/**
 * UNIQN Mobile — Feature Flags
 *
 * 배포 안전망: 값을 false로 바꾸면 OTA(EAS Update)로 즉시 롤백 가능.
 */

// 키 이름은 원격 플래그(app_config) 계약과 1:1 일치해야 하므로 snake_case 를 유지한다.
// (프로젝트 camelCase 규칙의 의도된 예외 — 원격 값과의 매칭 정합성 우선)
export const featureFlags = {
  /**
   * 근무표 활성화. 빌드타임 fallback(원격 app_config.weekly_grid_enabled 부재·오류 시 사용).
   *
   * 키 이름의 `weekly_grid` 는 원격 app_config 행의 키와 1:1 로 맞물린 **레거시 DB 계약**이다.
   * 도메인은 workSchedule 로 리네이밍(2026-07-27)했지만 이 키만은 그대로 둔다 — 코드에서만
   * 바꾸면 신 빌드가 없는 행을 조회해 조용히 fallback 으로 떨어진다.
   *
   * fallback=true 인 이유: 원격 플래그는 2026-07-19 부터 ON 이라 이 기능은 이미 출시돼 있다.
   * fallback 이 false 면 원격 조회가 실패하는 순간(오프라인·네트워크 불안) 이미 쓰던 근무표가
   * 사라지고 화면이 튕긴다. 원격 값 false 는 여전히 그대로 반영되므로 kill switch 는 유지된다.
   */
  weekly_grid_enabled: true,
  /**
   * ops 라이브 운영 허브 진입 표면 활성화. 빌드타임 fallback(원격 app_config.ops_hub_enabled 부재·오류 시 사용).
   * false 이면 진입 표면(발견 동선) 전부 미노출(직접 라우트는 유지).
   */
  ops_hub_enabled: false,
} as const;
