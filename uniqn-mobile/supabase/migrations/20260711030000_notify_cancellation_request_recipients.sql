-- =============================================================================
-- 취소요청 알림 수신자 확장 — fn_notify_cancellation_request
-- =============================================================================
-- 배경: 유저플로우 감사(2026-07-10) P1#10 / 클러스터 E.
--   prod 실측(2026-07-11): 트리거는 존재하나 owner 1명에게만 발송.
--   워크스페이스 멤버·공고 협업자는 당일 임박 취소 요청을 알 수 없다.
--   → "신설"이 아니라 **수신자 확장**이다.
--
-- 변경:
--   수신자 = owner ∪ 워크스페이스 멤버 ∪ 공고 협업자 (UNION dedup).
--   신청자 본인 제외(IS DISTINCT FROM), NULL 수신자 제외(고아 공고 안전).
--   문구·type·category·priority·data 페이로드는 기존과 동일.
--
-- 원본: 2026-07-11 prod pg_get_functiondef 실측 본문.
--   멤버십 판정은 prod is_workspace_member(workspaces.owner_id ∪
--   workspace_members)·is_posting_collaborator(job_posting_collaborators)와
--   동일 테이블 기준. workspaces.owner_id 는 job_postings.owner_id 와
--   다를 수 있어 워크스페이스 owner 도 수신자에 포함한다.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_cancellation_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner_id uuid;
  v_posting_title text;
  v_workspace_id uuid;
BEGIN
  IF NEW.status::text = 'cancellation_pending' AND OLD.status::text != 'cancellation_pending' THEN
    SELECT owner_id, title, workspace_id INTO v_owner_id, v_posting_title, v_workspace_id
    FROM public.job_postings WHERE id = NEW.job_posting_id;

    -- 수신자: 공고 owner ∪ 워크스페이스 owner/멤버 ∪ 공고 협업자 (dedup, 신청자 제외)
    INSERT INTO public.notifications (recipient_id, type, category, title, body, data, priority)
    SELECT DISTINCT r.uid,
      'cancellation_requested',
      'application'::public.notification_category,
      '취소 요청',
      COALESCE(NEW.applicant_name, '스태프') || '님이 "' || COALESCE(v_posting_title, '공고') || '" 취소를 요청했습니다',
      jsonb_build_object('applicationId', NEW.id, 'jobPostingId', NEW.job_posting_id),
      'high'
    FROM (
      SELECT v_owner_id AS uid
      UNION
      SELECT w.owner_id FROM public.workspaces w
        WHERE v_workspace_id IS NOT NULL AND w.id = v_workspace_id
      UNION
      SELECT wm.user_id FROM public.workspace_members wm
        WHERE v_workspace_id IS NOT NULL AND wm.workspace_id = v_workspace_id
      UNION
      SELECT c.user_id FROM public.job_posting_collaborators c
        WHERE c.job_posting_id = NEW.job_posting_id
    ) r
    WHERE r.uid IS NOT NULL
      AND r.uid IS DISTINCT FROM NEW.applicant_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 트리거 보장(멱등): prod 에는 존재하나 레포/로컬에는 누락된 파리티 구멍
-- (20260420235202 legacy notify 트리거 드롭 후 prod 만 재생성된 발산 — 2026-07-11 실측).
-- db reset 재현성을 위해 여기서 고정한다.
DROP TRIGGER IF EXISTS tr_notify_cancellation_request ON public.applications;
CREATE TRIGGER tr_notify_cancellation_request
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_cancellation_request();
