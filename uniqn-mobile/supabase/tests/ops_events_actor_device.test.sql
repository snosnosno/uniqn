-- ops 이력 기기 이름(마이그 20261004100200): 헤더의 device=base64 → actor_device · 헤더 없음/깨짐은 NULL(기록은 막지 않음) ·
--   40자 절단 · 제어문자 제거 · 내부 함수 직접 실행 불가.
BEGIN;
SELECT plan(11);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;

CREATE FUNCTION pg_temp.tid() RETURNS uuid LANGUAGE sql AS
  $$ SELECT current_setting('ops.tournament_id')::uuid $$;
CREATE FUNCTION pg_temp.owner() RETURNS uuid LANGUAGE sql AS
  $$ SELECT current_setting('ops.owner_id')::uuid $$;
-- 요청 헤더를 흉내 낸다(PostgREST 가 request.headers 에 소문자 키 JSON 으로 넣는다).
CREATE FUNCTION pg_temp.set_client_info(p_value text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.headers', json_build_object('x-client-info', p_value)::text, true) $$;
CREATE FUNCTION pg_temp.b64(p_text text) RETURNS text LANGUAGE sql AS
  $$ SELECT replace(encode(convert_to(p_text, 'UTF8'), 'base64'), E'\n', '') $$;
-- 이벤트를 하나 만들고(등록 토글) 방금 쌓인 이벤트의 기기 이름을 돌려준다.
CREATE FUNCTION pg_temp.device_after_toggle() RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), true);
  SELECT COALESCE(actor_device, 'NULL') INTO v FROM public.ops_events
   WHERE tournament_id = pg_temp.tid() ORDER BY seq DESC LIMIT 1;
  RETURN v;
END $$;

-- ─── (1) 내부 트리거 함수는 직접 실행할 수 없다 ───
SELECT ok(NOT has_function_privilege('authenticated', 'public.fn_ops_events_stamp_device()', 'EXECUTE'),
  'authenticated 는 fn_ops_events_stamp_device 를 직접 실행할 수 없다');

SELECT ops_test_set_user(pg_temp.owner());

-- ─── (2) 헤더가 아예 없으면 NULL ───
SELECT set_config('request.headers', '', true);
SELECT is(pg_temp.device_after_toggle(), 'NULL', '요청 헤더가 없으면 기기 이름 없음');

-- ─── (3) device 가 없는 x-client-info 는 NULL ───
SELECT pg_temp.set_client_info('supabase-js-web/2.117.2');
SELECT is(pg_temp.device_after_toggle(), 'NULL', 'device= 가 없으면 기기 이름 없음');

-- ─── (4) 한글 기기 이름 ───
SELECT pg_temp.set_client_info('supabase-js-web/2.117.2; device=' || pg_temp.b64('등록데스크 1'));
SELECT is(pg_temp.device_after_toggle(), '등록데스크 1', 'base64 로 실린 한글 기기 이름이 그대로 기록된다');

-- ─── (5) 40자 절단 ───
-- ASCII 50자(base64 68자) — 정규식 길이 제한이 아니라 left(…, 40) 이 자르는 경로를 탄다.
SELECT pg_temp.set_client_info('x; device=' || pg_temp.b64(repeat('a', 50)));
SELECT is(pg_temp.device_after_toggle(), repeat('a', 40), '기기 이름은 40자로 자른다');
-- 헤더에 실린 base64 가 서버 한도(160자)를 넘으면 문자 중간이 잘려 해석할 수 없다 → 이름 없이 기록한다.
SELECT pg_temp.set_client_info('x; device=' || pg_temp.b64('a' || repeat('가', 60)));
SELECT is(pg_temp.device_after_toggle(), 'NULL', '한도를 넘는 값은 기기 이름만 포기한다(이벤트는 남는다)');

-- ─── (6) 제어문자 제거 ───
SELECT pg_temp.set_client_info('x; device=' || pg_temp.b64(E'플로어\t태블릿\n'));
SELECT is(pg_temp.device_after_toggle(), '플로어태블릿', '탭·줄바꿈 같은 제어문자는 걷어 낸다');

-- ─── (7) 잘못된 UTF-8 → NULL, 이벤트 기록은 성공 ───
SELECT pg_temp.set_client_info('x; device=' || encode('\xfffe'::bytea, 'base64'));
SELECT is(pg_temp.device_after_toggle(), 'NULL', '해석할 수 없는 값이면 기기 이름만 포기하고 이벤트는 남긴다');

-- ─── (8) 헤더가 JSON 이 아니어도 이벤트 기록을 막지 않는다 ───
SELECT set_config('request.headers', 'not-json', true);
SELECT lives_ok(
  $$ SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), true) $$,
  '헤더 JSON 이 깨져 있어도 RPC 는 성공한다');

-- ─── (9) 공백뿐인 이름 → NULL ───
SELECT pg_temp.set_client_info('x; device=' || pg_temp.b64('   '));
SELECT is(pg_temp.device_after_toggle(), 'NULL', '공백뿐인 이름은 기록하지 않는다');


-- ─── actor 가 없는 이벤트(자동 전환·자동 마감)에는 헤더가 있어도 붙이지 않는다 ───
--     이런 이벤트는 공개 폴링이 일으킬 수 있어, 붙이면 익명 방문자가 운영 이력에 글자를 남길 수 있다.
SELECT pg_temp.set_client_info('x; device=' || pg_temp.b64('본부 데스크'));
SELECT set_config('role', 'postgres', true);
INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
VALUES (pg_temp.tid(), 'level_set', NULL, '{"action":"auto_advance"}'::jsonb);
SELECT is(
  (SELECT COALESCE(actor_device, 'NULL') FROM public.ops_events
    WHERE tournament_id = pg_temp.tid() ORDER BY seq DESC LIMIT 1),
  'NULL', 'actor 없는 이벤트에는 기기 이름을 붙이지 않는다');

SELECT * FROM finish();
ROLLBACK;
