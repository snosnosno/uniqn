/**
 * UNIQN Mobile — 일정 카드 변경 고지 진단 (설계 §3.9 F6 · Eng F-3·F-4)
 *
 * @description 정규화는 사장이 지시하지 않은 일을 한다 — 같은 조건 카드를 합치고, 성립하지
 * 않는 묶음을 풀고, 중복 날짜를 지운다. 침묵으로 넘기면 "내가 만든 카드가 사라졌다"가 되고,
 * 전부 알리면 새벽에 공고 쓰는 사장에게 토스트를 네 번 던지는 꼴이 된다.
 *
 * 그래서 **한 뮤테이션당 가장 손실이 큰 사건 하나**만 낸다:
 *   카드 소멸(조건까지 유실) > 묶음 해제 > 자동 병합 > 새 날짜 승계
 *
 * 되돌리기가 필요한 것은 카드 소멸뿐이다(나머지는 같은 조작을 되짚으면 원복된다).
 */
import { summarizeGroupDates } from '@/components/employer/order-sheet/orderRowMeta';
import type { ScheduleGroup } from './normalizeScheduleGroups';

type ScheduleNoticeKind = 'cardRemoved' | 'bundleReleased' | 'merged' | 'inherited';

export interface ScheduleNotice {
  kind: ScheduleNoticeKind;
  message: string;
  /** 승계 고지에서 "다른 조건으로" 를 눌렀을 때 열 카드 */
  inheritedCardIndex?: number;
}

export interface ScheduleChangeContext {
  /** 날짜가 전부 빠져 사라진 카드들(조건까지 유실) — applyDateSelection 이 낸다 */
  removedCards?: readonly ScheduleGroup[];
  /** 이번 확정으로 새로 들어온 날짜들 */
  inheritedDates?: readonly string[];
  /** 사용자가 직접 묶음 토글을 조작했는가 — 자기가 한 일을 되읽어주지 않는다 */
  bundleToggledByUser?: boolean;
}

/** 묶음(grouped) 카드의 날짜 집합 — 해제 판정용 */
const bundledDateCount = (groups: readonly ScheduleGroup[]): number =>
  groups.reduce((n, g) => n + (g.grouped === true ? (g.dates ?? []).length : 0), 0);

const dateCount = (groups: readonly ScheduleGroup[]): number =>
  groups.reduce((n, g) => n + (g.dates ?? []).length, 0);

const toMonthDay = (ymd: string): string => {
  const [, month, day] = ymd.split('-');
  return `${Number(month)}/${Number(day)}`;
};

export function diagnoseScheduleChange(
  before: readonly ScheduleGroup[],
  after: readonly ScheduleGroup[],
  context: ScheduleChangeContext
): ScheduleNotice | null {
  // ① 카드 소멸 — 날짜뿐 아니라 그 카드의 시간·역할이 통째로 사라진다. 되돌릴 길 필수.
  const removed = context.removedCards ?? [];
  if (removed.length > 0) {
    const label = removed
      .map((c) => summarizeGroupDates([...(c.dates ?? [])]))
      .filter(Boolean)
      .join(' · ');
    return { kind: 'cardRemoved', message: `${label || '일정'} 조건이 함께 삭제됐어요` };
  }

  // ② 묶음 해제 — 연속이 깨지거나 날짜가 빠져 묶음지원이 성립하지 않게 됐다.
  //    사용자가 스위치를 직접 내린 경우는 제외한다(자기가 한 일이다).
  if (context.bundleToggledByUser !== true && bundledDateCount(after) < bundledDateCount(before)) {
    return { kind: 'bundleReleased', message: '연속 일정이 바뀌어 묶음지원이 해제됐어요' };
  }

  // ③ 자동 병합 — 카드 수가 줄었거나(같은 조건 수렴) 날짜가 조용히 사라졌다(dedupe).
  //    dedupe 를 병합으로 승격해 고지하는 이유: 무고지 삭제가 되면 안 된다(Eng F-4).
  if (after.length < before.length || dateCount(after) < dateCount(before)) {
    return { kind: 'merged', message: '같은 조건이라 하나로 합쳐졌어요' };
  }

  // ④ 새 날짜 승계 — 어느 조건을 받았는지 말해 주고 바꿀 길을 준다.
  //    카드가 하나뿐이면 고를 여지가 없으므로 침묵한다.
  const inherited = context.inheritedDates ?? [];
  if (inherited.length > 0 && after.length > 1) {
    const owner = after.findIndex((g) => (g.dates ?? []).includes(inherited[0]!));
    if (owner < 0) return null;
    const ownerDates = (after[owner]?.dates ?? []).filter((d) => !inherited.includes(d));
    const ownerLabel = summarizeGroupDates(ownerDates);
    const addedLabel = inherited.map(toMonthDay).join(' · ');
    return {
      kind: 'inherited',
      message: `${addedLabel}을 ${ownerLabel} 조건으로 추가했어요`,
      inheritedCardIndex: owner,
    };
  }

  return null;
}
