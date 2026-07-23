/**
 * OpsPlayerRepository(claim 토큰 분리) — RPC 응답 경계 검증(zod) 계약 테스트.
 * 인증 토큰(viewToken/claimPin)·플레이어뷰 응답이 얇은 스키마를 통과/거부하는지 잠근다.
 * 정상 shape: 출력 불변(passthrough — 필드 strip 없음). 오염 shape: ValidationError.
 *
 * mapOpsRpcError 는 실제 구현 사용(에러 매핑까지 검증). supabase.rpc 만 mock.
 */
import { SupabaseOpsPlayerRepository } from '../OpsPlayerRepository';
import { ERROR_CODES, isValidationError } from '@/errors';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

beforeEach(() => {
  mockRpc.mockReset();
});

// 정상 플레이어뷰 픽스처(RPC 가 camelCase 로 직접 반환).
function makePlayerView() {
  return {
    me: {
      entryNumber: 12,
      name: '홍길동',
      status: 'active',
      chips: 30000,
      finishPosition: null,
      prizeAmount: null,
      bountyAccrued: null,
      rebuys: 0,
      addOns: 0,
      reentries: 0,
      knockouts: 0,
      tableNo: 2,
      seatNo: 3,
    },
    tournament: { name: '주말 토너먼트', venue: '강남', gameType: 'NLH', status: 'running' },
    clock: {
      currentLevelSort: 3,
      levelStartedAt: '2026-07-24T10:00:00Z',
      isRunning: true,
      pausedRemainingSec: null,
    },
    currentLevel: {
      level: 3,
      smallBlind: 100,
      bigBlind: 200,
      ante: 200,
      durationSec: 1200,
      isBreak: false,
    },
    stats: { playing: 20, entries: 30, averageStack: 15000, avgStackBb: 75 },
    nextBreak: { level: 5, sort: 5, secondsFromLevelStart: 2400 },
    serverNow: '2026-07-24T10:05:00Z',
  };
}

describe('SupabaseOpsPlayerRepository.getPlayerView — 응답 경계 검증', () => {
  const repo = new SupabaseOpsPlayerRepository();

  it('정상 응답 → 그대로 반환(passthrough — 필드 strip 없음)', async () => {
    const view = makePlayerView();
    mockRpc.mockResolvedValueOnce({ data: view, error: null });

    const result = await repo.getPlayerView('v'.repeat(32));

    expect(mockRpc).toHaveBeenCalledWith('ops_get_player_view', {
      p_view_token: 'v'.repeat(32),
    });
    expect(result).toEqual(view);
  });

  it('오염 응답(clock 누락) → ValidationError(E3005)', async () => {
    const bad = makePlayerView() as Record<string, unknown>;
    delete bad.clock;
    mockRpc.mockResolvedValueOnce({ data: bad, error: null });

    const promise = repo.getPlayerView('v'.repeat(32));
    await expect(promise).rejects.toBeTruthy();
    try {
      await promise;
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
      expect((e as { code: string }).code).toBe(ERROR_CODES.VALIDATION_SCHEMA);
    }
  });

  it('오염 응답(me.chips 문자열) → ValidationError', async () => {
    const bad = makePlayerView();
    (bad.me as Record<string, unknown>).chips = 'oops';
    mockRpc.mockResolvedValueOnce({ data: bad, error: null });

    const promise = repo.getPlayerView('v'.repeat(32));
    await expect(promise).rejects.toBeTruthy();
    try {
      await promise;
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
    }
  });
});

describe('SupabaseOpsPlayerRepository.issuePlayerCredentials — 응답 경계 검증', () => {
  const repo = new SupabaseOpsPlayerRepository();

  it('정상 자격증명 → participantId/viewToken/claimPin 반환', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { participantId: 'p1', viewToken: 'v'.repeat(32), claimPin: '1234' },
      error: null,
    });

    const result = await repo.issuePlayerCredentials('p1', 'a1');

    expect(result).toEqual({ participantId: 'p1', viewToken: 'v'.repeat(32), claimPin: '1234' });
  });

  it('participantId 누락 시 인자 participantId 로 폴백', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { viewToken: 'v'.repeat(32), claimPin: '1234' },
      error: null,
    });

    const result = await repo.issuePlayerCredentials('p-arg', 'a1');

    expect(result.participantId).toBe('p-arg');
  });

  it('빈 자격증명(viewToken/claimPin 빈 문자열) → ValidationError', async () => {
    mockRpc.mockResolvedValueOnce({ data: { viewToken: '', claimPin: '' }, error: null });

    const promise = repo.issuePlayerCredentials('p1', 'a1');
    await expect(promise).rejects.toBeTruthy();
    try {
      await promise;
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
      expect((e as { code: string }).code).toBe(ERROR_CODES.VALIDATION_SCHEMA);
    }
  });
});
