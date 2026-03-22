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
