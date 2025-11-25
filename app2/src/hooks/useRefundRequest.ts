import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { logger } from '../utils/logger';
import { useToast } from './useToast';

/**
 * 환불 요청 Hook
 *
 * Firebase Functions의 requestRefund를 호출하여 환불을 요청합니다.
 *
 * @returns 환불 요청 함수 및 상태
 */
export const useRefundRequest = () => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 환불 요청
   *
   * @param transactionId - 트랜잭션 ID
   * @param reason - 환불 사유
   */
  const requestRefund = async (transactionId: string, reason: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const requestRefundFn = httpsCallable(functions, 'requestRefund');

      const result = await requestRefundFn({
        transactionId,
        reason,
      });

      const data = result.data as { success: boolean; message: string };

      if (data.success) {
        logger.info('환불 요청 성공', {
          operation: 'requestRefund',
          additionalData: { transactionId },
        });
        toast.showSuccess('환불 요청이 완료되었습니다. 영업일 기준 3-5일 내에 처리됩니다.');
        return true;
      } else {
        throw new Error(data.message || '환불 요청 실패');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '환불 요청 중 오류가 발생했습니다';

      logger.error('환불 요청 실패', error instanceof Error ? error : undefined, {
        operation: 'requestRefund',
        additionalData: { transactionId },
      });

      toast.showError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    requestRefund,
    isLoading,
  };
};
