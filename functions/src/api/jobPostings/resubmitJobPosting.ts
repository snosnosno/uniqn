import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { STATUS } from '../../constants/status';
import {
  requireAuth,
  requireString,
  NotFoundError,
  BusinessError,
  PermissionError,
  ValidationError,
  ERROR_CODES,
  handleFunctionError,
} from '../../errors';

/**
 * 거부된 대회 공고 재제출 Firebase Function
 * 공고 소유자만 - 거부된 공고를 다시 승인 대기 상태로 변경
 */
export const resubmitJobPosting = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    try {
      // 1. 인증 체크
      const userId = requireAuth(request);

      // 2. 파라미터 검증
      const postingId = requireString(request.data.postingId, '공고 ID');

      const postingRef = db.collection('jobPostings').doc(postingId);
      const postingDoc = await postingRef.get();

      // 3. 공고 존재 확인
      if (!postingDoc.exists) {
        throw new NotFoundError({
          userMessage: '공고를 찾을 수 없습니다',
          metadata: { postingId },
        });
      }

      const posting = postingDoc.data();

      // 4. 공고 소유자 확인
      if (posting?.createdBy !== userId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인이 작성한 공고만 재제출할 수 있습니다',
          metadata: { postingId },
        });
      }

      // 5. 대회 공고 확인
      if (posting?.postingType !== 'tournament') {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '대회 공고만 재제출 가능합니다',
          metadata: { postingId, postingType: posting?.postingType },
        });
      }

      // 6. 거부 상태 확인
      if (posting?.tournamentConfig?.approvalStatus !== STATUS.TOURNAMENT.REJECTED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_PREVIOUSLY_REJECTED, {
          userMessage: '거부된 공고만 재제출할 수 있습니다',
          metadata: { postingId, approvalStatus: posting?.tournamentConfig?.approvalStatus },
        });
      }

      // 7. 공고 재제출 처리 (pending 상태로 변경)
      await postingRef.update({
        'tournamentConfig.approvalStatus': 'pending',
        'tournamentConfig.resubmittedAt': FieldValue.serverTimestamp(),
        'tournamentConfig.resubmittedBy': userId,
        'tournamentConfig.previousRejection': {
          reason: posting.tournamentConfig.rejectionReason || null,
          rejectedBy: posting.tournamentConfig.rejectedBy || null,
          rejectedAt: posting.tournamentConfig.rejectedAt || null
        },
        'tournamentConfig.rejectionReason': FieldValue.delete(),
        'tournamentConfig.rejectedBy': FieldValue.delete(),
        'tournamentConfig.rejectedAt': FieldValue.delete(),
        'updatedAt': FieldValue.serverTimestamp()
      });

      logger.info('resubmitJobPosting: 재제출 완료', {
        postingId,
        resubmittedBy: userId
      });

      return {
        success: true,
        postingId,
        resubmittedBy: userId,
        resubmittedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: 'resubmitJobPosting',
        context: { postingId: request.data?.postingId },
      });
    }
  });
