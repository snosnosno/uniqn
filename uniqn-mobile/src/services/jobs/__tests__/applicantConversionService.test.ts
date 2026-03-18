import {
  batchConvertApplicants,
  canConvertToStaff,
  convertApplicantToStaff,
  isAlreadyStaff,
  revertStaffConversion,
} from '../applicantConversionService';

const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockHandleServiceError = jest.fn();
const mockIsAppError = jest.fn();
const mockGetClosingStatus = jest.fn();

jest.mock('@/repositories', () => ({
  applicationRepository: {
    convertApplicantToStaffTransaction: jest.fn(),
    revertStaffConversionTransaction: jest.fn(),
    isAlreadyStaff: jest.fn(),
    canConvertToStaff: jest.fn(),
  },
  jobPostingRepository: {
    getById: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  isAppError: (error: unknown) => mockIsAppError(error),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: (error: unknown, context: unknown) => mockHandleServiceError(error, context),
}));

jest.mock('@/utils/job-posting/dateUtils', () => ({
  getClosingStatus: (posting: unknown) => mockGetClosingStatus(posting),
}));

const {
  applicationRepository: mockApplicationRepository,
  jobPostingRepository: mockJobPostingRepository,
} = jest.requireMock('@/repositories') as {
  applicationRepository: {
    convertApplicantToStaffTransaction: jest.Mock;
    revertStaffConversionTransaction: jest.Mock;
    isAlreadyStaff: jest.Mock;
    canConvertToStaff: jest.Mock;
  };
  jobPostingRepository: {
    getById: jest.Mock;
  };
};

function createConversionResult(overrides: Record<string, unknown> = {}) {
  return {
    applicationId: 'app-1',
    staffId: 'staff-1',
    workLogIds: ['work-log-1'],
    isNewStaff: true,
    message: 'converted',
    ...overrides,
  };
}

describe('applicantConversionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJobPostingRepository.getById.mockResolvedValue(null);
    mockGetClosingStatus.mockReturnValue({ total: 0, filled: 0 });
    mockHandleServiceError.mockImplementation(
      (error: Error) => new Error(`handled: ${error.message}`)
    );
    mockIsAppError.mockImplementation((error: unknown) =>
      Boolean((error as { __isAppError?: boolean })?.__isAppError)
    );
  });

  describe('convertApplicantToStaff', () => {
    it('delegates conversion to the application repository', async () => {
      const expected = createConversionResult();
      mockApplicationRepository.convertApplicantToStaffTransaction.mockResolvedValue(expected);

      const result = await convertApplicantToStaff('app-1', 'job-1', 'manager-1');

      expect(mockApplicationRepository.convertApplicantToStaffTransaction).toHaveBeenCalledWith(
        'app-1',
        'job-1',
        'manager-1',
        {}
      );
      expect(result).toEqual(expected);
    });

    it('passes conversion options through to the repository', async () => {
      const expected = createConversionResult({ workLogIds: [] });

      mockApplicationRepository.convertApplicantToStaffTransaction.mockResolvedValue(expected);

      await convertApplicantToStaff('app-1', 'job-1', 'manager-1', {
        skipExisting: true,
        createWorkLogs: false,
        notes: 'vip',
      });

      expect(mockApplicationRepository.convertApplicantToStaffTransaction).toHaveBeenCalledWith(
        'app-1',
        'job-1',
        'manager-1',
        {
          skipExisting: true,
          createWorkLogs: false,
          notes: 'vip',
        }
      );
    });

    it('rethrows known app errors without wrapping', async () => {
      const appError = Object.assign(new Error('known failure'), { __isAppError: true });
      mockApplicationRepository.convertApplicantToStaffTransaction.mockRejectedValue(appError);

      await expect(convertApplicantToStaff('app-1', 'job-1', 'manager-1')).rejects.toBe(appError);
      expect(mockHandleServiceError).not.toHaveBeenCalled();
    });

    it('wraps unexpected conversion errors with the service handler', async () => {
      const cause = new Error('db down');
      const handled = new Error('handled failure');

      mockApplicationRepository.convertApplicantToStaffTransaction.mockRejectedValue(cause);
      mockHandleServiceError.mockReturnValue(handled);

      await expect(convertApplicantToStaff('app-1', 'job-1', 'manager-1')).rejects.toBe(handled);
      expect(mockHandleServiceError).toHaveBeenCalledWith(
        cause,
        expect.objectContaining({
          component: 'applicantConversionService',
          context: { applicationId: 'app-1' },
        })
      );
    });
  });

  describe('batchConvertApplicants', () => {
    it('converts applicants sequentially, forcing skipExisting and collecting failures', async () => {
      const first = createConversionResult({ applicationId: 'app-1', staffId: 'staff-1' });
      const third = createConversionResult({ applicationId: 'app-3', staffId: 'staff-3' });
      const onProgress = jest.fn();

      mockApplicationRepository.convertApplicantToStaffTransaction
        .mockResolvedValueOnce(first)
        .mockRejectedValueOnce(new Error('duplicate assignment'))
        .mockResolvedValueOnce(third);

      const result = await batchConvertApplicants(
        ['app-1', 'app-2', 'app-3'],
        'job-1',
        'manager-1',
        { notes: 'vip', skipExisting: false },
        onProgress
      );

      expect(mockJobPostingRepository.getById).toHaveBeenCalledWith('job-1');
      expect(mockApplicationRepository.convertApplicantToStaffTransaction).toHaveBeenNthCalledWith(
        1,
        'app-1',
        'job-1',
        'manager-1',
        {
          notes: 'vip',
          skipExisting: true,
        }
      );
      expect(mockApplicationRepository.convertApplicantToStaffTransaction).toHaveBeenNthCalledWith(
        2,
        'app-2',
        'job-1',
        'manager-1',
        {
          notes: 'vip',
          skipExisting: true,
        }
      );
      expect(mockApplicationRepository.convertApplicantToStaffTransaction).toHaveBeenNthCalledWith(
        3,
        'app-3',
        'job-1',
        'manager-1',
        {
          notes: 'vip',
          skipExisting: true,
        }
      );
      expect(result).toEqual({
        successCount: 2,
        failedCount: 1,
        results: [first, third],
        failedApplications: [
          {
            applicationId: 'app-2',
            error: 'handled: duplicate assignment',
          },
        ],
      });
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
      expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
    });

    it('warns when requested conversions exceed remaining positions', async () => {
      mockJobPostingRepository.getById.mockResolvedValue({ id: 'job-1' });
      mockGetClosingStatus.mockReturnValue({ total: 2, filled: 1 });
      mockApplicationRepository.convertApplicantToStaffTransaction.mockResolvedValue(
        createConversionResult()
      );

      await batchConvertApplicants(['app-1', 'app-2'], 'job-1', 'manager-1');

      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('returns an empty batch result when there are no application ids', async () => {
      const result = await batchConvertApplicants([], 'job-1', 'manager-1');

      expect(result).toEqual({
        successCount: 0,
        failedCount: 0,
        results: [],
        failedApplications: [],
      });
      expect(mockApplicationRepository.convertApplicantToStaffTransaction).not.toHaveBeenCalled();
    });

    it('wraps unexpected batch errors before processing starts', async () => {
      const cause = new Error('job lookup failed');
      const handled = new Error('handled batch failure');

      mockJobPostingRepository.getById.mockRejectedValue(cause);
      mockHandleServiceError.mockReturnValue(handled);

      await expect(batchConvertApplicants(['app-1'], 'job-1', 'manager-1')).rejects.toBe(handled);
      expect(mockHandleServiceError).toHaveBeenCalledWith(
        cause,
        expect.objectContaining({
          component: 'applicantConversionService',
          context: { count: 1, jobPostingId: 'job-1' },
        })
      );
    });
  });

  describe('repository delegates', () => {
    it('delegates isAlreadyStaff checks', async () => {
      mockApplicationRepository.isAlreadyStaff.mockResolvedValue(true);

      await expect(isAlreadyStaff('user-1', 'job-1')).resolves.toBe(true);
      expect(mockApplicationRepository.isAlreadyStaff).toHaveBeenCalledWith('user-1', 'job-1');
    });

    it('delegates canConvertToStaff checks', async () => {
      const expected = { canConvert: false, reason: 'already completed' };
      mockApplicationRepository.canConvertToStaff.mockResolvedValue(expected);

      await expect(canConvertToStaff('app-1')).resolves.toEqual(expected);
      expect(mockApplicationRepository.canConvertToStaff).toHaveBeenCalledWith('app-1');
    });
  });

  describe('revertStaffConversion', () => {
    it('delegates revert operations to the application repository', async () => {
      mockApplicationRepository.revertStaffConversionTransaction.mockResolvedValue(undefined);

      await expect(revertStaffConversion('app-1', 'manager-1')).resolves.toBeUndefined();
      expect(mockApplicationRepository.revertStaffConversionTransaction).toHaveBeenCalledWith(
        'app-1',
        'manager-1'
      );
    });

    it('rethrows known app errors on revert', async () => {
      const appError = Object.assign(new Error('known revert failure'), { __isAppError: true });

      mockApplicationRepository.revertStaffConversionTransaction.mockRejectedValue(appError);

      await expect(revertStaffConversion('app-1', 'manager-1')).rejects.toBe(appError);
      expect(mockHandleServiceError).not.toHaveBeenCalled();
    });

    it('wraps unexpected revert errors with the service handler', async () => {
      const cause = new Error('transaction failed');
      const handled = new Error('handled revert failure');

      mockApplicationRepository.revertStaffConversionTransaction.mockRejectedValue(cause);
      mockHandleServiceError.mockReturnValue(handled);

      await expect(revertStaffConversion('app-1', 'manager-1')).rejects.toBe(handled);
      expect(mockHandleServiceError).toHaveBeenCalledWith(
        cause,
        expect.objectContaining({
          component: 'applicantConversionService',
          context: { applicationId: 'app-1' },
        })
      );
    });
  });
});
