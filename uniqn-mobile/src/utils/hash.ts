/**
 * UNIQN Mobile - 해싱 유틸리티
 *
 * @description UID 해싱 등 공통 해싱 함수
 * @version 1.0.0
 */

/**
 * UID를 해싱하여 스토리지 키에 사용
 * 보안상 원본 UID를 로컬 스토리지에 노출하지 않기 위함
 *
 * SYNC: e2e/global-setup.ts hashUID()와 동일 알고리즘 유지 필수
 * 어느 한쪽을 변경하면 다른 쪽도 반드시 동기화할 것
 */
export function hashUID(uid: string): string {
  if (!uid) {
    throw new Error('hashUID: uid must be non-empty');
  }

  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
