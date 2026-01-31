/**
 * 스케줄(WorkLog) 생성/취소 알림 Firebase Functions
 *
 * @description
 * WorkLog(스케줄)가 생성되거나 상태가 변경되면 근무자에게 FCM 푸시 알림 전송
 * - WorkLog 생성: 새로운 근무 배정 알림
 * - WorkLog status → cancelled: 근무 취소 알림
 *
 * @trigger Firestore onCreate, onUpdate
 * @collection workLogs/{workLogId}
 * @version 2.0.0
 * @since 2025-12-22
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음 (fcmTokens: string[] 배열만 사용)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFcmTokens } from '../utils/fcmTokenUtils';
import { sendMulticast } from '../utils/notificationUtils';
import { formatTime, extractUserId } from '../utils/helpers';

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
  district?: string;
  detailedAddress?: string;
  createdBy?: string;
}

interface WorkLogData {
  staffId: string;
  eventId: string;
  date?: string;
  role?: string;
  status?: string;
  scheduledStartTime?: admin.firestore.Timestamp | string;
  scheduledEndTime?: admin.firestore.Timestamp | string;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 새 스케줄(WorkLog) 생성 알림 트리거
 *
 * @description
 * - 새로운 WorkLog 문서 생성 시 근무자에게 알림
 * - FCM 푸시 알림 전송
 * - Firestore notifications 문서 생성
 */
export const onScheduleCreated = functions.firestore
  .document('workLogs/{workLogId}')
  .onCreate(async (snap, context) => {
    const workLogId = context.params.workLogId;
    const workLog = snap.data() as WorkLogData;

    functions.logger.info('새 스케줄 생성 감지', {
      workLogId,
      staffId: workLog.staffId,
      eventId: workLog.eventId,
      date: workLog.date,
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(workLog.eventId)
        .get();

      if (!jobPostingDoc.exists) {
        functions.logger.warn('공고를 찾을 수 없습니다', {
          workLogId,
          eventId: workLog.eventId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;

      // 2. 근무자 정보 조회
      const actualUserId = extractUserId(workLog.staffId);
      const staffDoc = await db.collection('users').doc(actualUserId).get();

      if (!staffDoc.exists) {
        functions.logger.warn('근무자를 찾을 수 없습니다', {
          workLogId,
          staffId: workLog.staffId,
          actualUserId,
        });
        return;
      }

      const staff = staffDoc.data() as UserData;

      // 3. 알림 내용 생성
      const notificationTitle = '📅 새로운 근무가 배정되었습니다!';
      const timeInfo = workLog.scheduledStartTime && workLog.scheduledEndTime
        ? ` (${formatTime(workLog.scheduledStartTime)} - ${formatTime(workLog.scheduledEndTime)})`
        : '';
      const notificationBody = `'${jobPosting?.title || '이벤트'}' ${workLog.date || ''}${timeInfo}`;

      // 4. Firestore notifications 문서 생성
      const notificationRef = db.collection('notifications').doc();
      const notificationId = notificationRef.id;

      await notificationRef.set({
        id: notificationId,
        recipientId: actualUserId,
        type: 'schedule_created',
        category: 'attendance',
        priority: 'high',
        title: notificationTitle,
        body: notificationBody,
        link: '/schedule',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          workLogId,
          eventId: workLog.eventId,
          jobPostingTitle: jobPosting?.title || '',
          date: workLog.date || '',
          role: workLog.role || '',
          scheduledStartTime: formatTime(workLog.scheduledStartTime),
          scheduledEndTime: formatTime(workLog.scheduledEndTime),
          location: jobPosting?.location || '',
          district: jobPosting?.district || '',
        },
      });

      functions.logger.info('스케줄 생성 알림 문서 생성 완료', {
        notificationId,
        staffId: workLog.staffId,
      });

      // 5. FCM 푸시 전송
      const fcmTokens = getFcmTokens(staff);

      if (fcmTokens.length === 0) {
        functions.logger.warn('FCM 토큰이 없습니다', {
          staffId: workLog.staffId,
          workLogId,
        });
        return;
      }

      const result = await sendMulticast(fcmTokens, {
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: 'schedule_created',
          notificationId,
          workLogId,
          eventId: workLog.eventId,
          target: '/schedule',
        },
        channelId: 'reminders',
        priority: 'high',
      });

      functions.logger.info('스케줄 생성 알림 FCM 전송 완료', {
        workLogId,
        success: result.success,
        failure: result.failure,
      });

      // 6. 전송 결과 업데이트
      if (result.success > 0) {
        await notificationRef.update({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error: any) {
      functions.logger.error('스케줄 생성 알림 처리 중 오류 발생', {
        workLogId,
        error: error.message,
        stack: error.stack,
      });
    }
  });

/**
 * 스케줄(WorkLog) 취소 알림 트리거
 *
 * @description
 * - WorkLog status가 'cancelled'로 변경 시 근무자에게 알림
 * - FCM 푸시 알림 전송
 * - Firestore notifications 문서 생성
 */
export const onScheduleCancelled = functions.firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const workLogId = context.params.workLogId;
    const before = change.before.data() as WorkLogData;
    const after = change.after.data() as WorkLogData;

    // status가 cancelled로 변경된 경우만 처리
    if (before.status === after.status || after.status !== 'cancelled') {
      return;
    }

    functions.logger.info('스케줄 취소 감지', {
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

      // 2. 근무자 정보 조회
      const actualUserId = extractUserId(after.staffId);
      const staffDoc = await db.collection('users').doc(actualUserId).get();

      if (!staffDoc.exists) {
        functions.logger.warn('근무자를 찾을 수 없습니다', {
          workLogId,
          staffId: after.staffId,
          actualUserId,
        });
        return;
      }

      const staff = staffDoc.data() as UserData;

      // 3. 알림 내용 생성
      const notificationTitle = '❌ 근무가 취소되었습니다';
      const notificationBody = `'${jobPosting?.title || '이벤트'}' ${after.date || ''} 근무가 취소되었습니다.`;

      // 4. Firestore notifications 문서 생성
      const notificationRef = db.collection('notifications').doc();
      const notificationId = notificationRef.id;

      await notificationRef.set({
        id: notificationId,
        recipientId: actualUserId,
        type: 'schedule_cancelled',
        category: 'attendance',
        priority: 'high',
        title: notificationTitle,
        body: notificationBody,
        link: '/schedule',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          workLogId,
          eventId: after.eventId,
          jobPostingTitle: jobPosting?.title || '',
          date: after.date || '',
          role: after.role || '',
        },
      });

      functions.logger.info('스케줄 취소 알림 문서 생성 완료', {
        notificationId,
        staffId: after.staffId,
      });

      // 5. FCM 푸시 전송
      const fcmTokens = getFcmTokens(staff);

      if (fcmTokens.length === 0) {
        functions.logger.warn('FCM 토큰이 없습니다', {
          staffId: after.staffId,
          workLogId,
        });
        return;
      }

      const result = await sendMulticast(fcmTokens, {
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: 'schedule_cancelled',
          notificationId,
          workLogId,
          eventId: after.eventId,
          target: '/schedule',
        },
        channelId: 'reminders',
        priority: 'high',
      });

      functions.logger.info('스케줄 취소 알림 FCM 전송 완료', {
        workLogId,
        success: result.success,
        failure: result.failure,
      });

      // 6. 전송 결과 업데이트
      if (result.success > 0) {
        await notificationRef.update({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error: any) {
      functions.logger.error('스케줄 취소 알림 처리 중 오류 발생', {
        workLogId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
