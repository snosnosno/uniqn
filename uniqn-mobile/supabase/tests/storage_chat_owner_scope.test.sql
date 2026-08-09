-- ============================================================
-- 감사 sec-01 / sec-02 회귀 가드 (마이그 20260809130000)
-- ============================================================
-- 목적
--   chat 버킷이 "인증된 아무나 남의 객체를 읽고 덮어쓰고 지울 수 있는" 상태로
--   되돌아가지 않게 고정한다. prod 실측상 storage.objects 35정책 중 소유자 술어가
--   전혀 없던 유일한 버킷이었다.
--
-- 구현 특성상 반드시 행동으로 검증한다
--   느슨한 chat_storage_* PERMISSIVE 4정책은 supabase_storage_admin 소유라
--   DROP/ALTER 가 불가능하고, 봉합은 RESTRICTIVE 정책 1개를 얹어 AND 결합하는
--   방식이다. "정책이 존재한다"만 봐서는 두 정책의 결합 결과를 알 수 없으므로
--   실제 INSERT 로 허용/차단을 관측한다.
--
-- Red-Green 실측(2026-08-09, 로컬 스택)
--   RED : 마이그 미적용 상태에서 `chat/<남의uid>/evil.png` INSERT → **성공**(결함 실재)
--   GREEN: 마이그 적용 후 동일 INSERT → 42501 RLS 위반으로 차단
--
-- 시드 비의존
--   술어가 auth.uid() 클레임과 경로 첫 세그먼트만 비교하고 storage.objects.owner 는
--   건드리지 않으므로 임의 UUID 로 검증된다(로컬 실측). baseline 시드 유저에 묶지 않는다.
--
-- 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(7);

-- 테스트용 가짜 사용자 2명 (auth.users 행 불필요 — 위 '시드 비의존' 참조)
\set me   '11111111-1111-4111-8111-111111111111'
\set them '22222222-2222-4222-8222-222222222222'

-- ------------------------------------------------------------
-- 1~2. 구조 — RESTRICTIVE 여야 의미가 있다
--   PERMISSIVE 로 잘못 만들면 느슨한 기존 정책과 OR 로 합쳐져 아무것도 막지 못한다.
-- ------------------------------------------------------------
SELECT is(
  (SELECT permissive FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname = 'chat_storage_owner_scope'),
  'RESTRICTIVE',
  'chat_storage_owner_scope 는 RESTRICTIVE 여야 한다(PERMISSIVE 면 OR 결합돼 무력)'
);

SELECT is(
  (SELECT roles::text FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname = 'chat_storage_owner_scope'),
  '{authenticated}',
  'chat_storage_owner_scope 는 authenticated 에만 적용된다(service_role 업로드 경로 무영향)'
);

-- ------------------------------------------------------------
-- 3. 행동(핵심) — 남의 폴더에 chat 업로드는 차단
-- ------------------------------------------------------------
SELECT throws_ok(
  format(
    $$ SELECT jpc_test_set_user(%L::uuid);
       INSERT INTO storage.objects (bucket_id, name) VALUES ('chat', %L); $$,
    :'me', :'them' || '/evil.png'
  ),
  '42501',
  NULL,
  'chat: 남의 uid 폴더에 업로드하면 RLS 로 차단된다(sec-01 핵심)'
);

-- ------------------------------------------------------------
-- 4. 행동(대조군) — 내 폴더는 허용
--   🚨 3번만 있으면 "전부 막혔다"와 구분되지 않는다. 허용 경로를 함께 단언해야
--      차단이 과잉이 아님을 증명할 수 있다.
-- ------------------------------------------------------------
SELECT lives_ok(
  format(
    $$ SELECT jpc_test_set_user(%L::uuid);
       INSERT INTO storage.objects (bucket_id, name) VALUES ('chat', %L);
       RESET ROLE; $$,
    :'me', :'me' || '/mine.png'
  ),
  'chat: 본인 uid 폴더 업로드는 허용된다'
);

-- ------------------------------------------------------------
-- 5. 행동(비침습) — 다른 버킷은 종전 그대로
--   술어를 `bucket_id IS DISTINCT FROM 'chat' OR ...` 로 쓴 이유가 이것이다.
-- ------------------------------------------------------------
SELECT lives_ok(
  format(
    $$ SELECT jpc_test_set_user(%L::uuid);
       INSERT INTO storage.objects (bucket_id, name) VALUES ('boards', %L);
       RESET ROLE; $$,
    :'me', :'me' || '/ok.png'
  ),
  'boards: 본인 폴더 업로드가 종전대로 동작한다(RESTRICTIVE 가 다른 버킷을 막지 않는다)'
);

-- ------------------------------------------------------------
-- 6~7. sec-02 — temp 버킷 MIME 화이트리스트
-- ------------------------------------------------------------
SELECT isnt(
  (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'temp'),
  NULL,
  'temp 버킷에 allowed_mime_types 화이트리스트가 있다(임의 확장자 20MB 업로드 차단)'
);

SELECT ok(
  NOT ('image/svg+xml' = ANY (SELECT unnest(allowed_mime_types) FROM storage.buckets WHERE id = 'temp')),
  'temp 화이트리스트에 image/svg+xml 이 없다(서빙 시 XSS 벡터)'
);

SELECT * FROM finish();
ROLLBACK;
