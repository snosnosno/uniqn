import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useLogger } from '../../hooks/useLogger';
import { useToast } from '../../hooks/useToast';
import i18n from '../../i18n';
import type { TossPaymentSuccessQuery } from '../../types/payment';
import PaymentStepIndicator from '../../components/payment/PaymentStepIndicator';
import {
  trackPaymentPerformance,
  trackApiCall,
  trackPageLoad,
} from '../../utils/performanceMetrics';

/**
 * 결제 성공 페이지
 *
 * 토스페이먼츠 결제 성공 시 리다이렉트되는 페이지
 * - 결제 승인 API 호출 (Firebase Functions)
 * - 칩 지급 확인
 * - 대시보드로 이동
 */
const PaymentSuccessPage: React.FC = () => {
  const { t } = useTranslation('payment');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const logger = useLogger();
  const toast = useToast();

  const [isProcessing, setIsProcessing] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<TossPaymentSuccessQuery | null>(null);

  useEffect(() => {
    // 페이지 로드 성능 측정
    trackPageLoad('payment-success');

    const processPayment = async () => {
      // 결제 처리 성능 측정 시작
      const perfTracker = trackPaymentPerformance('success');

      try {
        // URL 쿼리 파라미터에서 결제 정보 추출
        const paymentKey = searchParams.get('paymentKey');
        const orderId = searchParams.get('orderId');
        const amount = searchParams.get('amount');

        if (!paymentKey || !orderId || !amount) {
          logger.error('결제 정보가 누락되었습니다', undefined, {
            operation: 'processPayment',
            additionalData: { paymentKey, orderId, amount },
          });
          toast.showError(i18n.t('toast.payment.invalidInfo'));
          navigate('/');
          return;
        }

        const paymentData: TossPaymentSuccessQuery = {
          paymentKey,
          orderId,
          amount,
        };

        setPaymentInfo(paymentData);
        logger.info('결제 성공 정보 수신', {
          operation: 'processPayment',
          additionalData: paymentData as unknown as Record<string, unknown>,
        });

        // Firebase Functions를 통한 결제 승인 API 호출 (성능 측정 포함)
        const result = await trackApiCall('confirmPayment', async () => {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const functions = getFunctions();
          const confirmPaymentFn = httpsCallable(functions, 'confirmPayment');

          return await confirmPaymentFn({
            paymentKey,
            orderId,
            amount: parseInt(amount, 10),
          });
        });

        const resultData = result.data as { success: boolean; message: string; data: unknown };

        if (!resultData.success) {
          throw new Error(i18n.t('errors.paymentApprovalFailed'));
        }

        logger.info('결제 승인 완료', {
          operation: 'processPayment',
          additionalData: resultData.data as Record<string, unknown>,
        });

        // 성능 측정 종료 (성공)
        perfTracker.end({
          orderId,
          amount: parseInt(amount, 10),
          status: 'success',
        });

        toast.showSuccess(i18n.t('toast.payment.successWithChip'));
        setIsProcessing(false);

        // 3초 후 대시보드로 이동
        setTimeout(() => {
          navigate('/app/profile');
        }, 3000);
      } catch (error) {
        // 성능 측정 종료 (실패)
        perfTracker.end({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });

        logger.error('결제 처리 실패', undefined, {
          operation: 'processPayment',
          additionalData: { error },
        });
        toast.showError(i18n.t('toast.payment.processError'));
        navigate('/');
      }
    };

    processPayment();
  }, [searchParams, logger, toast, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
      {/* 단계 표시 */}
      <PaymentStepIndicator currentStep="complete" />

      <div className="max-w-md w-full space-y-8 text-center mx-auto mt-8">
        {isProcessing ? (
          <>
            {/* 로딩 상태 */}
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('common.loading')}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">{t('paymentSuccess.message')}</p>
            </div>
          </>
        ) : (
          <>
            {/* 성공 상태 */}
            <div className="flex flex-col items-center">
              <CheckCircleIcon className="h-16 w-16 text-green-500" />
              <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('paymentSuccess.title')}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">{t('paymentSuccess.message')}</p>

              {paymentInfo && (
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    {t('paymentSuccess.orderInfo.title')}
                  </h3>
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t('paymentSuccess.orderInfo.orderId')}:
                      </span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono text-sm">
                        {paymentInfo.orderId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t('paymentSuccess.orderInfo.amount')}:
                      </span>
                      <span className="text-gray-900 dark:text-gray-100 font-semibold">
                        {parseInt(paymentInfo.amount, 10).toLocaleString()}
                        {t('common.currency.krw')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                잠시 후 대시보드로 이동합니다...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default PaymentSuccessPage;
