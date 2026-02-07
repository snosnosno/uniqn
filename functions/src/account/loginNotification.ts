/**
 * 로그인 알림 Cloud Function
 *
 * @description
 * 사용자 로그인 시 보안 알림 발송
 * - 새 기기에서 로그인 시 알림
 * - 새 위치에서 로그인 시 알림
 * - 의심스러운 활동 감지 시 알림
 * - 로그인 시도 기록 저장
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 로그인 알림 전송 인터페이스
 */
interface LoginAttempt {
  userId: string;
  timestamp: admin.firestore.Timestamp;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  location?: {
    country?: string;
    city?: string;
  };
  success: boolean;
}

/**
 * 로그인 성공 시 알림 전송
 *
 * 클라이언트에서 로그인 성공 후 호출
 */
export const sendLoginNotification = functions.region('asia-northeast3').https.onCall(
  async (data, context) => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;
    const { ipAddress, userAgent, deviceId, location } = data;

    try {
      functions.logger.info(`로그인 알림 처리 시작: ${userId}`);

      // 1. 사용자 알림 설정 조회
      const settingsDoc = await db
        .collection('users')
        .doc(userId)
        .collection('securitySettings')
        .doc('loginNotifications')
        .get();

      const settings = settingsDoc.data();

      // 알림이 비활성화된 경우 조기 종료
      if (!settings || !settings.enabled) {
        functions.logger.info(`로그인 알림 비활성화됨: ${userId}`);
        return { notificationSent: false, reason: 'disabled' };
      }

      // 2. 로그인 시도 기록 저장
      const loginAttempt: LoginAttempt = {
        userId,
        timestamp: admin.firestore.Timestamp.now(),
        ipAddress: ipAddress || context.rawRequest?.ip || 'unknown',
        userAgent:
          userAgent || context.rawRequest?.get('user-agent') || 'unknown',
        deviceId,
        location,
        success: true,
      };

      await db
        .collection('users')
        .doc(userId)
        .collection('loginHistory')
        .add(loginAttempt);

      // 3. 최근 로그인 기록 조회 (지난 30일)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentLoginsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('loginHistory')
        .where('success', '==', true)
        .where(
          'timestamp',
          '>=',
          admin.firestore.Timestamp.fromDate(thirtyDaysAgo)
        )
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      const recentLogins = recentLoginsSnapshot.docs
        .map((doc) => doc.data() as LoginAttempt)
        .filter((login) => login.timestamp.toMillis() < loginAttempt.timestamp.toMillis());

      // 4. 알림 조건 확인
      let shouldNotify = false;
      let notificationReason = '';

      // 4.1. 새 기기 확인
      if (settings.notifyOnNewDevice && deviceId) {
        const isNewDevice = !recentLogins.some(
          (login) => login.deviceId === deviceId
        );
        if (isNewDevice) {
          shouldNotify = true;
          notificationReason = 'new_device';
          functions.logger.info(`새 기기 감지: ${userId}, ${deviceId}`);
        }
      }

      // 4.2. 새 위치 확인
      if (
        settings.notifyOnNewLocation &&
        location?.country &&
        !shouldNotify
      ) {
        const isNewLocation = !recentLogins.some(
          (login) => login.location?.country === location.country
        );
        if (isNewLocation) {
          shouldNotify = true;
          notificationReason = 'new_location';
          functions.logger.info(
            `새 위치 감지: ${userId}, ${location.country}`
          );
        }
      }

      // 4.3. 의심스러운 활동 확인
      if (settings.notifyOnSuspiciousActivity && !shouldNotify) {
        const isSuspicious = await detectSuspiciousActivity(
          userId,
          loginAttempt,
          recentLogins
        );
        if (isSuspicious) {
          shouldNotify = true;
          notificationReason = 'suspicious_activity';
          functions.logger.warn(`의심스러운 활동 감지: ${userId}`);
        }
      }

      // 5. 알림 전송
      if (shouldNotify) {
        await sendNotification(userId, loginAttempt, notificationReason);
        functions.logger.info(
          `로그인 알림 전송 완료: ${userId}, ${notificationReason}`
        );
        return {
          notificationSent: true,
          reason: notificationReason,
        };
      }

      functions.logger.info(`로그인 알림 전송 조건 미충족: ${userId}`);
      return { notificationSent: false, reason: 'no_trigger' };
    } catch (error) {
      functions.logger.error(`로그인 알림 처리 실패: ${userId}`, error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error
          ? error.message
          : 'Failed to process login notification'
      );
    }
  }
);

/**
 * 의심스러운 활동 감지
 *
 * @param userId - 사용자 ID
 * @param currentAttempt - 현재 로그인 시도
 * @param recentLogins - 최근 로그인 기록
 * @returns 의심스러운 활동 여부
 */
async function detectSuspiciousActivity(
  userId: string,
  currentAttempt: LoginAttempt,
  recentLogins: LoginAttempt[]
): Promise<boolean> {
  // 1. 짧은 시간 내 여러 국가에서 로그인 (불가능한 이동)
  if (currentAttempt.location?.country && recentLogins.length > 0) {
    const lastLogin = recentLogins[0];
    const timeDiffMinutes =
      (currentAttempt.timestamp.toMillis() -
        lastLogin.timestamp.toMillis()) /
      (1000 * 60);

    // 1시간 이내에 다른 국가에서 로그인
    if (
      timeDiffMinutes < 60 &&
      lastLogin.location?.country &&
      lastLogin.location.country !== currentAttempt.location.country
    ) {
      functions.logger.warn(
        `불가능한 이동 감지: ${userId}, ${lastLogin.location.country} → ${currentAttempt.location.country} (${timeDiffMinutes.toFixed(1)}분)`
      );
      return true;
    }
  }

  // 2. 비정상적으로 많은 로그인 시도 (5분 내 5회 이상)
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

  const recentAttemptsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('loginHistory')
    .where(
      'timestamp',
      '>=',
      admin.firestore.Timestamp.fromDate(fiveMinutesAgo)
    )
    .get();

  if (recentAttemptsSnapshot.size >= 5) {
    functions.logger.warn(
      `비정상적으로 많은 로그인 시도: ${userId}, ${recentAttemptsSnapshot.size}회`
    );
    return true;
  }

  return false;
}

/**
 * 알림 전송
 *
 * @param userId - 사용자 ID
 * @param loginAttempt - 로그인 시도 정보
 * @param reason - 알림 사유
 */
async function sendNotification(
  userId: string,
  loginAttempt: LoginAttempt,
  reason: string
): Promise<void> {
  try {
    // 사용자 정보 조회
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      throw new Error('User not found');
    }

    // 알림 메시지 생성
    let title = '';
    let body = '';

    switch (reason) {
      case 'new_device':
        title = '새 기기에서 로그인';
        body = `새로운 기기에서 계정에 로그인했습니다.\n기기: ${loginAttempt.userAgent}`;
        break;
      case 'new_location':
        title = '새 위치에서 로그인';
        body = `새로운 위치에서 계정에 로그인했습니다.\n위치: ${loginAttempt.location?.country || '알 수 없음'}`;
        break;
      case 'suspicious_activity':
        title = '⚠️ 의심스러운 로그인 활동';
        body = `비정상적인 로그인 활동이 감지되었습니다. 본인이 아닌 경우 즉시 비밀번호를 변경하세요.`;
        break;
      default:
        title = '로그인 알림';
        body = '계정에 로그인했습니다.';
    }

    // 알림 기록 저장
    await db
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .add({
        type: 'security',
        category: 'login_alert',
        title,
        body,
        data: {
          reason,
          ipAddress: loginAttempt.ipAddress,
          userAgent: loginAttempt.userAgent,
          deviceId: loginAttempt.deviceId,
          location: loginAttempt.location,
          timestamp: loginAttempt.timestamp,
        },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // FCM 푸시 알림 전송 (FCM 토큰이 있는 경우)
    if (userData.fcmToken) {
      try {
        await admin.messaging().send({
          token: userData.fcmToken,
          notification: {
            title,
            body,
          },
          data: {
            type: 'login_alert',
            reason,
          },
          android: {
            priority: 'high',
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        });
        functions.logger.info(`FCM 푸시 알림 전송 완료: ${userId}`);
      } catch (fcmError) {
        functions.logger.error(`FCM 푸시 알림 전송 실패: ${userId}`, fcmError);
        // FCM 실패 시에도 알림 기록은 저장됨
      }
    }
  } catch (error) {
    functions.logger.error(`알림 전송 실패: ${userId}`, error);
    throw error;
  }
}

/**
 * 로그인 실패 기록
 *
 * 클라이언트에서 로그인 실패 시 호출
 */
export const recordLoginFailure = functions.region('asia-northeast3').https.onCall(
  async (data, context) => {
    const { email, ipAddress, userAgent, reason } = data;

    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email is required'
      );
    }

    try {
      // 이메일로 사용자 조회
      const userRecord = await admin.auth().getUserByEmail(email);

      // 실패 기록 저장
      await db
        .collection('users')
        .doc(userRecord.uid)
        .collection('loginHistory')
        .add({
          userId: userRecord.uid,
          timestamp: admin.firestore.Timestamp.now(),
          ipAddress: ipAddress || context.rawRequest?.ip || 'unknown',
          userAgent:
            userAgent || context.rawRequest?.get('user-agent') || 'unknown',
          success: false,
          reason: reason || 'authentication_failed',
        });

      functions.logger.info(`로그인 실패 기록됨: ${userRecord.uid}`);
      return { success: true };
    } catch (error) {
      // 사용자를 찾을 수 없는 경우에도 에러를 노출하지 않음 (보안)
      functions.logger.warn(
        `로그인 실패 기록 중 오류 (이메일: ${email})`,
        error
      );
      return { success: true }; // 클라이언트에는 성공으로 반환
    }
  }
);
