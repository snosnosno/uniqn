/**
 * FCM 토큰 유틸리티
 *
 * @description FCM 토큰 추출, 검증, 관리 헬퍼 함수
 * @version 1.1.0
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음
 *       - fcmTokens: string[] 배열만 지원
 *       - 레거시 fcmToken 단일 필드는 완전히 무시
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

export interface UserFcmData {
  fcmTokens?: string[];
}

// ============================================================================
// Functions
// ============================================================================

/**
 * 사용자 문서에서 FCM 토큰 추출
 *
 * @param userData Firestore users 문서 데이터
 * @returns 유효한 FCM 토큰 배열 (중복 제거됨)
 *
 * @example
 * const tokens = getFcmTokens(userDoc.data());
 * if (tokens.length > 0) {
 *   await sendMulticast(tokens, message);
 * }
 */
export function getFcmTokens(userData: UserFcmData | undefined | null): string[] {
  if (!userData) {
    return [];
  }

  const { fcmTokens } = userData;

  if (!fcmTokens || !Array.isArray(fcmTokens)) {
    return [];
  }

  // 유효한 토큰만 필터링 (문자열이고 빈 문자열이 아닌 것)
  const validTokens = fcmTokens.filter(
    (token): token is string =>
      typeof token === 'string' && token.length > 0
  );

  // 중복 제거
  return [...new Set(validTokens)];
}

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
    const tokens = getFcmTokens(data);
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
 *
 * @example
 * // FCM 전송 실패 시 호출
 * if (error.code === 'messaging/invalid-registration-token') {
 *   await removeInvalidToken(userId, token);
 * }
 */
export async function removeInvalidToken(
  userId: string,
  invalidToken: string
): Promise<boolean> {
  try {
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(invalidToken),
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

    // 여러 토큰을 한 번에 제거
    await userRef.update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
    });

    functions.logger.info('만료된 FCM 토큰 일괄 제거 완료', {
      userId,
      removedCount: invalidTokens.length,
    });

    return invalidTokens.length;
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
