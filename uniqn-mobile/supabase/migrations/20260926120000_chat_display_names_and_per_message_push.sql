-- ============================================================================
-- 앱 내 채팅 — 실기기 QA 피드백 반영 (2026-09-26): 표시 이름 · 메시지마다 푸시
-- ============================================================================
-- 배경(실기기 QA):
--   ① 구직자 화면의 상대 이름이 '내 팀' — 워크스페이스 기본 이름이 그대로 스냅샷됐다
--      (prod 워크스페이스 7개 중 3개가 '내 팀', 나머지도 '<실명> 팀' 자동 생성명).
--      → 구인자 쪽 이름 = **공고 작성자 닉네임, 없으면 공고 제목**(사용자 결정).
--   ② 구직자 이름이 방을 만들 때 한 번 찍히고 끝 — 나중에 닉네임을 정해도 '구직자 xxxx' 그대로.
--      → 닉네임이 바뀌면 그 사람의 방 이름·보낸 메시지 이름을 따라 바꾼다.
--        닉네임이 없으면 중립 표시 '구직자 xxxx' 유지(M5 — 실명 미노출, 사용자 결정).
--   ③ 5분 안 연속 메시지는 푸시 없이 미리보기만 바뀌어, 받는 쪽은 첫 메시지만 본다.
--      → **메시지마다 푸시**(사용자 결정). 알림함은 방당 1행 유지 — 안 읽은 이전 행을 지우고 새로 넣는다.
--
-- 구성:
--   1. chat_safe_display_name(text)      — 공백·XSS 패턴이면 NULL(보안 L2 — 이름은 XSS 트리거 밖 원천)
--   2. fn_chat_conversation_names()       — BEFORE INSERT: 구인자 쪽 이름 = 작성자 닉네임 → 공고 제목
--   3. fn_chat_sync_nickname()            — users.nickname 변경 시 방 이름·메시지 이름 동기화
--   3-b. fn_chat_posting_owner_cleared()  — 공고 작성자 탈퇴(owner_id → NULL) 시 방 이름을 공고 제목으로
--   4. 기존 데이터 백필(같은 규칙)
--   5. chat_send_message 재정의 — S4(20260925210000) 원문 + 표시한 세 곳만
--        (a) 닉네임 없는 구인자 측 발신자 = '<공고 제목> 담당자'
--        (b) 알림: 5분 흡수 제거 → 안 읽은 이전 행 삭제 + 새 행 INSERT(= 메시지마다 푸시)
--        (c) 방어용 ON CONFLICT 가 제목도 갱신
--
-- 탈퇴 익명화와의 관계(DB 리뷰 HIGH):
--   · permanently_delete_user 는 users 행을 DELETE 한다(nickname UPDATE 없음) → 3 의 트리거는 돌지 않고,
--     seeker_id 가 SET NULL 된 방·sender_id NULL 메시지('[탈퇴한 사용자]')는 동기화 대상 밖이다.
--   · 구인자 쪽 이름이 업장명 → **개인 닉네임**으로 바뀌었으므로, 작성자가 탈퇴하면 그 닉네임도 지워야 한다.
--     탈퇴 함수는 job_postings.owner_id 를 NULL 로 만든다 → 3-b 트리거가 방 이름과 구직자가 받은 알림 제목을
--     공고 제목으로 바꾼다(탈퇴 함수 본문은 건드리지 않는다).
--
-- ⚠️ 메시지마다 푸시의 한계(DB 리뷰 MEDIUM-1 — 수용): 푸시 EF 는 커밋 뒤 **비동기로** 알림 id 를 다시 읽는다.
--   약 1초 안에 연달아 온 메시지는 앞 행이 이미 교체돼 앞 푸시가 빠질 수 있다(최신 메시지 푸시는 항상 나간다).
--   교체된 행의 push_tickets 는 FK CASCADE 로 함께 지워진다(수신 확인 기록 손실 — 최신 행 것은 남는다).
--   이전 행을 '읽음'으로 남기는 대안은 알림함에 메시지마다 행이 쌓여 택하지 않았다.
-- 파리티: 함수 249 = 245 + 4(1·2·3·3-b) · 정책 106 불변
-- prod-migrate: verify_function = chat_send_message
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 표시 이름 정화 헬퍼
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.chat_safe_display_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN nullif(btrim(p_name), '') ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN NULL
    ELSE nullif(btrim(p_name), '')
  END;
$$;

-- ----------------------------------------------------------------------------
-- 2. 새 방의 구인자 쪽 이름 — 작성자 닉네임 → 공고 제목 → (기존 스냅샷 값)
--    chat_open_conversation 은 그대로 두고 INSERT 직전에 덮는다.
--    SECDEF: 직접 INSERT 는 RLS 가 막지만, 그 판정 전에 이 함수가 헬퍼 권한 오류를 내지 않게.
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_chat_conversation_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.employer_display_name := coalesce(
    (SELECT public.chat_safe_display_name(u.nickname)
       FROM public.job_postings jp
       JOIN public.users u ON u.id = jp.owner_id
      WHERE jp.id = NEW.job_posting_id),
    public.chat_safe_display_name(NEW.posting_title),
    NEW.employer_display_name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_conversation_names
  BEFORE INSERT ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.fn_chat_conversation_names();

-- ----------------------------------------------------------------------------
-- 3. 닉네임 변경 → 방 이름 · 보낸 메시지 이름 동기화
--    신고 증거(chat_report_evidence)는 신고 시점 사본이라 건드리지 않는다.
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_chat_sync_nickname()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nick    text := public.chat_safe_display_name(NEW.nickname);
  v_neutral text := '구직자 ' || left(replace(NEW.id::text, '-', ''), 4);
BEGIN
  -- 값이 실제로 바뀌는 행만 쓴다 — chat_messages 는 realtime publication 이라 UPDATE 마다 전파된다(DB 리뷰 M-2)
  -- 구직자로 들어간 방
  UPDATE public.chat_conversations
     SET seeker_display_name = coalesce(v_nick, v_neutral)
   WHERE seeker_id = NEW.id
     AND seeker_display_name IS DISTINCT FROM coalesce(v_nick, v_neutral);

  -- 내가 작성한 공고의 방
  UPDATE public.chat_conversations c
     SET employer_display_name = coalesce(v_nick, public.chat_safe_display_name(c.posting_title),
                                          c.employer_display_name)
    FROM public.job_postings jp
   WHERE jp.id = c.job_posting_id
     AND jp.owner_id = NEW.id
     AND c.employer_display_name IS DISTINCT FROM
           coalesce(v_nick, public.chat_safe_display_name(c.posting_title), c.employer_display_name);

  -- 내가 보낸 메시지(쪽별 폴백은 chat_send_message 와 같다). system 은 대상 아님
  UPDATE public.chat_messages m
     SET sender_display_name = CASE m.sender_side
           WHEN 'seeker' THEN coalesce(v_nick, v_neutral)
           ELSE coalesce(v_nick, c.posting_title || ' 담당자')
         END
    FROM public.chat_conversations c
   WHERE c.id = m.conversation_id
     AND m.sender_id = NEW.id
     AND m.sender_side IN ('seeker', 'employer')
     AND m.sender_display_name IS DISTINCT FROM CASE m.sender_side
           WHEN 'seeker' THEN coalesce(v_nick, v_neutral)
           ELSE coalesce(v_nick, c.posting_title || ' 담당자')
         END;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_chat_sync_nickname
  AFTER UPDATE OF nickname ON public.users
  FOR EACH ROW
  WHEN (OLD.nickname IS DISTINCT FROM NEW.nickname)
  EXECUTE FUNCTION public.fn_chat_sync_nickname();

-- ----------------------------------------------------------------------------
-- 3-b. 공고 작성자 탈퇴 → 방 이름 = 공고 제목, 구직자가 받은 채팅 알림 제목도 같이
--      (permanently_delete_user 가 job_postings.owner_id 를 NULL 로 만든다 — 소유자 이전 경로는 없다)
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_chat_posting_owner_cleared()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.chat_conversations c
     SET employer_display_name = coalesce(public.chat_safe_display_name(c.posting_title), '구인자')
   WHERE c.job_posting_id = NEW.id;

  UPDATE public.notifications n
     SET title = c.employer_display_name
    FROM public.chat_conversations c
   WHERE n.type = 'chat_message'
     AND c.job_posting_id = NEW.id
     AND c.id::text = n.data ->> 'conversationId'
     AND n.recipient_id = c.seeker_id
     AND n.title IS DISTINCT FROM c.employer_display_name;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_chat_posting_owner_cleared
  AFTER UPDATE OF owner_id ON public.job_postings
  FOR EACH ROW
  WHEN (OLD.owner_id IS NOT NULL AND NEW.owner_id IS NULL)
  EXECUTE FUNCTION public.fn_chat_posting_owner_cleared();

-- SECDEF 규칙 4 — 트리거 전용 함수는 PUBLIC·anon·authenticated 전부 회수. 헬퍼도 서버 전용.
REVOKE ALL ON FUNCTION
  public.chat_safe_display_name(text),
  public.fn_chat_conversation_names(),
  public.fn_chat_sync_nickname(),
  public.fn_chat_posting_owner_cleared()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_safe_display_name(text) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. 기존 데이터 백필 — 2·3 과 같은 규칙
-- ----------------------------------------------------------------------------
UPDATE public.chat_conversations c
   SET employer_display_name = coalesce(
         (SELECT public.chat_safe_display_name(u.nickname)
            FROM public.job_postings jp
            JOIN public.users u ON u.id = jp.owner_id
           WHERE jp.id = c.job_posting_id),
         public.chat_safe_display_name(c.posting_title),
         c.employer_display_name);

UPDATE public.chat_conversations c
   SET seeker_display_name = coalesce(public.chat_safe_display_name(u.nickname),
                                      '구직자 ' || left(replace(u.id::text, '-', ''), 4))
  FROM public.users u
 WHERE u.id = c.seeker_id;

UPDATE public.chat_messages m
   SET sender_display_name = CASE m.sender_side
         WHEN 'seeker'
           THEN coalesce(public.chat_safe_display_name(u.nickname),
                         '구직자 ' || left(replace(u.id::text, '-', ''), 4))
         ELSE coalesce(public.chat_safe_display_name(u.nickname), c.posting_title || ' 담당자')
       END
  FROM public.users u, public.chat_conversations c
 WHERE u.id = m.sender_id
   AND c.id = m.conversation_id
   AND m.sender_side IN ('seeker', 'employer');

-- ----------------------------------------------------------------------------
-- 5. chat_send_message 재정의 — S4(20260925210000) 원문 + 표시한 두 곳만
--    (CREATE OR REPLACE: 권한·소유자 유지 — 공개 ON GRANT 그대로)
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
    -- M5 대칭: 닉네임 없으면 실명이 아니라 '<공고 제목> 담당자'
    -- [09-26 변경] 업장명 → 공고 제목(업장명이 '내 팀' 같은 기본값이라 의미가 없었다)
    SELECT coalesce(public.chat_safe_display_name(nickname), v_conv.posting_title || ' 담당자')
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

    -- [09-26 변경] 메시지마다 푸시 — 5분 흡수(UPDATE 는 INSERT 트리거의 new_rows 에 안 들어가
    --   푸시가 없었다)를 없앤다. 알림함은 방당 1행: 안 읽은 이전 행을 **나이와 무관하게** 지우고
    --   새로 넣는다(삭제 −1 · 삽입 +1 → 배지 카운터 순증 0). 방 잠금(⑦) 안이라 경합 없음.
    DELETE FROM public.notifications
     WHERE type = 'chat_message'
       AND recipient_id = ANY (v_recipients)
       AND data ->> 'conversationId' = v_conv.id::text
       AND is_read = false;

    -- 한 문장 팬아웃 → 푸시 EF 1회. ON CONFLICT 는 방어용(위 DELETE 뒤라 정상 경로에선 걸리지 않는다)
    -- [09-26 변경] 방어 경로에서도 제목을 최신으로(이름이 바뀐 뒤일 수 있다)
    INSERT INTO public.notifications (recipient_id, type, category, title, body, link, data, priority, created_at)
    SELECT r, 'chat_message', 'application'::notification_category, v_title, v_preview,
           '/chat/' || v_conv.id::text,
           jsonb_build_object('conversationId', v_conv.id, 'jobPostingId', v_conv.job_posting_id,
                              'senderId', v_uid, 'messageId', v_msg_id),
           'normal', v_now
      FROM unnest(v_recipients) AS r
    ON CONFLICT (recipient_id, ((data ->> 'conversationId'))) WHERE type = 'chat_message' AND is_read = false
    DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, data = EXCLUDED.data;
  END IF;

  RETURN jsonb_build_object('messageId', v_msg_id, 'createdAt', v_now, 'deduped', false);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. 착지 확인
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF to_regprocedure('public.chat_safe_display_name(text)') IS NULL
     OR to_regprocedure('public.fn_chat_conversation_names()') IS NULL
     OR to_regprocedure('public.fn_chat_sync_nickname()') IS NULL
     OR to_regprocedure('public.fn_chat_posting_owner_cleared()') IS NULL THEN
    RAISE EXCEPTION '표시 이름 함수가 생성되지 않았다';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
       WHERE NOT tgisinternal
         AND tgname IN ('trg_chat_conversation_names', 'trg_chat_sync_nickname',
                        'trg_chat_posting_owner_cleared')) <> 3 THEN
    RAISE EXCEPTION '표시 이름 트리거 3개가 모두 있지 않다';
  END IF;
  IF has_function_privilege('authenticated', 'public.fn_chat_sync_nickname()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_chat_conversation_names()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_chat_posting_owner_cleared()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.chat_safe_display_name(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.chat_safe_display_name(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '서버 전용 함수가 클라이언트 역할에 열려 있다';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.chat_send_message(uuid, text, text, text, int, int, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '재정의 뒤 chat_send_message 의 공개 ON GRANT 가 사라졌다';
  END IF;
  IF position('5 minutes' IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.chat_send_message(uuid, text, text, text, int, int, uuid)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'chat_send_message 에 5분 흡수가 남아 있다';
  END IF;
END
$verify$;
