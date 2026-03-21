import type { EventQRDisplayData, WorkLog } from '@/types';
import { processEventQRCheckIn } from '@/services/work/eventQRService';
import { STATUS } from '@/constants';

const mockValidateSecurityCode = jest.fn();
const mockFindByJobPostingStaffDate = jest.fn();
const mockFindActiveFixedByJobPostingStaff = jest.fn();
const mockProcessQRCheckInOutTransaction = jest.fn();

jest.mock('@/repositories', () => ({
  eventQRRepository: {
    validateSecurityCode: (...args: unknown[]) => mockValidateSecurityCode(...args),
  },
  workLogRepository: {
    findByJobPostingStaffDate: (...args: unknown[]) => mockFindByJobPostingStaffDate(...args),
    findActiveFixedByJobPostingStaff: (...args: unknown[]) =>
      mockFindActiveFixedByJobPostingStaff(...args),
    processQRCheckInOutTransaction: (...args: unknown[]) =>
      mockProcessQRCheckInOutTransaction(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
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
    userMessage: string;
    constructor({ message, userMessage }: { message?: string; userMessage?: string }) {
      super(message || userMessage || 'Invalid QR code');
      this.userMessage = userMessage || message || 'Invalid QR code';
    }
  },
}));

jest.mock('@/services/observability', () => ({
  trackCheckIn: jest.fn(),
  trackCheckOut: jest.fn(),
}));

jest.mock('@/utils/date', () => ({
  toISODateString: jest.fn((date: Date) => date.toISOString().split('T')[0]),
}));

function createMockWorkLog(overrides?: Partial<WorkLog>): WorkLog {
  return {
    id: 'wl-fixed',
    staffId: 'staff-123',
    jobPostingId: 'job-1',
    jobPostingName: 'Fixed Job',
    date: '',
    role: 'dealer',
    status: STATUS.WORK_LOG.SCHEDULED,
    isFixedPosting: true,
    createdAt: new Date() as never,
    updatedAt: new Date() as never,
    ...overrides,
  } as WorkLog;
}

describe('eventQRService fixed QR fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(false);
  });

  it('falls back to fixed worklogs and uses blank date for QR transaction', async () => {
    const now = Date.now();
    const qrData: EventQRDisplayData = {
      type: 'event',
      jobPostingId: 'job-1',
      date: '2025-01-15',
      action: 'checkIn',
      securityCode: 'secure-code',
      createdAt: now,
      expiresAt: now + 60_000,
    };

    mockValidateSecurityCode.mockResolvedValue({ id: 'qr-1' });
    mockFindByJobPostingStaffDate.mockResolvedValue(null);
    mockFindActiveFixedByJobPostingStaff.mockResolvedValue(createMockWorkLog());
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      hasExistingCheckInTime: false,
      workDuration: 0,
    });

    const result = await processEventQRCheckIn(JSON.stringify(qrData), 'staff-123');

    expect(result.success).toBe(true);
    expect(mockFindActiveFixedByJobPostingStaff).toHaveBeenCalledWith('job-1', 'staff-123');
    expect(mockProcessQRCheckInOutTransaction).toHaveBeenCalledWith(
      'wl-fixed',
      'staff-123',
      'job-1',
      'checkIn',
      expect.any(Date),
      ''
    );
  });
});
