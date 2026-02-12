import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { STATUS } from '../../constants/status';
import {
  requireAuth,
  requireRole,
  requireString,
  NotFoundError,
  BusinessError,
  ValidationError,
  ERROR_CODES,
  handleFunctionError,
} from '../../errors';
import { validateRateLimit, RATE_LIMIT_CONFIGS } from '../../middleware/rateLimiter';

/**
 * 대회 공고 거부 Firebase Function
 * admin 전용 - 대회 공고를 거부하고 tournamentConfig를 업데이트
 */
export const rejectJobPosting = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;

    try {
      // 1. 인증 + 권한 체크
      const userId = requireAuth(request);
      requireRole(request, 'admin');
      await validateRateLimit(userId, RATE_LIMIT_CONFIGS.general);

      // 2. 파라미터 검증
      const postingId = requireString(request.data.postingId, '공고 ID');
      const reason = requireString(request.data.reason, '거부 사유');

      if (reason.length < 10) {
        throw new ValidationError(ERROR_CODES.VALIDATION_MIN_LENGTH, {
          userMessage: '거부 사유는 최소 10자 이상이어야 합니다',
          field: 'reason',
          metadata: { minLength: 10, actualLength: reason.length },
        });
      }

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

      // 4. 대회 공고 확인
      if (posting?.postingType !== 'tournament') {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '대회 공고만 거부 가능합니다',
          metadata: { postingId, postingType: posting?.postingType },
        });
      }

      // 5. 승인 대기 상태 확인
      if (posting?.tournamentConfig?.approvalStatus !== STATUS.TOURNAMENT.PENDING) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 승인/거부된 공고입니다',
          metadata: { postingId, approvalStatus: posting?.tournamentConfig?.approvalStatus },
        });
      }

      // 6. 공고 거부 처리
      await postingRef.update({
        'tournamentConfig.approvalStatus': 'rejected',
        'tournamentConfig.rejectedBy': request.auth!.uid,
        'tournamentConfig.rejectedAt': FieldValue.serverTimestamp(),
        'tournamentConfig.rejectionReason': reason
      });

      logger.info('rejectJobPosting: 거부 완료', {
        postingId,
        rejectedBy: request.auth!.uid,
        reasonLength: reason.length
      });

      return {
        success: true,
        postingId,
        rejectedBy: request.auth!.uid,
        rejectedAt: new Date().toISOString(),
        reason
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: 'rejectJobPosting',
        context: { postingId: request.data?.postingId },
      });
    }
  });
