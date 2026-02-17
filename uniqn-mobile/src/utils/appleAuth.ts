/**
 * UNIQN Mobile - Apple Sign In 유틸리티
 *
 * @description Apple Sign In에 필요한 nonce 생성 및 SHA-256 해싱
 * @version 1.0.0
 *
 * Apple은 replay attack 방지를 위해 nonce를 요구:
 * 1. rawNonce(랜덤 문자열) 생성
 * 2. SHA-256 해싱하여 hashedNonce 생성
 * 3. hashedNonce를 Apple에 전달, rawNonce를 Firebase에 전달
 */

import { digestStringAsync, CryptoDigestAlgorithm, getRandomValues } from 'expo-crypto';

// ============================================================================
// Nonce Generation
// ============================================================================

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';

/**
 * 암호학적으로 안전한 랜덤 nonce 생성
 *
 * @param length - nonce 길이 (기본 32)
 * @returns 랜덤 문자열
 */
export function generateNonce(length = 32): string {
  const randomValues = new Uint8Array(length);
  getRandomValues(randomValues);

  return Array.from(randomValues)
    .map((byte) => CHARSET[byte % CHARSET.length])
    .join('');
}

// ============================================================================
// SHA-256 Hashing
// ============================================================================

/**
 * SHA-256 해싱
 *
 * @param input - 해싱할 문자열
 * @returns hex 인코딩된 SHA-256 해시
 */
export async function sha256(input: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, input);
}
