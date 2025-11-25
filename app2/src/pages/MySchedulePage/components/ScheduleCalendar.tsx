import React from 'react';
import LightweightCalendar from '@/components/LightweightCalendar';
import { 
  ScheduleEvent, 
  CalendarView
} from '@/types/schedule';

interface ScheduleCalendarProps {
  schedules: ScheduleEvent[];
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onEventClick: (event: ScheduleEvent) => void;
  onDateClick?: (date: string) => void;
}

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  schedules,
  currentView,
  onViewChange,
  onEventClick,
  onDateClick
}) => {
  // LightweightCalendar는 이미 필요한 모든 기능을 구현하고 있으므로
  // 단순히 props를 전달하기만 하면 됩니다.
  return (
    <LightweightCalendar
      schedules={schedules}
      currentView={currentView}
      onViewChange={onViewChange}
      onEventClick={onEventClick}
      {...(onDateClick && { onDateClick })}
    />
  );
};

export default ScheduleCalendar;