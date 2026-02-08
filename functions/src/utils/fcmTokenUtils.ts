/**
 * 푸시 토큰 유틸리티
 *
 * @description 푸시 토큰 추출, 검증, 관리 헬퍼 함수
 * @version 3.0.0
 *
 * fcmTokens 구조: Map (Record<string, FcmTokenRecord>)
 * 각 엔트리: { token, type, platform, registeredAt, lastRefreshedAt }
 * Expo Push Token과 FCM Token 모두 반환 — sendMulticast()에서 형식별 분기 처리
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

export interface FcmTokenRecord {
  token: string;
  type: 'expo' | 'fcm';
  platform: 'ios' | 'android';
  registeredAt: admin.firestore.Timestamp;
  lastRefreshedAt: admin.firestore.Timestamp;
}

export interface UserFcmData {
  fcmTokens?: Record<string, FcmTokenRecord>;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * 사용자 문서에서 푸시 토큰 추출
 *
 * @param userData Firestore users 문서 데이터
 * @returns 유효한 푸시 토큰 배열 (Expo + FCM 모두 포함, 중복 제거됨)
 *
 * @example
 * const tokens = getPushTokens(userDoc.data());
 * if (tokens.length > 0) {
 *   await sendMulticast(tokens, message);
 * }
 */
export function getPushTokens(userData: UserFcmData | undefined | null): string[] {
  if (!userData) {
    return [];
  }

  const { fcmTokens } = userData;

  if (!fcmTokens || typeof fcmTokens !== 'object') {
    return [];
  }

  const tokens: string[] = [];

  for (const record of Object.values(fcmTokens)) {
    if (!record || typeof record.token !== 'string' || record.token.length === 0) {
      continue;
    }

    tokens.push(record.token);
  }

  // 중복 제거
  return [...new Set(tokens)];
}

/** @deprecated getPushTokens()로 대체. 하위 호환용 별칭 */
export const getFcmTokens = getPushTokens;

/**
 * FCM 토큰 유효성 검사
 *
 * @param token 검사할 토큰
 * @returns 유효 여부
 */
export function isValidFcmToken(token: unknown): token is string {
  return typeof token === 'string' && token.length > 0;
}

/**
 * 여러 사용자의 FCM 토큰을 한 번에 추출
 *
 * @param usersData 여러 사용자 데이터 배열
 * @returns 사용자 ID와 토큰 배열 매핑
 */
export function extractAllFcmTokens(
  usersData: Array<{ id: string; data: UserFcmData | undefined }>
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const { id, data } of usersData) {
    const tokens = getPushTokens(data);
    if (tokens.length > 0) {
      result.set(id, tokens);
    }
  }

  return result;
}

/**
 * 모든 토큰을 평탄화하여 단일 배열로 반환
 *
 * @param tokenMap 사용자별 토큰 맵
 * @returns 모든 토큰이 포함된 단일 배열 (중복 제거됨)
 */
export function flattenTokens(tokenMap: Map<string, string[]>): string[] {
  const allTokens = new Set<string>();

  for (const tokens of tokenMap.values()) {
    tokens.forEach((token) => allTokens.add(token));
  }

  return [...allTokens];
}

// ============================================================================
// Token Management Functions
// ============================================================================

/**
 * 만료되거나 유효하지 않은 FCM 토큰 제거
 *
 * @param userId 사용자 ID
 * @param invalidToken 제거할 토큰
 * @returns 성공 여부
 */
export async function removeInvalidToken(
  userId: string,
  invalidToken: string
): Promise<boolean> {
  try {
    const userRef = db.collection('users').doc(userId);
    const tokenKey = await findTokenKeyByValue(userRef, invalidToken);

    if (!tokenKey) {
      functions.logger.warn('제거할 토큰 키를 찾을 수 없음', {
        userId,
        token: invalidToken.substring(0, 20) + '...',
      });
      return false;
    }

    await userRef.update({
      [`fcmTokens.${tokenKey}`]: admin.firestore.FieldValue.delete(),
    });

    functions.logger.info('만료된 FCM 토큰 제거 완료', {
      userId,
      token: invalidToken.substring(0, 20) + '...',
    });

    return true;
  } catch (error: any) {
    functions.logger.error('FCM 토큰 제거 실패', {
      userId,
      error: error.message,
    });
    return false;
  }
}

/**
 * 여러 만료 토큰 일괄 제거
 *
 * @param userId 사용자 ID
 * @param invalidTokens 제거할 토큰 배열
 * @returns 성공적으로 제거된 토큰 수
 */
export async function removeInvalidTokens(
  userId: string,
  invalidTokens: string[]
): Promise<number> {
  if (invalidTokens.length === 0) {
    return 0;
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const fcmTokens = (userDoc.data()?.fcmTokens ?? {}) as Record<string, FcmTokenRecord>;

    // 토큰 값으로 키 매핑
    const tokenToKey = new Map<string, string>();
    for (const [key, record] of Object.entries(fcmTokens)) {
      if (record?.token) {
        tokenToKey.set(record.token, key);
      }
    }

    const updateData: Record<string, admin.firestore.FieldValue> = {};
    let removedCount = 0;
    for (const token of invalidTokens) {
      const key = tokenToKey.get(token);
      if (key) {
        updateData[`fcmTokens.${key}`] = admin.firestore.FieldValue.delete();
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await userRef.update(updateData);
    }

    functions.logger.info('만료된 FCM 토큰 일괄 제거 완료', {
      userId,
      removedCount,
    });

    return removedCount;
  } catch (error: any) {
    functions.logger.error('FCM 토큰 일괄 제거 실패', {
      userId,
      tokenCount: invalidTokens.length,
      error: error.message,
    });
    return 0;
  }
}

/**
 * 토큰 값으로 Firestore Map 키 찾기
 */
async function findTokenKeyByValue(
  userRef: admin.firestore.DocumentReference,
  token: string
): Promise<string | null> {
  const userDoc = await userRef.get();
  const fcmTokens = (userDoc.data()?.fcmTokens ?? {}) as Record<string, FcmTokenRecord>;

  for (const [key, record] of Object.entries(fcmTokens)) {
    if (record?.token === token) {
      return key;
    }
  }
  return null;
}

/**
 * FCM 에러 코드가 토큰 만료/무효를 나타내는지 확인
 *
 * @param errorCode FCM 에러 코드
 * @returns 토큰이 무효화되었는지 여부
 *
 * @see https://firebase.google.com/docs/cloud-messaging/send-message#admin
 */
export function isTokenInvalidError(errorCode: string | undefined): boolean {
  const invalidTokenErrors = [
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
    'messaging/unregistered',
  ];

  return errorCode !== undefined && invalidTokenErrors.includes(errorCode);
}
