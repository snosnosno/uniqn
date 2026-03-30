> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 설계, 기록, 레거시 참고 또는 시점 한정 로그입니다.
> 현재 기준 문서는 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`, `docs/guides/DEPLOYMENT.md`를 우선 확인하세요.
# Integration Release Runbook (2026-03-22)

## Scope

- `fix(application): 지원 규칙 및 서버 카운터 소유권 전환`
- `fix(auth): phone-only 회원가입 세션 유지`
- `chore(mobile): 공고 생성 로그 정리 및 린트 잔여물 해소`

## Contract Changes

- `jobPostings.stats` is the server-owned derived aggregate field.
- Client transactions must not write legacy applicant counter fields.
- Applicant self-service updates are limited to:
  - `applied -> cancelled`
  - `confirmed -> cancellation_pending`
  - `cancelled -> applied`
- Fixed posting public flows are disabled during the V3 cutover.
- Auth bootstrap now allows `authenticated + profile=null` for phone-only signup sessions that have not created a profile document yet.

## Automated Verification

Verified locally on `2026-03-22`:

- `cd functions && npm run build`
- `cd functions && npm test`
- `cd uniqn-mobile && npm run quality`
- `cd uniqn-mobile && npx jest src/repositories/firebase/__tests__/ApplicationRepository.test.ts src/stores/__tests__/authStore.test.ts src/services/jobs/__tests__/jobManagementService.test.ts --runInBand`

Scenario coverage map:

- `공고 생성 -> 지원 -> 취소 -> 재지원`
  - `functions/test/firestoreApplicationRules.test.ts`
- `confirmed -> cancellation_pending`
  - `functions/test/firestoreApplicationRules.test.ts`
  - `functions/test/firestoreOccupancyRules.test.ts`
- `fixed public flow disabled`
  - employer create/apply/detail UI regression coverage
- `phone-only signup -> profile 미생성 상태 유지`
  - `uniqn-mobile/src/stores/__tests__/authStore.test.ts`

Manual smoke is still required before rollout because the above coverage is rule/unit-test heavy rather than full staged UI automation.

## Manual Smoke Checklist

Run these in staging or emulator before the mobile rollout:

1. `공고 생성 -> 지원 -> 취소 -> 재지원`
   - Create a fresh posting.
   - Apply as the staff account.
   - Cancel the application as the applicant.
   - Reapply with the same applicant.
   - Confirm the posting remains readable and the application document is reused without client-side counter writes.
2. `confirmed -> cancellation_pending`
   - Confirm an applicant from the employer surface.
   - Submit a cancellation request from the applicant surface.
   - Confirm the employer sees `cancellation_pending` and can review it.
3. `fixed public flow disabled`
   - Confirm the public home chips do not expose `고정`.
   - Confirm employer create/detail surfaces block fixed posting access with the V3 cutover message.
4. `phone-only signup -> profile 미생성 상태 유지`
   - Sign in with a phone-only account that does not have a profile document yet.
   - Confirm the app stays authenticated with `profile == null` instead of forcing sign-out.

## Deployment Order

Release in one window, in this order:

1. Functions
   - `cd functions`
   - `npx firebase-tools deploy --only functions:validateJobPostingData,functions:updateJobPostingApplicantCount`
2. Firestore Rules
   - `cd ..`
   - `npx firebase-tools deploy --only firestore:rules`
3. Mobile/Web App
   - Start the normal app rollout only after the backend steps above are confirmed healthy.

Gate condition:

- Do not start the app rollout until both function revisions and Firestore rules are live.

## Historical Cutover Writer Audit

This checklist was part of the V3 cutover validation on `2026-03-22`. Keep it as historical reference if a future canonical writer regression is suspected.

1. List deployed functions:
   - `npx firebase-tools functions:list`
2. Review recent logs for the canonical job posting trigger pair:
   - `npx firebase-tools functions:log --only validateJobPostingData,updateJobPostingApplicantCount --lines 100`
3. Inspect recent `jobPostings` documents in the production Firebase project.
4. Investigate any newly written document that includes non-canonical fields such as `applicantCount` or `lastUpdated`.

Historical decision rule:

- If a non-canonical writer was still active during cutover, redeploy or disable that writer before the app rollout.
- If only old persisted documents remained during cutover, treat data cleanup as a follow-up task rather than a current runtime contract issue.

## Observability And Follow-up

- Set `SENTRY_DSN` in `functions/.env` or the deployment secret store before the production deploy.
- Track the `functions` dependency audit separately; `npm ci` currently reports 18 vulnerabilities and this release does not fix them.
 # Cloud Scheduler 감사 로그 변경 대응 기록

**작성일**: 2026년 3월 26일  
**대상 프로젝트**: `tholdem-ebc18`  
**상태**: 대응 계획 반영 완료, 운영 자산 확인 대기

## 요약

- 현재 저장소와 실제 배포된 scheduled function 기준으로 이번 Cloud Scheduler 감사 로그 변경의 직접 영향은 없다.
- 즉시 수정이 필요한 앱/Functions 비즈니스 로직은 확인되지 않았다.
- 남은 리스크는 저장소 밖 운영 자산이다.
  - Cloud Logging Log Router sink
  - BigQuery 감사 로그 export
  - SIEM/Splunk/Datadog 등 외부 연동
  - `cloudscheduler.googleapis.com` 감사 로그를 읽는 수동 스크립트

## 배경

- Cloud Scheduler는 2025년 9월 15일부터 App Engine 흐름을 제외하고 표준 GFE 형식의 감사 로그를 생성하기 시작했다.
- 기존 형식 감사 로그는 2026년 9월 30일까지 병행 제공된다.
- 2026년 9월 30일부터 기존 payload 구조만 가정한 파서는 실패할 수 있다.

## 확인 근거

### 1. 저장소 코드 검색 결과

- `functions/src`, `uniqn-mobile/src`, `scripts`, `.github`, `docs`에서 아래 감사 로그 파싱 흔적을 찾지 못했다.
  - `protoPayload`
  - `authorizationInfo`
  - `retryConfig` / `retry_config`
  - `callerIp`
  - `cloudaudit.googleapis.com`
  - `@google-cloud/logging`
- `functions/package.json` 런타임 의존성에도 Logging SDK가 없다.

### 2. 실제 배포된 scheduled function 확인 결과

`npx firebase-tools functions:list --project tholdem-ebc18 --json` 기준으로 현재 배포된 scheduled function은 아래 8개다.

- `cleanupExpiredTokensScheduled`
- `cleanupOrphanAccountsScheduled`
- `cleanupRateLimitsScheduled`
- `expireByLastWorkDate`
- `expireFixedPostings`
- `processScheduledDeletions`
- `retryFailedCounterOpsScheduled`
- `sendReviewRemindersScheduled`

위 목록은 현재 소스 export와 일치한다.

### 3. 레거시 결제 Scheduler 문서 상태

아래 이름은 문서에는 남아 있지만 현재 저장소와 실제 배포된 Functions 기준 활성 대상이 아니다.

- `cleanupExpiredHearts`
- `heartExpiry7Days`
- `heartExpiry3Days`
- `heartExpiryToday`
- `archiveOldData`

## 최종 결론

### 직접 영향

- 없음.
- 현재 `onSchedule()` 기반 함수들은 Cloud Scheduler 감사 로그를 읽지 않고, 스케줄 트리거로만 Cloud Scheduler를 사용한다.
- 따라서 이번 변경으로 인해 앱 또는 Functions 런타임이 즉시 깨질 부분은 확인되지 않았다.

### 조건부 영향

- 운영팀이 Cloud Scheduler 감사 로그를 외부에서 직접 파싱하는 경우에만 영향이 있다.
- 이 경우 old/new 포맷 동시 지원 정규화 레이어를 두고 후속 비즈니스 로직은 정규화된 내부 필드만 보도록 전환해야 한다.

## 실행 계획

### 2026년 3월 31일까지

운영/인프라 담당에게 아래 항목을 확인한다.

- IAM 권한 확보 후 실제 Cloud Scheduler job inventory 조회
- Cloud Logging Log Router sink 존재 여부
- BigQuery로 내보내는 감사 로그 테이블 존재 여부
- SIEM/Splunk/Datadog 등 외부 연동 존재 여부
- `cloudscheduler.googleapis.com` 감사 로그를 읽는 커스텀 스크립트 존재 여부

### 2026년 4월 5일까지

- 외부 연동이 없으면 이번 건을 `무영향, 모니터링 유지`로 종료한다.
- 외부 연동이 있으면 old/new 포맷 동시 지원 정규화 로직 전환 계획을 수립한다.

### 2026년 4월 30일까지

- 새 형식 감사 로그 유입 여부를 1회 재확인한다.
- 공지상 일부 고객은 새 로그 수신이 늦을 수 있으므로, 미수신 자체를 즉시 장애로 판단하지 않는다.

### 2026년 8월 31일까지

- 외부 연동이 있는 경우 마이그레이션 완료 목표일로 잡는다.
- 공식 강제일인 2026년 9월 30일보다 1개월 이상 앞서 마감한다.

## 운영 확인 체크리스트

- `authorizationInfo[].resource`를 직접 문자열 파싱하는 로직이 있는가
- `request.job.retryConfig`만 가정한 파서가 있는가
- `callerIp`를 신뢰값으로 사용하는 규칙이 있는가
- 새 payload 구조의 `resourceAttributes`와 `retry_config`를 수용해야 하는 연동이 있는가

## 제한 사항

- Cloud Scheduler API 조회 권한이 없어 Scheduler job inventory를 직접 열람하지 못했다.
- Cloud Logging view/sink 조회 권한이 없어 로그 view, sink, export 설정을 직접 열람하지 못했다.
- 따라서 현재 대응 원칙은 `코드 수정 없음, 운영 자산 확인 후 종료`다.
 # 2026-03-26 Pre-Release Long-Run Log

## Batch 0

### Staff Closed Loop: Schedule Merge Identity

- 확인한 문제
  - `ScheduleMerger`가 `jobPostingId + date`만으로 중복을 제거해, 같은 공고의 같은 날짜에 서로 다른 슬롯이 있으면 스태프 일정 하나가 사라질 수 있었다.
- 실제 수정
  - `ScheduleEvent`에 `assignmentGroupId`를 추가했다.
  - `ScheduleConverter`가 `WorkLog.assignmentGroupId`와 `Assignment.groupId`를 일정 이벤트로 그대로 전달하도록 맞췄다.
  - `ScheduleMerger.generateScheduleKey()`를 `jobPostingId + date + assignmentGroupId + timeSlot` 우선, `role/customRole` 보조 식별자 fallback 구조로 바꿨다.
  - 일정 병합 계약과 식별자 전달 계약을 고정하는 Jest 테스트를 추가했다.
- 검증 결과
  - `npm test -- --runTestsByPath src/domains/schedule/__tests__/ScheduleMerger.test.ts src/domains/schedule/__tests__/ScheduleConverter.test.ts --runInBand` 통과.
  - `npm run type-check` 통과.
- 남은 리스크
  - `cancellation_pending` 신청이 스태프 일정에서 여전히 `confirmed`로만 보이는 경로가 있어, 취소 검토 중 상태가 UI에서 충분히 드러나지 않을 수 있다.
- 다음 우선순위
  - 스태프 일정 카드/상세/QR 진입에서 취소 검토 중 상태를 어떻게 보여 주고 막아야 하는지 재탐색한다.

### Staff Closed Loop: Cancellation Pending Visibility

- 확인한 문제
  - `cancellation_pending` 신청은 일정에서 `confirmed`로 접히고, WorkLog 우선 병합 과정에서 그 메타데이터가 사라질 수 있었다.
  - 그 결과 스태프 일정 카드와 상세 흐름에서 취소 요청 검토 중 상태가 드러나지 않고, 중복 취소 요청 버튼도 다시 열릴 수 있었다.
- 실제 수정
  - `ScheduleEvent`에 `isCancellationPending` 메타데이터를 추가했다.
  - `ScheduleConverter`가 `cancellation_pending` 신청을 일정 이벤트로 변환할 때 이 메타데이터를 유지하도록 맞췄다.
  - `ScheduleMerger`가 동일 일정에서 WorkLog를 우선 유지하되, 취소 요청 중 메타데이터는 WorkLog 쪽에 합쳐서 보존하도록 수정했다.
  - 스태프 일정 카드, 그룹 카드, 상세 모달, Work 탭에서 취소 요청 검토 중 배지/안내를 노출하고, 상세 모달에서는 중복 취소 요청 버튼을 숨기도록 조정했다.
- 검증 결과
  - `npm test -- --runTestsByPath src/domains/schedule/__tests__/ScheduleMerger.test.ts src/domains/schedule/__tests__/ScheduleConverter.test.ts src/components/schedule/__tests__/ScheduleCard.test.tsx src/components/schedule/__tests__/ScheduleDetailModal.test.tsx --runInBand` 통과.
  - `npm run type-check` 통과.
- 남은 리스크
  - 이번 배치는 스태프 노출과 중복 액션 억제까지 다뤘고, 실제 QR 허용/차단 정책 자체는 제품 규칙 확인이 더 필요하다.
- 다음 우선순위
  - 고용주 운영 콘솔에서 취소 검토 결과가 스태프 일정/QR/정산으로 반영되는 마지막 연결점을 다시 훑는다.
### Employer -> Staff: Cancellation Review Propagation

- Confirmed issue
  - The employer cancellation request screen reads `cancellationRequests` directly, but `applicant.reviewCancellation` did not invalidate that query path.
  - Staff-facing recovery still needed proof that realtime schedule updates clear the pending badge on approval and rejection, and that lifecycle notifications stay single-shot with `/schedule` deeplinks.
- Actual fix
  - Added `applicantManagement.cancellationRequests` to the `applicant.reviewCancellation` invalidation graph and routed it to the canonical query key.
  - Added schedule hook and UI tests that prove employer review results replace the pending schedule state with `cancelled` on approval and plain `confirmed` on rejection.
  - Added function trigger tests that lock `cancellation_approved` and `cancellation_rejected` notifications to a single send with the `/schedule` deeplink.
- Verification
  - `npm test -- --runTestsByPath src/lib/__tests__/invalidationStrategy.test.ts src/__tests__/hooks/useSchedules.test.ts src/components/schedule/__tests__/ScheduleCard.test.tsx src/components/schedule/__tests__/ScheduleDetailModal.test.tsx --runInBand`
  - `npx firebase-tools emulators:exec --only firestore "mocha --require ts-node/register --timeout 15000 test/onApplicationStatusChanged.test.ts"` in `functions/`
  - `npm run type-check`
- Remaining risk
  - QR entry, settlement surfaces, and review eligibility still rely on higher-level end-to-end traversal; this batch only locked the cache invalidation and immediate schedule and notification propagation edges.
- Next priority
  - Re-explore employer confirmed staff -> QR -> settlement screens for any remaining cross-surface mismatch after cancellation review.

### Employer Operations: QR Scope After Cancellation Review

- Confirmed issue
  - The employer QR modal built selectable slots from the posting schedule alone, so approved cancellations could leave empty slots still selectable for QR generation.
- Actual fix
  - Filtered QR scopes against active confirmed staff so slots without scheduled or checked-in staff stop appearing after cancellation review or other staffing changes.
  - Wired the QR modal to consume confirmed staff state when it opens.
- Verification
  - `npm test -- --runTestsByPath src/components/employer/qr/__tests__/eventQRScope.test.ts src/lib/__tests__/invalidationStrategy.test.ts src/__tests__/hooks/useSchedules.test.ts src/components/schedule/__tests__/ScheduleCard.test.tsx src/components/schedule/__tests__/ScheduleDetailModal.test.tsx --runInBand`
  - `npm run type-check`
- Remaining risk
  - Settlement and review surfaces still need a deeper end-to-end sweep to confirm there is no residual mismatch after employer-side lifecycle changes.
- Next priority
  - Re-explore employer settlement and post-work review eligibility surfaces with the same small-batch loop.

### Employer Operations: Settlement Filtering After Cancellation Approval

- Confirmed issue
  - The employer settlement service loaded every work log for the posting, so cancellation approval could leave `cancelled` work logs visible in settlement lists and summary totals.
- Actual fix
  - Filtered settlement queries to exclude `cancelled` work logs before building settlement list data and summary aggregates.
  - Added regression tests that prove cancelled logs no longer appear in `getWorkLogsByJobPosting()` results or `getJobPostingSettlementSummary()` totals.
- Verification
  - `npm test -- --runTestsByPath src/services/work/__tests__/settlementService.test.ts --runInBand`
  - `npm run type-check`
- Remaining risk
  - Review pending surfaces can still go stale unless cancellation review invalidates the review-specific cache after lifecycle changes.
- Next priority
  - Re-explore post-work review banners and pending review lists after cancellation approval or rejection.

### Staff Closed Loop: Pending Review Cache After Cancellation Review

- Confirmed issue
  - `applicant.reviewCancellation` refreshed schedules, work logs, and settlement data, but it did not invalidate `reviews.pending`, so review banners and pending review screens could keep stale items after cancellation approval or rejection.
- Actual fix
  - Added `reviews.pending` to the `applicant.reviewCancellation` invalidation graph.
  - Extended the invalidation regression test to lock the pending review query key into that path.
- Verification
  - `npm test -- --runTestsByPath src/lib/__tests__/invalidationStrategy.test.ts src/hooks/__tests__/useReviewsHooks.test.ts --runInBand`
  - `npm run type-check`
- Remaining risk
  - Review eligibility itself still depends on repository status data, so any future lifecycle change that bypasses work log status updates would need a separate audit.
- Next priority
  - Re-explore the remaining employer settlement -> review edge for any non-cancellation lifecycle mismatch.

### Employer -> Staff: Staff Management Cache Propagation

- Confirmed issue
  - Employer-side no-show and manual staff status updates only invalidated confirmed staff, settlement, and work log queries through `invalidateQueries.staffManagement(jobPostingId)`.
  - Staff schedule and pending review surfaces could therefore stay stale after employer-side lifecycle changes.
- Actual fix
  - Extended `invalidateQueries.staffManagement(jobPostingId)` to also invalidate `schedules` and `reviews.pending`.
  - Added a focused helper regression test that locks those query keys into the staff management invalidation contract.
- Verification
  - `npm test -- --runTestsByPath src/lib/__tests__/queryClient.test.ts src/__tests__/hooks/useConfirmedStaff.test.ts --runInBand`
  - `npm run type-check`
- Remaining risk
  - This batch fixes cache propagation for the existing hook path; any alternate mutation path that bypasses `staffManagement(jobPostingId)` would need its own audit.
- Next priority
  - Re-explore employer settlement and review eligibility for non-cache logic mismatches rather than stale query state.

### Staff Closed Loop: Employer Review Source Should Not Be Page-Capped

- Confirmed issue
  - `workLogRepository.getCompletedByOwnerId(ownerId)` is the employer-side source for pending reviews, but it still applied `DEFAULT_PAGE_SIZE`, which could silently drop older eligible review targets.
  - The repository test suite also lacked `whereIn()` coverage for this path, so the truncation risk was not guarded.
- Actual fix
  - Removed the default page-size limit from `getCompletedByOwnerId(ownerId)` so employer pending reviews are not cut off at the repository layer.
  - Updated the repository contract comment to match the actual `checked_out` + `completed` source behavior.
  - Added a repository regression test and filled the missing `whereIn()` QueryBuilder mock path so this flow stays covered.
- Verification
  - `npm test -- --runTestsByPath src/repositories/firebase/__tests__/WorkLogRepository.test.ts src/hooks/__tests__/useReviewsHooks.test.ts --runInBand`
  - `npm run type-check`
- Remaining risk
  - The review pending list still depends on client-side deadline filtering, so very large owner histories may need a future server-side narrowing strategy if performance becomes an issue.
- Next priority
  - Re-explore pending review ordering/dedup and any remaining employer-side review UX mismatches now that truncation and stale-cache paths are closed.

### Staff Closed Loop: Pending Review Sources Should Follow Review Deadline Window

- Confirmed issue
  - Staff pending reviews still used the generic `getByStaffId()` source, which defaulted to the latest 50 work logs regardless of review deadline.
  - Employer pending reviews fetched the owner’s full completed history and only filtered deadline eligibility on the client, which inflated downstream posting lookups and made ordering depend on repository incidental order.
- Actual fix
  - Switched staff pending reviews to `getByDateRange()` for the active review deadline window instead of the generic paged work log query.
  - Extended `getCompletedByOwnerId(ownerId, dateRange?)` so the employer-side pending review source can be scoped to the same deadline window.
  - Updated pending review query keys and hook tests so both staff and employer review sources are date-window aware.
- Verification
  - `npm test -- --runTestsByPath src/hooks/__tests__/useReviewsHooks.test.ts src/repositories/firebase/__tests__/WorkLogRepository.test.ts --runInBand`
  - `npm run type-check`
- Remaining risk
  - The pending review screen still computes urgency on the client, so any future change to review-deadline rules should update both the hook and the display helper together.
- Next priority
  - Re-explore pending review ordering and impossible review candidates now that both data sources are deadline-scoped.

### Staff Closed Loop: Pending Review Ordering And Eligibility Alignment

- Confirmed issue
  - Pending review items inherited repository order instead of an explicit urgency rule, so staff and employer review items could render in inconsistent sequence.
  - The helper could also surface impossible review prompts such as self-reviews, malformed employer items without `staffId`, or non-reviewable statuses if upstream data leaked through.
- Actual fix
  - Sorted pending review items by earliest review base time first so the most urgent review target consistently appears at the top.
  - Filtered self-review items, missing-staff employer items, and non-reviewable employer statuses inside `buildPendingReviewItems()` so the pending list matches review eligibility rules.
  - Added helper tests that lock ordering and impossible-item filtering into the review flow contract.
- Verification
  - `npm test -- --runTestsByPath src/hooks/__tests__/useReviews.test.ts src/hooks/__tests__/useReviewsHooks.test.ts --runInBand`
  - `npm run type-check`
- Remaining risk
  - No additional user-visible review flow mismatch was reproduced after this pass; remaining review work looks like optimization or policy change rather than a concrete release blocker.
- Next priority
  - Re-explore the broader employer/staff journey only if a new reproduction appears outside the now-covered review and settlement paths.

### Staff Closed Loop: Undated Fixed Review Source Regression Repair

- Confirmed issue
  - The new deadline-window review source optimization excluded fixed work logs with `date === ''`, so undated post-work review targets could disappear even while `checkOutTime` still kept them inside the review deadline.
- Actual fix
  - Kept the deadline-window source for dated work logs, but added an undated work log supplement for both staff and employer pending review sources and merged them by `workLogId`.
  - Added hook and repository regression tests so undated fixed work logs stay visible in pending review lists without reopening the old page-cap issue.
- Verification
  - `npm test -- --runTestsByPath src/hooks/__tests__/useReviews.test.ts src/hooks/__tests__/useReviewsHooks.test.ts src/repositories/firebase/__tests__/WorkLogRepository.test.ts --runInBand`
  - `npm run type-check`
- Remaining risk
  - The undated supplement uses dedicated Firestore query shapes, so if production data introduces additional malformed undated non-fixed work logs, they will still rely on downstream eligibility filters to stay hidden.
- Next priority
  - Run one last code review pass across the pending review source and cache paths, then stop unless a new reproducible blocker appears.

