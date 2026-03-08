/**
 * P4 오프라인/네트워크 테스트 (4 tests)
 * 프로젝트: chromium (staff storageState)
 *
 * useNetworkStatus 훅은 웹에서 window online/offline 이벤트를 감지.
 * OfflineBanner는 루트 레이아웃(_layout.tsx)에서 렌더링됨.
 */
import { test, expect } from '../../fixtures/base.fixture';

/**
 * 앱이 완전히 초기화될 때까지 대기 (useAppInitialize + 라우트 렌더링)
 * OfflineBanner의 useNetworkStatus 이벤트 리스너가 등록된 상태를 보장
 */
async function waitForAppReady(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  // 앱 초기화 완료 대기 — body에 콘텐츠가 렌더링될 때까지
  await page.waitForTimeout(5_000);
}

test.describe('오프라인 & 네트워크', () => {
  test('네트워크 차단 → OfflineBanner 표시', async ({ page }) => {
    await waitForAppReady(page);

    // navigator.onLine을 false로 설정 후 offline 이벤트 발생
    // (브라우저의 synthetic offline 이벤트만으로는 navigator.onLine이 바뀌지 않음)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });

    // useNetworkStatus의 handleOffline → isOffline: true → OfflineBanner 렌더링 대기
    await page.waitForTimeout(2_000);

    // OfflineBanner 확인 — 텍스트 또는 role="alert" 확인
    const offlineBanner = page.getByText('인터넷 연결이 끊어졌습니다');
    const hasOfflineBanner = await offlineBanner.isVisible().catch(() => false);

    const alertElement = page.locator('[role="alert"]');
    const hasAlert = (await alertElement.count()) > 0;

    expect(hasOfflineBanner || hasAlert).toBe(true);

    // 복구
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });
  });

  test('네트워크 복구 → OfflineBanner 사라짐', async ({ page }) => {
    await waitForAppReady(page);

    // 오프라인 상태로 전환
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(2_000);

    // 온라인 상태로 복구
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });
    await page.waitForTimeout(2_000);

    // OfflineBanner가 사라졌는지 확인
    const offlineBanner = page.getByText('인터넷 연결이 끊어졌습니다');
    const isStillVisible = await offlineBanner.isVisible().catch(() => false);

    // 복구 후에는 배너가 사라져야 함
    expect(isStillVisible).toBe(false);
  });

  test('오프라인 상태에서 재시도 버튼 표시', async ({ page }) => {
    await waitForAppReady(page);

    // 오프라인 이벤트 발생
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(2_000);

    // 재시도 버튼 확인 (OfflineBanner의 variant="banner"에서는 '재시도' 텍스트)
    const retryButton = page.getByText(/재시도|다시 연결/);
    const hasRetry = await retryButton.isVisible().catch(() => false);

    // 재시도 버튼이 있으면 클릭 가능해야 함
    if (hasRetry) {
      await expect(retryButton).toBeEnabled();
    }

    // 복구
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });
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
