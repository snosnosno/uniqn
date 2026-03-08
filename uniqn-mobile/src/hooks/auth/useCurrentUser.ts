/**
 * UNIQN Mobile - 현재 사용자 인증 정보 훅
 *
 * @description Firebase Auth currentUser 기반 인증 제공자 감지 로직
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';

/**
 * 현재 사용자가 Apple 로그인인지 확인
 *
 * Firebase Auth의 providerData를 검사하여 Apple Sign-In 여부를 반환.
 * 계정 삭제 시 Apple 토큰 파기 등 제공자별 분기에 사용.
 *
 * @precondition Auth guard로 보호된 라우트 내에서만 호출해야 합니다.
 *   마운트 시점에 `currentUser`가 복원되어 있어야 하므로,
 *   `(app)` 등 인증 필수 라우트 그룹 내에서만 사용하세요.
 *   인증 미완료 상태에서 호출하면 항상 `false`를 반환합니다.
 */
export function useIsAppleUser(): boolean {
  return useMemo(() => {
    const currentUser = getFirebaseAuth().currentUser;
    return currentUser?.providerData?.some((p) => p.providerId === 'apple.com') ?? false;
  }, []);
}
