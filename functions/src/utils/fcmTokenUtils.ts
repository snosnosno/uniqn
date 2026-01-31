/**
 * FCM 토큰 유틸리티
 *
 * @description FCM 토큰 추출 및 검증 헬퍼 함수
 * @version 1.0.0
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음
 *       - fcmTokens: string[] 배열만 지원
 *       - 레거시 fcmToken 단일 필드는 완전히 무시
 */

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
