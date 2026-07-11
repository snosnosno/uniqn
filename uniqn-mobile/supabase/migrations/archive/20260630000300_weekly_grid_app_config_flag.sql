-- 주간 배치 그리드 — Phase 1 ④ 원격 피처플래그 시드 (app_config)
--
-- weekly_grid_enabled: 주간 배치 그리드 UI 노출 플래그. 빌드타임 상수(featureFlags.ts)는 OTA 로만
--   토글 가능하므로, 동적/단계적 롤아웃을 위해 app_config 원격 플래그를 권장(설계 §9.2).
--
-- 기본값 enabled=false (안전): 전체 6 Phase 출하 전까지 OFF. PROD 적용은 하드게이트(사용자 승인)이며,
--   적용되더라도 OFF 로 남는다. 로컬/검증 환경에서만 UPDATE 로 켠다. fail-closed 컨테이너 deny 는
--   플래그와 무관하게 항상 적용된다(누수 방지는 플래그 뒤에 두지 않는다).
--
-- ON CONFLICT (key) DO NOTHING: 멱등 + 이미 토글된 값(운영 토글)을 재시드가 덮어쓰지 않게 보존.
INSERT INTO public.app_config (key, value, description, updated_at)
VALUES (
  'weekly_grid_enabled',
  jsonb_build_object('enabled', false),
  '주간 배치 그리드(홀덤펍 운영 그리드) UI 노출 플래그. {"enabled": bool}. 기본 OFF(출하 전).',
  now()
)
ON CONFLICT (key) DO NOTHING;
