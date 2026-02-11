/**
 * WorkLogCreator 테스트
 *
 * @description 근무 기록 생성 로직 테스트
 * - 시간 슬롯 파싱
 * - Timestamp 생성
 * - 단일/배치 WorkLog 생성
 * - Assignment 개수 계산
 */

import { Timestamp } from 'firebase/firestore';
import { WorkLogCreator } from '../WorkLogCreator';

describe('WorkLogCreator', () => {
  // ============================================================================
  // parseTimeSlot 테스트
  // ============================================================================
  describe('parseTimeSlot', () => {
    it('빈 문자열은 null 반환', () => {
      const result = WorkLogCreator.parseTimeSlot('');
      expect(result.startTime).toBeNull();
      expect(result.endTime).toBeNull();
      expect(result.original).toBe('');
    });

    it('단일 시간 "09:00" → startTime만', () => {
      const result = WorkLogCreator.parseTimeSlot('09:00');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBeNull();
      expect(result.original).toBe('09:00');
    });

    it('"09:00~18:00" → 시작/종료 분리', () => {
      const result = WorkLogCreator.parseTimeSlot('09:00~18:00');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('18:00');
    });

    it('"09:00 - 18:00" 형식도 지원 (- 구분자)', () => {
      const result = WorkLogCreator.parseTimeSlot('09:00 - 18:00');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('18:00');
    });

    it('공백이 포함된 시간 처리', () => {
      const result = WorkLogCreator.parseTimeSlot('  09:00~18:00  ');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('18:00');
      expect(result.original).toBe('09:00~18:00');
    });
  });

  // ============================================================================
  // extractStartTime 테스트
  // ============================================================================
  describe('extractStartTime', () => {
    it('시간 범위에서 시작 시간 추출', () => {
      expect(WorkLogCreator.extractStartTime('09:00~18:00')).toBe('09:00');
    });

    it('단일 시간에서 시작 시간 추출', () => {
      expect(WorkLogCreator.extractStartTime('19:00')).toBe('19:00');
    });

    it('빈 문자열은 빈 문자열 반환', () => {
      expect(WorkLogCreator.extractStartTime('')).toBe('');
    });
  });

  // ============================================================================
  // createTimestampFromDateTime 테스트
  // ============================================================================
  describe('createTimestampFromDateTime', () => {
    it('유효한 날짜/시간 → Timestamp 생성', () => {
      const result = WorkLogCreator.createTimestampFromDateTime('2026-02-11', '09:00');
      expect(result).toBeInstanceOf(Timestamp);
      expect(result).not.toBeNull();
    });

    it('빈 날짜는 null 반환', () => {
      expect(WorkLogCreator.createTimestampFromDateTime('', '09:00')).toBeNull();
    });

    it('빈 시간은 null 반환', () => {
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-11', '')).toBeNull();
    });

    it('잘못된 시간 형식은 null 반환', () => {
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-11', 'abc')).toBeNull();
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-11', '25:00')).toBeNull();
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-11', '12:60')).toBeNull();
    });

    it('한 자릿수 시간도 지원 (예: "9:00")', () => {
      const result = WorkLogCreator.createTimestampFromDateTime('2026-02-11', '9:00');
      expect(result).not.toBeNull();
    });
  });

  // ============================================================================
  // create 테스트
  // ============================================================================
  describe('create', () => {
    const baseInput = {
      staffId: 'staff-1',
      staffName: '테스트 스태프',
      jobPostingId: 'job-1',
      jobPostingName: '테스트 공고',
      roleId: 'dealer',
      date: '2026-02-15',
      timeSlot: '09:00~18:00',
    };

    it('기본 WorkLog 데이터 생성', () => {
      const workLog = WorkLogCreator.create(baseInput);

      expect(workLog.staffId).toBe('staff-1');
      expect(workLog.staffName).toBe('테스트 스태프');
      expect(workLog.jobPostingId).toBe('job-1');
      expect(workLog.jobPostingName).toBe('테스트 공고');
      expect(workLog.role).toBe('dealer');
      expect(workLog.date).toBe('2026-02-15');
      expect(workLog.timeSlot).toBe('09:00~18:00');
      expect(workLog.status).toBe('scheduled');
      expect(workLog.attendanceStatus).toBe('not_started');
      expect(workLog.isSettled).toBe(false);
      expect(workLog.checkOutTime).toBeNull();
      expect(workLog.workDuration).toBeNull();
      expect(workLog.payrollAmount).toBeNull();
    });

    it('checkInTime이 시작 시간 기반으로 생성된다', () => {
      const workLog = WorkLogCreator.create(baseInput);
      // 09:00이 파싱되어 Timestamp으로 설정됨
      expect(workLog.checkInTime).not.toBeNull();
    });

    it('기본값: isTimeToBeAnnounced=false', () => {
      const workLog = WorkLogCreator.create(baseInput);
      expect(workLog.isTimeToBeAnnounced).toBe(false);
    });

    it('기본값: checkMethod=individual', () => {
      const workLog = WorkLogCreator.create(baseInput);
      expect(workLog.checkMethod).toBe('individual');
    });

    it('옵션값 오버라이드', () => {
      const workLog = WorkLogCreator.create({
        ...baseInput,
        isTimeToBeAnnounced: true,
        tentativeDescription: '시간 미정',
        checkMethod: 'group',
        assignmentGroupId: 'group-1',
      });

      expect(workLog.isTimeToBeAnnounced).toBe(true);
      expect(workLog.tentativeDescription).toBe('시간 미정');
      expect(workLog.checkMethod).toBe('group');
      expect(workLog.assignmentGroupId).toBe('group-1');
    });
  });

  // ============================================================================
  // createFromAssignments 테스트
  // ============================================================================
  describe('createFromAssignments', () => {
    const staffInfo = { staffId: 'staff-1', staffName: '테스트 스태프' };
    const jobPostingInfo = { jobPostingId: 'job-1', jobPostingName: '테스트 공고' };

    it('단일 Assignment에서 WorkLog 배치 생성', () => {
      const assignments = [
        {
          dates: ['2026-02-15', '2026-02-16'],
          timeSlot: '09:00~18:00',
          roleIds: ['dealer'],
        },
      ];

      const result = WorkLogCreator.createFromAssignments(
        assignments,
        staffInfo,
        jobPostingInfo
      );

      expect(result.count).toBe(2);
      expect(result.workLogs).toHaveLength(2);
      expect(result.dates).toEqual(['2026-02-15', '2026-02-16']);
    });

    it('다중 Assignment에서 WorkLog 배치 생성', () => {
      const assignments = [
        {
          dates: ['2026-02-15'],
          timeSlot: '09:00~18:00',
          roleIds: ['dealer'],
        },
        {
          dates: ['2026-02-16', '2026-02-17'],
          timeSlot: '19:00~23:00',
          roleIds: ['floor'],
        },
      ];

      const result = WorkLogCreator.createFromAssignments(
        assignments,
        staffInfo,
        jobPostingInfo
      );

      expect(result.count).toBe(3);
      expect(result.workLogs[0].role).toBe('dealer');
      expect(result.workLogs[1].role).toBe('floor');
    });

    it('중복 날짜는 dates에서 제거', () => {
      const assignments = [
        { dates: ['2026-02-15'], timeSlot: '09:00~12:00', roleIds: ['dealer'] },
        { dates: ['2026-02-15'], timeSlot: '13:00~18:00', roleIds: ['floor'] },
      ];

      const result = WorkLogCreator.createFromAssignments(
        assignments,
        staffInfo,
        jobPostingInfo
      );

      expect(result.count).toBe(2); // workLogs는 2개
      expect(result.dates).toEqual(['2026-02-15']); // 중복 제거된 날짜
    });

    it('roleIds 없으면 defaultRole 사용', () => {
      const assignments = [
        { dates: ['2026-02-15'], timeSlot: '09:00~18:00' },
      ];

      const result = WorkLogCreator.createFromAssignments(
        assignments,
        staffInfo,
        jobPostingInfo,
        'serving'
      );

      expect(result.workLogs[0].role).toBe('serving');
    });

    it('빈 Assignment 배열은 빈 결과', () => {
      const result = WorkLogCreator.createFromAssignments(
        [],
        staffInfo,
        jobPostingInfo
      );

      expect(result.count).toBe(0);
      expect(result.workLogs).toHaveLength(0);
      expect(result.dates).toHaveLength(0);
    });
  });

  // ============================================================================
  // countAssignments 테스트
  // ============================================================================
  describe('countAssignments', () => {
    it('Assignment 배열의 총 날짜 수 계산', () => {
      const assignments = [
        { dates: ['2026-02-15', '2026-02-16'] },
        { dates: ['2026-02-17'] },
      ];

      expect(WorkLogCreator.countAssignments(assignments)).toBe(3);
    });

    it('빈 배열은 0 반환', () => {
      expect(WorkLogCreator.countAssignments([])).toBe(0);
    });

    it('빈 dates 배열도 처리', () => {
      const assignments = [{ dates: [] }, { dates: ['2026-02-15'] }];
      expect(WorkLogCreator.countAssignments(assignments)).toBe(1);
    });
  });
});
