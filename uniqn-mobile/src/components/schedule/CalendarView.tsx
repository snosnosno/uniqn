/**
 * UNIQN Mobile - Calendar view component
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData, MarkedDates } from 'react-native-calendars/src/types';
import { ACCENT_COLORS, PRIMARY_COLORS, STATUS_COLORS } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';
import type { ScheduleEvent, ScheduleType } from '@/types';

LocaleConfig.locales.ko = {
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

const SCHEDULE_DOT_COLORS: Record<ScheduleType, string> = {
  applied: STATUS_COLORS.warning,
  confirmed: STATUS_COLORS.success,
  completed: ACCENT_COLORS[500],
  cancelled: STATUS_COLORS.error,
};

const CALENDAR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const calendarTheme = {
  backgroundColor: 'transparent',
  calendarBackground: 'transparent',
  textSectionTitleColor: '#6B7280',
  textSectionTitleDisabledColor: '#9CA3AF',
  selectedDayBackgroundColor: PRIMARY_COLORS[600],
  selectedDayTextColor: '#FFFFFF',
  todayTextColor: ACCENT_COLORS[600],
  dayTextColor: '#1A1625',
  textDisabledColor: '#D1D5DB',
  dotColor: PRIMARY_COLORS[500],
  selectedDotColor: '#FFFFFF',
  monthTextColor: '#1A1625',
  indicatorColor: PRIMARY_COLORS[500],
  arrowColor: '#6B7280',
  textDayFontSize: 14,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 12,
  textDayFontWeight: '400' as const,
  textMonthFontWeight: '600' as const,
  textDayHeaderFontWeight: '500' as const,
};

const darkCalendarTheme = {
  ...calendarTheme,
  textSectionTitleColor: '#9CA3AF',
  textSectionTitleDisabledColor: '#6B7280',
  todayTextColor: ACCENT_COLORS[300],
  dayTextColor: '#F3F4F6',
  textDisabledColor: '#6B7280',
  monthTextColor: '#F3F4F6',
  arrowColor: '#D1D5DB',
};

function getDotsForSchedules(schedules: ScheduleEvent[]): DotInfo[] {
  const typeSet = new Set<ScheduleType>();
  schedules.forEach((schedule) => typeSet.add(schedule.type));

  return Array.from(typeSet)
    .slice(0, 3)
    .map((type) => ({
      key: type,
      color: SCHEDULE_DOT_COLORS[type],
    }));
}

function convertToMarkedDates(schedules: ScheduleEvent[], selectedDate: string): MarkedDates {
  const markedDates: MarkedDates = {};
  const schedulesByDate = new Map<string, ScheduleEvent[]>();

  schedules.forEach((schedule) => {
    if (!schedule.date) {
      return;
    }

    const existing = schedulesByDate.get(schedule.date) || [];
    schedulesByDate.set(schedule.date, [...existing, schedule]);
  });

  schedulesByDate.forEach((dateSchedules, date) => {
    const dots = getDotsForSchedules(dateSchedules);
    markedDates[date] = {
      dots,
      marked: true,
      selected: date === selectedDate,
      selectedColor: date === selectedDate ? PRIMARY_COLORS[600] : undefined,
    };
  });

  if (!markedDates[selectedDate]) {
    markedDates[selectedDate] = {
      selected: true,
      selectedColor: PRIMARY_COLORS[600],
    };
  }

  return markedDates;
}

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
    <View className="mb-1 mt-3 flex-row flex-wrap justify-center gap-3 px-2">
      {types.map((type) => (
        <View key={type} className="flex-row items-center">
          <View
            className="mr-1.5 h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: SCHEDULE_DOT_COLORS[type] }}
          />
          <Text className="text-xs text-gray-600 dark:text-gray-400">{labels[type]}</Text>
        </View>
      ))}
    </View>
  );
}

function CalendarWeekdayHeader() {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const weekdayTextClassName = isDarkMode
    ? 'text-xs font-medium text-gray-400'
    : 'text-xs font-medium text-gray-500';

  return (
    <View className="px-4 pb-2 pt-4">
      <View className="flex-row">
        {CALENDAR_WEEKDAYS.map((day) => (
          <View key={day} className="flex-1 items-center">
            <Text className={weekdayTextClassName}>{day}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CalendarView({
  schedules,
  selectedDate,
  currentMonth,
  onDateSelect,
  onMonthChange,
}: CalendarViewProps) {
  const { isDarkMode, mode } = useThemeStore();
  const theme = isDarkMode ? darkCalendarTheme : calendarTheme;

  const markedDates = useMemo(
    () => convertToMarkedDates(schedules, selectedDate),
    [schedules, selectedDate]
  );

  const usedTypes = useMemo(() => {
    const types = new Set<ScheduleType>();
    schedules.forEach((schedule) => types.add(schedule.type));
    return Array.from(types);
  }, [schedules]);

  const handleDayPress = useCallback(
    (day: DateData) => {
      onDateSelect(day.dateString);
    },
    [onDateSelect]
  );

  const handleMonthChange = useCallback(
    (month: DateData) => {
      onMonthChange(month.year, month.month);
    },
    [onMonthChange]
  );

  const currentMonthString = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`;

  return (
    <View className="mx-4 overflow-hidden rounded-xl bg-white dark:bg-surface">
      <Calendar
        key={`${currentMonthString}-${mode}`}
        current={currentMonthString}
        customHeader={CalendarWeekdayHeader}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markedDates={markedDates}
        markingType="multi-dot"
        enableSwipeMonths
        monthFormat="yyyy년 M월"
        theme={theme}
        firstDay={0}
        hideExtraDays={false}
        showSixWeeks={false}
      />

      {usedTypes.length > 0 ? <CalendarLegend types={usedTypes} /> : null}
    </View>
  );
}

export default CalendarView;
