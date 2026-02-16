/**
 * UNIQN Mobile - Event QR Service Tests
 *
 * @description Comprehensive unit tests for event QR service functions
 * @version 2.0.0
 */

import type { EventQRCode, WorkLog } from '@/types';

// ============================================================================
// Mock Setup
// ============================================================================

const mockEventQRRepositoryCreate = jest.fn();
const mockEventQRRepositoryDeactivate = jest.fn();
const mockEventQRRepositoryDeactivateByJobAndDate = jest.fn();
const mockEventQRRepositoryGetActiveByJobAndDate = jest.fn();
const mockEventQRRepositoryValidateSecurityCode = jest.fn();
const mockEventQRRepositoryDeactivateExpired = jest.fn();

const mockWorkLogRepositoryFindByJobPostingStaffDate = jest.fn();
const mockWorkLogRepositoryProcessQRCheckInOutTransaction = jest.fn();

jest.mock('@/repositories', () => ({
  eventQRRepository: {
    create: (...args: unknown[]) => mockEventQRRepositoryCreate(...args),
    deactivate: (...args: unknown[]) => mockEventQRRepositoryDeactivate(...args),
    deactivateByJobAndDate: (...args: unknown[]) =>
      mockEventQRRepositoryDeactivateByJobAndDate(...args),
    getActiveByJobAndDate: (...args: unknown[]) =>
      mockEventQRRepositoryGetActiveByJobAndDate(...args),
    validateSecurityCode: (...args: unknown[]) =>
      mockEventQRRepositoryValidateSecurityCode(...args),
    deactivateExpired: (...args: unknown[]) => mockEventQRRepositoryDeactivateExpired(...args),
  },
  workLogRepository: {
    findByJobPostingStaffDate: (...args: unknown[]) =>
      mockWorkLogRepositoryFindByJobPostingStaffDate(...args),
    processQRCheckInOutTransaction: (...args: unknown[]) =>
      mockWorkLogRepositoryProcessQRCheckInOutTransaction(...args),
  },
}));

const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => {
  // MockTimestamp를 팩토리 내부에 정의하여 호이스팅 문제 방지
  class MockTimestampImpl {
    private _milliseconds: number;
    constructor(milliseconds: number) {
      this._milliseconds = milliseconds;
    }
    static now() {
      return new MockTimestampImpl(Date.now());
    }
    static fromMillis(ms: number) {
      return new MockTimestampImpl(ms);
    }
    static fromDate(date: Date) {
      return new MockTimestampImpl(date.getTime());
    }
    toMillis() {
      return this._milliseconds;
    }
    toDate() {
      return new Date(this._milliseconds);
    }
  }
  return {
    collection: jest.fn(() => ({ path: 'workLogs' })),
    doc: jest.fn(() => ({ id: 'test-doc' })),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    query: jest.fn((...args) => args),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    limit: jest.fn((n) => ({ limit: n })),
    Timestamp: MockTimestampImpl,
    serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  };
});

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({ type: 'firestore' })),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/utils/generateId', () => ({
  generateUUID: jest.fn(() => 'test-uuid-1234'),
}));

jest.mock('@/schemas', () => ({
  parseWorkLogDocument: jest.fn((data: unknown) => data as WorkLog),
}));

jest.mock('@/services/analyticsService', () => ({
  trackCheckIn: jest.fn(),
  trackCheckOut: jest.fn(),
}));

jest.mock('@/utils/date', () => ({
  parseTimeSlotToDate: jest.fn((_timeSlot: string, date: string) => ({
    startTime: new Date(`${date}T09:00:00`),
    endTime: new Date(`${date}T18:00:00`),
  })),
  toISODateString: jest.fn((date: Date) => date.toISOString().split('T')[0]),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

const mockIsAppError = jest.fn();
jest.mock('@/errors', () => ({
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  isAppError: (...args: unknown[]) => mockIsAppError(...args),
  InvalidQRCodeError: class InvalidQRCodeError extends Error {
    code = 'E6010';
    userMessage: string;
    constructor({ message, userMessage }: { message?: string; userMessage?: string }) {
      super(message || userMessage || 'Invalid QR Code');
      this.name = 'InvalidQRCodeError';
      this.userMessage = userMessage || message || 'Invalid QR Code';
    }
  },
  AlreadyCheckedInError: class AlreadyCheckedInError extends Error {
    code = 'E6011';
    userMessage: string;
    workLogId?: string;
    constructor({
      message,
      userMessage,
      workLogId,
    }: {
      message?: string;
      userMessage?: string;
      workLogId?: string;
    }) {
      super(message || userMessage || 'Already Checked In');
      this.name = 'AlreadyCheckedInError';
      this.userMessage = userMessage || message || 'Already Checked In';
      this.workLogId = workLogId;
    }
  },
  NotCheckedInError: class NotCheckedInError extends Error {
    code = 'E6012';
    userMessage: string;
    constructor({ message, userMessage }: { message?: string; userMessage?: string }) {
      super(message || userMessage || 'Not Checked In');
      this.name = 'NotCheckedInError';
      this.userMessage = userMessage || message || 'Not Checked In';
    }
  },
}));

// Import after mocks
import {
  generateEventQR,
  validateEventQR,
  processEventQRCheckIn,
  getActiveEventQR,
  deactivateEventQR,
  cleanupExpiredQRCodes,
  getQRRemainingSeconds,
  stringifyQRData,
  QR_REFRESH_INTERVAL_MS,
} from '@/services/eventQRService';
import type { EventQRDisplayData } from '@/types';
import { STATUS } from '@/constants';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEventQR(overrides?: Partial<EventQRCode>): EventQRCode {
  const { Timestamp: MockTimestamp } = jest.requireMock('firebase/firestore');
  const now = Date.now();
  return {
    id: 'qr-1',
    jobPostingId: 'job-1',
    date: '2025-01-15',
    action: 'checkIn',
    securityCode: 'test-uuid-1234',
    createdBy: 'owner-1',
    createdAt: MockTimestamp.fromMillis(now),
    expiresAt: MockTimestamp.fromMillis(now + 3 * 60 * 1000),
    isActive: true,
    ...overrides,
  };
}

function createMockWorkLog(overrides?: Partial<WorkLog>): WorkLog {
  const { Timestamp: MockTimestamp } = jest.requireMock('firebase/firestore');
  return {
    id: 'wl-1',
    staffId: 'staff-123',
    jobPostingId: 'job-1',
    date: '2025-01-15',
    status: STATUS.WORK_LOG.SCHEDULED,
    role: '딜러',
    createdAt: MockTimestamp.now(),
    updatedAt: MockTimestamp.now(),
    ...overrides,
  } as WorkLog;
}

// ============================================================================
// Tests
// ============================================================================

describe('eventQRService - generateEventQR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventQRRepositoryCreate.mockResolvedValue('qr-123');
    mockEventQRRepositoryDeactivateByJobAndDate.mockResolvedValue(undefined);
  });

  it('QR 코드를 생성하고 ID와 표시 데이터를 반환해야 함', async () => {
    const input = {
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn' as const,
      createdBy: 'owner-1',
    };

    const result = await generateEventQR(input);

    expect(result.qrId).toBe('qr-123');
    expect(result.displayData).toHaveProperty('type', 'event');
    expect(result.displayData).toHaveProperty('jobPostingId', 'job-1');
    expect(result.displayData).toHaveProperty('date', '2025-01-15');
    expect(result.displayData).toHaveProperty('action', 'checkIn');
    expect(result.displayData).toHaveProperty('securityCode');
    expect(result.displayData).toHaveProperty('createdAt');
    expect(result.displayData).toHaveProperty('expiresAt');
  });

  it('기존 활성 QR 코드를 비활성화해야 함', async () => {
    const input = {
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn' as const,
      createdBy: 'owner-1',
    };

    await generateEventQR(input);

    expect(mockEventQRRepositoryDeactivateByJobAndDate).toHaveBeenCalledWith(
      'job-1',
      '2025-01-15',
      'checkIn'
    );
  });

  it('3분 후 만료 시간을 설정해야 함', async () => {
    const input = {
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn' as const,
      createdBy: 'owner-1',
    };

    const result = await generateEventQR(input);

    const validityMs = result.displayData.expiresAt - result.displayData.createdAt;
    expect(validityMs).toBe(3 * 60 * 1000);
  });

  it('고유한 보안 코드를 생성해야 함', async () => {
    const input = {
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn' as const,
      createdBy: 'owner-1',
    };

    const result = await generateEventQR(input);

    expect(result.displayData.securityCode).toBe('test-uuid-1234');
  });

  it('checkOut 액션으로 생성 가능해야 함', async () => {
    const input = {
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkOut' as const,
      createdBy: 'owner-1',
    };

    const result = await generateEventQR(input);

    expect(result.displayData.action).toBe('checkOut');
  });

  it('Repository 에러를 올바르게 처리해야 함', async () => {
    mockEventQRRepositoryCreate.mockRejectedValue(new Error('Firebase error'));

    const input = {
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn' as const,
      createdBy: 'owner-1',
    };

    await expect(generateEventQR(input)).rejects.toThrow();
  });
});

describe('eventQRService - validateEventQR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('유효한 QR 코드를 검증해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(createMockEventQR());

    const result = await validateEventQR(JSON.stringify(qrData));

    expect(result.isValid).toBe(true);
    expect(result.jobPostingId).toBe('job-1');
    expect(result.date).toBe('2025-01-15');
    expect(result.action).toBe('checkIn');
  });

  it('잘못된 JSON 형식을 거부해야 함', async () => {
    const result = await validateEventQR('invalid json');

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('유효하지 않은');
  });

  it('type이 event가 아닌 경우 거부해야 함', async () => {
    const qrData = {
      type: 'tournament',
      jobPostingId: 'job-1',
    };

    const result = await validateEventQR(JSON.stringify(qrData));

    expect(result.isValid).toBe(false);
  });

  it('필수 필드가 누락된 경우 거부해야 함', async () => {
    const qrData = {
      type: 'event',
      jobPostingId: 'job-1',
      // date, action, securityCode 누락
    };

    const result = await validateEventQR(JSON.stringify(qrData));

    expect(result.isValid).toBe(false);
  });

  it('만료된 QR 코드를 거부해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now - 10 * 60 * 1000,
      expiresAt: now - 1000, // 1초 전 만료
    };

    const result = await validateEventQR(JSON.stringify(qrData));

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('만료');
  });

  it('보안 코드가 일치하지 않으면 거부해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'wrong-code',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(null);

    const result = await validateEventQR(JSON.stringify(qrData));

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('유효하지 않거나 만료');
  });

  it('Repository 에러 발생 시 안전하게 처리해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    mockEventQRRepositoryValidateSecurityCode.mockRejectedValue(new Error('Firebase error'));

    const result = await validateEventQR(JSON.stringify(qrData));

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeDefined();
  });
});

describe('eventQRService - processEventQRCheckIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(false);
    // Repository mock 반환값 초기화 (clearAllMocks는 반환값을 초기화하지 않음)
    mockWorkLogRepositoryFindByJobPostingStaffDate.mockReset();
    mockWorkLogRepositoryProcessQRCheckInOutTransaction.mockReset();
  });

  it('유효한 QR로 출근 처리해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    const mockWorkLog = createMockWorkLog({
      id: 'wl-1',
      staffId: 'staff-123',
      jobPostingId: 'job-1',
      status: STATUS.WORK_LOG.SCHEDULED,
    });

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(createMockEventQR());
    mockWorkLogRepositoryFindByJobPostingStaffDate.mockResolvedValue(mockWorkLog);
    mockWorkLogRepositoryProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      hasExistingCheckInTime: false,
      workDuration: 0,
    });

    const result = await processEventQRCheckIn(JSON.stringify(qrData), 'staff-123');

    expect(result.success).toBe(true);
    expect(result.action).toBe('checkIn');
    expect(result.workLogId).toBe('wl-1');
    expect(result.message).toContain('출근');
  });

  it('유효한 QR로 퇴근 처리해야 함', async () => {
    const { Timestamp: MockTS } = jest.requireMock('firebase/firestore');
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkOut',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    const mockWorkLog = createMockWorkLog({
      id: 'wl-1',
      staffId: 'staff-123',
      jobPostingId: 'job-1',
      status: STATUS.WORK_LOG.CHECKED_IN,
      checkInTime: MockTS.fromDate(new Date(now - 3 * 60 * 60 * 1000)),
    });

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(
      createMockEventQR({ action: 'checkOut' })
    );
    mockWorkLogRepositoryFindByJobPostingStaffDate.mockResolvedValue(mockWorkLog);
    mockWorkLogRepositoryProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      hasExistingCheckInTime: true,
      workDuration: 180,
    });

    const result = await processEventQRCheckIn(JSON.stringify(qrData), 'staff-123');

    expect(result.success).toBe(true);
    expect(result.action).toBe('checkOut');
    expect(result.message).toContain('퇴근');
  });

  it('잘못된 QR 코드로 에러를 throw해야 함', async () => {
    await expect(processEventQRCheckIn('invalid json', 'staff-123')).rejects.toThrow();
  });

  it('해당 스태프의 WorkLog가 없으면 에러를 throw해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(createMockEventQR());
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    await expect(processEventQRCheckIn(JSON.stringify(qrData), 'staff-123')).rejects.toThrow();
  });

  it('이미 출근한 경우 에러를 throw해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    const mockWorkLog = createMockWorkLog({
      staffId: 'staff-123',
      jobPostingId: 'job-1',
      status: STATUS.WORK_LOG.CHECKED_IN,
    });

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(createMockEventQR());
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'wl-1', data: () => mockWorkLog }],
    });
    mockRunTransaction.mockImplementation(async (_db, callback) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          id: 'wl-1',
          data: () => mockWorkLog,
        }),
        update: jest.fn(),
      };
      return callback(mockTransaction);
    });

    await expect(processEventQRCheckIn(JSON.stringify(qrData), 'staff-123')).rejects.toThrow();
  });

  it('출근하지 않고 퇴근 시도하면 에러를 throw해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkOut',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    const mockWorkLog = createMockWorkLog({
      staffId: 'staff-123',
      jobPostingId: 'job-1',
      status: STATUS.WORK_LOG.SCHEDULED,
    });

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(
      createMockEventQR({ action: 'checkOut' })
    );
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'wl-1', data: () => mockWorkLog }],
    });
    mockRunTransaction.mockImplementation(async (_db, callback) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          id: 'wl-1',
          data: () => mockWorkLog,
        }),
        update: jest.fn(),
      };
      return callback(mockTransaction);
    });

    await expect(processEventQRCheckIn(JSON.stringify(qrData), 'staff-123')).rejects.toThrow();
  });

  it('staffId가 일치하지 않으면 에러를 throw해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    const mockWorkLog = createMockWorkLog({
      staffId: 'other-staff',
      jobPostingId: 'job-1',
      status: STATUS.WORK_LOG.SCHEDULED,
    });

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(createMockEventQR());
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'wl-1', data: () => mockWorkLog }],
    });
    mockRunTransaction.mockImplementation(async (_db, callback) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          id: 'wl-1',
          data: () => mockWorkLog,
        }),
        update: jest.fn(),
      };
      return callback(mockTransaction);
    });

    await expect(processEventQRCheckIn(JSON.stringify(qrData), 'staff-123')).rejects.toThrow();
  });

  it('jobPostingId가 일치하지 않으면 에러를 throw해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    const mockWorkLog = createMockWorkLog({
      staffId: 'staff-123',
      jobPostingId: 'job-2',
      status: STATUS.WORK_LOG.SCHEDULED,
    });

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(createMockEventQR());
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'wl-1', data: () => mockWorkLog }],
    });
    mockRunTransaction.mockImplementation(async (_db, callback) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          id: 'wl-1',
          data: () => mockWorkLog,
        }),
        update: jest.fn(),
      };
      return callback(mockTransaction);
    });

    await expect(processEventQRCheckIn(JSON.stringify(qrData), 'staff-123')).rejects.toThrow();
  });

  it('출근 시 checkInTime이 없으면 timeSlot에서 파싱해야 함', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    const mockWorkLog = createMockWorkLog({
      id: 'wl-1',
      staffId: 'staff-123',
      jobPostingId: 'job-1',
      status: STATUS.WORK_LOG.SCHEDULED,
      checkInTime: undefined,
      timeSlot: '09:00-18:00',
    });

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(createMockEventQR());
    mockWorkLogRepositoryFindByJobPostingStaffDate.mockResolvedValue(mockWorkLog);
    mockWorkLogRepositoryProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      hasExistingCheckInTime: false,
      workDuration: 0,
    });

    await processEventQRCheckIn(JSON.stringify(qrData), 'staff-123');

    expect(mockWorkLogRepositoryProcessQRCheckInOutTransaction).toHaveBeenCalled();
  });

  it('퇴근 시 근무 시간을 계산해야 함', async () => {
    const { Timestamp: MockTS } = jest.requireMock('firebase/firestore');
    const now = Date.now();
    const checkInMs = now - 3 * 60 * 60 * 1000; // 3시간 전

    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkOut',
      securityCode: 'test-uuid',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };

    const mockWorkLog = createMockWorkLog({
      id: 'wl-1',
      staffId: 'staff-123',
      jobPostingId: 'job-1',
      status: STATUS.WORK_LOG.CHECKED_IN,
      checkInTime: MockTS.fromMillis(checkInMs),
    });

    mockEventQRRepositoryValidateSecurityCode.mockResolvedValue(
      createMockEventQR({ action: 'checkOut' })
    );
    mockWorkLogRepositoryFindByJobPostingStaffDate.mockResolvedValue(mockWorkLog);
    mockWorkLogRepositoryProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      hasExistingCheckInTime: true,
      workDuration: 180,
    });

    const result = await processEventQRCheckIn(JSON.stringify(qrData), 'staff-123');

    expect(result.success).toBe(true);
  });
});

describe('eventQRService - getActiveEventQR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('활성 QR 코드를 반환해야 함', async () => {
    const mockQR = createMockEventQR();
    mockEventQRRepositoryGetActiveByJobAndDate.mockResolvedValue(mockQR);

    const result = await getActiveEventQR('job-1', '2025-01-15', 'checkIn');

    expect(result).toEqual(mockQR);
    expect(mockEventQRRepositoryGetActiveByJobAndDate).toHaveBeenCalledWith(
      'job-1',
      '2025-01-15',
      'checkIn'
    );
  });

  it('활성 QR이 없으면 null을 반환해야 함', async () => {
    mockEventQRRepositoryGetActiveByJobAndDate.mockResolvedValue(null);

    const result = await getActiveEventQR('job-1', '2025-01-15', 'checkIn');

    expect(result).toBeNull();
  });
});

describe('eventQRService - deactivateEventQR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('QR 코드를 비활성화해야 함', async () => {
    mockEventQRRepositoryDeactivate.mockResolvedValue(undefined);

    await deactivateEventQR('qr-123');

    expect(mockEventQRRepositoryDeactivate).toHaveBeenCalledWith('qr-123');
  });
});

describe('eventQRService - cleanupExpiredQRCodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('만료된 QR 코드 개수를 반환해야 함', async () => {
    mockEventQRRepositoryDeactivateExpired.mockResolvedValue(5);

    const result = await cleanupExpiredQRCodes();

    expect(result).toBe(5);
    expect(mockEventQRRepositoryDeactivateExpired).toHaveBeenCalled();
  });

  it('만료된 코드가 없으면 0을 반환해야 함', async () => {
    mockEventQRRepositoryDeactivateExpired.mockResolvedValue(0);

    const result = await cleanupExpiredQRCodes();

    expect(result).toBe(0);
  });
});

describe('eventQRService - getQRRemainingSeconds', () => {
  it('남은 시간을 초 단위로 계산해야 함', () => {
    const now = Date.now();
    const expiresAt = now + 120 * 1000; // 2분 후

    const remaining = getQRRemainingSeconds(expiresAt);

    expect(remaining).toBeGreaterThanOrEqual(119);
    expect(remaining).toBeLessThanOrEqual(120);
  });

  it('만료된 경우 0을 반환해야 함', () => {
    const now = Date.now();
    const expiresAt = now - 1000; // 1초 전

    const remaining = getQRRemainingSeconds(expiresAt);

    expect(remaining).toBe(0);
  });

  it('음수가 아닌 값을 반환해야 함', () => {
    const expiresAt = Date.now() - 10000;

    const remaining = getQRRemainingSeconds(expiresAt);

    expect(remaining).toBeGreaterThanOrEqual(0);
  });
});

describe('eventQRService - stringifyQRData', () => {
  it('표시 데이터를 JSON 문자열로 변환해야 함', () => {
    const displayData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'test-uuid',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3 * 60 * 1000,
    };

    const result = stringifyQRData(displayData);

    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual(displayData);
  });

  it('파싱 가능한 JSON을 생성해야 함', () => {
    const displayData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkOut',
      securityCode: 'test-uuid-5678',
      createdAt: 1234567890,
      expiresAt: 1234567890 + 180000,
    };

    const result = stringifyQRData(displayData);
    const parsed = JSON.parse(result);

    expect(parsed.type).toBe('event');
    expect(parsed.jobPostingId).toBe('job-1');
    expect(parsed.action).toBe('checkOut');
  });
});

describe('eventQRService - Constants', () => {
  it('QR_REFRESH_INTERVAL_MS는 2분이어야 함', () => {
    expect(QR_REFRESH_INTERVAL_MS).toBe(2 * 60 * 1000);
  });
});
