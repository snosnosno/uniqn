/**
 * ops 오프라인 가드 회귀 테스트 (결함⑦-3).
 *
 * networkState 만 오프라인으로 고정하고 가드(remoteMutationGuard)는 **실제 구현**을 쓴다 —
 * 검증 대상이 "훅의 mutationFn 첫 줄에 가드가 배선돼 있는가" 이기 때문이다.
 * 가드 자체를 모킹하면 배선이 빠져도 테스트가 통과하므로 의미가 없다.
 *
 * 단언: 오프라인에서 대표 쓰기 뮤테이션이 NetworkError(NETWORK_OFFLINE)로 throw 되고
 * Service 는 **호출되지 않는다**(요청이 발사되지 않는다). 온라인 대조군으로 가드가
 * 정상 경로를 막지 않는 것도 함께 고정한다.
 */
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ERROR_CODES, NetworkError } from '@/errors';
import { useAuthStore } from '@/stores/authStore';
import {
  useRegisterParticipant,
  useBustParticipant,
  useSetParticipantChips,
  useRedrawWaitlistFill,
  useReseatParticipants,
} from '../useOpsMutations';
import { useAdjustClock } from '../useOpsClockMutations';

// jest.setup.js 의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

// 네트워크 상태만 갈아끼운다. 가드는 실제 구현이 이 값을 읽고 판단한다.
const mockNetwork = { online: false };

jest.mock('@/services/offline/networkState', () => ({
  getNetworkState: () => ({
    isOnline: mockNetwork.online,
    isOffline: !mockNetwork.online,
    isChecking: false,
    connectionType: mockNetwork.online ? 'wifi' : 'none',
    isInternetReachable: mockNetwork.online,
    lastChecked: null,
    details: null,
  }),
  isNetworkAvailableForMutation: () => mockNetwork.online,
}));

const mockRegisterParticipant = jest.fn();
const mockBustParticipant = jest.fn();
const mockSetParticipantChips = jest.fn();
const mockRedrawWaitlistFill = jest.fn();
const mockReseatParticipants = jest.fn();
const mockClockAdjust = jest.fn();

jest.mock('@/services/ops', () => ({
  opsTournamentService: {},
  opsParticipantService: {
    registerParticipant: (...args: unknown[]) => mockRegisterParticipant(...args),
    bustParticipant: (...args: unknown[]) => mockBustParticipant(...args),
    setParticipantChips: (...args: unknown[]) => mockSetParticipantChips(...args),
  },
  opsTableService: {},
  opsSeatService: {
    redrawWaitlistFill: (...args: unknown[]) => mockRedrawWaitlistFill(...args),
    reseatParticipants: (...args: unknown[]) => mockReseatParticipants(...args),
  },
  opsStaffService: {},
  opsClockService: {
    adjust: (...args: unknown[]) => mockClockAdjust(...args),
  },
  opsBlindLevelService: {},
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      success: (...a: unknown[]) => mockToastSuccess(...a),
      error: (...a: unknown[]) => mockToastError(...a),
    }),
  },
}));

const TID = 't1';

const ALL_SERVICE_MOCKS = [
  mockRegisterParticipant,
  mockBustParticipant,
  mockSetParticipantChips,
  mockRedrawWaitlistFill,
  mockReseatParticipants,
  mockClockAdjust,
];

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** 뮤테이션을 실행하고 reject 된 에러를 돌려준다(성공하면 undefined). */
async function runAndCatch<TVars>(
  useHook: () => { mutateAsync: (v: TVars) => Promise<unknown> },
  variables: TVars
): Promise<unknown> {
  const client = createClient();
  const { result } = renderHook(useHook, { wrapper: createWrapper(client) });

  let caught: unknown;
  await act(async () => {
    try {
      await result.current.mutateAsync(variables);
    } catch (e) {
      caught = e;
    }
  });
  return caught;
}

/** 오프라인 차단의 공통 단언 — NetworkError(E1001) + Service 전량 미호출. */
function expectBlockedOffline(caught: unknown) {
  expect(caught).toBeInstanceOf(NetworkError);
  expect((caught as NetworkError).code).toBe(ERROR_CODES.NETWORK_OFFLINE);
  ALL_SERVICE_MOCKS.forEach((m) => expect(m).not.toHaveBeenCalled());
}

const REGISTER_INPUT = { name: '홍길동', phone: null } as never;
const CHIP_INPUT = { participantId: 'p1', chips: 30000 } as never;
const WAITLIST_ASSIGNMENTS = [{ seatId: 's1', participantId: 'p1', expected: null }];

beforeEach(() => {
  mockNetwork.online = false;
  ALL_SERVICE_MOCKS.forEach((m) => m.mockReset());
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  (useAuthStore as unknown as jest.Mock).mockReturnValue('actor-1');
});

describe('ops 오프라인 가드 — 쓰기 뮤테이션 차단', () => {
  it('참가자 등록: 오프라인이면 NetworkError(NETWORK_OFFLINE) + Service 미호출', async () => {
    const caught = await runAndCatch(() => useRegisterParticipant(TID), REGISTER_INPUT);
    expectBlockedOffline(caught);
  });

  it('탈락(bust): 오프라인이면 NetworkError(NETWORK_OFFLINE) + Service 미호출', async () => {
    const caught = await runAndCatch(() => useBustParticipant(TID), {
      participantId: 'p1',
      eliminatorId: null,
    });
    expectBlockedOffline(caught);
  });

  it('칩 카운트 설정: 오프라인이면 NetworkError(NETWORK_OFFLINE) + Service 미호출', async () => {
    const caught = await runAndCatch(() => useSetParticipantChips(TID), CHIP_INPUT);
    expectBlockedOffline(caught);
  });

  // 스냅샷 전제 액션 — 클라가 계산한 배정 계획을 통째로 보내므로 오프라인 진입 자체를 막아야 한다.
  it('redraw(대기자 좌석 채우기): 오프라인이면 NetworkError + 배정 계획이 전송되지 않는다', async () => {
    const caught = await runAndCatch(() => useRedrawWaitlistFill(TID), WAITLIST_ASSIGNMENTS);
    expectBlockedOffline(caught);
  });

  it('reseat(전원 재배치): 오프라인이면 NetworkError + 배정 계획이 전송되지 않는다', async () => {
    const caught = await runAndCatch(() => useReseatParticipants(TID), {
      assignments: [{ participantId: 'p1', seatId: 's1' }],
      mode: 'random_draw' as const,
    });
    expectBlockedOffline(caught);
  });

  it('클럭 시간 보정: 오프라인이면 NetworkError(NETWORK_OFFLINE) + Service 미호출', async () => {
    const caught = await runAndCatch(() => useAdjustClock(TID), 60);
    expectBlockedOffline(caught);
  });
});

describe('ops 오프라인 가드 — 온라인 대조군', () => {
  // 가드가 정상 경로까지 막아버리는 회귀를 막는다(차단 테스트만 있으면 상시 throw 도 통과한다).
  it('온라인이면 참가자 등록이 Service 로 그대로 위임된다', async () => {
    mockNetwork.online = true;
    mockRegisterParticipant.mockResolvedValueOnce({ entryNumber: 7 });

    const caught = await runAndCatch(() => useRegisterParticipant(TID), REGISTER_INPUT);

    expect(caught).toBeUndefined();
    expect(mockRegisterParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ tournamentId: TID }),
      'actor-1'
    );
  });

  it('온라인이면 redraw 가 배정 계획을 Service 로 그대로 전달한다', async () => {
    mockNetwork.online = true;
    mockRedrawWaitlistFill.mockResolvedValueOnce({ moved: 1 });

    const caught = await runAndCatch(() => useRedrawWaitlistFill(TID), WAITLIST_ASSIGNMENTS);

    expect(caught).toBeUndefined();
    expect(mockRedrawWaitlistFill).toHaveBeenCalledWith(TID, 'actor-1', WAITLIST_ASSIGNMENTS);
  });
});
