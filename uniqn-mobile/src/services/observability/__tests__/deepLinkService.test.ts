import type { NotificationType } from '@/types/notification';
import { buildBoardNoticePostId } from '@/shared/board/boardIds';

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

const mockAddEventListener = jest.fn();
const mockGetInitialURL = jest.fn();
const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();

jest.mock('react-native', () => ({
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

const mockTrackEvent = jest.fn();

jest.mock('../analyticsService', () => ({
  trackEvent: mockTrackEvent,
}));

const getMockExpoPath = (route: { name: string; params?: Record<string, string> }) => {
  switch (route.name) {
    case 'home':
      return '/(app)/(tabs)';
    case 'jobs':
      return '/(public)/jobs';
    case 'job':
      return `/jobs/${route.params?.id}`;
    case 'login':
      return '/(auth)/login';
    case 'signup':
      return '/(auth)/signup';
    case 'forgot-password':
      return '/(auth)/forgot-password';
    case 'notifications':
      return '/(app)/notifications';
    case 'schedule':
      return '/(app)/(tabs)/schedule';
    case 'board':
      return '/(app)/(tabs)/board';
    case 'board/post':
      return `/(app)/(tabs)/board/post/${route.params?.postId}`;
    case 'profile':
      return '/(app)/(tabs)/profile';
    case 'settings':
      return '/(app)/settings';
    case 'settings/profile':
      return '/(app)/settings/profile';
    case 'settings/change-password':
      return '/(app)/settings/change-password';
    case 'settings/delete-account':
      return '/(app)/settings/delete-account';
    case 'settings/privacy':
      return '/(app)/settings/privacy';
    case 'settings/terms':
      return '/(app)/settings/terms';
    case 'settings/employer-terms':
      return '/(app)/settings/employer-terms';
    case 'settings/liability-waiver':
      return '/(app)/settings/liability-waiver';
    case 'settings/my-data':
      return '/(app)/settings/my-data';
    case 'settings/business-info':
      return '/(app)/settings/business-info';
    case 'support':
      return '/(app)/support';
    case 'support/faq':
      return '/(app)/support/faq';
    case 'support/create-inquiry':
      return '/(app)/support/create-inquiry';
    case 'support/my-inquiries':
      return '/(app)/support/my-inquiries';
    case 'support/inquiry':
      return `/(app)/support/inquiry/${route.params?.id}`;
    case 'notices':
      return '/(app)/(tabs)/board/notice';
    case 'notice':
      return `/(app)/(tabs)/board/post/${buildBoardNoticePostId(route.params?.id || '')}`;
    case 'employer/my-postings':
      return '/(employer)/my-postings';
    case 'employer/posting-create':
      return '/(employer)/my-postings/create';
    case 'employer/posting':
      return `/(employer)/my-postings/${route.params?.id}`;
    case 'employer/posting-edit':
      return `/(employer)/my-postings/${route.params?.id}/edit`;
    case 'employer/applicants':
      return `/(employer)/my-postings/${route.params?.jobId}/applicants`;
    case 'employer/settlement':
      return `/(employer)/my-postings/${route.params?.jobId}/settlements`;
    case 'reviews/detail':
      return `/(app)/reviews/${route.params?.workLogId}`;
    case 'reviews/pending':
      return '/(app)/reviews/pending';
    case 'admin/dashboard':
      return '/(admin)';
    case 'admin/users':
      return '/(admin)/users';
    case 'admin/user':
      return `/(admin)/users/${route.params?.id}`;
    case 'admin/stats':
      return '/(admin)/stats';
    case 'admin/reports':
      return '/(admin)/reports';
    case 'admin/report':
      return `/(admin)/reports/${route.params?.id}`;
    case 'admin/announcements':
      return '/(admin)/announcements';
    case 'admin/announcement-create':
      return '/(admin)/announcements/create';
    case 'admin/announcement':
      return `/(admin)/announcements/${route.params?.id}`;
    case 'admin/announcement-edit':
      return `/(admin)/announcements/${route.params?.id}/edit`;
    case 'admin/inquiries':
      return '/(admin)/inquiries';
    case 'admin/inquiry':
      return `/(admin)/inquiries/${route.params?.id}`;
    case 'admin/tournaments':
      return '/(admin)/tournaments';
    default:
      return '/(app)/(tabs)';
  }
};

const mockRouteMapper = {
  toExpoPath: jest.fn(getMockExpoPath),
};

const mockNotificationRouteMap: Record<
  string,
  (data?: Record<string, string>) => { name: string; params?: Record<string, string> }
> = {
  new_application: (data) => ({
    name: 'employer/applicants',
    params: { jobId: data?.jobPostingId || '' },
  }),
  application_confirmed: () => ({ name: 'schedule' }),
  board_comment: (data) =>
    data?.postId ? { name: 'board/post', params: { postId: data.postId } } : { name: 'board' },
  settlement_completed: () => ({ name: 'schedule' }),
  job_updated: (data) => ({ name: 'job', params: { id: data?.jobPostingId || '' } }),
  announcement: (data) =>
    data?.announcementId
      ? { name: 'notice', params: { id: data.announcementId } }
      : { name: 'notices' },
  inquiry_answered: (data) =>
    data?.inquiryId
      ? { name: 'support/inquiry', params: { id: data.inquiryId } }
      : { name: 'support/my-inquiries' },
  new_report: (data) => ({ name: 'admin/report', params: { id: data?.reportId || '' } }),
};

jest.mock('@/shared/deeplink', () => ({
  RouteMapper: mockRouteMapper,
  NOTIFICATION_ROUTE_MAP: mockNotificationRouteMap,
}));

const { Platform } = jest.requireMock('react-native') as typeof import('react-native');
const { deepLinkService } = jest.requireActual(
  '../deepLinkService'
) as typeof import('../deepLinkService');

describe('deepLinkService', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockReset();
    mockRouterReplace.mockReset();
    mockRouterCanGoBack.mockReset().mockReturnValue(true);
    mockAddEventListener.mockReset().mockReturnValue({ remove: jest.fn() });
    mockGetInitialURL.mockReset().mockResolvedValue(null);
    mockCanOpenURL.mockReset();
    mockOpenURL.mockReset();
    mockRouteMapper.toExpoPath.mockReset().mockImplementation(getMockExpoPath);
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  describe('validateNotificationLink', () => {
    it('allows safe relative paths', () => {
      ['/jobs/123', '/notifications', '/admin/reports/abc'].forEach((link) => {
        expect(deepLinkService.validateNotificationLink(link)).toBe(link);
      });
    });

    it('blocks dangerous or malformed paths', () => {
      ['javascript:alert(1)', 'https://evil.com', '/path/with spaces', '/path?query=value'].forEach(
        (link) => {
          expect(deepLinkService.validateNotificationLink(link)).toBeUndefined();
        }
      );
    });
  });

  describe('parseDeepLink', () => {
    it('parses public and auth routes', () => {
      expect(deepLinkService.parseDeepLink('uniqn://jobs/123')).toEqual({
        url: 'uniqn://jobs/123',
        path: 'jobs/123',
        queryParams: {},
        route: { name: 'job', params: { id: '123' } },
        isValid: true,
      });

      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
      Object.defineProperty(globalThis, 'window', {
        value: {
          location: {
            origin: 'http://localhost',
            pathname: '/login',
            search: '',
          },
        },
        writable: true,
        configurable: true,
      });

      expect(deepLinkService.parseDeepLink('http://localhost/login')).toEqual({
        url: 'http://localhost/login',
        path: '/login',
        queryParams: {},
        route: { name: 'login' },
        isValid: true,
      });
    });

    it('parses nested settings routes explicitly', () => {
      expect(deepLinkService.parseDeepLink('/settings/change-password').route).toEqual({
        name: 'settings/change-password',
      });
      expect(deepLinkService.parseDeepLink('/settings/privacy').route).toEqual({
        name: 'settings/privacy',
      });
      expect(deepLinkService.parseDeepLink('/settings/about').route).toEqual({
        name: 'settings',
      });
    });

    it('parses nested support routes explicitly', () => {
      expect(deepLinkService.parseDeepLink('/support/faq').route).toEqual({
        name: 'support/faq',
      });
      expect(deepLinkService.parseDeepLink('/support/create-inquiry').route).toEqual({
        name: 'support/create-inquiry',
      });
      expect(deepLinkService.parseDeepLink('/support/my-inquiries').route).toEqual({
        name: 'support/my-inquiries',
      });
      expect(deepLinkService.parseDeepLink('/support/inquiry/inq-1').route).toEqual({
        name: 'support/inquiry',
        params: { id: 'inq-1' },
      });
      expect(deepLinkService.parseDeepLink('/support/inquiries/inq-1').route).toEqual({
        name: 'support/inquiry',
        params: { id: 'inq-1' },
      });
    });

    it('parses notices and legacy announcements into the notice surfaces', () => {
      expect(deepLinkService.parseDeepLink('/notices').route).toEqual({ name: 'notices' });
      expect(deepLinkService.parseDeepLink('/notices/notice-1').route).toEqual({
        name: 'notice',
        params: { id: 'notice-1' },
      });
      expect(deepLinkService.parseDeepLink('/announcements').route).toEqual({ name: 'notices' });
      expect(deepLinkService.parseDeepLink('/announcements/notice-1').route).toEqual({
        name: 'notice',
        params: { id: 'notice-1' },
      });
    });

    it('parses generic board post links into board post routes', () => {
      expect(deepLinkService.parseDeepLink('/board/post/post-1').route).toEqual({
        name: 'board/post',
        params: { postId: 'post-1' },
      });
    });

    it('parses admin aliases and detail routes explicitly', () => {
      expect(deepLinkService.parseDeepLink('/admin/users').route).toEqual({
        name: 'admin/users',
      });
      expect(deepLinkService.parseDeepLink('/admin/users/user-1').route).toEqual({
        name: 'admin/user',
        params: { id: 'user-1' },
      });
      expect(deepLinkService.parseDeepLink('/admin/stats').route).toEqual({
        name: 'admin/stats',
      });
      expect(deepLinkService.parseDeepLink('/admin/announcements').route).toEqual({
        name: 'admin/announcements',
      });
      expect(deepLinkService.parseDeepLink('/admin/announcements/create').route).toEqual({
        name: 'admin/announcement-create',
      });
      expect(deepLinkService.parseDeepLink('/admin/announcements/ann-1').route).toEqual({
        name: 'admin/announcement',
        params: { id: 'ann-1' },
      });
      expect(deepLinkService.parseDeepLink('/admin/announcements/ann-1/edit').route).toEqual({
        name: 'admin/announcement-edit',
        params: { id: 'ann-1' },
      });
    });

    it('keeps legacy schedule and query fallbacks working', () => {
      expect(deepLinkService.parseDeepLink('/my-applications').route).toEqual({ name: 'schedule' });
      expect(deepLinkService.parseDeepLink('uniqn://unknown?jobId=789').route).toEqual({
        name: 'job',
        params: { id: '789' },
      });
    });

    it('returns invalid results for unsupported URLs', () => {
      expect(deepLinkService.parseDeepLink('invalid-url')).toEqual({
        url: 'invalid-url',
        path: '',
        queryParams: {},
        route: null,
        isValid: false,
      });
    });
  });

  describe('navigateToDeepLink', () => {
    it('navigates to an explicit nested route', async () => {
      mockRouterPush.mockResolvedValue(undefined);

      const result = await deepLinkService.navigateToDeepLink('uniqn://settings/change-password');

      expect(result).toBe(true);
      expect(mockRouterPush).toHaveBeenCalledWith('/(app)/settings/change-password');
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'deep_link_navigation',
        expect.objectContaining({ route_name: 'settings/change-password' })
      );
    });

    it('skips a web navigation when the explicit route already matches the current page', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
      Object.defineProperty(globalThis, 'window', {
        value: {
          location: {
            origin: 'http://localhost',
            pathname: '/settings/change-password',
            search: '',
          },
        },
        writable: true,
        configurable: true,
      });

      const result = await deepLinkService.navigateToDeepLink(
        'http://localhost/settings/change-password'
      );

      expect(result).toBe(true);
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('returns false for invalid links', async () => {
      const result = await deepLinkService.navigateToDeepLink('invalid-url');

      expect(result).toBe(false);
      expect(mockLoggerWarn).toHaveBeenCalledWith('유효하지 않은 딥링크', {
        url: 'invalid-url',
      });
    });

    it('retries once and then succeeds', async () => {
      mockRouterPush.mockRejectedValueOnce(new Error('first failure')).mockResolvedValue(undefined);

      const result = await deepLinkService.navigateToDeepLink('uniqn://schedule');

      expect(result).toBe(true);
      expect(mockRouterPush).toHaveBeenCalledTimes(2);
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'deeplink 네비게이션 재시도 성공',
        expect.anything()
      );
    });

    it('falls back to notifications if push keeps failing', async () => {
      mockRouterPush.mockRejectedValue(new Error('push failure'));
      mockRouterReplace.mockResolvedValue(undefined);

      const result = await deepLinkService.navigateToDeepLink('uniqn://profile');

      expect(result).toBe(true);
      expect(mockRouterReplace).toHaveBeenCalledWith('/(app)/notifications');
    });
  });

  describe('getRouteFromNotification', () => {
    it('uses a valid link before the notification type mapping', () => {
      const route = deepLinkService.getRouteFromNotification(
        'announcement' as NotificationType,
        undefined,
        '/support/faq'
      );

      expect(route).toEqual({ name: 'support/faq' });
    });

    it('falls back to the notification route map when the link is invalid', () => {
      const route = deepLinkService.getRouteFromNotification(
        'announcement' as NotificationType,
        { announcementId: 'notice-1' },
        'javascript:alert(1)'
      );

      expect(route).toEqual({ name: 'notice', params: { id: 'notice-1' } });
    });

    it('maps board notifications to the exact post when postId exists', () => {
      expect(
        deepLinkService.getRouteFromNotification('board_comment' as NotificationType, {
          postId: 'post-99',
        })
      ).toEqual({
        name: 'board/post',
        params: { postId: 'post-99' },
      });
    });

    it('falls back to notifications for unknown notification types', () => {
      expect(deepLinkService.getRouteFromNotification('unknown_type' as NotificationType)).toEqual({
        name: 'notifications',
      });
    });
  });

  describe('createDeepLink', () => {
    it('creates canonical custom-scheme links', () => {
      expect(deepLinkService.createDeepLink({ name: 'jobs' })).toBe('uniqn://jobs');
      expect(deepLinkService.createDeepLink({ name: 'notice', params: { id: 'notice-1' } })).toBe(
        `uniqn://board/post/${buildBoardNoticePostId('notice-1')}`
      );
      expect(deepLinkService.createDeepLink({ name: 'admin/stats' })).toBe('uniqn://admin/stats');
    });

    it('creates canonical web links', () => {
      expect(
        deepLinkService.createDeepLink({ name: 'admin/announcements' }, { useWebUrl: true })
      ).toBe('https://uniqn.app/admin/announcements');
      expect(
        deepLinkService.createDeepLink(
          { name: 'support/inquiry', params: { id: 'inq-1' } },
          { useWebUrl: true }
        )
      ).toBe('https://uniqn.app/support/inquiry/inq-1');
      expect(deepLinkService.createJobDeepLink('job-1', true)).toBe('https://uniqn.app/jobs/job-1');
    });
  });

  describe('waitForNavigationReady', () => {
    it('waits until navigation is available', () => {
      jest.useFakeTimers();
      mockRouterCanGoBack.mockReturnValue(true);

      const callback = jest.fn();
      deepLinkService.waitForNavigationReady(callback);

      jest.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('forces the callback after the maximum retry count', () => {
      jest.useFakeTimers();
      mockRouterCanGoBack.mockImplementation(() => {
        throw new Error('not ready');
      });

      const callback = jest.fn();
      deepLinkService.waitForNavigationReady(callback);

      jest.advanceTimersByTime(5000);

      expect(callback).toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '콜드 스타트 네비게이션: 최대 대기 초과, 강제 실행',
        expect.objectContaining({ retries: 50 })
      );
      jest.useRealTimers();
    });
  });

  describe('setupDeepLinkListener', () => {
    it('registers and handles incoming URLs', () => {
      const remove = jest.fn();
      const onDeepLink = jest.fn();
      let handler: ((event: { url: string }) => void) | undefined;

      mockAddEventListener.mockImplementation((event, callback) => {
        if (event === 'url') {
          handler = callback as (event: { url: string }) => void;
        }
        return { remove };
      });

      const cleanup = deepLinkService.setupDeepLinkListener(onDeepLink);

      handler?.({ url: 'uniqn://jobs/123' });

      expect(onDeepLink).toHaveBeenCalledWith('uniqn://jobs/123');
      expect(mockLoggerInfo).toHaveBeenCalledWith('딥링크 수신', { url: 'uniqn://jobs/123' });

      cleanup();
      expect(remove).toHaveBeenCalled();
    });

    it('ignores the bare web root URL', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
      const onDeepLink = jest.fn();
      let handler: ((event: { url: string }) => void) | undefined;

      mockAddEventListener.mockImplementation((event, callback) => {
        if (event === 'url') {
          handler = callback as (event: { url: string }) => void;
        }
        return { remove: jest.fn() };
      });

      deepLinkService.setupDeepLinkListener(onDeepLink);
      handler?.({ url: 'https://uniqn.app/' });

      expect(onDeepLink).not.toHaveBeenCalled();
    });

    it('processes an initial URL', async () => {
      jest.useFakeTimers();
      const onDeepLink = jest.fn();
      mockGetInitialURL.mockResolvedValue('uniqn://notifications');

      deepLinkService.setupDeepLinkListener(onDeepLink);

      await Promise.resolve();
      jest.advanceTimersByTime(100);

      expect(onDeepLink).toHaveBeenCalledWith('uniqn://notifications');
      expect(mockLoggerInfo).toHaveBeenCalledWith('초기 딥링크', {
        url: 'uniqn://notifications',
      });
      jest.useRealTimers();
    });

    it('cancels pending initial URL navigation when the listener is cleaned up', async () => {
      jest.useFakeTimers();
      const remove = jest.fn();
      const onDeepLink = jest.fn();

      mockAddEventListener.mockReturnValue({ remove });
      mockGetInitialURL.mockResolvedValue('uniqn://notifications');

      const cleanup = deepLinkService.setupDeepLinkListener(onDeepLink);

      await Promise.resolve();
      cleanup();
      jest.advanceTimersByTime(100);

      expect(remove).toHaveBeenCalled();
      expect(onDeepLink).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('logs initial URL lookup failures without throwing', async () => {
      mockGetInitialURL.mockRejectedValue(new Error('initial url failed'));

      deepLinkService.setupDeepLinkListener();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockLoggerError).toHaveBeenCalledWith('초기 딥링크 가져오기 실패', expect.any(Error));
    });
  });

  describe('getInitialDeepLink', () => {
    it('returns the initial URL when it exists', async () => {
      mockGetInitialURL.mockResolvedValue('uniqn://jobs/123');
      await expect(deepLinkService.getInitialDeepLink()).resolves.toBe('uniqn://jobs/123');
    });

    it('returns null when getting the initial URL fails', async () => {
      mockGetInitialURL.mockRejectedValue(new Error('failed'));
      await expect(deepLinkService.getInitialDeepLink()).resolves.toBeNull();
    });
  });

  describe('openExternalUrl', () => {
    it('opens a supported URL', async () => {
      mockCanOpenURL.mockResolvedValue(true);
      mockOpenURL.mockResolvedValue(undefined);

      const result = await deepLinkService.openExternalUrl('https://example.com');

      expect(result).toBe(true);
      expect(mockOpenURL).toHaveBeenCalledWith('https://example.com');
    });

    it('logs a warning when a URL cannot be opened', async () => {
      mockCanOpenURL.mockResolvedValue(false);

      const result = await deepLinkService.openExternalUrl('unknown-scheme://test');

      expect(result).toBe(false);
      expect(mockLoggerWarn).toHaveBeenCalledWith('URL을 열 수 없음', {
        url: 'unknown-scheme://test',
      });
    });
  });
});
