import { createReviewInputSchema } from '../review.schema';

describe('createReviewInputSchema', () => {
  const baseInput = {
    workLogId: 'wl-1',
    jobPostingId: 'job-1',
    jobPostingTitle: 'Fixed Job',
    revieweeId: 'user-1',
    revieweeName: 'Alice',
    reviewerType: 'employer' as const,
    sentiment: 'positive' as const,
    tags: ['punctual'] as const,
  };

  it('allows blank workDate for fixed worklogs', () => {
    expect(
      createReviewInputSchema.safeParse({
        ...baseInput,
        workDate: '',
      }).success
    ).toBe(true);
  });

  it('still rejects malformed non-empty workDate values', () => {
    expect(
      createReviewInputSchema.safeParse({
        ...baseInput,
        workDate: '2025/01/15',
      }).success
    ).toBe(false);
  });
});
