/**
 * UNIQN Mobile - 스태프 전화번호 검색 훅
 *
 * @description 스태프 직접 추가용. 전화번호 정확 일치로 앱 가입자를 검색한다.
 *   수동 트리거(검색 버튼) 방식이라 useQuery 대신 명령형 상태로 관리한다.
 */

import { useCallback, useRef, useState } from 'react';
import { searchStaffByPhone } from '@/services';
import type { UserPhoneSearchResult } from '@/repositories';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';

export interface UseStaffPhoneSearchReturn {
  results: UserPhoneSearchResult[];
  isSearching: boolean;
  error: Error | null;
  /** 검색을 1회 이상 수행했는지 (빈 결과 안내 분기용) */
  searched: boolean;
  search: (phone: string) => Promise<void>;
  reset: () => void;
}

export function useStaffPhoneSearch(): UseStaffPhoneSearchReturn {
  const [results, setResults] = useState<UserPhoneSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searched, setSearched] = useState(false);
  // 순서 역전 가드: 최신 요청만 상태에 반영(연타 시 늦게 끝난 옛 요청이 덮어쓰는 것 방지)
  const latestRequestId = useRef(0);

  const search = useCallback(async (phone: string) => {
    const requestId = ++latestRequestId.current;
    setIsSearching(true);
    setError(null);
    try {
      const found = await searchStaffByPhone(phone);
      if (requestId !== latestRequestId.current) return;
      setResults(found);
      setSearched(true);
    } catch (e) {
      if (requestId !== latestRequestId.current) return;
      const normalized = toError(e);
      logger.error('스태프 전화번호 검색 실패', normalized);
      setError(normalized);
      setResults([]);
      setSearched(true);
    } finally {
      if (requestId === latestRequestId.current) {
        setIsSearching(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    // 진행 중 요청 결과가 reset 이후에 반영되지 않도록 요청 토큰 무효화
    latestRequestId.current += 1;
    setResults([]);
    setError(null);
    setSearched(false);
    setIsSearching(false);
  }, []);

  return { results, isSearching, error, searched, search, reset };
}
