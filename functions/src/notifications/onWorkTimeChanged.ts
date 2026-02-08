/**
 * 근무시간 변경 알림 Firebase Functions
 *
 * @description
 * 근무 로그의 예정 근무시간이 변경되면 근무자에게 FCM 푸시 알림 전송
 * - scheduledStartTime 변경
 * - scheduledEndTime 변경
 *
 * @trigger Firestore onUpdate
 * @collection workLogs/{workLogId}
 * @version 3.0.0
 * @since 2025-10-15
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createAndSendNotification } from '../utils/notificationUtils';
import { formatTime, extractUserId } from '../utils/helpers';

const db = admin.firestore();

/**
 * 근무시간 변경 알림 트리거
 *
 * @description
 * - scheduledStartTime 또는 scheduledEndTime 변경 감지
 * - 근무자에게 FCM 푸시 알림 전송
 */
export const onWorkTimeChanged = functions.region('asia-northeast3').firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const workLogId = context.params.workLogId;
    const before = change.before.data();
    const after = change.after.data();

    // scheduledStartTime 또는 scheduledEndTime 변경 감지
    const startTimeChanged =
      formatTime(before.scheduledStartTime) !== formatTime(after.scheduledStartTime);
    const endTimeChanged =
      formatTime(before.scheduledEndTime) !== formatTime(after.scheduledEndTime);

    if (!startTimeChanged && !endTimeChanged) {
      return; // 근무시간 변경 없음
    }

    functions.logger.info('근무시간 변경 감지', {
      workLogId,
      staffId: after.staffId,
      jobPostingId: after.jobPostingId,
      beforeStart: formatTime(before.scheduledStartTime),
      afterStart: formatTime(after.scheduledStartTime),
      beforeEnd: formatTime(before.scheduledEndTime),
      afterEnd: formatTime(after.scheduledEndTime),
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

      const jobPosting = jobPostingDoc.data();
      if (!jobPosting) {
        functions.logger.warn('공고 데이터가 없습니다', { workLogId });
        return;
      }

      // 2. 변경 내용 메시지 생성
      let changeDetails = '';
      if (startTimeChanged && endTimeChanged) {
        changeDetails = `시작: ${formatTime(before.scheduledStartTime)} → ${formatTime(after.scheduledStartTime)}, 종료: ${formatTime(before.scheduledEndTime)} → ${formatTime(after.scheduledEndTime)}`;
      } else if (startTimeChanged) {
        changeDetails = `시작시간: ${formatTime(before.scheduledStartTime)} → ${formatTime(after.scheduledStartTime)}`;
      } else if (endTimeChanged) {
        changeDetails = `종료시간: ${formatTime(before.scheduledEndTime)} → ${formatTime(after.scheduledEndTime)}`;
      }

      // 3. 근무자 userId 추출
      const actualUserId = extractUserId(after.staffId);

      // 4. 알림 전송
      const result = await createAndSendNotification(
        actualUserId,
        'schedule_change',
        '⏰ 근무 시간이 변경되었습니다!',
        `'${jobPosting.title}'\n${changeDetails}`,
        {
          link: '/schedule',
          priority: 'high',
          relatedId: workLogId,
          senderId: jobPosting.ownerId ?? jobPosting.createdBy ?? undefined,
          channelId: 'reminders',
          data: {
            workLogId,
            jobPostingId: after.jobPostingId,
            jobPostingTitle: jobPosting.title || '',
            scheduledStartTime: formatTime(after.scheduledStartTime),
            scheduledEndTime: formatTime(after.scheduledEndTime),
            location: jobPosting.location || '',
            district: jobPosting.district || '',
          },
        }
      );

      functions.logger.info('근무시간 변경 알림 전송 완료', {
        notificationId: result.notificationId,
        staffId: after.staffId,
        fcmSent: result.fcmSent,
        successCount: result.successCount,
      });
    } catch (error: any) {
      functions.logger.error('근무시간 변경 알림 처리 중 오류 발생', {
        workLogId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
