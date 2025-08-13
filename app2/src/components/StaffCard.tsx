import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';

import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useSwipeGestureReact } from '../hooks/useSwipeGesture';
import { useCachedFormatDate, useCachedTimeDisplay, useCachedTimeSlotColor } from '../hooks/useCachedFormatDate';
import { StaffData } from '../hooks/useStaffManagement';
import AttendanceStatusPopover from './AttendanceStatusPopover';
import { timestampToLocalDateString } from '../utils/dateUtils';

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
  
  const { lightImpact, mediumImpact, selectionFeedback } = useHapticFeedback();

  const formattedDate = useCachedFormatDate(staff.assignedDate);
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
    eventId
  ]);

  const memoizedTimeData = useMemo(() => {
    const dateString = timestampToLocalDateString(staff.assignedDate);
    
    const workLog = getStaffWorkLog ? getStaffWorkLog(staff.id, dateString) : null;
    
    let scheduledStartTime = staff.assignedTime;
    if (workLog?.scheduledStartTime) {
      try {
        const timeDate = workLog.scheduledStartTime.toDate ? workLog.scheduledStartTime.toDate() : new Date(workLog.scheduledStartTime);
        scheduledStartTime = timeDate.toLocaleTimeString('en-US', { 
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        // Fallback to staff time
      }
    }
    
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 flex-1 min-w-0">
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
            
            {onSelect && (
              <div className="absolute top-2 right-2 sm:static sm:mt-0">
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
            
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 mt-2 sm:mt-0">
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
                  onStatusChange={(_newStatus) => {
                    // Status change handled
                  }}
                />
              </div>
              
              <button
                onClick={toggleActions}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              
              <button
                onClick={toggleExpanded}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
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
    return false;
  }
  
  const prevAttendanceRecords = prevProps.attendanceRecords.filter(r => 
    r.staffId === prevProps.staff.id || 
    r.workLog?.dealerId === prevProps.staff.id
  );
  const nextAttendanceRecords = nextProps.attendanceRecords.filter(r => 
    r.staffId === nextProps.staff.id || 
    r.workLog?.dealerId === nextProps.staff.id
  );
  
  if (prevAttendanceRecords.length !== nextAttendanceRecords.length) {
    return false;
  }
  
  for (let i = 0; i < prevAttendanceRecords.length; i++) {
    const prev = prevAttendanceRecords[i];
    const next = nextAttendanceRecords[i];
    
    if (prev.status !== next.status || 
        prev.workLogId !== next.workLogId ||
        JSON.stringify(prev.workLog?.updatedAt) !== JSON.stringify(next.workLog?.updatedAt)) {
      return false;
    }
  }
  
  return true;
});

export default StaffCard;