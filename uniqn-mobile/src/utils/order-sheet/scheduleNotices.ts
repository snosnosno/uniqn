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
  /** 승계 고지에서 "다른 조건으로" 를 눌렀을 때 열 카드(발화 시점 인덱스 — 폴백 전용) */
  inheritedCardIndex?: number;
  /**
   * 그 카드의 **날짜집합** 앵커. 토스트는 5초간 살아 있고 그 사이 카드가 병합·이동할 수 있어
   * 인덱스만 들고 있으면 엉뚱한 카드가 열린다 — 시간을 넘나드는 좌표는 날짜집합으로 든다(F9).
   */
  inheritedCardDates?: readonly string[];
}

interface ScheduleChangeContextBase {
  /** 날짜가 전부 빠져 사라진 카드들(조건까지 유실) — applyDateSelection 이 낸다 */
  removedCards?: readonly ScheduleGroup[];
  /** 이번 확정으로 새로 들어온 날짜들 */
  inheritedDates?: readonly string[];
  /** 사용자가 직접 묶음 토글을 조작했는가 — 자기가 한 일을 되읽어주지 않는다 */
  bundleToggledByUser?: boolean;
}

/**
 * 고지 판정에 필요한 맥락.
 *
 * 🔴 `expectedDateCount` 는 **타입으로 강제한다.** 예전엔 옵셔널 + 주석 경고였는데,
 *    그 폴백(`dateCount(before)`)이 곧 버그 동작이다 — "before 보다 날짜가 줄었다" 는
 *    사용자가 날짜를 **해제한 경우에도 참**이라, 가장 흔한 조작이 "같은 조건이라 합쳐졌어요"로
 *    오고지되고 계기판(`order_sheet.auto_merge`)까지 오염된다(리뷰 실측).
 *    주석은 호출부 3곳 중 1곳만 지켰다 — 그래서 판별 유니온으로 옮겼다.
 *
 *    · 날짜를 건드리는 경로 → `datesTouched: true` + 사용자가 고른 수를 **반드시** 넘긴다
 *    · 그 외(역할·시간·묶음 토글 등) → 아무것도 넘기지 않는다. 이때 `dateCount(before)` 폴백은
 *      **정당하다**(날짜를 안 건드렸으니 의도한 수 = 이전 수).
 *
 *    `expectedDateCount?: never` 가 두 번째 갈래에 붙은 이유: 플래그 없이 값만 넘기는
 *    어중간한 호출을 컴파일 단계에서 막는다.
 */
export type ScheduleChangeContext =
  | (ScheduleChangeContextBase & { datesTouched: true; expectedDateCount: number })
  | (ScheduleChangeContextBase & { datesTouched?: false; expectedDateCount?: never });

/** 묶음(grouped) 카드가 덮는 날짜 **집합** — 해제 판정용 */
const bundledDates = (groups: readonly ScheduleGroup[]): Set<string> =>
  new Set(groups.filter((g) => g.grouped === true).flatMap((g) => g.dates ?? []));

const allDates = (groups: readonly ScheduleGroup[]): Set<string> =>
  new Set(groups.flatMap((g) => g.dates ?? []));

const dateCount = (groups: readonly ScheduleGroup[]): number =>
  groups.reduce((n, g) => n + (g.dates ?? []).length, 0);

export function diagnoseScheduleChange(
  before: readonly ScheduleGroup[],
  after: readonly ScheduleGroup[],
  context: ScheduleChangeContext
): ScheduleNotice | null {
  // ① 카드 소멸 — 날짜뿐 아니라 그 카드의 시간·역할이 통째로 사라진다. 되돌릴 길 필수.
  const removed = context.removedCards ?? [];
  if (removed.length > 0) {
    // 카드 **사이**는 `, `, 카드 **안**은 ` · ` — §3.8 확장으로 카드 요약 자체가 ` · ` 를
    // 쓰게 되면서, 바깥까지 같은 구분자를 쓰면 "9/1 · 9/3 · 9/7 · 9/9" 가 되어 2장인지
    // 4장인지 읽히지 않는다. 구분자를 계층별로 갈라 놓는다.
    const label = removed
      .map((c) => summarizeGroupDates([...(c.dates ?? [])]))
      .filter(Boolean)
      .join(', ');
    return { kind: 'cardRemoved', message: `${label || '일정'} 조건이 함께 삭제됐어요` };
  }

  // ② 묶음 해제 — 연속이 깨지거나 날짜가 빠져 묶음지원이 성립하지 않게 됐다.
  //    사용자가 스위치를 직접 내린 경우는 제외한다(자기가 한 일이다).
  //
  // ⚠️ **개수**가 아니라 **집합**으로 판정한다. `bundledDateCount(after) < before` 로 보면
  //    5일 묶음에서 하루를 해제해 4일 묶음이 되는(=묶음은 멀쩡히 살아 있는) 가장 흔한 조작이
  //    "묶음지원이 해제됐어요"로 오고지된다. 실측: 꼬리 1일 해제·중간 1일 해제 모두 오발화했다.
  //    진짜 해제 = "before 에 묶여 있었고 after 에도 **남아 있는데** 더는 묶이지 않은 날짜".
  //    사장이 지운 날짜는 after 에 없으므로 자연히 빠진다(③의 expectedDateCount 와 같은 원리).
  if (context.bundleToggledByUser !== true) {
    const beforeBundled = bundledDates(before);
    const afterBundled = bundledDates(after);
    const surviving = allDates(after);
    const released = [...beforeBundled].some((d) => surviving.has(d) && !afterBundled.has(d));
    if (released) {
      return { kind: 'bundleReleased', message: '연속 일정이 바뀌어 묶음지원이 해제됐어요' };
    }
  }

  // ③ 자동 병합 — 카드 수가 줄었거나(같은 조건 수렴) 날짜가 조용히 사라졌다(dedupe).
  //    dedupe 를 병합으로 승격해 고지하는 이유: 무고지 삭제가 되면 안 된다(Eng F-4).
  //    기준은 **사용자가 의도한 날짜 수**다 — before 와 비교하면 단순 해제까지 병합으로
  //    오고지해 계기판(order_sheet.auto_merge)이 가장 흔한 조작으로 오염된다.
  //
  // 🔴 카드 수 축소 항은 **사용자가 묶음 토글을 조작한 경우 건너뛴다.** ②와 같은 이유인데
  //    예전엔 ②만 그 갈래를 갖고 있었다. 토글을 켜면 카드가 실제로 합쳐지므로
  //    `after.length < before.length` 가 참이 되어 "같은 조건이라 하나로 합쳐졌어요"가 뜬다 —
  //    사용자가 방금 누른 스위치의 결과를 시스템이 한 일처럼 되읽어주는 것이고,
  //    계기판 `order_sheet.auto_merge` 도 그 조작으로 오염된다.
  //    dedupe 축(`dateCount(after) < expectedDates`)은 **남긴다** — 토글과 무관하게
  //    조용한 날짜 삭제는 반드시 고지해야 한다(Eng F-4, 무고지 삭제 금지).
  const expectedDates = context.datesTouched ? context.expectedDateCount : dateCount(before);
  const cardsMerged = context.bundleToggledByUser !== true && after.length < before.length;
  if (cardsMerged || dateCount(after) < expectedDates) {
    return { kind: 'merged', message: '같은 조건이라 하나로 합쳐졌어요' };
  }

  // ④ 새 날짜 승계 — 어느 조건을 받았는지 말해 주고 바꿀 길을 준다.
  //    카드가 하나뿐이면 고를 여지가 없으므로 침묵한다.
  const inherited = context.inheritedDates ?? [];
  if (inherited.length > 0 && after.length > 1) {
    const owner = after.findIndex((g) => (g.dates ?? []).includes(inherited[0]!));
    if (owner < 0) return null;
    const ownerAllDates = after[owner]?.dates ?? [];
    const ownerDates = ownerAllDates.filter((d) => !inherited.includes(d));
    const ownerLabel = summarizeGroupDates(ownerDates);
    // 추가된 날짜도 **압축**한다 — 날것으로 나열하면 30일 대회에서 213자짜리 토스트가 뜬다
    // (실측). 오너 라벨은 이미 같은 요약을 쓰고 있었는데 여기만 빠져 있었다.
    const addedLabel = summarizeGroupDates([...inherited]);
    return {
      kind: 'inherited',
      // 승계받은 카드에 원래 날짜가 없을 수 있다(조건만 있던 템플릿 카드에 첫 날짜가 들어간 경우)
      // — 그때 라벨을 그대로 끼우면 "8/10을  조건으로 추가했어요"가 된다.
      message: ownerLabel
        ? `${addedLabel}을 ${ownerLabel} 조건으로 추가했어요`
        : `${addedLabel}을 기존 조건으로 추가했어요`,
      inheritedCardIndex: owner,
      inheritedCardDates: [...ownerAllDates],
    };
  }

  return null;
}
