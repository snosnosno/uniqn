/**
 * 시스템 공지사항 전송 Firebase Functions
 *
 * @description
 * 전체 사용자 대상 시스템 공지사항을 FCM 푸시 알림으로 일괄 전송하는 Functions
 *
 * @version 1.0.0
 * @since 2025-10-25
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 시스템 공지사항 전송 요청 데이터
 */
interface SendSystemAnnouncementRequest {
  announcementId: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
}

/**
 * 시스템 공지사항 전송 응답 데이터
 */
interface SendSystemAnnouncementResponse {
  success: boolean;
  announcementId?: string;
  result?: {
    successCount: number;
    failedCount: number;
    totalUsers: number;
  };
  error?: string;
}

/**
 * 시스템 공지사항 전송 Cloud Function
 *
 * @description
 * - 권한 검증 (admin, manager만 가능)
 * - 모든 활성 사용자 조회
 * - FCM 멀티캐스트 전송 (500명씩 배치 처리)
 * - Firestore 알림 문서 생성 (각 사용자별)
 * - 전송 결과 기록 및 반환
 */
export const sendSystemAnnouncement = functions.https.onCall(
  async (data: SendSystemAnnouncementRequest, context): Promise<SendSystemAnnouncementResponse> => {
    functions.logger.info('시스템 공지사항 전송 요청 수신', { data, userId: context.auth?.uid });

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
        '시스템 공지사항 전송 권한이 없습니다. (관리자/매니저만 가능)'
      );
    }

    // 3. 입력 데이터 검증
    const { announcementId, title, content, priority } = data;

    if (!announcementId || !title || !content || !priority) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '필수 입력값이 누락되었습니다.'
      );
    }

    if (title.length > 100) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '공지 제목은 최대 100자까지 입력 가능합니다.'
      );
    }

    if (content.length > 2000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '공지 내용은 최대 2000자까지 입력 가능합니다.'
      );
    }

    if (!['normal', 'important', 'urgent'].includes(priority)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '올바른 우선순위를 선택해주세요.'
      );
    }

    try {
      // 4. 공지사항 문서 확인
      const announcementDoc = await db.collection('systemAnnouncements').doc(announcementId).get();

      if (!announcementDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          '공지사항을 찾을 수 없습니다.'
        );
      }

      // 5. 모든 사용자 조회 (isActive 필드 없이 전체 조회)
      const usersSnapshot = await db.collection('users').get();

      const totalUsers = usersSnapshot.size;
      functions.logger.info('전체 활성 사용자 조회 완료', { totalUsers });

      if (totalUsers === 0) {
        functions.logger.warn('활성 사용자가 없습니다.');

        await db.collection('systemAnnouncements').doc(announcementId).update({
          sendResult: {
            successCount: 0,
            failedCount: 0,
            totalUsers: 0,
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          }
        });

        return {
          success: false,
          announcementId,
          error: '활성 사용자가 없습니다.'
        };
      }

      // 6. FCM 토큰 수집
      const userTokensMap = new Map<string, string>();

      usersSnapshot.docs.forEach((doc) => {
        const userData = doc.data();
        const fcmToken = userData.fcmToken?.token || userData.fcmToken;

        if (fcmToken && typeof fcmToken === 'string') {
          userTokensMap.set(doc.id, fcmToken);
        }
      });

      functions.logger.info('FCM 토큰 조회 완료', {
        totalUsers,
        tokensFound: userTokensMap.size,
      });

      // 7. FCM 멀티캐스트 전송 (최대 500개씩 배치)
      const tokens = Array.from(userTokensMap.values());
      const allUserIds = Array.from(userTokensMap.keys());
      const successIds: string[] = [];
      const failedIds: string[] = [];
      const errors: Array<{ userId: string; error: string }> = [];

      if (tokens.length === 0) {
        functions.logger.warn('FCM 토큰이 있는 사용자가 없습니다.');

        // 토큰이 없는 사용자에게도 알림 문서는 생성 (앱 내 확인 가능)
        const notificationBatch = db.batch();

        usersSnapshot.docs.forEach((doc) => {
          const notificationRef = db.collection('notifications').doc();
          notificationBatch.set(notificationRef, {
            id: notificationRef.id,
            userId: doc.id,
            type: 'system_announcement',
            category: 'system',
            priority: priority,
            title: `📢 ${title}`,
            body: content.length > 200 ? content.substring(0, 200) + '...' : content,
            action: {
              type: 'navigate',
              target: '/app/announcements',
            },
            relatedId: announcementId,
            senderId: userId,
            isRead: false,
            isSent: false,
            isLocal: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await notificationBatch.commit();

        await db.collection('systemAnnouncements').doc(announcementId).update({
          sendResult: {
            successCount: 0,
            failedCount: 0,
            totalUsers: totalUsers,
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          }
        });

        return {
          success: true,
          announcementId,
          result: {
            successCount: 0,
            failedCount: 0,
            totalUsers: totalUsers
          }
        };
      }

      // FCM 우선순위별 채널 설정
      const androidChannelId = priority === 'urgent' ? 'urgent_announcements' :
                               priority === 'important' ? 'important_announcements' :
                               'announcements';

      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batchTokens = tokens.slice(i, i + batchSize);

        const fcmMessage = {
          notification: {
            title: `📢 ${title}`,
            body: content.length > 200 ? content.substring(0, 200) + '...' : content,
          },
          data: {
            type: 'system_announcement',
            announcementId,
            priority,
            target: '/app/announcements',
          },
          tokens: batchTokens,
          android: {
            priority: priority === 'urgent' ? 'high' as const : 'normal' as const,
            notification: {
              sound: priority === 'urgent' ? 'default' : undefined,
              channelId: androidChannelId,
              priority: priority === 'urgent' ? 'high' as const :
                        priority === 'important' ? 'default' as const :
                        'low' as const,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: priority === 'urgent' ? 'default' : undefined,
                badge: 1,
                alert: {
                  title: `📢 ${title}`,
                  body: content.length > 200 ? content.substring(0, 200) + '...' : content,
                },
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
            const userIdForToken = Array.from(userTokensMap.entries()).find(
              ([_, t]) => t === token
            )?.[0];

            if (resp.success && userIdForToken) {
              successIds.push(userIdForToken);
            } else if (userIdForToken) {
              failedIds.push(userIdForToken);
              errors.push({
                userId: userIdForToken,
                error: resp.error?.message || '알 수 없는 오류',
              });
            }
          });
        } catch (error: any) {
          functions.logger.error(`FCM 배치 ${i / batchSize + 1} 전송 실패`, error);

          // 배치 전체 실패 처리
          batchTokens.forEach((token) => {
            const userIdForToken = Array.from(userTokensMap.entries()).find(
              ([_, t]) => t === token
            )?.[0];

            if (userIdForToken) {
              failedIds.push(userIdForToken);
              errors.push({
                userId: userIdForToken,
                error: error.message || '배치 전송 실패',
              });
            }
          });
        }
      }

      // 8. 각 사용자에게 알림 문서 생성
      const notificationBatch = db.batch();

      allUserIds.forEach((uid) => {
        const notificationRef = db.collection('notifications').doc();
        const isSent = successIds.includes(uid);

        notificationBatch.set(notificationRef, {
          id: notificationRef.id,
          userId: uid,
          type: 'system_announcement',
          category: 'system',
          priority: priority,
          title: `📢 ${title}`,
          body: content.length > 200 ? content.substring(0, 200) + '...' : content,
          action: {
            type: 'navigate',
            target: '/app/announcements',
          },
          relatedId: announcementId,
          senderId: userId,
          isRead: false,
          isSent: isSent,
          isLocal: !isSent,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          sentAt: isSent ? admin.firestore.FieldValue.serverTimestamp() : null,
        });
      });

      await notificationBatch.commit();

      // 9. 공지사항 문서 업데이트
      const sendResult = {
        successCount: successIds.length,
        failedCount: failedIds.length,
        totalUsers: totalUsers,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('systemAnnouncements').doc(announcementId).update({
        sendResult
      });

      functions.logger.info('시스템 공지사항 전송 완료', {
        announcementId,
        successCount: successIds.length,
        failedCount: failedIds.length,
        totalUsers
      });

      return {
        success: true,
        announcementId,
        result: {
          successCount: successIds.length,
          failedCount: failedIds.length,
          totalUsers
        },
      };
    } catch (error: any) {
      functions.logger.error('시스템 공지사항 전송 중 오류 발생', error);

      throw new functions.https.HttpsError(
        'internal',
        error.message || '시스템 공지사항 전송에 실패했습니다.',
        error
      );
    }
  }
);
