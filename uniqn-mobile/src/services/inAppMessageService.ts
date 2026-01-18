/**
 * UNIQN Mobile - 인앱 메시지 서비스
 *
 * @description 인앱 메시지 필터링, 조건 검사, 표시 로직
 * @version 1.0.0
 */

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { useInAppMessageStore } from '@/stores/inAppMessageStore';
import { useAuthStore } from '@/stores/authStore';
import type {
  InAppMessage,
  InAppMessageConditions,
  InAppMessageAudience,
  InAppMessageHistory,
} from '@/types/inAppMessage';
import { logger } from '@/utils/logger';

// ============================================================================
// Constants
// ============================================================================

const LOG_CONTEXT = { service: 'inAppMessageService' };

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * 버전 문자열을 숫자 배열로 변환
 */
function parseVersion(version: string): number[] {
  return version.split('.').map((part) => parseInt(part, 10) || 0);
}

/**
 * 버전 비교 (-1: a < b, 0: a = b, 1: a > b)
 */
function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;

    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }

  return 0;
}

// ============================================================================
// Condition Checkers
// ============================================================================

/**
 * 앱 버전 조건 확인
 */
function checkVersionCondition(conditions: InAppMessageConditions): boolean {
  const currentVersion = Application.nativeApplicationVersion ?? '1.0.0';

  if (conditions.minAppVersion) {
    if (compareVersions(currentVersion, conditions.minAppVersion) < 0) {
      return false;
    }
  }

  if (conditions.maxAppVersion) {
    if (compareVersions(currentVersion, conditions.maxAppVersion) > 0) {
      return false;
    }
  }

  return true;
}

/**
 * 날짜 조건 확인
 */
function checkDateCondition(conditions: InAppMessageConditions): boolean {
  const now = new Date();

  if (conditions.startDate) {
    const startDate = new Date(conditions.startDate);
    if (now < startDate) {
      return false;
    }
  }

  if (conditions.endDate) {
    const endDate = new Date(conditions.endDate);
    if (now > endDate) {
      return false;
    }
  }

  return true;
}

/**
 * 플랫폼 조건 확인
 */
function checkPlatformCondition(conditions: InAppMessageConditions): boolean {
  if (!conditions.platforms || conditions.platforms.length === 0) {
    return true; // 모든 플랫폼
  }

  const currentPlatform = Platform.OS;
  return conditions.platforms.includes(currentPlatform as 'ios' | 'android' | 'web');
}

/**
 * 표시 빈도 조건 확인
 */
function checkFrequencyCondition(
  conditions: InAppMessageConditions,
  history: InAppMessageHistory | undefined,
  messageId: string
): boolean {
  const frequency = conditions.frequency ?? 'always';

  switch (frequency) {
    case 'once':
      // 한 번만 표시 (이력이 있으면 표시 안 함)
      return !history || history.shownCount === 0;

    case 'once_per_session':
      // 세션당 한 번만 표시 (스토어에서 직접 확인)
      return !useInAppMessageStore.getState().hasSessionShownId(messageId);

    case 'daily': {
      // 하루에 한 번만 표시
      if (!history?.lastShownAt) return true;

      const lastShown = new Date(history.lastShownAt);
      const now = new Date();

      // 날짜만 비교 (시간 무시)
      const lastShownDate = new Date(lastShown.getFullYear(), lastShown.getMonth(), lastShown.getDate());
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      return lastShownDate < todayDate;
    }

    case 'always':
    default:
      return true;
  }
}

/**
 * 타겟 오디언스 조건 확인
 */
function checkAudienceCondition(audience: InAppMessageAudience): boolean {
  if (audience.type === 'all') {
    return true;
  }

  if (audience.type === 'roles' && audience.roles) {
    const profile = useAuthStore.getState().profile;
    if (!profile?.role) return false;
    return audience.roles.includes(profile.role);
  }

  if (audience.type === 'users' && audience.userIds) {
    const user = useAuthStore.getState().user;
    if (!user?.uid) return false;
    return audience.userIds.includes(user.uid);
  }

  return false;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 세션 초기화 (앱 시작 시 호출)
 */
export function resetSession(): void {
  useInAppMessageStore.getState().resetSessionIds();
  logger.info('인앱 메시지 세션 초기화', LOG_CONTEXT);
}

/**
 * 메시지가 표시 가능한지 확인
 */
export function canShowMessage(message: InAppMessage): boolean {
  const { history } = useInAppMessageStore.getState();
  const messageHistory = history[message.id];

  // 1. 영구 닫힘 처리된 메시지
  if (messageHistory?.dismissed) {
    return false;
  }

  // 2. 비활성화된 메시지
  if (!message.isActive) {
    return false;
  }

  // 3. 타겟 오디언스 확인
  if (!checkAudienceCondition(message.targetAudience)) {
    return false;
  }

  // 4. 조건 확인
  if (message.conditions) {
    // 버전 조건
    if (!checkVersionCondition(message.conditions)) {
      return false;
    }

    // 날짜 조건
    if (!checkDateCondition(message.conditions)) {
      return false;
    }

    // 플랫폼 조건
    if (!checkPlatformCondition(message.conditions)) {
      return false;
    }

    // 빈도 조건
    if (!checkFrequencyCondition(message.conditions, messageHistory, message.id)) {
      return false;
    }
  }

  return true;
}

/**
 * 표시 가능한 메시지 필터링 및 우선순위 정렬
 */
export function filterAndSortMessages(messages: InAppMessage[]): InAppMessage[] {
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return messages
    .filter(canShowMessage)
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * 메시지 처리 (Remote Config 또는 Firestore에서 가져온 메시지)
 */
export function processMessages(messages: InAppMessage[]): void {
  const store = useInAppMessageStore.getState();

  // 전체 메시지 저장
  store.setMessages(messages);

  // 필터링 및 정렬
  const eligibleMessages = filterAndSortMessages(messages);

  logger.info('인앱 메시지 처리', {
    ...LOG_CONTEXT,
    totalMessages: messages.length,
    eligibleMessages: eligibleMessages.length,
  });

  // 표시 가능한 메시지를 큐에 추가
  eligibleMessages.forEach((message) => {
    store.enqueueMessage(message);
  });

  // 다음 메시지 표시
  store.showNextMessage();
}

/**
 * 단일 메시지 표시 요청
 */
export function showMessage(message: InAppMessage): void {
  if (!canShowMessage(message)) {
    logger.warn('메시지 표시 조건 불충족', {
      ...LOG_CONTEXT,
      messageId: message.id,
    });
    return;
  }

  const store = useInAppMessageStore.getState();
  store.enqueueMessage(message);
  store.showNextMessage();
}

/**
 * 현재 메시지 닫기
 */
export function dismissCurrentMessage(): void {
  const store = useInAppMessageStore.getState();
  const { currentMessage } = store;

  if (currentMessage) {
    // 세션 표시 기록
    store.addSessionShownId(currentMessage.id);
  }

  store.dismissCurrentMessage();
}

/**
 * 메시지 영구 닫기 (다시 보지 않기)
 */
export function dismissMessagePermanently(messageId: string): void {
  const store = useInAppMessageStore.getState();
  store.dismissMessagePermanently(messageId);

  // 세션 표시 기록
  store.addSessionShownId(messageId);

  logger.info('메시지 영구 닫기', {
    ...LOG_CONTEXT,
    messageId,
  });
}

/**
 * 특정 타입의 메시지 가져오기
 */
export function getMessagesByType(type: InAppMessage['type']): InAppMessage[] {
  const { allMessages } = useInAppMessageStore.getState();
  return allMessages.filter((m) => m.type === type && canShowMessage(m));
}

/**
 * 메시지 이력 초기화 (테스트용)
 */
export function clearMessageHistory(): void {
  const store = useInAppMessageStore.getState();
  store.clearHistory();
  store.resetSessionIds();

  logger.info('메시지 이력 초기화', LOG_CONTEXT);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  resetSession,
  canShowMessage,
  filterAndSortMessages,
  processMessages,
  showMessage,
  dismissCurrentMessage,
  dismissMessagePermanently,
  getMessagesByType,
  clearMessageHistory,
};
