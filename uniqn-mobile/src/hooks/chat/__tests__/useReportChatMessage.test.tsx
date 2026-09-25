/**
 * useReportChatMessage — (S4) 메시지 신고. 성공 toast 문구는 확정 초안 A.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessError } from '@/errors/AppError';
import { CHAT_ERROR_CODES } from '@/errors/chat';
import { useReportChatMessage } from '../useReportChatMessage';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockReport = jest.fn();
jest.mock('@/services/chat', () => ({
  chatService: { reportMessage: (...a: unknown[]) => mockReport(...a) },
}));
jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: jest.fn(),
}));
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@/stores/toastStore', () => ({
  useToastStore: { getState: () => mockToast },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const MSG = '9b2d6f3e-1c4a-4e8b-9f1a-2b3c4d5e6f70';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => jest.clearAllMocks());

describe('useReportChatMessage', () => {
  it('성공하면 true · 접수 안내 toast', async () => {
    mockReport.mockResolvedValue('r1');
    const { result } = renderHook(() => useReportChatMessage(), { wrapper: wrapper() });

    let ok = false;
    await act(async () => {
      ok = await result.current.report({ messageId: MSG, reason: 'scam', detail: null });
    });

    expect(ok).toBe(true);
    expect(mockReport).toHaveBeenCalledWith({ messageId: MSG, reason: 'scam', detail: null });
    expect(mockToast.success).toHaveBeenCalledWith('신고가 접수됐어요. 운영팀이 확인할게요.');
  });

  it('실패하면 false · 매핑된 문구로 toast(중복 신고 등)', async () => {
    mockReport.mockRejectedValue(
      new BusinessError(CHAT_ERROR_CODES.CHAT_REPORT_DUPLICATE, {
        userMessage: '이미 신고한 메시지예요.',
      })
    );
    const { result } = renderHook(() => useReportChatMessage(), { wrapper: wrapper() });

    let ok = true;
    await act(async () => {
      ok = await result.current.report({ messageId: MSG, reason: 'abuse', detail: null });
    });

    expect(ok).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith('이미 신고한 메시지예요.');
  });
});
