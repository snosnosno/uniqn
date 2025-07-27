import { useMemo } from 'react';

interface UseVirtualizationOptions {
  itemCount: number;
  threshold?: number; // 가상화를 시작할 최소 아이템 수
  mobileThreshold?: number; // 모바일에서의 임계값
  isMobile?: boolean;
}

interface UseVirtualizationReturn {
  shouldVirtualize: boolean;
  height: number;
  itemHeight: number;
  maxVisibleItems: number;
}

/**
 * 리스트 가상화 사용 여부와 설정을 결정하는 훅
 * 대용량 데이터에서 성능 최적화를 위해 react-window 사용 여부를 결정
 */
export const useVirtualization = ({
  itemCount,
  threshold = 50, // 50개 이상일 때 가상화 시작
  mobileThreshold = 30, // 모바일에서는 30개 이상일 때 시작
  isMobile = false
}: UseVirtualizationOptions): UseVirtualizationReturn => {
  
  const config = useMemo(() => {
    const currentThreshold = isMobile ? mobileThreshold : threshold;
    const shouldVirtualize = itemCount >= currentThreshold;
    
    // 가상화 설정
    const baseItemHeight = isMobile ? 200 : 80; // 모바일 카드: 200px, 데스크톱 행: 80px
    const maxVisibleItems = isMobile ? 5 : 10; // 최대 표시 아이템 수
    const height = Math.min(
      maxVisibleItems * baseItemHeight,
      window.innerHeight * 0.6 // 뷰포트의 60%를 넘지 않도록
    );

    return {
      shouldVirtualize,
      height: shouldVirtualize ? height : Math.min(itemCount * baseItemHeight, height),
      itemHeight: baseItemHeight,
      maxVisibleItems
    };
  }, [itemCount, threshold, mobileThreshold, isMobile]);

  return config;
};

/**
 * 가상화 성능 통계를 위한 유틸리티
 */
export const getVirtualizationStats = (
  totalItems: number,
  visibleItems: number,
  isVirtualized: boolean
) => ({
  totalItems,
  visibleItems,
  isVirtualized,
  memoryReduction: isVirtualized 
    ? Math.round((1 - visibleItems / totalItems) * 100) 
    : 0,
  renderReduction: isVirtualized 
    ? `${totalItems - visibleItems} 개 항목 절약`
    : '가상화 미적용'
});

export default useVirtualization;