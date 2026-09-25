-- ============================================================================
-- 앱 내 채팅 S4-1 — 차단 · 뮤트 · 신고(증거 스냅샷)
-- ============================================================================
-- 설계(정본): docs/planning/2026-09-24-in-app-chat-design.md §7 · §14-5 · §15(D3·D10·D12)
-- 계획:       docs/planning/2026-09-25-chat-s4-safety-plan.md
--
-- 한 줄: 방 단위 차단(양방향 전송 불가) · 방별 알림 끄기 · 메시지 신고(스냅샷은 **서버가 DB 에서
--        채운다** — 클라가 보낸 본문을 믿지 않는다). 관리자는 스냅샷과 그 안의 사진만 본다.
--
-- 파리티: 함수 +5(chat_set_muted · chat_block · chat_unblock · chat_report_message ·
--         admin_get_report_evidence) · 정책 +1(chat_blocks SELECT) → 243 / 106
--   chat_report_evidence 는 RLS on · 정책 0(deny-all)이라 정책 카운트 불변.
--   재정의(+0): chat_send_message(차단 게이트) · chat_list_conversations(blocked 실값) ·
--               chat_media_can_read(관리자 = 신고 증거 사진만)
--   → 본문은 S1(20260925100000) 원문을 그대로 옮기고 표시한 줄만 바꿨다.
--
-- 권한: 새 RPC 4개는 authenticated 에 연다 — 방 멤버 확인이 있어 방이 없으면 무해하고,
--       안전 기능은 서버 다크(open·send 미부여)와 무관하게 먼저 켜져 있어야 공개 ON 때 빈틈이 없다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 차단 (D10 — 방 단위로 시작. 업장 단위 확장은 우회 신고가 생기면)
-- ----------------------------------------------------------------------------
-- 쪽별 1행(보안 리뷰 M1): 방당 1행이면 가해자가 먼저 막아 두고 피해자의 차단을 무시(no-op)시킨 뒤
-- 스스로 풀어 버릴 수 있다. 쪽마다 따로 두면 각자 자기 차단만 풀 수 있다. 판정은 "행이 하나라도 있으면 차단".
CREATE TABLE public.chat_blocks (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  blocked_by_side text NOT NULL CHECK (blocked_by_side IN ('seeker', 'employer')),
  -- 탈퇴 크론(DELETE FROM users)이 막히지 않게 SET NULL
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, blocked_by_side)
);
CREATE INDEX chat_blocks_created_by_idx ON public.chat_blocks (created_by);

ALTER TABLE public.chat_blocks ENABLE ROW LEVEL SECURITY;

-- 방 멤버는 차단 여부·어느 쪽이 막았는지 본다(입력창 대신 안내 · 막은 쪽에 해제 버튼).
-- 누가(created_by) 막았는지는 컬럼 GRANT 로 가린다 — 구인자 측 개인이 드러나지 않게.
CREATE POLICY chat_blocks_select_member ON public.chat_blocks
  FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT public.chat_my_conversation_ids()));

REVOKE ALL ON public.chat_blocks FROM anon, authenticated;
GRANT SELECT (conversation_id, blocked_by_side, created_at) ON public.chat_blocks TO authenticated;
GRANT ALL ON public.chat_blocks TO service_role;

-- ----------------------------------------------------------------------------
-- 2. 신고 증거 스냅샷 (D12 — 신고 처리 후 1년 보존, 탈퇴와 무관)
-- ----------------------------------------------------------------------------
-- 🔒 reports 컬럼이 아니라 **별도 deny-all 테이블**에 둔다(보안 리뷰 H1 · DB 리뷰 M1).
--   · reports 는 baseline 의 rep_insert(reporter_id = 본인)와 authenticated INSERT/UPDATE 가 열려 있어
--     (prod 실측 09-25) 컬럼이면 클라가 가짜 스냅샷을 넣을 수 있고(→ 관리자에게 위조 증거·관리자 사진
--     열람 확대·삭제 예외 남용), rep_select 로 신고자가 상대(탈퇴자 포함) 원문을 계속 읽는다.
--   · 컬럼 권한으로 가리면 기존 앱의 `select('*')`(관리자 신고 목록)가 42501 로 깨진다(CI E2E 실측) —
--     1.0.6 함대는 OTA 를 못 받으므로 영구히. 그래서 테이블을 분리한다.
--   쓰기 = chat_report_message(SECDEF)·크론뿐 · 읽기 = admin_get_report_evidence(관리자 게이트)뿐.
CREATE TABLE public.chat_report_evidence (
  report_id           uuid PRIMARY KEY REFERENCES public.reports(id) ON DELETE CASCADE,
  -- 탈퇴 크론(DELETE FROM users)이 막히지 않게 SET NULL
  reporter_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reported_message_id uuid NOT NULL,
  snapshot            jsonb NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
-- 같은 신고자가 같은 메시지를 두 번 신고할 수 없다(RPC 사전 확인의 경합을 닫는 최종 판정 — 보안 LOW-5)
CREATE UNIQUE INDEX chat_report_evidence_once
  ON public.chat_report_evidence (reporter_id, reported_message_id);
-- 증거 사진 판정(`snapshot -> 'imagePaths' ? name`)이 객체마다 전체를 훑지 않게(DB 리뷰 L1)
CREATE INDEX chat_report_evidence_image_paths_gin
  ON public.chat_report_evidence USING gin ((snapshot -> 'imagePaths'));

ALTER TABLE public.chat_report_evidence ENABLE ROW LEVEL SECURITY;   -- 정책 0 = deny-all
REVOKE ALL ON public.chat_report_evidence FROM anon, authenticated;
GRANT ALL ON public.chat_report_evidence TO service_role;

COMMENT ON TABLE public.chat_report_evidence IS
  '채팅 신고 증거 스냅샷(chat_report_message 가 DB 에서 채움). snapshot = {source:chat, version, '
  'conversationId, jobPostingId, postingTitle, reason, reportedMessageId, messages[], imagePaths[]}. '
  'deny-all — 관리자는 admin_get_report_evidence 로만 읽고, imagePaths 사진만 chat_media_can_read 로 본다.';

-- 관리자 전용 스냅샷 조회(D3 — 관리자는 원문이 아니라 스냅샷만 본다)
CREATE FUNCTION public.admin_get_report_evidence(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 관리자만 신고 증거를 볼 수 있습니다';
  END IF;
  RETURN (SELECT e.snapshot FROM public.chat_report_evidence e WHERE e.report_id = p_report_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_report_evidence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_report_evidence(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. RPC
-- ----------------------------------------------------------------------------
-- 방 알림 끄기/켜기 — 전송 RPC(S1 ⑪)가 muted_until > now 인 수신자를 이미 거른다
CREATE FUNCTION public.chat_set_muted(p_conversation_id uuid, p_muted boolean)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_until timestamptz := CASE WHEN p_muted THEN 'infinity'::timestamptz END;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF p_muted IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 알림 설정 값이 없습니다';
  END IF;
  IF NOT public.chat_is_member(p_conversation_id, v_uid) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅방에 참여하고 있지 않습니다';
  END IF;

  INSERT INTO public.chat_read_states (conversation_id, user_id, muted_until, updated_at)
  VALUES (p_conversation_id, v_uid, v_until, now())
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET muted_until = EXCLUDED.muted_until,
        updated_at = now();
END;
$$;

-- 차단 — 방 단위, 양방향 전송 불가. 쪽별 1행(이미 내 쪽이 막았으면 그대로)
CREATE FUNCTION public.chat_block(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_conv public.chat_conversations%ROWTYPE;
  v_side text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF p_conversation_id IS NOT NULL THEN
    SELECT * INTO v_conv FROM public.chat_conversations WHERE id = p_conversation_id;
  END IF;
  -- 쪽 판정은 S1 chat_send_message ② 와 같은 규칙(구직자 본인 → seeker, 아니면 헬퍼 판정)
  IF v_conv.id IS NOT NULL AND v_conv.seeker_id IS NOT NULL AND v_conv.seeker_id = v_uid THEN
    v_side := 'seeker';
  ELSIF v_conv.id IS NOT NULL AND public.chat_is_employer_side(v_conv.job_posting_id, v_uid) THEN
    v_side := 'employer';
  ELSE
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅방에 참여하고 있지 않습니다';
  END IF;

  -- 전송과 같은 방 잠금 — 차단과 동시 전송을 직렬화해 차단 직후 메시지가 새지 않게(DB 리뷰 M2)
  PERFORM pg_advisory_xact_lock(hashtextextended('chat_conversation:' || v_conv.id::text, 0));

  INSERT INTO public.chat_blocks (conversation_id, blocked_by_side, created_by)
  VALUES (v_conv.id, v_side, v_uid)
  ON CONFLICT (conversation_id, blocked_by_side) DO NOTHING;
END;
$$;

-- 차단 해제 — 막은 쪽만. 구인자 측은 쪽 단위(같은 쪽 누구나 — 담당자가 바뀌어도 풀 수 있게)
CREATE FUNCTION public.chat_unblock(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_conv public.chat_conversations%ROWTYPE;
  v_side text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF p_conversation_id IS NOT NULL THEN
    SELECT * INTO v_conv FROM public.chat_conversations WHERE id = p_conversation_id;
  END IF;
  IF v_conv.id IS NOT NULL AND v_conv.seeker_id IS NOT NULL AND v_conv.seeker_id = v_uid THEN
    v_side := 'seeker';
  ELSIF v_conv.id IS NOT NULL AND public.chat_is_employer_side(v_conv.job_posting_id, v_uid) THEN
    v_side := 'employer';
  ELSE
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅방에 참여하고 있지 않습니다';
  END IF;

  DELETE FROM public.chat_blocks
   WHERE conversation_id = v_conv.id AND blocked_by_side = v_side;
  IF NOT FOUND AND EXISTS (SELECT 1 FROM public.chat_blocks WHERE conversation_id = v_conv.id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 상대가 차단한 대화는 해제할 수 없습니다';
  END IF;
END;
$$;

-- 메시지 신고 → reports 1행. 스냅샷(신고 메시지 + 직전 10개)은 **여기서 DB 로부터** 만든다.
CREATE FUNCTION public.chat_report_message(p_message_id uuid, p_reason text, p_detail text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_msg       public.chat_messages%ROWTYPE;
  v_conv      public.chat_conversations%ROWTYPE;
  v_side      text;
  v_detail    text := nullif(btrim(coalesce(p_detail, '')), '');
  v_label     text;
  v_my_name   text;
  v_rl        jsonb;
  v_messages  jsonb;
  v_images    jsonb;
  v_report_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND status = 'active') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 신고할 수 없는 계정 상태입니다';
  END IF;

  v_label := CASE p_reason
    WHEN 'abuse'  THEN '욕설·비하'
    WHEN 'scam'   THEN '사기·금전 요구'
    WHEN 'sexual' THEN '음란·불쾌한 사진'
    WHEN 'spam'   THEN '스팸·광고'
    WHEN 'other'  THEN '기타'
  END;
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 신고 사유를 선택해 주세요';
  END IF;
  IF char_length(coalesce(v_detail, '')) > 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 신고 내용은 500자 이하여야 합니다';
  END IF;

  -- 메시지 · 방 · 쪽. 없는 메시지와 남의 방 메시지는 **같은 코드**(존재 oracle 차단)
  IF p_message_id IS NOT NULL THEN
    SELECT * INTO v_msg FROM public.chat_messages WHERE id = p_message_id;
  END IF;
  IF v_msg.id IS NOT NULL THEN
    SELECT * INTO v_conv FROM public.chat_conversations WHERE id = v_msg.conversation_id;
  END IF;
  IF v_conv.id IS NOT NULL AND v_conv.seeker_id IS NOT NULL AND v_conv.seeker_id = v_uid THEN
    v_side := 'seeker';
  ELSIF v_conv.id IS NOT NULL AND public.chat_is_employer_side(v_conv.job_posting_id, v_uid) THEN
    v_side := 'employer';
  ELSE
    RAISE EXCEPTION 'PERMISSION_DENIED: 신고할 수 없는 메시지입니다';
  END IF;

  -- 상대 쪽이 보낸, 지워지지 않은 사람 메시지만(내 쪽 동료·시스템·공지·탈퇴자 메시지는 불가)
  IF v_msg.sender_side NOT IN ('seeker', 'employer') OR v_msg.sender_side = v_side
     OR v_msg.sender_id IS NULL OR v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 신고할 수 없는 메시지입니다';
  END IF;

  IF EXISTS (SELECT 1 FROM public.chat_report_evidence e
              WHERE e.reporter_id = v_uid AND e.reported_message_id = v_msg.id) THEN
    RAISE EXCEPTION 'DUPLICATE_REPORT: 이미 신고한 메시지입니다';
  END IF;

  v_rl := public.check_user_rate_limit(v_uid, 'chat_report', 20, 86400);
  IF NOT coalesce((v_rl ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'CHAT_REPORT_LIMITED: 오늘은 더 이상 신고할 수 없습니다';
  END IF;

  -- 신고자 표시 이름: 방 안에서 쓰는 이름과 같게(구직자=방 스냅샷, 구인자 측=닉네임 → '<업장> 담당자')
  IF v_side = 'seeker' THEN
    v_my_name := v_conv.seeker_display_name;
  ELSE
    SELECT coalesce(
             CASE WHEN nullif(btrim(nickname), '') ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN NULL
                  ELSE nullif(btrim(nickname), '') END,
             v_conv.employer_display_name || ' 담당자')
      INTO v_my_name FROM public.users WHERE id = v_uid;
  END IF;

  -- 스냅샷: 신고 메시지 + 직전 10개(지워진 것 제외), 오래된 → 최신
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'senderSide', x.sender_side, 'senderDisplayName', x.sender_display_name,
           'kind', x.kind, 'body', x.body, 'imagePath', x.image_path, 'createdAt', x.created_at,
           'reported', x.id = v_msg.id)
         ORDER BY x.created_at, x.id), '[]'::jsonb),
         coalesce(jsonb_agg(x.image_path) FILTER (WHERE x.image_path IS NOT NULL), '[]'::jsonb)
    INTO v_messages, v_images
    FROM (
      (SELECT m.* FROM public.chat_messages m
        WHERE m.conversation_id = v_conv.id AND m.deleted_at IS NULL
          AND (m.created_at, m.id) < (v_msg.created_at, v_msg.id)
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 10)
      UNION ALL
      SELECT (v_msg).*
    ) x;

  INSERT INTO public.reports (
    type, reporter_type, reporter_id, reporter_name, target_id, target_name,
    job_posting_id, job_posting_title, description, evidence_urls, severity, status
  )
  VALUES (
    'inappropriate_behavior',
    CASE v_side WHEN 'seeker' THEN 'employee' ELSE 'employer' END,
    v_uid, v_my_name, v_msg.sender_id, v_msg.sender_display_name,
    v_conv.job_posting_id, nullif(v_conv.posting_title, ''),
    '[채팅 신고] ' || v_label || coalesce(E'\n' || v_detail, ''),
    ARRAY[]::text[],
    (CASE WHEN p_reason IN ('scam', 'sexual') THEN 'high' ELSE 'medium' END)::public.report_severity,
    'pending'
  )
  RETURNING id INTO v_report_id;

  INSERT INTO public.chat_report_evidence (report_id, reporter_id, reported_message_id, snapshot)
  VALUES (v_report_id, v_uid, v_msg.id, jsonb_build_object(
    'source', 'chat', 'version', 1,
    'conversationId', v_conv.id, 'jobPostingId', v_conv.job_posting_id,
    'postingTitle', v_conv.posting_title, 'reason', p_reason,
    'reportedMessageId', v_msg.id, 'messages', v_messages, 'imagePaths', v_images));

  RETURN v_report_id;
EXCEPTION
  -- 같은 메시지 동시 재신고 경합 — 부분 유니크 인덱스가 최종 판정(보안 LOW-5)
  WHEN unique_violation THEN
    RAISE EXCEPTION 'DUPLICATE_REPORT: 이미 신고한 메시지입니다';
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. 재정의 — S1 원문 + 표시한 줄만 (CREATE OR REPLACE: 권한·소유자 유지)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.chat_send_message(
  p_conversation_id   uuid,
  p_kind              text,
  p_body              text,
  p_image_path        text,
  p_image_width       int,
  p_image_height      int,
  p_client_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_conv        public.chat_conversations%ROWTYPE;
  v_side        text;
  v_body        text := coalesce(p_body, '');
  v_rl          jsonb;
  v_existing    record;
  v_now         timestamptz;
  v_msg_id      uuid;
  v_sender_name text;
  v_is_first    boolean;
  v_recipients  uuid[];
  v_title       text;
  v_preview     text;
BEGIN
  -- ① 인증
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- ② 멤버 · 쪽 판정
  IF p_conversation_id IS NOT NULL THEN
    SELECT * INTO v_conv FROM public.chat_conversations WHERE id = p_conversation_id;
  END IF;
  IF v_conv.id IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅방에 참여하고 있지 않습니다';
  END IF;
  IF v_conv.seeker_id IS NOT NULL AND v_conv.seeker_id = v_uid THEN
    v_side := 'seeker';
  ELSIF public.chat_is_employer_side(v_conv.job_posting_id, v_uid) THEN
    v_side := 'employer';
  ELSE
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅방에 참여하고 있지 않습니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND status = 'active') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅을 사용할 수 없는 계정 상태입니다';   -- L6
  END IF;

  -- ③ 형태
  IF p_client_message_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 메시지 식별자가 없습니다';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('text', 'image') THEN
    RAISE EXCEPTION 'INVALID_INPUT: 보낼 수 없는 메시지 종류입니다';
  END IF;
  IF p_kind = 'text' THEN
    IF btrim(v_body) = '' OR char_length(v_body) > 1000 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 메시지는 1~1000자여야 합니다';
    END IF;
    IF p_image_path IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_INPUT: 텍스트 메시지에는 사진을 붙일 수 없습니다';
    END IF;
  ELSE
    IF char_length(v_body) > 1000 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 사진 설명은 1000자 이하여야 합니다';
    END IF;
    -- ④ 사진: 경로 완전 일치(L1) + 크기(L3) + chat-media 실재(L2) — 남의 사진 사칭 차단
    IF p_image_path IS NULL
       OR p_image_path NOT IN (
            -- (S4 보안 LOW-1) 정화 EF 가 만드는 모양만 — .jpg · 가로·세로 ≤ 2048(jpegSanitize 상한)
            format('%s/%s/%s.jpg',  v_conv.id, v_uid, p_client_message_id))
       OR p_image_width  IS NULL OR p_image_width  NOT BETWEEN 1 AND 2048
       OR p_image_height IS NULL OR p_image_height NOT BETWEEN 1 AND 2048
       OR NOT EXISTS (SELECT 1 FROM storage.objects o
                       WHERE o.bucket_id = 'chat-media' AND o.name = p_image_path) THEN
      RAISE EXCEPTION 'CHAT_IMAGE_INVALID: 사진을 보낼 수 없습니다';
    END IF;
  END IF;

  -- ⑤ 상대 탈퇴 (차단은 ⑤-c — 멱등 재전송이 차단 뒤에도 '이미 보냄'으로 끝나게 뒤에 둔다)
  IF v_side = 'employer' AND v_conv.seeker_id IS NULL THEN
    RAISE EXCEPTION 'CHAT_COUNTERPART_GONE: 대화 상대가 탈퇴했습니다';
  END IF;

  -- ⑤-b 멱등 사전 조회(잠금 없이) — 재전송이 rate limit 토큰을 쓰지 않게(DB 리뷰 L-2).
  --      확정 판정은 잠금 뒤 ⑧ 이 한다.
  SELECT id, sender_id, created_at INTO v_existing
    FROM public.chat_messages
   WHERE conversation_id = v_conv.id AND client_message_id = p_client_message_id;
  IF FOUND THEN
    IF v_existing.sender_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'INVALID_INPUT: 이미 사용된 메시지 식별자입니다';
    END IF;
    RETURN jsonb_build_object('messageId', v_existing.id, 'createdAt', v_existing.created_at, 'deduped', true);
  END IF;

  -- ⑤-c (S4) 차단 — 방 단위 · 양방향. 어느 쪽이 막았든 둘 다 못 보낸다(D10).
  --      rate limit 토큰을 쓰기 전에 거른다.
  IF EXISTS (SELECT 1 FROM public.chat_blocks b WHERE b.conversation_id = v_conv.id) THEN
    RAISE EXCEPTION 'CHAT_BLOCKED: 대화할 수 없는 상태입니다';
  END IF;

  -- ⑥ 속도 제한(분당 30)
  v_rl := public.check_user_rate_limit(v_uid, 'chat_send', 30, 60);
  IF NOT coalesce((v_rl ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'CHAT_RATE_LIMITED: 메시지를 너무 빨리 보내고 있습니다';
  END IF;

  -- ⑦ 방 단위 직렬화 — 잠금 **뒤에** 시각을 찍어야 늦게 커밋된 메시지가 더 이른 시각을
  --    갖지 않는다(now() 는 트랜잭션 시작 시각 → 읽음 커서가 건너뛰는 "안 읽음 누락")
  PERFORM pg_advisory_xact_lock(hashtextextended('chat_conversation:' || v_conv.id::text, 0));

  -- ⑧ 멱등: 같은 client id 는 기존 행 반환(알림 생략). 다른 발신자의 같은 id 는 거부
  SELECT id, sender_id, created_at INTO v_existing
    FROM public.chat_messages
   WHERE conversation_id = v_conv.id AND client_message_id = p_client_message_id;
  IF FOUND THEN
    IF v_existing.sender_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'INVALID_INPUT: 이미 사용된 메시지 식별자입니다';
    END IF;
    RETURN jsonb_build_object('messageId', v_existing.id, 'createdAt', v_existing.created_at, 'deduped', true);
  END IF;

  -- (S4 보안 LOW-4·DB M2) 잠금 뒤 차단 재확인 — chat_block 도 같은 잠금을 잡으므로 직렬화된다
  IF EXISTS (SELECT 1 FROM public.chat_blocks b WHERE b.conversation_id = v_conv.id) THEN
    RAISE EXCEPTION 'CHAT_BLOCKED: 대화할 수 없는 상태입니다';
  END IF;

  v_now := clock_timestamp();
  -- 잠금 뒤 다시 읽는다 — 동시에 온 첫 메시지 둘이 모두 "새 채팅 문의"가 되지 않게(DB 리뷰 L-3)
  SELECT last_message_id IS NULL INTO v_is_first
    FROM public.chat_conversations WHERE id = v_conv.id;

  IF v_side = 'seeker' THEN
    v_sender_name := v_conv.seeker_display_name;
  ELSE
    -- M5 대칭: 닉네임 없으면 실명이 아니라 '<업장명> 담당자'(보안 M-1 · DB M-5)
    SELECT coalesce(
             CASE WHEN nullif(btrim(nickname), '') ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN NULL
                  ELSE nullif(btrim(nickname), '') END,
             v_conv.employer_display_name || ' 담당자')
      INTO v_sender_name FROM public.users WHERE id = v_uid;
  END IF;

  -- ⑨ 저장
  INSERT INTO public.chat_messages (
    conversation_id, sender_id, sender_side, sender_display_name, kind, body,
    image_path, image_width, image_height, client_message_id, created_at
  )
  VALUES (
    v_conv.id, v_uid, v_side, v_sender_name, p_kind, v_body,
    CASE WHEN p_kind = 'image' THEN p_image_path END,
    CASE WHEN p_kind = 'image' THEN p_image_width END,
    CASE WHEN p_kind = 'image' THEN p_image_height END,
    p_client_message_id, v_now
  )
  RETURNING id INTO v_msg_id;

  -- ⑩ 방 요약 · 보낸 사람 커서 전진 · 상대들의 "나가기" 해제
  UPDATE public.chat_conversations
     SET last_message_at = v_now, last_message_id = v_msg_id
   WHERE id = v_conv.id;

  INSERT INTO public.chat_read_states (conversation_id, user_id, last_read_at, last_read_message_id, hidden_at, updated_at)
  VALUES (v_conv.id, v_uid, v_now, v_msg_id, NULL, v_now)
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET last_read_at = GREATEST(public.chat_read_states.last_read_at, EXCLUDED.last_read_at),
        last_read_message_id = EXCLUDED.last_read_message_id,
        hidden_at = NULL,
        updated_at = EXCLUDED.updated_at;

  UPDATE public.chat_read_states
     SET hidden_at = NULL, updated_at = v_now
   WHERE conversation_id = v_conv.id AND user_id <> v_uid AND hidden_at IS NOT NULL;

  -- ⑪ 알림 수신자: 상대 쪽 − 보낸 사람 − 뮤트. DISTINCT 필수(owner = ws owner 흔함 — M3,
  --    중복이면 ON CONFLICT DO UPDATE 가 21000 으로 전송 자체를 실패시킨다)
  IF v_side = 'seeker' THEN
    SELECT array_agg(DISTINCT r.uid) INTO v_recipients
      FROM (
        SELECT jp.owner_id AS uid FROM public.job_postings jp WHERE jp.id = v_conv.job_posting_id
        UNION ALL
        SELECT w.owner_id FROM public.job_postings jp
          JOIN public.workspaces w ON w.id = jp.workspace_id
         WHERE jp.id = v_conv.job_posting_id
        UNION ALL
        SELECT wm.user_id FROM public.job_postings jp
          JOIN public.workspace_members wm ON wm.workspace_id = jp.workspace_id
         WHERE jp.id = v_conv.job_posting_id
        UNION ALL
        SELECT jpc.user_id FROM public.job_posting_collaborators jpc
         WHERE jpc.job_posting_id = v_conv.job_posting_id AND jpc.role = 'manager'
      ) r
     WHERE r.uid IS NOT NULL
       AND r.uid <> v_uid
       AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = r.uid)
       AND NOT EXISTS (SELECT 1 FROM public.chat_read_states rs
                        WHERE rs.conversation_id = v_conv.id AND rs.user_id = r.uid
                          AND rs.muted_until > v_now);
    v_title := CASE WHEN v_is_first THEN '새 채팅 문의' ELSE v_conv.seeker_display_name END;
  ELSE
    SELECT array_agg(v_conv.seeker_id) INTO v_recipients
     WHERE NOT EXISTS (SELECT 1 FROM public.chat_read_states rs
                        WHERE rs.conversation_id = v_conv.id AND rs.user_id = v_conv.seeker_id
                          AND rs.muted_until > v_now);
    v_title := v_conv.employer_display_name;
  END IF;

  IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
    -- D4: 미리보기 60자, 사진은 고정 문구(이미지 URL 을 푸시에 싣지 않는다)
    v_preview := CASE WHEN p_kind = 'image' THEN '사진을 보냈어요' ELSE left(v_body, 60) END;

    -- (a) 5분 넘게 안 읽힌 행은 지워 새 푸시를 허용(decrement 트리거가 카운터 대칭 처리)
    DELETE FROM public.notifications
     WHERE type = 'chat_message'
       AND recipient_id = ANY (v_recipients)
       AND data ->> 'conversationId' = v_conv.id::text
       AND is_read = false
       AND created_at < v_now - interval '5 minutes';

    -- (b) 한 문장 팬아웃. 5분 안 연속 메시지는 UPDATE 로 흡수 — INSERT 트리거의 new_rows 에
    --     갱신 행은 들어가지 않으므로 푸시 없이 미리보기만 바뀐다(chat_notification_collapse N10)
    INSERT INTO public.notifications (recipient_id, type, category, title, body, link, data, priority, created_at)
    SELECT r, 'chat_message', 'application'::notification_category, v_title, v_preview,
           '/chat/' || v_conv.id::text,
           jsonb_build_object('conversationId', v_conv.id, 'jobPostingId', v_conv.job_posting_id,
                              'senderId', v_uid, 'messageId', v_msg_id),
           'normal', v_now
      FROM unnest(v_recipients) AS r
    ON CONFLICT (recipient_id, ((data ->> 'conversationId'))) WHERE type = 'chat_message' AND is_read = false
    DO UPDATE SET body = EXCLUDED.body, data = EXCLUDED.data;
  END IF;

  RETURN jsonb_build_object('messageId', v_msg_id, 'createdAt', v_now, 'deduped', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_list_conversations(p_limit int DEFAULT 30, p_before timestamptz DEFAULT NULL)
RETURNS TABLE (
  conversation_id      uuid,
  job_posting_id       uuid,
  posting_title        text,
  posting_status       text,
  counterpart_name     text,
  my_side              text,
  last_message_at      timestamptz,
  last_message_preview text,
  unread_count         int,
  blocked              boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  RETURN QUERY
  SELECT c.id,
         c.job_posting_id,
         c.posting_title,
         jp.status::text,
         CASE WHEN c.seeker_id = v_uid THEN c.employer_display_name ELSE c.seeker_display_name END,
         CASE WHEN c.seeker_id = v_uid THEN 'seeker' ELSE 'employer' END,
         c.last_message_at,
         CASE WHEN lm.deleted_at IS NOT NULL THEN '삭제된 메시지'
              WHEN lm.kind = 'image' THEN '사진'
              ELSE left(lm.body, 100) END,
         (SELECT count(*)::int FROM (
            SELECT 1 FROM public.chat_messages x
             WHERE x.conversation_id = c.id
               AND x.created_at > coalesce(rs.last_read_at, '-infinity')
               AND x.sender_id IS DISTINCT FROM v_uid
               AND x.deleted_at IS NULL
             LIMIT 99) u),                                   -- 99 에서 멈춘다(캡 이상 세지 않음)
         EXISTS (SELECT 1 FROM public.chat_blocks b WHERE b.conversation_id = c.id)   -- (S4) 실값
    FROM public.chat_conversations c
    LEFT JOIN public.job_postings jp ON jp.id = c.job_posting_id
    LEFT JOIN public.chat_read_states rs ON rs.conversation_id = c.id AND rs.user_id = v_uid
    LEFT JOIN LATERAL (SELECT x.kind, x.body, x.deleted_at FROM public.chat_messages x
                        WHERE x.id = c.last_message_id) lm ON true
   WHERE c.id IN (SELECT public.chat_my_conversation_ids())
     AND c.last_message_at IS NOT NULL
     AND (p_before IS NULL OR c.last_message_at < p_before)
     AND (rs.hidden_at IS NULL OR c.last_message_at > rs.hidden_at)
   ORDER BY c.last_message_at DESC, c.id DESC
   LIMIT LEAST(GREATEST(coalesce(p_limit, 30), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_media_can_read(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_uid IS NULL OR p_object_name IS NULL
     OR p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' THEN
    RETURN false;   -- 형식이 틀리면 캐스트 전에 false(예외 없음)
  END IF;

  IF split_part(p_object_name, '/', 2)::uuid = v_uid THEN
    RETURN true;
  END IF;

  -- (S4) 관리자는 **신고 증거로 스냅샷에 담긴 사진만** 본다(D3 — 원문 열람 불가 원칙 유지).
  --      방 멤버가 아니므로 아래 멤버 절로는 절대 통과하지 않는다.
  IF public.is_admin() AND EXISTS (
       SELECT 1 FROM public.chat_report_evidence e
        WHERE e.snapshot -> 'imagePaths' ? p_object_name) THEN
    RETURN true;
  END IF;

  v_conv := split_part(p_object_name, '/', 1)::uuid;
  RETURN EXISTS (
           SELECT 1 FROM public.chat_messages m
            WHERE m.image_path = p_object_name
              AND m.conversation_id = v_conv
              AND m.deleted_at IS NULL)
     AND public.chat_is_member(v_conv, v_uid);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. 함수 권한 — SECDEF 규칙 1(anon/PUBLIC 회수)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  public.chat_set_muted(uuid, boolean),
  public.chat_block(uuid),
  public.chat_unblock(uuid),
  public.chat_report_message(uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.chat_set_muted(uuid, boolean),
  public.chat_block(uuid),
  public.chat_unblock(uuid),
  public.chat_report_message(uuid, text, text)
TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. 적용 시점 자체 검증(픽스처 블랭킷 GRANT 보다 먼저 — S1 §9 와 같은 이유)
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF has_table_privilege('authenticated', 'public.chat_blocks', 'INSERT')
     OR has_table_privilege('authenticated', 'public.chat_blocks', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.chat_blocks', 'DELETE')
     OR has_table_privilege('anon', 'public.chat_blocks', 'SELECT') THEN
    RAISE EXCEPTION 'chat_blocks 쓰기/anon 권한이 남아 있다';
  END IF;
  IF has_column_privilege('authenticated', 'public.chat_blocks', 'created_by', 'SELECT') THEN
    RAISE EXCEPTION 'chat_blocks.created_by 가 authenticated 에 노출된다';
  END IF;
  IF has_table_privilege('authenticated', 'public.chat_report_evidence', 'SELECT')
     OR has_table_privilege('authenticated', 'public.chat_report_evidence', 'INSERT')
     OR has_table_privilege('anon', 'public.chat_report_evidence', 'SELECT') THEN
    RAISE EXCEPTION 'chat_report_evidence 가 클라이언트 롤에 열려 있다';
  END IF;
  IF has_function_privilege('anon', 'public.admin_get_report_evidence(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'admin_get_report_evidence 에 anon EXECUTE 가 남아 있다';
  END IF;
  -- 서버 다크 착지는 이 마이그가 건드리지 않는다(공개 ON 은 별도 GRANT 마이그)
  IF has_function_privilege('authenticated', 'public.chat_send_message(uuid, text, text, text, int, int, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '서버 다크 착지 위반: authenticated 가 chat_send_message 를 실행할 수 있다';
  END IF;
END
$verify$;
