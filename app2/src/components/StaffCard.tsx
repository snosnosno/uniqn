import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useSwipeGestureReact } from '../hooks/useSwipeGesture';
import { useCachedFormatDate, useCachedTimeDisplay, useCachedTimeSlotColor } from '../hooks/useCachedFormatDate';
import { StaffData } from '../hooks/useStaffManagement';
import { getExceptionIcon, getExceptionSeverity } from '../utils/attendanceExceptionUtils';
import { parseToDate } from '../utils/jobPosting/dateUtils';
import AttendanceStatusCard from './AttendanceStatusCard';
import AttendanceStatusDropdown from './AttendanceStatusDropdown';

interface StaffCardProps {
  staff: StaffData;
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onExceptionEdit: (staffId: string) => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => any;
  attendanceRecords: any[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate?: boolean;
  isSelected?: boolean;
  onSelect?: (staffId: string) => void;
}

const StaffCard: React.FC<StaffCardProps> = React.memo(({
  staff,
  onEditWorkTime,
  onExceptionEdit,
  onDeleteStaff,
  getStaffAttendanceStatus,
  attendanceRecords,
  formatTimeDisplay,
  getTimeSlotColor,
  showDate = false,
  isSelected = false,
  onSelect
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  // 햅틱 피드백과 스와이프 제스처
  const { lightImpact, mediumImpact, selectionFeedback } = useHapticFeedback();

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
        console.warn('StaffCard workLog scheduledStartTime 변환 오류:', error);
        // 변환 실패시 staff의 assignedTime 사용
      }
    }
    
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
        console.warn('StaffCard workLog scheduledEndTime 변환 오류:', error);
      }
    }
    
    const endTime = actualEndTime || scheduledEndTime;
    
    return {
      displayStartTime: formatTimeDisplay(startTime),
      displayEndTime: endTime ? formatTimeDisplay(endTime) : '미정',
      startTimeColor: getTimeSlotColor(startTime),
      endTimeColor: endTime ? getTimeSlotColor(endTime) : 'bg-gray-100 text-gray-500',
      hasEndTime: !!endTime
    };
  }, [staff.id, staff.assignedTime, memoizedAttendanceData, formatTimeDisplay, getTimeSlotColor]);
  
  // 메모이제이션된 이벤트 핸들러들
  const handleCardClick = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleSelectClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      selectionFeedback();
      onSelect(staff.id);
    }
  }, [onSelect, staff.id, selectionFeedback]);

  const handleActionClick = useCallback((e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    lightImpact();
    action();
  }, [lightImpact]);

  const toggleActions = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    mediumImpact();
    setShowActions(prev => !prev);
  }, [mediumImpact]);

  // 스와이프 핸들러들
  const handleSwipeLeft = useCallback(() => {
    mediumImpact();
    setShowActions(true);
  }, [mediumImpact]);

  const handleSwipeRight = useCallback(() => {
    if (showActions) {
      lightImpact();
      setShowActions(false);
    } else if (onSelect) {
      selectionFeedback();
      onSelect(staff.id);
    }
  }, [showActions, onSelect, staff.id, lightImpact, selectionFeedback]);

  const swipeGesture = useSwipeGestureReact({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    minDistance: 50,
    threshold: 30
  });

  return (
    <div 
      className={`bg-white rounded-lg shadow-md border-2 transition-all duration-200 ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      } ${isExpanded ? 'shadow-lg' : 'shadow-md'} hover:shadow-lg active:scale-[0.98] touch-none select-none`}
      onClick={handleCardClick}
      {...swipeGesture}
    >
      {/* 카드 헤더 */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* 선택 체크박스 (다중 선택 모드일 때) */}
            {onSelect && (
              <div onClick={handleSelectClick} className="flex-shrink-0">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            )}
            
            {/* 아바타 */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-md">
                <span className="text-white font-semibold text-lg">
                  {memoizedStaffData.avatarInitial}
                </span>
              </div>
            </div>
            
            {/* 기본 정보 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {memoizedStaffData.displayName}
                </h3>
                <div className="flex items-center space-x-1">
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${memoizedTimeData.startTimeColor}`}>
                    🕘 {memoizedTimeData.displayStartTime}
                  </div>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${memoizedTimeData.endTimeColor}`}>
                    {memoizedTimeData.hasEndTime ? '🕕' : '⏳'} {memoizedTimeData.displayEndTime}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-600">
                  {memoizedStaffData.roleDisplay}
                </span>
                {showDate && staff.assignedDate && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-500">
                      📅 {formattedDate}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* 빠른 상태 및 액션 */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* 출석 상태 */}
            <div className="transform scale-90">
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
            </div>
            
            {/* 예외 상태 표시 */}
            {memoizedAttendanceData.hasException && (
              <div className="flex items-center">
                <span className={`text-lg ${
                  memoizedAttendanceData.exceptionSeverity === 'high' ? 'text-red-500' : 
                  memoizedAttendanceData.exceptionSeverity === 'medium' ? 'text-yellow-500' : 'text-orange-500'
                }`}>
                  {getExceptionIcon(memoizedAttendanceData.exceptionType!)}
                </span>
              </div>
            )}
            
            {/* 액션 메뉴 버튼 */}
            <button
              onClick={toggleActions}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {/* 확장/축소 아이콘 */}
            <div className="text-gray-400">
              <svg className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* 스와이프 인디케이터 */}
        {!showActions && onSelect && (
          <div className="mt-2 flex items-center justify-center text-xs text-gray-400">
            <span className="flex items-center space-x-1">
              <span>←</span>
              <span>액션</span>
              <span className="mx-2">•</span>
              <span>선택</span>
              <span>→</span>
            </span>
          </div>
        )}

        {/* 액션 메뉴 */}
        {showActions && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>스와이프 액션</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightImpact();
                  setShowActions(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={(e) => handleActionClick(e, () => onEditWorkTime(staff.id, 'start'))}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                출근
              </button>
              <button
                onClick={(e) => handleActionClick(e, () => onEditWorkTime(staff.id, 'end'))}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                퇴근
              </button>
              <button
                onClick={(e) => handleActionClick(e, () => onExceptionEdit(staff.id))}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                예외 처리
              </button>
              <button
                onClick={(e) => handleActionClick(e, () => onDeleteStaff(staff.id))}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 확장된 세부 정보 */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="space-y-4">
            {/* 연락처 정보 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">연락처 정보</h4>
              <div className="space-y-2">
                {staff.phone && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      <span className="text-sm text-gray-600">{staff.phone}</span>
                    </div>
                    <a
                      href={`tel:${staff.phone}`}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      통화
                    </a>
                  </div>
                )}
                {staff.email && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      <span className="text-sm text-gray-600 truncate">{staff.email}</span>
                    </div>
                    <a
                      href={`mailto:${staff.email}`}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors flex-shrink-0 ml-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      메일
                    </a>
                  </div>
                )}
                {!memoizedStaffData.hasContact && (
                  <div className="text-sm text-gray-400 italic">연락처 정보가 없습니다</div>
                )}
              </div>
            </div>
            
            {/* 출석 세부 정보 */}
            {memoizedAttendanceData.attendanceRecord && (memoizedAttendanceData.attendanceRecord.checkInTime || memoizedAttendanceData.attendanceRecord.checkOutTime) && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">출석 세부 정보</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {memoizedAttendanceData.attendanceRecord.checkInTime && (
                    <div>
                      <span className="text-gray-500">출근 시간</span>
                      <div className="font-medium text-gray-900">
                        {memoizedAttendanceData.attendanceRecord.checkInTime}
                      </div>
                    </div>
                  )}
                  {memoizedAttendanceData.attendanceRecord.checkOutTime && (
                    <div>
                      <span className="text-gray-500">퇴근 시간</span>
                      <div className="font-medium text-gray-900">
                        {memoizedAttendanceData.attendanceRecord.checkOutTime}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 예외 상황 세부 정보 */}
            {memoizedAttendanceData.hasException && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">예외 상황</h4>
                <div className="flex items-center space-x-2 text-sm">
                  <span className={`text-lg ${
                    memoizedAttendanceData.exceptionSeverity === 'high' ? 'text-red-500' : 
                    memoizedAttendanceData.exceptionSeverity === 'medium' ? 'text-yellow-500' : 'text-orange-500'
                  }`}>
                    {getExceptionIcon(memoizedAttendanceData.exceptionType!)}
                  </span>
                  <span className="text-gray-700">
                    {t(`exceptions.types.${memoizedAttendanceData.exceptionType}`)}
                  </span>
                </div>
                {memoizedAttendanceData.exceptionRecord?.workLog?.exception?.description && (
                  <div className="mt-1 text-sm text-gray-600">
                    {memoizedAttendanceData.exceptionRecord.workLog.exception.description}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수로 불필요한 렌더링 방지
  // 핵심 props가 변경되지 않았다면 리렌더링하지 않음
  return (
    prevProps.staff.id === nextProps.staff.id &&
    prevProps.staff.name === nextProps.staff.name &&
    prevProps.staff.assignedTime === nextProps.staff.assignedTime &&
    prevProps.staff.assignedDate === nextProps.staff.assignedDate &&
    prevProps.staff.assignedRole === nextProps.staff.assignedRole &&
    prevProps.staff.role === nextProps.staff.role &&
    prevProps.staff.phone === nextProps.staff.phone &&
    prevProps.staff.email === nextProps.staff.email &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showDate === nextProps.showDate &&
    prevProps.attendanceRecords.length === nextProps.attendanceRecords.length &&
    // 출석 기록의 변경을 감지하기 위한 간단한 비교
    JSON.stringify(prevProps.attendanceRecords.find(r => r.staffId === prevProps.staff.id)) === 
    JSON.stringify(nextProps.attendanceRecords.find(r => r.staffId === nextProps.staff.id))
  );
});

export default StaffCard;