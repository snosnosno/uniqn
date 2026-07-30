/**
 * 같은 날 시간이 겹치는 확정 근무(더블부킹) 감지.
 *
 * '여러 공고에 동시 지원해두고 되는 데를 간다'가 단발 알바의 생존 전략인데, 확정 권한은
 * 각 구인자에게 있다. 서로 모르게 같은 시간대에 둘 다 확정되면 스태프는 당일에야 알아채고
 * 한쪽을 노쇼한다 — 매칭 신뢰도를 직접 갉아먹는 지점인데, 정작 곤란해지는 쪽에만 경고가
 * 없었다(감지기는 구인자 화면에만 배선돼 있었다).
 *
 * 판정은 구인자 화면과 같은 `slotsOverlap`(자정 넘김 + 단일값/범위 혼합 처리 포함)을 공유해,
 * 두 화면이 서로 다른 답을 내지 않게 한다. 차단이 아니라 경고다.
 *
 * ⚠️ `time_slot` 정본이 출근 예정 단일값으로 바뀌면서(§K) 구간 기반 판정만으로는 단일값 근무가
 * 통째로 탈락한다. 판정 갈래를 늘릴 일이 생기면 **반드시 `slotsOverlap` 한 곳만** 고칠 것 —
 * 여기서 따로 늘리면 사장 화면엔 경고가 뜨고 스태프 화면엔 안 뜨는 옛 비대칭이 되살아난다.
 */
import { slotsOverlap, hasComparableSlotTime } from '@/domains/workSchedule/slotEdit';
import { STATUS } from '@/constants';
import type { ScheduleEvent } from '@/types';

/** 겹침 판정에 필요한 최소 형태 */
export interface OverlapCandidate {
  id: string;
  date: string;
  timeSlot?: string | null;
  type: string;
  jobPostingName?: string;
}

/**
 * 겹치는 확정 근무를 id → 상대 근무 목록으로 돌려준다.
 *
 * - 확정 건만 본다. 지원 중은 확정될지 모르므로 경고하면 소음이다.
 * - 같은 날짜끼리만 비교한다.
 * - 경계가 맞닿기만 한 경우(18:00 종료 ↔ 18:00 시작)는 겹침이 아니다(반열림 구간).
 */
export function detectScheduleOverlaps<T extends OverlapCandidate>(
  schedules: readonly T[]
): Map<string, T[]> {
  const byDate = new Map<string, T[]>();

  for (const schedule of schedules) {
    if (schedule.type !== STATUS.SCHEDULE.CONFIRMED) continue;
    if (!schedule.date) continue;
    // 시각을 읽을 수 없는 근무(미정·NEGOTIABLE)는 비교 대상에서 뺀다. 단일값도 통과해야 한다.
    if (!hasComparableSlotTime(schedule.timeSlot)) continue;

    byDate.set(schedule.date, [...(byDate.get(schedule.date) ?? []), schedule]);
  }

  const overlaps = new Map<string, T[]>();

  for (const sameDay of byDate.values()) {
    if (sameDay.length < 2) continue;

    for (const target of sameDay) {
      const conflicts = sameDay.filter((other) => {
        if (other.id === target.id) return false;
        return slotsOverlap(target.timeSlot, other.timeSlot);
      });

      if (conflicts.length > 0) {
        overlaps.set(target.id, conflicts);
      }
    }
  }

  return overlaps;
}

/** 카드 배지에 쓰는 한 줄 경고 문구 */
export function formatOverlapWarning(conflicts: readonly OverlapCandidate[]): string | null {
  if (conflicts.length === 0) return null;

  const first = conflicts[0].jobPostingName?.trim();
  if (!first) {
    return `다른 확정 근무 ${conflicts.length}건과 시간이 겹쳐요`;
  }
  if (conflicts.length === 1) {
    return `${first}와 시간이 겹쳐요`;
  }
  return `${first} 외 ${conflicts.length - 1}건과 시간이 겹쳐요`;
}

/** ScheduleEvent 배열에 바로 쓸 수 있는 좁힌 타입 */
export type ScheduleOverlapMap = Map<string, ScheduleEvent[]>;
