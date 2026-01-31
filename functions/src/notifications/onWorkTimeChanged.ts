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
 * @version 2.0.0
 * @since 2025-10-15
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음 (fcmTokens: string[] 배열만 사용)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFcmTokens } from '../utils/fcmTokenUtils';
import { sendMulticast } from '../utils/notificationUtils';
import { formatTime, extractUserId } from '../utils/helpers';

const db = admin.firestore();

/**
 * 근무시간 변경 알림 트리거
 *
 * @description
 * - scheduledStartTime 또는 scheduledEndTime 변경 감지
 * - 근무자에게 FCM 푸시 알림 전송
 * - Firestore notifications 문서 생성
 * - 전송 결과 로깅
 */
export const onWorkTimeChanged = functions.firestore
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
      eventId: after.eventId,
      beforeStart: formatTime(before.scheduledStartTime),
      afterStart: formatTime(after.scheduledStartTime),
      beforeEnd: formatTime(before.scheduledEndTime),
      afterEnd: formatTime(after.scheduledEndTime),
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(after.eventId)
        .get();

      if (!jobPostingDoc.exists) {
        functions.logger.warn('공고를 찾을 수 없습니다', {
          workLogId,
          eventId: after.eventId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data();
      if (!jobPosting) {
        functions.logger.warn('공고 데이터가 없습니다', { workLogId });
        return;
      }

      // 2. 근무자 정보 조회
      const actualUserId = extractUserId(after.staffId);

      const staffDoc = await db
        .collection('users')
        .doc(actualUserId)
        .get();

      if (!staffDoc.exists) {
        functions.logger.warn('근무자를 찾을 수 없습니다', {
          workLogId,
          staffId: after.staffId,
          actualUserId,
        });
        return;
      }

      const staff = staffDoc.data();
      if (!staff) {
        functions.logger.warn('근무자 데이터가 없습니다', { workLogId });
        return;
      }

      // 3. 변경 내용 메시지 생성
      let changeDetails = '';
      if (startTimeChanged && endTimeChanged) {
        changeDetails = `시작: ${formatTime(before.scheduledStartTime)} → ${formatTime(after.scheduledStartTime)}, 종료: ${formatTime(before.scheduledEndTime)} → ${formatTime(after.scheduledEndTime)}`;
      } else if (startTimeChanged) {
        changeDetails = `시작시간: ${formatTime(before.scheduledStartTime)} → ${formatTime(after.scheduledStartTime)}`;
      } else if (endTimeChanged) {
        changeDetails = `종료시간: ${formatTime(before.scheduledEndTime)} → ${formatTime(after.scheduledEndTime)}`;
      }

      // 4. 알림 제목 및 내용 생성
      const notificationTitle = '⏰ 근무 시간이 변경되었습니다!';
      const notificationBody = `'${jobPosting.title}'\n${changeDetails}`;

      functions.logger.info('근무시간 변경 알림 전송 시작', {
        workLogId,
        staffId: after.staffId,
        changeDetails,
      });

      // 5. Firestore notifications 문서 생성
      const notificationRef = db.collection('notifications').doc();
      const notificationId = notificationRef.id;

      await notificationRef.set({
        id: notificationId,
        recipientId: actualUserId,
        type: 'schedule_change',
        category: 'attendance',
        priority: 'high',
        title: notificationTitle,
        body: notificationBody,
        link: '/schedule',
        relatedId: workLogId,
        senderId: jobPosting.createdBy ?? null,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          type: 'schedule_change',
          workLogId,
          eventId: after.eventId,
          jobPostingTitle: jobPosting.title,
          scheduledStartTime: formatTime(after.scheduledStartTime),
          scheduledEndTime: formatTime(after.scheduledEndTime),
          location: jobPosting.location,
          district: jobPosting.district,
        },
      });

      functions.logger.info('근무시간 변경 알림 문서 생성 완료', {
        notificationId,
        staffId: after.staffId,
      });

      // 6. FCM 토큰 확인 및 푸시 전송
      const fcmTokens = getFcmTokens(staff);

      if (fcmTokens.length === 0) {
        functions.logger.warn('FCM 토큰이 없습니다', {
          staffId: after.staffId,
          workLogId,
        });
        return;
      }

      // 7. FCM 멀티캐스트 전송 (공통 유틸리티 사용)
      const result = await sendMulticast(fcmTokens, {
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: 'schedule_change',
          notificationId,
          workLogId,
          eventId: after.eventId,
          link: '/schedule',
        },
        channelId: 'reminders',
        priority: 'high',
      });

      functions.logger.info('근무시간 변경 알림 FCM 푸시 전송 완료', {
        workLogId,
        staffId: after.staffId,
        success: result.success,
        failure: result.failure,
      });

      // 8. 전송 성공 시 알림 문서 업데이트
      if (result.success > 0) {
        await notificationRef.update({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          fcmSuccess: result.success,
          fcmFailure: result.failure,
        });
      }
    } catch (error: any) {
      functions.logger.error('근무시간 변경 알림 처리 중 오류 발생', {
        workLogId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
