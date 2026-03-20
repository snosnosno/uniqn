import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAutoLogin, checkAutoLoginEnabled } from '@/hooks/useAutoLogin';

const mockIsAutoLoginEnabled = jest.fn();
const mockSetAutoLoginEnabled = jest.fn();
const mockSetBiometricEnabled = jest.fn();

jest.mock('@/lib/secureStorage', () => ({
  settingsStorage: {
    isAutoLoginEnabled: (...args: unknown[]) => mockIsAutoLoginEnabled(...args),
    setAutoLoginEnabled: (...args: unknown[]) => mockSetAutoLoginEnabled(...args),
  },
}));

jest.mock('@/services/auth', () => ({
  setBiometricEnabled: (...args: unknown[]) => mockSetBiometricEnabled(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useAutoLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAutoLoginEnabled.mockResolvedValue(true);
    mockSetAutoLoginEnabled.mockResolvedValue(undefined);
    mockSetBiometricEnabled.mockResolvedValue(undefined);
  });

  it('저장된 자동 로그인 설정을 기본값으로 로드해야 함', async () => {
    mockIsAutoLoginEnabled.mockResolvedValue(false);

    const { result } = renderHook(() => useAutoLogin());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.autoLoginEnabled).toBe(false);
  });

  it('자동 로그인을 끄면 생체 인증도 함께 비활성화해야 함', async () => {
    const { result } = renderHook(() => useAutoLogin());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setAutoLoginEnabled(false);
    });

    expect(mockSetAutoLoginEnabled).toHaveBeenCalledWith(false);
    expect(mockSetBiometricEnabled).toHaveBeenCalledWith(false);
    expect(result.current.autoLoginEnabled).toBe(false);
  });

  it('자동 로그인을 켜면 생체 인증 설정은 건드리지 않아야 함', async () => {
    const { result } = renderHook(() => useAutoLogin());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setAutoLoginEnabled(true);
    });

    expect(mockSetAutoLoginEnabled).toHaveBeenCalledWith(true);
    expect(mockSetBiometricEnabled).not.toHaveBeenCalled();
    expect(result.current.autoLoginEnabled).toBe(true);
  });

  it('생체 인증 비활성화에 실패하면 자동 로그인 설정을 롤백해야 함', async () => {
    mockSetBiometricEnabled.mockRejectedValueOnce(new Error('biometric failure'));

    const { result } = renderHook(() => useAutoLogin());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.setAutoLoginEnabled(false)).rejects.toThrow('biometric failure');
    });

    expect(mockSetAutoLoginEnabled).toHaveBeenNthCalledWith(1, false);
    expect(mockSetAutoLoginEnabled).toHaveBeenNthCalledWith(2, true);
    expect(result.current.autoLoginEnabled).toBe(true);
  });
});

describe('checkAutoLoginEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('storage 조회 실패 시 기본값 true를 반환해야 함', async () => {
    mockIsAutoLoginEnabled.mockRejectedValueOnce(new Error('storage failure'));

    await expect(checkAutoLoginEnabled()).resolves.toBe(true);
  });
});
