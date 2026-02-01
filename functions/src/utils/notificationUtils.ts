/**
 * 알림 유틸리티
 *
 * @description 알림 생성 및 FCM 전송 공통 함수
 * @version 1.0.0
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getFcmTokens } from './fcmTokenUtils';

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
  responses: Array<{ success: boolean; messageId?: string; error?: string }>;
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

// ============================================================================
// Functions
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

  // 2. 수신자의 FCM 토큰 조회
  const userDoc = await db.collection('users').doc(recipientId).get();
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

  functions.logger.info('알림 전송 완료', {
    notificationId,
    recipientId,
    success: fcmResult.success,
    failure: fcmResult.failure,
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

    const responses = response.responses.map((r, index) => ({
      success: r.success,
      messageId: r.success ? r.messageId : undefined,
      error: r.error?.message,
    }));

    return {
      success: response.successCount,
      failure: response.failureCount,
      responses,
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
