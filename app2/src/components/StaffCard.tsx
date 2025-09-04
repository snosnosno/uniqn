import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';

import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useSwipeGestureReact } from '../hooks/useSwipeGesture';
import { useCachedTimeDisplay, useCachedTimeSlotColor } from '../hooks/useCachedFormatDate';
import { StaffData } from '../hooks/useStaffManagement';
import AttendanceStatusPopover, { AttendanceStatus } from './AttendanceStatusPopover';
import { timestampToLocalDateString } from '../utils/dateUtils';
import { UnifiedWorkLog } from '../types/unified/workLog';

// BaseCard 및 하위 컴포넌트들 import
import BaseCard, { CardHeader, CardBody, CardFooter } from './ui/BaseCard';
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
  getStaffWorkLog?: (staffId: string, date: string) => UnifiedWorkLog | null;
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
  // 🚀 출석 상태 Optimistic Update를 위한 로컬 상태
  const [optimisticAttendanceStatus, setOptimisticAttendanceStatus] = useState<AttendanceStatus | null>(null);
  
  const { lightImpact, mediumImpact, selectionFeedback } = useHapticFeedback();

  useCachedTimeDisplay(staff.assignedTime, formatTimeDisplay);
  useCachedTimeSlotColor(staff.assignedTime, getTimeSlotColor);

  const memoizedStaffData = useMemo(() => ({
    displayName: staff.name || '이름 미정',
    avatarInitial: (staff.name || 'U').charAt(0).toUpperCase(),
    roleDisplay: staff.assignedRole || staff.role || '역할 미정',
    hasContact: !!(staff.phone || staff.email)
  }), [staff.name, staff.assignedRole, staff.role, staff.phone, staff.email]);

  const memoizedAttendanceData = useMemo(() => {
    const dateString = timestampToLocalDateString(staff.assignedDate);
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      logger.warn('⚠️ StaffCard - assignedDate 파싱 실패:', { component: 'StaffCard', data: {
        staffId: staff.id,
        staffName: staff.name,
        assignedDate: staff.assignedDate,
        parsedDate: dateString
      } });
    }
    
    const actualStaffId = staff.id.replace(/_\d+$/, '');
    const workLogId = `virtual_${actualStaffId}_${dateString}`;
    
    const attendanceRecord = getStaffAttendanceStatus(workLogId);
    const workLogRecord = attendanceRecords.find(r => r.staffId === staff.id);
    
    let realWorkLogId = workLogId;
    if (attendanceRecord && attendanceRecord.workLogId) {
      realWorkLogId = attendanceRecord.workLogId;
    } else if (eventId) {
      realWorkLogId = `${eventId}_${actualStaffId}_${dateString}`;
    }
    
    return {
      attendanceRecord,
      workLogRecord,
      workLogId,
      realWorkLogId
    };
  }, [
    staff.id, 
    staff.name, 
    staff.assignedDate, 
    attendanceRecords,
    eventId,
    getStaffAttendanceStatus
  ]);

  const memoizedTimeData = useMemo(() => {
    const dateString = timestampToLocalDateString(staff.assignedDate);
    
    const workLog = getStaffWorkLog ? getStaffWorkLog(staff.id, dateString) : null;
    
    // workLog.scheduledStartTime을 우선 사용, assignedTime/timeSlot은 fallback
    let scheduledStartTime = staff.assignedTime || (staff as any).timeSlot;
    if (workLog?.scheduledStartTime) {
      try {
        if (typeof workLog.scheduledStartTime === 'string') {
          // 문자열인 경우 그대로 사용
          scheduledStartTime = workLog.scheduledStartTime;
        } else if (workLog.scheduledStartTime && typeof workLog.scheduledStartTime === 'object' && 'toDate' in workLog.scheduledStartTime) {
          // Timestamp인 경우
          const timeDate = workLog.scheduledStartTime.toDate();
          scheduledStartTime = timeDate.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (error) {
        // Fallback to staff time
      }
    }
    
    let scheduledEndTime = null;
    if (workLog?.scheduledEndTime) {
      try {
        if (typeof workLog.scheduledEndTime === 'string') {
          // 문자열인 경우 그대로 사용
          scheduledEndTime = workLog.scheduledEndTime;
        } else if (workLog.scheduledEndTime && typeof workLog.scheduledEndTime === 'object' && 'toDate' in workLog.scheduledEndTime) {
          // Timestamp인 경우
          const timeDate = workLog.scheduledEndTime.toDate();
          scheduledEndTime = timeDate.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (error) {
        // Fallback
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
  }, [staff, formatTimeDisplay, getTimeSlotColor, getStaffWorkLog]);
  

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  }, []);


  const toggleActions = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    mediumImpact();
    setShowActions(prev => !prev);
  }, [mediumImpact]);

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

  const handleCardClick = onSelect ? () => {
    onSelect(staff.id);
  } : undefined;

  return (
    <div {...swipeGesture}>
      <BaseCard
        variant={isSelected ? 'elevated' : 'bordered'}
        hover={!!onSelect}
        active={isSelected}
        {...(handleCardClick && { onClick: handleCardClick })}
        className={`relative transition-all duration-200 ${
          onSelect 
            ? isSelected 
              ? 'border-primary-500 bg-primary-50 staff-card-selected' 
              : 'border-dashed hover:border-gray-400 hover:bg-gray-50'
            : ''
        } ${isExpanded ? 'shadow-lg' : ''} touch-none select-none`}
        aria-label={`스태프 카드: ${memoizedStaffData.displayName}`}
        aria-describedby={`staff-${staff.id}-details`}
      >
        <CardHeader className="p-0" id={`staff-${staff.id}-header`}>
          <div className="flex flex-col">
            {/* 첫 번째 줄: 이름과 메뉴 버튼 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <StaffCardHeader
                  name={memoizedStaffData.displayName}
                  {...(staff.role && { role: staff.role })}
                  {...(staff.assignedRole && { assignedRole: staff.assignedRole })}
                  {...(staff.assignedDate && { date: staff.assignedDate })}
                  {...(showDate && { showDate })}
                  {...(multiSelectMode && { multiSelectMode })}
                  {...(onShowProfile && { onShowProfile })}
                  staffId={staff.id}
                />
              </div>
              
              {/* 모바일: 메뉴 버튼을 이름과 같은 줄에 */}
              <button
                onClick={toggleActions}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors sm:hidden"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>
            
            {/* 두 번째 줄: 시간 */}
            <div className="mb-2">
              <StaffCardTimeSection
                displayStartTime={memoizedTimeData.displayStartTime}
                displayEndTime={memoizedTimeData.displayEndTime}
                startTimeColor={memoizedTimeData.startTimeColor}
                endTimeColor={memoizedTimeData.endTimeColor}
                canEdit={canEdit}
                multiSelectMode={multiSelectMode}
                onEditWorkTime={onEditWorkTime}
                staffId={staff.id}
              />
            </div>
            
            {/* 세 번째 줄: 출석상태와 확장버튼 */}
            <div className="flex items-center justify-between">
              <div className="relative">
                <AttendanceStatusPopover
                  workLogId={memoizedAttendanceData.realWorkLogId || memoizedAttendanceData.attendanceRecord?.workLogId || memoizedAttendanceData.workLogId}
                  currentStatus={optimisticAttendanceStatus || memoizedAttendanceData.attendanceRecord?.status || 'not_started'}
                  staffId={staff.id}
                  staffName={staff.name || ''}
                  eventId={eventId || ''}
                  size="sm"
                  className="scale-90"
                  scheduledStartTime={memoizedTimeData.displayStartTime}
                  scheduledEndTime={memoizedTimeData.displayEndTime}
                  canEdit={!!canEdit && !multiSelectMode}
                  onStatusChange={(newStatus) => {
                    // 🚀 즉시 UI 업데이트 (Optimistic Update)
                    setOptimisticAttendanceStatus(newStatus);
                    
                    // Firebase 업데이트 완료 후 실제 상태로 동기화 (3초 후 초기화)
                    setTimeout(() => {
                      setOptimisticAttendanceStatus(null);
                    }, 3000);
                  }}
                />
              </div>
              
              {/* 확장 버튼을 오른쪽 끝에 */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={toggleExpanded}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* 데스크톱: 메뉴 버튼 */}
                <button
                  onClick={toggleActions}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors hidden sm:block"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 선택 모드 표시 */}
            {onSelect && (
              <div className="absolute top-2 right-2">
                {isSelected ? (
                  <div className="bg-primary-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">선택됨</span>
                  </div>
                ) : (
                  <div className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                    <span className="hidden sm:inline">선택</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardBody className="p-0" id={`staff-${staff.id}-details`}>
          {!showActions && onSelect ? (
            <div className="mt-2 flex items-center justify-center text-xs text-gray-400">
              <span className="flex items-center space-x-1">
                <span>←</span>
                <span>액션</span>
                <span className="mx-2">•</span>
                <span>선택</span>
                <span>→</span>
              </span>
            </div>
          ) : null}

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
        </CardBody>
        
        {isExpanded && (
          <CardFooter className="p-0">
            <StaffCardContactInfo
              {...(staff.phone && { phone: staff.phone })}
              {...(staff.email && { email: staff.email })}
              {...(staff.postingTitle && { postingTitle: staff.postingTitle })}
              {...(staff.postingId && { postingId: staff.postingId })}
            />
          </CardFooter>
        )}
      </BaseCard>
    </div>
  );
}, (prevProps, nextProps) => {
  // 기본 속성 비교
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
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.multiSelectMode === nextProps.multiSelectMode
  );
  
  if (!shouldMemoize) {
    return false;
  }
  
  // workLog 변경 감지 추가
  const dateString = prevProps.staff.assignedDate || '';
  const prevWorkLog = prevProps.getStaffWorkLog ? prevProps.getStaffWorkLog(prevProps.staff.id, dateString) : null;
  const nextWorkLog = nextProps.getStaffWorkLog ? nextProps.getStaffWorkLog(nextProps.staff.id, dateString) : null;
  
  // workLog의 주요 시간 필드 변경 체크
  if (prevWorkLog?.scheduledStartTime !== nextWorkLog?.scheduledStartTime ||
      prevWorkLog?.scheduledEndTime !== nextWorkLog?.scheduledEndTime ||
      prevWorkLog?.actualStartTime !== nextWorkLog?.actualStartTime ||
      prevWorkLog?.actualEndTime !== nextWorkLog?.actualEndTime ||
      prevWorkLog?.status !== nextWorkLog?.status) {
    return false;
  }
  
  // attendanceRecords 비교
  const prevAttendanceRecords = prevProps.attendanceRecords.filter(r => 
    r.staffId === prevProps.staff.id || 
    r.workLog?.staffId === prevProps.staff.id
  );
  const nextAttendanceRecords = nextProps.attendanceRecords.filter(r => 
    r.staffId === nextProps.staff.id || 
    r.workLog?.staffId === nextProps.staff.id
  );
  
  if (prevAttendanceRecords.length !== nextAttendanceRecords.length) {
    return false;
  }
  
  for (let i = 0; i < prevAttendanceRecords.length; i++) {
    const prev = prevAttendanceRecords[i];
    const next = nextAttendanceRecords[i];
    
    if (prev?.status !== next?.status || 
        prev?.workLogId !== next?.workLogId ||
        JSON.stringify(prev?.workLog?.updatedAt) !== JSON.stringify(next?.workLog?.updatedAt)) {
      return false;
    }
  }
  
  return true;
});

export default StaffCard;