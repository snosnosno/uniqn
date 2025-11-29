/**
 * UnifiedDataStore 단위 테스트
 *
 * Zustand Store의 기본 동작 검증
 * - 초기 상태 검증
 * - CRUD Actions 검증
 * - Selectors 검증
 *
 * @version 1.0.0
 * @created 2025-11-15
 * @feature 001-zustand-migration
 */

// Firebase 모킹
import { renderHook, act } from '@testing-library/react';
import { useUnifiedDataStore } from '../unifiedDataStore';
import type { Staff } from '../../types/unifiedData';
import { Timestamp } from 'firebase/firestore';

jest.mock('../../firebase', () => ({
  db: {},
  auth: {},
  functions: {},
}));

describe('UnifiedDataStore - 단위 테스트', () => {
  beforeEach(() => {
    // 각 테스트 전에 Store 초기화
    // eslint-disable-next-line testing-library/no-render-in-setup
    const { result } = renderHook(() => useUnifiedDataStore());
    act(() => {
      result.current.setStaff(new Map());
      result.current.setWorkLogs(new Map());
      result.current.setApplications(new Map());
      result.current.setAttendanceRecords(new Map());
      result.current.setJobPostings(new Map());
      result.current.setLoading(false);
      result.current.setError(null);
    });
  });

  describe('초기 상태 검증', () => {
    it('Store가 빈 Map으로 초기화되어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      expect(result.current.staff.size).toBe(0);
      expect(result.current.workLogs.size).toBe(0);
      expect(result.current.applications.size).toBe(0);
      expect(result.current.attendanceRecords.size).toBe(0);
      expect(result.current.jobPostings.size).toBe(0);
    });

    it('로딩 상태가 false로 초기화되어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      expect(result.current.isLoading).toBe(false);
    });

    it('에러 상태가 null로 초기화되어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      expect(result.current.error).toBe(null);
    });
  });

  describe('Staff CRUD Actions', () => {
    it('setStaff로 staff 데이터를 설정할 수 있어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const mockStaff = new Map<string, Staff>([
        [
          'staff1',
          {
            id: 'staff1',
            staffId: 'staff1',
            name: '홍길동',
            email: 'hong@example.com',
            phone: '010-1234-5678',
            role: 'dealer',
            userId: 'user1',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        ],
      ]);

      act(() => {
        result.current.setStaff(mockStaff);
      });

      expect(result.current.staff.size).toBe(1);
      expect(result.current.staff.get('staff1')?.name).toBe('홍길동');
    });

    it('updateStaff로 개별 staff를 업데이트할 수 있어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const initialStaff = new Map<string, Staff>([
        [
          'staff1',
          {
            id: 'staff1',
            staffId: 'staff1',
            name: '홍길동',
            email: 'hong@example.com',
            phone: '010-1234-5678',
            role: 'dealer',
            userId: 'user1',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        ],
      ]);

      act(() => {
        result.current.setStaff(initialStaff);
      });

      const updatedStaff: Staff = {
        ...initialStaff.get('staff1')!,
        name: '김철수',
      };

      act(() => {
        result.current.updateStaff(updatedStaff);
      });

      expect(result.current.staff.get('staff1')?.name).toBe('김철수');
    });

    it('deleteStaff로 staff를 삭제할 수 있어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const initialStaff = new Map<string, Staff>([
        [
          'staff1',
          {
            id: 'staff1',
            staffId: 'staff1',
            name: '홍길동',
            email: 'hong@example.com',
            phone: '010-1234-5678',
            role: 'dealer',
            userId: 'user1',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        ],
      ]);

      act(() => {
        result.current.setStaff(initialStaff);
      });

      expect(result.current.staff.size).toBe(1);

      act(() => {
        result.current.deleteStaff('staff1');
      });

      expect(result.current.staff.size).toBe(0);
    });
  });

  describe('Selectors', () => {
    it('getStaffById로 특정 staff를 조회할 수 있어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const mockStaff = new Map<string, Staff>([
        [
          'staff1',
          {
            id: 'staff1',
            staffId: 'staff1',
            name: '홍길동',
            email: 'hong@example.com',
            phone: '010-1234-5678',
            role: 'dealer',
            userId: 'user1',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        ],
      ]);

      act(() => {
        result.current.setStaff(mockStaff);
      });

      const staff = result.current.getStaffById('staff1');
      expect(staff?.name).toBe('홍길동');
    });
  });

  describe('로딩 및 에러 상태 관리', () => {
    it('setLoading으로 로딩 상태를 변경할 수 있어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('setError로 에러 상태를 변경할 수 있어야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());
      const testError = new Error('테스트 에러');

      act(() => {
        result.current.setError(testError);
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.error?.message).toBe('테스트 에러');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBe(null);
    });
  });
});
