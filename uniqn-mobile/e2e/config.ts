/**
 * E2E 테스트 공유 설정
 * CI workflow(e2e.yml)에서도 동일한 값을 사용하므로 변경 시 동기화 필요
 */
export const E2E_CONFIG = {
  /** Firebase 프로젝트 ID */
  projectId: 'tholdem-ebc18',

  /** 에뮬레이터 호스트 설정 */
  emulator: {
    authHost: 'localhost:9099',
    firestoreHost: 'localhost:8080',
  },
} as const;
