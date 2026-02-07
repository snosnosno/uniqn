/**
 * QR 출퇴근 확인 알림 Firebase Functions
 *
 * @description
 * WorkLog에 checkInTime/checkOutTime이 설정되면 근무자에게 FCM 푸시 알림 전송
 * - checkInTime 설정: 출근 확인 알림
 * - checkOutTime 설정: 퇴근 확인 알림
 *
 * @trigger Firestore onUpdate
 * @collection workLogs/{workLogId}
 * @version 2.0.0
 * @since 2025-01-18
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
  createdBy?: string;
}

interface WorkLogData {
  staffId: string;
  eventId: string;
  date?: string;
  checkInTime?: admin.firestore.Timestamp | null;
  checkOutTime?: admin.firestore.Timestamp | null;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * QR 출퇴근 확인 알림 트리거
 *
 * @description
 * - WorkLog checkInTime/checkOutTime 변경 감지
 * - 근무자에게 check_in_confirmed/check_out_confirmed 알림 전송
 * - 구인자에게 staff_checked_in/staff_checked_out 알림 전송
 * - Firestore notifications 문서 생성
 */
export const onCheckInOut = functions.region('asia-northeast3').firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const workLogId = context.params.workLogId;
    const before = change.before.data() as WorkLogData;
    const after = change.after.data() as WorkLogData;

    // 출근/퇴근 시간 변경 확인
    const isCheckIn = !before.checkInTime && after.checkInTime;
    const isCheckOut = !before.checkOutTime && after.checkOutTime;

    if (!isCheckIn && !isCheckOut) {
      return; // 출퇴근 시간 변경 없음
    }

    const checkType = isCheckIn ? 'check_in' : 'check_out';
    const checkTime = isCheckIn ? after.checkInTime : after.checkOutTime;

    functions.logger.info(`QR ${checkType} 감지`, {
      workLogId,
      staffId: after.staffId,
      eventId: after.eventId,
      checkType,
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
      const formattedTime = formatTime(checkTime);
      const notificationTitle = isCheckIn ? '✅ 출근 확인' : '✅ 퇴근 확인';
      const notificationBody = isCheckIn
        ? `'${jobPosting?.title || '이벤트'}' 출근이 확인되었습니다. (${formattedTime})`
        : `'${jobPosting?.title || '이벤트'}' 퇴근이 확인되었습니다. (${formattedTime})`;

      // 4. Firestore notifications 문서 생성
      const notificationRef = db.collection('notifications').doc();
      const notificationId = notificationRef.id;

      await notificationRef.set({
        id: notificationId,
        recipientId: actualUserId,
        type: isCheckIn ? 'check_in_confirmed' : 'check_out_confirmed',
        category: 'attendance',
        priority: 'normal',
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
          checkTime: formattedTime,
        },
      });

      functions.logger.info(`${checkType} 알림 문서 생성 완료`, {
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
          type: isCheckIn ? 'check_in_confirmed' : 'check_out_confirmed',
          notificationId,
          workLogId,
          eventId: after.eventId,
          target: '/schedule',
        },
        channelId: 'default',
        priority: 'normal',
      });

      functions.logger.info(`${checkType} 알림 FCM 전송 완료`, {
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

      // ========================================================================
      // 7. 구인자에게 staff_checked_in/out 알림 전송
      // ========================================================================
      if (jobPosting?.createdBy) {
        const employerDoc = await db.collection('users').doc(jobPosting.createdBy).get();

        if (employerDoc.exists) {
          const employer = employerDoc.data() as UserData;

          // 구인자용 알림 내용
          const employerTitle = isCheckIn ? '🟢 출근 알림' : '🔴 퇴근 알림';
          const employerBody = isCheckIn
            ? `${staff?.name || '스태프'}님이 ${formattedTime}에 출근했습니다.`
            : `${staff?.name || '스태프'}님이 ${formattedTime}에 퇴근했습니다.`;

          // 구인자용 알림 문서 생성
          const employerNotificationRef = db.collection('notifications').doc();
          const employerNotificationId = employerNotificationRef.id;

          await employerNotificationRef.set({
            id: employerNotificationId,
            recipientId: jobPosting.createdBy,
            type: isCheckIn ? 'staff_checked_in' : 'staff_checked_out',
            category: 'attendance',
            priority: 'normal',
            title: employerTitle,
            body: employerBody,
            link: `/employer/applicants/${after.eventId}`,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            data: {
              workLogId,
              eventId: after.eventId,
              jobPostingTitle: jobPosting?.title || '',
              staffId: after.staffId,
              staffName: staff?.name || '',
              date: after.date || '',
              checkTime: formattedTime,
            },
          });

          functions.logger.info(`구인자 ${checkType} 알림 문서 생성 완료`, {
            notificationId: employerNotificationId,
            employerId: jobPosting.createdBy,
          });

          // 구인자 FCM 푸시 전송
          const employerTokens = getFcmTokens(employer);

          if (employerTokens.length > 0) {
            const employerResult = await sendMulticast(employerTokens, {
              title: employerTitle,
              body: employerBody,
              data: {
                type: isCheckIn ? 'staff_checked_in' : 'staff_checked_out',
                notificationId: employerNotificationId,
                workLogId,
                eventId: after.eventId,
                target: `/employer/applicants/${after.eventId}`,
              },
              channelId: 'reminders',
              priority: 'normal',
            });

            if (employerResult.success > 0) {
              await employerNotificationRef.update({
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            functions.logger.info(`구인자 ${checkType} 알림 FCM 전송 완료`, {
              employerId: jobPosting.createdBy,
              success: employerResult.success,
              failure: employerResult.failure,
            });
          }
        }
      }
    } catch (error: any) {
      functions.logger.error(`${checkType} 알림 처리 중 오류 발생`, {
        workLogId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
