/**
 * ScheduleSection — 주문서 "일정 · 모집" 섹션 (설계 §3.2·§3.9)
 *
 * @description 구 3행(날짜/시간/역할) + 3지 세그먼트를 대체한다. 사장은 **사실만** 입력하고
 * (날짜 요약 행 → 시간·역할 시트) 그룹은 조건 시그니처로 시스템이 도출한다. 화면 구조는
 *
 *   [날짜 요약 행]  8/10 8/11 8/12 8/13   4일 ›
 *   ── 조건 카드 × 시그니처 클래스 ──
 *
 * 로, 최빈 케이스(전 날짜 동일 조건)에서는 카드가 1개라 현행과 같은 밀도로 축약된다(F1).
 *
 * OrderSheetScreen 에서 분리한 이유: 그 파일이 1,200줄이라 800줄 규칙을 이미 넘겼다(CEO-S5).
 * 이 컴포넌트는 상태를 갖지 않는다 — 뮤테이션은 전부 상위 confirm 핸들러가 수행하고
 * (normalizeScheduleGroups 통과) 여기는 결과를 그린다.
 */
import React from 'react';
import { View } from 'react-native';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';
import { OrderGroup } from './OrderGroup';
import { ScheduleDateSummaryRow } from './ScheduleDateSummaryRow';
import { ScheduleConditionCard } from './ScheduleConditionCard';
import { summarizeTotalRoles, type OrderRowKey } from './orderRowMeta';

export interface ScheduleSectionProps {
  values: OrderSheetFormValues;
  /** 행 에러 조회 — OrderSheetScreen 의 rowError 위임(카드 인덱스 = 그룹 인덱스, §3.6) */
  rowError: (key: OrderRowKey, groupIndex: number) => string | undefined;
  /** F2 — 날짜 칩 탭으로 지목된 카드 */
  highlightedCardIndex: number | null;
  onPressDates: () => void;
  onPressDateChip: (date: string) => void;
  onPressCondition: (groupIndex: number) => void;
  onToggleRun: (groupIndex: number, run: string[], on: boolean) => void;
  onDeleteCard: (groupIndex: number) => void;
  /** F2 스크롤 앵커 — 카드의 섹션 내 y 좌표 통지 */
  onCardLayoutY?: (groupIndex: number, y: number) => void;
}

export function ScheduleSection({
  values,
  rowError,
  highlightedCardIndex,
  onPressDates,
  onPressDateChip,
  onPressCondition,
  onToggleRun,
  onDeleteCard,
  onCardLayoutY,
}: ScheduleSectionProps) {
  const groups = values.scheduleGroups ?? [];
  const dates = [...new Set(groups.flatMap((g) => g.dates ?? []))].sort();
  const hasCondition = groups.some((g) => (g.timeSlots ?? []).length > 0);
  /**
   * 빈 상태(F4) = 날짜도 조건도 없는 **초기** 상태. 날짜가 0이어도 조건이 남아 있으면
   * (템플릿 프리셋이 조건만 있는 빈 그룹을 만든다 — normalize 규칙 0 이 보존하는 그 값)
   * 카드를 숨기지 않는다. 숨기면 사장은 자기 템플릿 조건이 사라진 줄 알고, 제출 시에는
   * dates.min(1) 에러가 **화면에 표시할 카드 없이** 뜬다.
   */
  const isEmpty = dates.length === 0 && !hasCondition;

  const datesError = groups.reduce<string | undefined>(
    (found, _g, gi) => found ?? rowError('dates', gi),
    undefined
  );

  return (
    <OrderGroup
      title="일정 · 모집"
      caption={groups.length > 1 ? summarizeTotalRoles(values) || undefined : undefined}
    >
      <ScheduleDateSummaryRow
        dates={dates}
        {...(datesError !== undefined ? { error: datesError } : {})}
        onPress={onPressDates}
        onPressChip={onPressDateChip}
      />
      {isEmpty ? null : (
        <View className="border-t border-secondary-100 dark:border-surface-overlay">
          {groups.map((group, gi) => {
            const conditionError = rowError('time', gi) ?? rowError('roles', gi);
            return (
              <ScheduleConditionCard
                key={`schedule-card-${gi}`}
                group={group}
                index={gi}
                showHeader={groups.length > 1}
                highlighted={highlightedCardIndex === gi}
                {...(conditionError !== undefined ? { conditionError } : {})}
                onPressCondition={onPressCondition}
                onToggleRun={onToggleRun}
                onDelete={onDeleteCard}
                {...(onCardLayoutY !== undefined ? { onLayoutY: onCardLayoutY } : {})}
              />
            );
          })}
        </View>
      )}
    </OrderGroup>
  );
}
