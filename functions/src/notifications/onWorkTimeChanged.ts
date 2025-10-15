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
 * @version 1.0.0
 * @since 2025-10-15
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Firestore Timestamp를 HH:MM 형식으로 변환
 */
function formatTime(time: any): string {
  if (!time) return '';

  if (typeof time === 'string') {
    return time;
  }

  // Firestore Timestamp인 경우
  if (time.toDate) {
    const date = time.toDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return '';
}

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
      const staffDoc = await db
        .collection('users')
        .doc(after.staffId)
        .get();

      if (!staffDoc.exists) {
        functions.logger.warn('근무자를 찾을 수 없습니다', {
          workLogId,
          staffId: after.staffId,
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
        changeDetails = `시작: ${formatTime(after.scheduledStartTime)}, 종료: ${formatTime(after.scheduledEndTime)}`;
      } else if (startTimeChanged) {
        changeDetails = `시작시간: ${formatTime(after.scheduledStartTime)}`;
      } else if (endTimeChanged) {
        changeDetails = `종료시간: ${formatTime(after.scheduledEndTime)}`;
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
        userId: after.staffId, // 근무자에게 전송
        type: 'schedule_change',
        category: 'schedule',
        priority: 'high',
        title: notificationTitle,
        body: notificationBody,
        action: {
          type: 'navigate',
          target: '/app/my-schedule',
        },
        relatedId: workLogId,
        senderId: jobPosting.createdBy,
        isRead: false,
        isSent: false,
        isLocal: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          workLogId,
          eventId: after.eventId,
          jobPostingTitle: jobPosting.title,
          scheduledStartTime: formatTime(after.scheduledStartTime),
          scheduledEndTime: formatTime(after.scheduledEndTime),
          location: jobPosting.location,
          district: jobPosting.district,
          detailedAddress: jobPosting.detailedAddress,
        },
      });

      functions.logger.info('근무시간 변경 알림 문서 생성 완료', {
        notificationId,
        staffId: after.staffId,
      });

      // 6. FCM 토큰 확인 및 푸시 전송
      const fcmToken = staff.fcmToken?.token || staff.fcmToken;

      if (!fcmToken || typeof fcmToken !== 'string') {
        functions.logger.warn('FCM 토큰이 없습니다', {
          staffId: after.staffId,
          workLogId,
        });
        return;
      }

      // 7. FCM 푸시 메시지 전송
      const fcmMessage = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: 'schedule_change',
          notificationId,
          workLogId,
          eventId: after.eventId,
          target: '/app/my-schedule',
        },
        token: fcmToken,
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            channelId: 'schedule',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      try {
        const response = await admin.messaging().send(fcmMessage);

        functions.logger.info('근무시간 변경 알림 FCM 푸시 전송 성공', {
          workLogId,
          staffId: after.staffId,
          messageId: response,
        });

        // 8. 전송 성공 시 알림 문서 업데이트
        await notificationRef.update({
          isSent: true,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (fcmError: any) {
        functions.logger.error('근무시간 변경 알림 FCM 푸시 전송 실패', {
          workLogId,
          staffId: after.staffId,
          error: fcmError.message,
          errorCode: fcmError.code,
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
