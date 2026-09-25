-- ============================================================================
-- 앱 내 채팅 S4-2 — 사진 서버 정화 경로(보안 M1, PR #521 보안 리뷰)
-- ============================================================================
-- 계획: docs/planning/2026-09-25-chat-s4-safety-plan.md "보안 M1"
--
-- 문제: 서버가 사진 바이트를 검사하지 않는다. 앱을 우회해 chat-media 에 직접 올리면 원본 EXIF(GPS)
--       나 디코딩 폭탄(가로·세로가 거대한 JPEG)을 상대 기기로 보낼 수 있다.
-- 해결: 앱은 **접수함(chat-media-inbox)** 에만 올린다. EF `chat-media-sanitize`(service_role)가
--       JPEG 마커를 파싱해 메타데이터를 떼고 크기를 확인한 뒤 chat-media 에 기록한다.
--       chat_send_message 는 S1 그대로 "chat-media 에 실재" 를 확인하므로, 그 확인이 곧
--       "정화를 통과했다"는 증명이 된다.
--
--   비유: 손님이 가져온 액자를 벽에 바로 걸던 문을 잠그고, 접수 창구에만 두게 한다. 직원이 뒷면
--         메모를 떼고 크기를 확인한 뒤에 건다.
--
-- 🔑 기존 chat-media INSERT 정책(chat_media_insert_member)은 DROP 하지 않는다 — storage 정책
--    DROP 은 CI 에서 42501 이력(20260809130000:36-43). 대신 그 정책이 부르는 함수
--    chat_media_can_write 를 **항상 false** 로 바꿔 직접 업로드를 봉쇄한다.
--    (S1 헤더의 긴급 무력화 절차와 같은 방법)
--
-- 파리티: 함수 +1(chat_media_can_stage) → 245 / 106 · storage 정책 +1(public 밖, 카운트 밖)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 접수함 버킷 — 비공개 · 1.5MB · JPEG 만(앱은 항상 JPEG 로 재인코딩한다)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-media-inbox', 'chat-media-inbox', false, 1572864, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. 접수함 쓰기 판정 — S1 chat_media_can_write 규칙 + 차단(S4-1) + 두 버킷 합산 한도
--    경로 = '<방>/<나>/<client_message_id>.jpg' (소문자 정규 uuid, JPEG 만)
-- ----------------------------------------------------------------------------
-- ⚠️ 카운트는 소유자 postgres 의 BYPASSRLS 에 기댄다(S1 보안 L7 과 같음 — pgTAP 이 단언).
--    정화가 끝난 객체는 chat-media 로 옮겨지고 접수함에서 지워지므로 두 버킷을 합산해야
--    한도가 새지 않는다.
CREATE FUNCTION public.chat_media_can_stage(p_object_name text)
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
     OR p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' THEN
    RETURN false;   -- 형식이 틀리면 캐스트 전에 false(예외 없음)
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
  IF EXISTS (SELECT 1 FROM public.chat_blocks b WHERE b.conversation_id = v_conv) THEN
    RETURN false;   -- 차단된 방(S4-1)
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND status = 'active') THEN
    RETURN false;   -- L6
  END IF;

  SELECT count(*) FILTER (WHERE o.created_at > now() - interval '10 minutes'),
         count(*)
    INTO v_recent, v_day
    FROM storage.objects o
   WHERE o.bucket_id IN ('chat-media', 'chat-media-inbox')
     AND split_part(o.name, '/', 2) = v_uid::text
     AND o.created_at > now() - interval '1 day';
  RETURN v_recent < 20 AND v_day < 60;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_media_can_stage(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_media_can_stage(text) TO authenticated, service_role;

-- CREATE POLICY 만. 실패하면 마이그 전체가 실패해야 한다(예외를 삼키지 않는다 — S1 L5).
-- SELECT·UPDATE·DELETE 정책은 두지 않는다 — 접수함은 EF(service_role)만 읽고 지운다.
CREATE POLICY chat_media_inbox_insert_member ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media-inbox' AND public.chat_media_can_stage(name));

-- ----------------------------------------------------------------------------
-- 3. chat-media 직접 업로드 봉쇄 — 정책은 그대로, 판정 함수만 false
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_media_can_write(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- (S4 보안 M1) chat-media 에는 EF chat-media-sanitize(service_role)만 쓴다.
  -- 앱은 chat-media-inbox 에 올리고(chat_media_can_stage), 정화된 사본만 여기로 온다.
  -- storage 정책 chat_media_insert_member 는 DROP 이 CI 에서 42501 이라 남겨 두고 이 함수로 끈다.
  RETURN false;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. 적용 시점 자체 검증
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets
                  WHERE id = 'chat-media-inbox' AND public = false
                    AND allowed_mime_types = ARRAY['image/jpeg']) THEN
    RAISE EXCEPTION 'chat-media-inbox 버킷 형상이 틀렸다';
  END IF;
  IF has_function_privilege('anon', 'public.chat_media_can_stage(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'chat_media_can_stage 에 anon EXECUTE 가 남아 있다';
  END IF;
END
$verify$;
