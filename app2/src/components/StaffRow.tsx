import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { StaffData } from '../hooks/useStaffManagement';
import { getExceptionIcon, getExceptionSeverity } from '../utils/attendanceExceptionUtils';
import { useCachedFormatDate, useCachedTimeDisplay, useCachedTimeSlotColor } from '../hooks/useCachedFormatDate';
import AttendanceStatusCard from './AttendanceStatusCard';
import AttendanceStatusDropdown from './AttendanceStatusDropdown';

interface StaffRowProps {
  staff: StaffData;
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onExceptionEdit: (staffId: string) => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => any;
  attendanceRecords: any[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate?: boolean; // 날짜 표시 여부 (단일 테이블 모드에서 사용)
}

const StaffRow: React.FC<StaffRowProps> = React.memo(({
  staff,
  onEditWorkTime,
  onExceptionEdit,
  onDeleteStaff,
  getStaffAttendanceStatus,
  attendanceRecords,
  formatTimeDisplay,
  getTimeSlotColor,
  showDate = false
}) => {
  const { t } = useTranslation();

  // 메모이제이션된 포맷팅 훅 사용
  const formattedDate = useCachedFormatDate(staff.assignedDate);
  const formattedTime = useCachedTimeDisplay(staff.assignedTime, formatTimeDisplay);
  const timeSlotColor = useCachedTimeSlotColor(staff.assignedTime, getTimeSlotColor);

  // 메모이제이션된 기본 스태프 데이터
  const memoizedStaffData = useMemo(() => ({
    displayName: staff.name || '이름 미정',
    avatarInitial: (staff.name || 'U').charAt(0).toUpperCase(),
    roleDisplay: staff.assignedRole || staff.role || '역할 미정',
    hasContact: !!(staff.phone || staff.email)
  }), [staff.id, staff.name, staff.assignedRole, staff.role, staff.phone, staff.email]);

  // 메모이제이션된 출석 관련 데이터
  const memoizedAttendanceData = useMemo(() => {
    const attendanceRecord = getStaffAttendanceStatus(staff.id);
    const exceptionRecord = attendanceRecords.find(r => r.staffId === staff.id);
    
    
    return {
      attendanceRecord,
      exceptionRecord,
      hasException: !!(exceptionRecord?.workLog?.exception),
      exceptionType: exceptionRecord?.workLog?.exception?.type,
      exceptionSeverity: exceptionRecord?.workLog?.exception ? 
        getExceptionSeverity(exceptionRecord.workLog.exception.type) : null
    };
  }, [staff.id, getStaffAttendanceStatus, attendanceRecords]);

  // 메모이제이션된 출근/퇴근 시간 데이터
  const memoizedTimeData = useMemo(() => {
    // 실제 출근시간 우선, 없으면 예정시간
    const actualStartTime = memoizedAttendanceData.attendanceRecord?.checkInTime || 
                           memoizedAttendanceData.exceptionRecord?.workLog?.actualStartTime;
    
    // workLogs의 scheduledStartTime을 우선 사용 (날짜별 개별 시간 관리)
    const workLogScheduledTime = memoizedAttendanceData.attendanceRecord?.workLog?.scheduledStartTime;
    const staffAssignedTime = staff.assignedTime;
    
    // 시간 우선순위: workLogs의 scheduledStartTime > staff의 assignedTime
    let scheduledStartTime = staffAssignedTime;
    if (workLogScheduledTime) {
      try {
        // Timestamp를 시간 문자열로 변환
        const timeDate = workLogScheduledTime.toDate ? workLogScheduledTime.toDate() : new Date(workLogScheduledTime);
        scheduledStartTime = timeDate.toLocaleTimeString('en-US', { 
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        console.warn('workLog scheduledStartTime 변환 오류:', error);
        // 변환 실패시 staff의 assignedTime 사용
      }
    }
    
    // 출근시간 결정: 실제 시간이 있으면 실제 시간, 없으면 예정 시간
    const startTime = actualStartTime || scheduledStartTime;
    
    // 퇴근시간 - workLogs의 scheduledEndTime도 고려
    const actualEndTime = memoizedAttendanceData.attendanceRecord?.checkOutTime || 
                         memoizedAttendanceData.exceptionRecord?.workLog?.actualEndTime;
    
    const workLogScheduledEndTime = memoizedAttendanceData.attendanceRecord?.workLog?.scheduledEndTime;
    let scheduledEndTime = null;
    if (workLogScheduledEndTime) {
      try {
        const timeDate = workLogScheduledEndTime.toDate ? workLogScheduledEndTime.toDate() : new Date(workLogScheduledEndTime);
        scheduledEndTime = timeDate.toLocaleTimeString('en-US', { 
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        console.warn('workLog scheduledEndTime 변환 오류:', error);
      }
    }
    
    const endTime = actualEndTime || scheduledEndTime;
    
    return {
      displayStartTime: formatTimeDisplay(startTime),
      displayEndTime: endTime ? formatTimeDisplay(endTime) : '미정',
      startTimeColor: getTimeSlotColor(startTime),
      endTimeColor: endTime ? getTimeSlotColor(endTime) : 'bg-gray-100 text-gray-500',
      hasEndTime: !!endTime,
      hasActualStartTime: !!actualStartTime, // 실제 출근시간이 있는지 여부
      isScheduledTimeTBD: scheduledStartTime === '미정' // 예정시간이 미정인지 여부
    };
  }, [staff.id, staff.assignedTime, memoizedAttendanceData, formatTimeDisplay, getTimeSlotColor]);

  // 메모이제이션된 이벤트 핸들러들
  const handleEditStartTime = useCallback(() => {
    onEditWorkTime(staff.id, 'start');
  }, [onEditWorkTime, staff.id]);

  const handleEditEndTime = useCallback(() => {
    onEditWorkTime(staff.id, 'end');
  }, [onEditWorkTime, staff.id]);

  const handleExceptionEdit = useCallback(() => {
    onExceptionEdit(staff.id);
  }, [onExceptionEdit, staff.id]);

  const handleDeleteStaff = useCallback(async () => {
    await onDeleteStaff(staff.id);
  }, [onDeleteStaff, staff.id]);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* 출근 시간 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <button
          onClick={handleEditStartTime}
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors hover:opacity-80 ${memoizedTimeData.startTimeColor}`}
          title={
            memoizedTimeData.hasActualStartTime 
              ? "실제 출근시간 수정" 
              : memoizedTimeData.isScheduledTimeTBD 
                ? "미정 - 출근시간 설정" 
                : "예정 출근시간 수정"
          }
        >
          {memoizedTimeData.hasActualStartTime ? '✅' : memoizedTimeData.isScheduledTimeTBD ? '📋' : '🕘'} {memoizedTimeData.displayStartTime}
        </button>
      </td>
      
      {/* 퇴근 시간 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <button
          onClick={handleEditEndTime}
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors hover:opacity-80 ${memoizedTimeData.endTimeColor} ${!memoizedTimeData.hasEndTime ? 'hover:bg-gray-200' : ''}`}
          title="퇴근 시간 수정"
        >
          {memoizedTimeData.hasEndTime ? '🕕' : '⏳'} {memoizedTimeData.displayEndTime}
        </button>
      </td>
      
      {/* 이름 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-8 w-8">
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700">
              {memoizedStaffData.avatarInitial}
            </div>
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">
              {memoizedStaffData.displayName}
            </div>
            {showDate && staff.assignedDate && (
              <div className="text-sm text-gray-500">
                📅 {formattedDate}
              </div>
            )}
          </div>
        </div>
      </td>
      
      {/* 역할 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {memoizedStaffData.roleDisplay}
        </div>
      </td>
      
      {/* 연락처 열 (전화번호 + 이메일 통합) */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900 space-y-1">
          {staff.phone && (
            <div className="flex items-center">
              <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <a href={`tel:${staff.phone}`} className="text-blue-600 hover:text-blue-800 transition-colors">
                {staff.phone}
              </a>
            </div>
          )}
          {staff.email && (
            <div className="flex items-center">
              <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <a href={`mailto:${staff.email}`} className="text-blue-600 hover:text-blue-800 transition-colors">
                {staff.email.length > 20 ? `${staff.email.substring(0, 20)}...` : staff.email}
              </a>
            </div>
          )}
          {!memoizedStaffData.hasContact && (
            <span className="text-gray-400 text-xs">연락처 없음</span>
          )}
        </div>
      </td>
      
      {/* 출석 상태 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        {memoizedAttendanceData.attendanceRecord && memoizedAttendanceData.attendanceRecord.workLogId ? (
          <AttendanceStatusDropdown
            workLogId={memoizedAttendanceData.attendanceRecord.workLogId}
            currentStatus={memoizedAttendanceData.attendanceRecord.status}
            staffId={staff.id}
            staffName={staff.name}
            size="sm"
          />
        ) : (
          <AttendanceStatusCard
            status="not_started"
            size="sm"
          />
        )}
      </td>
      
      {/* 예외 상황 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        {memoizedAttendanceData.hasException ? (
          <div className="flex items-center gap-1">
            <span className={`text-${memoizedAttendanceData.exceptionSeverity === 'high' ? 'red' : memoizedAttendanceData.exceptionSeverity === 'medium' ? 'yellow' : 'orange'}-500`}>
              {getExceptionIcon(memoizedAttendanceData.exceptionType!)}
            </span>
            <span className="text-xs text-gray-600">
              {t(`exceptions.types.${memoizedAttendanceData.exceptionType}`)}
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">정상</span>
        )}
      </td>
      
      {/* 작업 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex space-x-1">
          <button
            onClick={handleExceptionEdit}
            className="px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors"
            title="예외 상황 처리"
          >
            예외
          </button>
          <button
            onClick={handleDeleteStaff}
            className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
            title="스태프 삭제"
          >
            삭제
          </button>
        </div>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수로 불필요한 렌더링 방지
  return (
    prevProps.staff.id === nextProps.staff.id &&
    prevProps.staff.name === nextProps.staff.name &&
    prevProps.staff.assignedTime === nextProps.staff.assignedTime &&
    prevProps.staff.assignedDate === nextProps.staff.assignedDate &&
    prevProps.staff.assignedRole === nextProps.staff.assignedRole &&
    prevProps.staff.role === nextProps.staff.role &&
    prevProps.staff.phone === nextProps.staff.phone &&
    prevProps.staff.email === nextProps.staff.email &&
    prevProps.showDate === nextProps.showDate &&
    prevProps.attendanceRecords.length === nextProps.attendanceRecords.length &&
    // 출석 기록의 변경을 감지하기 위한 간단한 비교
    JSON.stringify(prevProps.attendanceRecords.find(r => r.staffId === prevProps.staff.id)) === 
    JSON.stringify(nextProps.attendanceRecords.find(r => r.staffId === nextProps.staff.id))
  );
});

export default StaffRow;