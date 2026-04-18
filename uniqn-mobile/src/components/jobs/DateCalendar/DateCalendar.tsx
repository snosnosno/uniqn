/**
 * UNIQN Mobile - DateCalendar
 *
 * @description 일반 공고 탭 날짜 필터의 상태머신 컴포넌트.
 *   - 마운트: selectedDate=null → expanded, selectedDate 있음 → collapsed
 *   - 날짜 셀 탭 → onDateSelect + collapsed
 *   - CollapsedHeader 탭 → expanded 복귀
 *   - CollapsedHeader ✕ → onDateSelect(null) + expanded
 *   - 외부 selectedDate=null로 변경 → expanded 동기화
 * @version 1.0.0
 *
 * 월 범위: 오늘의 전월 1일 ~ 오늘의 +3개월 말일 (spec 결정 #2).
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { addMonths, isBefore, isAfter, startOfMonth, subMonths, format } from 'date-fns';
import { useRegularDateCounts } from '@/hooks/useRegularDateCounts';
import { CalendarHeader } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { CollapsedHeader } from './CollapsedHeader';

interface DateCalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  className?: string;
}

type Mode = 'expanded' | 'collapsed';

export const DateCalendar = memo(function DateCalendar({
  selectedDate,
  onDateSelect,
  className = '',
}: DateCalendarProps) {
  const [mode, setMode] = useState<Mode>(selectedDate ? 'collapsed' : 'expanded');
  // collapsed 렌더에 사용할 날짜 — prop이 uncontrolled로 null로 고정돼도 내부적으로 유지
  const [internalSelected, setInternalSelected] = useState<Date | null>(selectedDate);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    selectedDate ? startOfMonth(selectedDate) : startOfMonth(new Date())
  );

  // 월 범위 경계 (spec 결정 #2: -1 ~ +3개월)
  const { minMonth, maxMonth } = useMemo(() => {
    const today = new Date();
    return {
      minMonth: startOfMonth(subMonths(today, 1)),
      maxMonth: startOfMonth(addMonths(today, 3)),
    };
  }, []);

  const canGoPrev = isAfter(visibleMonth, minMonth);
  const canGoNext = isBefore(visibleMonth, maxMonth);

  // 외부 selectedDate=null 변경 시 expanded 동기화
  useEffect(() => {
    if (selectedDate === null) {
      setMode('expanded');
      setInternalSelected(null);
    } else {
      setInternalSelected(selectedDate);
    }
  }, [selectedDate]);

  // collapsed 렌더에 사용할 날짜: prop이 있으면 우선, 없으면 내부 상태
  const displayDate = selectedDate ?? internalSelected;

  const { data: counts = {} } = useRegularDateCounts(visibleMonth);

  const handleDateSelect = useCallback(
    (date: Date) => {
      onDateSelect(date);
      setInternalSelected(date);
      setMode('collapsed');
    },
    [onDateSelect]
  );

  const handleExpand = useCallback(() => setMode('expanded'), []);

  const handleClearSelection = useCallback(() => {
    onDateSelect(null);
    setInternalSelected(null);
    setMode('expanded');
  }, [onDateSelect]);

  const handlePrevMonth = useCallback(() => {
    setVisibleMonth((m) => subMonths(m, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setVisibleMonth((m) => addMonths(m, 1));
  }, []);

  if (mode === 'collapsed' && displayDate) {
    const key = format(displayDate, 'yyyy-MM-dd');
    const count = counts[key] ?? 0;
    return (
      <View className={className}>
        <CollapsedHeader
          selectedDate={displayDate}
          count={count}
          onExpand={handleExpand}
          onClear={handleClearSelection}
        />
      </View>
    );
  }

  return (
    <View
      className={`bg-surface-card dark:bg-surface-elevated border-b border-divider ${className}`}
    >
      <CalendarHeader
        visibleMonth={visibleMonth}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        hasSelection={selectedDate !== null}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        onClearSelection={handleClearSelection}
      />
      <CalendarGrid
        visibleMonth={visibleMonth}
        selectedDate={selectedDate}
        counts={counts}
        onDateSelect={handleDateSelect}
      />
    </View>
  );
});

export default DateCalendar;
