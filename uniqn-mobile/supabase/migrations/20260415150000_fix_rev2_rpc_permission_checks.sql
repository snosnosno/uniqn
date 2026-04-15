-- ============================================================================
-- REV-2 P1: SECURITY DEFINER RPC 권한 체크 보강
-- 출처: docs/qa/2026-04-14/REVIEW-2026-04-15.md §2.2 (line 101-129)
-- 전제: 20260414130500_recover_stats_increment_rpcs.sql 이후
-- 전략:
--   1) increment_view_count             : 반-셀프인플레 가드 (owner 본인 no-op)
--   2) increment_announcement_view_count: 반-셀프인플레 가드 (author 본인 no-op)
--   3) increment_template_usage         : owner/admin 전용 가드 (RAISE)
--   4) get_job_posting_stats            : self/admin 전용 가드 (RAISE)
-- ============================================================================

-- 1. increment_view_count -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_view_count(posting_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증된 사용자만 조회수를 증가시킬 수 있습니다';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.job_postings
  WHERE id = posting_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 소유자 본인은 셀프인플레 차단: silent no-op
  IF v_owner_id IS NOT NULL AND v_owner_id = auth.uid() THEN
    RETURN;
  END IF;

  UPDATE public.job_postings
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = posting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO authenticated;

-- 2. increment_announcement_view_count ---------------------------------------
-- 주의: announcements RLS UPDATE는 admin 전용 → 이 RPC가 비-admin 유일 경로. revoke 불가.
CREATE OR REPLACE FUNCTION public.increment_announcement_view_count(p_announcement_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_author_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증된 사용자만 조회수를 증가시킬 수 있습니다';
  END IF;

  SELECT author_id INTO v_author_id
  FROM public.announcements
  WHERE id = p_announcement_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 작성자 본인은 셀프인플레 차단: silent no-op
  IF v_author_id IS NOT NULL AND v_author_id = auth.uid() THEN
    RETURN;
  END IF;

  UPDATE public.announcements
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_announcement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_announcement_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_announcement_view_count(uuid) TO authenticated;

-- 3. increment_template_usage ------------------------------------------------
-- 템플릿은 per-user 프라이빗 → 본인/관리자만 카운트 가능. ROW_COUNT 0 이면 RAISE.
CREATE OR REPLACE FUNCTION public.increment_template_usage(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_updated integer;
  v_exists  boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증된 사용자만 템플릿 사용 횟수를 증가시킬 수 있습니다';
  END IF;

  UPDATE public.job_posting_templates
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = p_template_id
    AND (user_id = auth.uid() OR public.is_admin());

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    -- 404 vs 403 구분: 존재하지 않는 템플릿은 silent return (이전 동작 보존)
    SELECT EXISTS (SELECT 1 FROM public.job_posting_templates WHERE id = p_template_id)
      INTO v_exists;

    IF NOT v_exists THEN
      RETURN;
    END IF;

    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 템플릿 사용 횟수를 증가시킬 수 있습니다';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_template_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_template_usage(uuid) TO authenticated;

-- 4. get_job_posting_stats ---------------------------------------------------
-- BI 유출 방지: self/admin 게이트. plpgsql 변환 + jp 별칭 + 명시적 ::bigint 캐스트.
CREATE OR REPLACE FUNCTION public.get_job_posting_stats(p_owner_id uuid)
RETURNS TABLE(
  total              bigint,
  active             bigint,
  closed             bigint,
  cancelled          bigint,
  total_applications bigint,
  total_views        bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증된 사용자만 통계를 조회할 수 있습니다';
  END IF;

  IF auth.uid() <> p_owner_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 통계를 조회할 수 있습니다';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint,
    count(*)::bigint FILTER (WHERE jp.status = 'active'),
    count(*)::bigint FILTER (WHERE jp.status = 'closed'),
    count(*)::bigint FILTER (WHERE jp.status = 'cancelled'),
    coalesce(sum((jp.stats->>'totalApplicants')::int), 0)::bigint,
    coalesce(sum(jp.view_count), 0)::bigint
  FROM public.job_postings jp
  WHERE jp.owner_id = p_owner_id
    AND jp.status IN ('active', 'closed', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.get_job_posting_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_posting_stats(uuid) TO authenticated;
