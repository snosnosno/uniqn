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

describe('핵심 퍼널 영속 레일 (마이그 20260923100000)', () => {
  it('핵심 퍼널 이벤트는 브레드크럼과 함께 서버에도 기록된다', async () => {
    await trackEvent('job_apply', { job_id: 'job-1', job_role: 'dealer' });

    expect(mockLeaveBreadcrumb).toHaveBeenCalledWith('analytics:job_apply', {
      job_id: 'job-1',
      job_role: 'dealer',
    });
    expect(mockInsert).toHaveBeenCalledWith('job_apply', { job_id: 'job-1', job_role: 'dealer' });
  });

  it('서버에는 화이트리스트 키만 싣는다 — 제목·금액 같은 자유 텍스트/개인 값은 빠진다', async () => {
    await trackEvent('settlement_complete', {
      settlement_amount: 150000,
      settlement_count: 3,
      job_title: '주말 딜러',
    });

    // 브레드크럼(에러 맥락)에는 그대로 남는다
    expect(mockLeaveBreadcrumb).toHaveBeenCalledWith('analytics:settlement_complete', {
      settlement_amount: 150000,
      settlement_count: 3,
      job_title: '주말 딜러',
    });
    // 서버(보존 기한 없는 계측 테이블)에는 건수만
    expect(mockInsert).toHaveBeenCalledWith('settlement_complete', { settlement_count: 3 });
  });

  it('핵심 퍼널 8종 전부가 서버 레일을 탄다 (서버 CHECK 화이트리스트와 1:1)', async () => {
    const events = [
      'signup',
      'login',
      'job_view',
      'job_apply',
      'job_create',
      'check_in',
      'check_out',
      'settlement_complete',
    ];
    for (const event of events) {
      await trackEvent(event);
    }

    expect(mockInsert.mock.calls.map(([event]) => event)).toEqual(events);
  });

  it('핵심 퍼널 밖 이벤트는 서버로 보내지 않는다 (서버가 거부할 값을 쏘지 않는다)', async () => {
    await trackEvent('search', { search_term: '홀덤펍' });
    await trackEvent('notification_click', { type: 'x' });
    await trackEvent('job_shared', { job_id: 'job-1' });

    expect(mockLeaveBreadcrumb).toHaveBeenCalledTimes(3);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('분석이 꺼져 있으면 서버에도 보내지 않는다', async () => {
    setAnalyticsEnabled(false);
    try {
      await trackEvent('login', { method: 'email' });
    } finally {
      setAnalyticsEnabled(true);
    }

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('서버 기록이 실패해도 trackEvent 는 던지지 않는다', async () => {
    mockInsert.mockImplementation(() => Promise.reject(new Error('offline')));

    await expect(trackEvent('login', { method: 'email' })).resolves.toBeUndefined();
  });
});
