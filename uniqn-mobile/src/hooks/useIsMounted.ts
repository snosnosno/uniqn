/**
 * UNIQN Mobile - useIsMounted
 *
 * 컴포넌트가 마운트 상태인지 추적하는 ref를 반환합니다.
 * async 작업 완료 후 setState를 호출하기 전에 isMountedRef.current를 확인해
 * unmount 이후 상태 갱신으로 인한 메모리 누수를 방지합니다.
 */

import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

export function useIsMounted(): MutableRefObject<boolean> {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}
