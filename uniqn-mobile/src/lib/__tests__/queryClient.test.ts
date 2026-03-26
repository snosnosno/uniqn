import { invalidateQueries, queryClient } from '../queryClient';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  normalizeError: jest.fn(() => ({ category: 'unknown' })),
  isRetryableError: jest.fn(() => false),
  requiresReauthentication: jest.fn(() => false),
}));

describe('queryClient invalidateQueries', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('invalidates schedule and pending review surfaces for staff management updates', () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    invalidateQueries.staffManagement('job-1');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['confirmedStaff', 'byJobPosting', 'job-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['settlement', 'byJobPosting', 'job-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workLogs'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['schedules'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['reviews', 'pending'],
    });
  });
});
