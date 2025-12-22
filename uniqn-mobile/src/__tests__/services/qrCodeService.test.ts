/**
 * UNIQN Mobile - QR Code Service Tests
 *
 * @description Unit tests for QR code generation and validation
 * @version 1.0.0
 */

import {
  createMockQRCodeData,
  createExpiredQRCode,
  createUsedQRCode,
  createCheckInQRCode,
  createCheckOutQRCode,
  resetCounters,
} from '../mocks/factories';

// Import after mocks
import {
  createQRCode,
  validateQRCode,
  getQRCodeById,
} from '@/services/qrCodeService';

// Mock Firebase
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  Timestamp: {
    now: () => ({
      toMillis: () => Date.now(),
      toDate: () => new Date(),
    }),
    fromMillis: (ms: number) => ({
      toMillis: () => ms,
      toDate: () => new Date(ms),
    }),
  },
}));

jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  mapFirebaseError: (error: Error) => error,
}));

jest.mock('@/errors/BusinessErrors', () => ({
  InvalidQRCodeError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'InvalidQRCodeError';
    }
  },
  ExpiredQRCodeError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ExpiredQRCodeError';
    }
  },
}));

describe('qrCodeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockDoc.mockReturnValue({ id: 'test-doc' });
  });

  describe('createQRCode', () => {
    it('should create a QR code with valid data', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const staffId = 'staff-123';
      const request = {
        eventId: 'event-456',
        action: 'checkIn' as const,
      };

      const result = await createQRCode(staffId, request);

      expect(result).toBeDefined();
      expect(result.staffId).toBe(staffId);
      expect(result.eventId).toBe(request.eventId);
      expect(result.action).toBe(request.action);
      expect(result.isUsed).toBe(false);
      expect(result.id).toMatch(/^qr_/);
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    it('should create a checkOut QR code', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await createQRCode('staff-123', {
        eventId: 'event-456',
        action: 'checkOut',
      });

      expect(result.action).toBe('checkOut');
    });

    it('should set expiration time to 5 minutes', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);
      const before = Date.now();

      const result = await createQRCode('staff-123', {
        eventId: 'event-456',
        action: 'checkIn',
      });

      const after = Date.now();
      const expiresAt = result.expiresAt.toMillis();
      const fiveMinutesMs = 5 * 60 * 1000;

      // 만료 시간이 현재 + 5분 범위 내에 있어야 함
      expect(expiresAt).toBeGreaterThanOrEqual(before + fiveMinutesMs - 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + fiveMinutesMs + 1000);
    });

    it('should throw error when Firebase fails', async () => {
      mockSetDoc.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(
        createQRCode('staff-123', { eventId: 'event-456', action: 'checkIn' })
      ).rejects.toThrow('Firebase error');
    });
  });

  describe('validateQRCode', () => {
    it('should return invalid for non-existent QR code', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await validateQRCode('invalid-qr-id');

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID');
      expect(result.error).toBe('유효하지 않은 QR 코드입니다.');
    });

    it('should return invalid for expired QR code', async () => {
      const expiredQR = createExpiredQRCode();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => expiredQR,
      });

      const result = await validateQRCode(expiredQR.id);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('EXPIRED');
      expect(result.error).toContain('만료');
    });

    it('should return invalid for already used QR code', async () => {
      const usedQR = createUsedQRCode();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => usedQR,
      });

      const result = await validateQRCode(usedQR.id);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('USED');
      expect(result.error).toContain('이미 사용된');
    });

    it('should return invalid for wrong action type', async () => {
      const checkInQR = createCheckInQRCode();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => checkInQR,
      });

      const result = await validateQRCode(checkInQR.id, 'checkOut');

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('WRONG_ACTION');
      expect(result.error).toContain('퇴근용 QR 코드가 아닙니다');
    });

    it('should return invalid when expecting checkIn but got checkOut', async () => {
      const checkOutQR = createCheckOutQRCode();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => checkOutQR,
      });

      const result = await validateQRCode(checkOutQR.id, 'checkIn');

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('WRONG_ACTION');
      expect(result.error).toContain('출근용 QR 코드가 아닙니다');
    });

    it('should return valid for a valid QR code', async () => {
      const validQR = createMockQRCodeData();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => validQR,
      });

      const result = await validateQRCode(validQR.id);

      expect(result.isValid).toBe(true);
      expect(result.qrData).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should return valid for QR code with matching action', async () => {
      const checkInQR = createCheckInQRCode();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => checkInQR,
      });

      const result = await validateQRCode(checkInQR.id, 'checkIn');

      expect(result.isValid).toBe(true);
    });

    it('should throw error when Firebase fails', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(validateQRCode('qr-id')).rejects.toThrow('Firebase error');
    });
  });

  describe('getQRCodeById', () => {
    it('should return null for non-existent QR code', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await getQRCodeById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return QR code data for existing QR code', async () => {
      const mockQR = createMockQRCodeData();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockQR,
      });

      const result = await getQRCodeById(mockQR.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockQR.id);
      expect(result?.action).toBe(mockQR.action);
    });

    it('should throw error when Firebase fails', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(getQRCodeById('qr-id')).rejects.toThrow('Firebase error');
    });
  });
});

describe('Mock Factories', () => {
  beforeEach(() => {
    resetCounters();
  });

  describe('createMockQRCodeData', () => {
    it('should create valid mock QR code data', () => {
      const qrData = createMockQRCodeData();

      expect(qrData.id).toBeDefined();
      expect(qrData.eventId).toBeDefined();
      expect(qrData.staffId).toBeDefined();
      expect(qrData.action).toBe('checkIn');
      expect(qrData.isUsed).toBe(false);
      expect(qrData.createdAt.toMillis()).toBeLessThanOrEqual(Date.now());
      expect(qrData.expiresAt.toMillis()).toBeGreaterThan(Date.now());
    });

    it('should allow overrides', () => {
      const qrData = createMockQRCodeData({
        action: 'checkOut',
        eventId: 'custom-event',
        isUsed: true,
      });

      expect(qrData.action).toBe('checkOut');
      expect(qrData.eventId).toBe('custom-event');
      expect(qrData.isUsed).toBe(true);
    });
  });

  describe('createExpiredQRCode', () => {
    it('should create an expired QR code', () => {
      const expiredQR = createExpiredQRCode();

      expect(expiredQR.expiresAt.toMillis()).toBeLessThan(Date.now());
    });
  });

  describe('createUsedQRCode', () => {
    it('should create a used QR code', () => {
      const usedQR = createUsedQRCode();

      expect(usedQR.isUsed).toBe(true);
      expect(usedQR.usedAt).toBeDefined();
    });
  });

  describe('createCheckInQRCode', () => {
    it('should create a checkIn QR code', () => {
      const qr = createCheckInQRCode();
      expect(qr.action).toBe('checkIn');
    });
  });

  describe('createCheckOutQRCode', () => {
    it('should create a checkOut QR code', () => {
      const qr = createCheckOutQRCode();
      expect(qr.action).toBe('checkOut');
    });
  });
});
