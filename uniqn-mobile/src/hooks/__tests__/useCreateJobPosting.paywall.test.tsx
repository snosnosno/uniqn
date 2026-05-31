// src/hooks/__tests__/useCreateJobPosting.paywall.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCreateJobPosting } from '@/hooks/useJobManagement';
import { BusinessError, ERROR_CODES } from '@/errors';

// jest.setup.js는 @tanstack/react-query의 useMutation을 no-op 스텁으로 모킹한다.
// onError/onSuccess 분기를 실측하려면 실제 useMutation 구현을 복원해야 한다.
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({ useToastStore: () => ({ addToast: mockAddToast }) }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { uid: 'u1', displayName: 'U' }, profile: { name: 'U' } }),
}));
jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: jest.fn(),
  shouldApplyOptimisticUpdate: () => false,
}));
const mockCreate = jest.fn();
jest.mock('@/services', () => ({ createJobPosting: (...a: unknown[]) => mockCreate(...a) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockAddToast.mockReset();
  mockCreate.mockReset();
});

it('잔액부족(BUSINESS_INSUFFICIENT_BALANCE) 에러는 토스트를 띄우지 않는다 (PaywallModal이 화면에서 처리)', async () => {
  mockCreate.mockRejectedValue(
    new BusinessError(ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE, { userMessage: '부족' })
  );
  const { result } = renderHook(() => useCreateJobPosting(), { wrapper });

  await act(async () => {
    result.current.mutate({ input: {} as never });
  });
  await waitFor(() => expect(mockCreate).toHaveBeenCalled());

  const errorToasts = mockAddToast.mock.calls.filter((c) => c[0]?.type === 'error');
  expect(errorToasts).toHaveLength(0);
});

it('그 외 에러는 기존대로 토스트를 띄운다', async () => {
  mockCreate.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useCreateJobPosting(), { wrapper });
  await act(async () => {
    result.current.mutate({ input: {} as never });
  });
  await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
});
