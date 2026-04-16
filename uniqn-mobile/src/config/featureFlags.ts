/**
 * UNIQN Mobile — Feature Flags
 *
 * 배포 안전망: 값을 false로 바꾸면 OTA(EAS Update)로 즉시 롤백 가능.
 */

export const featureFlags = {
  /** 홈 대시보드 활성화. false 시 기존 탭 진입 경로로 fallback. */
  home_dashboard_enabled: true,
} as const;
