-- ============================================================
-- 알림 중복 발송 3건 해소 (리뷰·문의·대회공고 승인요청)
--
-- 원인: baseline(20260710000002)이 레거시 notify_on_* 트리거와 QA기 fn_notify_*
--   트리거를 동일 이벤트(AFTER INSERT)에 이중 보존 — 행 2건 INSERT 되고,
--   푸시 statement 트리거(on_notification_created_send_push)가 INSERT 문마다
--   발동하므로 Expo 푸시도 2번 나간다.
--   (archive/20260421030000 정리 당시 "trigger 보유"라며 fn_ 계열을 오보존)
--
-- 유지 기준: 클라이언트 NotificationType 매핑이 존재하는 레거시 타입 쪽 유지
--   (review_received / new_inquiry / tournament_approval_request 리치 본문).
--   fn_ 계열이 넣던 review_created / inquiry_created 는 클라 미매핑 유령 타입.
-- ============================================================

-- 1. 리뷰: fn_notify_review_created 제거 (notify_on_review_insert 가 전담)
DROP TRIGGER IF EXISTS tr_notify_review_created ON public.reviews;
DROP FUNCTION IF EXISTS public.fn_notify_review_created();

-- 2. 문의: fn_notify_inquiry_created 제거 (notify_on_inquiry_insert 가 전담)
DROP TRIGGER IF EXISTS tr_notify_inquiry_created ON public.inquiries;
DROP FUNCTION IF EXISTS public.fn_notify_inquiry_created();

-- 3. 대회공고: INSERT 는 notify_on_job_posting_insert(job_posting_notify_insert)가
--    전담하므로 tr_notify_tournament_approval 을 UPDATE 한정으로 재정의.
--    함수 fn_notify_tournament_approval 은 유지 — 내부의 pending 진입 전이 가드
--    (OLD.approvalStatus IS DISTINCT FROM 'pending')가 재제출(rejected→pending)
--    경로를 정확히 커버한다.
DROP TRIGGER IF EXISTS tr_notify_tournament_approval ON public.job_postings;
CREATE TRIGGER tr_notify_tournament_approval
  AFTER UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_tournament_approval();

-- 4. 기존 중복 데이터 정리
--    미읽음 카운터는 행 트리거 tr_notification_delete_decrement 가 자동 보정
--    (GREATEST(0, ..) 음수 방지 내장).

-- 4-1. 클라 미매핑 유령 타입 전체 삭제
DELETE FROM public.notifications
WHERE type IN ('review_created', 'inquiry_created');

-- 4-2. 대회공고 중복: fn_ 쪽(제목 '토너먼트 승인 요청')만 삭제
--      — 같은 수신자·같은 jobPostingId 의 레거시 짝이 존재할 때만
DELETE FROM public.notifications n
WHERE n.type = 'tournament_approval_request'
  AND n.title = '토너먼트 승인 요청'
  AND EXISTS (
    SELECT 1 FROM public.notifications m
    WHERE m.recipient_id = n.recipient_id
      AND m.type = n.type
      AND m.id <> n.id
      AND m.data->>'jobPostingId' = n.data->>'jobPostingId'
      AND m.title <> '토너먼트 승인 요청'
  );
