/**
 * 고유 ID 생성 유틸리티
 *
 * @description expo-crypto의 getRandomValues를 직접 사용하여 충돌 방지
 */

import { getRandomValues, randomUUID } from 'expo-crypto';

/**
 * 고유 ID 생성 (타임스탬프 + 랜덤)
 *
 * @param prefix - 선택적 접두사 (예: 'modal', 'q')
 * @returns 고유 ID 문자열
 */
export function generateId(prefix?: string): string {
  const random = getRandomString(9);
  const id = `${Date.now()}-${random}`;
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * UUID v4 생성
 *
 * @description expo-crypto 네이티브 구현 활용
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * 암호학적으로 안전한 랜덤 문자열 생성
 */
function getRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0').slice(-1))
    .join('')
    .substring(0, length);
}
