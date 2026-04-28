-- Feature Flag: monetization 초기 시드
-- Decision #6 + Spec §7.1
-- 초기 정책: 시스템은 enabled, 4종 paid_types는 모두 false (무료 운영),
--   다이아 충전 UI(show_purchase_ui)는 활성, 첫 충전 보너스 5💎 적용.
-- Plan Task 10

INSERT INTO public.app_config (key, value, description, updated_at)
VALUES (
  'monetization',
  jsonb_build_object(
    'enabled', true,
    'paid_types', jsonb_build_object(
      'regular', false,
      'urgent', false,
      'fixed', false,
      'tournament', false
    ),
    'rollout_percentage', 0,
    'show_purchase_ui', true,
    'first_purchase_bonus_diamonds', 5
  ),
  '결제 시스템 Feature Flag. paid_types 모두 false = 전부 무료 운영. show_purchase_ui = 충전 UI 노출. rollout_percentage = 단계 배포 비율. Spec §7.1, Decision #6.',
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
