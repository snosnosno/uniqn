/**
 * OpsParticipantRepository(1f) — 금전 경로 RPC 응답 경계 검증(zod) 계약 테스트.
 * 탈락취소(칩복원)·상금 정정·상금 지급 응답이 얇은 스키마를 통과/거부하는지 잠근다.
 * 정상 shape: camelCase 매핑 결과 불변. 오염 shape: ValidationError(오염값 차단).
 *
 * mapOpsRpcError 는 실제 구현 사용. supabase.rpc 만 mock.
 */
import { SupabaseOpsParticipantRepository } from '../OpsParticipantRepository';
import { ERROR_CODES, isValidationError } from '@/errors';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

beforeEach(() => {
  mockRpc.mockReset();
});

const repo = new SupabaseOpsParticipantRepository();

async function expectValidationError(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeTruthy();
  try {
    await promise;
    throw new Error('should have thrown');
  } catch (e) {
    expect(isValidationError(e)).toBe(true);
    expect((e as { code: string }).code).toBe(ERROR_CODES.VALIDATION_SCHEMA);
  }
}

describe('undoBust — 응답 경계 검증', () => {
  it('정상 응답(snake_case) → camelCase 매핑 결과', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        participant_id: 'p1',
        restored_chips: 5000,
        status: 'active',
        seated: true,
        table_no: 2,
        seat_no: 3,
      },
      error: null,
    });

    const result = await repo.undoBust('p1', 'a1');

    expect(result).toEqual({
      participantId: 'p1',
      restoredChips: 5000,
      status: 'active',
      seated: true,
      tableNo: 2,
      seatNo: 3,
    });
  });

  it('table_no/seat_no null(미착석) → tableNo/seatNo null', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        participant_id: 'p1',
        restored_chips: 5000,
        status: 'active',
        seated: false,
        table_no: null,
        seat_no: null,
      },
      error: null,
    });

    const result = await repo.undoBust('p1', 'a1');

    expect(result.tableNo).toBeNull();
    expect(result.seatNo).toBeNull();
  });

  it('오염 응답(restored_chips 문자열) → ValidationError', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { participant_id: 'p1', restored_chips: 'oops', status: 'active', seated: true },
      error: null,
    });

    await expectValidationError(repo.undoBust('p1', 'a1'));
  });
});

describe('correctPrize — 응답 경계 검증', () => {
  it('정상 응답 → amountBefore/amountAfter 매핑', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { participant_id: 'p1', amount_before: 100000, amount_after: 200000 },
      error: null,
    });

    const result = await repo.correctPrize('p1', 'a1', 200000, '정정 사유');

    expect(result).toEqual({ participantId: 'p1', amountBefore: 100000, amountAfter: 200000 });
  });

  it('amount null(회수) → amountBefore/amountAfter null 허용', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { participant_id: 'p1', amount_before: 100000, amount_after: null },
      error: null,
    });

    const result = await repo.correctPrize('p1', 'a1', null);

    expect(result.amountAfter).toBeNull();
  });

  it('오염 응답(participant_id 숫자) → ValidationError', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { participant_id: 123, amount_before: 1, amount_after: 2 },
      error: null,
    });

    await expectValidationError(repo.correctPrize('p1', 'a1', 2));
  });
});

describe('setPrizePaid — 응답 경계 검증', () => {
  it('정상 응답 → prizePaidAt 매핑', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { participant_id: 'p1', prize_paid_at: '2026-07-24T10:00:00Z' },
      error: null,
    });

    const result = await repo.setPrizePaid('p1', 'a1', true);

    expect(result).toEqual({ participantId: 'p1', prizePaidAt: '2026-07-24T10:00:00Z' });
  });

  it('prize_paid_at null(미지급) → prizePaidAt null', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { participant_id: 'p1', prize_paid_at: null },
      error: null,
    });

    const result = await repo.setPrizePaid('p1', 'a1', false);

    expect(result.prizePaidAt).toBeNull();
  });

  it('오염 응답(participant_id 누락) → ValidationError', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { prize_paid_at: '2026-07-24T10:00:00Z' },
      error: null,
    });

    await expectValidationError(repo.setPrizePaid('p1', 'a1', true));
  });
});
