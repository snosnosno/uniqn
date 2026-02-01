/**
 * 알림 유틸리티
 *
 * @description 알림 생성 및 FCM 전송 공통 함수
 * @version 1.1.0
 *
 * @changelog
 * - 1.1.0: 알림 설정 확인 로직 추가, 토큰 만료 자동 정리
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getFcmTokens, removeInvalidTokens, isTokenInvalidError } from './fcmTokenUtils';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

/** 알림 타입 */
export type NotificationType =
  | 'new_application'
  | 'application_confirmed'
  | 'application_rejected'
  | 'application_cancelled'
  | 'confirmation_cancelled'
  | 'cancellation_approved'     // 취소 요청 승인
  | 'cancellation_rejected'     // 취소 요청 거절
  | 'staff_checked_in'
  | 'staff_checked_out'
  | 'check_in_confirmed'    // 출근 확인 (스태프 본인에게)
  | 'check_out_confirmed'   // 퇴근 확인 (스태프 본인에게)
  | 'checkin_reminder'
  | 'no_show_alert'
  | 'schedule_change'
  | 'schedule_created'
  | 'schedule_cancelled'
  | 'settlement_completed'
  | 'settlement_requested'
  | 'job_updated'
  | 'job_cancelled'
  | 'job_closed'
  | 'announcement'
  | 'maintenance'
  | 'app_update'
  | 'inquiry_answered'
  | 'report_resolved'
  | 'new_report'
  | 'new_inquiry'
  | 'tournament_approval_request';

/** 알림 카테고리 */
export type NotificationCategory =
  | 'application'
  | 'attendance'
  | 'settlement'
  | 'job'
  | 'system'
  | 'admin';

/** 알림 우선순위 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Android 알림 채널 */
export type AndroidChannelId =
  | 'applications'
  | 'reminders'
  | 'settlement'
  | 'announcements'
  | 'default';

/** 알림 생성 옵션 */
export interface CreateNotificationOptions {
  /** 딥링크 경로 (예: /employer/applications/123) */
  link?: string;
  /** 추가 데이터 */
  data?: Record<string, string>;
  /** 우선순위 */
  priority?: NotificationPriority;
  /** Android 채널 ID */
  channelId?: AndroidChannelId;
  /** 관련 문서 ID */
  relatedId?: string;
  /** 발신자 ID */
  senderId?: string;
}

/** 알림 생성 결과 */
export interface NotificationResult {
  /** 생성된 알림 문서 ID */
  notificationId: string;
  /** FCM 전송 성공 여부 */
  fcmSent: boolean;
  /** 전송 성공한 토큰 수 */
  successCount: number;
  /** 전송 실패한 토큰 수 */
  failureCount: number;
}

/** FCM 멀티캐스트 결과 */
export interface MulticastResult {
  success: number;
  failure: number;
  responses: Array<{
    success: boolean;
    messageId?: string;
    error?: string;
    errorCode?: string;
  }>;
  /** 만료/무효화된 토큰 목록 (자동 정리용) */
  invalidTokens: string[];
}

/** 알림 설정 (카테고리별) */
export interface NotificationCategorySettings {
  enabled: boolean;
  pushEnabled: boolean;
}

/** 사용자 알림 설정 */
export interface UserNotificationSettings {
  enabled: boolean;
  pushEnabled?: boolean;
  categories: {
    [key in NotificationCategory]?: NotificationCategorySettings;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
  };
}

// ============================================================================
// Mappings
// ============================================================================

/** 알림 타입 → 카테고리 매핑 */
const TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  new_application: 'application',
  application_confirmed: 'application',
  application_rejected: 'application',
  application_cancelled: 'application',
  confirmation_cancelled: 'application',
  cancellation_approved: 'application',
  cancellation_rejected: 'application',
  staff_checked_in: 'attendance',
  staff_checked_out: 'attendance',
  check_in_confirmed: 'attendance',
  check_out_confirmed: 'attendance',
  checkin_reminder: 'attendance',
  no_show_alert: 'attendance',
  schedule_change: 'attendance',
  schedule_created: 'attendance',
  schedule_cancelled: 'attendance',
  settlement_completed: 'settlement',
  settlement_requested: 'settlement',
  job_updated: 'job',
  job_cancelled: 'job',
  job_closed: 'job',
  announcement: 'system',
  maintenance: 'system',
  app_update: 'system',
  inquiry_answered: 'admin',
  report_resolved: 'admin',
  new_report: 'admin',
  new_inquiry: 'admin',
  tournament_approval_request: 'admin',
};

/** 알림 타입 → Android 채널 매핑 */
const TYPE_TO_CHANNEL: Record<NotificationType, AndroidChannelId> = {
  new_application: 'applications',
  application_confirmed: 'applications',
  application_rejected: 'applications',
  application_cancelled: 'applications',
  confirmation_cancelled: 'applications',
  cancellation_approved: 'applications',
  cancellation_rejected: 'applications',
  staff_checked_in: 'reminders',
  staff_checked_out: 'reminders',
  check_in_confirmed: 'default',
  check_out_confirmed: 'default',
  checkin_reminder: 'reminders',
  no_show_alert: 'reminders',
  schedule_change: 'reminders',
  schedule_created: 'reminders',
  schedule_cancelled: 'reminders',
  settlement_completed: 'settlement',
  settlement_requested: 'settlement',
  job_updated: 'announcements',
  job_cancelled: 'announcements',
  job_closed: 'announcements',
  announcement: 'announcements',
  maintenance: 'announcements',
  app_update: 'announcements',
  inquiry_answered: 'default',
  report_resolved: 'default',
  new_report: 'default',
  new_inquiry: 'default',
  tournament_approval_request: 'default',
};

/**
 * 방해 금지 시간에도 전송되는 긴급 알림 타입
 *
 * @description urgent 우선순위 알림은 사용자가 방해 금지 모드를 설정해도 전송됨
 */
const URGENT_NOTIFICATION_TYPES: NotificationType[] = [
  'checkin_reminder',
  'no_show_alert',
];

// ============================================================================
// Notification Settings Functions
// ============================================================================

/**
 * 사용자 알림 설정 조회
 *
 * @param userId 사용자 ID
 * @returns 알림 설정 또는 null (설정이 없으면 기본값 사용)
 *
 * @description Firestore 경로: users/{userId}/notificationSettings/default
 */
async function getUserNotificationSettings(
  userId: string
): Promise<UserNotificationSettings | null> {
  try {
    const settingsDoc = await db
      .collection('users')
      .doc(userId)
      .collection('notificationSettings')
      .doc('default')
      .get();

    if (!settingsDoc.exists) {
      return null;
    }

    return settingsDoc.data() as UserNotificationSettings;
  } catch (error: any) {
    functions.logger.warn('알림 설정 조회 실패', {
      userId,
      error: error.message,
    });
    return null;
  }
}

/**
 * 방해 금지 시간인지 확인
 *
 * @param quietHours 방해 금지 설정
 * @returns 현재 방해 금지 시간인지 여부
 */
function isQuietHoursActive(
  quietHours: UserNotificationSettings['quietHours']
): boolean {
  if (!quietHours?.enabled) {
    return false;
  }

  const now = new Date();
  // 한국 시간 (UTC+9)
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentHour = koreaTime.getUTCHours();
  const currentMinute = koreaTime.getUTCMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = quietHours.start.split(':').map(Number);
  const [endHour, endMinute] = quietHours.end.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  // 자정을 넘어가는 경우 (예: 22:00 ~ 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  // 같은 날 내 (예: 14:00 ~ 18:00)
  return currentTime >= startTime && currentTime < endTime;
}

/**
 * 푸시 알림 전송 가능 여부 확인
 *
 * @param userId 사용자 ID
 * @param type 알림 타입
 * @returns 전송 가능 여부와 사유
 */
async function checkNotificationPermission(
  userId: string,
  type: NotificationType
): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getUserNotificationSettings(userId);

  // 설정이 없으면 기본적으로 허용
  if (!settings) {
    return { allowed: true };
  }

  // 전체 알림 비활성화
  if (!settings.enabled) {
    return { allowed: false, reason: 'notifications_disabled' };
  }

  // 전체 푸시 비활성화
  if (settings.pushEnabled === false) {
    return { allowed: false, reason: 'push_disabled' };
  }

  // 카테고리별 설정 확인
  const category = TYPE_TO_CATEGORY[type];
  const categorySettings = settings.categories?.[category];

  if (categorySettings) {
    // 카테고리 알림 비활성화
    if (!categorySettings.enabled) {
      return { allowed: false, reason: `category_${category}_disabled` };
    }

    // 카테고리 푸시 비활성화
    if (!categorySettings.pushEnabled) {
      return { allowed: false, reason: `category_${category}_push_disabled` };
    }
  }

  // 방해 금지 시간 확인 (urgent 우선순위는 예외)
  if (isQuietHoursActive(settings.quietHours)) {
    // urgent 알림은 방해 금지 시간에도 전송
    const isUrgent = URGENT_NOTIFICATION_TYPES.includes(type);
    if (!isUrgent) {
      return { allowed: false, reason: 'quiet_hours' };
    }
  }

  return { allowed: true };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 알림 생성 및 FCM 전송
 *
 * @description
 * 1. Firestore notifications 문서 생성
 * 2. 수신자의 FCM 토큰 조회
 * 3. FCM 멀티캐스트 전송
 * 4. 전송 결과 업데이트
 *
 * @param recipientId 수신자 사용자 ID
 * @param type 알림 타입
 * @param title 알림 제목
 * @param body 알림 본문
 * @param options 추가 옵션
 * @returns 알림 생성 결과
 *
 * @example
 * await createAndSendNotification(
 *   employerId,
 *   'new_application',
 *   '📨 새로운 지원자',
 *   `${applicantName}님이 지원했습니다`,
 *   { link: `/employer/applications/${applicationId}` }
 * );
 */
export async function createAndSendNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  body: string,
  options: CreateNotificationOptions = {}
): Promise<NotificationResult> {
  const {
    link,
    data = {},
    priority = 'normal',
    channelId = TYPE_TO_CHANNEL[type],
    relatedId,
    senderId,
  } = options;

  const category = TYPE_TO_CATEGORY[type];

  // 0. 알림 설정 확인 + 사용자 문서 조회 (병렬 처리로 성능 최적화)
  const [permissionCheck, userDoc] = await Promise.all([
    checkNotificationPermission(recipientId, type),
    db.collection('users').doc(recipientId).get(),
  ]);

  if (!permissionCheck.allowed) {
    functions.logger.info('사용자 알림 설정에 의해 푸시 전송 생략', {
      recipientId,
      type,
      category,
      reason: permissionCheck.reason,
    });

    // Firestore에는 알림 문서 생성 (인앱 알림용), FCM만 생략
    const notificationRef = db.collection('notifications').doc();
    const notificationId = notificationRef.id;

    await notificationRef.set({
      id: notificationId,
      recipientId,
      type,
      category,
      priority,
      title,
      body,
      link,
      data: { ...data, type, notificationId },
      relatedId: relatedId ?? null,
      senderId: senderId ?? null,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // 푸시 전송 생략 사유 기록
      pushSkipped: true,
      pushSkipReason: permissionCheck.reason,
    });

    return {
      notificationId,
      fcmSent: false,
      successCount: 0,
      failureCount: 0,
    };
  }

  // 1. Firestore 알림 문서 생성
  const notificationRef = db.collection('notifications').doc();
  const notificationId = notificationRef.id;

  const notificationDoc = {
    id: notificationId,
    recipientId,
    type,
    category,
    priority,
    title,
    body,
    link,
    data: {
      ...data,
      type,
      notificationId,
    },
    relatedId: relatedId ?? null,
    senderId: senderId ?? null,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await notificationRef.set(notificationDoc);

  functions.logger.info('알림 문서 생성 완료', {
    notificationId,
    recipientId,
    type,
  });

  // 2. 수신자의 FCM 토큰 조회 (이미 병렬로 조회됨)
  const userData = userDoc.data();
  const tokens = getFcmTokens(userData);

  if (tokens.length === 0) {
    functions.logger.warn('FCM 토큰이 없습니다', {
      recipientId,
      notificationId,
    });

    return {
      notificationId,
      fcmSent: false,
      successCount: 0,
      failureCount: 0,
    };
  }

  // 3. FCM 멀티캐스트 전송
  const fcmResult = await sendMulticast(tokens, {
    title,
    body,
    data: {
      type,
      notificationId,
      link: link ?? '',
      ...data,
    },
    channelId,
    priority,
  });

  // 4. 전송 결과 업데이트
  if (fcmResult.success > 0) {
    await notificationRef.update({
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      fcmSuccess: fcmResult.success,
      fcmFailure: fcmResult.failure,
    });
  }

  // 5. 만료된 토큰 자동 정리
  if (fcmResult.invalidTokens.length > 0) {
    // 비동기로 처리 (알림 전송 결과에 영향 주지 않음)
    removeInvalidTokens(recipientId, fcmResult.invalidTokens).catch((error) => {
      functions.logger.error('만료 토큰 정리 실패', {
        recipientId,
        tokenCount: fcmResult.invalidTokens.length,
        error: error.message,
      });
    });
  }

  functions.logger.info('알림 전송 완료', {
    notificationId,
    recipientId,
    success: fcmResult.success,
    failure: fcmResult.failure,
    invalidTokensRemoved: fcmResult.invalidTokens.length,
  });

  return {
    notificationId,
    fcmSent: fcmResult.success > 0,
    successCount: fcmResult.success,
    failureCount: fcmResult.failure,
  };
}

/**
 * FCM 멀티캐스트 전송
 *
 * @param tokens FCM 토큰 배열
 * @param payload 전송할 페이로드
 * @returns 전송 결과
 */
export async function sendMulticast(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
    channelId?: AndroidChannelId;
    priority?: NotificationPriority;
  }
): Promise<MulticastResult> {
  const { title, body, data = {}, channelId = 'default', priority = 'normal' } = payload;

  // Android 우선순위 매핑
  const androidPriority =
    priority === 'urgent' || priority === 'high' ? 'high' : 'normal';

  const message: admin.messaging.MulticastMessage = {
    notification: {
      title,
      body,
    },
    data,
    tokens,
    android: {
      priority: androidPriority,
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

    const invalidTokens: string[] = [];
    const responses = response.responses.map((r, index) => {
      const errorCode = r.error?.code;

      // 토큰 만료/무효 에러 감지
      if (!r.success && isTokenInvalidError(errorCode)) {
        invalidTokens.push(tokens[index]);
      }

      return {
        success: r.success,
        messageId: r.success ? r.messageId : undefined,
        error: r.error?.message,
        errorCode,
      };
    });

    // 만료된 토큰이 있으면 로깅
    if (invalidTokens.length > 0) {
      functions.logger.info('만료/무효 FCM 토큰 감지', {
        invalidCount: invalidTokens.length,
        totalTokens: tokens.length,
      });
    }

    return {
      success: response.successCount,
      failure: response.failureCount,
      responses,
      invalidTokens,
    };
  } catch (error: any) {
    functions.logger.error('FCM 멀티캐스트 전송 실패', {
      error: error.message,
      tokenCount: tokens.length,
    });

    return {
      success: 0,
      failure: tokens.length,
      responses: tokens.map(() => ({
        success: false,
        error: error.message,
      })),
      invalidTokens: [],
    };
  }
}

/**
 * 여러 사용자에게 알림 전송 (브로드캐스트)
 *
 * @param recipientIds 수신자 ID 배열
 * @param type 알림 타입
 * @param title 알림 제목
 * @param body 알림 본문
 * @param options 추가 옵션
 * @returns 각 수신자별 결과
 */
export async function broadcastNotification(
  recipientIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  options: CreateNotificationOptions = {}
): Promise<Map<string, NotificationResult>> {
  const results = new Map<string, NotificationResult>();

  // 병렬 처리 (배치 크기 제한)
  const BATCH_SIZE = 10;

  for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
    const batch = recipientIds.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map((recipientId) =>
        createAndSendNotification(recipientId, type, title, body, options)
          .then((result) => ({ recipientId, result }))
          .catch((error) => {
            functions.logger.error('개별 알림 전송 실패', {
              recipientId,
              error: error.message,
            });
            return {
              recipientId,
              result: {
                notificationId: '',
                fcmSent: false,
                successCount: 0,
                failureCount: 0,
              },
            };
          })
      )
    );

    for (const { recipientId, result } of batchResults) {
      results.set(recipientId, result);
    }
  }

  return results;
}
