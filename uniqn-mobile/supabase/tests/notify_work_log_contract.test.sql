-- ============================================================
-- notify_on_work_log_update 알림 계약 회귀 테스트
-- 마이그 20260802093000_notify_settlement_revert_and_cancel_hint_gate.sql 적용 후 실행.
-- 근거: docs/analysis/2026-08-01-work-schedule-wave-audit.md M3 · M5
-- ============================================================
-- M3 — Case 2-B 의 '취소를 요청할 수 있어요' 힌트는 클라의 버튼 표시 조건
--      (ScheduleDetailModal.tsx:536-540)의 부분집합이어야 한다. 취소 요청 심사 중
--      (applications.status='cancellation_pending')이면 버튼이 없으므로 말하지 않는다.
--      (1) 대조군: 정상 confirmed → 힌트 **있다**  ← 힌트를 통째로 지우는 '수정'을 막는다
--      (2) 본체:   cancellation_pending → 힌트 **없다**
--      (3) 그래도 시각 변경 통지 자체는 나간다(힌트만 빠진다 — 알림을 죽이는 게 아니다)
--
-- M5 — 지급 완료 되돌리기(payroll_status: completed → 그 외)에 Case 3-B 신설.
--      (4) settlement_reverted 정확히 1건
--      (5) 본문에 지급액 + 되돌리기 사유(settlement_modification_history 마지막 항목)
--      (6) 정방향(pending → completed)에서는 settlement_reverted 0 / settlement_completed 1
--      (8) settlement_modification_history 가 배열이 아니어도(raw PostgREST 오염) 알림은 나간다 —
--          jsonb_array_length 가 22023 을 던지면 함수의 EXCEPTION 블록이 되감아
--          **이 UPDATE 의 모든 알림**이 통째로 사라진다. jsonb_typeof 가드의 관측 가능한 효과.
--      (9) 같은 함정이 **modification_history**(Case 2)에도 있고 그쪽이 더 위험하다 — IF 밖
--          최상단이라 무조건 실행되므로, 오염되면 (8)의 가드조차 상류에서 죽어 무력해진다.
--          리뷰 2인이 각각 실측으로 재현한 결함이다.
--
-- (7) CREATE OR REPLACE 의 SET 절이 pg_temp 하드닝을 지우지 않았는지 —
--     20260711100000 이 ALTER FUNCTION 으로 얹은 방어의 국소 회귀 가드.
--
-- 🔗 형제 파일: `worklog_time_slot_change_notify.test.sql` 이 Case 2-B 의 **발화 조건**
--    (T1 발화 · T2 취소 중복금지 · T3 무관컬럼 침묵 · T4 applicationId NULL · T5 힌트 있음)을
--    이미 고정한다. 이 파일은 그 위에 얹히는 **힌트 억제 축**(M3)과 **Case 3-B**(M5)만 본다.
--    새 단언을 추가할 때 어느 쪽에 속하는지 먼저 판단할 것 — 세 번째 파일을 만들지 말 것.
--
-- ⚠️ JWT 주입은 헬퍼(jpc_test_set_user_with_role) 경유만 — 인라인 set_config 금지
--    (wiki decisions/wallet-pgtap-caller-binding: singular/plural GUC 동시 갱신 필수).
--    payroll 컬럼은 protect_work_log_payroll_columns 가 app_metadata.role 로 게이트하므로
--    employer JWT 없이는 UPDATE 자체가 42501 로 막힌다.
-- ============================================================

BEGIN;
SELECT plan(9);

-- ─── 시드 (superuser 컨텍스트, set_user 이전) ───
DO $$
DECLARE
  v_owner uuid;
  v_staff_a uuid;   -- M3 대조군 (정상 confirmed)
  v_staff_b uuid;   -- M3 본체   (cancellation_pending)
  v_staff_c uuid;   -- M5 되돌리기
  v_staff_d uuid;   -- M5 정방향
  v_staff_e uuid;   -- M5 정산이력 오염(비배열)
  v_staff_f uuid;   -- M5 수정이력 오염(비배열, 상류 폭발)
  v_ws uuid := gen_random_uuid();
  v_job uuid := gen_random_uuid();
  v_app_a uuid := gen_random_uuid();
  v_app_b uuid := gen_random_uuid();
  v_wl_a uuid := gen_random_uuid();
  v_wl_b uuid := gen_random_uuid();
  v_wl_c uuid := gen_random_uuid();
  v_wl_d uuid := gen_random_uuid();
  v_wl_e uuid := gen_random_uuid();
  v_wl_f uuid := gen_random_uuid();
BEGIN
  v_owner   := jpc_test_create_user('employer');
  v_staff_a := jpc_test_create_user('staff');
  v_staff_b := jpc_test_create_user('staff');
  v_staff_c := jpc_test_create_user('staff');
  v_staff_d := jpc_test_create_user('staff');
  v_staff_e := jpc_test_create_user('staff');
  v_staff_f := jpc_test_create_user('staff');

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_nwc_ws', v_owner, now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  ) VALUES (v_job, v_owner, v_ws, '__sql_fixture: nwc', 10, 0, 'active', now(), now());

  -- 지원서 2건: 같은 (공고, 지원자) 중복을 피하려고 스태프를 나눈다.
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES
    (v_app_a, v_job, v_staff_a, 'STAFF_A', 'confirmed', now(), now()),
    -- 심사 중인 취소 요청 — UPDATE 가 아니라 INSERT 로 심는다(취소요청 알림 트리거 미발화).
    (v_app_b, v_job, v_staff_b, 'STAFF_B', 'cancellation_pending', now(), now());

  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, application_id, owner_id, date, status, role,
    time_slot, created_at, updated_at
  ) VALUES
    (v_wl_a, v_staff_a, v_job, v_app_a, v_owner, '2026-08-10', 'scheduled', 'dealer', '18:00', now(), now()),
    (v_wl_b, v_staff_b, v_job, v_app_b, v_owner, '2026-08-10', 'scheduled', 'dealer', '18:00', now(), now());

  -- 정산 픽스처: work_logs_status_timestamp_consistency CHECK 때문에
  -- checked_out 은 check_in_ts / check_out_ts 가 모두 있어야 한다.
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts, payroll_status, payroll_amount, payroll_date, created_at, updated_at
  ) VALUES
    (v_wl_c, v_staff_c, v_job, v_owner, '2026-08-09', 'checked_out', 'dealer',
     now() - interval '8 hour', now() - interval '1 hour', 'completed', 500000, now(), now(), now()),
    (v_wl_d, v_staff_d, v_job, v_owner, '2026-08-09', 'checked_out', 'dealer',
     now() - interval '8 hour', now() - interval '1 hour', 'pending', 300000, NULL, now(), now());

  -- 이력 오염 픽스처: 배열이 아닌 jsonb. 컬럼에 CHECK 가 없어 raw PostgREST 로 실제 가능하다.
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts, payroll_status, payroll_amount, payroll_date,
    settlement_modification_history, created_at, updated_at
  ) VALUES
    (v_wl_e, v_staff_e, v_job, v_owner, '2026-08-08', 'checked_out', 'dealer',
     now() - interval '8 hour', now() - interval '1 hour', 'completed', 200000, now(),
     '{"corrupted": true}'::jsonb, now(), now());

  -- 상류 오염 픽스처: Case 2 가 무조건 읽는 modification_history 를 비배열로 만든다.
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts, payroll_status, payroll_amount, payroll_date,
    modification_history, created_at, updated_at
  ) VALUES
    (v_wl_f, v_staff_f, v_job, v_owner, '2026-08-07', 'checked_out', 'dealer',
     now() - interval '8 hour', now() - interval '1 hour', 'completed', 100000, now(),
     '{"corrupted": true}'::jsonb, now(), now());

  PERFORM set_config('nwc.owner', v_owner::text, true);
  PERFORM set_config('nwc.wl_a', v_wl_a::text, true);
  PERFORM set_config('nwc.wl_b', v_wl_b::text, true);
  PERFORM set_config('nwc.wl_c', v_wl_c::text, true);
  PERFORM set_config('nwc.wl_d', v_wl_d::text, true);
  PERFORM set_config('nwc.wl_e', v_wl_e::text, true);
  PERFORM set_config('nwc.wl_f', v_wl_f::text, true);
END $$;

-- ─── 행위: 구인자(employer JWT + RLS 경유)로 4건을 각각 UPDATE ───
SELECT jpc_test_set_user_with_role((current_setting('nwc.owner'))::uuid, 'employer');

DO $$
BEGIN
  -- M3 대조군 / 본체: 출근 예정 시각 변경 (Case 2-B 발화)
  UPDATE public.work_logs SET time_slot = '19:00'
   WHERE id = (current_setting('nwc.wl_a'))::uuid;
  UPDATE public.work_logs SET time_slot = '19:00'
   WHERE id = (current_setting('nwc.wl_b'))::uuid;

  -- 🔄 채널 전환 (2026-08-05, 마이그 20260805120000 / 감사 L1 3단계)
  --    payroll 4컬럼은 이제 **정산 RPC 전용**이다(tr_work_logs_pin_payroll).
  --    클라도 raw UPDATE 가 아니라 set_work_log_payroll_status RPC 를 쓴다
  --    (SettlementRepository.ts:568,587 — 아래 옛 주석의 "동일한 컬럼 조합" 은 #402 이전 형태였다).
  --    SECDEF RPC 안에서는 current_user 가 definer 로 바뀌므로 핀을 통과한다.
  --    여기서는 그 채널을 RESET ROLE 로 재현한다 — JWT(employer)는 유지되므로
  --    알림 트리거가 보는 auth.uid()·역할 문맥은 그대로다(= 알림 계약 검증 의미 불변).
  --    ⚠️ 트리거는 채널과 무관하게 발화한다(P5 20260802120000 실증) — 그래서 이 전환이
  --       알림 단언의 의미를 바꾸지 않는다.
  RESET ROLE;

  -- M5 되돌리기: 클라가 RPC 로 보내는 것과 동일한 컬럼 조합으로 재현한다.
  UPDATE public.work_logs
     SET payroll_status = 'pending',
         payroll_date = NULL,
         settlement_modification_history =
           COALESCE(settlement_modification_history, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'type', 'payroll_status_revert',
                'previousStatus', 'completed',
                'newStatus', 'pending',
                'reason', '퇴근 시각 정정으로 재계산 필요',
                'modifiedBy', current_setting('nwc.owner'),
                'modifiedAt', now()::text))
   WHERE id = (current_setting('nwc.wl_c'))::uuid;

  -- M5 정방향: pending → completed (Case 3 만 발화해야 한다)
  UPDATE public.work_logs
     SET payroll_status = 'completed', payroll_date = now()
   WHERE id = (current_setting('nwc.wl_d'))::uuid;

  -- M5 정산이력 오염: 되돌리기를 하되 이력 배열은 손대지 않는다(비배열 그대로).
  UPDATE public.work_logs
     SET payroll_status = 'pending', payroll_date = NULL
   WHERE id = (current_setting('nwc.wl_e'))::uuid;

  -- M5 수정이력(Case 2) 오염: 같은 되돌리기. 상류가 던지면 이 UPDATE 의 알림이 전멸한다.
  UPDATE public.work_logs
     SET payroll_status = 'pending', payroll_date = NULL
   WHERE id = (current_setting('nwc.wl_f'))::uuid;
END $$;

RESET ROLE;
SELECT jpc_test_clear_user();

-- ─── (1) M3 대조군: 정상 confirmed 지원서면 힌트가 붙는다 ───
SELECT is(
  (SELECT (body LIKE '%취소를 요청할 수 있어요%')
     FROM public.notifications
    WHERE type = 'schedule_change'
      AND data->>'workLogId' = current_setting('nwc.wl_a')),
  true,
  'M3 대조군: confirmed 지원서는 취소 요청 힌트를 그대로 받는다(힌트 통째 제거 방지)');

-- ─── (2) M3 본체: 취소 요청 심사 중이면 힌트가 없다 ───
SELECT is(
  (SELECT (body LIKE '%취소를 요청할 수 있어요%')
     FROM public.notifications
    WHERE type = 'schedule_change'
      AND data->>'workLogId' = current_setting('nwc.wl_b')),
  false,
  'M3: cancellation_pending 이면 버튼이 없으므로 취소 요청 힌트를 말하지 않는다');

-- ─── (3) 힌트만 빠질 뿐, 시각 변경 통지 자체는 나간다 ───
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'schedule_change'
      AND data->>'workLogId' = current_setting('nwc.wl_b')),
  1,
  'M3: 힌트 억제가 알림 자체를 죽이지 않는다(시각 변경 통지 1건 유지)');

-- ─── (4) M5: 되돌리기 알림 정확히 1건 ───
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'settlement_reverted'
      AND data->>'workLogId' = current_setting('nwc.wl_c')),
  1,
  'M5: payroll_status completed → pending 에 settlement_reverted 1건 발화');

-- ─── (5) M5: 본문에 지급액과 되돌리기 사유가 실린다 ───
SELECT is(
  (SELECT (body LIKE '%500,000원%' AND body LIKE '%사유: 퇴근 시각 정정으로 재계산 필요%')
     FROM public.notifications
    WHERE type = 'settlement_reverted'
      AND data->>'workLogId' = current_setting('nwc.wl_c')),
  true,
  'M5: 되돌리기 본문에 동결 지급액 + settlement_modification_history 의 사유가 실린다');

-- ─── (6) M5: 정방향 전이는 완료 알림만, 되돌리기 알림 0 ───
SELECT is(
  (SELECT format('%s/%s',
     (SELECT count(*) FROM public.notifications
       WHERE type = 'settlement_completed' AND data->>'workLogId' = current_setting('nwc.wl_d')),
     (SELECT count(*) FROM public.notifications
       WHERE type = 'settlement_reverted' AND data->>'workLogId' = current_setting('nwc.wl_d')))),
  '1/0',
  'M5: pending → completed 는 settlement_completed 1 / settlement_reverted 0 (역방향 오발화 없음)');

-- ─── (7) 재정의가 pg_temp 하드닝을 지우지 않았다 ───
SELECT is(
  (SELECT bool_or(c ILIKE '%pg_temp%')
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace,
          unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
    WHERE n.nspname = 'public' AND p.proname = 'notify_on_work_log_update'
      AND c LIKE 'search_path=%'),
  true,
  'notify_on_work_log_update search_path 에 pg_temp 보존(CREATE OR REPLACE SET 절 회귀 가드)');

-- ─── (8) 이력이 배열이 아니어도 알림이 살아남는다 ───
SELECT is(
  (SELECT format('%s/%s',
     count(*),
     COALESCE(max(CASE WHEN body LIKE '%사유:%' THEN 1 ELSE 0 END), 0))
     FROM public.notifications
    WHERE type = 'settlement_reverted'
      AND data->>'workLogId' = current_setting('nwc.wl_e')),
  '1/0',
  'M5: settlement_modification_history 가 비배열이어도 되돌리기 알림 1건(사유 없이) — jsonb_typeof 가드');

-- ─── (9) 상류(Case 2) 이력이 비배열이어도 알림이 살아남는다 ───
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'settlement_reverted'
      AND data->>'workLogId' = current_setting('nwc.wl_f')),
  1,
  'M5: modification_history 가 비배열이어도 되돌리기 알림 1건 — Case 2 상단 jsonb_typeof 가드');

SELECT * FROM finish();
ROLLBACK;
