-- ============================================================
-- Lane D: extend_job_posting — 무한 무료연장 차단(P0) + monetization 게이트(P1)
-- 근거: docs/planning/2026-06-02-monetization-review-findings.md
--   - 무과금(paid_types.extend 부재) → cost 0, 무료 연장 적용
--   - 유료(enabled+paid_types.extend+rollout) → 1회차 5다이아 차감·적용, 2회차 idempotent 차단(무료 재연장 금지)
-- 안전: BEGIN/ROLLBACK (app_config UPDATE 포함 — 트랜잭션 종료 시 롤백)
-- ============================================================
BEGIN;
SELECT plan(7);

DO $$
DECLARE
  v_owner    uuid := gen_random_uuid();
  v_ws       uuid := gen_random_uuid();
  v_pid_free uuid := gen_random_uuid();
  v_pid_paid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_ext_owner@test.local', 'authenticated','authenticated','', '{"role":"employer"}'::jsonb, '{"name":"EXT"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_ext_owner@test.local', 'fixture','employer', true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_ext_ws', v_owner, now(), now());
  -- 유료 연장 차감용 잔액
  INSERT INTO public.wallets(user_id, diamond_balance) VALUES (v_owner, 10) ON CONFLICT (user_id) DO UPDATE SET diamond_balance = 10;

  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, work_date, work_dates, created_at, updated_at)
  VALUES
    (v_pid_free, v_owner, v_ws, '__ext free', 1, 0, 'active', 'urgent', '2026-07-01', ARRAY['2026-07-01']::text[], now(), now()),
    (v_pid_paid, v_owner, v_ws, '__ext paid', 1, 0, 'active', 'urgent', '2026-08-01', ARRAY['2026-08-01']::text[], now(), now());

  PERFORM set_config('test.owner', v_owner::text, false);
  PERFORM set_config('test.pid_free', v_pid_free::text, false);
  PERFORM set_config('test.pid_paid', v_pid_paid::text, false);
END $$;

-- ── Phase A: 무과금(시드 monetization 에 paid_types.extend 부재) → cost 0, 무료 연장 ──
SELECT is(
  (public.extend_job_posting(current_setting('test.pid_free')::uuid, current_setting('test.owner')::uuid, 7))->>'success',
  'true', 'A1: 무과금 연장 성공');
SELECT is(
  (SELECT work_date FROM public.job_postings WHERE id = current_setting('test.pid_free')::uuid),
  '2026-07-08', 'A2: 무과금 연장 — work_date +7 평행이동');

-- ── Phase B: 유료화 ON (paid_types.extend=true, rollout 100) ──
UPDATE public.app_config
SET value = jsonb_set(
      jsonb_set(value, '{paid_types,extend}', 'true'::jsonb, true),
      '{rollout_percentage}', '100'::jsonb, true
    ) || '{"enabled": true}'::jsonb
WHERE key = 'monetization';

-- 1회차 유료 연장: 5다이아 차감
SELECT is(
  (public.extend_job_posting(current_setting('test.pid_paid')::uuid, current_setting('test.owner')::uuid, 7))->>'diamonds_consumed',
  '5', 'B1: 유료 1회차 연장 — 5다이아 차감');
SELECT is(
  (SELECT diamond_balance FROM public.wallets WHERE user_id = current_setting('test.owner')::uuid),
  5, 'B2: 잔액 10-5=5');

-- 2회차 연장 시도: consume 멱등 → 차단(무한 무료연장 금지)
SELECT is(
  (public.extend_job_posting(current_setting('test.pid_paid')::uuid, current_setting('test.owner')::uuid, 7))->>'already_extended',
  'true', 'B3: 2회차 연장 — already_extended(무료 재연장 차단)');
SELECT is(
  (SELECT diamond_balance FROM public.wallets WHERE user_id = current_setting('test.owner')::uuid),
  5, 'B4: 2회차도 잔액 5 유지(이중 차감 없음)');
SELECT is(
  (SELECT work_date FROM public.job_postings WHERE id = current_setting('test.pid_paid')::uuid),
  '2026-08-08', 'B5: 날짜는 1회만 이동(+14 아님) — 무료 재연장 차단 확인');

SELECT * FROM finish();
ROLLBACK;
