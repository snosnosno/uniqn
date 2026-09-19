/**
 * T-B6: process_qr_checkin_atomically RPC 클라이언트 회귀 테스트
 *
 * supabase.rpc 모킹으로 executeProcessQRCheckInOut가 새 RPC 호출 패턴을 따르는지 검증.
 * 각 에러 코드가 적절한 AppError 서브타입으로 매핑되는지 확인.
 */

import {
  executeProcessPostingQRAttendance,
  executeProcessQRCheckInOut,
} from '../WorkLogRepositoryTransactions';
import {
  AlreadyCheckedInError,
  InvalidQRCodeError,
  NotCheckedInError,
} from '@/errors/BusinessErrors';
import { BusinessError } from '@/errors';
import { settledLockMessage } from '@/domains/settlement';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const WORK_LOG_ID = '11111111-1111-1111-1111-111111111111';
const STAFF_ID = '22222222-2222-2222-2222-222222222222';
const JOB_POSTING_ID = '33333333-3333-3333-3333-333333333333';
const CHECK_TIME = new Date('2026-04-14T10:00:00.000Z');
const EXPECTED_DATE = '2026-04-14';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('executeProcessQRCheckInOut — RPC 위임', () => {
  it('checkIn 호출 시 process_qr_checkin_atomically RPC를 올바른 파라미터로 호출', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        action: 'checkIn',
        check_in_time: CHECK_TIME.toISOString(),
        work_duration: 0,
      },
      error: null,
    });

    const result = await executeProcessQRCheckInOut(
      WORK_LOG_ID,
      STAFF_ID,
      JOB_POSTING_ID,
      'checkIn',
      CHECK_TIME,
      EXPECTED_DATE
    );

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('process_qr_checkin_atomically', {
      p_work_log_id: WORK_LOG_ID,
      p_staff_id: STAFF_ID,
      p_job_posting_id: JOB_POSTING_ID,
      p_action: 'checkIn',
      p_check_time: null,
      p_expected_date: EXPECTED_DATE,
    });
    expect(result.action).toBe('checkIn');
    expect(result.workDuration).toBe(0);
    // U3: RPC가 check_in_time을 돌려주면 hasExistingCheckInTime=true로 도출
    expect(result.hasExistingCheckInTime).toBe(true);
  });

  it('checkOut 호출 시 work_duration이 응답값을 그대로 반환', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        action: 'checkOut',
        check_out_time: CHECK_TIME.toISOString(),
        work_duration: 8.5,
      },
      error: null,
    });

    const result = await executeProcessQRCheckInOut(
      WORK_LOG_ID,
      STAFF_ID,
      JOB_POSTING_ID,
      'checkOut',
      CHECK_TIME,
      EXPECTED_DATE
    );

    expect(result.action).toBe('checkOut');
    expect(result.workDuration).toBe(8.5);
    // U3: RPC 응답에 check_in_time이 없으면 hasExistingCheckInTime=false
    expect(result.hasExistingCheckInTime).toBe(false);
  });
});

describe('executeProcessQRCheckInOut — 에러 매핑', () => {
  it('already_settled → BusinessError', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'already_settled' }, error: null });

    await expect(
      executeProcessQRCheckInOut(
        WORK_LOG_ID,
        STAFF_ID,
        JOB_POSTING_ID,
        'checkIn',
        CHECK_TIME,
        EXPECTED_DATE
      )
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('already_settled 의 사용자 문구는 정산 확정 안내여야 함', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'already_settled' }, error: null });

    await expect(
      executeProcessQRCheckInOut(
        WORK_LOG_ID,
        STAFF_ID,
        JOB_POSTING_ID,
        'checkIn',
        CHECK_TIME,
        EXPECTED_DATE
      )
      // 정산 잠금 문구는 settledLockMessage 단일 소스를 따른다(화면마다 다른 말을 하던 4종을 통일).
    ).rejects.toMatchObject({ userMessage: settledLockMessage('출퇴근을 처리할') });
  });

  it('already_checked_in → AlreadyCheckedInError', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'already_checked_in' },
      error: null,
    });

    await expect(
      executeProcessQRCheckInOut(
        WORK_LOG_ID,
        STAFF_ID,
        JOB_POSTING_ID,
        'checkIn',
        CHECK_TIME,
        EXPECTED_DATE
      )
    ).rejects.toBeInstanceOf(AlreadyCheckedInError);
  });

  it('not_checked_in → NotCheckedInError', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'not_checked_in' }, error: null });

    await expect(
      executeProcessQRCheckInOut(
        WORK_LOG_ID,
        STAFF_ID,
        JOB_POSTING_ID,
        'checkOut',
        CHECK_TIME,
        EXPECTED_DATE
      )
    ).rejects.toBeInstanceOf(NotCheckedInError);
  });

  it('staff_id_mismatch → InvalidQRCodeError', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'staff_id_mismatch' },
      error: null,
    });

    await expect(
      executeProcessQRCheckInOut(
        WORK_LOG_ID,
        STAFF_ID,
        JOB_POSTING_ID,
        'checkIn',
        CHECK_TIME,
        EXPECTED_DATE
      )
    ).rejects.toBeInstanceOf(InvalidQRCodeError);
  });

  it('job_posting_inactive 의 사용자 문구는 종료된 공고 안내여야 함', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'job_posting_inactive' },
      error: null,
    });

    await expect(
      executeProcessQRCheckInOut(
        WORK_LOG_ID,
        STAFF_ID,
        JOB_POSTING_ID,
        'checkIn',
        CHECK_TIME,
        EXPECTED_DATE
      )
    ).rejects.toMatchObject({ userMessage: '종료된 공고입니다' });
  });

  it('job_posting_inactive → InvalidQRCodeError', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'job_posting_inactive' },
      error: null,
    });

    await expect(
      executeProcessQRCheckInOut(
        WORK_LOG_ID,
        STAFF_ID,
        JOB_POSTING_ID,
        'checkIn',
        CHECK_TIME,
        EXPECTED_DATE
      )
    ).rejects.toBeInstanceOf(InvalidQRCodeError);
  });

  it('date_mismatch → InvalidQRCodeError', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'date_mismatch' }, error: null });

    await expect(
      executeProcessQRCheckInOut(
        WORK_LOG_ID,
        STAFF_ID,
        JOB_POSTING_ID,
        'checkIn',
        CHECK_TIME,
        EXPECTED_DATE
      )
    ).rejects.toBeInstanceOf(InvalidQRCodeError);
  });
});

describe('executeProcessQRCheckInOut — Phase C 응답 호환', () => {
  it('checkIn 응답의 check_in_time 이 ISO string 이면 정상 처리', async () => {
    const iso = '2026-04-21T12:00:00.000Z';
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        action: 'checkIn',
        check_in_time: iso,
        work_duration: 0,
      },
      error: null,
    });

    const result = await executeProcessQRCheckInOut(
      WORK_LOG_ID,
      STAFF_ID,
      JOB_POSTING_ID,
      'checkIn',
      new Date(iso),
      EXPECTED_DATE
    );

    expect(result.action).toBe('checkIn');
    expect(result.workDuration).toBe(0);
  });
});

describe('executeProcessPostingQRAttendance — 서버 자동 판별', () => {
  it('첫 스캔은 공고와 스태프만 보내고 서버 결과를 변환한다', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        work_log_id: WORK_LOG_ID,
        action: 'checkIn',
        date: EXPECTED_DATE,
        time_slot: '18:00',
        scanned_at: CHECK_TIME.toISOString(),
        applied_time: CHECK_TIME.toISOString(),
      },
      error: null,
    });

    const result = await executeProcessPostingQRAttendance(JOB_POSTING_ID, STAFF_ID);

    expect(mockRpc).toHaveBeenCalledWith('process_posting_qr_attendance', {
      p_job_posting_id: JOB_POSTING_ID,
      p_staff_id: STAFF_ID,
    });
    expect(result).toMatchObject({ success: true, workLogId: WORK_LOG_ID, action: 'checkIn' });
  });

  it('여러 후보 응답은 선택 목록으로 변환한다', async () => {
    const candidates = [
      { workLogId: WORK_LOG_ID, date: EXPECTED_DATE, timeSlot: '18:00', action: 'checkIn' },
    ];
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'selection_required',
        requires_selection: true,
        selection_token: 'selection-token',
        candidates,
      },
      error: null,
    });

    await expect(executeProcessPostingQRAttendance(JOB_POSTING_ID, STAFF_ID)).resolves.toEqual({
      success: false,
      requiresSelection: true,
      selectionToken: 'selection-token',
      candidates,
    });
  });

  it('선택 재호출은 workLogId를 포함한다', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        work_log_id: WORK_LOG_ID,
        action: 'checkOut',
        scanned_at: CHECK_TIME.toISOString(),
        applied_time: CHECK_TIME.toISOString(),
      },
      error: null,
    });

    await executeProcessPostingQRAttendance(
      JOB_POSTING_ID,
      STAFF_ID,
      WORK_LOG_ID,
      'selection-token'
    );
    expect(mockRpc).toHaveBeenCalledWith('process_posting_qr_attendance', {
      p_job_posting_id: JOB_POSTING_ID,
      p_staff_id: STAFF_ID,
      p_selected_work_log_id: WORK_LOG_ID,
      p_selection_token: 'selection-token',
    });
  });

  it('출근과 같은 15분 슬롯의 퇴근은 사용자 오류로 변환한다', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'checkout_too_early' },
      error: null,
    });

    await expect(executeProcessPostingQRAttendance(JOB_POSTING_ID, STAFF_ID)).rejects.toMatchObject(
      { userMessage: expect.stringContaining('퇴근할 수 없습니다') }
    );
  });
});
