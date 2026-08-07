/**
 * UNIQN Mobile — 주문서 일정 그룹 정규화 (조건 유도 그룹핑의 단일 소스)
 *
 * @description 사장은 사실(날짜·시간·역할)만 입력하고, "그룹"은 조건 시그니처로 시스템이
 * 도출한다. 폼 뮤테이션(날짜 확정·조건 확정·예외 추출·묶음 토글)과 draft 복원
 * (`mappers.draftToValues`)이 **한 구현**을 공유하므로, 재진입 시 그룹이 갑자기 병합돼 보이던
 * 서프라이즈가 "UI 규칙 = 저장 규칙"으로 정의상 소멸한다.
 *
 * 설계 정본: docs/planning/2026-08-06-condition-derived-grouping-design.md §3.1
 *
 * 규칙:
 *  0. `dates` 가 빈 그룹은 평탄화에서 제외하고 **원형 그대로 결과 뒤에 보존**한다.
 *     템플릿 프리셋(`templateToValues`)이 조건만 있는 빈 그룹 N개를 만들므로, 이 규칙이 없으면
 *     첫 뮤테이션에서 템플릿의 2번째 이후 조건이 침묵 유실된다(Eng F-2).
 *  1. 나머지 그룹을 (날짜, 시그니처, grouped) 레코드로 평탄화. 그룹 간 중복 날짜는 **뒤에 온
 *     그룹이 이긴다**(Undo 재삽입 경로 방어 — 스키마 E1 이 1차 차단, 여기는 2차).
 *  2. `grouped=true` 레코드: 연속 + 동일 시그니처 run → 묶음 그룹 1개.
 *     **run 길이 1 이면 `grouped=false` 로 강등**한다(신설 정규형). 지원자 화면에서 길이 1 run 은
 *     어차피 단독 렌더라 묶음이 성립하지 않아 **행동 중립**이고, 강등이 없으면 토글이 렌더되지
 *     않는(run≥2 조건) 좀비 grouped 카드가 해제 불가 상태로 남는다.
 *  3. `grouped=false` 레코드(2의 강등분 포함): 시그니처별 병합 — 시그니처당 그룹 1개(비연속 허용).
 *  4. 그룹을 최소 날짜 기준 오름차순 정렬(결정적 순서). 각 그룹 `dates` 도 오름차순.
 *
 * ⚠️ 빈 입력은 빈 출력이다. "빈 시드 그룹 1개 유지"는 **호출자(화면 뮤테이션) 계약** —
 *    `mappers` 의 fixed 분기가 `scheduleGroups: []` 를 정본으로 쓰므로 여기서 시드하면 깨진다.
 * ⚠️ RHF 상호작용: confirm 핸들러에서만 호출한다. watch 기반 useEffect 에서 호출하면
 *    무한 재검증 루프가 된다(설계 §3.1 Eng Q1).
 */
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';
import { areDatesConsecutive } from '@/utils/date';

type ScheduleGroups = NonNullable<OrderSheetFormValues['scheduleGroups']>;
/** 폼 일정 그룹 1개 — 같은 시간·역할을 공유하는 날짜 묶음 */
export type ScheduleGroup = ScheduleGroups[number];
/** 그룹의 시간대 슬롯 목록 */
export type ScheduleGroupSlots = ScheduleGroup['timeSlots'];

/** 폼 슬롯 깊은복사 — 분할·병합 결과가 입력과 참조를 공유해 타 그룹을 오염시키는 것을 막는다. */
export const cloneGroupSlots = (slots: ScheduleGroupSlots | undefined): ScheduleGroupSlots =>
  (slots ?? []).map((s) => ({ ...s, roles: s.roles.map((r) => ({ ...r })) }));

/**
 * 조건 시그니처 — **정준 직렬화**(필드 순서를 코드로 고정).
 *
 * 객체 리터럴 키 순서에 의존하면(`JSON.stringify` 의 기본 동작) 스프레드로 재조립된 동등 슬롯이
 * 다른 문자열이 되어 **유령 카드**로 갈라진다(`ScheduleSlotsSheet.updateStart` 가 실제로
 * `{...rest, startTime}` 로 키 순서를 바꾼다). 아래 정규화는 저장 형식
 * (`mappers.toPostingTimeSlots`)이 실제로 기록하는 것과 같은 축만 남긴다 — 저장이 드롭하는 값
 * (미정 슬롯의 잔존 startTime, 비-other 역할의 customRole)은 시그니처에서도 무시해야
 * "저장 후 복원하면 같은 그룹"이 성립한다.
 *
 * 배열 순서(슬롯·역할)는 **보존**한다. 저장이 순서를 유지하므로 정렬하면 왕복이 깨진다.
 */
export function slotsSignature(slots: ScheduleGroupSlots | undefined): string {
  return JSON.stringify(
    (slots ?? []).map((s) => {
      const isTba = s.isTimeToBeAnnounced === true;
      return {
        isTba,
        startTime: isTba ? '' : (s.startTime ?? ''),
        roles: s.roles.map((r) => ({
          role: r.role,
          customRole: r.role === 'other' ? (r.customRole ?? '') : '',
          count: r.count,
        })),
      };
    })
  );
}

interface FlatRecord {
  date: string;
  signature: string;
  grouped: boolean;
  slots: ScheduleGroupSlots;
}

/** 규칙 0~1 — 빈 그룹 분리 + 날짜 단위 평탄화(중복은 뒤가 승리) */
function flatten(groups: ScheduleGroups): { preserved: ScheduleGroup[]; records: FlatRecord[] } {
  const preserved: ScheduleGroup[] = [];
  const byDate = new Map<string, FlatRecord>();
  for (const group of groups) {
    const dates = group.dates ?? [];
    if (dates.length === 0) {
      preserved.push(group);
      continue;
    }
    const slots = group.timeSlots ?? [];
    const signature = slotsSignature(slots);
    const grouped = group.grouped ?? false;
    for (const date of dates) {
      byDate.set(date, { date, signature, grouped, slots });
    }
  }
  const records = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { preserved, records };
}

/** 규칙 2 — 연속+동일 시그니처 grouped run 추출. 길이 1 run 은 강등분으로 흘려보낸다. */
function extractGroupedRuns(records: FlatRecord[]): {
  runs: ScheduleGroup[];
  demoted: FlatRecord[];
} {
  const runs: ScheduleGroup[] = [];
  const demoted: FlatRecord[] = [];
  let current: FlatRecord[] = [];
  const flush = () => {
    if (current.length === 0) return;
    if (current.length === 1) {
      demoted.push(current[0]!);
    } else {
      runs.push({
        dates: current.map((r) => r.date),
        timeSlots: cloneGroupSlots(current[0]!.slots),
        grouped: true,
      });
    }
    current = [];
  };
  for (const record of records) {
    if (!record.grouped) continue;
    const last = current[current.length - 1];
    if (
      last &&
      last.signature === record.signature &&
      areDatesConsecutive(last.date, record.date)
    ) {
      current = [...current, record];
      continue;
    }
    flush();
    current = [record];
  }
  flush();
  return { runs, demoted };
}

/** 규칙 3 — grouped=false(강등분 포함) 시그니처 병합 */
function mergeBySignature(records: FlatRecord[]): ScheduleGroup[] {
  const bySignature = new Map<string, { dates: string[]; slots: ScheduleGroupSlots }>();
  const order: string[] = [];
  for (const record of records) {
    const existing = bySignature.get(record.signature);
    if (existing) {
      existing.dates.push(record.date); // 로컬 빌더 — 입력은 변형하지 않는다
      continue;
    }
    bySignature.set(record.signature, { dates: [record.date], slots: record.slots });
    order.push(record.signature);
  }
  return order.map((signature) => {
    const entry = bySignature.get(signature)!;
    return { dates: entry.dates, timeSlots: cloneGroupSlots(entry.slots), grouped: false };
  });
}

/** 조건 유도 정규화 — 규칙 0~4. 멱등(normalize∘normalize = normalize). */
export function normalizeScheduleGroups(groups: ScheduleGroups): ScheduleGroups {
  const { preserved, records } = flatten(groups);
  const { runs, demoted } = extractGroupedRuns(records);
  const shared = mergeBySignature(
    [...records.filter((r) => !r.grouped), ...demoted].sort((a, b) => a.date.localeCompare(b.date))
  );
  const merged = [...runs, ...shared]
    .map((group) => ({ ...group, dates: [...group.dates].sort() }))
    .sort((a, b) => (a.dates[0] ?? '').localeCompare(b.dates[0] ?? ''));
  return [...merged, ...preserved];
}

/**
 * run 부분 토글 선분할 — 폼의 `grouped` 는 **그룹 단위** 플래그라, 카드 안의 특정 연속 구간만
 * 묶음지원으로 바꾸려면 정규화 **전에** 그룹을 `{run, grouped:on}` + 나머지로 쪼개야 한다(Eng F-6).
 *
 * 나머지 날짜는 원래 그룹의 `grouped` 를 유지한다 — 묶음 카드의 일부 run 만 해제하는 경우
 * 남은 구간의 묶음지원이 침묵 해제되면 안 되기 때문이다. 결과는 정규화를 통과하므로
 * run 길이 1 강등·동일 조건 재병합이 자동으로 적용된다.
 */
export function setRunGrouped(
  groups: ScheduleGroups,
  cardIndex: number,
  run: readonly string[],
  on: boolean
): ScheduleGroups {
  const target = groups[cardIndex];
  if (target === undefined) return normalizeScheduleGroups(groups);
  const runSet = new Set(run);
  const inRun = (target.dates ?? []).filter((d) => runSet.has(d));
  if (inRun.length === 0) return normalizeScheduleGroups(groups);
  const rest = (target.dates ?? []).filter((d) => !runSet.has(d));
  const split: ScheduleGroup[] = [
    { dates: inRun, timeSlots: cloneGroupSlots(target.timeSlots), grouped: on },
    ...(rest.length > 0
      ? [
          {
            dates: rest,
            timeSlots: cloneGroupSlots(target.timeSlots),
            grouped: target.grouped ?? false,
          },
        ]
      : []),
  ];
  return normalizeScheduleGroups([
    ...groups.slice(0, cardIndex),
    ...split,
    ...groups.slice(cardIndex + 1),
  ]);
}
