import React, { useMemo, useEffect, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { getTodayString } from '../../../utils/jobPosting/dateUtils';
import { 
  FaCalendarAlt, 
  FaClock, 
  FaMapMarkerAlt, 
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaMoneyBillWave,
  FaSpinner
} from 'react-icons/fa';
import { 
  ScheduleEvent, 
  ScheduleGroup, 
  ATTENDANCE_STATUS_COLORS 
} from '../../../types/schedule';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

interface ScheduleListProps {
  schedules: ScheduleEvent[];
  onEventClick: (event: ScheduleEvent) => void;
  onCheckIn?: (scheduleId: string) => void;
  onCheckOut?: (scheduleId: string) => void;
  // 무한 스크롤 관련
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

const ScheduleList: React.FC<ScheduleListProps> = ({
  schedules,
  onEventClick,
  onCheckIn,
  onCheckOut,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // 무한 스크롤을 위한 ref (항상 선언)
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 날짜별로 그룹화
  const groupedSchedules = useMemo((): ScheduleGroup[] => {
    const groups = schedules.reduce((acc, schedule) => {
      const date = schedule.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(schedule);
      return acc;
    }, {} as Record<string, ScheduleEvent[]>);

    // 날짜별 그룹 생성
    const today = getTodayString();
    
    return Object.entries(groups)
      .map(([date, events]) => {
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        });

        return {
          date,
          formattedDate,
          events: events.sort((a, b) => {
            // 시간순 정렬
            if (a.startTime && b.startTime) {
              return a.startTime.toDate().getTime() - b.startTime.toDate().getTime();
            }
            return 0;
          }),
          isToday: date === today,
          isPast: date < today
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // 날짜 내림차순
  }, [schedules]);

  // 시간 포맷팅
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '미정';
    try {
      const date = timestamp.toDate();
      return date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch (error) {
      return '미정';
    }
  };

  // 상태 아이콘 렌더링
  const renderStatusIcon = (event: ScheduleEvent) => {
    switch (event.type) {
      case 'applied':
        return <FaHourglassHalf className="text-yellow-500" />;
      case 'confirmed':
        return <FaCheckCircle className="text-green-500" />;
      case 'completed':
        return <FaCheckCircle className="text-blue-500" />;
      case 'cancelled':
        return <FaTimesCircle className="text-red-500" />;
      default:
        return null;
    }
  };

  // 출퇴근 버튼 렌더링
  const renderAttendanceButtons = (event: ScheduleEvent, isToday: boolean) => {
    if (!isToday || event.type !== 'confirmed') return null;

    return (
      <div className="flex gap-2 mt-3">
        {event.status === 'not_started' && onCheckIn && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCheckIn(event.id);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
          >
            출근하기
          </button>
        )}
        {event.status === 'checked_in' && onCheckOut && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCheckOut(event.id);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            퇴근하기
          </button>
        )}
      </div>
    );
  };

  // 개별 이벤트 카드 렌더링
  const EventCard: React.FC<{ event: ScheduleEvent; isToday: boolean }> = ({ event, isToday }) => {
    const statusColorClass = ATTENDANCE_STATUS_COLORS[event.status];
    
    return (
      <div
        onClick={() => onEventClick(event)}
        className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${
          isToday ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {renderStatusIcon(event)}
            <h4 className="font-semibold text-gray-900">{event.eventName}</h4>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColorClass}`}>
            {event.status === 'not_started' && '예정'}
            {event.status === 'checked_in' && '출근'}
            {event.status === 'checked_out' && '퇴근'}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <FaClock className="text-gray-400" />
            <span>
              {formatTime(event.startTime)} - {formatTime(event.endTime)}
              {event.actualStartTime && (
                <span className="ml-2 text-green-600">
                  (실제: {formatTime(event.actualStartTime)} - {formatTime(event.actualEndTime)})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <FaInfoCircle className="text-gray-400" />
            <span>{event.role}</span>
          </div>

          {event.location && (
            <div className="flex items-center gap-2">
              <FaMapMarkerAlt className="text-gray-400" />
              <span>{event.location}</span>
              {event.detailedAddress && (
                <span className="text-xs text-gray-500">({event.detailedAddress})</span>
              )}
            </div>
          )}

          {event.payrollAmount && event.type === 'completed' && (
            <div className="flex items-center gap-2">
              <FaMoneyBillWave className="text-gray-400" />
              <span className="text-green-600 font-medium">
                ₩{event.payrollAmount.toLocaleString()}
                {event.payrollStatus === 'completed' && ' (지급완료)'}
                {event.payrollStatus === 'processing' && ' (처리중)'}
                {event.payrollStatus === 'pending' && ' (대기중)'}
              </span>
            </div>
          )}
        </div>

        {renderAttendanceButtons(event, isToday)}

        {event.notes && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
            {event.notes}
          </div>
        )}
      </div>
    );
  };

  // 가상화를 위한 리스트 아이템 렌더러
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    let content: React.ReactNode = null;
    let currentIndex = 0;

    // 인덱스에 해당하는 그룹과 이벤트 찾기
    for (const group of groupedSchedules) {
      // 그룹 헤더
      if (currentIndex === index) {
        content = (
          <div style={style} className="px-4 py-2">
            <div className="flex items-center gap-3 mb-3">
              <FaCalendarAlt className="text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                {group.formattedDate}
              </h3>
              {group.isToday && (
                <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                  오늘
                </span>
              )}
              <span className="text-sm text-gray-500">
                ({group.events.length}개 일정)
              </span>
            </div>
          </div>
        );
        break;
      }
      currentIndex++;

      // 그룹의 이벤트들
      for (const event of group.events) {
        if (currentIndex === index) {
          content = (
            <div style={style} className="px-4 pb-3">
              <EventCard event={event} isToday={group.isToday} />
            </div>
          );
          break;
        }
        currentIndex++;
      }

      if (content) break;
    }

    return <>{content}</>;
  };

  // 전체 아이템 수 계산 (그룹 헤더 + 이벤트)
  const itemCount = groupedSchedules.reduce((sum, group) => {
    return sum + 1 + group.events.length; // 1은 그룹 헤더
  }, 0);

  // 아이템 높이 계산 함수
  const getItemSize = (index: number): number => {
    let currentIndex = 0;

    for (const group of groupedSchedules) {
      // 그룹 헤더
      if (currentIndex === index) {
        return 60; // 헤더 높이
      }
      currentIndex++;

      // 이벤트들
      for (const event of group.events) {
        if (currentIndex === index) {
          // 이벤트 카드 높이 (내용에 따라 동적)
          let height = 180; // 기본 높이
          if (event.notes) height += 40;
          if (group.isToday && event.type === 'confirmed') height += 50; // 출퇴근 버튼
          return height;
        }
        currentIndex++;
      }
    }

    return 180; // 기본값
  };

  // 무한 스크롤을 위한 Intersection Observer
  useEffect(() => {
    if (!onLoadMore || !hasMore || !loadMoreRef.current || !isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [onLoadMore, hasMore, isLoadingMore, isMobile]);

  if (schedules.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <FaCalendarAlt className="text-4xl text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">등록된 일정이 없습니다.</p>
      </div>
    );
  }

  // 모바일에서는 가상화 사용하지 않음 (스크롤 이슈)
  if (isMobile) {
    return (
      <div className="space-y-6">
        {groupedSchedules.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-3 mb-3">
              <FaCalendarAlt className="text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                {group.formattedDate}
              </h3>
              {group.isToday && (
                <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                  오늘
                </span>
              )}
            </div>
            <div className="space-y-3">
              {group.events.map((event) => (
                <EventCard key={event.id} event={event} isToday={group.isToday} />
              ))}
            </div>
          </div>
        ))}
        
        {/* 무한 스크롤 트리거 */}
        {hasMore && (
          <div ref={loadMoreRef} className="py-4 text-center">
            {isLoadingMore ? (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <FaSpinner className="animate-spin" />
                <span>더 불러오는 중...</span>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">스크롤하여 더 보기</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 데스크탑에서는 가상화 사용 - FixedSizeList는 고정 크기만 지원하므로 평균값 사용
  const averageItemHeight = 150;
  
  return (
    <List
      height={650}
      itemCount={itemCount}
      itemSize={averageItemHeight}
      width="100%"
      className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
    >
      {Row}
    </List>
  );
};

export default ScheduleList;