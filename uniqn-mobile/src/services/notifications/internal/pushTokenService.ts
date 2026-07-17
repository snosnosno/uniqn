/**
 * UNIQN Mobile - Push Token Service
 *
 * @description FCM/Expo 푸시 토큰 발급/등록/해제 + 일시적 오류 재시도
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { crashlyticsService } from '@/services/observability';
import { notificationRepository } from '@/repositories';
import type { PushTokenResult } from './pushNotificationTypes';
import { EXPO_PUSH_TOKEN_RETRY_DELAYS_MS } from './pushNotificationConstants';
import { getNotifications, pushState, sleep } from './pushNotificationState';
import { checkPermission } from './pushPermissionService';

interface ExpoPushTokenErrorMetadata {
  isTransient: boolean;
  requestId?: string;
  statusCode?: number;
}

function extractExpoPushTokenErrorMetadata(error: Error): ExpoPushTokenErrorMetadata {
  const message = error.message ?? '';
  const statusCodeMatch = message.match(/received:\s*(\d{3})/i);
  const requestIdMatch = message.match(/"requestId":"([^"]+)"/);
  const statusCode = statusCodeMatch ? Number(statusCodeMatch[1]) : undefined;
  const isTransient =
    (statusCode !== undefined && statusCode >= 500) ||
    message.includes('SERVICE_UNAVAILABLE') ||
    message.includes('temporarily unavailable due to high load') ||
    message.includes('"isTransient":true') ||
    message.includes('"isTransient": true');

  return {
    isTransient,
    requestId: requestIdMatch?.[1],
    statusCode,
  };
}

async function getExpoPushTokenWithRetry(projectId: string): Promise<string> {
  const Notifications = getNotifications();
  if (!Notifications) {
    throw new Error('expo-notifications module is not loaded');
  }

  for (let attempt = 0; attempt <= EXPO_PUSH_TOKEN_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      return data;
    } catch (error) {
      const normalizedError = toError(error);
      const metadata = extractExpoPushTokenErrorMetadata(normalizedError);
      const nextRetryMs = EXPO_PUSH_TOKEN_RETRY_DELAYS_MS[attempt];

      if (!metadata.isTransient || nextRetryMs === undefined) {
        throw normalizedError;
      }

      logger.warn('Expo Push Token fetch temporarily unavailable - retrying', {
        component: 'pushNotificationService',
        action: 'getToken',
        attempt: attempt + 1,
        nextRetryMs,
        requestId: metadata.requestId,
        statusCode: metadata.statusCode,
      });
      void crashlyticsService.leaveBreadcrumb('expo_push_token_retry_scheduled', {
        attempt: attempt + 1,
        nextRetryMs,
        requestId: metadata.requestId,
        statusCode: metadata.statusCode,
      });

      await sleep(nextRetryMs);
    }
  }

  throw new Error('Expo Push Token retry loop exited unexpectedly');
}

export async function getTokenWithRecovery(): Promise<PushTokenResult | null> {
  const Notifications = getNotifications();
  if (Platform.OS === 'web' || !Notifications) {
    return null;
  }

  try {
    const permission = await checkPermission();
    if (!permission.granted) {
      logger.warn('푸시 알림 권한이 없어 토큰을 가져올 수 없습니다');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      logger.error('EAS projectId를 찾을 수 없습니다');
      return null;
    }

    const expoPushToken = await getExpoPushTokenWithRetry(projectId);

    pushState.currentToken = expoPushToken;
    logger.info('Expo Push Token 발급', {
      tokenLength: expoPushToken.length,
      type: 'expo',
      platform: Platform.OS,
    });

    return {
      token: expoPushToken,
      type: 'expo',
    };
  } catch (error) {
    const normalizedError = toError(error);
    const metadata = extractExpoPushTokenErrorMetadata(normalizedError);

    if (metadata.isTransient) {
      logger.warn('Expo Push Token fetch temporarily unavailable', {
        component: 'pushNotificationService',
        action: 'getToken',
        error: normalizedError.message,
        requestId: metadata.requestId,
        statusCode: metadata.statusCode,
      });
      void crashlyticsService.leaveBreadcrumb('expo_push_token_temporarily_unavailable', {
        isTransient: true,
        requestId: metadata.requestId,
        statusCode: metadata.statusCode,
      });
      return null;
    }

    logger.error('푸시 토큰 발급 실패', normalizedError, {
      component: 'pushNotificationService',
      action: 'getToken',
    });
    return null;
  }
}

export async function registerToken(userId: string): Promise<boolean> {
  try {
    const tokenResult = await getTokenWithRecovery();
    if (!tokenResult) {
      logger.warn('토큰 없음 - 등록 스킵');
      return false;
    }

    await notificationRepository.registerFCMToken(userId, tokenResult.token, {
      type: tokenResult.type,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    logger.info('푸시 토큰 등록 완료', { userId, type: tokenResult.type, platform: Platform.OS });
    return true;
  } catch (error) {
    logger.error('푸시 토큰 등록 실패', toError(error));
    return false;
  }
}

/**
 * 사용자 토큰 해제
 */
export async function unregisterToken(userId: string): Promise<boolean> {
  try {
    if (!pushState.currentToken) {
      logger.warn('등록된 토큰 없음 - 해제 스킵');
      return true;
    }

    await notificationRepository.unregisterFCMToken(userId, pushState.currentToken);
    pushState.currentToken = null;
    logger.info('푸시 토큰 해제 완료', { userId });
    return true;
  } catch (error) {
    logger.error('푸시 토큰 해제 실패', toError(error));
    return false;
  }
}

/**
 * 로그아웃 시 서버의 푸시 토큰 해제.
 *
 * 인메모리 토큰을 알고 있으면 해당 토큰만, 모르면(앱 재시작 후 signOut 등 인메모리
 * 부재 시) 현재 사용자의 전체 토큰을 삭제한다. 공용 기기에서 이전 계정으로 푸시가
 * 잔존하는 것을 막기 위함이다.
 *
 * 반드시 세션이 유효한 signOut 서두에 호출해야 한다 — signOut 이후에는 RLS 로
 * fcm_tokens 삭제가 거부된다.
 *
 * `unregisterToken`(인메모리 토큰이 없으면 서버 접근 없이 스킵)과 달리, 여기서는
 * 인메모리 부재 시에도 전체 삭제로 폴백한다. 실패 시 에러를 전파하며, 호출자(signOut)가
 * fail-safe 로 감싸 로그아웃 자체는 계속 진행한다.
 */
export async function unregisterTokensForSignOut(userId: string): Promise<void> {
  const token = pushState.currentToken;
  if (token) {
    await notificationRepository.unregisterFCMToken(userId, token);
    pushState.currentToken = null;
    logger.info('로그아웃 푸시 토큰 해제 완료 (단일 토큰)', { userId });
    return;
  }

  await notificationRepository.unregisterAllFCMTokens(userId);
  logger.info('로그아웃 푸시 토큰 해제 완료 (전체 폴백)', { userId });
}

/** @alias getTokenWithRecovery — 하위 호환용 */
export const getToken = getTokenWithRecovery;

/**
 * 현재 토큰 가져오기
 */
export function getCurrentToken(): string | null {
  return pushState.currentToken;
}
