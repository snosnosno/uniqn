-- ============================================================
-- T5: refund 협업자 권한 분기
-- owner 환불 OK / 협업자(JPC) 취소 시 owner 지갑 환불 OK / 제3자 unauthorized
-- 안전: BEGIN/ROLLBACK. auth.uid() = request.jwt.claim.sub (STEP0 확인)
-- JPC 실제 컬럼: job_posting_id, user_id, added_by, added_at (workspace_id/role 없음)
-- 각 케이스는 독립된 posting을 사용하여 멱등성 충돌을 방지
-- ============================================================
BEGIN;
SELECT plan(3);

DO $$
DECLARE
  v_owner    uuid := gen_random_uuid();
  v_collab   uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_ws       uuid := gen_random_uuid();
  v_pid1     uuid := gen_random_uuid();  -- collab 테스트용
  v_pid2     uuid := gen_random_uuid();  -- owner 테스트용
  v_pid3     uuid := gen_random_uuid();  -- stranger 테스트용 (독립)
BEGIN
  -- auth.users
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,   '__sql_fixture_rf_owner@test.local',   'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"RFO"}'::jsonb, now(), now()),
    (v_collab,  '__sql_fixture_rf_collab@test.local',  'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"RFC"}'::jsonb, now(), now()),
    (v_stranger,'__sql_fixture_rf_str@test.local',     'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"RFS"}'::jsonb, now(), now());

  -- public.users
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture', 'employer', true, now(), now()
    FROM auth.users
   WHERE id IN (v_owner, v_collab, v_stranger)
  ON CONFLICT (id) DO NOTHING;

  -- workspace (owner 소유)
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_rf_ws', v_owner, now(), now());

  -- owner 지갑
  INSERT INTO public.wallets(user_id, diamond_balance) VALUES (v_owner, 0) ON CONFLICT (user_id) DO NOTHING;

  -- job_postings (각 테스트케이스별 독립 공고)
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, created_at, updated_at)
  VALUES
    (v_pid1, v_owner, v_ws, '__sql_fixture: rf collab',   1, 0, 'active', 'urgent', now(), now()),
    (v_pid2, v_owner, v_ws, '__sql_fixture: rf owner',    1, 0, 'active', 'urgent', now(), now()),
    (v_pid3, v_owner, v_ws, '__sql_fixture: rf stranger', 1, 0, 'active', 'urgent', now(), now());

  -- 협업자 등록 (JPC 실제 컬럼: job_posting_id, user_id, added_by, added_at)
  -- added_by != user_id 제약 준수: added_by = v_owner
  -- collab는 pid1에만 등록 (pid3에는 없음 → stranger 권한 없음)
  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by, added_at)
  VALUES (v_pid1, v_collab, v_owner, now())
  ON CONFLICT (job_posting_id, user_id) DO NOTHING;

  -- owner consume ledger 시드 (각 공고 10 다이아 차감, 1시간 전)
  INSERT INTO public.wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
                                    balance_after_heart, balance_after_diamond, created_at)
  VALUES
    (v_owner, 'diamond', -10, 'consume_job_posting', v_pid1, 'job_posting', 0, 0, now() - interval '1 hour'),
    (v_owner, 'diamond', -10, 'consume_job_posting', v_pid2, 'job_posting', 0, 0, now() - interval '1 hour'),
    (v_owner, 'diamond', -10, 'consume_job_posting', v_pid3, 'job_posting', 0, 0, now() - interval '1 hour');

  PERFORM set_config('test.owner',    v_owner::text,   false);
  PERFORM set_config('test.collab',   v_collab::text,  false);
  PERFORM set_config('test.stranger', v_stranger::text,false);
  PERFORM set_config('test.pid1',     v_pid1::text,    false);
  PERFORM set_config('test.pid2',     v_pid2::text,    false);
  PERFORM set_config('test.pid3',     v_pid3::text,    false);
END $$;

-- T1: owner 본인이 자기 공고(pid2) 취소 → 환불 성공
SELECT set_config('request.jwt.claim.sub', current_setting('test.owner'), false);
SELECT is(
  (public.refund_job_cancellation_atomically(
     current_setting('test.pid2')::uuid,
     current_setting('test.owner')::uuid
   ))->>'success',
  'true',
  'owner cancel → refund success'
);

-- T2: 협업자(collab)가 pid1 취소, p_owner_id=owner → owner 지갑 환불 성공
SELECT set_config('request.jwt.claim.sub', current_setting('test.collab'), false);
SELECT is(
  (public.refund_job_cancellation_atomically(
     current_setting('test.pid1')::uuid,
     current_setting('test.owner')::uuid
   ))->>'success',
  'true',
  'collaborator cancel → owner refund success'
);

-- T3: 제3자(stranger)가 pid3 취소 시도 → unauthorized
-- pid3는 미환불·stranger는 JPC 미등록 → 멱등성 충돌 없이 권한 체크에 도달
SELECT set_config('request.jwt.claim.sub', current_setting('test.stranger'), false);
SELECT is(
  (public.refund_job_cancellation_atomically(
     current_setting('test.pid3')::uuid,
     current_setting('test.owner')::uuid
   ))->>'error',
  'unauthorized',
  'stranger cancel → unauthorized'
);

SELECT * FROM finish();
ROLLBACK;
