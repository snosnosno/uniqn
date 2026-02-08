/**
 * 공고 수정 알림 Firebase Functions
 *
 * @description
 * 공고 주요 필드가 수정되면 해당 공고에 지원한 지원자들에게 FCM 푸시 알림 전송
 * - 알림 대상 필드: title, location, workDate, startTime, endTime, hourlyRate
 * - 알림 대상: confirmed, pending 상태의 지원자들
 *
 * @trigger Firestore onUpdate
 * @collection jobPostings/{jobPostingId}
 * @version 2.0.0
 * @since 2025-01-18
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음 (fcmTokens: string[] 배열만 사용)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFcmTokens } from '../utils/fcmTokenUtils';
import { sendMulticast } from '../utils/notificationUtils';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface UserData {
  fcmTokens?: string[];
  name?: string;
}

interface ApplicationData {
  applicantId: string;
  status: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 알림 대상 필드 (이 필드가 변경되면 알림 발송)
 */
const NOTIFY_FIELDS = [
  'title',
  'location',
  'district',
  'workDate',
  'startDate',
  'endDate',
  'timeSlots',
  'hourlyRate',
  'salary',
];

// ============================================================================
// Helper Functions
// ============================================================================


// ============================================================================
// Triggers
// ============================================================================

/**
 * 공고 수정 알림 트리거
 *
 * @description
 * - 공고 주요 필드 변경 감지
 * - 해당 공고에 지원한 지원자들에게 알림
 * - FCM 푸시 알림 전송 + Firestore notifications 문서 생성
 */
export const onJobPostingUpdated = functions.region('asia-northeast3').firestore
  .document('jobPostings/{jobPostingId}')
  .onUpdate(async (change, context) => {
    const jobPostingId = context.params.jobPostingId;
    const before = change.before.data();
    const after = change.after.data();

    // 주요 필드 변경 확인
    const changedFields = NOTIFY_FIELDS.filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
    );

    if (changedFields.length === 0) {
      return; // 주요 필드 변경 없음
    }

    functions.logger.info('공고 수정 감지', {
      jobPostingId,
      changedFields,
    });

    try {
      // 1. 해당 공고의 지원자들 조회 (confirmed, pending 상태만)
      const applicationsSnap = await db
        .collection('applications')
        .where('jobPostingId', '==', jobPostingId)
        .where('status', 'in', ['confirmed', 'pending', 'applied'])
        .get();

      if (applicationsSnap.empty) {
        functions.logger.info('알림 대상 지원자가 없습니다', { jobPostingId });
        return;
      }

      functions.logger.info('알림 대상 지원자 수', {
        jobPostingId,
        count: applicationsSnap.size,
      });

      // 2. 각 지원자에게 알림 발송
      const notificationPromises = applicationsSnap.docs.map(async (doc) => {
        const application = doc.data() as ApplicationData;

        try {
          // 지원자 정보 조회
          const userDoc = await db
            .collection('users')
            .doc(application.applicantId)
            .get();

          if (!userDoc.exists) {
            functions.logger.warn('지원자를 찾을 수 없습니다', {
              applicantId: application.applicantId,
            });
            return;
          }

          const user = userDoc.data() as UserData;

          // 알림 내용 생성
          const notificationTitle = '📝 공고 수정 안내';
          const notificationBody = `'${after.title || '공고'}' 공고가 수정되었습니다. 변경 내용을 확인하세요.`;

          // Firestore notifications 문서 생성
          const notificationRef = db.collection('notifications').doc();
          const notificationId = notificationRef.id;

          await notificationRef.set({
            id: notificationId,
            recipientId: application.applicantId,
            type: 'job_updated',
            category: 'job',
            priority: 'normal',
            title: notificationTitle,
            body: notificationBody,
            link: `/jobs/${jobPostingId}`,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            data: {
              jobPostingId,
              jobPostingTitle: after.title || '',
              changedFields: changedFields.join(', '),
            },
          });

          // FCM 푸시 전송
          const fcmTokens = getFcmTokens(user);

          if (fcmTokens.length > 0) {
            const result = await sendMulticast(fcmTokens, {
              title: notificationTitle,
              body: notificationBody,
              data: {
                type: 'job_updated',
                notificationId,
                jobPostingId,
                target: `/jobs/${jobPostingId}`,
              },
              channelId: 'announcements',
              priority: 'normal',
            });

            if (result.success > 0) {
              await notificationRef.update({
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            functions.logger.info('공고 수정 알림 전송 완료', {
              applicantId: application.applicantId,
              success: result.success,
              failure: result.failure,
            });
          }
        } catch (error) {
          functions.logger.error('지원자 알림 전송 실패', {
            applicantId: application.applicantId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.all(notificationPromises);

      functions.logger.info('공고 수정 알림 전체 처리 완료', {
        jobPostingId,
        totalApplicants: applicationsSnap.size,
      });
    } catch (error) {
      functions.logger.error('공고 수정 알림 처리 중 오류 발생', {
        jobPostingId,
        error: error instanceof Error ? error.stack : String(error),
      });
    }
  });
