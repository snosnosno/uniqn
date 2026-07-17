-- ops 전면 개방 S1 — 진입 표면 피처 플래그(S9 롤아웃: OTA 는 OFF 상태로 출하 → 플래그 ON).
-- weekly_grid_enabled 와 동일 패턴(app_config key/value). 롤백 = value 를 false 로 UPDATE.
-- 게이트 대상은 "발견 표면"(프로필 메뉴/신기능 안내/스케줄 크로스링크)만 — (ops) 라우트 자체는 기존대로 접근 가능.

INSERT INTO public.app_config (key, value, description)
VALUES (
  'ops_hub_enabled',
  '{"enabled": false}'::jsonb,
  'ops 라이브 운영 허브 진입 표면 노출(S1). false=진입 표면 숨김(직접 라우트는 유지).'
)
ON CONFLICT (key) DO NOTHING;
