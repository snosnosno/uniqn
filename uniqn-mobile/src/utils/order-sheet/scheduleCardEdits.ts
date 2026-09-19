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

export interface ConditionApplyResult {
  groups: ScheduleGroups;
  /**
   * 날짜를 전부 뺏겨 사라진 **다른** 카드들 — 조건까지 유실되므로 호출부는 고지하고 되돌릴
   * 길을 줘야 한다(F6). 편집 대상 카드 자신은 여기 포함되지 않는다: 그 카드의 조건은
   * 사장이 방금 넣은 새 조건으로 **의도적으로** 교체되는 것이라 유실이 아니다.
   */
  removedCards: ScheduleGroups;
}

/**
 * 조건 적용 — 시간·역할 시트가 확인될 때 도는 **단일 연산**(구 `extractException` 대체).
 *
 * 시트는 "적용할 날짜"를 항상 보여주고, 사장의 선택이 곧 적용 범위다:
 *  - **0개 선택 = 이 카드 전부**. 가장 흔한 조작이라 아무것도 안 고르면 그렇게 동작한다.
 *    카드의 `timeSlots` 만 갈아끼우므로 `grouped`·날짜가 그대로 보존된다.
 *  - **N개 선택 = 그 날짜만 이 조건**. 고른 날짜는 **어느 카드에 있었든** 여기로 옮겨온다.
 *    같은 카드 안이면 예외 추출이고, 다른 카드에서 왔으면 재배정인데 — 사장에게는 둘 다
 *    "이 날짜는 이 조건"이라는 한 가지 조작이다. 덕분에 날짜가 아직 없는 조건 카드
 *    (템플릿 프리셋이 만드는 그것)도 같은 시트에서 날짜를 받을 수 있다.
 *
 * 카드가 이미 사라졌으면 `null` — 호출부는 조용히 버리지 말고 고지해야 한다(§8.4).
 */
export function applyConditionToDates(
  groups: readonly ScheduleGroup[],
  cardIndex: number,
  pickedDates: readonly string[],
  slots: ScheduleGroupSlots
): ConditionApplyResult | null {
  const source = groups[cardIndex];
  if (source === undefined) return null;

  if (pickedDates.length === 0) {
    return {
      groups: normalizeScheduleGroups(
        groups.map((g, i) => (i === cardIndex ? { ...g, timeSlots: cloneGroupSlots(slots) } : g))
      ),
      removedCards: [],
    };
  }

  // 시트가 열려 있는 동안 사라진 날짜는 버린다 — 남은 게 하나도 없으면 stale confirm 이므로
  // 조용히 없는 날짜를 만들어 내지 않고 `null` 로 고지시킨다(§8.4).
  const existing = new Set(groups.flatMap((g) => g.dates ?? []));
  const picked = new Set(pickedDates.filter((d) => existing.has(d)));
  if (picked.size === 0) return null;
  const sourceDates = source.dates ?? [];
  // 고른 날짜가 이 카드의 날짜와 정확히 같으면 "카드 전체 편집"이다 — 그때만 묶음지원을
  // 승계한다. 일부만 고른 경우는 연속이 깨질 수 있어 정규화 판단(규칙 2)에 맡긴다.
  const isWholeCard = sourceDates.length === picked.size && sourceDates.every((d) => picked.has(d));
  const moved: ScheduleGroup = {
    dates: [...picked].sort(),
    timeSlots: cloneGroupSlots(slots),
    grouped: isWholeCard ? (source.grouped ?? false) : false,
  };

  const removedCards: ScheduleGroups = [];
  const kept: ScheduleGroups = [];
  groups.forEach((g, i) => {
    if (i === cardIndex) {
      // 이 카드에서 **고르지 않은** 날짜는 원래 조건 그대로 남는다 — 이걸 빠뜨리면
      // "3일 중 하루만 다르게" 가 나머지 이틀을 통째로 지우는 조용한 유실이 된다.
      const rest = (g.dates ?? []).filter((d) => !picked.has(d));
      if (rest.length > 0) {
        kept.push({ ...g, dates: rest, timeSlots: cloneGroupSlots(g.timeSlots) });
      }
      kept.push(moved);
      return;
    }
    const before = g.dates ?? [];
    const after = before.filter((d) => !picked.has(d));
    if (before.length > 0 && after.length === 0) {
      // 날짜가 다 빠졌다 = 이 카드의 조건이 통째로 사라진다. 빈 껍데기로 남기면
      // 정규화 규칙 0 이 그걸 **보존**해 채울 수 없는 유령 카드가 된다 — 떨어내고 고지한다.
      removedCards.push(g);
      return;
    }
    kept.push({ ...g, dates: after, timeSlots: cloneGroupSlots(g.timeSlots) });
  });

  return { groups: normalizeScheduleGroups(kept), removedCards };
}
