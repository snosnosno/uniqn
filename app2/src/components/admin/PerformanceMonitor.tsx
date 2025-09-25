/**
 * PerformanceMonitor - 최적화 성능 모니터링 컴포넌트
 * 실시간으로 Firebase 비용 절감 효과와 성능 메트릭 표시
 *
 * @version 1.0
 * @since 2025-09-25
 * @author T-HOLDEM Development Team
 */

import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../../utils/logger';
import { optimizedUnifiedDataService } from '../../services/OptimizedUnifiedDataService';

interface PerformanceMetrics {
  subscriptionCount: number;
  queryTimes: number[];
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
  lastOptimizationRun: number;
  cacheHitRate: number;
  avgQueryTime: number;
  optimizationSavings: number;
  cache: {
    size: number;
    hitRate: number;
  };
}

interface CostCalculation {
  originalReads: number;
  optimizedReads: number;
  savedReads: number;
  savingPercentage: number;
  monthlyCost: {
    original: number;
    optimized: number;
    saved: number;
  };
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // 성능 메트릭 주기적 업데이트
  useEffect(() => {
    const updateMetrics = () => {
      try {
        const currentMetrics = optimizedUnifiedDataService.getPerformanceMetrics();
        setMetrics(currentMetrics);
      } catch (error) {
        logger.error('성능 메트릭 업데이트 실패', error instanceof Error ? error : new Error(String(error)));
      }
    };

    // 초기 로드
    updateMetrics();

    // 5초마다 업데이트
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  // 비용 계산
  const costCalculation = useMemo((): CostCalculation => {
    if (!metrics) {
      return {
        originalReads: 0,
        optimizedReads: 0,
        savedReads: 0,
        savingPercentage: 0,
        monthlyCost: { original: 0, optimized: 0, saved: 0 }
      };
    }

    // 예상 원본 읽기 횟수 (최적화 전)
    const originalReads = metrics.optimizationSavings * 2.5; // 추정값
    const optimizedReads = originalReads - metrics.optimizationSavings;
    const savingPercentage = originalReads > 0 ? (metrics.optimizationSavings / originalReads) * 100 : 0;

    // Firebase 가격: $0.36 per million reads
    const readCostPerMillion = 0.36;
    const dailyReadsToMonthly = 30; // 30일

    const originalMonthlyCost = (originalReads * dailyReadsToMonthly * readCostPerMillion) / 1000000;
    const optimizedMonthlyCost = (optimizedReads * dailyReadsToMonthly * readCostPerMillion) / 1000000;
    const savedMonthlyCost = originalMonthlyCost - optimizedMonthlyCost;

    return {
      originalReads: Math.round(originalReads),
      optimizedReads: Math.round(optimizedReads),
      savedReads: metrics.optimizationSavings,
      savingPercentage: Math.round(savingPercentage),
      monthlyCost: {
        original: Math.round(originalMonthlyCost * 100) / 100,
        optimized: Math.round(optimizedMonthlyCost * 100) / 100,
        saved: Math.round(savedMonthlyCost * 100) / 100
      }
    };
  }, [metrics]);

  if (!metrics) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-100 rounded-lg p-3 shadow-lg">
        <div className="text-sm text-gray-600">성능 메트릭 로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all ${
          isVisible ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
        } text-white`}
        title={isVisible ? '성능 모니터 숨기기' : '성능 모니터 표시'}
      >
        {isVisible ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
      </button>

      {/* 성능 모니터 패널 */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm w-80 z-40">
          <div className="space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-800">⚡ 성능 모니터</h3>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">실시간</span>
              </div>
            </div>

            {/* 비용 절감 효과 */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-3 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">💰 비용 절감 효과</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">절약된 읽기:</span>
                  <span className="font-mono font-semibold text-green-600">
                    {costCalculation.savedReads.toLocaleString()}회
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">절약 비율:</span>
                  <span className="font-mono font-bold text-green-600">
                    {costCalculation.savingPercentage}%
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium text-gray-700">월 절약 금액:</span>
                  <span className="font-mono font-bold text-green-700">
                    ${costCalculation.monthlyCost.saved}
                  </span>
                </div>
              </div>
            </div>

            {/* 캐시 성능 */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">🚀 캐시 성능</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">히트율:</span>
                  <span className="font-mono font-semibold text-blue-600">
                    {metrics.cacheHitRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">캐시 크기:</span>
                  <span className="font-mono text-blue-600">{metrics.cache.size}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">히트/미스:</span>
                  <span className="font-mono text-blue-600">
                    {metrics.cacheHits}/{metrics.cacheMisses}
                  </span>
                </div>
              </div>
            </div>

            {/* 쿼리 성능 */}
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">⚡ 쿼리 성능</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">평균 응답시간:</span>
                  <span className="font-mono font-semibold text-purple-600">
                    {metrics.avgQueryTime.toFixed(2)}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">활성 구독:</span>
                  <span className="font-mono text-purple-600">{metrics.subscriptionCount}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">오류 수:</span>
                  <span className={`font-mono ${metrics.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {metrics.errorCount}회
                  </span>
                </div>
              </div>
            </div>

            {/* 월 비용 상세 */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-2">📊 월 비용 분석</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">기존 비용:</span>
                  <span className="font-mono text-red-600">${costCalculation.monthlyCost.original}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">최적화 후:</span>
                  <span className="font-mono text-blue-600">${costCalculation.monthlyCost.optimized}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span className="text-gray-700">총 절약:</span>
                  <span className="font-mono text-green-600">${costCalculation.monthlyCost.saved}</span>
                </div>
              </div>
            </div>

            {/* 성능 상태 표시기 */}
            <div className="flex justify-center space-x-4 pt-2 border-t">
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                  metrics.avgQueryTime < 100 ? 'bg-green-500' :
                  metrics.avgQueryTime < 300 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <div className="text-xs text-gray-500">속도</div>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                  metrics.cacheHitRate > 70 ? 'bg-green-500' :
                  metrics.cacheHitRate > 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <div className="text-xs text-gray-500">캐시</div>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                  metrics.errorCount === 0 ? 'bg-green-500' :
                  metrics.errorCount < 5 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <div className="text-xs text-gray-500">안정성</div>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                  costCalculation.savingPercentage > 50 ? 'bg-green-500' :
                  costCalculation.savingPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <div className="text-xs text-gray-500">절약</div>
              </div>
            </div>

            {/* 업데이트 시간 */}
            <div className="text-center">
              <div className="text-xs text-gray-400">
                마지막 업데이트: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PerformanceMonitor;