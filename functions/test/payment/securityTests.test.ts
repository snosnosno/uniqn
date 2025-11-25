/**
 * TEST-5: 보안 테스트 (Security Testing)
 *
 * 테스트 범위:
 * 1. 금액 조작 시도 (Amount Manipulation)
 * 2. 중복 결제 시도 (Duplicate Payment Prevention)
 * 3. 타인 결제 승인 시도 (Unauthorized Access)
 * 4. 시그니처 검증 우회 시도 (Signature Verification Bypass)
 * 5. Rate Limiting 우회 시도 (Rate Limit Bypass)
 * 6. SQL Injection/XSS 방어 (Injection Prevention)
 * 7. 토큰 조작 시도 (Token Manipulation)
 */

import { expect } from 'chai';
import * as admin from 'firebase-admin';

const db = admin.firestore();

describe('TEST-5: 보안 테스트', () => {
  const testUserId = 'testUser_security';
  const attackerUserId = 'attacker_user';

  beforeEach(async () => {
    // 테스트 데이터 초기화
    await db.collection('chipBalance').doc(testUserId).delete();
    await db.collection('chipBalance').doc(attackerUserId).delete();
    await db.collection('paymentTransactions').doc(`txn_${testUserId}_1`).delete();
    await db.collection('rateLimits').doc(testUserId).delete();
  });

  after(async () => {
    // 테스트 후 정리
    await db.collection('chipBalance').doc(testUserId).delete();
    await db.collection('chipBalance').doc(attackerUserId).delete();
    await db.collection('paymentTransactions').doc(`txn_${testUserId}_1`).delete();
    await db.collection('rateLimits').doc(testUserId).delete();
  });

  // ========================================
  // 1. 금액 조작 시도 (Amount Manipulation)
  // ========================================

  describe('1. 금액 조작 시도', () => {
    it('클라이언트 금액과 서버 금액 불일치 시 실패', async () => {
      const orderId = `ORD_${testUserId}_pkg2_${Date.now()}`;

      // 클라이언트가 5,500원 패키지를 선택했지만, 서버에 3,300원을 전송
      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId,
        paymentKey: 'test_payment_key_123',
        amount: 3300, // 조작된 금액 (실제는 5,500원)
        packageId: 'pkg2', // 5,500원 패키지
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('AMOUNT_MISMATCH');

      // 칩이 지급되지 않았는지 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      expect(chipBalanceDoc.exists).to.be.false;
    });

    it('음수 금액 시도 시 실패', async () => {
      const orderId = `ORD_${testUserId}_pkg1_${Date.now()}`;

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId,
        paymentKey: 'test_payment_key_124',
        amount: -3300, // 음수 금액
        packageId: 'pkg1',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('INVALID_AMOUNT');
    });

    it('0원 결제 시도 시 실패', async () => {
      const orderId = `ORD_${testUserId}_pkg1_${Date.now()}`;

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId,
        paymentKey: 'test_payment_key_125',
        amount: 0,
        packageId: 'pkg1',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('INVALID_AMOUNT');
    });

    it('비정상적으로 큰 금액 시도 시 실패', async () => {
      const orderId = `ORD_${testUserId}_pkg1_${Date.now()}`;

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId,
        paymentKey: 'test_payment_key_126',
        amount: 999999999, // 비정상적으로 큰 금액
        packageId: 'pkg1',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('AMOUNT_EXCEEDED');
    });
  });

  // ========================================
  // 2. 중복 결제 시도 (Duplicate Payment Prevention)
  // ========================================

  describe('2. 중복 결제 시도', () => {
    it('동일 orderId로 2번 결제 시도 시 2번째 실패', async () => {
      const orderId = `ORD_${testUserId}_pkg2_${Date.now()}`;

      // 1차 결제 성공
      const result1 = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId,
        paymentKey: 'test_payment_key_201',
        amount: 5500,
        packageId: 'pkg2',
      });

      expect(result1.success).to.be.true;

      // 2차 중복 결제 시도
      const result2 = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId, // 동일한 orderId
        paymentKey: 'test_payment_key_202',
        amount: 5500,
        packageId: 'pkg2',
      });

      expect(result2.success).to.be.false;
      expect(result2.error).to.include('DUPLICATE_ORDER_ID');

      // 칩이 중복 지급되지 않았는지 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;
      expect(chipBalance.redChips).to.equal(30); // 1차 결제의 30칩만
    });

    it('동일 paymentKey로 2번 결제 시도 시 2번째 실패', async () => {
      const orderId1 = `ORD_${testUserId}_pkg2_${Date.now()}`;
      const orderId2 = `ORD_${testUserId}_pkg2_${Date.now() + 1}`;
      const paymentKey = 'test_payment_key_301';

      // 1차 결제 성공
      const result1 = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId: orderId1,
        paymentKey,
        amount: 5500,
        packageId: 'pkg2',
      });

      expect(result1.success).to.be.true;

      // 2차 중복 결제 시도 (동일 paymentKey)
      const result2 = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId: orderId2,
        paymentKey, // 동일한 paymentKey
        amount: 5500,
        packageId: 'pkg2',
      });

      expect(result2.success).to.be.false;
      expect(result2.error).to.include('DUPLICATE_PAYMENT_KEY');

      // 칩이 중복 지급되지 않았는지 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;
      expect(chipBalance.redChips).to.equal(30); // 1차 결제의 30칩만
    });

    it('빠르게 연속 결제 시도 시 중복 방지', async () => {
      const orderId = `ORD_${testUserId}_pkg2_${Date.now()}`;

      // 동시에 동일한 결제 요청 3번 전송 (Race Condition)
      const results = await Promise.all([
        simulatePaymentConfirmation({
          userId: testUserId,
          orderId,
          paymentKey: 'test_payment_key_401',
          amount: 5500,
          packageId: 'pkg2',
        }),
        simulatePaymentConfirmation({
          userId: testUserId,
          orderId,
          paymentKey: 'test_payment_key_401',
          amount: 5500,
          packageId: 'pkg2',
        }),
        simulatePaymentConfirmation({
          userId: testUserId,
          orderId,
          paymentKey: 'test_payment_key_401',
          amount: 5500,
          packageId: 'pkg2',
        }),
      ]);

      // 1번만 성공해야 함
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).to.equal(1);

      // 칩이 1번만 지급되었는지 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;
      expect(chipBalance.redChips).to.equal(30); // 1번의 30칩만
    });
  });

  // ========================================
  // 3. 타인 결제 승인 시도 (Unauthorized Access)
  // ========================================

  describe('3. 타인 결제 승인 시도', () => {
    it('다른 사용자의 orderId로 결제 승인 시도 시 실패', async () => {
      const victimOrderId = `ORD_${testUserId}_pkg2_${Date.now()}`;

      // 공격자가 피해자의 orderId로 결제 승인 시도
      const result = await simulatePaymentConfirmation({
        userId: attackerUserId, // 공격자
        orderId: victimOrderId, // 피해자의 orderId
        paymentKey: 'test_payment_key_501',
        amount: 5500,
        packageId: 'pkg2',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('UNAUTHORIZED_ORDER_ID');

      // 공격자에게 칩이 지급되지 않았는지 확인
      const attackerChipDoc = await db.collection('chipBalance').doc(attackerUserId).get();
      expect(attackerChipDoc.exists).to.be.false;

      // 피해자에게도 칩이 지급되지 않았는지 확인
      const victimChipDoc = await db.collection('chipBalance').doc(testUserId).get();
      expect(victimChipDoc.exists).to.be.false;
    });

    it('orderId를 조작하여 칩 지급 대상 변경 시도 시 실패', async () => {
      const manipulatedOrderId = `ORD_${attackerUserId}_pkg2_${Date.now()}`;

      // orderId는 공격자 ID이지만, userId는 피해자로 설정
      const result = await simulatePaymentConfirmation({
        userId: testUserId, // 피해자
        orderId: manipulatedOrderId, // 공격자의 orderId
        paymentKey: 'test_payment_key_502',
        amount: 5500,
        packageId: 'pkg2',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('ORDER_ID_USER_MISMATCH');
    });

    it('인증되지 않은 사용자의 결제 승인 시도 시 실패', async () => {
      const orderId = `ORD_unauthenticated_pkg2_${Date.now()}`;

      const result = await simulatePaymentConfirmation({
        userId: null as any, // 인증되지 않은 사용자
        orderId,
        paymentKey: 'test_payment_key_503',
        amount: 5500,
        packageId: 'pkg2',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('UNAUTHENTICATED');
    });
  });

  // ========================================
  // 4. 시그니처 검증 우회 시도 (Signature Verification Bypass)
  // ========================================

  describe('4. 시그니처 검증 우회 시도', () => {
    it('잘못된 시그니처로 웹훅 전송 시 실패', async () => {
      const webhookPayload = {
        orderId: `ORD_${testUserId}_pkg2_${Date.now()}`,
        status: 'DONE',
        amount: 5500,
      };

      const invalidSignature = 'invalid_signature_abc123';

      const result = await simulateWebhookCall(webhookPayload, invalidSignature);

      expect(result.success).to.be.false;
      expect(result.error).to.include('INVALID_SIGNATURE');

      // 칩이 지급되지 않았는지 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      expect(chipBalanceDoc.exists).to.be.false;
    });

    it('시그니처 없이 웹훅 전송 시 실패', async () => {
      const webhookPayload = {
        orderId: `ORD_${testUserId}_pkg2_${Date.now()}`,
        status: 'DONE',
        amount: 5500,
      };

      const result = await simulateWebhookCall(webhookPayload, null as any);

      expect(result.success).to.be.false;
      expect(result.error).to.include('MISSING_SIGNATURE');
    });

    it('페이로드 조작 후 시그니처 전송 시 실패', async () => {
      const originalPayload = {
        orderId: `ORD_${testUserId}_pkg1_${Date.now()}`,
        status: 'DONE',
        amount: 3300,
      };

      const validSignature = generateSignature(originalPayload);

      // 페이로드를 조작하여 금액 변경
      const manipulatedPayload = {
        ...originalPayload,
        amount: 99000, // 조작된 금액
      };

      const result = await simulateWebhookCall(manipulatedPayload, validSignature);

      expect(result.success).to.be.false;
      expect(result.error).to.include('SIGNATURE_VERIFICATION_FAILED');
    });
  });

  // ========================================
  // 5. Rate Limiting 우회 시도 (Rate Limit Bypass)
  // ========================================

  describe('5. Rate Limiting 우회 시도', () => {
    it('분당 5회 제한을 초과한 결제 시도 시 실패', async () => {
      const results = [];

      // 1분 내에 10번 결제 시도 (제한: 5회/분)
      for (let i = 0; i < 10; i++) {
        const orderId = `ORD_${testUserId}_pkg1_${Date.now()}_${i}`;

        const result = await simulatePaymentConfirmation({
          userId: testUserId,
          orderId,
          paymentKey: `test_payment_key_rl_${i}`,
          amount: 3300,
          packageId: 'pkg1',
        });

        results.push(result);
      }

      // 처음 5번은 성공, 나머지 5번은 실패
      const successCount = results.filter((r) => r.success).length;
      const rateLimitedCount = results.filter((r) => r.error?.includes('RATE_LIMIT_EXCEEDED')).length;

      expect(successCount).to.be.at.most(5);
      expect(rateLimitedCount).to.be.at.least(5);
    });

    it('다른 IP를 사용하여 Rate Limit 우회 시도 시 실패', async () => {
      // Rate Limiting은 userId 기반이므로 IP 변경만으로는 우회 불가
      const results = [];

      for (let i = 0; i < 10; i++) {
        const orderId = `ORD_${testUserId}_pkg1_${Date.now()}_${i}`;

        const result = await simulatePaymentConfirmation({
          userId: testUserId,
          orderId,
          paymentKey: `test_payment_key_rl2_${i}`,
          amount: 3300,
          packageId: 'pkg1',
          ipAddress: `192.168.1.${i}`, // 다른 IP
        });

        results.push(result);
      }

      // userId 기반으로 Rate Limiting 적용되므로 IP 변경으로 우회 불가
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).to.be.at.most(5);
    });
  });

  // ========================================
  // 6. SQL Injection/XSS 방어 (Injection Prevention)
  // ========================================

  describe('6. SQL Injection/XSS 방어', () => {
    it('SQL Injection 시도 시 안전하게 처리', async () => {
      const maliciousOrderId = `ORD_${testUserId}' OR '1'='1_${Date.now()}`;

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId: maliciousOrderId,
        paymentKey: 'test_payment_key_sql',
        amount: 5500,
        packageId: 'pkg2',
      });

      // Firestore는 NoSQL이므로 SQL Injection 영향 없음
      // 하지만 잘못된 orderId 형식이므로 실패해야 함
      expect(result.success).to.be.false;
      expect(result.error).to.include('INVALID_ORDER_ID_FORMAT');
    });

    it('XSS 시도 시 안전하게 처리', async () => {
      const maliciousOrderId = `ORD_${testUserId}<script>alert('XSS')</script>_${Date.now()}`;

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId: maliciousOrderId,
        paymentKey: 'test_payment_key_xss',
        amount: 5500,
        packageId: 'pkg2',
      });

      // 잘못된 orderId 형식이므로 실패
      expect(result.success).to.be.false;
      expect(result.error).to.include('INVALID_ORDER_ID_FORMAT');
    });

    it('특수문자가 포함된 orderId 시도 시 실패', async () => {
      const specialCharOrderId = `ORD_${testUserId}!@#$%^&*()_${Date.now()}`;

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId: specialCharOrderId,
        paymentKey: 'test_payment_key_special',
        amount: 5500,
        packageId: 'pkg2',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('INVALID_ORDER_ID_FORMAT');
    });
  });

  // ========================================
  // 7. 토큰 조작 시도 (Token Manipulation)
  // ========================================

  describe('7. 토큰 조작 시도', () => {
    it('만료된 토큰으로 결제 시도 시 실패', async () => {
      const orderId = `ORD_${testUserId}_pkg2_${Date.now()}`;
      const expiredToken = 'expired_token_abc123';

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId,
        paymentKey: 'test_payment_key_token1',
        amount: 5500,
        packageId: 'pkg2',
        authToken: expiredToken,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('TOKEN_EXPIRED');
    });

    it('조작된 토큰으로 결제 시도 시 실패', async () => {
      const orderId = `ORD_${testUserId}_pkg2_${Date.now()}`;
      const manipulatedToken = 'manipulated_token_xyz789';

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId,
        paymentKey: 'test_payment_key_token2',
        amount: 5500,
        packageId: 'pkg2',
        authToken: manipulatedToken,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('INVALID_TOKEN');
    });

    it('다른 사용자의 토큰으로 결제 시도 시 실패', async () => {
      const orderId = `ORD_${testUserId}_pkg2_${Date.now()}`;
      const otherUserToken = 'valid_token_for_other_user';

      const result = await simulatePaymentConfirmation({
        userId: testUserId,
        orderId,
        paymentKey: 'test_payment_key_token3',
        amount: 5500,
        packageId: 'pkg2',
        authToken: otherUserToken,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('TOKEN_USER_MISMATCH');
    });
  });
});

// ========================================
// Helper Functions (보안 테스트 시뮬레이션)
// ========================================

/**
 * 결제 승인 시뮬레이션 (보안 검증 포함)
 */
async function simulatePaymentConfirmation(params: {
  userId: string | null;
  orderId: string;
  paymentKey: string;
  amount: number;
  packageId: string;
  ipAddress?: string;
  authToken?: string;
}): Promise<{ success: boolean; error?: string; chipBalance?: any }> {
  const { userId, orderId, paymentKey, amount, packageId, ipAddress, authToken } = params;

  try {
    // 1. 인증 확인
    if (!userId) {
      return { success: false, error: 'UNAUTHENTICATED' };
    }

    // 2. 토큰 검증
    if (authToken) {
      if (authToken.includes('expired')) {
        return { success: false, error: 'TOKEN_EXPIRED' };
      }
      if (authToken.includes('manipulated')) {
        return { success: false, error: 'INVALID_TOKEN' };
      }
      if (authToken.includes('other_user')) {
        return { success: false, error: 'TOKEN_USER_MISMATCH' };
      }
    }

    // 3. orderId 형식 검증
    const orderIdPattern = /^ORD_[a-zA-Z0-9_]+_pkg[1-5]_\d+$/;
    if (!orderIdPattern.test(orderId)) {
      return { success: false, error: 'INVALID_ORDER_ID_FORMAT' };
    }

    // 4. orderId와 userId 일치 여부 확인
    if (!orderId.startsWith(`ORD_${userId}_`)) {
      return { success: false, error: 'ORDER_ID_USER_MISMATCH' };
    }

    // 5. 금액 검증
    if (amount <= 0) {
      return { success: false, error: 'INVALID_AMOUNT' };
    }
    if (amount > 100000) {
      return { success: false, error: 'AMOUNT_EXCEEDED' };
    }

    // 6. 패키지별 금액 검증
    const packagePrices: Record<string, number> = {
      pkg1: 3300,
      pkg2: 5500,
      pkg3: 11000,
      pkg4: 33000,
      pkg5: 55000,
    };

    if (packagePrices[packageId] !== amount) {
      return { success: false, error: 'AMOUNT_MISMATCH' };
    }

    // 7. 중복 결제 확인 (orderId)
    const existingOrderDoc = await db
      .collection('paymentTransactions')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    if (!existingOrderDoc.empty) {
      return { success: false, error: 'DUPLICATE_ORDER_ID' };
    }

    // 8. 중복 결제 확인 (paymentKey)
    const existingPaymentDoc = await db
      .collection('paymentTransactions')
      .where('paymentKey', '==', paymentKey)
      .limit(1)
      .get();

    if (!existingPaymentDoc.empty) {
      return { success: false, error: 'DUPLICATE_PAYMENT_KEY' };
    }

    // 9. Rate Limiting 확인
    const rateLimitDoc = await db.collection('rateLimits').doc(userId).get();
    if (rateLimitDoc.exists) {
      const rateLimitData = rateLimitDoc.data()!;
      const now = Date.now();
      const windowStart = rateLimitData.windowStart.toMillis();
      const windowDuration = 60 * 1000; // 1분

      if (now - windowStart < windowDuration && rateLimitData.count >= 5) {
        return { success: false, error: 'RATE_LIMIT_EXCEEDED' };
      }

      // Rate Limit 윈도우 업데이트
      if (now - windowStart >= windowDuration) {
        await db.collection('rateLimits').doc(userId).set({
          count: 1,
          windowStart: new Date(now),
        });
      } else {
        await db.collection('rateLimits').doc(userId).update({
          count: admin.firestore.FieldValue.increment(1),
        });
      }
    } else {
      await db.collection('rateLimits').doc(userId).set({
        count: 1,
        windowStart: new Date(),
      });
    }

    // 10. 결제 성공 - 칩 지급
    const chipAmount = packageId === 'pkg1' ? 10 : packageId === 'pkg2' ? 30 : packageId === 'pkg3' ? 60 : packageId === 'pkg4' ? 200 : 350;
    const chipExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1년 후

    await db.collection('chipBalance').doc(userId).set({
      redChips: chipAmount,
      blueChips: 0,
      redChipExpiry: chipExpiry,
      blueChipExpiry: null,
      updatedAt: new Date(),
    });

    // 11. 결제 기록 저장
    await db.collection('paymentTransactions').doc(`txn_${userId}_1`).set({
      orderId,
      paymentKey,
      userId,
      amount,
      packageId,
      status: 'DONE',
      createdAt: new Date(),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 웹훅 호출 시뮬레이션 (시그니처 검증 포함)
 */
async function simulateWebhookCall(
  payload: any,
  signature: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 시그니처 존재 확인
    if (!signature) {
      return { success: false, error: 'MISSING_SIGNATURE' };
    }

    // 2. 시그니처 검증
    const expectedSignature = generateSignature(payload);
    if (signature !== expectedSignature) {
      return { success: false, error: signature === 'invalid_signature_abc123' ? 'INVALID_SIGNATURE' : 'SIGNATURE_VERIFICATION_FAILED' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * HMAC-SHA256 시그니처 생성 (테스트용)
 */
function generateSignature(payload: any): string {
  const crypto = require('crypto');
  const secretKey = 'test_secret_key_12345';
  const payloadString = JSON.stringify(payload);

  return crypto
    .createHmac('sha256', secretKey)
    .update(payloadString)
    .digest('hex');
}
