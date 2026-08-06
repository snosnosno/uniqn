/**
 * UNIQN Mobile — 조건 카드 편집 연산 (설계 §3.3·§3.4·§3.9 F6·F10)
 *
 * @description "날짜를 이렇게 고쳤을 때 카드들이 어떻게 되는가"를 정하는 순수 계층.
 * 화면(OrderSheetScreen)은 폼·토스트·시트 배선만 맡고 판단은 여기 있다 — 그래야 승계·소멸
 * 규칙이 렌더 코드에 흩어지지 않는다.
 *
 * 모든 반환값은 `normalizeScheduleGroups` 를 통과한 상태다. 호출부가 정규화를 잊는 실수를
 * 구조적으로 막는다(정규화를 건너뛰면 재진입 시 그룹이 갑자기 달라지는 옛 버그가 되살아난다).
 */
import { areDatesConsecutive } from '@/utils/date';
import {
  cloneGroupSlots,
  normalizeScheduleGroups,
  type ScheduleGroup,
  type ScheduleGroupSlots,
} from './normalizeScheduleGroups';

type ScheduleGroups = ScheduleGroup[];

export interface DateSelectionResult {
  groups: ScheduleGroups;
  /**
   * 날짜가 전부 빠져 사라진 카드들 — **조건까지 함께 유실**되므로 호출부는 반드시 고지하고
   * 되돌릴 길을 줘야 한다(F6 최우선 토스트). 원래부터 날짜가 없던 조건 카드(템플릿 프리셋)는
   * 여기 포함되지 않는다 — 그건 유실이 아니라 보존이다.
   */
  removedCards: ScheduleGroups;
  /** 이번에 새로 들어온 날짜들 — 승계 고지(F10)가 "어느 조건을 받았는지" 말할 재료 */
  addedDates: string[];
}

/** 새 날짜를 받을 카드 — 연속으로 인접한 카드가 우선, 없으면 첫 카드(F10 승계 휴리스틱) */
function inheritIndex(cards: readonly { dates: string[] }[], date: string): number {
  const adjacent = cards.findIndex((c) => c.dates.some((d) => areDatesConsecutive(d, date)));
  return adjacent >= 0 ? adjacent : 0;
}

/** 날짜 확정 — 해제분 제거 · 추가분 승계 · 소멸 카드 보고 */
export function applyDateSelection(
  groups: readonly ScheduleGroup[],
  nextDates: readonly string[]
): DateSelectionResult {
  const sorted = [...new Set(nextDates)].sort();

  // 카드가 하나면 "전체 = 그 카드"다. 날짜를 통째로 바꿔도 소멸이 아니라 편집이며,
  // 조건은 그대로 남는다(최빈 케이스에서 조건 재입력을 요구하지 않는다).
  const addedDates = sorted.filter((d) => !groups.some((g) => (g.dates ?? []).includes(d)));

  if (groups.length <= 1) {
    const base = groups[0] ?? { dates: [], timeSlots: [], grouped: false };
    return {
      groups: normalizeScheduleGroups([
        { ...base, dates: sorted, timeSlots: cloneGroupSlots(base.timeSlots) },
      ]),
      removedCards: [],
      addedDates,
    };
  }

  const kept = new Set(sorted);
  const hadDates = groups.map((g) => (g.dates ?? []).length > 0);
  const trimmed = groups.map((g) => ({
    ...g,
    dates: (g.dates ?? []).filter((d) => kept.has(d)),
    timeSlots: cloneGroupSlots(g.timeSlots),
  }));
  const vanishedFlags = trimmed.map((g, i) => hadDates[i] === true && g.dates.length === 0);
  const survivors = trimmed.filter((_, i) => vanishedFlags[i] !== true);

  // 남은 카드가 하나도 없다 = 날짜를 통째로 갈아치웠다. 카드 1개 케이스와 같은 감각으로
  // 첫 카드 조건을 이어받고, 조건이 실제로 유실된 나머지만 소멸로 보고한다.
  if (survivors.length === 0) {
    const base = groups[0]!;
    return {
      groups: normalizeScheduleGroups([
        { ...base, dates: sorted, timeSlots: cloneGroupSlots(base.timeSlots) },
      ]),
      removedCards: groups.slice(1).filter((_, i) => vanishedFlags[i + 1] === true),
      addedDates,
    };
  }

  // 승계 판정은 **추가 전 상태**로 고정한다 — 방금 넣은 날짜가 다음 날짜의 인접 판정을
  // 흔들면 같은 선택이 순서에 따라 다른 결과를 내 결정성이 깨진다.
  const basis = survivors.map((g) => ({ dates: [...g.dates] }));
  const withAdded = survivors.map((g) => ({ ...g, dates: [...g.dates] }));
  for (const date of addedDates) {
    const target = inheritIndex(basis, date);
    withAdded[target] = { ...withAdded[target]!, dates: [...withAdded[target]!.dates, date] };
  }

  return {
    groups: normalizeScheduleGroups(withAdded),
    removedCards: groups.filter((_, i) => vanishedFlags[i] === true),
    addedDates,
  };
}

/**
 * 예외 추출 — 카드의 날짜 일부를 골라 다른 조건으로 분리한다.
 *
 * 카드가 이미 사라졌거나 고른 날짜가 하나도 남아 있지 않으면 `null` 을 낸다 —
 * 호출부는 조용히 버리지 말고 "일정이 바뀌어 반영하지 못했어요"로 고지해야 한다(§8.4).
 * 전 날짜를 고르면 카드 전체 편집과 같아지는데, 정규화가 처리하므로 그대로 허용한다.
 */
export function extractException(
  groups: readonly ScheduleGroup[],
  cardIndex: number,
  pickedDates: readonly string[],
  slots: ScheduleGroupSlots
): ScheduleGroups | null {
  const source = groups[cardIndex];
  if (source === undefined) return null;
  const sourceDates = source.dates ?? [];
  const picked = sourceDates.filter((d) => pickedDates.includes(d));
  if (picked.length === 0) return null;
  const rest = sourceDates.filter((d) => !picked.includes(d));

  return normalizeScheduleGroups([
    ...groups.slice(0, cardIndex),
    ...(rest.length > 0
      ? [{ ...source, dates: rest, timeSlots: cloneGroupSlots(source.timeSlots) }]
      : []),
    { dates: picked, timeSlots: cloneGroupSlots(slots), grouped: false },
    ...groups.slice(cardIndex + 1),
  ]);
}
