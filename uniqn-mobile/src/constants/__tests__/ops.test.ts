/**
 * ops 공개 링크 origin 회귀 테스트.
 *
 * 이력: 2026-08-07 에는 `ops.uniqn.app` 이 만들어지지 않아(DNS 미해석) 메인 웹앱 origin 으로
 * 폴백했다. ops 웹 개통(W8)으로 공개뷰 정본이 `ops.uniqn.app` 으로 옮겨졌고, 이 테스트가
 * ①네이티브·운영 웹은 정본 도메인 ②로컬 개발은 자기 origin ③env 탈출구 우선을 고정한다.
 */
import { Platform } from 'react-native';
import {
  OPS_WEB_ORIGIN,
  getOpsBaseUrl,
  getOpsMonitorUrl,
  getOpsPlayerUrl,
  getOpsWebOrigin,
} from '@/constants/ops';
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

describe('네이티브', () => {
  it('정본 ops 도메인으로 링크를 만든다', () => {
    setPlatform('ios');

    expect(OPS_WEB_ORIGIN).toBe('https://ops.uniqn.app');
    expect(getOpsBaseUrl()).toBe(OPS_WEB_ORIGIN);
    expect(getOpsMonitorUrl('tok')).toBe('https://ops.uniqn.app/monitor/tok');
    expect(getOpsPlayerUrl('tok')).toBe('https://ops.uniqn.app/live/tok');
  });

  it('env 가 던져도 정본 도메인으로 흡수한다', () => {
    setPlatform('android');
    mockGetEnv.mockImplementation(() => {
      throw new Error('env not initialized');
    });

    expect(getOpsBaseUrl()).toBe(OPS_WEB_ORIGIN);
    expect(getOpsWebOrigin()).toBe(OPS_WEB_ORIGIN);
  });

  it('EXPO_PUBLIC_OPS_URL 이 설정되면 그 값을 우선한다(탈출구)', () => {
    setPlatform('ios');
    mockGetEnv.mockReturnValue({
      EXPO_PUBLIC_OPS_URL: 'https://ops.example.com',
    } as ReturnType<typeof getEnv>);

    expect(getOpsMonitorUrl('tok')).toBe('https://ops.example.com/monitor/tok');
  });
});

describe('웹', () => {
  function setOrigin(origin: string): void {
    setPlatform('web');
    (globalThis as { window?: unknown }).window = { location: { origin } };
  }

  it('운영 웹(uniqn.app)에서도 정본 도메인으로 링크를 만든다 — 옛 경로 302 를 거치지 않게', () => {
    setOrigin('https://uniqn.app');

    expect(getOpsPlayerUrl('tok')).toBe('https://ops.uniqn.app/live/tok');
  });

  it('프리뷰 호스트도 정본 도메인을 쓴다(프리뷰의 /monitor 도 302 로 넘어간다)', () => {
    setOrigin('https://abc.uniqn-app.pages.dev');

    expect(getOpsWebOrigin()).toBe(OPS_WEB_ORIGIN);
  });

  it.each(['http://localhost:8081', 'http://127.0.0.1:8081'])(
    '로컬 개발(%s)은 자기 origin 으로 링크를 만든다',
    (origin) => {
      setOrigin(origin);

      expect(getOpsMonitorUrl('tok')).toBe(`${origin}/monitor/tok`);
    }
  );

  it('호스트명에 localhost 가 들어갈 뿐인 외부 도메인은 로컬로 보지 않는다', () => {
    setOrigin('https://localhost.evil.example');

    expect(getOpsWebOrigin()).toBe(OPS_WEB_ORIGIN);
  });

  it('로컬 개발이어도 EXPO_PUBLIC_OPS_URL 이 있으면 그 값을 쓴다', () => {
    setOrigin('http://localhost:8081');
    mockGetEnv.mockReturnValue({
      EXPO_PUBLIC_OPS_URL: 'http://localhost:5173',
    } as ReturnType<typeof getEnv>);

    expect(getOpsWebOrigin()).toBe('http://localhost:5173');
  });

  it('window 가 없는 웹 SSR 경로에서는 정본 도메인을 쓴다', () => {
    setPlatform('web');

    expect(getOpsWebOrigin()).toBe(OPS_WEB_ORIGIN);
  });
});
