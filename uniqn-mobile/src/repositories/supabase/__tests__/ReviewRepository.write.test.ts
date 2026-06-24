import { SupabaseReviewRepository } from '../ReviewRepository';
import type { CreateReviewInput } from '@/types/review';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const input: CreateReviewInput = {
  workLogId: 'wl-1',
  jobPostingId: 'jp-1',
  jobPostingTitle: '공고',
  workDate: '2026-06-20',
  revieweeId: 'rv-1',
  revieweeName: '대상',
  reviewerType: 'staff',
  sentiment: 'positive',
  tags: ['punctual'],
  comment: undefined,
};

describe('SupabaseReviewRepository.createWithTransaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('create_review 를 합성 p_review_id 없이 호출하고 반환 id 를 돌려준다', async () => {
    mockRpc.mockResolvedValue({ data: 'new-review-uuid', error: null });
    const repo = new SupabaseReviewRepository();

    const id = await repo.createWithTransaction(input, { reviewerId: 'me-1', reviewerName: '나' });

    expect(id).toBe('new-review-uuid');
    expect(mockRpc).toHaveBeenCalledWith(
      'create_review',
      expect.objectContaining({
        p_work_log_id: 'wl-1',
        p_reviewer_id: 'me-1',
        p_reviewer_type: 'staff',
        p_reviewee_id: 'rv-1',
        p_sentiment: 'positive',
      })
    );
    const params = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(params).not.toHaveProperty('p_review_id');
    expect(params).not.toHaveProperty('p_bubble_score_change');
  });
});
