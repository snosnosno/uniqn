import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';

import { useAttendanceStatus } from '../../hooks/useAttendanceStatus';
import { useResponsive } from '../../hooks/useResponsive';
import { useStaffManagement, StaffData } from '../../hooks/useStaffManagement';
import { useVirtualization } from '../../hooks/useVirtualization';
import { usePerformanceMetrics } from '../../hooks/usePerformanceMetrics';
import { parseToDate } from '../../utils/jobPosting/dateUtils';
import BulkActionsModal from '../BulkActionsModal';
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
    getTimeSlotColor
  } = useStaffManagement({
    jobPostingId: jobPosting?.id,
    enableGrouping: true,
    enableFiltering: true
  });

  // 출석 상태 관리
  const { 
    attendanceRecords,
    getStaffAttendanceStatus 
  } = useAttendanceStatus({
    eventId: jobPosting?.id || 'default-event',
    date: new Date().toISOString().split('T')[0] || ''
  });
  
  // 모달 상태
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isWorkTimeEditorOpen, setIsWorkTimeEditorOpen] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState<any | null>(null);
  const [currentTimeType, setCurrentTimeType] = useState<'start' | 'end' | undefined>(undefined);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedStaffForProfile, setSelectedStaffForProfile] = useState<StaffData | null>(null);
  
  // 모바일 전용 상태
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  
  // 성능 모니터링 상태 (개발 환경에서만)
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const { registerComponentMetrics } = usePerformanceMetrics();
  
  // 출퇴근 시간 수정 핸들러 (다중 날짜 지원)
  const handleEditWorkTime = (staffId: string, timeType?: 'start' | 'end', targetDate?: string) => {
    const staff = staffData.find(s => s.id === staffId);
    if (!staff) {
      console.log('스태프 정보를 찾을 수 없습니다.');
      return;
    }

    // 대상 날짜 결정: 파라미터로 받은 날짜 또는 스태프의 assignedDate 또는 오늘 날짜
    const workDate = targetDate || staff.assignedDate || new Date().toISOString().split('T')[0];
    
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
              console.error('Invalid assignedTime format:', staff.assignedTime);
              return null;
            }
            
            const [hours, minutes] = timeParts.map(Number);
            
            // 유효하지 않은 시간 값 검사
            if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              console.error('Invalid assignedTime values:', { hours, minutes, original: staff.assignedTime });
              return null;
            }
            
            // parseToDate를 사용하여 workDate를 Date로 변환
            let date = parseToDate(workDate);
            if (!date) {
              console.error('Invalid workDate, using current date:', workDate);
              date = new Date();
            }
            
            date.setHours(hours, minutes, 0, 0);
            
            // 최종 날짜가 유효한지 확인
            if (isNaN(date.getTime())) {
              console.error('Invalid final date created:', date);
              return null;
            }
            
            return Timestamp.fromDate(date);
          } catch (error) {
            console.error('Error creating scheduledStartTime:', error);
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
    console.log('✅ 근무 시간이 업데이트되었습니다:', updatedWorkLog);
    
    // 실시간 구독으로 자동 업데이트되므로 별도 새로고침 불필요
    // useStaffManagement와 useAttendanceStatus 모두 실시간 구독 중
    console.log('🔄 실시간 구독으로 자동 업데이트됩니다');
    
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
  
  // 모바일 관련 핸들러
  const handleMultiSelectToggle = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedStaff(new Set());
  };
  
  const handleStaffSelect = (staffId: string) => {
    const newSelected = new Set(selectedStaff);
    if (newSelected.has(staffId)) {
      newSelected.delete(staffId);
    } else {
      newSelected.add(staffId);
    }
    setSelectedStaff(newSelected);
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
    // 실제 구현에서는 메시지 발송 로직 추가
    console.log('Bulk message:', { staffIds, message });
    // TODO: 실제 메시지 발송 구현
    alert(`${staffIds.length}명에게 메시지를 발송했습니다: "${message}"`);
  };
  
  const handleBulkStatusUpdate = async (staffIds: string[], status: string) => {
    // 실제 구현에서는 출석 상태 업데이트 로직 추가
    console.log('Bulk status update:', { staffIds, status });
    // TODO: 실제 상태 업데이트 구현
    alert(`${staffIds.length}명의 상태를 "${status}"로 변경했습니다.`);
  };
  
  // 프로필 모달 핸들러
  const handleShowProfile = (staffId: string) => {
    console.log('🔍 프로필 클릭:', staffId);
    const staff = staffData.find(s => s.id === staffId);
    console.log('🔍 스태프 데이터:', staff);
    if (staff) {
      setSelectedStaffForProfile(staff);
      setIsProfileModalOpen(true);
      console.log('🔍 프로필 모달 열기 설정 완료');
    } else {
      console.log('⚠️ 스태프를 찾을 수 없음:', staffId);
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
                  <button
                    onClick={handleBulkActions}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    일괄 작업 ({selectedStaff.size})
                  </button>
                )}
              </div>
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
                        onSelect={multiSelectMode ? handleStaffSelect : undefined}
                        onShowProfile={handleShowProfile}
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
                  />
                ) : (
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
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
        timeType={currentTimeType}
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
    </>
  );
};

export default StaffManagementTab;