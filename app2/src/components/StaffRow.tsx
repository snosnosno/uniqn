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
  applyOptimisticUpdate?: (workLogId: string, newStatus: any) => void;
  multiSelectMode?: boolean; // 선택 모드 활성화 여부
  isSelected?: boolean; // 현재 행이 선택되었는지
  onSelect?: (staffId: string) => void; // 선택 핸들러
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
  getStaffWorkLog,
  applyOptimisticUpdate,
  multiSelectMode = false,
  isSelected = false,
  onSelect
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
      // StaffRow - assignedDate 파싱 실패
    }
    
    // staffId에서 _숫자 패턴 제거
    const actualStaffId = staff.id.replace(/_\d+$/, '');
    const workLogId = `virtual_${actualStaffId}_${dateString}`;
    
    // workLogId로 출석 상태 가져오기 - 렌더링 시점마다 새로 호출
    const attendanceRecord = getStaffAttendanceStatus(workLogId);
    
    // 더 정확한 매칭을 위해 여러 방법으로 검색
    let finalAttendanceRecord = attendanceRecord;
    if (!finalAttendanceRecord && eventId) {
      // eventId를 포함한 실제 workLogId로 다시 검색
      const realWorkLogId = `${eventId}_${actualStaffId}_${dateString}`;
      finalAttendanceRecord = getStaffAttendanceStatus(realWorkLogId);
    }
    
    
    // 실제 workLogId 추출 (Firebase에 저장된 형식)
    let realWorkLogId = workLogId; // 기본값은 virtual workLogId
    if (finalAttendanceRecord && finalAttendanceRecord.workLogId) {
      realWorkLogId = finalAttendanceRecord.workLogId; // 실제 Firebase의 workLogId 사용
    } else if (eventId) {
      // attendanceRecord가 없으면 eventId를 포함한 형식으로 생성
      realWorkLogId = `${eventId}_${actualStaffId}_${dateString}`;
    }
    
    return {
      attendanceRecord: finalAttendanceRecord,
      workLogId,
      realWorkLogId, // 실제 Firebase workLogId 추가
      actualStaffId,
      dateString,
      // 강제 리렌더링을 위한 timestamp 추가
      timestamp: Date.now()
    };
  }, [
    staff.id, 
    staff.name,
    staff.assignedDate, 
    getStaffAttendanceStatus, 
    attendanceRecords.length,
    eventId,
    // 해당 스태프의 출석 기록 변화를 더 정확하게 감지
    // attendanceRecords에서 해당 스태프 관련 데이터만 추출하여 비교
    attendanceRecords.filter(r => {
      const staffIdMatch = r.staffId === staff.id || 
                          r.workLog?.dealerId === staff.id ||
                          r.workLog?.dealerId === staff.id.replace(/_\d+$/, '');
      const dateMatch = !staff.assignedDate || r.workLog?.date === (convertToDateString(staff.assignedDate) || getTodayString());
      return staffIdMatch && dateMatch;
    }).map(r => `${r.workLogId}:${r.status}`).join(',')
  ]);

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
      } catch (error) {
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
        // 변환 실패시 fallback
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
  const handleEditStartTime = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 버블링 방지
    
    // 다중 선택 모드에서는 무시
    if (multiSelectMode) {
      console.log('다중 선택 모드에서 시작 시간 클릭 무시됨');
      return;
    }
    
    onEditWorkTime(staff.id, 'start');
  }, [onEditWorkTime, staff.id, multiSelectMode]);

  const handleEditEndTime = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 버블링 방지
    
    // 다중 선택 모드에서는 무시
    if (multiSelectMode) {
      return;
    }
    
    // 모든 상태에서 퇴근 시간 수정 가능
    onEditWorkTime(staff.id, 'end');
  }, [onEditWorkTime, staff.id, multiSelectMode]);


  const handleDeleteStaff = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 버블링 방지
    
    // 다중 선택 모드에서는 무시
    if (multiSelectMode) {
      return;
    }
    
    await onDeleteStaff(staff.id);
  }, [onDeleteStaff, staff.id, multiSelectMode]);

  const handleRowClick = useCallback((event: React.MouseEvent) => {
    // 버튼들이나 다른 클릭 가능한 요소를 클릭한 경우 무시
    const target = event.target as HTMLElement;
    const isButton = target.tagName === 'BUTTON' || target.closest('button');
    const isLink = target.tagName === 'A' || target.closest('a');
    
    if (isButton || isLink) {
      return;
    }
    
    // 선택 모드일 때만 선택 처리
    if (multiSelectMode && onSelect) {
      onSelect(staff.id);
    }
  }, [multiSelectMode, onSelect, staff.id]);

  return (
    <tr 
      className={`transition-all cursor-pointer ${
        multiSelectMode 
          ? isSelected 
            ? 'bg-blue-50 border-2 border-blue-500 hover:bg-blue-100'
            : 'border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          : 'hover:bg-gray-50'
      }`}
      onClick={handleRowClick}
    >
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
            onClick={(e) => {
              e.stopPropagation(); // 이벤트 버블링 방지
              
              // 다중 선택 모드에서는 무시
              if (multiSelectMode) {
                return;
              }
              
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
              <a 
                href={`tel:${staff.phone}`} 
                onClick={(e) => {
                  if (multiSelectMode) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
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
              <a 
                href={`mailto:${staff.email}`} 
                onClick={(e) => {
                  if (multiSelectMode) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
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
      <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => {
        // 다중 선택 모드에서는 AttendanceStatusPopover 클릭 무시
        if (multiSelectMode) {
          e.stopPropagation();
        }
      }}>
        <AttendanceStatusPopover
          workLogId={memoizedAttendanceData.realWorkLogId || memoizedAttendanceData.attendanceRecord?.workLogId || memoizedAttendanceData.workLogId}
          currentStatus={memoizedAttendanceData.attendanceRecord?.status || 'not_started'}
          staffId={staff.id}
          staffName={staff.name || ''}
          eventId={eventId || ''}
          size="sm"
          actualStartTime={(() => {
            // workLog에서 actualStartTime 가져오기
            const dateString = convertToDateString(staff.assignedDate) || getTodayString();
            const workLog = getStaffWorkLog ? getStaffWorkLog(staff.id, dateString) : null;
            return workLog?.actualStartTime || memoizedAttendanceData.attendanceRecord?.workLog?.actualStartTime;
          })()}
          actualEndTime={(() => {
            // workLog에서 actualEndTime 가져오기
            const dateString = convertToDateString(staff.assignedDate) || getTodayString();
            const workLog = getStaffWorkLog ? getStaffWorkLog(staff.id, dateString) : null;
            return workLog?.actualEndTime || memoizedAttendanceData.attendanceRecord?.workLog?.actualEndTime;
          })()}
          scheduledStartTime={memoizedTimeData.displayStartTime}
          scheduledEndTime={memoizedTimeData.displayEndTime}
          canEdit={!!canEdit && !multiSelectMode}
          {...(applyOptimisticUpdate && { applyOptimisticUpdate })}
          onStatusChange={(newStatus) => {
            // 상태 변경 시 강제 리렌더링
            // StaffRow - onStatusChange 호출
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
  const shouldMemoize = (
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
    prevProps.multiSelectMode === nextProps.multiSelectMode &&
    prevProps.isSelected === nextProps.isSelected
  );
  
  if (!shouldMemoize) {
    return false; // 리렌더링 필요
  }
  
  // 날짜 추출
  const { convertToDateString, getTodayString } = require('../utils/jobPosting/dateUtils');
  const dateString = convertToDateString(prevProps.staff.assignedDate) || getTodayString();
  const actualStaffId = prevProps.staff.id.replace(/_\d+$/, '');
  
  // 해당 스태프의 출석 기록 찾기 (더 정확한 매칭)
  const findAttendanceRecord = (records: any[], staffId: string, date: string) => {
    return records.find(r => {
      // staffId 매칭
      const isStaffMatch = r.staffId === staffId || 
                          r.staffId === actualStaffId ||
                          r.workLog?.dealerId === staffId ||
                          r.workLog?.dealerId === actualStaffId;
      
      // 날짜 매칭
      const isDateMatch = r.workLog?.date === date;
      
      // workLogId 매칭 (virtual ID 포함)
      const workLogIdMatch = r.workLogId?.includes(actualStaffId) && r.workLogId?.includes(date);
      
      return isStaffMatch && (isDateMatch || workLogIdMatch);
    });
  };
  
  const prevRecord = findAttendanceRecord(prevProps.attendanceRecords, prevProps.staff.id, dateString);
  const nextRecord = findAttendanceRecord(nextProps.attendanceRecords, nextProps.staff.id, dateString);
  
  // 출석 기록이 변경되었는지 확인
  if (prevRecord?.status !== nextRecord?.status) {
    // StaffRow 리렌더링 - 출석 상태 변경 감지
    return false; // 리렌더링 필요
  }
  
  // workLog의 actualStartTime 또는 actualEndTime 변경 감지
  if (JSON.stringify(prevRecord?.workLog?.actualStartTime) !== JSON.stringify(nextRecord?.workLog?.actualStartTime) ||
      JSON.stringify(prevRecord?.workLog?.actualEndTime) !== JSON.stringify(nextRecord?.workLog?.actualEndTime)) {
    // StaffRow 리렌더링 - 실제 시간 변경 감지
    return false; // 리렌더링 필요
  }
  
  // getStaffWorkLog 함수가 다른 경우 리렌더링 (workLog 데이터 변경 가능성)
  if (prevProps.getStaffWorkLog !== nextProps.getStaffWorkLog) {
    return false;
  }
  
  return true; // 메모이제이션 유지
});

export default StaffRow;