import { SupabaseReviewRepository } from '../ReviewRepository';

const eqCalls: [string, unknown][] = [];

// jest.mock factory cannot reference out-of-scope vars unless they start with 'mock'
function mockMakeChain() {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(() => chain),
    eq: jest.fn((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return chain;
    }),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return chain;
}

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => mockMakeChain()) },
}));

describe('SupabaseReviewRepository 읽기 — work_log_id+reviewer_type 조회', () => {
  beforeEach(() => {
    eqCalls.length = 0;
  });

  it('getReviewsWithBlindCheck 는 합성 id 가 아닌 work_log_id/reviewer_type 으로 조회한다', async () => {
    const repo = new SupabaseReviewRepository();
    await repo.getReviewsWithBlindCheck('wl-1', 'staff', 'me-1');

    // 합성키('wl-1_staff')로 id 조회하면 uuid 컬럼에서 22P02 → 절대 금지
    expect(eqCalls).toContainEqual(['work_log_id', 'wl-1']);
    expect(eqCalls).toContainEqual(['reviewer_type', 'staff']);
    expect(eqCalls).toContainEqual(['reviewer_type', 'employer']); // 상대 리뷰
    expect(eqCalls.some(([col]) => col === 'id')).toBe(false);
  });

  it('getByWorkLogAndType 도 id 합성키를 쓰지 않는다', async () => {
    const repo = new SupabaseReviewRepository();
    await repo.getByWorkLogAndType('wl-9', 'employer');

    expect(eqCalls).toContainEqual(['work_log_id', 'wl-9']);
    expect(eqCalls).toContainEqual(['reviewer_type', 'employer']);
    expect(eqCalls.some(([col]) => col === 'id')).toBe(false);
  });
});
