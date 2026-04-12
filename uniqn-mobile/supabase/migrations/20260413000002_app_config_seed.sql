-- ============================================================================
-- app_config 테이블 초기 버전 설정 데이터
-- ============================================================================
-- 문제: app_config 테이블에 데이터가 없어 versionService가 null을 반환하고
--      버전 업데이트 체크를 스킵함 (ISSUE-009)
-- 참고: src/services/versionService.ts - getRemoteVersionConfig() 참조

INSERT INTO public.app_config (key, value) VALUES
  (
    'force_update_version',
    '{"ios": "0.0.0", "android": "0.0.0", "web": "0.0.0"}'::jsonb
  ),
  (
    'latest_version',
    '{"ios": "1.0.0", "android": "1.0.0", "web": "1.0.0"}'::jsonb
  ),
  (
    'recommended_version',
    '{"ios": "1.0.0", "android": "1.0.0", "web": "1.0.0"}'::jsonb
  ),
  (
    'release_notes',
    '{"ios": "초기 릴리즈", "android": "초기 릴리즈", "web": "초기 릴리즈"}'::jsonb
  ),
  (
    'maintenance_mode',
    '{"enabled": false, "message": ""}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
