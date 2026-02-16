/**
 * 고아 계정 정리 Scheduler
 *
 * @description
 * 회원가입 롤백 실패로 인한 고아 계정(orphanAccounts)을 주기적으로 정리합니다.
 * - orphanAccounts 컬렉션에서 7일 이상 된 항목 조회
 * - users 문서가 없으면 Firebase Auth에서 삭제
 * - Auth에서 phone-only 계정(email 없음) 중 7일 이상 된 것도 스캔
 *
 * 실행 주기: 매일 02:00 KST
 *
 * @version 1.0.0
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const ORPHAN_AGE_DAYS = 7;

export const cleanupOrphanAccountsScheduled = onSchedule(
  { schedule: '0 17 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  // 02:00 KST = 17:00 UTC (전날)
  async () => {
    logger.info('고아 계정 정리 시작');

    const db = admin.firestore();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ORPHAN_AGE_DAYS);

    let deletedCount = 0;
    let failedCount = 0;

    try {
      // 1. orphanAccounts 컬렉션에서 오래된 항목 조회
      const snapshot = await db
        .collection('orphanAccounts')
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(cutoffDate))
        .limit(100)
        .get();

      logger.info(`고아 계정 후보 ${snapshot.size}건 발견`);

      for (const orphanDoc of snapshot.docs) {
        const { uid } = orphanDoc.data();

        try {
          // users 문서가 존재하면 정상 계정이므로 orphan 기록만 삭제
          const userDoc = await db.collection('users').doc(uid).get();
          if (userDoc.exists) {
            await orphanDoc.ref.delete();
            logger.info('정상 계정의 orphan 기록 삭제', { uid });
            continue;
          }

          // Firebase Auth에서 삭제
          try {
            await admin.auth().deleteUser(uid);
            logger.info('고아 계정 Auth 삭제 완료', { uid });
          } catch (authError: unknown) {
            // 이미 삭제된 경우
            if (
              authError &&
              typeof authError === 'object' &&
              'code' in authError &&
              (authError as { code: string }).code === 'auth/user-not-found'
            ) {
              logger.info('Auth에 이미 없는 계정', { uid });
            } else {
              throw authError;
            }
          }

          // orphanAccounts 문서 삭제
          await orphanDoc.ref.delete();
          deletedCount++;
        } catch (error) {
          failedCount++;
          logger.error('고아 계정 정리 실패', { uid, error });
        }
      }

      logger.info('orphanAccounts 정리 완료', { deletedCount, failedCount, total: snapshot.size });
    } catch (error) {
      logger.error('orphanAccounts 정리 실패', { error });
    }

    // 2. Auth에서 phone-only 계정 스캔 (email 없음 + users 문서 없음)
    try {
      let nextPageToken: string | undefined;
      let phoneOnlyDeleted = 0;

      do {
        const listResult = await admin.auth().listUsers(100, nextPageToken);

        for (const userRecord of listResult.users) {
          // phone-only: phoneNumber 있고 email 없음
          if (!userRecord.phoneNumber || userRecord.email) continue;

          // 7일 미만이면 스킵
          const createdAt = new Date(userRecord.metadata.creationTime);
          if (createdAt > cutoffDate) continue;

          // Firestore users 문서 존재하면 정상 계정
          const userDoc = await db.collection('users').doc(userRecord.uid).get();
          if (userDoc.exists) continue;

          // 삭제
          try {
            await admin.auth().deleteUser(userRecord.uid);
            phoneOnlyDeleted++;
            logger.info('phone-only 고아 계정 삭제', { uid: userRecord.uid });
          } catch (delError) {
            logger.error('phone-only 계정 삭제 실패', { uid: userRecord.uid, error: delError });
          }
        }

        nextPageToken = listResult.pageToken;
      } while (nextPageToken);

      logger.info('phone-only 계정 스캔 완료', { phoneOnlyDeleted });
    } catch (error) {
      logger.error('phone-only 계정 스캔 실패', { error });
    }
  }
);
