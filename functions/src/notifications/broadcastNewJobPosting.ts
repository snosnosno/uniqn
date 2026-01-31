/**
 * 신규 공고 등록 알림 (구직자)
 *
 * @description
 * 새로운 구인공고가 등록될 때 모든 구직자(스태프)에게 알림을 전송합니다.
 *
 * @trigger Firestore onCreate: jobPostings/{id}
 * @condition status === 'open'
 *
 * @version 2.0.0
 * @since 2025-10-15
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음 (fcmTokens: string[] 배열만 사용)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { extractAllFcmTokens, flattenTokens } from '../utils/fcmTokenUtils';
import { sendMulticast } from '../utils/notificationUtils';

/**
 * 새로운 구인공고 등록 시 모든 구직자에게 알림 전송
 */
export const broadcastNewJobPosting = functions.firestore
  .document('jobPostings/{postingId}')
  .onCreate(async (snap, context) => {
    const postingId = context.params.postingId;
    const jobPosting = snap.data();

    try {
      functions.logger.info(`[broadcastNewJobPosting] 시작: ${postingId}`);

      // 1. 공고 정보 유효성 검증
      if (!jobPosting || jobPosting.status !== 'open') {
        functions.logger.info(`[broadcastNewJobPosting] 공고가 공개 상태가 아님: ${postingId}`);
        return null;
      }

      // 2. 필수 필드 확인
      const { title, location, roles } = jobPosting;
      if (!title || !location) {
        functions.logger.info(`[broadcastNewJobPosting] 필수 필드 누락: ${postingId}`);
        return null;
      }

      // 3. 급여 정보 추출
      const hourlyPay = roles?.[0]?.hourlyPay || '협의';

      // 4. 모든 사용자 FCM 토큰 조회
      const usersSnapshot = await admin.firestore()
        .collection('users')
        .get();

      if (usersSnapshot.empty) {
        functions.logger.info(`[broadcastNewJobPosting] 사용자 없음`);
        return null;
      }

      // 5. FCM 토큰 수집 (fcmTokens: string[] 배열만 사용)
      const usersData = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data(),
      }));

      const userTokensMap = extractAllFcmTokens(usersData);
      const allTokens = flattenTokens(userTokensMap);

      functions.logger.info('[broadcastNewJobPosting] FCM 토큰 조회 완료', {
        totalUsers: usersSnapshot.size,
        usersWithTokens: userTokensMap.size,
        totalTokens: allTokens.length,
      });

      // 6. Firestore 알림 문서 일괄 생성 (배치 처리)
      const BATCH_LIMIT = 500;

      for (let i = 0; i < usersSnapshot.docs.length; i += BATCH_LIMIT) {
        const batchDocs = usersSnapshot.docs.slice(i, i + BATCH_LIMIT);
        const batch = admin.firestore().batch();

        batchDocs.forEach((userDoc) => {
          const notificationRef = admin.firestore().collection('notifications').doc();

          batch.set(notificationRef, {
            id: notificationRef.id,
            recipientId: userDoc.id,
            type: 'new_job_in_area',
            category: 'job',
            priority: 'normal',
            title: '🎯 새로운 구인공고',
            body: `📍 ${title} | ${location}\n지금 바로 지원하세요!`,
            link: `/jobs/${postingId}`,
            data: {
              type: 'new_job_in_area',
              jobPostingId: postingId,
              title,
              location,
              hourlyPay: String(hourlyPay),
            },
            relatedId: postingId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
      }

      functions.logger.info(`[broadcastNewJobPosting] 알림 문서 생성 완료: ${usersSnapshot.size}개`);

      // 7. FCM 푸시 알림 전송 (공통 유틸리티 사용)
      if (allTokens.length > 0) {
        const FCM_BATCH_SIZE = 500;
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < allTokens.length; i += FCM_BATCH_SIZE) {
          const batchTokens = allTokens.slice(i, i + FCM_BATCH_SIZE);

          const result = await sendMulticast(batchTokens, {
            title: '🎯 새로운 구인공고',
            body: `📍 ${title} | ${location}\n지금 바로 지원하세요!`,
            data: {
              type: 'new_job_in_area',
              jobPostingId: postingId,
              title,
              location,
              hourlyPay: String(hourlyPay),
              link: `/jobs/${postingId}`,
            },
            channelId: 'announcements',
            priority: 'normal',
          });

          successCount += result.success;
          failureCount += result.failure;

          functions.logger.info(`[broadcastNewJobPosting] 배치 ${Math.floor(i / FCM_BATCH_SIZE) + 1} 전송 완료`, {
            success: result.success,
            failure: result.failure,
          });
        }

        functions.logger.info('[broadcastNewJobPosting] FCM 전송 완료', {
          totalTokens: allTokens.length,
          successCount,
          failureCount,
        });
      } else {
        functions.logger.info('[broadcastNewJobPosting] FCM 토큰 없음');
      }

      functions.logger.info(`[broadcastNewJobPosting] 완료: ${postingId}`);
      return null;
    } catch (error) {
      functions.logger.info(`[broadcastNewJobPosting] 오류 발생: ${postingId}`);
      return null;
    }
  });
