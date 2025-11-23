/**
 * 환불 시스템 구현
 *
 * 기능:
 * - 7일 이내 환불 가능
 * - 20% 수수료 차감
 * - 칩 회수
 * - 환불 내역 기록
 *
 * 토스페이먼츠 API: POST /v1/payments/{paymentKey}/cancel
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import {
  validateRateLimit,
  RATE_LIMIT_CONFIGS,
} from '../middleware/rateLimiter';

// Firestore & Timestamp
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * 환불 요청 인터페이스
 */
interface RefundPaymentRequest {
  userId: string;
  transactionId: string;  // 원 결제 트랜잭션 ID
  reason: 'unused' | 'partial_use' | 'dissatisfaction' | 'error' | 'other';
  reasonDetail: string;
}

/**
 * 환불 응답 인터페이스
 */
interface RefundPaymentResponse {
  success: boolean;
  refundId?: string;
  refundAmount?: number;
  feeAmount?: number;
  message?: string;
  error?: string;
}

/**
 * 토스페이먼츠 환불 요청
 */
interface TossRefundRequest {
  cancelReason: string;
  cancelAmount?: number;
}

/**
 * 토스페이먼츠 환불 응답
 */
interface TossRefundResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  cancels: Array<{
    cancelAmount: number;
    cancelReason: string;
    canceledAt: string;
    cancelStatus: 'DONE' | 'ABORTED';
  }>;
}

/**
 * 환불 정책 상수
 */
const REFUND_POLICY = {
  eligibleDays: 7,        // 7일 이내 환불 가능
  fullRefundFee: 0,       // 미사용 시 0%
  partialRefundFee: 0.2,  // 부분 사용 시 20%
  monthlyLimit: 1,        // 월 1회
  yearlyLimit: 3,         // 연 3회
  blacklistThreshold: 3,  // 환불 3회 초과 시 블랙리스트
};

/**
 * 환불 처리 Cloud Function
 *
 * @param {RefundPaymentRequest} data - 환불 요청 데이터
 * @param {functions.https.CallableContext} context - 호출 컨텍스트
 * @returns {Promise<RefundPaymentResponse>} 환불 결과
 */
export const refundPayment = functions
  .region('asia-northeast3')
  .https.onCall(
    async (
      data: RefundPaymentRequest,
      context: functions.https.CallableContext
    ): Promise<RefundPaymentResponse> => {
      try {
        // 1. 인증 확인
        if (!context.auth) {
          throw new functions.https.HttpsError(
            'unauthenticated',
            '인증이 필요합니다.'
          );
        }

        const { userId, transactionId, reason, reasonDetail } = data;

        // 2. 본인 확인
        if (context.auth.uid !== userId) {
          throw new functions.https.HttpsError(
            'permission-denied',
            '본인의 결제만 환불할 수 있습니다.'
          );
        }

        // 2-1. Rate Limiting 검증
        try {
          await validateRateLimit(userId, RATE_LIMIT_CONFIGS.refund);
        } catch (error: any) {
          if (error.code === 'RATE_LIMIT_EXCEEDED') {
            logger.warn('환불 요청 실패: Rate limit 초과', {
              userId,
              retryAfter: error.retryAfter,
            });
            throw new functions.https.HttpsError(
              'resource-exhausted',
              error.message
            );
          }
          throw error;
        }

        // 3. 원 결제 트랜잭션 조회
        const transactionDoc = await db
          .collection('paymentTransactions')
          .doc(transactionId)
          .get();

        if (!transactionDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            '결제 내역을 찾을 수 없습니다.'
          );
        }

        const transaction = transactionDoc.data()!;

        // 4. 환불 가능 여부 검증
        const eligibility = await checkRefundEligibility(userId, transaction);

        if (!eligibility.isEligible) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            eligibility.reason || '환불이 불가능합니다.'
          );
        }

        // 5. 사용한 칩 개수 확인
        const usedChips = await getUsedChips(userId, transactionId);
        const purchasedChips = transaction.chips;
        const remainingChips = purchasedChips - usedChips;

        // 6. 환불 금액 계산
        const { refundAmount, feeAmount, refundChips } = calculateRefundAmount(
          transaction.amount,
          purchasedChips,
          usedChips,
          remainingChips
        );

        logger.info('환불 금액 계산 완료', {
          userId,
          transactionId,
          purchasedChips,
          usedChips,
          remainingChips,
          refundAmount,
          feeAmount,
          refundChips,
        });

        // 7. 환불 요청 생성
        const refundRequestRef = db.collection('refundRequests').doc();
        const refundId = refundRequestRef.id;

        await refundRequestRef.set({
          id: refundId,
          userId,
          userEmail: context.auth.token.email || '',
          userName: transaction.userName || '',

          // 원 거래 정보
          transactionId,
          packageId: transaction.packageId,
          purchasedAmount: transaction.amount,
          purchasedChips,

          // 환불 정보
          status: 'pending',
          reason,
          reasonDetail,

          // 사용 내역
          usedChips,
          remainingChips,

          // 환불 금액
          refundAmount,
          refundChips,
          feeAmount,
          feePercentage: usedChips > 0 ? REFUND_POLICY.partialRefundFee : REFUND_POLICY.fullRefundFee,

          // 환불 가능 여부
          isEligible: true,

          // 환불 제한
          monthlyRefundCount: eligibility.monthlyRefundCount,
          yearlyRefundCount: eligibility.yearlyRefundCount,

          // 타임스탬프
          requestedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info('환불 요청 생성 완료', { refundId });

        // 8. 토스페이먼츠 환불 API 호출 (실제 환불은 관리자 승인 후 처리)
        // 여기서는 환불 요청만 생성하고, 실제 환불은 별도의 관리자 승인 프로세스를 통해 처리
        // processRefundToToss 함수는 관리자가 승인할 때 호출됨

        return {
          success: true,
          refundId,
          refundAmount,
          feeAmount,
          message: '환불 요청이 접수되었습니다. 관리자 승인 후 처리됩니다.',
        };
      } catch (error: unknown) {
        logger.error('환불 처리 실패', { error });

        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        throw new functions.https.HttpsError(
          'internal',
          '환불 처리 중 오류가 발생했습니다.'
        );
      }
    }
  );

/**
 * 환불 가능 여부 검증
 */
async function checkRefundEligibility(
  userId: string,
  transaction: admin.firestore.DocumentData
): Promise<{
  isEligible: boolean;
  reason?: string;
  monthlyRefundCount: number;
  yearlyRefundCount: number;
}> {
  // 1. 블랙리스트 확인
  const blacklistDoc = await db
    .collection('refundBlacklist')
    .doc(userId)
    .get();

  if (blacklistDoc.exists) {
    return {
      isEligible: false,
      reason: '환불 블랙리스트에 등록되어 환불이 불가능합니다.',
      monthlyRefundCount: 0,
      yearlyRefundCount: 0,
    };
  }

  // 2. 구매일 확인 (7일 이내)
  const purchasedAt = transaction.createdAt?.toDate();
  if (!purchasedAt) {
    return {
      isEligible: false,
      reason: '결제 정보를 확인할 수 없습니다.',
      monthlyRefundCount: 0,
      yearlyRefundCount: 0,
    };
  }

  const daysSincePurchase = Math.floor(
    (Date.now() - purchasedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSincePurchase > REFUND_POLICY.eligibleDays) {
    return {
      isEligible: false,
      reason: `구매일로부터 ${REFUND_POLICY.eligibleDays}일이 경과하여 환불이 불가능합니다.`,
      monthlyRefundCount: 0,
      yearlyRefundCount: 0,
    };
  }

  // 3. 환불 횟수 확인
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // 이번 달 환불 횟수
  const monthlyRefundsSnapshot = await db
    .collection('refundRequests')
    .where('userId', '==', userId)
    .where('status', 'in', ['approved', 'completed'])
    .where('requestedAt', '>=', monthStart)
    .get();

  const monthlyRefundCount = monthlyRefundsSnapshot.size;

  if (monthlyRefundCount >= REFUND_POLICY.monthlyLimit) {
    return {
      isEligible: false,
      reason: `월 환불 한도(${REFUND_POLICY.monthlyLimit}회)를 초과했습니다.`,
      monthlyRefundCount,
      yearlyRefundCount: 0,
    };
  }

  // 올해 환불 횟수
  const yearlyRefundsSnapshot = await db
    .collection('refundRequests')
    .where('userId', '==', userId)
    .where('status', 'in', ['approved', 'completed'])
    .where('requestedAt', '>=', yearStart)
    .get();

  const yearlyRefundCount = yearlyRefundsSnapshot.size;

  if (yearlyRefundCount >= REFUND_POLICY.yearlyLimit) {
    return {
      isEligible: false,
      reason: `연 환불 한도(${REFUND_POLICY.yearlyLimit}회)를 초과했습니다.`,
      monthlyRefundCount,
      yearlyRefundCount,
    };
  }

  return {
    isEligible: true,
    monthlyRefundCount,
    yearlyRefundCount,
  };
}

/**
 * 사용한 칩 개수 조회
 */
async function getUsedChips(
  userId: string,
  transactionId: string
): Promise<number> {
  const transactionsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('chipTransactions')
    .where('metadata.transactionId', '==', transactionId)
    .where('type', '==', 'use')
    .get();

  let usedChips = 0;
  transactionsSnapshot.forEach((doc) => {
    const data = doc.data();
    usedChips += Math.abs(data.amount || 0);
  });

  return usedChips;
}

/**
 * 환불 금액 계산
 */
function calculateRefundAmount(
  purchasedAmount: number,
  purchasedChips: number,
  usedChips: number,
  remainingChips: number
): {
  refundAmount: number;
  feeAmount: number;
  refundChips: number;
} {
  // 칩당 가격
  const pricePerChip = purchasedAmount / purchasedChips;

  // 환불할 칩 금액
  const refundChipsValue = remainingChips * pricePerChip;

  // 수수료 계산 (사용한 칩이 있으면 20% 수수료)
  const feeRate = usedChips > 0 ? REFUND_POLICY.partialRefundFee : REFUND_POLICY.fullRefundFee;
  const feeAmount = Math.floor(refundChipsValue * feeRate);

  // 실제 환불 금액
  const refundAmount = Math.floor(refundChipsValue - feeAmount);

  return {
    refundAmount,
    feeAmount,
    refundChips: remainingChips,
  };
}

/**
 * 관리자 환불 승인 Cloud Function
 *
 * 관리자가 환불 요청을 승인하면 실제 토스페이먼츠 환불 API를 호출합니다.
 */
export const approveRefund = functions
  .region('asia-northeast3')
  .https.onCall(
    async (
      data: { refundId: string },
      context: functions.https.CallableContext
    ): Promise<RefundPaymentResponse> => {
      try {
        // 1. 관리자 권한 확인
        if (!context.auth) {
          throw new functions.https.HttpsError(
            'unauthenticated',
            '인증이 필요합니다.'
          );
        }

        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
          throw new functions.https.HttpsError(
            'permission-denied',
            '관리자만 환불을 승인할 수 있습니다.'
          );
        }

        const { refundId } = data;

        // 2. 환불 요청 조회
        const refundRequestRef = db.collection('refundRequests').doc(refundId);
        const refundRequestDoc = await refundRequestRef.get();

        if (!refundRequestDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            '환불 요청을 찾을 수 없습니다.'
          );
        }

        const refundRequest = refundRequestDoc.data()!;

        if (refundRequest.status !== 'pending') {
          throw new functions.https.HttpsError(
            'failed-precondition',
            '이미 처리된 환불 요청입니다.'
          );
        }

        // 3. 원 결제 트랜잭션 조회
        const transactionDoc = await db
          .collection('paymentTransactions')
          .doc(refundRequest.transactionId)
          .get();

        if (!transactionDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            '결제 내역을 찾을 수 없습니다.'
          );
        }

        const transaction = transactionDoc.data()!;

        // 4. 토스페이먼츠 환불 API 호출
        const tossResult = await processRefundToToss(
          transaction.paymentKey,
          refundRequest.refundAmount,
          refundRequest.reasonDetail
        );

        // 5. 트랜잭션 처리 (칩 회수 + 환불 기록)
        await db.runTransaction(async (t) => {
          // 5-1. 칩 잔액 차감
          const chipBalanceRef = db
            .collection('users')
            .doc(refundRequest.userId)
            .collection('chipBalance')
            .doc('current');

          const chipBalanceDoc = await t.get(chipBalanceRef);
          const chipBalance = chipBalanceDoc.data() || { redChips: 0 };

          const newRedChips = Math.max(0, chipBalance.redChips - refundRequest.refundChips);

          t.update(chipBalanceRef, {
            redChips: newRedChips,
            totalChips: FieldValue.increment(-refundRequest.refundChips),
            lastUpdatedAt: FieldValue.serverTimestamp(),
          });

          // 5-2. 칩 트랜잭션 기록
          const chipTransactionRef = db
            .collection('users')
            .doc(refundRequest.userId)
            .collection('chipTransactions')
            .doc();

          t.set(chipTransactionRef, {
            id: chipTransactionRef.id,
            userId: refundRequest.userId,
            type: 'refund',
            chipType: 'red',
            amount: -refundRequest.refundChips,
            balanceBefore: chipBalance.redChips,
            balanceAfter: newRedChips,
            description: `환불 처리 (수수료: ${refundRequest.feeAmount.toLocaleString()}원)`,
            metadata: {
              refundId,
              transactionId: refundRequest.transactionId,
            },
            createdAt: FieldValue.serverTimestamp(),
          });

          // 5-3. 환불 요청 상태 업데이트
          t.update(refundRequestRef, {
            status: 'completed',
            processedAt: FieldValue.serverTimestamp(),
            processedBy: context.auth!.uid,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            tossRefundData: tossResult,
          });
        });

        logger.info('환불 승인 완료', {
          refundId,
          userId: refundRequest.userId,
          refundAmount: refundRequest.refundAmount,
        });

        return {
          success: true,
          refundId,
          refundAmount: refundRequest.refundAmount,
          feeAmount: refundRequest.feeAmount,
          message: '환불이 완료되었습니다.',
        };
      } catch (error: unknown) {
        logger.error('환불 승인 실패', { error });

        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        throw new functions.https.HttpsError(
          'internal',
          '환불 승인 중 오류가 발생했습니다.'
        );
      }
    }
  );

/**
 * 토스페이먼츠 환불 API 호출
 */
async function processRefundToToss(
  paymentKey: string,
  cancelAmount: number,
  cancelReason: string
): Promise<TossRefundResponse> {
  const secretKey = functions.config().toss?.secret_key;

  if (!secretKey) {
    throw new Error('토스페이먼츠 Secret Key가 설정되지 않았습니다.');
  }

  const url = `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`;
  const auth = Buffer.from(`${secretKey}:`).toString('base64');

  const requestBody: TossRefundRequest = {
    cancelReason,
    cancelAmount,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    logger.error('토스페이먼츠 환불 API 실패', { errorData });
    throw new Error(`토스페이먼츠 환불 실패: ${errorData.message}`);
  }

  const result: TossRefundResponse = await response.json();

  logger.info('토스페이먼츠 환불 성공', {
    paymentKey,
    cancelAmount,
    status: result.status,
  });

  return result;
}

/**
 * 환불 거부 Cloud Function
 */
export const rejectRefund = functions
  .region('asia-northeast3')
  .https.onCall(
    async (
      data: { refundId: string; rejectionReason: string },
      context: functions.https.CallableContext
    ): Promise<{ success: boolean; message: string }> => {
      try {
        // 1. 관리자 권한 확인
        if (!context.auth) {
          throw new functions.https.HttpsError(
            'unauthenticated',
            '인증이 필요합니다.'
          );
        }

        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
          throw new functions.https.HttpsError(
            'permission-denied',
            '관리자만 환불을 거부할 수 있습니다.'
          );
        }

        const { refundId, rejectionReason } = data;

        // 2. 환불 요청 상태 업데이트
        await db
          .collection('refundRequests')
          .doc(refundId)
          .update({
            status: 'rejected',
            rejectedAt: FieldValue.serverTimestamp(),
            rejectedBy: context.auth.uid,
            rejectionReason,
            updatedAt: FieldValue.serverTimestamp(),
          });

        logger.info('환불 거부 완료', { refundId, rejectionReason });

        return {
          success: true,
          message: '환불 요청이 거부되었습니다.',
        };
      } catch (error: unknown) {
        logger.error('환불 거부 실패', { error });

        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        throw new functions.https.HttpsError(
          'internal',
          '환불 거부 중 오류가 발생했습니다.'
        );
      }
    }
  );
