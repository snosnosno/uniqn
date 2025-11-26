/**
 * staffGrouping.ts
 * 스태프 데이터 필터링 및 그룹화 로직
 *
 * @version 1.0
 * @since 2025-02-04
 */

import type { StaffData } from './staffDataTransformer';
import { getTodayString } from '../jobPosting/dateUtils';

export interface StaffFilters {
  searchTerm: string;
}

export interface GroupedStaffData {
  grouped: Record<string, StaffData[]>;
  sortedDates: string[];
  total: number;
  uniqueCount: number;
}

/**
 * 스태프 데이터 필터링
 *
 * @param staffData 전체 스태프 데이터
 * @param filters 검색 조건
 * @returns 필터링된 스태프 데이터
 */
export function filterStaffData(staffData: StaffData[], filters: StaffFilters): StaffData[] {
  return staffData.filter(
    (staff) =>
      !filters.searchTerm ||
      staff.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      staff.role?.toLowerCase().includes(filters.searchTerm.toLowerCase())
  );
}

/**
 * 날짜별로 스태프 그룹화 및 정렬
 *
 * @param staffData 스태프 데이터
 * @returns 날짜별로 그룹화된 데이터
 */
export function groupStaffByDate(staffData: StaffData[]): GroupedStaffData {
  const grouped: Record<string, StaffData[]> = {};
  const sortedDates: string[] = [];

  staffData.forEach((staff) => {
    const date = staff.assignedDate || getTodayString();
    if (!grouped[date]) {
      grouped[date] = [];
      sortedDates.push(date);
    }
    grouped[date]?.push(staff);
  });

  // 필터링된 고유 스태프 수 계산 (이름 기준)
  const uniqueFilteredNames = new Set(staffData.map((staff) => staff.name));

  return {
    grouped,
    sortedDates: sortedDates.sort(),
    total: staffData.length,
    uniqueCount: uniqueFilteredNames.size,
  };
}

/**
 * 필터링 및 그룹화를 한번에 처리
 *
 * @param staffData 전체 스태프 데이터
 * @param filters 검색 조건
 * @returns 필터링 및 그룹화된 데이터
 */
export function filterAndGroupStaffData(
  staffData: StaffData[],
  filters: StaffFilters
): GroupedStaffData {
  const filtered = filterStaffData(staffData, filters);
  return groupStaffByDate(filtered);
}
