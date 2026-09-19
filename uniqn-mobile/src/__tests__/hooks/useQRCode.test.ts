/**
 * UNIQN Mobile - useQRCode Hooks Tests
 *
 * @description Unit tests for QR code hooks
 * @version 3.0.0 - 공고당 고정 QR 전환 (processQRCheckIn 단일 진입점)
 */

import { renderHook, act } from '@testing-library/react-native';
import type { QRCodeScanResult, VenueQRDisplayData, QRCodeAction } from '@/types';

// Import after mocks
import { useQRCodeScanner } from '@/hooks/useQRCode';

// Mock eventQRService
const mockProcessQRCheckIn = jest.fn();

jest.mock('@/services/work/eventQRService', () => ({
  processQRCheckIn: (...args: unknown[]) => mockProcessQRCheckIn(...args),
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

// 고정 QR 문자열 생성 헬퍼 (공고 ID 만 담기며 만료·갱신 개념이 없다)
function createVenueQRString(jobPostingId = 'posting-123'): string {
  const data: VenueQRDisplayData = { type: 'venue', jobPostingId };
  return JSON.stringify(data);
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

    it('should process checkIn with fixed venue QR', async () => {
      const mockScanResult = {
        success: true,
        workLogId: 'worklog-123',
        action: 'checkIn' as QRCodeAction,
        checkTime: new Date(),
        message: '출근이 완료되었습니다.',
      };
      mockProcessQRCheckIn.mockResolvedValueOnce(mockScanResult);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useQRCodeScanner({ onSuccess }));

      const scanResult: QRCodeScanResult = {
        success: true,
        qrString: createVenueQRString(),
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      expect(mockProcessQRCheckIn).toHaveBeenCalledWith(scanResult.qrString, 'test-user-id');
      expect(mockAddToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
      expect(onSuccess).toHaveBeenCalled();
    });

    // 같은 QR에서 출근/퇴근 액션은 서버 응답으로 해소된다.
    it('should process server-resolved checkOut with the same fixed venue QR', async () => {
      const mockScanResult = {
        success: true,
        workLogId: 'worklog-123',
        action: 'checkOut' as QRCodeAction,
        checkTime: new Date(),
        message: '퇴근이 완료되었습니다.',
      };
      mockProcessQRCheckIn.mockResolvedValueOnce(mockScanResult);

      const { result } = renderHook(() => useQRCodeScanner({}));

      const scanResult: QRCodeScanResult = {
        success: true,
        qrString: createVenueQRString(),
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      expect(mockProcessQRCheckIn).toHaveBeenCalledWith(scanResult.qrString, 'test-user-id');

      expect(mockAddToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('should expose multiple candidates and submit only the selected work log id', async () => {
      mockProcessQRCheckIn
        .mockResolvedValueOnce({
          success: false,
          requiresSelection: true,
          selectionToken: 'selection-token',
          candidates: [
            { workLogId: 'wl-1', date: '2026-09-10', timeSlot: '18:00', action: 'checkIn' },
            { workLogId: 'wl-2', date: '2026-09-10', timeSlot: '19:00', action: 'checkIn' },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          workLogId: 'wl-2',
          action: 'checkIn',
          message: '출근이 완료되었습니다.',
        });
      const { result } = renderHook(() => useQRCodeScanner({}));
      const scanResult: QRCodeScanResult = { success: true, qrString: createVenueQRString() };

      await act(async () => result.current.handleScanResult(scanResult));
      expect(result.current.pendingCandidates).toHaveLength(2);

      await act(async () => result.current.selectCandidate('wl-2'));
      expect(mockProcessQRCheckIn).toHaveBeenLastCalledWith(
        scanResult.qrString,
        'test-user-id',
        'wl-2',
        'selection-token'
      );
    });

    it('should handle processing error', async () => {
      mockProcessQRCheckIn.mockRejectedValueOnce(new Error('처리 실패'));

      const onError = jest.fn();
      const { result } = renderHook(() => useQRCodeScanner({ onError }));

      const scanResult: QRCodeScanResult = {
        success: true,
        qrString: createVenueQRString(),
      };

      await act(async () => {
        await result.current.handleScanResult(scanResult);
      });

      // 토스트 대신 lastError 상태로 에러 표시 (scanError UI)
      expect(result.current.lastError).toEqual({
        code: expect.any(String),
        message: '처리 실패',
        isRetryable: expect.any(Boolean),
        kind: 'generic',
      });
      expect(onError).toHaveBeenCalled();
    });
  });
});
