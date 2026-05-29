import { STATUS } from '@/constants';

export function getApplicationStatusMessage(status: string | undefined): string | null {
  if (!status) return null;

  switch (status) {
    case STATUS.APPLICATION.APPLIED:
      return '지원 완료 - 검토 중';
    case STATUS.APPLICATION.CONFIRMED:
      return '지원이 확정되었습니다.';
    case STATUS.APPLICATION.REJECTED:
      return '지원이 거절되었습니다.';
    case STATUS.APPLICATION.CANCELLED:
      return '지원이 취소되었습니다.';
    case STATUS.APPLICATION.COMPLETED:
      return '근무가 완료되었습니다.';
    case STATUS.APPLICATION.CANCELLATION_PENDING:
      return '취소 요청 검토 중입니다.';
    default:
      return null;
  }
}

/**
 * 확정된 지원을 앱에서 취소할 수 없는 사유 안내 문구.
 *
 * @description 취소 버튼이 렌더되지 않는 경우(canRequestCancel=false) 사용자에게
 *              "왜 취소할 수 없는지 + 어떻게 해야 하는지"를 한 줄로 안내한다.
 *              확정 상태가 아니거나 정상적으로 취소 가능한 경우엔 null.
 */
export function getCancelUnavailableReason(params: {
  status: string | undefined;
  isFixed: boolean;
  hasPendingCancellation: boolean;
}): string | null {
  // 확정 상태가 아니면 상태 메시지만으로 충분 → 별도 안내 불필요
  if (params.status !== STATUS.APPLICATION.CONFIRMED) return null;

  // 취소 요청이 이미 접수된 경우
  if (params.hasPendingCancellation) {
    return '취소 요청이 접수되어 검토 중이에요. 결과를 기다려 주세요.';
  }

  // 장기(고정) 공고는 앱 취소 불가 — 사업주 직접 문의 필요
  if (params.isFixed) {
    return '장기 알바는 앱에서 취소할 수 없어요. 사업주에게 직접 문의해 주세요.';
  }

  return null;
}
