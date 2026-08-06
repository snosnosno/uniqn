/**
 * UNIQN Mobile - 수동 새로고침(Pull-to-Refresh) 상태 훅
 *
 * @description `RefreshControl.refreshing` 을 **사용자가 직접 당긴 경우에만** true 로 만든다.
 *
 * ## 왜 필요한가
 * `refreshing={query.isRefetching}` 처럼 TanStack Query 의 조회 상태를 그대로 물리면,
 * 사용자가 아무것도 안 했는데도 스피너가 뜬다 — 탭을 옮기거나 앱을 포그라운드로 되돌릴
 * 때마다 stale 쿼리가 배경 재조회되기 때문이다(refetchOnMount / focusManager 배선).
 * 화면을 전환할 때마다 상단에 새로고침 피커가 튀어나오는 증상이 이것이다.
 *
 * 배경 재조회는 **조용해야** 한다(stale-while-revalidate 의 요지). 캐시된 내용이 이미
 * 떠 있으므로 사용자가 기다릴 것이 없고, 스피너는 iOS 에서 콘텐츠를 아래로 밀기까지 한다.
 *
 * 같은 레포의 선례: `app/(employer)/work-schedule.tsx` 가 이 패턴을 로컬로 구현해 두었다.
 *
 * @example
 * ```tsx
 * const { refreshing, onRefresh } = useManualRefresh(refetch);
 * <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...PTR_REFRESH_PROPS} />
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/utils/logger';

export interface ManualRefreshState {
  /** 사용자가 당겨서 시작한 새로고침이 진행 중인지 */
  readonly refreshing: boolean;
  /** RefreshControl 의 onRefresh 에 그대로 넘긴다 */
  readonly onRefresh: () => void;
}

/**
 * @param refresh 실제 재조회를 수행하는 함수(TanStack `refetch`, `invalidateQueries` 래퍼 등).
 *   Promise 를 반환하면 완료까지 스피너를 유지하고, 아니면 즉시 내린다.
 */
export function useManualRefresh(refresh: () => unknown | Promise<unknown>): ManualRefreshState {
  const [refreshing, setRefreshing] = useState(false);

  // 언마운트 후 setState 로 경고가 나지 않게 — 새로고침 도중 화면을 떠날 수 있다.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 최신 refresh 를 참조로 들고 onRefresh 의 정체성을 고정한다 — RefreshControl 이
  // 매 렌더 새 함수를 받으면 iOS 에서 진행 중인 제스처가 끊긴다.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const onRefresh = useCallback(() => {
    // 이미 돌고 있으면 중복 실행하지 않는다(연속으로 당기는 경우).
    if (refreshing) {
      return;
    }

    setRefreshing(true);

    void (async () => {
      try {
        await refreshRef.current();
      } catch (error) {
        // 실패해도 스피너는 반드시 내린다. 에러 표면(배너/토스트)은 호출 측 쿼리 상태가 담당한다.
        logger.warn('수동 새로고침 실패', {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (isMountedRef.current) {
          setRefreshing(false);
        }
      }
    })();
  }, [refreshing]);

  return { refreshing, onRefresh };
}
