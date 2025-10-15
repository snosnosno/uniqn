/**
 * 신규 공고 등록 알림 (구직자)
 *
 * @description
 * 새로운 구인공고가 등록될 때 모든 구직자(스태프)에게 알림을 전송합니다.
 *
 * @trigger Firestore onCreate: jobPostings/{id}
 * @condition status === 'open'
 *
 * @example
 * 알림 내용:
 * - 제목: "🎯 새로운 홀덤 딜러 구인공고"
 * - 내용: "📍 {지역} | 💰 시급 {급여}원\n지금 바로 지원하세요!"
 * - 액션: /job-postings/{id}
 *
 * @version 1.0.0
 * @since 2025-10-15
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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

      // 4. 모든 구직자(스태프) FCM 토큰 조회
      const usersSnapshot = await admin.firestore()
        .collection('users')
        .where('role', '==', 'staff')
        .get();

      if (usersSnapshot.empty) {
        functions.logger.info(`[broadcastNewJobPosting] 구직자 없음`);
        return null;
      }

      // 5. FCM 토큰 수집 및 알림 문서 생성
      const fcmTokens: string[] = [];
      const notificationPromises: Promise<any>[] = [];
      const now = admin.firestore.Timestamp.now();

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const fcmToken = userData.fcmToken;

        // 5-1. FCM 토큰이 있으면 수집
        if (fcmToken && typeof fcmToken === 'string') {
          fcmTokens.push(fcmToken);
        }

        // 5-2. Firestore 알림 문서 생성
        const notificationRef = admin.firestore()
          .collection('notifications')
          .doc();

        notificationPromises.push(
          notificationRef.set({
            id: notificationRef.id,
            staffId: userId,
            type: 'new_job_posting',
            title: '🎯 새로운 홀덤 딜러 구인공고',
            message: `📍 ${location} | 💰 시급 ${hourlyPay}원\n지금 바로 지원하세요!`,
            data: {
              postingId,
              title,
              location,
              hourlyPay,
            },
            action: {
              type: 'navigate',
              target: `/app/jobs/${postingId}`,
            },
            isRead: false,
            createdAt: now,
            updatedAt: now,
          })
        );
      }

      // 6. Firestore 알림 문서 일괄 생성
      await Promise.all(notificationPromises);
      functions.logger.info(`[broadcastNewJobPosting] 알림 문서 생성 완료: ${notificationPromises.length}개`);

      // 7. FCM 푸시 알림 전송 (최대 500개씩 배치)
      if (fcmTokens.length > 0) {
        const message: admin.messaging.MulticastMessage = {
          tokens: fcmTokens,
          notification: {
            title: '🎯 새로운 홀덤 딜러 구인공고',
            body: `📍 ${location} | 💰 시급 ${hourlyPay}원\n지금 바로 지원하세요!`,
          },
          data: {
            type: 'new_job_posting',
            postingId,
            title,
            location,
            hourlyPay: String(hourlyPay),
            target: `/app/jobs/${postingId}`,
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'job_notifications',
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

        // 배치로 전송 (FCM은 최대 500개까지 지원)
        const batchSize = 500;
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < fcmTokens.length; i += batchSize) {
          const batch = fcmTokens.slice(i, i + batchSize);
          const batchMessage = { ...message, tokens: batch };

          try {
            const response = await admin.messaging().sendEachForMulticast(batchMessage);
            successCount += response.successCount;
            failureCount += response.failureCount;

            functions.logger.info(`[broadcastNewJobPosting] 배치 ${i / batchSize + 1} 전송 완료: 성공 ${response.successCount}, 실패 ${response.failureCount}`);
          } catch (error) {
            functions.logger.info(`[broadcastNewJobPosting] 배치 ${i / batchSize + 1} 전송 실패`);
            failureCount += batch.length;
          }
        }

        functions.logger.info(`[broadcastNewJobPosting] FCM 전송 완료: 총 ${fcmTokens.length}개 (성공 ${successCount}, 실패 ${failureCount})`);
      } else {
        functions.logger.info(`[broadcastNewJobPosting] FCM 토큰 없음`);
      }

      functions.logger.info(`[broadcastNewJobPosting] 완료: ${postingId}`);
      return null;
    } catch (error) {
      functions.logger.info(`[broadcastNewJobPosting] 오류 발생: ${postingId}`);
      return null;
    }
  });
