/**
 * 지원 확정/취소 알림 Firebase Functions
 *
 * @description
 * 지원서 상태가 변경되면 지원자에게 FCM 푸시 알림 전송
 * - applied → confirmed: 확정 알림
 * - confirmed → cancelled / applied → cancelled: 취소 알림
 *
 * @trigger Firestore onUpdate
 * @collection applications/{applicationId}
 * @version 1.0.0
 * @since 2025-10-15
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 지원 상태 변경 알림 트리거
 *
 * @description
 * - 지원서 상태 변경 감지 (applied → confirmed/cancelled)
 * - 지원자에게 FCM 푸시 알림 전송
 * - Firestore notifications 문서 생성
 * - 전송 결과 로깅
 */
export const onApplicationStatusChanged = functions.firestore
  .document('applications/{applicationId}')
  .onUpdate(async (change, context) => {
    const applicationId = context.params.applicationId;
    const before = change.before.data();
    const after = change.after.data();

    // status 변경 감지
    if (before.status === after.status) {
      return; // 상태 변경 없음
    }

    functions.logger.info('지원 상태 변경 감지', {
      applicationId,
      beforeStatus: before.status,
      afterStatus: after.status,
      applicantId: after.applicantId,
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(after.eventId)
        .get();

      if (!jobPostingDoc.exists) {
        functions.logger.warn('공고를 찾을 수 없습니다', {
          applicationId,
          eventId: after.eventId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data();
      if (!jobPosting) {
        functions.logger.warn('공고 데이터가 없습니다', { applicationId });
        return;
      }

      // 2. 지원자 정보 조회
      const applicantDoc = await db
        .collection('users')
        .doc(after.applicantId)
        .get();

      if (!applicantDoc.exists) {
        functions.logger.warn('지원자를 찾을 수 없습니다', {
          applicationId,
          applicantId: after.applicantId,
        });
        return;
      }

      const applicant = applicantDoc.data();
      if (!applicant) {
        functions.logger.warn('지원자 데이터가 없습니다', { applicationId });
        return;
      }

      // 3. 상태별 알림 처리
      if (after.status === 'confirmed') {
        // 확정 알림
        await sendConfirmationNotification(
          applicationId,
          after,
          jobPosting,
          applicant
        );
      } else if (after.status === 'cancelled') {
        // 취소 알림
        await sendCancellationNotification(
          applicationId,
          after,
          jobPosting,
          applicant
        );
      }
    } catch (error: any) {
      functions.logger.error('지원 상태 변경 알림 처리 중 오류 발생', {
        applicationId,
        error: error.message,
        stack: error.stack,
      });
    }
  });

/**
 * 확정 알림 전송
 */
async function sendConfirmationNotification(
  applicationId: string,
  application: any,
  jobPosting: any,
  applicant: any
): Promise<void> {
  const notificationTitle = '🎉 지원이 확정되었습니다!';
  const notificationBody = `'${jobPosting.title}' 지원이 확정되었습니다.`;

  functions.logger.info('확정 알림 전송 시작', {
    applicationId,
    applicantId: applicant.id || application.applicantId,
  });

  // 1. Firestore notifications 문서 생성
  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  await notificationRef.set({
    id: notificationId,
    userId: application.applicantId, // 지원자에게 전송
    type: 'staff_approval',
    category: 'work',
    priority: 'high',
    title: notificationTitle,
    body: notificationBody,
    action: {
      type: 'navigate',
      target: '/app/my-schedule',
    },
    relatedId: applicationId,
    senderId: jobPosting.createdBy,
    isRead: false,
    isSent: false,
    isLocal: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      applicationId,
      eventId: application.eventId,
      jobPostingTitle: jobPosting.title,
      location: jobPosting.location,
      district: jobPosting.district,
      detailedAddress: jobPosting.detailedAddress,
    },
  });

  functions.logger.info('확정 알림 문서 생성 완료', {
    notificationId,
    applicantId: application.applicantId,
  });

  // 2. FCM 토큰 확인 및 푸시 전송
  const fcmToken = applicant.fcmToken?.token || applicant.fcmToken;

  if (!fcmToken || typeof fcmToken !== 'string') {
    functions.logger.warn('FCM 토큰이 없습니다', {
      applicantId: application.applicantId,
      applicationId,
    });
    return;
  }

  // 3. FCM 푸시 메시지 전송
  const fcmMessage = {
    notification: {
      title: notificationTitle,
      body: notificationBody,
    },
    data: {
      type: 'staff_approval',
      notificationId,
      applicationId,
      eventId: application.eventId,
      target: '/app/my-schedule',
    },
    token: fcmToken,
    android: {
      priority: 'high' as const,
      notification: {
        sound: 'default',
        channelId: 'work',
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

    functions.logger.info('확정 알림 FCM 푸시 전송 성공', {
      applicationId,
      applicantId: application.applicantId,
      messageId: response,
    });

    // 4. 전송 성공 시 알림 문서 업데이트
    await notificationRef.update({
      isSent: true,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (fcmError: any) {
    functions.logger.error('확정 알림 FCM 푸시 전송 실패', {
      applicationId,
      applicantId: application.applicantId,
      error: fcmError.message,
      errorCode: fcmError.code,
    });
  }
}

/**
 * 취소 알림 전송
 */
async function sendCancellationNotification(
  applicationId: string,
  application: any,
  jobPosting: any,
  applicant: any
): Promise<void> {
  const notificationTitle = '확정 취소 안내';
  const notificationBody = `'${jobPosting.title}' 지원 확정이 취소되었습니다.`;

  functions.logger.info('취소 알림 전송 시작', {
    applicationId,
    applicantId: applicant.id || application.applicantId,
  });

  // 1. Firestore notifications 문서 생성
  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  await notificationRef.set({
    id: notificationId,
    userId: application.applicantId, // 지원자에게 전송
    type: 'staff_rejection',
    category: 'work',
    priority: 'medium',
    title: notificationTitle,
    body: notificationBody,
    action: {
      type: 'navigate',
      target: '/app/my-schedule',
    },
    relatedId: applicationId,
    senderId: jobPosting.createdBy,
    isRead: false,
    isSent: false,
    isLocal: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      applicationId,
      eventId: application.eventId,
      jobPostingTitle: jobPosting.title,
    },
  });

  functions.logger.info('취소 알림 문서 생성 완료', {
    notificationId,
    applicantId: application.applicantId,
  });

  // 2. FCM 토큰 확인 및 푸시 전송 (선택적)
  const fcmToken = applicant.fcmToken?.token || applicant.fcmToken;

  if (!fcmToken || typeof fcmToken !== 'string') {
    functions.logger.warn('FCM 토큰이 없습니다', {
      applicantId: application.applicantId,
      applicationId,
    });
    return;
  }

  // 3. FCM 푸시 메시지 전송
  const fcmMessage = {
    notification: {
      title: notificationTitle,
      body: notificationBody,
    },
    data: {
      type: 'staff_rejection',
      notificationId,
      applicationId,
      eventId: application.eventId,
      target: '/app/my-schedule',
    },
    token: fcmToken,
    android: {
      priority: 'normal' as const,
      notification: {
        sound: 'default',
        channelId: 'work',
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

    functions.logger.info('취소 알림 FCM 푸시 전송 성공', {
      applicationId,
      applicantId: application.applicantId,
      messageId: response,
    });

    // 4. 전송 성공 시 알림 문서 업데이트
    await notificationRef.update({
      isSent: true,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (fcmError: any) {
    functions.logger.error('취소 알림 FCM 푸시 전송 실패', {
      applicationId,
      applicantId: application.applicantId,
      error: fcmError.message,
      errorCode: fcmError.code,
    });
  }
}
