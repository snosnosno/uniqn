/**
 * 공고 마감 알림 Firebase Functions
 *
 * @description
 * 공고 상태가 closed로 변경되면 해당 공고에 지원한 지원자들에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onUpdate
 * @collection jobPostings/{jobPostingId}
 * @version 1.0.0
 * @since 2025-02-01
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

interface JobPostingData {
  title?: string;
  location?: string;
  status?: string;
  createdBy?: string;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 공고 마감 알림 트리거
 *
 * @description
 * - 공고 status가 'closed'로 변경되면 실행
 * - confirmed, pending, applied 상태의 지원자들에게 알림 전송
 * - Firestore notifications 문서 생성 + FCM 푸시 전송
 */
export const onJobPostingClosed = functions.firestore
  .document('jobPostings/{jobPostingId}')
  .onUpdate(async (change, context) => {
    const jobPostingId = context.params.jobPostingId;
    const before = change.before.data() as JobPostingData;
    const after = change.after.data() as JobPostingData;

    // status가 closed로 변경된 경우만 처리
    if (before.status === after.status || after.status !== 'closed') {
      return;
    }

    functions.logger.info('공고 마감 감지', {
      jobPostingId,
      beforeStatus: before.status,
      afterStatus: after.status,
    });

    try {
      // 1. 해당 공고의 지원자들 조회 (confirmed, pending, applied 상태만)
      const applicationsSnap = await db
        .collection('applications')
        .where('eventId', '==', jobPostingId)
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

      // 2. 알림 내용 생성
      const notificationTitle = '📋 공고 마감 안내';
      const notificationBody = `'${after.title || '공고'}'가 마감되었습니다.`;

      // 3. 각 지원자에게 알림 발송
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

          // Firestore notifications 문서 생성
          const notificationRef = db.collection('notifications').doc();
          const notificationId = notificationRef.id;

          await notificationRef.set({
            id: notificationId,
            recipientId: application.applicantId,
            type: 'job_closed',
            category: 'job',
            priority: 'normal',
            title: notificationTitle,
            body: notificationBody,
            link: '/my-applications',
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            data: {
              jobPostingId,
              jobPostingTitle: after.title || '',
            },
          });

          // FCM 푸시 전송
          const fcmTokens = getFcmTokens(user);

          if (fcmTokens.length > 0) {
            const result = await sendMulticast(fcmTokens, {
              title: notificationTitle,
              body: notificationBody,
              data: {
                type: 'job_closed',
                notificationId,
                jobPostingId,
                target: '/my-applications',
              },
              channelId: 'announcements',
              priority: 'normal',
            });

            if (result.success > 0) {
              await notificationRef.update({
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            functions.logger.info('공고 마감 알림 전송 완료', {
              applicantId: application.applicantId,
              success: result.success,
              failure: result.failure,
            });
          }
        } catch (error: any) {
          functions.logger.error('지원자 알림 전송 실패', {
            applicantId: application.applicantId,
            error: error.message,
          });
        }
      });

      await Promise.all(notificationPromises);

      functions.logger.info('공고 마감 알림 전체 처리 완료', {
        jobPostingId,
        totalApplicants: applicationsSnap.size,
      });
    } catch (error: any) {
      functions.logger.error('공고 마감 알림 처리 중 오류 발생', {
        jobPostingId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
