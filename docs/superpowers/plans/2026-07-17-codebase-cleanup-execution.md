# 전체 코드 정리 실행 계획 (SDD) — 2026-07-17

> 근거 분석: `docs/analysis/2026-07-16-full-codebase-cleanup-analysis.md` (fable 적대검증 3축 완료)
> 워크트리: `C:\Users\user\Desktop\T-HOLDEM-cleanup` · 브랜치 `refactor/codebase-cleanup` (master @cb825815e 기반)
> 선행 완료: A1(정산 taxSettings 배선 @8a73d33b6) · A2(duration 재배선 @64b4801a1)

## Global Constraints (모든 태스크 공통 — 구속력 있음)

1. **기능·UI 무변경이 기본값.** 사용자에게 보이는 문자열·레이아웃·동작을 바꾸지 않는다. 버그 수정 태스크(T1~T4)만 명세된 동작 변경 허용.
2. 작업 디렉토리는 `C:\Users\user\Desktop\T-HOLDEM-cleanup\uniqn-mobile` (워크트리). 본 트리(`C:\Users\user\Desktop\T-HOLDEM`)는 절대 건드리지 않는다.
3. `src/components/employer/order-sheet/**`, `src/components/employer/job-form/**`, `src/utils/job-posting/draftAdapter.ts`, ops 경로(`src/**/ops/**`, `app/(ops)/**`)는 **수정 금지** (타 세션 작업 중 / S3·S4 별도 계획).
4. 금지: `mcp__supabase__*` 호출, 마이그레이션 파일 수정, push/PR, 본 트리 파일 접근.
5. 커밋: 태스크당 1커밋, `<type>(<scope>): <한글>` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. pre-commit 훅이 ESLint/Prettier 자동 실행.
6. 모든 응답·주석·커밋 한글. `console.log` 금지(`logger` 사용). `@/` 절대 경로.
7. 삭제 태스크: 각 심볼 삭제 **직전** `grep -rn "<심볼>" src app --include="*.ts*"` 로 프로덕션 참조 0 재확인. 참조가 발견되면 삭제하지 말고 보고서에 SKIPPED로 기록.
8. 테스트: 변경 파일을 커버하는 스위트만 실행(`npx jest <경로>`), 전체 스위트 금지. 회귀 테스트는 red-green(수정 되돌려 FAIL 확인) 원칙 — 되돌리기가 위험하면 논리적 RED 근거를 보고서에 명시.
9. 타입 게이트: 태스크 종료 전 `npx tsc --noEmit` EXIT 0.

---

## Task 1: A3 — 로그아웃 시 푸시토큰 서버 해제

**문제 (fable-datasec 확인)**: `authCoreService.signOut`(src/services/auth/authCoreService.ts:382-410)이 Realtime·biometric·세션만 정리하고 푸시토큰을 해제하지 않는다. `pushTokenService.unregisterToken`(src/services/notifications/internal/pushTokenService.ts:169-172)은 인메모리 토큰(`pushNotificationState.ts:23-35`, 영속화 없음) 부재 시 서버 삭제 없이 true 반환. 결과: 로그아웃 후에도 fcm_tokens 행(user_id,token — NotificationRepository.ts:557-566 upsert) 잔존 → 이전 계정 푸시 계속 수신, 공용 기기에서 계정 간 알림 노출.

**요구사항**:
1. signOut **서두**(세션이 아직 유효한 시점 — RLS상 signOut 후엔 삭제 불가)에 푸시토큰 서버 해제를 추가한다.
2. 인메모리 토큰이 있으면 해당 토큰만 삭제, 없으면 현재 userId의 전체 토큰 삭제 폴백(NotificationRepository에 `unregisterAllFCMTokens(userId)` 계열 메서드가 있는지 확인, 없으면 Repository에 추가 — Service→Repository 계층 준수).
3. **fail-safe**: 푸시 해제 실패가 signOut 자체를 막으면 안 된다(기존 signOut의 "한쪽 실패해도 계속" 패턴 준수, logger.warn 기록).
4. 회귀 테스트: signOut이 푸시토큰 해제를 호출하는지(인메모리 有/無 두 경로), 해제 실패 시에도 signOut이 완료되는지. 기존 테스트 위치 참고: `src/services/auth/__tests__/`.

**검증**: 관련 스위트 + tsc. 보고서에 signOut 호출 순서(해제가 세션 종료 이전) 증거 포함.

---

## Task 2: A4 — 관리자 유저 검색 서버측 필터

**문제 (fable-datasec CONFIRMED)**: `AdminRepository.getUsers`(src/repositories/supabase/AdminRepository.ts:211-252)가 `count:'exact'`+`range`로 서버 페이지네이션 후 **클라이언트에서** search 필터 적용(:242-249), total/totalPages(:251-252)는 검색 미반영. 증상: 검색 시 현재 페이지 20행 내 매칭만 표시(타 페이지 매칭 누락), totalPages 왜곡.

**요구사항**:
1. search가 있으면 `range` **이전에** 서버측 필터 적용: `query.or('name.ilike.%<s>%,email.ilike.%<s>%')` — 실제 컬럼명은 파일에서 확인(name/email 컬럼 실측). PostgREST `.or()` 값에 들어가는 사용자 입력의 `%`, `,`, `(`, `)` 는 이스케이프 또는 제거(인젝션·문법 오류 방지 — 기존 코드베이스에 유사 이스케이프 헬퍼가 있는지 먼저 검색).
2. 클라 측 사후 필터 제거. total/totalPages/hasNextPage가 검색 조건 반영된 count 기반이 되게.
3. 회귀 테스트: 기존 AdminRepository 테스트(`src/repositories/supabase/__tests__/`)의 mock 패턴을 따라 검색 시 or 필터가 range 전에 적용되고 count가 검색 기준인지 검증.

**검증**: 관련 스위트 + tsc.

---

## Task 3: A5 — 공고 컬럼 화이트리스트 단일소스화

**문제 (직접 확정)**: `JobPostingRepositoryHelpers.ts:17-18 TABLE_COLUMNS`(정본, conditions·venue_id 포함)의 사본 2벌이 드리프트:
- `ApplicationRepositoryHelpers.ts:45-46 JOB_POSTING_COLUMNS` — conditions,venue_id **누락** ("동기화 유지" 주석 위반)
- `SettlementRepository.ts:60-61` 자체 사본 — 동일 누락 + ISSUE-003에서 정본에서 제거된 last_work_date/og_image_url/rejection_reason 잔존

**요구사항**:
1. 두 사본을 제거하고 `JobPostingRepositoryHelpers`의 `TABLE_COLUMNS`를 import해 단일소스화한다. (조인 select 문자열 조립 방식은 각 파일의 기존 사용부 확인 후 동일 형태 유지.)
2. 주의: SettlementRepository 사본의 잔존 컬럼(last_work_date 등)이 DB에 실존하는지와 무관하게, 정본 TABLE_COLUMNS로의 교체는 "정본이 select하는 컬럼만 select"가 되므로 안전. 단 교체 후 해당 파일들이 last_work_date 등을 **코드에서 읽는 곳**이 있는지 grep — 있으면 BLOCKED 보고(삭제된 컬럼 의존 발견).
3. 회귀 테스트: ApplicationRepositoryHelpers의 JOB_POSTING_COLUMNS(또는 대체 참조)가 conditions,venue_id를 포함하는지 단언하는 동기화 가드 테스트(문자열 포함 단언으로 충분 — 이 클래스의 재발 방지가 목적).

**검증**: 관련 스위트(`ApplicationRepository*`, `SettlementRepository*` 테스트) + tsc.

---

## Task 4: A6+A7 — E6080 재할당 + users.status 'deactivated' 유니온 추가

**A6 (직접 확정)**: `src/errors/AppError.ts:176 BUSINESS_TOURNAMENT_NOT_APPROVED:'E6080'` vs `src/errors/workspace.ts:22 WORKSPACE_NOT_FOUND:'E6080'` — 이중 할당. **AppError.ts 쪽이 주석상 공식 범위(E6080~ 대회 승인 게이트)이므로 workspace.ts 쪽을 재할당**한다. E6xxx 대역에서 미사용 코드를 grep으로 확정(예: E6090대) 후 할당. 'E6080' 문자열을 참조하는 다른 코드/테스트 전수 grep 후 정합.

**A7 (fable-types PARTIAL)**: DB에 실기록되는 `status:'deactivated'`(UserRepository.ts:313,393)가 `types/user.ts:124` 유니온과 `user.schema.ts:26` enum에 없음. 두 곳에 'deactivated' 추가. 추가 후 status를 exhaustive 분기하는 코드가 있는지 tsc로 확인(스위치 누락 컴파일 에러가 나면 해당 분기에 'deactivated' 케이스를 기존 'inactive' 취급과 동일하게 추가 — 동작 변경 최소화). `getDeletionStatus`(UserRepository.ts:222-223)의 문자열 매핑은 이미 'deactivated'→pending으로 동작하므로 변경 금지.

**검증**: 에러/유저 스키마 관련 스위트 + tsc. 회귀 테스트: userStatusSchema가 'deactivated'를 허용하는지 1케이스.

---

## Task 5: A8 — 세금 미리보기 트랩 해소

**문제 (fable-money PARTIAL)**: `TaxSettingsEditor.tsx:180-188` 미리보기가 non-itemized `calculateTaxAmount`(utils/settlement/tax.ts:30-34) 사용 — 실정산(taxCore.calculateItemizedRateTax, 항목별 제외 반영)과 산식 상이. 현재 showPreview 소비처 4곳 전부 false라 도달 불가하나, **컴포넌트 기본값이 true**(TaxSettingsEditor.tsx:77)라 신규 사용처에서 즉시 갈라진 금액 노출.

**요구사항**:
1. 미리보기 계산을 `calculateTaxAmountByItems`(항목별) 기반으로 교체 — 실정산과 동일 산식이 되게. 에디터가 이미 항목 체크 상태(taxableItems)를 갖고 있으므로(TaxSettingsEditor.tsx:60-65,333-386) 그것을 입력으로 사용. 미리보기에 필요한 금액 입력(basePay 등)이 prop에 없으면: 미리보기 블록과 관련 prop을 **제거**(현재 도달 불가 dead UI)하는 쪽을 택한다 — 이 경우 showPreview prop·기본값·:389 블록 제거, 소비처 4곳의 `showPreview={false}` 전달도 제거.
2. 어느 쪽을 택했는지와 근거를 보고서에 명시. UI 가시 변화 없음(현재 도달 불가이므로 두 선택 모두 무변화).
3. `calculateTaxAmount`(non-itemized)의 잔여 소비처가 0이 되면 함수도 제거 가능 — 단 grep으로 0 확인 시에만 (calculateAfterTaxAmount:50-53이 내부 호출하므로 그 처리 포함 판단).

**검증**: settlement/tax 관련 스위트 + tsc.

---

## Task 6: Phase1a — 죽은 코드 삭제 (services/repos/hooks)

분석 D절 확정 목록. **각 항목 삭제 직전 grep 재확인(Global Constraint 7)**. 참조 발견 시 SKIPPED 기록.

1. `src/services/auth/authCoreService.ts:487` `getCurrentUser`(항상 null, @deprecated) + index 재수출
2. `src/repositories/supabase/UserRepository.ts:420-503` `registerAsEmployer`(즉시 role 승격 RPC 래퍼, 호출 0 — 보안상 제거 가치) + 인터페이스 선언(IUserRepository) 정합
3. `src/services/observability/crashlyticsService.ts` 전체 + import/재수출 정리
4. `src/repositories/supabase/ApplicationRepositoryTransactions.ts:320-370` `createWorkLogsForConfirmation`
5. `src/repositories/supabase/BoardRepository.ts:461-502` `getCommentReaction`(호출 0 + 실행되면 POST_COLUMNS 오류 버그)
6. `src/services/board/boardScheduleService.ts:213-321` @deprecated 3함수(`syncScheduleBoardForJobPosting`/`syncScheduleBoardByJobPostingId`/`syncScheduleBoardByApplicationId`) + `boardService.ts:41-43` 네임스페이스 우회 주석/구조 정리(배럴에서 해당 3함수 노출 제거)
7. `src/repositories/supabase/WorkLogRepository.ts:537` `subscribeByDate`(**이것만** — 나머지 subscribe 3개는 실사용, 삭제 금지) + 인터페이스 정합
8. 훅 3종 삭제: `src/hooks/useAllowances.ts`, `src/hooks/useAssignmentSelection.ts`, `src/hooks/useUnsavedChangesGuard.ts` + hooks index 재수출 제거
9. 각 삭제로 무의미해진 관련 테스트 파일 정리(테스트만 참조하는 경우 테스트도 삭제)

**검증**: 삭제 후 `npx tsc --noEmit` EXIT 0 + 영향 스위트. 보고서에 항목별 grep 결과(0건 확인) 기록.

---

## Task 7: Phase1b — 죽은 코드 삭제 (utils/domains/schemas/types/UI)

동일 프로토콜(삭제 직전 grep). 목록:

1. UI 4종+1: `src/components/ui/LoadingOverlay.tsx`(+ index의 InlineLoadingOverlay export), `ScreenSkeleton.tsx`, `Radio.tsx`, `FormSelect.tsx` + ui/index.ts 정리
2. `src/components/icons/index.tsx` `CurrencyYenIcon`(@deprecated, 프로덕션 0 — 테스트 스냅샷 참조는 테스트 갱신)
3. `src/domains/settlement/SettlementCache.ts` 전체 + `SettlementCalculator.ts`의 `calculateWithCache`/`calculateBatch`
4. `src/utils/salary/roleExtractor.ts`, `src/utils/salary/costCalculator.ts` (barrel 정리 포함)
5. `src/domains/job-posting/selectors.ts`의 미사용 3함수(`selectPostingScheduleDisplay`/`selectPostingSalaryDisplay`/`selectPostingApplicationEligibility`) — index 재수출 제거 포함
6. `src/utils/job-posting/gridPrefill.ts` `buildGridPrefillDraft`
7. `src/shared/auth/sessionState.ts:36-49` `isPhoneOnlySignupFirebaseUser`
8. `src/shared/id/IdNormalizer.ts:106-118` `toStaffId`/`toApplicantId`(항등함수)
9. `src/utils/assignment/selectionUtils.ts` `makeSelectionKey`(barrel 미노출 도달불가 판 — selectionCore 판은 유지)
10. `src/lib/queryClient.ts:763-797` `invalidationGraph`/`invalidateRelated`(죽은 판 — invalidationStrategy.ts가 정본)
11. `src/schemas/user.schema.ts` `staffProfileSchema`/`employerProfileSchema`/`userSettingsSchema`/`employerRegisterSchema` (barrel 정리)
12. `src/schemas/jobPosting.schema.ts` `jobFilterSchema`/`basicInfoSchema`/`dateTimeSchema`
13. `src/types/auth.ts` 미사용 6종: `SignUpRequest`/`LoginRequest`/`ResetPasswordRequest`/`VerificationStatus`/`ConsentItems`/`SessionInfo`
14. `src/types/common.ts` 고아 `User`/`Staff` 인터페이스 (BaseDocument는 유지 — FirebaseDocument 별칭의 근원)
15. `src/schemas/common.ts` `optionalDurationSchema`(+`durationSchema`가 다른 소비처 없으면 함께)·`src/schemas/index.ts`의 `commonPhoneSchema`/`commonDurationSchema`/`optionalDurationSchema` 별칭, `src/schemas/common.ts:124 phoneSchema`(auth판이 정본)
16. `src/domains/schedule/WorkLogCreator.ts` Firestore 잔재(`SERVER_TIMESTAMP_SENTINEL`/`create`/`createFromAssignments` — `parseTimeSlot`/`extractStartTime`는 실사용 유지)
17. `src/utils/date/` 테스트 전용 함수들: ranges.ts `calculateWorkDuration`/`minutesToHoursMinutes`/`getDateRange`, validation.ts `validateDateCount`/`isDuplicateDate`/`dateChecks`, grouping.ts:393 `getDateListFromRange` — **주의: utils/date/core.ts의 Firestore 변환은 의도적 유지, 삭제 금지**
18. `src/schemas/assignment.schema.ts`: durationSchema·durationTypeSchema·dateSchema는 A2가 사용하므로 **유지**. 나머지(`roleIdsSchema`/`timeSlotSchema`/`datesArraySchema`/`checkMethodSchema`/`assignmentSchema`/`assignmentsArraySchema`/`createApplicationV2Schema`/`confirmApplicationV2Schema`/`cancelConfirmationSchema`)는 grep 0 확인 시 삭제

**금지(오삭제 함정 — 분석 E절)**: `JobPostingCard` 별칭, `variant:'legacy'` 분기, jobTemplate.ts legacy*, utils/date/core.ts Firestore 변환, scheduleNormalizer, constants supervisor 라벨, WorkLogRepository subscribe 3종(By Date 제외), FirestoreUserProfile/FirebaseDocument(치환은 Task 9).

**검증**: tsc EXIT 0 + 영향 스위트 + `npx knip --no-exit-code | tail -5`로 이슈 감소 확인(보고서에 전/후 수치).

---

## Task 8: Phase2a — 급여 표기·formatters 그림자 해소 (출력 문자열 불변)

**8-1 그림자 해소**: `src/utils/formatters.ts`(파일)와 `src/utils/formatters/`(디렉토리) 공존 — bare `@/utils/formatters` import는 파일이 승리, 디렉토리 index.ts의 "canonical" 주석은 거짓. **해소 방식**: 파일(formatters.ts)의 export 전부를 디렉토리 쪽으로 흡수(중복 정의는 디렉토리 판 기준으로 통합하되 **동작 차이가 있으면 파일 판 동작 유지** — bare import 소비처가 실제로 받아온 구현이 파일 판이므로), formatters.ts 삭제, 디렉토리 index.ts가 유일한 진입점이 되게. bare import 소비처(PortOneIdentityVerification 2, ProfileInfoSections, postingSurfaceModel, domains/job-posting/core, schedule.tsx, my-data.tsx 등)가 받는 심볼·동작이 바뀌지 않는지 export 목록 diff로 증명(보고서 첨부).

**8-2 급여 표기 중복 제거 (출력 불변)**: 다음 로컬 재구현을 `@/utils/formatters`(통합 후)의 함수로 교체하되, **각 화면의 현재 출력 문자열을 바이트 단위로 유지**한다(₩ 유무·공백·"원" 접미 그대로). 필요한 경우 formatters에 옵션/변형 함수를 추가하는 것은 허용, 각 call site의 표시 문자열 변경은 **금지**:
- `src/components/employer/order-sheet/sheets/SalarySheet.tsx:250,275,403` — ⚠️ order-sheet는 수정 금지 경로 → **이 파일은 SKIP하고 보고서에 S3 이월 기록**
- `src/components/employer/job-form/.../RoleSalaryInput.tsx:99` — ⚠️ job-form 수정 금지 → **SKIP·이월 기록**
- `src/components/jobs/RoleSalaryDisplay.tsx:54-67` 자체 `formatSalary` — 교체 대상
- `src/components/employer/settlement/SettlementModals.tsx:149-150` toLocaleString+원 — 교체 대상
- 로컬 `SALARY_TYPE_LABELS`(RoleSalaryDisplay.tsx) — `utils/settlement/constants.ts` 판으로 교체(값 동일 확인 후)
**테스트**: 교체 지점의 출력 문자열 스냅샷/단언 테스트(교체 전 문자열을 먼저 기록해 동일성 증명).

**검증**: tsc + 영향 스위트. 보고서에 8-1 export diff, 8-2 전/후 출력 동일성 증거.

---

## Task 9: Phase2b — 레포 공통 상수·정산 중복 수렴 (동작 불변)

**9-1**: 35컬럼 `TABLE_COLUMNS` 리터럴+`applyTsPreference` 3벌(WorkLogRepositoryHelpers.ts:21·SettlementRepository.ts:58·ConfirmedStaffRepository.ts:42 — work_logs 컬럼) → 공용 모듈(예: `src/repositories/supabase/workLogColumns.ts`)로 추출, 3파일이 import. 바이트 동일 복제임을 diff로 확인 후 진행(다르면 BLOCKED 보고).

**9-2**: `src/utils/allowanceUtils.ts` `calculateTotalAllowance`(프로덕션 import 0 — fable 확인) 삭제 또는 helpers 위임 — grep 0이면 삭제.

**9-3**: `src/components/employer/settlement/AllowanceEditor.tsx:94-119` 로컬 수당 합산 재구현 → `domains/settlement/helpers`의 `calculateAllowanceAmount` 호출로 교체(fable이 라인 동치 확인 — 출력 불변).

**9-4**: 정산 등가성 게이트 확장: 기존 `helpers.test.ts` 등가성 회귀(basePay·수당)에 **세금·역할급여 조회**(getSalaryForRole vs getRoleSalaryFromRoles의 useSameSalary 시나리오 포함) 케이스 추가 — 두 계열이 갈라지면 테스트가 잡도록. (구현 통합 자체는 이번 범위 밖 — 게이트만.)

**9-5**: `versionService.ts:67-140`의 app_config 읽기 중복 → `appConfigService` 재사용으로 수렴(반환 shape 불변).

**검증**: tsc + settlement/version 관련 스위트.

---

## Task 10: Phase3 — 마커·주석·규칙 정정 (코드 동작 불변)

1. `WorkLogRepository.ts:551,598,620` — 실사용 중인 subscribe 3종의 @deprecated 주석을 "폴링 전환 예정(마이그레이션 미완, 현재 실사용)"으로 정정
2. `src/types/user.ts:150` FirestoreUserProfile·`src/types/common.ts:34` FirebaseDocument — @deprecated 문구를 실태(repository층/상속 베이스의 실제 정본, 이름만 Firebase 시대 잔재)에 맞게 정정. **타입 치환·삭제 금지**(전체 치환은 별도 PR)
3. `src/types/jobPosting.ts:555` JobPostingCard "Legacy compatibility alias" 주석 → "주력 별칭(22파일 사용)" 실태 반영
4. `src/domains/job-posting/approvalGate.ts:10` "단일 헬퍼(SSOT)" 주석 → 4중 구현 실태와 상호참조 명시(jobPostingVisibility·JobPostingRepository SQL 2곳)
5. Firebase 잔재 주석 정정: jobService.ts:8, scheduleService.ts:4, workLogService.ts:7-8, searchService.ts:49, AppError.ts:74("E4xxx: Firebase"→인프라), useStaffSettlementsHandlers.ts:244
6. `src/utils/formatters/index.ts` "canonical 단일 진입점" 주석 — Task 8 이후 사실이 되므로 유지 확인만
7. console.* 위반 정리: workLogService.ts 2곳, types/assignment.ts 1곳 → logger로 교체 (useAssignmentSelection은 Task 6에서 삭제됨)
8. `src/config/featureFlags.ts:9,14` snake_case 키 — **키 이름은 원격 플래그 계약이므로 변경 금지**, camelCase 규칙 예외 사유 주석만 추가
9. `src/utils/salary/costCalculator.ts` JSDoc 깨진 @see — Task 7에서 파일 삭제됐으면 해당 없음

**검증**: tsc + 주석 변경이므로 lint. console→logger 교체 부분은 해당 스위트.

---

## Task 11: 최종 게이트 + 래칫 조정

1. `npm run quality` EXIT 0 (type-check+lint+format)
2. 영향 전체 스위트 실행(이번 브랜치 커밋들이 건드린 디렉토리의 테스트 전부) — 결과 수치 보고
3. `npx knip --no-exit-code` 전/후 비교 → `package.json`의 `knip:gate` `--max-issues`를 새 총량 이하로 **하향 조정**(래칫 규율, wiki knip-signal-hygiene)
4. `git log --oneline master..HEAD` 커밋 목록 정리 보고

---

## 이월 (이번 범위 밖 — 기록만)

- job-form↔order-sheet 8쌍 중복: S3/S4 계획(`docs/superpowers/plans/2026-07-16-order-sheet-*.md`)
- SalarySheet/RoleSalaryInput 급여 표기(수정 금지 경로): S3 이월
- FirestoreUserProfile/FirebaseDocument 전체 치환: 별도 PR
- 정산 helpers↔Calculator 구현 통합(위임 래퍼화): 등가성 게이트 확장(T9-4) 후속
- ConfirmedStaffList SectionList→FlashList: 성능 PR
- QRPanel dark: 대비: 실기기 확인 후
- 환경판별 이원화(config/env vs lib/env)·리뷰 마감 이원 산식·dateRequirement 타입 통합: 리스크 대비 수익 재평가 후
