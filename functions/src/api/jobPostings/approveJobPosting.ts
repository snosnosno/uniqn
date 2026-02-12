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
    const FieldValue = admin.firestore.FieldValue;

    try {
      // 1. 인증 + 권한 체크
      const userId = requireAuth(request);
      requireRole(request, 'admin');
      await validateRateLimit(userId, RATE_LIMIT_CONFIGS.general);

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

      // 4. 대회 공고 확인
      if (posting?.postingType !== 'tournament') {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '대회 공고만 승인 가능합니다',
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

      // 6. 공고 승인 처리
      await postingRef.update({
        'tournamentConfig.approvalStatus': 'approved',
        'tournamentConfig.approvedBy': request.auth!.uid,
        'tournamentConfig.approvedAt': FieldValue.serverTimestamp()
      });

      logger.info('approveJobPosting: 승인 완료', {
        postingId,
        approvedBy: request.auth!.uid
      });

      return {
        success: true,
        postingId,
        approvedBy: request.auth!.uid,
        approvedAt: new Date().toISOString()
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: 'approveJobPosting',
        context: { postingId: request.data?.postingId },
      });
    }
  });
