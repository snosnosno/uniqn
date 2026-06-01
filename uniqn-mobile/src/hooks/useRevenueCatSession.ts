/**
 * UNIQN Mobile - useRevenueCatSession
 * @description 인증 사용자 변경에 맞춰 RevenueCat SDK를 configure/logIn하고, 언마운트(로그아웃) 시 logOut.
 *   appUserID = Supabase user UUID(웹훅 app_user_id와 일치해야 함).
 *   웹/키 미설정 환경은 purchasesService가 no-op.
 */
import { useEffect } from 'react';
import { purchasesService } from '@/services/purchases';
import { useAuthStore } from '@/stores/authStore';

export function useRevenueCatSession(): void {
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid;

  useEffect(() => {
    if (uid) {
      void purchasesService.configure(uid);
    }
    return () => {
      void purchasesService.logOut();
    };
  }, [uid]);
}
