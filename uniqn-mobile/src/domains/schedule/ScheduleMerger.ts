/**
 * ScheduleMerger
 *
 * Centralizes schedule merging and grouping logic for staff-facing schedule
 * surfaces.
 */

import { STATUS } from '@/constants';
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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

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
    const existingKeyMap = new Map<string, number>();

    for (const [index, schedule] of mergedWorkLogs.entries()) {
      existingKeyMap.set(this.generateScheduleKey(schedule), index);
    }

    const filteredApplicationSchedules = applicationSchedules.filter((schedule) => {
      const key = this.generateScheduleKey(schedule);
      const existingIndex = existingKeyMap.get(key);

      if (existingIndex !== undefined) {
        mergedWorkLogs[existingIndex] = this.mergeApplicationMetadata(
          mergedWorkLogs[existingIndex]!,
          schedule
        );
        return false;
      }

      if (dateRange) {
        if (schedule.date < dateRange.start || schedule.date > dateRange.end) {
          return false;
        }
      }

      return true;
    });

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
