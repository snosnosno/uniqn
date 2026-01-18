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
// Helper Functions
// ============================================================================

/**
 * Firestore Timestamp를 HH:MM 형식으로 변환 (KST 기준)
 */
function formatTime(time: admin.firestore.Timestamp | null | undefined): string {
  if (!time) return '';

  if ('toDate' in time) {
    const utcDate = time.toDate();
    // KST로 변환 (UTC+9)
    const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
    const hours = kstDate.getUTCHours().toString().padStart(2, '0');
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return '';
}

/**
 * staffId에서 실제 userId 추출
 * staffId 형식: {userId}_{index} 또는 {userId}
 */
function extractUserId(staffId: string): string {
  if (!staffId) return '';
  return staffId.includes('_') ? staffId.split('_')[0] : staffId;
}

/**
 * 사용자의 FCM 토큰 배열 가져오기
 */
function getFcmTokens(userData: UserData): string[] {
  const tokens: string[] = [];

  // 새로운 fcmTokens 배열 형식
  if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
    tokens.push(
      ...userData.fcmTokens.filter((t) => typeof t === 'string' && t.length > 0)
    );
  }

  // 기존 fcmToken 형식 (호환성)
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
  data: Record<string, string>,
  channelId: string = 'attendance'
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
        channelId,
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
 * QR 출퇴근 확인 알림 트리거
 *
 * @description
 * - WorkLog checkInTime/checkOutTime 변경 감지
 * - 근무자에게 FCM 푸시 알림 전송
 * - Firestore notifications 문서 생성
 */
export const onCheckInOut = functions.firestore
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
        priority: 'medium',
        title: notificationTitle,
        body: notificationBody,
        link: '/app/my-schedule',
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

      const result = await sendPushNotification(
        fcmTokens,
        notificationTitle,
        notificationBody,
        {
          type: isCheckIn ? 'check_in_confirmed' : 'check_out_confirmed',
          notificationId,
          workLogId,
          eventId: after.eventId,
          target: '/app/my-schedule',
        },
        'attendance'
      );

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
    } catch (error: any) {
      functions.logger.error(`${checkType} 알림 처리 중 오류 발생`, {
        workLogId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
