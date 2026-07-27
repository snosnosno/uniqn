import { useCallback, useRef, useState } from 'react';

import { toError } from '@/errors';
import { logger } from '@/utils/logger';

export interface SubmitGate<TArgs extends unknown[] = []> {
  /**
   * 제출을 실행한다. **성공했을 때만** `onSuccess` 가 돈다.
   * 진행 중 재호출은 무시되며, 실패해도 호출부로 되던지지 않는다.
   */
  submit: (...args: TArgs) => Promise<void>;
  /** 진행 중 여부 — 버튼·입력 잠금과 '처리 중' 라벨에 쓴다. */
  isSubmitting: boolean;
}

export interface UseSubmitGateOptions<TArgs extends unknown[]> {
  /** 실제 제출. `mutate` 가 아니라 **`mutateAsync`** 를 넘겨야 결과를 볼 수 있다. */
  action: (...args: TArgs) => Promise<unknown>;
  /** 성공 후 부수효과 — 모달 닫기·네비게이션·필터 전환. 실패하면 절대 돌지 않는다. */
  onSuccess?: (...args: TArgs) => void;
  /** 실패 로그 메시지. 사용자 토스트는 발행하지 않는다(아래 주석 참고). */
  errorMessage: string;
  /** 실패 로그에 함께 남길 식별자. */
  context?: Record<string, unknown>;
}

/**
 * 제출 관문 — 결과를 보고 나서 닫는다.
 *
 * @description 이 훅이 막는 것은 하나다: **결과를 보기 전에 성공을 선언하는 것.**
 *   `mutate` 는 fire-and-forget 이고 throw 하지 않는다. 그래서 `mutate` 직후 모달을 닫는
 *   코드는 실패할 때 사용자가 입력한 사유를 통째로 버리고, 같은 파일의 '처리 중...' 라벨과
 *   `isLoading` prop 을 **도달 불가능한 죽은 코드**로 만들며, 감싸고 있는 try/catch 의
 *   catch 절까지 죽인다. 느린 네트워크에서는 재탭으로 중복 제출까지 열린다.
 *
 *   계약 넷:
 *   1. `mutateAsync` 를 await 한다.
 *   2. 진행 중에는 `isSubmitting` 을 켜고 재호출을 **무시**한다(ref 가드 — state 는
 *      리렌더 전이라 같은 틱의 두 번째 탭을 못 막는다).
 *   3. 성공에서만 `onSuccess`(닫기·이동·필터 전환)를 실행한다.
 *   4. 실패하면 화면을 그대로 두고 로그만 남긴다.
 *
 *   ⚠️ **사용자 토스트를 발행하지 않는다.** 성공/실패 토스트는 mutation 훅이 이미
 *   담당한다(useJobManagement·useConfirmedStaff·useCancellationManagement 등). 화면에서
 *   한 장 더 얹으면 같은 실패가 두 번 뜨거나 Supabase 영문 원문이 사용자에게 노출된다.
 *
 * @example
 * const rejectGate = useSubmitGate<[string]>({
 *   action: (reason) => rejectAsync({ applicationId, reason }),
 *   onSuccess: closeModal,
 *   errorMessage: '취소 요청 거절 실패',
 *   context: { applicationId },
 * });
 * <Button onPress={() => rejectGate.submit(reason)} loading={rejectGate.isSubmitting} />
 */
export function useSubmitGate<TArgs extends unknown[] = []>({
  action,
  onSuccess,
  errorMessage,
  context,
}: UseSubmitGateOptions<TArgs>): SubmitGate<TArgs> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // state 는 리렌더 후에야 보이므로 같은 틱의 재탭을 못 막는다 — 잠금의 진실원은 이 ref 다.
  const inFlightRef = useRef(false);

  const submit = useCallback(
    async (...args: TArgs) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setIsSubmitting(true);
      try {
        await action(...args);
        onSuccess?.(...args);
      } catch (error) {
        logger.error(errorMessage, toError(error), context);
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [action, onSuccess, errorMessage, context]
  );

  return { submit, isSubmitting };
}
