/**
 * UNIQN Mobile - QR 출퇴근 단일 진입점 테스트
 *
 * @description 고정 QR(type='venue') 스캔 → 후보 조회 → 처리 대상 자동 선택 →
 *   process_qr_checkin_atomically(p_action='auto') 로 이어지는 서비스 경로를 검증한다.
 *
 * @remarks 선택 규칙 자체(순환 거리·동률 처리)는 selectWorkLogForQR.test.ts 가 검증한다.
 *   여기서는 서비스가 후보 조회·선택·RPC 를 올바르게 배선하는지와 사용자 문구 계약을 본다.
 *   대부분의 케이스는 후보를 1건만 두거나 checked_in 우선 규칙처럼 현재 시각과 무관한 조합만 쓴다.
 *   단 어제 자 후보 필터는 출근 후 경과 시간의 상한을 보므로, 그 describe 만 가짜 타이머로
 *   시계를 고정한다 — 실제 `new Date()` 를 쓰는 코드라 고정하지 않으면 플레이크가 된다.
 *   시각은 CI(UTC)에서도 의미가 유지되도록 로컬 생성자(`new Date(2026, 5, 28, 18, 0)`)로 만든다.
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
const FIXED_YESTERDAY = '2026-06-28';
// getTodayString/getYesterdayString 만 고정한다. toDate/toISODateString 은 selectWorkLogForQR 이
// 실제로 쓰므로 requireActual 로 진짜 구현을 남긴다(직접 재구현하면 선택 로직이 조용히 어긋난다).
jest.mock('@/utils/date', () => ({
  ...jest.requireActual('@/utils/date'),
  getTodayString: jest.fn(() => '2026-06-29'),
  getYesterdayString: jest.fn(() => '2026-06-28'),
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

    // 후보 조회: 공고 + 스태프 + 오늘(getTodayString) + 어제(getYesterdayString)
    expect(mockFindQRCandidates).toHaveBeenCalledWith(
      'container-1',
      'staff-1',
      FIXED_TODAY,
      FIXED_YESTERDAY
    );

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

describe('processQRCheckIn — 자정 넘는 근무(어제 자 후보)', () => {
  // 어제 자 후보 필터가 "출근 후 경과 시간"을 보므로 시계를 고정한다.
  // 기본 시각 = D+1 02:00 — 18:00~02:00 자정 넘김 근무의 정상 퇴근 스캔 시점.
  const SCAN_AT_DAWN = new Date(2026, 5, 29, 2, 0);

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(true);
    jest.useFakeTimers({ now: SCAN_AT_DAWN });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('어제 자 출근 중 근무를 D+1 새벽 스캔으로 퇴근 처리한다', async () => {
    // 18:00~02:00 근무의 work_logs.date 는 시작일(어제). 오늘 날짜로만 조회하면 후보가 0건이 된다.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-overnight',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '18:00~02:00',
        checkInTime: new Date(2026, 5, 28, 18, 0),
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      workDuration: 480,
      hasExistingCheckInTime: true,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.action).toBe('checkOut');
    expect(result.workLogId).toBe('wl-overnight');

    // p_expected_date = 선택된 work_log 자신의 date.
    // 오늘 날짜를 넘기면 RPC 의 date_mismatch 가드가 퇴근을 거부한다.
    expect(mockProcessQRCheckInOutTransaction).toHaveBeenCalledWith(
      'wl-overnight',
      'staff-1',
      'container-1',
      'auto',
      expect.any(Date),
      FIXED_YESTERDAY
    );
  });

  it('어제 자 scheduled(출근한 적 없는 지난 근무)는 후보에서 제외한다', async () => {
    // 어제를 조회 범위에 넣은 것은 퇴근 스캔용이지, 지난 근무에 새로 출근하기 위한 게 아니다.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-yesterday-noshow',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.SCHEDULED,
        timeSlot: '18:00~02:00',
      }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });

  it('새벽 스캔이면 오늘 자 대기 근무보다 어제 자 출근 중 근무의 퇴근을 먼저 처리한다', async () => {
    // selectWorkLogForQR 규칙 ① checked_in 우선 — 상태가 날짜보다 우선순위가 높다.
    // 단 이 우선순위는 **어제 자가 경과 시간 상한 안일 때만** 성립한다. 시각을 고정하지 않으면
    // "어제 자 우선"이 무조건 참인 것처럼 읽혀, 퇴근을 깜빡한 어제 건이 오늘 출근을
    // 가로채는 결함(아래 24시간 경과 케이스)을 정답으로 못박게 된다.
    // 여기서는 D+1 02:00 스캔 + 어제 18:00 출근 = 8시간 경과 → 상한 안.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-today-scheduled',
        date: FIXED_TODAY,
        status: STATUS.WORK_LOG.SCHEDULED,
        timeSlot: '18:00~02:00',
      }),
      createMockWorkLog({
        id: 'wl-yesterday-working',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '18:00~02:00',
        checkInTime: new Date(2026, 5, 28, 18, 0),
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      workDuration: 480,
      hasExistingCheckInTime: true,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.workLogId).toBe('wl-yesterday-working');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][5]).toBe(FIXED_YESTERDAY);
  });

  it('어제 자 checked_out 만 남으면 이미 퇴근이 아니라 배정 없음으로 안내한다', async () => {
    // 어제 끝난 근무를 "오늘 근무는 이미 퇴근 처리됐습니다"라고 안내하면 거짓 정보다.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-yesterday-done',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_OUT,
        timeSlot: '18:00~02:00',
      }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });

  it('어제 자 checked_out 은 제외되고 오늘 자 대기 근무가 선택된다', async () => {
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-yesterday-done',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_OUT,
        timeSlot: '18:00~02:00',
      }),
      createMockWorkLog({
        id: 'wl-today-scheduled',
        date: FIXED_TODAY,
        status: STATUS.WORK_LOG.SCHEDULED,
        timeSlot: '18:00~02:00',
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      workDuration: 0,
      hasExistingCheckInTime: false,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    // 문서용 케이스 — 이 조합은 어제 자 필터의 유무와 무관하게 오늘 자가 선택된다.
    // selectWorkLogForQR 이 checked_in 없음 → scheduled 분기로 가므로 어제 자 checked_out 은
    // 애초에 경쟁 후보가 아니다. 필터의 실제 가드는 위의 'checked_out 만 남으면' 케이스와
    // 아래 '24시간 경과' 케이스가 담당한다.
    expect(result.workLogId).toBe('wl-today-scheduled');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][5]).toBe(FIXED_TODAY);
  });

  it('고정 공고(FIXED_SCHEDULE) 대기 후보는 날짜 축 필터와 무관하게 통과한다', async () => {
    // 날짜 축(어제 자 제외)은 FIXED_SCHEDULE 을 건드리지 않는다. 단 상태 축(경과 시간 상한)은
    // 별개로 적용된다 — 아래 '고정 공고 후보 상한' describe 참고.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-fixed',
        date: 'FIXED_SCHEDULE',
        status: STATUS.WORK_LOG.SCHEDULED,
        timeSlot: '09:00~15:00',
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      workDuration: 0,
      hasExistingCheckInTime: false,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.workLogId).toBe('wl-fixed');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][5]).toBe('FIXED_SCHEDULE');
  });

  // ==========================================================================
  // 경과 시간 상한 (MAX_OVERNIGHT_SHIFT_MS = 16시간)
  //
  // 어제 자 checked_in 을 상태만 보고 인정하면, 퇴근 스캔을 깜빡한 어제 건이 다음날
  // 출근 스캔을 가로채 24시간짜리 허위 work_duration 을 정산에 흘려보낸다.
  // RPC 의 시각 클램프는 p_check_time 과 서버 now() 의 편차만 보정하고, work_duration 은
  // 음수만 막을 뿐 상한이 없다 → 클라이언트 필터가 유일한 방어선이다.
  // ==========================================================================

  it('어제 자 출근 후 8시간 경과(정상 자정 넘김)는 퇴근 처리한다 — checkInTime 이 문자열이어도', async () => {
    // D+1 02:00 스캔 - 어제 18:00 출근 = 8시간 → 상한(16시간) 안.
    //
    // checkInTime 을 **문자열**로 주는 유일한 케이스다. 프로덕션의 checkInTime 은 PostgREST
    // timestamptz 문자열이지 Date 객체가 아니다 — 전 케이스를 Date 로만 두면 toDate() 의
    // 문자열 경로가 한 번도 실행되지 않아, 파싱이 깨져도 초록으로 남는다.
    //
    // 이 케이스만 스캔 시각도 오프셋 문자열로 고정한다. 절대 시각(+09:00)과 로컬 생성자를
    // 섞으면 경과 시간이 실행 TZ 에 따라 달라져 CI(UTC)에서만 터진다.
    jest.setSystemTime(new Date('2026-06-29T02:00:00+09:00'));

    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-overnight',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '18:00~02:00',
        checkInTime: '2026-06-28T18:00:00+09:00',
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      workDuration: 480,
      hasExistingCheckInTime: true,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.action).toBe('checkOut');
    expect(result.workLogId).toBe('wl-overnight');
  });

  it('어제 자 출근 후 24시간 경과(퇴근 깜빡)는 제외하고 오늘 자에 정상 출근시킨다', async () => {
    // 결함 재현: D일 09:00 출근 후 퇴근 스캔 누락 → D+1 08:55 오늘 근무 출근 스캔.
    // 상한이 없으면 어제 자 checked_in 이 선택되어 work_duration ≈ 23.9시간이 기록되고,
    // 정작 오늘 출근은 되지 않는다.
    jest.setSystemTime(new Date(2026, 5, 29, 8, 55));

    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-yesterday-forgot-checkout',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '09:00~18:00',
        checkInTime: new Date(2026, 5, 28, 9, 0),
      }),
      createMockWorkLog({
        id: 'wl-today-scheduled',
        date: FIXED_TODAY,
        status: STATUS.WORK_LOG.SCHEDULED,
        timeSlot: '09:00~18:00',
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkIn',
      workDuration: 0,
      hasExistingCheckInTime: false,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.action).toBe('checkIn');
    expect(result.workLogId).toBe('wl-today-scheduled');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][0]).toBe('wl-today-scheduled');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][5]).toBe(FIXED_TODAY);
  });

  it('어제 자 checked_in 이지만 checkInTime 이 없으면 제외한다(fail-closed)', async () => {
    // 경과 시간을 판정할 근거가 없다. 근거 없이 24시간 근무를 기록하느니 스캔이 실패하는 게 낫다.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-yesterday-no-checkin-time',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '18:00~02:00',
        checkInTime: undefined,
      }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });

  it('상한 경계: 15시간 59분 경과는 통과한다', async () => {
    // D+1 02:00 스캔 - 어제 10:01 출근 = 15시간 59분.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-just-inside',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '10:00~02:00',
        checkInTime: new Date(2026, 5, 28, 10, 1),
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      workDuration: 959,
      hasExistingCheckInTime: true,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.action).toBe('checkOut');
    expect(result.workLogId).toBe('wl-just-inside');
  });

  it('상한 경계: 정확히 16시간 경과는 통과한다(경계 포함 계약)', async () => {
    // D+1 02:00 스캔 - 어제 10:00 출근 = 정확히 16시간.
    //
    // 15시간 59분/16시간 1분만으로는 비교 연산자가 고정되지 않는다 — `<=` 를 `<` 로 바꿔도
    // 두 케이스 모두 초록이다. 경계값 자체를 한 건 두어 "상한은 포함"이라는 계약을 못박는다.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-exactly-at-limit',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '10:00~02:00',
        checkInTime: new Date(2026, 5, 28, 10, 0),
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      workDuration: 960,
      hasExistingCheckInTime: true,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.action).toBe('checkOut');
    expect(result.workLogId).toBe('wl-exactly-at-limit');
  });

  it('상한 경계: 16시간 1분 경과는 제외한다', async () => {
    // D+1 02:00 스캔 - 어제 09:59 출근 = 16시간 1분.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-just-outside',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '10:00~02:00',
        checkInTime: new Date(2026, 5, 28, 9, 59),
      }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });

  it('checkInTime 이 미래면 제외한다(경과 시간 음수 — 클럭 스큐·오염 데이터)', async () => {
    // 상한만 보면 미래 시각이 통과한다(음수 <= 16시간). 기기 시계가 앞서 있거나 데이터가
    // 오염돼 미래 출근 시각이 들어오면, 그 행이 선택돼 서버가 퇴근으로 해소해 버린다.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-future-checkin',
        date: FIXED_YESTERDAY,
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '18:00~02:00',
        checkInTime: new Date(2026, 5, 29, 3, 0), // 스캔 시각(02:00)보다 1시간 미래
      }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 고정 공고(FIXED_SCHEDULE) 후보의 경과 시간 상한
//
// 고정 공고는 confirm_application 이 dates:['FIXED_SCHEDULE'] 한 원소만 flat INSERT 하므로
// **스태프·공고당 work_log 가 1행**이고, 그 행을 scheduled 로 되돌리는 코드가 없다.
// 상한을 날짜 축(date === yesterday)에만 걸면 date === 'FIXED_SCHEDULE' 인 이 행은 검사를
// 통째로 건너뛴다 → 퇴근 미스캔 시 checked_in 으로 무기한 남고, 며칠 뒤 스캔이 규칙①
// (checked_in 우선)로 그 행을 골라 수십 시간짜리 work_duration 을 정산에 흘려보낸다.
// 서버는 GREATEST(0, ...) 로 음수만 막고 상한이 없다 → 이 필터가 유일한 방어선이다.
// ============================================================================

describe('processQRCheckIn — 고정 공고(FIXED_SCHEDULE) 후보 상한', () => {
  const SCAN_AT_MORNING = new Date(2026, 5, 29, 8, 55);

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(true);
    jest.useFakeTimers({ now: SCAN_AT_MORNING });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('출근 후 4일 경과한 FIXED_SCHEDULE 행은 제외한다(96시간 work_duration 차단)', async () => {
    // 결함 재현: 고정 공고에서 퇴근 스캔을 놓친 뒤 4일 후 출근하려고 스캔.
    // 상한이 날짜 축에만 걸려 있으면 이 행이 선택돼 96시간짜리 퇴근으로 해소된다.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-fixed-stale',
        date: 'FIXED_SCHEDULE',
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '09:00~15:00',
        checkInTime: new Date(2026, 5, 25, 9, 0), // 4일 전
      }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
  });

  it('상한 이내(6시간 경과)인 FIXED_SCHEDULE 행은 정상 퇴근 처리한다', async () => {
    // 상한이 정상 근무까지 막아버리지 않는지 — 제외 케이스와 짝을 이루는 통과 경로.
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-fixed-active',
        date: 'FIXED_SCHEDULE',
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '09:00~15:00',
        checkInTime: new Date(2026, 5, 29, 2, 55), // 6시간 전
      }),
    ]);
    mockProcessQRCheckInOutTransaction.mockResolvedValue({
      action: 'checkOut',
      workDuration: 360,
      hasExistingCheckInTime: true,
    });

    const result = await processQRCheckIn(VENUE_QR, 'staff-1');

    expect(result.action).toBe('checkOut');
    expect(result.workLogId).toBe('wl-fixed-active');
    expect(mockProcessQRCheckInOutTransaction.mock.calls[0][5]).toBe('FIXED_SCHEDULE');
  });

  it('checkInTime 이 없는 FIXED_SCHEDULE checked_in 행은 제외한다(fail-closed)', async () => {
    mockFindQRCandidates.mockResolvedValue([
      createMockWorkLog({
        id: 'wl-fixed-no-checkin-time',
        date: 'FIXED_SCHEDULE',
        status: STATUS.WORK_LOG.CHECKED_IN,
        timeSlot: '09:00~15:00',
        checkInTime: undefined,
      }),
    ]);

    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).rejects.toMatchObject({
      userMessage: '오늘 이 공고에 배정된 근무가 없습니다',
    });

    expect(mockProcessQRCheckInOutTransaction).not.toHaveBeenCalled();
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
    expect(mockFindQRCandidates).toHaveBeenCalledWith(
      'container-1',
      'staff-1',
      FIXED_TODAY,
      FIXED_YESTERDAY
    );
  });
});
