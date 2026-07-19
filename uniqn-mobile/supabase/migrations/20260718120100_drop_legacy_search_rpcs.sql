-- 닉네임 검색 통일 후속 — 구 검색 RPC 제거 (마이그B)
--
-- 전제: 클라이언트는 신규 닉네임 RPC(20260718120000_nickname_search_rpcs)로 전환 완료.
--   실사용자 부재 시점에 OTA 전 즉시 제거한다(라이브 클라 없음 확인).
-- 의존성 실측: ops_add_staff 가 search_users_by_phone 를 참조하나 **주석뿐**(실제 호출 아님) →
--   DROP 이 런타임에 영향 없음(plpgsql 늦은바인딩 함정 회피, pg_proc.prosrc 실측 확인).
--
-- ⚠️ 배포 순서: 이 마이그는 클라 OTA 확산 후 적용해야 안전하다. 단, 실사용자가 없어 라이브
--   클라가 없으므로 OTA 전 적용해도 무방하다(당 세션 조건).

DROP FUNCTION IF EXISTS public.search_users_by_phone(text);
DROP FUNCTION IF EXISTS public.search_users_for_collaborator_invite(uuid, text);
