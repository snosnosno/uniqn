-- =============================================================================
-- Migration: notification_settings.grouping jsonb 컬럼 추가
-- =============================================================================
-- 목적: NotificationSettings 타입(client)과 DB 스키마 불일치 해소.
--       `grouping` 필드가 upsert에 포함되어 저장 실패하던 버그 근본 해결.
--
-- 기존: client 타입은 { enabled, pushEnabled, categories, quietHours, grouping }
--       DB 컬럼은 enabled, push_enabled, categories, quiet_hours 만 존재.
--       → saveSettings 시 "column grouping does not exist" 에러로 "저장 실패" 토스트.
--
-- 해결: DB에 grouping jsonb 컬럼 추가하여 타입/스키마 1:1 정렬.
--       기본값은 클라의 createDefaultNotificationSettings()와 동일한 shape.
--
-- 영향:
--   - 신규 행: DEFAULT로 grouping 채워짐
--   - 기존 행: NULL → 클라 parseNotificationSettingsDocument가 .passthrough() +
--              optional 처리로 무해 (기본값이 store에서 이미 적용)
--   - push trigger (on_notification_created_send_push): notifications 테이블만 봄 → 영향 없음
--   - RLS: 기존 self-only 정책 그대로 재사용 (컬럼 추가해도 row-level 정책은 컬럼 무관)
--
-- 롤백:
--   ALTER TABLE public.notification_settings DROP COLUMN grouping;
-- =============================================================================

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS grouping jsonb DEFAULT jsonb_build_object(
    'enabled', true,
    'minGroupSize', 2,
    'timeWindowHours', 24
  );

COMMENT ON COLUMN public.notification_settings.grouping IS
  '알림 그룹화 설정. shape: { enabled: boolean, minGroupSize: number, timeWindowHours: number }. 클라이언트 NotificationSettings.grouping과 1:1 매칭.';
