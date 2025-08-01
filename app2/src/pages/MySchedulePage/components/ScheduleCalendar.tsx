import React, { useMemo, useRef, useEffect } from 'react';
import { logger } from '../../../utils/logger';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
// import { useTranslation } from 'react-i18next'; // not used
import { 
  ScheduleEvent, 
  CalendarView, 
  SCHEDULE_COLORS 
} from '../../../types/schedule';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

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
  // const { t } = useTranslation(); // not used
  const calendarRef = useRef<FullCalendar>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 스케줄 이벤트를 FullCalendar 이벤트로 변환
  const calendarEvents = useMemo(() => {
    logger.debug('\n📅 ========== 캘린더 이벤트 변환 시작 ==========', { component: 'ScheduleCalendar' });
    logger.debug('입력된 스케줄 수:', { component: 'ScheduleCalendar', data: schedules.length });
    
    // 입력 스케줄 상세
    schedules.forEach((schedule, index) => {
      console.log(`[${index}] 입력 스케줄:`, {
        id: schedule.id,
        date: schedule.date,
        dateType: typeof schedule.date,
        eventName: schedule.eventName,
        type: schedule.type,
        startTime: schedule.startTime,
        endTime: schedule.endTime
      });
    });
    
    const events = schedules.map((schedule, index) => {
      const colors = SCHEDULE_COLORS[schedule.type];
      
      // 시간 표시 텍스트 생성
      let timeText = '';
      if (schedule.startTime && schedule.endTime) {
        const startDate = schedule.startTime.toDate();
        const startHour = startDate.getHours().toString().padStart(2, '0');
        const startMin = startDate.getMinutes().toString().padStart(2, '0');
        timeText = `${startHour}:${startMin}`;
      } else {
        timeText = '미정';
      }

      // 제목 생성: 시간과 이벤트명
      const displayTitle = `${timeText} ${schedule.eventName}`;

      // 날짜 확인
      let startDate: Date;
      let endDate: Date;
      
      if (schedule.startTime) {
        startDate = schedule.startTime.toDate();
        endDate = schedule.endTime ? schedule.endTime.toDate() : startDate;
      } else {
        // 날짜 문자열을 Date 객체로 변환
        startDate = new Date(schedule.date + 'T00:00:00');
        endDate = new Date(schedule.date + 'T23:59:59');
      }
      
      const event = {
        id: schedule.id,
        title: displayTitle,
        start: startDate,
        end: endDate,
        allDay: !schedule.startTime || !schedule.endTime,
        backgroundColor: colors.backgroundColor,
        borderColor: colors.borderColor,
        textColor: colors.textColor,
        extendedProps: {
          scheduleData: schedule,
          location: schedule.location,
          status: schedule.status,
          type: schedule.type
        }
      };
      
      console.log(`[${index}] 캘린더 이벤트 생성:`, {
        id: event.id,
        title: event.title,
        start: event.start,
        startISO: event.start.toISOString(),
        end: event.end,
        endISO: event.end.toISOString(),
        allDay: event.allDay,
        date: schedule.date,
        dateType: typeof schedule.date,
        colors: {
          backgroundColor: event.backgroundColor,
          borderColor: event.borderColor,
          textColor: event.textColor
        }
      });
      return event;
    });
    
    logger.debug('\n📅 ========== 캘린더 이벤트 변환 완료 ==========', { component: 'ScheduleCalendar' });
    logger.debug('생성된 이벤트 수:', { component: 'ScheduleCalendar', data: events.length });
    logger.debug('========================================\n', { component: 'ScheduleCalendar' });
    
    return events;
  }, [schedules]);

  // 모바일에서는 월 뷰를 유지하되, 표시 설정을 조정
  useEffect(() => {
    if (isMobile && currentView === 'dayGridMonth') {
      // 모바일에서도 월 뷰 유지
    }
  }, [isMobile, currentView]);

  // 이벤트 클릭 핸들러
  const handleEventClick = (clickInfo: any) => {
    const scheduleData = clickInfo.event.extendedProps.scheduleData;
    onEventClick(scheduleData);
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (dateClickInfo: any) => {
    if (onDateClick) {
      onDateClick(dateClickInfo.dateStr);
    }
  };

  // 뷰 변경 핸들러
  const handleViewChange = (viewInfo: any) => {
    onViewChange(viewInfo.view.type as CalendarView);
  };

  // 캘린더 툴바 설정
  const headerToolbar = isMobile ? {
    left: 'prev,next',
    center: 'title',
    right: 'today'
  } : {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  };

  // 한국어 설정
  const locale = 'ko';
  const buttonText = {
    today: '오늘',
    month: '월',
    week: '주',
    day: '일',
    list: '목록'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin
        ]}
        initialView={currentView}
        initialDate={new Date().toISOString().substring(0, 10)} // 오늘 날짜로 동적 설정
        headerToolbar={headerToolbar}
        firstDay={0} // 일요일부터 시작
        weekends={true} // 주말 표시
        events={calendarEvents}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        viewDidMount={handleViewChange}
        locale={locale}
        buttonText={buttonText}
        height={isMobile ? 'auto' : 650}
        contentHeight={isMobile ? 'auto' : 600}
        aspectRatio={isMobile ? 1.35 : 1.8}
        
        // 날짜 포맷 설정 - 숫자만 표시
        dayCellContent={(info) => {
          return { html: info.dayNumberText.replace('일', '') };
        }}
        
        // 모바일 최적화
        dayMaxEvents={isMobile ? 3 : false}
        moreLinkText="더보기"
        eventDisplay="block"
        
        // 시간 설정
        slotMinTime="06:00:00"
        slotMaxTime="30:00:00" // 새벽 6시까지 표시
        slotDuration="01:00:00"
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          hour12: false
        }}
        
        // 이벤트 시간 표시 형식
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }}
        
        // 주간 뷰 설정
        weekNumbers={false}
        weekText="주"
        
        // 스타일링
        eventClassNames={(arg) => {
          const status = arg.event.extendedProps.status;
          const type = arg.event.extendedProps.type;
          return [
            'cursor-pointer',
            'transition-all',
            'hover:opacity-80',
            `schedule-${type}`,
            `status-${status}`
          ];
        }}
        
        // 드래그 앤 드롭 비활성화 (읽기 전용)
        editable={false}
        droppable={false}
        
        // 터치 이벤트 지원
        eventLongPressDelay={250}
        selectLongPressDelay={250}
      />
      
      {/* 범례 */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: SCHEDULE_COLORS.applied.backgroundColor, border: `1px solid ${SCHEDULE_COLORS.applied.borderColor}` }}></div>
          <span>지원중</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: SCHEDULE_COLORS.confirmed.backgroundColor, border: `1px solid ${SCHEDULE_COLORS.confirmed.borderColor}` }}></div>
          <span>확정</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: SCHEDULE_COLORS.completed.backgroundColor, border: `1px solid ${SCHEDULE_COLORS.completed.borderColor}` }}></div>
          <span>완료</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: SCHEDULE_COLORS.cancelled.backgroundColor, border: `1px solid ${SCHEDULE_COLORS.cancelled.borderColor}` }}></div>
          <span>취소</span>
        </div>
      </div>
    </div>
  );
};

export default ScheduleCalendar;