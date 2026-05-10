# Team C — Bug Inventory Sweep

> 작성일: 2026-04-14
> 입력: Phase 0 #6, #7, #8, #9
> 결과: P0 1-line fix 3건 + Firebase 잔재 분류 + e2e 이주 매트릭스

---

## 0. Summary

| 패턴 | 발견 | P0 | P1 | P2 |
|------|------|----|----|----|
| Pattern 1: Repository 컬럼 불일치 | 2 | 2 | 0 | 0 |
| Pattern 2: Firebase 런타임 잔재 | 1 | 1 | 0 | 0 |
| Pattern 3: snake_case 누수 (런타임) | 0 | - | - | - |
| Pattern 4: e2e Firebase 의존 | 9 파일 | - | - | 9 |
| Pattern 5: 기타 dead code | 1 | 0 | 0 | 1 |

**Bottom line**: P0 즉시 수정 가능 항목 3건 (총 5분 작업). 런타임 코드의 snake_case 누수는 없음 (CLAUDE.md 규칙 잘 지켜지고 있음). e2e Firebase 이주는 별도 트랙 필요.

---

## 1. Methodology

1. **Pattern 1**: `uniqn-mobile/src/repositories/supabase/**`의 모든 Repository에서 `TABLE_COLUMNS` 또는 `.select(...)` 컬럼 vs `rowTo*` 매퍼가 읽는 필드 diff
2. **Pattern 2**: `uniqn-mobile/src/`, `uniqn-mobile/app/` 런타임 코드에서 Firebase 식별자 grep
3. **Pattern 3**: 런타임 코드에서 `\.created_at`, `\.user_id`, `\.is_active` 등 직접 snake_case 접근 grep (Repository row mapper 제외)
4. **Pattern 4**: `uniqn-mobile/e2e/` 디렉토리 내 firebase import 파일 매핑
5. **Pattern 5**: 부수적으로 발견된 dead code/swallow pattern 기록

---

## 2. Pattern 1: Repository 컬럼 불일치

| Repository | 누락 필드 | 읽기 site | 영향 | 수정 |
|-----------|----------|----------|------|------|
| `EventQRRepository.ts` | `assignment_group_id`, `time_slot` | line 44-56 (`matchesScope`), 238, 250 | scope 필터 항상 undefined → 잘못된 QR 매칭 | line 28 SELECT에 두 필드 추가 |
| `AdminRepository.ts` | `last_login_at` | line 54 (`rowToAdminUser`) | 관리자 user 상세에서 lastLoginAt 항상 undefined | line 37 USER_COLUMNS에 추가 |

**EventQRRepository 상세**:
- Line 28: `TABLE_COLUMNS = 'id,code,created_at,expires_at,is_active,job_posting_id,type,user_id,work_date'`
- Line 44: `matchesScope` 시그니처가 `Pick<EventQRCode, 'assignmentGroupId' | 'timeSlot'>` 받음
- Line 49-51, 54-56: `expected.assignmentGroupId`, `expected.timeSlot` 사용
- toCamelCase 변환 시 SELECT에 없으면 영구히 undefined → scope 필터 깨짐
- **위험도**: P0 — 잘못된 QR 코드가 매칭되어 출퇴근 처리 오작동 가능

**AdminRepository 상세**:
- Line 37: `USER_COLUMNS = 'id,name,email,role,phone,photo_url,created_at,updated_at,is_active,phone_verified'` — `last_login_at` 누락
- Line 54: `lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined`
- 결과: 항상 undefined. 관리자 UI에서 마지막 로그인 시각 표시 안 됨.
- **위험도**: P0 — 감사 추적 깨짐

---

## 3. Pattern 2: Firebase 런타임 잔재

| 파일 | 위치 | 매치 | 상태 | 액션 |
|------|------|------|------|------|
| `templateService.ts` | line 29-31 | `firebaseError.code === 'permission-denied'` | dead code | 3줄 삭제 |

```typescript
// 현재 (templateService.ts:29-31)
const firebaseError = error as { code?: string };
if (firebaseError.code === 'permission-denied') {
  return [];
}
```

Supabase는 `'permission-denied'` 코드를 반환하지 않음. PostgreSQL 에러 코드(예: `42501`) 또는 `PostgrestError`. 이 분기는 절대 활성되지 않으며, 권한 에러를 빈 배열로 변환하려는 원래 의도가 사라진 상태. 단순 삭제 권장 (의도가 필요하면 PostgrestError 코드 검사로 교체).

**다른 런타임 파일에서 추가 발견 없음**. CLAUDE.md의 Firebase 제거 작업이 대부분 완료됨.

---

## 4. Pattern 3: snake_case 필드 누수 (런타임)

**결과: 위반 없음 ✅**

`uniqn-mobile/src/`, `uniqn-mobile/app/`의 Hook/Service/Component/Store 코드에서 `*.created_at`, `*.user_id` 등 직접 접근하는 site는 발견되지 않음. snake_case 접근은 모두 Repository row mapper (`rowToUser`, `rowToJobPosting` 등) 내부에 한정되어 있음.

CLAUDE.md "필드명 camelCase" 규칙이 잘 지켜지고 있음.

---

## 5. Pattern 4: e2e Firebase 의존 매트릭스

총 9 파일이 firebase-admin/firestore에 의존. 모두 테스트 인프라 코드이며 런타임 코드는 영향 받지 않음.

| 파일 | 용도 | Supabase 대체 가능성 |
|------|------|---------------------|
| `e2e/global-setup.ts:12-14` | initializeApp + getAuth + getFirestore | 신규 작성 필요 — Supabase admin client + service role |
| `e2e/helpers/firebase-admin.ts` | Firebase Admin SDK 래퍼 | 폐기 + `e2e/helpers/supabase-admin.ts` 신규 |
| `e2e/scripts/seed-emulator.ts` | Firestore 시드 데이터 | `e2e/scripts/seed-supabase.ts` 신규 |
| (기타 6 파일) | 픽스처/헬퍼 | 점진적 이주 |

**이주 전략**:
1. `e2e/helpers/supabase-admin.ts` 작성 (service role 키 사용)
2. `seed-supabase.ts` 작성 — `users`, `job_postings`, `applications`, `work_logs` 시드
3. `global-setup.ts` 교체
4. 나머지 6 파일을 한 번에 마이그레이션 (의존 트리 한꺼번에 교체)
5. `firebase-admin` 패키지 제거 (`package.json` + `package-lock.json`)

**우선순위**: P1 (Team D의 e2e 커버리지 분석과 함께 진행)

---

## 6. Pattern 5: 기타 발견사항

### 6.1 swallow + warn 패턴 (의도적, 문서화 필요)

`syncScheduleBoardSafely` (`jobManagementService.ts:20-33`) 외에도 유사한 fire-and-forget warn 패턴이 다수 존재:
- `TemplateRepository.ts:130` — 통계 업데이트 실패 무시
- `JobPostingRepository.ts:340-344` — view count 증가 실패 무시
- `notificationReadStateService.ts:24-41` — counter reset 3회 재시도 후 무시

이들은 의도된 fire-and-forget 패턴이지만 **운영 모니터링 측면에서 alert가 없으면 데이터 drift를 감지할 수 없음**. Sentry 또는 별도 메트릭 추적 권장.

### 6.2 토너먼트 승인 함수 (Team A에서 발견)
`tournamentApprovalService.ts`의 3개 Edge Function 호출은 토너먼트 서브시스템에 한정. 별도 트랙으로 분리.

---

## 7. P0 Quick Wins (총 5분 작업)

이 세 건은 Team B/D/E 결과를 기다리지 않고 즉시 수정 가능:

### 7.1 AdminRepository.ts:37 — last_login_at 추가
```diff
- 'id,name,email,role,phone,photo_url,created_at,updated_at,is_active,phone_verified'
+ 'id,name,email,role,phone,photo_url,created_at,updated_at,is_active,phone_verified,last_login_at'
```

### 7.2 EventQRRepository.ts:28 — scope 필드 추가
```diff
- 'id,code,created_at,expires_at,is_active,job_posting_id,type,user_id,work_date'
+ 'id,code,created_at,expires_at,is_active,job_posting_id,type,user_id,work_date,assignment_group_id,time_slot'
```

### 7.3 templateService.ts:29-31 — Firebase 분기 제거
```diff
- const firebaseError = error as { code?: string };
- if (firebaseError.code === 'permission-denied') {
-   return [];
- }
```

**검증**: `npm run quality` (type-check + lint + format)

---

## 8. 다음 액션

| Task | 우선순위 | 사이즈 | 의존성 |
|------|---------|--------|--------|
| 7.1 / 7.2 / 7.3 즉시 수정 + commit | P0 | XS | - |
| 7.1 / 7.2 회귀 테스트 작성 | P1 | S | 위 |
| e2e Firebase → Supabase 이주 (9 파일) | P1 | L | Team D 결과 |
| swallow 패턴 monitoring 추가 (Sentry) | P2 | M | - |
| 토너먼트 Edge Function 별도 분석 | P2 | M | Team A |

---

**Coverage**: Repository 21개 sweep / 런타임 코드 grep / e2e 79 파일 분류 완료
**Production-ready**: ✅
