/**
 * UNIQN Mobile - Calendar view component
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData, MarkedDates } from 'react-native-calendars/src/types';
import { PRIMARY_COLORS, SECONDARY_PALETTE, TEXT_COLORS } from '@/constants/colors';
import { WEEKDAYS_KO } from '@/constants/weekdays';
import { useThemeStore } from '@/stores/themeStore';
// 라벨은 shared/status 한 곳에서만 만든다 — 예전에는 이 파일이 같은 표를 두 번 하드코딩해
// 상태를 하나 늘릴 때마다 세 곳이 조용히 어긋날 수 있었다.
import { SCHEDULE_TYPE_LABELS } from '@/shared/status';
import { SCHEDULE_STATUS, getStatusHexColor } from '@/constants/statusConfig';
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
  selectedDotColor?: string;
}

/**
 * 같은 계열에서 덜 급한 쪽에 얹는 hex8 알파(45%).
 *
 * 색상만으로 가르면 색약 사용자에게는 구분이 사라진다. 휘도 축을 하나 더 줘서
 * 지원 중(vs 확정) · 취소(vs 노쇼)를 색 단독에 의존하지 않고 구분한다.
 */
const PALE_DOT_ALPHA = '73';

/**
 * 상태 → 점 색. 값을 여기서 따로 정하지 않는다 — 예전엔 원시 hex 를 직접 조합한
 * 독립 매핑이라 배지(SCHEDULE_STATUS)와 어긋났다(completed 가 배지=회색인데 점은 골드).
 * SCHEDULE_STATUS 를 단일 소스로 두고 위 알파 규칙만 얹는다. 범례도 이 상수를 참조한다.
 */
const SCHEDULE_DOT_COLORS: Record<ScheduleType, string> = {
  applied: `${getStatusHexColor(SCHEDULE_STATUS, 'applied')}${PALE_DOT_ALPHA}`,
  confirmed: getStatusHexColor(SCHEDULE_STATUS, 'confirmed'),
  completed: getStatusHexColor(SCHEDULE_STATUS, 'completed'),
  cancelled: `${getStatusHexColor(SCHEDULE_STATUS, 'cancelled')}${PALE_DOT_ALPHA}`,
  no_show: getStatusHexColor(SCHEDULE_STATUS, 'no_show'),
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

/** 점이 3개를 넘칠 때 무엇을 남길지 — 지금 행동이 필요한 순서 */
const DOT_PRIORITY: ScheduleType[] = [
  'confirmed',
  'applied',
  // 노쇼는 이의 제기 기한이 있는 유일한 과거 항목이라 완료·취소보다 먼저 남긴다.
  'no_show',
  'completed',
  'cancelled',
];
const MAX_DOTS = 3;

function getDotsForSchedules(schedules: ScheduleEvent[]): DotInfo[] {
  const typeSet = new Set<ScheduleType>();
  schedules.forEach((schedule) => typeSet.add(schedule.type));

  // 예전엔 Set 순회 순서를 그대로 잘라 4종이 겹치면 아무거나 하나가 조용히 빠졌다.
  // 지금 행동이 필요한 것(확정 > 지원 중)부터 남긴다.
  return DOT_PRIORITY.filter((type) => typeSet.has(type))
    .slice(0, MAX_DOTS)
    .map((type) => ({
      key: type,
      color: SCHEDULE_DOT_COLORS[type],
      // 선택된 날짜 셀은 배경이 골드라 원래 색 점이 묻혀 사라진다. 라이브러리는
      // multi-dot 경로에서 테마의 selectedDotColor 를 무시하고 marking 값만 본다.
      selectedDotColor: '#FFFFFF',
    }));
}

/** '7월 13일, 확정 1건 · 지원 중 1건' — 날짜 뒤에 붙어 낭독된다. */
function buildDayAccessibilityLabel(date: string, schedules: ScheduleEvent[]): string {
  const counts = new Map<ScheduleType, number>();
  schedules.forEach((schedule) => {
    counts.set(schedule.type, (counts.get(schedule.type) ?? 0) + 1);
  });

  const [, month, day] = date.split('-');
  const summary = Array.from(counts.entries())
    .map(([type, count]) => `${SCHEDULE_TYPE_LABELS[type]} ${count}건`)
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
  return (
    <View className="mb-1 mt-3 flex-row flex-wrap justify-center gap-3 px-2">
      {types.map((type) => (
        <View key={type} className="flex-row items-center">
          <View
            className="mr-1.5 h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: SCHEDULE_DOT_COLORS[type] }}
          />
          <Text className="text-xs text-content-muted dark:text-secondary-400 font-sans">
            {SCHEDULE_TYPE_LABELS[type]}
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
