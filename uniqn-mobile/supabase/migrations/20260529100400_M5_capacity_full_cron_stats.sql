-- M5 (공고 자동마감 Approach B): capacity_full enum-completeness 보강 (/review P1+P2)
--
-- /review 적발: capacity_full 가 "live(모집중 계열)" 상태인데 아래 함수들이 'active'
--   하드코딩이라 누락 → 정원 도달(capacity_full) 공고가:
--   [P1] 만료 cron 2종에서 제외 → 근무일 지나도 영원히 안 닫힘(zombie)
--   [P1] 만료 알림(소유자)에서 제외
--   [P2] get_job_posting_stats total/active 집계에서 누락(과소집계)
-- FIX: 'active' → IN ('active','capacity_full'). 본문 나머지는 prod 현행 정의 100% 보존.

-- ── 1) 고정공고 만료 cron: capacity_full 도 만료 대상 ──
CREATE OR REPLACE FUNCTION public.fn_expire_fixed_postings_batch()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_updated_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.job_postings
    SET
      status = 'closed',
      closed_at = now(),
      closed_reason = 'expired',
      updated_at = now()
    WHERE posting_type = 'fixed'
      AND status IN ('active', 'capacity_full')
      AND fixed_config IS NOT NULL
      AND (fixed_config ->> 'expiresAt') IS NOT NULL
      AND (fixed_config ->> 'expiresAt')::timestamptz < now()
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM expired;

  IF v_updated_count > 0 THEN
    RAISE NOTICE '[expire_fixed_postings_batch] closed % postings', v_updated_count;
  END IF;

  RETURN v_updated_count;
END;
$function$;

-- ── 2) 근무일 경과 만료 cron: capacity_full 도 만료 대상 ──
CREATE OR REPLACE FUNCTION public.fn_expire_by_last_work_date()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cutoff date;
  v_updated_count integer;
BEGIN
  -- KST 오늘 - 2일 기준. Firebase 구현과 동일.
  v_cutoff := ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date;

  WITH expired AS (
    UPDATE public.job_postings
    SET
      status = 'closed',
      closed_at = now(),
      closed_reason = 'expired_by_work_date',
      updated_at = now()
    WHERE posting_type IN ('regular', 'urgent', 'tournament')
      AND status IN ('active', 'capacity_full')
      AND last_work_date IS NOT NULL
      AND last_work_date <= v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM expired;

  IF v_updated_count > 0 THEN
    RAISE NOTICE '[expire_by_last_work_date] closed % postings (cutoff=%)', v_updated_count, v_cutoff;
  END IF;

  RETURN v_updated_count;
END;
$function$;

-- ── 3) 소유자 만료 알림: capacity_full→closed 전이도 알림 ──
CREATE OR REPLACE FUNCTION public.notify_on_job_posting_owner_expired()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_notif_type text;
  v_notif_title text;
  v_notif_body text;
BEGIN
  -- active/capacity_full → closed + closed_reason 조건만 처리
  IF NOT (OLD.status IN ('active', 'capacity_full') AND NEW.status = 'closed') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.closed_reason = 'expired' AND NEW.posting_type = 'fixed' THEN
    v_notif_type := 'fixed_posting_expired';
    v_notif_title := '⏰ 고정 공고 만료';
    v_notif_body := format('''%s'' 고정 공고가 만료되어 자동 마감되었습니다.', COALESCE(NEW.title, '공고'));
  ELSIF NEW.closed_reason = 'expired_by_work_date' THEN
    v_notif_type := 'work_date_expired';
    v_notif_title := '⏰ 공고 자동 마감';
    v_notif_body := format('''%s'' 공고가 근무일 경과로 자동 마감되었습니다.', COALESCE(NEW.title, '공고'));
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.owner_id,
    v_notif_type,
    v_notif_title,
    v_notif_body,
    format('/jobs/%s', NEW.id),
    jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'closedReason', NEW.closed_reason,
      'postingType', NEW.posting_type::text
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_owner_expired] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- ── 4) 구인자 통계: capacity_full 을 active 계열로 집계 + total 누락 방지 ──
CREATE OR REPLACE FUNCTION public.get_job_posting_stats(p_owner_id uuid)
 RETURNS TABLE(total bigint, active bigint, closed bigint, cancelled bigint, total_applications bigint, total_views bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
    count(CASE WHEN jp.status IN ('active', 'capacity_full') THEN 1 END)::bigint,
    count(CASE WHEN jp.status = 'closed' THEN 1 END)::bigint,
    count(CASE WHEN jp.status = 'cancelled' THEN 1 END)::bigint,
    coalesce(sum((jp.stats->>'totalApplicants')::int), 0)::bigint,
    coalesce(sum(jp.view_count), 0)::bigint
  FROM public.job_postings jp
  WHERE jp.owner_id = p_owner_id
    AND jp.status IN ('active', 'capacity_full', 'closed', 'cancelled');
END;
$function$;
