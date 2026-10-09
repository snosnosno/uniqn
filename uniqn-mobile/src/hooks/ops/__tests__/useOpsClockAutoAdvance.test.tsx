/**
 * useOpsClockAutoAdvance — 레벨 시간이 0 이 되면 서버에 따라잡기를 요청한다(모바일 콘솔).
 *
 * 고정하는 계약:
 *  1. 진행 중 + 시간 종료 + 다음 레벨 있음 + 온라인일 때만 요청한다.
 *  2. 마지막 레벨·일시정지·오프라인이면 보내지 않는다(요청 자체가 무의미하거나 못 나간다).
 *  3. 같은 틱에서 중복으로 보내지 않고, 앞 요청이 돌아오기 전에는 다시 보내지 않는다.
 *  4. 넘어갔을 때만(advanced > 0) 딸린 값(대회·통계·이력)을 다시 받는다 — 시계는 항상 다시 읽는다.
 *  5. 실패해도 던지지 않는다(시계가 일으킨 요청 — 운영 화면에 토스트를 띄우지 않는다).
 */
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { queryKeys } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useOpsClockAutoAdvance, type OpsClockAutoAdvanceInput } from '../useOpsClockAutoAdvance';

// jest.setup.js 의 전역 react-query 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockNetwork = { online: true };
jest.mock('@/services/offline/networkState', () => ({
  isNetworkAvailableForMutation: () => mockNetwork.online,
}));

const mockSync = jest.fn();
jest.mock('@/services/ops', () => ({
  opsClockService: { sync: (...args: unknown[]) => mockSync(...args) },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const TID = 't1';
const due: OpsClockAutoAdvanceInput = {
  isRunning: true,
  isExpired: true,
  hasNext: true,
  currentSort: 3,
  nowMs: 10_000,
};

function setup(initial: OpsClockAutoAdvanceInput) {
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ clock }: { clock: OpsClockAutoAdvanceInput }) => useOpsClockAutoAdvance(TID, clock),
    { wrapper, initialProps: { clock: initial } }
  );
  const keys = () => invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
  return { ...hook, keys };
}

const flush = () => act(async () => {});

beforeEach(() => {
  mockSync.mockReset();
  mockNetwork.online = true;
  useAuthStore.setState({ user: { uid: 'u1' } } as never);
});

describe('useOpsClockAutoAdvance', () => {
  it('진행 중 00:00 + 다음 레벨 → 서버에 따라잡기를 요청한다', async () => {
    mockSync.mockResolvedValue(1);
    setup(due);
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledWith(TID, 'u1');
  });

  it.each([
    ['시간이 남았다', { isExpired: false }],
    ['일시정지', { isRunning: false }],
    ['마지막 레벨(넘어갈 곳이 없다)', { hasNext: false }],
  ])('%s → 요청하지 않는다', async (_name, over) => {
    setup({ ...due, ...over });
    await flush();
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('오프라인이면 요청하지 않는다', async () => {
    mockNetwork.online = false;
    setup(due);
    await flush();
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('로그인 정보가 없으면 요청하지 않는다', async () => {
    useAuthStore.setState({ user: null } as never);
    setup(due);
    await flush();
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('넘어갔으면 시계 + 딸린 값(대회·통계·이력)을 다시 받는다', async () => {
    mockSync.mockResolvedValue(1);
    const { keys } = setup(due);
    await flush();
    expect(keys()).toEqual(
      expect.arrayContaining([
        queryKeys.ops.clock(TID),
        queryKeys.ops.tournamentDetail(TID),
        queryKeys.ops.liveStats(TID),
        queryKeys.ops.events(TID),
      ])
    );
  });

  it('안 넘어갔으면(0) 시계만 다시 읽는다 — 재시도마다 이력을 다시 받지 않는다', async () => {
    mockSync.mockResolvedValue(0);
    const { keys } = setup(due);
    await flush();
    expect(keys()).toEqual([queryKeys.ops.clock(TID)]);
  });

  it('앞 요청이 돌아오기 전에는 틱이 지나도 다시 보내지 않는다', async () => {
    mockSync.mockReturnValue(new Promise(() => undefined)); // 돌아오지 않는 요청
    const { rerender } = setup(due);
    await flush();
    rerender({ clock: { ...due, nowMs: 20_000 } });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it('서버가 아직 안 끝났다고 하면(0) 간격을 두고 다시 묻는다', async () => {
    mockSync.mockResolvedValue(0);
    const { rerender } = setup(due);
    await flush();
    // 같은 틱·간격 전 — 다시 보내지 않는다
    rerender({ clock: { ...due, nowMs: 10_500 } });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(1);
    // 1초 뒤 — 다시 묻는다
    rerender({ clock: { ...due, nowMs: 11_000 } });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(2);
  });

  it('실패해도 던지지 않고, 다음 간격에 다시 묻는다', async () => {
    mockSync.mockRejectedValueOnce(new Error('rpc down')).mockResolvedValue(1);
    const { rerender } = setup(due);
    await flush();
    rerender({ clock: { ...due, nowMs: 11_000 } });
    await flush();
    expect(mockSync).toHaveBeenCalledTimes(2);
  });
});
