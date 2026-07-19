/**
 * UNIQN Mobile - 멤버 초대 후보 닉네임 검색 훅
 *
 * @description 팀 멤버 초대용. 닉네임 prefix(대소문자 무시)로 초대 가능한 구인자를 검색한다.
 *   수동 트리거(검색 버튼·엔터) 방식이라 useQuery 대신 명령형 상태로 관리한다 —
 *   서버 rate limit(분당 20회)이 걸려 있어 타이핑마다 호출하면 정상 사용자가 잠긴다.
 *
 * useStaffNicknameSearch 와 같은 형태를 의도적으로 유지한다(순서역전 가드 포함).
 */

import { useCallback, useRef, useState } from 'react';
import { workspaceService } from '@/services/workspace';
import type { WorkspaceInviteCandidate } from '@/repositories';
import { toError, isAppError } from '@/errors';
import { logger } from '@/utils/logger';

export interface UseWorkspaceInviteSearchReturn {
  results: WorkspaceInviteCandidate[];
  isSearching: boolean;
  /** 사용자에게 보여줄 실패 문구 (권한·rate limit 구분됨). 실패가 없으면 null */
  errorMessage: string | null;
  /** 검색을 1회 이상 수행했는지 (빈 결과 안내 분기용) */
  searched: boolean;
  search: (nickname: string) => Promise<void>;
  reset: () => void;
}

/** 서버 예외를 화면 문구로 옮긴다 — 옛 구현처럼 전부 "못 찾음"으로 뭉개지 않는다. */
function toUserMessage(error: unknown): string {
  if (isAppError(error) && error.userMessage) {
    return error.userMessage;
  }
  const raw = String(error);
  if (raw.includes('SEARCH_RATE_LIMITED')) {
    return '검색이 너무 잦아요. 잠시 후 다시 시도해주세요.';
  }
  if (raw.includes('PERMISSION_DENIED')) {
    return '이 팀의 소유자만 멤버를 초대할 수 있어요.';
  }
  return '검색에 실패했어요. 다시 시도해주세요.';
}

export function useWorkspaceInviteSearch(workspaceId: string): UseWorkspaceInviteSearchReturn {
  const [results, setResults] = useState<WorkspaceInviteCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  // 순서 역전 가드: 최신 요청만 상태에 반영(연타 시 늦게 끝난 옛 요청이 덮어쓰는 것 방지)
  const latestRequestId = useRef(0);

  const search = useCallback(
    async (nickname: string) => {
      const requestId = ++latestRequestId.current;
      setIsSearching(true);
      setErrorMessage(null);
      try {
        const found = await workspaceService.searchInviteCandidatesByNickname(
          workspaceId,
          nickname
        );
        if (requestId !== latestRequestId.current) return;
        setResults(found);
        setSearched(true);
      } catch (e) {
        if (requestId !== latestRequestId.current) return;
        logger.warn('멤버 초대 후보 검색 실패', { error: String(toError(e)) });
        setErrorMessage(toUserMessage(e));
        setResults([]);
        setSearched(true);
      } finally {
        if (requestId === latestRequestId.current) {
          setIsSearching(false);
        }
      }
    },
    [workspaceId]
  );

  const reset = useCallback(() => {
    // 진행 중 요청 결과가 reset 이후에 반영되지 않도록 요청 토큰 무효화
    latestRequestId.current += 1;
    setResults([]);
    setErrorMessage(null);
    setSearched(false);
    setIsSearching(false);
  }, []);

  return { results, isSearching, errorMessage, searched, search, reset };
}
