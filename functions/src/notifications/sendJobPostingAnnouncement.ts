/**
 * 구인공고 공지 전송 Firebase Functions
 *
 * @description
 * 각 공고마다 확정된 스태프들에게 FCM 푸시 알림을 일괄 전송하는 Functions
 *
 * @version 2.0.0
 * @since 2025-09-30
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음 (fcmTokens: string[] 배열만 사용)
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { extractAllFcmTokens, flattenTokens } from '../utils/fcmTokenUtils';
import { sendMulticast, updateUnreadCounter } from '../utils/notificationUtils';

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
export const sendJobPostingAnnouncement = functions.region('asia-northeast3').https.onCall(
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

      // 7. 스태프 FCM 토큰 조회 (배치 처리, fcmTokens: string[] 배열만 사용)
      const allUsersData: Array<{ id: string; data: any }> = [];
      const chunkSize = 10; // Firestore in 쿼리 제한

      for (let i = 0; i < targetStaffIds.length; i += chunkSize) {
        const chunk = targetStaffIds.slice(i, i + chunkSize);
        const usersSnapshot = await db.collection('users').where('__name__', 'in', chunk).get();

        usersSnapshot.docs.forEach((doc) => {
          allUsersData.push({ id: doc.id, data: doc.data() });
        });
      }

      const staffTokensMap = extractAllFcmTokens(allUsersData);
      const allTokens = flattenTokens(staffTokensMap);

      // 토큰 → 사용자 ID 역매핑
      const tokenToUserMap = new Map<string, string>();
      for (const [userId, tokens] of staffTokensMap.entries()) {
        for (const token of tokens) {
          tokenToUserMap.set(token, userId);
        }
      }

      functions.logger.info('FCM 토큰 조회 완료', {
        totalStaff: targetStaffIds.length,
        usersWithTokens: staffTokensMap.size,
        totalTokens: allTokens.length,
      });

      // 8. FCM 멀티캐스트 전송 (최대 500개씩 배치)
      const successUserIds = new Set<string>();
      const failedUserIds = new Set<string>();
      const errors: Array<{ userId: string; error: string }> = [];

      if (allTokens.length === 0) {
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

      // sendMulticast()로 일괄 전송 (Expo/FCM 하이브리드)
      // @note 의도적 설계: 공지사항은 사용자별 알림설정(카테고리 비활성화) 무시하여 전원 수신
      // @note 만료 토큰 정리는 cleanupExpiredTokensScheduled (스케줄 함수)에서 일괄 처리
      const multicastResult = await sendMulticast(allTokens, {
        title: `📢 ${notificationTitle}`,
        body: announcementMessage,
        data: {
          type: 'announcement',
          announcementId,
          eventId,
          link: `/jobs/${eventId}`,
        },
        channelId: 'announcements',
        priority: 'high',
      });

      // 전송 결과 처리 (토큰 → 사용자 역매핑)
      multicastResult.responses.forEach((resp, idx) => {
        const token = allTokens[idx];
        const staffId = tokenToUserMap.get(token);

        if (!staffId) return;

        if (resp.success) {
          successUserIds.add(staffId);
        } else {
          failedUserIds.add(staffId);
          errors.push({
            userId: staffId,
            error: resp.error || '알 수 없는 오류',
          });
        }
      });

      // Set을 Array로 변환
      const successIds = Array.from(successUserIds);
      const failedIds = Array.from(failedUserIds);

      // 9. 각 스태프에게 알림 문서 생성 (배치 500개 제한 고려)
      const FIRESTORE_BATCH_LIMIT = 500;

      for (let i = 0; i < successIds.length; i += FIRESTORE_BATCH_LIMIT) {
        const batchIds = successIds.slice(i, i + FIRESTORE_BATCH_LIMIT);
        const notificationBatch = db.batch();

        batchIds.forEach((staffId) => {
          const notificationRef = db.collection('notifications').doc();
          notificationBatch.set(notificationRef, {
            id: notificationRef.id,
            recipientId: staffId,
            type: 'announcement',
            category: 'system',
            priority: 'high',
            title: `📢 ${notificationTitle}`,
            body: announcementMessage,
            link: `/jobs/${eventId}`,
            data: {
              type: 'announcement',
              announcementId,
              eventId,
            },
            relatedId: announcementId,
            senderId: userId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await notificationBatch.commit();

        // 카운터 증가 (배치 후)
        await Promise.all(
          batchIds.map((staffId) =>
            updateUnreadCounter(staffId, 1).catch(() => {
              // 에러는 updateUnreadCounter 내부에서 로깅 및 기록됨
            })
          )
        );
      }

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