/**
 * UNIQN Mobile - useClaimDailyAttendance
 *
 * @description 일일 출석 적립 뮤테이션.
 *   - 성공(claimed): 지갑 잔액 쿼리 키 invalidate(6A 패턴) + 성공 토스트
 *   - 이미 출석(already_claimed): info 토스트만 (invalidate 없음)
 *   - 에러: 에러 토스트
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { claimDailyAttendance } from '@/services/wallet';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/stores/toastStore';
import { queryKeys } from '@/lib/queryClient';

export function useClaimDailyAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const uid = user?.uid;

  return useMutation({
    mutationFn: () => claimDailyAttendance(),
    onSuccess: (result) => {
      if (result.status === 'claimed') {
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary(uid) });
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.ledger(uid) });
        addToast({ type: 'success', message: `출석 완료! 하트 ${result.amount}개를 받았어요.` });
      } else {
        addToast({ type: 'info', message: '오늘은 이미 출석했어요.' });
      }
    },
    onError: () => {
      addToast({ type: 'error', message: '출석 적립에 실패했어요. 다시 시도해 주세요.' });
    },
  });
}
