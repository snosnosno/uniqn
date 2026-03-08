/**
 * Playwright Global Teardown
 * - 에뮬레이터 데이터 정리 (선택적)
 */
async function globalTeardown() {
  // 에뮬레이터는 프로세스 종료 시 자동 정리됨
  // 필요 시 여기서 에뮬레이터 데이터를 명시적으로 초기화할 수 있음
}

export default globalTeardown;
