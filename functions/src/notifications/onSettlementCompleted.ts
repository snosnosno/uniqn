/**
 * 정산 완료 알림 Firebase Functions
 *
 * @description
 * WorkLog의 settlementStatus가 'completed'로 변경되면 스태프에게 FCM 푸시 알림 전송
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
import { sendMulticast } from '../utils/notificationUtils';
import { extractUserId } from '../utils/helpers';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface UserData {
  fcmTokens?: string[];
  name?: string;
}

interface JobPostingData {
  title?: string;
  location?: string;
}

interface WorkLogData {
  staffId: string;
  eventId: string;
  date?: string;
  settlementStatus?: string;
  totalPay?: number;
  hourlyRate?: number;
  totalHours?: number;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 정산 완료 알림 트리거
 *
 * @description
 * - WorkLog settlementStatus가 'completed'로 변경되면 실행
 * - 스태프(workLog.staffId에서 userId 추출)에게 알림 전송
 * - Firestore notifications 문서 생성 + FCM 푸시 전송
 */
export const onSettlementCompleted = functions.region('asia-northeast3').firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const workLogId = context.params.workLogId;
    const before = change.before.data() as WorkLogData;
    const after = change.after.data() as WorkLogData;

    // settlementStatus가 completed로 변경된 경우만 처리
    if (
      before.settlementStatus === after.settlementStatus ||
      after.settlementStatus !== 'completed'
    ) {
      return;
    }

    functions.logger.info('정산 완료 감지', {
      workLogId,
      staffId: after.staffId,
      eventId: after.eventId,
      beforeStatus: before.settlementStatus,
      afterStatus: after.settlementStatus,
    });

    try {
      // 1. 스태프 정보 조회
      const actualUserId = extractUserId(after.staffId);
      const staffDoc = await db.collection('users').doc(actualUserId).get();

      if (!staffDoc.exists) {
        functions.logger.warn('스태프를 찾을 수 없습니다', {
          workLogId,
          staffId: after.staffId,
          actualUserId,
        });
        return;
      }

      const staff = staffDoc.data() as UserData;

      // 2. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(after.eventId)
        .get();

      const jobPosting = jobPostingDoc.exists
        ? (jobPostingDoc.data() as JobPostingData)
        : null;

      // 3. 정산 금액 포맷
      const totalPay = after.totalPay || 0;
      const formattedPay = totalPay.toLocaleString('ko-KR');

      // 4. 알림 내용 생성
      const notificationTitle = '💰 정산 완료';
      const notificationBody = jobPosting?.title
        ? `'${jobPosting.title}' 정산이 완료되었습니다. (${formattedPay}원)`
        : `정산이 완료되었습니다. (${formattedPay}원)`;

      // 5. Firestore notifications 문서 생성
      const notificationRef = db.collection('notifications').doc();
      const notificationId = notificationRef.id;

      await notificationRef.set({
        id: notificationId,
        recipientId: actualUserId,
        type: 'settlement_completed',
        category: 'settlement',
        priority: 'high',
        title: notificationTitle,
        body: notificationBody,
        link: '/my-settlements',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          workLogId,
          eventId: after.eventId,
          jobPostingTitle: jobPosting?.title || '',
          date: after.date || '',
          totalPay,
          hourlyRate: after.hourlyRate || 0,
          totalHours: after.totalHours || 0,
        },
      });

      functions.logger.info('정산 완료 알림 문서 생성 완료', {
        notificationId,
        staffId: after.staffId,
        totalPay,
      });

      // 6. FCM 푸시 전송
      const fcmTokens = getFcmTokens(staff);

      if (fcmTokens.length === 0) {
        functions.logger.warn('스태프 FCM 토큰이 없습니다', {
          staffId: after.staffId,
          workLogId,
        });
        return;
      }

      const result = await sendMulticast(fcmTokens, {
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: 'settlement_completed',
          notificationId,
          workLogId,
          eventId: after.eventId,
          target: '/my-settlements',
        },
        channelId: 'settlement',
        priority: 'high',
      });

      functions.logger.info('정산 완료 알림 FCM 전송 완료', {
        workLogId,
        staffId: after.staffId,
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
      functions.logger.error('정산 완료 알림 처리 중 오류 발생', {
        workLogId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
