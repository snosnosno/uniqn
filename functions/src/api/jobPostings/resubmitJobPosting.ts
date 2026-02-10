import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { STATUS } from '../../constants/status';

/**
 * 거부된 대회 공고 재제출 Firebase Function
 * 공고 소유자만 - 거부된 공고를 다시 승인 대기 상태로 변경
 */
export const resubmitJobPosting = functions
  .region('asia-northeast3')
  .https.onCall(async (data: { postingId: string }, context) => {
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    // 1. 인증 체크
    if (!context.auth) {
      logger.error('resubmitJobPosting: 인증되지 않은 요청');
      throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    // 2. 파라미터 검증
    const { postingId } = data;

    if (!postingId || typeof postingId !== 'string') {
      logger.error('resubmitJobPosting: 잘못된 postingId', { postingId });
      throw new functions.https.HttpsError('invalid-argument', '공고 ID가 필요합니다');
    }

    try {
      const postingRef = db.collection('jobPostings').doc(postingId);
      const postingDoc = await postingRef.get();

      // 3. 공고 존재 확인
      if (!postingDoc.exists) {
        logger.error('resubmitJobPosting: 공고 없음', { postingId });
        throw new functions.https.HttpsError('not-found', '공고를 찾을 수 없습니다');
      }

      const posting = postingDoc.data();

      // 4. 공고 소유자 확인
      if (posting?.createdBy !== context.auth.uid) {
        logger.error('resubmitJobPosting: 권한 없음', {
          postingId,
          createdBy: posting?.createdBy,
          requestedBy: context.auth.uid
        });
        throw new functions.https.HttpsError('permission-denied', '본인이 작성한 공고만 재제출할 수 있습니다');
      }

      // 5. 대회 공고 확인
      if (posting?.postingType !== 'tournament') {
        logger.error('resubmitJobPosting: 대회 공고가 아님', {
          postingId,
          postingType: posting?.postingType
        });
        throw new functions.https.HttpsError('invalid-argument', '대회 공고만 재제출 가능합니다');
      }

      // 6. 거부 상태 확인
      if (posting?.tournamentConfig?.approvalStatus !== STATUS.TOURNAMENT.REJECTED) {
        logger.error('resubmitJobPosting: 거부 상태가 아님', {
          postingId,
          approvalStatus: posting?.tournamentConfig?.approvalStatus
        });
        throw new functions.https.HttpsError('failed-precondition', '거부된 공고만 재제출할 수 있습니다');
      }

      // 7. 공고 재제출 처리 (pending 상태로 변경)
      await postingRef.update({
        'tournamentConfig.approvalStatus': 'pending',
        'tournamentConfig.resubmittedAt': FieldValue.serverTimestamp(),
        'tournamentConfig.resubmittedBy': context.auth.uid,
        // 이전 거부 정보는 히스토리로 보존
        'tournamentConfig.previousRejection': {
          reason: posting.tournamentConfig.rejectionReason || null,
          rejectedBy: posting.tournamentConfig.rejectedBy || null,
          rejectedAt: posting.tournamentConfig.rejectedAt || null
        },
        // 거부 정보 초기화
        'tournamentConfig.rejectionReason': FieldValue.delete(),
        'tournamentConfig.rejectedBy': FieldValue.delete(),
        'tournamentConfig.rejectedAt': FieldValue.delete(),
        'updatedAt': FieldValue.serverTimestamp()
      });

      logger.info('resubmitJobPosting: 재제출 완료', {
        postingId,
        resubmittedBy: context.auth.uid
      });

      return {
        success: true,
        postingId,
        resubmittedBy: context.auth.uid,
        resubmittedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      // HttpsError는 그대로 던지기
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // 예상치 못한 에러
      logger.error('resubmitJobPosting: 예상치 못한 에러', {
        error,
        postingId
      });
      throw new functions.https.HttpsError('internal', '공고 재제출 중 오류가 발생했습니다');
    }
  });
