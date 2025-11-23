/**
 * 칩 로직 테스트 (Mocha + Chai)
 *
 * 테스트 대상:
 * - 칩 지급 (grantChips)
 * - 칩 차감 (deductChips) - 우선순위: 파란칩 → 빨간칩
 * - 칩 만료 (expireChips)
 *
 * 실행 방법:
 * cd functions
 * npm test
 */

import { expect } from 'chai';
import * as admin from 'firebase-admin';

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
 * 테스트용 칩 지급 함수
 */
async function grantChips(
  userId: string,
  amount: number,
  type: 'red' | 'blue',
  reason: string
): Promise<void> {
  const chipBalanceRef = db.collection('chipBalance').doc(userId);

  await db.runTransaction(async (transaction) => {
    const chipBalanceDoc = await transaction.get(chipBalanceRef);

    if (!chipBalanceDoc.exists) {
      // 칩 잔액 문서가 없으면 생성
      transaction.set(chipBalanceRef, {
        userId,
        redChips: type === 'red' ? amount : 0,
        blueChips: type === 'blue' ? amount : 0,
        redChipExpiry: type === 'red' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
        blueChipExpiry: type === 'blue' ? getNextMonthFirstDay() : null,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // 기존 칩 잔액에 추가
      const currentData = chipBalanceDoc.data()!;
      const updates: any = {
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (type === 'red') {
        updates.redChips = (currentData.redChips || 0) + amount;
        updates.redChipExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      } else {
        updates.blueChips = (currentData.blueChips || 0) + amount;
        updates.blueChipExpiry = getNextMonthFirstDay();
      }

      transaction.update(chipBalanceRef, updates);
    }

    // 거래 내역 기록
    const transactionRef = db.collection('chipTransactions').doc();
    transaction.set(transactionRef, {
      userId,
      type: 'grant',
      chipType: type,
      amount,
      reason,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      balance: {
        redChips: chipBalanceDoc.exists
          ? (chipBalanceDoc.data()!.redChips || 0) + (type === 'red' ? amount : 0)
          : type === 'red'
          ? amount
          : 0,
        blueChips: chipBalanceDoc.exists
          ? (chipBalanceDoc.data()!.blueChips || 0) + (type === 'blue' ? amount : 0)
          : type === 'blue'
          ? amount
          : 0,
      },
    });
  });
}

/**
 * 테스트용 칩 차감 함수 (우선순위: 파란칩 → 빨간칩)
 */
async function deductChips(
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const chipBalanceRef = db.collection('chipBalance').doc(userId);

  try {
    await db.runTransaction(async (transaction) => {
      const chipBalanceDoc = await transaction.get(chipBalanceRef);

      if (!chipBalanceDoc.exists) {
        throw new Error('칩 잔액 문서가 존재하지 않습니다.');
      }

      const chipBalance = chipBalanceDoc.data()!;
      const totalChips = (chipBalance.redChips || 0) + (chipBalance.blueChips || 0);

      if (totalChips < amount) {
        throw new Error(`칩이 부족합니다. (필요: ${amount}, 보유: ${totalChips})`);
      }

      let remainingAmount = amount;
      let newBlueChips = chipBalance.blueChips || 0;
      let newRedChips = chipBalance.redChips || 0;

      // 1. 파란칩 우선 차감
      if (newBlueChips > 0) {
        const deductFromBlue = Math.min(newBlueChips, remainingAmount);
        newBlueChips -= deductFromBlue;
        remainingAmount -= deductFromBlue;
      }

      // 2. 파란칩으로 부족하면 빨간칩 차감
      if (remainingAmount > 0 && newRedChips > 0) {
        const deductFromRed = Math.min(newRedChips, remainingAmount);
        newRedChips -= deductFromRed;
        remainingAmount -= deductFromRed;
      }

      // 칩 잔액 업데이트
      transaction.update(chipBalanceRef, {
        redChips: newRedChips,
        blueChips: newBlueChips,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 거래 내역 기록
      const transactionRef = db.collection('chipTransactions').doc();
      transaction.set(transactionRef, {
        userId,
        type: 'use',
        amount,
        reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        balance: {
          redChips: newRedChips,
          blueChips: newBlueChips,
        },
      });
    });

    return { success: true, message: '칩 차감 완료' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * 테스트용 칩 만료 함수
 */
async function expireChips(userId: string): Promise<{ redExpired: number; blueExpired: number }> {
  const chipBalanceRef = db.collection('chipBalance').doc(userId);
  let redExpired = 0;
  let blueExpired = 0;

  await db.runTransaction(async (transaction) => {
    const chipBalanceDoc = await transaction.get(chipBalanceRef);

    if (!chipBalanceDoc.exists) {
      return;
    }

    const chipBalance = chipBalanceDoc.data()!;
    const now = new Date();
    const updates: any = {};

    // 빨간칩 만료 확인 (1년)
    if (chipBalance.redChipExpiry && chipBalance.redChipExpiry.toDate() <= now) {
      redExpired = chipBalance.redChips || 0;
      updates.redChips = 0;
      updates.redChipExpiry = null;
    }

    // 파란칩 만료 확인 (매월 1일)
    if (chipBalance.blueChipExpiry && chipBalance.blueChipExpiry.toDate() <= now) {
      blueExpired = chipBalance.blueChips || 0;
      updates.blueChips = 0;
      updates.blueChipExpiry = null;
    }

    if (Object.keys(updates).length > 0) {
      updates.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
      transaction.update(chipBalanceRef, updates);

      // 만료 거래 내역 기록
      if (redExpired > 0) {
        const transactionRef = db.collection('chipTransactions').doc();
        transaction.set(transactionRef, {
          userId,
          type: 'expire',
          chipType: 'red',
          amount: redExpired,
          reason: '빨간칩 만료 (1년)',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          balance: {
            redChips: 0,
            blueChips: chipBalance.blueChips - blueExpired,
          },
        });
      }

      if (blueExpired > 0) {
        const transactionRef = db.collection('chipTransactions').doc();
        transaction.set(transactionRef, {
          userId,
          type: 'expire',
          chipType: 'blue',
          amount: blueExpired,
          reason: '파란칩 만료 (매월 1일)',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          balance: {
            redChips: chipBalance.redChips - redExpired,
            blueChips: 0,
          },
        });
      }
    }
  });

  return { redExpired, blueExpired };
}

/**
 * 유틸리티 함수: 다음 달 1일 계산
 */
function getNextMonthFirstDay(): Date {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return nextMonth;
}

// ============================================================
// 테스트 시작
// ============================================================

describe('칩 로직 테스트', () => {
  const testUserId = 'test-user-chip-logic';

  beforeEach(async () => {
    // 각 테스트 전에 데이터 초기화
    await db.collection('chipBalance').doc(testUserId).delete();
    const transactions = await db.collection('chipTransactions').where('userId', '==', testUserId).get();
    const batch = db.batch();
    transactions.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  });

  after(async () => {
    // 모든 테스트 후 정리
    await db.collection('chipBalance').doc(testUserId).delete();
    const transactions = await db.collection('chipTransactions').where('userId', '==', testUserId).get();
    const batch = db.batch();
    transactions.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  });

  // ========================================
  // 칩 지급 테스트
  // ========================================

  describe('칩 지급 (grantChips)', () => {
    it('빨간칩 30개 지급 성공', async () => {
      await grantChips(testUserId, 30, 'red', '테스트 결제');

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(30);
      expect(chipBalance.blueChips).to.equal(0);
      expect(chipBalance.redChipExpiry).to.exist;
    });

    it('파란칩 30개 지급 성공', async () => {
      await grantChips(testUserId, 30, 'blue', '구독 플랜');

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(0);
      expect(chipBalance.blueChips).to.equal(30);
      expect(chipBalance.blueChipExpiry).to.exist;
    });

    it('빨간칩 + 파란칩 순차 지급', async () => {
      await grantChips(testUserId, 30, 'red', '결제 1');
      await grantChips(testUserId, 50, 'blue', '구독');

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(30);
      expect(chipBalance.blueChips).to.equal(50);
    });

    it('동일 타입 칩 여러 번 지급 (누적)', async () => {
      await grantChips(testUserId, 30, 'red', '결제 1');
      await grantChips(testUserId, 30, 'red', '결제 2');

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(60);
    });

    it('칩 거래 내역이 기록됨', async () => {
      await grantChips(testUserId, 30, 'red', '테스트 결제');

      const transactions = await db
        .collection('chipTransactions')
        .where('userId', '==', testUserId)
        .where('type', '==', 'grant')
        .get();

      expect(transactions.size).to.equal(1);
      const transaction = transactions.docs[0].data();
      expect(transaction.amount).to.equal(30);
      expect(transaction.chipType).to.equal('red');
      expect(transaction.reason).to.equal('테스트 결제');
    });
  });

  // ========================================
  // 칩 차감 테스트 (우선순위: 파란칩 → 빨간칩)
  // ========================================

  describe('칩 차감 (deductChips) - 우선순위', () => {
    it('파란칩만 있을 때 차감', async () => {
      await grantChips(testUserId, 50, 'blue', '구독');
      const result = await deductChips(testUserId, 10, '칩 사용');

      expect(result.success).to.be.true;

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.blueChips).to.equal(40); // 50 - 10
      expect(chipBalance.redChips).to.equal(0);
    });

    it('빨간칩만 있을 때 차감', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      const result = await deductChips(testUserId, 10, '칩 사용');

      expect(result.success).to.be.true;

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(20); // 30 - 10
      expect(chipBalance.blueChips).to.equal(0);
    });

    it('파란칩 + 빨간칩 모두 있을 때 파란칩 우선 차감', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      await grantChips(testUserId, 50, 'blue', '구독');

      const result = await deductChips(testUserId, 20, '칩 사용');

      expect(result.success).to.be.true;

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.blueChips).to.equal(30); // 50 - 20 (파란칩 우선 차감)
      expect(chipBalance.redChips).to.equal(30); // 변동 없음
    });

    it('파란칩 부족 시 빨간칩 차감', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      await grantChips(testUserId, 10, 'blue', '구독');

      const result = await deductChips(testUserId, 25, '칩 사용');

      expect(result.success).to.be.true;

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.blueChips).to.equal(0); // 10 전부 차감
      expect(chipBalance.redChips).to.equal(15); // 30 - 15 (나머지 차감)
    });

    it('정확히 칩 잔액만큼 차감', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      const result = await deductChips(testUserId, 30, '칩 사용');

      expect(result.success).to.be.true;

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(0);
      expect(chipBalance.blueChips).to.equal(0);
    });

    it('칩 부족 시 실패', async () => {
      await grantChips(testUserId, 10, 'red', '결제');
      const result = await deductChips(testUserId, 20, '칩 사용');

      expect(result.success).to.be.false;
      expect(result.message).to.include('칩이 부족합니다');

      // 칩 잔액이 변경되지 않았는지 확인
      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(10); // 변동 없음
    });

    it('칩 잔액 문서가 없을 때 실패', async () => {
      const result = await deductChips(testUserId, 10, '칩 사용');

      expect(result.success).to.be.false;
      expect(result.message).to.include('칩 잔액 문서가 존재하지 않습니다');
    });

    it('칩 차감 거래 내역이 기록됨', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      await deductChips(testUserId, 10, '칩 사용');

      const transactions = await db
        .collection('chipTransactions')
        .where('userId', '==', testUserId)
        .where('type', '==', 'use')
        .get();

      expect(transactions.size).to.equal(1);
      const transaction = transactions.docs[0].data();
      expect(transaction.amount).to.equal(10);
      expect(transaction.reason).to.equal('칩 사용');
      expect(transaction.balance.redChips).to.equal(20);
    });
  });

  // ========================================
  // 칩 만료 테스트
  // ========================================

  describe('칩 만료 (expireChips)', () => {
    it('만료되지 않은 칩은 그대로 유지', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      await grantChips(testUserId, 50, 'blue', '구독');

      const result = await expireChips(testUserId);

      expect(result.redExpired).to.equal(0);
      expect(result.blueExpired).to.equal(0);

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(30);
      expect(chipBalance.blueChips).to.equal(50);
    });

    it('빨간칩 만료 시 0으로 설정', async () => {
      // 빨간칩 지급 후 만료일을 과거로 설정
      await grantChips(testUserId, 30, 'red', '결제');
      await db.collection('chipBalance').doc(testUserId).update({
        redChipExpiry: new Date(Date.now() - 1000), // 1초 전 만료
      });

      const result = await expireChips(testUserId);

      expect(result.redExpired).to.equal(30);

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(0);
      expect(chipBalance.redChipExpiry).to.be.null;
    });

    it('파란칩 만료 시 0으로 설정', async () => {
      // 파란칩 지급 후 만료일을 과거로 설정
      await grantChips(testUserId, 50, 'blue', '구독');
      await db.collection('chipBalance').doc(testUserId).update({
        blueChipExpiry: new Date(Date.now() - 1000), // 1초 전 만료
      });

      const result = await expireChips(testUserId);

      expect(result.blueExpired).to.equal(50);

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.blueChips).to.equal(0);
      expect(chipBalance.blueChipExpiry).to.be.null;
    });

    it('빨간칩 + 파란칩 동시 만료', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      await grantChips(testUserId, 50, 'blue', '구독');

      // 모두 과거 만료일로 설정
      await db.collection('chipBalance').doc(testUserId).update({
        redChipExpiry: new Date(Date.now() - 1000),
        blueChipExpiry: new Date(Date.now() - 1000),
      });

      const result = await expireChips(testUserId);

      expect(result.redExpired).to.equal(30);
      expect(result.blueExpired).to.equal(50);

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(0);
      expect(chipBalance.blueChips).to.equal(0);
      expect(chipBalance.redChipExpiry).to.be.null;
      expect(chipBalance.blueChipExpiry).to.be.null;
    });

    it('칩 만료 거래 내역이 기록됨', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      await db.collection('chipBalance').doc(testUserId).update({
        redChipExpiry: new Date(Date.now() - 1000),
      });

      await expireChips(testUserId);

      const transactions = await db
        .collection('chipTransactions')
        .where('userId', '==', testUserId)
        .where('type', '==', 'expire')
        .get();

      expect(transactions.size).to.equal(1);
      const transaction = transactions.docs[0].data();
      expect(transaction.chipType).to.equal('red');
      expect(transaction.amount).to.equal(30);
      expect(transaction.reason).to.include('빨간칩 만료');
    });
  });

  // ========================================
  // 통합 시나리오 테스트
  // ========================================

  describe('통합 시나리오', () => {
    it('결제 → 구독 → 사용 → 만료 전체 플로우', async () => {
      // 1. 빨간칩 30개 구매 (결제)
      await grantChips(testUserId, 30, 'red', '패키지 구매');

      // 2. 파란칩 50개 지급 (구독)
      await grantChips(testUserId, 50, 'blue', 'Standard 플랜');

      // 3. 칩 20개 사용 (파란칩 우선 차감)
      await deductChips(testUserId, 20, '공고 게시');

      // 4. 칩 잔액 확인
      let chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      let chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(30); // 변동 없음
      expect(chipBalance.blueChips).to.equal(30); // 50 - 20

      // 5. 파란칩 만료
      await db.collection('chipBalance').doc(testUserId).update({
        blueChipExpiry: new Date(Date.now() - 1000),
      });

      const expired = await expireChips(testUserId);
      expect(expired.blueExpired).to.equal(30);

      // 6. 최종 칩 잔액 확인
      chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(30); // 빨간칩만 남음
      expect(chipBalance.blueChips).to.equal(0); // 파란칩 만료

      // 7. 거래 내역 확인 (4개: grant x2, use x1, expire x1)
      const transactions = await db
        .collection('chipTransactions')
        .where('userId', '==', testUserId)
        .get();

      expect(transactions.size).to.equal(4);
    });

    it('파란칩 소진 후 빨간칩 사용', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      await grantChips(testUserId, 10, 'blue', '구독');

      // 파란칩 10개 소진
      await deductChips(testUserId, 10, '사용 1');

      let chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      let chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.blueChips).to.equal(0);
      expect(chipBalance.redChips).to.equal(30);

      // 빨간칩에서 추가 차감
      await deductChips(testUserId, 20, '사용 2');

      chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.blueChips).to.equal(0);
      expect(chipBalance.redChips).to.equal(10); // 30 - 20
    });
  });

  // ========================================
  // 엣지 케이스 테스트
  // ========================================

  describe('엣지 케이스', () => {
    it('0개 칩 지급', async () => {
      await grantChips(testUserId, 0, 'red', '테스트');

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(0);
    });

    it('0개 칩 차감', async () => {
      await grantChips(testUserId, 30, 'red', '결제');
      const result = await deductChips(testUserId, 0, '테스트');

      expect(result.success).to.be.true;

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(30); // 변동 없음
    });

    it('매우 큰 칩 지급 (100,000개)', async () => {
      await grantChips(testUserId, 100000, 'red', '테스트');

      const chipBalanceDoc = await db.collection('chipBalance').doc(testUserId).get();
      const chipBalance = chipBalanceDoc.data()!;

      expect(chipBalance.redChips).to.equal(100000);
    });

    it('매우 큰 칩 차감 (잔액 초과)', async () => {
      await grantChips(testUserId, 10, 'red', '결제');
      const result = await deductChips(testUserId, 100000, '테스트');

      expect(result.success).to.be.false;
      expect(result.message).to.include('칩이 부족합니다');
    });
  });
});
