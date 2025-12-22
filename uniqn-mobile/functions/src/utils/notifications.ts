/**
 * UNIQN Functions - 알림 유틸리티
 */

import * as admin from 'firebase-admin';
import { NotificationData, NotificationType, NotificationCategory, FCMMessage, UserDoc } from '../types';

const db = admin.firestore();
const messaging = admin.messaging();

// ============================================================================
// 알림 템플릿
// ============================================================================

interface NotificationTemplate {
  title: (data: Record<string, string>) => string;
  body: (data: Record<string, string>) => string;
  category: NotificationCategory;
  link: (data: Record<string, string>) => string;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  // 지원 관련
  new_application: {
    title: () => '새로운 지원자가 있습니다',
    body: (d) => `${d.applicantName}님이 "${d.jobTitle}" 공고에 지원했습니다.`,
    category: 'application',
    link: (d) => `/employer/my-postings/${d.jobPostingId}/applicants`,
  },
  application_confirmed: {
    title: () => '지원이 확정되었습니다',
    body: (d) => `"${d.jobTitle}" 공고 지원이 확정되었습니다. 스케줄을 확인해주세요.`,
    category: 'application',
    link: (d) => `/app/schedule?date=${d.scheduleDate}`,
  },
  confirmation_cancelled: {
    title: () => '확정이 취소되었습니다',
    body: (d) => `"${d.jobTitle}" 공고의 확정이 취소되었습니다.`,
    category: 'application',
    link: (d) => `/app/jobs/${d.jobPostingId}`,
  },
  application_rejected: {
    title: () => '지원 결과 안내',
    body: (d) => `"${d.jobTitle}" 공고 지원이 반려되었습니다.`,
    category: 'application',
    link: () => '/app/applications',
  },

  // 출퇴근
  staff_checked_in: {
    title: () => '출근 완료',
    body: (d) => `${d.staffName}님이 출근했습니다.`,
    category: 'schedule',
    link: (d) => `/employer/my-postings/${d.jobPostingId}/settlements`,
  },
  staff_checked_out: {
    title: () => '퇴근 완료',
    body: (d) => `${d.staffName}님이 퇴근했습니다. 근무시간: ${d.workHours}`,
    category: 'schedule',
    link: (d) => `/employer/my-postings/${d.jobPostingId}/settlements`,
  },
  checkin_reminder: {
    title: () => '출근 리마인더',
    body: (d) => `"${d.jobTitle}" 공고 출근 시간이 30분 남았습니다.`,
    category: 'schedule',
    link: (d) => `/app/qr?scheduleId=${d.scheduleId}`,
  },
  no_show_alert: {
    title: () => 'No-show 알림',
    body: (d) => `${d.staffName}님이 출근 시간을 30분 이상 경과했습니다.`,
    category: 'schedule',
    link: (d) => `/employer/my-postings/${d.jobPostingId}/settlements`,
  },
  schedule_change: {
    title: () => '스케줄 변경',
    body: (d) => `"${d.jobTitle}" 스케줄이 변경되었습니다.`,
    category: 'schedule',
    link: (d) => `/app/schedule?date=${d.scheduleDate}`,
  },
  work_time_changed: {
    title: () => '근무시간 수정',
    body: (d) => `"${d.jobTitle}" 근무시간이 관리자에 의해 수정되었습니다.`,
    category: 'schedule',
    link: (d) => `/app/schedule?date=${d.scheduleDate}`,
  },

  // 정산
  settlement_completed: {
    title: () => '정산 완료',
    body: (d) => `"${d.jobTitle}" 정산이 완료되었습니다. 금액: ${d.amount}원`,
    category: 'settlement',
    link: () => '/app/settlements',
  },

  // 공고
  new_job_in_area: {
    title: () => '새 공고가 등록되었습니다',
    body: (d) => `${d.location} 지역에 "${d.jobTitle}" 공고가 등록되었습니다.`,
    category: 'job',
    link: (d) => `/jobs/${d.jobPostingId}`,
  },
  job_closing_soon: {
    title: () => '공고 마감 임박',
    body: (d) => `"${d.jobTitle}" 공고가 곧 마감됩니다.`,
    category: 'job',
    link: (d) => `/jobs/${d.jobPostingId}`,
  },

  // 시스템
  system_notice: {
    title: (d) => d.title || '시스템 공지',
    body: (d) => d.message || '',
    category: 'system',
    link: () => '/app/notifications',
  },
  account_deleted: {
    title: () => '계정 삭제 완료',
    body: () => '계정이 정상적으로 삭제되었습니다.',
    category: 'system',
    link: () => '/',
  },
};

// ============================================================================
// 알림 생성 및 전송
// ============================================================================

/**
 * 인앱 알림 생성 및 저장
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, string>
): Promise<string> {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  const notification: NotificationData = {
    userId,
    type,
    category: template.category,
    title: template.title(data),
    body: template.body(data),
    data,
    link: template.link(data),
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('notifications').add(notification);
  return docRef.id;
}

/**
 * 사용자 설정 확인
 */
async function getUserNotificationSettings(userId: string): Promise<{
  enabled: boolean;
  categoryEnabled: boolean;
  fcmTokens: string[];
  isQuietHours: boolean;
}> {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data() as UserDoc | undefined;

  if (!userData) {
    return { enabled: false, categoryEnabled: false, fcmTokens: [], isQuietHours: false };
  }

  const settings = userData.notificationSettings;
  const fcmTokens = userData.fcmTokens || [];

  // 기본값
  if (!settings) {
    return { enabled: true, categoryEnabled: true, fcmTokens, isQuietHours: false };
  }

  // 방해금지 시간 체크
  let isQuietHours = false;
  if (settings.quietHoursStart && settings.quietHoursEnd) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = settings.quietHoursStart.split(':').map(Number);
    const [endH, endM] = settings.quietHoursEnd.split(':').map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    if (startTime < endTime) {
      isQuietHours = currentTime >= startTime && currentTime < endTime;
    } else {
      // 자정을 넘어가는 경우 (예: 22:00 ~ 08:00)
      isQuietHours = currentTime >= startTime || currentTime < endTime;
    }
  }

  return {
    enabled: settings.enabled !== false,
    categoryEnabled: true, // 카테고리별 설정은 나중에 구현
    fcmTokens,
    isQuietHours,
  };
}

/**
 * FCM 푸시 알림 전송
 */
async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (tokens.length === 0) return;

  const messages: FCMMessage[] = tokens.map((token) => ({
    token,
    notification: { title, body },
    data: data ? Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ) : undefined,
    android: {
      notification: {
        channelId: 'default',
        priority: 'high',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
    },
  }));

  try {
    const response = await messaging.sendEach(messages);

    // 실패한 토큰 정리
    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokens[idx]);
        }
      }
    });

    // 유효하지 않은 토큰 제거 (비동기, 결과 기다리지 않음)
    if (failedTokens.length > 0) {
      cleanupInvalidTokens(failedTokens).catch(console.error);
    }

    console.log(`FCM sent: ${response.successCount} success, ${response.failureCount} failed`);
  } catch (error) {
    console.error('FCM send error:', error);
  }
}

/**
 * 유효하지 않은 FCM 토큰 정리
 */
async function cleanupInvalidTokens(invalidTokens: string[]): Promise<void> {
  const usersSnapshot = await db.collection('users')
    .where('fcmTokens', 'array-contains-any', invalidTokens.slice(0, 10)) // Firestore 제한
    .get();

  const batch = db.batch();
  usersSnapshot.docs.forEach((doc) => {
    const userData = doc.data() as UserDoc;
    const validTokens = (userData.fcmTokens || []).filter(
      (t) => !invalidTokens.includes(t)
    );
    batch.update(doc.ref, { fcmTokens: validTokens });
  });

  await batch.commit();
}

/**
 * 알림 생성 + 푸시 전송 통합 함수
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, string>
): Promise<void> {
  const settings = await getUserNotificationSettings(userId);

  // 알림 비활성화된 경우
  if (!settings.enabled) {
    console.log(`Notification disabled for user: ${userId}`);
    return;
  }

  // 인앱 알림 생성 (항상)
  const notificationId = await createNotification(userId, type, data);

  // 방해금지 시간이면 푸시만 생략
  if (settings.isQuietHours) {
    console.log(`Quiet hours, skipping push for user: ${userId}`);
    return;
  }

  // 푸시 알림 전송
  const template = NOTIFICATION_TEMPLATES[type];
  await sendPushNotification(
    settings.fcmTokens,
    template.title(data),
    template.body(data),
    { notificationId, type, link: template.link(data), ...data }
  );
}

/**
 * 여러 사용자에게 알림 전송
 */
export async function sendNotificationToMany(
  userIds: string[],
  type: NotificationType,
  data: Record<string, string>
): Promise<void> {
  await Promise.all(
    userIds.map((userId) => sendNotification(userId, type, data))
  );
}
