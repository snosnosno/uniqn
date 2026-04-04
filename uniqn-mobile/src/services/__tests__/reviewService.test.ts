import { createReview } from '../reviewService';

const mockCreateWithTransaction = jest.fn();
const mockGetWorkLogById = jest.fn();

jest.mock('@/repositories', () => ({
  reviewRepository: {
    createWithTransaction: (...args: unknown[]) => mockCreateWithTransaction(...args),
    getReviewsWithBlindCheck: jest.fn(),
    getByRevieweeId: jest.fn(),
    getByReviewerId: jest.fn(),
    getByWorkLogAndType: jest.fn(),
  },
  workLogRepository: {
    getById: (...args: unknown[]) => mockGetWorkLogById(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }),
}));

describe('reviewService.createReview', () => {
  const today = new Date().toISOString().slice(0, 10);
  const baseInput = {
    workLogId: 'worklog-1',
    jobPostingId: 'job-1',
    jobPostingTitle: 'Night Shift',
    workDate: today,
    revieweeId: 'staff-1',
    revieweeName: 'Alice',
    reviewerType: 'employer' as const,
    sentiment: 'positive' as const,
    tags: ['punctual'] as const,
    comment: 'Great work',
  };

  const baseContext = {
    reviewerId: 'owner-1',
    reviewerName: 'Owner',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWorkLogById.mockResolvedValue({
      id: 'worklog-1',
      staffId: 'staff-1',
      ownerId: 'owner-1',
      jobPostingId: 'job-1',
      status: 'completed',
      date: today,
      checkOutTime: new Date(),
    });
    mockCreateWithTransaction.mockResolvedValue('review-1');
  });

  it('rejects incompatible sentiment and tags before repository write', async () => {
    await expect(
      createReview(
        {
          ...baseInput,
          tags: ['late'],
        },
        baseContext
      )
    ).rejects.toThrow('긍정 리뷰에는 긍정 태그만 선택할 수 있어요.');

    expect(mockGetWorkLogById).not.toHaveBeenCalled();
    expect(mockCreateWithTransaction).not.toHaveBeenCalled();
  });

  it('allows neutral sentiment with mixed tags', async () => {
    await expect(
      createReview(
        {
          ...baseInput,
          sentiment: 'neutral',
          tags: ['punctual', 'late'],
        },
        baseContext
      )
    ).resolves.toBe('review-1');

    expect(mockCreateWithTransaction).toHaveBeenCalledWith(
      {
        ...baseInput,
        sentiment: 'neutral',
        tags: ['punctual', 'late'],
      },
      baseContext
    );
  });
});
