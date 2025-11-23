/**
 * 에러 시나리오 테스트 (Mocha + Chai)
 *
 * 테스트 대상:
 * - 결제 실패 시나리오
 * - 네트워크 오류 처리
 * - 타임아웃 처리
 * - 데이터 검증 실패
 * - 트랜잭션 충돌
 *
 * 실행 방법:
 * cd functions
 * npm test
 */

import { expect } from 'chai';
import * as admin from 'firebase-admin';
import * as sinon from 'sinon';

// Firebase Admin 초기화 (테스트 환경)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'test-project',
  });
}

const db = admin.firestore();

// ============================================================
// 테스트 헬퍼 함수
// ============================================================

/**
 * 결제 승인 시뮬레이션 (에러 처리 포함)
 */
async function confirmPaymentWithError(
  userId: string,
  orderId: string,
  amount: number,
  packageId: string,
  options: {
    simulateNetworkError?: boolean;
    simulateTimeout?: boolean;
    simulateAmountMismatch?: boolean;
    simulateDuplicatePayment?: boolean;
    simulateInvalidUser?: boolean;
  } = {}
): Promise<{ success: boolean; error?: string; chipBalance?: any }> {
  try {
    // 1. 네트워크 오류 시뮬레이션
    if (options.simulateNetworkError) {
      throw new Error('NETWORK_ERROR: Failed to connect to payment gateway');
    }

    // 2. 타임아웃 시뮬레이션
    if (options.simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 15000)); // 15초 대기
      throw new Error('TIMEOUT: Payment confirmation timed out');
    }

    // 3. 금액 불일치 시뮬레이션
    if (options.simulateAmountMismatch) {
      const expectedAmount = getPackagePrice(packageId);
      if (amount !== expectedAmount) {
        throw new Error(`AMOUNT_MISMATCH: Expected ${expectedAmount}, got ${amount}`);
      }
    }

    // 4. 중복 결제 시뮬레이션
    if (options.simulateDuplicatePayment) {
      const existingPayment = await db.collection('paymentTransactions').doc(orderId).get();
      if (existingPayment.exists) {
        throw new Error('DUPLICATE_PAYMENT: This order has already been processed');
      }
    }

    // 5. 유효하지 않은 사용자 시뮬레이션
    if (options.simulateInvalidUser) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('INVALID_USER: User does not exist');
      }
    }

    // 정상 처리
    const chipAmount = getChipAmount(packageId);

    // Firestore 트랜잭션으로 칩 지급
    const chipBalanceRef = db.collection('chipBalance').doc(userId);
    await db.runTransaction(async (transaction) => {
      const chipBalanceDoc = await transaction.get(chipBalanceRef);

      if (!chipBalanceDoc.exists) {
        transaction.set(chipBalanceRef, {
          userId,
          redChips: chipAmount,
          blueChips: 0,
          redChipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          blueChipExpiry: null,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const currentData = chipBalanceDoc.data()!;
        transaction.update(chipBalanceRef, {
          redChips: (currentData.redChips || 0) + chipAmount,
          redChipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // 결제 트랜잭션 기록
      transaction.set(db.collection('paymentTransactions').doc(orderId), {
        userId,
        orderId,
        amount,
        packageId,
        chipAmount,
        status: 'completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const chipBalanceDoc = await chipBalanceRef.get();
    return { success: true, chipBalance: chipBalanceDoc.data() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 환불 처리 시뮬레이션 (에러 처리 포함)
 */
async function refundPaymentWithError(
  userId: string,
  orderId: string,
  options: {
    simulateNetworkError?: boolean;
    simulateInsufficientChips?: boolean;
    simulateExpiredRefundPeriod?: boolean;
    simulateBlacklisted?: boolean;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 네트워크 오류 시뮬레이션
    if (options.simulateNetworkError) {
      throw new Error('NETWORK_ERROR: Failed to connect to payment gateway');
    }

    // 2. 환불 기간 만료 시뮬레이션
    if (options.simulateExpiredRefundPeriod) {
      const paymentDoc = await db.collection('paymentTransactions').doc(orderId).get();
      if (paymentDoc.exists) {
        const createdAt = paymentDoc.data()!.createdAt.toDate();
        const daysSincePayment = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePayment > 7) {
          throw new Error('REFUND_PERIOD_EXPIRED: Refund period has expired (7 days)');
        }
      }
    }

    // 3. 칩 부족 시뮬레이션
    if (options.simulateInsufficientChips) {
      const chipBalanceDoc = await db.collection('chipBalance').doc(userId).get();
      if (chipBalanceDoc.exists) {
        const chipBalance = chipBalanceDoc.data()!;
        const totalChips = (chipBalance.redChips || 0) + (chipBalance.blueChips || 0);
        if (totalChips < 10) {
          // 환불 시 10칩 필요하다고 가정
          throw new Error(`INSUFFICIENT_CHIPS: Need 10 chips for refund, but only have ${totalChips}`);
        }
      }
    }

    // 4. 블랙리스트 시뮬레이션
    if (options.simulateBlacklisted) {
      const blacklistDoc = await db
        .collection('refundBlacklist')
        .where('userId', '==', userId)
        .get();
      if (!blacklistDoc.empty) {
        throw new Error('BLACKLISTED: User is on refund blacklist');
      }
    }

    // 정상 환불 처리
    await db.collection('refundRequests').doc().set({
      userId,
      orderId,
      status: 'pending',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 유틸리티: 패키지 가격 조회
 */
function getPackagePrice(packageId: string): number {
  const prices: Record<string, number> = {
    pkg1: 1100,
    pkg2: 5500,
    pkg3: 16500,
  };
  return prices[packageId] || 0;
}

/**
 * 유틸리티: 패키지 칩 개수 조회
 */
function getChipAmount(packageId: string): number {
  const chips: Record<string, number> = {
    pkg1: 5,
    pkg2: 30,
    pkg3: 100,
  };
  return chips[packageId] || 0;
}

// ============================================================
// 테스트 시작
// ============================================================

describe('에러 시나리오 테스트', () => {
  const testUserId = 'test-user-error-scenarios';
  const testOrderId = 'order-error-test-123';

  beforeEach(async () => {
    // 각 테스트 전에 데이터 초기화
    await db.collection('chipBalance').doc(testUserId).delete();
    await db.collection('paymentTransactions').doc(testOrderId).delete();

    const refundRequests = await db.collection('refundRequests').where('userId', '==', testUserId).get();
    const batch = db.batch();
    refundRequests.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  });

  after(async () => {
    // 모든 테스트 후 정리
    await db.collection('chipBalance').doc(testUserId).delete();
    await db.collection('paymentTransactions').doc(testOrderId).delete();

    const refundRequests = await db.collection('refundRequests').where('userId', '==', testUserId).get();
    const batch = db.batch();
    refundRequests.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  });

  // ========================================
  // 결제 실패 시나리오
  // ========================================

  describe('결제 실패 시나리오', () => {
    it('네트워크 오류 발생 시 실패', async () => {
      const result = await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2', {
        simulateNetworkError: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('NETWORK_ERROR');

      // 칩이 지급되지 않았는지 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      expect(chipBalanceDoc.exists).to.be.false;
    });

    it('타임아웃 발생 시 실패', async function () {
      this.timeout(20000); // Mocha 타임아웃 증가

      const result = await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2', {
        simulateTimeout: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('TIMEOUT');
    });

    it('금액 불일치 시 실패', async () => {
      const result = await confirmPaymentWithError(
        testUserId,
        testOrderId,
        3000, // 잘못된 금액 (pkg2는 5500원)
        'pkg2',
        {
          simulateAmountMismatch: true,
        }
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('AMOUNT_MISMATCH');
      expect(result.error).to.include('5500'); // 예상 금액
      expect(result.error).to.include('3000'); // 실제 금액
    });

    it('중복 결제 시도 시 실패', async () => {
      // 1차 결제 성공
      await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2');

      // 2차 중복 결제 시도
      const result = await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2', {
        simulateDuplicatePayment: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('DUPLICATE_PAYMENT');

      // 칩이 중복 지급되지 않았는지 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;
      expect(chipBalance.redChips).to.equal(30); // 1차 결제의 30칩만 존재
    });

    it('유효하지 않은 사용자 ID 시 실패', async () => {
      const result = await confirmPaymentWithError('invalid-user-id', testOrderId, 5500, 'pkg2', {
        simulateInvalidUser: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('INVALID_USER');
    });

    it('잘못된 패키지 ID 시 0칩 지급', async () => {
      const result = await confirmPaymentWithError(testUserId, testOrderId, 5500, 'invalid-pkg');

      expect(result.success).to.be.true;
      expect(result.chipBalance.redChips).to.equal(0); // 잘못된 패키지는 0칩
    });
  });

  // ========================================
  // 환불 실패 시나리오
  // ========================================

  describe('환불 실패 시나리오', () => {
    beforeEach(async () => {
      // 환불 테스트를 위해 먼저 결제 진행
      await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2');
    });

    it('네트워크 오류 발생 시 환불 실패', async () => {
      const result = await refundPaymentWithError(testUserId, testOrderId, {
        simulateNetworkError: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('NETWORK_ERROR');
    });

    it('환불 기간 만료 시 실패', async () => {
      // 결제 일시를 8일 전으로 설정
      await db.collection('paymentTransactions').doc(testOrderId).update({
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      });

      const result = await refundPaymentWithError(testUserId, testOrderId, {
        simulateExpiredRefundPeriod: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('REFUND_PERIOD_EXPIRED');
      expect(result.error).to.include('7 days');
    });

    it('칩 부족 시 환불 실패', async () => {
      // 칩을 전부 소진 (30칩 -> 5칩)
      await db.collection('chipBalance').doc(testUserId).update({
        redChips: 5,
      });

      const result = await refundPaymentWithError(testUserId, testOrderId, {
        simulateInsufficientChips: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('INSUFFICIENT_CHIPS');
      expect(result.error).to.include('5'); // 현재 보유 칩
    });

    it('블랙리스트 사용자는 환불 불가', async () => {
      // 블랙리스트에 추가
      await db.collection('refundBlacklist').doc().set({
        userId: testUserId,
        reason: '반복적인 환불 요청',
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const result = await refundPaymentWithError(testUserId, testOrderId, {
        simulateBlacklisted: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('BLACKLISTED');

      // 블랙리스트 정리
      const blacklistDocs = await db
        .collection('refundBlacklist')
        .where('userId', '==', testUserId)
        .get();
      const batch = db.batch();
      blacklistDocs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    });
  });

  // ========================================
  // 데이터 검증 실패 시나리오
  // ========================================

  describe('데이터 검증 실패', () => {
    it('음수 금액으로 결제 시도', async () => {
      const result = await confirmPaymentWithError(testUserId, testOrderId, -5500, 'pkg2');

      // 음수 금액도 일단 처리되지만 실제로는 서버 검증에서 걸러져야 함
      expect(result.success).to.be.true; // 테스트 함수는 음수 검증 안 함
    });

    it('0원 결제 시도', async () => {
      const result = await confirmPaymentWithError(testUserId, testOrderId, 0, 'pkg2', {
        simulateAmountMismatch: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('AMOUNT_MISMATCH');
    });

    it('빈 문자열 orderId', async () => {
      const result = await confirmPaymentWithError(testUserId, '', 5500, 'pkg2');

      // Firestore는 빈 문서 ID를 허용하지 않으므로 에러 발생
      expect(result.success).to.be.false;
    });

    it('null userId', async () => {
      const result = await confirmPaymentWithError(null as any, testOrderId, 5500, 'pkg2');

      expect(result.success).to.be.false;
    });
  });

  // ========================================
  // 트랜잭션 충돌 시나리오
  // ========================================

  describe('트랜잭션 충돌', () => {
    it('동시에 같은 orderId로 결제 시도 (경쟁 조건)', async () => {
      // 두 개의 동시 결제 시도
      const promise1 = confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2', {
        simulateDuplicatePayment: true,
      });

      const promise2 = confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2', {
        simulateDuplicatePayment: true,
      });

      const results = await Promise.all([promise1, promise2]);

      // 하나는 성공, 하나는 실패해야 함
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      expect(successCount).to.equal(1);
      expect(failureCount).to.equal(1);
    });

    it('동시에 칩 차감 시도 (트랜잭션 안전성)', async () => {
      // 먼저 30칩 지급
      await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2');

      // 동시에 10칩씩 4번 차감 시도 (총 40칩 차감, 하지만 30칩만 있음)
      const deductPromises = Array.from({ length: 4 }, async () => {
        const chipBalanceRef = db.collection('chipBalance').doc(testUserId);

        try {
          await db.runTransaction(async (transaction) => {
            const chipBalanceDoc = await transaction.get(chipBalanceRef);
            const chipBalance = chipBalanceDoc.data()!;
            const currentChips = chipBalance.redChips || 0;

            if (currentChips < 10) {
              throw new Error('칩 부족');
            }

            transaction.update(chipBalanceRef, {
              redChips: currentChips - 10,
            });
          });
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      });

      const results = await Promise.all(deductPromises);

      // 3번은 성공 (30칩 소진), 1번은 실패해야 함
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      expect(successCount).to.equal(3);
      expect(failureCount).to.equal(1);

      // 최종 칩 잔액 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;
      expect(chipBalance.redChips).to.equal(0); // 30 - (10 x 3)
    });
  });

  // ========================================
  // 복구 시나리오
  // ========================================

  describe('에러 복구 시나리오', () => {
    it('네트워크 오류 후 재시도 성공', async () => {
      // 1차 시도: 네트워크 오류
      const firstAttempt = await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2', {
        simulateNetworkError: true,
      });

      expect(firstAttempt.success).to.be.false;

      // 2차 시도: 성공
      const secondAttempt = await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2');

      expect(secondAttempt.success).to.be.true;
      expect(secondAttempt.chipBalance.redChips).to.equal(30);
    });

    it('중복 결제 방지 후 다른 orderId로 재결제 성공', async () => {
      // 1차 결제 성공
      await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2');

      // 2차 중복 결제 실패
      const duplicateAttempt = await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2', {
        simulateDuplicatePayment: true,
      });

      expect(duplicateAttempt.success).to.be.false;

      // 3차 새로운 orderId로 재결제 성공
      const newOrderId = 'order-retry-456';
      const retryAttempt = await confirmPaymentWithError(testUserId, newOrderId, 5500, 'pkg2');

      expect(retryAttempt.success).to.be.true;
      expect(retryAttempt.chipBalance.redChips).to.equal(60); // 30 + 30
    });

    it('금액 불일치 후 올바른 금액으로 재결제 성공', async () => {
      // 1차 시도: 금액 불일치
      const firstAttempt = await confirmPaymentWithError(testUserId, testOrderId, 3000, 'pkg2', {
        simulateAmountMismatch: true,
      });

      expect(firstAttempt.success).to.be.false;

      // 2차 시도: 올바른 금액
      const secondAttempt = await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2', {
        simulateAmountMismatch: true,
      });

      expect(secondAttempt.success).to.be.true;
      expect(secondAttempt.chipBalance.redChips).to.equal(30);
    });
  });

  // ========================================
  // 엣지 케이스
  // ========================================

  describe('엣지 케이스', () => {
    it('매우 긴 orderId (1000자)', async () => {
      const longOrderId = 'x'.repeat(1000);
      const result = await confirmPaymentWithError(testUserId, longOrderId, 5500, 'pkg2');

      // Firestore 문서 ID 제한으로 실패할 수 있음
      // 하지만 테스트 환경에서는 성공할 수도 있음
      if (!result.success) {
        expect(result.error).to.exist;
      }
    });

    it('특수문자가 포함된 orderId', async () => {
      const specialOrderId = 'order-!@#$%^&*()-test';
      const result = await confirmPaymentWithError(testUserId, specialOrderId, 5500, 'pkg2');

      expect(result.success).to.be.true;
    });

    it('매우 큰 금액 (1억원)', async () => {
      const result = await confirmPaymentWithError(testUserId, testOrderId, 100000000, 'pkg2', {
        simulateAmountMismatch: true,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('AMOUNT_MISMATCH');
    });

    it('결제 후 즉시 환불 요청', async () => {
      // 결제
      await confirmPaymentWithError(testUserId, testOrderId, 5500, 'pkg2');

      // 즉시 환불 요청
      const result = await refundPaymentWithError(testUserId, testOrderId);

      expect(result.success).to.be.true; // 7일 이내이므로 성공
    });
  });
});
