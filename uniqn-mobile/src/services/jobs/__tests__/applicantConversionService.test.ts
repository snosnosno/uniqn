import {
  batchConvertApplicants,
  canConvertToStaff,
  convertApplicantToStaff,
  isAlreadyStaff,
  revertStaffConversion,
} from '../applicantConversionService';

const mockLoggerWarn = jest.fn();

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('applicantConversionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks direct applicant conversion at runtime', async () => {
    await expect(convertApplicantToStaff('app-1', 'job-1', 'manager-1')).rejects.toThrow();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it('returns a failed batch result for deprecated conversion batches', async () => {
    const onProgress = jest.fn();

    const result = await batchConvertApplicants(
      ['app-1', 'app-2'],
      'job-1',
      'manager-1',
      {},
      onProgress
    );

    expect(result).toEqual({
      successCount: 0,
      failedCount: 2,
      results: [],
      failedApplications: [
        {
          applicationId: 'app-1',
          error: expect.any(String),
        },
        {
          applicationId: 'app-2',
          error: expect.any(String),
        },
      ],
    });
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it('returns false for deprecated isAlreadyStaff checks', async () => {
    await expect(isAlreadyStaff('user-1', 'job-1')).resolves.toBe(false);
  });

  it('returns a blocked state for deprecated canConvertToStaff checks', async () => {
    await expect(canConvertToStaff('app-1')).resolves.toEqual({
      canConvert: false,
      reason: expect.any(String),
    });
  });

  it('blocks legacy revertStaffConversion calls', async () => {
    await expect(revertStaffConversion('app-1', 'manager-1')).rejects.toThrow();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });
});
