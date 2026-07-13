-- =============================================================================
-- Migration: Misc 도메인 알림 트리거 (Firebase 마이그레이션)
-- =============================================================================
-- 목적:
--   Firebase Functions의 리뷰/게시판/문의/신고 알림 4개를 PostgreSQL trigger로 재구현.
--
-- 매핑:
--   onReviewCreated   (Firestore onCreate reviews)                 → notify_on_review_insert
--   onBoardActivity   (Firestore onCreate board_comments / locked) → notify_on_board_comment_insert + notify_on_board_post_update
--   onInquiryCreated  (Firestore onCreate inquiries)               → notify_on_inquiry_insert
--   onReportCreated   (Firestore onCreate reports)                 → notify_on_report_insert
--
-- 정책:
--   - notifications INSERT만 책임짐. push 발송은 Phase 1 trigger가 자동 처리.
--   - board: mentioned_user_ids 우선. 게시글/답글 알림은 mention 받은 사람에서 제외하여 중복 방지.
--   - admin 대상 알림(inquiry/report): users.role = 'admin' 전체 조회.
--   - board_posts.id / board_comments.post_id는 text 타입. 나머지는 uuid.
-- =============================================================================

-- ============================================================
-- 1. reviews INSERT: 리뷰 수신 알림 (→ reviewee)
--    블라인드 정책: sentiment/tags는 알림에 노출하지 않음.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_review_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_reviewer_label text;
  v_job_title text;
BEGIN
  IF NEW.reviewee_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_reviewer_label := CASE NEW.reviewer_type
    WHEN 'employer' THEN '구인자'
    WHEN 'staff' THEN '스태프'
    ELSE '상대방'
  END;

  v_job_title := COALESCE(NULLIF(NEW.job_posting_title, ''), '근무');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.reviewee_id,
    'review_received',
    '📋 새로운 평가가 도착했습니다',
    format(
      '"%s" 근무에 대한 %s 평가가 등록되었습니다. 내 평가를 작성하면 확인할 수 있습니다.',
      v_job_title, v_reviewer_label
    ),
    format('/reviews/%s', NEW.work_log_id),
    jsonb_build_object(
      'workLogId', NEW.work_log_id,
      'jobPostingId', NEW.job_posting_id,
      'jobPostingTitle', v_job_title,
      'senderId', NEW.reviewer_id
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_review_insert] failed for review % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS review_notify_insert ON public.reviews;
CREATE TRIGGER review_notify_insert
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_review_insert();


-- ============================================================
-- 2. board_comments INSERT: 댓글/답글/멘션 알림
--    → post author, parent comment author, schedule members, mentioned users
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_board_comment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_post_title text;
  v_post_author_id uuid;
  v_post_board_type text;
  v_parent_author_id uuid;
  v_is_reply boolean;
  v_comment_title text;
  v_comment_body text;
  v_link text;
  v_base_data jsonb;
  v_mentioned_uuids uuid[];
BEGIN
  -- hidden/deleted 상태 댓글은 알림 스킵
  IF NEW.status = 'hidden' OR NEW.status = 'deleted' THEN
    RETURN NEW;
  END IF;
  IF NEW.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.title, p.author_id, p.board_type::text
    INTO v_post_title, v_post_author_id, v_post_board_type
  FROM public.board_posts p
  WHERE p.id = NEW.post_id;

  IF v_post_title IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_reply := NEW.parent_comment_id IS NOT NULL;
  v_comment_title := CASE WHEN v_is_reply THEN '새 답글' ELSE '새 댓글' END;
  v_comment_body := format(
    '%s님이 "%s"에 %s을 남겼습니다.',
    COALESCE(NULLIF(NEW.author_name, ''), '사용자'),
    v_post_title,
    CASE WHEN v_is_reply THEN '답글' ELSE '댓글' END
  );
  v_link := format('/board/post/%s', NEW.post_id);
  v_base_data := jsonb_build_object(
    'postId', NEW.post_id,
    'boardTitle', v_post_title,
    'boardType', COALESCE(v_post_board_type, ''),
    'commentId', NEW.id,
    'senderId', NEW.author_id
  );

  -- 부모 댓글 작성자 (답글인 경우)
  IF v_is_reply THEN
    SELECT author_id INTO v_parent_author_id
    FROM public.board_comments
    WHERE id = NEW.parent_comment_id;
  END IF;

  -- mentioned_user_ids → uuid[] 변환 (text[] 저장이므로)
  v_mentioned_uuids := ARRAY(
    SELECT u::uuid
    FROM unnest(COALESCE(NEW.mentioned_user_ids, ARRAY[]::text[])) AS u
    WHERE u ~ '^[0-9a-fA-F-]{36}$'
  );

  -- ① mention 알림 먼저 (high priority, 댓글/답글 알림보다 우선)
  --    schedule 보드: 멤버십 또는 게시글 작성자만 mention 가능
  --    일반 보드: 게시글 작성자 또는 기존 active 댓글 작성자만 mention 가능
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    m.recipient_id,
    'board_mention',
    '멘션',
    format(
      '%s님이 "%s"에서 회원님을 멘션했습니다.',
      COALESCE(NULLIF(NEW.author_name, ''), '사용자'),
      v_post_title
    ),
    v_link,
    v_base_data,
    'high'
  FROM unnest(v_mentioned_uuids) AS m(recipient_id)
  WHERE m.recipient_id <> NEW.author_id
    AND (
      (v_post_board_type = 'schedule' AND (
        m.recipient_id = v_post_author_id
        OR EXISTS (
          SELECT 1 FROM public.board_memberships bm
          WHERE bm.post_id = NEW.post_id
            AND bm.user_id = m.recipient_id
            AND bm.can_read = true
        )
      ))
      OR (v_post_board_type IS DISTINCT FROM 'schedule' AND (
        m.recipient_id = v_post_author_id
        OR EXISTS (
          SELECT 1 FROM public.board_comments bc
          WHERE bc.post_id = NEW.post_id
            AND bc.author_id = m.recipient_id
            AND bc.status = 'active'
        )
      ))
    );

  -- ② 댓글/답글 수신 대상 수집 (멘션 받은 사람 제외)
  WITH recipients AS (
    -- 답글: 부모 댓글 작성자 + 게시글 작성자
    SELECT v_parent_author_id AS recipient_id WHERE v_is_reply AND v_parent_author_id IS NOT NULL
    UNION
    SELECT v_post_author_id WHERE v_post_author_id IS NOT NULL
    UNION
    -- schedule 보드: 멤버 전체
    SELECT bm.user_id
    FROM public.board_memberships bm
    WHERE v_post_board_type = 'schedule'
      AND bm.post_id = NEW.post_id
      AND bm.can_read = true
  )
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    r.recipient_id,
    CASE WHEN v_is_reply THEN 'board_reply' ELSE 'board_comment' END,
    v_comment_title,
    v_comment_body,
    v_link,
    v_base_data,
    'normal'
  FROM recipients r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id <> NEW.author_id
    AND r.recipient_id <> ALL(COALESCE(v_mentioned_uuids, ARRAY[]::uuid[]));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_board_comment_insert] failed for comment % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS board_comment_notify_insert ON public.board_comments;
CREATE TRIGGER board_comment_notify_insert
AFTER INSERT ON public.board_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_board_comment_insert();


-- ============================================================
-- 3. board_posts UPDATE: 게시글 잠금 알림
--    → 게시글 작성자 + 댓글 작성자들 + (schedule 보드) 멤버
--    단, 잠금을 실행한 사람은 제외
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_board_post_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_id uuid;
  v_title text;
BEGIN
  -- is_locked false→true 전환만 감지
  IF OLD.is_locked = NEW.is_locked OR NEW.is_locked IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_title := COALESCE(NULLIF(NEW.title, ''), '게시글');

  -- locked_by가 uuid 문자열이면 파싱, 아니면 author_id 사용
  IF NEW.locked_by IS NOT NULL AND NEW.locked_by ~ '^[0-9a-fA-F-]{36}$' THEN
    v_actor_id := NEW.locked_by::uuid;
  ELSE
    v_actor_id := NEW.author_id;
  END IF;

  WITH recipients AS (
    SELECT NEW.author_id AS recipient_id WHERE NEW.author_id IS NOT NULL
    UNION
    SELECT bc.author_id
    FROM public.board_comments bc
    WHERE bc.post_id = NEW.id
      AND bc.author_id IS NOT NULL
    UNION
    SELECT bm.user_id
    FROM public.board_memberships bm
    WHERE NEW.board_type::text = 'schedule'
      AND bm.post_id = NEW.id
      AND bm.can_read = true
  )
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    r.recipient_id,
    'board_locked',
    '게시글 잠금',
    format('"%s" 글이 잠겼습니다.', v_title),
    format('/board/post/%s', NEW.id),
    jsonb_build_object(
      'postId', NEW.id,
      'boardTitle', v_title,
      'boardType', NEW.board_type::text,
      'senderId', v_actor_id
    ),
    'high'
  FROM recipients r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id IS DISTINCT FROM v_actor_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_board_post_update] failed for post % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS board_post_notify_update ON public.board_posts;
CREATE TRIGGER board_post_notify_update
AFTER UPDATE ON public.board_posts
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_board_post_update();


-- ============================================================
-- 4. inquiries INSERT: 문의 접수 → 전체 관리자 알림
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_inquiry_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_name text;
BEGIN
  v_user_name := COALESCE(NULLIF(NEW.user_name, ''), '사용자');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    u.id,
    'new_inquiry',
    '💬 새로운 문의 접수',
    format('%s님의 문의: %s', v_user_name, NEW.subject),
    format('/admin/inquiries/%s', NEW.id),
    jsonb_build_object(
      'inquiryId', NEW.id,
      'category', COALESCE(NEW.category, ''),
      'subject', NEW.subject,
      'userName', v_user_name,
      'senderId', NEW.user_id
    ),
    'normal'
  FROM public.users u
  WHERE u.role = 'admin';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_inquiry_insert] failed for inquiry % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inquiry_notify_insert ON public.inquiries;
CREATE TRIGGER inquiry_notify_insert
AFTER INSERT ON public.inquiries
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_inquiry_insert();


-- ============================================================
-- 5. reports INSERT: 신고 접수 → 전체 관리자 알림 (high)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_report_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_type_label text;
BEGIN
  -- 신고 유형 라벨 매핑 (Firebase REPORT_TYPE_LABELS 1:1 이전)
  v_type_label := CASE NEW.type
    WHEN 'tardiness' THEN '지각'
    WHEN 'negligence' THEN '근무태만'
    WHEN 'no_show' THEN '노쇼'
    WHEN 'early_leave' THEN '무단 조퇴'
    WHEN 'inappropriate' THEN '부적절한 행동'
    WHEN 'dress_code' THEN '복장 불량'
    WHEN 'communication' THEN '소통 문제'
    WHEN 'false_posting' THEN '허위 공고'
    WHEN 'employer_negligence' THEN '근무 관리 태만'
    WHEN 'unfair_treatment' THEN '부당한 대우'
    WHEN 'inappropriate_behavior' THEN '부적절한 행동'
    WHEN 'other' THEN '기타'
    ELSE NEW.type
  END;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    u.id,
    'new_report',
    '🚨 새로운 신고 접수',
    format(
      '%s님이 %s님을 신고했습니다. (%s)',
      NEW.reporter_name, NEW.target_name, v_type_label
    ),
    format('/admin/reports/%s', NEW.id),
    jsonb_build_object(
      'reportId', NEW.id,
      'reportType', NEW.type,
      'reporterName', NEW.reporter_name,
      'targetName', NEW.target_name,
      'severity', COALESCE(NEW.severity::text, 'medium'),
      'senderId', NEW.reporter_id
    ),
    'high'
  FROM public.users u
  WHERE u.role = 'admin';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_report_insert] failed for report % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS report_notify_insert ON public.reports;
CREATE TRIGGER report_notify_insert
AFTER INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_report_insert();


COMMENT ON FUNCTION public.notify_on_review_insert() IS
  'reviews INSERT 시 reviewee에게 리뷰 수신 알림 (Firebase onReviewCreated 대체). 블라인드 정책 유지.';
COMMENT ON FUNCTION public.notify_on_board_comment_insert() IS
  'board_comments INSERT 시 게시글/부모 댓글 작성자/schedule 멤버/멘션 대상에게 알림 (Firebase onBoardCommentCreated 대체)';
COMMENT ON FUNCTION public.notify_on_board_post_update() IS
  'board_posts UPDATE 시 잠금 전환되면 참여자에게 잠금 알림 (Firebase onBoardPostLocked 대체)';
COMMENT ON FUNCTION public.notify_on_inquiry_insert() IS
  'inquiries INSERT 시 전체 관리자에게 문의 접수 알림 (Firebase onInquiryCreated 대체)';
COMMENT ON FUNCTION public.notify_on_report_insert() IS
  'reports INSERT 시 전체 관리자에게 신고 접수 알림 (Firebase onReportCreated 대체)';
