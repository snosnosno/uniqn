/**
 * 지원서 제출 알림 Firebase Functions
 *
 * @description 지원자가 구인공고에 지원하면 고용주에게 FCM 푸시 알림 전송
 * @trigger Firestore onCreate
 * @collection applications/{applicationId}
 * @version 2.0.0
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { createAndSendNotification } from '../utils/notificationUtils';

const db = admin.firestore();

/**
 * 지원서 제출 알림 트리거
 *
 * @description
 * - 지원자가 공고에 지원하면 자동 실행
 * - 고용주에게 FCM 푸시 알림 전송
 * - 공통 유틸리티 사용으로 일관된 알림 처리
 */
export const onApplicationSubmitted = functions.region('asia-northeast3').firestore
  .document('applications/{applicationId}')
  .onCreate(async (snap, context) => {
    const applicationId = context.params.applicationId;
    const application = snap.data();

    functions.logger.info('지원서 제출 알림 시작', {
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
        functions.logger.warn('공고를 찾을 수 없습니다', {
          applicationId,
          jobPostingId: application.jobPostingId,
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

      // 3. 고용주 ID 확인
      const employerId = jobPosting.ownerId ?? jobPosting.createdBy;
      if (!employerId) {
        functions.logger.error('공고 소유자 정보 누락', {
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

      functions.logger.info('지원서 제출 알림 완료', {
        applicationId,
        notificationId: result.notificationId,
        fcmSent: result.fcmSent,
        successCount: result.successCount,
      });
    } catch (error: unknown) {
      functions.logger.error('지원서 제출 알림 처리 중 오류 발생', {
        applicationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });
