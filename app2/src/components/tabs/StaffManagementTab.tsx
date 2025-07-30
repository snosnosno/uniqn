import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';

import { useAttendanceStatus } from '../../hooks/useAttendanceStatus';
import { useResponsive } from '../../hooks/useResponsive';
import { useStaffManagement, StaffData } from '../../hooks/useStaffManagement';
import { useVirtualization } from '../../hooks/useVirtualization';
import { usePerformanceMetrics } from '../../hooks/usePerformanceMetrics';
import { parseToDate, getTodayString } from '../../utils/jobPosting/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
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

interface StaffManagementTabProps {
  jobPosting?: any;
}

const StaffManagementTab: React.FC<StaffManagementTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { isMobile, isTablet } = useResponsive();
  const { currentUser } = useAuth();
  const { showError } = useToast();
  
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
    enableGrouping: true,
    enableFiltering: true
  });

  // 출석 상태 관리
  const { 
    attendanceRecords,
    getStaffAttendanceStatus,
    loading: attendanceLoading,
    applyOptimisticUpdate
  } = useAttendanceStatus({
    eventId: jobPosting?.id || 'default-event'
    // date 파라미터 제거 - 모든 날짜의 workLog를 가져옴
  });
  
  // 모달 상태
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isWorkTimeEditorOpen, setIsWorkTimeEditorOpen] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState<any | null>(null);
  const [currentTimeType, setCurrentTimeType] = useState<'start' | 'end' | undefined>(undefined);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedStaffForProfile, setSelectedStaffForProfile] = useState<StaffData | null>(null);
  
  // 선택 모드 상태
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [isBulkTimeEditOpen, setIsBulkTimeEditOpen] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  
  // 성능 모니터링 상태 (개발 환경에서만)
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const { registerComponentMetrics } = usePerformanceMetrics();
  
  // 권한 체크 - 공고 작성자만 수정 가능
  const canEdit = currentUser?.uid && currentUser.uid === jobPosting?.createdBy;

  // 출퇴근 시간 수정 핸들러 (다중 날짜 지원)
  const handleEditWorkTime = (staffId: string, timeType?: 'start' | 'end', targetDate?: string) => {
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
    
    // 해당 날짜의 workLog 찾기
    const workLog = attendanceRecords.find(record => 
      record.workLog?.eventId === (jobPosting?.id || 'default-event') && 
      record.staffId === staffId &&
      record.workLog?.date === workDate
    );
    
    if (workLog && workLog.workLog) {
      setSelectedWorkLog(workLog.workLog);
      setCurrentTimeType(timeType);
      setIsWorkTimeEditorOpen(true);
    } else {
      // 해당 날짜의 가상 WorkLog 생성
      const virtualWorkLog = {
        id: `virtual_${staffId}_${workDate}`,
        eventId: jobPosting?.id || 'default-event',
        staffId: staffId,  // 호환성을 위해 유지
        dealerId: staffId, // dealerId도 추가
        date: workDate,
        scheduledStartTime: staff.assignedTime && staff.assignedTime !== '미정' ? (() => {
          try {
            const timeParts = staff.assignedTime.split(':');
            if (timeParts.length !== 2) {
              return null;
            }
            
            const [hours, minutes] = timeParts.map(Number);
            
            // 유효하지 않은 시간 값 검사
            if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              return null;
            }
            
            // parseToDate를 사용하여 workDate를 Date로 변환
            let date = parseToDate(workDate);
            if (!date) {
              date = new Date();
            }
            
            date.setHours(hours, minutes, 0, 0);
            
            // 최종 날짜가 유효한지 확인
            if (isNaN(date.getTime())) {
              return null;
            }
            
            return Timestamp.fromDate(date);
          } catch (error) {
            return null;
          }
        })() : null,
        scheduledEndTime: null,
        actualStartTime: null,
        actualEndTime: null
      };
      
      setSelectedWorkLog(virtualWorkLog);
      setCurrentTimeType(timeType);
      setIsWorkTimeEditorOpen(true);
    }
  };
  
  const handleWorkTimeUpdate = async (updatedWorkLog: any) => {
    // 실시간 구독으로 자동 업데이트되므로 별도 새로고침 불필요
    // useStaffManagement와 useAttendanceStatus 모두 실시간 구독 중
    // 성공 메시지는 WorkTimeEditor 내부에서 처리
  };
  

  // 필터링된 데이터 계산
  const flattenedStaffData = Object.values(groupedStaffData.grouped).flat();
  const filteredStaffCount = flattenedStaffData.length;
  const selectedStaffData = staffData.filter(staff => selectedStaff.has(staff.id));

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
  
  // 키보드 단축키 처리
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ctrl+A: 전체 선택 (선택 모드일 때만)
    if (event.ctrlKey && event.key === 'a' && multiSelectMode) {
      event.preventDefault();
      const allStaffIds = new Set(filteredStaffCount > 0 ? flattenedStaffData.map(s => s.id) : []);
      setSelectedStaff(allStaffIds);
    }
    
    // Esc: 선택 모드 종료
    if (event.key === 'Escape' && multiSelectMode) {
      setMultiSelectMode(false);
      setSelectedStaff(new Set());
    }
  }, [multiSelectMode, filteredStaffCount, flattenedStaffData]);

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    if (multiSelectMode) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [multiSelectMode, handleKeyDown]);

  // 모바일 관련 핸들러
  const handleMultiSelectToggle = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedStaff(new Set());
  };
  
  const handleStaffSelect = (staffId: string, event?: React.MouseEvent) => {
    const currentIndex = flattenedStaffData.findIndex(s => s.id === staffId);
    
    if (event?.shiftKey && lastSelectedIndex !== null && currentIndex !== -1) {
      // Shift 키를 누른 상태로 클릭 - 범위 선택
      const newSelected = new Set(selectedStaff);
      const start = Math.min(lastSelectedIndex, currentIndex);
      const end = Math.max(lastSelectedIndex, currentIndex);
      
      for (let i = start; i <= end; i++) {
        const staffItem = flattenedStaffData[i];
        if (staffItem) {
          newSelected.add(staffItem.id);
        }
      }
      
      setSelectedStaff(newSelected);
    } else {
      // 일반 클릭 - 개별 선택/해제
      const newSelected = new Set(selectedStaff);
      if (newSelected.has(staffId)) {
        newSelected.delete(staffId);
      } else {
        newSelected.add(staffId);
      }
      setSelectedStaff(newSelected);
      setLastSelectedIndex(currentIndex);
    }
  };
  
  const handleBulkActions = () => {
    setIsBulkActionsOpen(true);
  };
  
  const handleBulkDelete = async (staffIds: string[]) => {
    // 순차적으로 삭제 (병렬 처리시 충돌 가능성)
    for (const staffId of staffIds) {
      await deleteStaff(staffId);
    }
    setSelectedStaff(new Set());
    setMultiSelectMode(false);
  };
  
  const handleBulkMessage = async (staffIds: string[], message: string) => {
    // TODO: 실제 메시지 발송 구현
    alert(`${staffIds.length}명에게 메시지를 발송했습니다: "${message}"`);
  };
  
  const handleBulkStatusUpdate = async (staffIds: string[], status: string) => {
    // TODO: 실제 상태 업데이트 구현
    alert(`${staffIds.length}명의 상태를 "${status}"로 변경했습니다.`);
  };
  
  // 프로필 모달 핸들러
  const handleShowProfile = (staffId: string) => {
    const staff = staffData.find(s => s.id === staffId);
    if (staff) {
      setSelectedStaffForProfile(staff);
      setIsProfileModalOpen(true);
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
        onMetricsUpdate={(metrics) => {
          registerComponentMetrics(
            'StaffManagementTab',
            metrics.lastRenderTime,
            metrics.virtualizationActive,
            metrics.totalItems,
            metrics.visibleItems
          );
        }}
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
                    title={multiSelectMode ? 'Esc 키로 선택 모드 종료' : '스태프를 선택하여 일괄 수정'}
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
                        const allStaffIds = new Set(staffData.map(staff => staff.id));
                        setSelectedStaff(allStaffIds);
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

        {/* 선택 모드 활성화 시 키보드 단축키 안내 */}
        {multiSelectMode && !isMobile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-blue-800">
                <strong>단축키:</strong> Ctrl+A (전체 선택), Shift+클릭 (범위 선택), Esc (선택 모드 종료)
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
                        showDate={true}
                        isSelected={multiSelectMode ? selectedStaff.has(staff.id) : false}
                        {...(multiSelectMode && { onSelect: handleStaffSelect })}
                        onShowProfile={handleShowProfile}
                        eventId={jobPosting?.id}
                        canEdit={!!canEdit}
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
                                <input
                                  type="checkbox"
                                  checked={selectedStaff.size === flattenedStaffData.length && flattenedStaffData.length > 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStaff(new Set(flattenedStaffData.map(s => s.id)));
                                    } else {
                                      setSelectedStaff(new Set());
                                    }
                                  }}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  aria-label="전체 선택"
                                />
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
                            <StaffRow
                              key={staff.id}
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
          setCurrentTimeType(undefined);
        }}
        workLog={selectedWorkLog}
        onUpdate={handleWorkTimeUpdate}
        {...(currentTimeType && { timeType: currentTimeType })}
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
          setSelectedStaff(new Set());
          setMultiSelectMode(false);
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

      {/* 플로팅 선택 정보 */}
      {multiSelectMode && selectedStaff.size > 0 && canEdit && (
        <div className={`fixed ${isMobile ? 'bottom-20 right-4' : 'bottom-6 right-6'} bg-blue-600 text-white px-4 py-2 md:px-6 md:py-3 rounded-full shadow-lg flex items-center space-x-3 md:space-x-4 z-50`}>
          <span className="font-medium text-sm md:text-base">{selectedStaff.size}명 선택됨</span>
          <button
            onClick={() => setIsBulkTimeEditOpen(true)}
            className="bg-white text-blue-600 px-3 py-0.5 md:px-4 md:py-1 rounded-full text-xs md:text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            일괄 수정
          </button>
          <button
            onClick={() => {
              setSelectedStaff(new Set());
              setMultiSelectMode(false);
            }}
            className="text-white hover:text-blue-200 transition-colors"
            aria-label="선택 취소"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
};

export default StaffManagementTab;