/**
 * ScheduleMerger - 스케줄 병합 로직 통합 클래스
 *
 * @description Phase 5 - 스케줄 병합 로직 분리
 * WorkLogs + Applications 병합, 중복 제거, 그룹핑 기능 통합
 *
 * 주요 기능:
 * 1. WorkLogs와 Applications 병합 (WorkLog 우선)
 * 2. 날짜별/applicationId별 그룹핑
 * 3. 중복 제거 및 정렬
 */

import type { ScheduleEvent } from '@/types';

// ============================================================================
// Types
// ============================================================================

/** 병합 옵션 */
export interface MergeOptions {
  /** 날짜 범위 필터 */
  dateRange?: { start: string; end: string };
  /** 정렬 순서 (기본: desc - 최신순) */
  sortOrder?: 'asc' | 'desc';
}

/** 날짜별 그룹 */
export interface DateGroup {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 표시용 라벨 (예: "1월 20일 (월)") */
  label: string;
  /** 해당 날짜의 스케줄 목록 */
  schedules: ScheduleEvent[];
}

/** applicationId별 그룹 */
export interface ApplicationGroup {
  /** 지원 ID */
  applicationId: string;
  /** 해당 지원의 스케줄 목록 */
  events: ScheduleEvent[];
  /** 날짜 목록 (정렬됨) */
  dates: string[];
  /** 연속 날짜 여부 */
  isConsecutive: boolean;
}

/** 그룹핑 결과 */
export interface GroupByApplicationResult {
  /** 그룹화된 스케줄 */
  grouped: ApplicationGroup[];
  /** 그룹화 불가능한 스케줄 (applicationId 없음) */
  ungrouped: ScheduleEvent[];
}

/** 그룹핑 옵션 */
export interface GroupByApplicationOptions {
  /** 최소 그룹 크기 (기본: 1) */
  minGroupSize?: number;
}

/** 통계 */
export interface ScheduleStats {
  total: number;
  applied: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 날짜 문자열을 Date 객체로 변환
 * iOS 타임존 이슈 방지를 위해 직접 파싱
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 날짜 라벨 생성
 */
function formatDateLabel(dateStr: string): string {
  const date = parseDate(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = WEEKDAYS[date.getDay()];
  return `${month}월 ${day}일 (${dayOfWeek})`;
}

// ============================================================================
// ScheduleMerger Class
// ============================================================================

export class ScheduleMerger {
  /**
   * WorkLogs와 Applications 병합
   *
   * @description 같은 eventId + date면 WorkLog 우선
   *
   * @param workLogSchedules - WorkLog 기반 스케줄
   * @param applicationSchedules - Application 기반 스케줄
   * @param options - 병합 옵션
   * @returns 병합된 스케줄 배열
   */
  static merge(
    workLogSchedules: ScheduleEvent[],
    applicationSchedules: ScheduleEvent[],
    options: MergeOptions = {}
  ): ScheduleEvent[] {
    const { dateRange, sortOrder = 'desc' } = options;

    // 1. WorkLogs로 중복 체크 맵 생성
    const existingKeys = new Set<string>();
    for (const schedule of workLogSchedules) {
      const key = this.generateScheduleKey(schedule);
      existingKeys.add(key);
    }

    // 2. Applications에서 중복 제거 + 날짜 범위 필터
    const filteredApplicationSchedules = applicationSchedules.filter((schedule) => {
      const key = this.generateScheduleKey(schedule);

      // 이미 WorkLog로 존재하면 제외
      if (existingKeys.has(key)) {
        return false;
      }

      // 날짜 범위 필터
      if (dateRange) {
        if (schedule.date < dateRange.start || schedule.date > dateRange.end) {
          return false;
        }
      }

      return true;
    });

    // 3. WorkLogs에도 날짜 범위 필터 적용
    const filteredWorkLogs = dateRange
      ? workLogSchedules.filter(
          (s) => s.date >= dateRange.start && s.date <= dateRange.end
        )
      : workLogSchedules;

    // 4. 병합 후 정렬
    const merged = [...filteredWorkLogs, ...filteredApplicationSchedules];
    merged.sort((a, b) => {
      const compare = a.date.localeCompare(b.date);
      return sortOrder === 'asc' ? compare : -compare;
    });

    return merged;
  }

  /**
   * 날짜별로 스케줄 그룹화
   *
   * @param schedules - 스케줄 배열
   * @returns 날짜별 그룹 배열
   */
  static groupByDate(schedules: ScheduleEvent[]): DateGroup[] {
    if (schedules.length === 0) return [];

    const groupMap = new Map<string, ScheduleEvent[]>();

    // 날짜별로 그룹화
    for (const schedule of schedules) {
      const date = schedule.date;
      if (!groupMap.has(date)) {
        groupMap.set(date, []);
      }
      groupMap.get(date)!.push(schedule);
    }

    // DateGroup 배열 생성 (날짜 내림차순)
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

  /**
   * applicationId별로 스케줄 그룹화
   *
   * @description 같은 applicationId의 다중 날짜 스케줄을 하나의 그룹으로 통합
   *
   * @param schedules - 스케줄 배열
   * @param options - 그룹핑 옵션
   * @returns 그룹핑 결과
   */
  static groupByApplication(
    schedules: ScheduleEvent[],
    options: GroupByApplicationOptions = {}
  ): GroupByApplicationResult {
    const { minGroupSize = 1 } = options;

    const groupMap = new Map<string, ScheduleEvent[]>();
    const ungrouped: ScheduleEvent[] = [];

    // applicationId별로 그룹화
    for (const schedule of schedules) {
      const appId = schedule.applicationId;

      if (appId) {
        if (!groupMap.has(appId)) {
          groupMap.set(appId, []);
        }
        groupMap.get(appId)!.push(schedule);
      } else {
        ungrouped.push(schedule);
      }
    }

    // ApplicationGroup 배열 생성
    const grouped: ApplicationGroup[] = [];
    for (const [applicationId, events] of groupMap.entries()) {
      if (events.length >= minGroupSize) {
        const dates = [...new Set(events.map((e) => e.date))].sort();
        grouped.push({
          applicationId,
          events,
          dates,
          isConsecutive: this.isConsecutiveDates(dates),
        });
      } else {
        // minGroupSize 미달: ungrouped로 이동
        ungrouped.push(...events);
      }
    }

    return { grouped, ungrouped };
  }

  /**
   * 날짜 배열이 연속인지 확인
   *
   * @param dates - 날짜 배열 (YYYY-MM-DD)
   * @returns 연속 여부
   */
  static isConsecutiveDates(dates: string[]): boolean {
    if (dates.length <= 1) return true;

    const sorted = [...dates].sort();

    for (let i = 1; i < sorted.length; i++) {
      const prev = parseDate(sorted[i - 1]);
      const curr = parseDate(sorted[i]);

      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays !== 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * 스케줄 중복 체크용 키 생성
   *
   * @param schedule - 스케줄 이벤트
   * @returns jobPostingId_date 형식의 키
   */
  static generateScheduleKey(schedule: ScheduleEvent): string {
    return `${schedule.jobPostingId}_${schedule.date}`;
  }

  /**
   * 스케줄 통계 계산
   *
   * @param schedules - 스케줄 배열
   * @returns 통계 객체
   */
  static calculateStats(schedules: ScheduleEvent[]): ScheduleStats {
    const stats: ScheduleStats = {
      total: schedules.length,
      applied: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const schedule of schedules) {
      switch (schedule.type) {
        case 'applied':
          stats.applied++;
          break;
        case 'confirmed':
          stats.confirmed++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
      }
    }

    return stats;
  }
}
