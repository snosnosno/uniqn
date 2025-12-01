import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * 칩 만료 처리 Cloud Scheduler
 *
 * 실행 주기: 매일 00:00 (Asia/Seoul)
 *
 * 처리 내용:
 * 1. 만료된 빨간칩 찾기 (구매일 + 1년)
 * 2. 만료된 파란칩 찾기 (다음 달 1일)
 * 3. 칩 잔액에서 차감
 * 4. 만료 트랜잭션 기록 생성
 *
 * 설정 방법:
 * ```bash
 * gcloud scheduler jobs create pubsub expireChips \
 *   --schedule="0 0 * * *" \
 *   --time-zone="Asia/Seoul" \
 *   --topic="expire-chips" \
 *   --message-body="{}"
 * ```
 */
export const expireChips = functions.pubsub
  .schedule('0 0 * * *') // 매일 00:00
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const currentTime = admin.firestore.Timestamp.now();

    functions.logger.info('칩 만료 처리 시작', {
      timestamp: now.toISOString(),
      scheduledTime: context.timestamp,
    });

    let totalExpired = 0;
    let totalUsers = 0;
    let totalRedChips = 0;
    let totalBlueChips = 0;

    try {
      // 모든 사용자의 칩 잔액 조회
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        try {
          // 사용자의 칩 트랜잭션 조회
          const transactionsSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('chipTransactions')
            .where('type', 'in', ['purchase', 'grant'])
            .get();

          const expiredChips: {
            redChips: number;
            blueChips: number;
            transactions: any[];
          } = {
            redChips: 0,
            blueChips: 0,
            transactions: [],
          };

          // 만료된 칩 찾기
          for (const txDoc of transactionsSnapshot.docs) {
            const tx = txDoc.data();

            if (!tx.expiryDate) {
              continue; // 만료일 없는 트랜잭션 스킵
            }

            const expiryDate = tx.expiryDate.toDate();

            // 만료일이 지났는지 확인
            if (expiryDate <= now) {
              if (tx.chipType === 'red') {
                expiredChips.redChips += tx.amount;
              } else if (tx.chipType === 'blue') {
                expiredChips.blueChips += tx.amount;
              }

              expiredChips.transactions.push({
                id: txDoc.id,
                chipType: tx.chipType,
                amount: tx.amount,
                expiryDate: expiryDate.toISOString(),
              });
            }
          }

          // 만료된 칩이 있으면 처리
          if (expiredChips.redChips > 0 || expiredChips.blueChips > 0) {
            await processExpiredChips(userId, expiredChips, currentTime);

            totalUsers++;
            totalRedChips += expiredChips.redChips;
            totalBlueChips += expiredChips.blueChips;
            totalExpired += expiredChips.redChips + expiredChips.blueChips;

            functions.logger.info('사용자 칩 만료 처리 완료', {
              userId,
              redChips: expiredChips.redChips,
              blueChips: expiredChips.blueChips,
              total: expiredChips.redChips + expiredChips.blueChips,
            });
          }
        } catch (userError: any) {
          functions.logger.error('사용자 칩 만료 처리 실패', {
            userId,
            error: userError.message,
            stack: userError.stack,
          });
          // 개별 사용자 실패는 전체 프로세스를 중단하지 않음
          continue;
        }
      }

      functions.logger.info('칩 만료 처리 완료', {
        totalUsers,
        totalExpired,
        totalRedChips,
        totalBlueChips,
        duration: Date.now() - now.getTime(),
      });

      return {
        success: true,
        totalUsers,
        totalExpired,
        totalRedChips,
        totalBlueChips,
      };
    } catch (error: any) {
      functions.logger.error('칩 만료 처리 중 오류 발생', {
        error: error.message,
        stack: error.stack,
      });

      throw new functions.https.HttpsError('internal', '칩 만료 처리 중 오류가 발생했습니다');
    }
  });

/**
 * 만료된 칩 처리 (Firestore 트랜잭션)
 *
 * @param userId - 사용자 ID
 * @param expiredChips - 만료된 칩 정보
 * @param currentTime - 현재 시간
 */
async function processExpiredChips(
  userId: string,
  expiredChips: {
    redChips: number;
    blueChips: number;
    transactions: any[];
  },
  currentTime: admin.firestore.Timestamp
): Promise<void> {
  const db = admin.firestore();
  const chipBalanceRef = db.collection('users').doc(userId).collection('chipBalance').doc('current');

  await db.runTransaction(async (transaction) => {
    const chipBalanceDoc = await transaction.get(chipBalanceRef);

    if (!chipBalanceDoc.exists) {
      functions.logger.warn('칩 잔액 문서 없음', { userId });
      return;
    }

    const currentBalance = chipBalanceDoc.data();
    if (!currentBalance) {
      functions.logger.warn('칩 잔액 데이터 없음', { userId });
      return;
    }

    // 새 잔액 계산
    const newRedChips = Math.max(0, (currentBalance.redChips || 0) - expiredChips.redChips);
    const newBlueChips = Math.max(0, (currentBalance.blueChips || 0) - expiredChips.blueChips);
    const newTotalChips = newRedChips + newBlueChips;

    // 잔액 업데이트
    transaction.update(chipBalanceRef, {
      redChips: newRedChips,
      blueChips: newBlueChips,
      totalChips: newTotalChips,
      lastUpdated: currentTime,
    });

    // 만료 트랜잭션 기록 생성
    if (expiredChips.redChips > 0) {
      const redExpireTxRef = db
        .collection('users')
        .doc(userId)
        .collection('chipTransactions')
        .doc();

      transaction.set(redExpireTxRef, {
        userId,
        type: 'expire',
        chipType: 'red',
        amount: -expiredChips.redChips,
        balanceBefore: currentBalance.redChips || 0,
        balanceAfter: newRedChips,
        description: `빨간칩 만료 (${expiredChips.transactions.filter(tx => tx.chipType === 'red').length}건)`,
        metadata: {
          expiredTransactions: expiredChips.transactions.filter(tx => tx.chipType === 'red'),
        },
        createdAt: currentTime,
      });
    }

    if (expiredChips.blueChips > 0) {
      const blueExpireTxRef = db
        .collection('users')
        .doc(userId)
        .collection('chipTransactions')
        .doc();

      transaction.set(blueExpireTxRef, {
        userId,
        type: 'expire',
        chipType: 'blue',
        amount: -expiredChips.blueChips,
        balanceBefore: currentBalance.blueChips || 0,
        balanceAfter: newBlueChips,
        description: `파란칩 만료 (${expiredChips.transactions.filter(tx => tx.chipType === 'blue').length}건)`,
        metadata: {
          expiredTransactions: expiredChips.transactions.filter(tx => tx.chipType === 'blue'),
        },
        createdAt: currentTime,
      });
    }
  });
}
