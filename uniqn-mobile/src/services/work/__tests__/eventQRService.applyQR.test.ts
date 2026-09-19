/**
 * 지원 QR ↔ 출근 QR 분리 (S3-5)
 *
 * 🚨 **이 스위트는 오스캔 사고를 막는다.**
 *   현장에는 두 QR 이 동시에 존재한다 — 사장이 띄우는 출근 QR, 홍보물에 실린 지원 QR.
 *   `type` 이 같아지는 순간 지원 QR 을 찍은 스태프가 출근 처리되거나, 반대로 출근 QR 이
 *   공고 페이지로 새어 **현장에서 출근이 안 된다.** 둘 다 "에러 없이 잘못 동작"하는 형태다.
 *
 *   그리고 잘못 찍었을 때 "UNIQN 출근 QR이 아닙니다" 만 보여 주면 사용자는 무엇이 잘못됐는지
 *   모르고 같은 QR 을 반복해서 찍는다 — 무엇을 찍었는지 말해 줘야 행동을 바꾼다.
 */
import { processQRCheckIn, buildVenueQRString, buildApplyQRString } from '../eventQRService';
import { QR_MESSAGES, QR_PAYLOAD_TYPES } from '@/constants/qr';

const mockFindQRCandidates = jest.fn();

jest.mock('@/repositories', () => ({
  workLogRepository: {
    findQRCandidates: (...args: unknown[]) => mockFindQRCandidates(...args),
    processQRCheckInOutTransaction: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('지원 QR 페이로드', () => {
  it('🚨 URL 이다 — JSON 이면 폰 카메라가 아무 데도 못 가서 기능이 죽는다', () => {
    // 2026-08-14 리뷰 적발: 처음엔 출근 QR 페이로드를 복사해 {type:'apply'} JSON 을 넣었는데
    // 그걸 읽는 소비자가 코드베이스에 0곳이었다. 화면은 "찍으면 공고가 열려요"라고 말하는데
    // 실제로는 아무 일도 일어나지 않았다. 이 단언이 그 재발을 막는다.
    const apply = buildApplyQRString('job-1');

    expect(apply.startsWith('https://')).toBe(true);
    expect(apply).toContain('/jobs/job-1');
    expect(() => JSON.parse(apply)).toThrow();
  });

  it('출처가 붙어 QR 유입이 공유 퍼널에 잡힌다', () => {
    expect(buildApplyQRString('job-1')).toContain('src=apply_qr');
  });

  it('출근 QR 과 형태부터 다르다 — 오스캔이 사고가 되지 않는다', () => {
    const apply = buildApplyQRString('job-1');
    const venue = buildVenueQRString('job-1');

    // 출근 QR 은 우리 앱 스캐너가 읽는 JSON, 지원 QR 은 남의 카메라가 읽는 URL 이다.
    expect(JSON.parse(venue).type).toBe(QR_PAYLOAD_TYPES.venue);
    expect(apply).not.toBe(venue);
  });
});

/** 거부 문구만 뽑아낸다. 통과해 버리면 undefined 라 단언이 자연스럽게 실패한다. */
function rejectionMessage(qrString: string): Promise<string | undefined> {
  return processQRCheckIn(qrString, 'staff-1').then(
    () => undefined,
    (error: unknown) => (error as { userMessage?: string }).userMessage
  );
}

describe('출근 스캐너에 지원 QR 을 댔을 때', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('지원 QR(URL)이라고 짚어 주고, 무엇을 찍어야 하는지 알려준다', async () => {
    await expect(processQRCheckIn(buildApplyQRString('job-1'), 'staff-1')).rejects.toMatchObject({
      userMessage: QR_MESSAGES.applyQRScannedAtCheckIn,
    });

    // 출근 처리 경로로는 한 발짝도 못 들어가야 한다.
    expect(mockFindQRCandidates).not.toHaveBeenCalled();
  });

  it('이미 인쇄돼 나간 구 JSON 형태(type:apply)도 같은 문구로 짚어 준다', async () => {
    const legacyApply = JSON.stringify({ type: 'apply', jobPostingId: 'job-1' });

    await expect(processQRCheckIn(legacyApply, 'staff-1')).rejects.toMatchObject({
      userMessage: QR_MESSAGES.applyQRScannedAtCheckIn,
    });
  });

  it('정체불명 QR 과는 다른 문구를 쓴다 — 사용자가 취할 행동이 다르다', async () => {
    const applyMessage = await rejectionMessage(buildApplyQRString('job-1'));
    const unknownMessage = await rejectionMessage('그냥문자열');

    expect(applyMessage).not.toBe(unknownMessage);
    expect(unknownMessage).toBe(QR_MESSAGES.notCheckInQR);
  });

  it('기존 거부 경로(정체불명·구 회전 QR)의 문구는 그대로다 — 회귀 방지', async () => {
    await expect(processQRCheckIn('그냥문자열', 'staff-1')).rejects.toMatchObject({
      userMessage: 'UNIQN 출근 QR이 아닙니다',
    });

    const legacy = JSON.stringify({ type: 'event', jobPostingId: 'p1', action: 'checkIn' });
    await expect(processQRCheckIn(legacy, 'staff-1')).rejects.toMatchObject({
      userMessage: 'UNIQN 출근 QR이 아닙니다',
    });
  });
});
