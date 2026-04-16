# Phase 1 구현 계획: 구인자 등록 관리자 승인 플로우 (DB 기반)

> 설계 문서: `.gstack/projects/snosnosno-uniqn/user-master-design-20260416-134945.md`
> 작성일: 2026-04-16 | 브랜치: master

---

## Pre-Implementation Gates 결과

| Gate                       | 판정           | 근거                                                                                             |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| Gate 1: Admin Push 인프라  | ✅ 조건부 통과 | pushNotificationService.ts 구현 완료. fcm_tokens 별도 테이블 미생성 버그 → Migration #1에서 수정 |
| Gate 2: 관리자 화면 UX     | ✅ 통과        | board-reports/[id].tsx 패턴 재사용 가능 (카드+하단 2버튼)                                        |
| Gate 3: 기존 employer 유저 | ✅ 통과        | 1명 (QA 테스트 계정: qa-employer@uniqn.test) → seed 마이그레이션 처리                            |

---

## 마이그레이션 파일 순서 (4개)

### Migration 1: `20260416130000_fcm_tokens_table.sql`

- Gate 1 버그 수정: `fcm_tokens` 별도 테이블 생성
- `users.fcm_tokens` JSONB 컬럼은 추후 DROP (이번 scope 외)
- RLS: 본인만 자신의 토큰 SELECT/DELETE. admin 전체 SELECT (push 발송용)

### Migration 2: `20260416140000_employer_applications_table.sql`

- `employer_applications` 테이블 + 인덱스 2개 + RLS 3개
- 컬럼: id, user_id, status, submitted_at, reviewed_at, reviewed_by,
  rejection_reason, rejection_category, agreements_snapshot, supersedes_id, created_at

### Migration 3: `20260416150000_employer_application_rpcs.sql`

RPC 4개:

1. `register_as_employer(agreements JSONB)` — 재작성. 기존 pending 체크 후 INSERT (status='pending')
2. `approve_employer_application(app_id UUID)` — admin only, self-approve 방지, 동시성 방지
3. `reject_employer_application(app_id UUID, reason TEXT, category TEXT)` — admin only, 동시성 방지
4. `get_latest_employer_application(target_user_id UUID)` — ORDER BY created_at DESC LIMIT 1

### Migration 4: `20260416160000_seed_existing_employers.sql`

- 기존 `role='employer'` 유저 (QA 테스트 계정 1명) → `status='approved'` 이력 INSERT
- `agreements_snapshot`: 기존 `employer_agreements` 값 복사, 없으면 `{"_seeded": true}`
- `reviewed_by`: NULL (시스템 seed)

---

## 에러 코드 신규 추가 (E6070~)

`src/errors/AppError.ts`의 `ERROR_CODES`에 추가:

```
BUSINESS_EMPLOYER_APP_PENDING_EXISTS: 'E6070'   // 이미 심사 중인 신청 있음
BUSINESS_EMPLOYER_APP_ALREADY_PROCESSED: 'E6071' // 이미 처리된 신청 (동시성 충돌)
BUSINESS_EMPLOYER_APP_SELF_APPROVE: 'E6072'      // 본인 신청 직접 처리 시도
BUSINESS_EMPLOYER_APP_NOT_FOUND: 'E6073'         // 신청 내역 없음
```

RPC 에러 → AppError 매핑 (RPC는 `RAISE EXCEPTION` + message prefix로 식별):

| RPC 에러 조건          | AppError 코드                                |
| ---------------------- | -------------------------------------------- |
| admin 아님             | E2012 (AUTH_REQUIRED / 권한 없음으로 재사용) |
| 이미 pending 신청 존재 | E6070                                        |
| 이미 처리된 신청       | E6071                                        |
| self-approve 시도      | E6072                                        |
| 신청 없음              | E6073                                        |
| DB 제약 위반           | E4001 (INFRA_PERMISSION_DENIED)              |
| 기타                   | E7000 (UNKNOWN)                              |

---

## Phase별 완료 기준

### Phase 1 (이번 작업): DB 기반

- [ ] Migration 1~4 작성 완료
- [ ] Supabase MCP로 staging 적용 성공
- [ ] RPC 동작 검증 (SQL 직접 테스트)
  - `register_as_employer`: pending INSERT 확인, users.role 변경 없음 확인
  - `approve_employer_application`: users.role='employer' 변경 확인
  - `reject_employer_application`: users.role 변경 없음 확인
  - 동시성 충돌 시나리오: 두 번 approve → 두 번째 에러 확인
  - self-approve 시도: 에러 확인
  - 동일 유저 두 번째 pending 신청: 에러 확인
- [ ] seed 적용 결과: QA 계정 approved 이력 1개 존재 확인
- [ ] RLS 검증: 비관리자로 타 유저 application 조회 시도 → 빈 결과

### Phase 2 (다음 작업): Service/Repository 계층

- `EmployerApplicationRepository.ts` (신규)
- `src/services/admin/employerApplicationService.ts` (신규)
- `profileService.ts` → `registerAsEmployer` 재작성
- `UserRepository.ts` → `registerAsEmployer` 수정
- `src/errors/BusinessErrors.ts` → EmployerApplication 에러 클래스 추가

### Phase 3 (다음 작업): UI

- `app/(app)/employer-register.tsx` → "승인 대기 중" 화면 전환
- `app/(app)/employer-application-status.tsx` (신규)
- `app/(admin)/employer-applications/index.tsx` (신규, 목록+필터)
- `app/(admin)/employer-applications/[id].tsx` (신규, board-reports 패턴 재사용)
- `app/(admin)/_layout.tsx` → 메뉴 추가
- `src/hooks/auth/useEmployerApplication.ts` (신규)
- 알림 3종 (유저) + 1종 (관리자)

---

## PR 분할 방안

| PR    | 포함 내용                    | 리뷰 포인트                          |
| ----- | ---------------------------- | ------------------------------------ |
| PR #1 | Migration 1~4 (DB 기반)      | RLS 정책, RPC 권한 검증, 동시성 처리 |
| PR #2 | Phase 2 (Service/Repository) | 아키텍처 준수, 에러 처리             |
| PR #3 | Phase 3 (UI)                 | UX 플로우, 다크모드, 알림 연동       |

---

## 롤아웃 순서 (설계 문서 Distribution Plan 준수)

1. Pre-Implementation Gates 통과 ✅ (완료)
2. Migration #1 (fcm_tokens 테이블)
3. Migration #2 (employer_applications 테이블)
4. Migration #3 (RPC 4개)
5. Migration #4 (기존 employer seed)
6. Phase 2: Service/Repository/Error 계층
7. Phase 3: UI (관리자 화면 포함)
8. staging E2E 1회: 신청 → 승인 → 거부 → 재신청
9. OTA 배포

---

## 주의사항

- **동시 유지 없이 원자적 교체**: `register_as_employer` RPC를 재작성하므로, 배포 직후부터 새 플로우만 작동
- **커밋 금지**: 사용자가 `/commit`으로 명시 요청 시에만 커밋
- **테스트**: SQL 직접 검증 (Jest DB 테스트는 Phase 2에서 Service 계층과 함께 작성)
