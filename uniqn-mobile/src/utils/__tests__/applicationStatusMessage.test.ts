import {
  getApplicationStatusMessage,
  getCancelUnavailableReason,
} from '@/utils/applicationStatusMessage';
import { STATUS } from '@/constants';

describe('getApplicationStatusMessage', () => {
  it('확정 상태 메시지를 반환한다', () => {
    expect(getApplicationStatusMessage(STATUS.APPLICATION.CONFIRMED)).toBe(
      '지원이 확정되었습니다.'
    );
  });

  it('취소 요청 검토 중 메시지를 반환한다', () => {
    expect(getApplicationStatusMessage(STATUS.APPLICATION.CANCELLATION_PENDING)).toBe(
      '취소 요청 검토 중입니다.'
    );
  });

  it('상태가 없으면 null을 반환한다', () => {
    expect(getApplicationStatusMessage(undefined)).toBeNull();
  });
});

describe('getCancelUnavailableReason', () => {
  it('고정(장기) 공고가 확정되면 앱 취소 불가 안내를 반환한다', () => {
    expect(
      getCancelUnavailableReason({
        status: STATUS.APPLICATION.CONFIRMED,
        isFixed: true,
        hasPendingCancellation: false,
      })
    ).toBe('장기 알바는 앱에서 취소할 수 없어요. 사업주에게 직접 문의해 주세요.');
  });

  it('취소 요청이 접수된 확정 건은 검토 중 안내를 우선 반환한다', () => {
    expect(
      getCancelUnavailableReason({
        status: STATUS.APPLICATION.CONFIRMED,
        isFixed: true,
        hasPendingCancellation: true,
      })
    ).toBe('취소 요청이 접수되어 검토 중이에요. 결과를 기다려 주세요.');
  });

  it('취소 가능한 일반(dated) 확정 건은 안내가 없다(null)', () => {
    expect(
      getCancelUnavailableReason({
        status: STATUS.APPLICATION.CONFIRMED,
        isFixed: false,
        hasPendingCancellation: false,
      })
    ).toBeNull();
  });

  it('확정 상태가 아니면(지원 완료 등) 안내가 없다(null)', () => {
    expect(
      getCancelUnavailableReason({
        status: STATUS.APPLICATION.APPLIED,
        isFixed: true,
        hasPendingCancellation: false,
      })
    ).toBeNull();
  });
});
