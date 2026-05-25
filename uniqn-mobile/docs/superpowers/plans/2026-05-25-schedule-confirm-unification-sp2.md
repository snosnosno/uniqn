# 스케줄 확정 경로 통일 (SP2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `confirm_application` RPC 와 클라이언트 확정 경로에서 fixed/dated 분기(`p_is_fixed_posting`)를 제거하여, 모든 공고가 동일 경로(H1 정원 가드 + work_logs INSERT)를 타게 하고, fixed 역할별 overfill 을 서버에서 실제 차단하며 fixed 취소를 활성화한다.

**Architecture:** RPC 시그니처는 `p_is_fixed_posting` 파라미터를 **유지하되 내부에서 무시**(DROP/오버로드/배포순서 위험 회피)하고, `v_is_fixed := (schedule->>'kind')='fixed'` 를 본문에서 도출한다. H1 정원 가드의 capacity 키 도출(date/slot)을 클라이언트 fixed 마커(`FIXED_SCHEDULE`/`NEGOTIABLE`/`미정`)와 정합시켜 fixed 에서도 가드가 실제로 작동하게 한다. `filled_positions` 수동 갱신은 SP2 에서 현행 보존(트리거 이관은 SP3).

**Tech Stack:** PostgreSQL plpgsql (MCP `apply_migration`), TypeScript strict, Jest, Supabase RPC.

**MCP 규칙:** 마이그레이션/RPC 재정의/execute_sql 검증은 **메인(오케스트레이터)만** 수행. 서브에이전트는 `mcp__supabase__*` 사용 금지 — DB 작업이 필요한 Task 는 서브에이전트가 SQL/코드를 작성·검증 절차를 명시하면 메인이 적용한다.

---

## File Structure

| 파일                                                                                                                                         | 책임                                                                                                                                               | Task |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| (검증) `src/components/jobs/AssignmentSelector/AssignmentSelector.tsx`, `src/components/jobs/ApplicationForm.tsx`, `src/types/assignment.ts` | fixed assignment 가 `dates:['FIXED_SCHEDULE']` + `timeSlot:'NEGOTIABLE'\|'미정'` 으로 만들어짐을 실측 확인                                         | 0    |
| `supabase/migrations/<ts>_confirm_application_unify_fixed.sql`                                                                               | `confirm_application` 재정의: `v_is_fixed` 도출, H1·work_logs 를 fixed 포함, capacity 키 정합                                                      | 1    |
| `src/repositories/supabase/ApplicationRepositoryTransactions.ts`                                                                             | `executeConfirmWithHistory` `p_is_fixed_posting` 인자 제거 / `validateConfirmCapacity` 시그니처 정리 / `executeReviewCancellation` fixed 차단 제거 | 2,3  |
| `src/repositories/supabase/__tests__/ApplicationRepositoryTransactions.*.test.ts`                                                            | confirm/cancel 단위 테스트                                                                                                                         | 2,3  |

> **불변식**: dated 확정/취소 경로의 사용자 가시 동작은 SP2 전후 동일. 변경은 (a) fixed 가 H1+work_logs 를 타게 함, (b) fixed 취소 허용, (c) `p_is_fixed_posting` 클라 미전달뿐.

---

## Task 0: fixed assignment 마커 실측 검증 (코드 변경 없음)

이 Task 는 SP2 의 핵심 전제(fixed assignment 키 = `FIXED_SCHEDULE`/`NEGOTIABLE`/`미정`)를 코드로 확인한다. 불일치 시 **BLOCKED 보고** 후 플랜 재조정.

- [ ] **0.1** `src/types/assignment.ts` 에서 `FIXED_DATE_MARKER`, `FIXED_TIME_MARKER`, `TBA_TIME_MARKER` 상수 값 확인. Expected: `'FIXED_SCHEDULE'`, `'NEGOTIABLE'`, `'미정'`.
- [ ] **0.2** `AssignmentSelector.tsx` / `ApplicationForm.tsx` 에서 fixed 공고 지원 시 `Assignment.dates` 와 `Assignment.timeSlot` 이 어떻게 채워지는지 읽고 기록. Expected: fixed 는 `dates: ['FIXED_SCHEDULE']` (또는 `[FIXED_DATE_MARKER]`), `timeSlot`: 협의면 `'NEGOTIABLE'`, TBA 면 `'미정'`, 시간지정이면 `'HH:MM'`.
- [ ] **0.3** 발견사항을 플랜 상단 또는 커밋 메시지 본문에 기록. 코드 변경/커밋 없음. (불일치 시 STOP + 보고.)

---

## Task 1: `confirm_application` RPC 재정의 (fixed 통일 + capacity 키 정합)

**Files:**

- Create: `supabase/migrations/<timestamp>_confirm_application_unify_fixed.sql` (파일명 타임스탬프는 round number, MCP 적용 시각이 권위 — 메모리 `feedback_supabase_migration_workflow`)

> **이 Task 는 DB 변경이므로 메인이 적용한다.** 서브에이전트는 마이그레이션 SQL 파일을 작성하고, 메인이 ① `pg_get_functiondef` 로 현행 본문 재확인 → ② `execute_sql` BEGIN/ROLLBACK 으로 RED/GREEN/멱등 검증 → ③ `apply_migration` 으로 적용한다.

- [ ] **1.1 현행 본문 재확인 (메인)** — `SELECT pg_get_functiondef('public.confirm_application'::regprocedure)` 로 현행 prod 본문을 가져와 아래 목표 본문과 diff. blurhash·filled_positions·stats 갱신 라인이 보존되는지 라인 단위 확인.

- [ ] **1.2 RED 검증 SQL 작성 (overfill 이 현재는 통과)** — 다음을 `execute_sql` 롤백 트랜잭션으로:

```sql
BEGIN;
-- fixed 공고 1건 + 역할 정원 1 시드
-- (workspace/owner 는 기존 prod row 재사용; job_postings INSERT 시 schedule 통일 구조)
INSERT INTO job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, schedule, ...)
VALUES ('00000000-0000-0000-0000-0000000000f1', <owner>, <ws>, 'SP2 fixed test', 'active', 'fixed', 1, 0,
  jsonb_build_object('kind','fixed','daysPerWeek',5,
    'requirements', jsonb_build_array(jsonb_build_object('date', null,
      'timeSlots', jsonb_build_array(jsonb_build_object('isTimeToBeAnnounced', false,
        'roles', jsonb_build_array(jsonb_build_object('role','dealer','count',1))))))), ...);
-- 이미 1명 확정된 상태를 work_log 로 시드 (FIXED_SCHEDULE / NEGOTIABLE / dealer)
INSERT INTO work_logs (staff_id, job_posting_id, application_id, date, time_slot, role, owner_id, status, is_fixed_posting, ...)
VALUES (<staff1>, '...f1', <app1>, 'FIXED_SCHEDULE', 'NEGOTIABLE', 'dealer', <owner>, 'scheduled', true, ...);
-- 2번째 지원자(app2, applied) 확정 시도 → 정원 1 초과
SELECT confirm_application('app2'::uuid, <owner>::uuid,
  '[{"groupId":null,"date":"FIXED_SCHEDULE","timeSlot":"NEGOTIABLE","role":"dealer","customRole":null}]'::jsonb,
  null, '[]'::jsonb, null, true, '[]'::jsonb);
-- 현행(재정의 전): p_is_fixed_posting=true 라 H1 스킵 → 성공(overfill) = RED
ROLLBACK;
```

Expected (재정의 **전**): 성공(overfill 허용) — 이것이 잡아야 할 버그.

- [ ] **1.3 목표 RPC 본문 작성** — 마이그레이션 파일에 아래 전체 본문. **현행 대비 변경점은 주석 표시한 5곳뿐**:

```sql
CREATE OR REPLACE FUNCTION public.confirm_application(
  p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb,
  p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false,  -- 유지하되 본문에서 무시
  p_assignments_v3 jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_app record; v_job record;
  v_work_log_ids uuid[] := '{}'; v_wl_id uuid; v_assignment jsonb;
  v_now timestamptz := now(); v_existing int; v_capacity int; v_rec record;
  v_is_fixed boolean;  -- [변경1] schedule 에서 도출
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_owner_id AND is_active = true) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;

  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;

  v_is_fixed := (v_job.schedule->>'kind') = 'fixed';  -- [변경1]

  IF NOT (
    v_job.owner_id = p_owner_id OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id) OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음';
  END IF;

  -- [변경2] H1 정원 가드: fixed 포함 (NOT p_is_fixed_posting 조건 제거)
  IF jsonb_array_length(p_assignments) > 0 THEN
    FOR v_rec IN
      SELECT (a->>'date') AS a_date,
        public._posting_slot_key(a->>'timeSlot') AS slot_key,
        public._posting_role_key(a->>'role', a->>'customRole') AS role_key,
        COUNT(*)::int AS requested
      FROM jsonb_array_elements(p_assignments) a GROUP BY 1, 2, 3
    LOOP
      SELECT COUNT(*) INTO v_existing FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id
        AND wl.date = v_rec.a_date
        AND public._posting_slot_key(wl.time_slot) = v_rec.slot_key
        AND public._posting_role_key(wl.role::text, wl.custom_role) = v_rec.role_key
        AND wl.status NOT IN ('cancelled', 'no_show');

      SELECT COALESCE(MAX((r->>'count')::int), 0) INTO v_capacity
      FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
      CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
      CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
      WHERE COALESCE(req->>'date', 'FIXED_SCHEDULE') = v_rec.a_date  -- [변경3] null→FIXED_SCHEDULE
        AND (CASE  -- [변경4] fixed 협의 슬롯 NEGOTIABLE 정합
              WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false) THEN '미정'
              WHEN COALESCE(ts->>'startTime', ts->>'time') IS NOT NULL
                THEN public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
              WHEN v_is_fixed THEN 'NEGOTIABLE'
              ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
            END) = v_rec.slot_key
        AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key;

      IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity THEN
        RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
          v_rec.role_key, v_rec.a_date, v_rec.slot_key, v_existing + v_rec.requested, v_capacity;
      END IF;
    END LOOP;
  END IF;

  -- [변경5] work_logs INSERT: fixed 포함 + is_fixed_posting = v_is_fixed
  IF jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id, assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
        role, custom_role, owner_id, status, is_fixed_posting, created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname,
        v_app.applicant_photo_url, v_app.applicant_photo_url_blurhash,
        COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
        v_assignment->>'customRole', p_owner_id,
        'scheduled', v_is_fixed, v_now, v_now  -- is_fixed_posting: false → v_is_fixed
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  UPDATE applications SET
    status = 'confirmed', assignments = COALESCE(p_assignments_v3, assignments),
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history, confirmed_at = v_now,
    processed_by = p_owner_id::text, processed_at = v_now,
    notes = COALESCE(p_notes, notes), updated_at = v_now
  WHERE id = p_application_id;

  -- filled_positions/stats.filledPositions 수동 갱신: SP2 현행 보존 (SP3 에서 트리거 이관)
  UPDATE job_postings SET
    filled_positions = filled_positions + 1,
    stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{filledPositions}',
      to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)),
    updated_at = v_now
  WHERE id = v_app.job_posting_id;

  RETURN jsonb_build_object('applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids), 'assignmentCount', jsonb_array_length(p_assignments));
END;
$function$;
```

- [ ] **1.4 GREEN 검증 (메인)** — 1.2 의 RED SQL 을 재정의 **후** 다시 실행. Expected: `MAX_CAPACITY_REACHED` 예외 발생(overfill 차단). 추가로:
  - fixed 정상 확정(빈 정원): work_logs 1행(`date='FIXED_SCHEDULE'`, `is_fixed_posting=true`) + filled_positions +1.
  - **dated 회귀 없음**: 기존 dated 확정 시나리오(실제 dated 공고 id 사용, 롤백) 동일 성공 + work_logs/filled_positions 동작.
  - 멱등: 마이그레이션 SQL 두 번 적용(CREATE OR REPLACE) 동일.
- [ ] **1.5 적용 (메인)** — `apply_migration` 으로 prod 적용. fixed 0건이라 데이터 무영향. 적용 후 `pg_get_functiondef` 로 반영 확인.
- [ ] **1.6 커밋** — `git add supabase/migrations/<file>.sql && git commit -m "fix(db): confirm_application fixed 분기 제거 + H1 정원가드 fixed 키 정합"`

---

## Task 2: 클라이언트 confirm 경로 — `p_is_fixed_posting` 미전달 + 시그니처 정리

**Files:**

- Modify: `src/repositories/supabase/ApplicationRepositoryTransactions.ts` (`executeConfirmWithHistory` 113–122, `validateConfirmCapacity` 309–322)
- Test: `src/repositories/supabase/__tests__/ApplicationRepositoryTransactions.confirm.test.ts` (없으면 신규)

- [ ] **2.1 실패 테스트 작성** — confirm 시 RPC 가 `p_is_fixed_posting` 없이 호출되고, fixed 공고도 정상 확정 흐름을 타는지(mock `supabase.rpc`):

```ts
// supabase.rpc 를 mock 하여 confirm_application 호출 인자를 캡처
it('confirm RPC 호출에 p_is_fixed_posting 인자를 보내지 않는다 (fixed 공고)', async () => {
  const rpcMock = jest
    .spyOn(supabase, 'rpc')
    .mockResolvedValue({
      data: { workLogIds: [], applicationId: 'app1', assignmentCount: 0 },
      error: null,
    } as never);
  // loadApplication/loadAndVerifyJobPostingAccess mock → fixed jobData + applied application + assignments 1건
  await executeConfirmWithHistory('app1', undefined, 'owner1');
  const [, params] = rpcMock.mock.calls.find(([fn]) => fn === 'confirm_application')!;
  expect(params).not.toHaveProperty('p_is_fixed_posting');
  expect(params.p_assignments).toBeDefined();
});
```

> 구현자는 기존 테스트 픽스처/모킹 패턴(`loadApplication`/`loadAndVerifyJobPostingAccess` 모킹)을 파일 내 기존 테스트에서 차용한다. 없으면 `jest.mock('./ApplicationRepositoryHelpers')` 로 모킹.

- [ ] **2.2 실패 확인** — `npx jest ApplicationRepositoryTransactions.confirm -t "p_is_fixed_posting"` → FAIL (현재 인자 전달 중).
- [ ] **2.3 구현** — `executeConfirmWithHistory`:
  - 113–122 의 `supabase.rpc('confirm_application', {...})` 인자에서 `p_is_fixed_posting: isFixedPosting,` 줄 **삭제**.
  - 77 의 `validateConfirmCapacity(isFixedPosting, assignmentsToConfirm, jobData, applicationData)` → `validateConfirmCapacity(assignmentsToConfirm, jobData, applicationData)`.
  - `isFixedPosting`/`assignmentsToConfirm` 선택 분기(65–68)는 **유지**(fixed 는 selectedAssignments 개념 부재 = UX 선택 로직, capacity/RPC 와 무관). 단 `isFixedPosting` 변수는 selection 에만 쓰이므로 유지.
  - `validateConfirmCapacity`(309) 시그니처에서 `_isFixedPosting: boolean,` 파라미터 제거:

```ts
function validateConfirmCapacity(
  assignmentsToConfirm: Assignment[],
  jobData: JobPosting,
  applicationData: Application
): void {
  const slotCapacity = validateAssignmentSlotCapacity(jobData, assignmentsToConfirm);
  if (!slotCapacity.available) {
    throw new MaxCapacityReachedError({
      userMessage: '모집 인원이 마감되었습니다.',
      jobPostingId: applicationData.jobPostingId,
    });
  }
}
```

- [ ] **2.4 통과 확인** — `npx jest ApplicationRepositoryTransactions.confirm` → PASS.
- [ ] **2.5 커밋** — `git add src/repositories/supabase/ApplicationRepositoryTransactions.ts src/repositories/supabase/__tests__/ApplicationRepositoryTransactions.confirm.test.ts && git commit -m "refactor(application): confirm 클라 경로 p_is_fixed_posting 미전달 + validateConfirmCapacity 시그니처 정리"`

---

## Task 3: fixed 취소 활성화

**Files:**

- Modify: `src/repositories/supabase/ApplicationRepositoryTransactions.ts` (`executeReviewCancellation` 171–175)
- Test: `src/repositories/supabase/__tests__/ApplicationRepositoryTransactions.cancel.test.ts`

- [ ] **3.1 실패 테스트 작성** — fixed 공고 취소 검토가 더는 throw 하지 않고 RPC(approve) 를 호출:

```ts
it('fixed 공고 취소 요청 검토가 차단되지 않는다', async () => {
  // loadAndVerifyJobPostingAccess → fixed jobData, application status=cancellation_pending + 유효 cancellationRequest
  const approveMock = jest
    .spyOn(supabase, 'rpc')
    .mockResolvedValue({ data: { success: true }, error: null } as never);
  await expect(
    executeReviewCancellation(
      { applicationId: 'app1', approved: true } as ReviewCancellationInput,
      'reviewer1'
    )
  ).resolves.not.toThrow();
  expect(approveMock).toHaveBeenCalledWith(
    'cancel_application_atomically',
    expect.objectContaining({ p_actor_type: 'staff_approves_cancel_request' })
  );
});
```

- [ ] **3.2 실패 확인** — `npx jest ApplicationRepositoryTransactions.cancel -t "fixed 공고 취소"` → FAIL (현재 BusinessError throw).
- [ ] **3.3 구현** — `executeReviewCancellation` 171–175 의 fixed 차단 블록 **삭제**:

```ts
// 삭제:
//   if (jobData.schedule.kind === 'fixed') {
//     throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
//       userMessage: '고정공고는 1차 범위에서 취소 요청을 지원하지 않습니다.',
//     });
//   }
```

> `jobData` 가 이후 다른 곳에서 안 쓰이면 `loadAndVerifyJobPostingAccess` 호출 자체는 권한 검증 목적이므로 **유지**. (lint unused 경고 시 `void jobData;` 또는 호출만 유지.)

- [ ] **3.4 통과 확인** — `npx jest ApplicationRepositoryTransactions.cancel` → PASS.
- [ ] **3.5 DB 동적 검증 (메인)** — fixed 확정→취소 시나리오를 `execute_sql` 롤백 트랜잭션으로: fixed 확정(work_log `FIXED_SCHEDULE` 생성) → `cancel_application_atomically('...', 'staff_initiates', staff)` → work_log status='scheduled' 행 DELETE + filled_positions -1 확인.
- [ ] **3.6 커밋** — `git add ... && git commit -m "feat(application): fixed 공고 취소 요청 검토 활성화"`

---

## Task 4: SP2 통합 게이트 + 회귀 검증

- [ ] **4.1** `npm run quality` (tsc + eslint + prettier) → exit 0. warning 은 기존분만(SP1 기준 12개) 허용, error 0.
- [ ] **4.2** `npm test` 전체 → 0 fail. confirm/cancel 관련 기존 테스트 회귀 시 새 동작으로 갱신(단 dated 동작 동치 유지).
- [ ] **4.3** `createWorkLogsForConfirmation`(325, `@internal 서버 RPC 마이그레이션 완료 시 제거 예정`) 가 호출되지 않는 dead code 인지 grep 확인. 호출처 0이면 **이 Task 에서 제거하지 말고** SP3/별도 정리로 기록(스코프 경계). 호출처 있으면 SP2 변경과 정합 확인.
- [ ] **4.4 동적 증거 기록 (메인)** — Task 1.4 / 3.5 의 RED→GREEN 결과(overfill 차단·fixed work_log·fixed 취소)를 커밋 메시지 또는 PR 본문에 증거로 남긴다.

---

## Self-Review 결과 (작성자)

- **Spec 커버리지**: SP2 spec §4.1(RPC)→Task1, §4.3(클라 confirm)→Task2, §4.4(fixed 취소)→Task3, §5(테스트)→Task1.4/3.5/4. ✅
- **Placeholder**: RPC 본문은 전체 기재. 클라 변경 코드 전체 기재. Task0 은 의도적 검증 전용(코드 변경 없음). ✅
- **타입 일관성**: `validateConfirmCapacity` 시그니처 변경(Task2)이 유일 호출처(77)와 정합. RPC 시그니처 불변(파라미터 유지). ✅
- **회귀 가드**: dated 경로 본문 보존(변경 5곳 주석), filled_positions 이중증가 금지(SP2 수동 유지·SP3 이관). ✅
