/**
 * UNIQN Mobile - DateCalendar
 *
 * @description 일반 공고 탭 날짜 필터의 상태머신 컴포넌트.
 *   - 마운트: 항상 collapsed (selectedDate 무관 — 사용자가 명시적으로 펼쳐야 달력 노출)
 *   - 날짜 셀 탭 → onDateSelect + collapsed
 *   - CalendarHeader 월 이름 ▲ 탭 → collapsed (선택 유지)
 *   - CollapsedHeader 좌측 탭 → expanded 복귀
 *   - CollapsedHeader ✕ → onDateSelect(null) + expanded
 *   - CalendarHeader "전체 보기" 탭 → onDateSelect(null), expanded 유지
 * @version 1.2.0
 *
 * 월 범위: 오늘의 전월 1일 ~ 오늘의 +3개월 말일 (spec 결정 #2).
 * 폴리시:
 *   - (Rule 16) 카운트 로딩 중 셀 뱃지 위치에 SkeletonText 표시
 *   - (Rule 10) 에러 시 그리드 하단 인라인 메시지 + '다시 시도' 버튼
 *   - (Rule  8) 접기/펼치기 LayoutAnimation (300ms/225ms) + Reduce Motion 대응
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
  View,
} from 'react-native';
import { addMonths, isBefore, isAfter, startOfMonth, subMonths, format } from 'date-fns';
import { useRegularDateCounts } from '@/hooks/useRegularDateCounts';
import { CalendarHeader } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { CollapsedHeader } from './CollapsedHeader';

// Android에서 LayoutAnimation 활성화 필요
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// 접기/펼치기 애니메이션 설정 (Rule 8: entrance 300ms / exit 225ms)
// 함수로 생성 — 모듈 레벨 상수는 Jest 환경에서 LayoutAnimation 미초기화 문제 유발
// LayoutAnimation.create가 없을 때(Jest 환경) 기본 configureNext preset 사용
function createExpandAnimation(): Parameters<typeof LayoutAnimation.configureNext>[0] {
  if (typeof LayoutAnimation.create === 'function') {
    return LayoutAnimation.create(
      300,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    );
  }
  return LayoutAnimation.Presets.easeInEaseOut;
}

function createCollapseAnimation(): Parameters<typeof LayoutAnimation.configureNext>[0] {
  if (typeof LayoutAnimation.create === 'function') {
    return LayoutAnimation.create(
      225,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    );
  }
  return LayoutAnimation.Presets.easeInEaseOut;
}

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
  const [mode, setMode] = useState<Mode>('collapsed');
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    selectedDate ? startOfMonth(selectedDate) : startOfMonth(new Date())
  );

  // Reduce Motion 감지 (Rule 8)
  const reduceMotionRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) reduceMotionRef.current = enabled;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
      reduceMotionRef.current = enabled;
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  // 월 범위 경계 (spec 결정 #2: -1 ~ +3개월)
  const { minMonth, maxMonth } = useMemo(() => {
    const today = new Date();
    return {
      minMonth: startOfMonth(subMonths(today, 1)),
      maxMonth: startOfMonth(addMonths(today, 3)),
    };
  }, []);

  // strict 비교 — 경계 달에 도달하면 이동 불가 (spec: -1 ~ +3개월)
  const canGoPrev = isAfter(visibleMonth, minMonth);
  const canGoNext = isBefore(visibleMonth, maxMonth);

  const { data: counts = {}, isLoading, isError, refetch } = useRegularDateCounts(visibleMonth);

  const triggerExpandAnimation = useCallback(() => {
    if (!reduceMotionRef.current && typeof LayoutAnimation.configureNext === 'function') {
      LayoutAnimation.configureNext(createExpandAnimation());
    }
  }, []);

  const triggerCollapseAnimation = useCallback(() => {
    if (!reduceMotionRef.current && typeof LayoutAnimation.configureNext === 'function') {
      LayoutAnimation.configureNext(createCollapseAnimation());
    }
  }, []);

  const handleDateSelect = useCallback(
    (date: Date) => {
      triggerCollapseAnimation();
      onDateSelect(date);
      setMode('collapsed');
    },
    [onDateSelect, triggerCollapseAnimation]
  );

  const handleExpand = useCallback(() => {
    triggerExpandAnimation();
    setMode('expanded');
  }, [triggerExpandAnimation]);

  const handleCollapseFromHeader = useCallback(() => {
    triggerCollapseAnimation();
    setMode('collapsed');
  }, [triggerCollapseAnimation]);

  const handleClearSelection = useCallback(() => {
    triggerExpandAnimation();
    onDateSelect(null);
    setMode('expanded');
  }, [onDateSelect, triggerExpandAnimation]);

  const handlePrevMonth = useCallback(() => {
    setVisibleMonth((m) => subMonths(m, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setVisibleMonth((m) => addMonths(m, 1));
  }, []);

  if (mode === 'collapsed') {
    const key = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
    const count = key ? (counts[key] ?? 0) : 0;
    return (
      <View className={className}>
        <CollapsedHeader
          selectedDate={selectedDate}
          visibleMonth={visibleMonth}
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
        onCollapse={handleCollapseFromHeader}
      />
      <CalendarGrid
        visibleMonth={visibleMonth}
        selectedDate={selectedDate}
        counts={counts}
        onDateSelect={handleDateSelect}
        isLoading={isLoading}
      />
      {/* 에러 인라인 메시지 (Rule 10) */}
      {isError && (
        <View className="px-4 py-3 flex-row items-center justify-between bg-error-50 dark:bg-error-900/20">
          <Text className="flex-1 text-sm text-content-primary dark:text-content-primary">
            공고 수를 불러오지 못했어요. 다시 시도해주세요.
          </Text>
          <Pressable
            onPress={() => void refetch()}
            hitSlop={10}
            className="ml-3 px-3 py-1.5 rounded-sm active:bg-secondary-100 dark:active:bg-surface-hover"
            accessibilityRole="button"
            accessibilityLabel="공고 개수 다시 불러오기"
          >
            <Text className="text-xs font-sans-semibold text-primary-500">다시 시도</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

export default DateCalendar;
