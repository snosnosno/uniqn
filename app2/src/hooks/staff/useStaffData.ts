/**
 * useStaffData.ts
 * WorkLog 데이터를 StaffData로 변환하고 필터링/그룹화하는 커스텀 훅
 *
 * @version 1.0
 * @since 2025-02-04
 */

import { useMemo } from 'react';
import type { WorkLog } from '../../types/unifiedData';
import type { JobPosting } from '../../types/jobPosting/jobPosting';
import {
  transformWorkLogsToStaffData,
  getUniqueStaffCount,
  type StaffData,
} from '../../utils/staff/staffDataTransformer';
import {
  filterAndGroupStaffData,
  type StaffFilters,
  type GroupedStaffData,
} from '../../utils/staff/staffGrouping';

export interface UseStaffDataParams {
  workLogs: Map<string, WorkLog>;
  jobPostings: Map<string, JobPosting>;
  currentJobPosting: JobPosting | null | undefined;
  filters: StaffFilters;
}

export interface UseStaffDataReturn {
  staffData: StaffData[];
  groupedStaffData: GroupedStaffData;
  uniqueStaffCount: number;
  filteredStaffCount: number;
}

/**
 * WorkLog 데이터를 StaffData로 변환하고 필터링/그룹화
 *
 * @param params WorkLog, JobPosting, 현재 공고, 필터 조건
 * @returns 변환/필터링/그룹화된 스태프 데이터
 */
export function useStaffData({
  workLogs,
  jobPostings,
  currentJobPosting,
  filters,
}: UseStaffDataParams): UseStaffDataReturn {
  // 🚀 WorkLog → StaffData 변환 및 메모이제이션
  const staffData = useMemo(() => {
    return transformWorkLogsToStaffData(
      workLogs,
      jobPostings,
      currentJobPosting?.id
    );
  }, [workLogs, jobPostings, currentJobPosting?.id]);

  // 🎯 고유한 스태프 수 계산 (중복 제거)
  const uniqueStaffCount = useMemo(() => {
    return getUniqueStaffCount(staffData);
  }, [staffData]);

  // 🎯 필터링 및 그룹화된 데이터 계산
  const groupedStaffData = useMemo(() => {
    return filterAndGroupStaffData(staffData, filters);
  }, [staffData, filters]);

  const filteredStaffCount = groupedStaffData.uniqueCount;

  return {
    staffData,
    groupedStaffData,
    uniqueStaffCount,
    filteredStaffCount,
  };
}
