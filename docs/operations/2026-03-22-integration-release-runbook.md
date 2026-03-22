# Integration Release Runbook (2026-03-22)

## Scope

- `fix(application): 지원 규칙 및 서버 카운터 소유권 전환`
- `fix(auth): phone-only 회원가입 세션 유지`
- `chore(mobile): 공고 생성 로그 정리 및 린트 잔여물 해소`

## Contract Changes

- `jobPostings.applicationCount` is a server-owned derived field.
- Client transactions may update `filledPositions`, `schedule`, and application status, but must not write `applicationCount`.
- Applicant self-service updates are limited to:
  - `applied/pending -> cancelled`
  - `confirmed -> cancellation_pending`
  - `cancelled -> applied`
- Fixed posting `workLogs` may be created with `date: null` and `timeSlot: null` when `isFixedPosting == true`.
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
- `fixed posting workLog 생성`
  - `functions/test/firestoreOccupancyRules.test.ts`
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
3. `fixed posting workLog 생성`
   - Confirm a fixed posting assignment.
   - Verify the created work log uses `isFixedPosting == true`, `date == null`, and `timeSlot == null`.
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

## Legacy Writer Audit

Complete this before the app rollout:

1. List deployed functions:
   - `npx firebase-tools functions:list`
2. Review recent logs for the canonical job posting trigger pair:
   - `npx firebase-tools functions:log --only validateJobPostingData,updateJobPostingApplicantCount --lines 100`
3. Inspect recent `jobPostings` documents in the production Firebase project.
4. Stop the rollout if any newly written document still contains legacy fields such as `applicantCount` or `lastUpdated`.

Decision rule:

- If a legacy writer is still active, redeploy or disable that writer before the app rollout.
- If only old persisted documents remain, keep the read-compat hotfix and move data cleanup to a follow-up task.

## Observability And Follow-up

- Set `SENTRY_DSN` in `functions/.env` or the deployment secret store before the production deploy.
- Track the `functions` dependency audit separately; `npm ci` currently reports 18 vulnerabilities and this release does not fix them.
