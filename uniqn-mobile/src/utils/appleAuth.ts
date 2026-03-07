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
 * 암호학적으로 안전한 랜덤 nonce 생성 (reject sampling)
 *
 * 복권 추첨기처럼 고르지 않은 공이 섞여 있으면 특정 번호가 더 잘 나온다.
 * reject sampling으로 256개 바이트 중 균등하게 나누어지지 않는 값을 버려서
 * 모든 문자가 동일한 확률로 선택되도록 보장한다.
 *
 * @param length - nonce 길이 (기본 32)
 * @returns 랜덤 문자열
 */
export function generateNonce(length = 32): string {
  // CHARSET.length=66, 66*3=198. 198 이상인 바이트는 버림 (균등 분포 보장)
  const REJECT_THRESHOLD = Math.floor(256 / CHARSET.length) * CHARSET.length;
  const bufferSize = length * 2;
  const randomValues = new Uint8Array(bufferSize);
  getRandomValues(randomValues);

  const result: string[] = [];
  let i = 0;

  while (result.length < length) {
    if (i >= randomValues.length) {
      // 버퍼 소진 시 새로 생성 (rejection rate ~22.6%, 확률상 극히 드문 케이스)
      getRandomValues(randomValues);
      i = 0;
    }
    const byte = randomValues[i++];
    if (byte < REJECT_THRESHOLD) {
      result.push(CHARSET[byte % CHARSET.length]);
    }
  }

  return result.join('');
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
