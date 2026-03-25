# Parallel Refactor Integration Coordination

Last updated: 2026-03-22
Integration branch: `codex/integration`

## Latest Integration Decision

- `codex/canonical-contract`, `codex/workflow-domain`, `codex/error-observability`, and `codex/functions-modularize` have been merged into `codex/integration`.
- Wave 2 was merged in this fixed order:
  - `codex/workflow-domain`
  - `codex/error-observability`
  - `codex/functions-modularize`
- Canonical invariant freeze remains the active dependency baseline for all downstream streams.
- Wave 2 integration gate status is `satisfied`:
  - `uniqn-mobile` `npm run quality` passed on integration
  - `functions` `npm run build` passed on integration
  - targeted mobile workflow regressions passed
  - `functions` `npm test` passed on integration
- Integration interpretation:
  - `UI Shared Surfaces` and `Perf Cost Optimization` may now start
  - downstream streams must build on frozen canonical invariants and frozen workflow selectors/projections only

## Final Integration Verification Status

- `codex/ui-shared-surfaces` and `codex/perf-cost-optimization` have been merged into `codex/integration`.
- Final integration branch status:
  - tracked changes: integration cleanup in progress
  - untracked planning docs remain at repository root
- Final decision:
  - merge train is complete
  - automatic verification is still mixed because mobile full-test is not fully green
  - authenticated smoke risk was reduced after real-login verification
  - final promotion to the default branch should still acknowledge the remaining mobile test failure below

## Current Baseline

- Repository state: `codex/integration` checked out, no committed stream divergence yet.
- Branch divergence vs integration:
  - `codex/canonical-contract`: `0/0`
  - `codex/workflow-domain`: `0/0`
  - `codex/error-observability`: `0/0`
  - `codex/functions-modularize`: `0/0`
- Stream branches not present locally yet:
  - `codex/ui-shared-surfaces`
  - `codex/perf-cost-optimization`
- Working tree note:
  - Untracked planning docs already exist at repository root and should remain reference material for this integration thread.

## Baseline Validation Snapshot

Executed on `2026-03-21` from `codex/integration`.

- `uniqn-mobile`: `npm run quality` passed
  - Current warning budget is 2 warnings, 0 errors.
  - Warning 1: `uniqn-mobile/app/(employer)/my-postings/[id]/edit.tsx`
  - Warning 2: `uniqn-mobile/app/(employer)/my-postings/index.tsx`
- `functions`: `npm run build` passed
- Mobile targeted regression suite passed:
  - `src/schemas/__tests__/jobPosting.schema.test.ts`
  - `src/utils/job-posting/__tests__/submission.test.ts`
  - `src/repositories/firebase/__tests__/JobPostingRepository.test.ts`
  - `src/services/work/__tests__/scheduleService.integration.test.ts`
  - `src/services/observability/__tests__/deepLinkService.test.ts`
  - `src/errors/__tests__/AppError.test.ts`
  - `src/components/jobs/__tests__/JobCard.test.tsx`
  - `src/components/employer/posting/__tests__/JobPostingCard.test.tsx`
  - Result: 8 suites, 215 tests passed
- Functions full suite passed:
  - `npm test`
  - Result: 25 tests passed
  - Expected logs observed during tests: permission-denied error path, missing Sentry DSN warning

## Post-Canonical Merge Validation Snapshot

Executed on `2026-03-21` after merging `codex/canonical-contract` into `codex/integration`.

- `uniqn-mobile`: targeted canonical regression suite passed
  - `src/schemas/__tests__/jobPosting.schema.test.ts`
  - `src/utils/job-posting/__tests__/submission.test.ts`
  - `src/utils/job-posting/__tests__/draftAdapter.test.ts`
  - `src/repositories/firebase/__tests__/JobPostingRepository.test.ts`
  - Result: 4 suites, 64 tests passed
- `functions`: `npm test` passed
  - Result: 26 tests passed
- `uniqn-mobile`: `npm run quality` failed
  - `tsc --noEmit`: passed
  - `eslint`: passed with the same 2 pre-existing warnings
  - `prettier --check`: failed on touched canonical files:
    - `src/domains/job-posting/index.ts`
    - `src/domains/job-posting/serialization.ts`
    - `src/repositories/firebase/__tests__/JobPostingRepository.test.ts`
    - `src/repositories/firebase/jobPosting/jobPostingTransactions.ts`
    - `src/schemas/__tests__/jobPosting.schema.test.ts`
    - `src/schemas/jobPosting.schema.ts`
    - `src/utils/job-posting/__tests__/draftAdapter.test.ts`
    - `src/utils/job-posting/__tests__/submission.test.ts`
    - `src/utils/job-posting/draftAdapter.ts`

## Post-Wave-2 Integration Validation Snapshot

Executed on `2026-03-21` after merging `codex/workflow-domain`, `codex/error-observability`, and `codex/functions-modularize` into `codex/integration`.

- `uniqn-mobile`: `npm run quality` passed
  - `tsc --noEmit`: passed
  - `eslint`: passed with 1 existing warning
  - `prettier --check`: passed
- `functions`: `npm run build` passed
- Mobile targeted integration regression suite passed:
  - `src/schemas/__tests__/jobPosting.schema.test.ts`
  - `src/domains/job-posting/__tests__/workflow.test.ts`
  - `src/services/work/__tests__/scheduleService.test.ts`
  - `src/services/work/__tests__/scheduleService.integration.test.ts`
  - `src/domains/application/__tests__/ApplicationValidator.test.ts`
  - `src/repositories/firebase/application/__tests__/applicationTransactions.fixed.test.ts`
  - `src/services/work/__tests__/workLogService.test.ts`
  - `src/repositories/firebase/workLog/__tests__/workLogMutations.fixed.test.ts`
  - `src/schemas/__tests__/workLog.schema.test.ts`
  - Result: 9 suites, 198 tests passed
- `functions`: `npm test` passed
  - Result: 31 tests passed
  - Expected logs observed during tests: permission-denied error path, missing Sentry DSN warning

## Final Integration Validation Snapshot

Executed on `2026-03-21` after merging `codex/ui-shared-surfaces` and `codex/perf-cost-optimization` into `codex/integration`.

- `uniqn-mobile`: `npm run quality` passed
  - `tsc --noEmit`: passed
  - `eslint`: passed with 1 existing warning
  - `prettier --check`: passed
- `uniqn-mobile`: full `npm test` failed
  - Result: 153 suites passed, 1 suite failed
  - Result: 3558 tests passed, 2 tests failed
  - Failing suite:
    - `src/services/notifications/__tests__/pushNotificationService.test.ts`
  - Failing expectations:
    - initialize failure path no longer records through the mocked observability path
    - duplicate initialize path returns `false` instead of expected `true`
- `functions`: `npm run build` passed
- `functions`: `npm test` passed
  - Result: 34 tests passed
  - Expected logs observed during tests: permission-denied error path, missing Sentry DSN warning
- Additional mobile regressions passed:
  - `src/components/jobs/__tests__/PostingSharedContent.test.tsx`
  - `src/components/jobs/__tests__/postingSurfaceModel.test.ts`
  - `src/__tests__/hooks/useSchedules.test.ts`
  - `src/__tests__/hooks/useWorkLogs.test.ts`
  - Result: 4 suites, 61 tests passed

## Post-Integration Compatibility Remediation Snapshot

This section is a historical incident record from the cutover window. The current codebase assumes no persisted non-canonical `jobPostings` remain.

Executed on `2026-03-22` after reproducing the employer-side “job posting not found” regression during create -> apply verification.

- Root cause:
  - persisted job posting reads were being rejected by the strict V3 parser when legacy operational fields remained on the document
  - observed legacy fields:
    - `applicantCount`
    - `lastUpdated`
  - failure path:
    - `JobPosting document validation failed`
    - repository read returned `null`
    - service layer surfaced `공고를 찾을 수 없음`
- Integration remediation:
  - the temporary read-compat shim was removed once the V3 cutover completed
  - legacy `applicantCount` is no longer normalized on read
  - legacy `lastUpdated` is no longer part of the canonical document contract
  - canonical write contract is now:
    - `stats`
    - `updatedAt`
- Validation:
  - `cd uniqn-mobile && npm test -- --runInBand src/schemas/__tests__/jobPosting.schema.test.ts`
  - `cd uniqn-mobile && npm test -- --runInBand src/repositories/firebase/application/__tests__/applicationTransactions.fixed.test.ts`
  - `cd uniqn-mobile && npm run type-check`
  - `cd uniqn-mobile && npm run quality`
  - Result: all passed, with the pre-existing lint warning only
- Operational interpretation:
  - current integration source does not write legacy applicant counters or `lastUpdated`
  - at the time of the incident, any continued appearance of those fields would have indicated an older deployed writer or legacy client
  - keep this snapshot as cutover history, not as evidence of an active runtime writer in the current contract

## Real-Login Smoke Follow-Up

Executed on `2026-03-21` and `2026-03-22` using a real authenticated web session instead of Playwright storage-state fixtures.

- Verified successfully after manual login:
  - home `/`
  - public job detail
  - apply route
  - schedule `/schedule`
  - employer posting list `/my-postings`
  - employer posting create `/my-postings/create`
  - QR `/qr`
- Integration interpretation:
  - the earlier Playwright smoke failures are more consistent with storage-state or auth bootstrap mismatch than with a total authenticated-route regression
  - authenticated manual smoke is partially restored, but the full automated mobile test suite still has the notification test failures noted above

## Manual Smoke Attempt Snapshot

Executed on `2026-03-21` using local Firebase emulators, fresh web export, and Playwright E2E smoke selection.

- Environment setup:
  - `npx firebase-tools emulators:start --only auth,firestore`
  - `cd uniqn-mobile && npm run build:web`
- Smoke proxy run:
  - selected Playwright specs across public, apply, employer, settlement, schedule, QR, and admin flows
  - Result: 21 passed, 33 failed
- What passed:
  - unauthenticated public page coverage was partially successful
- Main failure pattern:
  - authenticated staff, employer, and admin flows frequently landed on the login screen instead of the expected route
  - representative failed areas:
    - job detail / apply
    - schedule tab
    - QR tab
    - employer posting management
    - employer settlement
    - admin dashboard
- Integration interpretation:
  - likely auth session bootstrap or persisted-auth compatibility regression in web smoke environment
  - manual smoke checklist cannot be considered passed yet

## Stream Opening Rules

### Open now

- `UI Shared Surfaces`
  - May start on top of frozen workflow selectors, facts, projections, and canonical invariants.
- `Perf Cost Optimization`
  - May start on top of frozen workflow selectors, facts, projections, and canonical invariants.

### Do not open yet

- No additional stream is blocked within the current parallel plan.
- Guardrails still apply:
  - do not redefine canonical contract files
  - do not redefine workflow selector rules
  - do not introduce new feature scope under UI or performance work

## Integration Invariants

- No stream may change job posting canonical contract before `Canonical Contract` is merged.
- After canonical merge, downstream streams may consume canonical helpers, but they may not redefine:
  - `postingType`
  - `schedule.kind`
  - `fixedConfig.durationDays`
  - canonical location shape
  - repository write validation rules
- `app2/` is reference-only and must not become runtime source.
- No feature additions during this refactor.
- No direct merge to `master` or `mainline`; merge flows through `codex/integration`.
- A stream may only touch its owned files plus minimal callsite adjustments required to compile or satisfy tests.
- Baseline warning budget may not increase without explicit approval from integration.

## Ownership Boundaries

### Canonical Contract

- Owns:
  - `uniqn-mobile/src/schemas/jobPosting.schema.ts`
  - `uniqn-mobile/src/domains/job-posting/*`
  - `uniqn-mobile/src/repositories/firebase/jobPosting/*`
  - `firestore.rules`
  - related schema, repository, rules, and submission tests
- Must not own:
  - UI surface refactors
  - observability naming cleanup
  - functions export modularization outside contract conformance fixes

### Workflow Domain

- Opens only after canonical merge.
- Owns:
  - workflow selectors, facts, projections
  - `uniqn-mobile/src/domains/schedule/*`
  - consumer-side workflow/domain logic that removes duplicated branching
- Must not change:
  - schema shape
  - Firestore rules
  - repository canonical write contract

### Error Observability

- Opens only after canonical merge.
- Owns:
  - `uniqn-mobile/src/errors/*`
  - `uniqn-mobile/src/services/observability/*`
  - `uniqn-mobile/src/utils/logger.ts`
  - related tests
- Must not change:
  - job posting canonical schema or rules
  - presentation redesign

### Functions Modularize

- Opens only after canonical merge.
- Owns:
  - `functions/src/index.ts`
  - `functions/src/api/jobPostings/*`
  - `functions/src/triggers/*`
  - adjacent export/test structure required for modularization
- Must not change:
  - app-side canonical schema definitions
  - non-canonical field behavior

### UI Shared Surfaces

- Opens only after workflow merge.
- Owns:
  - `uniqn-mobile/src/components/jobs/*`
  - `uniqn-mobile/src/components/employer/posting/*`
  - minimal screen glue needed to consume shared view-models
- Must not change:
  - canonical invariant definitions
  - workflow selector rules
  - functions or observability structure

### Perf Cost Optimization

- Opens only after canonical and workflow merge.
- Owns:
  - query/projection/cache/performance helpers
  - offline cache shape/versioning
  - trigger churn and repeated computation reduction
- Must not change:
  - business behavior
  - UI meaning or strings
  - canonical shape

## Merge Order

Merge into `codex/integration` in this order only:

1. `codex/canonical-contract`
2. `codex/workflow-domain`
3. `codex/error-observability`
4. `codex/functions-modularize`
5. `codex/ui-shared-surfaces`
6. `codex/perf-cost-optimization`

Notes:

- `Workflow Domain`, `Error Observability`, and `Functions Modularize` may be developed in parallel after canonical freeze, but merge order stays fixed.
- `UI Shared Surfaces` and `Perf Cost Optimization` may be developed in parallel after workflow merge, but merge order stays fixed.
- Every stream must rebase or merge latest `codex/integration` and rerun its gates immediately before merge approval.

## Common Pre-Merge Gate

Every stream must satisfy all of the following before integration review:

- Scope matches owned files and does not redefine another stream's contract.
- Branch is rebased onto latest `codex/integration`.
- `uniqn-mobile`: `npm run quality` if mobile code changed.
- `functions`: `npm run build` if functions code changed.
- All related Jest / Mocha / rules tests for touched areas pass.
- No new lint warnings unless explicitly approved by integration.
- Manual smoke checklist for touched workflows is completed.
- Final report is submitted in the required format below.

## Stream-Specific Merge Gates

### Canonical Contract Gate

- Contract files only; no opportunistic UI or observability cleanup.
- Explicitly document frozen invariants:
  - `postingType` and `schedule.kind` relationship
  - `fixedConfig.durationDays`
  - canonical location round-trip shape
  - repository write validation point
- Required validation:
  - `cd uniqn-mobile && npm run quality`
  - Mobile tests:
    - `src/schemas/__tests__/jobPosting.schema.test.ts`
    - `src/utils/job-posting/__tests__/submission.test.ts`
    - `src/repositories/firebase/__tests__/JobPostingRepository.test.ts`
  - `cd functions && npm test`
- Merge condition:
  - create/update/read/rules all interpret the same V3 document shape
- Current status on integration:
  - merged
  - functional validation passed
  - formatting follow-up still required for full gate closure

### Workflow Domain Gate

- No schema, rules, or repository contract edits.
- Consolidates duplicated workflow branching into selectors/facts/projections.
- Required validation:
  - `cd uniqn-mobile && npm run quality`
  - Related workflow tests, including schedule and posting workflow suites
  - Manual smoke:
    - public jobs list/detail
    - employer posting detail/manage
    - application eligibility, apply, cancel
    - schedule tab/date grouping
- Merge condition:
  - public, employer, application, and schedule flows resolve the same posting facts

### Error Observability Gate

- No job posting contract redefinition.
- Error classes, logger, and observability facade naming are consistent.
- Required validation:
  - `cd uniqn-mobile && npm run quality`
  - Related tests:
    - `src/errors/__tests__/AppError.test.ts`
    - touched error or logger suites
    - `src/services/observability/__tests__/deepLinkService.test.ts` when deep link code changes
- Merge condition:
  - recoverable, silent, and critical paths are classified consistently without breaking callers

### Functions Modularize Gate

- No app-side schema ownership grab.
- Functions structure changes do not emit or rely on non-canonical fields.
- Required validation:
  - `cd functions && npm run build`
  - `cd functions && npm test`
- Manual smoke:
  - admin approval/reject flows tied to job postings
  - notification-triggered job posting updates when affected
- Merge condition:
  - exports remain complete and job posting function behavior stays canonical

### UI Shared Surfaces Gate

- Uses workflow outputs rather than reimplementing workflow rules in components.
- No schema or selector rule changes.
- Required validation:
  - `cd uniqn-mobile && npm run quality`
  - Related component tests, including:
    - `src/components/jobs/__tests__/JobCard.test.tsx`
    - `src/components/employer/posting/__tests__/JobPostingCard.test.tsx`
    - other touched component tests
- Manual smoke:
  - public jobs list/detail
  - employer posting card/detail
  - empty/loading/error/partial states
- Merge condition:
  - public and employer surfaces show the same grouped schedule, salary, and status meaning

### Perf Cost Optimization Gate

- No behavior or contract changes under the name of optimization.
- Any cache shape change must include invalidation or versioning notes.
- Required validation:
  - `cd uniqn-mobile && npm run quality`
  - touched query/projection/cache tests
  - functions tests if trigger cost work was touched
- Manual smoke:
  - same workflow renders the same result before and after optimization
  - no extra fetches or duplicate calculations on critical screens
- Merge condition:
  - measured or clearly demonstrated cost reduction with no user-visible behavior regression

## Final Integration Smoke Checklist

Run on `codex/integration` after each merge and again before final approval.

- Public job list opens and job detail renders canonical schedule/location/salary.
- Employer posting list opens and card summary matches job detail.
- Employer can create or edit posting without schema regression.
- Staff can apply or cancel without workflow mismatch.
- Schedule tab groups dates correctly and relevant QR or attendance entry points still open.
- Admin approval, rejection, or deletion flow for job postings still works when affected.
- Notifications or deep links still route to the intended destination when affected.
- No crash on empty, loading, error, or partial-data states for touched surfaces.

## Required Completion Report Format

Every stream must report back in this shape:

1. Change summary
2. Owned files changed
3. Frozen invariants or input/output contract confirmed
4. Validation run
   - commands executed
   - pass/fail result
   - warnings observed
5. Remaining risks
6. Handoff notes for the next stream or integration merge

## Current Integration Status Summary

- Overall status: all planned parallel streams merged and integration cleanup is nearly complete, but final promotion is not fully sign-off ready
- Open now:
  - none
- Blocked for now:
  - default-branch promotion until remaining regressions are triaged or explicitly accepted
- Known common risks:
  - mobile full-test regression in `pushNotificationService`
  - remote Firebase project may still have an older deployed writer emitting legacy job posting fields
  - notification initialization regression in `pushNotificationService` tests
  - contract drift between app schema, repository writes, Firestore rules, and functions after future fixes
  - the existing mobile lint warning in `app/(employer)/my-postings/[id]/edit.tsx`
  - repository default branch is currently `master`, not `main`; promotion instructions must target the actual default branch
