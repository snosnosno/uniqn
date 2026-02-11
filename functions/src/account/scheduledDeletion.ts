/**
 * 예약된 계정 삭제 Cloud Function
 *
 * @description
 * 30일 유예 기간이 지난 계정 삭제 요청을 자동으로 처리
 * - 매일 자동 실행 (Cloud Scheduler 연동)
 * - 삭제 예정일이 지난 요청 검색
 * - Firebase Auth 및 Firestore 데이터 완전 삭제
 * - GDPR 준수: 개인정보 완전 제거
 *
 * @schedule 매일 오전 3시 (KST) = 오후 6시 (UTC-1) 실행
 * @version 1.0.0
 * @since 2025-10-23
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * 예약된 계정 삭제 처리 함수
 *
 * Cloud Scheduler에서 매일 자동 실행
 */
export const processScheduledDeletions = functions.region('asia-northeast3').pubsub
  .schedule('0 18 * * *') // 매일 UTC 18:00 (KST 03:00)
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();
    functions.logger.info('예약된 계정 삭제 작업 시작');

    try {
      const now = admin.firestore.Timestamp.now();

      // 삭제 예정일이 지난 pending 상태의 요청 조회
      const deletionRequestsSnapshot = await db
        .collectionGroup('deletionRequests')
        .where('status', '==', 'pending')
        .where('scheduledDeletionAt', '<=', now)
        .get();

      if (deletionRequestsSnapshot.empty) {
        functions.logger.info('처리할 계정 삭제 요청이 없습니다');
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      functions.logger.info(
        `${deletionRequestsSnapshot.size}개의 계정 삭제 요청 발견`
      );

      const results = {
        processed: deletionRequestsSnapshot.size,
        succeeded: 0,
        failed: 0,
      };

      // 각 삭제 요청 처리
      for (const doc of deletionRequestsSnapshot.docs) {
        const deletionRequest = doc.data();
        const userId = deletionRequest.userId;

        try {
          functions.logger.info(`계정 삭제 시작: ${userId}`);

          // 1. 사용자 하위 컬렉션 삭제
          await deleteUserSubcollections(userId);

          // 2. Firestore 사용자 문서 삭제
          await db.collection('users').doc(userId).delete();
          functions.logger.info(`Firestore 사용자 문서 삭제 완료: ${userId}`);

          // 3. Firebase Auth 계정 삭제
          try {
            await admin.auth().deleteUser(userId);
            functions.logger.info(`Firebase Auth 계정 삭제 완료: ${userId}`);
          } catch (authError: unknown) {
            // Auth 계정이 이미 삭제된 경우 무시
            const authErrorCode = authError != null && typeof authError === 'object' && 'code' in authError ? (authError as { code: string }).code : undefined;
            if (authErrorCode !== 'auth/user-not-found') {
              throw authError;
            }
            functions.logger.warn(
              `Firebase Auth 계정이 이미 삭제됨: ${userId}`
            );
          }

          // 4. 삭제 요청 상태 업데이트 (완료로 표시)
          await doc.ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          functions.logger.info(`계정 삭제 완료: ${userId}`);
          results.succeeded++;
        } catch (error) {
          functions.logger.error(`계정 삭제 실패: ${userId}`, error);
          results.failed++;

          // 삭제 실패 시 에러 로그 기록
          await doc.ref.update({
            lastError: {
              message:
                error instanceof Error ? error.message : 'Unknown error',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            },
          });
        }
      }

      functions.logger.info('예약된 계정 삭제 작업 완료', results);
      return results;
    } catch (error) {
      functions.logger.error('예약된 계정 삭제 작업 중 오류 발생', error);
      throw error;
    }
  });

/**
 * 사용자 하위 컬렉션 삭제 (GDPR 준수)
 *
 * @param userId - 삭제할 사용자 ID
 */
async function deleteUserSubcollections(userId: string): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);

  // 삭제할 하위 컬렉션 목록
  const subcollections = [
    'consents',
    'consentHistory',
    'deletionRequests',
    'loginNotifications',
    'securitySettings',
    'tournaments', // 멀티테넌트 데이터
  ];

  for (const collectionName of subcollections) {
    try {
      const snapshot = await userRef.collection(collectionName).get();

      if (snapshot.empty) {
        continue;
      }

      // 배치 삭제 (최대 500개씩)
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      functions.logger.info(
        `하위 컬렉션 삭제 완료: users/${userId}/${collectionName} (${snapshot.size}개)`
      );
    } catch (error) {
      functions.logger.error(
        `하위 컬렉션 삭제 실패: users/${userId}/${collectionName}`,
        error
      );
      // 일부 컬렉션 삭제 실패 시에도 계속 진행
    }
  }

  // tournaments 하위의 더 깊은 데이터도 삭제
  try {
    const tournamentsSnapshot = await userRef.collection('tournaments').get();
    for (const tournamentDoc of tournamentsSnapshot.docs) {
      const tournamentSubcollections = [
        'participants',
        'settings',
        'tables',
        'prizes',
        'shifts',
      ];

      for (const subCollection of tournamentSubcollections) {
        const subSnapshot = await tournamentDoc.ref
          .collection(subCollection)
          .get();
        if (!subSnapshot.empty) {
          const batch = db.batch();
          subSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          functions.logger.info(
            `토너먼트 하위 데이터 삭제: ${tournamentDoc.id}/${subCollection} (${subSnapshot.size}개)`
          );
        }
      }
    }
  } catch (error) {
    functions.logger.error('토너먼트 데이터 삭제 중 오류', error);
  }
}

/**
 * 수동 계정 삭제 함수 (관리자용)
 *
 * 관리자가 즉시 계정을 삭제할 수 있는 함수
 */
export const forceDeleteAccount = functions.region('asia-northeast3').https.onCall(
  async (data, context) => {
    const db = admin.firestore();

    // 관리자 권한 확인
    if (context.auth?.token?.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can force delete accounts'
      );
    }

    const { userId, reason } = data;

    if (!userId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId is required'
      );
    }

    try {
      functions.logger.info(`관리자 강제 삭제 시작: ${userId}`, {
        adminUid: context.auth.uid,
        reason,
      });

      // 사용자 존재 확인
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User not found'
        );
      }

      // 하위 컬렉션 삭제
      await deleteUserSubcollections(userId);

      // Firestore 사용자 문서 삭제
      await db.collection('users').doc(userId).delete();

      // Firebase Auth 계정 삭제
      try {
        await admin.auth().deleteUser(userId);
      } catch (authError: unknown) {
        const authErrorCode = authError != null && typeof authError === 'object' && 'code' in authError ? (authError as { code: string }).code : undefined;
        if (authErrorCode !== 'auth/user-not-found') {
          throw authError;
        }
      }

      // 삭제 로그 기록
      await db.collection('adminLogs').add({
        action: 'force_delete_account',
        targetUserId: userId,
        adminUid: context.auth.uid,
        reason: reason || 'No reason provided',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`관리자 강제 삭제 완료: ${userId}`);

      return {
        success: true,
        message: `Account ${userId} has been permanently deleted`,
      };
    } catch (error) {
      functions.logger.error(`관리자 강제 삭제 실패: ${userId}`, error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to delete account'
      );
    }
  }
);
