-- ============================================================================
-- 🚨 E2E·로컬 스택 전용 — PROD 에서 실행 금지 (공개 ON 과 같은 효과)
-- ============================================================================
-- 앱 내 채팅 서버는 다크로 착지했다(마이그 20260925100000 — open·send 에 authenticated EXECUTE 없음).
-- E2E 가 채팅 흐름을 돌리려면 그 잠금을 **이 스택에서만** 풀어야 한다.
--
-- 왜 마이그·seed.sql 이 아닌가
--   · 마이그로 넣으면 prod 에 나간다 = 공개 ON.
--   · seed.sql 은 DB Tests 잡의 `supabase start` 에도 적용된다 → chat_security_grants A4/A4b/A4c
--     (다크 단언)가 red 가 된다. E2E 잡과 DB Tests 잡은 서로 다른 스택이라 여기서만 건다.
--
-- GRANT 문장은 jpc_chat_simulate_on()(supabase/fixtures/jpc_helpers.sql)과 같다.
-- 되돌리기: e2e_chat_disable.sql — 로컬에서 E2E 뒤 pgTAP 을 돌리기 전에 반드시.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.chat_open_conversation(uuid, uuid),
  public.chat_send_message(uuid, text, text, text, int, int, uuid) TO authenticated;

INSERT INTO public.app_config (key, value, description, updated_at)
VALUES ('chat_enabled', '{"enabled": true}'::jsonb, 'E2E 전용 — 앱 내 채팅 진입점 ON', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 적용 확인(조용한 실패 방지)
DO $$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.chat_send_message(uuid,text,text,text,integer,integer,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'e2e_chat_enable: chat_send_message GRANT 가 적용되지 않았다';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.chat_open_conversation(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'e2e_chat_enable: chat_open_conversation GRANT 가 적용되지 않았다';
  END IF;
END;
$$;
