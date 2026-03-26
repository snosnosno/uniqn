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
