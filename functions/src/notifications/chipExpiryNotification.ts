import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 칩 만료 알림 Cloud Scheduler
 *
 * 실행 주기: 매일 09:00 (Asia/Seoul)
 *
 * 알림 단계:
 * - 30일 전 알림
 * - 7일 전 알림
 * - 3일 전 알림
 * - 당일 알림
 *
 * 설정 방법:
 * ```bash
 * gcloud scheduler jobs create pubsub chipExpiryNotification \
 *   --schedule="0 9 * * *" \
 *   --time-zone="Asia/Seoul" \
 *   --topic="chip-expiry-notification" \
 *   --message-body="{}"
 * ```
 */
export const chipExpiryNotification = functions.pubsub
  .schedule('0 9 * * *') // 매일 09:00
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    const now = new Date();

    functions.logger.info('칩 만료 알림 발송 시작', {
      timestamp: now.toISOString(),
      scheduledTime: context.timestamp,
    });

    let totalNotifications = 0;
    let totalUsers = 0;

    try {
      // 알림 단계별 일수 설정
      const notificationStages = [
        { stage: 'days_30', daysBeforeExpiry: 30 },
        { stage: 'days_7', daysBeforeExpiry: 7 },
        { stage: 'days_3', daysBeforeExpiry: 3 },
        { stage: 'day_current', daysBeforeExpiry: 0 },
      ];

      // 모든 사용자의 칩 트랜잭션 조회
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        try {
          // 사용자의 칩 트랜잭션 조회 (purchase, grant 타입만)
          const transactionsSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('chipTransactions')
            .where('type', 'in', ['purchase', 'grant'])
            .get();

          const expiringChips: {
            stage: string;
            chipType: 'red' | 'blue';
            amount: number;
            expiryDate: Date;
            daysUntilExpiry: number;
          }[] = [];

          // 만료 예정 칩 찾기
          for (const txDoc of transactionsSnapshot.docs) {
            const tx = txDoc.data();

            if (!tx.expiryDate) {
              continue; // 만료일 없는 트랜잭션 스킵
            }

            const expiryDate = tx.expiryDate.toDate();
            const daysUntilExpiry = Math.ceil(
              (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            // 각 알림 단계에 해당하는지 확인
            for (const { stage, daysBeforeExpiry } of notificationStages) {
              if (daysUntilExpiry === daysBeforeExpiry) {
                expiringChips.push({
                  stage,
                  chipType: tx.chipType,
                  amount: tx.amount,
                  expiryDate,
                  daysUntilExpiry,
                });

                functions.logger.info('만료 예정 칩 발견', {
                  userId,
                  chipType: tx.chipType,
                  amount: tx.amount,
                  daysUntilExpiry,
                  stage,
                });
              }
            }
          }

          // 만료 예정 칩이 있으면 알림 발송
          if (expiringChips.length > 0) {
            await sendExpiryNotifications(userId, expiringChips, now);
            totalUsers++;
            totalNotifications += expiringChips.length;

            functions.logger.info('칩 만료 알림 발송 완료', {
              userId,
              notificationCount: expiringChips.length,
            });
          }
        } catch (userError: any) {
          functions.logger.error('사용자 알림 발송 실패', {
            userId,
            error: userError.message,
            stack: userError.stack,
          });
          // 개별 사용자 실패는 전체 프로세스를 중단하지 않음
          continue;
        }
      }

      functions.logger.info('칩 만료 알림 발송 완료', {
        totalUsers,
        totalNotifications,
        duration: Date.now() - now.getTime(),
      });

      return {
        success: true,
        totalUsers,
        totalNotifications,
      };
    } catch (error: any) {
      functions.logger.error('칩 만료 알림 발송 중 오류 발생', {
        error: error.message,
        stack: error.stack,
      });

      throw new functions.https.HttpsError('internal', '칩 만료 알림 발송 중 오류가 발생했습니다');
    }
  });

/**
 * 만료 예정 칩에 대한 알림 발송
 *
 * @param userId - 사용자 ID
 * @param expiringChips - 만료 예정 칩 목록
 * @param currentTime - 현재 시간
 */
async function sendExpiryNotifications(
  userId: string,
  expiringChips: {
    stage: string;
    chipType: 'red' | 'blue';
    amount: number;
    expiryDate: Date;
    daysUntilExpiry: number;
  }[],
  currentTime: Date
): Promise<void> {
  const notificationsRef = db.collection('notifications');

  // 칩 타입별로 그룹화
  const redChips = expiringChips.filter(chip => chip.chipType === 'red');
  const blueChips = expiringChips.filter(chip => chip.chipType === 'blue');

  // 빨간칩 알림 발송
  if (redChips.length > 0) {
    const totalRedChips = redChips.reduce((sum, chip) => sum + chip.amount, 0);
    const earliestExpiry = redChips.reduce((earliest, chip) =>
      chip.expiryDate < earliest.expiryDate ? chip : earliest
    );

    const redChipNotification = {
      userId,
      type: 'chip_expiry',
      title: '🔴 빨간칩 만료 안내',
      message: getExpiryMessage(
        '빨간칩',
        totalRedChips,
        earliestExpiry.daysUntilExpiry,
        earliestExpiry.expiryDate
      ),
      metadata: {
        chipType: 'red',
        totalAmount: totalRedChips,
        expiryDate: admin.firestore.Timestamp.fromDate(earliestExpiry.expiryDate),
        daysUntilExpiry: earliestExpiry.daysUntilExpiry,
        stage: earliestExpiry.stage,
      },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await notificationsRef.add(redChipNotification);
  }

  // 파란칩 알림 발송
  if (blueChips.length > 0) {
    const totalBlueChips = blueChips.reduce((sum, chip) => sum + chip.amount, 0);
    const earliestExpiry = blueChips.reduce((earliest, chip) =>
      chip.expiryDate < earliest.expiryDate ? chip : earliest
    );

    const blueChipNotification = {
      userId,
      type: 'chip_expiry',
      title: '🔵 파란칩 만료 안내',
      message: getExpiryMessage(
        '파란칩',
        totalBlueChips,
        earliestExpiry.daysUntilExpiry,
        earliestExpiry.expiryDate
      ),
      metadata: {
        chipType: 'blue',
        totalAmount: totalBlueChips,
        expiryDate: admin.firestore.Timestamp.fromDate(earliestExpiry.expiryDate),
        daysUntilExpiry: earliestExpiry.daysUntilExpiry,
        stage: earliestExpiry.stage,
      },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await notificationsRef.add(blueChipNotification);
  }
}

/**
 * 만료 알림 메시지 생성
 *
 * @param chipType - 칩 타입 (한글)
 * @param amount - 칩 개수
 * @param daysUntilExpiry - 만료까지 남은 일수
 * @param expiryDate - 만료일
 * @returns 알림 메시지
 */
function getExpiryMessage(
  chipType: string,
  amount: number,
  daysUntilExpiry: number,
  expiryDate: Date
): string {
  const formattedDate = expiryDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (daysUntilExpiry === 0) {
    return `${chipType} ${amount}개가 오늘(${formattedDate}) 만료됩니다. 만료 전에 사용해주세요!`;
  } else if (daysUntilExpiry === 3) {
    return `${chipType} ${amount}개가 3일 후(${formattedDate})에 만료됩니다. 사용을 서두르세요.`;
  } else if (daysUntilExpiry === 7) {
    return `${chipType} ${amount}개가 7일 후(${formattedDate})에 만료됩니다. 계획적으로 사용해주세요.`;
  } else if (daysUntilExpiry === 30) {
    return `${chipType} ${amount}개가 30일 후(${formattedDate})에 만료됩니다. 만료일을 확인해주세요.`;
  } else {
    return `${chipType} ${amount}개가 ${daysUntilExpiry}일 후(${formattedDate})에 만료됩니다.`;
  }
}

/**
 * 수동 칩 만료 알림 트리거 (테스트용)
 *
 * 관리자가 특정 사용자에게 칩 만료 알림을 수동으로 발송할 수 있습니다.
 */
export const sendManualChipExpiryNotification = functions.https.onCall(
  async (data: any, context: any) => {
    // 관리자 권한 확인
    if (!context.auth || context.auth.token?.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        '관리자 권한이 필요합니다'
      );
    }

    const { userId, chipType, amount, daysUntilExpiry, expiryDate } = data;

    // 입력 검증
    if (!userId || !chipType || !amount || daysUntilExpiry === undefined || !expiryDate) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '필수 파라미터가 누락되었습니다'
      );
    }

    try {
      const notificationsRef = db.collection('notifications');
      const expiry = new Date(expiryDate);

      const notification = {
        userId,
        type: 'chip_expiry',
        title: chipType === 'red' ? '🔴 빨간칩 만료 안내' : '🔵 파란칩 만료 안내',
        message: getExpiryMessage(
          chipType === 'red' ? '빨간칩' : '파란칩',
          amount,
          daysUntilExpiry,
          expiry
        ),
        metadata: {
          chipType,
          totalAmount: amount,
          expiryDate: admin.firestore.Timestamp.fromDate(expiry),
          daysUntilExpiry,
          stage: getStageFromDays(daysUntilExpiry),
          isManual: true,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await notificationsRef.add(notification);

      functions.logger.info('수동 칩 만료 알림 발송 완료', {
        userId,
        chipType,
        amount,
        daysUntilExpiry,
      });

      return {
        success: true,
        message: '칩 만료 알림이 성공적으로 발송되었습니다',
      };
    } catch (error: any) {
      functions.logger.error('수동 칩 만료 알림 발송 실패', {
        error: error.message,
        stack: error.stack,
      });

      throw new functions.https.HttpsError(
        'internal',
        '알림 발송 중 오류가 발생했습니다'
      );
    }
  }
);

/**
 * 일수에 따른 알림 단계 반환
 */
function getStageFromDays(days: number): string {
  if (days === 0) return 'day_current';
  if (days === 3) return 'days_3';
  if (days === 7) return 'days_7';
  if (days === 30) return 'days_30';
  return 'custom';
}
