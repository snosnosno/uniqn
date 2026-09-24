-- ============================================================================
-- 앱 내 채팅 S1 — 스키마 · 헬퍼 · RPC · RLS · 알림 collapse · chat-media 버킷
-- ============================================================================
-- 설계(정본): docs/planning/2026-09-24-in-app-chat-design.md §3 · §4 · §4-2 · §6 · §14-2
-- 결정: D1~D4 · D7 확정(§15). 클라 UI 는 S2(플래그 chat_enabled OFF 로 다크 착지).
--
-- 한 줄: 공고 × 구직자 1:1 방. 구인자 측 참여자는 방에 명부를 두지 않고 **매번 기존 권한
--        헬퍼로 판정**한다(협업자 해제가 즉시 반영 · fail-closed). 쓰기는 전부 SECDEF RPC.
--
-- 파리티: 함수 +12 · 정책 +3 → 238 / 105 (storage 정책 2개는 public 밖이라 카운트 밖)
--   설계 §10 의 +11 에 chat_my_conversation_ids 1개가 더해졌다(리뷰 반영 — 아래 3).
--
-- 🔒 서버 다크 착지(2026-09-25 사용자 결정 — 보안 리뷰 H-2)
--   플래그 chat_enabled OFF 는 UI 만 숨긴다. 차단·신고(S4) 없이 RPC 가 열리면 누구나 사장 측에
--   UNIQN 공식 푸시를 보낼 수 있다(로컬 재현). 그래서 **쓰기 진입점 2개(open·send)의
--   authenticated EXECUTE 를 부여하지 않은 채** 착지한다 = 설계 D6 킬스위치를 '꺼진 위치'에서
--   시작. 방을 못 열면 storage 업로드(멤버 조건)도 막힌다. 공개 ON 은 GRANT 전용 마이그 1건:
--     GRANT EXECUTE ON FUNCTION public.chat_open_conversation(uuid, uuid),
--       public.chat_send_message(uuid, text, text, text, int, int, uuid) TO authenticated;
--   (prod-migrate 는 verify_function 을 비운다). pgTAP 은 트랜잭션 안에서 이 GRANT 를
--   시뮬레이션하고(jpc_chat_simulate_on), 다크 상태 자체는 chat_security_grants A4b 가 고정한다.
--
-- 설계 대비 조정(PR 본문에 기록)
--   1) first_published_at 백필 UPDATE 를 하지 않는다. job_postings 에 UPDATE 트리거가 13개라
--      (updated_at 갱신·알림 트리거 포함) 기존 41행 UPDATE 가 부수효과를 낸다. 대신 트리거가
--      "공개 status **진입 또는 이탈**" 시점에 한 번 기록하고, 개설 게이트는
--      `first_published_at IS NOT NULL OR 현재 공개 status` 로 본다. prod 에 cancelled/expired
--      행은 0건(2026-09-24 실측)이라 누락 대상이 없다.
--   2) 경로 정규식은 설계 L1 의 `[0-9a-f-]{36}` 대신 **정규 uuid 형식**으로 좁힌다 —
--      `------…` 같은 36자가 통과하면 ::uuid 캐스트 예외가 storage 정책에서 터진다.
--   3) (리뷰 반영) RLS 가 행마다 plpgsql 헬퍼를 부르면 필터 없는 SELECT 가 테이블 전체 ×
--      쿼리 4개가 된다(보안 M-2 · DB M-3 실측 23µs/행). 내 방 id 집합을 쿼리당 1회 계산하는
--      chat_my_conversation_ids() 로 바꾸고 목록·배지 RPC 도 같은 집합을 쓴다(DB M-1).
--      후보는 인덱스 경로로 넓게 뽑고 **최종 판정은 chat_is_employer_side** — 권한 의미의
--      진실원은 헬퍼 하나로 유지한다.
--   4) (리뷰 반영) 사진 한도: 버킷 5MB → 1.5MB(클라가 1600px JPEG 재인코딩) + 하루 60장
--      누적 한도. 10분 20장만으로는 약 102분에 무료 1GB 가 찬다(보안 H-1).
--   5) (리뷰 반영) 구인자 측 발신자 표시: 닉네임 없으면 실명이 아니라 '<업장명> 담당자'
--      (M5 대칭 — 보안 M-1 · DB M-5).
--
-- 🚨 storage 정책은 CREATE POLICY 만 쓰고 **예외를 삼키지 않는다**(설계 L5 — baseline 은
--    insufficient_privilege 를 삼켜 정책 미생성을 숨긴다. 20260809130000:82-83 원칙).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 공고 "공개된 적 있음" 기록 (§4-2 M1)
-- ----------------------------------------------------------------------------
ALTER TABLE public.job_postings ADD COLUMN first_published_at timestamptz;

COMMENT ON COLUMN public.job_postings.first_published_at IS
  '공개 status(approved·active·capacity_full·closed) 에 처음 진입했거나 그 상태에서 벗어난 시각. '
  '채팅 개설 게이트용 — 초안에서 곧장 삭제된 공고의 존재를 숨긴다. 트리거만 쓴다(직접 쓰기 무시).';

CREATE FUNCTION public.fn_job_posting_first_published()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.first_published_at := CASE
      WHEN NEW.status IN ('approved', 'active', 'capacity_full', 'closed') THEN clock_timestamp()
    END;
  ELSE
    -- 한 번 기록되면 불변. 클라가 심은 값은 무시한다(OLD 기준으로만 계산).
    NEW.first_published_at := COALESCE(
      OLD.first_published_at,
      CASE
        WHEN NEW.status IN ('approved', 'active', 'capacity_full', 'closed')
          OR OLD.status IN ('approved', 'active', 'capacity_full', 'closed')
        THEN clock_timestamp()
      END);
  END IF;
  RETURN NEW;
END;
$$;

-- 이름 순서상 tr_fixed_posting_expired(BEFORE UPDATE, status 를 바꿀 수 있음) 뒤에 돈다.
-- 순서가 바뀌어도 OLD.status 조건이 공개 → 만료 전이를 잡는다.
CREATE TRIGGER trg_jp_first_published_at
  BEFORE INSERT OR UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_posting_first_published();

-- SECDEF 규칙 4 — 트리거 전용 함수는 PUBLIC·anon·authenticated 전부 회수
REVOKE ALL ON FUNCTION public.fn_job_posting_first_published() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. 테이블
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 공고는 soft delete(cancelled)라 행이 남는다. CASCADE 는 운영자 수동 hard-delete 때만 발동
  job_posting_id        uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  -- 탈퇴 크론(permanently_delete_user)이 DELETE FROM users 를 하므로 NO ACTION 금지
  seeker_id             uuid REFERENCES public.users(id) ON DELETE SET NULL,
  seeker_display_name   text NOT NULL,   -- 닉네임 우선, 없으면 중립 표시(M5 — 실명 미노출)
  employer_display_name text NOT NULL,   -- 업장명(workspaces.name) 스냅샷
  posting_title         text NOT NULL,   -- 공고 제목 스냅샷
  created_by            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at       timestamptz,
  last_message_id       uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conv_posting_seeker_uq UNIQUE (job_posting_id, seeker_id)
);
CREATE INDEX chat_conv_seeker_idx  ON public.chat_conversations (seeker_id, last_message_at DESC);
CREATE INDEX chat_conv_posting_idx ON public.chat_conversations (job_posting_id, last_message_at DESC);
CREATE INDEX chat_conv_created_by_idx ON public.chat_conversations (created_by);

CREATE TABLE public.chat_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sender_side         text NOT NULL CHECK (sender_side IN ('seeker', 'employer', 'system')),
  sender_display_name text NOT NULL,
  kind                text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image', 'announcement', 'system')),
  body                text NOT NULL DEFAULT '',
  -- 사진: chat-media 객체 경로 '<conversation_id>/<sender_id>/<client_message_id>.<ext>'
  image_path          text,
  image_width         int,
  image_height        int,
  client_message_id   uuid NOT NULL,                  -- 재전송 멱등키
  created_at          timestamptz NOT NULL,           -- RPC 가 잠금 획득 후 clock_timestamp()
  deleted_at          timestamptz,
  CONSTRAINT chat_msg_shape_chk CHECK (
       deleted_at IS NOT NULL AND body = '' AND image_path IS NULL           -- 삭제·탈퇴 익명화
    OR kind = 'image' AND image_path IS NOT NULL AND char_length(body) <= 1000
    OR kind <> 'image' AND image_path IS NULL AND char_length(body) BETWEEN 1 AND 1000),
  CONSTRAINT chat_msg_image_path_chk CHECK (
    image_path IS NULL
    OR image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  CONSTRAINT chat_msg_image_dims_chk CHECK (
        (image_width  IS NULL OR image_width  BETWEEN 1 AND 10000)
    AND (image_height IS NULL OR image_height BETWEEN 1 AND 10000))
);
CREATE UNIQUE INDEX chat_msg_idem_uq       ON public.chat_messages (conversation_id, client_message_id);
CREATE UNIQUE INDEX chat_msg_image_path_uq ON public.chat_messages (image_path) WHERE image_path IS NOT NULL;
CREATE INDEX chat_msg_conv_time_idx        ON public.chat_messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX chat_msg_sender_idx           ON public.chat_messages (sender_id);   -- 탈퇴 익명화 스캔

-- UPDATE OF body 로 좁힌다: 탈퇴 크론의 ON DELETE SET NULL 연쇄도 행 UPDATE 트리거를 발화시키므로,
-- 나중에 패턴이 엄격해지면 과거 본문 재검사(P0001)가 탈퇴를 무음 실패시킬 수 있다(DB 리뷰 L-1)
CREATE TRIGGER chat_messages_xss_check BEFORE INSERT OR UPDATE OF body ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('body');         -- 범용 함수 재사용, 함수 +0

CREATE TABLE public.chat_read_states (
  conversation_id      uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at         timestamptz NOT NULL DEFAULT '-infinity',
  last_read_message_id uuid,
  muted_until          timestamptz,
  hidden_at            timestamptz,   -- "채팅방 나가기". 이후 새 메시지가 오면 목록에 다시 나타남
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX chat_read_states_user_idx ON public.chat_read_states (user_id);

-- 푸시 묶기(§6): 방 · 수신자당 미읽음 채팅 알림 1행
CREATE UNIQUE INDEX notifications_chat_unread_collapse
  ON public.notifications (recipient_id, ((data ->> 'conversationId')))
  WHERE type = 'chat_message' AND is_read = false;

-- ----------------------------------------------------------------------------
-- 3. 권한 헬퍼 (plpgsql SECDEF — RLS 재귀 없음, NULL fail-open 차단)
-- ----------------------------------------------------------------------------
-- 구인자 측 = 공고 owner ∪ 워크스페이스 owner/멤버 ∪ manager 협업자(좁은 헬퍼 — viewer 제외, D3)
CREATE FUNCTION public.chat_is_employer_side(p_posting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid;
  v_ws    uuid;
  v_uid   uuid := auth.uid();
BEGIN
  IF p_posting_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;
  -- L4: 남의 멤버십 탐문 금지 — 두 번째 인자는 호출자 본인. 예외는 허용 목록뿐:
  --     service_role JWT, 또는 JWT 가 아예 없고 PostgREST 접속 롤(authenticator)이 아닌 직결
  --     (postgres 마이그·크론·pgTAP). role claim 이 빠진 JWT(`{}`)는 신뢰하지 않는다(보안 L1).
  IF p_user_id IS DISTINCT FROM v_uid
     AND NOT (coalesce(auth.jwt() ->> 'role', '') = 'service_role'
              OR (auth.jwt() IS NULL AND session_user <> 'authenticator')) THEN
    RETURN false;
  END IF;

  SELECT owner_id, workspace_id INTO v_owner, v_ws
    FROM public.job_postings WHERE id = p_posting_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- owner_id 는 탈퇴 시 NULL — `v_owner = p_user_id` 가 NULL 이 되어 NOT 게이트를 뚫지 않게
  RETURN coalesce(
       (v_owner IS NOT NULL AND v_owner = p_user_id)
    OR public.is_workspace_member(v_ws, p_user_id)
    OR public.is_posting_collaborator(p_posting_id, p_user_id),
    false);
END;
$$;

CREATE FUNCTION public.chat_is_member(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_posting uuid;
  v_seeker  uuid;
  v_uid     uuid := auth.uid();
BEGIN
  IF p_conversation_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF p_user_id IS DISTINCT FROM v_uid
     AND NOT (coalesce(auth.jwt() ->> 'role', '') = 'service_role'
              OR (auth.jwt() IS NULL AND session_user <> 'authenticator')) THEN
    RETURN false;   -- L4 (허용 목록 — chat_is_employer_side 와 같은 규칙)
  END IF;

  SELECT job_posting_id, seeker_id INTO v_posting, v_seeker
    FROM public.chat_conversations WHERE id = p_conversation_id;   -- SECDEF → RLS 우회, 재귀 없음
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN (v_seeker IS NOT NULL AND v_seeker = p_user_id)
      OR public.chat_is_employer_side(v_posting, p_user_id);
END;
$$;

-- 내 방 id 집합 — RLS·목록·배지가 쿼리당 1회만 계산한다(행당 헬퍼 호출 제거).
--   구직자 갈래: seeker_id 인덱스. 구인자 갈래: 내 공고(owner · ws owner · ws 멤버 · 협업자 **전
--   role**)의 방을 posting 인덱스로 모은 뒤 chat_is_employer_side 로 최종 판정 — viewer 제외 같은
--   권한 의미는 헬퍼에만 둔다(후보를 좁게 뽑으면 헬퍼를 고쳐도 테스트가 못 잡는다).
--   구인자 측에는 메시지 없는 방을 숨긴다(구직자가 "채팅하기"만 누른 흔적 — 보안 L3).
CREATE FUNCTION public.chat_my_conversation_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id FROM public.chat_conversations c WHERE c.seeker_id = v_uid
  UNION
  SELECT c.id
    FROM (
      SELECT jp.id FROM public.job_postings jp WHERE jp.owner_id = v_uid
      UNION
      SELECT jp.id FROM public.workspaces w
        JOIN public.job_postings jp ON jp.workspace_id = w.id WHERE w.owner_id = v_uid
      UNION
      SELECT jp.id FROM public.workspace_members wm
        JOIN public.job_postings jp ON jp.workspace_id = wm.workspace_id WHERE wm.user_id = v_uid
      UNION
      SELECT jpc.job_posting_id FROM public.job_posting_collaborators jpc WHERE jpc.user_id = v_uid
    ) mp
    JOIN public.chat_conversations c ON c.job_posting_id = mp.id
   WHERE (c.last_message_at IS NOT NULL OR c.created_by = v_uid)
     AND public.chat_is_employer_side(mp.id, v_uid);
END;
$$;

-- storage 정책용: 경로 = '<방>/<발신자>/<client id>.<jpg|png|webp>' (소문자 정규 uuid)
-- 읽기(H1) = 내가 올린 것 OR (삭제 안 된 메시지가 참조하는 사진 AND 내가 그 방 멤버)
CREATE FUNCTION public.chat_media_can_read(p_object_name text)
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

  v_conv := split_part(p_object_name, '/', 1)::uuid;
  RETURN EXISTS (
           SELECT 1 FROM public.chat_messages m
            WHERE m.image_path = p_object_name
              AND m.conversation_id = v_conv
              AND m.deleted_at IS NULL)
     AND public.chat_is_member(v_conv, v_uid);
END;
$$;

-- 쓰기(M6) = 형식 · 2세그먼트=본인 · 방 멤버 · 상대 탈퇴 아님 · 활성 사용자
--            · 최근 10분 < 20 · 최근 24시간 < 60 (속도만으로는 총량이 무한 — 보안 H-1)
-- ⚠️ 카운트는 bucket_id 인덱스 뒤 Filter 스캔이다(storage.objects 에 created_at 인덱스를 둘 권한
--    없음 — 소유자 supabase_storage_admin). chat-media 객체가 수만 개에 이르면 업로드 티켓 방식으로
--    재설계한다(DB 리뷰 M-2). 또 이 카운트는 소유자 postgres 의 BYPASSRLS 에 기댄다 —
--    빠지면 0 이 되어 한도가 조용히 꺼지므로 pgTAP 이 소유자 속성을 단언한다(보안 L7).
CREATE FUNCTION public.chat_media_can_write(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_conv   uuid;
  v_seeker uuid;
  v_recent int;
  v_day    int;
BEGIN
  IF v_uid IS NULL OR p_object_name IS NULL
     OR p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' THEN
    RETURN false;
  END IF;
  IF split_part(p_object_name, '/', 2)::uuid IS DISTINCT FROM v_uid THEN
    RETURN false;
  END IF;

  v_conv := split_part(p_object_name, '/', 1)::uuid;
  SELECT seeker_id INTO v_seeker FROM public.chat_conversations WHERE id = v_conv;
  IF NOT FOUND OR v_seeker IS NULL THEN
    RETURN false;   -- 없는 방 · 상대(구직자) 탈퇴
  END IF;
  IF NOT public.chat_is_member(v_conv, v_uid) THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND status = 'active') THEN
    RETURN false;   -- L6
  END IF;

  SELECT count(*) FILTER (WHERE o.created_at > now() - interval '10 minutes'),
         count(*)
    INTO v_recent, v_day
    FROM storage.objects o
   WHERE o.bucket_id = 'chat-media'
     AND split_part(o.name, '/', 2) = v_uid::text
     AND o.created_at > now() - interval '1 day';
  RETURN v_recent < 20 AND v_day < 60;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC
-- ----------------------------------------------------------------------------
-- 방 개설(있으면 기존 id). 구직자는 p_seeker_id 생략, 구인자 측은 상대(이 공고 지원자) 지정.
CREATE FUNCTION public.chat_open_conversation(p_job_posting_id uuid, p_seeker_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_is_emp     boolean;
  v_seeker     uuid;
  v_status     text;
  v_first_pub  timestamptz;
  v_title      text;
  v_ws_name    text;
  v_owner_name text;
  v_nick       text;
  v_id         uuid;
  v_rl         jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND status = 'active') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅을 사용할 수 없는 계정 상태입니다';   -- L6
  END IF;

  v_is_emp := public.chat_is_employer_side(p_job_posting_id, v_uid);

  -- M2: 제3자가 남의 uid 로 피해자 명의 문의방을 만들 수 없다
  IF p_seeker_id IS NOT NULL AND p_seeker_id <> v_uid AND NOT v_is_emp THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅방을 열 권한이 없습니다';
  END IF;

  -- M1: 없는 id · 비공개 공고 · 초안에서 곧장 삭제된 공고는 **같은 코드**(존재 oracle 차단)
  SELECT jp.status::text, jp.first_published_at, jp.title, w.name, jp.owner_name
    INTO v_status, v_first_pub, v_title, v_ws_name, v_owner_name
    FROM public.job_postings jp
    LEFT JOIN public.workspaces w ON w.id = jp.workspace_id
   WHERE jp.id = p_job_posting_id;
  IF NOT FOUND
     OR v_status IN ('draft', 'pending', 'rejected', 'container')
     OR NOT (v_first_pub IS NOT NULL OR v_status IN ('approved', 'active', 'capacity_full', 'closed')) THEN
    RAISE EXCEPTION 'CHAT_POSTING_UNAVAILABLE: 채팅할 수 없는 공고입니다';
  END IF;

  IF p_seeker_id IS NULL OR p_seeker_id = v_uid THEN
    -- 구직자 모드: 자기(구인자 측) 공고 문의 금지
    IF v_is_emp THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: 내 공고에는 문의할 수 없습니다';
    END IF;
    v_seeker := v_uid;
  ELSE
    -- 구인자 모드: 이 공고 지원자에게만 먼저 연락할 수 있다(스팸 차단 — 당근도 판매자 선제 불가)
    IF NOT EXISTS (SELECT 1 FROM public.applications a
                    WHERE a.job_posting_id = p_job_posting_id AND a.applicant_id = p_seeker_id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: 이 공고 지원자에게만 먼저 대화를 걸 수 있습니다';
    END IF;
    v_seeker := p_seeker_id;
  END IF;

  SELECT id INTO v_id FROM public.chat_conversations
   WHERE job_posting_id = p_job_posting_id AND seeker_id = v_seeker;
  IF FOUND THEN
    RETURN v_id;   -- 기존 방 재진입은 한도에 세지 않는다
  END IF;

  -- 새 방 하루 20개(구직자 쪽). check_user_rate_limit 은 service_role 전용 → SECDEF 안에서만,
  -- 그리고 이 함수는 VOLATILE 이어야 카운트가 접히지 않는다(20260719061931:25-27)
  IF v_seeker = v_uid THEN
    v_rl := public.check_user_rate_limit(v_uid, 'chat_open', 20, 86400);
    IF NOT coalesce((v_rl ->> 'allowed')::boolean, false) THEN
      RAISE EXCEPTION 'CHAT_OPEN_LIMITED: 오늘은 더 이상 새 채팅을 시작할 수 없습니다';
    END IF;
  END IF;

  -- M5: 닉네임 없으면 실명 대신 중립 표시
  SELECT nullif(btrim(nickname), '') INTO v_nick FROM public.users WHERE id = v_seeker;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAT_COUNTERPART_GONE: 대화 상대가 없습니다';
  END IF;

  -- 스냅샷 원천(workspaces.name · job_postings.owner_name · users.nickname)은 XSS 트리거 밖이다.
  -- 이 값들이 방 제목·푸시 title 로 퍼지므로 패턴이 보이면 중립값으로 바꾼다(보안 L2).
  IF v_nick ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
    v_nick := NULL;
  END IF;
  IF v_ws_name ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
    v_ws_name := NULL;
  END IF;
  IF v_owner_name ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
    v_owner_name := NULL;
  END IF;

  INSERT INTO public.chat_conversations (
    job_posting_id, seeker_id, seeker_display_name, employer_display_name, posting_title, created_by
  )
  VALUES (
    p_job_posting_id, v_seeker,
    coalesce(v_nick, '구직자 ' || left(replace(v_seeker::text, '-', ''), 4)),
    coalesce(nullif(btrim(v_ws_name), ''), nullif(btrim(v_owner_name), ''), '구인자'),
    v_title, v_uid
  )
  ON CONFLICT (job_posting_id, seeker_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN   -- 동시 개설 경합에서 진 쪽
    SELECT id INTO v_id FROM public.chat_conversations
     WHERE job_posting_id = p_job_posting_id AND seeker_id = v_seeker;
  END IF;
  RETURN v_id;
END;
$$;

-- 전송. 수신자 알림은 방 단위로 묶는다(§6 — 5분 창, 한 문장 팬아웃 → EF 1회)
CREATE FUNCTION public.chat_send_message(
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
            format('%s/%s/%s.jpg',  v_conv.id, v_uid, p_client_message_id),
            format('%s/%s/%s.png',  v_conv.id, v_uid, p_client_message_id),
            format('%s/%s/%s.webp', v_conv.id, v_uid, p_client_message_id))
       OR p_image_width  IS NULL OR p_image_width  NOT BETWEEN 1 AND 10000
       OR p_image_height IS NULL OR p_image_height NOT BETWEEN 1 AND 10000
       OR NOT EXISTS (SELECT 1 FROM storage.objects o
                       WHERE o.bucket_id = 'chat-media' AND o.name = p_image_path) THEN
      RAISE EXCEPTION 'CHAT_IMAGE_INVALID: 사진을 보낼 수 없습니다';
    END IF;
  END IF;

  -- ⑤ 상대 탈퇴 (차단은 S4)
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

-- 읽음 커서 전진(역행 없음) + **내** 방 알림만 읽음(M4)
CREATE FUNCTION public.chat_mark_read(p_conversation_id uuid, p_last_message_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_at  timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF NOT public.chat_is_member(p_conversation_id, v_uid) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅방에 참여하고 있지 않습니다';
  END IF;
  SELECT created_at INTO v_at FROM public.chat_messages
   WHERE id = p_last_message_id AND conversation_id = p_conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_INPUT: 이 방의 메시지가 아닙니다';
  END IF;

  INSERT INTO public.chat_read_states (conversation_id, user_id, last_read_at, last_read_message_id, updated_at)
  VALUES (p_conversation_id, v_uid, v_at, p_last_message_id, now())
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET last_read_message_id = CASE WHEN EXCLUDED.last_read_at > public.chat_read_states.last_read_at
                                    THEN EXCLUDED.last_read_message_id
                                    ELSE public.chat_read_states.last_read_message_id END,
        last_read_at = GREATEST(public.chat_read_states.last_read_at, EXCLUDED.last_read_at),
        updated_at = now();

  UPDATE public.notifications
     SET is_read = true, read_at = now()
   WHERE recipient_id = v_uid
     AND type = 'chat_message'
     AND data ->> 'conversationId' = p_conversation_id::text
     AND is_read = false;
END;
$$;

-- "채팅방 나가기" = 내 목록에서 숨김. 상대가 새 메시지를 보내면 다시 나타난다
CREATE FUNCTION public.chat_hide_conversation(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_last_at timestamptz;
  v_last_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF NOT public.chat_is_member(p_conversation_id, v_uid) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 채팅방에 참여하고 있지 않습니다';
  END IF;
  -- 전송과 같은 방 잠금 — 읽는 순간과 hidden_at 사이에 커밋된 메시지가 "숨겨졌는데 배지 1"로
  -- 남지 않게(DB 리뷰 L-4)
  PERFORM pg_advisory_xact_lock(hashtextextended('chat_conversation:' || p_conversation_id::text, 0));
  SELECT last_message_at, last_message_id INTO v_last_at, v_last_id
    FROM public.chat_conversations WHERE id = p_conversation_id;

  INSERT INTO public.chat_read_states (conversation_id, user_id, last_read_at, last_read_message_id, hidden_at, updated_at)
  VALUES (p_conversation_id, v_uid, coalesce(v_last_at, '-infinity'), v_last_id, clock_timestamp(), now())
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET last_read_message_id = CASE WHEN EXCLUDED.last_read_at > public.chat_read_states.last_read_at
                                    THEN EXCLUDED.last_read_message_id
                                    ELSE public.chat_read_states.last_read_message_id END,
        last_read_at = GREATEST(public.chat_read_states.last_read_at, EXCLUDED.last_read_at),
        hidden_at = EXCLUDED.hidden_at,
        updated_at = now();

  UPDATE public.notifications
     SET is_read = true, read_at = now()
   WHERE recipient_id = v_uid
     AND type = 'chat_message'
     AND data ->> 'conversationId' = p_conversation_id::text
     AND is_read = false;
END;
$$;

-- 내 방 목록(최신순). 후보 = chat_my_conversation_ids()(인덱스 경로 + 헬퍼 최종 판정)
CREATE FUNCTION public.chat_list_conversations(p_limit int DEFAULT 30, p_before timestamptz DEFAULT NULL)
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
         false
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

-- 헤더 배지용 전체 미읽음(99 캡). 목록과 같은 후보 · 같은 커서 규칙. 99행에서 스캔을 멈춘다
CREATE FUNCTION public.chat_unread_total()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_total int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  SELECT count(*)::int INTO v_total
    FROM (
      SELECT 1
        FROM public.chat_conversations c
        LEFT JOIN public.chat_read_states rs ON rs.conversation_id = c.id AND rs.user_id = v_uid
        JOIN public.chat_messages x ON x.conversation_id = c.id
       WHERE c.id IN (SELECT public.chat_my_conversation_ids())
         AND x.created_at > coalesce(rs.last_read_at, '-infinity')
         AND x.sender_id IS DISTINCT FROM v_uid
         AND x.deleted_at IS NULL
       LIMIT 99
    ) u;

  RETURN v_total;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. RLS — 전부 SELECT 만, TO authenticated. 멤버십은 SECDEF 집합 함수로 쿼리당 1회 계산
--    (자기 테이블 inline SELECT 없음 → 재귀 없음. 함수는 SECDEF 라 RLS 를 우회해 읽는다)
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_states   ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_conversations_select_member ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.chat_my_conversation_ids()));

CREATE POLICY chat_messages_select_member ON public.chat_messages
  FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT public.chat_my_conversation_ids()));

CREATE POLICY chat_read_states_select_own ON public.chat_read_states
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 테이블 권한: 쓰기는 RPC 전용. Supabase 기본 default-privilege 가 준 ALL 을 걷어내고 SELECT 만
REVOKE ALL ON public.chat_conversations, public.chat_messages, public.chat_read_states FROM anon, authenticated;
GRANT SELECT ON public.chat_conversations, public.chat_messages, public.chat_read_states TO authenticated;
GRANT ALL ON public.chat_conversations, public.chat_messages, public.chat_read_states TO service_role;

-- ----------------------------------------------------------------------------
-- 6. 함수 권한 — SECDEF 규칙 1(anon/PUBLIC 회수) + 서버 다크 착지(open·send 는 authenticated 미부여)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  public.chat_is_employer_side(uuid, uuid),
  public.chat_is_member(uuid, uuid),
  public.chat_my_conversation_ids(),
  public.chat_media_can_read(text),
  public.chat_media_can_write(text),
  public.chat_open_conversation(uuid, uuid),
  public.chat_send_message(uuid, text, text, text, int, int, uuid),
  public.chat_mark_read(uuid, uuid),
  public.chat_hide_conversation(uuid),
  public.chat_list_conversations(int, timestamptz),
  public.chat_unread_total()
FROM PUBLIC, anon, authenticated;

-- 읽기·헬퍼(RLS·storage 정책 평가에 필요)와 방이 없으면 무해한 읽음/나가기는 연다
GRANT EXECUTE ON FUNCTION
  public.chat_is_employer_side(uuid, uuid),
  public.chat_is_member(uuid, uuid),
  public.chat_my_conversation_ids(),
  public.chat_media_can_read(text),
  public.chat_media_can_write(text),
  public.chat_mark_read(uuid, uuid),
  public.chat_hide_conversation(uuid),
  public.chat_list_conversations(int, timestamptz),
  public.chat_unread_total()
TO authenticated, service_role;

-- 🔒 쓰기 진입점은 service_role 만. 공개 ON = authenticated 에 GRANT 하는 별도 마이그(헤더 참조)
GRANT EXECUTE ON FUNCTION
  public.chat_open_conversation(uuid, uuid),
  public.chat_send_message(uuid, text, text, text, int, int, uuid)
TO service_role;

-- ----------------------------------------------------------------------------
-- 7. Realtime — 방 화면이 postgres_changes 로 구독(RLS 가 구독자별로 걸러 보낸다)
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ----------------------------------------------------------------------------
-- 8. 사진 버킷 + storage 정책 (storage 스키마 — parity 가드 밖, 전용 pgTAP 로 행동 관측)
-- ----------------------------------------------------------------------------
-- 1.5MB: 클라가 긴 변 1600px · JPEG 0.8 로 재인코딩하므로 충분하다(보안 H-1 — 5MB 는 과함).
-- SVG·GIF 제외(SVG 는 서빙 시 XSS 벡터 — 20260809130000 temp 버킷 선례). 기존 'chat' 버킷은
-- 소유자 전용 RESTRICTIVE 가 SQL 로 안 지워져 재사용하지 않는다(설계 §0-2).
-- ON CONFLICT: 누가 대시보드로 먼저 만들어 둬도 적용이 막히지 않고 설정을 정본으로 맞춘다
-- (선례 20260802150000:33-36 · DB 리뷰 L-6).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-media', 'chat-media', false, 1572864, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- CREATE POLICY 만. 실패하면 마이그 전체가 실패해야 한다(예외를 삼키지 않는다 — L5)
CREATE POLICY chat_media_select_member ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media' AND public.chat_media_can_read(name));

CREATE POLICY chat_media_insert_member ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND public.chat_media_can_write(name));

-- ----------------------------------------------------------------------------
-- 9. 적용 시점 자체 검증 — 테스트 픽스처의 블랭킷 GRANT 보다 **먼저** 돈다(CI·prod 모두).
--    pgTAP 은 픽스처가 relacl 을 덮어 테이블 GRANT 를 볼 수 없다(DB 리뷰 참고 절).
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(format('%s:%s:%s', r, t, pr), ', ') INTO v_bad
    FROM unnest(ARRAY['anon', 'authenticated']) r,
         unnest(ARRAY['public.chat_conversations', 'public.chat_messages', 'public.chat_read_states']) t,
         unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) pr
   WHERE has_table_privilege(r, t, pr);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '채팅 테이블 쓰기 권한이 남아 있다: %', v_bad;
  END IF;

  IF has_table_privilege('anon', 'public.chat_messages', 'SELECT') THEN
    RAISE EXCEPTION '채팅 테이블에 anon SELECT 가 남아 있다';
  END IF;

  IF has_function_privilege('authenticated', 'public.chat_open_conversation(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.chat_send_message(uuid, text, text, text, int, int, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '서버 다크 착지 위반: authenticated 가 open/send 를 실행할 수 있다';
  END IF;
END
$verify$;
