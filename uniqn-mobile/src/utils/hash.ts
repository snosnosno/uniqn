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
 * 이중 해시(djb2a 변형)로 ~64비트 공간 확보하여 충돌 저항성 강화
 *
 * SYNC: e2e/global-setup.ts hashUID()와 동일 알고리즘 유지 필수
 * 어느 한쪽을 변경하면 다른 쪽도 반드시 동기화할 것
 */
export function hashUID(uid: string): string {
  if (!uid) {
    throw new Error('hashUID: uid must be non-empty');
  }

  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }

  return `${Math.abs(hash1).toString(36)}_${Math.abs(hash2).toString(36)}`;
}
