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
 * 대회 공고 승인 Firebase Function
 * admin 전용 - 대회 공고를 승인하고 tournamentConfig를 업데이트
 */
export const approveJobPosting = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const db = admin.firestore();

    try {
      // 1. 인증 + 권한 체크
      const userId = requireAuth(request);
      requireRole(request, 'admin');
      await validateRateLimit(userId, RATE_LIMIT_CONFIGS.general);

      // 2. 파라미터 검증
      const postingId = requireString(request.data.postingId, '공고 ID');

      const postingRef = db.collection('jobPostings').doc(postingId);
      const now = admin.firestore.Timestamp.now();

      // 3-6. 트랜잭션으로 원자적 검증 + 승인 처리 (TOCTOU 방지)
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
            userMessage: '대회 공고만 승인 가능합니다',
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
          'tournamentConfig.approvalStatus': 'approved',
          'tournamentConfig.approvedBy': userId,
          'tournamentConfig.approvedAt': now,
        });
      });

      logger.info('approveJobPosting: 승인 완료', {
        postingId,
        approvedBy: userId
      });

      return {
        success: true,
        postingId,
        approvedBy: userId,
        approvedAt: now.toDate().toISOString()
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: 'approveJobPosting',
        context: { postingId: request.data?.postingId },
      });
    }
  });
