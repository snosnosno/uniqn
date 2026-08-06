/**
 * ScheduleConditionCard — 조건 카드 1개 (설계 §3.2·§3.5·§3.9 F1·F5·F7·F12·F13)
 *
 * @description 카드 = 정규화 결과의 그룹. 카드 수와 경계는 사장이 고르는 게 아니라 **조건이
 * 정한다**. 카드 안에는 ① 조건 요약 행(탭=시간·역할 시트) ② 연속 run 마다 묶음지원 토글
 * ③ 예외 추출 진입이 들어간다.
 *
 * 중첩 카드 금지(impeccable §6) — 카드 경계는 디바이더로만 표현한다. 카드가 1개면 헤더의
 * 날짜 재표기를 생략해 최빈 케이스의 밀도를 현행과 같게 유지한다(F1).
 */
import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { CalendarDaysIcon, ChevronRightIcon, XMarkIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { groupConsecutiveDates } from '@/utils/date';
import { isSlotTimeSet, roleName, slotHasRoles, summarizeGroupDates } from './orderRowMeta';
import type { ScheduleGroup } from '@/utils/order-sheet/normalizeScheduleGroups';

/** 카드 조건 한 줄 — 시간·역할을 합쳐 요약한다. 미설정은 에러(빨강)가 아니라 muted 안내다(F5). */
export function summarizeCardCondition(group: ScheduleGroup): {
  text: string;
  incomplete: boolean;
} {
  const slots = group.timeSlots ?? [];
  const timeSet = slots.length > 0 && slots.every(isSlotTimeSet);
  const rolesSet = slots.length > 0 && slots.every(slotHasRoles);
  if (!timeSet && !rolesSet) return { text: '시간과 역할을 정해주세요', incomplete: true };

  const timePart = timeSet
    ? slots.map((s) => (s.isTimeToBeAnnounced === true ? '미정' : s.startTime)).join(' · ')
    : '시간을 정해주세요';

  const totals = new Map<string, number>();
  for (const slot of slots) {
    for (const r of slot.roles) {
      const name = roleName(r.role, r.customRole);
      totals.set(name, (totals.get(name) ?? 0) + r.count);
    }
  }
  const rolePart = rolesSet
    ? [...totals.entries()].map(([name, count]) => `${name} ${count}`).join(' · ')
    : '역할을 정해주세요';

  return { text: `${timePart} · ${rolePart}`, incomplete: !timeSet || !rolesSet };
}

/** 카드 안에서 묶음지원 토글을 붙일 연속 구간(길이 2 이상)만 */
export const groupableRuns = (dates: string[]): string[][] =>
  groupConsecutiveDates(dates).filter((run) => run.length > 1);

export interface ScheduleConditionCardProps {
  group: ScheduleGroup;
  index: number;
  /** 카드 1개면 헤더 날짜 재표기·삭제 버튼을 생략한다(F1·E4) */
  showHeader: boolean;
  /** F2 칩 탭으로 지목된 카드 */
  highlighted: boolean;
  conditionError?: string;
  onPressCondition: (index: number) => void;
  onToggleRun: (index: number, run: string[], on: boolean) => void;
  onPressException: (index: number) => void;
  onDelete: (index: number) => void;
  onLayoutY?: (index: number, y: number) => void;
}

export function ScheduleConditionCard({
  group,
  index,
  showHeader,
  highlighted,
  conditionError,
  onPressCondition,
  onToggleRun,
  onPressException,
  onDelete,
  onLayoutY,
}: ScheduleConditionCardProps) {
  const dates = group.dates ?? [];
  const summary = summarizeGroupDates(dates);
  const condition = summarizeCardCondition(group);
  // grouped 카드는 정규화상 연속 run 하나다(규칙 2) — 그 카드의 토글은 켜진 상태로 렌더된다.
  const grouped = group.grouped ?? false;
  const runs = grouped ? [dates] : groupableRuns(dates);

  return (
    <View
      onLayout={(e) => onLayoutY?.(index, e.nativeEvent.layout.y)}
      className={highlighted ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
      testID={`order-sheet-card-${index}`}
    >
      {index > 0 ? <View className="h-px bg-secondary-100 dark:bg-surface-overlay" /> : null}
      {showHeader ? (
        <View
          className="flex-row items-center pl-4 pr-1 pt-1.5"
          testID={`order-sheet-card-header-${index}`}
        >
          <Text className="flex-1 text-sm font-sans-bold text-content-primary dark:text-off-white">
            {summary || '날짜 미설정'}
          </Text>
          <Pressable
            onPress={() => onDelete(index)}
            hitSlop={14}
            className="h-8 w-8 items-center justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel={`${summary || '이'} 날짜들 삭제`}
            testID={`order-sheet-card-delete-${index}`}
          >
            <XMarkIcon size={16} />
          </Pressable>
        </View>
      ) : null}
      {!showHeader && dates.length === 0 ? (
        <Text className="px-4 pt-2 text-sm font-sans-bold text-content-primary dark:text-off-white">
          날짜 미설정
        </Text>
      ) : null}
      <Pressable
        onPress={() => onPressCondition(index)}
        className="min-h-[44px] flex-row items-center px-4 py-3 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`${summary || '날짜 미설정'} 일정의 시간과 역할, ${condition.text}, 탭하여 편집${
          conditionError ? `, 오류: ${conditionError}` : ''
        }`}
        testID={`order-sheet-card-condition-${index}`}
      >
        <Text
          // 삼항 **안**의 dark: 변형은 정적 추출이 안 된다 — 분기마다 완결된 리터럴을 고른다
          // (nativewind-patterns 규칙 1·3 · darkModePairRatchet 주석 15-16).
          className={
            condition.incomplete
              ? 'flex-1 text-sm font-sans-medium text-content-muted dark:text-content-muted'
              : 'flex-1 text-sm font-sans-medium text-content-primary dark:text-content-primary'
          }
          numberOfLines={2}
        >
          {condition.text}
        </Text>
        {conditionError ? (
          <Text className="mr-1 text-[11px] font-sans text-error-500 dark:text-error-400">
            {conditionError}
          </Text>
        ) : null}
        <ChevronRightIcon size={16} />
      </Pressable>
      {runs.map((run, runIndex) => {
        const runLabel = summarizeGroupDates(run);
        return (
          <View
            key={run[0]}
            className="min-h-[44px] flex-row items-center gap-2 px-4 py-1.5"
            testID={`order-sheet-card-run-${index}-${runIndex}`}
          >
            <View className="flex-1">
              <Text className="text-sm font-sans text-content-primary dark:text-off-white">
                {`${runLabel} 통째로 지원받기`}
              </Text>
              <Text className="text-[11px] font-sans text-content-muted">하루만 지원 불가</Text>
            </View>
            <Switch
              value={grouped}
              onValueChange={(next) => onToggleRun(index, run, next)}
              trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
              thumbColor={grouped ? '#FFFFFF' : SECONDARY_PALETTE[50]}
              accessibilityRole="switch"
              accessibilityLabel={`${runLabel} 통째로 지원받기. 켜면 ${runLabel} 전부 나올 수 있는 사람만 지원할 수 있어요. 하루만 지원 불가`}
              testID={`order-sheet-card-run-toggle-${index}-${runIndex}`}
            />
          </View>
        );
      })}
      {dates.length > 1 ? (
        <View className="px-4 pb-3 pt-1">
          <Pressable
            onPress={() => onPressException(index)}
            className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl border border-secondary-200 px-3 py-2 active:opacity-80 dark:border-surface-overlay"
            accessibilityRole="button"
            accessibilityLabel="이 일정에서 일부 날짜만 다른 조건으로 나누기"
            testID={`order-sheet-card-exception-${index}`}
          >
            {/* 레포에 분기(⑂) 아이콘이 없다 — 날짜를 골라 나눈다는 의미로 캘린더 아이콘 대체.
                ghost 금지(F7①): 보더 + 본문색 텍스트로 어포던스를 명시한다. */}
            <CalendarDaysIcon size={14} />
            <Text className="text-sm font-sans-medium text-content-secondary">
              일부 날짜만 다르게
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
