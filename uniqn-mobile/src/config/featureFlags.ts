/**
 * UNIQN Mobile — Feature Flags
 *
 * 배포 안전망: 값을 false로 바꾸면 OTA(EAS Update)로 즉시 롤백 가능.
 */

export const featureFlags = {
  /** 홈 대시보드 활성화. false 시 기존 탭 진입 경로로 fallback. */
  home_dashboard_enabled: true,
  /**
   * 주간 배치 그리드 활성화. 빌드타임 fallback(원격 app_config.weekly_grid_enabled 부재·오류 시 사용).
   * false 이면 신규 그리드 UI 전부 미노출(기존 캘린더 무회귀).
   */
  weekly_grid_enabled: false,
  /**
   * ops 라이브 운영 허브 진입 표면 활성화. 빌드타임 fallback(원격 app_config.ops_hub_enabled 부재·오류 시 사용).
   * false 이면 진입 표면(발견 동선) 전부 미노출(직접 라우트는 유지).
   */
  ops_hub_enabled: false,
} as const;
