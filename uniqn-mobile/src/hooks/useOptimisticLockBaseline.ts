import { useCallback, useState } from 'react';

/**
 * 낙관적 잠금 baseline 동결 훅.
 *
 * @description 편집을 **시작한 시점**의 `updatedAt` 을 붙잡아 저장 조건으로 쓴다.
 *
 *   왜 굳이 동결하는가 — 공고 편집 화면과 상세 레이아웃은 같은 queryKey 를 공유하고,
 *   상세 쪽 realtime 구독이 `setQueryData` 로 캐시를 갈아치운다. baseline 을 그 살아있는
 *   값에서 매번 읽으면 협업자가 저장한 순간 내 baseline 도 최신으로 따라가버려
 *   `.eq('updated_at', …)` 가 항상 매칭된다 — **잠금을 건 적이 없는 것과 같아진다.**
 *
 *   `releaseForOverwrite()` 는 충돌 안내를 사용자에게 이미 보여준 뒤에만 호출한다.
 *   한 번 놓으면 이후 갱신으로 다시 잠기지 않는다 — 재잠금은 "다시 저장해 주세요" 안내를
 *   영원히 실패하는 거짓말로 만들기 때문이다(경고를 본 사용자의 재저장은 통과해야 한다).
 */
export interface OptimisticLockBaseline {
  /** 저장 시 서버에 넘길 baseline. `null` 이면 잠금 없이 덮어쓴다. */
  expectedUpdatedAt: string | null;
  /** 충돌 안내 노출 후 호출 — 다음 저장을 덮어쓰기로 진행시킨다. */
  releaseForOverwrite: () => void;
}

interface LockState {
  /** 값이 한 번 확정됐는지. 확정 후에는 입력 갱신을 무시한다. */
  settled: boolean;
  value: string | null;
}

export function useOptimisticLockBaseline(
  latestUpdatedAt: string | null | undefined
): OptimisticLockBaseline {
  const [lock, setLock] = useState<LockState>({ settled: false, value: null });

  // 렌더 중 상태 조정 — 최초 관측값을 그 즉시 동결한다. effect 로 미루면 그사이 제출이
  // 들어왔을 때 잠금 없이 저장되는 창이 생긴다.
  if (!lock.settled && latestUpdatedAt) {
    setLock({ settled: true, value: latestUpdatedAt });
  }

  const releaseForOverwrite = useCallback(() => {
    setLock({ settled: true, value: null });
  }, []);

  return { expectedUpdatedAt: lock.settled ? lock.value : null, releaseForOverwrite };
}
