-- =============================================================================
-- users.identity_verified 컬럼 가드 트리거 — 셀프 승격 차단
-- =============================================================================
-- 배경(보안 리뷰 HIGH): users_update RLS가 자기 행 UPDATE를 허용하고 WITH CHECK·
--   컬럼 제약이 없어, 로그인 유저가 PostgREST로 자신의 identity_verified=true를
--   직접 써서 본인인증 게이트(20260725020000 지원 게이트·20260725190000 구인자
--   신청/승인 게이트)를 전면 우회할 수 있었다. role 컬럼은 prevent_role_escalation
--   트리거가 지키지만 identity_verified는 무방비였다.
-- 해결: prevent_role_self_escalation과 동일 패턴의 BEFORE UPDATE 컬럼 가드.
--   허용 경로: ①값 무변경(전체 row 에코 UPDATE 무해) ②auth.uid() 없음
--   (직접 SQL·마이그레이션·service_role Edge Function verify-and-save-portone-profile —
--   service_role JWT는 sub가 없어 auth.uid()=NULL) ③admin JWT.
--   그 외(일반 authenticated 셀프/타인)는 차단.
-- parity: 함수 180 = 179 + prevent_identity_flag_self_update 1 — 가드 테스트 동시 갱신.

CREATE OR REPLACE FUNCTION public.prevent_identity_flag_self_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.identity_verified IS NOT DISTINCT FROM NEW.identity_verified
     AND OLD.identity_verified_at IS NOT DISTINCT FROM NEW.identity_verified_at THEN
    RETURN NEW;
  END IF;
  -- 직접 SQL·시드·service_role(EF) — JWT sub 부재 = 신뢰 컨텍스트
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'IDENTITY_FLAG_CHANGE_DENIED: 본인인증 상태는 서버 검증을 통해서만 변경할 수 있습니다';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_identity_flag_self_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_identity_flag_self_update() FROM anon;

DROP TRIGGER IF EXISTS prevent_identity_flag_escalation ON public.users;
CREATE TRIGGER prevent_identity_flag_escalation
  BEFORE UPDATE OF identity_verified, identity_verified_at ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_identity_flag_self_update();
