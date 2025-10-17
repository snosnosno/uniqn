/**
 * 지원서 제출 알림 Firebase Functions
 *
 * @description
 * 지원자가 구인공고에 지원하면 고용주에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onCreate
 * @collection applications/{applicationId}
 * @version 1.0.0
 * @since 2025-10-15
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 지원서 제출 알림 트리거
 *
 * @description
 * - 지원자가 공고에 지원하면 자동 실행
 * - 고용주에게 FCM 푸시 알림 전송
 * - Firestore notifications 문서 생성
 * - 전송 결과 로깅
 */
export const onApplicationSubmitted = functions.firestore
  .document('applications/{applicationId}')
  .onCreate(async (snap, context) => {
    const applicationId = context.params.applicationId;
    const application = snap.data();

    functions.logger.info('지원서 제출 알림 시작', {
      applicationId,
      applicantId: application.applicantId,
      eventId: application.eventId,
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(application.eventId)
        .get();

      if (!jobPostingDoc.exists) {
        functions.logger.warn('공고를 찾을 수 없습니다', {
          applicationId,
          eventId: application.eventId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data();
      if (!jobPosting) {
        functions.logger.warn('공고 데이터가 없습니다', { applicationId });
        return;
      }

      // 2. 고용주 정보 조회
      const employerDoc = await db
        .collection('users')
        .doc(jobPosting.createdBy)
        .get();

      if (!employerDoc.exists) {
        functions.logger.warn('고용주를 찾을 수 없습니다', {
          applicationId,
          employerId: jobPosting.createdBy,
        });
        return;
      }

      const employer = employerDoc.data();
      if (!employer) {
        functions.logger.warn('고용주 데이터가 없습니다', { applicationId });
        return;
      }

      // 3. 지원자 정보 조회
      const applicantDoc = await db
        .collection('users')
        .doc(application.applicantId)
        .get();

      if (!applicantDoc.exists) {
        functions.logger.warn('지원자를 찾을 수 없습니다', {
          applicationId,
          applicantId: application.applicantId,
        });
        return;
      }

      const applicant = applicantDoc.data();
      if (!applicant) {
        functions.logger.warn('지원자 데이터가 없습니다', { applicationId });
        return;
      }

      // 4. 알림 제목 및 내용 생성
      const notificationTitle = '📨 새로운 지원서 도착';
      const notificationBody = `${applicant.name}님이 '${jobPosting.title}'에 지원했습니다.`;

      // 5. Firestore notifications 문서 생성
      const notificationRef = db.collection('notifications').doc();
      const notificationId = notificationRef.id;

      await notificationRef.set({
        id: notificationId,
        userId: jobPosting.createdBy, // 고용주에게 전송
        type: 'job_application',
        category: 'work',
        priority: 'medium',
        title: notificationTitle,
        body: notificationBody,
        action: {
          type: 'navigate',
          target: `/applications/${applicationId}`,
        },
        relatedId: applicationId,
        senderId: application.applicantId,
        isRead: false,
        isSent: false,
        isLocal: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          applicationId,
          eventId: application.eventId,
          applicantName: applicant.name,
          jobPostingTitle: jobPosting.title,
        },
      });

      functions.logger.info('알림 문서 생성 완료', {
        notificationId,
        employerId: jobPosting.createdBy,
      });

      // 6. FCM 토큰 확인 및 푸시 전송
      const fcmToken = employer.fcmToken?.token || employer.fcmToken;

      if (!fcmToken || typeof fcmToken !== 'string') {
        functions.logger.warn('FCM 토큰이 없습니다', {
          employerId: jobPosting.createdBy,
          applicationId,
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
          type: 'job_application',
          notificationId,
          applicationId,
          eventId: application.eventId,
          target: `/applications/${applicationId}`,
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

        functions.logger.info('FCM 푸시 전송 성공', {
          applicationId,
          employerId: jobPosting.createdBy,
          messageId: response,
        });

        // 8. 전송 성공 시 알림 문서 업데이트
        await notificationRef.update({
          isSent: true,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (fcmError: any) {
        functions.logger.error('FCM 푸시 전송 실패', {
          applicationId,
          employerId: jobPosting.createdBy,
          error: fcmError.message,
          errorCode: fcmError.code,
        });

        // FCM 전송 실패해도 알림 문서는 유지 (앱 내 알림으로 표시)
      }
    } catch (error: any) {
      functions.logger.error('지원서 제출 알림 처리 중 오류 발생', {
        applicationId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
