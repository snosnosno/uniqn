/**
 * UNIQN Mobile - useQRCode Hooks Tests
 *
 * @description Unit tests for QR code hooks
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-native';
import {
  createMockQRCodeData,
  resetCounters,
} from '../mocks/factories';
import type { QRCodeScanResult, QRCodeValidationResult } from '@/types';

// Mock services
const mockCreateQRCode = jest.fn();
const mockValidateQRCode = jest.fn();
const mockCheckIn = jest.fn();
const mockCheckOut = jest.fn();

jest.mock('@/services/qrCodeService', () => ({
  createQRCode: (...args: unknown[]) => mockCreateQRCode(...args),
  validateQRCode: (...args: unknown[]) => mockValidateQRCode(...args),
}));

jest.mock('@/services/workLogService', () => ({
  checkIn: (...args: unknown[]) => mockCheckIn(...args),
  checkOut: (...args: unknown[]) => mockCheckOut(...args),
}));

// Mock stores
const mockAddToast = jest.fn();
const mockUser = { uid: 'test-user-id' };

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof mockAddToast }) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock React Query
const mockMutate = jest.fn();
const mockMutateAsync = jest.fn();
let mockIsPending = false;
let mockData: unknown = undefined;
let mockError: Error | null = null;

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((options: {
    mutationFn: (...args: unknown[]) => Promise<unknown>;
    onSuccess?: (data: unknown) => void;
    onError?: (error: Error) => void;
  }) => {
    mockMutate.mockImplementation(async (args: unknown) => {
      try {
        mockIsPending = true;
        const result = await options.mutationFn(args);
        mockData = result;
        options.onSuccess?.(result);
        mockIsPending = false;
        return result;
      } catch (error) {
        mockError = error as Error;
        options.onError?.(error as Error);
        mockIsPending = false;
        throw error;
      }
    });

    return {
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      data: mockData,
      isPending: mockIsPending,
      error: mockError,
      reset: jest.fn(),
    };
  }),
}));

// Import after mocks
import {
  useCreateQRCode,
  useQRCodeScanner,
  useValidateQRCode,
  useQRScannerModal,
  useQRDisplayModal,
} from '@/hooks/useQRCode';

describe('useQRCode Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockIsPending = false;
    mockData = undefined;
    mockError = null;
  });

  describe('useCreateQRCode', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(() => useCreateQRCode());

      expect(result.current.createQRCode).toBeDefined();
      expect(result.current.qrData).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.reset).toBeDefined();
    });

    it('should call createQRCode service with correct params', async () => {
      const mockQRData = createMockQRCodeData();
      mockCreateQRCode.mockResolvedValueOnce(mockQRData);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useCreateQRCode({ onSuccess }));

      await act(async () => {
        await result.current.createQRCode({
          eventId: 'event-123',
          action: 'checkIn',
        });
      });

      expect(mockCreateQRCode).toHaveBeenCalledWith('test-user-id', {
        eventId: 'event-123',
        action: 'checkIn',
      });
    });

    it('should show error toast on failure', async () => {
      mockCreateQRCode.mockRejectedValueOnce(new Error('Failed'));

      const onError = jest.fn();
      const { result } = renderHook(() => useCreateQRCode({ onError }));

      await act(async () => {
        try {
          await result.current.createQRCode({
            eventId: 'event-123',
            action: 'checkIn',
          });
        } catch {
          // Expected to throw
        }
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'QR 코드 생성에 실패했습니다.',
      });
    });
  });

  describe('useQRCodeScanner', () => {
    const defaultOptions = {
      workLogId: 'worklog-123',
      expectedAction: 'checkIn' as const,
    };

    it('should return initial state correctly', () => {
      const { result } = renderHook(() => useQRCodeScanner(defaultOptions));

      expect(result.current.handleScanResult).toBeDefined();
      expect(result.current.isProcessing).toBe(false);
    });

    it('should show error toast when scan fails', async () => {
      const { result } = renderHook(() => useQRCodeScanner(defaultOptions));

      const failedResult: QRCodeScanResult = {
        success: false,
        error: '스캔 실패',
      };

      await act(async () => {
        await result.current.handleScanResult(failedResult);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '스캔 실패',
      });
    });

    it('should show error toast when qrCodeId is missing', async () => {
      const { result } = renderHook(() => useQRCodeScanner(defaultOptions));

      const resultWithoutId: QRCodeScanResult = {
        success: true,
        qrCodeId: undefined,
      };

      await act(async () => {
        await result.current.handleScanResult(resultWithoutId);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'QR 코드 정보를 읽을 수 없습니다.',
      });
    });

    it('should validate QR code and process checkIn', async () => {
      const validationResult: QRCodeValidationResult = {
        isValid: true,
        qrData: createMockQRCodeData() as unknown as import('@/types').QRCodeData,
      };
      mockValidateQRCode.mockResolvedValueOnce(validationResult);
      mockCheckIn.mockResolvedValueOnce(undefined);

      const onSuccess = jest.fn();
      const { result } = renderHook(() =>
        useQRCodeScanner({ ...defaultOptions, onSuccess })
      );

      const scanResult: QRCodeScanResult = {
        success: true,
        qrCodeId: 'qr-123',
        action: 'checkIn',
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      expect(mockValidateQRCode).toHaveBeenCalledWith('qr-123', 'checkIn');
      expect(mockCheckIn).toHaveBeenCalledWith('worklog-123', 'qr-123');
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '출근이 완료되었습니다.',
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should validate QR code and process checkOut', async () => {
      const validationResult: QRCodeValidationResult = {
        isValid: true,
        qrData: createMockQRCodeData({ action: 'checkOut' }) as unknown as import('@/types').QRCodeData,
      };
      mockValidateQRCode.mockResolvedValueOnce(validationResult);
      mockCheckOut.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useQRCodeScanner({
          workLogId: 'worklog-123',
          expectedAction: 'checkOut',
        })
      );

      const scanResult: QRCodeScanResult = {
        success: true,
        qrCodeId: 'qr-123',
        action: 'checkOut',
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      expect(mockCheckOut).toHaveBeenCalledWith('worklog-123', 'qr-123');
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '퇴근이 완료되었습니다.',
      });
    });

    it('should show error when validation fails', async () => {
      const validationResult: QRCodeValidationResult = {
        isValid: false,
        error: 'QR 코드가 만료되었습니다.',
      };
      mockValidateQRCode.mockResolvedValueOnce(validationResult);

      const { result } = renderHook(() => useQRCodeScanner(defaultOptions));

      const scanResult: QRCodeScanResult = {
        success: true,
        qrCodeId: 'qr-123',
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'QR 코드가 만료되었습니다.',
      });
      expect(mockCheckIn).not.toHaveBeenCalled();
    });
  });

  describe('useQRScannerModal', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(() => useQRScannerModal());

      expect(result.current.isVisible).toBe(false);
      expect(result.current.action).toBeUndefined();
      expect(result.current.openScanner).toBeDefined();
      expect(result.current.closeScanner).toBeDefined();
    });

    it('should open scanner with action', () => {
      const { result } = renderHook(() => useQRScannerModal());

      act(() => {
        result.current.openScanner('checkIn');
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.action).toBe('checkIn');
    });

    it('should close scanner and reset action', () => {
      const { result } = renderHook(() => useQRScannerModal());

      act(() => {
        result.current.openScanner('checkOut');
      });

      expect(result.current.isVisible).toBe(true);

      act(() => {
        result.current.closeScanner();
      });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.action).toBeUndefined();
    });
  });

  describe('useQRDisplayModal', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(() => useQRDisplayModal());

      expect(result.current.isVisible).toBe(false);
      expect(result.current.qrData).toBeNull();
      expect(result.current.action).toBeUndefined();
      expect(result.current.openDisplay).toBeDefined();
      expect(result.current.closeDisplay).toBeDefined();
      expect(result.current.updateQRData).toBeDefined();
    });

    it('should open display with QR data', () => {
      const { result } = renderHook(() => useQRDisplayModal());
      const mockQRData = createMockQRCodeData() as unknown as import('@/types').QRCodeData;

      act(() => {
        result.current.openDisplay(mockQRData, 'checkIn');
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.qrData).toBe(mockQRData);
      expect(result.current.action).toBe('checkIn');
    });

    it('should close display', () => {
      const { result } = renderHook(() => useQRDisplayModal());
      const mockQRData = createMockQRCodeData() as unknown as import('@/types').QRCodeData;

      act(() => {
        result.current.openDisplay(mockQRData);
      });

      act(() => {
        result.current.closeDisplay();
      });

      expect(result.current.isVisible).toBe(false);
      // Note: qrData is cleared after timeout in actual implementation
    });

    it('should update QR data', () => {
      const { result } = renderHook(() => useQRDisplayModal());
      const initialData = createMockQRCodeData() as unknown as import('@/types').QRCodeData;
      const updatedData = createMockQRCodeData({
        eventId: 'updated-event',
      }) as unknown as import('@/types').QRCodeData;

      act(() => {
        result.current.openDisplay(initialData);
      });

      act(() => {
        result.current.updateQRData(updatedData);
      });

      expect(result.current.qrData).toBe(updatedData);
    });
  });
});

describe('useValidateQRCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPending = false;
    mockData = undefined;
    mockError = null;
  });

  it('should return initial state correctly', () => {
    const { result } = renderHook(() => useValidateQRCode());

    expect(result.current.validateQRCode).toBeDefined();
    expect(result.current.validationResult).toBeUndefined();
    expect(result.current.isValidating).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
