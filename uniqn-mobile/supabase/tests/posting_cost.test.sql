-- ============================================================
-- T1: get_posting_cost / _calc_posting_cost 검증
-- 비용 모델: regular=1, urgent=10, fixed=5, tournament=0
-- flag off → 항상 0 / flag on + rollout 경계 검증
-- 안전: BEGIN/ROLLBACK 래핑
-- ============================================================
BEGIN;
SELECT plan(10);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_pc_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"PC"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_pc_owner@test.local', 'fixture', 'employer', true, now(), now());
  PERFORM set_config('test.owner', v_owner::text, false);
END $$;

-- flag off (현재 시드 상태: paid_types 전부 false) → 전부 0
SELECT is(
  public._calc_posting_cost('regular', current_setting('test.owner')::uuid), 0,
  'flag off: regular cost = 0');
SELECT is(
  public._calc_posting_cost('urgent', current_setting('test.owner')::uuid), 0,
  'flag off: urgent cost = 0');

-- flag on, rollout 100%, urgent/fixed/regular paid → base cost
UPDATE public.app_config
SET value = jsonb_set(jsonb_set(jsonb_set(jsonb_set(value,
      '{paid_types,urgent}','true'),
      '{paid_types,fixed}','true'),
      '{paid_types,regular}','true'),
      '{rollout_percentage}','100')
WHERE key = 'monetization';

SELECT is(public._calc_posting_cost('regular', current_setting('test.owner')::uuid), 1, 'paid 100%: regular = 1 (heart)');
SELECT is(public._calc_posting_cost('urgent', current_setting('test.owner')::uuid), 10, 'paid 100%: urgent = 10');
SELECT is(public._calc_posting_cost('fixed', current_setting('test.owner')::uuid), 5, 'paid 100%: fixed = 5');
SELECT is(public._calc_posting_cost('tournament', current_setting('test.owner')::uuid), 0, 'tournament always 0');

-- rollout 0% → 게이트 밖이라 0 (paid_types true여도)
UPDATE public.app_config SET value = jsonb_set(value, '{rollout_percentage}', '0') WHERE key = 'monetization';
SELECT is(public._calc_posting_cost('urgent', current_setting('test.owner')::uuid), 0, 'rollout 0%: urgent = 0 (gated out)');

-- enabled=false → 전부 0 (paid_types/rollout 무관)
UPDATE public.app_config SET value = jsonb_set(jsonb_set(value, '{enabled}', 'false'), '{rollout_percentage}', '100') WHERE key = 'monetization';
SELECT is(public._calc_posting_cost('urgent', current_setting('test.owner')::uuid), 0, 'enabled=false: urgent = 0');

-- get_posting_cost read-only 표시 계약 (enabled=false 상태)
SELECT is(
  (public.get_posting_cost('urgent', current_setting('test.owner')::uuid))->>'cost', '0',
  'get_posting_cost returns cost field');
SELECT is(
  (public.get_posting_cost('urgent', current_setting('test.owner')::uuid))->>'is_paid', 'false',
  'get_posting_cost returns is_paid field');

SELECT * FROM finish();
ROLLBACK;
