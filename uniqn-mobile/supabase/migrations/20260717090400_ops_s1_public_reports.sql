-- ops 전면 개방 S1 — B2 공개뷰 신고 경로(D7 스펙: 익명 폼 + 재신고 rate limit).
-- 설계 선택: anon-executable ops SECDEF =2 불변 계약 때문에 신규 anon RPC 를 만들지 않는다.
--   대신 board_reports 선례(직접 RLS INSERT)를 따라 전용 테이블 + BEFORE INSERT 가드 트리거로 구현.
--   트리거(fn_ 접두)는 RPC 로 직접 호출 불가(RETURNS trigger)라 anon 실행 표면이 아니며,
--   =2 카운트 쿼리(proname LIKE 'ops\_%')의 스코프 밖이다.
-- 토큰 처리: 클라가 monitor/view 토큰 원문을 INSERT → 트리거가 대회를 해석해 tournament_id 를
--   바인딩하고 토큰은 8자 prefix 로 절단 저장(capability 토큰 원문 영속 금지).

CREATE TABLE public.ops_public_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.ops_tournaments(id) ON DELETE SET NULL,
  token_kind text NOT NULL CHECK (token_kind IN ('monitor', 'player')),
  token text NOT NULL CHECK (char_length(token) BETWEEN 8 AND 128),
  reason text NOT NULL CHECK (reason IN ('gambling', 'illegal_gambling', 'other')),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  reporter_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ops_public_reports IS
  'ops 공개뷰(모니터/플레이어) 익명 신고(B2/D7). 사유: gambling=사행성 우려, illegal_gambling=불법 도박, other=기타. token 은 트리거가 8자 prefix 로 절단 저장.';

-- rate limit 카운트 쿼리와 1:1 부분 인덱스
CREATE INDEX idx_ops_public_reports_tournament_recent
  ON public.ops_public_reports (tournament_id, created_at);

-- BEFORE INSERT 가드: 토큰 해석(무효 토큰 거부) + 대회당 시간당 5건 rate limit + 필드 캐노니컬라이즈
CREATE OR REPLACE FUNCTION public.fn_ops_public_reports_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tournament_id uuid;
  v_cnt int;
BEGIN
  IF NEW.token_kind = 'monitor' THEN
    SELECT id INTO v_tournament_id
      FROM public.ops_tournaments WHERE monitor_token = NEW.token;
  ELSE
    SELECT tournament_id INTO v_tournament_id
      FROM public.ops_participants WHERE view_token = NEW.token;
  END IF;

  IF v_tournament_id IS NULL THEN
    RAISE EXCEPTION 'OPS_REPORT_TOKEN_INVALID: 유효하지 않은 신고 대상입니다' USING ERRCODE = 'P0001';
  END IF;

  -- 접수 후 재신고 rate limit: 같은 대회 대상 시간당 5건
  SELECT count(*) INTO v_cnt
    FROM public.ops_public_reports
   WHERE tournament_id = v_tournament_id
     AND created_at > now() - interval '1 hour';
  IF v_cnt >= 5 THEN
    RAISE EXCEPTION 'OPS_REPORT_RATE_LIMITED: 신고가 이미 접수되어 처리 중이에요. 잠시 후 다시 시도해주세요'
      USING ERRCODE = 'P0001';
  END IF;

  -- 캐노니컬라이즈: 서버가 결정하는 필드는 입력을 신뢰하지 않는다
  NEW.tournament_id := v_tournament_id;
  NEW.token := left(NEW.token, 8);
  NEW.reporter_id := auth.uid(); -- anon 이면 NULL (위조 reporter_id 차단)
  NEW.status := 'pending';
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_ops_public_reports_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_ops_public_reports_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ops_public_reports_guard() FROM anon;

CREATE TRIGGER trg_ops_public_reports_guard
  BEFORE INSERT ON public.ops_public_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_public_reports_guard();

-- RLS: 익명 INSERT 허용(가드 트리거가 검증), 조회/처리(triage)는 admin 전용
ALTER TABLE public.ops_public_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_public_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY opr_insert ON public.ops_public_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true); -- 검증·rate limit·캐노니컬라이즈는 BEFORE INSERT 트리거가 전담

CREATE POLICY opr_admin_select ON public.ops_public_reports
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY opr_admin_update ON public.ops_public_reports
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- grant 위생: INSERT 만 anon 허용, UPDATE 는 admin triage 용(RLS 게이트), DELETE 없음
REVOKE ALL ON TABLE public.ops_public_reports FROM PUBLIC;
REVOKE ALL ON TABLE public.ops_public_reports FROM anon;
REVOKE ALL ON TABLE public.ops_public_reports FROM authenticated;
GRANT INSERT ON TABLE public.ops_public_reports TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.ops_public_reports TO authenticated;
GRANT ALL ON TABLE public.ops_public_reports TO service_role;
