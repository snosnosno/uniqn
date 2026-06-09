/**
 * UNIQN Mobile - useRestorePurchases
 * @description 스토어 구매 복원(영수증 재동기화) — App Store 심사(3.1.1) 필수 동선.
 *   성공 시 wallet 캐시 무효화 + 토스트. 진행 중 중복 호출 무시(이중탭 가드).
 */
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { purchasesService } from '@/services/purchases';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/utils/logger';

export function useRestorePurchases() {
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid);
  const { success, error: showError } = useToastStore();
  const [restoring, setRestoring] = useState(false);
  const inFlight = useRef(false);

  const restore = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRestoring(true);
    try {
      // uid 전달 — RC 사용자 정합 보장(stale/anonymous 영수증 동기화 차단)
      await purchasesService.restorePurchases(uid);
      // 미반영 영수증이 웹훅으로 적립될 수 있어 잔액·내역 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary(uid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.ledger(uid) });
      success('구매 내역을 동기화했어요.');
    } catch (err) {
      logger.error('restorePurchases.failed', err as Error);
      showError('구매 복원에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      inFlight.current = false;
      setRestoring(false);
    }
  }, [queryClient, uid, success, showError]);

  return { restoring, restore };
}
