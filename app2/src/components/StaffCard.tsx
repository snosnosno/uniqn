import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';

import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useSwipeGestureReact } from '../hooks/useSwipeGesture';
import { useCachedFormatDate, useCachedTimeDisplay, useCachedTimeSlotColor } from '../hooks/useCachedFormatDate';
import { StaffData } from '../hooks/useStaffManagement';
import AttendanceStatusPopover from './AttendanceStatusPopover';
import { timestampToLocalDateString } from '../utils/dateUtils';
import { getTodayString } from '../utils/jobPosting/dateUtils';

// 분리된 컴포넌트들 import
import StaffCardHeader from './staff/StaffCardHeader';
import StaffCardTimeSection from './staff/StaffCardTimeSection';
import StaffCardActions from './staff/StaffCardActions';
import StaffCardContactInfo from './staff/StaffCardContactInfo';

interface StaffCardProps {
  staff: StaffData;
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => any;
  attendanceRecords: any[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate?: boolean;
  isSelected?: boolean;
  onSelect?: (staffId: string) => void;
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
  canEdit?: boolean;
  getStaffWorkLog?: (staffId: string, date: string) => any | null;
  multiSelectMode?: boolean;
}

const StaffCard: React.FC<StaffCardProps> = React.memo(({
  staff,
  onEditWorkTime,
  onDeleteStaff,
  getStaffAttendanceStatus,
  attendanceRecords,
  formatTimeDisplay,
  getTimeSlotColor,
  showDate = false,
  isSelected = false,
  onSelect,
  onShowProfile,
  eventId,
  canEdit = true,
  getStaffWorkLog,
  multiSelectMode = false
}) => {
  useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  // 햅틱 피드백과 스와이프 제스처
  const { lightImpact, mediumImpact, selectionFeedback } = useHapticFeedback();

  // 메모이제이션된 포맷팅 훅 사용
  const formattedDate = useCachedFormatDate(staff.assignedDate);
  useCachedTimeDisplay(staff.assignedTime, formatTimeDisplay);
  useCachedTimeSlotColor(staff.assignedTime, getTimeSlotColor);

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
    const dateString = timestampToLocalDateString(staff.assignedDate);
    
    // 날짜가 제대로 파싱되었는지 확인
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      logger.warn('⚠️ StaffCard - assignedDate 파싱 실패:', { component: 'StaffCard', data: {
        staffId: staff.id,
        staffName: staff.name,
        assignedDate: staff.assignedDate,
        parsedDate: dateString
      } });
    }
    
    // staffId에서 _숫자 패턴 제거
    const actualStaffId = staff.id.replace(/_\d+$/, '');
    const workLogId = `virtual_${actualStaffId}_${dateString}`;
    
    // workLogId로 출석 상태 가져오기 - 렌더링 시점마다 새로 호출
    const attendanceRecord = getStaffAttendanceStatus(workLogId);
    const workLogRecord = attendanceRecords.find(r => r.staffId === staff.id);
    
    logger.debug('StaffCard memoizedAttendanceData 재계산', {
      component: 'StaffCard',
      data: {
        staffId: staff.id,
        staffName: staff.name,
        workLogId,
        attendanceRecord: attendanceRecord ? {
          status: attendanceRecord.status,
          workLogId: attendanceRecord.workLogId,
          staffId: attendanceRecord.staffId
        } : null,
        timestamp: new Date().toISOString()
      }
    });
    
    // 실제 workLogId 추출 (Firebase에 저장된 형식)
    let realWorkLogId = workLogId; // 기본값은 virtual workLogId
    if (attendanceRecord && attendanceRecord.workLogId) {
      realWorkLogId = attendanceRecord.workLogId; // 실제 Firebase의 workLogId 사용
    } else if (eventId) {
      // attendanceRecord가 없으면 eventId를 포함한 형식으로 생성
      realWorkLogId = `${eventId}_${actualStaffId}_${dateString}`;
    }
    
    return {
      attendanceRecord,
      workLogRecord,
      workLogId,
      realWorkLogId, // 실제 Firebase workLogId 추가
      // 강제 리렌더링을 위한 timestamp 추가
      timestamp: Date.now()
    };
  }, [
    staff.id, 
    staff.name,
    staff.assignedDate, 
    getStaffAttendanceStatus, 
    attendanceRecords, 
    attendanceRecords.length,
    // 전체 attendanceRecords 변경사항을 더 세밀하게 감지
    JSON.stringify(attendanceRecords.map(r => ({
      workLogId: r.workLogId,
      staffId: r.staffId,
      status: r.status,
      workLogDate: r.workLog?.date
    }))),
    // 해당 스태프의 출석 기록 변화를 더 정확하게 감지
    JSON.stringify(attendanceRecords.filter(r => 
      r.staffId === staff.id || 
      r.workLog?.dealerId === staff.id ||
      r.workLogId?.includes(staff.id.replace(/_\d+$/, ''))
    ).map(r => ({
      workLogId: r.workLogId,
      status: r.status,
      timestamp: r.workLog?.updatedAt
    })))
  ]);

  // 메모이제이션된 출근/퇴근 시간 데이터
  const memoizedTimeData = useMemo(() => {
    // 날짜 추출
    const dateString = timestampToLocalDateString(staff.assignedDate);
    
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
      isScheduledTimeTBD: scheduledStartTime === '미정'
    };
  }, [staff.id, staff.assignedTime, staff.assignedDate, formatTimeDisplay, getTimeSlotColor, getStaffWorkLog]);
  

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);


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
      className={`relative bg-white rounded-lg shadow-md border-2 transition-all duration-200 ${
        onSelect 
          ? isSelected 
            ? 'border-blue-500 bg-blue-50 cursor-pointer staff-card-selected' 
            : 'border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 cursor-pointer'
          : 'border-gray-200'
      } ${isExpanded ? 'shadow-lg' : 'shadow-md'} hover:shadow-lg touch-none select-none`}
      {...swipeGesture}
      onClick={onSelect ? (e) => {
        // 버튼이나 다른 클릭 가능한 요소를 클릭한 경우 무시
        const target = e.target as HTMLElement;
        const isButton = target.tagName === 'BUTTON' || target.closest('button');
        const isLink = target.tagName === 'A' || target.closest('a');
        
        if (isButton || isLink) {
          return;
        }
        
        onSelect(staff.id);
      } : undefined}
    >
      {/* 카드 헤더 */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* 기본 정보 - StaffCardHeader 컴포넌트 사용 */}
            <StaffCardHeader
              name={memoizedStaffData.displayName}
              {...(staff.role && { role: staff.role })}
              {...(staff.assignedRole && { assignedRole: staff.assignedRole })}
              {...(staff.assignedDate && { date: staff.assignedDate })}
              {...(formattedDate && { formattedDate })}
              {...(showDate && { showDate })}
              {...(multiSelectMode && { multiSelectMode })}
              {...(onShowProfile && { onShowProfile })}
              staffId={staff.id}
            />
            
            {/* 출근/퇴근 시간 - StaffCardTimeSection 컴포넌트 사용 */}
            <StaffCardTimeSection
              displayStartTime={memoizedTimeData.displayStartTime}
              displayEndTime={memoizedTimeData.displayEndTime}
              startTimeColor={memoizedTimeData.startTimeColor}
              endTimeColor={memoizedTimeData.endTimeColor}
              isScheduledTimeTBD={memoizedTimeData.isScheduledTimeTBD}
              hasEndTime={memoizedTimeData.hasEndTime}
              canEdit={canEdit}
              multiSelectMode={multiSelectMode}
              onEditWorkTime={onEditWorkTime}
              staffId={staff.id}
            />
          </div>
          
          {/* 선택 상태 표시 (우측 상단) */}
          {onSelect && (
            <div className="absolute top-2 right-2">
              {isSelected ? (
                <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>선택됨</span>
                </div>
              ) : (
                <div className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                  선택
                </div>
              )}
            </div>
          )}
          
          {/* 빠른 상태 및 액션 */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* 출석 상태 */}
            <div className="relative">
              <AttendanceStatusPopover
                workLogId={memoizedAttendanceData.realWorkLogId || memoizedAttendanceData.attendanceRecord?.workLogId || memoizedAttendanceData.workLogId}
                currentStatus={memoizedAttendanceData.attendanceRecord?.status || 'not_started'}
                staffId={staff.id}
                staffName={staff.name || ''}
                eventId={eventId || ''}
                size="sm"
                className="scale-90"
                scheduledStartTime={memoizedTimeData.displayStartTime}
                scheduledEndTime={memoizedTimeData.displayEndTime}
                canEdit={!!canEdit && !multiSelectMode}
                onStatusChange={(newStatus) => {
                  // 상태 변경 시 강제 리렌더링
                  logger.debug('StaffCard - onStatusChange 호출', {
                    component: 'StaffCard',
                    data: {
                      staffId: staff.id,
                      newStatus,
                      realWorkLogId: memoizedAttendanceData.realWorkLogId
                    }
                  });
                }}
              />
            </div>
            
            
            {/* 액션 메뉴 버튼 */}
            <button
              onClick={toggleActions}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {/* 확장/축소 버튼 */}
            <button
              onClick={toggleExpanded}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
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

        {/* 액션 메뉴 - StaffCardActions 컴포넌트 사용 */}
        <StaffCardActions
          showActions={showActions}
          setShowActions={setShowActions}
          workLogId={memoizedAttendanceData.realWorkLogId || memoizedAttendanceData.attendanceRecord?.workLogId || memoizedAttendanceData.workLogId}
          currentStatus={memoizedAttendanceData.attendanceRecord?.status || 'not_started'}
          staffId={staff.id}
          staffName={staff.name || ''}
          eventId={staff.postingId}
          scheduledStartTime={memoizedTimeData.displayStartTime}
          scheduledEndTime={memoizedTimeData.displayEndTime}
          canEdit={canEdit}
          multiSelectMode={multiSelectMode}
          onEditWorkTime={onEditWorkTime}
          onDeleteStaff={onDeleteStaff}
          onStatusChange={() => {}}
          lightImpact={lightImpact}
        />
      </div>
      
      {/* 확장된 세부 정보 - StaffCardContactInfo 컴포넌트 사용 */}
      {isExpanded && (
        <StaffCardContactInfo
          {...(staff.phone && { phone: staff.phone })}
          {...(staff.email && { email: staff.email })}
          {...(staff.postingTitle && { postingTitle: staff.postingTitle })}
          {...(staff.postingId && { postingId: staff.postingId })}
        />
      )}
    </div>
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
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showDate === nextProps.showDate &&
    prevProps.attendanceRecords.length === nextProps.attendanceRecords.length
  );
  
  if (!shouldMemoize) {
    return false; // 리렌더링 필요
  }
  
  // 출석 기록의 상세한 변경 감지
  const prevAttendanceRecords = prevProps.attendanceRecords.filter(r => 
    r.staffId === prevProps.staff.id || 
    r.workLog?.dealerId === prevProps.staff.id
  );
  const nextAttendanceRecords = nextProps.attendanceRecords.filter(r => 
    r.staffId === nextProps.staff.id || 
    r.workLog?.dealerId === nextProps.staff.id
  );
  
  // 출석 기록 개수가 다르면 리렌더링
  if (prevAttendanceRecords.length !== nextAttendanceRecords.length) {
    logger.debug('StaffCard 리렌더링 - 출석 기록 개수 변경', {
      component: 'StaffCard',
      data: {
        staffId: prevProps.staff.id,
        prevCount: prevAttendanceRecords.length,
        nextCount: nextAttendanceRecords.length
      }
    });
    return false;
  }
  
  // 각 기록의 상태나 workLogId 변경 감지
  for (let i = 0; i < prevAttendanceRecords.length; i++) {
    const prev = prevAttendanceRecords[i];
    const next = nextAttendanceRecords[i];
    
    if (prev.status !== next.status || 
        prev.workLogId !== next.workLogId ||
        JSON.stringify(prev.workLog?.updatedAt) !== JSON.stringify(next.workLog?.updatedAt)) {
      logger.debug('StaffCard 리렌더링 - 출석 상태 변경 감지', {
        component: 'StaffCard',
        data: {
          staffId: prevProps.staff.id,
          prevStatus: prev.status,
          nextStatus: next.status,
          prevWorkLogId: prev.workLogId,
          nextWorkLogId: next.workLogId
        }
      });
      return false; // 리렌더링 필요
    }
  }
  
  return true; // 메모이제이션 유지
});

export default StaffCard;