/**
 * ScheduleDateSummaryRow — 일정 섹션 날짜 요약 행 (설계 §3.2·§3.8·F2·F4)
 *
 * @description 사장이 "그룹"을 고르는 대신 **날짜만** 고르는 자리. 행 전체 탭은 날짜 모달을
 * 열고(추가·해제), 개별 칩 탭은 그 날짜가 속한 조건 카드로 데려간다(F2 — 예외 추출 제2 진입로).
 * 날짜가 하나도 없으면 카드·토글 없이 단일 CTA 로 축약한다(F4).
 *
 * ⚠️ testID `order-sheet-row-dates` 는 빈 상태에서도 유지해야 한다 —
 *    `e2e/tests/p1-important/employer-posting-crud.spec.ts:212·258` 이 공고 작성 화면 진입 직후
 *    이 행의 가시성을 확인한다(e2e 는 `npm run quality` 범위 밖이라 깨져도 로컬에서 안 잡힌다).
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRightIcon } from '@/components/icons';

/**
 * 접힘 상태에서 보여줄 칩 수 — 2줄 근사치.
 * 정확한 2줄 판정은 onLayout 측정이 필요한데, 대회(30일) 케이스에서 세로 폭 폭주만 막으면
 * 충분하므로 개수로 근사한다(375pt 기준 한 줄 약 6개 × 2줄).
 */
const COLLAPSED_CHIP_LIMIT = 12;

/** 'YYYY-MM-DD' → '8/10'. 문자열만 다뤄 Date 왕복(타임존 밀림)이 없다. */
const toMonthDay = (ymd: string): string => {
  const [, month, day] = ymd.split('-');
  return `${Number(month)}/${Number(day)}`;
};

const toSpokenDate = (ymd: string): string => {
  const [, month, day] = ymd.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
};

export interface ScheduleDateSummaryRowProps {
  /** 전 카드의 날짜 합집합(정렬됨) */
  dates: string[];
  /** 전 카드 dates 에러 합산 — 요약 행에 표시 */
  error?: string;
  onPress: () => void;
  onPressChip: (date: string) => void;
}

export function ScheduleDateSummaryRow({
  dates,
  error,
  onPress,
  onPressChip,
}: ScheduleDateSummaryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, dates.length - COLLAPSED_CHIP_LIMIT);
  const shown = expanded || hidden === 0 ? dates : dates.slice(0, COLLAPSED_CHIP_LIMIT);

  if (dates.length === 0) {
    return (
      <Pressable
        onPress={onPress}
        className="flex-row items-center px-4 py-3 min-h-[44px] active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`날짜를 골라 시작하세요${error ? `, 오류: ${error}` : ''}`}
        testID="order-sheet-row-dates"
      >
        <Text className="flex-1 text-sm font-sans-medium text-content-primary">
          날짜를 골라 시작하세요
        </Text>
        {error ? (
          <Text className="mr-1 text-[11px] font-sans text-error-500 dark:text-error-400">
            {error}
          </Text>
        ) : null}
        <ChevronRightIcon size={16} />
      </Pressable>
    );
  }

  return (
    <View className="px-4 py-2.5">
      <Pressable
        onPress={onPress}
        className="flex-row items-center min-h-[44px] active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`선택한 날짜 ${dates.map(toSpokenDate).join(', ')}, 총 ${
          dates.length
        }일, 탭하여 날짜 추가 또는 해제${error ? `, 오류: ${error}` : ''}`}
        testID="order-sheet-row-dates"
      >
        <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
          {shown.map((date) => (
            <Pressable
              key={date}
              onPress={() => onPressChip(date)}
              hitSlop={6}
              className="rounded-full bg-surface-page dark:bg-surface px-2.5 py-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={`${toSpokenDate(date)} 일정으로 이동`}
              testID={`order-sheet-date-chip-${date}`}
            >
              <Text className="text-xs font-sans-medium text-content-primary">
                {toMonthDay(date)}
              </Text>
            </Pressable>
          ))}
          {hidden > 0 ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              hitSlop={6}
              className="rounded-full px-2.5 py-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={expanded ? '날짜 접기' : `나머지 ${hidden}일 더 보기`}
              testID="order-sheet-dates-expand"
            >
              <Text className="text-xs font-sans-medium text-primary-600 dark:text-primary-400">
                {expanded ? '접기' : `외 ${hidden}일`}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="ml-2 text-xs font-sans text-content-secondary">{`${dates.length}일`}</Text>
        <ChevronRightIcon size={16} />
      </Pressable>
      {error ? (
        <Text className="mt-0.5 text-[11px] font-sans text-error-500 dark:text-error-400">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
