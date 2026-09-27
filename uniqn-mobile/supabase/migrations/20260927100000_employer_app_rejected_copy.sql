-- ============================================================================
-- 구인자 신청 거절 알림 문구 정리 (2026-09-27)
-- ============================================================================
-- 배경(UX 흐름 감사 P3):
--   ① 거절 알림 본문에 사유가 **영어 코드 그대로** 찍혔다 — "구인자 신청이 거부되었습니다. 사유: dummy".
--      rejection_category 는 CHECK 로 4값(duplicate/dummy/identity_mismatch/other)만 허용하므로
--      같은 4값을 한글 라벨로 바꿔 붙인다. 라벨은 신청자 화면(app/(app)/employer-application-status.tsx
--      CATEGORY_LABELS)과 같은 문자열이어야 한다.
--   ② 같은 결과를 화면은 '거절', 알림은 '거부'로 불렀다 — 앱 전역 용어('확정'/'거절')에 맞춰 '거절'로 통일.
--
-- 범위: notify_employer_application_change() 의 rejected 분기 title/body 두 곳만.
--   함수 본문 나머지는 prod 원문(2026-09-27 pg_get_functiondef 실측, md5(prosrc)=29219aa8…)과 동일하다.
--   트리거 정의는 건드리지 않는다(CREATE OR REPLACE 는 기존 트리거 바인딩을 유지한다).
--   이미 쌓인 알림 행은 고치지 않는다 — 과거 이력이고, 재작성하면 읽음 상태·정렬이 흔들린다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_employer_application_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      '구인자 신청 거절',
      '구인자 신청이 거절되었습니다.' || CASE NEW.rejection_category
        WHEN 'duplicate' THEN ' 사유: 중복 계정'
        WHEN 'dummy' THEN ' 사유: 실사용 확인이 어려운 계정'
        WHEN 'identity_mismatch' THEN ' 사유: 본인인증 불일치'
        WHEN 'other' THEN ' 사유: 기타'
        ELSE ''
      END,
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
$function$;
