/**
 * 노쇼 알림 Firebase Functions
 *
 * @description
 * WorkLog status가 'no_show'로 변경되면 구인자에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onUpdate
 * @collection workLogs/{workLogId}
 * @version 1.0.0
 * @since 2025-02-01
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음 (fcmTokens: string[] 배열만 사용)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFcmTokens } from '../utils/fcmTokenUtils';
import type { FcmTokenRecord } from '../utils/fcmTokenUtils';
import { sendMulticast } from '../utils/notificationUtils';
import { extractUserId } from '../utils/helpers';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface UserData {
  fcmTokens?: Record<string, FcmTokenRecord>;
  name?: string;
}

interface JobPostingData {
  title?: string;
  location?: string;
  createdBy?: string;
}

interface WorkLogData {
  staffId: string;
  eventId: string;
  date?: string;
  status?: string;
  scheduledStartTime?: admin.firestore.Timestamp | string;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 노쇼 알림 트리거
 *
 * @description
 * - WorkLog status가 'no_show'로 변경되면 실행
 * - 구인자(jobPosting.createdBy)에게 알림 전송
 * - Firestore notifications 문서 생성 + FCM 푸시 전송
 */
export const onNoShow = functions.region('asia-northeast3').firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const workLogId = context.params.workLogId;
    const before = change.before.data() as WorkLogData;
    const after = change.after.data() as WorkLogData;

    // status가 no_show로 변경된 경우만 처리
    if (before.status === after.status || after.status !== 'no_show') {
      return;
    }

    functions.logger.info('노쇼 감지', {
      workLogId,
      staffId: after.staffId,
      eventId: after.eventId,
      beforeStatus: before.status,
      afterStatus: after.status,
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(after.eventId)
        .get();

      if (!jobPostingDoc.exists) {
        functions.logger.warn('공고를 찾을 수 없습니다', {
          workLogId,
          eventId: after.eventId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;

      if (!jobPosting?.createdBy) {
        functions.logger.warn('공고 작성자를 찾을 수 없습니다', {
          workLogId,
          eventId: after.eventId,
        });
        return;
      }

      // 2. 스태프 정보 조회
      const actualUserId = extractUserId(after.staffId);
      const staffDoc = await db.collection('users').doc(actualUserId).get();

      const staffName = staffDoc.exists
        ? (staffDoc.data() as UserData)?.name || '스태프'
        : '스태프';

      // 3. 구인자 정보 조회
      const employerDoc = await db
        .collection('users')
        .doc(jobPosting.createdBy)
        .get();

      if (!employerDoc.exists) {
        functions.logger.warn('구인자를 찾을 수 없습니다', {
          workLogId,
          employerId: jobPosting.createdBy,
        });
        return;
      }

      const employer = employerDoc.data() as UserData;

      // 4. 알림 내용 생성
      const notificationTitle = '⚠️ 노쇼 알림';
      const notificationBody = `${staffName}님이 '${jobPosting.title || '공고'}'에 출근하지 않았습니다.`;

      // 5. Firestore notifications 문서 생성
      const notificationRef = db.collection('notifications').doc();
      const notificationId = notificationRef.id;

      await notificationRef.set({
        id: notificationId,
        recipientId: jobPosting.createdBy,
        type: 'no_show_alert',
        category: 'attendance',
        priority: 'urgent',
        title: notificationTitle,
        body: notificationBody,
        link: `/employer/applicants/${after.eventId}`,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          workLogId,
          eventId: after.eventId,
          jobPostingTitle: jobPosting.title || '',
          staffId: after.staffId,
          staffName,
          date: after.date || '',
        },
      });

      functions.logger.info('노쇼 알림 문서 생성 완료', {
        notificationId,
        employerId: jobPosting.createdBy,
      });

      // 6. FCM 푸시 전송
      const fcmTokens = getFcmTokens(employer);

      if (fcmTokens.length === 0) {
        functions.logger.warn('구인자 FCM 토큰이 없습니다', {
          employerId: jobPosting.createdBy,
          workLogId,
        });
        return;
      }

      const result = await sendMulticast(fcmTokens, {
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: 'no_show_alert',
          notificationId,
          workLogId,
          eventId: after.eventId,
          target: `/employer/applicants/${after.eventId}`,
        },
        channelId: 'reminders',
        priority: 'urgent',
      });

      functions.logger.info('노쇼 알림 FCM 전송 완료', {
        workLogId,
        employerId: jobPosting.createdBy,
        success: result.success,
        failure: result.failure,
      });

      // 7. 전송 결과 업데이트
      if (result.success > 0) {
        await notificationRef.update({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error: any) {
      functions.logger.error('노쇼 알림 처리 중 오류 발생', {
        workLogId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
