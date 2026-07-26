/**
 * UNIQN Mobile - Calendar view component
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData, MarkedDates } from 'react-native-calendars/src/types';
import { PRIMARY_COLORS, STATUS_COLORS, SECONDARY_PALETTE, TEXT_COLORS } from '@/constants/colors';
import { WEEKDAYS_KO } from '@/constants/weekdays';
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
  dayNamesShort: [...WEEKDAYS_KO],
  today: '오늘',
  // 지정하지 않으면 라이브러리가 'Monday 13 July 2026' 를 영어로 읽는다.
  formatAccessibilityLabel: 'yyyy년 M월 d일 dddd',
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
  // 지원 중은 반투명(hex8 알파 45%) 점: 확정(불투명)과 색상뿐 아니라 휘도 차이로도
  // 구분되게 해 색상 단독 의존을 완화한다(색약 대응). 범례도 같은 상수를 참조해 자동 일치.
  applied: `${STATUS_COLORS.warning}73`,
  confirmed: STATUS_COLORS.success,
  completed: PRIMARY_COLORS[500],
  cancelled: STATUS_COLORS.error,
};

const CALENDAR_WEEKDAYS = WEEKDAYS_KO;

const calendarTheme = {
  backgroundColor: 'transparent',
  calendarBackground: 'transparent',
  textSectionTitleColor: SECONDARY_PALETTE[500],
  textSectionTitleDisabledColor: SECONDARY_PALETTE[400],
  selectedDayBackgroundColor: PRIMARY_COLORS[600],
  selectedDayTextColor: '#FFFFFF',
  todayTextColor: PRIMARY_COLORS[600],
  dayTextColor: TEXT_COLORS.primary.light,
  textDisabledColor: SECONDARY_PALETTE[200],
  dotColor: PRIMARY_COLORS[500],
  selectedDotColor: '#FFFFFF',
  monthTextColor: TEXT_COLORS.primary.light,
  indicatorColor: PRIMARY_COLORS[500],
  arrowColor: SECONDARY_PALETTE[500],
  textDayFontSize: 14,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 12,
  textDayFontWeight: '400' as const,
  textMonthFontWeight: '600' as const,
  textDayHeaderFontWeight: '500' as const,
  // 날짜 셀 터치 타깃 44×44 (WCAG 2.5.5). 기본값 32 에 hitSlop 도 없어
  // 새벽 근무 후 한 손 조작에서 탭이 자주 먹지 않았다.
  'stylesheet.day.basic': {
    base: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
};

const darkCalendarTheme = {
  ...calendarTheme,
  textSectionTitleColor: SECONDARY_PALETTE[400],
  textSectionTitleDisabledColor: SECONDARY_PALETTE[500],
  todayTextColor: PRIMARY_COLORS[300],
  dayTextColor: TEXT_COLORS.primary.dark,
  textDisabledColor: SECONDARY_PALETTE[500],
  monthTextColor: TEXT_COLORS.primary.dark,
  arrowColor: SECONDARY_PALETTE[200],
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

const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  applied: '지원 중',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
};

/** '7월 13일, 확정 1건 · 지원 중 1건' — 날짜 뒤에 붙어 낭독된다. */
function buildDayAccessibilityLabel(date: string, schedules: ScheduleEvent[]): string {
  const counts = new Map<ScheduleType, number>();
  schedules.forEach((schedule) => {
    counts.set(schedule.type, (counts.get(schedule.type) ?? 0) + 1);
  });

  const [, month, day] = date.split('-');
  const summary = Array.from(counts.entries())
    .map(([type, count]) => `${SCHEDULE_TYPE_LABEL[type]} ${count}건`)
    .join(' · ');

  return `${Number(month)}월 ${Number(day)}일, ${summary || '일정 없음'}`;
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
      // 라이브러리는 marking.accessibilityLabel 을 최우선으로 읽는다. 이걸 주지 않으면
      // 건수도 상태(색 점)도 낭독되지 않아 스크린리더 사용자에겐 점이 존재하지 않는 것과 같다.
      accessibilityLabel: buildDayAccessibilityLabel(date, dateSchedules),
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
            className="mr-1.5 h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: SCHEDULE_DOT_COLORS[type] }}
          />
          <Text className="text-xs text-content-muted dark:text-secondary-400 font-sans">
            {labels[type]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CalendarWeekdayHeader() {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const weekdayTextClassName = isDarkMode
    ? 'text-xs font-sans-medium text-secondary-400'
    : 'text-xs font-sans-medium text-secondary-500';

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
    <View className="mx-4 overflow-hidden rounded-md bg-surface-card">
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
