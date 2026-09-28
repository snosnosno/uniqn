-- ============================================================================
-- ops-web 로컬 검증용 시드 — 계정 (W2). 대회·참가자·좌석은 W3 에서 이어 붙인다.
-- ⚠️ 로컬 전용. 알려진 비밀번호 계정을 만든다 — prod 실행 절대 금지.
--    실행기(scripts/seed-local.mjs)는 로컬 Docker 컨테이너(supabase_db_uniqn)에만 붙는다.
-- 멱등: 여러 번 돌려도 같은 상태로 되돌린다(DO UPDATE) — 검증 전에 매번 돌려도 된다.
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. auth.users (이메일 로그인 자격 증명)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  ('0a5e0000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ops-owner@uniqn.test',
   crypt('TestPass1!', gen_salt('bf', 10)), now(), now(), now(),
   '{"provider":"email","providers":["email"],"role":"employer"}', '{"name":"옵스운영자"}',
   false, '', '', '', ''),
  ('0a5e0000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ops-incomplete@uniqn.test',
   crypt('TestPass1!', gen_salt('bf', 10)), now(), now(), now(),
   '{"provider":"email","providers":["email"],"role":"staff"}', '{"name":"미완성"}',
   false, '', '', '', ''),
  ('0a5e0000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ops-dealer@uniqn.test',
   crypt('TestPass1!', gen_salt('bf', 10)), now(), now(), now(),
   '{"provider":"email","providers":["email"],"role":"staff"}', '{"name":"옵스딜러"}',
   false, '', '', '', '')
ON CONFLICT (id) DO UPDATE
  SET encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      recovery_token = '',
      updated_at = now();

-- 2. auth.identities (이메일 로그인에 필수)
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.email, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
FROM auth.users u
WHERE u.id IN ('0a5e0000-0000-4000-8000-000000000001', '0a5e0000-0000-4000-8000-000000000002',
               '0a5e0000-0000-4000-8000-000000000003')
ON CONFLICT (provider_id, provider) DO NOTHING;

-- 3. public.users — 진입 판정 4컬럼을 매번 원상태로 되돌린다.
INSERT INTO public.users (
  id, email, name, nickname, role, status, is_active, phone, phone_verified, profile_completed,
  terms_agreed, privacy_agreed, marketing_agreed, identity_verified, identity_verified_at,
  created_at, updated_at
)
VALUES
  ('0a5e0000-0000-4000-8000-000000000001', 'ops-owner@uniqn.test', '옵스운영자', 'ops-owner',
   'employer', 'active', true, '+82101110001', true, true, true, true, false, true, now(), now(), now()),
  ('0a5e0000-0000-4000-8000-000000000002', 'ops-incomplete@uniqn.test', '미완성', 'ops-incomplete',
   'staff', 'active', true, NULL, false, false, true, true, false, false, NULL, now(), now()),
  -- 스태프 수동 추가(닉네임 검색) 검증용 — 완성 프로필
  ('0a5e0000-0000-4000-8000-000000000003', 'ops-dealer@uniqn.test', '옵스딜러', 'ops-dealer',
   'staff', 'active', true, '+82101110003', true, true, true, true, false, true, now(), now(), now())
ON CONFLICT (id) DO UPDATE
  SET nickname = EXCLUDED.nickname,
      phone_verified = EXCLUDED.phone_verified,
      profile_completed = EXCLUDED.profile_completed,
      identity_verified = EXCLUDED.identity_verified,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      is_active = EXCLUDED.is_active,
      updated_at = now();

-- 4. ops-owner 의 워크스페이스 + 관리 공고 1건(대회↔공고 연결 검증용). 픽스처라 직접 INSERT.
INSERT INTO public.workspaces (id, name, owner_id)
VALUES ('0a5e0000-0000-4000-8000-0000000000a1', '옵스 시드 워크스페이스', '0a5e0000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.job_postings (id, title, status, owner_id, workspace_id)
VALUES ('0a5e0000-0000-4000-8000-0000000000b1', '시드 · 금요 토너먼트 딜러 모집', 'active',
        '0a5e0000-0000-4000-8000-000000000001', '0a5e0000-0000-4000-8000-0000000000a1')
ON CONFLICT (id) DO UPDATE SET status = 'active', owner_id = EXCLUDED.owner_id, workspace_id = EXCLUDED.workspace_id;

-- 두 번째 공고 — "공고 변경" 후보가 있어야 select 화살표 키 오조작 회귀(E2E w56)가 공허하지 않다.
INSERT INTO public.job_postings (id, title, status, owner_id, workspace_id)
VALUES ('0a5e0000-0000-4000-8000-0000000000b2', '시드 · 토요 대회 플로어 모집', 'active',
        '0a5e0000-0000-4000-8000-000000000001', '0a5e0000-0000-4000-8000-0000000000a1')
ON CONFLICT (id) DO UPDATE SET status = 'active', owner_id = EXCLUDED.owner_id, workspace_id = EXCLUDED.workspace_id;

COMMIT;
