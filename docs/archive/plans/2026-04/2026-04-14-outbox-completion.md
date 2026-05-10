# Outbox 시스템 완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** outbox 패턴(B7~B10)을 완성하여 schedule_board sync가 안정적·관찰가능하게 동작하고, atomicity RPC들이 SQL 회귀 테스트로 보호받으며, 모든 board sync 호출이 단일 진실 소스(outbox enqueue)를 거치도록 통일한다.

**Architecture:**
1. pg_cron + pg_net으로 `sync-schedule-board-outbox` Edge Function을 1분마다 자동 호출
2. Edge Function이 `failed_retry_limit` 발생 시 Slack webhook으로 alert
3. 두 atomicity RPC(`cancel_application_atomically`, `process_qr_checkin_atomically`)에 실제 fixture를 채운 SQL 회귀 테스트
4. `applicationHistoryService` + `confirmedStaffService`의 직접 sync 호출을 outbox enqueue로 전환
5. `boardService`의 direct sync 함수에 `@deprecated` 마크 + 향후 제거 경로 명시

**Tech Stack:** Supabase (pg_cron, pg_net, vault, Edge Functions, PL/pgSQL), TypeScript, Deno

**Execution Order:** Task 1 → Task 2 → Task 3 → Task 6 → Task 4 → Task 5

---

## Task 1: pg_cron으로 sync-schedule-board-outbox 자동 호출

**목적:** Edge Function이 1분마다 outbox pending 행을 처리하도록 영속적 스케줄링. Supabase Dashboard 수동 설정 대신 마이그레이션으로 버전 관리.

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260414130000_setup_outbox_cron.sql`

**전제:**
- Supabase Project Settings에서 `pg_cron`, `pg_net` extension이 활성화되어 있어야 함 (마이그레이션이 `CREATE EXTENSION IF NOT EXISTS`로 시도하지만 권한 거부 시 Dashboard에서 수동 활성화 필요)
- Vault에 `supabase_url`, `service_role_key` 시크릿이 등록되어야 함

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `uniqn-mobile/supabase/migrations/20260414130000_setup_outbox_cron.sql`:

```sql
-- ============================================================
-- T-B11: sync-schedule-board-outbox pg_cron 스케줄링
-- ============================================================
-- 목적: Edge Function을 1분마다 자동 호출하여 outbox pending 처리.
-- 의존: pg_cron, pg_net extension + vault 시크릿(supabase_url, service_role_key)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 기존 동명 job 제거 (재실행 안전성)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-schedule-board-outbox') THEN
    PERFORM cron.unschedule('sync-schedule-board-outbox');
  END IF;
END $$;

-- vault에서 URL/키 읽어 1분마다 Edge Function 호출
SELECT cron.schedule(
  'sync-schedule-board-outbox',
  '* * * * *',  -- 매 분
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/sync-schedule-board-outbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

COMMENT ON EXTENSION pg_cron IS 'sync-schedule-board-outbox 스케줄링용';
```

- [ ] **Step 2: 마이그레이션 적용 (로컬 또는 staging)**

Run:
```bash
cd uniqn-mobile
supabase db push
```
Expected: `Applying migration 20260414130000_setup_outbox_cron.sql ... done`

만약 vault 시크릿이 없으면 다음을 먼저 실행 (Supabase Studio SQL Editor 또는 supabase db psql):
```sql
SELECT vault.create_secret('https://YOUR-PROJECT.supabase.co', 'supabase_url');
SELECT vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');
```

- [ ] **Step 3: cron job 등록 검증**

Run:
```bash
supabase db psql -c "SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'sync-schedule-board-outbox';"
```
Expected output: `sync-schedule-board-outbox | * * * * * | t`

- [ ] **Step 4: 1분 후 호출 로그 검증**

Wait 90 seconds then run:
```bash
supabase db psql -c "SELECT runid, status, return_message FROM cron.job_run_details WHERE jobname = 'sync-schedule-board-outbox' ORDER BY start_time DESC LIMIT 3;"
```
Expected: 최소 1행, status='succeeded'

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/supabase/migrations/20260414130000_setup_outbox_cron.sql
git commit -m "feat(atomicity): pg_cron으로 sync-schedule-board-outbox 자동 호출 (T-B11)"
```

---

## Task 2: outbox failed_retry_limit Slack 알림

**목적:** Edge Function 처리 중 한 행이 `failed_retry_limit`로 진입하면 즉시 Slack webhook으로 alert. 운영팀이 수동 백필 시점을 인지할 수 있게 한다.

**Files:**
- Modify: `uniqn-mobile/supabase/functions/sync-schedule-board-outbox/index.ts`
- Modify: `uniqn-mobile/.env.example` (SLACK_OUTBOX_ALERT_WEBHOOK 추가)

- [ ] **Step 1: .env.example에 환경변수 문서화**

Modify `uniqn-mobile/.env.example` — 기존 EXPO_PUBLIC_SENTRY_DSN 근처에 추가:

```
# T-B11: outbox failed_retry_limit 알림용 (Edge Function 환경변수)
# Supabase Dashboard > Edge Functions > Secrets에 등록
# SLACK_OUTBOX_ALERT_WEBHOOK=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

- [ ] **Step 2: Edge Function에 Slack alert 함수 추가**

Modify `uniqn-mobile/supabase/functions/sync-schedule-board-outbox/index.ts` — `MAX_RETRY` 상수 아래에 함수 추가:

```typescript
const SLACK_WEBHOOK = Deno.env.get('SLACK_OUTBOX_ALERT_WEBHOOK');

async function sendSlackAlert(failed: ProcessResult[]): Promise<void> {
  if (!SLACK_WEBHOOK || failed.length === 0) return;

  const lines = failed.map(
    (r) => `• \`${r.id}\` (job_posting=${r.job_posting_id}): ${r.error ?? 'unknown'}`
  );
  const text = [
    `:rotating_light: *outbox failed_retry_limit* (${failed.length}건)`,
    ...lines,
    `_check: SELECT * FROM schedule_board_sync_outbox WHERE status = 'failed_retry_limit';_`,
  ].join('\n');

  try {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error('slack alert failed', err);
  }
}
```

- [ ] **Step 3: Deno.serve 핸들러에서 alert 호출 추가**

Modify same file — 기존 `summary` 객체 생성 직후, response return 직전에 alert 호출:

```typescript
    const summary = {
      processed: results.length,
      success: results.filter((r) => r.outcome === 'success').length,
      retried: results.filter((r) => r.outcome === 'retry').length,
      failed: results.filter((r) => r.outcome === 'failed_retry_limit').length,
      results,
    };

    // T-B11: failed_retry_limit 행 발생 시 Slack alert
    const failedRows = results.filter((r) => r.outcome === 'failed_retry_limit');
    if (failedRows.length > 0) {
      await sendSlackAlert(failedRows);
    }

    return new Response(JSON.stringify(summary), {
```

- [ ] **Step 4: Edge Function 재배포**

Run:
```bash
cd uniqn-mobile
supabase functions deploy sync-schedule-board-outbox
```
Expected: `Deployed Function sync-schedule-board-outbox`

- [ ] **Step 5: Slack 시크릿 설정 (수동)**

```bash
# 사용자가 Slack incoming webhook URL을 발급한 후:
supabase secrets set SLACK_OUTBOX_ALERT_WEBHOOK=https://hooks.slack.com/services/...
```
사용자가 webhook URL을 모르거나 설정 안 하면 알림은 silently disabled (코드는 `if (!SLACK_WEBHOOK) return`로 안전).

- [ ] **Step 6: Commit**

```bash
git add uniqn-mobile/supabase/functions/sync-schedule-board-outbox/index.ts uniqn-mobile/.env.example
git commit -m "feat(observability): outbox failed_retry_limit Slack 알림 (T-B11)"
```

---

## Task 3: SQL fixture 보완 — cancel_application_atomically + process_qr_checkin_atomically

**목적:** 두 atomicity RPC의 SQL 회귀 테스트가 실제로 실행되도록 fixture INSERT를 채운다. 모든 시나리오를 BEGIN/ROLLBACK으로 격리.

**Files:**
- Modify: `uniqn-mobile/supabase/tests/cancel_application_atomically.test.sql`
- Modify: `uniqn-mobile/supabase/tests/process_qr_checkin_atomically.test.sql`

**전제 — 스키마 확인:** 마이그레이션 파일들에서 다음 컬럼 사용 확인됨:
- `users(id uuid pk, email text, role text, created_at)` (auth.users 미러링 또는 public.users)
- `job_postings(id, owner_id, total_positions, filled_positions, status, title, ...)`
- `applications(id, job_posting_id, applicant_id, status, confirmation_history jsonb, cancellation_request jsonb, ...)`
- `work_logs(id, application_id, status, work_date, ...)`

(스키마 오류 발생 시 `supabase db psql -c "\d applications"`로 실제 컬럼 확인 후 보정)

- [ ] **Step 1: cancel_application_atomically.test.sql fixture INSERT 활성화**

Modify `uniqn-mobile/supabase/tests/cancel_application_atomically.test.sql` — L37-47 (DO 블록 시작 직후) 픽스처 INSERT 주석 해제 + 실제 코드:

```sql
  -- 픽스처 INSERT
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES
    (v_owner_id, format('owner-%s@test.local', v_owner_id), 'employer', now(), now()),
    (v_staff_id, format('staff-%s@test.local', v_staff_id), 'staff', now(), now()),
    (v_other_user_id, format('other-%s@test.local', v_other_user_id), 'staff', now(), now());

  INSERT INTO public.job_postings (id, owner_id, title, total_positions, filled_positions, status, created_at, updated_at)
  VALUES (v_job_id, v_owner_id, 'TEST 공고', 5, 1, 'active', now(), now());

  INSERT INTO public.applications (id, job_posting_id, applicant_id, status, confirmation_history, created_at, updated_at)
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'confirmed',
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-01'))),
      'cancelled_at', NULL,
      'confirmed_at', now()::text
    )),
    now(), now()
  );

  INSERT INTO public.work_logs (id, application_id, status, work_date, created_at, updated_at)
  VALUES (v_work_log_id, v_app_id, 'scheduled', '2026-05-01', now(), now());
```

- [ ] **Step 2: 시나리오 1, 3, 4, 5, 2 어설션 활성화**

Modify same file — L52-142 모든 ASSERT 블록 주석 해제 (이미 작성된 코드 그대로). 기존 텍스트의 `--` 접두사만 제거.

- [ ] **Step 3: 로컬 실행 검증**

Run:
```bash
cd uniqn-mobile
supabase db psql -f supabase/tests/cancel_application_atomically.test.sql
```
Expected: `NOTICE: cancel_application_atomically tests: OK` 마지막 출력, ROLLBACK 완료, 종료 코드 0

만약 스키마 mismatch (예: `column "updated_at" does not exist`) 발생 시 해당 컬럼 제거 또는 보정.

- [ ] **Step 4: process_qr_checkin_atomically.test.sql 동일 작업**

Read `uniqn-mobile/supabase/tests/process_qr_checkin_atomically.test.sql`, 동일하게 fixture 활성화. 이 파일의 시나리오는 attendance check-in/out 위주이므로 attendance_records (또는 work_logs)에 맞는 fixture 준비.

(파일을 읽어본 뒤 시나리오 별로 INSERT 추가 — 픽스처 변수는 `v_staff_id`, `v_qr_token`, `v_event_id` 등을 사용)

- [ ] **Step 5: process 테스트 실행 검증**

```bash
supabase db psql -f supabase/tests/process_qr_checkin_atomically.test.sql
```
Expected: NOTICE OK + ROLLBACK + 종료 코드 0

- [ ] **Step 6: Commit**

```bash
git add uniqn-mobile/supabase/tests/
git commit -m "test(atomicity): SQL 회귀 테스트 fixture 활성화 (T-W3.1)"
```

---

## Task 6: cancel_application_atomically 통합 테스트 — idempotency + race

**목적:** Task 3에서 활성화된 happy path를 넘어, 동시성 race를 검증하는 시나리오 추가. 두 트랜잭션이 동시에 같은 application을 취소 시도해도 결과가 일관되도록.

**Files:**
- Create: `uniqn-mobile/supabase/tests/cancel_application_race.test.sql`

- [ ] **Step 1: race 시나리오 테스트 파일 작성**

Create `uniqn-mobile/supabase/tests/cancel_application_race.test.sql`:

```sql
-- ============================================================
-- T-W3.1: cancel_application_atomically race 검증
-- ============================================================
-- 시나리오:
--   R1. 동시 호출 idempotency: 두 SELECT FOR UPDATE 시나리오에서 두 번째 호출이
--       idempotent로 success 반환하는지 검증 (직렬화 후 첫 번째는 실제 취소,
--       두 번째는 status='applied' 보고 idempotent=true)
--   R2. 권한 없는 actor의 동시 시도는 unauthorized
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app_id uuid := gen_random_uuid();
  v_first jsonb;
  v_second jsonb;
BEGIN
  -- 픽스처
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES
    (v_owner_id, format('owner-%s@test.local', v_owner_id), 'employer', now(), now()),
    (v_staff_id, format('staff-%s@test.local', v_staff_id), 'staff', now(), now());

  INSERT INTO public.job_postings (id, owner_id, title, total_positions, filled_positions, status, created_at, updated_at)
  VALUES (v_job_id, v_owner_id, 'RACE TEST', 3, 1, 'active', now(), now());

  INSERT INTO public.applications (id, job_posting_id, applicant_id, status, confirmation_history, created_at, updated_at)
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'confirmed',
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-06-01'))),
      'cancelled_at', NULL
    )),
    now(), now()
  );

  -- R1: 동일 트랜잭션 내 연속 호출 (race를 단일 세션으로 단순화)
  v_first := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_staff_id,
    p_cancel_reason := 'first call'
  );
  ASSERT (v_first->>'success')::bool = true,
    format('R1 first call expected success, got: %s', v_first);
  ASSERT v_first->>'new_status' = 'applied',
    format('R1 first call expected new_status=applied, got: %s', v_first);

  v_second := public.cancel_application_atomically(
    p_application_id := v_app_id,
    p_actor_type := 'staff_initiates',
    p_actor_id := v_staff_id,
    p_cancel_reason := 'second call'
  );
  ASSERT (v_second->>'success')::bool = true
    AND (v_second->>'idempotent')::bool = true,
    format('R1 second call expected idempotent=true, got: %s', v_second);

  -- 사이드이펙트: filled_positions가 1 → 0이지만 두 번째 호출 후에도 0 유지
  ASSERT (SELECT filled_positions FROM public.job_postings WHERE id = v_job_id) = 0,
    'R1 expected filled_positions=0 after both calls';

  RAISE NOTICE 'cancel_application_race tests: OK';
END $$;

ROLLBACK;
```

**Note on real concurrency:** True parallel race (두 별도 세션에서 SELECT FOR UPDATE 동시 시도)는 PL/pgSQL 단일 트랜잭션 안에서 시뮬레이션 불가. 실제 race는 RPC 자체의 SELECT FOR UPDATE가 보장하므로, 본 테스트는 idempotency 가지가 동작함을 보장하면 충분. 별도 외부 도구(예: pgbench, jest-concurrent) 검증은 추후 작업.

- [ ] **Step 2: 실행 검증**

```bash
cd uniqn-mobile
supabase db psql -f supabase/tests/cancel_application_race.test.sql
```
Expected: `NOTICE: cancel_application_race tests: OK` + 종료 코드 0

- [ ] **Step 3: 실패 시 진단**

만약 ASSERT fail 시 `RAISE NOTICE 'first=%, second=%', v_first, v_second;`를 ASSERT 위에 추가해 실제 jsonb 출력 확인 후 보정.

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/supabase/tests/cancel_application_race.test.sql
git commit -m "test(atomicity): cancel RPC race/idempotency 통합 테스트 (T-W3.1)"
```

---

## Task 4: applicationHistoryService + confirmedStaffService → outbox enqueue

**목적:** legacy 직접 sync 호출을 outbox enqueue로 전환. 이를 통해 모든 board sync가 단일 진실 소스(outbox)를 거치며 atomicity 보장.

**Files:**
- Modify: `uniqn-mobile/src/services/jobs/applicationHistoryService.ts`
- Modify: `uniqn-mobile/src/services/work/confirmedStaffService.ts`
- Modify: `uniqn-mobile/src/services/jobs/jobManagementService.ts` (enqueue 함수 export)

**핵심 변경:** `enqueueScheduleBoardSync`는 jobPostingId를 받지만 호출처는 applicationId만 가진 경우가 있음. → application repository에서 jobPostingId 조회 후 enqueue.

- [ ] **Step 1: jobManagementService에서 enqueue 함수 export**

Modify `uniqn-mobile/src/services/jobs/jobManagementService.ts:26-50` — `async function enqueueScheduleBoardSync` 앞에 `export` 키워드 추가:

```typescript
export async function enqueueScheduleBoardSync(
  jobPostingId: string,
  action: ScheduleBoardSyncAction,
  payload: Record<string, unknown> = {}
): Promise<void> {
```

또한 `ScheduleBoardSyncAction` 타입도 export:

```typescript
export type ScheduleBoardSyncAction = 'create' | 'update' | 'delete' | 'close' | 'reopen';
```

- [ ] **Step 2: applicationHistoryService 변환**

Modify `uniqn-mobile/src/services/jobs/applicationHistoryService.ts:14, 23-34`:

기존:
```typescript
import { syncScheduleBoardByApplicationId } from '@/services/boardService';

async function syncScheduleBoardSafely(applicationId: string, action: 'confirm' | 'cancel') {
  try {
    await syncScheduleBoardByApplicationId(applicationId);
  } catch (error) {
    logger.warn('Schedule board sync failed', { ... });
  }
}
```

신규:
```typescript
import { applicationRepository } from '@/repositories';
import { enqueueScheduleBoardSync } from '@/services/jobs/jobManagementService';

async function syncScheduleBoardSafely(applicationId: string, action: 'confirm' | 'cancel') {
  try {
    const app = await applicationRepository.getById(applicationId);
    if (!app?.jobPostingId) {
      logger.warn('Schedule board enqueue skipped: jobPostingId missing', {
        component: 'applicationHistoryService',
        applicationId,
        action,
      });
      return;
    }
    await enqueueScheduleBoardSync(app.jobPostingId, 'update', {
      jobPostingId: app.jobPostingId,
      applicationId,
      reason: action,
    });
  } catch (error) {
    logger.warn('Schedule board enqueue failed', {
      component: 'applicationHistoryService',
      applicationId,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

**확인:** `applicationRepository.getById` 메서드가 존재하고 `jobPostingId`를 반환하는지 검증. 없으면 `applicationRepository.findById` 등 실제 메서드명으로 보정.

- [ ] **Step 3: applicationRepository.getById 확인**

Run:
```bash
grep -n "getById\|findById\|getApplicationById" uniqn-mobile/src/repositories/applicationRepository.ts
```
Expected: `getById` 또는 `findById` 메서드 존재. 둘 다 없으면 새로 추가하거나 기존 메서드 사용.

- [ ] **Step 4: confirmedStaffService 변환**

Modify `uniqn-mobile/src/services/work/confirmedStaffService.ts:7, 202-208`:

기존:
```typescript
import { syncScheduleBoardByJobPostingId } from '@/services/boardService';
// ...
if (workLog?.jobPostingId) {
  try {
    await syncScheduleBoardByJobPostingId(workLog.jobPostingId);
  } catch (error) {
    logger.warn('Schedule board sync failed after confirmed staff status update', { ... });
  }
}
```

신규:
```typescript
import { enqueueScheduleBoardSync } from '@/services/jobs/jobManagementService';
// ...
if (workLog?.jobPostingId) {
  try {
    await enqueueScheduleBoardSync(workLog.jobPostingId, 'update', {
      jobPostingId: workLog.jobPostingId,
      reason: 'confirmed_staff_status_update',
    });
  } catch (error) {
    logger.warn('Schedule board enqueue failed after confirmed staff status update', {
      component: 'confirmedStaffService',
      jobPostingId: workLog.jobPostingId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

- [ ] **Step 5: 타입 체크 + lint**

Run:
```bash
cd uniqn-mobile
npm run quality
```
Expected: 0 errors. circular import 발생 시(`applicationHistoryService → jobManagementService → ?`) 확인하고 보정.

- [ ] **Step 6: 기존 단위 테스트 실행**

Run:
```bash
cd uniqn-mobile
npx jest applicationHistoryService confirmedStaffService 2>&1 | tail -30
```
Expected: 모든 기존 테스트 통과. enqueue 함수 모킹이 필요할 수 있음 — 실패 시 mock 추가.

- [ ] **Step 7: Commit**

```bash
git add uniqn-mobile/src/services/jobs/jobManagementService.ts \
        uniqn-mobile/src/services/jobs/applicationHistoryService.ts \
        uniqn-mobile/src/services/work/confirmedStaffService.ts
git commit -m "refactor(atomicity): applicationHistory/confirmedStaff sync를 outbox enqueue로 전환 (T-B12)"
```

---

## Task 5: boardService direct sync 함수 deprecation

**목적:** Task 4 이후 boardService의 `syncScheduleBoardByApplicationId`, `syncScheduleBoardByJobPostingId`, `syncScheduleBoardForJobPosting`를 호출하는 코드는 boardService 내부 자기 호출만 남음. 이들을 `@deprecated` 마크하고 제거 경로 명시.

**Files:**
- Modify: `uniqn-mobile/src/services/boardService.ts:1597-1672`

- [ ] **Step 1: 외부 호출처가 전부 사라졌는지 확인**

Run:
```bash
grep -rn "syncScheduleBoardForJobPosting\|syncScheduleBoardByJobPostingId\|syncScheduleBoardByApplicationId" uniqn-mobile/src --include="*.ts" | grep -v boardService.ts
```
Expected: 0 lines (Task 4가 모두 제거했으므로). 만약 남아있으면 누락 호출처 발견 → Task 4로 돌아가 보정.

- [ ] **Step 2: deprecation JSDoc 추가**

Modify `uniqn-mobile/src/services/boardService.ts:1597` — `syncScheduleBoardForJobPosting` 함수 직전에:

```typescript
/**
 * @deprecated T-B12 — 직접 호출 금지. 대신 jobManagementService.enqueueScheduleBoardSync를
 * 사용하여 outbox 패턴을 거칠 것. 이 함수는 outbox Edge Function 내부에서만 사용해야 하며,
 * 다음 마이너 릴리스에서 export 제거 예정.
 *
 * 마이그레이션 가이드:
 *   await syncScheduleBoardForJobPosting(jp);
 *   ↓
 *   await enqueueScheduleBoardSync(jp.id, 'update', { jobPostingId: jp.id });
 */
export async function syncScheduleBoardForJobPosting(...
```

동일 패턴을 `syncScheduleBoardByJobPostingId` (L1643) + `syncScheduleBoardByApplicationId` (L1663)에도 적용.

- [ ] **Step 3: ESLint 룰로 외부 호출 차단 (선택)**

`.eslintrc.js`나 `eslint.config.js`에 `no-restricted-imports`로 추가:

```javascript
{
  files: ['src/**/*.ts', 'src/**/*.tsx'],
  ignores: ['src/services/boardService.ts', 'supabase/functions/sync-schedule-board-outbox/**'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "ImportSpecifier[imported.name=/^syncScheduleBoard(ForJobPosting|ByJobPostingId|ByApplicationId)$/]",
        message: 'T-B12: outbox enqueue를 사용하세요. enqueueScheduleBoardSync from "@/services/jobs/jobManagementService"',
      },
    ],
  },
}
```

(eslint config 형태가 flat config인지 legacy인지에 따라 보정)

- [ ] **Step 4: 타입 체크 + lint**

```bash
cd uniqn-mobile
npm run quality
```
Expected: 0 errors. deprecated 마크는 warning이지만 lint failure는 아님.

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/services/boardService.ts uniqn-mobile/eslint.config.js
git commit -m "refactor(atomicity): boardService 직접 sync 함수 deprecation (T-B12)"
```

---

## 완료 검증 체크리스트

전체 작업 완료 후 다음을 순서대로 확인:

- [ ] `supabase db psql -c "SELECT jobname, active FROM cron.job;"`에 `sync-schedule-board-outbox` 활성 상태
- [ ] 1분 대기 후 `supabase db psql -c "SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 3;"`에 succeeded 확인
- [ ] `supabase db psql -c "SELECT status, count(*) FROM schedule_board_sync_outbox GROUP BY status;"`에서 pending이 누적되지 않음
- [ ] `supabase db psql -f supabase/tests/cancel_application_atomically.test.sql` 종료 코드 0
- [ ] `supabase db psql -f supabase/tests/process_qr_checkin_atomically.test.sql` 종료 코드 0
- [ ] `supabase db psql -f supabase/tests/cancel_application_race.test.sql` 종료 코드 0
- [ ] `npm run quality` 0 errors
- [ ] `grep -rn "syncScheduleBoardBy\|syncScheduleBoardFor" uniqn-mobile/src --include="*.ts" | grep -v boardService.ts` → 0 lines
- [ ] Slack webhook URL 설정 후 임의로 outbox 행을 `failed_retry_limit`로 변경 → Edge Function 호출 → Slack 메시지 수신 확인 (선택적, webhook 미설정 시 스킵)

## 알려진 위험

| 위험 | 완화책 |
|------|--------|
| pg_cron/pg_net extension이 Supabase Free tier에서 비활성 | Dashboard에서 수동 활성화 또는 외부 cron(GitHub Actions) fallback |
| vault 시크릿 미등록 시 pg_cron 호출 실패 | Step 2 안내문에 vault.create_secret SQL 포함 |
| Slack webhook URL 미설정 시 alert 누락 | 코드는 `if (!SLACK_WEBHOOK) return`로 silently skip — 운영팀이 별도 모니터링 가능 |
| applicationRepository.getById 메서드명 다를 가능성 | Step 3에서 검증 후 보정 |
| Race test가 단일 세션이라 진정한 병렬 검증 아님 | Note 명시 + RPC 자체 SELECT FOR UPDATE 신뢰 |
| applications 스키마 컬럼 mismatch | Step 1 후 첫 실행에서 즉시 발견 → 보정 |
