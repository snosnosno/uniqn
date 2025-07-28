import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { Timestamp } from 'firebase/firestore';

import { useAttendanceStatus } from '../../hooks/useAttendanceStatus';
import { useResponsive } from '../../hooks/useResponsive';
import { useStaffManagement } from '../../hooks/useStaffManagement';
import { useVirtualization } from '../../hooks/useVirtualization';
import { usePerformanceMetrics } from '../../hooks/usePerformanceMetrics';
import { parseToDate } from '../../utils/jobPosting/dateUtils';
import { AttendanceExceptionHandler } from '../AttendanceExceptionHandler';
import BulkActionsModal from '../BulkActionsModal';
import PerformanceMonitor from '../PerformanceMonitor';
import PerformanceDashboard from '../PerformanceDashboard';
import QRCodeGeneratorModal from '../QRCodeGeneratorModal';
import StaffCard from '../StaffCard';
import StaffDateGroup from '../StaffDateGroup';
import StaffDateGroupMobile from '../StaffDateGroupMobile';
import StaffFilters from '../StaffFilters';
import StaffFiltersMobile from '../StaffFiltersMobile';
import StaffRow from '../StaffRow';
import VirtualizedStaffList from '../VirtualizedStaffList';
import VirtualizedStaffTable from '../VirtualizedStaffTable';
import WorkTimeEditor from '../WorkTimeEditor';

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
    availableDates,
    availableRoles,
    loading,
    error,
    filters,
    setFilters,
    expandedDates,
    groupByDate,
    setGroupByDate,
    deleteStaff,
    refreshStaffData,
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
  const [selectedExceptionWorkLog, setSelectedExceptionWorkLog] = useState<any | null>(null);
  
  // 모바일 전용 상태
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  
  // 성능 모니터링 상태 (개발 환경에서만)
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const { registerComponentMetrics } = usePerformanceMetrics();
  
  // 출퇴근 시간 수정 핸들러 (다중 날짜 지원)
  const handleEditWorkTime = (staffId: string, targetDate?: string) => {
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
      setIsWorkTimeEditorOpen(true);
    } else {
      // 해당 날짜의 가상 WorkLog 생성
      const virtualWorkLog = {
        id: `virtual_${staffId}_${workDate}`,
        eventId: jobPosting?.id || 'default-event',
        staffId: staffId,
        date: workDate,
        scheduledStartTime: staff.assignedTime ? (() => {
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
      setIsWorkTimeEditorOpen(true);
    }
  };
  
  const handleWorkTimeUpdate = async (updatedWorkLog: any) => {
    console.log('근무 시간이 업데이트되었습니다:', updatedWorkLog);
    
    // 스태프 데이터 새로고침하여 시간 열 업데이트
    try {
      await refreshStaffData();
      console.log('스태프 데이터 새로고침 완료');
    } catch (error) {
      console.error('스태프 데이터 새로고침 오류:', error);
    }
    
    // 성공 메시지는 WorkTimeEditor 내부에서 처리
  };
  
  // 예외 상황 처리 함수
  const handleExceptionEdit = (staffId: string) => {
    const workLog = attendanceRecords.find(record => 
      record.workLog?.eventId === (jobPosting?.id || 'default-event') && 
      record.staffId === staffId &&
      record.workLog?.date === new Date().toISOString().split('T')[0]
    );
    
    if (workLog?.workLog) {
      setSelectedExceptionWorkLog(workLog.workLog);
    }
  };
  
  const handleExceptionUpdate = (updatedWorkLog: any) => {
    console.log('예외 상황이 업데이트되었습니다:', updatedWorkLog);
    setSelectedExceptionWorkLog(null);
    // 성공 메시지는 AttendanceExceptionHandler 내부에서 처리
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
        </div>

        {error && (
          <div className="bg-red-50 p-4 rounded-lg mb-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* 필터 컴포넌트 */}
        {(isMobile || isTablet) ? (
          <StaffFiltersMobile
            filters={filters}
            onFiltersChange={setFilters}
            availableDates={availableDates}
            availableRoles={availableRoles}
            groupByDate={groupByDate}
            onGroupByDateChange={setGroupByDate}
            onQRCodeClick={() => setIsQrModalOpen(true)}
            totalStaffCount={staffData.length}
            filteredStaffCount={filteredStaffCount}
            multiSelectMode={multiSelectMode}
            onMultiSelectToggle={handleMultiSelectToggle}
            selectedCount={selectedStaff.size}
            onBulkActions={handleBulkActions}
          />
        ) : (
          <StaffFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableDates={availableDates}
            availableRoles={availableRoles}
            groupByDate={groupByDate}
            onGroupByDateChange={setGroupByDate}
            onQRCodeClick={() => setIsQrModalOpen(true)}
            totalStaffCount={staffData.length}
            filteredStaffCount={filteredStaffCount}
          />
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
                      onExceptionEdit={handleExceptionEdit}
                      onDeleteStaff={deleteStaff}
                      getStaffAttendanceStatus={getStaffAttendanceStatus}
                      attendanceRecords={attendanceRecords}
                      formatTimeDisplay={formatTimeDisplay}
                      getTimeSlotColor={getTimeSlotColor}
                      selectedStaff={selectedStaff}
                      onStaffSelect={handleStaffSelect}
                      multiSelectMode={multiSelectMode}
                    />
                  );
                })
              ) : (
                // 모바일 단일 카드 리스트 (가상화 적용)
                mobileVirtualization.shouldVirtualize ? (
                  <VirtualizedStaffList
                    staffList={flattenedStaffData}
                    onEditWorkTime={handleEditWorkTime}
                    onExceptionEdit={handleExceptionEdit}
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
                  />
                ) : (
                  <div className="space-y-3">
                    {flattenedStaffData.map((staff) => (
                      <StaffCard
                        key={staff.id}
                        staff={staff}
                        onEditWorkTime={handleEditWorkTime}
                        onExceptionEdit={handleExceptionEdit}
                        onDeleteStaff={deleteStaff}
                        getStaffAttendanceStatus={getStaffAttendanceStatus}
                        attendanceRecords={attendanceRecords}
                        formatTimeDisplay={formatTimeDisplay}
                        getTimeSlotColor={getTimeSlotColor}
                        showDate={true}
                        isSelected={multiSelectMode ? selectedStaff.has(staff.id) : false}
                        onSelect={multiSelectMode ? handleStaffSelect : undefined}
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
                      onExceptionEdit={handleExceptionEdit}
                      onDeleteStaff={deleteStaff}
                      getStaffAttendanceStatus={getStaffAttendanceStatus}
                      attendanceRecords={attendanceRecords}
                      formatTimeDisplay={formatTimeDisplay}
                      getTimeSlotColor={getTimeSlotColor}
                    />
                  );
                })
              ) : (
                // 데스크톱 단일 테이블 보기 (가상화 적용)
                desktopVirtualization.shouldVirtualize ? (
                  <VirtualizedStaffTable
                    staffList={flattenedStaffData}
                    onEditWorkTime={handleEditWorkTime}
                    onExceptionEdit={handleExceptionEdit}
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
                              시간
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
                              예외
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
                              onExceptionEdit={handleExceptionEdit}
                              onDeleteStaff={deleteStaff}
                              getStaffAttendanceStatus={getStaffAttendanceStatus}
                              attendanceRecords={attendanceRecords}
                              formatTimeDisplay={formatTimeDisplay}
                              getTimeSlotColor={getTimeSlotColor}
                              showDate={true}
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
        onClose={() => setIsWorkTimeEditorOpen(false)}
        workLog={selectedWorkLog}
        onUpdate={handleWorkTimeUpdate}
      />

      {/* 예외 상황 처리 모달 */}
      {selectedExceptionWorkLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('exceptions.title', '예외 상황 처리')}</h3>
              <button
                onClick={() => setSelectedExceptionWorkLog(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            
            <AttendanceExceptionHandler
              workLog={selectedExceptionWorkLog}
              onExceptionUpdated={handleExceptionUpdate}
            />
          </div>
        </div>
      )}

      {/* 일괄 작업 모달 */}
      <BulkActionsModal
        isOpen={isBulkActionsOpen}
        onClose={() => setIsBulkActionsOpen(false)}
        selectedStaff={selectedStaffData}
        onBulkDelete={handleBulkDelete}
        onBulkMessage={handleBulkMessage}
        onBulkStatusUpdate={handleBulkStatusUpdate}
      />
    </>
  );
};

export default StaffManagementTab;