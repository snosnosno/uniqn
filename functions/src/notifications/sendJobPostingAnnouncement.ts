/**
 * 구인공고 공지 전송 Firebase Functions
 *
 * @description
 * 각 공고마다 확정된 스태프들에게 FCM 푸시 알림을 일괄 전송하는 Functions
 *
 * @version 1.0.0
 * @since 2025-09-30
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 공지 전송 요청 데이터
 */
interface SendAnnouncementRequest {
  eventId: string; // 이벤트 ID (공고 ID)
  title: string;
  message: string; // 클라이언트에서 전달되는 필드명
  targetStaffIds: string[];
  jobPostingTitle?: string; // 공고 제목 (알림 제목 prefix용)
}

/**
 * 공지 전송 응답 데이터
 */
interface SendAnnouncementResponse {
  success: boolean;
  announcementId?: string;
  result?: {
    successIds: string[];
    failedIds: string[];
    successCount: number;
    failedCount: number;
    errors?: Array<{ userId: string; error: string }>;
  };
  error?: string;
}

/**
 * 공지 전송 Cloud Function
 *
 * @description
 * - 권한 검증 (admin, manager만 가능)
 * - 스태프 FCM 토큰 조회
 * - FCM 멀티캐스트 전송
 * - Firestore 알림 문서 생성
 * - 전송 결과 반환
 */
export const sendJobPostingAnnouncement = functions.https.onCall(
  async (data: SendAnnouncementRequest, context): Promise<SendAnnouncementResponse> => {
    functions.logger.info('공지 전송 요청 수신', { data, userId: context.auth?.uid });

    // 1. 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '인증이 필요합니다.'
      );
    }

    const userId = context.auth.uid;
    const userRole = context.auth.token?.role;

    // 2. 권한 검증 (admin, manager만 가능)
    if (userRole !== 'admin' && userRole !== 'manager') {
      functions.logger.warn('권한 없음', { userId, userRole });
      throw new functions.https.HttpsError(
        'permission-denied',
        '공지 전송 권한이 없습니다. (관리자/매니저만 가능)'
      );
    }

    // 3. 입력 데이터 검증
    const { eventId, title, message: announcementMessage, targetStaffIds, jobPostingTitle } = data;

    if (!eventId || !title || !announcementMessage || !targetStaffIds || targetStaffIds.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '필수 입력값이 누락되었습니다.'
      );
    }

    if (title.length > 50) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '공지 제목은 최대 50자까지 입력 가능합니다.'
      );
    }

    if (announcementMessage.length > 500) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '공지 내용은 최대 500자까지 입력 가능합니다.'
      );
    }

    try {
      // 4. 공고 정보 조회
      const jobPostingDoc = await db.collection('jobPostings').doc(eventId).get();

      if (!jobPostingDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          '공고를 찾을 수 없습니다.'
        );
      }

      const jobPosting = jobPostingDoc.data();

      // 공고 제목으로 알림 제목 prefix 생성
      const actualJobPostingTitle = jobPostingTitle || jobPosting?.title || '공고';
      const notificationTitle = `[${actualJobPostingTitle}] ${title}`;

      // 5. 발신자 정보 조회
      const senderDoc = await db.collection('users').doc(userId).get();
      const senderName = senderDoc.data()?.name || '관리자';

      // 6. 공지 문서 생성
      const announcementRef = db.collection('jobPostingAnnouncements').doc();
      const announcementId = announcementRef.id;

      const announcementData = {
        id: announcementId,
        eventId,
        title,
        message: announcementMessage,
        createdBy: userId,
        createdByName: senderName,
        targetStaffIds,
        sentCount: 0,
        failedCount: 0,
        status: 'sending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          jobPostingTitle: jobPosting?.title || '공고',
          location: jobPosting?.location || '',
        },
      };

      await announcementRef.set(announcementData);

      // 7. 스태프 FCM 토큰 조회 (배치 처리)
      const staffTokensMap = new Map<string, string>();
      const chunkSize = 10; // Firestore in 쿼리 제한

      for (let i = 0; i < targetStaffIds.length; i += chunkSize) {
        const chunk = targetStaffIds.slice(i, i + chunkSize);
        const usersSnapshot = await db.collection('users').where('__name__', 'in', chunk).get();

        usersSnapshot.docs.forEach((doc) => {
          const userData = doc.data();
          const fcmToken = userData.fcmToken?.token || userData.fcmToken;

          if (fcmToken && typeof fcmToken === 'string') {
            staffTokensMap.set(doc.id, fcmToken);
          }
        });
      }

      functions.logger.info('FCM 토큰 조회 완료', {
        totalStaff: targetStaffIds.length,
        tokensFound: staffTokensMap.size,
      });

      // 8. FCM 멀티캐스트 전송 (최대 500개씩 배치)
      const tokens = Array.from(staffTokensMap.values());
      const successIds: string[] = [];
      const failedIds: string[] = [];
      const errors: Array<{ userId: string; error: string }> = [];

      if (tokens.length === 0) {
        functions.logger.warn('FCM 토큰이 없는 스태프만 있습니다.');

        await announcementRef.update({
          status: 'failed',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          failedCount: targetStaffIds.length,
        });

        return {
          success: false,
          announcementId,
          error: 'FCM 토큰이 있는 스태프가 없습니다.',
        };
      }

      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batchTokens = tokens.slice(i, i + batchSize);

        const fcmMessage = {
          notification: {
            title: `📢 ${notificationTitle}`,
            body: announcementMessage,
          },
          data: {
            type: 'job_posting_announcement',
            announcementId,
            eventId,
            target: `/app/admin/job-postings/${eventId}`,
          },
          tokens: batchTokens,
          android: {
            priority: 'high' as const,
            notification: {
              sound: 'default',
              channelId: 'announcement',
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
          const response = await admin.messaging().sendEachForMulticast(fcmMessage);

          functions.logger.info(`FCM 배치 ${i / batchSize + 1} 전송 결과`, {
            successCount: response.successCount,
            failureCount: response.failureCount,
          });

          // 전송 결과 처리
          response.responses.forEach((resp, idx) => {
            const token = batchTokens[idx];
            const staffId = Array.from(staffTokensMap.entries()).find(
              ([_, t]) => t === token
            )?.[0];

            if (resp.success && staffId) {
              successIds.push(staffId);
            } else if (staffId) {
              failedIds.push(staffId);
              errors.push({
                userId: staffId,
                error: resp.error?.message || '알 수 없는 오류',
              });
            }
          });
        } catch (error: any) {
          functions.logger.error(`FCM 배치 ${i / batchSize + 1} 전송 실패`, error);
          // 배치 전체 실패 처리
          batchTokens.forEach((token) => {
            const staffId = Array.from(staffTokensMap.entries()).find(
              ([_, t]) => t === token
            )?.[0];

            if (staffId) {
              failedIds.push(staffId);
              errors.push({
                userId: staffId,
                error: error.message || '배치 전송 실패',
              });
            }
          });
        }
      }

      // 9. 각 스태프에게 알림 문서 생성
      const notificationBatch = db.batch();

      successIds.forEach((staffId) => {
        const notificationRef = db.collection('notifications').doc();
        notificationBatch.set(notificationRef, {
          id: notificationRef.id,
          userId: staffId,
          type: 'job_posting_announcement',
          category: 'system',
          priority: 'high',
          title: `📢 ${notificationTitle}`,
          body: announcementMessage,
          action: {
            type: 'navigate',
            target: `/app/admin/job-postings/${eventId}`,
          },
          relatedId: announcementId,
          senderId: userId,
          isRead: false,
          isSent: true,
          isLocal: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await notificationBatch.commit();

      // 10. 공지 문서 업데이트
      const sendResult: {
        successIds: string[];
        failedIds: string[];
        successCount: number;
        failedCount: number;
        errors?: Array<{ userId: string; error: string }>;
      } = {
        successIds,
        failedIds,
        successCount: successIds.length,
        failedCount: failedIds.length,
      };

      // errors가 있을 때만 필드 추가
      if (errors.length > 0) {
        sendResult.errors = errors;
      }

      await announcementRef.update({
        status: successIds.length > 0 ? 'sent' : 'failed',
        sentCount: successIds.length,
        failedCount: failedIds.length,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sendResult,
      });

      functions.logger.info('공지 전송 완료', {
        announcementId,
        successCount: successIds.length,
        failedCount: failedIds.length,
      });

      return {
        success: true,
        announcementId,
        result: sendResult,
      };
    } catch (error: any) {
      functions.logger.error('공지 전송 중 오류 발생', error);

      throw new functions.https.HttpsError(
        'internal',
        error.message || '공지 전송에 실패했습니다.',
        error
      );
    }
  }
);