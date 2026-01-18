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
 * @version 1.0.0
 * @since 2025-01-18
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
 * FCM 푸시 알림 전송
 */
async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<{ success: number; failure: number }> {
  if (tokens.length === 0) {
    return { success: 0, failure: 0 };
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title,
      body,
    },
    data,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'job',
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
export const onJobPostingUpdated = functions.firestore
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
            priority: 'medium',
            title: notificationTitle,
            body: notificationBody,
            link: `/app/jobs/${jobPostingId}`,
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
            const result = await sendPushNotification(
              fcmTokens,
              notificationTitle,
              notificationBody,
              {
                type: 'job_updated',
                notificationId,
                jobPostingId,
                target: `/app/jobs/${jobPostingId}`,
              }
            );

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
        } catch (error: any) {
          functions.logger.error('지원자 알림 전송 실패', {
            applicantId: application.applicantId,
            error: error.message,
          });
        }
      });

      await Promise.all(notificationPromises);

      functions.logger.info('공고 수정 알림 전체 처리 완료', {
        jobPostingId,
        totalApplicants: applicationsSnap.size,
      });
    } catch (error: any) {
      functions.logger.error('공고 수정 알림 처리 중 오류 발생', {
        jobPostingId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
