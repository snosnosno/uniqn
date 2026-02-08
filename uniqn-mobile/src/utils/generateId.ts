/**
 * 고유 ID 생성 유틸리티
 *
 * @description crypto.getRandomValues 기반으로 충돌 방지
 * Math.random() 대신 암호학적으로 안전한 난수 사용
 */

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
 * @description RFC 4122 호환 UUID 생성
 */
export function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // variant 1
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * 암호학적으로 안전한 랜덤 문자열 생성
 */
function getRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0').slice(-1))
    .join('')
    .substring(0, length);
}
