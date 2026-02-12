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

    try {
      // 1. 인증 + 권한 체크
      const userId = requireAuth(request);
      requireRole(request, 'admin');
      await validateRateLimit(userId, RATE_LIMIT_CONFIGS.general);

      // 2. 파라미터 검증 (DB 접근 불필요 → 트랜잭션 밖)
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
      const now = admin.firestore.Timestamp.now();

      // 3-6. 트랜잭션으로 원자적 검증 + 거부 처리 (TOCTOU 방지)
      await db.runTransaction(async (transaction) => {
        const postingDoc = await transaction.get(postingRef);

        if (!postingDoc.exists) {
          throw new NotFoundError({
            userMessage: '공고를 찾을 수 없습니다',
            metadata: { postingId },
          });
        }

        const posting = postingDoc.data();

        if (posting?.postingType !== 'tournament') {
          throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
            userMessage: '대회 공고만 거부 가능합니다',
            metadata: { postingId, postingType: posting?.postingType },
          });
        }

        if (posting?.tournamentConfig?.approvalStatus !== STATUS.TOURNAMENT.PENDING) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 승인/거부된 공고입니다',
            metadata: { postingId, approvalStatus: posting?.tournamentConfig?.approvalStatus },
          });
        }

        transaction.update(postingRef, {
          'tournamentConfig.approvalStatus': 'rejected',
          'tournamentConfig.rejectedBy': userId,
          'tournamentConfig.rejectedAt': now,
          'tournamentConfig.rejectionReason': reason
        });
      });

      logger.info('rejectJobPosting: 거부 완료', {
        postingId,
        rejectedBy: userId,
        reasonLength: reason.length
      });

      return {
        success: true,
        postingId,
        rejectedBy: userId,
        rejectedAt: now.toDate().toISOString(),
        reason
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: 'rejectJobPosting',
        context: { postingId: request.data?.postingId },
      });
    }
  });
