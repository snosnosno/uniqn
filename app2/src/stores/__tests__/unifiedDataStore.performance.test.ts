/**
 * UnifiedDataStore 성능 테스트
 *
 * 대량 데이터 렌더링 성능 테스트
 * - Map 데이터 구조 성능 검증
 * - Selector 성능 검증
 * - 메모리 사용량 검증
 *
 * @version 1.0.0
 * @created 2025-11-15
 * @feature 001-zustand-migration
 */

import { renderHook, act } from '@testing-library/react';
import { useUnifiedDataStore } from '../unifiedDataStore';
import type { Staff, WorkLog } from '../../types/unifiedData';
import { Timestamp } from 'firebase/firestore';

// Firebase 모킹
jest.mock('../../firebase', () => ({
  db: {},
  auth: {},
  functions: {},
}));

describe('UnifiedDataStore - 성능 테스트', () => {
  beforeEach(() => {
    // Store 초기화
    const { result } = renderHook(() => useUnifiedDataStore());
    act(() => {
      result.current.setStaff(new Map());
      result.current.setWorkLogs(new Map());
      result.current.setApplications(new Map());
      result.current.setAttendanceRecords(new Map());
      result.current.setJobPostings(new Map());
    });
  });

  describe('대량 데이터 처리', () => {
    it('1000개 staff 데이터 삽입 성능 테스트', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      // 1000개 staff 데이터 생성
      const staffMap = new Map<string, Staff>();
      for (let i = 0; i < 1000; i++) {
        staffMap.set(`staff${i}`, {
          id: `staff${i}`,
          staffId: `staff${i}`,
          name: `스태프 ${i}`,
          email: `staff${i}@example.com`,
          phone: `010-0000-${String(i).padStart(4, '0')}`,
          role: i % 2 === 0 ? 'dealer' : 'floor',
          userId: `user${i}`,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      // 성능 측정
      const startTime = performance.now();

      act(() => {
        result.current.setStaff(staffMap);
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // 성능 검증: 100ms 이내
      expect(executionTime).toBeLessThan(100);
      expect(result.current.staff.size).toBe(1000);
    });

    it('1000개 workLogs 데이터 삽입 성능 테스트', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      // 1000개 workLogs 데이터 생성
      const workLogsMap = new Map<string, WorkLog>();
      for (let i = 0; i < 1000; i++) {
        workLogsMap.set(`wl${i}`, {
          id: `wl${i}`,
          staffId: `staff${i % 100}`,
          staffName: `스태프 ${i % 100}`,
          eventId: `event${i % 10}`,
          date: '2025-11-15',
          staffInfo: {
            userId: `user${i % 100}`,
            name: `스태프 ${i % 100}`,
            jobRole: [i % 2 === 0 ? 'dealer' : 'floor'],
          },
          assignmentInfo: {
            role: i % 2 === 0 ? 'dealer' : 'floor',
            assignedTime: '18:00-22:00',
            postingId: `posting${i % 10}`,
          },
          status: 'not_started',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        } as WorkLog);
      }

      const startTime = performance.now();

      act(() => {
        result.current.setWorkLogs(workLogsMap);
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // 성능 검증: 100ms 이내
      expect(executionTime).toBeLessThan(100);
      expect(result.current.workLogs.size).toBe(1000);
    });
  });

  describe('Selector 성능', () => {
    it('getStaffById가 O(1) 성능을 보여야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      // 10000개 staff 데이터 생성
      const staffMap = new Map<string, Staff>();
      for (let i = 0; i < 10000; i++) {
        staffMap.set(`staff${i}`, {
          id: `staff${i}`,
          staffId: `staff${i}`,
          name: `스태프 ${i}`,
          email: `staff${i}@example.com`,
          phone: `010-0000-${String(i).padStart(4, '0')}`,
          role: 'dealer',
          userId: `user${i}`,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      act(() => {
        result.current.setStaff(staffMap);
      });

      // 조회 성능 측정 (100번 반복)
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const staff = result.current.getStaffById(`staff${i * 100}`);
        expect(staff).toBeDefined();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // 평균 조회 시간: 1ms 이내
      expect(avgTime).toBeLessThan(1);
    });

    it('getWorkLogsByStaffId가 효율적으로 필터링해야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      // 1000개 workLogs 데이터 생성 (10명의 staff에 대해 각 100개씩)
      const workLogsMap = new Map<string, WorkLog>();
      for (let i = 0; i < 1000; i++) {
        workLogsMap.set(`wl${i}`, {
          id: `wl${i}`,
          staffId: `staff${i % 10}`, // 10명의 staff로 분산
          staffName: `스태프 ${i % 10}`,
          eventId: `event${i}`,
          date: '2025-11-15',
          staffInfo: {
            userId: `user${i % 10}`,
            name: `스태프 ${i % 10}`,
            jobRole: ['dealer'],
          },
          assignmentInfo: {
            role: 'dealer',
            assignedTime: '18:00-22:00',
            postingId: `posting${i}`,
          },
          status: 'not_started',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        } as WorkLog);
      }

      act(() => {
        result.current.setWorkLogs(workLogsMap);
      });

      // 필터링 성능 측정
      const startTime = performance.now();

      const workLogs = result.current.getWorkLogsByStaffId('staff0');

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // 필터링 시간: 10ms 이내
      expect(executionTime).toBeLessThan(10);
      expect(workLogs.length).toBe(100);
    });
  });

  describe('메모리 효율성', () => {
    it('Map 데이터 구조가 중복 없이 데이터를 저장해야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const staff1: Staff = {
        id: 'staff1',
        staffId: 'staff1',
        name: '홍길동',
        email: 'hong@example.com',
        phone: '010-1234-5678',
        role: 'dealer',
        userId: 'user1',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // 동일한 ID로 여러 번 설정
      act(() => {
        result.current.updateStaff(staff1);
        result.current.updateStaff(staff1);
        result.current.updateStaff(staff1);
      });

      // 중복 없이 1개만 저장되어야 함
      expect(result.current.staff.size).toBe(1);
      expect(result.current.staff.get('staff1')).toEqual(staff1);
    });

    it('deleteStaff가 메모리에서 데이터를 제거해야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      // 100개 staff 추가
      const staffMap = new Map<string, Staff>();
      for (let i = 0; i < 100; i++) {
        staffMap.set(`staff${i}`, {
          id: `staff${i}`,
          staffId: `staff${i}`,
          name: `스태프 ${i}`,
          email: `staff${i}@example.com`,
          phone: `010-0000-${String(i).padStart(4, '0')}`,
          role: 'dealer',
          userId: `user${i}`,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      act(() => {
        result.current.setStaff(staffMap);
      });

      expect(result.current.staff.size).toBe(100);

      // 50개 삭제
      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.deleteStaff(`staff${i}`);
        }
      });

      // 50개만 남아있어야 함
      expect(result.current.staff.size).toBe(50);
    });
  });

  describe('동시성 테스트', () => {
    it('여러 컬렉션을 동시에 업데이트해도 데이터 무결성이 유지되어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      // Staff 100개
      const staffMap = new Map<string, Staff>();
      for (let i = 0; i < 100; i++) {
        staffMap.set(`staff${i}`, {
          id: `staff${i}`,
          staffId: `staff${i}`,
          name: `스태프 ${i}`,
          email: `staff${i}@example.com`,
          phone: `010-0000-${String(i).padStart(4, '0')}`,
          role: 'dealer',
          userId: `user${i}`,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      // WorkLogs 100개
      const workLogsMap = new Map<string, WorkLog>();
      for (let i = 0; i < 100; i++) {
        workLogsMap.set(`wl${i}`, {
          id: `wl${i}`,
          staffId: `staff${i}`,
          staffName: `스태프 ${i}`,
          eventId: `event${i}`,
          date: '2025-11-15',
          staffInfo: {
            userId: `user${i}`,
            name: `스태프 ${i}`,
            jobRole: ['dealer'],
          },
          assignmentInfo: {
            role: 'dealer',
            assignedTime: '18:00-22:00',
            postingId: `posting${i}`,
          },
          status: 'not_started',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        } as WorkLog);
      }

      // 동시에 업데이트
      act(() => {
        result.current.setStaff(staffMap);
        result.current.setWorkLogs(workLogsMap);
        result.current.setLoading(false);
        result.current.setError(null);
      });

      // 데이터 무결성 확인
      expect(result.current.staff.size).toBe(100);
      expect(result.current.workLogs.size).toBe(100);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });
});
