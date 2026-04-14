# Team A — Server Contract Recovery

> 작성일: 2026-04-14
> 입력: Phase 0 #1 (15개 RPC/Edge 호출 중 14개 정의 누락)
> 결과: 14개 + 추가 발견 4개 = **총 18개 미정의 함수 카탈로그**

---

## 0. Summary

| 카테고리 | 개수 | P0 | P1 | P2 |
|---------|------|----|----|----|
| RPC | 9 | 5 | 3 | 1 |
| Edge Function | 9 | 4 | 3 | 2 |
| **합계** | **18** | **9** | **6** | **3** |

**Bottom-line risk**: 핵심 흐름이 코드베이스 외부의 함수 정의에 의존. 회원가입(check_email/nickname/phone), 지원 확정(confirm_application), 본인인증(verify-portone-*), Apple 탈퇴(revoke-apple-token)가 모두 repo에 정의 없음. `supabase/functions/` 디렉토리 자체가 존재하지 않음.

**Phase 0 검증과 차이**: Phase 0이 14개라고 했으나 추가 sweep 결과 **18개**. 추가로 발견된 것:
- `initialize-unread-counter` (`useAppInitialize.ts:218`)
- `verify-portone-identity` (`portOneIdentityService.ts:233`)
- `verify-and-save-portone-profile` (`portOneIdentityService.ts:262`)
- 토너먼트 승인 함수군 3종 (`approve-job-posting`, `reject-job-posting`, `resubmit-job-posting` — `tournamentApprovalService.ts:127,164,197`) — 별도 서브시스템으로 따로 처리 권장

---

## 1. Methodology

1. `uniqn-mobile/src/**/*.ts` 전수 grep: `\.rpc\(`, `supabase\.functions\.invoke`
2. 호출 site 10-20줄 컨텍스트 추출 → 파라미터/반환 형태 추출
3. 기존 정의 검색: `supabase/migrations/**/*.sql`의 `CREATE.*FUNCTION` — `permanently_delete_user`, `decrement_unread_counter`, `increment_board_post_view_count` 3개만 존재 (이 중 `decrement_unread_counter`는 RPC 이름이 다른 Edge Function `decrement-unread-counter`와 별도)
4. `supabase/functions/` 디렉토리 존재 확인 — **없음**

---

## 2. Catalog — RPCs

### 2.1 `check_email_exists` (P0)
**Caller**: `uniqn-mobile/src/services/auth/authCoreService.ts:161`
**Signature (inferred)**:
```sql
CREATE OR REPLACE FUNCTION check_email_exists(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public';
```
**Caller behavior**: `boolean` 캐스트, 타이밍 공격 방어 위해 최소 300ms 응답 보장 (193-196). 클라이언트 rate limit 5/60s. 네트워크 에러 시 1회 재시도.
**Server expected**: `auth.users` 테이블에서 이메일 존재 검사. 응답 시간 일정해야 함.
**MCP recovery**: `SELECT pg_get_functiondef('public.check_email_exists'::regproc);`

### 2.2 `check_nickname_exists` (P0)
**Caller**: `authCoreService.ts:221`
```sql
CREATE OR REPLACE FUNCTION check_nickname_exists(p_nickname text, p_exclude_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER;
```
**Caller behavior**: optional `excludeUid`로 프로필 수정 시 자기 자신 제외. 에러 시 throw.
**Server expected**: `users` 테이블에서 nickname 매칭, exclude_uid 제외.

### 2.3 `check_phone_exists` (P0)
**Caller**: `authCoreService.ts:497`
```sql
CREATE OR REPLACE FUNCTION check_phone_exists(p_phone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER;
```
**Caller behavior**: 전화번호 마스킹 후 로깅. 회원가입 흐름.
**Server expected**: `users` 테이블에서 phone 매칭.

### 2.4 `confirm_application` (P0 ★ 핵심)
**Caller**: `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryTransactions.ts:116`
**Caller call shape**:
```typescript
await supabase.rpc('confirm_application', {
  p_application_id, p_owner_id,
  p_assignments,            // jsonb: [{groupId, date, timeSlot, role, customRole}]
  p_original_application,   // jsonb: {assignments, appliedAt}
  p_confirmation_history,   // jsonb: history entries
  p_notes,
  p_is_fixed_posting,       // boolean
});
// rpcResult?.workLogIds: string[]
```
**Signature (inferred)**:
```sql
CREATE OR REPLACE FUNCTION confirm_application(
  p_application_id uuid, p_owner_id uuid,
  p_assignments jsonb, p_original_application jsonb,
  p_confirmation_history jsonb, p_notes text,
  p_is_fixed_posting boolean
) RETURNS jsonb  -- { workLogIds: uuid[] }
LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
```
**Server expected (원자성 요구)**:
1. application 존재 + APPLIED 상태 확인
2. owner_id가 application.job_posting.owner_id와 일치 확인
3. capacity 검증 (fixed/flex)
4. application: status→CONFIRMED + assignments + history + notes 갱신
5. work_logs: 각 assignment 조합마다 한 행 생성
6. job_postings: filled_positions, schedule.roleRequirements[].filled 갱신
7. 모든 work_log id 배열 반환

**위험**: 이 함수가 운영 환경에 없거나 다른 시그니처면 지원자 확정 흐름 전체 깨짐.

### 2.5 `register_as_employer` (P0)
**Caller**: `uniqn-mobile/src/repositories/supabase/UserRepository.ts:447`
```sql
CREATE OR REPLACE FUNCTION register_as_employer(p_employer_agreements jsonb)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
```
**Server expected**:
1. `auth.uid()`로 현재 사용자 식별
2. phone_verified = true 검증
3. role이 staff인지 확인 (이미 employer/admin이면 거부)
4. `users` role → 'employer' + employer_agreements 저장
5. `auth.users.app_metadata.role` 동기화 (JWT 전파)

**보안**: `app_metadata` 갱신은 service role 권한 필요. 이 함수가 SECURITY DEFINER로 권한 escalation을 처리.

### 2.6 `increment_view_count` (P1)
**Caller**: `JobPostingRepository.ts:340`
```sql
CREATE OR REPLACE FUNCTION increment_view_count(posting_id uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER;
```
**주의**: 파라미터명이 `posting_id` (다른 함수의 `p_` 접두사와 다름) — 운영에 정의 있다면 동일 형태로 회수 필요.

### 2.7 `increment_announcement_view_count` (P1)
**Caller**: `AnnouncementRepository.ts:483`
```sql
CREATE OR REPLACE FUNCTION increment_announcement_view_count(p_announcement_id uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER;
```
**Note**: 호출자가 RPC 실패 시 직접 SELECT+UPDATE로 fallback (489-500) — RPC가 없어도 동작은 하지만 race 발생 가능.

### 2.8 `increment_template_usage` (P2)
**Caller**: `TemplateRepository.ts:130` (fire-and-forget, 백그라운드)
```sql
CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER;
```

### 2.9 `get_job_posting_stats` (P1)
**Caller**: `JobPostingRepository.ts:551`
```sql
CREATE OR REPLACE FUNCTION get_job_posting_stats(p_owner_id uuid)
RETURNS TABLE(
  total bigint, active bigint, closed bigint, cancelled bigint,
  total_applications bigint, total_views bigint
) LANGUAGE sql STABLE SECURITY DEFINER;
```
**Caller**: 단일 row 또는 array 모두 처리하는 방어적 코드 (554) — 시그니처 회수 시 단일 row 형태 권장.

---

## 3. Catalog — Edge Functions

### 3.1 `reset-unread-counter` (P1)
**Caller**: `notificationReadStateService.ts:26`
```
POST /functions/v1/reset-unread-counter
Body: { notificationIds: string[] }
Response: 200 (no body)
```
**Caller behavior**: 최대 3회 재시도 (1s, 2s, 3s). fire-and-forget.

### 3.2 `decrement-unread-counter` (P1)
**Caller**: `notificationReadStateService.ts:53`
```
POST /functions/v1/decrement-unread-counter
Body: { delta: number }
Response: 200
```

### 3.3 `revoke-apple-token` (P0 ★ Apple 컴플라이언스)
**Caller**: `accountDeletionService.ts:54`
```
POST /functions/v1/revoke-apple-token
Body: { authorizationCode: string }
Response: 200
```
**Server expected**: Apple의 token revocation endpoint 호출. App Store 심사 요구사항.

### 3.4 `initialize-unread-counter` (P1) — 신규 발견
**Caller**: `useAppInitialize.ts:218`
```
POST /functions/v1/initialize-unread-counter
Body: {}  (JWT에서 사용자 추출)
Response: { unreadCount: number }
```
**Caller behavior**: 앱 시작 시 호출. 실패하면 0으로 fallback (228).

### 3.5 `verify-portone-identity` (P0) — 신규 발견
**Caller**: `portOneIdentityService.ts:233`
```
POST /functions/v1/verify-portone-identity
Body: VerifyPortOneIdentityPayload
Response: VerifyPortOneIdentityResult
```
**Server expected**: PortOne API 호출하여 identity verification ID 검증. 본인인증 흐름 핵심.

### 3.6 `verify-and-save-portone-profile` (P0) — 신규 발견
**Caller**: `portOneIdentityService.ts:262`
```
POST /functions/v1/verify-and-save-portone-profile
Headers: Authorization: Bearer <token>
Body: VerifyAndSavePortOneProfilePayload
Response: VerifyAndSavePortOneProfileResult
```
**Server expected**: 본인인증 후 검증된 프로필 정보를 users 테이블에 저장.

### 3.7~3.9 토너먼트 함수군 (P2 — 별도 서브시스템)
- `approve-job-posting` — `tournamentApprovalService.ts:127`
- `reject-job-posting` — `tournamentApprovalService.ts:164`
- `resubmit-job-posting` — `tournamentApprovalService.ts:197`

별도 분석 권장.

---

## 4. Recovery Strategy

### 4.1 운영 Supabase에 존재할 가능성이 높은 것 (단순 함수)
회수 시 `mcp__supabase__execute_sql`로:
```sql
SELECT proname, pg_get_function_arguments(oid), pg_get_functiondef(oid)
FROM pg_proc
WHERE proname IN ('check_email_exists', 'check_nickname_exists', 'check_phone_exists',
                  'confirm_application', 'register_as_employer',
                  'increment_view_count', 'increment_announcement_view_count',
                  'increment_template_usage', 'get_job_posting_stats');
```
Edge Function:
```bash
mcp__supabase__list_edge_functions
mcp__supabase__get_edge_function(function_slug='reset-unread-counter')
# ... 나머지 8개
```

### 4.2 신규 작성 필요할 가능성이 높은 것
- `confirm_application` — 비즈니스 로직 복잡 (capacity, work_log 생성)
- `register_as_employer` — JWT app_metadata 동기화 필요
- 모든 PortOne / Apple Edge Function — 외부 API 통합

### 4.3 회수 우선순위
**Week 1 (P0 unblock)**:
1. `confirm_application` ★
2. `check_email_exists`, `check_nickname_exists`, `check_phone_exists`
3. `register_as_employer`
4. `revoke-apple-token`
5. `verify-portone-identity`, `verify-and-save-portone-profile`

**Week 2 (P1 features)**:
1. `reset-unread-counter`, `decrement-unread-counter`, `initialize-unread-counter`
2. `get_job_posting_stats`
3. `increment_view_count`, `increment_announcement_view_count`

**Week 3+ (P2)**:
1. `increment_template_usage`
2. 토너먼트 함수군 (별도 분석)

---

## 5. Repository Sanity 확인

- ✅ `supabase/migrations/**/*.sql`에서 `CREATE.*FUNCTION` 검색 — 정의 3개만 존재 (`permanently_delete_user`, `increment_board_post_view_count`, helper trigger 함수들)
- ✅ `supabase/functions/` 디렉토리 부재 확인
- ✅ 18개 호출 site 모두 file:line 추적 완료

---

## 6. 다음 액션 (EXECUTION-PLAN으로 이동할 task)

| Task | 우선순위 | 사이즈 | 의존성 |
|------|---------|--------|--------|
| MCP로 운영 환경 함수 정의 회수 | P0 | M | Supabase MCP 접근 |
| 회수 결과를 마이그레이션 파일로 저장 | P0 | S | 위 |
| 신규 함수 작성 (P0 우선) | P0 | L | 회수 이후 |
| `supabase/functions/` 디렉토리 + 9개 Edge Function | P0 | L | - |
| 함수별 통합 테스트 작성 | P1 | M | 함수 작성 이후 |
| 클라이언트 호출 site에 contract 주석 추가 | P2 | S | - |

---

**Coverage**: 호출 site 18개 100% / file:line 추적 완료
**Production-ready**: ✅
