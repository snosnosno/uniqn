import { AppError, BusinessError, ERROR_CODES, NetworkError } from '@/errors';
import { crashlyticsService } from '../crashlyticsService';
import { recordAppError, recordHandledError, sentryService, setEnabled } from '../sentryService';

const mockScope = {
  setTag: jest.fn(),
  setExtra: jest.fn(),
  setLevel: jest.fn(),
  setUser: jest.fn(),
};

const mockCaptureException = jest.fn();
const mockWithScope = jest.fn((callback: (scope: typeof mockScope) => void) => callback(mockScope));
const mockAddBreadcrumb = jest.fn();
const mockSetTag = jest.fn();
const mockSetUser = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@sentry/react-native', () => ({
  withScope: (callback: (scope: typeof mockScope) => void) => mockWithScope(callback),
  captureException: (error: Error) => mockCaptureException(error),
  addBreadcrumb: (breadcrumb: unknown) => mockAddBreadcrumb(breadcrumb),
  setTag: (key: string, value: string) => mockSetTag(key, value),
  setUser: (user: unknown) => mockSetUser(user),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('sentryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setEnabled(true);
  });

  it('recoverable business AppError는 Sentry로 전송하지 않아야 한다', async () => {
    const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

    await recordAppError(error);

    expect(mockWithScope).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('infra AppError는 non-fatal error level로 전송해야 한다', async () => {
    const error = new NetworkError();

    await recordAppError(error);

    expect(mockWithScope).toHaveBeenCalledTimes(1);
    expect(mockScope.setLevel).toHaveBeenCalledWith('error');
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it('critical AppError는 fatal level로 전송해야 한다', async () => {
    const error = new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      severity: 'critical',
    });

    await recordAppError(error);

    expect(mockScope.setLevel).toHaveBeenCalledWith('fatal');
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it('plain Error는 handled error 경로에서 전송해야 한다', async () => {
    const error = new Error('plain failure');

    await recordHandledError(error, { component: 'sessionService' });

    expect(mockScope.setLevel).toHaveBeenCalledWith('error');
    expect(mockCaptureException).toHaveBeenCalledWith(error);
    expect(mockScope.setTag).toHaveBeenCalledWith('component', 'sessionService');
  });

  it('legacy crashlytics alias도 같은 인스턴스를 바라봐야 한다', () => {
    expect(crashlyticsService).toBe(sentryService);
  });
});
