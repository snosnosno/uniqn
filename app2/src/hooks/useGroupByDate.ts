import { useState, useEffect, useMemo, useRef } from 'react';

import { logger } from '../utils/logger';
interface GroupByDateOptions<T> {
  data: T[];
  getDateKey: (item: T) => string;
  sortItems?: (a: T, b: T) => number;
  storageKey?: string;
  defaultExpanded?: boolean;
}

interface GroupedData<T> {
  grouped: Record<string, T[]>;
  sortedKeys: string[];
  totalItems: number;
}

interface UseGroupByDateReturn<T> {
  // 그룹화된 데이터
  groupedData: GroupedData<T>;

  // 확장 상태
  expandedKeys: Set<string>;
  isExpanded: (key: string) => boolean;
  toggleExpansion: (key: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // 유틸리티
  getItemCount: (key: string) => number;
  getTotalItems: () => number;
  getExpandedCount: () => number;
}

export const useGroupByDate = <T>(options: GroupByDateOptions<T>): UseGroupByDateReturn<T> => {
  const { data, getDateKey, sortItems, storageKey, defaultExpanded = false } = options;

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  // localStorage에서 확장 상태 복원 (마운트 시 한 번만)
  useEffect(() => {
    if (isInitializedRef.current) return;

    if (storageKey) {
      const savedExpanded = localStorage.getItem(storageKey);
      if (savedExpanded) {
        try {
          const expandedArray = JSON.parse(savedExpanded);
          setExpandedKeys(new Set(expandedArray));
          isInitializedRef.current = true;
        } catch (error) {
          logger.error(
            '확장 상태 복원 오류:',
            error instanceof Error ? error : new Error(String(error)),
            { component: 'useGroupByDate' }
          );
          // 기본값 설정
          if (defaultExpanded && data.length > 0) {
            const allKeys = Array.from(new Set(data.map(getDateKey)));
            setExpandedKeys(new Set(allKeys));
          }
          isInitializedRef.current = true;
        }
      } else if (defaultExpanded && data.length > 0) {
        // 저장된 상태가 없고 기본값이 확장이면 모든 키를 확장
        const allKeys = Array.from(new Set(data.map(getDateKey)));
        setExpandedKeys(new Set(allKeys));
        isInitializedRef.current = true;
      } else {
        isInitializedRef.current = true;
      }
    } else if (!isInitializedRef.current && defaultExpanded && data.length > 0) {
      // storageKey가 없고 기본값이 확장이면
      const allKeys = Array.from(new Set(data.map(getDateKey)));
      setExpandedKeys(new Set(allKeys));
      isInitializedRef.current = true;
    } else {
      isInitializedRef.current = true;
    }
  }, [storageKey, defaultExpanded, data, getDateKey]);

  // 그룹화된 데이터 생성
  const groupedData = useMemo((): GroupedData<T> => {
    // 데이터를 키별로 그룹화
    const grouped = data.reduce(
      (acc, item) => {
        const key = getDateKey(item);
        if (!acc[key]) {
          acc[key] = [];
        }
        const items = acc[key];
        if (items) {
          items.push(item);
        }
        return acc;
      },
      {} as Record<string, T[]>
    );

    // 각 그룹 내에서 정렬 (제공된 정렬 함수 사용)
    if (sortItems) {
      Object.keys(grouped).forEach((key) => {
        const items = grouped[key];
        if (items) {
          items.sort(sortItems);
        }
      });
    }

    // 키를 정렬 (날짜 형식 고려)
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      // "날짜 미정" 또는 비슷한 특수 값을 맨 뒤로
      if (a.includes('미정') || a.includes('없음')) return 1;
      if (b.includes('미정') || b.includes('없음')) return -1;

      // 날짜 형식 문자열 비교
      return a.localeCompare(b);
    });

    const totalItems = data.length;

    return { grouped, sortedKeys, totalItems };
  }, [data, getDateKey, sortItems]);

  // 확장 상태 토글
  const toggleExpansion = (key: string) => {
    const newExpandedKeys = new Set(expandedKeys);
    if (newExpandedKeys.has(key)) {
      newExpandedKeys.delete(key);
    } else {
      newExpandedKeys.add(key);
    }
    setExpandedKeys(newExpandedKeys);

    // localStorage에 상태 저장
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(newExpandedKeys)));
    }
  };

  // 모든 그룹 확장
  const expandAll = () => {
    const allKeys = new Set(groupedData.sortedKeys);
    setExpandedKeys(allKeys);

    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(allKeys)));
    }
  };

  // 모든 그룹 축소
  const collapseAll = () => {
    setExpandedKeys(new Set());

    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify([]));
    }
  };

  // 특정 키의 확장 상태 확인
  const isExpanded = (key: string): boolean => {
    return expandedKeys.has(key);
  };

  // 특정 키의 아이템 수 반환
  const getItemCount = (key: string): number => {
    return groupedData.grouped[key]?.length || 0;
  };

  // 전체 아이템 수 반환
  const getTotalItems = (): number => {
    return groupedData.totalItems;
  };

  // 확장된 그룹 수 반환
  const getExpandedCount = (): number => {
    return expandedKeys.size;
  };

  return {
    // 그룹화된 데이터
    groupedData,

    // 확장 상태
    expandedKeys,
    isExpanded,
    toggleExpansion,
    expandAll,
    collapseAll,

    // 유틸리티
    getItemCount,
    getTotalItems,
    getExpandedCount,
  };
};

export type { GroupByDateOptions, GroupedData, UseGroupByDateReturn };
