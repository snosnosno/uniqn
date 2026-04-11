import { checkForceUpdate } from '../versionService';

const mockGetDoc = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: (...args: unknown[]) => mockGetDoc(...args),
    })),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/constants/version', () => ({
  APP_VERSION: '1.0.0',
  compareVersions: jest.fn(() => 0),
}));

describe('versionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('falls back to a non-blocking default result when remote version lookup hangs', async () => {
    jest.useFakeTimers();
    mockGetDoc.mockImplementation(() => new Promise<void>(() => undefined));

    const resultPromise = checkForceUpdate();

    await jest.advanceTimersByTimeAsync(3000);

    await expect(resultPromise).resolves.toEqual({
      updateType: 'none',
      mustUpdate: false,
      shouldUpdate: false,
      isMaintenanceMode: false,
      currentVersion: '1.0.0',
    });
  });
});
