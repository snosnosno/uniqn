/**
 * useChatMediaUrl — 사진 서명 URL (TTL 5분)
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatMediaUrl } from '../useChatMediaUrl';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockSign = jest.fn();
jest.mock('@/repositories/chat', () => ({
  chatRepository: { createSignedImageUrl: (...a: unknown[]) => mockSign(...a) },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: (s: unknown) => unknown) => selector({ user: { uid: 'u1' } })),
}));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => jest.clearAllMocks());

describe('useChatMediaUrl', () => {
  it('경로로 TTL 300초 서명 URL 을 받는다', async () => {
    mockSign.mockResolvedValue('https://x/signed');
    const { result } = renderHook(() => useChatMediaUrl('a/b/c.jpg'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.url).toBe('https://x/signed'));
    expect(mockSign).toHaveBeenCalledWith('a/b/c.jpg', 300);
  });

  it('경로가 없으면 조회하지 않는다', () => {
    const { result } = renderHook(() => useChatMediaUrl(null), { wrapper: wrapper() });
    expect(result.current.url).toBeNull();
    expect(mockSign).not.toHaveBeenCalled();
  });
});
