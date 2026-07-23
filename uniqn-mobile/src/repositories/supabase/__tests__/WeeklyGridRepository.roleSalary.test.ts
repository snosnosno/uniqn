/**
 * WeeklyGridRepository.setVenueRoleSalary — 지점 역할별 단가 쓰기 RPC 래퍼 contract test
 *
 * set_venue_role_salary(SECDEF) 파라미터 매핑을 검증한다. salary:null 이면 type/amount 를
 * NULL 로 전달(삭제 시맨틱). supabase.rpc 는 mock(형제 파일 WeeklyGridRepository.test.ts 셋업 복제).
 */
import { weeklyGridRepository } from '@/repositories/weeklyGrid';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: jest.fn(),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      throw new Error(`supabase: ${error?.message ?? 'unknown'}`);
    },
  };
});

beforeEach(() => mockRpc.mockReset());

describe('setVenueRoleSalary', () => {
  it('upsert — RPC 파라미터 매핑', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });
    await weeklyGridRepository.setVenueRoleSalary('v1', {
      role: 'other',
      customRole: '칩 러너',
      salary: { type: 'hourly', amount: 20000 },
    });
    expect(mockRpc).toHaveBeenCalledWith('set_venue_role_salary', {
      p_venue: 'v1',
      p_role: 'other',
      p_custom_role: '칩 러너',
      p_salary_type: 'hourly',
      p_amount: 20000,
    });
  });

  it('삭제 — salary:null 이면 p_salary_type/p_amount 미전달(NULL)', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });
    await weeklyGridRepository.setVenueRoleSalary('v1', { role: 'dealer', salary: null });
    expect(mockRpc).toHaveBeenCalledWith('set_venue_role_salary', {
      p_venue: 'v1',
      p_role: 'dealer',
      p_custom_role: null,
      p_salary_type: null,
      p_amount: null,
    });
  });
});
