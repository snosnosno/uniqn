/**
 * useChatSafety — (S4) 방 안전 상태 조회 + 알림 끄기/켜기 · 차단/해제
 *
 * 성공하면 안전 상태·목록(blocked 컬럼)·방 메타를 무효화한다. 실패는 toast 로 알린다.
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ERROR_CODES, PermissionError } from '@/errors/AppError';
import { useChatSafety } from '../useChatSafety';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockGetSafety = jest.fn();
jest.mock('@/repositories/chat', () => ({
  chatRepository: { getSafetyState: (...a: unknown[]) => mockGetSafety(...a) },
}));

const mockSetMuted = jest.fn();
const mockBlock = jest.fn();
const mockUnblock = jest.fn();
jest.mock('@/services/chat', () => ({
  chatService: {
    setMuted: (...a: unknown[]) => mockSetMuted(...a),
    block: (...a: unknown[]) => mockBlock(...a),
    unblock: (...a: unknown[]) => mockUnblock(...a),
  },
}));
jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: jest.fn(),
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: (s: unknown) => unknown) => selector({ user: { uid: 'me' } })),
}));
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@/stores/toastStore', () => ({
  useToastStore: { getState: () => mockToast },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const CONV = '0f8fad5b-d9cb-469f-a165-70867728950e';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate };
}

function invalidatedKeys(invalidate: jest.SpyInstance) {
  return invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSafety.mockResolvedValue({ blockedBySides: [], mutedUntil: null });
  mockSetMuted.mockResolvedValue(undefined);
  mockBlock.mockResolvedValue(undefined);
  mockUnblock.mockResolvedValue(undefined);
});

describe('useChatSafety 조회', () => {
  it('내 쪽이 막았으면 blockState=mine, infinity 뮤트면 muted', async () => {
    mockGetSafety.mockResolvedValue({ blockedBySides: ['seeker'], mutedUntil: 'infinity' });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useChatSafety(CONV, 'seeker'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.blockState).toBe('mine'));
    expect(result.current.muted).toBe(true);
    expect(mockGetSafety).toHaveBeenCalledWith(CONV);
  });

  it('상대 쪽이 막았으면 theirs', async () => {
    mockGetSafety.mockResolvedValue({ blockedBySides: ['employer'], mutedUntil: null });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useChatSafety(CONV, 'seeker'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.blockState).toBe('theirs'));
    expect(result.current.muted).toBe(false);
  });

  it('방이 아직 없으면(새 방) 조회하지 않고 none', () => {
    const { Wrapper } = setup();
    const { result } = renderHook(() => useChatSafety(null, 'seeker'), { wrapper: Wrapper });
    expect(result.current.blockState).toBe('none');
    expect(mockGetSafety).not.toHaveBeenCalled();
  });
});

describe('useChatSafety 동작', () => {
  it('알림 끄기 → setMuted(true) · 안전 상태 무효화 · 안내', async () => {
    const { Wrapper, invalidate } = setup();
    const { result } = renderHook(() => useChatSafety(CONV, 'seeker'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.setMuted(true);
    });

    expect(mockSetMuted).toHaveBeenCalledWith(CONV, true);
    expect(invalidatedKeys(invalidate)).toContain(JSON.stringify(['chat', 'safety', CONV]));
    expect(mockToast.success).toHaveBeenCalledWith('이 대화 알림을 껐어요');
  });

  it('알림 켜기 → setMuted(false) · 안내', async () => {
    const { Wrapper } = setup();
    const { result } = renderHook(() => useChatSafety(CONV, 'seeker'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.setMuted(false);
    });

    expect(mockSetMuted).toHaveBeenCalledWith(CONV, false);
    expect(mockToast.success).toHaveBeenCalledWith('이 대화 알림을 켰어요');
  });

  it('차단 → block · 안전 상태·목록·방 메타를 무효화', async () => {
    const { Wrapper, invalidate } = setup();
    const { result } = renderHook(() => useChatSafety(CONV, 'seeker'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.block();
    });

    expect(mockBlock).toHaveBeenCalledWith(CONV);
    expect(invalidatedKeys(invalidate)).toEqual(
      expect.arrayContaining([
        JSON.stringify(['chat', 'safety', CONV]),
        JSON.stringify(['chat', 'list']),
        JSON.stringify(['chat', 'conversation', CONV]),
      ])
    );
    expect(mockToast.success).toHaveBeenCalledWith('대화를 차단했어요');
  });

  it('차단 해제 실패(상대가 막음)는 서버 문구로 toast · 던지지 않는다', async () => {
    mockUnblock.mockRejectedValue(
      new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
        userMessage: '상대가 차단한 대화는 해제할 수 없습니다',
      })
    );
    const { Wrapper } = setup();
    const { result } = renderHook(() => useChatSafety(CONV, 'seeker'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.unblock();
    });

    expect(mockToast.error).toHaveBeenCalledWith('상대가 차단한 대화는 해제할 수 없습니다');
  });
});
