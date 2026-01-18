/**
 * 지원 상태 변경 알림 Firebase Functions
 *
 * @description
 * 지원서 상태가 변경되면 관련자에게 FCM 푸시 알림 전송
 * - applied → confirmed: 확정 알림 (지원자)
 * - confirmed → cancelled: 확정 취소 알림 (지원자)
 * - applied → rejected: 지원 거절 알림 (지원자)
 * - applied → withdrawn: 지원 철회 알림 (구인자)
 * - cancellation.status → approved: 취소 승인 알림 (지원자)
 * - cancellation.status → rejected: 취소 거절 알림 (지원자)
 *
 * @trigger Firestore onUpdate
 * @collection applications/{applicationId}
 * @version 2.0.0
 * @since 2025-10-15
 * @updated 2025-01-18
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface UserData {
  fcmTokens?: string[];
  fcmToken?: string | { token: string };
  name?: string;
}

interface CancellationData {
  status?: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

interface ApplicationData {
  applicantId: string;
  applicantName?: string;
  eventId: string;
  status: string;
  cancellation?: CancellationData;
}

interface JobPostingData {
  title?: string;
  location?: string;
  district?: string;
  detailedAddress?: string;
  createdBy?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 사용자의 FCM 토큰 배열 가져오기
 */
function getFcmTokens(userData: UserData): string[] {
  const tokens: string[] = [];

  if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
    tokens.push(
      ...userData.fcmTokens.filter((t) => typeof t === 'string' && t.length > 0)
    );
  }

  if (userData.fcmToken) {
    const token =
      typeof userData.fcmToken === 'string'
        ? userData.fcmToken
        : userData.fcmToken.token;
    if (token && typeof token === 'string' && !tokens.includes(token)) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * FCM 푸시 알림 전송 (단일 토큰)
 * @deprecated Use sendPushNotification instead
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function sendFcmMessage(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
  priority: 'high' | 'normal' = 'high',
  channelId: string = 'application'
): Promise<string | null> {
  const fcmMessage: admin.messaging.Message = {
    notification: { title, body },
    data,
    token,
    android: {
      priority,
      notification: {
        sound: 'default',
        channelId,
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
    return response;
  } catch (error) {
    return null;
  }
}

/**
 * FCM 푸시 알림 전송 (멀티캐스트)
 */
async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  channelId: string = 'application'
): Promise<{ success: number; failure: number }> {
  if (tokens.length === 0) {
    return { success: 0, failure: 0 };
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId,
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
    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      success: response.successCount,
      failure: response.failureCount,
    };
  } catch (error) {
    functions.logger.error('FCM 전송 실패', { error });
    return { success: 0, failure: tokens.length };
  }
}

// ============================================================================
// Main Trigger
// ============================================================================

/**
 * 지원 상태 변경 알림 트리거
 */
export const onApplicationStatusChanged = functions.firestore
  .document('applications/{applicationId}')
  .onUpdate(async (change, context) => {
    const applicationId = context.params.applicationId;
    const before = change.before.data() as ApplicationData;
    const after = change.after.data() as ApplicationData;

    // 상태 변경 감지
    const statusChanged = before.status !== after.status;
    const cancellationStatusChanged =
      before.cancellation?.status !== after.cancellation?.status;

    if (!statusChanged && !cancellationStatusChanged) {
      return; // 관련 변경 없음
    }

    functions.logger.info('지원 상태 변경 감지', {
      applicationId,
      beforeStatus: before.status,
      afterStatus: after.status,
      beforeCancellation: before.cancellation?.status,
      afterCancellation: after.cancellation?.status,
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

      const jobPosting = jobPostingDoc.data() as JobPostingData;

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

      const applicant = applicantDoc.data() as UserData;

      // 3. 상태별 알림 처리
      if (statusChanged) {
        switch (after.status) {
          case 'confirmed':
            await sendConfirmationNotification(
              applicationId,
              after,
              jobPosting,
              applicant
            );
            break;

          case 'cancelled':
            await sendCancellationNotification(
              applicationId,
              after,
              jobPosting,
              applicant
            );
            break;

          case 'rejected':
            await sendRejectionNotification(
              applicationId,
              after,
              jobPosting,
              applicant
            );
            break;

          case 'withdrawn':
            await sendWithdrawnNotification(
              applicationId,
              after,
              jobPosting
            );
            break;
        }
      }

      // 4. 취소 요청 상태 변경 처리
      if (cancellationStatusChanged && after.cancellation?.status) {
        switch (after.cancellation.status) {
          case 'approved':
            await sendCancellationApprovedNotification(
              applicationId,
              after,
              jobPosting,
              applicant
            );
            break;

          case 'rejected':
            await sendCancellationRejectedNotification(
              applicationId,
              after,
              jobPosting,
              applicant
            );
            break;
        }
      }
    } catch (error: any) {
      functions.logger.error('지원 상태 변경 알림 처리 중 오류 발생', {
        applicationId,
        error: error.message,
        stack: error.stack,
      });
    }
  });

// ============================================================================
// Notification Senders
// ============================================================================

/**
 * 확정 알림 전송 (지원자에게)
 */
async function sendConfirmationNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData,
  applicant: UserData
): Promise<void> {
  const notificationTitle = '🎉 지원이 확정되었습니다!';
  const notificationBody = `'${jobPosting.title}' 지원이 확정되었습니다.`;

  functions.logger.info('확정 알림 전송 시작', {
    applicationId,
    applicantId: application.applicantId,
  });

  // Firestore notifications 문서 생성
  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  await notificationRef.set({
    id: notificationId,
    recipientId: application.applicantId,
    type: 'application_confirmed',
    category: 'application',
    priority: 'high',
    title: notificationTitle,
    body: notificationBody,
    link: '/app/my-schedule',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      applicationId,
      eventId: application.eventId,
      jobPostingTitle: jobPosting.title || '',
      location: jobPosting.location || '',
    },
  });

  // FCM 푸시 전송
  const fcmTokens = getFcmTokens(applicant);

  if (fcmTokens.length > 0) {
    const result = await sendPushNotification(
      fcmTokens,
      notificationTitle,
      notificationBody,
      {
        type: 'application_confirmed',
        notificationId,
        applicationId,
        eventId: application.eventId,
        target: '/app/my-schedule',
      }
    );

    if (result.success > 0) {
      await notificationRef.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    functions.logger.info('확정 알림 FCM 전송 완료', {
      applicationId,
      success: result.success,
      failure: result.failure,
    });
  }
}

/**
 * 확정 취소 알림 전송 (지원자에게)
 */
async function sendCancellationNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData,
  applicant: UserData
): Promise<void> {
  const notificationTitle = '확정 취소 안내';
  const notificationBody = `'${jobPosting.title}' 지원 확정이 취소되었습니다.`;

  functions.logger.info('취소 알림 전송 시작', {
    applicationId,
    applicantId: application.applicantId,
  });

  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  await notificationRef.set({
    id: notificationId,
    recipientId: application.applicantId,
    type: 'confirmation_cancelled',
    category: 'application',
    priority: 'medium',
    title: notificationTitle,
    body: notificationBody,
    link: '/app/my-schedule',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      applicationId,
      eventId: application.eventId,
      jobPostingTitle: jobPosting.title || '',
    },
  });

  const fcmTokens = getFcmTokens(applicant);

  if (fcmTokens.length > 0) {
    const result = await sendPushNotification(
      fcmTokens,
      notificationTitle,
      notificationBody,
      {
        type: 'confirmation_cancelled',
        notificationId,
        applicationId,
        eventId: application.eventId,
        target: '/app/my-schedule',
      }
    );

    if (result.success > 0) {
      await notificationRef.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    functions.logger.info('취소 알림 FCM 전송 완료', {
      applicationId,
      success: result.success,
      failure: result.failure,
    });
  }
}

/**
 * 지원 거절 알림 전송 (지원자에게)
 */
async function sendRejectionNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData,
  applicant: UserData
): Promise<void> {
  const notificationTitle = '지원 결과 안내';
  const notificationBody = `'${jobPosting.title}' 지원이 거절되었습니다.`;

  functions.logger.info('거절 알림 전송 시작', {
    applicationId,
    applicantId: application.applicantId,
  });

  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  await notificationRef.set({
    id: notificationId,
    recipientId: application.applicantId,
    type: 'application_rejected',
    category: 'application',
    priority: 'medium',
    title: notificationTitle,
    body: notificationBody,
    link: '/app/applications',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      applicationId,
      eventId: application.eventId,
      jobPostingTitle: jobPosting.title || '',
    },
  });

  const fcmTokens = getFcmTokens(applicant);

  if (fcmTokens.length > 0) {
    const result = await sendPushNotification(
      fcmTokens,
      notificationTitle,
      notificationBody,
      {
        type: 'application_rejected',
        notificationId,
        applicationId,
        eventId: application.eventId,
        target: '/app/applications',
      }
    );

    if (result.success > 0) {
      await notificationRef.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    functions.logger.info('거절 알림 FCM 전송 완료', {
      applicationId,
      success: result.success,
      failure: result.failure,
    });
  }
}

/**
 * 지원 철회 알림 전송 (구인자에게)
 */
async function sendWithdrawnNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData
): Promise<void> {
  // 구인자에게 알림
  if (!jobPosting.createdBy) {
    functions.logger.warn('구인자 ID를 찾을 수 없습니다', { applicationId });
    return;
  }

  const employerDoc = await db
    .collection('users')
    .doc(jobPosting.createdBy)
    .get();

  if (!employerDoc.exists) {
    functions.logger.warn('구인자를 찾을 수 없습니다', {
      applicationId,
      employerId: jobPosting.createdBy,
    });
    return;
  }

  const employer = employerDoc.data() as UserData;

  const applicantName = application.applicantName || '지원자';
  const notificationTitle = '지원 철회 알림';
  const notificationBody = `${applicantName}님이 '${jobPosting.title}' 지원을 철회했습니다.`;

  functions.logger.info('철회 알림 전송 시작', {
    applicationId,
    employerId: jobPosting.createdBy,
  });

  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  await notificationRef.set({
    id: notificationId,
    recipientId: jobPosting.createdBy,
    type: 'application_withdrawn',
    category: 'application',
    priority: 'medium',
    title: notificationTitle,
    body: notificationBody,
    link: `/employer/my-postings/${application.eventId}/applicants`,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      applicationId,
      eventId: application.eventId,
      jobPostingTitle: jobPosting.title || '',
      applicantId: application.applicantId,
      applicantName,
    },
  });

  const fcmTokens = getFcmTokens(employer);

  if (fcmTokens.length > 0) {
    const result = await sendPushNotification(
      fcmTokens,
      notificationTitle,
      notificationBody,
      {
        type: 'application_withdrawn',
        notificationId,
        applicationId,
        eventId: application.eventId,
        target: `/employer/my-postings/${application.eventId}/applicants`,
      }
    );

    if (result.success > 0) {
      await notificationRef.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    functions.logger.info('철회 알림 FCM 전송 완료', {
      applicationId,
      success: result.success,
      failure: result.failure,
    });
  }
}

/**
 * 취소 요청 승인 알림 전송 (지원자에게)
 */
async function sendCancellationApprovedNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData,
  applicant: UserData
): Promise<void> {
  const notificationTitle = '취소 승인 안내';
  const notificationBody = `'${jobPosting.title}' 취소 요청이 승인되었습니다.`;

  functions.logger.info('취소 승인 알림 전송 시작', {
    applicationId,
    applicantId: application.applicantId,
  });

  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  await notificationRef.set({
    id: notificationId,
    recipientId: application.applicantId,
    type: 'cancellation_approved',
    category: 'application',
    priority: 'medium',
    title: notificationTitle,
    body: notificationBody,
    link: '/app/my-schedule',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      applicationId,
      eventId: application.eventId,
      jobPostingTitle: jobPosting.title || '',
    },
  });

  const fcmTokens = getFcmTokens(applicant);

  if (fcmTokens.length > 0) {
    const result = await sendPushNotification(
      fcmTokens,
      notificationTitle,
      notificationBody,
      {
        type: 'cancellation_approved',
        notificationId,
        applicationId,
        eventId: application.eventId,
        target: '/app/my-schedule',
      }
    );

    if (result.success > 0) {
      await notificationRef.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    functions.logger.info('취소 승인 알림 FCM 전송 완료', {
      applicationId,
      success: result.success,
      failure: result.failure,
    });
  }
}

/**
 * 취소 요청 거절 알림 전송 (지원자에게)
 */
async function sendCancellationRejectedNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData,
  applicant: UserData
): Promise<void> {
  const notificationTitle = '취소 거절 안내';
  const notificationBody = `'${jobPosting.title}' 취소 요청이 거절되었습니다. 예정대로 근무해 주세요.`;

  functions.logger.info('취소 거절 알림 전송 시작', {
    applicationId,
    applicantId: application.applicantId,
  });

  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  await notificationRef.set({
    id: notificationId,
    recipientId: application.applicantId,
    type: 'cancellation_rejected',
    category: 'application',
    priority: 'high',
    title: notificationTitle,
    body: notificationBody,
    link: '/app/my-schedule',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      applicationId,
      eventId: application.eventId,
      jobPostingTitle: jobPosting.title || '',
    },
  });

  const fcmTokens = getFcmTokens(applicant);

  if (fcmTokens.length > 0) {
    const result = await sendPushNotification(
      fcmTokens,
      notificationTitle,
      notificationBody,
      {
        type: 'cancellation_rejected',
        notificationId,
        applicationId,
        eventId: application.eventId,
        target: '/app/my-schedule',
      }
    );

    if (result.success > 0) {
      await notificationRef.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    functions.logger.info('취소 거절 알림 FCM 전송 완료', {
      applicationId,
      success: result.success,
      failure: result.failure,
    });
  }
}
