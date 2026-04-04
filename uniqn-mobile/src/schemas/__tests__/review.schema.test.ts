import { createReviewInputSchema, reviewFormSchema } from '../review.schema';

describe('review schema', () => {
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

  it('rejects malformed non-empty workDate values', () => {
    expect(
      createReviewInputSchema.safeParse({
        ...baseInput,
        workDate: '2025/01/15',
      }).success
    ).toBe(false);
  });

  it('rejects positive sentiment with negative-only tags', () => {
    const result = createReviewInputSchema.safeParse({
      ...baseInput,
      workDate: '2025-01-15',
      tags: ['late'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative sentiment with positive-only tags', () => {
    const result = reviewFormSchema.safeParse({
      sentiment: 'negative',
      tags: ['punctual'],
      comment: '',
    });

    expect(result.success).toBe(false);
  });

  it('allows neutral sentiment with mixed tags', () => {
    const result = reviewFormSchema.safeParse({
      sentiment: 'neutral',
      tags: ['punctual', 'late'],
      comment: '',
    });

    expect(result.success).toBe(true);
  });
});
