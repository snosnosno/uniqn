-- =============================================================================
-- Migration: employer_applications 알림 트리거
--
-- 트리거 이벤트:
-- 1. INSERT (pending 신청): 신청자에게 접수 알림 + 모든 admin에게 새 신청 알림
-- 2. UPDATE → approved: 신청자에게 승인 알림
-- 3. UPDATE → rejected: 신청자에게 거부 알림
--
-- ⚠️ 타입 문자열 동기화 필수:
-- 이 트리거는 notifications.type에 하드코딩 문자열을 INSERT합니다.
-- src/types/notification.ts의 NotificationType const와 반드시 일치해야 하며,
-- enum 값 변경 시 별도 마이그레이션으로 동기화해야 합니다.
--   NotificationType.EMPLOYER_APP_SUBMITTED      = 'employer_app_submitted'
--   NotificationType.EMPLOYER_APP_APPROVED       = 'employer_app_approved'
--   NotificationType.EMPLOYER_APP_REJECTED       = 'employer_app_rejected'
--   NotificationType.NEW_EMPLOYER_APPLICATION    = 'new_employer_application'
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_employer_application_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- INSERT: 새 pending 신청
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- 신청자에게 접수 알림
    INSERT INTO notifications (recipient_id, type, category, title, body, link, is_read, priority, created_at)
    VALUES (
      NEW.user_id,
      'employer_app_submitted',
      'system',
      '구인자 신청 접수',
      '구인자 등록 신청이 접수되었습니다. 평균 1-2시간 내 검토 후 결과를 알려드립니다.',
      '/employer-application-status',
      false,
      'normal',
      now()
    );

    -- 모든 admin에게 새 신청 알림
    INSERT INTO notifications (recipient_id, type, category, title, body, link, data, is_read, priority, created_at)
    SELECT
      u.id,
      'new_employer_application',
      'admin',
      '📋 새 구인자 신청',
      '새로운 구인자 등록 신청이 접수되었습니다.',
      '/admin/employer-applications/' || NEW.id,
      jsonb_build_object('applicationId', NEW.id, 'userId', NEW.user_id),
      false,
      'high',
      now()
    FROM users u
    WHERE u.role = 'admin';

  -- UPDATE → approved
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (recipient_id, type, category, title, body, link, is_read, priority, created_at)
    VALUES (
      NEW.user_id,
      'employer_app_approved',
      'system',
      '🎉 구인자 신청 승인',
      '구인자 등록 신청이 승인되었습니다. 지금 바로 공고를 등록해보세요!',
      '/employer-application-status',
      false,
      'high',
      now()
    );

  -- UPDATE → rejected
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (recipient_id, type, category, title, body, link, data, is_read, priority, created_at)
    VALUES (
      NEW.user_id,
      'employer_app_rejected',
      'system',
      '구인자 신청 거부',
      '구인자 신청이 거부되었습니다.' || CASE WHEN NEW.rejection_category IS NOT NULL THEN ' 사유: ' || NEW.rejection_category ELSE '' END,
      '/employer-application-status',
      jsonb_build_object(
        'rejectionCategory', NEW.rejection_category,
        'rejectionReason', NEW.rejection_reason
      ),
      false,
      'normal',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER employer_application_notification_trigger
  AFTER INSERT OR UPDATE ON public.employer_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_employer_application_change();
