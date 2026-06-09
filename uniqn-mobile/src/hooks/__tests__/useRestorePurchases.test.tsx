// src/hooks/__tests__/useRestorePurchases.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { useRestorePurchases } from '../useRestorePurchases';

const mockRestore = jest.fn((..._a: unknown[]) => Promise.resolve());
jest.mock('@/services/purchases', () => ({
  purchasesService: {
    restorePurchases: (...a: unknown[]) => mockRestore(...a),
  },
}));

const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { uid: '11111111-1111-4111-8111-111111111111' } }),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

beforeEach(() => {
  mockRestore.mockClear();
  mockInvalidate.mockClear();
  mockToastSuccess.mockClear();
  mockToastError.mockClear();
});

describe('useRestorePurchases', () => {
  it('성공: 서비스 호출 + wallet 쿼리 무효화 + success 토스트, restoring 원복', async () => {
    const { result } = renderHook(() => useRestorePurchases());
    await act(async () => {
      await result.current.restore();
    });
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(result.current.restoring).toBe(false);
  });

  it('실패: error 토스트 + restoring 원복(throw 안 함)', async () => {
    mockRestore.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useRestorePurchases());
    await act(async () => {
      await result.current.restore();
    });
    expect(mockToastError).toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(result.current.restoring).toBe(false);
  });

  it('복원 진행 중 중복 호출은 무시(이중탭 가드)', async () => {
    let resolveRestore: (() => void) | undefined;
    mockRestore.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRestore = resolve;
        })
    );
    const { result } = renderHook(() => useRestorePurchases());
    let first: Promise<void>;
    act(() => {
      first = result.current.restore();
    });
    await act(async () => {
      await result.current.restore(); // 진행 중 재호출 — 무시되어야 함
    });
    expect(mockRestore).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRestore?.();
      await first;
    });
    expect(result.current.restoring).toBe(false);
  });
});
