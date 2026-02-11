/**
 * 스케줄(WorkLog) 생성/취소 알림 Firebase Functions
 *
 * @description
 * WorkLog(스케줄)가 생성되거나 상태가 변경되면 근무자에게 FCM 푸시 알림 전송
 * - WorkLog 생성: 새로운 근무 배정 알림
 * - WorkLog status → cancelled: 근무 취소 알림
 *
 * @trigger Firestore onCreate, onUpdate
 * @collection workLogs/{workLogId}
 * @version 3.0.0
 * @since 2025-12-22
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { createAndSendNotification } from '../utils/notificationUtils';
import { formatTime, extractUserId } from '../utils/helpers';
import { STATUS } from '../constants/status';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface JobPostingData {
  title?: string;
  location?: string;
  district?: string;
  detailedAddress?: string;
  ownerId?: string;
  createdBy?: string;
}

interface WorkLogData {
  staffId: string;
  jobPostingId: string;
  date?: string;
  role?: string;
  status?: string;
  scheduledStartTime?: admin.firestore.Timestamp | string;
  scheduledEndTime?: admin.firestore.Timestamp | string;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 새 스케줄(WorkLog) 생성 알림 트리거
 *
 * @description
 * - 새로운 WorkLog 문서 생성 시 근무자에게 알림
 */
export const onScheduleCreated = functions.region('asia-northeast3').firestore
  .document('workLogs/{workLogId}')
  .onCreate(async (snap, context) => {
    const workLogId = context.params.workLogId;
    const workLog = snap.data() as WorkLogData;

    functions.logger.info('새 스케줄 생성 감지', {
      workLogId,
      staffId: workLog.staffId,
      jobPostingId: workLog.jobPostingId,
      date: workLog.date,
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(workLog.jobPostingId)
        .get();

      if (!jobPostingDoc.exists) {
        functions.logger.warn('공고를 찾을 수 없습니다', {
          workLogId,
          jobPostingId: workLog.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;
      const actualUserId = extractUserId(workLog.staffId);

      // 2. 알림 내용 생성
      const timeInfo = workLog.scheduledStartTime && workLog.scheduledEndTime
        ? ` (${formatTime(workLog.scheduledStartTime)} - ${formatTime(workLog.scheduledEndTime)})`
        : '';
      const notificationBody = `'${jobPosting?.title || '이벤트'}' ${workLog.date || ''}${timeInfo}`;

      // 3. 알림 전송
      const result = await createAndSendNotification(
        actualUserId,
        'schedule_created',
        '📅 새로운 근무가 배정되었습니다!',
        notificationBody,
        {
          link: '/schedule',
          priority: 'high',
          relatedId: workLogId,
          senderId: jobPosting?.ownerId ?? jobPosting?.createdBy ?? undefined,
          data: {
            workLogId,
            jobPostingId: workLog.jobPostingId,
            jobPostingTitle: jobPosting?.title || '',
            date: workLog.date || '',
            role: workLog.role || '',
            scheduledStartTime: formatTime(workLog.scheduledStartTime),
            scheduledEndTime: formatTime(workLog.scheduledEndTime),
            location: jobPosting?.location || '',
            district: jobPosting?.district || '',
          },
        }
      );

      functions.logger.info('스케줄 생성 알림 전송 완료', {
        notificationId: result.notificationId,
        staffId: workLog.staffId,
        fcmSent: result.fcmSent,
      });
    } catch (error: unknown) {
      functions.logger.error('스케줄 생성 알림 처리 중 오류 발생', {
        workLogId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

/**
 * 스케줄(WorkLog) 취소 알림 트리거
 *
 * @description
 * - WorkLog status가 'cancelled'로 변경 시 근무자에게 알림
 */
export const onScheduleCancelled = functions.region('asia-northeast3').firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const workLogId = context.params.workLogId;
    const before = change.before.data() as WorkLogData;
    const after = change.after.data() as WorkLogData;

    // status가 cancelled로 변경된 경우만 처리
    if (before.status === after.status || after.status !== STATUS.APPLICATION.CANCELLED) {
      return;
    }

    functions.logger.info('스케줄 취소 감지', {
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
        functions.logger.warn('공고를 찾을 수 없습니다', {
          workLogId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;
      const actualUserId = extractUserId(after.staffId);

      // 2. 알림 전송
      const result = await createAndSendNotification(
        actualUserId,
        'schedule_cancelled',
        '❌ 근무가 취소되었습니다',
        `'${jobPosting?.title || '이벤트'}' ${after.date || ''} 근무가 취소되었습니다.`,
        {
          link: '/schedule',
          priority: 'high',
          relatedId: workLogId,
          senderId: jobPosting?.ownerId ?? jobPosting?.createdBy ?? undefined,
          data: {
            workLogId,
            jobPostingId: after.jobPostingId,
            jobPostingTitle: jobPosting?.title || '',
            date: after.date || '',
            role: after.role || '',
          },
        }
      );

      functions.logger.info('스케줄 취소 알림 전송 완료', {
        notificationId: result.notificationId,
        staffId: after.staffId,
        fcmSent: result.fcmSent,
      });
    } catch (error: unknown) {
      functions.logger.error('스케줄 취소 알림 처리 중 오류 발생', {
        workLogId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });
