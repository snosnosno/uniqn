import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadTossPayments, type TossPaymentsInstance } from '@tosspayments/payment-sdk';
import { useAuth } from '../contexts/AuthContext';
import { useLogger } from './useLogger';
import { useToast } from './useToast';
import type {
  TossPaymentRequest,
  ChipPackageId,
} from '../types/payment';
import { CHIP_PACKAGES } from '../config/chipPricing';

// 토스페이먼츠 클라이언트 키 (환경변수에서 가져오기)
const TOSS_CLIENT_KEY = process.env.REACT_APP_TOSS_CLIENT_KEY || '';

/**
 * 토스페이먼츠 결제 Hook
 *
 * 기능:
 * - 토스페이먼츠 SDK 초기화
 * - 결제창 호출
 * - 주문 ID 생성
 * - 결제 상태 관리
 */
export const useTossPayment = () => {
  const { currentUser } = useAuth();
  const logger = useLogger();
  const toast = useToast();
  const navigate = useNavigate();

  const [tossPayments, setTossPayments] = useState<TossPaymentsInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * 토스페이먼츠 SDK 초기화
   */
  useEffect(() => {
    const initializeTossPayments = async () => {
      try {
        if (!TOSS_CLIENT_KEY) {
          logger.error('토스페이먼츠 클라이언트 키가 설정되지 않았습니다', undefined, {
            operation: 'initializeTossPayments',
            additionalData: { env: process.env.NODE_ENV },
          });
          toast.showError('결제 시스템 설정 오류');
          return;
        }

        logger.info('토스페이먼츠 SDK 초기화 시작');
        const instance = await loadTossPayments(TOSS_CLIENT_KEY);
        setTossPayments(instance);
        setIsInitialized(true);
        logger.info('토스페이먼츠 SDK 초기화 완료');
      } catch (error) {
        logger.error('토스페이먼츠 SDK 초기화 실패', error instanceof Error ? error : undefined, {
          operation: 'initializeTossPayments',
        });
        toast.showError('결제 시스템 초기화 실패');
      }
    };

    initializeTossPayments();
  }, [logger, toast]); // 한 번만 실행

  /**
   * 주문 ID 생성
   * 형식: CHIP_{userId}_{packageId}_{timestamp}
   */
  const generateOrderId = useCallback((packageId: ChipPackageId): string => {
    const timestamp = Date.now();
    const userId = currentUser?.uid?.substring(0, 8) || 'unknown';
    return `CHIP_${userId}_${packageId}_${timestamp}`;
  }, [currentUser]);

  /**
   * 칩 충전 결제 요청
   */
  const requestChipPayment = useCallback(async (packageId: ChipPackageId) => {
    try {
      if (!currentUser) {
        toast.showError('로그인이 필요합니다');
        navigate('/login');
        return;
      }

      if (!isInitialized || !tossPayments) {
        toast.showError('결제 시스템이 초기화되지 않았습니다');
        return;
      }

      setIsLoading(true);
      logger.info('칩 충전 결제 요청 시작', { operation: 'requestChipPayment', additionalData: { packageId } });

      const chipPackage = CHIP_PACKAGES[packageId];
      if (!chipPackage) {
        throw new Error(`유효하지 않은 패키지 ID: ${packageId}`);
      }

      const orderId = generateOrderId(packageId);
      const orderName = `${chipPackage.name} (빨간칩 ${chipPackage.chipCount}개)`;

      // 결제 요청 파라미터
      const paymentRequest: TossPaymentRequest = {
        amount: chipPackage.price,
        orderId,
        orderName,
        customerName: currentUser.displayName || undefined,
        customerEmail: currentUser.email || undefined,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        flowMode: 'DEFAULT',
      };

      logger.info('결제창 호출', { operation: 'requestChipPayment', additionalData: paymentRequest as unknown as Record<string, unknown> });

      // 토스페이먼츠 결제창 호출
      await tossPayments.requestPayment('카드', paymentRequest);

    } catch (error) {
      logger.error('칩 충전 결제 요청 실패', error instanceof Error ? error : undefined, {
        operation: 'requestChipPayment',
        additionalData: { packageId },
      });
      toast.showError('결제 요청에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [
    currentUser,
    isInitialized,
    tossPayments,
    generateOrderId,
    navigate,
    logger,
    toast,
  ]);

  /**
   * 구독 플랜 결제 요청 (추후 구현)
   */
  const requestSubscriptionPayment = useCallback(async (planType: 'standard' | 'pro') => {
    logger.info('구독 플랜 결제는 추후 구현 예정', { operation: 'requestSubscriptionPayment', additionalData: { planType } });
    toast.showInfo('구독 플랜 결제는 준비 중입니다');
  }, [logger, toast]);

  return {
    // 상태
    isLoading,
    isInitialized,

    // 메서드
    requestChipPayment,
    requestSubscriptionPayment,
    generateOrderId,
  };
};
