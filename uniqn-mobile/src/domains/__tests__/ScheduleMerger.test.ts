/**
 * ScheduleMerger 테스트
 *
 * @description 스케줄 병합 로직 테스트
 * WorkLog + Application 병합, 중복 제거, 그룹핑 테스트
 */

import { ScheduleMerger } from '../schedule/ScheduleMerger';
import type { ScheduleEvent } from '@/types';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockTimestamp(date: Date): Timestamp {
  const seconds = Math.floor(date.getTime() / 1000);
  return {
    toDate: () => date,
    seconds,
    nanoseconds: 0,
    toMillis: () => date.getTime(),
    isEqual: () => false,
    valueOf: () => '',
    toJSON: () => ({ seconds, nanoseconds: 0, type: 'timestamp' }),
  } as Timestamp;
}

function createMockScheduleEvent(
  overrides: Partial<ScheduleEvent> & { id: string; date: string; jobPostingId: string }
): ScheduleEvent {
  const baseDate = new Date('2025-01-20');
  return {
    type: 'confirmed',
    startTime: createMockTimestamp(baseDate),
    endTime: createMockTimestamp(new Date(baseDate.getTime() + 8 * 60 * 60 * 1000)),
    jobPostingName: '테스트 이벤트',
    location: '서울',
    role: 'dealer',
    status: 'not_started',
    createdAt: createMockTimestamp(baseDate),
    updatedAt: createMockTimestamp(baseDate),
    ...overrides,
  } as ScheduleEvent;
}

describe('ScheduleMerger', () => {
  // ==========================================================================
  // merge: WorkLogs + Applications 병합
  // ==========================================================================
  describe('merge', () => {
    it('WorkLogs와 Applications를 병합', () => {
      const workLogs: ScheduleEvent[] = [
        createMockScheduleEvent({
          id: 'wl1',
          date: '2025-01-20',
          jobPostingId: 'job1',
          type: 'confirmed',
        }),
      ];
      const applications: ScheduleEvent[] = [
        createMockScheduleEvent({
          id: 'app1',
          date: '2025-01-21',
          jobPostingId: 'job1',
          type: 'applied',
        }),
      ];

      const result = ScheduleMerger.merge(workLogs, applications);
      expect(result).toHaveLength(2);
    });

    it('같은 jobPostingId + date면 WorkLog 우선', () => {
      const workLogs: ScheduleEvent[] = [
        createMockScheduleEvent({
          id: 'wl1',
          date: '2025-01-20',
          jobPostingId: 'job1',
          type: 'confirmed',
          source: 'workLog',
        } as Partial<ScheduleEvent> & { id: string; date: string; jobPostingId: string }),
      ];
      const applications: ScheduleEvent[] = [
        createMockScheduleEvent({
          id: 'app1',
          date: '2025-01-20',
          jobPostingId: 'job1',
          type: 'applied',
          source: 'application',
        } as Partial<ScheduleEvent> & { id: string; date: string; jobPostingId: string }),
      ];

      const result = ScheduleMerger.merge(workLogs, applications);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('wl1');
    });

    it('날짜 범위 필터 적용', () => {
      const workLogs: ScheduleEvent[] = [
        createMockScheduleEvent({ id: 'wl1', date: '2025-01-20', jobPostingId: 'job1' }),
      ];
      const applications: ScheduleEvent[] = [
        createMockScheduleEvent({ id: 'app1', date: '2025-01-15', jobPostingId: 'job2' }),
        createMockScheduleEvent({ id: 'app2', date: '2025-01-21', jobPostingId: 'job3' }),
        createMockScheduleEvent({ id: 'app3', date: '2025-01-25', jobPostingId: 'job4' }),
      ];

      const result = ScheduleMerger.merge(workLogs, applications, {
        dateRange: { start: '2025-01-18', end: '2025-01-22' },
      });

      // wl1 (01-20), app2 (01-21) 만 포함
      expect(result).toHaveLength(2);
      const dates = result.map((r) => r.date);
      expect(dates).toContain('2025-01-20');
      expect(dates).toContain('2025-01-21');
    });

    it('날짜순 정렬 (기본: 내림차순)', () => {
      const workLogs: ScheduleEvent[] = [
        createMockScheduleEvent({ id: 'wl1', date: '2025-01-18', jobPostingId: 'job1' }),
      ];
      const applications: ScheduleEvent[] = [
        createMockScheduleEvent({ id: 'app1', date: '2025-01-20', jobPostingId: 'job2' }),
        createMockScheduleEvent({ id: 'app2', date: '2025-01-19', jobPostingId: 'job3' }),
      ];

      const result = ScheduleMerger.merge(workLogs, applications);
      expect(result[0].date).toBe('2025-01-20');
      expect(result[1].date).toBe('2025-01-19');
      expect(result[2].date).toBe('2025-01-18');
    });

    it('오름차순 정렬 옵션', () => {
      const workLogs: ScheduleEvent[] = [
        createMockScheduleEvent({ id: 'wl1', date: '2025-01-20', jobPostingId: 'job1' }),
      ];
      const applications: ScheduleEvent[] = [
        createMockScheduleEvent({ id: 'app1', date: '2025-01-18', jobPostingId: 'job2' }),
      ];

      const result = ScheduleMerger.merge(workLogs, applications, {
        sortOrder: 'asc',
      });
      expect(result[0].date).toBe('2025-01-18');
      expect(result[1].date).toBe('2025-01-20');
    });

    it('빈 배열 처리', () => {
      expect(ScheduleMerger.merge([], [])).toEqual([]);
      expect(
        ScheduleMerger.merge(
          [createMockScheduleEvent({ id: 'wl1', date: '2025-01-20', jobPostingId: 'job1' })],
          []
        )
      ).toHaveLength(1);
      expect(
        ScheduleMerger.merge(
          [],
          [createMockScheduleEvent({ id: 'app1', date: '2025-01-20', jobPostingId: 'job1' })]
        )
      ).toHaveLength(1);
    });
  });

  // ==========================================================================
  // groupByDate: 날짜별 그룹화
  // ==========================================================================
  describe('groupByDate', () => {
    it('날짜별로 스케줄 그룹화', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({ id: '1', date: '2025-01-20', jobPostingId: 'job1' }),
        createMockScheduleEvent({ id: '2', date: '2025-01-20', jobPostingId: 'job2' }),
        createMockScheduleEvent({ id: '3', date: '2025-01-21', jobPostingId: 'job3' }),
      ];

      const result = ScheduleMerger.groupByDate(schedules);
      expect(result).toHaveLength(2);

      const group20 = result.find((g) => g.date === '2025-01-20');
      const group21 = result.find((g) => g.date === '2025-01-21');

      expect(group20?.schedules).toHaveLength(2);
      expect(group21?.schedules).toHaveLength(1);
    });

    it('그룹에 label 포함', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({ id: '1', date: '2025-01-20', jobPostingId: 'job1' }),
      ];

      const result = ScheduleMerger.groupByDate(schedules);
      expect(result[0].label).toBeDefined();
      expect(result[0].label).toContain('1월');
    });

    it('빈 배열 처리', () => {
      expect(ScheduleMerger.groupByDate([])).toEqual([]);
    });
  });

  // ==========================================================================
  // groupByApplication: applicationId별 그룹화
  // ==========================================================================
  describe('groupByApplication', () => {
    it('같은 applicationId를 그룹화', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({
          id: '1',
          date: '2025-01-20',
          jobPostingId: 'job1',
          applicationId: 'app1',
        }),
        createMockScheduleEvent({
          id: '2',
          date: '2025-01-21',
          jobPostingId: 'job1',
          applicationId: 'app1',
        }),
        createMockScheduleEvent({
          id: '3',
          date: '2025-01-20',
          jobPostingId: 'job1',
          applicationId: 'app2',
        }),
      ];

      const result = ScheduleMerger.groupByApplication(schedules);
      expect(result.grouped).toHaveLength(2);
      expect(result.ungrouped).toHaveLength(0);

      const group1 = result.grouped.find((g) => g.applicationId === 'app1');
      expect(group1?.events).toHaveLength(2);
    });

    it('applicationId 없으면 ungrouped로 분류', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({
          id: '1',
          date: '2025-01-20',
          jobPostingId: 'job1',
          applicationId: 'app1',
        }),
        createMockScheduleEvent({
          id: '2',
          date: '2025-01-21',
          jobPostingId: 'job1',
          // applicationId 없음
        }),
      ];

      const result = ScheduleMerger.groupByApplication(schedules);
      expect(result.grouped).toHaveLength(1);
      expect(result.ungrouped).toHaveLength(1);
    });

    it('minGroupSize 옵션 적용', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({
          id: '1',
          date: '2025-01-20',
          jobPostingId: 'job1',
          applicationId: 'app1',
        }),
        // app1은 1개뿐이므로 minGroupSize=2일 때 ungrouped로
      ];

      const result = ScheduleMerger.groupByApplication(schedules, { minGroupSize: 2 });
      expect(result.grouped).toHaveLength(0);
      expect(result.ungrouped).toHaveLength(1);
    });
  });

  // ==========================================================================
  // isConsecutiveDates: 연속 날짜 확인
  // ==========================================================================
  describe('isConsecutiveDates', () => {
    it('연속 날짜 확인', () => {
      expect(ScheduleMerger.isConsecutiveDates(['2025-01-20', '2025-01-21', '2025-01-22'])).toBe(
        true
      );
    });

    it('비연속 날짜 확인', () => {
      expect(ScheduleMerger.isConsecutiveDates(['2025-01-20', '2025-01-22'])).toBe(false);
    });

    it('단일 날짜는 연속으로 처리', () => {
      expect(ScheduleMerger.isConsecutiveDates(['2025-01-20'])).toBe(true);
    });

    it('빈 배열은 연속으로 처리', () => {
      expect(ScheduleMerger.isConsecutiveDates([])).toBe(true);
    });

    it('정렬되지 않은 배열도 처리', () => {
      expect(ScheduleMerger.isConsecutiveDates(['2025-01-22', '2025-01-20', '2025-01-21'])).toBe(
        true
      );
    });
  });

  // ==========================================================================
  // generateScheduleKey: 중복 키 생성
  // ==========================================================================
  describe('generateScheduleKey', () => {
    it('jobPostingId + date 조합으로 키 생성', () => {
      const schedule = createMockScheduleEvent({
        id: '1',
        date: '2025-01-20',
        jobPostingId: 'job1',
      });

      const key = ScheduleMerger.generateScheduleKey(schedule);
      expect(key).toBe('job1_2025-01-20');
    });
  });

  // ==========================================================================
  // calculateStats: 통계 계산
  // ==========================================================================
  describe('calculateStats', () => {
    it('스케줄 타입별 카운트', () => {
      const schedules: ScheduleEvent[] = [
        createMockScheduleEvent({
          id: '1',
          date: '2025-01-20',
          jobPostingId: 'job1',
          type: 'applied',
        }),
        createMockScheduleEvent({
          id: '2',
          date: '2025-01-21',
          jobPostingId: 'job2',
          type: 'confirmed',
        }),
        createMockScheduleEvent({
          id: '3',
          date: '2025-01-22',
          jobPostingId: 'job3',
          type: 'confirmed',
        }),
        createMockScheduleEvent({
          id: '4',
          date: '2025-01-15',
          jobPostingId: 'job4',
          type: 'completed',
        }),
      ];

      const stats = ScheduleMerger.calculateStats(schedules);
      expect(stats.total).toBe(4);
      expect(stats.applied).toBe(1);
      expect(stats.confirmed).toBe(2);
      expect(stats.completed).toBe(1);
    });

    it('빈 배열 처리', () => {
      const stats = ScheduleMerger.calculateStats([]);
      expect(stats.total).toBe(0);
      expect(stats.applied).toBe(0);
      expect(stats.confirmed).toBe(0);
      expect(stats.completed).toBe(0);
    });
  });
});
