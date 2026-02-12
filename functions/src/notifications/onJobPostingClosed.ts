/**
 * 공고 마감 알림 Firebase Functions
 *
 * @description
 * 공고 상태가 closed로 변경되면 해당 공고에 지원한 지원자들에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onUpdate
 * @collection jobPostings/{jobPostingId}
 * @version 2.0.0
 * @since 2025-02-01
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { broadcastNotification } from '../utils/notificationUtils';
import { STATUS } from '../constants/status';
import { handleTriggerError } from '../errors';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface ApplicationData {
  applicantId: string;
  status: string;
}

interface JobPostingData {
  title?: string;
  location?: string;
  status?: string;
  createdBy?: string;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 공고 마감 알림 트리거
 *
 * @description
 * - 공고 status가 'closed'로 변경되면 실행
 * - confirmed, pending, applied 상태의 지원자들에게 broadcastNotification으로 일괄 알림
 */
export const onJobPostingClosed = onDocumentUpdated(
  { document: 'jobPostings/{jobPostingId}', region: 'asia-northeast3' },
  async (event) => {
    const jobPostingId = event.params.jobPostingId;
    const before = event.data?.before.data() as JobPostingData | undefined;
    const after = event.data?.after.data() as JobPostingData | undefined;
    if (!before || !after) return;

    // status가 closed로 변경된 경우만 처리
    if (before.status === after.status || after.status !== STATUS.JOB_POSTING.CLOSED) {
      return;
    }

    logger.info('공고 마감 감지', {
      jobPostingId,
      beforeStatus: before.status,
      afterStatus: after.status,
    });

    try {
      // 1. 해당 공고의 지원자들 조회 (confirmed, pending, applied 상태만)
      const applicationsSnap = await db
        .collection('applications')
        .where('jobPostingId', '==', jobPostingId)
        .where('status', 'in', ['confirmed', 'pending', 'applied'])
        .get();

      if (applicationsSnap.empty) {
        logger.info('알림 대상 지원자가 없습니다', { jobPostingId });
        return;
      }

      // 2. 지원자 ID 목록 추출 (중복 제거)
      const applicantIds = [...new Set(
        applicationsSnap.docs.map((doc) => (doc.data() as ApplicationData).applicantId)
      )];

      logger.info('알림 대상 지원자 수', {
        jobPostingId,
        count: applicantIds.length,
      });

      // 3. broadcastNotification으로 일괄 전송
      const results = await broadcastNotification(
        applicantIds,
        'job_closed',
        '📋 공고 마감 안내',
        `'${after.title || '공고'}'가 마감되었습니다.`,
        {
          link: '/my-applications',
          data: {
            jobPostingId,
            jobPostingTitle: after.title || '',
          },
        }
      );

      // 4. 결과 로깅
      let totalSuccess = 0;
      let totalFailure = 0;
      results.forEach((result) => {
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;
      });

      logger.info('공고 마감 알림 전체 처리 완료', {
        jobPostingId,
        totalApplicants: applicantIds.length,
        totalSuccess,
        totalFailure,
      });
    } catch (error) {
      handleTriggerError(error, {
        operation: 'onJobPostingClosed',
        context: { jobPostingId },
      });
    }
  });
