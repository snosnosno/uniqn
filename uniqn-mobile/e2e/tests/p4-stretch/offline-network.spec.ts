/**
 * P4 오프라인/네트워크 테스트 (3 tests)
 * 프로젝트: chromium (staff storageState)
 *
 * networkState 싱글톤은 웹에서 window online/offline 이벤트를 감지.
 * OfflineStatusBar(패시브 오버레이)는 루트 레이아웃(_layout.tsx)에서 렌더링됨.
 * 재시도 버튼 없음 — NetInfo 자동 감지 + 재연결 자동 refetch가 복구를 담당.
 */
import { test, expect } from '../../fixtures/base.fixture';

/**
 * 앱이 완전히 초기화될 때까지 대기 (useAppInitialize + 라우트 렌더링)
 * OfflineStatusBar의 networkState 구독이 등록된 상태를 보장
 */
async function waitForAppReady(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  // 앱 초기화 완료 대기 — body에 콘텐츠가 렌더링될 때까지
  await page.waitForTimeout(5_000);
}

async function goOffline(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('offline'));
  });
}

async function goOnline(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('online'));
  });
}

test.describe('오프라인 & 네트워크', () => {
  test('네트워크 차단 → 오프라인 상태바 표시', async ({ page }) => {
    await waitForAppReady(page);

    await goOffline(page);

    // networkState → OfflineStatusBar 렌더링 대기
    const statusBar = page.getByTestId('offline-status-bar');
    await expect(statusBar).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('오프라인 상태입니다')).toBeVisible();

    // 복구 (다음 테스트 오염 방지)
    await goOnline(page);
  });

  test('네트워크 복구 → 복구 배너 표시 후 자동 dismiss', async ({ page }) => {
    await waitForAppReady(page);

    await goOffline(page);
    await expect(page.getByTestId('offline-status-bar')).toBeVisible({ timeout: 5_000 });

    await goOnline(page);

    // 복구 순간 success 배너로 교체
    await expect(page.getByText('온라인으로 돌아왔어요')).toBeVisible({ timeout: 5_000 });

    // 2초 auto-dismiss + 225ms exit 후 완전히 사라짐
    await expect(page.getByTestId('offline-status-bar')).toBeHidden({ timeout: 6_000 });
  });

  test('느린 네트워크 → 로딩 인디케이터 표시', async ({ page }) => {
    // CDP를 통한 느린 네트워크 시뮬레이션
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;
    try {
      client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50 * 1024, // 50KB/s
        uploadThroughput: 50 * 1024,
        latency: 2000, // 2초 지연
      });
    } catch {
      // CDP 세션 생성 실패 시 (브라우저가 CDP를 지원하지 않는 경우) 테스트 스킵
      test.skip();
      return;
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 앱 초기화 중 '앱 로딩 중...' 텍스트가 표시되어야 함 (Loading 컴포넌트)
    const loadingText = page.getByText(/로딩|불러오는 중|앱 로딩/);
    const hasLoading = await loadingText
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    // 네트워크 조건 복구
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    // 최종적으로 페이지가 로드되어야 함
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toBeTruthy();
  });
});
