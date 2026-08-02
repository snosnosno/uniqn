/**
 * ScheduleMerger
 *
 * Centralizes schedule merging and grouping logic for staff-facing schedule
 * surfaces.
 */

import { STATUS } from '@/constants';
import { WEEKDAYS_KO } from '@/constants/weekdays';
import type { ScheduleEvent } from '@/types';
import { areAllDatesConsecutive, parseDateString } from '@/utils/date';

export interface MergeOptions {
  dateRange?: { start: string; end: string };
  sortOrder?: 'asc' | 'desc';
}

export interface DateGroup {
  date: string;
  label: string;
  schedules: ScheduleEvent[];
}

export interface ApplicationGroup {
  applicationId: string;
  events: ScheduleEvent[];
  dates: string[];
  isConsecutive: boolean;
}

export interface GroupByApplicationResult {
  grouped: ApplicationGroup[];
  ungrouped: ScheduleEvent[];
}

export interface GroupByApplicationOptions {
  minGroupSize?: number;
}

export interface MergerScheduleStats {
  total: number;
  applied: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

const WEEKDAYS = WEEKDAYS_KO;

function formatDateLabel(dateStr: string): string {
  const date = parseDateString(dateStr);
  if (!date) return dateStr;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = WEEKDAYS[date.getDay()];

  return `${month}월 ${day}일 (${dayOfWeek})`;
}

export class ScheduleMerger {
  static merge(
    workLogSchedules: ScheduleEvent[],
    applicationSchedules: ScheduleEvent[],
    options: MergeOptions = {}
  ): ScheduleEvent[] {
    const { dateRange, sortOrder = 'desc' } = options;

    const mergedWorkLogs = [...workLogSchedules];

    // 1단계 — 엄격 키(시각 포함). 시각까지 일치하는 짝을 **모두** 먼저 소진한다.
    // 🔴 단계를 섞으면 안 된다. 느슨한 매칭을 먼저 허용하면, 뒤에 올 지원서가 엄격하게
    //    맞출 수 있었던 work_log 를 앞선 지원서가 가로챈다.
    const strictKeyMap = new Map<string, number>();
    for (const [index, schedule] of mergedWorkLogs.entries()) {
      strictKeyMap.set(this.generateScheduleKey(schedule), index);
    }

    const consumed = new Set<number>();
    const leftovers: ScheduleEvent[] = [];

    for (const schedule of applicationSchedules) {
      const existingIndex = strictKeyMap.get(this.generateScheduleKey(schedule));
      if (existingIndex === undefined) {
        leftovers.push(schedule);
        continue;
      }
      consumed.add(existingIndex);
      mergedWorkLogs[existingIndex] = this.mergeApplicationMetadata(
        mergedWorkLogs[existingIndex]!,
        schedule
      );
    }

    // 2단계 — 남은 것만 지원서 링크 키로 재시도.
    //
    // 구인자가 슬롯을 편집하면 `work_logs` 의 `time_slot`·`role` 만 갱신되고
    // `applications.assignments[]` 는 낡은 채 남는다(WorkLogRepositoryVenue.updateSlot 은
    // applications 를 건드리지 않는다). 그러면 엄격 키가 어긋나 취소 요청 표시가 붙지 못하고
    // (`mergeApplicationMetadata` 가 실행되지 않는다) 같은 근무가 카드 2장으로 쪼개진다.
    //
    // 🔴 그래도 표류 축을 뺀 키만으로 단독 병합하면 안 된다. `work_logs` 에는 PK 외 UNIQUE
    //    제약이 없어 같은 지원서·같은 날에 서로 다른 슬롯이 공존할 수 있다. 그래서
    //    **양쪽 후보가 정확히 하나씩일 때만** 짝짓는다. 모호하면 합치지 않고 그대로 둔다
    //    (쪼개져 보이는 것이 남의 근무와 뭉치는 것보다 가볍다).
    const linkCandidates = this.indexByLinkKey(mergedWorkLogs, consumed);
    const linkLeftoverCounts = new Map<string, number>();
    for (const schedule of leftovers) {
      const key = this.generateApplicationLinkKey(schedule);
      if (key === null) continue;
      linkLeftoverCounts.set(key, (linkLeftoverCounts.get(key) ?? 0) + 1);
    }

    const unmatchedApplicationSchedules: ScheduleEvent[] = [];
    for (const schedule of leftovers) {
      const key = this.generateApplicationLinkKey(schedule);
      const candidates = key === null ? undefined : linkCandidates.get(key);

      if (key !== null && candidates?.length === 1 && linkLeftoverCounts.get(key) === 1) {
        const existingIndex = candidates[0]!;
        linkCandidates.delete(key);
        mergedWorkLogs[existingIndex] = this.mergeApplicationMetadata(
          mergedWorkLogs[existingIndex]!,
          schedule
        );
        continue;
      }

      unmatchedApplicationSchedules.push(schedule);
    }

    const filteredApplicationSchedules = dateRange
      ? unmatchedApplicationSchedules.filter((schedule) => {
          return schedule.date >= dateRange.start && schedule.date <= dateRange.end;
        })
      : unmatchedApplicationSchedules;

    const filteredWorkLogs = dateRange
      ? mergedWorkLogs.filter((schedule) => {
          return schedule.date >= dateRange.start && schedule.date <= dateRange.end;
        })
      : mergedWorkLogs;

    const merged = [...filteredWorkLogs, ...filteredApplicationSchedules];
    merged.sort((a, b) => {
      const compare = a.date.localeCompare(b.date);
      return sortOrder === 'asc' ? compare : -compare;
    });

    return merged;
  }

  static groupByDate(schedules: ScheduleEvent[]): DateGroup[] {
    if (schedules.length === 0) {
      return [];
    }

    const groupMap = new Map<string, ScheduleEvent[]>();

    for (const schedule of schedules) {
      if (!groupMap.has(schedule.date)) {
        groupMap.set(schedule.date, []);
      }

      groupMap.get(schedule.date)!.push(schedule);
    }

    const result: DateGroup[] = [];
    for (const [date, items] of groupMap.entries()) {
      result.push({
        date,
        label: formatDateLabel(date),
        schedules: items,
      });
    }

    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }

  static groupByApplication(
    schedules: ScheduleEvent[],
    options: GroupByApplicationOptions = {}
  ): GroupByApplicationResult {
    const { minGroupSize = 1 } = options;

    const groupMap = new Map<string, ScheduleEvent[]>();
    const ungrouped: ScheduleEvent[] = [];

    for (const schedule of schedules) {
      const applicationId = schedule.applicationId;

      if (!applicationId) {
        ungrouped.push(schedule);
        continue;
      }

      if (!groupMap.has(applicationId)) {
        groupMap.set(applicationId, []);
      }

      groupMap.get(applicationId)!.push(schedule);
    }

    const grouped: ApplicationGroup[] = [];
    for (const [applicationId, events] of groupMap.entries()) {
      if (events.length < minGroupSize) {
        ungrouped.push(...events);
        continue;
      }

      const dates = [...new Set(events.map((event) => event.date))].sort();
      grouped.push({
        applicationId,
        events,
        dates,
        isConsecutive: this.isConsecutiveDates(dates),
      });
    }

    return { grouped, ungrouped };
  }

  static isConsecutiveDates(dates: string[]): boolean {
    return areAllDatesConsecutive(dates);
  }

  static generateScheduleKey(schedule: ScheduleEvent): string {
    const identityKey = schedule.assignmentGroupId
      ? this.normalizeKeyPart(schedule.assignmentGroupId)
      : `role:${this.createRoleKey(schedule)}`;

    return [
      this.normalizeKeyPart(schedule.jobPostingId),
      this.normalizeKeyPart(schedule.date),
      identityKey,
      this.normalizeKeyPart(schedule.timeSlot),
    ].join('_');
  }

  /**
   * 지원서 링크 키 — 2단계 병합 전용. 링크할 수 없으면 `null`.
   *
   * 🔴 표류하는 축(`timeSlot`·`role`)을 **둘 다** 뺀다. 슬롯 편집(`updateSlot`)은 `work_logs` 의
   *    시각과 역할을 갱신하면서 `applications.assignments[]` 는 그대로 두므로, 그 둘은 두 원천이
   *    어긋날 수 있는 축이다. 남는 것은 표류하지 않는 것들뿐이다:
   *      · `applicationId` — `confirm_application` 이 심는 FK 로, **이 병합이 찾으려는 링크 그 자체**다
   *      · `date` — 편집으로 바뀌지 않는다
   *      · `assignmentGroupId` — 어떤 경로도 UPDATE 하지 않는다(있으면 같은 날 슬롯을 정확히 가른다)
   *
   * 🔴 `applicationId` 가 없으면 링크를 만들지 않는다(`null`). 없는 쪽까지 자리표시자로 정규화해
   *    키를 만들면 서로 다른 공고의 레거시·수동(add_direct_staff) 행이 날짜 하나로 뭉친다.
   *
   * ⚠️ 단, 이 `null` 반환은 **현재 컨버터 조합에서는 관찰되지 않는 방어**다. 지원서 쪽 이벤트는
   *    `ScheduleConverter.applicationToScheduleEvents` 가 항상 `applicationId` 를 채우므로, 비어
   *    있는 쪽은 work_log 뿐이고 그 키는 지원서 키와 충돌할 수 없다. 그래서 이 분기를 제거해도
   *    `merge()` 를 통과하는 테스트는 red 가 되지 않는다 — 테스트로 지킬 수 없다는 사실을 여기
   *    적어 둔다. 컨버터가 `applicationId` 를 비울 수 있게 바뀌면 그때는 실효 방어가 된다.
   */
  private static generateApplicationLinkKey(schedule: ScheduleEvent): string | null {
    const applicationId = schedule.applicationId?.trim();
    if (!applicationId || !schedule.date) return null;

    return [
      applicationId,
      this.normalizeKeyPart(schedule.date),
      this.normalizeKeyPart(schedule.assignmentGroupId),
    ].join('_');
  }

  /** 아직 짝이 없는 work_log 만 링크 키로 색인한다(엄격 단계에서 소진된 것은 후보에서 뺀다). */
  private static indexByLinkKey(
    schedules: readonly ScheduleEvent[],
    consumed: ReadonlySet<number>
  ): Map<string, number[]> {
    const index = new Map<string, number[]>();

    for (const [position, schedule] of schedules.entries()) {
      if (consumed.has(position)) continue;
      const key = this.generateApplicationLinkKey(schedule);
      if (key === null) continue;
      index.set(key, [...(index.get(key) ?? []), position]);
    }

    return index;
  }

  static calculateStats(schedules: ScheduleEvent[]): MergerScheduleStats {
    const stats: MergerScheduleStats = {
      total: schedules.length,
      applied: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const schedule of schedules) {
      switch (schedule.type) {
        case STATUS.SCHEDULE.APPLIED:
          stats.applied += 1;
          break;
        case STATUS.SCHEDULE.CONFIRMED:
          stats.confirmed += 1;
          break;
        case STATUS.SCHEDULE.COMPLETED:
          stats.completed += 1;
          break;
        case STATUS.SCHEDULE.CANCELLED:
          stats.cancelled += 1;
          break;
      }
    }

    return stats;
  }

  private static normalizeKeyPart(value?: string | null): string {
    return value?.trim() || '-';
  }

  private static createRoleKey(schedule: ScheduleEvent): string {
    return `${schedule.role}:${schedule.customRole?.trim() || '-'}`;
  }

  private static mergeApplicationMetadata(
    schedule: ScheduleEvent,
    applicationSchedule: ScheduleEvent
  ): ScheduleEvent {
    if (!applicationSchedule.isCancellationPending) {
      return schedule;
    }

    return {
      ...schedule,
      applicationId: applicationSchedule.applicationId ?? schedule.applicationId,
      isCancellationPending: true,
    };
  }
}
