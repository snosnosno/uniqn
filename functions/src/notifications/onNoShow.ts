/**
 * 노쇼 알림 Firebase Functions
 *
 * @description
 * WorkLog status가 'no_show'로 변경되면 구인자에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onUpdate
 * @collection workLogs/{workLogId}
 * @version 2.0.0
 * @since 2025-02-01
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createAndSendNotification } from '../utils/notificationUtils';
import { extractUserId } from '../utils/helpers';
import { handleTriggerError } from '../errors';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface JobPostingData {
  title?: string;
  location?: string;
  ownerId?: string;
  createdBy?: string;
}

interface WorkLogData {
  staffId: string;
  jobPostingId: string;
  date?: string;
  status?: string;
  scheduledStartTime?: admin.firestore.Timestamp | string;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 노쇼 알림 트리거
 *
 * @description
 * - WorkLog status가 'no_show'로 변경되면 실행
 * - 구인자(jobPosting.ownerId/createdBy)에게 알림 전송
 */
export const onNoShow = onDocumentUpdated(
  { document: 'workLogs/{workLogId}', region: 'asia-northeast3' },
  async (event) => {
    const workLogId = event.params.workLogId;
    const before = event.data?.before.data() as WorkLogData | undefined;
    const after = event.data?.after.data() as WorkLogData | undefined;
    if (!before || !after) return;

    // status가 no_show로 변경된 경우만 처리
    if (before.status === after.status || after.status !== 'no_show') {
      return;
    }

    logger.info('노쇼 감지', {
      workLogId,
      staffId: after.staffId,
      jobPostingId: after.jobPostingId,
      beforeStatus: before.status,
      afterStatus: after.status,
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(after.jobPostingId)
        .get();

      if (!jobPostingDoc.exists) {
        logger.warn('공고를 찾을 수 없습니다', {
          workLogId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;

      const employerId = jobPosting?.ownerId ?? jobPosting?.createdBy;
      if (!employerId) {
        logger.warn('공고 작성자를 찾을 수 없습니다', {
          workLogId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      // 2. 스태프 이름 조회
      const actualUserId = extractUserId(after.staffId);
      const staffDoc = await db.collection('users').doc(actualUserId).get();
      const staffName = staffDoc.exists
        ? staffDoc.data()?.name || '스태프'
        : '스태프';

      // 3. 알림 전송
      const result = await createAndSendNotification(
        employerId,
        'no_show_alert',
        '⚠️ 노쇼 알림',
        `${staffName}님이 '${jobPosting.title || '공고'}'에 출근하지 않았습니다.`,
        {
          link: `/employer/applicants/${after.jobPostingId}`,
          priority: 'urgent',
          relatedId: workLogId,
          senderId: actualUserId,
          data: {
            workLogId,
            jobPostingId: after.jobPostingId,
            jobPostingTitle: jobPosting.title || '',
            staffId: after.staffId,
            staffName,
            date: after.date || '',
          },
        }
      );

      logger.info('노쇼 알림 전송 완료', {
        notificationId: result.notificationId,
        employerId,
        fcmSent: result.fcmSent,
        successCount: result.successCount,
      });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: 'onNoShow',
        context: { workLogId, staffId: after.staffId },
      });
    }
  });
