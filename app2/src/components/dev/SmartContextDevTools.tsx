/**
 * Smart Context DevTools
 * Smart Hybrid Context의 성능과 비용 절감 효과를 실시간으로 모니터링
 *
 * @version 1.0.0
 * @since 2025-01-24
 * @author T-HOLDEM Development Team
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnifiedDataDebug } from '../../hooks/useUnifiedData';
import smartCache from '../../utils/smartCache';
import { logger } from '../../utils/logger';

interface PerformanceMetrics {
  firebaseReads: number;
  cacheHits: number;
  cacheMisses: number;
  dataCount: {
    staff: number;
    workLogs: number;
    applications: number;
    jobPostings: number;
    attendance: number;
  };
  estimatedCost: {
    withoutOptimization: number;
    withOptimization: number;
    savings: number;
    savingsPercent: number;
  };
}

const SmartContextDevTools: React.FC = () => {
  const { role, currentUser } = useAuth();
  const debug = useUnifiedDataDebug();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    firebaseReads: 0,
    cacheHits: 0,
    cacheMisses: 0,
    dataCount: {
      staff: 0,
      workLogs: 0,
      applications: 0,
      jobPostings: 0,
      attendance: 0
    },
    estimatedCost: {
      withoutOptimization: 0,
      withOptimization: 0,
      savings: 0,
      savingsPercent: 0
    }
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateMetrics = () => {
      const cacheStats = smartCache.getStats();
      const dataSummary = debug.dataSummary;

      // 비용 계산 (Firebase Firestore 가격 기준)
      // $0.06 per 100,000 reads
      const COST_PER_100K_READS = 0.06;

      // 예상 읽기 횟수 계산
      const totalDocuments = Object.values(dataSummary).reduce((a, b) => a + b, 0);
      const dailyReadsWithoutOptimization = totalDocuments * 10; // 하루 10번 페이지 이동 가정
      const dailyReadsWithOptimization = role === 'staff'
        ? 50 * 10  // staff는 자신의 데이터만 (약 50개 문서)
        : totalDocuments * 10; // admin/manager는 전체

      const monthlyReadsWithoutOpt = dailyReadsWithoutOptimization * 30;
      const monthlyReadsWithOpt = dailyReadsWithOptimization * 30;

      const costWithoutOpt = (monthlyReadsWithoutOpt / 100000) * COST_PER_100K_READS;
      const costWithOpt = (monthlyReadsWithOpt / 100000) * COST_PER_100K_READS;
      const savings = costWithoutOpt - costWithOpt;
      const savingsPercent = costWithoutOpt > 0 ? (savings / costWithoutOpt) * 100 : 0;

      setMetrics({
        firebaseReads: cacheStats.misses,
        cacheHits: cacheStats.hits,
        cacheMisses: cacheStats.misses,
        dataCount: {
          staff: dataSummary.staff || 0,
          workLogs: dataSummary.workLogs || 0,
          applications: dataSummary.applications || 0,
          jobPostings: dataSummary.jobPostings || 0,
          attendance: dataSummary.attendanceRecords || 0
        },
        estimatedCost: {
          withoutOptimization: costWithoutOpt,
          withOptimization: costWithOpt,
          savings,
          savingsPercent
        }
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // 5초마다 업데이트

    return () => clearInterval(interval);
  }, [role, debug.dataSummary]);

  // 개발 모드가 아니면 표시하지 않음
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const cacheHitRate = metrics.cacheHits + metrics.cacheMisses > 0
    ? ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`bg-gray-900 text-white rounded-lg shadow-2xl transition-all ${
        isExpanded ? 'w-96' : 'w-64'
      }`}>
        {/* 헤더 */}
        <div
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-lg cursor-pointer flex items-center justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            <span className="text-lg">🚀</span>
            <span className="font-bold">Smart Context DevTools</span>
          </div>
          <span className="text-xl">{isExpanded ? '−' : '+'}</span>
        </div>

        {/* 주요 지표 */}
        <div className="p-4 space-y-3">
          {/* 역할 및 사용자 정보 */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Role:</span>
            <span className={`font-bold ${
              role === 'admin' ? 'text-red-400' :
              role === 'manager' ? 'text-orange-400' :
              role === 'staff' ? 'text-green-400' :
              'text-gray-400'
            }`}>{role || 'user'}</span>
          </div>

          {/* 비용 절감 */}
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/30">
            <div className="text-xs text-green-400 mb-1">💰 월간 비용 절감</div>
            <div className="text-2xl font-bold text-green-400">
              {metrics.estimatedCost.savingsPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              ${metrics.estimatedCost.savings.toFixed(2)} 절약/월
            </div>
          </div>

          {/* 캐시 성능 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-900/30 rounded-lg p-2 border border-blue-500/30">
              <div className="text-xs text-blue-400">캐시 적중률</div>
              <div className="text-lg font-bold">{cacheHitRate}%</div>
            </div>
            <div className="bg-purple-900/30 rounded-lg p-2 border border-purple-500/30">
              <div className="text-xs text-purple-400">Firebase 읽기</div>
              <div className="text-lg font-bold">{metrics.firebaseReads}</div>
            </div>
          </div>

          {/* 확장된 상세 정보 */}
          {isExpanded && (
            <>
              {/* 데이터 카운트 */}
              <div className="border-t border-gray-700 pt-3">
                <div className="text-xs text-gray-400 mb-2">📊 로드된 데이터</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Staff:</span>
                    <span className="font-mono">{metrics.dataCount.staff}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>WorkLogs:</span>
                    <span className="font-mono">{metrics.dataCount.workLogs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Applications:</span>
                    <span className="font-mono">{metrics.dataCount.applications}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>JobPostings:</span>
                    <span className="font-mono">{metrics.dataCount.jobPostings}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Attendance:</span>
                    <span className="font-mono">{metrics.dataCount.attendance}</span>
                  </div>
                </div>
              </div>

              {/* 비용 상세 */}
              <div className="border-t border-gray-700 pt-3">
                <div className="text-xs text-gray-400 mb-2">💵 예상 월간 비용</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>최적화 전:</span>
                    <span className="font-mono text-red-400">
                      ${metrics.estimatedCost.withoutOptimization.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>최적화 후:</span>
                    <span className="font-mono text-green-400">
                      ${metrics.estimatedCost.withOptimization.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="border-t border-gray-700 pt-3 space-y-2">
                <button
                  onClick={() => {
                    debug.logCurrentState();
                    logger.info('Smart Context 상태 로깅', {
                      component: 'SmartContextDevTools',
                      data: metrics
                    });
                  }}
                  className="w-full px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
                >
                  콘솔에 상태 출력
                </button>
                <button
                  onClick={() => {
                    smartCache.clear();
                    debug.clearCache();
                    logger.info('캐시 클리어 완료', { component: 'SmartContextDevTools' });
                  }}
                  className="w-full px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium transition-colors"
                >
                  캐시 클리어
                </button>
              </div>
            </>
          )}
        </div>

        {/* 최적화 상태 인디케이터 */}
        <div className={`h-1 rounded-b-lg ${
          metrics.estimatedCost.savingsPercent > 90 ? 'bg-green-500' :
          metrics.estimatedCost.savingsPercent > 70 ? 'bg-yellow-500' :
          metrics.estimatedCost.savingsPercent > 50 ? 'bg-orange-500' :
          'bg-red-500'
        }`} />
      </div>
    </div>
  );
};

export default SmartContextDevTools;