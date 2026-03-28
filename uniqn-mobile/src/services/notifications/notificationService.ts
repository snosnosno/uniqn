/**
 * UNIQN Mobile - Notification Service
 *
 * @description 알림 관리 서비스 (Firestore + Expo Notifications)
 * @version 1.1.0 - handleServiceError 패턴 적용
 *
 * 현재 상태: expo-notifications 설치 완료
 *
 * TODO [출시 전]: EAS Build 후 실제 디바이스에서 FCM 테스트
 * TODO [P2]: 알림 그룹핑 기능 추가 (Android Notification Channels)
 */

import { Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { getFirebaseFunctions } from '@/lib/firebase';
import * as pushNotificationService from './pushNotificationService';
import {
  type NotificationPayload,
  type NotificationPermissionStatus,
} from './pushNotificationService';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { toError } from '@/errors';
import { notificationRepository } from '@/repositories';
import { isSyncCacheValid, updateSyncCache } from '@/shared/cache/counterSyncCache';
import { logger } from '@/utils/logger';
import {
  NotificationType as NotificationTypeEnum,
  NOTIFICATION_TYPE_LABELS,
} from '@/types/notification';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
  NotificationType,
} from '@/types/notification';

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 20;
const COMPONENT = 'notificationService';

const ENGLISH_NOTIFICATION_TITLES: Partial<Record<NotificationType, readonly string[]>> = {
  [NotificationTypeEnum.APPLICATION_CONFIRMED]: ['Application confirmed'],
  [NotificationTypeEnum.CONFIRMATION_CANCELLED]: ['Confirmation cancelled'],
  [NotificationTypeEnum.APPLICATION_REJECTED]: ['Application rejected'],
  [NotificationTypeEnum.CANCELLATION_APPROVED]: ['Cancellation approved'],
  [NotificationTypeEnum.CANCELLATION_REJECTED]: ['Cancellation rejected'],
  [NotificationTypeEnum.SCHEDULE_CREATED]: ['New schedule confirmed'],
  [NotificationTypeEnum.SCHEDULE_CANCELLED]: ['Schedule cancelled'],
  [NotificationTypeEnum.CHECK_IN_CONFIRMED]: ['Check-in confirmed'],
  [NotificationTypeEnum.CHECK_OUT_CONFIRMED]: ['Check-out confirmed'],
  [NotificationTypeEnum.STAFF_CHECKED_IN]: ['Staff checked in'],
  [NotificationTypeEnum.STAFF_CHECKED_OUT]: ['Staff checked out'],
  [NotificationTypeEnum.REVIEW_REQUEST]: ['Leave a review'],
  [NotificationTypeEnum.SETTLEMENT_COMPLETED]: ['Settlement completed'],
  [NotificationTypeEnum.SCHEDULE_CHANGE]: ['Work time updated'],
};

const ENGLISH_NOTIFICATION_BODY_FRAGMENTS: Partial<Record<NotificationType, readonly string[]>> = {
  [NotificationTypeEnum.APPLICATION_CONFIRMED]: ['has been confirmed.'],
  [NotificationTypeEnum.CONFIRMATION_CANCELLED]: ['was cancelled.'],
  [NotificationTypeEnum.APPLICATION_REJECTED]: ['was rejected.'],
  [NotificationTypeEnum.CANCELLATION_APPROVED]: ['cancellation was approved.'],
  [NotificationTypeEnum.CANCELLATION_REJECTED]: ['cancellation was rejected.'],
  [NotificationTypeEnum.SCHEDULE_CREATED]: ['is scheduled for'],
  [NotificationTypeEnum.SCHEDULE_CANCELLED]: ['has been cancelled.'],
  [NotificationTypeEnum.CHECK_IN_CONFIRMED]: ['check-in was recorded'],
  [NotificationTypeEnum.CHECK_OUT_CONFIRMED]: ['check-out was recorded'],
  [NotificationTypeEnum.STAFF_CHECKED_IN]: ['checked in at'],
  [NotificationTypeEnum.STAFF_CHECKED_OUT]: ['checked out at'],
  [NotificationTypeEnum.REVIEW_REQUEST]: ['Please leave a review.', 'Please review'],
  [NotificationTypeEnum.SETTLEMENT_COMPLETED]: ['Settlement for', 'Settlement is complete.'],
  [NotificationTypeEnum.SCHEDULE_CHANGE]: ['was updated:'],
};

// ============================================================================
// Types
// ============================================================================

/**
 * 페이지네이션 커서 타입 별칭
 * @description Hook 레이어에서 firebase/firestore 직접 import을 방지하기 위한 추상화
 */
export type NotificationPageCursor = QueryDocumentSnapshot;

interface FetchNotificationsOptions {
  userId: string;
  filter?: NotificationFilter;
  pageSize?: number;
  lastDoc?: NotificationPageCursor;
}

interface FetchNotificationsResult {
  notifications: NotificationData[];
  lastDoc: NotificationPageCursor | null;
  hasMore: boolean;
}

type LocalizedNotificationMessage = Pick<NotificationData, 'title' | 'body'>;

function hasText(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getNotificationDataValue(
  data: Record<string, string> | undefined,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = data?.[key];
    if (hasText(value)) {
      return value.trim();
    }
  }

  return '';
}

function getJobTitle(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'jobPostingTitle', 'jobTitle', 'title');
}

function getQuotedLabel(value: string): string {
  return `'${value}'`;
}

function getJobReference(data: Record<string, string> | undefined): string {
  const jobTitle = getJobTitle(data);
  return jobTitle ? getQuotedLabel(jobTitle) : '해당 공고';
}

function getWorkReference(data: Record<string, string> | undefined): string {
  const jobTitle = getJobTitle(data);
  return jobTitle ? getQuotedLabel(jobTitle) : '해당';
}

function getDateTimeLabel(data: Record<string, string> | undefined): string {
  const date = getNotificationDataValue(data, 'date', 'workDate');
  const time = getNotificationDataValue(data, 'timeSlot', 'startTime');

  if (date && time) {
    return `${date} (${time})`;
  }

  return date || time;
}

function getTimeLabel(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'checkTime', 'timeSlot', 'startTime');
}

function getReasonLabel(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'rejectionReason', 'reason');
}

function getAmountLabel(data: Record<string, string> | undefined): string {
  const rawAmount = getNotificationDataValue(data, 'payrollAmount', 'amount');
  if (!rawAmount) {
    return '';
  }

  const parsedAmount = Number(rawAmount.replaceAll(',', ''));
  return Number.isFinite(parsedAmount) ? parsedAmount.toLocaleString('ko-KR') : rawAmount;
}

function getStaffName(data: Record<string, string> | undefined): string {
  return getNotificationDataValue(data, 'staffName', 'applicantName') || '스태프';
}

function buildLocalizedNotificationMessage(
  type: NotificationType,
  data: Record<string, string> | undefined
): LocalizedNotificationMessage | null {
  const when = getDateTimeLabel(data);
  const reason = getReasonLabel(data);
  const time = getTimeLabel(data);
  const amount = getAmountLabel(data);
  const staffName = getStaffName(data);

  switch (type) {
    case NotificationTypeEnum.APPLICATION_CONFIRMED:
      return {
        title: '지원 확정',
        body: `${getJobReference(data)} 지원이 확정되었습니다.`,
      };
    case NotificationTypeEnum.CONFIRMATION_CANCELLED:
      return {
        title: '확정 취소',
        body: `${getJobReference(data)} 확정이 취소되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
      };
    case NotificationTypeEnum.APPLICATION_REJECTED:
      return {
        title: '지원 거절',
        body: `${getJobReference(data)} 지원이 거절되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
      };
    case NotificationTypeEnum.CANCELLATION_APPROVED:
      return {
        title: '취소 요청 승인',
        body: `${getJobReference(data)} 취소 요청이 승인되었습니다.`,
      };
    case NotificationTypeEnum.CANCELLATION_REJECTED:
      return {
        title: '취소 요청 거절',
        body: `${getJobReference(data)} 취소 요청이 거절되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
      };
    case NotificationTypeEnum.SCHEDULE_CREATED:
      return {
        title: '새 근무 배정',
        body: when
          ? `${getWorkReference(data)} 근무가 ${when}에 배정되었습니다.`
          : `${getWorkReference(data)} 근무가 배정되었습니다.`,
      };
    case NotificationTypeEnum.SCHEDULE_CANCELLED:
      return {
        title: '근무 취소',
        body: when
          ? `${getWorkReference(data)} ${when} 근무가 취소되었습니다.`
          : `${getWorkReference(data)} 근무가 취소되었습니다.`,
      };
    case NotificationTypeEnum.CHECK_IN_CONFIRMED:
      return {
        title: '출근 확인',
        body: `${getWorkReference(data)} 출근이${time ? ` ${time}에` : ''} 기록되었습니다.`,
      };
    case NotificationTypeEnum.STAFF_CHECKED_IN:
      return {
        title: '출근 알림',
        body: `${staffName}님이${time ? ` ${time}에` : ''} 출근했습니다.`,
      };
    case NotificationTypeEnum.CHECK_OUT_CONFIRMED:
      return {
        title: '퇴근 확인',
        body: `${getWorkReference(data)} 퇴근이${time ? ` ${time}에` : ''} 기록되었습니다.`,
      };
    case NotificationTypeEnum.STAFF_CHECKED_OUT:
      return {
        title: '퇴근 알림',
        body: `${staffName}님이${time ? ` ${time}에` : ''} 퇴근했습니다.`,
      };
    case NotificationTypeEnum.REVIEW_REQUEST:
      return {
        title: '평가 요청',
        body: data?.staffName
          ? `${getWorkReference(data)} 근무가 완료되었습니다. ${staffName}님에 대한 평가를 남겨주세요.`
          : `${getWorkReference(data)} 근무가 완료되었습니다. 평가를 남겨주세요.`,
      };
    case NotificationTypeEnum.SETTLEMENT_COMPLETED:
      return {
        title: '정산 완료',
        body: amount
          ? `${getJobReference(data)} 정산이 완료되었습니다. 지급액: ${amount}원`
          : `${getJobReference(data)} 정산이 완료되었습니다.`,
      };
    case NotificationTypeEnum.SCHEDULE_CHANGE: {
      const start = getNotificationDataValue(data, 'checkInTime');
      const end = getNotificationDataValue(data, 'checkOutTime');
      const latestTime = start && end ? `${start} - ${end}` : start || end || when;

      return {
        title: '근무 시간 변경',
        body: `${getWorkReference(data)} 근무 시간이 변경되었습니다.${
          latestTime ? ` 현재 시간: ${latestTime}` : ''
        }`,
      };
    }
    default:
      return null;
  }
}

function shouldNormalizeNotification(
  notification: Pick<NotificationData, 'type' | 'title' | 'body'>
): boolean {
  if (!hasText(notification.title) || !hasText(notification.body)) {
    return true;
  }

  const englishTitles = ENGLISH_NOTIFICATION_TITLES[notification.type] ?? [];
  if (englishTitles.includes(notification.title.trim())) {
    return true;
  }

  const englishFragments = ENGLISH_NOTIFICATION_BODY_FRAGMENTS[notification.type] ?? [];
  return englishFragments.some((fragment) => notification.body.includes(fragment));
}

function normalizeNotification(notification: NotificationData): NotificationData {
  if (!shouldNormalizeNotification(notification)) {
    return notification;
  }

  const localized = buildLocalizedNotificationMessage(notification.type, notification.data);
  if (!localized) {
    return notification;
  }

  return {
    ...notification,
    title: localized.title || notification.title || NOTIFICATION_TYPE_LABELS[notification.type],
    body: localized.body || notification.body || '새로운 알림이 있습니다.',
  };
}

// ============================================================================
// Counter Management (Repository에서 이동)
// ============================================================================

/**
 * 미읽음 카운터 리셋 (재시도, Store 참조 없음)
 *
 * @description markAllAsRead 후 Cloud Function으로 서버 카운터 리셋
 * 최대 3회 재시도 (exponential backoff)
 * @returns 리셋 성공 여부 (실패 시 onSnapshot/foreground sync로 자동 보정됨)
 */
async function resetUnreadCounterWithRetry(
  notificationIds: string[],
  userId: string
): Promise<boolean> {
  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      const functions = getFirebaseFunctions();
      const resetCounter = httpsCallable<{ notificationIds: string[] }, { success: boolean }>(
        functions,
        'resetUnreadCounter'
      );
      await resetCounter({ notificationIds });
      logger.info('미읽음 카운터 리셋 완료', { userId });
      return true;
    } catch (counterError) {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        logger.warn('카운터 리셋 재시도', {
          attempt: retryCount,
          error: toError(counterError).message,
        });
      }
    }
  }

  logger.error('카운터 리셋 최종 실패 - onSnapshot/foreground sync에서 보정 예정', {
    userId,
    attempts: MAX_RETRIES,
  });
  return false;
}

/**
 * 미읽음 카운터 감소 (CF 호출, Store 참조 없음)
 *
 * @description delete/deleteMany 후 Cloud Function으로 서버 카운터 감소
 * @returns 감소 성공 여부 (실패 시 onSnapshot/foreground sync로 자동 보정됨)
 */
async function decrementUnreadCounterWithRetry(delta: number): Promise<boolean> {
  try {
    const functions = getFirebaseFunctions();
    const decrementCounter = httpsCallable<{ delta: number }, { success: boolean }>(
      functions,
      'decrementUnreadCounter'
    );
    await decrementCounter({ delta });
    logger.info('미읽음 카운터 감소 완료', { delta });
    return true;
  } catch (counterError) {
    logger.warn('미읽음 카운터 감소 실패 - onSnapshot/foreground sync에서 보정 예정', {
      delta,
      error: toError(counterError).message,
    });
    return false;
  }
}

// ============================================================================
// Counter Sync (useNotificationHandler에서 이동)
// ============================================================================

/**
 * 서버에서 미읽음 카운터 조회
 *
 * @description 포그라운드 복귀 시 또는 멀티 디바이스 동기화를 위해 서버 카운터 조회
 * @param userId 사용자 ID
 * @param forceSync 캐시 무시하고 강제 동기화 (기본값: false)
 * @returns 서버 카운터 값 (캐시 유효/조회 실패 시 null). Store 업데이트는 호출자가 처리
 *
 * @note 30초 캐시 TTL 적용으로 불필요한 Firestore 읽기 방지
 */
export async function syncUnreadCounterFromServer(
  userId: string,
  forceSync: boolean = false
): Promise<number | null> {
  try {
    if (!forceSync && isSyncCacheValid(userId)) {
      logger.debug('카운터 동기화 스킵 - 캐시 TTL 내', { userId });
      return null;
    }

    const serverCount = await notificationRepository.getUnreadCounterFromCache(userId);

    // S1: 카운터 문서가 존재할 때만 캐시 갱신 (신규 가입자 30초 차단 방지)
    if (serverCount !== null) {
      updateSyncCache(userId);
    }

    return serverCount;
  } catch (error) {
    logger.warn('카운터 동기화 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// FCM Payload Conversion (useNotificationHandler에서 이동)
// ============================================================================

/**
 * FCM 페이로드로부터 NotificationData 생성
 *
 * @description Hook 레이어에서 Firebase SDK (Timestamp) 직접 참조를 방지하기 위해
 * Service 레이어에서 변환을 담당
 */
export function createNotificationFromFCM(
  payload: NotificationPayload,
  userId: string
): NotificationData | null {
  const notificationId =
    typeof payload.data?.notificationId === 'string' ? payload.data.notificationId : undefined;
  if (!notificationId) return null;

  // FCM data 필드는 항상 string 값이므로 typeof 검증으로 안전성 확보
  const rawType = typeof payload.data?.type === 'string' ? payload.data.type : '';
  const link = typeof payload.data?.link === 'string' ? payload.data.link : undefined;

  // W-NEW-1: as NotificationType 캐스트 대신 유효값 검증
  const validTypes = Object.values(NotificationTypeEnum) as string[];
  const type: NotificationType = validTypes.includes(rawType)
    ? (rawType as NotificationType)
    : NotificationTypeEnum.ANNOUNCEMENT;

  return normalizeNotification({
    id: notificationId,
    recipientId: userId,
    type,
    title: payload.title || '',
    body: payload.body || '',
    link,
    data: payload.data as Record<string, string> | undefined,
    isRead: false,
    createdAt: Timestamp.now(),
  });
}

// ============================================================================
// Counter Cache Query (useAppInitialize에서 사용)
// ============================================================================

/**
 * 캐싱된 미읽음 카운터 조회 (Repository 래퍼)
 *
 * @description Hook 레이어에서 Repository 직접 호출을 방지하기 위한 Service 래퍼
 * @param userId 사용자 ID
 * @returns 캐싱된 카운터 값 (문서 없으면 null)
 */
export async function getUnreadCounterFromCache(userId: string): Promise<number | null> {
  try {
    return await notificationRepository.getUnreadCounterFromCache(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '캐시된 미읽음 카운터 조회',
      component: COMPONENT,
      context: { userId },
    });
  }
}

// ============================================================================
// Notification Fetch Operations
// ============================================================================

/**
 * 알림 목록 조회 (페이지네이션)
 */
export async function fetchNotifications(
  options: FetchNotificationsOptions
): Promise<FetchNotificationsResult> {
  try {
    const { userId, filter, pageSize = PAGE_SIZE, lastDoc } = options;

    const result = await notificationRepository.getByUserId(userId, {
      filter,
      pageSize,
      lastDoc,
    });

    return {
      notifications: result.items.map(normalizeNotification),
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 목록 조회',
      component: COMPONENT,
      context: { userId: options.userId },
    });
  }
}

/**
 * 읽지 않은 알림 수 조회
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await notificationRepository.getUnreadCount(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '읽지 않은 알림 수 조회',
      component: COMPONENT,
      context: { userId },
    });
  }
}

/**
 * 알림 상세 조회
 */
export async function getNotification(notificationId: string): Promise<NotificationData | null> {
  try {
    const notification = await notificationRepository.getById(notificationId);
    return notification ? normalizeNotification(notification) : null;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 상세 조회',
      component: COMPONENT,
      context: { notificationId },
    });
  }
}

// ============================================================================
// Notification Update Operations
// ============================================================================

/**
 * 알림 읽음 처리
 */
export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await notificationRepository.markAsRead(notificationId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 읽음 처리',
      component: COMPONENT,
      context: { notificationId },
    });
  }
}

/**
 * 모든 알림 읽음 처리 + 카운터 리셋
 */
export async function markAllAsRead(userId: string): Promise<void> {
  try {
    const { updatedIds } = await notificationRepository.markAllAsRead(userId);
    if (updatedIds.length > 0) {
      await resetUnreadCounterWithRetry(updatedIds, userId);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '모든 알림 읽음 처리',
      component: COMPONENT,
      context: { userId },
    });
  }
}

/**
 * 알림 삭제 + 카운터 감소
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const { wasUnread } = await notificationRepository.delete(notificationId);
    if (wasUnread) {
      await decrementUnreadCounterWithRetry(1);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 삭제',
      component: COMPONENT,
      context: { notificationId },
    });
  }
}

/**
 * 여러 알림 삭제 + 카운터 감소
 */
export async function deleteNotifications(notificationIds: string[]): Promise<void> {
  try {
    const { deletedUnreadCount } = await notificationRepository.deleteMany(notificationIds);
    if (deletedUnreadCount > 0) {
      await decrementUnreadCounterWithRetry(deletedUnreadCount);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '여러 알림 삭제',
      component: COMPONENT,
      context: { count: notificationIds.length },
    });
  }
}

/**
 * 오래된 알림 정리 (30일 이상)
 */
export async function cleanupOldNotifications(userId: string, daysToKeep = 30): Promise<number> {
  try {
    return await notificationRepository.deleteOlderThan(userId, daysToKeep);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '오래된 알림 정리',
      component: COMPONENT,
      context: { userId, daysToKeep },
    });
  }
}

// ============================================================================
// Real-time Subscription
// ============================================================================

/**
 * 알림 실시간 구독
 *
 * @description Repository를 통한 실시간 구독 (RealtimeManager 중복 구독 방지)
 */
export function subscribeToNotifications(
  userId: string,
  onNotifications: (notifications: NotificationData[]) => void,
  onError?: (error: Error) => void
): () => void {
  return notificationRepository.subscribeToNotifications(
    userId,
    (notifications) => {
      onNotifications(notifications.map(normalizeNotification));
    },
    onError
  );
}

/**
 * 읽지 않은 알림 수 실시간 구독 (최적화 버전)
 *
 * @description Repository를 통한 카운터 문서 실시간 구독
 */
export function subscribeToUnreadCount(
  userId: string,
  onCount: (count: number) => void,
  onError?: (error: Error) => void
): () => void {
  return notificationRepository.subscribeToUnreadCount(userId, onCount, onError);
}

// ============================================================================
// Notification Settings
// ============================================================================

/**
 * 알림 설정 조회
 * @description Firestore 경로: users/{userId}/notificationSettings/default
 */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  try {
    return await notificationRepository.getSettings(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 설정 조회',
      component: COMPONENT,
      context: { userId },
    });
  }
}

/**
 * 알림 설정 저장
 * @description Firestore 경로: users/{userId}/notificationSettings/default
 */
export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<void> {
  try {
    await notificationRepository.saveSettings(userId, settings);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 설정 저장',
      component: COMPONENT,
      context: { userId },
    });
  }
}

// ============================================================================
// Push Notification Permission (Expo)
// ============================================================================

/**
 * 푸시 알림 권한 확인
 *
 * @description Expo Notifications를 사용한 권한 확인
 * 현재 상태: expo-notifications 설치 완료, pushNotificationService에서 구현됨
 * @see pushNotificationService.getPermissionStatus
 */
export async function checkNotificationPermission(): Promise<NotificationPermissionStatus> {
  // 웹에서는 기본적으로 거부 처리
  if (Platform.OS === 'web') {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }

  return pushNotificationService.checkPermission();
}

/**
 * 푸시 알림 권한 요청
 *
 * @description Expo Notifications를 사용한 권한 요청
 * 현재 상태: expo-notifications 설치 완료, pushNotificationService에서 구현됨
 * @see pushNotificationService.requestPermissions
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  // 웹에서는 기본적으로 거부 처리
  if (Platform.OS === 'web') {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }

  return pushNotificationService.requestPermission();
}

// ============================================================================
// FCM Token Management
// ============================================================================

/**
 * FCM 토큰 등록
 *
 * @description Firestore에 FCM 토큰 저장 (Map 구조, 토큰키 기반 upsert)
 */
export async function registerFCMToken(
  userId: string,
  token: string,
  metadata: { type: 'expo' | 'fcm'; platform: 'ios' | 'android' }
): Promise<void> {
  try {
    await notificationRepository.registerFCMToken(userId, token, metadata);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'FCM 토큰 등록',
      component: COMPONENT,
      context: { userId, platform: metadata.platform },
    });
  }
}

/**
 * FCM 토큰 삭제
 *
 * @description Firestore에서 특정 FCM 토큰 제거 (Map 키 deleteField)
 */
export async function unregisterFCMToken(userId: string, token: string): Promise<void> {
  try {
    await notificationRepository.unregisterFCMToken(userId, token);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'FCM 토큰 삭제',
      component: COMPONENT,
      context: { userId },
    });
  }
}

/**
 * 모든 FCM 토큰 삭제
 *
 * @description 로그아웃 시 해당 사용자의 모든 FCM 토큰 제거
 */
export async function unregisterAllFCMTokens(userId: string): Promise<void> {
  try {
    await notificationRepository.unregisterAllFCMTokens(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '모든 FCM 토큰 삭제',
      component: COMPONENT,
      context: { userId },
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const notificationService = {
  // Fetch
  fetchNotifications,
  getUnreadCount,
  getNotification,

  // Update
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteNotifications,
  cleanupOldNotifications,

  // Counter Sync
  syncUnreadCounterFromServer,
  getUnreadCounterFromCache,

  // FCM Conversion
  createNotificationFromFCM,

  // Subscription
  subscribeToNotifications,
  subscribeToUnreadCount,

  // Settings
  getNotificationSettings,
  saveNotificationSettings,

  // Permission
  checkNotificationPermission,
  requestNotificationPermission,

  // FCM
  registerFCMToken,
  unregisterFCMToken,
  unregisterAllFCMTokens,
};

export default notificationService;
