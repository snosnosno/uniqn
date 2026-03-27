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

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import {
  getPushTokens,
  removeInvalidTokens,
  isTokenInvalidError,
} from "./fcmTokenUtils";

const expo = new Expo();

const db = admin.firestore();

// ============================================================================
// Admin Cache
// ============================================================================

let adminCache: { userIds: string[]; fetchedAt: number } | null = null;
const ADMIN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getAdminUserIds(): Promise<string[]> {
  if (adminCache && Date.now() - adminCache.fetchedAt < ADMIN_CACHE_TTL) {
    return adminCache.userIds;
  }

  const adminUsersSnap = await db
    .collection("users")
    .where("role", "==", "admin")
    .get();

  const userIds = adminUsersSnap.docs.map((doc) => doc.id);
  adminCache = { userIds, fetchedAt: Date.now() };
  return userIds;
}

// ============================================================================
// Types
// ============================================================================

/** 알림 타입 */
export type NotificationType =
  | "new_application"
  | "application_confirmed"
  | "application_rejected"
  | "application_cancelled"
  | "confirmation_cancelled"
  | "cancellation_approved" // 취소 요청 승인
  | "cancellation_rejected" // 취소 요청 거절
  | "staff_checked_in"
  | "staff_checked_out"
  | "check_in_confirmed" // 출근 확인 (스태프 본인에게)
  | "check_out_confirmed" // 퇴근 확인 (스태프 본인에게)
  | "checkin_reminder"
  | "no_show_alert"
  | "schedule_change"
  | "schedule_created"
  | "schedule_cancelled"
  | "settlement_completed"
  | "settlement_requested"
  | "negative_settlement_alert"
  | "job_updated"
  | "job_cancelled"
  | "job_closed"
  | "announcement"
  | "maintenance"
  | "app_update"
  | "inquiry_answered"
  | "report_resolved"
  | "new_report"
  | "new_inquiry"
  | "tournament_approval_request"
  | "review_request"
  | "review_received"
  | "review_reminder";

/** 알림 카테고리 */
export type NotificationCategory =
  | "application"
  | "attendance"
  | "settlement"
  | "job"
  | "system"
  | "admin"
  | "review";

/** 알림 우선순위 */
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

/** Android 알림 채널 */
export type AndroidChannelId =
  | "applications"
  | "reminders"
  | "settlement"
  | "announcements"
  | "default";

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

/**
 * 미읽음 알림 카운터 문서 타입
 * @path users/{userId}/counters/notifications
 */
export interface UnreadCounterDocument {
  /** 미읽음 알림 수 */
  unreadCount: number;
  /** 마지막 업데이트 시간 */
  lastUpdatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  /** 초기화 시간 (initializeUnreadCounter 호출 시) */
  initializedAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

/**
 * 실패한 카운터 연산 기록 타입
 * @path _failedCounterOps/{docId}
 */
export interface FailedCounterOperation {
  /** 사용자 ID */
  userId: string;
  /** 연산 종류 */
  operation: "increment" | "decrement";
  /** 변경량 */
  delta: number;
  /** 관련 알림 ID */
  notificationId: string | null;
  /** 에러 메시지 */
  error: string;
  /** 생성 시간 */
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  /** 재시도 횟수 */
  retryCount: number;
  /** 상태 */
  status: "pending" | "processing" | "completed" | "failed";
  /** 마지막 재시도 시간 */
  lastRetryAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  /** 마지막 에러 메시지 */
  lastError?: string;
  /** 최종 실패 시간 */
  failedAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

// ============================================================================
// Mappings
// ============================================================================

/** 알림 타입 → 카테고리 매핑 */
const TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  new_application: "application",
  application_confirmed: "application",
  application_rejected: "application",
  application_cancelled: "application",
  confirmation_cancelled: "application",
  cancellation_approved: "application",
  cancellation_rejected: "application",
  staff_checked_in: "attendance",
  staff_checked_out: "attendance",
  check_in_confirmed: "attendance",
  check_out_confirmed: "attendance",
  checkin_reminder: "attendance",
  no_show_alert: "attendance",
  schedule_change: "attendance",
  schedule_created: "attendance",
  schedule_cancelled: "attendance",
  settlement_completed: "settlement",
  settlement_requested: "settlement",
  negative_settlement_alert: "admin",
  job_updated: "job",
  job_cancelled: "job",
  job_closed: "job",
  announcement: "system",
  maintenance: "system",
  app_update: "system",
  inquiry_answered: "admin",
  report_resolved: "admin",
  new_report: "admin",
  new_inquiry: "admin",
  tournament_approval_request: "admin",
  review_request: "review",
  review_received: "review",
  review_reminder: "review",
};

/** 알림 타입 → Android 채널 매핑 */
const TYPE_TO_CHANNEL: Record<NotificationType, AndroidChannelId> = {
  new_application: "applications",
  application_confirmed: "applications",
  application_rejected: "applications",
  application_cancelled: "applications",
  confirmation_cancelled: "applications",
  cancellation_approved: "applications",
  cancellation_rejected: "applications",
  staff_checked_in: "reminders",
  staff_checked_out: "reminders",
  check_in_confirmed: "default",
  check_out_confirmed: "default",
  checkin_reminder: "reminders",
  no_show_alert: "reminders",
  schedule_change: "reminders",
  schedule_created: "reminders",
  schedule_cancelled: "reminders",
  settlement_completed: "settlement",
  settlement_requested: "settlement",
  negative_settlement_alert: "settlement",
  job_updated: "announcements",
  job_cancelled: "announcements",
  job_closed: "announcements",
  announcement: "announcements",
  maintenance: "announcements",
  app_update: "announcements",
  inquiry_answered: "default",
  report_resolved: "default",
  new_report: "default",
  new_inquiry: "default",
  tournament_approval_request: "default",
  review_request: "default",
  review_received: "default",
  review_reminder: "reminders",
};

/**
 * 방해 금지 시간에도 전송되는 긴급 알림 타입
 *
 * @description urgent 우선순위 알림은 사용자가 방해 금지 모드를 설정해도 전송됨
 */
const URGENT_NOTIFICATION_TYPES: NotificationType[] = [
  "checkin_reminder",
  "no_show_alert",
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
  userId: string,
): Promise<UserNotificationSettings | null> {
  try {
    const settingsDoc = await db
      .collection("users")
      .doc(userId)
      .collection("notificationSettings")
      .doc("default")
      .get();

    if (!settingsDoc.exists) {
      return null;
    }

    return settingsDoc.data() as UserNotificationSettings;
  } catch (error: unknown) {
    logger.warn("알림 설정 조회 실패", {
      userId,
      error: error instanceof Error ? error.message : String(error),
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
  quietHours: UserNotificationSettings["quietHours"],
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

  const [startHour, startMinute] = quietHours.start.split(":").map(Number);
  const [endHour, endMinute] = quietHours.end.split(":").map(Number);
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
  type: NotificationType,
): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getUserNotificationSettings(userId);

  // 설정이 없으면 기본적으로 허용
  if (!settings) {
    return { allowed: true };
  }

  // 전체 알림 비활성화
  if (!settings.enabled) {
    return { allowed: false, reason: "notifications_disabled" };
  }

  // 전체 푸시 비활성화
  if (settings.pushEnabled === false) {
    return { allowed: false, reason: "push_disabled" };
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
      return { allowed: false, reason: "quiet_hours" };
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
  options: CreateNotificationOptions = {},
): Promise<NotificationResult> {
  const {
    link,
    data = {},
    priority = "normal",
    channelId = TYPE_TO_CHANNEL[type],
    relatedId,
    senderId,
  } = options;

  const category = TYPE_TO_CATEGORY[type];

  // 0. 알림 설정 확인 + 사용자 문서 조회 (병렬 처리로 성능 최적화)
  const [permissionCheck, userDoc] = await Promise.all([
    checkNotificationPermission(recipientId, type),
    db.collection("users").doc(recipientId).get(),
  ]);

  if (!permissionCheck.allowed) {
    logger.info("사용자 알림 설정에 의해 푸시 전송 생략", {
      recipientId,
      type,
      category,
      reason: permissionCheck.reason,
    });

    // Firestore에는 알림 문서 생성 (인앱 알림용), FCM만 생략
    const notificationRef = db.collection("notifications").doc();
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
      createdAt: FieldValue.serverTimestamp(),
      // 푸시 전송 생략 사유 기록
      pushSkipped: true,
      pushSkipReason: permissionCheck.reason,
    });

    // 🆕 미읽음 카운터 증가 (비동기, 실패 시 _failedCounterOps에 기록됨)
    updateUnreadCounter(recipientId, 1, notificationId).catch(() => {
      // 에러는 updateUnreadCounter 내부에서 로깅 및 기록됨
    });

    return {
      notificationId,
      fcmSent: false,
      successCount: 0,
      failureCount: 0,
    };
  }

  // 1. Firestore 알림 문서 생성
  const notificationRef = db.collection("notifications").doc();
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
    createdAt: FieldValue.serverTimestamp(),
  };

  await notificationRef.set(notificationDoc);

  // 🆕 미읽음 카운터 증가 (비동기, 실패 시 _failedCounterOps에 기록됨)
  updateUnreadCounter(recipientId, 1, notificationId).catch(() => {
    // 에러는 updateUnreadCounter 내부에서 로깅 및 기록됨
  });

  logger.info("알림 문서 생성 완료", {
    notificationId,
    recipientId,
    type,
  });

  // 2. 수신자의 푸시 토큰 조회 (이미 병렬로 조회됨)
  const userData = userDoc.data();
  const tokens = getPushTokens(userData);

  if (tokens.length === 0) {
    logger.warn("FCM 토큰이 없습니다", {
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
      link: link ?? "",
      ...data,
    },
    channelId,
    priority,
  });

  // 4. 전송 결과 업데이트
  if (fcmResult.success > 0) {
    await notificationRef.update({
      sentAt: FieldValue.serverTimestamp(),
      fcmSuccess: fcmResult.success,
      fcmFailure: fcmResult.failure,
    });
  }

  // 5. 만료된 토큰 자동 정리
  if (fcmResult.invalidTokens.length > 0) {
    // 비동기로 처리 (알림 전송 결과에 영향 주지 않음)
    removeInvalidTokens(recipientId, fcmResult.invalidTokens).catch((error) => {
      logger.error("만료 토큰 정리 실패", {
        recipientId,
        tokenCount: fcmResult.invalidTokens.length,
        error: error.message,
      });
    });
  }

  logger.info("알림 전송 완료", {
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
 * 푸시 알림 멀티캐스트 전송 (Expo Push API + FCM 하이브리드)
 *
 * @description
 * - Expo Push Token (`ExponentPushToken[...]`) → Expo Push API로 전송
 * - FCM Registration Token → 기존 admin.messaging()으로 전송
 * - 전환기 동안 두 형식 모두 처리 가능
 *
 * @param tokens 푸시 토큰 배열 (Expo + FCM 혼합 가능)
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
  },
): Promise<MulticastResult> {
  const {
    title,
    body,
    data = {},
    channelId = "default",
    priority = "normal",
  } = payload;

  // 토큰 형식별 분리 (원본 인덱스 보존)
  const expoIndices: number[] = [];
  const fcmIndices: number[] = [];

  tokens.forEach((t, i) => {
    if (Expo.isExpoPushToken(t)) {
      expoIndices.push(i);
    } else {
      fcmIndices.push(i);
    }
  });

  const expoTokens = expoIndices.map((i) => tokens[i]);
  const fcmTokens = fcmIndices.map((i) => tokens[i]);

  // 원본 tokens 배열 순서와 일치하는 응답 배열
  const orderedResponses: MulticastResult["responses"] = new Array(
    tokens.length,
  );
  const invalidTokens: string[] = [];
  let totalSuccess = 0;
  let totalFailure = 0;

  // ── 1. Expo Push Token → Expo Push API ──
  if (expoTokens.length > 0) {
    const expoPriority =
      priority === "urgent" || priority === "high" ? "high" : "normal";

    const messages: ExpoPushMessage[] = expoTokens.map((token) => ({
      to: token,
      title,
      body,
      data,
      sound: "default" as const,
      channelId,
      priority: expoPriority,
    }));

    const chunks = expo.chunkPushNotifications(messages);
    let processedCount = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);

        tickets.forEach((ticket: ExpoPushTicket) => {
          const expoIdx = processedCount;
          const originalIdx = expoIndices[expoIdx];
          const token = expoTokens[expoIdx];
          processedCount++;

          if (ticket.status === "ok") {
            totalSuccess++;
            orderedResponses[originalIdx] = {
              success: true,
              messageId: ticket.id,
            };
          } else {
            totalFailure++;
            orderedResponses[originalIdx] = {
              success: false,
              error: ticket.message,
              errorCode: ticket.details?.error,
            };

            // DeviceNotRegistered → 토큰 만료
            if (ticket.details?.error === "DeviceNotRegistered" && token) {
              invalidTokens.push(token);
            }
          }
        });
      } catch (error: unknown) {
        logger.error("Expo Push API 전송 실패", {
          error: error instanceof Error ? error.message : String(error),
          chunkSize: chunk.length,
        });

        for (let j = 0; j < chunk.length; j++) {
          const originalIdx = expoIndices[processedCount];
          processedCount++;
          totalFailure++;
          orderedResponses[originalIdx] = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    logger.info("Expo Push 전송 완료", {
      total: expoTokens.length,
      success: totalSuccess,
      failure: totalFailure,
    });
  }

  // ── 2. FCM Token → admin.messaging() (하위호환, 전환기) ──
  if (fcmTokens.length > 0) {
    const androidPriority =
      priority === "urgent" || priority === "high" ? "high" : "normal";

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title,
        body,
      },
      data,
      tokens: fcmTokens,
      android: {
        priority: androidPriority,
        notification: {
          sound: "default",
          channelId,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      response.responses.forEach((r, index) => {
        const originalIdx = fcmIndices[index];
        const errorCode = r.error?.code;

        if (!r.success && isTokenInvalidError(errorCode)) {
          invalidTokens.push(fcmTokens[index]);
        }

        orderedResponses[originalIdx] = {
          success: r.success,
          messageId: r.success ? r.messageId : undefined,
          error: r.error?.message,
          errorCode,
        };
      });

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      logger.info("FCM 전송 완료", {
        total: fcmTokens.length,
        success: response.successCount,
        failure: response.failureCount,
      });
    } catch (error: unknown) {
      logger.error("FCM 멀티캐스트 전송 실패", {
        error: error instanceof Error ? error.message : String(error),
        tokenCount: fcmTokens.length,
      });

      fcmTokens.forEach((_, index) => {
        const originalIdx = fcmIndices[index];
        totalFailure++;
        orderedResponses[originalIdx] = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      });
    }
  }

  // 만료된 토큰이 있으면 로깅
  if (invalidTokens.length > 0) {
    logger.info("만료/무효 토큰 감지", {
      invalidCount: invalidTokens.length,
      totalTokens: tokens.length,
    });
  }

  return {
    success: totalSuccess,
    failure: totalFailure,
    responses: orderedResponses,
    invalidTokens,
  };
}

/**
 * 미읽음 알림 카운터 증가
 *
 * @description Firestore 경로: users/{userId}/counters/notifications
 * @param userId 사용자 ID
 * @param delta 증가 값 (양수만 사용, 기본값 1)
 * @param notificationId 알림 ID (실패 시 복구용)
 *
 * @note 증가는 FieldValue.increment 사용 (원자적)
 * @note 실패 시 _failedCounterOps에 기록하여 배치 재동기화 지원
 */
export async function updateUnreadCounter(
  userId: string,
  delta: number = 1,
  notificationId?: string,
): Promise<void> {
  // 증가만 허용 (감소는 decrementUnreadCounter 사용)
  if (delta <= 0) {
    logger.warn(
      "updateUnreadCounter는 양수만 허용, decrementUnreadCounter 사용 필요",
      {
        userId,
        delta,
      },
    );
    return;
  }

  const counterRef = db
    .collection("users")
    .doc(userId)
    .collection("counters")
    .doc("notifications");

  try {
    await counterRef.set(
      {
        unreadCount: FieldValue.increment(delta),
        lastUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    logger.info("미읽음 카운터 증가", {
      userId,
      delta,
    });
  } catch (error: unknown) {
    // 🆕 실패 시 _failedCounterOps에 기록 (배치 재동기화용)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("미읽음 카운터 증가 실패 - 복구 대기열에 추가", {
      userId,
      delta,
      notificationId,
      error: errorMessage,
    });

    try {
      await db.collection("_failedCounterOps").add({
        userId,
        operation: "increment",
        delta,
        notificationId: notificationId ?? null,
        error: errorMessage,
        createdAt: FieldValue.serverTimestamp(),
        retryCount: 0,
        status: "pending", // pending | processing | completed | failed
      });
    } catch (recordError) {
      // 실패 기록도 실패하면 로깅만 (추가 조치 없음)
      logger.error("실패 기록 저장 실패", {
        userId,
        originalError: errorMessage,
        recordError:
          recordError instanceof Error ? recordError.message : "Unknown",
      });
    }

    // 원래 에러를 다시 throw하여 호출자에게 알림
    throw error;
  }
}

/**
 * 미읽음 알림 카운터 감소 (음수 방지, 재시도 + 실패 기록)
 *
 * @description 트랜잭션으로 음수 방지, 재시도 한도 초과 시 실패 기록
 * @param userId 사용자 ID
 * @param delta 감소 값 (양수로 입력, 기본값 1)
 * @param notificationId 알림 ID (실패 시 복구용, 선택)
 *
 * @note 알림 읽음 처리 시 사용 (onNotificationRead 트리거)
 * @note Firestore 트랜잭션은 기본적으로 5회 재시도 (경합 시)
 */
export async function decrementUnreadCounter(
  userId: string,
  delta: number = 1,
  notificationId?: string,
): Promise<void> {
  const counterRef = db
    .collection("users")
    .doc(userId)
    .collection("counters")
    .doc("notifications");

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentCount = counterDoc.exists
          ? (counterDoc.data()?.unreadCount ?? 0)
          : 0;

        // 음수 방지: 최소 0
        const newCount = Math.max(0, currentCount - delta);

        transaction.set(
          counterRef,
          {
            unreadCount: newCount,
            lastUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });

      logger.info("미읽음 카운터 감소 (트랜잭션)", {
        userId,
        delta,
        attempt,
      });

      return; // 성공 시 함수 종료
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES) {
        // 재시도 전 대기 (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * Math.pow(2, attempt)),
        );
        logger.warn("카운터 감소 트랜잭션 재시도", {
          userId,
          delta,
          attempt,
          error: lastError.message,
        });
      }
    }
  }

  // 🆕 최대 재시도 초과 시 실패 기록
  logger.error("미읽음 카운터 감소 최종 실패 - 복구 대기열에 추가", {
    userId,
    delta,
    notificationId,
    error: lastError?.message,
  });

  try {
    await db.collection("_failedCounterOps").add({
      userId,
      operation: "decrement",
      delta,
      notificationId: notificationId ?? null,
      error: lastError?.message ?? "Max retries exceeded",
      createdAt: FieldValue.serverTimestamp(),
      retryCount: 0,
      status: "pending",
    });

    // 사용자 문서에 동기화 필요 플래그 설정
    await db.collection("users").doc(userId).update({
      _counterSyncRequired: true,
      _counterSyncRequestedAt: FieldValue.serverTimestamp(),
    });
  } catch (recordError) {
    logger.error("실패 기록 저장 실패", {
      userId,
      originalError: lastError?.message,
      recordError:
        recordError instanceof Error ? recordError.message : "Unknown",
    });
  }

  // 원래 에러를 다시 throw
  throw lastError;
}

/**
 * 미읽음 알림 카운터 리셋 (0으로 초기화)
 *
 * @description markAllAsRead에서 사용 - 배치 업데이트 후 직접 리셋
 * @param userId 사용자 ID
 *
 * @note 배치 업데이트 시 개별 트리거가 스킵되므로 직접 리셋 필요
 */
export async function resetUnreadCounter(userId: string): Promise<void> {
  const counterRef = db
    .collection("users")
    .doc(userId)
    .collection("counters")
    .doc("notifications");

  await counterRef.set(
    {
      unreadCount: 0,
      lastUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  logger.info("미읽음 카운터 리셋", {
    userId,
  });
}

/**
 * 실패한 카운터 연산 재처리
 *
 * @description 스케줄러에서 호출하여 _failedCounterOps 컬렉션의 실패 기록을 재처리
 * @param batchSize 한 번에 처리할 최대 건수 (기본값: 100)
 * @returns 처리 결과 (성공/실패 건수)
 *
 * @example
 * // Cloud Scheduler에서 1시간마다 호출
 * exports.retryFailedCounterOps = functions.pubsub
 *   .schedule('every 1 hours')
 *   .onRun(async () => {
 *     await retryFailedCounterOps(100);
 *   });
 */
export async function retryFailedCounterOps(
  batchSize: number = 100,
): Promise<{ success: number; failed: number; skipped: number }> {
  const MAX_RETRY_COUNT = 3;

  // pending 상태의 실패 기록 조회
  const failedOpsQuery = db
    .collection("_failedCounterOps")
    .where("status", "==", "pending")
    .where("retryCount", "<", MAX_RETRY_COUNT)
    .orderBy("retryCount", "asc")
    .orderBy("createdAt", "asc")
    .limit(batchSize);

  const snapshot = await failedOpsQuery.get();

  if (snapshot.empty) {
    logger.info("재처리할 실패 카운터 연산 없음");
    return { success: 0, failed: 0, skipped: 0 };
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { userId, operation, delta } = data;

    try {
      // 재처리 중 표시
      await doc.ref.update({
        status: "processing",
        lastRetryAt: FieldValue.serverTimestamp(),
      });

      // 카운터 연산 재시도
      const counterRef = db
        .collection("users")
        .doc(userId)
        .collection("counters")
        .doc("notifications");

      if (operation === "increment") {
        await counterRef.set(
          {
            unreadCount: FieldValue.increment(delta),
            lastUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else if (operation === "decrement") {
        // 감소는 트랜잭션으로 음수 방지
        await db.runTransaction(async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          const currentCount = counterDoc.exists
            ? (counterDoc.data()?.unreadCount ?? 0)
            : 0;
          const newCount = Math.max(0, currentCount - delta);

          transaction.set(
            counterRef,
            {
              unreadCount: newCount,
              lastUpdatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        });
      }

      // 성공 시 삭제
      await doc.ref.delete();
      success++;
    } catch (retryError: unknown) {
      const newRetryCount = (data.retryCount ?? 0) + 1;
      const errorMessage =
        retryError instanceof Error ? retryError.message : "Unknown error";

      if (newRetryCount >= MAX_RETRY_COUNT) {
        // 30일 이상 된 문서는 삭제
        const createdAt = data.createdAt as
          | admin.firestore.Timestamp
          | undefined;
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (createdAt && createdAt.toMillis() < thirtyDaysAgo) {
          await doc.ref.delete();
          logger.info("30일 경과 실패 카운터 연산 삭제", {
            docId: doc.id,
            userId,
          });
        } else {
          await doc.ref.update({
            status: "failed",
            retryCount: newRetryCount,
            lastError: errorMessage,
            failedAt: FieldValue.serverTimestamp(),
          });
        }
        failed++;
      } else {
        // 다음 재시도를 위해 대기
        await doc.ref.update({
          status: "pending",
          retryCount: newRetryCount,
          lastError: errorMessage,
        });
        skipped++;
      }
    }
  }

  logger.info("실패 카운터 연산 재처리 완료", {
    total: snapshot.size,
    success,
    failed,
    skipped,
  });

  return { success, failed, skipped };
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
  options: CreateNotificationOptions = {},
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
            logger.error("개별 알림 전송 실패", {
              recipientId,
              error: error.message,
            });
            return {
              recipientId,
              result: {
                notificationId: "",
                fcmSent: false,
                successCount: 0,
                failureCount: 0,
              },
            };
          }),
      ),
    );

    for (const { recipientId, result } of batchResults) {
      results.set(recipientId, result);
    }
  }

  return results;
}
