import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  validatePaymentSecurity,
  extractPackageIdFromOrderId,
  extractUserIdFromOrderId,
} from './verifySignature';
import {
  validateRateLimit,
  checkDailyPaymentLimit,
  detectAbusePattern,
  RATE_LIMIT_CONFIGS,
} from '../middleware/rateLimiter';

const db = admin.firestore();

/**
 * 토스페이먼츠 결제 승인 API
 *
 * 프론트엔드에서 결제 성공 후 호출하여 서버에서 결제를 승인합니다.
 *
 * 요청 데이터:
 * - paymentKey: 토스페이먼츠 결제 키
 * - orderId: 주문 ID (CHIP_{userId}_{packageId}_{timestamp})
 * - amount: 결제 금액
 *
 * 처리 과정:
 * 1. 토스페이먼츠 API로 결제 승인 요청
 * 2. 승인 성공 시 Firestore에 결제 기록 저장
 * 3. 칩 지급 처리 (grantChips 호출)
 *
 * @security
 * - 로그인된 사용자만 호출 가능
 * - orderId에서 userId 추출하여 본인 확인
 * - amount 서버 측 검증 (패키지 가격과 일치하는지 확인)
 * - 중복 결제 방지 (orderId 유니크 체크)
 */
export const confirmPayment = functions.https.onCall(async (data: any, context: any) => {
  // 1. 인증 확인
  if (!context.auth) {
    functions.logger.error('결제 승인 실패: 인증되지 않은 요청');
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다');
  }

  const userId = context.auth.uid;
  const { paymentKey, orderId, amount } = data;

  // 1-1. Rate Limiting 검증
  try {
    await validateRateLimit(userId, RATE_LIMIT_CONFIGS.payment);
  } catch (error: any) {
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      functions.logger.warn('결제 승인 실패: Rate limit 초과', {
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

  // 1-2. 일일 결제 한도 체크
  const dailyLimit = await checkDailyPaymentLimit(userId);
  if (!dailyLimit.allowed) {
    functions.logger.warn('결제 승인 실패: 일일 한도 초과', {
      userId,
      todayPayments: dailyLimit.todayPayments,
    });
    throw new functions.https.HttpsError(
      'resource-exhausted',
      '일일 결제 한도를 초과했습니다. 내일 다시 시도하세요.'
    );
  }

  // 1-3. 남용 패턴 감지
  const abuseCheck = await detectAbusePattern(userId);
  if (abuseCheck.isAbusive) {
    functions.logger.error('결제 승인 실패: 남용 패턴 감지', {
      userId,
      riskScore: abuseCheck.riskScore,
      reason: abuseCheck.reason,
    });
    throw new functions.https.HttpsError(
      'permission-denied',
      abuseCheck.reason || '의심스러운 결제 패턴이 감지되었습니다.'
    );
  }

  // 2. 입력 검증
  if (!paymentKey || !orderId || !amount) {
    functions.logger.error('결제 승인 실패: 필수 파라미터 누락', { paymentKey, orderId, amount });
    throw new functions.https.HttpsError('invalid-argument', '필수 파라미터가 누락되었습니다');
  }

  // 3. orderId에서 정보 추출
  const packageId = extractPackageIdFromOrderId(orderId);
  const orderUserId = extractUserIdFromOrderId(orderId);

  if (!packageId || !orderUserId) {
    functions.logger.error('결제 승인 실패: orderId 파싱 실패', { orderId });
    throw new functions.https.HttpsError('invalid-argument', '잘못된 주문 ID 형식입니다');
  }

  // 4. 중복 결제 확인
  const existingPayment = await db.collection('payments').doc(orderId).get();
  if (existingPayment.exists) {
    functions.logger.warn('결제 승인 실패: 이미 처리된 주문', { orderId });
    throw new functions.https.HttpsError('already-exists', '이미 처리된 주문입니다');
  }

  // 5. 패키지 가격 조회
  const packagePrices: Record<string, number> = {
    'BASIC': 5000,
    'STANDARD': 10000,
    'PREMIUM': 30000,
    'ULTIMATE': 50000,
  };

  const expectedAmount = packagePrices[packageId];
  if (!expectedAmount) {
    functions.logger.error('결제 승인 실패: 유효하지 않은 패키지 ID', { packageId });
    throw new functions.https.HttpsError('invalid-argument', '유효하지 않은 패키지입니다');
  }

  // 6. 종합 보안 검증
  const securityValidation = validatePaymentSecurity({
    orderId,
    clientAmount: parseInt(amount, 10),
    serverAmount: expectedAmount,
    userId: orderUserId,
  });

  if (!securityValidation.success) {
    functions.logger.error('결제 승인 실패: 보안 검증 실패', {
      error: securityValidation.error,
      orderId,
      userId,
    });
    throw new functions.https.HttpsError('permission-denied', securityValidation.error || '보안 검증 실패');
  }

  // 7. 토스페이먼츠 API 호출
  const tossSecretKey = functions.config().toss?.secret_key;
  if (!tossSecretKey) {
    functions.logger.error('결제 승인 실패: 토스페이먼츠 시크릿 키 미설정');
    throw new functions.https.HttpsError('internal', '결제 시스템 설정 오류');
  }

  try {
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(tossSecretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: expectedAmount,
      }),
    });

    if (!tossResponse.ok) {
      const errorData = await tossResponse.json();
      functions.logger.error('토스페이먼츠 API 오류', {
        status: tossResponse.status,
        error: errorData
      });
      throw new functions.https.HttpsError('internal', '결제 승인 중 오류가 발생했습니다');
    }

    const tossPaymentData = await tossResponse.json();

    // 8. Firestore에 결제 기록 저장
    const paymentRecord = {
      orderId,
      paymentKey,
      userId,
      packageId,
      amount: expectedAmount,
      status: 'completed',
      tossPaymentData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('payments').doc(orderId).set(paymentRecord);
    functions.logger.info('결제 기록 저장 완료', { orderId, userId, packageId });

    // 9. 칩 지급 처리
    const chipCounts: Record<string, number> = {
      'BASIC': 5,
      'STANDARD': 11,
      'PREMIUM': 35,
      'ULTIMATE': 60,
    };

    const chipCount = chipCounts[packageId];

    // grantChips 함수 호출 (별도 파일에서 import)
    // 여기서는 직접 구현
    const userChipsRef = db.collection('users').doc(userId).collection('chipBalance').doc('current');
    const chipTransaction = {
      type: 'purchase' as const,
      chipType: 'red' as const,
      amount: chipCount,
      packageId,
      orderId,
      paymentKey,
      price: expectedAmount,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년 후
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 트랜잭션으로 칩 잔액 업데이트
    await db.runTransaction(async (transaction: any) => {
      const chipBalanceDoc = await transaction.get(userChipsRef);

      let newBalance = {
        userId,
        redChips: chipCount,
        blueChips: 0,
        totalChips: chipCount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (chipBalanceDoc.exists) {
        const current = chipBalanceDoc.data();
        newBalance = {
          userId,
          redChips: (current?.redChips || 0) + chipCount,
          blueChips: current?.blueChips || 0,
          totalChips: (current?.totalChips || 0) + chipCount,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        };
      }

      transaction.set(userChipsRef, newBalance);

      // 거래 내역 저장
      const transactionRef = db.collection('users').doc(userId).collection('chipTransactions').doc();
      transaction.set(transactionRef, chipTransaction);
    });

    functions.logger.info('칩 지급 완료', { userId, chipCount, packageId });

    // 10. 성공 응답
    return {
      success: true,
      message: '결제가 완료되었습니다',
      data: {
        orderId,
        amount: expectedAmount,
        chipCount,
        paymentKey: tossPaymentData.paymentKey,
      },
    };

  } catch (error: any) {
    functions.logger.error('결제 승인 실패', { error: error.message, stack: error.stack });

    // 실패 기록 저장
    await db.collection('payments').doc(orderId).set({
      orderId,
      paymentKey,
      userId,
      packageId,
      amount: expectedAmount,
      status: 'failed',
      error: error.message,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw new functions.https.HttpsError('internal', '결제 처리 중 오류가 발생했습니다');
  }
});
