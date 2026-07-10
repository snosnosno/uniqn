/**
 * UNIQN Mobile - CalendarCell
 *
 * @description 달력 단일 날짜 셀 — 날짜 숫자 + 카운트 뱃지 + 오늘/선택/과거 상태
 * @version 1.1.0
 *
 * 스타일 결정 트리:
 *   isOutsideMonth   → opacity-30, disabled
 *   loading=true     → 뱃지 위치에 SkeletonText (shimmer) 표시
 *   count === 0      → 뱃지 없음, disabled
 *   isSelected       → bg-primary-500, text-content-onGold, 뱃지 bg-[rgba(9,9,11,0.2)]
 *   isToday          → border-2 border-primary-500, 뱃지 bg-primary-500/15
 *   과거 + count>0   → opacity-60, 탭 가능, 뱃지 bg-primary-500/15
 *   기본             → 탭 가능, 뱃지 bg-primary-500/15
 *
 * 그리드 모드(gridCell prop 제공 시, weekly_grid_enabled 플래그 뒤):
 *   - U2 우선순위 단일 뱃지(부족>공고>배치)만 렌더(priorityBadge SSOT)
 *   - U1 a11y: 색상 단독 금지 → 글리프(아이콘)+숫자 병기, a11y 라벨에 "부족/공고/배치 N"
 *   - U3: status별 셀 배경 틴트는 Midnight Craft 토큰 팔레트 리터럴 클래스만(자유 hex 금지)
 *   - gridCell 없으면 기존 count 동작 100% 유지(무회귀)
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { triggerHaptic } from '@/utils/haptics';
import { Skeleton } from '@/components/ui/Skeleton';
// 뱃지 표시 메타(글리프/라벨/토큰 클래스)는 도메인 SSOT — 범례(GridBadgeLegend)와 공유(P0-3).
import { GRID_BADGE_META, type GridDayCell } from '@/domains/weeklyGrid';

interface CalendarCellProps {
  date: Date;
  count: number;
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  onPress: (date: Date) => void;
  testID?: string;
  /** true일 때 뱃지 위치에 Skeleton shimmer 표시 (Rule 16) */
  loading?: boolean;
  /**
   * 주간 그리드 셀 데이터(weekly_grid_enabled 플래그 뒤). 제공되면 그리드 모드로 동작:
   * priorityBadge/status 기반 렌더. 미제공이면 기존 count 동작 100% 유지(무회귀).
   */
  gridCell?: GridDayCell;
}

export const CalendarCell = memo(function CalendarCell({
  date,
  count,
  isToday,
  isSelected,
  isOutsideMonth,
  onPress,
  testID,
  loading = false,
  gridCell,
}: CalendarCellProps) {
  const gridMode = gridCell !== undefined;
  // 그리드 모드: 운영 도구라 월내 모든 날짜 탭 가능(빈 날=배치 추가 진입).
  // 비그리드 모드: 기존 규칙 유지(공고 0건이면 disabled) → 무회귀.
  const disabled = gridMode ? isOutsideMonth : isOutsideMonth || count === 0;
  const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
  const dayNumber = format(date, 'd');
  const fullLabel = format(date, 'M월 d일 EEEE', { locale: ko });
  const countLabel = count > 0 ? `공고 ${count}건` : '공고 없음';

  const handlePress = useCallback(() => {
    if (disabled) return;
    void triggerHaptic('light');
    onPress(date);
  }, [date, disabled, onPress]);

  // U3: 그리드 status별 셀 배경 틴트(토큰 리터럴 클래스만). isSelected가 우선(기존 골드 하이라이트).
  const statusBg =
    gridCell !== undefined && !isSelected
      ? gridCell.status === 'shortage'
        ? 'bg-warning-500/10'
        : gridCell.status === 'staffed'
          ? 'bg-success-500/10'
          : ''
      : '';

  // P1-3: 그리드 모드는 셀 세로 압축(마진/패딩 축소) — 비그리드 모드는 기존 그대로(무회귀).
  // min-h-10(40px)은 터치타깃 하한(임페커블 룰5 — 인접 그리드 그룹 예외 40px) 준수를 위해 유지.
  // 두 갈래 모두 정적 리터럴(동적 조립 금지 — dark: 유실 방지).
  const containerBase = gridMode
    ? 'min-h-10 items-center justify-center rounded-sm mx-0.5 my-px py-0.5 active:bg-secondary-100 dark:active:bg-surface-hover'
    : 'min-h-10 items-center justify-center rounded-sm mx-0.5 my-0.5 py-1 active:bg-secondary-100 dark:active:bg-surface-hover';
  // 비그리드 모드: statusBg='' 라 기존 동작과 동일(isToday border 또는 빈 문자열).
  const containerState = isSelected
    ? 'bg-primary-500'
    : `${isToday ? 'border-2 border-primary-500' : ''} ${statusBg}`.trim();
  const opacityClass = isOutsideMonth ? 'opacity-30' : isPast && !isSelected ? 'opacity-60' : '';

  const numberColor = isSelected
    ? 'text-content-onGold'
    : isToday
      ? 'text-primary-500'
      : 'text-content-primary';

  // U2: 우선순위 압축 단일 뱃지(부족>공고>배치) — priorityBadge SSOT.
  const gridBadge = gridCell?.priorityBadge ?? null;
  const gridBadgeMeta = gridBadge ? GRID_BADGE_META[gridBadge.kind] : null;

  const badgeBase = 'rounded-sm px-1.5 py-0.5 mt-1 text-micro font-sans-medium';
  const badgeColor = isSelected
    ? 'bg-[rgba(9,9,11,0.2)] text-content-onGold'
    : gridMode && gridBadgeMeta
      ? gridBadgeMeta.tokenClass
      : 'bg-primary-500/25 text-primary-500';

  // U1 a11y: 그리드 모드는 "종류명 N단위"(색상 외 종류·수치 명시), 비그리드는 기존 "공고 N건".
  const a11yDetail = gridMode
    ? gridBadge && gridBadgeMeta
      ? `${gridBadgeMeta.label} ${gridBadge.count}${gridBadgeMeta.unit}`
      : '비어있음'
    : countLabel;

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${fullLabel} ${a11yDetail}`}
      accessibilityState={{ selected: isSelected, disabled }}
      className={`${containerBase} ${containerState} ${opacityClass}`}
    >
      <Text className={`text-sm font-sans-medium ${numberColor}`}>{dayNumber}</Text>
      {loading && !isOutsideMonth ? (
        <View className="mt-1">
          <Skeleton width={24} height={10} accessible={false} />
        </View>
      ) : gridMode ? (
        gridBadge !== null &&
        gridBadgeMeta !== null &&
        !isOutsideMonth && (
          <Text className={`${badgeBase} ${badgeColor}`}>
            {gridBadgeMeta.glyph}
            {gridBadge.count}
          </Text>
        )
      ) : (
        count > 0 &&
        !isOutsideMonth && <Text className={`${badgeBase} ${badgeColor}`}>{count}건</Text>
      )}
    </Pressable>
  );
});
