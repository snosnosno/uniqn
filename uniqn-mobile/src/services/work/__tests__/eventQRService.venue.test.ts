/**
 * UNIQN Mobile - QR 출퇴근 단일 진입점 테스트
 *
 * @description 고정 QR(type='venue') 스캔 → 후보 조회 → 처리 대상 자동 선택 →
 *   process_qr_checkin_atomically(p_action='auto') 로 이어지는 서비스 경로를 검증한다.
 *
 * @remarks 선택 규칙 자체(순환 거리·동률 처리)는 selectWorkLogForQR.test.ts 가 검증한다.
 *   여기서는 서비스가 후보 조회·선택·RPC 를 올바르게 배선하는지와 사용자 문구 계약을 본다.
 *   그래서 시각 의존 케이스를 만들지 않는다 — 후보를 1건만 두거나 checked_in 우선 규칙처럼
 *   현재 시각과 무관한 조합만 쓴다(실제 `new Date()` 를 쓰는 코드라 시각 의존 시 플레이크).
 */
import type { WorkLog } from '@/types';

// Import after mocks
import { processQRCheckIn, buildVenueQRString } from '@/services/work/eventQRService';
import { STATUS } from '@/constants';

// ============================================================================
// Mock Setup
// ============================================================================

const mockFindQRCandidates = jest.fn();
const mockProcessQRCheckInOutTransaction = jest.fn();

jest.mock('@/repositories', () => ({
  workLogRepository: {
    findQRCandidates: (...args: unknown[]) => mockFindQRCandidates(...args),
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

const FIXED_TODAY = '2026-06-29';
// getTodayString 만 고정한다. toDate/toISODateString 은 selectWorkLogForQR 이 실제로 쓰므로
// requireActual 로 진짜 구현을 남긴다(직접 재구현하면 선택 로직이 조용히 어긋난다).
jest.mock('@/utils/date', () => ({
  ...jest.requireActual('@/utils/date'),
  getTodayString: jest.fn(() => '2026-06-29'),
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

describe('processQRCheckIn — QR 형식 거부', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(true);
  });

  it('venue 형식이 아닌 QR 은 UNIQN QR 아님으로 거부한다', async () => {
    await expect(processQRCheckIn('그냥문자열', 'staff-1')).rejects.toMatchObject({
      userMessage: 'UNIQN 출근 QR이 아닙니다',
    });

    expect(mockFindQRCandidates).not.toHaveBeenCalled();
  });

  it('event 형식(구 회전 QR)도 더 이상 처리하지 않는다', async () => {
    const legacy = JSON.stringify({
      type: 'event',
      jobPostingId: 'posting-1',
      date: '2026-07-20',
      action: 'checkIn',
      securityCode: 'code-1',
    });

    await expect(processQRCheckIn(legacy, 'staff-1')).rejects.toMatchObject({
      userMessage: 'UNIQN 출근 QR이 아닙니다',
    });

    expect(mockFindQRCandidates).not.toHaveBeenCalled();
  });

  it('jobPostingId 가 없는 venue QR 도 거부한다', async () => {
    await expect(
      processQRCheckIn(JSON.stringify({ type: 'venue' }), 'staff-1')
    ).rejects.toMatchObject({ userMessage: 'UNIQN 출근 QR이 아닙니다' });

    expect(mockFindQRCandidates).not.toHaveBeenCalled();
  });
});

describe('processQRCheckIn — 처리 대상 없음', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(true);
  });

  it('배정이 없으면 오늘 배정 없음 문구로 거부하고 RPC 를 호출하지 않는다', async () => {
    mockFindQRCandidates.mockResolvedValue([]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });

  it('후보가 전부 퇴근 완료면 이미 퇴근 문구로 거부한다', async () => {
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({ status: STATUS.WORK_LOG.CHECKED_OUT, timeSlot: '09:00~15:00' }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 근무는 이미 퇴근 처리됐습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });

  it('취소/노쇼만 남았으면 처리 불가 문구로 거부한다', async () => {
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({ id: 'wl-cancelled', status: STATUS.WORK_LOG.CANCELLED }),
      createMockWorkLog({ id: 'wl-no-show', status: STATUS.WORK_LOG.NO_SHOW }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '취소되었거나 처리할 수 없는 근무입니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });
});

describe('processQRCheckIn — auto 액션 위임', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(true);
  });

  it('선택된 work_log 로 auto 액션 RPC 를 호출한다', async () => {
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-1',
        status: STATUS.WORK_LOG.SCHEDULED,
        timeSlot: '09:00~15:00',
        assignmentGroupId: 'group-1',
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      workDuration: 0,
      hasExistingCheckInTime: false,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    // 후보 조회: 공고 + 스태프 + 오늘(getTodayString)
    expect(mockFindQRCandidates).toHaveBeenCalledWith('container-1', 'staff-1', FIXED_TODAY);

    // 클라가 출/퇴근을 결정하지 않는다 — 서버가 status 로 해소한다
    expect(mockProcessQRCheckInOutTransaction).toHaveBeenCalledWith(
      'wl-1',
      'staff-1',
      'container-1',
      'auto',
      expect.any(Date),
      FIXED_TODAY
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('checkIn');
    expect(result.workLogId).toBe('wl-1');
    expect(result.assignmentGroupId).toBe('group-1');
    expect(result.timeSlot).toBe('09:00~15:00');
    expect(result.message).toContain('출근');
  });

  it('서버가 checkOut 으로 해소하면 퇴근 결과를 반환한다', async () => {
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({ status: STATUS.WORK_LOG.CHECKED_IN, checkInTime: new Date() }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      workDuration: 180,
      hasExistingCheckInTime: true,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.action).toBe('checkOut');
    expect(result.message).toContain('퇴근');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][3]).toBe('auto');
  });

  it('출근 중인 근무가 있으면 대기 중인 근무보다 먼저 처리한다', async () => {
    // 선택 규칙 위임 검증: checked_in 우선(= 퇴근 처리)은 현재 시각과 무관하다.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({ id: 'wl-scheduled', status: STATUS.WORK_LOG.SCHEDULED }),
      createMockWorkLog({
        id: 'wl-working',
        status: STATUS.WORK_LOG.CHECKED_IN,
        checkInTime: new Date(),
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      workDuration: 120,
      hasExistingCheckInTime: true,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][0]).toBe('wl-working');
    expect(result.workLogId).toBe('wl-working');
  });

  it('RPC 가 던진 에러는 그대로 전파한다', async () => {
    mockFindQRCandidates.mockResolvedValue([createMockWorkLog({ id: 'wl-1' })]);
    mockProcessQRCheckInOutTransaction.mockRejectedValue(
      Object.assign(new Error('정산 완료'), {
        userMessage: '정산이 끝난 근무는 변경할 수 없습니다',
      })
    );

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '정산이 끝난 근무는 변경할 수 없습니다',
    });
  });
});

describe('buildVenueQRString', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(true);
  });

  it('생성한 QR 문자열을 스캔 경로가 그대로 받아들인다', async () => {
    mockFindQRCandidates.mockResolvedValue([createMockWorkLog({ id: 'wl-1' })]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      workDuration: 0,
      hasExistingCheckInTime: false,
    });

    const qr = buildVenueQRString('container-1');
    await processQRCheckIn(qr, 'staff-1');

    // 왕복 성립: 생성한 QR 이 같은 공고 ID 로 후보 조회를 트리거한다
    expect(mockFindQRCandidates).toHaveBeenCalledWith('container-1', 'staff-1', FIXED_TODAY);
  });
});
