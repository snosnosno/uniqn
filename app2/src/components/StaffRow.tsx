import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { StaffData } from '../hooks/useStaffManagement';
import { useCachedFormatDate, useCachedTimeDisplay, useCachedTimeSlotColor } from '../hooks/useCachedFormatDate';
import AttendanceStatusCard from './AttendanceStatusCard';
import AttendanceStatusPopover from './AttendanceStatusPopover';
import { getTodayString, convertToDateString } from '../utils/jobPosting/dateUtils';

interface StaffRowProps {
  staff: StaffData;
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => any;
  attendanceRecords: any[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate?: boolean; // 날짜 표시 여부 (단일 테이블 모드에서 사용)
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
  canEdit?: boolean; // 수정 권한 여부
  getStaffWorkLog?: (staffId: string, date: string) => any | null;
}

const StaffRow: React.FC<StaffRowProps> = React.memo(({
  staff,
  onEditWorkTime,
  onDeleteStaff,
  getStaffAttendanceStatus,
  attendanceRecords,
  formatTimeDisplay,
  getTimeSlotColor,
  showDate = false,
  onShowProfile,
  eventId,
  canEdit = true,
  getStaffWorkLog
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
    // workLogId 생성 (날짜별 출석 상태 구분을 위해)
    const dateString = convertToDateString(staff.assignedDate) || getTodayString();
    
    // 날짜가 제대로 파싱되었는지 확인
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      console.warn('⚠️ StaffRow - assignedDate 파싱 실패:', {
        staffId: staff.id,
        staffName: staff.name,
        assignedDate: staff.assignedDate,
        parsedDate: dateString
      });
    }
    
    // staffId에서 _숫자 패턴 제거
    const actualStaffId = staff.id.replace(/_\d+$/, '');
    const workLogId = `virtual_${actualStaffId}_${dateString}`;
    
    // workLogId로 출석 상태 가져오기
    const attendanceRecord = getStaffAttendanceStatus(workLogId);
    const workLogRecord = attendanceRecords.find(r => r.staffId === staff.id);
    
    console.log('🔍 StaffRow - 출석 데이터 조회:', {
      staffId: staff.id,
      actualStaffId,
      dateString,
      workLogId,
      hasAttendanceRecord: !!attendanceRecord,
      hasWorkLogRecord: !!workLogRecord
    });
    
    return {
      attendanceRecord,
      workLogRecord,
      workLogId
    };
  }, [staff.id, staff.assignedDate, getStaffAttendanceStatus, attendanceRecords]);

  // 메모이제이션된 출근/퇴근 시간 데이터
  const memoizedTimeData = useMemo(() => {
    // 날짜 추출
    const dateString = convertToDateString(staff.assignedDate) || getTodayString();
    
    // getStaffWorkLog을 사용하여 workLog 데이터 가져오기
    const workLog = getStaffWorkLog ? getStaffWorkLog(staff.id, dateString) : null;
    
    // workLogs의 scheduledStartTime을 우선 사용 (날짜별 개별 시간 관리)
    let scheduledStartTime = staff.assignedTime;
    if (workLog?.scheduledStartTime) {
      try {
        // Timestamp를 시간 문자열로 변환
        const timeDate = workLog.scheduledStartTime.toDate ? workLog.scheduledStartTime.toDate() : new Date(workLog.scheduledStartTime);
        scheduledStartTime = timeDate.toLocaleTimeString('en-US', { 
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
        console.log('🕰️ StaffRow - workLog 시간 변환 성공:', {
          staffId: staff.id,
          date: dateString,
          workLogTime: scheduledStartTime,
          originalStaffTime: staff.assignedTime
        });
      } catch (error) {
        console.warn('workLog scheduledStartTime 변환 오류:', error);
        // 변환 실패시 staff의 assignedTime 사용
      }
    }
    
    // 퇴근시간 - workLogs의 scheduledEndTime도 고려
    let scheduledEndTime = null;
    if (workLog?.scheduledEndTime) {
      try {
        const timeDate = workLog.scheduledEndTime.toDate ? workLog.scheduledEndTime.toDate() : new Date(workLog.scheduledEndTime);
        scheduledEndTime = timeDate.toLocaleTimeString('en-US', { 
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        console.warn('workLog scheduledEndTime 변환 오류:', error);
      }
    }
    
    return {
      displayStartTime: formatTimeDisplay(scheduledStartTime),
      displayEndTime: scheduledEndTime ? formatTimeDisplay(scheduledEndTime) : '미정',
      startTimeColor: getTimeSlotColor(scheduledStartTime),
      endTimeColor: scheduledEndTime ? getTimeSlotColor(scheduledEndTime) : 'bg-gray-100 text-gray-500',
      hasEndTime: !!scheduledEndTime,
      isScheduledTimeTBD: scheduledStartTime === '미정' // 예정시간이 미정인지 여부
    };
  }, [staff.id, staff.assignedTime, staff.assignedDate, formatTimeDisplay, getTimeSlotColor, getStaffWorkLog]);

  // 메모이제이션된 이벤트 핸들러들
  const handleEditStartTime = useCallback(() => {
    onEditWorkTime(staff.id, 'start');
  }, [onEditWorkTime, staff.id]);

  const handleEditEndTime = useCallback(() => {
    // 모든 상태에서 퇴근 시간 수정 가능
    onEditWorkTime(staff.id, 'end');
  }, [onEditWorkTime, staff.id]);


  const handleDeleteStaff = useCallback(async () => {
    await onDeleteStaff(staff.id);
  }, [onDeleteStaff, staff.id]);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* 출근 시간 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <button
          onClick={handleEditStartTime}
          disabled={!canEdit}
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            canEdit ? 'hover:opacity-80' : 'opacity-50 cursor-not-allowed'
          } ${memoizedTimeData.startTimeColor}`}
          title={
            !canEdit
              ? "수정 권한이 없습니다"
              : memoizedTimeData.isScheduledTimeTBD 
                ? "미정 - 출근시간 설정" 
                : "예정 출근시간 수정"
          }
        >
          {memoizedTimeData.isScheduledTimeTBD ? '📋' : '🕘'} {memoizedTimeData.displayStartTime}
        </button>
      </td>
      
      {/* 퇴근 시간 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <button
          onClick={handleEditEndTime}
          disabled={!canEdit}
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            canEdit ? 'hover:opacity-80' : 'opacity-50 cursor-not-allowed'
          } ${memoizedTimeData.endTimeColor} ${!memoizedTimeData.hasEndTime && canEdit ? 'hover:bg-gray-200' : ''}`}
          title={!canEdit ? "수정 권한이 없습니다" : "예정 퇴근시간 수정"}
        >
          {memoizedTimeData.hasEndTime ? '🕕' : '⏳'} {memoizedTimeData.displayEndTime}
        </button>
      </td>
      
      {/* 이름 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div>
          <button
            onClick={() => {
              console.log('🔍 StaffRow 이름 클릭:', staff.id, staff.name);
              console.log('🔍 onShowProfile 함수 존재:', !!onShowProfile);
              if (onShowProfile) {
                onShowProfile(staff.id);
              }
            }}
            className="text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 px-3 py-1 rounded-md border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left inline-block"
          >
            {memoizedStaffData.displayName}
          </button>
          {showDate && staff.assignedDate && (
            <div className="text-sm text-gray-500">
              📅 {formattedDate}
            </div>
          )}
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
        <AttendanceStatusPopover
          workLogId={memoizedAttendanceData.attendanceRecord?.workLogId || memoizedAttendanceData.workLogId}
          currentStatus={memoizedAttendanceData.attendanceRecord?.status || 'not_started'}
          staffId={staff.id}
          staffName={staff.name}
          eventId={eventId}
          size="sm"
          actualStartTime={memoizedAttendanceData.attendanceRecord?.workLog?.actualStartTime || memoizedAttendanceData.workLogRecord?.workLog?.actualStartTime}
          actualEndTime={memoizedAttendanceData.attendanceRecord?.workLog?.actualEndTime || memoizedAttendanceData.workLogRecord?.workLog?.actualEndTime}
          scheduledStartTime={memoizedTimeData.displayStartTime}
          canEdit={canEdit}
          onStatusChange={(newStatus) => {
            console.log('✅ StaffRow - 출석 상태 변경 콜백:', {
              staffId: staff.id,
              newStatus,
              workLogId: memoizedAttendanceData.attendanceRecord?.workLogId
            });
          }}
        />
      </td>
      
      
      {/* 작업 열 */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex space-x-1">
          <button
            onClick={handleDeleteStaff}
            disabled={!canEdit}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              canEdit 
                ? 'text-red-600 hover:text-red-800 hover:bg-red-50' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
            title={canEdit ? "스태프 삭제" : "수정 권한이 없습니다"}
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
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.attendanceRecords.length === nextProps.attendanceRecords.length &&
    // 출석 기록의 변경을 감지하기 위한 간단한 비교
    JSON.stringify(prevProps.attendanceRecords.find(r => r.staffId === prevProps.staff.id)) === 
    JSON.stringify(nextProps.attendanceRecords.find(r => r.staffId === nextProps.staff.id))
  );
});

export default StaffRow;