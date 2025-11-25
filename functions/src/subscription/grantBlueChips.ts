/**
 * 구독 플랜 파란칩 자동 지급 Cloud Function
 *
 * 기능:
 * - Cloud Scheduler: 매월 1일 00:00 (Asia/Seoul) 실행
 * - 활성 구독자에게 파란칩 자동 지급
 * - 칩 만료일: 다음 달 1일
 * - 중복 지급 방지 (월별 체크)
 *
 * 배포 명령:
 * ```bash
 * gcloud scheduler jobs create pubsub grantMonthlyBlueChips \
 *   --schedule="0 0 1 * *" \
 *   --time-zone="Asia/Seoul" \
 *   --topic="grant-monthly-blue-chips" \
 *   --message-body="{}"
 * ```
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * 구독 플랜별 파란칩 지급량
 */
const SUBSCRIPTION_CHIP_AMOUNTS: Record<string, number> = {
  free: 5,
  standard: 30,
  pro: 80,
};

/**
 * 매월 1일 자동 실행: 구독자에게 파란칩 지급
 */
export const grantMonthlyBlueChips = functions
  .region('asia-northeast3')
  .pubsub.topic('grant-monthly-blue-chips')
  .onPublish(async () => {
    logger.info('=== 월별 파란칩 지급 시작 ===');

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      // 1. 활성 구독 조회
      const subscriptionsSnapshot = await db
        .collection('subscriptions')
        .where('status', '==', 'active')
        .where('autoRenew', '==', true)
        .get();

      if (subscriptionsSnapshot.empty) {
        logger.info('활성 구독자가 없습니다');
        return;
      }

      logger.info(`활성 구독자 ${subscriptionsSnapshot.size}명 발견`);

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      // 2. 각 구독자에게 파란칩 지급
      for (const subscriptionDoc of subscriptionsSnapshot.docs) {
        const subscription = subscriptionDoc.data();
        const { userId, planType } = subscription;

        try {
          // 2-1. 이번 달 이미 지급했는지 확인
          const lastGrantMonth = subscription.lastChipGrantMonth;
          if (lastGrantMonth === currentMonth) {
            logger.info(`이미 지급 완료: ${userId} (${currentMonth})`);
            skipCount++;
            continue;
          }

          // 2-2. 플랜별 칩 개수 확인
          const chipAmount = SUBSCRIPTION_CHIP_AMOUNTS[planType];
          if (!chipAmount || chipAmount === 0) {
            logger.warn(`유효하지 않은 플랜: ${userId} - ${planType}`);
            skipCount++;
            continue;
          }

          // 2-3. 파란칩 지급 (Firestore 트랜잭션)
          await db.runTransaction(async (transaction) => {
            const chipBalanceRef = db
              .collection('users')
              .doc(userId)
              .collection('chipBalance')
              .doc('current');

            const chipBalanceDoc = await transaction.get(chipBalanceRef);

            // 칩 잔액 문서가 없으면 생성
            if (!chipBalanceDoc.exists) {
              transaction.set(chipBalanceRef, {
                userId,
                redChips: 0,
                blueChips: chipAmount,
                redChipsExpiry: null,
                blueChipsExpiry: getNextMonthFirstDay(),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
            } else {
              // 파란칩 추가
              const currentBlueChips = chipBalanceDoc.data()?.blueChips || 0;
              transaction.update(chipBalanceRef, {
                blueChips: currentBlueChips + chipAmount,
                blueChipsExpiry: getNextMonthFirstDay(),
                updatedAt: FieldValue.serverTimestamp(),
              });
            }

            // 2-4. 트랜잭션 기록 생성
            const transactionRef = db
              .collection('users')
              .doc(userId)
              .collection('chipTransactions')
              .doc();

            transaction.set(transactionRef, {
              userId,
              type: 'grant',
              source: 'subscription',
              amount: chipAmount,
              chipType: 'blue',
              description: `월간 구독 파란칩 지급 (${planType.toUpperCase()} 플랜)`,
              balanceAfter: (chipBalanceDoc.data()?.blueChips || 0) + chipAmount,
              metadata: {
                planType,
                grantMonth: currentMonth,
                expiresAt: getNextMonthFirstDay(),
              },
              createdAt: FieldValue.serverTimestamp(),
            });

            // 2-5. 구독 정보 업데이트 (마지막 지급 월)
            const subscriptionRef = db.collection('subscriptions').doc(subscriptionDoc.id);
            transaction.update(subscriptionRef, {
              lastChipGrantMonth: currentMonth,
              lastChipGrantDate: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          });

          logger.info(`파란칩 지급 완료: ${userId} - ${chipAmount}칩 (${planType})`);
          successCount++;
        } catch (error) {
          logger.error(`파란칩 지급 실패: ${userId}`, error);
          errorCount++;
        }
      }

      // 3. 결과 로깅
      logger.info('=== 월별 파란칩 지급 완료 ===', {
        totalSubscriptions: subscriptionsSnapshot.size,
        successCount,
        skipCount,
        errorCount,
      });
    } catch (error) {
      logger.error('월별 파란칩 지급 중 오류 발생', error);
      throw error;
    }
  });

/**
 * 다음 달 1일 00:00:00 반환
 */
function getNextMonthFirstDay(): Date {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return nextMonth;
}

/**
 * 수동으로 특정 사용자에게 파란칩 지급 (관리자 전용)
 */
export const manualGrantSubscriptionChips = functions
  .region('asia-northeast3')
  .https.onCall(async (data, context) => {
    // 1. 관리자 권한 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '로그인이 필요합니다.'
      );
    }

    const callerUid = context.auth.uid;
    const callerDoc = await db.collection('users').doc(callerUid).get();
    const callerRole = callerDoc.data()?.role;

    if (callerRole !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        '관리자만 수동 지급할 수 있습니다.'
      );
    }

    const { userId, planType } = data;

    if (!userId || !planType) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId와 planType이 필요합니다.'
      );
    }

    try {
      const chipAmount = SUBSCRIPTION_CHIP_AMOUNTS[planType];
      if (!chipAmount) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          '유효하지 않은 플랜 타입입니다.'
        );
      }

      // 파란칩 지급
      await db.runTransaction(async (transaction) => {
        const chipBalanceRef = db
          .collection('users')
          .doc(userId)
          .collection('chipBalance')
          .doc('current');

        const chipBalanceDoc = await transaction.get(chipBalanceRef);

        if (!chipBalanceDoc.exists) {
          transaction.set(chipBalanceRef, {
            userId,
            redChips: 0,
            blueChips: chipAmount,
            redChipsExpiry: null,
            blueChipsExpiry: getNextMonthFirstDay(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const currentBlueChips = chipBalanceDoc.data()?.blueChips || 0;
          transaction.update(chipBalanceRef, {
            blueChips: currentBlueChips + chipAmount,
            blueChipsExpiry: getNextMonthFirstDay(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // 트랜잭션 기록
        const transactionRef = db
          .collection('users')
          .doc(userId)
          .collection('chipTransactions')
          .doc();

        transaction.set(transactionRef, {
          userId,
          type: 'grant',
          source: 'manual_subscription',
          amount: chipAmount,
          chipType: 'blue',
          description: `수동 구독 파란칩 지급 (${planType.toUpperCase()} 플랜)`,
          balanceAfter: (chipBalanceDoc.data()?.blueChips || 0) + chipAmount,
          grantedBy: callerUid,
          metadata: {
            planType,
            manualGrant: true,
            expiresAt: getNextMonthFirstDay(),
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      logger.info(`수동 파란칩 지급 완료: ${userId} - ${chipAmount}칩 (${planType})`);

      return {
        success: true,
        message: `${chipAmount}개의 파란칩이 지급되었습니다.`,
        userId,
        amount: chipAmount,
        planType,
      };
    } catch (error) {
      logger.error('수동 파란칩 지급 실패', error);
      throw new functions.https.HttpsError(
        'internal',
        '파란칩 지급 중 오류가 발생했습니다.'
      );
    }
  });
