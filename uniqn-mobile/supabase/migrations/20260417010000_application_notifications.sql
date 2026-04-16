-- =============================================================================
-- Migration: Application 도메인 알림 트리거 (Firebase 마이그레이션)
-- =============================================================================
-- 목적:
--   Firebase Functions의 onApplicationSubmitted, onApplicationStatusChanged를
--   PostgreSQL trigger로 1:1 재구현.
--
-- 정책:
--   - notifications INSERT만 책임짐. push 발송은 Phase 1 trigger
--     (on_notification_created_send_push)가 자동 처리.
--   - 모든 trigger function은 SECURITY DEFINER + search_path 고정.
--
-- 매핑:
--   onApplicationSubmitted (Firestore onCreate)  → notify_on_application_insert
--   onApplicationStatusChanged (Firestore onUpdate) → notify_on_application_update
-- =============================================================================

-- ============================================================
-- 1. 신규 지원 알림 (applicant → employer)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_application_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
BEGIN
  -- owner_id 조회
  SELECT title, owner_id
  INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  -- 공고 없거나 owner_id 없음 → 스킵 (Firebase 동등 동작)
  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body,
    link, data, priority
  ) VALUES (
    v_owner_id,
    'new_application',
    '📨 새로운 지원자',
    format('%s님이 ''%s''에 지원했습니다.', NEW.applicant_name, COALESCE(v_job_title, '해당 공고')),
    format('/employer/applicants/%s', NEW.job_posting_id),
    jsonb_build_object(
      'applicationId', NEW.id,
      'jobPostingId', NEW.job_posting_id,
      'applicantId', NEW.applicant_id,
      'applicantName', NEW.applicant_name,
      'jobPostingTitle', COALESCE(v_job_title, ''),
      'senderId', NEW.applicant_id
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_application_insert] failed for application % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS application_notify_insert ON public.applications;
CREATE TRIGGER application_notify_insert
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_application_insert();


-- ============================================================
-- 2. 지원 상태 변경 알림 (status / cancellation_request)
--    → applicant에게 발송
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_application_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_label text;
  v_old_cancel_status text;
  v_new_cancel_status text;
  v_rejection_reason text;
BEGIN
  -- 변경 감지: status 또는 cancellation_request.status
  v_old_cancel_status := OLD.cancellation_request ->> 'status';
  v_new_cancel_status := NEW.cancellation_request ->> 'status';

  IF OLD.status = NEW.status
     AND v_old_cancel_status IS NOT DISTINCT FROM v_new_cancel_status THEN
    RETURN NEW;
  END IF;

  -- 공고 정보 조회
  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  v_label := CASE
    WHEN v_job_title IS NULL OR v_job_title = '' THEN '해당 공고'
    ELSE format('''%s''', v_job_title)
  END;

  -- ============ status 전환 ============

  -- applied → confirmed: 지원 확정 (high priority)
  IF OLD.status = 'applied' AND NEW.status = 'confirmed' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'application_confirmed',
      '지원 확정',
      format('%s 지원이 확정되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  -- → cancelled (cancellation_request 승인 외): 확정 취소
  IF OLD.status <> NEW.status
     AND NEW.status = 'cancelled'
     AND COALESCE(v_new_cancel_status, '') <> 'approved' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'confirmation_cancelled',
      '확정 취소',
      format('%s 확정이 취소되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- → rejected: 지원 거절
  IF OLD.status <> NEW.status AND NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'application_rejected',
      '지원 거절',
      format('%s 지원이 거절되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- ============ cancellation_request 전환 ============

  -- → approved: 취소 요청 승인
  IF v_old_cancel_status IS DISTINCT FROM v_new_cancel_status
     AND v_new_cancel_status = 'approved' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'cancellation_approved',
      '취소 요청 승인',
      format('%s 취소 요청이 승인되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- → rejected: 취소 요청 거절 (high priority — 출근 의무)
  IF v_old_cancel_status IS DISTINCT FROM v_new_cancel_status
     AND v_new_cancel_status = 'rejected' THEN
    v_rejection_reason := NEW.cancellation_request ->> 'rejectionReason';
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'cancellation_rejected',
      '취소 요청 거절',
      format(
        '%s 취소 요청이 거절되었습니다.%s',
        v_label,
        CASE WHEN v_rejection_reason IS NULL OR v_rejection_reason = ''
             THEN ''
             ELSE ' 사유: ' || v_rejection_reason
        END
      ),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'rejectionReason', COALESCE(v_rejection_reason, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_application_update] failed for application % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS application_notify_update ON public.applications;
CREATE TRIGGER application_notify_update
AFTER UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_application_update();

COMMENT ON FUNCTION public.notify_on_application_insert() IS
  'Application INSERT 시 employer에게 신규 지원 알림 (Firebase onApplicationSubmitted 대체)';
COMMENT ON FUNCTION public.notify_on_application_update() IS
  'Application status / cancellation_request 변경 시 applicant에게 알림 (Firebase onApplicationStatusChanged 대체)';
