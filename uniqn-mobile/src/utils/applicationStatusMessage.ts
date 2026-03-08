/**
 * UNIQN Mobile - 지원 상태별 메시지 매핑
 *
 * @description 공고 상세 페이지 하단에 표시하는 지원 상태 메시지
 * @version 1.0.0
 */

import { STATUS } from '@/constants';

/**
 * 지원 상태에 따른 사용자 안내 메시지 반환
 *
 * @param status - 지원 상태 문자열
 * @returns 표시할 메시지 (null이면 표시하지 않음)
 */
export function getApplicationStatusMessage(status: string | undefined): string | null {
  if (!status) return null;

  switch (status) {
    case STATUS.APPLICATION.APPLIED:
    case STATUS.APPLICATION.PENDING:
      return '지원 완료 - 검토 중';
    case STATUS.APPLICATION.CONFIRMED:
      return '지원 승인됨';
    case STATUS.APPLICATION.REJECTED:
      return '지원이 거절되었습니다';
    case STATUS.APPLICATION.CANCELLED:
      return '지원이 취소되었습니다';
    case STATUS.APPLICATION.COMPLETED:
      return '근무 완료';
    case STATUS.APPLICATION.CANCELLATION_PENDING:
      return '취소 요청 중';
    default:
      return null;
  }
}
