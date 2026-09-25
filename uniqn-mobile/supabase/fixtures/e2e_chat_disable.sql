-- ============================================================================
-- e2e_chat_enable.sql 되돌리기 — 로컬 스택을 서버 다크 상태로 복원
-- ============================================================================
-- 로컬에서 E2E 를 돌린 뒤 pgTAP(npm run test:db)을 돌리기 전에 실행한다. 안 하면
-- chat_security_grants A4b 가 로컬에서 red 가 된다(실패가 아니라 오염).
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.chat_open_conversation(uuid, uuid),
  public.chat_send_message(uuid, text, text, text, int, int, uuid) FROM authenticated;

DELETE FROM public.app_config WHERE key = 'chat_enabled';

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.chat_send_message(uuid,text,text,text,integer,integer,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'e2e_chat_disable: chat_send_message 권한이 아직 남아 있다(PUBLIC 경유 여부 확인)';
  END IF;
  IF has_function_privilege('authenticated', 'public.chat_open_conversation(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'e2e_chat_disable: chat_open_conversation 권한이 아직 남아 있다(PUBLIC 경유 여부 확인)';
  END IF;
END;
$$;
