-- uniqn-mobile/supabase/fixtures/ops_helpers.sql
-- ops(라이브 운영) pgTAP 헬퍼 — fixtures 전용 (PROD 등록 금지).
-- ⚠️ 위치: supabase/fixtures/ (tests/ 에 두면 plan 없는 파일로 pg_prove fail).
-- ⚠️ 테이블/시퀀스만 GRANT (함수 GRANT 금지 — 마이그 REVOKE 회귀 방지).
-- 참고: jpc_helpers.sql 패턴. set_config('role','authenticated') = 실제 role switch →
--       RLS 평가됨(postgres superuser 는 RLS 우회하므로 role 전환 필수).

-- CLI 드리프트 방어: 테스트 스택 GRANT 를 prod 동치로 (RLS 가 실제 보안경계).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 페르소나 + 리소스 시드 (트랜잭션 내 호출, ROLLBACK 정리).
-- owner(employer), member(workspace editor, employer), outsider(staff).
-- ops_tournament 는 job_posting(workspace) 연결 → is_ops_member 가 owner OR workspace 멤버 허용.
CREATE OR REPLACE FUNCTION ops_test_seed()
RETURNS TABLE (
  owner_id       uuid,
  member_id      uuid,
  outsider_id    uuid,
  workspace_id   uuid,
  job_posting_id uuid,
  tournament_id  uuid,
  participant_id uuid,
  event_id       uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_owner     uuid := gen_random_uuid();
  v_member    uuid := gen_random_uuid();
  v_outsider  uuid := gen_random_uuid();
  v_ws        uuid := gen_random_uuid();
  v_jp        uuid := gen_random_uuid();
  v_t         uuid := gen_random_uuid();
  v_p         uuid := gen_random_uuid();
  v_e         uuid := gen_random_uuid();
  v_work_date date := current_date + 14;
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (v_owner,    'ops_owner_'    || v_owner    || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_member,   'ops_member_'   || v_member   || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_outsider, 'ops_outsider_' || v_outsider || '@test.local', '{"role":"staff"}'::jsonb,    '{}'::jsonb, now(), now(), '', '', '', '');

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'ops test',
    CASE WHEN id = v_outsider THEN 'staff'::user_role ELSE 'employer'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner, v_member, v_outsider)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, 'ops test ws', v_owner, now(), now());
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (v_ws, v_member, 'editor', now());

  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  )
  VALUES (
    v_jp, v_owner, 'ops owner', v_ws, 'ops test posting', 'active', 'regular',
    v_work_date::text, ARRAY[v_work_date::text], 3, 0, 0, 3, '+82101111111', now(), now()
  );

  -- 시드 대회: 참가자 1명 + next_entry_seq=1 (다음 할당은 2 부터 — gap-free 유지).
  INSERT INTO public.ops_tournaments (
    id, owner_id, job_posting_id, name, game_type, starting_chips,
    registration_open, next_entry_seq, rebuy_chips, addon_chips, buy_in_cost
  )
  VALUES (v_t, v_owner, v_jp, 'ops test cup', 'NLH', 30000, true, 1, 30000, 20000, 50000);

  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES (v_p, v_t, 1, 'Seed Player', 'active', 30000);

  INSERT INTO public.ops_events (id, tournament_id, type, actor_id, payload)
  VALUES (v_e, v_t, 'tournament_created', v_owner, '{}'::jsonb);

  RETURN QUERY SELECT v_owner, v_member, v_outsider, v_ws, v_jp, v_t, v_p, v_e;
END;
$$;

-- JWT 클레임 + role 전환 (auth.uid() = request.jwt.claims->>'sub').
CREATE OR REPLACE FUNCTION ops_test_set_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;
