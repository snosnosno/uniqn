/**
 * 계측이 프로덕션에서 실제로 무언가를 하는가 (감사 testgap-01)
 *
 * @description 예전에는 `trackEvent`·`trackScreenView`·`setUserId` 의 본문이 통째로
 *   `if (__DEV__)` 안에 있었다. 즉 출시 빌드에서 이 함수들은 **문자 그대로 아무 일도
 *   하지 않았고**, 앱 전역에 흩뿌려진 호출부 전부가 죽은 배선이었다.
 *
 *   이 파일은 그 상태로 되돌아가지 못하게 막는다. `__DEV__` 를 false 로 강제한
 *   상태에서 프로덕션 레일(Sentry 브레드크럼 · 서버 이벤트)이 실제로 불리는지 본다.
 */

import {
  trackEvent,
  trackScreenView,
  setUserId,
  setUserProperties,
  setAnalyticsEnabled,
  reportAppSessionStart,
  resetAppSessionStartForTests,
} from '../analyticsService';

const mockLeaveBreadcrumb = jest.fn();
const mockSetSentryAttributes = jest.fn();
const mockSetSentryUserId = jest.fn();
const mockInsert = jest.fn();

jest.mock('../sentryService', () => ({
  leaveBreadcrumb: (...args: unknown[]) => mockLeaveBreadcrumb(...args),
  setAttributes: (...args: unknown[]) => mockSetSentryAttributes(...args),
  setUserId: (...args: unknown[]) => mockSetSentryUserId(...args),
}));

jest.mock('@/repositories/supabase/AnalyticsEventRepository', () => ({
  analyticsEventRepository: {
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

jest.mock('../buildIdentity', () => ({
  getBuildIdentity: () => ({
    appVersion: '1.0.6',
    buildNumber: '12',
    runtimeVersion: '1.0.6',
    platform: 'ios',
    otaUpdateId: 'update-abc',
    otaChannel: 'production',
    isEmbeddedLaunch: false,
  }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// 출시 빌드를 흉내낸다 — 이 파일의 요점 전체가 "DEV 가 아닐 때"의 동작이다.
const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

beforeAll(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
});

afterAll(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
});

beforeEach(() => {
  jest.clearAllMocks();
  resetAppSessionStartForTests();
  // 실제 repository.insert 는 async 라 항상 Promise 를 돌려준다 — 목도 그래야
  // 호출부의 `.catch` 배선을 정직하게 검증할 수 있다.
  mockInsert.mockResolvedValue(undefined);
});

describe('프로덕션 계측 레일', () => {
  it('trackEvent 가 출시 빌드에서 브레드크럼을 남긴다 (더 이상 no-op 아님)', async () => {
    await trackEvent('job_apply', { job_id: 'job-1', job_title: '딜러 모집' });

    expect(mockLeaveBreadcrumb).toHaveBeenCalledWith('analytics:job_apply', {
      job_id: 'job-1',
      job_title: '딜러 모집',
    });
  });

  it('undefined 파라미터는 브레드크럼에서 걸러진다', async () => {
    await trackEvent('job_view', { job_id: 'job-1', job_title: undefined });

    expect(mockLeaveBreadcrumb).toHaveBeenCalledWith('analytics:job_view', { job_id: 'job-1' });
  });

  it('trackScreenView 가 출시 빌드에서 화면 전환을 남긴다', async () => {
    await trackScreenView('JobDetail', 'jobs/[id]');

    expect(mockLeaveBreadcrumb).toHaveBeenCalledWith('analytics:screen_view', {
      screen: 'JobDetail',
      class: 'jobs/[id]',
    });
  });

  it('setUserId 가 Sentry 사용자에 배선된다 (에러가 특정 사용자 한정인지 판별)', async () => {
    await setUserId('user-1');

    expect(mockSetSentryUserId).toHaveBeenCalledWith('user-1');
  });

  it('setUserProperties 가 비-PII 축을 태그로 올린다', async () => {
    await setUserProperties({ user_role: 'employer', total_jobs_posted: 3 });

    expect(mockSetSentryAttributes).toHaveBeenCalledWith({
      user_user_role: 'employer',
      user_total_jobs_posted: '3',
    });
  });

  it('계측이 비활성이면 아무 레일도 타지 않는다', async () => {
    setAnalyticsEnabled(false);

    await trackEvent('job_view', { job_id: 'job-1' });
    expect(mockLeaveBreadcrumb).not.toHaveBeenCalled();

    setAnalyticsEnabled(true);
  });
});

describe('reportAppSessionStart — 롤아웃 계기판', () => {
  it('앱버전·빌드·OTA 번들을 서버 레일에 기록한다', () => {
    reportAppSessionStart();

    expect(mockInsert).toHaveBeenCalledWith('app_session_start', {
      v: '1.0.6',
      build: '12',
      rt: '1.0.6',
      platform: 'ios',
      ota: 'update-abc',
      channel: 'production',
    });
  });

  it('세션당 정확히 1회만 기록한다 (리마운트로 늘지 않는다)', () => {
    reportAppSessionStart();
    reportAppSessionStart();
    reportAppSessionStart();

    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('서버 기록이 실패해도 던지지 않는다 (계측이 앱을 막지 않는다)', () => {
    mockInsert.mockImplementation(() => Promise.reject(new Error('offline')));

    expect(() => reportAppSessionStart()).not.toThrow();
  });
});
