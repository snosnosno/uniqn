/**
 * 지원 상태 변경 알림 Firebase Functions
 *
 * @description
 * 지원서 상태가 변경되면 관련자에게 FCM 푸시 알림 전송
 * - applied → confirmed: 확정 알림 (지원자)
 * - confirmed → cancelled: 확정 취소 알림 (지원자)
 * - applied → rejected: 지원 거절 알림 (지원자)
 * - cancellation.status → approved: 취소 승인 알림 (지원자)
 * - cancellation.status → rejected: 취소 거절 알림 (지원자)
 *
 * @trigger Firestore onUpdate
 * @collection applications/{applicationId}
 * @version 3.0.0
 * @since 2025-10-15
 * @updated 2026-02-09
 *
 * @changelog
 * - 3.0.0: createAndSendNotification 유틸리티 적용
 *   (unreadCount 증가, 알림설정 확인, 만료 토큰 정리 자동 처리)
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { createAndSendNotification } from '../utils/notificationUtils';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface CancellationData {
  status?: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

interface ApplicationData {
  applicantId: string;
  applicantName?: string;
  jobPostingId: string;
  status: string;
  cancellation?: CancellationData;
}

interface JobPostingData {
  title?: string;
  location?: string;
  district?: string;
  detailedAddress?: string;
  ownerId?: string;
  createdBy?: string;
}

// ============================================================================
// Main Trigger
// ============================================================================

/**
 * 지원 상태 변경 알림 트리거
 */
export const onApplicationStatusChanged = functions.region('asia-northeast3').firestore
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
        .doc(after.jobPostingId)
        .get();

      if (!jobPostingDoc.exists) {
        functions.logger.warn('공고를 찾을 수 없습니다', {
          applicationId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;

      // 2. 상태별 알림 처리
      if (statusChanged) {
        switch (after.status) {
          case 'confirmed':
            await sendConfirmationNotification(applicationId, after, jobPosting);
            break;

          case 'cancelled':
            await sendCancellationNotification(applicationId, after, jobPosting);
            break;

          case 'rejected':
            await sendRejectionNotification(applicationId, after, jobPosting);
            break;
        }
      }

      // 3. 취소 요청 상태 변경 처리
      if (cancellationStatusChanged && after.cancellation?.status) {
        switch (after.cancellation.status) {
          case 'approved':
            await sendCancellationApprovedNotification(applicationId, after, jobPosting);
            break;

          case 'rejected':
            await sendCancellationRejectedNotification(applicationId, after, jobPosting);
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
  jobPosting: JobPostingData
): Promise<void> {
  const result = await createAndSendNotification(
    application.applicantId,
    'application_confirmed',
    '🎉 지원이 확정되었습니다!',
    `'${jobPosting.title}' 지원이 확정되었습니다.`,
    {
      link: '/schedule',
      priority: 'high',
      relatedId: applicationId,
      data: {
        applicationId,
        jobPostingId: application.jobPostingId,
        jobPostingTitle: jobPosting.title || '',
        location: jobPosting.location || '',
      },
    }
  );

  functions.logger.info('확정 알림 전송 완료', {
    applicationId,
    notificationId: result.notificationId,
    fcmSent: result.fcmSent,
    successCount: result.successCount,
  });
}

/**
 * 확정 취소 알림 전송 (지원자에게)
 */
async function sendCancellationNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData
): Promise<void> {
  const result = await createAndSendNotification(
    application.applicantId,
    'confirmation_cancelled',
    '확정 취소 안내',
    `'${jobPosting.title}' 지원 확정이 취소되었습니다.`,
    {
      link: '/schedule',
      priority: 'normal',
      relatedId: applicationId,
      data: {
        applicationId,
        jobPostingId: application.jobPostingId,
        jobPostingTitle: jobPosting.title || '',
      },
    }
  );

  functions.logger.info('취소 알림 전송 완료', {
    applicationId,
    notificationId: result.notificationId,
    fcmSent: result.fcmSent,
  });
}

/**
 * 지원 거절 알림 전송 (지원자에게)
 */
async function sendRejectionNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData
): Promise<void> {
  const result = await createAndSendNotification(
    application.applicantId,
    'application_rejected',
    '지원 결과 안내',
    `'${jobPosting.title}' 지원이 거절되었습니다.`,
    {
      link: '/my-applications',
      priority: 'normal',
      relatedId: applicationId,
      data: {
        applicationId,
        jobPostingId: application.jobPostingId,
        jobPostingTitle: jobPosting.title || '',
      },
    }
  );

  functions.logger.info('거절 알림 전송 완료', {
    applicationId,
    notificationId: result.notificationId,
    fcmSent: result.fcmSent,
  });
}

/**
 * 취소 요청 승인 알림 전송 (지원자에게)
 */
async function sendCancellationApprovedNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData
): Promise<void> {
  const result = await createAndSendNotification(
    application.applicantId,
    'cancellation_approved',
    '취소 승인 안내',
    `'${jobPosting.title}' 취소 요청이 승인되었습니다.`,
    {
      link: '/schedule',
      priority: 'normal',
      relatedId: applicationId,
      data: {
        applicationId,
        jobPostingId: application.jobPostingId,
        jobPostingTitle: jobPosting.title || '',
      },
    }
  );

  functions.logger.info('취소 승인 알림 전송 완료', {
    applicationId,
    notificationId: result.notificationId,
    fcmSent: result.fcmSent,
  });
}

/**
 * 취소 요청 거절 알림 전송 (지원자에게)
 */
async function sendCancellationRejectedNotification(
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData
): Promise<void> {
  const result = await createAndSendNotification(
    application.applicantId,
    'cancellation_rejected',
    '취소 거절 안내',
    `'${jobPosting.title}' 취소 요청이 거절되었습니다. 예정대로 근무해 주세요.`,
    {
      link: '/schedule',
      priority: 'high',
      relatedId: applicationId,
      data: {
        applicationId,
        jobPostingId: application.jobPostingId,
        jobPostingTitle: jobPosting.title || '',
      },
    }
  );

  functions.logger.info('취소 거절 알림 전송 완료', {
    applicationId,
    notificationId: result.notificationId,
    fcmSent: result.fcmSent,
  });
}
