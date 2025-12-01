import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

/**
 * 대회 공고 거부 Firebase Function
 * admin 전용 - 대회 공고를 거부하고 tournamentConfig를 업데이트
 */
export const rejectJobPosting = functions
  .region('asia-northeast3')
  .https.onCall(async (data: { postingId: string; reason: string }, context) => {
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    // 1. 인증 체크
    if (!context.auth) {
      logger.error('rejectJobPosting: 인증되지 않은 요청');
      throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    // 2. admin 권한 체크
    if (context.auth.token.role !== 'admin') {
      logger.error('rejectJobPosting: admin 권한 없음', {
        userId: context.auth.uid,
        role: context.auth.token.role
      });
      throw new functions.https.HttpsError('permission-denied', 'Admin 권한이 필요합니다');
    }

    // 3. 파라미터 검증
    const { postingId, reason } = data;

    if (!postingId || typeof postingId !== 'string') {
      logger.error('rejectJobPosting: 잘못된 postingId', { postingId });
      throw new functions.https.HttpsError('invalid-argument', '공고 ID가 필요합니다');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      logger.error('rejectJobPosting: 잘못된 거부 사유', {
        postingId,
        reasonLength: reason?.length || 0
      });
      throw new functions.https.HttpsError('invalid-argument', '거부 사유는 최소 10자 이상이어야 합니다');
    }

    try {
      const postingRef = db.collection('jobPostings').doc(postingId);
      const postingDoc = await postingRef.get();

      // 4. 공고 존재 확인
      if (!postingDoc.exists) {
        logger.error('rejectJobPosting: 공고 없음', { postingId });
        throw new functions.https.HttpsError('not-found', '공고를 찾을 수 없습니다');
      }

      const posting = postingDoc.data();

      // 5. 대회 공고 확인
      if (posting?.postingType !== 'tournament') {
        logger.error('rejectJobPosting: 대회 공고가 아님', {
          postingId,
          postingType: posting?.postingType
        });
        throw new functions.https.HttpsError('invalid-argument', '대회 공고만 거부 가능합니다');
      }

      // 6. 승인 대기 상태 확인
      if (posting?.tournamentConfig?.approvalStatus !== 'pending') {
        logger.error('rejectJobPosting: 이미 처리됨', {
          postingId,
          approvalStatus: posting?.tournamentConfig?.approvalStatus
        });
        throw new functions.https.HttpsError('failed-precondition', '이미 승인/거부된 공고입니다');
      }

      // 7. 공고 거부 처리
      await postingRef.update({
        'tournamentConfig.approvalStatus': 'rejected',
        'tournamentConfig.rejectedBy': context.auth.uid,
        'tournamentConfig.rejectedAt': FieldValue.serverTimestamp(),
        'tournamentConfig.rejectionReason': reason.trim()
      });

      logger.info('rejectJobPosting: 거부 완료', {
        postingId,
        rejectedBy: context.auth.uid,
        reasonLength: reason.trim().length
      });

      return {
        success: true,
        postingId,
        rejectedBy: context.auth.uid,
        rejectedAt: new Date().toISOString(),
        reason: reason.trim()
      };
    } catch (error: unknown) {
      // HttpsError는 그대로 던지기
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // 예상치 못한 에러
      logger.error('rejectJobPosting: 예상치 못한 에러', {
        error,
        postingId
      });
      throw new functions.https.HttpsError('internal', '공고 거부 중 오류가 발생했습니다');
    }
  });
