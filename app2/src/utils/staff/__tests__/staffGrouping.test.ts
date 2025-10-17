/**
 * staffGrouping.test.ts
 * 스태프 데이터 필터링 및 그룹화 로직 테스트
 */

import {
  filterStaffData,
  groupStaffByDate,
  filterAndGroupStaffData,
  type StaffFilters,
} from '../staffGrouping';
import type { StaffData } from '../staffDataTransformer';

describe('staffGrouping', () => {
  const mockStaffData: StaffData[] = [
    {
      id: 'staff-1',
      userId: 'user-1',
      staffId: 'user-1',
      name: '김철수',
      role: '딜러',
      assignedRole: '딜러',
      assignedTime: '09:00',
      assignedDate: '2025-02-04',
      postingId: 'event-1',
      postingTitle: '테스트 공고',
      status: 'active',
    },
    {
      id: 'staff-2',
      userId: 'user-2',
      staffId: 'user-2',
      name: '이영희',
      role: '서버',
      assignedRole: '서버',
      assignedTime: '18:00',
      assignedDate: '2025-02-04',
      postingId: 'event-1',
      postingTitle: '테스트 공고',
      status: 'active',
    },
    {
      id: 'staff-3',
      userId: 'user-3',
      staffId: 'user-3',
      name: '박민수',
      role: '딜러',
      assignedRole: '딜러',
      assignedTime: '09:00',
      assignedDate: '2025-02-05',
      postingId: 'event-1',
      postingTitle: '테스트 공고',
      status: 'active',
    },
  ];

  describe('filterStaffData', () => {
    it('검색어가 없으면 모든 데이터를 반환해야 함', () => {
      const filters: StaffFilters = { searchTerm: '' };
      const result = filterStaffData(mockStaffData, filters);

      expect(result).toHaveLength(3);
    });

    it('이름으로 필터링해야 함 (대소문자 무시)', () => {
      const filters: StaffFilters = { searchTerm: '김철' };
      const result = filterStaffData(mockStaffData, filters);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('김철수');
    });

    it('역할로 필터링해야 함', () => {
      const filters: StaffFilters = { searchTerm: '딜러' };
      const result = filterStaffData(mockStaffData, filters);

      expect(result).toHaveLength(2);
      expect(result[0]?.role).toBe('딜러');
      expect(result[1]?.role).toBe('딜러');
    });

    it('부분 일치로 검색해야 함', () => {
      const filters: StaffFilters = { searchTerm: '영' };
      const result = filterStaffData(mockStaffData, filters);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('이영희');
    });
  });

  describe('groupStaffByDate', () => {
    it('날짜별로 그룹화해야 함', () => {
      const result = groupStaffByDate(mockStaffData);

      expect(result.grouped['2025-02-04']).toHaveLength(2);
      expect(result.grouped['2025-02-05']).toHaveLength(1);
    });

    it('날짜를 정렬해야 함', () => {
      const result = groupStaffByDate(mockStaffData);

      expect(result.sortedDates).toEqual(['2025-02-04', '2025-02-05']);
    });

    it('전체 스태프 수를 계산해야 함', () => {
      const result = groupStaffByDate(mockStaffData);

      expect(result.total).toBe(3);
    });

    it('고유 스태프 수를 계산해야 함', () => {
      const staffWithDuplicate: StaffData[] = [
        ...mockStaffData,
        {
          id: 'staff-4',
          userId: 'user-1',
          staffId: 'user-1_1',
          name: '김철수', // 중복
          role: '딜러',
          assignedRole: '딜러',
          assignedTime: '18:00',
          assignedDate: '2025-02-06',
          postingId: 'event-1',
          postingTitle: '테스트 공고',
          status: 'active',
        },
      ];

      const result = groupStaffByDate(staffWithDuplicate);

      expect(result.total).toBe(4);
      expect(result.uniqueCount).toBe(3); // 김철수, 이영희, 박민수
    });
  });

  describe('filterAndGroupStaffData', () => {
    it('필터링과 그룹화를 동시에 수행해야 함', () => {
      const filters: StaffFilters = { searchTerm: '딜러' };
      const result = filterAndGroupStaffData(mockStaffData, filters);

      expect(result.total).toBe(2);
      expect(result.grouped['2025-02-04']).toHaveLength(1);
      expect(result.grouped['2025-02-05']).toHaveLength(1);
    });

    it('빈 검색 결과는 빈 그룹을 반환해야 함', () => {
      const filters: StaffFilters = { searchTerm: '존재하지않는이름' };
      const result = filterAndGroupStaffData(mockStaffData, filters);

      expect(result.total).toBe(0);
      expect(result.uniqueCount).toBe(0);
      expect(result.sortedDates).toHaveLength(0);
    });
  });
});
