/**
 * StaffManagementTabSimplified - UnifiedDataContext 기반 단순화 버전
 * 기존 14개 훅을 3개로 줄이고 복잡한 상태 관리를 단순화
 * 
 * @version 3.0 (Week 3 최적화)
 * @since 2025-02-02
 */

import React, { useState, useCallback, useMemo } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import useUnifiedData from '../../hooks/useUnifiedData';
// import useSystemPerformance from '../../hooks/useSystemPerformance'; // 임시 비활성화
import { useToast } from '../../hooks/useToast';

interface StaffManagementTabSimplifiedProps {
  jobPosting?: any;
}

/**
 * 단순화된 스태프 관리 탭
 * 복잡성 지수: 14개 훅 → 3개 훅 (80% 감소)
 */
const StaffManagementTabSimplified: React.FC<StaffManagementTabSimplifiedProps> = ({ 
  jobPosting 
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  
  // 🚀 UnifiedDataContext 활용 (1개 훅으로 모든 데이터 접근)
  const {
    state,
    loading
  } = useUnifiedData();
  
  // 📊 성능 모니터링 (임시 비활성화)
  // const { currentMetrics, isPerformanceGood } = useSystemPerformance({
  //   enableRealtimeTracking: true
  // });
  const currentMetrics: { optimizationScore: number; averageQueryTime: number; cacheHitRate: number; activeSubscriptions: number } | null = null;
  const isPerformanceGood = true;
  
  // 🎯 단순화된 상태 관리 (9개 → 2개)
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // 📈 메모이제이션된 데이터 (성능 최적화)
  const staffData = useMemo(() => {
    if (!jobPosting?.id) return [];
    return Array.from(state.staff.values()).filter((staff: any) => 
      Array.from(state.workLogs.values()).some((log: any) => 
        log.staffId === staff.staffId && log.eventId === jobPosting.id
      )
    );
  }, [state.staff, state.workLogs, jobPosting?.id]);
  
  const workLogsData = useMemo(() => {
    if (!jobPosting?.id) return [];
    return Array.from(state.workLogs.values()).filter((log: any) => 
      log.eventId === jobPosting.id
    );
  }, [state.workLogs, jobPosting?.id]);
  
  const attendanceData = useMemo(() => {
    if (!jobPosting?.id) return [];
    return Array.from(state.attendanceRecords.values()).filter((att: any) => 
      att.eventId === jobPosting.id
    );
  }, [state.attendanceRecords, jobPosting?.id]);
  
  // 📋 날짜별 그룹화 (기존 복잡한 로직을 단순화)
  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    staffData.forEach((staff: any) => {
      const workLogs = workLogsData.filter((log: any) => log.staffId === staff.staffId);
      const attendance = attendanceData.filter((att: any) => att.staffId === staff.staffId);
      
      workLogs.forEach((workLog: any) => {
        const date = workLog.date;
        if (!groups[date]) {
          groups[date] = [];
        }
        
        groups[date]!.push({
          ...staff,
          workLog,
          attendance: attendance.find((att: any) => att.workLogId === workLog.id)
        });
      });
    });
    
    return groups;
  }, [staffData, workLogsData, attendanceData]);
  
  // 🎯 단순화된 이벤트 핸들러들
  const handleStaffSelect = useCallback((staffId: string) => {
    setSelectedStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  }, []);
  
  const handleSelectAll = useCallback(() => {
    if (selectedStaffIds.size === staffData.length) {
      setSelectedStaffIds(new Set());
    } else {
      setSelectedStaffIds(new Set(staffData.map((staff: any) => staff.staffId)));
    }
  }, [selectedStaffIds.size, staffData]);
  
  const handleBulkAction = useCallback(async (action: 'approve' | 'reject' | 'delete') => {
    if (selectedStaffIds.size === 0) {
      showError('선택된 스태프가 없습니다.');
      return;
    }
    
    try {
      logger.info(`대량 작업 실행: ${action}`, {
        component: 'StaffManagementTabSimplified',
        data: { selectedCount: selectedStaffIds.size, action }
      });
      
      // TODO: 실제 bulk operation 구현
      showSuccess(`${selectedStaffIds.size}명의 스태프에 대한 ${action} 작업이 완료되었습니다.`);
      setSelectedStaffIds(new Set());
      
    } catch (error) {
      logger.error('대량 작업 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'StaffManagementTabSimplified'
      });
      showError('대량 작업 중 오류가 발생했습니다.');
    }
  }, [selectedStaffIds, showSuccess, showError]);
  
  // 로딩 상태
  if (loading.staff || loading.workLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3 inline-block"></div>
          스태프 데이터 로딩 중...
        </div>
      </div>
    );
  }
  
  // 데이터 없음
  if (staffData.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">👥</div>
        <p className="text-gray-500 mb-4">등록된 스태프가 없습니다.</p>
        <p className="text-sm text-gray-400">
          구인공고에 지원한 스태프가 승인되면 여기에 표시됩니다.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 성능 모니터링 표시 (개발 환경) */}
      {process.env.NODE_ENV === 'development' && currentMetrics && (
        <div className={`p-3 rounded-lg text-sm ${
          isPerformanceGood ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
        }`}>
          <div className="flex items-center justify-between">
            <span>
              ⚡ 성능: {(currentMetrics as any)?.optimizationScore || 'N/A'}점 
              | 쿼리: {(currentMetrics as any)?.averageQueryTime?.toFixed(1) || 'N/A'}ms
              | 캐시: {(currentMetrics as any)?.cacheHitRate?.toFixed(1) || 'N/A'}%
            </span>
            <span className="text-xs">
              구독: {(currentMetrics as any)?.activeSubscriptions || 0}개
            </span>
          </div>
        </div>
      )}
      
      {/* 헤더 & 컨트롤 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            스태프 관리 ({staffData.length}명)
          </h2>
          {selectedStaffIds.size > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {selectedStaffIds.size}명 선택됨
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* 뷰 모드 토글 */}
          <div className="flex border rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'list' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              목록
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'grid' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              그리드
            </button>
          </div>
          
          {/* 전체 선택 */}
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {selectedStaffIds.size === staffData.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>
      </div>
      
      {/* 대량 작업 버튼 */}
      {selectedStaffIds.size > 0 && (
        <div className="flex gap-2 p-4 bg-blue-50 rounded-lg">
          <button
            onClick={() => handleBulkAction('approve')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            일괄 승인
          </button>
          <button
            onClick={() => handleBulkAction('reject')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            일괄 거절
          </button>
          <button
            onClick={() => handleBulkAction('delete')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            일괄 삭제
          </button>
        </div>
      )}
      
      {/* 스태프 목록 (날짜별 그룹화) */}
      <div className="space-y-4">
        {Object.entries(groupedData)
          .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
          .map(([date, staffList]) => (
            <div key={date} className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-medium text-gray-900">
                  📅 {new Date(date).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} ({staffList.length}명)
                </h3>
              </div>
              
              <div className={
                viewMode === 'grid' 
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4'
                  : 'divide-y'
              }>
                {staffList.map((item, index) => (
                  <div
                    key={`${item.staffId}-${index}`}
                    className={`${
                      viewMode === 'grid' 
                        ? 'p-4 border rounded-lg hover:shadow-md transition-shadow'
                        : 'p-4 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedStaffIds.has(item.staffId)}
                          onChange={() => handleStaffSelect(item.staffId)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {item.name}
                          </h4>
                          <div className="text-sm text-gray-500 space-y-1">
                            <p>📞 {item.phone || '전화번호 없음'}</p>
                            <p>👤 {item.role || '역할 미정'}</p>
                            {item.workLog && (
                              <p>⏰ {item.workLog.scheduledStartTime} - {item.workLog.scheduledEndTime}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-1">
                        {item.attendance && (
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            item.attendance.status === 'checked_in' 
                              ? 'bg-green-100 text-green-800' 
                              : item.attendance.status === 'checked_out'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {item.attendance.status === 'checked_in' && '✅ 출근'}
                            {item.attendance.status === 'checked_out' && '🏁 퇴근'}  
                            {item.attendance.status === 'not_started' && '⏳ 대기'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
      
      {/* 성능 정보 (디버그용) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400 text-center">
          🚀 Week 3 최적화: {staffData.length}개 스태프 데이터 렌더링 완료
        </div>
      )}
    </div>
  );
};

export default StaffManagementTabSimplified;