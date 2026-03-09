/**
 * UNIQN Mobile - 사용자 UID 해시 훅
 *
 * @description 인증된 사용자의 UID 해시를 반환하는 유틸리티 훅
 */

import { useAuthStore } from '@/stores/authStore';
import { hashUID } from '@/utils/hash';

/**
 * 인증된 사용자의 UID 해시를 반환
 * 미인증 시 null
 */
export function useUserHash(): string | null {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !user?.uid) return null;
  return hashUID(user.uid);
}
