# work_logs timestamptz Phase C — Readers Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `work_logs.check_in_time`/`check_out_time` (jsonb) 읽기 경로를 새 timestamptz 컬럼(`check_in_ts`/`check_out_ts`)으로 전환하여 Phase D (jsonb DROP) 선행 조건을 만든다.

**Architecture:** Phase A 에서 추가된 `check_in_ts`/`check_out_ts` timestamptz 컬럼은 `tr_sync_work_log_ts` trigger 로 기존 jsonb 컬럼 쓰기와 자동 동기화됨. Phase C 에서는 Repository SELECT/ORDER, RPC 읽기, 도메인 파싱 지점만 새 컬럼으로 전환하고, writers 는 그대로 jsonb 에 쓰도록 둔다 (Phase B 는 redundant 라 스킵). RPC 는 timestamptz 직접 쓰기로 전환하되 Phase D 까지 jsonb 도 dual-write 하여 호환 유지.

**Tech Stack:** Supabase (PostgreSQL timestamptz), PostgREST, Zod 4.x, TypeScript strict, Jest. Supabase migrations via MCP `apply_migration` (per feedback_supabase_migration_workflow.md — `supabase db push` 금지).

---

## 전제

- **Phase A 완료** (commit `0444c9033`):
  - `work_logs.check_in_ts timestamptz`, `check_out_ts timestamptz` 컬럼 존재
  - `tr_sync_work_log_ts` BEFORE INSERT/UPDATE OF check_in_time, check_out_time trigger 동작 중
  - 기존 row backfill 완료 (2 rows 전수 일치 확인)
- **호환 정책**: Phase C 동안 jsonb 컬럼(`check_in_time`/`check_out_time`)은 남아있고 trigger 가 ts 로 sync. 따라서 writer 코드 수정 없이 readers 만 전환 가능.
- **범위 축소**: REFACTOR-5.md 의 "TimeNormalizer.parseTime() 호출 지점 제거"는 work_logs 데이터 흐름 한정 — `scheduleService`, `timeHelpers`, `WorkTimeDisplay` 등 일반 시간 파싱은 건드리지 않음 (별개 도메인). 이 플랜은 `WorkLogRepository.getStats`, `executeUpdateWorkTime` 2곳만 대상.

## File Structure

**수정 파일 (7):**
- `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryHelpers.ts` — TABLE_COLUMNS 에 `check_in_ts, check_out_ts` 추가, `toWorkLog` 에서 ts 우선 매핑
- `uniqn-mobile/src/repositories/supabase/WorkLogRepository.ts` — `.order('check_in_time')` → `.order('check_in_ts')`, `getStats` 에서 `TimeNormalizer.parseTime` → `new Date()` 직접 호출
- `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryTransactions.ts` — `executeUpdateWorkTime` 의 `TimeNormalizer.parseTime(workLog.checkInTime)` → `new Date(workLog.checkInTime)` 직접 호출 (스키마가 이미 ISO string 보장)
- `uniqn-mobile/src/repositories/supabase/UserRepository.ts:508` — export select 에 `check_in_ts, check_out_ts` 추가
- `uniqn-mobile/src/repositories/supabase/__tests__/qrCheckinAtomic.test.ts` — 신규 `check_in_ts`/`check_out_ts` 응답 필드 추가 (회귀 방지)

**신규 migration:**
- `uniqn-mobile/supabase/migrations/20260421180000_worklog_ts_phase_c_rpc_dual_write.sql` — `process_qr_checkin_atomically` RPC 를 timestamptz dual-write + duration 계산을 `check_in_ts` 직접 사용으로 리팩토링

**검증 파일 (touch 불필요, 회귀 확인용):**
- `uniqn-mobile/src/domains/schedule/__tests__/ScheduleConverter.test.ts`
- `uniqn-mobile/src/domains/review/__tests__/reviewDeadline.test.ts`
- `uniqn-mobile/src/domains/__tests__/SettlementCalculator.test.ts`

**건드리지 않는 파일 (Phase C 범위 외):**
- `SettlementRepository.ts:135-141` — writer (jsonb 유지, trigger 가 sync)
- `ApplicationRepositoryTransactions.ts:378-379` — writer (null 초기화만)
- `schemas/workLog.schema.ts`, `schemas/common.ts` — `optionalTimestampSchema` 가 이미 ISO string 정규화 완료 (2026-04-19 `project_firebase_timestamp_cleanup.md` 참조). 추가 단순화는 효과 없음.
- `domains/schedule/ScheduleConverter.ts`, `domains/settlement/helpers.ts`, `domains/staff/confirmedStaff.ts`, `domains/review/reviewDeadline.ts` — 도메인 레이어는 `workLog.checkInTime` (ISO string) 을 소비하고, 자체 `toDate()`/`TimeNormalizer.parseTime` 호출은 일반 시간 파싱 유틸이므로 유지.

---

## Task 1: TABLE_COLUMNS + toWorkLog 매퍼 확장

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryHelpers.ts:20-30`

- [ ] **Step 1: `TABLE_COLUMNS` 에 `check_in_ts, check_out_ts` 추가**

`WorkLogRepositoryHelpers.ts:20-21` 의 `TABLE_COLUMNS` 상수에서 기존 문자열에 `check_in_ts,check_out_ts` 를 추가한다.

```typescript
export const TABLE_COLUMNS =
  'id,application_id,assignment_group_id,check_in_time,check_in_ts,check_out_time,check_out_ts,created_at,custom_allowances,custom_role,custom_salary_info,custom_tax_settings,date,has_time_modification_logs,is_fixed_posting,job_posting_id,modification_history,no_show_at,no_show_reason,notes,owner_id,payroll_amount,payroll_date,payroll_notes,payroll_status,role,role_change_history,settlement_modification_history,staff_id,staff_name,staff_nickname,staff_photo_url,staff_photo_url_blurhash,status,time_slot,updated_at' as const;
```

> **Why both?** jsonb 컬럼을 당분간 함께 select 하여 Phase D 전까지 fallback 가능. 다음 단계에서 ts 를 우선하도록 매핑.

- [ ] **Step 2: `toWorkLog` 에 ts → ISO string 우선 매핑 추가**

`WorkLogRepositoryHelpers.ts:27-30` 의 `toWorkLog` 함수를 수정하여, `toCamelCase` 결과의 `checkInTs`/`checkOutTs` (PostgREST 가 timestamptz 를 ISO string 으로 직렬화) 를 `checkInTime`/`checkOutTime` 필드로 치환한다. 이렇게 하면 schema (`parseWorkLogDocument`) 와 domain layer 는 수정 불필요.

```typescript
export function toWorkLog(row: Record<string, unknown>): WorkLog | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  // Phase C: check_in_ts/check_out_ts (timestamptz) 우선. 구 jsonb 값은 fallback.
  // PostgREST 가 timestamptz 를 ISO string 으로 직렬화하므로 바로 도메인 타입에 호환.
  const checkInTime = camel.checkInTs ?? camel.checkInTime;
  const checkOutTime = camel.checkOutTs ?? camel.checkOutTime;
  return parseWorkLogDocument({ ...camel, id: row.id, checkInTime, checkOutTime });
}

export function rowsToWorkLogs(rows: Record<string, unknown>[]): WorkLog[] {
  return parseWorkLogDocuments(
    rows.map((row) => {
      const camel = toCamelCase<Record<string, unknown>>(row);
      const checkInTime = camel.checkInTs ?? camel.checkInTime;
      const checkOutTime = camel.checkOutTs ?? camel.checkOutTime;
      return { ...camel, id: row.id, checkInTime, checkOutTime };
    })
  );
}
```

- [ ] **Step 3: 타입 체크 실행**

Run: `cd uniqn-mobile && npm run type-check`
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/WorkLogRepositoryHelpers.ts
git commit -m "refactor(worklog): Phase C.1 — TABLE_COLUMNS 에 check_in_ts/check_out_ts 추가 + toWorkLog ts 우선 매핑"
```

---

## Task 2: WorkLogRepository ORDER BY + getStats 단순화

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/WorkLogRepository.ts:168, 305-316`

- [ ] **Step 1: `.order('check_in_time')` → `.order('check_in_ts')`**

`WorkLogRepository.ts:168` 의 `getByDate` 메서드에서 jsonb 컬럼 ordering 을 timestamptz ordering 으로 교체.

```typescript
// Before:
.order('check_in_time', { ascending: false });

// After:
.order('check_in_ts', { ascending: false, nullsFirst: false });
```

> **Why nullsFirst: false?** jsonb ordering 은 jsonb null/NULL 구분이 불명확했지만 timestamptz NULL 은 표준 정렬에 들어감. 기존 동작 유지 (체크인 안 한 기록은 아래).

- [ ] **Step 2: `getStats` 에서 TimeNormalizer.parseTime 제거**

`WorkLogRepository.ts:305-316` 의 duration 계산부를 수정. `workLog.checkInTime` 은 Phase C 매핑 후 항상 ISO string 이므로 `TimeNormalizer.parseTime` 호출 불필요.

```typescript
if (workLog.checkInTime && workLog.checkOutTime) {
  const checkInMs = Date.parse(String(workLog.checkInTime));
  const checkOutMs = Date.parse(String(workLog.checkOutTime));
  if (Number.isFinite(checkInMs) && Number.isFinite(checkOutMs)) {
    const durationHours = (checkOutMs - checkInMs) / (1000 * 60 * 60);
    if (durationHours > 0) {
      stats.totalHoursWorked += durationHours;
    }
  }
}
```

> **Why `Date.parse` over `new Date()`?** NaN 검증이 한 번에 끝남. `TimeInput` 이 아직 `Date | string | number | null | undefined` 유니언이라 `String(...)` 강제 캐스팅 필요 (`Date` 인스턴스면 ISO 표현으로 parse, number 면 `NaN`).

- [ ] **Step 3: 만약 `TimeNormalizer` import 가 getStats 외 사용처 없으면 제거**

`WorkLogRepository.ts:18` 의 `import { TimeNormalizer } from '@/shared/time'` 를 확인. `getStats` 에서만 썼다면 import 삭제.

Run: `cd uniqn-mobile && grep -n "TimeNormalizer" src/repositories/supabase/WorkLogRepository.ts`
Expected: 0 matches (or delete the import line if matched)

- [ ] **Step 4: Jest 실행 — WorkLogRepository 관련 테스트 회귀 없음 확인**

Run: `cd uniqn-mobile && npx jest --testPathPattern="WorkLog|workLog" --no-coverage`
Expected: All related tests PASS

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/WorkLogRepository.ts
git commit -m "refactor(worklog): Phase C.2 — getByDate order check_in_ts 로 전환 + getStats TimeNormalizer 제거"
```

---

## Task 3: executeUpdateWorkTime TimeNormalizer 제거

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryTransactions.ts:84-94`

- [ ] **Step 1: duration 재계산부의 TimeNormalizer.parseTime 호출 제거**

`WorkLogRepositoryTransactions.ts:84-87` 를 ISO string 직접 파싱으로 교체. `workLog.checkInTime` 은 Phase C 매퍼가 항상 ISO string 으로 반환하므로 `Date.parse` 로 충분.

```typescript
// workDuration 재계산 (ISO string → ms)
const finalCheckInMs = updates.checkInTime
  ? updates.checkInTime.getTime()
  : workLog.checkInTime
    ? Date.parse(String(workLog.checkInTime))
    : NaN;
const finalCheckOutMs = updates.checkOutTime
  ? updates.checkOutTime.getTime()
  : workLog.checkOutTime
    ? Date.parse(String(workLog.checkOutTime))
    : NaN;

if (Number.isFinite(finalCheckInMs) && Number.isFinite(finalCheckOutMs)) {
  const durationMinutes = Math.round((finalCheckOutMs - finalCheckInMs) / (1000 * 60));
  updateData.work_duration = Math.round((durationMinutes / 60) * 100) / 100;
}
```

- [ ] **Step 2: `TimeNormalizer` import 제거 확인**

`WorkLogRepositoryTransactions.ts:17` 의 import 확인. `executeUpdateWorkTime` 외 사용처 없으면 삭제.

Run: `cd uniqn-mobile && grep -n "TimeNormalizer" src/repositories/supabase/WorkLogRepositoryTransactions.ts`
Expected: 0 matches (or remove the import line)

- [ ] **Step 3: 타입 체크 + Jest 실행**

Run: `cd uniqn-mobile && npm run type-check && npx jest --testPathPattern="WorkLog|workLog|qrCheckin" --no-coverage`
Expected: 0 type errors, all related tests PASS

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/WorkLogRepositoryTransactions.ts
git commit -m "refactor(worklog): Phase C.3 — executeUpdateWorkTime TimeNormalizer 제거, ISO string 직접 파싱"
```

---

## Task 4: UserRepository export select 확장

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/UserRepository.ts:506-509`

- [ ] **Step 1: `exportUserData` 의 work_logs select 에 `check_in_ts, check_out_ts` 추가**

```typescript
supabase
  .from(TABLES.WORK_LOGS)
  .select('id, date, check_in_time, check_in_ts, check_out_time, check_out_ts')
  .eq('staff_id', userId),
```

> **Why both?** 이 select 결과는 사용자에게 JSON 으로 내보냄. Phase D 에서 jsonb 컬럼 DROP 후 재수정 필요하지만, Phase C 동안 dual export 로 안전.

- [ ] **Step 2: 타입 체크**

Run: `cd uniqn-mobile && npm run type-check`
Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/UserRepository.ts
git commit -m "refactor(user): Phase C.4 — exportUserData select 에 check_in_ts/check_out_ts 추가"
```

---

## Task 5: process_qr_checkin_atomically RPC — timestamptz dual-write

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260421180000_worklog_ts_phase_c_rpc_dual_write.sql`

- [ ] **Step 1: 신규 migration 파일 작성**

기존 RPC 를 `CREATE OR REPLACE FUNCTION` 으로 덮어쓴다. 변경점:
1. UPDATE 시 `check_in_ts = p_check_time` / `check_out_ts = p_check_time` 를 추가 (dual-write)
2. checkOut duration 계산을 `v_work_log.check_in_ts` 직접 사용 (jsonb 추출 로직 제거)
3. 기존 `check_in_time = to_jsonb(v_now)` / `check_out_time = to_jsonb(v_now)` 는 Phase D 전까지 유지 (trigger 가 ts 로 역동기 불필요 — 우리가 직접 쓰므로)

```sql
-- work_logs timestamptz 전환 Phase C (후속 리팩토링 #5)
-- 목표: process_qr_checkin_atomically 를 check_in_ts/check_out_ts dual-write 로 전환
-- + duration 계산을 timestamptz 직접 사용 (jsonb 추출 로직 제거)
-- 기존 jsonb 컬럼도 계속 씀 (Phase D 전까지 reader 호환)

CREATE OR REPLACE FUNCTION public.process_qr_checkin_atomically(
  p_work_log_id uuid,
  p_staff_id uuid,
  p_job_posting_id uuid,
  p_action text,
  p_check_time timestamptz DEFAULT now(),
  p_expected_date text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_work_log work_logs%ROWTYPE;
  v_job_posting_status text;
  v_now text := to_char(p_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_work_duration numeric := 0;
  v_duration_minutes numeric;
BEGIN
  -- 1. Lock work_log row
  SELECT * INTO v_work_log
  FROM work_logs
  WHERE id = p_work_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found');
  END IF;

  -- 2. Lock job_posting row
  SELECT status INTO v_job_posting_status
  FROM job_postings
  WHERE id = p_job_posting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- 3. Defensive validations
  IF v_work_log.staff_id IS DISTINCT FROM p_staff_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch');
  END IF;

  IF v_work_log.job_posting_id IS DISTINCT FROM p_job_posting_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch');
  END IF;

  IF p_expected_date IS NOT NULL
     AND COALESCE(v_work_log.is_fixed_posting, false) = false
     AND v_work_log.date IS DISTINCT FROM p_expected_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'date_mismatch');
  END IF;

  IF v_job_posting_status::text != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;

  IF v_work_log.payroll_status::text = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_settled');
  END IF;

  -- 4. Action-specific processing
  IF p_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_checked_in');
    END IF;

    -- Phase C: dual-write jsonb + timestamptz. Phase D 에서 jsonb 열 제거 예정.
    UPDATE work_logs SET
      status = 'checked_in',
      check_in_time = to_jsonb(v_now),
      check_in_ts = p_check_time,
      updated_at = p_check_time
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkIn',
      'check_in_time', v_now,
      'work_duration', 0
    );

  ELSIF p_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_checked_in');
    END IF;

    -- Phase C: duration 계산을 check_in_ts (timestamptz) 직접 사용 — jsonb 추출 제거.
    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (p_check_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;

    UPDATE work_logs SET
      status = 'checked_out',
      check_out_time = to_jsonb(v_now),
      check_out_ts = p_check_time,
      work_duration = v_work_duration,
      updated_at = p_check_time
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkOut',
      'check_out_time', v_now,
      'work_duration', v_work_duration
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.process_qr_checkin_atomically(
  uuid, uuid, uuid, text, timestamptz, text
) IS 'QR check-in/check-out SELECT FOR UPDATE 단일 트랜잭션 처리. Phase C: check_in_ts/check_out_ts dual-write + duration 계산 timestamptz 직접 사용. Phase D 에서 jsonb 컬럼 제거 예정.';
```

- [ ] **Step 2: Supabase MCP 로 migration 적용**

> **중요**: `supabase db push` 사용 금지 (memory `feedback_supabase_migration_workflow.md`). 반드시 MCP `apply_migration` 사용.

Run (pseudo — actual via MCP tool):
```
mcp__supabase__apply_migration({
  name: "worklog_ts_phase_c_rpc_dual_write",
  query: "<migration file contents>"
})
```

Expected: Migration 성공. `list_migrations` 로 확인.

- [ ] **Step 3: 신규 RPC 동작 검증 (DB-side smoke test)**

Run (via MCP `execute_sql`):
```sql
-- 현재 임의 scheduled work_log 1건에 대해 checkIn → checkOut 시뮬레이션
-- (실제 데이터 기반. 테스트 후 롤백)
BEGIN;
  -- 1. checkIn
  SELECT public.process_qr_checkin_atomically(
    (SELECT id FROM work_logs WHERE status = 'scheduled' LIMIT 1),
    (SELECT staff_id FROM work_logs WHERE status = 'scheduled' LIMIT 1),
    (SELECT job_posting_id FROM work_logs WHERE status = 'scheduled' LIMIT 1),
    'checkIn',
    now(),
    NULL
  );
  -- 2. check_in_time (jsonb) 과 check_in_ts (timestamptz) 일치 확인
  SELECT id, check_in_time, check_in_ts,
    (check_in_time #>> '{}')::timestamptz = check_in_ts AS ts_match
  FROM work_logs
  WHERE status = 'checked_in'
  ORDER BY updated_at DESC LIMIT 1;
ROLLBACK;
```

Expected: `ts_match = true`. 0 errors.

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260421180000_worklog_ts_phase_c_rpc_dual_write.sql
git commit -m "feat(supabase): Phase C.5 — process_qr_checkin_atomically check_in_ts/check_out_ts dual-write"
```

---

## Task 6: qrCheckinAtomic.test.ts — 신규 RPC 응답 회귀 방지

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/__tests__/qrCheckinAtomic.test.ts`

- [ ] **Step 1: 현재 mock 응답이 신규 RPC 와 호환인지 확인**

현행 테스트는 RPC 를 `supabase.rpc` 레벨에서 mock. 신규 RPC 도 동일한 JSON 스키마 (`success`, `action`, `check_in_time`, `check_out_time`, `work_duration`) 반환하므로 mock 수정 불필요. **확인만 하고 넘어간다.**

Run: `cd uniqn-mobile && npx jest --testPathPattern=qrCheckinAtomic --no-coverage`
Expected: 12 tests PASS (no changes needed)

- [ ] **Step 2: 회귀 방지 테스트 1건 추가 — RPC 응답에 `check_in_time` ISO 포함 검증**

(선택 사항이지만 Phase D 로 가는 길에 Safety net 으로 추가 권장)

```typescript
// Task 6 Step 2: qrCheckinAtomic.test.ts 맨 아래에 추가
describe('executeProcessQRCheckInOut — Phase C 응답 호환', () => {
  it('checkIn 응답의 check_in_time 이 ISO string 이면 정상 처리', async () => {
    const iso = '2026-04-21T12:00:00.000Z';
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        action: 'checkIn',
        check_in_time: iso,
        work_duration: 0,
      },
      error: null,
    });

    const result = await executeProcessQRCheckInOut(
      WORK_LOG_ID, STAFF_ID, JOB_POSTING_ID, 'checkIn', new Date(iso), EXPECTED_DATE
    );

    expect(result.action).toBe('checkIn');
    expect(result.workDuration).toBe(0);
  });
});
```

- [ ] **Step 3: Jest 재실행**

Run: `cd uniqn-mobile && npx jest --testPathPattern=qrCheckinAtomic --no-coverage`
Expected: 기존 + 1건 PASS

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/__tests__/qrCheckinAtomic.test.ts
git commit -m "test(worklog): Phase C.6 — RPC ISO 응답 회귀 테스트 추가"
```

---

## Task 7: 전체 회귀 검증 + REFACTOR-5.md 문서 업데이트

**Files:**
- Modify: `.gstack/qa-reports/REFACTOR-5.md` — Phase C 완료 상태 반영

- [ ] **Step 1: `npm run quality` — 전체 프로젝트 타입체크 + lint + format**

Run: `cd uniqn-mobile && npm run quality`
Expected: exit code 0, 0 errors, 0 warnings

- [ ] **Step 2: 전체 Jest 실행**

Run: `cd uniqn-mobile && npm test -- --no-coverage`
Expected: 전체 PASS. 특히 다음 파일 회귀 없음:
- `WorkLog*` repository tests
- `qrCheckinAtomic.test.ts`
- `ScheduleConverter.test.ts`
- `reviewDeadline.test.ts`
- `SettlementCalculator.test.ts`

- [ ] **Step 3: REFACTOR-5.md 업데이트**

`Phase` 테이블의 C 행을 `✅ 완료` 로 수정하고, Phase C 산출물 섹션을 추가:

```markdown
| C | 코드: Repository readers 신규 컬럼 읽기 + RPC dual-write + TimeNormalizer 제거 | MED | ✅ 완료 |
```

그리고 "Phase C 산출물" 섹션 추가:

```markdown
## Phase C 산출물

### 코드 변경 (6 commits)
- `WorkLogRepositoryHelpers`: TABLE_COLUMNS 에 `check_in_ts, check_out_ts` 추가, `toWorkLog` 에서 ts 우선 매핑
- `WorkLogRepository.getByDate`: ORDER BY check_in_ts
- `WorkLogRepository.getStats` + `executeUpdateWorkTime`: TimeNormalizer.parseTime → Date.parse
- `UserRepository.exportUserData`: dual-select

### Migration
`20260421180000_worklog_ts_phase_c_rpc_dual_write.sql` — `process_qr_checkin_atomically` dual-write + duration 을 check_in_ts 직접 사용

### Phase D 선행 조건 완료
- 읽기 경로 100% ts 컬럼 사용 (fallback 만 jsonb)
- writer 측은 sync trigger + RPC dual-write 로 jsonb/ts 자동 동기
- 다음 세션에서 Phase D (jsonb DROP + rename) 진행 가능. 단 사용자 명시 확인 필수.
```

- [ ] **Step 4: 문서 커밋**

```bash
git add .gstack/qa-reports/REFACTOR-5.md
git commit -m "docs(refactor-5): Phase C 완료 산출물 반영"
```

- [ ] **Step 5: 최종 증거 수집 — 완료 보고**

다음 실행 결과를 모아 user 에게 보고:
1. `npm run quality` exit code 0 증거
2. `npm test` 전체 PASS 숫자
3. MCP `list_migrations` 결과에서 `20260421180000_worklog_ts_phase_c_rpc_dual_write` 존재 확인
4. git log 최근 7개 commit

Run:
```bash
cd uniqn-mobile && npm run quality 2>&1 | tail -20
cd uniqn-mobile && npm test -- --no-coverage 2>&1 | tail -10
git log --oneline -n 8
```

Expected: 모두 성공. Phase D 진행 여부 사용자에게 질의.

---

## 제외된 범위 (명시)

**Phase C 에서 건드리지 않는 것:**
1. **Phase B (writer dual-write)**: Sync trigger 가 이미 담당. redundant.
2. **Schema 단순화**: `optionalTimestampSchema` 는 2026-04-19 Firebase Timestamp cleanup 에서 이미 ISO string 정규화로 축소됨. 추가 단순화는 별개 작업.
3. **`TimeNormalizer.parseTime` 의 전체 제거**: work_logs 데이터 흐름 밖의 호출 (scheduleService, timeHelpers, WorkTimeDisplay 등) 은 일반 시간 파싱이라 유지.
4. **Phase D (jsonb DROP + rename)**: destructive. 사용자 명시 확인 필수. 별도 세션.
5. **도메인 레이어 (ScheduleConverter, SettlementCalculator, confirmedStaff 등)**: `workLog.checkInTime` ISO string 을 소비하는 순수 함수. 입력 포맷은 그대로 유지되므로 수정 불필요.

---

## Self-Review 체크리스트

### Spec coverage
| REFACTOR-5.md 핵심 변경 | 대응 Task |
|-------------------------|-----------|
| 1. WorkLogRepository 읽기 쿼리 check_in_ts 직접 select + order | Task 1 (TABLE_COLUMNS + toWorkLog), Task 2 (.order check_in_ts) |
| 2. Schema timestamp 단일 포맷 정규화 | 이미 2026-04-19 에 완료 → 이 플랜에서 스킵 (설명) |
| 3. TimeNormalizer.parseTime 호출 지점 제거 | Task 2 (getStats), Task 3 (executeUpdateWorkTime) — work_logs 관련만 |
| 4. process_qr_checkin_atomically RPC 리팩토링 | Task 5 (dual-write + check_in_ts 직접) |
| 5. Jest mock jsonb → string | Task 6 (기존 mock 이미 ISO string) |

### Placeholder scan
- ❌ "TBD", "implement later", "Add appropriate ..." 없음
- ❌ "Similar to Task N" (재현 없는 참조) 없음
- ✅ 모든 code block 실제 내용 포함

### Type consistency
- `checkInTs` / `checkOutTs` (camelCase from `toCamelCase`) 일관
- `v_work_log.check_in_ts` (snake_case SQL) 일관
- RPC parameter `p_check_time` (기존 이름 유지)
- `WorkLog.checkInTime` 타입 (TimeInput = `Date | string | number | null | undefined`) 유지 — 매퍼에서 ISO string 으로 세팅하지만 domain type 은 건드리지 않음 (backward compat)
