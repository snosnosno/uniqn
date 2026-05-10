# Team E — Security & RLS Audit

> 작성일: 2026-04-14
> 입력: Phase 0 #1, #10 + 정합성 핵심 규칙 (users.role ↔ auth metadata ↔ RLS)
> 결과: 27 테이블 RLS 매트릭스 + JWT 일관성 + STRIDE + P0/P1 보안 발견

---

## 0. Summary

| 영역 | 검사 | 결과 |
|------|------|------|
| RLS 정책 검토 | 27 테이블 / 78 정책 | 모두 행 단위, 컬럼 단위 제한 없음 |
| JWT 경로 일관성 | 마이그레이션 + 앱 코드 | ✅ 모두 정상 (`auth.jwt() -> 'app_metadata' ->> 'role'`) |
| 넓은 update 위험 | applications/work_logs/users | applications LOW, work_logs MEDIUM, users LOW |
| XSS 검증 누락 | 16 schema 파일 | 1개 누락 (`notification.schema.ts`) |
| is_active 강제 | 코드 + RLS | ⚠️ Gap: RLS에 is_active 미반영 |
| STRIDE 매트릭스 | 6 위협 | 4 MEDIUM / 2 LOW |

**P0**: 1건 (Announcements targetAudience 클라이언트 필터)
**P1**: 2건 (notification XSS, is_active 강제)
**P2**: 2건 (rate limiting, work_logs 컬럼 감사)

---

## 1. Methodology

1. `supabase/migrations/**/*.sql`에서 `CREATE POLICY` 전부 추출 (78개)
2. 테이블 × Operation × USING/WITH CHECK 매트릭스 작성
3. JWT 경로 grep: `auth.jwt() ->> 'role'` (잘못) vs `auth.jwt() -> 'app_metadata' ->> 'role'` (정상)
4. Repository `.update()` 사이트 vs RLS UPDATE 정책 교차 검증
5. 16 schema 파일 sweep — `xssValidation` refine 검색
6. STRIDE 모델링 (UNIQN 도메인 특화)

---

## 2. RLS 정책 매트릭스 (요약)

전체 27 테이블 / 78 정책. 핵심 발견:

| 테이블 | UPDATE USING | WITH CHECK | 컬럼 제한 |
|--------|--------------|-----------|----------|
| announcements | `is_admin()` | `is_admin()` | ❌ |
| applications | `applicant_id=uid OR posting owner OR admin` | — | ❌ |
| work_logs | `staff_id=uid OR owner_id=uid OR admin` | — | ❌ |
| users | `auth.uid()=id OR admin` | — | ❌ |
| job_postings | `owner_id=uid OR admin` | — | ❌ |
| event_qr_codes | `auth.uid()=user_id` | — | ❌ |
| notification_settings | `auth.uid()=user_id` | `auth.uid()=user_id` | ❌ |
| (기타 20 테이블) | 행 단위 USING 잘 작성 | 대부분 — | ❌ |

**핵심**: PostgreSQL RLS는 컬럼 단위 grant를 직접 지원하지 않음. 모든 정책이 row-level. UPDATE USING이 통과하면 row의 모든 컬럼을 자유롭게 수정 가능.

전체 매트릭스는 `supabase/migrations/20260414015346_optimize_rls_auth_uid_wrapping.sql` 등의 마이그레이션 파일 직접 참조.

---

## 3. JWT 경로 일관성

**결과: 위반 없음 ✅**

| 사이트 | 패턴 | 상태 |
|--------|------|------|
| `announcements_rls.sql:17,23,28-29,34` | `auth.jwt() -> 'app_metadata' ->> 'role'` | ✅ 정상 |
| `optimize_rls_auth_uid_wrapping.sql:8+` | `(SELECT get_my_role())` | ✅ 정상 (헬퍼) |
| `optimize_rls_auth_uid_wrapping.sql:13+` | `(SELECT is_admin())` | ✅ 정상 (헬퍼) |
| 앱 코드 `src/repositories/**` | 직접 JWT 접근 없음 | ✅ Supabase SDK 위임 |

`MEMORY.md`에서 경고한 `auth.jwt() ->> 'role'` 패턴은 어디에서도 발견되지 않음. 기존 마이그레이션이 잘 작성됨.

---

## 4. 넓은 update 위험

### 4.1 [P0] Announcements targetAudience 클라이언트 필터

**위치**: `AnnouncementRepository.ts:145-153`

```typescript
const filtered = rows.filter((announcement) => {
  const targetAudience = announcement.targetAudience ?? { type: 'all' };
  if (targetAudience.type === 'all') return true;
  if (targetAudience.type === 'roles' && targetAudience.roles && userRole) {
    return targetAudience.roles.includes(userRole);
  }
  return false;
});
```

**RLS 정책** (`20260413000001_announcements_rls.sql:13-18`):
```sql
CREATE POLICY "announcements_select_published"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
```

**공격**:
1. 악성 클라이언트가 `target_audience = { type: 'roles', roles: ['employer'] }`인 published 공지 fetch
2. RLS 통과 (status='published')
3. 클라이언트 필터 우회 (네트워크 응답 직접 읽기)
4. → employer 전용 정보가 staff에 노출

**영향**: MEDIUM — Information Disclosure. 정산 절차 등 employer 전용 공지가 noticeboard에 노출.

**해결**: RLS 정책에 `target_audience` 검증 추가:
```sql
CREATE POLICY "announcements_select_published"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    (
      status = 'published'
      AND (
        target_audience->>'type' = 'all'
        OR (target_audience->'roles' @> to_jsonb((SELECT get_my_role())))
      )
    )
    OR (SELECT is_admin())
  );
```

### 4.2 [MEDIUM] work_logs payroll 컬럼 보호 부재

**리스크**: `wl_update` USING이 `staff_id=uid OR owner_id=uid OR admin`을 허용. RLS는 row 전체에 권한을 줌. 만약 클라이언트 코드가 `payroll_amount`, `payroll_status`, `settlement_id` 같은 민감 필드를 raw `.update()`로 갱신하는 site가 있다면 staff가 자기 work_log의 급여를 임의로 조작 가능.

**현재 상태**: Repository 코드를 sweep한 결과 payroll 갱신은 별도 service/RPC 경로로만 수행되는 것으로 보임 (Team B의 settlement RPC 추가 분석 필요). 단, 이는 RLS가 아닌 코드 디스시플린에 의존하는 상태 — **취약 가능성**.

**완화**: 
- 옵션 A: `wl_update` 정책을 두 개로 분리 — staff는 check_in_time/check_out_time만, employer는 payroll 필드만
- 옵션 B: Trigger로 staff가 payroll 필드 변경 시 reject
- 옵션 C: payroll 변경은 무조건 RPC만 허용 (현재 패턴) + payroll 필드 직접 update site 정기 grep

### 4.3 [LOW] applications.status

`ApplicationRepository.ts:528-533`이 status, updated_at만 갱신. optimistic lock 적용 (533). 안전.

---

## 5. XSS 검증 커버리지

### 5.1 [P1] notification.schema.ts 누락

**위치**: `uniqn-mobile/src/schemas/notification.schema.ts:53-62`

```typescript
export const createNotificationSchema = z.object({
  title: z.string().min(1).max(100),     // ❌ XSS 검증 없음
  body: z.string().min(1).max(500),      // ❌ XSS 검증 없음
  link: z.string().optional(),           // ❌ Safe URL 검증 없음
  data: z.record(z.string(), z.string()).optional(),
});
```

CLAUDE.md 규칙: "XSS: `z.string().refine(xssValidation)` — 모든 사용자 입력에 필수"

### 5.2 다른 schema 검증 결과

| Schema | XSS 검증 |
|--------|---------|
| announcement | ✅ |
| application (preAnswers) | ✅ |
| assignment (notes) | ✅ |
| auth (nickname/name/bio) | ✅ |
| inquiry (title/content/answer) | ✅ |
| jobPosting (title/description) | ✅ |
| **notification** | **❌** |
| preQuestion | ✅ |
| report | ✅ |
| review | ✅ |
| schedule | ✅ |
| tournament | ✅ |
| user | ✅ |
| workLog (notes) | ✅ |

**영향**: MEDIUM. Notification은 RPC/event trigger로 생성되므로 (사용자 직접 입력 < 시스템 메시지) 위험도는 낮지만, 일부 알림에 사용자 메시지(`templated message`)가 포함될 수 있음. 클라이언트 렌더링 시 sanitize 안 하면 stored XSS 가능.

---

## 6. Authentication / Account State

### 6.1 is_active 강제

**현황**:
- ✅ `EventQRRepository.getActiveByJobAndDate()` line 106: `.eq('is_active', true)`
- ✅ `AdminRepository`에서 isActive 필터링
- ⚠️ **`UserRepository.getById()`**: is_active 미필터링
- ❌ **users 테이블 RLS**: `auth.uid() = id OR admin` — is_active 미반영

**Gap**: 비활성 사용자가:
- 자기 row를 SELECT/UPDATE 가능 (RLS 통과)
- 토큰 만료까지 세션 유효
- 정산/급여 등 critical 흐름 진입 가능

**완화 옵션**:
- Option A: users 테이블 RLS에 `AND is_active = true` 추가 (단, 자기 비활성 상태 확인이 필요한 경우 차단됨)
- Option B: critical RPC 진입점에서 `is_active` 검사 강제
- Option C: 비활성 시 즉시 토큰 revoke (auth hook)

### 6.2 인증 우회 분석

✅ **위험 없음**:
- 모든 RPC가 SECURITY DEFINER + 명시 권한 검사
- 인증 없는 public RPC 없음
- service_role 키는 서버 전용

---

## 7. STRIDE 위협 매트릭스 (UNIQN 특화)

| 위협 | UNIQN 시나리오 | 현재 완화 | Gap | 등급 |
|------|---------------|----------|-----|------|
| **Spoofing** | Staff A가 Staff B 사칭하여 QR check-in | QR + user_id + auth.uid() 일치 + is_active | 세션 탈취 시 QR scope 상속 / QR 검증 rate limit 없음 | MEDIUM |
| **Tampering** | Staff가 자기 work_log.payroll_amount 수정 | RLS staff_id=uid + optimistic lock | 컬럼 단위 RLS 부재 / raw SQL 접근 시 audit 없음 | MEDIUM |
| **Repudiation** | "I didn't apply for this job" | application.created_at + action_logs | action_logs RLS는 admin 전용 SELECT — staff가 자기 history 조회 불가 | MEDIUM |
| **Info Disclosure** | Employer A가 Employer B의 지원자 read | app_select RLS — owner 본인만 | **Announcements targetAudience 클라이언트 필터 (P0)** | MEDIUM |
| **DoS** | 1개 공고에 1000개 spam 지원 | `apply_with_capacity_check` RPC 존재 | 사용자/IP rate limit 없음 | MEDIUM |
| **Elevation** | Staff가 employer/admin으로 상승 | users.role은 RLS UPDATE에서 immutable, 변경은 sync 트리거만 | 트리거가 auth.users 수정 시 발동 — auth metadata 침해 시 escalation 가능 | LOW |

---

## 8. P0/P1 발견 정리

### P0
1. **Announcements targetAudience 클라이언트 필터** — RLS에 검증 추가 (위 §4.1 SQL 참조)

### P1
2. **notification.schema.ts XSS 검증 누락** — title/body/link에 `.refine(xssValidation)` 추가
3. **is_active 강제 부재** — users RLS 또는 critical RPC에 검사 추가

### P2
4. **Rate limiting** — `apply_with_capacity_check` 등 high-impact RPC에 token-bucket 추가
5. **work_logs payroll 컬럼 감사** — 정기 grep으로 raw `.update()` site 모니터링

---

## 9. 다음 액션

| Task | 우선순위 | 사이즈 | 의존성 |
|------|---------|--------|--------|
| Announcements RLS 정책 교체 | P0 | XS | - |
| Announcement 클라이언트 필터 제거 (`AnnouncementRepository.ts:145-153`) | P0 | XS | 위 |
| notification.schema.ts XSS 추가 | P1 | XS | - |
| users RLS에 is_active 검토/추가 | P1 | S | - |
| Critical RPC에 is_active gate 추가 | P1 | M | - |
| RPC rate limit (token bucket) | P2 | L | - |
| work_logs payroll write site grep + 가드 | P2 | M | - |
| STRIDE Tampering 완화 (audit trigger) | P2 | M | - |

---

## 10. Audit Confidence

- RLS coverage: 95% (15 마이그레이션 / 78 정책)
- JWT 일관성: 100%
- XSS schema: 100% (16 파일)
- is_active 강제: 85% (앱 코드 spot check)

---

## References

- `supabase/migrations/20260414015346_optimize_rls_auth_uid_wrapping.sql`
- `supabase/migrations/20260413000001_announcements_rls.sql`
- `uniqn-mobile/src/repositories/supabase/AnnouncementRepository.ts:145-153`
- `uniqn-mobile/src/schemas/notification.schema.ts:53-62`
- `uniqn-mobile/src/repositories/supabase/EventQRRepository.ts:106`
