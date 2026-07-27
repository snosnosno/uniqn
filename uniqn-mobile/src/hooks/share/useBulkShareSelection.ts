/**
 * 묶음 공유 선택 상태 훅
 *
 * @description 공고 목록에서 여러 공고를 골라 한 번에 공유하기 위한 선택 상태.
 *   화면 로컬 상태로 둔다 — 목록을 벗어나면 선택이 사라지는 게 올바른 동작이라
 *   전역 스토어로 올릴 이유가 없다.
 *
 *   공유 불가 공고(승인 대기 대회·마감/취소)는 **선택 자체를 막는다**(fail-closed).
 *   실행 시점에도 useBulkShare 가 다시 검증하지만, 고를 수 있게 두면 사용자가
 *   "왜 5개 골랐는데 3개만 나가지?"를 매번 겪는다.
 */

import { useCallback, useMemo, useState } from 'react';
import { canShareJob } from '@/domains/job-posting';
import { MAX_BULK_SHARE_COUNT } from '@/utils/bulkJobShareMessage';
import { useToast } from '@/stores/toastStore';
import type { JobPosting } from '@/types';

/** 선택 가능 판정에 필요한 최소 형태 — 카드 뷰모델도 이 필드만 있으면 넘길 수 있다. */
export type ShareSelectable = Pick<JobPosting, 'id' | 'status' | 'postingType' | 'tournamentConfig'>;

export interface UseBulkShareSelectionReturn {
  /** 선택 모드 진입 여부 */
  isSelectionMode: boolean;
  /** 선택된 공고 id 집합 */
  selectedIds: Set<string>;
  /** 선택 개수 */
  selectedCount: number;
  /** 선택 상한 (UI 표기용) */
  maxCount: number;
  /** 선택 모드 진입 */
  enterSelectionMode: () => void;
  /** 선택 모드 종료 + 선택 초기화 */
  exitSelectionMode: () => void;
  /** 개별 토글. 상한 초과 시 토스트로 안내하고 선택하지 않는다. */
  toggle: (posting: ShareSelectable) => void;
  /** 선택 여부 조회 */
  isSelected: (jobId: string) => boolean;
  /** 공유 가능 여부 (체크박스 비활성 판정) */
  canSelect: (posting: ShareSelectable) => boolean;
  /** 화면에 보이는 공고 중 공유 가능한 것을 상한까지 선택 */
  selectAll: (postings: ShareSelectable[]) => void;
  /** 선택만 초기화 (선택 모드는 유지) */
  clear: () => void;
}

export function useBulkShareSelection(): UseBulkShareSelectionReturn {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toast = useToast();

  const canSelect = useCallback((posting: ShareSelectable) => canShareJob(posting), []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const enterSelectionMode = useCallback(() => setIsSelectionMode(true), []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggle = useCallback(
    (posting: ShareSelectable) => {
      if (!canShareJob(posting)) {
        toast.error('지금은 공유할 수 없는 공고예요. (승인 대기 중이거나 마감된 공고)');
        return;
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(posting.id)) {
          next.delete(posting.id);
          return next;
        }
        if (next.size >= MAX_BULK_SHARE_COUNT) {
          toast.error(`한 번에 최대 ${MAX_BULK_SHARE_COUNT}건까지 공유할 수 있어요`);
          return prev;
        }
        next.add(posting.id);
        return next;
      });
    },
    [toast]
  );

  const selectAll = useCallback(
    (postings: ShareSelectable[]) => {
      const shareable = postings.filter((posting) => canShareJob(posting));
      const picked = shareable.slice(0, MAX_BULK_SHARE_COUNT);
      setSelectedIds(new Set(picked.map((posting) => posting.id)));
      if (shareable.length > MAX_BULK_SHARE_COUNT) {
        toast.info(`상한 ${MAX_BULK_SHARE_COUNT}건까지만 선택했어요`);
      }
    },
    [toast]
  );

  const isSelected = useCallback((jobId: string) => selectedIds.has(jobId), [selectedIds]);

  return useMemo(
    () => ({
      isSelectionMode,
      selectedIds,
      selectedCount: selectedIds.size,
      maxCount: MAX_BULK_SHARE_COUNT,
      enterSelectionMode,
      exitSelectionMode,
      toggle,
      isSelected,
      canSelect,
      selectAll,
      clear,
    }),
    [
      isSelectionMode,
      selectedIds,
      enterSelectionMode,
      exitSelectionMode,
      toggle,
      isSelected,
      canSelect,
      selectAll,
      clear,
    ]
  );
}
