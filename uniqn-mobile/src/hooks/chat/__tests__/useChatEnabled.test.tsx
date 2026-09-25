/**
 * useChatEnabled — 원격 플래그 + 빌드타임 fallback(false)
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatEnabled } from '../useChatEnabled';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockRaw = jest.fn();
jest.mock('@/services/appConfigService', () => ({
  getChatFlagRaw: () => mockRaw(),
}));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useChatEnabled', () => {
  it('원격 행이 없으면(null) 닫힌다', async () => {
    mockRaw.mockResolvedValue(null);
    const { result } = renderHook(() => useChatEnabled(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });

  it('로딩 중에도 닫혀 있다', () => {
    mockRaw.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useChatEnabled(), { wrapper: wrapper() });
    expect(result.current.enabled).toBe(false);
  });

  it('원격이 {"enabled": true} 면 열린다', async () => {
    mockRaw.mockResolvedValue({ enabled: true });
    const { result } = renderHook(() => useChatEnabled(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.enabled).toBe(true));
  });
});
