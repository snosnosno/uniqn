-- ops 전면 개방 S1 — D1 퍼널 계측(F8) 영속 레일.
-- Firebase Analytics 제거(무영속) 상태라 최소 이벤트 테이블을 신설한다.
-- 퍼널: 허브 노출 → 진입 → 생성 → 공개뷰 열람 → 가입(claim) 전환. 분모 = 노출 대비 진입율.
-- ops_limit_reached 는 S2(한도) 대비 선배선 — S1 에서는 발화 지점 없음.
-- 쓰기: INSERT 전용(수정/삭제 불가). 조회: admin 전용(SQL 대시보드).

CREATE TABLE public.analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event text NOT NULL CHECK (event IN (
    'ops_hub_impression',       -- 진입 표면 노출(프로필 메뉴 렌더 등)
    'ops_hub_entered',          -- (ops) 허브 진입
    'ops_tournament_created',   -- 대회 생성(복제 포함, props.method)
    'ops_public_view_opened',   -- 공개뷰 열람(anon 허용, props.tk = 토큰 8자 prefix)
    'ops_claim_converted',      -- 플레이어 claim 성공(가입 전환 보조 지표)
    'ops_limit_reached'         -- 한도 도달(S2 선배선)
  )),
  user_id uuid,
  props jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(props) <= 2048),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analytics_events IS
  'ops S1 퍼널 계측(D1/F8). INSERT 전용, 조회 admin. P1 성공 기준 쿼리는 설계 문서 §5-S1 참조.';

CREATE INDEX idx_analytics_events_event_time ON public.analytics_events (event, created_at);
CREATE INDEX idx_analytics_events_user_time ON public.analytics_events (user_id, created_at)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_events_anon_tk ON public.analytics_events ((props->>'tk'), created_at)
  WHERE user_id IS NULL;

-- BEFORE INSERT 가드: 필드 캐노니컬라이즈 + rate limit(남용 상한)
CREATE OR REPLACE FUNCTION public.fn_analytics_events_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_cnt int;
  v_tk text;
BEGIN
  NEW.user_id := auth.uid(); -- 위조 user_id 차단(anon 이면 NULL)
  NEW.created_at := now();

  IF NEW.user_id IS NOT NULL THEN
    SELECT count(*) INTO v_cnt FROM public.analytics_events
     WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour';
    IF v_cnt >= 240 THEN
      RAISE EXCEPTION 'ANALYTICS_RATE_LIMITED: 이벤트 기록 한도 초과' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- anon 은 토큰 prefix 필수(공개뷰 열람만) + prefix 당 시간당 120건 상한
    v_tk := NEW.props->>'tk';
    IF v_tk IS NULL OR char_length(v_tk) NOT BETWEEN 4 AND 16 THEN
      RAISE EXCEPTION 'ANALYTICS_RATE_LIMITED: 익명 이벤트 형식 오류' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) INTO v_cnt FROM public.analytics_events
     WHERE user_id IS NULL AND props->>'tk' = v_tk AND created_at > now() - interval '1 hour';
    IF v_cnt >= 120 THEN
      RAISE EXCEPTION 'ANALYTICS_RATE_LIMITED: 이벤트 기록 한도 초과' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_analytics_events_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_analytics_events_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_analytics_events_guard() FROM anon;

CREATE TRIGGER trg_analytics_events_guard
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_analytics_events_guard();

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events FORCE ROW LEVEL SECURITY;

-- anon 은 공개뷰 열람 이벤트만
CREATE POLICY ae_anon_insert ON public.analytics_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND event = 'ops_public_view_opened');

CREATE POLICY ae_auth_insert ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ae_admin_select ON public.analytics_events
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC;
REVOKE ALL ON TABLE public.analytics_events FROM anon;
REVOKE ALL ON TABLE public.analytics_events FROM authenticated;
GRANT INSERT ON TABLE public.analytics_events TO anon, authenticated;
GRANT SELECT ON TABLE public.analytics_events TO authenticated;
GRANT ALL ON TABLE public.analytics_events TO service_role;
