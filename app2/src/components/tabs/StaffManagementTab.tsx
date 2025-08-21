import React, { useState, useCallback, useMemo } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAttendanceStatus } from '../../hooks/useAttendanceStatus';
import { useResponsive } from '../../hooks/useResponsive';
import { useStaffManagement, StaffData } from '../../hooks/useStaffManagement';
import { useVirtualization } from '../../hooks/useVirtualization';
import { usePerformanceMetrics } from '../../hooks/usePerformanceMetrics';
import { getTodayString } from '../../utils/jobPosting/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useJobPostingContext } from '../../contexts/JobPostingContextAdapter';
import { useToast } from '../../hooks/useToast';
import { useStaffSelection } from '../../hooks/useStaffSelection';
import { useAttendanceMap } from '../../hooks/useAttendanceMap';
import { createVirtualWorkLog } from '../../utils/workLogUtils';
import { fixConfirmedStaffTimeSlots } from '../../utils/fixConfirmedStaffTimeSlots';
import { BulkOperationService } from '../../services/BulkOperationService';
import BulkActionsModal from '../BulkActionsModal';
import BulkTimeEditModal from '../BulkTimeEditModal';
import PerformanceMonitor from '../PerformanceMonitor';
import PerformanceDashboard from '../PerformanceDashboard';
import QRCodeGeneratorModal from '../QRCodeGeneratorModal';
import StaffCard from '../StaffCard';
import StaffDateGroup from '../StaffDateGroup';
import StaffDateGroupMobile from '../StaffDateGroupMobile';
import StaffRow from '../StaffRow';
import VirtualizedStaffList from '../VirtualizedStaffList';
import VirtualizedStaffTable from '../VirtualizedStaffTable';
import WorkTimeEditor from '../WorkTimeEditor';
import StaffProfileModal from '../StaffProfileModal';
import MobileSelectionBar from '../MobileSelectionBar';
import '../../styles/staffSelection.css';

interface StaffManagementTabProps {
  jobPosting?: any;
}

const StaffManagementTab: React.FC<StaffManagementTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { isMobile, isTablet } = useResponsive();
  const { currentUser } = useAuth();
  const { refreshWorkLogs } = useJobPostingContext();
  const { showError, showSuccess } = useToast();
  
  // 커스텀 훅 사용
  const {
    staffData,
    groupedStaffData,
    loading,
    error,
    filters,
    setFilters,
    expandedDates,
    groupByDate,
    setGroupByDate,
    deleteStaff,
    toggleDateExpansion,
    formatTimeDisplay,
    getTimeSlotColor,
    getStaffWorkLog
  } = useStaffManagement({
    jobPostingId: jobPosting?.id,
    enableFiltering: true
  });

  // 출석 상태 관리
  const { 
    attendanceRecords,
    getStaffAttendanceStatus,
    applyOptimisticUpdate
  } = useAttendanceStatus({
    eventId: jobPosting?.id || 'default-event'
  });
  
  // AttendanceRecords를 Map으로 변환하여 O(1) 검색
  const { getStaffAttendance: _getStaffAttendance } = useAttendanceMap(attendanceRecords);
  
  // 모달 상태
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isWorkTimeEditorOpen, setIsWorkTimeEditorOpen] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState<any | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedStaffForProfile, setSelectedStaffForProfile] = useState<StaffData | null>(null);
  
  // 선택 모드 관리 (커스텀 훅 사용)
  const {
    multiSelectMode,
    selectedStaff,
    toggleMultiSelectMode,
    toggleStaffSelection,
    selectAll,
    deselectAll,
    isAllSelected,
    resetSelection
  } = useStaffSelection({
    totalStaffCount: staffData.length,
    onSelectionChange: (_count) => {
      // logger.debug 제거 - 성능 최적화
    }
  });
  
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [isBulkTimeEditOpen, setIsBulkTimeEditOpen] = useState(false);
  const [isFixingTimeSlots, setIsFixingTimeSlots] = useState(false);
  
  // 성능 모니터링 상태 (개발 환경에서만)
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const { registerComponentMetrics } = usePerformanceMetrics();
  
  // 성능 메트릭 업데이트 콜백 (안정적인 참조를 위해 useCallback 사용)
  const onMetricsUpdate = useCallback((metrics: any) => {
    registerComponentMetrics(
      'StaffManagementTab',
      metrics.lastRenderTime,
      metrics.virtualizationActive,
      metrics.totalItems,
      metrics.visibleItems
    );
  }, [registerComponentMetrics]);
  
  // 권한 체크 - 공고 작성자만 수정 가능
  const canEdit = currentUser?.uid && currentUser.uid === jobPosting?.createdBy;

  // 출퇴근 시간 수정 핸들러 (다중 날짜 지원)
  const handleEditWorkTime = useCallback(async (staffId: string, timeType?: 'start' | 'end', targetDate?: string) => {
    // 권한 체크
    if (!canEdit) {
      showError('이 공고를 수정할 권한이 없습니다.');
      return;
    }
    
    const staff = staffData.find(s => s.id === staffId);
    if (!staff) {
      showError('스태프 정보를 찾을 수 없습니다.');
      return;
    }

    // 대상 날짜 결정: 파라미터로 받은 날짜 또는 스태프의 assignedDate 또는 오늘 날짜
    const workDate = targetDate || staff.assignedDate || getTodayString();
    
    // staffId에서 실제 ID 추출 (날짜 부분 제거)
    const actualStaffId = staffId.replace(/_\d{4}-\d{2}-\d{2}$/, '');
    
    // Firebase에서 직접 최신 workLog 가져오기
    const workLogId = `${jobPosting?.id || 'default-event'}_${actualStaffId}_${workDate}`;
    const workLogRef = doc(db, 'workLogs', workLogId);
    
    try {
      const docSnap = await getDoc(workLogRef);
      
      if (docSnap.exists()) {
        // 실제 workLog가 있는 경우
        const data = docSnap.data();
        // Firebase 데이터를 먼저 spread하고, 필수 필드만 오버라이드
        const workLogData = {
          ...data,  // 모든 Firebase 데이터 포함 (Timestamp 객체 포함)
          id: workLogId,
          eventId: data.eventId || jobPosting?.id,
          staffId: data.staffId || actualStaffId,
          dealerId: data.dealerId || actualStaffId,
          date: workDate,
          staffName: staff.name || data.staffName || '이름 미정',
          dealerName: staff.name || data.dealerName || '이름 미정'
        };
        logger.info('WorkLog 데이터 가져오기 성공', { 
          component: 'StaffManagementTab',
          data: { 
            workLogId,
            hasScheduledStartTime: !!data.scheduledStartTime,
            hasScheduledEndTime: !!data.scheduledEndTime,
            scheduledStartTimeType: data.scheduledStartTime ? typeof data.scheduledStartTime : 'null',
            scheduledEndTimeType: data.scheduledEndTime ? typeof data.scheduledEndTime : 'null'
          }
        });
        setSelectedWorkLog(workLogData);
        setIsWorkTimeEditorOpen(true);
      } else {
        // staff.assignedTime이 없으면 timeSlot 사용
        const timeValue = staff.assignedTime || (staff as any).timeSlot || null;
        
        // 디버깅: staff의 시간 값 확인
        logger.info('가상 WorkLog 생성 시도', { 
          component: 'StaffManagementTab',
          data: {
            staffId: actualStaffId,
            staffName: staff.name,
            assignedTime: staff.assignedTime,
            timeSlot: (staff as any).timeSlot,
            timeValue,
            workDate
          }
        });
        
        // 해당 날짜의 가상 WorkLog 생성 (유틸리티 함수 사용)
        const virtualWorkLog = createVirtualWorkLog({
          eventId: jobPosting?.id || 'default-event',
          staffId: actualStaffId,
          staffName: staff.name || '이름 미정',
          date: workDate,
          assignedTime: timeValue
        });
        
        setSelectedWorkLog(virtualWorkLog);
        setIsWorkTimeEditorOpen(true);
      }
    } catch (error) {
      logger.error('WorkLog 가져오기 실패', error instanceof Error ? error : new Error(String(error)), { 
        component: 'StaffManagementTab',
        data: { staffId, workDate }
      });
      
      // 오류 발생 시 가상 WorkLog 생성
      const timeValue = staff.assignedTime || (staff as any).timeSlot || null;
      const virtualWorkLog = createVirtualWorkLog({
        eventId: jobPosting?.id || 'default-event',
        staffId: actualStaffId,
        staffName: staff.name || '이름 미정',
        date: workDate,
        assignedTime: timeValue
      });
      
      setSelectedWorkLog(virtualWorkLog);
      setIsWorkTimeEditorOpen(true);
    }
  }, [canEdit, staffData, jobPosting?.id, showError]);
  
  // WorkTimeEditor의 onUpdate 콜백 처리
  const handleWorkTimeUpdate = useCallback((updatedWorkLog: any) => {
    // workLog가 업데이트되면 자동으로 Firebase 구독이 감지하여 UI 업데이트
    // 추가로 필요한 처리가 있다면 여기서 수행
    logger.info('WorkTimeEditor에서 시간 업데이트 완료', { 
      component: 'StaffManagementTab',
      data: { 
        workLogId: updatedWorkLog.id,
        staffId: updatedWorkLog.staffId
      }
    });
    
    // 업데이트된 데이터로 selectedWorkLog 갱신 (모달은 열어둠)
    setSelectedWorkLog(updatedWorkLog);
    
    // 중요: WorkLogs 데이터를 강제로 새로고침하여 정산 탭에 즉시 반영
    logger.info('🔄 WorkLogs 데이터 강제 새로고침 시작', { 
      component: 'StaffManagementTab',
      data: { 
        workLogId: updatedWorkLog.id,
        staffId: updatedWorkLog.staffId,
        date: updatedWorkLog.date
      }
    });
    refreshWorkLogs();
  }, [refreshWorkLogs]);
  

  // 필터링된 데이터 계산 (메모이제이션 최적화)
  const flattenedStaffData = useMemo(() => {
    const flattened = Object.values(groupedStaffData.grouped).flat();
    // 객체 참조 안정성을 위한 추가 확인
    return flattened.length === 0 ? [] : flattened;
  }, [groupedStaffData.grouped]);
  
  const filteredStaffCount = flattenedStaffData.length; // useMemo 제거 - 단순 계산
  
  const selectedStaffData = useMemo(() => {
    if (selectedStaff.size === 0) return []; // 빈 배열 재사용
    return staffData.filter(staff => selectedStaff.has(staff.id));
  }, [staffData, selectedStaff]);

  // 가상화 설정
  const mobileVirtualization = useVirtualization({
    itemCount: filteredStaffCount,
    threshold: 30,
    mobileThreshold: 20,
    isMobile: true
  });

  const desktopVirtualization = useVirtualization({
    itemCount: filteredStaffCount,
    threshold: 50,
    mobileThreshold: 30,
    isMobile: false
  });
  

  // 최적화된 핸들러들 (메모이제이션 강화)
  const handleStaffSelect = useCallback((staffId: string) => {
    toggleStaffSelection(staffId);
  }, [toggleStaffSelection]);
  
  const handleMultiSelectToggle = useCallback(() => {
    toggleMultiSelectMode();
  }, [toggleMultiSelectMode]);

  // 고정된 props 값들 메모이제이션
  const constantProps = useMemo(() => ({
    showDate: true,
    canEdit: !!canEdit,
    eventId: jobPosting?.id || 'default-event'
  }), [canEdit, jobPosting?.id]);
  
  const handleBulkActions = () => {
    setIsBulkActionsOpen(true);
  };
  
  const handleBulkDelete = async (staffIds: string[]) => {
    // 순차적으로 삭제 (병렬 처리시 충돌 가능성)
    for (const staffId of staffIds) {
      await deleteStaff(staffId);
    }
    resetSelection(); // 선택 상태 초기화
  };
  
  const handleBulkMessage = async (staffIds: string[], message: string) => {
    alert(`${staffIds.length}명에게 메시지를 발송했습니다: "${message}"`);
  };
  
  const handleBulkStatusUpdate = async (staffIds: string[], status: string) => {
    if (!canEdit) {
      showError('이 공고를 수정할 권한이 없습니다.');
      return;
    }
    
    try {
      const staffInfo = staffIds.map(id => {
        const staff = staffData.find(s => s.id === id);
        return {
          id,
          name: staff?.name || '이름 미정',
          ...(staff?.assignedDate && { assignedDate: staff.assignedDate })
        };
      });
      
      const result = await BulkOperationService.bulkUpdateStatus(
        staffInfo,
        jobPosting?.id || 'default-event',
        status as any
      );
      
      const { type, message } = BulkOperationService.generateResultMessage(
        result,
        'status',
        { status }
      );
      
      if (type === 'success') {
        showSuccess(message);
        resetSelection(); // 성공 시 선택 상태 초기화
      } else {
        showError(message);
      }
    } catch (error) {
      logger.error('출석 상태 일괄 변경 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'StaffManagementTab' });
      showError('출석 상태 변경 중 오류가 발생했습니다.');
    }
  };
  
  // 프로필 모달 핸들러
  const handleShowProfile = (staffId: string) => {
    const staff = staffData.find(s => s.id === staffId);
    if (staff) {
      setSelectedStaffForProfile(staff);
      setIsProfileModalOpen(true);
    }
  };

  // confirmedStaff의 잘못된 timeSlot 수정
  const handleFixTimeSlots = async () => {
    if (!jobPosting?.id) {
      showError('공고 ID를 찾을 수 없습니다.');
      return;
    }
    
    setIsFixingTimeSlots(true);
    try {
      const result = await fixConfirmedStaffTimeSlots(jobPosting.id);
      
      if (result.success) {
        showSuccess(`${result.updatedCount}명의 스태프 시간 데이터가 수정되었습니다.`);
        // JobPosting 데이터 새로고침
        if (window.location.reload) {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else {
        showError(result.error || '시간 데이터 수정에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Time slots 수정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'StaffManagementTab'
      });
      showError('시간 데이터 수정 중 오류가 발생했습니다.');
    } finally {
      setIsFixingTimeSlots(false);
    }
  };

  // Early return if no job posting data
  if (!jobPosting) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg text-gray-500">공고 정보를 불러올 수 없습니다.</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 ml-4">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PerformanceMonitor
        componentName="StaffManagementTab"
        isVirtualized={mobileVirtualization.shouldVirtualize || desktopVirtualization.shouldVirtualize}
        totalItems={filteredStaffCount}
        visibleItems={mobileVirtualization.shouldVirtualize ? mobileVirtualization.maxVisibleItems : desktopVirtualization.shouldVirtualize ? desktopVirtualization.maxVisibleItems : filteredStaffCount}
        onMetricsUpdate={onMetricsUpdate}
      >
        <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">{jobPosting.title} - 스태프 관리</h3>
          
          {/* 데스크톱에서만 검색 기능과 날짜별 그룹화 토글을 오른쪽 상단에 표시 */}
          {!isMobile && !isTablet && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={groupByDate}
                    onChange={(e) => setGroupByDate(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">날짜별 그룹화</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="스태프 검색..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {canEdit && (
                <>
                  <button
                    onClick={handleMultiSelectToggle}
                    className={`px-3 py-2 rounded-md transition-colors flex items-center space-x-2 ${
                      multiSelectMode
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title={multiSelectMode ? '선택 모드 종료' : '스태프를 선택하여 일괄 수정'}
                  >
                    <span>{multiSelectMode ? '선택 완료' : '선택 모드'}</span>
                    {multiSelectMode && (
                      <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded text-sm">
                        {selectedStaff.size}/{filteredStaffCount}
                      </span>
                    )}
                  </button>
                  {multiSelectMode && selectedStaff.size > 0 && (
                    <button
                      onClick={() => setIsBulkTimeEditOpen(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2"
                      title={`선택된 ${selectedStaff.size}명 일괄 수정`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>선택 항목 수정 ({selectedStaff.size}명)</span>
                    </button>
                  )}
                  {!multiSelectMode && (
                    <button
                      onClick={() => {
                        // 전체 스태프를 선택하고 일괄 수정 모달 열기
                        selectAll(staffData.map(s => s.id));
                        setIsBulkTimeEditOpen(true);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      title={`전체 ${staffData.length}명 일괄 수정`}
                    >
                      전체 일괄 수정
                    </button>
                  )}
                </>
              )}
              <button
                onClick={handleFixTimeSlots}
                disabled={isFixingTimeSlots}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                title="잘못된 시간 데이터를 수정합니다"
              >
                {isFixingTimeSlots ? '수정 중...' : '시간 데이터 수정'}
              </button>
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                QR 생성
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 p-4 rounded-lg mb-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* 모바일에서 추가 컨트롤 */}
        {(isMobile || isTablet) && (
          <div className="mb-4 space-y-3">
            {/* 검색 및 날짜별 그룹화 */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={groupByDate}
                    onChange={(e) => setGroupByDate(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">날짜별 그룹화</span>
                </label>
                <button
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  QR 생성
                </button>
              </div>
              <input
                type="text"
                placeholder="스태프 검색..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* 다중 선택 모드 및 일괄 작업 */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  총 {staffData.length}명
                  {filteredStaffCount !== staffData.length && ` (${filteredStaffCount}명 필터됨)`}
                </span>
              </div>
              <div className="flex space-x-2">
                {canEdit && (
                  <>
                    <button
                      onClick={handleMultiSelectToggle}
                      className={`px-3 py-1 rounded text-sm ${
                        multiSelectMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {multiSelectMode ? '선택 취소' : '다중 선택'}
                    </button>
                    {multiSelectMode && selectedStaff.size > 0 && (
                      <>
                        <button
                          onClick={handleBulkActions}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          일괄 작업 ({selectedStaff.size})
                        </button>
                        <button
                          onClick={() => setIsBulkTimeEditOpen(true)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          시간 수정
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 선택 모드 활성화 시 안내 메시지 */}
        {multiSelectMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-blue-800">
                <strong>선택 모드:</strong> {isMobile ? '카드를 터치' : '스태프 행을 클릭'}하여 선택하세요
              </span>
            </div>
          </div>
        )}

        {/* 스태프 목록 */}
        {staffData.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <p className="text-gray-600 mb-4">이 공고에 할당된 스태프가 없습니다.</p>
            <p className="text-sm text-gray-500">
              지원자 목록에서 지원자를 확정하면 자동으로 스태프로 등록됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(isMobile || isTablet) ? (
              // 모바일/태블릿 카드 레이아웃
              groupByDate ? (
                // 모바일 날짜별 그룹화 보기
                groupedStaffData.sortedDates.map((date) => {
                  const staffForDate = groupedStaffData.grouped[date];
                  const isExpanded = expandedDates.has(date);
                  
                  if (!staffForDate) return null;
                  
                  return (
                    <StaffDateGroupMobile
                      key={date}
                      date={date}
                      staffList={staffForDate}
                      isExpanded={isExpanded}
                      onToggleExpansion={toggleDateExpansion}
                      onEditWorkTime={handleEditWorkTime}
                      onDeleteStaff={deleteStaff}
                      getStaffAttendanceStatus={getStaffAttendanceStatus}
                      attendanceRecords={attendanceRecords}
                      formatTimeDisplay={formatTimeDisplay}
                      getTimeSlotColor={getTimeSlotColor}
                      selectedStaff={selectedStaff}
                      onStaffSelect={handleStaffSelect}
                      multiSelectMode={multiSelectMode}
                      onShowProfile={handleShowProfile}
                      eventId={jobPosting?.id}
                      getStaffWorkLog={getStaffWorkLog}
                    />
                  );
                })
              ) : (
                // 모바일 단일 카드 리스트 (가상화 적용)
                mobileVirtualization.shouldVirtualize ? (
                  <VirtualizedStaffList
                    staffList={flattenedStaffData}
                    onEditWorkTime={handleEditWorkTime}
                    onDeleteStaff={deleteStaff}
                    getStaffAttendanceStatus={getStaffAttendanceStatus}
                    attendanceRecords={attendanceRecords}
                    formatTimeDisplay={formatTimeDisplay}
                    getTimeSlotColor={getTimeSlotColor}
                    showDate={true}
                    multiSelectMode={multiSelectMode}
                    selectedStaff={selectedStaff}
                    onStaffSelect={handleStaffSelect}
                    height={mobileVirtualization.height}
                    itemHeight={mobileVirtualization.itemHeight}
                    onShowProfile={handleShowProfile}
                    eventId={jobPosting?.id}
                    canEdit={!!canEdit}
                    getStaffWorkLog={getStaffWorkLog}
                  />
                ) : (
                  <div className="space-y-3">
                    {flattenedStaffData.map((staff) => (
                      <StaffCard
                        key={staff.id}
                        staff={staff}
                        onEditWorkTime={handleEditWorkTime}
                        onDeleteStaff={deleteStaff}
                        getStaffAttendanceStatus={getStaffAttendanceStatus}
                        attendanceRecords={attendanceRecords}
                        formatTimeDisplay={formatTimeDisplay}
                        getTimeSlotColor={getTimeSlotColor}
                        {...constantProps}
                        isSelected={multiSelectMode && selectedStaff.has(staff.id)}
                        multiSelectMode={multiSelectMode}
                        {...(multiSelectMode && { onSelect: handleStaffSelect })}
                        onShowProfile={handleShowProfile}
                        getStaffWorkLog={getStaffWorkLog}
                      />
                    ))}
                  </div>
                )
              )
            ) : (
              // 데스크톱 테이블 레이아웃
              groupByDate ? (
                // 데스크톱 날짜별 그룹화 보기
                groupedStaffData.sortedDates.map((date) => {
                  const staffForDate = groupedStaffData.grouped[date];
                  const isExpanded = expandedDates.has(date);
                  
                  if (!staffForDate) return null;
                  
                  return (
                    <StaffDateGroup
                      key={date}
                      date={date}
                      staffList={staffForDate}
                      isExpanded={isExpanded}
                      onToggleExpansion={toggleDateExpansion}
                      onEditWorkTime={handleEditWorkTime}
                      onDeleteStaff={deleteStaff}
                      getStaffAttendanceStatus={getStaffAttendanceStatus}
                      attendanceRecords={attendanceRecords}
                      formatTimeDisplay={formatTimeDisplay}
                      getTimeSlotColor={getTimeSlotColor}
                      onShowProfile={handleShowProfile}
                      eventId={jobPosting?.id}
                      canEdit={!!canEdit}
                      getStaffWorkLog={getStaffWorkLog}
                      applyOptimisticUpdate={applyOptimisticUpdate}
                      multiSelectMode={multiSelectMode}
                      selectedStaff={selectedStaff}
                      onStaffSelect={handleStaffSelect}
                    />
                  );
                })
              ) : (
                // 데스크톱 단일 테이블 보기 (가상화 적용)
                desktopVirtualization.shouldVirtualize ? (
                  <VirtualizedStaffTable
                    staffList={flattenedStaffData}
                    onEditWorkTime={handleEditWorkTime}
                    onDeleteStaff={deleteStaff}
                    getStaffAttendanceStatus={getStaffAttendanceStatus}
                    attendanceRecords={attendanceRecords}
                    formatTimeDisplay={formatTimeDisplay}
                    getTimeSlotColor={getTimeSlotColor}
                    showDate={true}
                    height={desktopVirtualization.height}
                    rowHeight={desktopVirtualization.itemHeight}
                    eventId={jobPosting?.id}
                    canEdit={!!canEdit}
                  />
                ) : (
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {multiSelectMode && (
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                  onClick={() => {
                                    if (isAllSelected(flattenedStaffData.map(s => s.id))) {
                                      deselectAll();
                                    } else {
                                      selectAll(flattenedStaffData.map(s => s.id));
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors select-all-button"
                                  aria-label="전체 선택/해제"
                                >
                                  {isAllSelected(flattenedStaffData.map(s => s.id)) ? '전체 해제' : '전체 선택'}
                                </button>
                              </th>
                            )}
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              출근
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              퇴근
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              이름
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              역할
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              연락처
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              출석
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              작업
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {flattenedStaffData.map((staff) => (
                            <tr
                              key={staff.id}
                              className={`${selectedStaff.has(staff.id) ? 'staff-row-selected' : ''} ${multiSelectMode ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                              onClick={() => multiSelectMode && handleStaffSelect(staff.id)}
                            >
                              <StaffRow
                                staff={staff}
                                onEditWorkTime={handleEditWorkTime}
                                onDeleteStaff={deleteStaff}
                                getStaffAttendanceStatus={getStaffAttendanceStatus}
                                attendanceRecords={attendanceRecords}
                                formatTimeDisplay={formatTimeDisplay}
                                getTimeSlotColor={getTimeSlotColor}
                                showDate={true}
                                onShowProfile={handleShowProfile}
                                eventId={jobPosting?.id}
                                canEdit={!!canEdit}
                                getStaffWorkLog={getStaffWorkLog}
                                applyOptimisticUpdate={applyOptimisticUpdate}
                                multiSelectMode={multiSelectMode}
                                isSelected={selectedStaff.has(staff.id)}
                                onSelect={handleStaffSelect}
                              />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        )}
        </div>
      </PerformanceMonitor>

      {/* 성능 대시보드 (개발 환경에서만) */}
      <PerformanceDashboard
        isVisible={isDashboardOpen}
        onToggle={() => setIsDashboardOpen(!isDashboardOpen)}
      />

      {/* QR 코드 생성 모달 */}
      <QRCodeGeneratorModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        eventId={jobPosting?.id || 'default-event'}
        title={t('attendance.actions.generateQR')}
        description={`${jobPosting?.title || '공고'} 스태프들이 출석 체크를 할 수 있는 QR 코드를 생성합니다.`}
      />

      {/* 시간 수정 모달 */}
      <WorkTimeEditor
        isOpen={isWorkTimeEditorOpen}
        onClose={() => {
          setIsWorkTimeEditorOpen(false);
          setSelectedWorkLog(null); // 모달 닫을 때만 초기화
        }}
        workLog={selectedWorkLog}
        onUpdate={handleWorkTimeUpdate}
      />


      {/* 일괄 작업 모달 */}
      <BulkActionsModal
        isOpen={isBulkActionsOpen}
        onClose={() => setIsBulkActionsOpen(false)}
        selectedStaff={selectedStaffData}
        onBulkDelete={handleBulkDelete}
        onBulkMessage={handleBulkMessage}
        onBulkStatusUpdate={handleBulkStatusUpdate}
      />
      
      {/* 스태프 프로필 모달 */}
      <StaffProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedStaffForProfile(null);
        }}
        staff={selectedStaffForProfile}
        attendanceRecord={selectedStaffForProfile ? getStaffAttendanceStatus(selectedStaffForProfile.id) : undefined}
        workLogRecord={selectedStaffForProfile ? attendanceRecords.find(r => r.staffId === selectedStaffForProfile.id) : undefined}
      />
      
      {/* 일괄 시간 수정 모달 */}
      <BulkTimeEditModal
        isOpen={isBulkTimeEditOpen}
        onClose={() => {
          setIsBulkTimeEditOpen(false);
          resetSelection();
        }}
        selectedStaff={staffData
          .filter(staff => selectedStaff.has(staff.id))
          .map(staff => {
            // 스태프의 날짜를 추출
            const dateString = staff.assignedDate || new Date().toISOString().split('T')[0];
            // 해당 날짜의 workLog 찾기
            const workLogRecord = attendanceRecords.find(r => {
              // staffId가 일치하고
              const staffIdMatch = r.staffId === staff.id || 
                                  r.workLog?.dealerId === staff.id ||
                                  r.workLog?.dealerId === staff.id.replace(/_\d+$/, '');
              // 날짜가 일치하는 경우
              const dateMatch = r.workLog?.date === dateString;
              return staffIdMatch && dateMatch;
            });
            
            return {
              id: staff.id,
              name: staff.name || '이름 미정',
              ...(staff.assignedDate && { assignedDate: staff.assignedDate }),
              ...(staff.assignedTime && { assignedTime: staff.assignedTime }),
              ...(workLogRecord?.workLogId && { workLogId: workLogRecord.workLogId })
            };
          })}
        eventId={jobPosting?.id || 'default-event'}
        onComplete={() => {
          // 실시간 구독으로 자동 업데이트됨
        }}
      />

      {/* 모바일 선택 바 */}
      {multiSelectMode && selectedStaff.size > 0 && canEdit && (isMobile || isTablet) && (
        <MobileSelectionBar
          selectedCount={selectedStaff.size}
          totalCount={staffData.length}
          onSelectAll={() => selectAll(staffData.map(s => s.id))}
          onDeselectAll={deselectAll}
          onBulkEdit={() => setIsBulkTimeEditOpen(true)}
          onBulkStatusChange={() => setIsBulkActionsOpen(true)}
          onCancel={() => {
            deselectAll();
            toggleMultiSelectMode();
          }}
          isAllSelected={isAllSelected(staffData.map(s => s.id))}
        />
      )}
      
      {/* 데스크톱 플로팅 선택 정보 */}
      {multiSelectMode && selectedStaff.size > 0 && canEdit && !isMobile && !isTablet && (
        <div className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-4 z-50 floating-selection-info">
          <span className="font-medium">{selectedStaff.size}명 선택됨</span>
          <button
            onClick={() => setIsBulkTimeEditOpen(true)}
            className="bg-white text-blue-600 px-4 py-1 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            일괄 수정
          </button>
          <button
            onClick={() => {
              deselectAll();
              toggleMultiSelectMode();
            }}
            className="text-white hover:text-blue-200 transition-colors"
            aria-label="선택 취소"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
};

export default StaffManagementTab;