/**
 * UNIQN Mobile — Feature Flags
 *
 * 배포 안전망: 값을 false로 바꾸면 OTA(EAS Update)로 즉시 롤백 가능.
 */

// 키 이름은 원격 플래그(app_config) 계약과 1:1 일치해야 하므로 snake_case 를 유지한다.
// (프로젝트 camelCase 규칙의 의도된 예외 — 원격 값과의 매칭 정합성 우선)
export const featureFlags = {
  /** 홈 대시보드 활성화. false 시 기존 탭 진입 경로로 fallback. */
  home_dashboard_enabled: true,
  /**
   * 주간 배치 그리드 활성화. 빌드타임 fallback(원격 app_config.weekly_grid_enabled 부재·오류 시 사용).
   * false 이면 신규 그리드 UI 전부 미노출(기존 캘린더 무회귀).
   */
  weekly_grid_enabled: false,
} as const;
