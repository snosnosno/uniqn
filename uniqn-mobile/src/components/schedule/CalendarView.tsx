/**
 * UNIQN Mobile - CalendarView 컴포넌트
 *
 * @description 스케줄 캘린더 뷰 (월간/주간)
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useThemeStore } from '@/stores/themeStore';
import type { DateData, MarkedDates } from 'react-native-calendars/src/types';
import type { ScheduleEvent, ScheduleType } from '@/types';
// import { SCHEDULE_COLORS } from '@/types';

// 한글 로케일 설정
LocaleConfig.locales['ko'] = {
  monthNames: [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ],
  monthNamesShort: [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

// ============================================================================
// Types
// ============================================================================

interface CalendarViewProps {
  schedules: ScheduleEvent[];
  selectedDate: string;
  currentMonth: { year: number; month: number };
  onDateSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

interface DotInfo {
  key: string;
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

const SCHEDULE_DOT_COLORS: Record<ScheduleType, string> = {
  applied: '#F59E0B', // yellow-500
  confirmed: '#10B981', // green-500
  completed: '#A855F7', // primary-500
  cancelled: '#EF4444', // red-500
};

// 캘린더 테마
const calendarTheme = {
  // 배경
  backgroundColor: 'transparent',
  calendarBackground: 'transparent',

  // 텍스트 색상
  textSectionTitleColor: '#6B7280',
  textSectionTitleDisabledColor: '#9CA3AF',
  selectedDayBackgroundColor: '#A855F7',
  selectedDayTextColor: '#FFFFFF',
  todayTextColor: '#A855F7',
  dayTextColor: '#1A1625',
  textDisabledColor: '#D1D5DB',
  dotColor: '#A855F7',
  selectedDotColor: '#FFFFFF',

  // 월 네비게이션
  monthTextColor: '#1A1625',
  indicatorColor: '#A855F7',

  // 화살표
  arrowColor: '#6B7280',

  // 폰트
  textDayFontSize: 14,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 12,
  textDayFontWeight: '400' as const,
  textMonthFontWeight: '600' as const,
  textDayHeaderFontWeight: '500' as const,
};

// 다크모드 테마
const darkCalendarTheme = {
  ...calendarTheme,
  textSectionTitleColor: '#9CA3AF',
  textSectionTitleDisabledColor: '#6B7280',
  dayTextColor: '#F3F4F6',
  textDisabledColor: '#6B7280',
  monthTextColor: '#F3F4F6',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 스케줄 타입별 도트 생성
 */
function getDotsForSchedules(schedules: ScheduleEvent[]): DotInfo[] {
  const typeSet = new Set<ScheduleType>();
  schedules.forEach((schedule) => typeSet.add(schedule.type));

  return Array.from(typeSet)
    .slice(0, 3) // 최대 3개 도트
    .map((type) => ({
      key: type,
      color: SCHEDULE_DOT_COLORS[type],
    }));
}

/**
 * 스케줄을 MarkedDates 형식으로 변환
 */
function convertToMarkedDates(schedules: ScheduleEvent[], selectedDate: string): MarkedDates {
  const markedDates: MarkedDates = {};

  // 날짜별 스케줄 그룹화
  const schedulesByDate = new Map<string, ScheduleEvent[]>();
  schedules.forEach((schedule) => {
    const existing = schedulesByDate.get(schedule.date) || [];
    schedulesByDate.set(schedule.date, [...existing, schedule]);
  });

  // MarkedDates 생성
  schedulesByDate.forEach((dateSchedules, date) => {
    const dots = getDotsForSchedules(dateSchedules);
    markedDates[date] = {
      dots,
      marked: true,
      selected: date === selectedDate,
      selectedColor: date === selectedDate ? '#A855F7' : undefined,
    };
  });

  // 선택된 날짜가 스케줄이 없는 경우에도 표시
  if (!markedDates[selectedDate]) {
    markedDates[selectedDate] = {
      selected: true,
      selectedColor: '#A855F7',
    };
  }

  return markedDates;
}

// ============================================================================
// Sub Components
// ============================================================================

interface LegendProps {
  types: ScheduleType[];
}

function CalendarLegend({ types }: LegendProps) {
  const labels: Record<ScheduleType, string> = {
    applied: '지원 중',
    confirmed: '확정',
    completed: '완료',
    cancelled: '취소',
  };

  return (
    <View className="flex-row flex-wrap justify-center gap-3 mt-3 mb-1 px-2">
      {types.map((type) => (
        <View key={type} className="flex-row items-center">
          <View
            className="w-2.5 h-2.5 rounded-full mr-1.5"
            style={{ backgroundColor: SCHEDULE_DOT_COLORS[type] }}
          />
          <Text className="text-xs text-gray-600 dark:text-gray-400">{labels[type]}</Text>
        </View>
      ))}
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarView({
  schedules,
  selectedDate,
  currentMonth,
  onDateSelect,
  onMonthChange,
}: CalendarViewProps) {
  // 다크모드 감지 (앱 테마 스토어 사용)
  const { isDarkMode, mode } = useThemeStore();
  const theme = isDarkMode ? darkCalendarTheme : calendarTheme;

  // 마킹된 날짜 계산
  const markedDates = useMemo(
    () => convertToMarkedDates(schedules, selectedDate),
    [schedules, selectedDate]
  );

  // 사용된 스케줄 타입들 추출
  const usedTypes = useMemo(() => {
    const types = new Set<ScheduleType>();
    schedules.forEach((schedule) => types.add(schedule.type));
    return Array.from(types);
  }, [schedules]);

  // 날짜 선택 핸들러
  const handleDayPress = useCallback(
    (day: DateData) => {
      onDateSelect(day.dateString);
    },
    [onDateSelect]
  );

  // 월 변경 핸들러
  const handleMonthChange = useCallback(
    (month: DateData) => {
      onMonthChange(month.year, month.month);
    },
    [onMonthChange]
  );

  // 현재 월 문자열 (YYYY-MM-DD 형식의 첫 날)
  const currentMonthString = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`;

  return (
    <View className="bg-white dark:bg-surface rounded-xl mx-4 overflow-hidden">
      <Calendar
        key={`${currentMonthString}-${mode}`}
        current={currentMonthString}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markedDates={markedDates}
        markingType="multi-dot"
        enableSwipeMonths
        theme={theme}
        firstDay={0} // 일요일 시작
        hideExtraDays={false}
        showSixWeeks={false}
      />

      {/* 범례 */}
      {usedTypes.length > 0 && <CalendarLegend types={usedTypes} />}
    </View>
  );
}

export default CalendarView;
