-- =============================================================================
-- Migration: JobPosting 도메인 알림 트리거 (Firebase 마이그레이션)
-- =============================================================================
-- 목적:
--   Firebase Functions의 job_posting 관련 알림 4개를 PostgreSQL trigger로 재구현.
--
-- 매핑:
--   onJobPostingUpdated   (Firestore onUpdate jobPostings)  → notify_on_job_posting_update (updated case)
--   onJobPostingClosed    (Firestore onUpdate status=closed) → notify_on_job_posting_update (closed case)
--   onJobPostingCancelled (Firestore onUpdate status=cancelled) → notify_on_job_posting_update (cancelled case)
--   onTournamentPostingCreated (Firestore onCreate postingType=tournament) → notify_on_job_posting_insert
--
-- 정책:
--   - notifications INSERT만 책임짐. push 발송은 Phase 1 trigger가 자동 처리.
--   - 알림 수신 대상 지원자: status IN ('confirmed', 'applied', 'cancellation_pending')
--   - status가 'closed'/'cancelled'로 전환되면 전용 알림만 발송하고
--     'updated' 알림은 스킵 (Firebase는 둘 다 보냈으나, 중복 알림 방지 개선).
--   - Firebase JOB_POSTING_NOTIFICATION_FIELDS 9개 필드 변경 감지:
--     title, location, work_date, work_dates, schedule, compensation,
--     role_catalog, posting_type, status
-- =============================================================================

-- ============================================================
-- 1. job_postings UPDATE: 수정/마감/취소 알림
--    → 지원자들에게 발송
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_job_posting_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_changed_fields text[] := ARRAY[]::text[];
  v_status_transitioned boolean;
  v_notif_type text;
  v_notif_title text;
  v_notif_body text;
  v_notif_link text;
  v_notif_priority text;
  v_notif_data jsonb;
BEGIN
  v_status_transitioned := OLD.status IS DISTINCT FROM NEW.status;

  -- 1) status → 'cancelled' 전환: 공고 취소 알림 (high)
  IF v_status_transitioned AND NEW.status = 'cancelled' THEN
    v_notif_type := 'job_cancelled';
    v_notif_title := '🚫 공고 취소';
    v_notif_body := format('''%s''가 취소되었습니다.', COALESCE(NEW.title, '공고'));
    v_notif_link := '/schedule';
    v_notif_priority := 'high';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'senderId', NEW.owner_id
    );

  -- 2) status → 'closed' 전환: 공고 마감 알림 (normal)
  ELSIF v_status_transitioned AND NEW.status = 'closed' THEN
    v_notif_type := 'job_closed';
    v_notif_title := '📋 공고 마감 안내';
    v_notif_body := format('''%s''가 마감되었습니다.', COALESCE(NEW.title, '공고'));
    v_notif_link := format('/jobs/%s', NEW.id);
    v_notif_priority := 'normal';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'senderId', NEW.owner_id
    );

  -- 3) 기타 필드 변경: 공고 수정 알림 (normal)
  ELSE
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_changed_fields := v_changed_fields || 'title';
    END IF;
    IF OLD.location IS DISTINCT FROM NEW.location THEN
      v_changed_fields := v_changed_fields || 'location';
    END IF;
    IF OLD.work_date IS DISTINCT FROM NEW.work_date THEN
      v_changed_fields := v_changed_fields || 'workDate';
    END IF;
    IF OLD.work_dates IS DISTINCT FROM NEW.work_dates THEN
      v_changed_fields := v_changed_fields || 'workDates';
    END IF;
    IF OLD.schedule IS DISTINCT FROM NEW.schedule THEN
      v_changed_fields := v_changed_fields || 'schedule';
    END IF;
    IF OLD.compensation IS DISTINCT FROM NEW.compensation THEN
      v_changed_fields := v_changed_fields || 'compensation';
    END IF;
    IF OLD.role_catalog IS DISTINCT FROM NEW.role_catalog THEN
      v_changed_fields := v_changed_fields || 'roleCatalog';
    END IF;
    IF OLD.posting_type IS DISTINCT FROM NEW.posting_type THEN
      v_changed_fields := v_changed_fields || 'postingType';
    END IF;
    IF v_status_transitioned THEN
      v_changed_fields := v_changed_fields || 'status';
    END IF;

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    v_notif_type := 'job_updated';
    v_notif_title := '📝 공고 수정 안내';
    v_notif_body := format(
      '''%s'' 공고가 수정되었습니다. 변경 내용을 확인하세요.',
      COALESCE(NEW.title, '공고')
    );
    v_notif_link := format('/jobs/%s', NEW.id);
    v_notif_priority := 'normal';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'changedFields', array_to_string(v_changed_fields, ', '),
      'senderId', NEW.owner_id
    );
  END IF;

  -- 해당 공고에 지원한 활성 지원자 전원에게 알림 INSERT
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    a.applicant_id,
    v_notif_type,
    v_notif_title,
    v_notif_body,
    v_notif_link,
    v_notif_data,
    v_notif_priority
  FROM public.applications a
  WHERE a.job_posting_id = NEW.id
    AND a.status IN ('confirmed', 'applied', 'cancellation_pending');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_update] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_posting_notify_update ON public.job_postings;
CREATE TRIGGER job_posting_notify_update
AFTER UPDATE ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_job_posting_update();


-- ============================================================
-- 2. job_postings INSERT: 대회공고 승인 요청 알림
--    → 모든 관리자에게 발송
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_job_posting_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_employer_name text;
BEGIN
  -- tournament 타입만 처리
  IF NEW.posting_type IS DISTINCT FROM 'tournament' THEN
    RETURN NEW;
  END IF;

  -- 구인자 이름 조회
  SELECT COALESCE(name, '알 수 없음') INTO v_employer_name
  FROM public.users
  WHERE id = NEW.owner_id;

  v_employer_name := COALESCE(v_employer_name, '알 수 없음');

  -- 모든 관리자에게 알림 INSERT
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    u.id,
    'tournament_approval_request',
    '🏆 대회공고 승인 요청',
    format('%s님이 ''%s'' 대회공고 승인을 요청했습니다.', v_employer_name, NEW.title),
    '/admin/tournaments',
    jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobTitle', NEW.title,
      'employerName', v_employer_name,
      'employerId', NEW.owner_id,
      'senderId', NEW.owner_id
    ),
    'high'
  FROM public.users u
  WHERE u.role = 'admin';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_insert] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_posting_notify_insert ON public.job_postings;
CREATE TRIGGER job_posting_notify_insert
AFTER INSERT ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_job_posting_insert();


COMMENT ON FUNCTION public.notify_on_job_posting_update() IS
  'job_postings UPDATE 시 지원자에게 수정/마감/취소 알림 (Firebase onJobPostingUpdated/Closed/Cancelled 통합)';
COMMENT ON FUNCTION public.notify_on_job_posting_insert() IS
  'job_postings INSERT 시 관리자에게 대회공고 승인 요청 알림 (Firebase onTournamentPostingCreated 대체)';
