/**
 * UNIQN Mobile - Deep Link Service 테스트
 *
 * @description deepLinkService.ts의 전체 기능 테스트
 */

import { Platform } from 'react-native';
import { deepLinkService } from '../deepLinkService';
import type { NotificationType } from '@/types/notification';

// ============================================================================
// Mocks
// ============================================================================

// router 모킹
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterCanGoBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
    replace: mockRouterReplace,
    canGoBack: mockRouterCanGoBack,
  },
}));

// Linking 모킹
const mockAddEventListener = jest.fn();
const mockGetInitialURL = jest.fn();
const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Linking: {
    addEventListener: mockAddEventListener,
    getInitialURL: mockGetInitialURL,
    canOpenURL: mockCanOpenURL,
    openURL: mockOpenURL,
  },
  Platform: {
    OS: 'ios',
  },
}));

// logger 모킹
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerDebug = jest.fn();

jest.mock('@/utils/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  },
}));

// analyticsService 모킹
const mockTrackEvent = jest.fn();

jest.mock('../analyticsService', () => ({
  trackEvent: mockTrackEvent,
}));

// Shared 모듈 모킹
const mockRouteMapper = {
  toExpoPath: jest.fn((route: { name: string; params?: Record<string, string> }) => {
    if (route.name === 'home') return '/(app)/(tabs)';
    if (route.name === 'jobs') return '/(public)/jobs';
    if (route.name === 'job') return `/(public)/jobs/${route.params?.id}`;
    if (route.name === 'notifications') return '/(app)/notifications';
    if (route.name === 'schedule') return '/(app)/(tabs)/schedule';
    if (route.name === 'profile') return '/(app)/(tabs)/profile';
    if (route.name === 'settings') return '/(app)/settings';
    if (route.name === 'support') return '/(app)/support';
    if (route.name === 'notices') return '/(app)/notices';
    if (route.name === 'employer/my-postings') return '/(employer)/my-postings';
    if (route.name === 'employer/posting') return `/(employer)/my-postings/${route.params?.id}`;
    if (route.name === 'employer/applicants') {
      return `/(employer)/applicants/${route.params?.jobId}`;
    }
    if (route.name === 'employer/settlement') {
      return `/(employer)/settlement/${route.params?.jobId}`;
    }
    if (route.name === 'admin/dashboard') return '/(admin)';
    if (route.name === 'admin/reports') return '/(admin)/reports';
    if (route.name === 'admin/report') return `/(admin)/reports/${route.params?.id}`;
    if (route.name === 'admin/inquiries') return '/(admin)/inquiries';
    if (route.name === 'admin/inquiry') return `/(admin)/inquiries/${route.params?.id}`;
    if (route.name === 'admin/tournaments') return '/(admin)/tournaments';
    return '/(app)/(tabs)';
  }),
};

const mockNotificationRouteMap: Record<
  string,
  (data?: Record<string, string>) => { name: string; params?: Record<string, string> }
> = {
  new_application: (data) => ({
    name: 'employer/applicants',
    params: { jobId: data?.jobPostingId || '' },
  }),
  application_confirmed: (_data) => ({ name: 'schedule' }),
  settlement_completed: (_data) => ({ name: 'schedule' }),
  job_updated: (data) => ({ name: 'job', params: { id: data?.jobPostingId || '' } }),
  announcement: () => ({ name: 'notices' }),
  new_report: (data) => ({ name: 'admin/report', params: { id: data?.reportId || '' } }),
};

jest.mock('@/shared/deeplink', () => ({
  RouteMapper: mockRouteMapper,
  NOTIFICATION_ROUTE_MAP: mockNotificationRouteMap,
}));

// ============================================================================
// Test Suites
// ============================================================================

describe('deepLinkService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    mockRouterCanGoBack.mockReturnValue(true);
  });

  // ==========================================================================
  // validateNotificationLink Tests
  // ==========================================================================

  describe('validateNotificationLink', () => {
    it('유효한 상대 경로를 그대로 반환해야 함', () => {
      const validLinks = [
        '/jobs/123',
        '/notifications',
        '/schedule',
        '/employer/my-postings',
        '/admin/reports/abc',
      ];

      validLinks.forEach((link) => {
        expect(deepLinkService.validateNotificationLink(link)).toBe(link);
      });
    });

    it('빈 문자열이나 undefined는 undefined를 반환해야 함', () => {
      expect(deepLinkService.validateNotificationLink('')).toBeUndefined();
      expect(deepLinkService.validateNotificationLink('   ')).toBeUndefined();
      expect(deepLinkService.validateNotificationLink(undefined)).toBeUndefined();
    });

    it('위험한 패턴을 차단해야 함', () => {
      const dangerousLinks = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'https://evil.com',
        'http://evil.com',
        '/path/with spaces',
        '/path/with<script>',
        '/path?query=value', // 쿼리 파라미터 포함
      ];

      dangerousLinks.forEach((link) => {
        expect(deepLinkService.validateNotificationLink(link)).toBeUndefined();
        expect(mockLoggerWarn).toHaveBeenCalledWith(
          '위험한 알림 링크 차단',
          expect.objectContaining({ reason: 'pattern_mismatch' })
        );
        jest.clearAllMocks();
      });
    });

    it('최대 길이 제한을 넘는 링크를 로깅할 때 잘라야 함', () => {
      const longLink = 'javascript:' + 'a'.repeat(100);

      deepLinkService.validateNotificationLink(longLink);

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '위험한 알림 링크 차단',
        expect.objectContaining({
          link: expect.stringMatching(/^.{50}$/), // 정확히 50자
        })
      );
    });
  });

  // ==========================================================================
  // parseDeepLink Tests
  // ==========================================================================

  describe('parseDeepLink', () => {
    it('Custom Scheme URL을 파싱해야 함', () => {
      const result = deepLinkService.parseDeepLink('uniqn://jobs/123');

      expect(result).toEqual({
        url: 'uniqn://jobs/123',
        path: 'jobs/123',
        queryParams: {},
        route: { name: 'job', params: { id: '123' } },
        isValid: true,
      });
    });

    it('쿼리 파라미터를 포함한 URL을 파싱해야 함', () => {
      const result = deepLinkService.parseDeepLink('uniqn://jobs?jobId=456');

      expect(result).toEqual({
        url: 'uniqn://jobs?jobId=456',
        path: 'jobs',
        queryParams: { jobId: '456' },
        route: { name: 'jobs' },
        isValid: true,
      });
    });

    it('Universal Link를 파싱해야 함', () => {
      const result = deepLinkService.parseDeepLink('https://uniqn.app/notifications');

      expect(result).toEqual({
        url: 'https://uniqn.app/notifications',
        path: '/notifications',
        queryParams: {},
        route: { name: 'notifications' },
        isValid: true,
      });
    });

    it('상대 경로를 파싱해야 함', () => {
      const result = deepLinkService.parseDeepLink('/schedule');

      expect(result).toEqual({
        url: '/schedule',
        path: '/schedule',
        queryParams: {},
        route: { name: 'schedule' },
        isValid: true,
      });
    });

    it('쿼리 파라미터에서 jobId를 추출하여 라우트를 생성해야 함', () => {
      const result = deepLinkService.parseDeepLink('uniqn://unknown?jobId=789');

      expect(result).toEqual({
        url: 'uniqn://unknown?jobId=789',
        path: 'unknown',
        queryParams: { jobId: '789' },
        route: { name: 'job', params: { id: '789' } },
        isValid: true,
      });
    });

    it('알 수 없는 형식은 유효하지 않음으로 표시해야 함', () => {
      const result = deepLinkService.parseDeepLink('invalid-url');

      expect(result).toEqual({
        url: 'invalid-url',
        path: '',
        queryParams: {},
        route: null,
        isValid: false,
      });
    });

    it('파싱 에러 발생 시 유효하지 않은 결과를 반환해야 함', () => {
      // URL 생성자가 에러를 던지도록 유도
      const result = deepLinkService.parseDeepLink('https://[invalid');

      expect(result.isValid).toBe(false);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // navigateToDeepLink Tests
  // ==========================================================================

  describe('navigateToDeepLink', () => {
    it('유효한 딥링크로 네비게이션해야 함', async () => {
      mockRouterPush.mockResolvedValue(undefined);

      const result = await deepLinkService.navigateToDeepLink('uniqn://jobs/123');

      expect(result).toBe(true);
      expect(mockRouterPush).toHaveBeenCalledWith('/(public)/jobs/123');
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'deep_link_navigation',
        expect.objectContaining({ route_name: 'job' })
      );
    });

    it('유효하지 않은 딥링크는 경고를 로깅하고 false를 반환해야 함', async () => {
      const result = await deepLinkService.navigateToDeepLink('invalid-url');

      expect(result).toBe(false);
      expect(mockLoggerWarn).toHaveBeenCalledWith('유효하지 않은 딥링크', { url: 'invalid-url' });
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('네비게이션 실패 시 재시도해야 함', async () => {
      mockRouterPush.mockRejectedValueOnce(new Error('1차 실패')).mockResolvedValue(undefined);

      const result = await deepLinkService.navigateToDeepLink('uniqn://schedule');

      expect(result).toBe(true);
      expect(mockRouterPush).toHaveBeenCalledTimes(2);
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'deeplink 네비게이션 재시도 성공',
        expect.anything()
      );
    });

    it('재시도 실패 시 폴백 라우트로 이동해야 함', async () => {
      mockRouterPush.mockRejectedValue(new Error('실패'));
      mockRouterReplace.mockResolvedValue(undefined);

      const result = await deepLinkService.navigateToDeepLink('uniqn://profile');

      expect(result).toBe(true);
      expect(mockRouterReplace).toHaveBeenCalledWith('/(app)/notifications');
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'notification_navigation_fallback',
        expect.objectContaining({ original_route: 'profile' })
      );
    });

    it('폴백도 실패 시 false를 반환해야 함', async () => {
      mockRouterPush.mockRejectedValue(new Error('push 실패'));
      mockRouterReplace.mockRejectedValue(new Error('replace 실패'));

      const result = await deepLinkService.navigateToDeepLink('uniqn://settings');

      expect(result).toBe(false);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'deeplink 네비게이션 폴백도 실패',
        expect.anything()
      );
    });
  });

  // ==========================================================================
  // getRouteFromNotification Tests
  // ==========================================================================

  describe('getRouteFromNotification', () => {
    it('link 필드가 있으면 link를 우선 사용해야 함', () => {
      const route = deepLinkService.getRouteFromNotification(
        'new_application' as NotificationType,
        undefined,
        '/jobs/999'
      );

      expect(route).toEqual({ name: 'job', params: { id: '999' } });
    });

    it('link가 유효하지 않으면 알림 타입 매핑을 사용해야 함', () => {
      const route = deepLinkService.getRouteFromNotification(
        'new_application' as NotificationType,
        { jobPostingId: '123' },
        'javascript:alert(1)' // 위험한 링크
      );

      expect(route).toEqual({ name: 'employer/applicants', params: { jobId: '123' } });
    });

    it('알림 타입 매핑을 사용해야 함', () => {
      const testCases: Array<{
        type: NotificationType;
        data?: Record<string, string>;
        expected: { name: string; params?: Record<string, string> };
      }> = [
        {
          type: 'new_application' as NotificationType,
          data: { jobPostingId: '123' },
          expected: { name: 'employer/applicants', params: { jobId: '123' } },
        },
        {
          type: 'application_confirmed' as NotificationType,
          expected: { name: 'schedule' },
        },
        {
          type: 'settlement_completed' as NotificationType,
          expected: { name: 'schedule' },
        },
        {
          type: 'job_updated' as NotificationType,
          data: { jobPostingId: '456' },
          expected: { name: 'job', params: { id: '456' } },
        },
        {
          type: 'announcement' as NotificationType,
          expected: { name: 'notices' },
        },
      ];

      testCases.forEach(({ type, data, expected }) => {
        const route = deepLinkService.getRouteFromNotification(type, data);
        expect(route).toEqual(expected);
      });
    });

    it('매핑되지 않은 알림 타입은 알림 목록으로 이동해야 함', () => {
      const route = deepLinkService.getRouteFromNotification(
        'unknown_type' as NotificationType,
        undefined
      );

      expect(route).toEqual({ name: 'notifications' });
    });
  });

  // ==========================================================================
  // navigateFromNotification Tests
  // ==========================================================================

  describe('navigateFromNotification', () => {
    it('알림에서 올바른 라우트로 네비게이션해야 함', async () => {
      mockRouterPush.mockResolvedValue(undefined);

      const result = await deepLinkService.navigateFromNotification(
        'new_application' as NotificationType,
        { jobPostingId: '123' }
      );

      expect(result).toBe(true);
      expect(mockRouterPush).toHaveBeenCalled();
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'notification_click',
        expect.objectContaining({ notification_type: 'new_application' })
      );
    });

    it('라우트를 찾을 수 없으면 false를 반환해야 함', async () => {
      // getRouteFromNotification이 null을 반환하도록 모킹
      jest.spyOn(deepLinkService, 'getRouteFromNotification').mockReturnValueOnce(null);

      const result = await deepLinkService.navigateFromNotification(
        'unknown_type' as NotificationType
      );

      expect(result).toBe(false);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '알림에 대한 라우트를 찾을 수 없음',
        expect.objectContaining({ type: 'unknown_type' })
      );
    });
  });

  // ==========================================================================
  // createDeepLink Tests
  // ==========================================================================

  describe('createDeepLink', () => {
    it('Custom Scheme 딥링크를 생성해야 함', () => {
      const link = deepLinkService.createDeepLink({ name: 'jobs' });

      expect(link).toBe('uniqn://jobs');
    });

    it('파라미터가 있는 딥링크를 생성해야 함', () => {
      const link = deepLinkService.createDeepLink({ name: 'job', params: { id: '123' } });

      expect(link).toBe('uniqn://jobs/123');
    });

    it('웹 URL을 생성할 수 있어야 함', () => {
      const link = deepLinkService.createDeepLink({ name: 'schedule' }, { useWebUrl: true });

      expect(link).toBe('https://uniqn.app/schedule');
    });

    it('라우트 그룹을 제거해야 함', () => {
      mockRouteMapper.toExpoPath.mockReturnValueOnce('/(app)/(tabs)');
      const link = deepLinkService.createDeepLink({ name: 'home' });

      // /(app)/(tabs) → home
      expect(link).toBe('uniqn://home');
    });

    it('빈 경로는 home으로 폴백해야 함', () => {
      mockRouteMapper.toExpoPath.mockReturnValueOnce('/');
      const link = deepLinkService.createDeepLink({ name: 'home' });

      expect(link).toBe('uniqn://home');
    });
  });

  describe('createJobDeepLink', () => {
    it('공고 딥링크를 생성해야 함', () => {
      const link = deepLinkService.createJobDeepLink('job123');

      expect(link).toBe('uniqn://jobs/job123');
    });

    it('웹 URL 공고 링크를 생성할 수 있어야 함', () => {
      const link = deepLinkService.createJobDeepLink('job456', true);

      expect(link).toBe('https://uniqn.app/jobs/job456');
    });
  });

  // ==========================================================================
  // waitForNavigationReady Tests
  // ==========================================================================

  describe('waitForNavigationReady', () => {
    it('네비게이션이 준비되면 즉시 콜백을 호출해야 함', () => {
      jest.useFakeTimers();
      mockRouterCanGoBack.mockReturnValue(true);

      const mockCallback = jest.fn();
      deepLinkService.waitForNavigationReady(mockCallback);

      jest.advanceTimersByTime(100);

      expect(mockCallback).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('네비게이션이 준비되지 않으면 재시도해야 함', () => {
      jest.useFakeTimers();
      mockRouterCanGoBack
        .mockImplementationOnce(() => {
          throw new Error('Not ready');
        })
        .mockImplementationOnce(() => {
          throw new Error('Not ready');
        })
        .mockReturnValue(true);

      const mockCallback = jest.fn();
      deepLinkService.waitForNavigationReady(mockCallback);

      // 2번 실패 후 성공
      jest.advanceTimersByTime(300);

      expect(mockCallback).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('최대 재시도 횟수 초과 시 강제 실행해야 함', () => {
      jest.useFakeTimers();
      mockRouterCanGoBack.mockImplementation(() => {
        throw new Error('Never ready');
      });

      const mockCallback = jest.fn();
      deepLinkService.waitForNavigationReady(mockCallback);

      // 50회 재시도 = 5초
      jest.advanceTimersByTime(5000);

      expect(mockCallback).toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '콜드 스타트 네비게이션: 최대 대기 초과, 강제 실행',
        expect.objectContaining({ retries: 50 })
      );
      jest.useRealTimers();
    });
  });

  describe('waitForNavigationReadyAsync', () => {
    it('Promise를 반환하고 준비되면 resolve해야 함', async () => {
      jest.useFakeTimers();
      mockRouterCanGoBack.mockReturnValue(true);

      const promise = deepLinkService.waitForNavigationReadyAsync();

      jest.advanceTimersByTime(100);

      await expect(promise).resolves.toBeUndefined();
      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // setupDeepLinkListener Tests
  // ==========================================================================

  describe('setupDeepLinkListener', () => {
    it('딥링크 리스너를 등록해야 함', () => {
      const mockRemove = jest.fn();
      mockAddEventListener.mockReturnValue({ remove: mockRemove });
      mockGetInitialURL.mockResolvedValue(null);

      const cleanup = deepLinkService.setupDeepLinkListener();

      expect(mockAddEventListener).toHaveBeenCalledWith('url', expect.any(Function));

      cleanup();
      expect(mockRemove).toHaveBeenCalled();
    });

    it('앱이 실행 중일 때 딥링크를 처리해야 함', () => {
      const mockOnDeepLink = jest.fn();
      const mockRemove = jest.fn();
      let urlListener: ((event: { url: string }) => void) | undefined;

      mockAddEventListener.mockImplementation((event, callback) => {
        if (event === 'url') {
          urlListener = callback as (event: { url: string }) => void;
        }
        return { remove: mockRemove };
      });
      mockGetInitialURL.mockResolvedValue(null);

      deepLinkService.setupDeepLinkListener(mockOnDeepLink);

      // 딥링크 수신 시뮬레이션
      urlListener?.({ url: 'uniqn://jobs/123' });

      expect(mockOnDeepLink).toHaveBeenCalledWith('uniqn://jobs/123');
      expect(mockLoggerInfo).toHaveBeenCalledWith('딥링크 수신', { url: 'uniqn://jobs/123' });
    });

    it('웹에서 루트 URL은 무시해야 함', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
      const mockOnDeepLink = jest.fn();
      let urlListener: ((event: { url: string }) => void) | undefined;

      mockAddEventListener.mockImplementation((event, callback) => {
        if (event === 'url') {
          urlListener = callback as (event: { url: string }) => void;
        }
        return { remove: jest.fn() };
      });
      mockGetInitialURL.mockResolvedValue(null);

      deepLinkService.setupDeepLinkListener(mockOnDeepLink);

      // 루트 URL 수신 (무시되어야 함)
      urlListener?.({ url: 'https://uniqn.app/' });

      expect(mockOnDeepLink).not.toHaveBeenCalled();
      expect(mockLoggerInfo).not.toHaveBeenCalledWith('딥링크 수신', expect.anything());
    });

    it('초기 딥링크를 처리해야 함 (콜드 스타트)', async () => {
      const mockOnDeepLink = jest.fn();
      mockAddEventListener.mockReturnValue({ remove: jest.fn() });
      mockGetInitialURL.mockResolvedValue('uniqn://notifications');
      mockRouterCanGoBack.mockReturnValue(true);

      deepLinkService.setupDeepLinkListener(mockOnDeepLink);

      // getInitialURL이 비동기이므로 대기
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockOnDeepLink).toHaveBeenCalledWith('uniqn://notifications');
      expect(mockLoggerInfo).toHaveBeenCalledWith('초기 딥링크', { url: 'uniqn://notifications' });
    });
  });

  // ==========================================================================
  // getInitialDeepLink Tests
  // ==========================================================================

  describe('getInitialDeepLink', () => {
    it('초기 딥링크 URL을 반환해야 함', async () => {
      mockGetInitialURL.mockResolvedValue('uniqn://jobs/123');

      const result = await deepLinkService.getInitialDeepLink();

      expect(result).toBe('uniqn://jobs/123');
    });

    it('초기 딥링크가 없으면 null을 반환해야 함', async () => {
      mockGetInitialURL.mockResolvedValue(null);

      const result = await deepLinkService.getInitialDeepLink();

      expect(result).toBeNull();
    });

    it('에러 발생 시 null을 반환하고 에러를 로깅해야 함', async () => {
      mockGetInitialURL.mockRejectedValue(new Error('URL 가져오기 실패'));

      const result = await deepLinkService.getInitialDeepLink();

      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // openExternalUrl Tests
  // ==========================================================================

  describe('openExternalUrl', () => {
    it('외부 URL을 열 수 있으면 열어야 함', async () => {
      mockCanOpenURL.mockResolvedValue(true);
      mockOpenURL.mockResolvedValue(undefined);

      const result = await deepLinkService.openExternalUrl('https://example.com');

      expect(result).toBe(true);
      expect(mockCanOpenURL).toHaveBeenCalledWith('https://example.com');
      expect(mockOpenURL).toHaveBeenCalledWith('https://example.com');
    });

    it('URL을 열 수 없으면 경고를 로깅하고 false를 반환해야 함', async () => {
      mockCanOpenURL.mockResolvedValue(false);

      const result = await deepLinkService.openExternalUrl('unknown-scheme://test');

      expect(result).toBe(false);
      expect(mockLoggerWarn).toHaveBeenCalledWith('URL을 열 수 없음', {
        url: 'unknown-scheme://test',
      });
      expect(mockOpenURL).not.toHaveBeenCalled();
    });

    it('에러 발생 시 에러를 로깅하고 false를 반환해야 함', async () => {
      mockCanOpenURL.mockRejectedValue(new Error('URL 열기 실패'));

      const result = await deepLinkService.openExternalUrl('https://example.com');

      expect(result).toBe(false);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });
});
