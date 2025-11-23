import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 칩 지급 타입
 */
export type ChipGrantType = 'purchase' | 'subscription' | 'bonus' | 'refund';

/**
 * 칩 타입
 */
export type ChipType = 'red' | 'blue';

/**
 * 칩 지급 요청 데이터
 */
export interface GrantChipsRequest {
  userId: string;
  chipType: ChipType;
  amount: number;
  grantType: ChipGrantType;
  metadata?: {
    orderId?: string;
    paymentKey?: string;
    packageId?: string;
    price?: number;
    subscriptionId?: string;
    reason?: string;
  };
}

/**
 * 칩 지급 함수
 *
 * Firestore 트랜잭션을 사용하여 안전하게 칩을 지급합니다.
 *
 * 처리 과정:
 * 1. 칩 잔액 조회 (없으면 생성)
 * 2. 칩 타입에 따라 만료일 설정
 *    - 빨간칩: 1년 후
 *    - 파란칩: 다음 달 1일 00:00:00
 * 3. 트랜잭션으로 잔액 업데이트 및 거래 내역 저장
 * 4. 알림 발송 (선택적)
 *
 * @param request 칩 지급 요청 데이터
 * @returns 업데이트된 칩 잔액
 */
export async function grantChips(request: GrantChipsRequest) {
  const { userId, chipType, amount, grantType, metadata = {} } = request;

  // 1. 입력 검증
  if (!userId || !chipType || amount <= 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '유효하지 않은 칩 지급 요청입니다'
    );
  }

  // 2. 만료일 계산
  let expiryDate: Date;
  if (chipType === 'red') {
    // 빨간칩: 1년 후
    expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  } else {
    // 파란칩: 다음 달 1일 00:00:00
    const now = new Date();
    expiryDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  }

  // 3. Firestore 참조
  const userChipsRef = db.collection('users').doc(userId).collection('chipBalance').doc('current');
  const transactionRef = db.collection('users').doc(userId).collection('chipTransactions').doc();

  try {
    // 4. 트랜잭션 실행
    const result = await db.runTransaction(async (transaction: any) => {
      const chipBalanceDoc = await transaction.get(userChipsRef);

      // 현재 잔액 조회
      let currentBalance = {
        redChips: 0,
        blueChips: 0,
        totalChips: 0,
      };

      if (chipBalanceDoc.exists) {
        const data = chipBalanceDoc.data();
        currentBalance = {
          redChips: data?.redChips || 0,
          blueChips: data?.blueChips || 0,
          totalChips: data?.totalChips || 0,
        };
      }

      // 새로운 잔액 계산
      const newBalance = {
        userId,
        redChips: chipType === 'red'
          ? currentBalance.redChips + amount
          : currentBalance.redChips,
        blueChips: chipType === 'blue'
          ? currentBalance.blueChips + amount
          : currentBalance.blueChips,
        totalChips: currentBalance.totalChips + amount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 거래 내역 데이터
      const chipTransaction = {
        userId,
        type: grantType,
        chipType,
        amount,
        expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
        ...metadata,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 잔액 업데이트
      transaction.set(userChipsRef, newBalance);

      // 거래 내역 저장
      transaction.set(transactionRef, chipTransaction);

      return newBalance;
    });

    functions.logger.info('칩 지급 완료', {
      userId,
      chipType,
      amount,
      grantType,
      newBalance: result,
    });

    return result;

  } catch (error: any) {
    functions.logger.error('칩 지급 실패', {
      userId,
      chipType,
      amount,
      error: error.message,
    });
    throw new functions.https.HttpsError('internal', '칩 지급 중 오류가 발생했습니다');
  }
}

/**
 * 칩 차감 함수
 *
 * Firestore 트랜잭션을 사용하여 안전하게 칩을 차감합니다.
 *
 * 차감 우선순위:
 * 1. 파란칩 (만료일이 빠른 것부터)
 * 2. 빨간칩 (만료일이 빠른 것부터)
 *
 * @param userId 사용자 ID
 * @param amount 차감할 칩 개수
 * @param reason 차감 사유
 * @returns 업데이트된 칩 잔액
 */
export async function deductChips(
  userId: string,
  amount: number,
  reason: string
) {
  if (!userId || amount <= 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '유효하지 않은 칩 차감 요청입니다'
    );
  }

  const userChipsRef = db.collection('users').doc(userId).collection('chipBalance').doc('current');
  const transactionRef = db.collection('users').doc(userId).collection('chipTransactions').doc();

  try {
    const result = await db.runTransaction(async (transaction: any) => {
      const chipBalanceDoc = await transaction.get(userChipsRef);

      if (!chipBalanceDoc.exists) {
        throw new functions.https.HttpsError('not-found', '칩 잔액을 찾을 수 없습니다');
      }

      const currentBalance = chipBalanceDoc.data();
      const totalChips = currentBalance?.totalChips || 0;

      // 잔액 부족 확인
      if (totalChips < amount) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          '칩 잔액이 부족합니다'
        );
      }

      let remainingAmount = amount;
      let blueChipsDeducted = 0;
      let redChipsDeducted = 0;

      // 1. 파란칩 차감
      const blueChips = currentBalance?.blueChips || 0;
      if (blueChips > 0 && remainingAmount > 0) {
        blueChipsDeducted = Math.min(blueChips, remainingAmount);
        remainingAmount -= blueChipsDeducted;
      }

      // 2. 빨간칩 차감
      const redChips = currentBalance?.redChips || 0;
      if (redChips > 0 && remainingAmount > 0) {
        redChipsDeducted = Math.min(redChips, remainingAmount);
        remainingAmount -= redChipsDeducted;
      }

      // 새로운 잔액
      const newBalance = {
        userId,
        redChips: redChips - redChipsDeducted,
        blueChips: blueChips - blueChipsDeducted,
        totalChips: totalChips - amount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 거래 내역
      const chipTransaction = {
        userId,
        type: 'usage' as const,
        amount: -amount,
        blueChipsUsed: blueChipsDeducted,
        redChipsUsed: redChipsDeducted,
        reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 업데이트
      transaction.set(userChipsRef, newBalance);
      transaction.set(transactionRef, chipTransaction);

      return newBalance;
    });

    functions.logger.info('칩 차감 완료', {
      userId,
      amount,
      reason,
      newBalance: result,
    });

    return result;

  } catch (error: any) {
    functions.logger.error('칩 차감 실패', {
      userId,
      amount,
      reason,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 칩 지급 Cloud Function (테스트/관리자용)
 *
 * 관리자가 수동으로 칩을 지급할 때 사용합니다.
 */
export const manualGrantChips = functions.https.onCall(async (data: any, context: any) => {
  // 관리자 권한 확인
  if (context.auth?.token?.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      '관리자만 수동 칩 지급이 가능합니다'
    );
  }

  const { userId, chipType, amount, reason } = data;

  if (!userId || !chipType || !amount || amount <= 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '필수 파라미터가 누락되었거나 유효하지 않습니다'
    );
  }

  const result = await grantChips({
    userId,
    chipType,
    amount,
    grantType: 'bonus',
    metadata: {
      reason: reason || '관리자 지급',
    },
  });

  return {
    success: true,
    message: `${chipType === 'red' ? '빨간' : '파란'}칩 ${amount}개가 지급되었습니다`,
    data: result,
  };
});
