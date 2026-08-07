/**
 * ops 공개 링크 origin 회귀 테스트.
 *
 * 배경(2026-08-07): 네이티브 폴백이 `https://ops.uniqn.app` 였는데 그 도메인은 끝내 만들어지지
 * 않았다(DNS 미해석). 운영 앱에서 공유한 전광판 링크·플레이어 QR 이 열리지 않는 결함이라
 * 폴백을 메인 웹앱 origin 으로 되돌렸고, 그 상태를 이 테스트가 고정한다.
 */
import { Platform } from 'react-native';
import { APP_WEB_ORIGIN } from '@/constants/appUrl';
import { getOpsBaseUrl, getOpsMonitorUrl, getOpsPlayerUrl, getOpsWebOrigin } from '@/constants/ops';
import { getEnv } from '@/lib/env';

jest.mock('@/lib/env', () => ({
  getEnv: jest.fn(() => ({})),
}));

const mockGetEnv = getEnv as jest.MockedFunction<typeof getEnv>;
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatform(os: string): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

afterEach(() => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
  }
  delete (globalThis as { window?: unknown }).window;
  mockGetEnv.mockReturnValue({} as ReturnType<typeof getEnv>);
});

describe('네이티브 폴백', () => {
  it('EXPO_PUBLIC_OPS_URL 미설정이면 메인 웹앱 origin 을 쓴다', () => {
    setPlatform('ios');

    expect(getOpsBaseUrl()).toBe(APP_WEB_ORIGIN);
    expect(getOpsWebOrigin()).toBe(APP_WEB_ORIGIN);
  });

  it('만들어지지 않은 ops 전용 도메인으로 링크를 만들지 않는다(회귀 가드)', () => {
    setPlatform('android');

    expect(getOpsMonitorUrl('tok')).toBe(`${APP_WEB_ORIGIN}/monitor/tok`);
    expect(getOpsPlayerUrl('tok')).toBe(`${APP_WEB_ORIGIN}/live/tok`);
    expect(getOpsMonitorUrl('tok')).not.toContain('ops.uniqn.app');
    expect(getOpsPlayerUrl('tok')).not.toContain('ops.uniqn.app');
  });

  it('env 가 던져도 메인 웹앱 origin 으로 흡수한다', () => {
    setPlatform('ios');
    mockGetEnv.mockImplementation(() => {
      throw new Error('env not initialized');
    });

    expect(getOpsBaseUrl()).toBe(APP_WEB_ORIGIN);
  });

  it('EXPO_PUBLIC_OPS_URL 이 설정되면 그 값을 우선한다(별도 도메인 탈출구)', () => {
    setPlatform('ios');
    mockGetEnv.mockReturnValue({
      EXPO_PUBLIC_OPS_URL: 'https://ops.example.com',
    } as ReturnType<typeof getEnv>);

    expect(getOpsMonitorUrl('tok')).toBe('https://ops.example.com/monitor/tok');
  });
});

describe('웹 origin 우선', () => {
  it('실제 서빙 origin 으로 링크를 만든다(어느 배포 호스트에서 열든)', () => {
    setPlatform('web');
    (globalThis as { window?: unknown }).window = {
      location: { origin: 'https://uniqn-app.pages.dev' },
    };

    expect(getOpsWebOrigin()).toBe('https://uniqn-app.pages.dev');
    expect(getOpsPlayerUrl('tok')).toBe('https://uniqn-app.pages.dev/live/tok');
  });

  it('window 가 없는 웹 SSR 경로에서는 폴백을 쓴다', () => {
    setPlatform('web');

    expect(getOpsWebOrigin()).toBe(APP_WEB_ORIGIN);
  });
});
