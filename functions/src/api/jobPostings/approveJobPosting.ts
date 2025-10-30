import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * 대회 공고 승인 Firebase Function
 * admin 전용 - 대회 공고를 승인하고 tournamentConfig를 업데이트
 */
export const approveJobPosting = onCall(async (request) => {
  // 1. 인증 체크
  if (!request.auth) {
    logger.error('approveJobPosting: 인증되지 않은 요청');
    throw new HttpsError('unauthenticated', '로그인이 필요합니다');
  }

  // 2. admin 권한 체크
  if (request.auth.token.role !== 'admin') {
    logger.error('approveJobPosting: admin 권한 없음', {
      userId: request.auth.uid,
      role: request.auth.token.role
    });
    throw new HttpsError('permission-denied', 'Admin 권한이 필요합니다');
  }

  // 3. 파라미터 검증
  const { postingId } = request.data;

  if (!postingId || typeof postingId !== 'string') {
    logger.error('approveJobPosting: 잘못된 postingId', { postingId });
    throw new HttpsError('invalid-argument', '공고 ID가 필요합니다');
  }

  try {
    const postingRef = db.collection('jobPostings').doc(postingId);
    const postingDoc = await postingRef.get();

    // 4. 공고 존재 확인
    if (!postingDoc.exists) {
      logger.error('approveJobPosting: 공고 없음', { postingId });
      throw new HttpsError('not-found', '공고를 찾을 수 없습니다');
    }

    const posting = postingDoc.data();

    // 5. 대회 공고 확인
    if (posting?.postingType !== 'tournament') {
      logger.error('approveJobPosting: 대회 공고가 아님', {
        postingId,
        postingType: posting?.postingType
      });
      throw new HttpsError('invalid-argument', '대회 공고만 승인 가능합니다');
    }

    // 6. 승인 대기 상태 확인
    if (posting?.tournamentConfig?.approvalStatus !== 'pending') {
      logger.error('approveJobPosting: 이미 처리됨', {
        postingId,
        approvalStatus: posting?.tournamentConfig?.approvalStatus
      });
      throw new HttpsError('failed-precondition', '이미 승인/거부된 공고입니다');
    }

    // 7. 공고 승인 처리
    await postingRef.update({
      'tournamentConfig.approvalStatus': 'approved',
      'tournamentConfig.approvedBy': request.auth.uid,
      'tournamentConfig.approvedAt': FieldValue.serverTimestamp()
    });

    logger.info('approveJobPosting: 승인 완료', {
      postingId,
      approvedBy: request.auth.uid
    });

    return {
      success: true,
      postingId,
      approvedBy: request.auth.uid,
      approvedAt: new Date().toISOString()
    };
  } catch (error: any) {
    // HttpsError는 그대로 던지기
    if (error instanceof HttpsError) {
      throw error;
    }

    // 예상치 못한 에러
    logger.error('approveJobPosting: 예상치 못한 에러', {
      error,
      postingId
    });
    throw new HttpsError('internal', '공고 승인 중 오류가 발생했습니다');
  }
});
