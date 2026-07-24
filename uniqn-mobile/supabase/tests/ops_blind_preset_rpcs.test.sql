-- ops_blind_presets save/delete SECDEF RPC pgTAP(B6): actor 바인딩·upsert·소유자 격리·anon REVOKE 계약.
--   ops_save_blind_preset(actor,name,levels) / ops_delete_blind_preset(actor,preset_id).
-- 스펙: taskB-4-brief.md(Step 1). 패턴: ops_blind_presets_rls.test.sql(seed·set_user), ops_staff_security.test.sql
--   (actor 위조 throws_ok + anon-executable ops SECDEF 카탈로그 총량 불변 카운트).
-- ⚠️ JWT 주입은 헬퍼(ops_test_set_user) 경유만 — 인라인 set_config 로 request.jwt.* 직접 주입 금지
--    (wiki decisions/wallet-pgtap-caller-binding: singular/plural GUC 동시주입 안 하면 owner 바인딩 42501 오염).
-- ⚠️ 케이스 5 anon =2 는 기존 가드(ops_staff_security.test.sql:54-68)와 동일 쿼리 복제 — prosecdef 필터 +
--    'ops\_test\_%' 헬퍼 제외 + '\_' 이스케이프 셋 다 필수(하나라도 빠지면 로컬 픽스처가 섞여 false-RED).
BEGIN;
SELECT plan(7);

-- 독립 소유자 A/B 시드(각 seed 호출은 새 랜덤 유저). 시드는 set_user 이전(postgres superuser).
DO $$
DECLARE a RECORD; b RECORD;
BEGIN
  SELECT * INTO a FROM ops_test_seed();
  SELECT * INTO b FROM ops_test_seed();
  PERFORM set_config('bp.a', a.owner_id::text, true);
  PERFORM set_config('bp.b', b.owner_id::text, true);
END $$;

-- ─── (1) save: owner A 저장 → 행 1개, owner_id=A ───
SELECT ops_test_set_user((current_setting('bp.a'))::uuid);
DO $$
DECLARE v uuid;
BEGIN
  v := public.ops_save_blind_preset(
    (current_setting('bp.a'))::uuid, '내 프리셋',
    '[{"level":1,"smallBlind":100,"bigBlind":200,"ante":0,"durationSec":600,"isBreak":false}]'::jsonb);
  PERFORM set_config('bp.pid', v::text, true);
END $$;
SELECT is(
  (SELECT owner_id FROM public.ops_blind_presets WHERE id = (current_setting('bp.pid'))::uuid),
  (current_setting('bp.a'))::uuid,
  'save: owner A 프리셋 저장(owner_id=A)');

-- ─── (2) save: 동명 재저장 → 행 수 그대로 1, levels 갱신(upsert) ───
DO $$
BEGIN
  PERFORM public.ops_save_blind_preset(
    (current_setting('bp.a'))::uuid, '내 프리셋',
    '[{"level":1,"smallBlind":200,"bigBlind":400,"ante":50,"durationSec":900,"isBreak":false}]'::jsonb);
END $$;
SELECT is(
  (SELECT json_build_object('n', count(*)::int, 'bb', max((levels->0->>'bigBlind')::int))::text
     FROM public.ops_blind_presets
    WHERE owner_id = (current_setting('bp.a'))::uuid AND name = '내 프리셋'),
  json_build_object('n', 1, 'bb', 400)::text,
  'upsert: 동명 재저장 행 1 유지 + levels 갱신(bigBlind 400)');

-- ─── (3) save: 비-숫자 bigBlind("abc") → 캐스트 전 정규식 선검증으로 P0001(raw 22P02 아님) ───
-- ⚠️ actor A 유효(가드 통과) → levels 검증에 도달. 정규식 미적용이면 (e->>'bigBlind')::bigint 가 22P02 로
--    친절 P0001 경로를 우회한다. SQLSTATE 를 P0001 로 앵커해 회귀 고정.
SELECT throws_ok(
  $$ SELECT public.ops_save_blind_preset(
       (current_setting('bp.a'))::uuid, '불량 레벨',
       '[{"level":1,"smallBlind":100,"bigBlind":"abc","ante":0,"durationSec":600,"isBreak":false}]'::jsonb) $$,
  'P0001', '레벨 값 불량', 'save: 비-숫자 bigBlind 캐스트 전 P0001(22P02 우회 차단)');

-- ─── (4) save: p_actor 위조(auth.uid()=B ≠ actor A, non-admin) → P0001 ───
SELECT ops_test_set_user((current_setting('bp.b'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_save_blind_preset((current_setting('bp.a'))::uuid, '위조', '[]'::jsonb) $$,
  'P0001', 'actor 불일치', 'save: actor 위조 차단(P0001, 본문 첫 검사)');

-- ─── (5) delete: owner B 가 A 프리셋 삭제 시도(유효 actor B) → owner 스코프로 삭제 0, A 프리셋 존치 ───
DO $$
BEGIN
  PERFORM public.ops_delete_blind_preset(
    (current_setting('bp.b'))::uuid, (current_setting('bp.pid'))::uuid);
END $$;
SELECT ops_test_set_user((current_setting('bp.a'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.ops_blind_presets WHERE id = (current_setting('bp.pid'))::uuid),
  1, 'delete: 타인(B) 삭제 차단 — A 프리셋 존치(owner_id 스코프)');

-- ─── (6) anon-executable ops SECDEF 정확히 2개 유지(신규 RPC REVOKE 확인) ───
-- ⚠️ 기존 가드(ops_staff_security.test.sql:54-68)와 동일 쿼리 복제. 신규 함수가 REVOKE 없이 추가되면 튄다.
SELECT is(
  (SELECT count(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname LIKE 'ops\_%' ESCAPE '\'
      AND p.proname NOT LIKE 'ops\_test\_%' ESCAPE '\'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  2::bigint,
  'anon-executable ops SECDEF =2 (신규 save/delete RPC REVOKE 확인)');

-- ─── (7) search_path 하드닝(public, extensions, pg_temp) — 신규 2함수 proconfig ───
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('ops_save_blind_preset', 'ops_delete_blind_preset')
      AND p.prosecdef
      AND EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
                  WHERE c LIKE 'search_path=%' AND c LIKE '%pg_temp%'
                    AND c LIKE '%public%' AND c LIKE '%extensions%')),
  2, 'search_path=public,extensions,pg_temp 하드닝 2함수');

SELECT * FROM finish();
ROLLBACK;
