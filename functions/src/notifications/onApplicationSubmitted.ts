/**
 * 지원서 제출 알림 Firebase Functions
 *
 * @description 지원자가 구인공고에 지원하면 고용주에게 FCM 푸시 알림 전송
 * @trigger Firestore onCreate
 * @collection applications/{applicationId}
 * @version 2.0.0
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createAndSendNotification } from '../utils/notificationUtils';
import { handleTriggerError } from '../errors';

const db = admin.firestore();

/**
 * 지원서 제출 알림 트리거
 *
 * @description
 * - 지원자가 공고에 지원하면 자동 실행
 * - 고용주에게 FCM 푸시 알림 전송
 * - 공통 유틸리티 사용으로 일관된 알림 처리
 */
export const onApplicationSubmitted = onDocumentCreated(
  { document: 'applications/{applicationId}', region: 'asia-northeast3' },
  async (event) => {
    const applicationId = event.params.applicationId;
    const application = event.data?.data();
    if (!application) return;

    logger.info('지원서 제출 알림 시작', {
      applicationId,
      applicantId: application.applicantId,
      jobPostingId: application.jobPostingId,
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(application.jobPostingId)
        .get();

      if (!jobPostingDoc.exists) {
        logger.warn('공고를 찾을 수 없습니다', {
          applicationId,
          jobPostingId: application.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data();
      if (!jobPosting) {
        logger.warn('공고 데이터가 없습니다', { applicationId });
        return;
      }

      // 2. 지원자 정보 조회
      const applicantDoc = await db
        .collection('users')
        .doc(application.applicantId)
        .get();

      if (!applicantDoc.exists) {
        logger.warn('지원자를 찾을 수 없습니다', {
          applicationId,
          applicantId: application.applicantId,
        });
        return;
      }

      const applicant = applicantDoc.data();
      if (!applicant) {
        logger.warn('지원자 데이터가 없습니다', { applicationId });
        return;
      }

      // 3. 고용주 ID 확인
      const employerId = jobPosting.ownerId;
      if (!employerId) {
        logger.error('공고 소유자 정보 누락', {
          applicationId,
          jobPostingId: application.jobPostingId,
        });
        return;
      }

      // 4. 알림 생성 및 전송 (공통 유틸리티 사용)
      const result = await createAndSendNotification(
        employerId, // 고용주에게 전송
        'new_application',
        '📨 새로운 지원자',
        `${applicant.name}님이 '${jobPosting.title}'에 지원했습니다.`,
        {
          link: `/employer/applicants/${application.jobPostingId}`,
          relatedId: applicationId,
          senderId: application.applicantId,
          data: {
            applicationId,
            jobPostingId: application.jobPostingId,
            applicantName: applicant.name || '',
            jobPostingTitle: jobPosting.title || '',
          },
        }
      );

      logger.info('지원서 제출 알림 완료', {
        applicationId,
        notificationId: result.notificationId,
        fcmSent: result.fcmSent,
        successCount: result.successCount,
      });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: 'onApplicationSubmitted',
        context: { applicationId, applicantId: application.applicantId },
      });
    }
  });
