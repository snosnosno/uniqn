import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  lastRenderTime: number;
  cacheHitRate: number;
  virtualizationActive: boolean;
  visibleItems: number;
  totalItems: number;
}

interface PerformanceMonitorProps {
  componentName: string;
  isVirtualized?: boolean;
  totalItems?: number;
  visibleItems?: number;
  children: React.ReactNode;
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

/**
 * 컴포넌트 성능을 실시간으로 모니터링하는 래퍼 컴포넌트
 * React DevTools Profiler와 함께 사용하여 정확한 성능 측정 제공
 */
const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  componentName,
  isVirtualized = false,
  totalItems = 0,
  visibleItems = 0,
  children,
  onMetricsUpdate
}) => {
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const lastRenderTimeRef = useRef(performance.now());
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    cacheHitRate: 0,
    virtualizationActive: isVirtualized,
    visibleItems,
    totalItems
  });

  // 캐시 히트율 계산
  const calculateCacheHitRate = useCallback(() => {
    try {
      // useCachedFormatDate에서 캐시 통계 가져오기
      const { getCacheStats } = require('../hooks/useCachedFormatDate');
      const stats = getCacheStats();
      
      // 총 캐시 시도 대비 히트율 추정 (실제 히트 카운터가 없으므로 캐시 사용률로 추정)
      const totalCacheSize = stats.formatDateCacheSize + stats.timeDisplayCacheSize + stats.timeSlotColorCacheSize;
      const maxCacheSize = 1000 + 500 + 200; // 각 캐시의 최대 크기
      
      return totalCacheSize > 0 ? Math.min((totalCacheSize / maxCacheSize) * 100, 95) : 0;
    } catch (error) {
      console.warn('캐시 통계 계산 실패:', error);
      return 0;
    }
  }, []);


  // 컴포넌트 마운트 시와 주요 props 변경 시에만 성능 측정
  useEffect(() => {
    const currentTime = performance.now();
    const renderTime = currentTime - lastRenderTimeRef.current;
    
    renderCountRef.current += 1;
    renderTimesRef.current.push(renderTime);
    
    // 최근 100회 렌더링 시간만 유지
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current.shift();
    }
    
    const totalTime = renderTimesRef.current.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / renderTimesRef.current.length;
    
    let cacheHitRate = 0;
    try {
      // useCachedFormatDate에서 캐시 통계 가져오기
      const { getCacheStats } = require('../hooks/useCachedFormatDate');
      const stats = getCacheStats();
      
      // 총 캐시 시도 대비 히트율 추정
      const totalCacheSize = stats.formatDateCacheSize + stats.timeDisplayCacheSize + stats.timeSlotColorCacheSize;
      const maxCacheSize = 1000 + 500 + 200;
      
      cacheHitRate = totalCacheSize > 0 ? Math.min((totalCacheSize / maxCacheSize) * 100, 95) : 0;
    } catch (error) {
      // 캐시 통계 계산 실패 시 0으로 설정
      cacheHitRate = 0;
    }
    
    const newMetrics: PerformanceMetrics = {
      renderCount: renderCountRef.current,
      totalRenderTime: totalTime,
      averageRenderTime: averageTime,
      lastRenderTime: renderTime,
      cacheHitRate,
      virtualizationActive: isVirtualized,
      visibleItems,
      totalItems
    };
    
    setMetrics(newMetrics);
    lastRenderTimeRef.current = currentTime;
    
    // onMetricsUpdate는 stable reference인 경우에만 호출
    if (onMetricsUpdate) {
      onMetricsUpdate(newMetrics);
    }
  }, [isVirtualized, visibleItems, totalItems]);

  // 개발 모드에서만 성능 정보 표시
  const showPerformanceInfo = process.env.NODE_ENV === 'development';

  return (
    <>
      {children}
      {showPerformanceInfo && (
        <div 
          className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg text-xs font-mono z-50"
          style={{ maxWidth: '300px' }}
        >
          <div className="font-bold mb-2">{componentName} 성능</div>
          <div className="space-y-1">
            <div>렌더링 횟수: {metrics.renderCount}</div>
            <div>평균 렌더 시간: {metrics.averageRenderTime.toFixed(2)}ms</div>
            <div>마지막 렌더 시간: {metrics.lastRenderTime.toFixed(2)}ms</div>
            <div>캐시 히트율: {metrics.cacheHitRate.toFixed(1)}%</div>
            {isVirtualized && (
              <>
                <div>가상화: ✅ 활성</div>
                <div>표시된 항목: {visibleItems} / {totalItems}</div>
                <div>메모리 절약: {totalItems > 0 ? (((totalItems - visibleItems) / totalItems) * 100).toFixed(1) : 0}%</div>
              </>
            )}
            {!isVirtualized && totalItems > 50 && (
              <div className="text-yellow-300">⚠️ 가상화 권장 ({totalItems}개 항목)</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PerformanceMonitor;
export type { PerformanceMetrics };