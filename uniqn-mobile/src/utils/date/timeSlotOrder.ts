/**
 * 타임 슬롯 표시 정렬 — 시작시간 오름차순, TBA(시간 미정)는 맨 뒤.
 * 공고 등록 순서가 뒤섞여 저장돼도(예: 10:00, 11:00, 10:30) 표시에서 정렬한다.
 * 저장 형식/키 계약은 건드리지 않는 순수 표시 유틸.
 */
interface SortableTimeSlot {
  startTime?: string;
  time?: string;
  isTimeToBeAnnounced?: boolean;
}

const LAST = '99:99';

function startOf(slot: SortableTimeSlot): string {
  // "14:00~22:00" 범위 문자열은 시작 시각만 취한다(hydrate 키 규칙과 동일 방향, domains 의존 없이 자체 파싱)
  const raw = slot.startTime || slot.time || '';
  const match = raw.match(/^\s*(\d{1,2}:\d{2})/);
  return match?.[1]?.padStart(5, '0') ?? LAST;
}

export function sortTimeSlotsByStart<T extends SortableTimeSlot>(slots: readonly T[]): T[] {
  return [...slots].sort((a, b) => {
    if (!!a.isTimeToBeAnnounced !== !!b.isTimeToBeAnnounced) {
      return a.isTimeToBeAnnounced ? 1 : -1;
    }
    return startOf(a).localeCompare(startOf(b));
  });
}
