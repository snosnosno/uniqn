import { buildVenueQRString, processQRCheckIn } from '@/services/work/eventQRService';

const mockProcessPostingQRAttendance = jest.fn();
const mockTrackCheckIn = jest.fn();
const mockTrackCheckOut = jest.fn();

jest.mock('@/repositories', () => ({
  workLogRepository: {
    processPostingQRAttendance: (...args: unknown[]) => mockProcessPostingQRAttendance(...args),
  },
}));

jest.mock('@/services/observability', () => ({
  createJobDeepLink: jest.fn(),
  trackCheckIn: (...args: unknown[]) => mockTrackCheckIn(...args),
  trackCheckOut: (...args: unknown[]) => mockTrackCheckOut(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const VENUE_QR = JSON.stringify({ type: 'venue', jobPostingId: 'posting-1' });
const SCANNED_AT = new Date('2026-09-10T09:02:00.000Z');
const APPLIED_AT = new Date('2026-09-10T09:15:00.000Z');

describe('processQRCheckIn — 공고 QR 서버 자동 판별', () => {
  beforeEach(() => jest.clearAllMocks());

  it('알 수 없는 QR은 서버를 호출하지 않고 거부한다', async () => {
    await expect(processQRCheckIn('{"type":"event"}', 'staff-1')).rejects.toMatchObject({
      userMessage: expect.any(String),
    });
    expect(mockProcessPostingQRAttendance).not.toHaveBeenCalled();
  });

  it('공고 ID와 스태프 ID만 보내 서버가 날짜와 액션을 판별한다', async () => {
    mockProcessPostingQRAttendance.mockResolvedValue({
      success: true,
      workLogId: 'wl-1',
      assignmentGroupId: null,
      timeSlot: '18:00',
      action: 'checkIn',
      scannedAt: SCANNED_AT,
      appliedTime: APPLIED_AT,
      message: '출근이 기록되었습니다.',
    });
    const result = await processQRCheckIn(VENUE_QR, 'staff-1');
    expect(mockProcessPostingQRAttendance).toHaveBeenCalledWith(
      'posting-1',
      'staff-1',
      undefined,
      undefined
    );
    expect(result).toMatchObject({ success: true, action: 'checkIn' });
    if (result.success) expect(result.message).toContain('18:15');
    expect(mockTrackCheckIn).toHaveBeenCalled();
  });

  it('여러 후보에서는 변경 없이 선택 요청을 전달한다', async () => {
    const candidates = [
      { workLogId: 'wl-1', date: '2026-09-10', timeSlot: '10:00', action: 'checkIn' },
      { workLogId: 'wl-2', date: '2026-09-10', timeSlot: '18:00', action: 'checkIn' },
    ];
    mockProcessPostingQRAttendance.mockResolvedValue({
      success: false,
      requiresSelection: true,
      selectionToken: 'selection-token',
      candidates,
    });
    await expect(processQRCheckIn(VENUE_QR, 'staff-1')).resolves.toEqual({
      success: false,
      requiresSelection: true,
      selectionToken: 'selection-token',
      candidates,
    });
    expect(mockTrackCheckIn).not.toHaveBeenCalled();
    expect(mockTrackCheckOut).not.toHaveBeenCalled();
  });

  it('선택한 후보 ID만 서버에 다시 전달한다', async () => {
    mockProcessPostingQRAttendance.mockResolvedValue({
      success: true,
      workLogId: 'wl-2',
      assignmentGroupId: null,
      timeSlot: '18:00',
      action: 'checkOut',
      scannedAt: SCANNED_AT,
      appliedTime: APPLIED_AT,
      message: '퇴근이 기록되었습니다.',
    });
    const result = await processQRCheckIn(VENUE_QR, 'staff-1', 'wl-2', 'selection-token');
    expect(mockProcessPostingQRAttendance).toHaveBeenCalledWith(
      'posting-1',
      'staff-1',
      'wl-2',
      'selection-token'
    );
    expect(result).toMatchObject({ success: true, action: 'checkOut' });
    expect(mockTrackCheckOut).toHaveBeenCalled();
  });
});

describe('buildVenueQRString', () => {
  it('날짜와 액션 없이 공고 ID만 인코딩한다', () => {
    expect(JSON.parse(buildVenueQRString('posting-1'))).toEqual({
      type: 'venue',
      jobPostingId: 'posting-1',
    });
  });
});
