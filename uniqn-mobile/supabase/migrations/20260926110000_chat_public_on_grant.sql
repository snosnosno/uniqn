-- ============================================================================
-- 앱 내 채팅 공개 ON — 쓰기 진입점 GRANT (설계 §14-7 · S1 헤더 "서버 다크 착지")
-- ============================================================================
-- 2026-09-26 사용자 승인("지금 사용자들 거의 없으니까 그냥 공개하자"). 실기기 QA 를 prod 실제 경로로
-- 하기 위해 공개와 함께 진행한다.
--
-- 전제(모두 prod 반영 확인 — 09-25 14:34 UTC 실측, 파리티 245/106):
--   S4 차단·뮤트·신고·탈퇴 익명화·사진 서버 정화(M1) · S5-a 방침 v1.3 · S5-b 보존 purge 크론
-- ⚠️ 법무 확인 미완(방침 §12-3 "중요 변경 30일 전 공지"와 시행일=게시일 충돌) 상태의 공개 — 사용자 결정.
--
-- 이 마이그는 GRANT 만 한다 → prod-migrate 에서 verify_function 을 비운다(md5 불변이라 실패로 접힘).
-- 클라 노출은 app_config.chat_enabled = {"enabled": true} 로 따로 켠다.
--
-- 🔙 끄기(킬스위치): 이 문장을 REVOKE 로 바꾼 정방향 마이그를 **먼저** 적용하고, 그다음 플래그 OFF
--    (앱의 플래그 반영은 staleTime 때문에 최대 1시간 늦다 — 서버를 먼저 닫아야 즉시 막힌다).
-- 파리티: 불변(245 / 106)
-- ============================================================================

GRANT EXECUTE ON FUNCTION
  public.chat_open_conversation(uuid, uuid),
  public.chat_send_message(uuid, text, text, text, int, int, uuid)
TO authenticated;

DO $verify$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.chat_open_conversation(uuid, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.chat_send_message(uuid, text, text, text, int, int, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '공개 ON GRANT 가 적용되지 않았다';
  END IF;
  IF has_function_privilege('anon', 'public.chat_open_conversation(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.chat_send_message(uuid, text, text, text, int, int, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon 이 채팅 쓰기 진입점을 실행할 수 있다';
  END IF;
END
$verify$;
