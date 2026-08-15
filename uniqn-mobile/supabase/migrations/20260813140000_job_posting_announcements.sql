-- ============================================================================
-- S3-2 · 확정 스태프 일괄 공지 (발송 이력 + RPC)
-- ============================================================================
-- 사장이 확정된 스태프 전원에게 한 번에 알린다("내일 복장은 검은 상의입니다").
-- 지금은 방법이 없어 한 명씩 전화하거나, 아예 전달을 포기하고 현장에서 말한다.
--
-- 🔑 **왜 이력 테이블이 먼저인가**
--   알림은 받는 사람 것이고, 지운 사람에게선 사라진다. 사장 쪽에는 "내가 무엇을 언제
--   몇 명에게 보냈는지"가 아무 데도 남지 않는다. 그러면 같은 공지를 두 번 보내거나
--   ("보냈던가?"), 안 보낸 걸 보냈다고 착각한다. 이력이 없으면 이 기능은 쓸수록 불안해진다.
--
-- 🚨 **단일 INSERT 문이어야 하는 이유 (성능이 아니라 구조다)**
--   푸시 트리거 `on_notification_created_send_push` 는 **STATEMENT 레벨**이다
--   (REFERENCING NEW TABLE ... FOR EACH STATEMENT). 스태프 N명에게 루프로 INSERT 하면
--   푸시 Edge Function 이 **N번** 호출된다. 마이그 20260809150000 이 바로 이 안티패턴을
--   교정한 선례다. 그래서 아래 INSERT ... SELECT 는 반드시 한 문장으로 유지해야 한다.
--
-- ⚠️ 기존 Edge Function `send-job-posting-announcement` 는 같은 일을 하지만
--    **호출부가 0곳인 고아 코드**이고 이력을 남기지 않는다(자체 주석이 "추적 테이블 없음"이라
--    인정한다). 이 RPC 가 그 자리를 대신한다 — 알림과 이력을 **한 트랜잭션**에 쓰기 때문이다.
--    EF 제거는 별도 작업으로 분리한다(config.toml 등록 해제 + 배포 동반이라 범위가 다르다).
-- ============================================================================

-- ------------------------------------------------------------
-- 1. 발송 이력
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_posting_announcements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id   uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  body             text NOT NULL,
  -- 보낸 시점의 수신자 수. 나중에 스태프가 빠져도 "그때 몇 명에게 갔는지"는 변하면 안 된다.
  recipient_count  integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_posting_announcements IS
  'S3-2 공고 일괄 공지 발송 이력. 쓰기는 send_job_posting_announcement RPC 전용(INSERT 정책 없음).';

CREATE INDEX IF NOT EXISTS job_posting_announcements_posting_idx
  ON public.job_posting_announcements (job_posting_id, created_at DESC);

ALTER TABLE public.job_posting_announcements ENABLE ROW LEVEL SECURITY;

-- 읽기: 그 공고를 관리할 수 있는 사람. 기존 관리 권한 축과 같게 맞춘다 —
-- 여기만 좁으면 협업자가 "내가 보낸 공지"를 못 보고, 넓으면 남의 운영 기록이 샌다.
DROP POLICY IF EXISTS jpa_select_manager ON public.job_posting_announcements;
CREATE POLICY jpa_select_manager ON public.job_posting_announcements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.job_postings jp
        JOIN public.workspaces w ON w.id = jp.workspace_id
       WHERE jp.id = job_posting_announcements.job_posting_id
         AND (
           -- `(SELECT auth.uid())` 은 스타일이 아니라 성능 계약이다(20260809140000 RLS 비용 위생):
           -- 맨 `auth.uid()` 는 행마다 재평가되고, 감싸면 initPlan 으로 한 번만 계산된다.
              w.owner_id = (SELECT auth.uid())
           OR public.is_workspace_member(jp.workspace_id, (SELECT auth.uid()))
           OR public.is_posting_collaborator(jp.id, (SELECT auth.uid()))
         )
    )
  );

-- INSERT/UPDATE/DELETE 정책은 **의도적으로 없다** — 이력은 고쳐 쓰는 물건이 아니다.
-- 쓰기는 아래 SECDEF RPC 만 할 수 있다(job_posting_collaborator_audit 과 같은 형태).

-- ------------------------------------------------------------
-- 2. 발송 RPC
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_job_posting_announcement(
  p_job_posting_id uuid,
  p_title text,
  p_body text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_owner_id      uuid;
  v_workspace_id  uuid;
  v_title         text := btrim(coalesce(p_title, ''));
  v_body          text := btrim(coalesce(p_body, ''));
  v_recipients    integer := 0;
  v_recent        integer;
  v_announcement  uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF v_title = '' OR v_body = '' THEN
    RAISE EXCEPTION 'VALIDATION_FAILED: 제목과 내용을 모두 입력해주세요';
  END IF;
  -- 한도는 Edge Function(send-job-posting-announcement)이 쓰던 값과 같게 맞춘다.
  IF char_length(v_title) > 50 THEN
    RAISE EXCEPTION 'VALIDATION_FAILED: 제목은 50자 이내로 입력해주세요';
  END IF;
  IF char_length(v_body) > 500 THEN
    RAISE EXCEPTION 'VALIDATION_FAILED: 내용은 500자 이내로 입력해주세요';
  END IF;

  SELECT jp.owner_id, jp.workspace_id
    INTO v_owner_id, v_workspace_id
    FROM public.job_postings jp
   WHERE jp.id = p_job_posting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: 공고를 찾을 수 없습니다';
  END IF;

  IF NOT (
       v_owner_id = v_caller
    OR public.is_workspace_member(v_workspace_id, v_caller)
    OR public.is_posting_collaborator(p_job_posting_id, v_caller)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 이 공고에 공지를 보낼 권한이 없습니다';
  END IF;

  -- 연타 방어. 알림은 되돌릴 수 없다 — 잘못 두 번 보내면 스태프 전원의 알림함에 남는다.
  -- 시간 창을 짧게 둬서 "실수로 두 번 누름"만 막고 정상적인 후속 공지는 통과시킨다.
  --
  -- 🚨 잠금이 **먼저** 와야 한다. SELECT count → INSERT 는 READ COMMITTED 에서
  --    동시 두 호출이 **둘 다 0 을 읽어** 나란히 통과한다. 그리고 막으려던 "연타" 의 실체가
  --    바로 그 동시 케이스다(네트워크가 끊길 때 사용자는 빠르게 두 번 누른다).
  --    공고 단위 트랜잭션 잠금이라 다른 공고의 발송은 막지 않고, 커밋/롤백 시 자동 해제된다.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_job_posting_id::text, 0));

  SELECT count(*)::integer INTO v_recent
    FROM public.job_posting_announcements a
   WHERE a.job_posting_id = p_job_posting_id
     AND a.created_at > now() - INTERVAL '60 seconds';

  IF v_recent > 0 THEN
    RAISE EXCEPTION 'RATE_LIMITED: 방금 공지를 보냈어요. 잠시 후 다시 시도해주세요';
  END IF;

  -- 이력을 먼저 남긴다. 알림 INSERT 가 실패하면 트랜잭션 전체가 롤백되므로
  -- "이력은 있는데 알림은 안 간" 상태는 생기지 않는다.
  INSERT INTO public.job_posting_announcements (job_posting_id, sender_id, title, body)
  VALUES (p_job_posting_id, v_caller, v_title, v_body)
  RETURNING id INTO v_announcement;

  -- 🚨 단일 문장 팬아웃 — 루프로 바꾸면 STATEMENT 트리거가 수신자 수만큼 푸시 EF 를 부른다.
  --    수신자 = 이 공고의 활성 근무 배정(취소·노쇼 제외). 같은 사람이 여러 날 배정돼 있어도
  --    DISTINCT 로 한 번만 받는다 — 안 그러면 3일치 배정된 스태프가 같은 공지를 3번 받는다.
  WITH recipients AS (
    SELECT DISTINCT wl.staff_id
      FROM public.work_logs wl
     WHERE wl.job_posting_id = p_job_posting_id
       AND wl.status NOT IN ('cancelled', 'no_show')
       AND wl.no_show_at IS NULL
       AND wl.staff_id IS NOT NULL
  )
  INSERT INTO public.notifications (
    recipient_id, type, category, title, body, link, data, priority
  )
  SELECT
    r.staff_id,
    'posting_announcement',
    'job'::public.notification_category,
    v_title,
    v_body,
    format('/jobs/%s', p_job_posting_id),
    jsonb_build_object(
      'jobPostingId',   p_job_posting_id,
      'announcementId', v_announcement
    ),
    'high'
  FROM recipients r;

  GET DIAGNOSTICS v_recipients = ROW_COUNT;

  UPDATE public.job_posting_announcements
     SET recipient_count = v_recipients
   WHERE id = v_announcement;

  RETURN v_recipients;
END;
$$;

COMMENT ON FUNCTION public.send_job_posting_announcement(uuid, text, text) IS
  'S3-2: 공고의 확정 스태프 전원에게 공지를 보내고 발송 이력을 남긴다. '
  '알림 INSERT 는 단일 문장이어야 한다(STATEMENT 레벨 푸시 트리거가 문당 1회 발화). '
  '수신자 수를 반환한다.';

REVOKE ALL ON FUNCTION public.send_job_posting_announcement(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_job_posting_announcement(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_job_posting_announcement(uuid, text, text) TO authenticated;
