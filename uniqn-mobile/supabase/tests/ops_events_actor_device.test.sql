-- ops 이력 기기 이름(마이그 20261004100200): 헤더의 device=base64 → actor_device · 헤더 없음/깨짐은 NULL(기록은 막지 않음) ·
--   40자 절단 · 제어문자 제거 · 내부 함수 직접 실행 불가.
BEGIN;
SELECT plan(9);

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
SELECT pg_temp.set_client_info('x; device=' || pg_temp.b64(repeat('가', 50)));
SELECT is(char_length(pg_temp.device_after_toggle()), 40, '기기 이름은 40자로 자른다');

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

SELECT * FROM finish();
ROLLBACK;
