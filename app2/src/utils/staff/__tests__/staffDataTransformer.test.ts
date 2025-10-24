/**
 * staffDataTransformer.test.ts
 * WorkLog → StaffData 변환 로직 유닛 테스트
 */

import {
  transformWorkLogsToStaffData,
  getUniqueStaffCount,
  extractUserIdFromStaffId,
  removeStaffIdDateSuffix,
  type StaffData,
} from '../staffDataTransformer';
import type { WorkLog } from '../../../types/unifiedData';
import type { JobPosting } from '../../../types/jobPosting/jobPosting';
import { Timestamp } from 'firebase/firestore';

describe('staffDataTransformer', () => {
  describe('transformWorkLogsToStaffData', () => {
    it('빈 WorkLog 맵은 빈 배열을 반환해야 함', () => {
      const workLogs = new Map<string, WorkLog>();
      const jobPostings = new Map<string, JobPosting>();

      const result = transformWorkLogsToStaffData(
        workLogs,
        jobPostings,
        'event-1'
      );

      expect(result).toEqual([]);
    });

    it('현재 공고의 WorkLog만 변환해야 함', () => {
      const workLogs = new Map<string, WorkLog>();
      const jobPostings = new Map<string, JobPosting>();

      // 현재 공고의 WorkLog
      workLogs.set('wl-1', {
        id: 'wl-1',
        eventId: 'event-1',
        staffId: 'user-1',
        staffName: '김철수',
        date: '2025-02-04',
        status: 'not_started',
        staffInfo: {
          userId: 'user-1',
          name: '김철수',
          phone: '010-1234-5678',
          email: 'test@example.com',
          isActive: true,
        },
        assignmentInfo: {
          postingId: 'event-1',
          role: '딜러',
          assignedRole: '딜러',
          assignedTime: '09:00~18:00',
          assignedDate: '2025-02-04',
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as WorkLog);

      // 다른 공고의 WorkLog (필터링되어야 함)
      workLogs.set('wl-2', {
        id: 'wl-2',
        eventId: 'event-2',
        staffId: 'user-2',
        staffName: '이영희',
        date: '2025-02-04',
        status: 'not_started',
        staffInfo: {
          userId: 'user-2',
          name: '이영희',
          isActive: true,
        },
        assignmentInfo: {
          postingId: 'event-2',
          role: '서버',
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as WorkLog);

      const result = transformWorkLogsToStaffData(
        workLogs,
        jobPostings,
        'event-1'
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.staffId).toBe('user-1');
      expect(result[0]?.name).toBe('김철수');
    });

    it('staffInfo가 없는 WorkLog는 무시해야 함', () => {
      const workLogs = new Map<string, WorkLog>();
      const jobPostings = new Map<string, JobPosting>();

      workLogs.set('wl-1', {
        id: 'wl-1',
        eventId: 'event-1',
        staffId: 'user-1',
        date: '2025-02-04',
        status: 'scheduled',
        // staffInfo 없음
        assignmentInfo: {
          postingId: 'event-1',
          role: '딜러',
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as any);

      const result = transformWorkLogsToStaffData(
        workLogs,
        jobPostings,
        'event-1'
      );

      expect(result).toHaveLength(0);
    });

    it('복합 staffId에서 userId를 올바르게 추출해야 함', () => {
      const workLogs = new Map<string, WorkLog>();
      const jobPostings = new Map<string, JobPosting>();

      workLogs.set('wl-1', {
        id: 'wl-1',
        eventId: 'event-1',
        staffId: 'user-123_1', // 복합 ID
        staffName: '김철수',
        date: '2025-02-04',
        status: 'not_started',
        staffInfo: {
          userId: 'user-123',
          name: '김철수',
          isActive: true,
        },
        assignmentInfo: {
          postingId: 'event-1',
          role: '딜러',
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as WorkLog);

      const result = transformWorkLogsToStaffData(
        workLogs,
        jobPostings,
        'event-1'
      );

      expect(result[0]?.userId).toBe('user-123');
      expect(result[0]?.staffId).toBe('user-123_1');
    });

    it('선택적 필드가 있을 때만 포함해야 함', () => {
      const workLogs = new Map<string, WorkLog>();
      const jobPostings = new Map<string, JobPosting>();

      workLogs.set('wl-1', {
        id: 'wl-1',
        eventId: 'event-1',
        staffId: 'user-1',
        staffName: '김철수',
        date: '2025-02-04',
        status: 'not_started',
        staffInfo: {
          userId: 'user-1',
          name: '김철수',
          phone: '010-1234-5678',
          // email 없음
          isActive: true,
        },
        assignmentInfo: {
          postingId: 'event-1',
          role: '딜러',
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as WorkLog);

      const result = transformWorkLogsToStaffData(
        workLogs,
        jobPostings,
        'event-1'
      );

      expect(result[0]?.phone).toBe('010-1234-5678');
      expect(result[0]).not.toHaveProperty('email');
    });
  });

  describe('getUniqueStaffCount', () => {
    it('빈 배열은 0을 반환해야 함', () => {
      const result = getUniqueStaffCount([]);
      expect(result).toBe(0);
    });

    it('이름 기준으로 중복을 제거해야 함', () => {
      const staffData: StaffData[] = [
        {
          id: 'staff-1',
          userId: 'user-1',
          staffId: 'user-1',
          name: '김철수',
          assignedRole: '딜러',
          assignedTime: '09:00',
          assignedDate: '2025-02-04',
          postingId: 'event-1',
          postingTitle: '테스트 공고',
          status: 'active',
        },
        {
          id: 'staff-2',
          userId: 'user-1',
          staffId: 'user-1_1',
          name: '김철수', // 같은 이름
          assignedRole: '딜러',
          assignedTime: '18:00',
          assignedDate: '2025-02-05',
          postingId: 'event-1',
          postingTitle: '테스트 공고',
          status: 'active',
        },
        {
          id: 'staff-3',
          userId: 'user-2',
          staffId: 'user-2',
          name: '이영희', // 다른 이름
          assignedRole: '서버',
          assignedTime: '09:00',
          assignedDate: '2025-02-04',
          postingId: 'event-1',
          postingTitle: '테스트 공고',
          status: 'active',
        },
      ];

      const result = getUniqueStaffCount(staffData);
      expect(result).toBe(2); // 김철수, 이영희
    });
  });

  describe('extractUserIdFromStaffId', () => {
    it('단순 staffId는 그대로 반환해야 함', () => {
      expect(extractUserIdFromStaffId('user-123')).toBe('user-123');
    });

    it('복합 staffId에서 숫자 접미사를 제거해야 함', () => {
      expect(extractUserIdFromStaffId('user-123_0')).toBe('user-123');
      expect(extractUserIdFromStaffId('user-123_1')).toBe('user-123');
      expect(extractUserIdFromStaffId('user-123_999')).toBe('user-123');
    });

    it('날짜가 포함된 staffId는 처리하지 않음', () => {
      // 이 함수는 날짜 접미사를 제거하지 않음
      expect(extractUserIdFromStaffId('user-123_2025-02-04')).toBe(
        'user-123_2025-02-04'
      );
    });
  });

  describe('removeStaffIdDateSuffix', () => {
    it('날짜 접미사를 제거해야 함', () => {
      expect(removeStaffIdDateSuffix('user-123_2025-02-04')).toBe('user-123');
      expect(removeStaffIdDateSuffix('user-123_2025-12-31')).toBe('user-123');
    });

    it('날짜가 없는 staffId는 그대로 반환해야 함', () => {
      expect(removeStaffIdDateSuffix('user-123')).toBe('user-123');
      expect(removeStaffIdDateSuffix('user-123_0')).toBe('user-123_0');
    });
  });
});
