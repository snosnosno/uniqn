-- ops 이력에 기기 이름 기록(2026-10-04).
--
-- ops_events.actor_device 컬럼은 처음부터 있었지만 아무 RPC 도 채우지 않았다.
-- RPC 48종의 시그니처를 바꾸는 대신, 이벤트가 쌓이는 한 곳(BEFORE INSERT 트리거)에서 요청 헤더를 읽어 채운다.
--
-- 클라이언트 → `x-client-info: <기존 값>; device=<기기 이름의 base64(UTF-8)>`
--   · x-client-info 는 supabase-js 가 늘 보내는 헤더라 CORS 허용 목록을 건드리지 않는다.
--   · HTTP 헤더에는 한글을 그대로 실을 수 없어 base64 로 감싼다.
-- 이 값은 **클라이언트가 보낸 참고 정보**다 — 위조할 수 있으므로 권한·판정에 쓰지 않는다.
-- 헤더가 없거나(크론·구 앱·SQL 직접 호출) 해석에 실패하면 NULL 로 두고, 이벤트 기록 자체는 절대 막지 않는다.
-- **actor 가 없는 이벤트(자동 전환·자동 마감)에는 붙이지 않는다** — 그 이벤트는 공개 전광판·플레이어뷰 폴링이
--   일으킬 수 있어, 붙이면 공개 링크만 아는 익명 방문자가 헤더로 임의의 글자를 운영 이력에 남길 수 있다.
-- 같은 테이블의 기존 트리거는 trg_ops_events_append_only(BEFORE DELETE OR UPDATE) 하나라 이벤트가 겹치지 않는다.

CREATE OR REPLACE FUNCTION public.fn_ops_events_stamp_device() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_info text;
  v_b64 text;
  v_name text;
BEGIN
  IF NEW.actor_device IS NOT NULL OR NEW.actor_id IS NULL THEN
    RETURN NEW;
  END IF;
  BEGIN
    v_info := NULLIF(current_setting('request.headers', true), '')::json ->> 'x-client-info';
    v_b64 := substring(v_info from 'device=([A-Za-z0-9+/]{1,160}={0,2})');
    IF v_b64 IS NOT NULL THEN
      -- 제어문자를 걷어 내고 40자로 자른다(이력 화면·CSV 한 칸에 들어갈 길이).
      v_name := btrim(regexp_replace(convert_from(decode(v_b64, 'base64'), 'UTF8'), '[[:cntrl:]]', '', 'g'));
      NEW.actor_device := NULLIF(left(v_name, 40), '');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 깨진 base64·잘못된 UTF-8·헤더 JSON 오류 — 기기 이름만 포기한다.
    NEW.actor_device := NULL;
  END;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_ops_events_stamp_device() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_ops_events_stamp_device() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ops_events_stamp_device ON public.ops_events;
CREATE TRIGGER trg_ops_events_stamp_device
  BEFORE INSERT ON public.ops_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_events_stamp_device();

COMMENT ON FUNCTION public.fn_ops_events_stamp_device() IS
  'ops_events INSERT 시 요청 헤더(x-client-info 의 device=base64)에서 기기 이름을 읽어 actor_device 에 채운다. 참고 정보(위조 가능) — 권한 판정에 쓰지 않는다.';
