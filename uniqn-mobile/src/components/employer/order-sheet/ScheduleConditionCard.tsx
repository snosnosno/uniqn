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
import Animated, { LinearTransition } from 'react-native-reanimated';
import { ChevronRightIcon, XMarkIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { MOTION_DURATION } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { groupConsecutiveDates } from '@/utils/date';
import { isSlotTimeSet, roleName, slotHasRoles, summarizeGroupDates } from './orderRowMeta';
import type { ScheduleGroup } from '@/utils/order-sheet/normalizeScheduleGroups';

/**
 * 카드 조건 요약 — **시간대(슬롯)마다 한 줄**이다.
 *
 *   미정 딜러 50
 *   19:00 딜러 60 플로어 10
 *
 * 구 표기는 시간을 전부 이어 붙이고 역할을 **전 슬롯 합산**해 한 줄로 냈다("미정 · 19:00 · 딜러 110").
 * 그러면 어느 시간대에 몇 명인지가 카드에서 사라진다 — 대회사가 "미정 50 / 19시 60" 처럼
 * 시간대별로 인원을 나눠 뽑는 것이 이 화면의 실제 용도인데 그 축이 통째로 뭉개졌다.
 *
 * 미설정은 에러(빨강)가 아니라 muted 안내다(F5). 판정은 슬롯 단위이므로 한 슬롯만 비어도
 * 그 줄에만 안내가 뜨고 나머지 줄은 정상 값을 유지한다.
 */
function summarizeCardCondition(group: ScheduleGroup): {
  lines: string[];
  incomplete: boolean;
} {
  const slots = group.timeSlots ?? [];
  if (slots.length === 0) return { lines: ['시간과 역할을 정해주세요'], incomplete: true };

  const lines = slots.map((slot) => {
    const timePart = isSlotTimeSet(slot)
      ? slot.isTimeToBeAnnounced === true
        ? '미정'
        : slot.startTime
      : '시간을 정해주세요';
    // 역할 합산은 **슬롯 안에서만** 한다 — 같은 슬롯에 같은 역할이 두 행으로 들어올 수 있다.
    const totals = new Map<string, number>();
    for (const r of slot.roles) {
      const name = roleName(r.role, r.customRole);
      totals.set(name, (totals.get(name) ?? 0) + r.count);
    }
    const rolePart = slotHasRoles(slot)
      ? [...totals.entries()].map(([name, count]) => `${name} ${count}`).join(' ')
      : '역할을 정해주세요';
    return `${timePart} ${rolePart}`;
  });

  return {
    lines,
    incomplete: slots.some((s) => !isSlotTimeSet(s) || !slotHasRoles(s)),
  };
}

/** 카드 안에서 묶음지원 토글을 붙일 연속 구간(길이 2 이상)만 */
const groupableRuns = (dates: string[]): string[][] =>
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
  onDelete,
  onLayoutY,
}: ScheduleConditionCardProps) {
  const dates = group.dates ?? [];
  const summary = summarizeGroupDates(dates);
  const condition = summarizeCardCondition(group);
  // grouped 카드는 정규화상 연속 run 하나다(규칙 2) — 그 카드의 토글은 켜진 상태로 렌더된다.
  // 단 날짜가 없으면(템플릿 조건 카드) 묶을 대상 자체가 없다 — 빈 라벨의 해제 불가 토글을
  // 그리지 않도록 방어한다(생산자 측 리셋은 mappers.templateToValues 가 담당).
  const grouped = group.grouped ?? false;
  const runs = grouped && dates.length > 1 ? [dates] : groupableRuns(dates);
  const reduceMotion = useReduceMotion();

  return (
    <Animated.View
      // 카드가 합쳐지고 갈라질 때 위치가 순간이동하면 사장은 무슨 일이 일어났는지 못 본다.
      // 200ms 위치 전이로 "저 카드가 여기로 왔구나"를 눈이 따라가게 한다(D4/F8).
      layout={reduceMotion ? undefined : LinearTransition.duration(MOTION_DURATION.base)}
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
        accessibilityLabel={`${summary || '날짜 미설정'} 일정의 시간과 역할, ${condition.lines.join(
          ', '
        )}, 탭하여 편집${conditionError ? `, 오류: ${conditionError}` : ''}`}
        testID={`order-sheet-card-condition-${index}`}
      >
        {/* 시간대마다 한 줄 — 한 Text 에 \n 으로 밀어넣지 않는다. 줄마다 numberOfLines={1} 을
            걸어야 역할이 많은 시간대만 말줄임되고 다른 시간대 줄은 그대로 보인다. */}
        <View className="flex-1 gap-0.5">
          {condition.lines.map((line, lineIndex) => (
            <Text
              // 삼항 **안**의 dark: 변형은 정적 추출이 안 된다 — 분기마다 완결된 리터럴을 고른다
              // (nativewind-patterns 규칙 1·3 · darkModePairRatchet 주석 15-16).
              key={`${line}-${lineIndex}`}
              className={
                condition.incomplete
                  ? 'text-sm font-sans-medium text-content-muted dark:text-content-muted'
                  : 'text-sm font-sans-medium text-content-primary dark:text-content-primary'
              }
              numberOfLines={1}
            >
              {line}
            </Text>
          ))}
        </View>
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
            {/* 라벨 탭도 같은 토글 — switch 관례(F13). 스위치만 반응하면 사장은 글자를
                눌러 보고 "안 눌리네" 하고 만다. Switch 자체는 자기 터치를 소비한다. */}
            <Pressable
              onPress={() => onToggleRun(index, run, !grouped)}
              className="flex-1 justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={`${runLabel} 통째로 지원받기 ${grouped ? '끄기' : '켜기'}`}
              testID={`order-sheet-card-run-label-${index}-${runIndex}`}
            >
              <Text className="text-sm font-sans text-content-primary dark:text-off-white">
                {`${runLabel} 통째로 지원받기`}
              </Text>
              <Text className="text-[11px] font-sans text-content-muted">하루만 지원 불가</Text>
            </Pressable>
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
      {/* 구 "일부 날짜만 다르게" 버튼은 사라졌다 — 조건 시트가 열리면 맨 위에 "적용할 날짜"가
          항상 있어, 일부만 고르는 것이 곧 예외 추출이다. 진입로를 둘로 나눌 이유가 없어졌다. */}
    </Animated.View>
  );
}
