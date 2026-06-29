/**
 * UNIQN Mobile - 고정 운영처(컨테이너) QR 출퇴근 처리 테스트
 *
 * @description 주간 배치 그리드 Phase 4 — 고정 운영처 QR 앱측 경로.
 *   (스태프, 컨테이너 공고, 오늘) work_log 해소 + process_qr_checkin_atomically(p_action='auto').
 *   슬롯 해소 + auto 분기 선택 로직을 모킹 기반으로 검증.
 */
import type { WorkLog } from '@/types';

// Import after mocks
import { processVenueQRCheckIn, processEventQRCheckIn } from '@/services/work/eventQRService';
import { STATUS } from '@/constants';

// ============================================================================
// Mock Setup
// ============================================================================

const mockFindByJobPostingStaffDate = jest.fn();
const mockProcessQRCheckInOutTransaction = jest.fn();
const mockValidateSecurityCode = jest.fn();

jest.mock('@/repositories', () => ({
  eventQRRepository: {
    create: jest.fn(),
    deactivate: jest.fn(),
    deactivateByJobAndDate: jest.fn(),
    getActiveByJobAndDate: jest.fn(),
    validateSecurityCode: (...args: unknown[]) => mockValidateSecurityCode(...args),
    deactivateExpired: jest.fn(),
  },
  workLogRepository: {
    findByJobPostingStaffDate: (...args: unknown[]) => mockFindByJobPostingStaffDate(...args),
    processQRCheckInOutTransaction: (...args: unknown[]) =>
      mockProcessQRCheckInOutTransaction(...args),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/generateId', () => ({
  generateUUID: jest.fn(() => 'test-uuid'),
}));

const FIXED_TODAY = '2026-06-29';
jest.mock('@/utils/date', () => ({
  getTodayString: jest.fn(() => '2026-06-29'),
  toISODateString: jest.fn((date: Date) => date.toISOString().split('T')[0]),
  parseTimeSlotToDate: jest.fn(),
}));

jest.mock('@/services/observability', () => ({
  trackCheckIn: jest.fn(),
  trackCheckOut: jest.fn(),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

const mockIsAppError = jest.fn();
jest.mock('@/errors', () => ({
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  isAppError: (...args: unknown[]) => mockIsAppError(...args),
}));

// ============================================================================
// Helpers
// ============================================================================

function createMockWorkLog(overrides?: Partial<WorkLog>): WorkLog {
  return {
    id: 'wl-container-1',
    staffId: 'staff-1',
    jobPostingId: 'container-1',
    date: FIXED_TODAY,
    status: STATUS.WORK_LOG.SCHEDULED,
    role: '딜러',
    assignmentGroupId: null,
    timeSlot: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WorkLog;
}

const VENUE_QR = JSON.stringify({ type: 'venue', jobPostingId: 'container-1' });

// ============================================================================
// Tests
// ============================================================================

describe('eventQRService - processVenueQRCheckIn (고정 운영처 QR)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(true); // 던져진 AppError 는 그대로 rethrow
    mockFindByJobPostingStaffDate.mockReset();
    mockProcessQRCheckInOutTransaction.mockReset();
  });

  it('(스태프,컨테이너,오늘) work_log 해소 후 auto 로 출근 처리해야 함', async () => {
    mockFindByJobPostingStaffDate.mockResolvedValue(createMockWorkLog());
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      hasExistingCheckInTime: false,
      workDuration: 0,
    });

    const result = await processVenueQRCheckIn('container-1', 'staff-1');

    expect(result.success).toBe(true);
    expect(result.action).toBe('checkIn');
    expect(result.workLogId).toBe('wl-container-1');
    expect(result.message).toContain('출근');

    // 슬롯 해소: 컨테이너 공고 + 오늘(getTodayString)로 조회
    expect(mockFindByJobPostingStaffDate).toHaveBeenCalledWith(
      'container-1',
      'staff-1',
      FIXED_TODAY
    );

    // auto 분기: p_action='auto', date=오늘
    expect(mockProcessQRCheckInOutTransaction).toHaveBeenCalledWith(
      'wl-container-1',
      'staff-1',
      'container-1',
      'auto',
      expect.any(Date),
      FIXED_TODAY
    );
  });

  it('서버가 checkOut 으로 해소하면 퇴근 결과를 반환해야 함', async () => {
    mockFindByJobPostingStaffDate.mockResolvedValue(
      createMockWorkLog({ status: STATUS.WORK_LOG.CHECKED_IN })
    );
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      hasExistingCheckInTime: true,
      workDuration: 180,
    });

    const result = await processVenueQRCheckIn('container-1', 'staff-1');

    expect(result.action).toBe('checkOut');
    expect(result.message).toContain('퇴근');
    // auto 로 호출(클라가 출/퇴근을 결정하지 않음)
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][3]).toBe('auto');
  });

  it('오늘 컨테이너에 배치된 work_log 가 없으면 에러를 throw하고 RPC를 호출하지 않아야 함', async () => {
    mockFindByJobPostingStaffDate.mockResolvedValue(null);

    await expect(processVenueQRCheckIn('container-1', 'staff-1')).rejects.toThrow();
    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });
});

describe('eventQRService - processEventQRCheckIn 분기 선택(dispatch)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(true);
    mockFindByJobPostingStaffDate.mockReset();
    mockProcessQRCheckInOutTransaction.mockReset();
    mockValidateSecurityCode.mockReset();
  });

  it('venue QR 이면 auto 경로로 위임(오늘 날짜 + p_action=auto)해야 함', async () => {
    mockFindByJobPostingStaffDate.mockResolvedValue(createMockWorkLog());
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      hasExistingCheckInTime: false,
      workDuration: 0,
    });

    await processEventQRCheckIn(VENUE_QR, 'staff-1');

    // 고정 운영처 경로: 보안코드 검증 우회
    expect(mockValidateSecurityCode).not.toHaveBeenCalled();
    expect(mockFindByJobPostingStaffDate).toHaveBeenCalledWith(
      'container-1',
      'staff-1',
      FIXED_TODAY
    );
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][3]).toBe('auto');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][5]).toBe(FIXED_TODAY);
  });

  it('event QR 이면 기존 경로(보안코드 검증 + QR 액션, auto 아님)를 유지해야 함', async () => {
    const now = Date.now();
    const eventQR = JSON.stringify({
      type: 'event',
      jobPostingId: 'job-1',
      date: '2026-01-15',
      action: 'checkIn',
      securityCode: 'sec-1',
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    });

    mockValidateSecurityCode.mockResolvedValue({ id: 'qr-1' });
    mockFindByJobPostingStaffDate.mockResolvedValue(
      createMockWorkLog({ jobPostingId: 'job-1', date: '2026-01-15' })
    );
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      hasExistingCheckInTime: false,
      workDuration: 0,
    });

    await processEventQRCheckIn(eventQR, 'staff-1');

    expect(mockValidateSecurityCode).toHaveBeenCalled();
    // event 경로: QR 액션 그대로, auto 아님 + QR 의 날짜 사용
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][3]).toBe('checkIn');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][5]).toBe('2026-01-15');
  });
});
