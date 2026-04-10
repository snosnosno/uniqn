/**
 * UNIQN Mobile - 현재 사용자 인증 정보 훅
 *
 * @description Supabase Auth 기반 인증 제공자 감지 로직
 * @version 2.0.0 - Supabase Auth 전환
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * 현재 사용자가 Apple 로그인인지 확인
 *
 * authStore의 user.providerIds를 검사하여 Apple Sign-In 여부를 반환.
 * 계정 삭제 시 Apple 토큰 파기 등 제공자별 분기에 사용.
 *
 * @precondition Auth guard로 보호된 라우트 내에서만 호출해야 합니다.
 */
export function useIsAppleUser(): boolean {
  const user = useAuthStore((state) => state.user);
  return useMemo(() => {
    return user?.providerIds?.includes('apple') ?? false;
  }, [user]);
}
