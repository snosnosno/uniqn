/**
 * UNIQN Mobile - useQRCode Hooks Tests
 *
 * @description Unit tests for QR code hooks
 * @version 2.0.0 - Updated for EventQR system
 */

import { renderHook, act } from '@testing-library/react-native';
import type { QRCodeScanResult, EventQRDisplayData, QRCodeAction } from '@/types';

// Import after mocks
import { useQRCodeScanner, useQRScannerModal, useQRDisplayModal } from '@/hooks/useQRCode';

// Mock eventQRService
const mockProcessEventQRCheckIn = jest.fn();

jest.mock('@/services/eventQRService', () => ({
  processEventQRCheckIn: (...args: unknown[]) => mockProcessEventQRCheckIn(...args),
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

// Helper function to create mock EventQRDisplayData
function createMockEventQRDisplayData(
  overrides: Partial<EventQRDisplayData> = {}
): EventQRDisplayData {
  return {
    type: 'event',
    jobPostingId: 'event-123',
    date: '2024-01-15',
    action: 'checkIn',
    securityCode: 'uuid-security-code',
    createdAt: Date.now(),
    expiresAt: Date.now() + 3 * 60 * 1000, // 3 minutes
    ...overrides,
  };
}

describe('useQRCode Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useQRCodeScanner', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(() => useQRCodeScanner({}));

      expect(result.current.handleScanResult).toBeDefined();
      expect(result.current.isProcessing).toBe(false);
    });

    it('should show error toast when scan fails', async () => {
      const { result } = renderHook(() => useQRCodeScanner({}));

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

    it('should show error toast when qrString is missing', async () => {
      const { result } = renderHook(() => useQRCodeScanner({}));

      const resultWithoutString: QRCodeScanResult = {
        success: true,
        qrString: undefined,
      };

      await act(async () => {
        await result.current.handleScanResult(resultWithoutString);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'QR 코드를 읽을 수 없습니다.',
      });
    });

    it('should process checkIn with EventQR system', async () => {
      const mockScanResult = {
        success: true,
        workLogId: 'worklog-123',
        action: 'checkIn' as QRCodeAction,
        checkTime: new Date(),
        message: '출근이 완료되었습니다.',
      };
      mockProcessEventQRCheckIn.mockResolvedValueOnce(mockScanResult);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useQRCodeScanner({ onSuccess }));

      const scanResult: QRCodeScanResult = {
        success: true,
        qrString: JSON.stringify(createMockEventQRDisplayData()),
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      expect(mockProcessEventQRCheckIn).toHaveBeenCalledWith(scanResult.qrString, 'test-user-id');
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '출근이 완료되었습니다.',
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should process checkOut with EventQR system', async () => {
      const mockScanResult = {
        success: true,
        workLogId: 'worklog-123',
        action: 'checkOut' as QRCodeAction,
        checkTime: new Date(),
        message: '퇴근이 완료되었습니다.',
      };
      mockProcessEventQRCheckIn.mockResolvedValueOnce(mockScanResult);

      const { result } = renderHook(() => useQRCodeScanner({}));

      const qrData = createMockEventQRDisplayData({ action: 'checkOut' });
      const scanResult: QRCodeScanResult = {
        success: true,
        qrString: JSON.stringify(qrData),
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '퇴근이 완료되었습니다.',
      });
    });

    it('should handle processing error', async () => {
      mockProcessEventQRCheckIn.mockRejectedValueOnce(new Error('처리 실패'));

      const onError = jest.fn();
      const { result } = renderHook(() => useQRCodeScanner({ onError }));

      const scanResult: QRCodeScanResult = {
        success: true,
        qrString: JSON.stringify(createMockEventQRDisplayData()),
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '처리 실패',
      });
      expect(onError).toHaveBeenCalled();
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
      expect(result.current.displayData).toBeNull();
      expect(result.current.action).toBeUndefined();
      expect(result.current.openDisplay).toBeDefined();
      expect(result.current.closeDisplay).toBeDefined();
      expect(result.current.updateDisplayData).toBeDefined();
    });

    it('should open display with EventQRDisplayData', () => {
      const { result } = renderHook(() => useQRDisplayModal());
      const mockDisplayData = createMockEventQRDisplayData();

      act(() => {
        result.current.openDisplay(mockDisplayData, 'checkIn');
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.displayData).toBe(mockDisplayData);
      expect(result.current.action).toBe('checkIn');
    });

    it('should close display', () => {
      const { result } = renderHook(() => useQRDisplayModal());
      const mockDisplayData = createMockEventQRDisplayData();

      act(() => {
        result.current.openDisplay(mockDisplayData);
      });

      act(() => {
        result.current.closeDisplay();
      });

      expect(result.current.isVisible).toBe(false);
      // Note: displayData is cleared after timeout in actual implementation
    });

    it('should update display data', () => {
      const { result } = renderHook(() => useQRDisplayModal());
      const initialData = createMockEventQRDisplayData();
      const updatedData = createMockEventQRDisplayData({
        jobPostingId: 'updated-event',
      });

      act(() => {
        result.current.openDisplay(initialData);
      });

      act(() => {
        result.current.updateDisplayData(updatedData);
      });

      expect(result.current.displayData).toBe(updatedData);
    });
  });
});
