/**
 * 빌드 정체성이 계측을 죽이지 않는가 (감사 testgap-01)
 *
 * @description `expo-updates` 는 dev 클라이언트·Expo Go·웹에서 비활성이고, 필드 접근
 *   자체가 던지는 경로가 있다. 계측 때문에 앱이 죽으면 본말전도이므로 "무슨 일이 있어도
 *   객체를 돌려준다"를 계약으로 못박는다.
 */

import { getBuildIdentity, getSentryRelease } from '../buildIdentity';

const mockUpdates: {
  updateId: string | null;
  channel: string | null;
  isEmbeddedLaunch: boolean;
} = {
  updateId: null,
  channel: null,
  isEmbeddedLaunch: true,
};

jest.mock('expo-updates', () => ({
  get updateId() {
    return mockUpdates.updateId;
  },
  get channel() {
    return mockUpdates.channel;
  },
  get isEmbeddedLaunch() {
    return mockUpdates.isEmbeddedLaunch;
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.6',
      runtimeVersion: '1.0.6',
      ios: { buildNumber: '12' },
      android: { versionCode: 12 },
      extra: { environment: 'production' },
    },
  },
}));

describe('getBuildIdentity', () => {
  beforeEach(() => {
    mockUpdates.updateId = null;
    mockUpdates.channel = null;
    mockUpdates.isEmbeddedLaunch = true;
  });

  it('앱 버전·런타임 버전을 expoConfig 에서 읽는다', () => {
    const identity = getBuildIdentity();

    expect(identity.appVersion).toBe('1.0.6');
    expect(identity.runtimeVersion).toBe('1.0.6');
  });

  it('OTA 번들이 적용됐으면 updateId 와 채널을 실어 나른다', () => {
    mockUpdates.updateId = 'update-abc';
    mockUpdates.channel = 'production';
    mockUpdates.isEmbeddedLaunch = false;

    const identity = getBuildIdentity();

    expect(identity.otaUpdateId).toBe('update-abc');
    expect(identity.otaChannel).toBe('production');
    expect(identity.isEmbeddedLaunch).toBe(false);
  });

  it('expo-updates 필드가 던져도 앱을 죽이지 않고 null 로 떨어진다', () => {
    Object.defineProperty(mockUpdates, 'updateId', {
      get() {
        throw new Error('UpdatesModule is not available');
      },
      configurable: true,
    });

    expect(() => getBuildIdentity()).not.toThrow();
    expect(getBuildIdentity().otaUpdateId).toBeNull();

    // 다음 테스트를 위해 평범한 값 프로퍼티로 되돌린다
    Object.defineProperty(mockUpdates, 'updateId', {
      value: null,
      writable: true,
      configurable: true,
    });
  });

  it('OTA 상태를 못 읽으면 내장(embedded)으로 보수적으로 판정한다', () => {
    Object.defineProperty(mockUpdates, 'isEmbeddedLaunch', {
      get() {
        throw new Error('UpdatesModule is not available');
      },
      configurable: true,
    });

    // 과대 보고하지 않는 방향 — "OTA 가 닿았다"고 잘못 세면 롤아웃 판단이 뒤집힌다
    expect(getBuildIdentity().isEmbeddedLaunch).toBe(true);

    Object.defineProperty(mockUpdates, 'isEmbeddedLaunch', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('Sentry release 는 프로젝트@버전 관례 형식이다', () => {
    expect(getSentryRelease()).toBe('uniqn@1.0.6');
  });
});
