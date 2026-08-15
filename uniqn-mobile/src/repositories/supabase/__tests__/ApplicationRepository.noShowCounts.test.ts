/**
 * SupabaseApplicationRepository.getApplicantNoShowCounts 회귀 테스트 (S3-3)
 *
 * 🚨 이 스위트가 반드시 필요한 이유 — **타입이 이 경계를 지켜주지 않는다.**
 *   `src/lib/supabase.ts` 는 `createClient(...)` 를 `Database` 제네릭 **없이** 만든다.
 *   그래서 `supabase.rpc('오타난_이름', { 틀린_인자: 1 })` 도 `tsc --noEmit` 를 그냥 통과한다.
 *   RPC 이름이나 인자 키가 하나만 어긋나도 컴파일은 성공하고, 런타임에 에러가 나는데
 *   이 함수는 **fail-open**(빈 Map 반환)이라 화면은 멀쩡히 뜬다 — 칩만 영원히 안 보인다.
 *   즉 잘못 배선해도 아무도 모른다. 그 계약을 여기서 문자 그대로 고정한다.
 *
 * 고정 대상:
 *   C1. RPC 이름과 인자 키가 마이그(20260813120000)의 시그니처와 정확히 일치한다
 *   C2. 응답(snake_case)을 applicantId → 횟수 Map 으로 옮긴다
 *   C3. RPC 에러여도 throw 하지 않고 빈 Map (칩은 보조 정보 — 목록이 죽으면 손해가 더 크다)
 *   C4. 빈 입력이면 왕복 자체를 하지 않는다
 */
import { SupabaseApplicationRepository } from '../ApplicationRepository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('SupabaseApplicationRepository.getApplicantNoShowCounts (S3-3)', () => {
  let repo: SupabaseApplicationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SupabaseApplicationRepository();
  });

  it('C1: 마이그 시그니처와 같은 RPC 이름·인자 키로 호출한다', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await repo.getApplicantNoShowCounts('job-1', ['staff-a', 'staff-b']);

    // 이름·키가 어긋나면 런타임 에러 → fail-open → 칩이 조용히 사라진다.
    // 마이그: get_applicant_no_show_counts(p_job_posting_id uuid, p_staff_ids uuid[])
    expect(mockRpc).toHaveBeenCalledWith('get_applicant_no_show_counts', {
      p_job_posting_id: 'job-1',
      p_staff_ids: ['staff-a', 'staff-b'],
    });
  });

  it('C2: snake_case 응답을 applicantId → 횟수 Map 으로 옮긴다', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { staff_id: 'staff-a', no_show_count: 2 },
        // 서버가 bigint 를 문자열로 주는 경우가 있다(postgrest) — 숫자로 정규화해야 한다.
        { staff_id: 'staff-b', no_show_count: '0' },
      ],
      error: null,
    });

    const result = await repo.getApplicantNoShowCounts('job-1', ['staff-a', 'staff-b']);

    expect(result.get('staff-a')).toBe(2);
    expect(result.get('staff-b')).toBe(0);
  });

  it('C3: RPC 가 에러여도 throw 하지 않고 빈 Map 을 준다 (fail-open)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const result = await repo.getApplicantNoShowCounts('job-1', ['staff-a']);

    expect(result.size).toBe(0);
  });

  it('C3: 예외가 던져져도 삼키고 빈 Map 을 준다', async () => {
    mockRpc.mockRejectedValue(new Error('network down'));

    const result = await repo.getApplicantNoShowCounts('job-1', ['staff-a']);

    expect(result.size).toBe(0);
  });

  it('C4: 지원자가 없으면 왕복하지 않는다', async () => {
    const result = await repo.getApplicantNoShowCounts('job-1', []);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('C4: 공고 id 가 비면 왕복하지 않는다', async () => {
    const result = await repo.getApplicantNoShowCounts('', ['staff-a']);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });
});
