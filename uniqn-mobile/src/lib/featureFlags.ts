/**
 * UNIQN Mobile - Feature Flags
 *
 * @description 기능 출시 단계 게이트 (PR #4 — workspace collaboration)
 * @version 1.0.0
 *
 * 정책:
 *  - 권한 단일 진실은 RLS. 본 플래그는 UI 노출 + 일부 흐름 가드 용도.
 *  - 환경 변수 EXPO_PUBLIC_<FLAG_NAME>=false 로 빌드 타임 비활성화 가능.
 *  - 배포 후 ON/OFF 전환은 새 빌드 필요 (서버 사이드 토글이 필요하면 app_config 도입 후속 PR).
 */

function parseBoolean(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === null || raw === '') {
    return defaultValue;
  }
  const lowered = String(raw).toLowerCase().trim();
  if (lowered === 'false' || lowered === '0' || lowered === 'no' || lowered === 'off') {
    return false;
  }
  if (lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on') {
    return true;
  }
  return defaultValue;
}

export const featureFlags = {
  /**
   * 공고 워크스페이스 협업 편집 (PR #1~#5)
   *
   * - true: 워크스페이스 UI 노출, RLS 새 정책 활성 (M2 백필 완료 후)
   * - false: 기존 owner_id 단독 흐름 (병행 동작)
   *
   * 배포 단계:
   *  Day 0 — staging 적용 + regression 확인
   *  Day 1-3 — 내부 admin 만 (env override OFF in production until verified)
   *  Day 4-7 — review-employer + 베타 employer
   *  Day 8+ — 점진적 활성화 (10% → 50% → 100%)
   */
  WORKSPACE_COLLABORATION_ENABLED: parseBoolean(
    process.env.EXPO_PUBLIC_WORKSPACE_COLLABORATION_ENABLED,
    true
  ),
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return featureFlags[flag];
}
