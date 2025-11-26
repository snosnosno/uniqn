import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { useLogger } from '../../hooks/useLogger';
import type { TossPaymentFailQuery } from '../../types/payment';

/**
 * 결제 실패 페이지
 *
 * 토스페이먼츠 결제 실패 시 리다이렉트되는 페이지
 * - 실패 사유 표시
 * - 재시도 유도
 */
const PaymentFailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const logger = useLogger();

  const code = searchParams.get('code') || 'UNKNOWN_ERROR';
  const message = searchParams.get('message') || '알 수 없는 오류가 발생했습니다';
  const orderId = searchParams.get('orderId') || '';

  useEffect(() => {
    const failInfo: TossPaymentFailQuery = {
      code,
      message,
      orderId,
    };

    logger.error('결제 실패', undefined, {
      operation: 'processPaymentFail',
      additionalData: failInfo as unknown as Record<string, unknown>,
    });
  }, [code, message, orderId, logger]);

  const handleRetry = () => {
    navigate('/chip/recharge');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex flex-col items-center">
          <XCircleIcon className="h-16 w-16 text-red-500" />
          <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
            결제에 실패했습니다
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{message}</p>

          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              오류 정보
            </h3>
            <div className="space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">오류 코드:</span>
                <span className="text-gray-900 dark:text-gray-100 font-mono text-sm">{code}</span>
              </div>
              {orderId && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">주문 번호:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono text-sm">
                    {orderId}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 space-y-3 w-full">
            <button
              onClick={handleRetry}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              다시 시도하기
            </button>
            <button
              onClick={handleGoHome}
              className="w-full flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>

          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            문제가 계속되면 고객센터로 문의해주세요.
          </p>
        </div>
      </div>
    </div>
  );
};
export default PaymentFailPage;
