/**
 * applicantValidation.ts - 지원자 데이터 검증 유틸리티
 *
 * 주요 기능:
 * - 다중 선택 검증
 * - 중복 선택 검증
 * - 날짜 선택 통계 계산
 *
 * @module utils/applicants/applicantValidation
 */

import { toISODateString } from '../dateUtils';

import { Applicant } from '../../components/applicants/ApplicantListTab/types';
import type { Selection } from '../../types/applicants/selection';

/**
 * 지원자가 다중 선택을 했는지 확인하는 함수
 */
export const hasMultipleSelections = (applicant: Applicant): boolean => {
  // 새로운 assignments 배열 확인
  if (applicant.assignments && applicant.assignments.length > 1) {
    return true;
  }

  // 레거시 필드 확인
  return !!(
    applicant.assignedRoles?.length ||
    applicant.assignedTimes?.length ||
    applicant.assignedDates?.length
  );
};

/**
 * 같은 날짜 내에서 중복 선택인지 확인하는 함수
 */
export const isDuplicateInSameDate = (
  existingSelections: Selection[],
  newSelection: Selection
): boolean => {
  return existingSelections.some(
    (existing) =>
      existing.date === newSelection.date &&
      existing.time === newSelection.time &&
      existing.role === newSelection.role
  );
};

/**
 * 특정 날짜의 선택 통계를 계산하는 함수
 */
export const getDateSelectionStats = (
  selections: Selection[],
  selectedAssignments: Array<{ timeSlot: string; role: string; date: string }>,
  targetDate: string
) => {
  const dateSelections = selections.filter((s) => s.date === targetDate);
  const selectedInDate = selectedAssignments.filter((s) => s.date === targetDate);

  return {
    totalCount: dateSelections.length,
    selectedCount: selectedInDate.length,
  };
};

/**
 * 특정 역할과 시간대의 확정/필요 인원 계산
 */
export const getStaffCounts = (
  jobPosting: any,
  applications: any[],
  role: string,
  timeSlot: string,
  date?: string
): { confirmed: number; required: number } => {
  // 확정된 인원 계산
  const confirmed = applications.filter(
    (app) =>
      app.status === 'confirmed' &&
      app.assignments?.some((a: any) => {
        const roleMatch = a.role === role || a.roles?.includes(role);
        const timeMatch = a.timeSlot === timeSlot;
        const dateMatch = !date || a.dates?.includes(date);
        return roleMatch && timeMatch && dateMatch;
      })
  ).length;

  // 필요 인원 계산
  let required = 0;
  if (jobPosting?.dateSpecificRequirements && Array.isArray(jobPosting.dateSpecificRequirements)) {
    if (date) {
      const dateReq = jobPosting.dateSpecificRequirements.find((dateReq: any) => {
        let dateReqDate = '';
        if (dateReq.date) {
          if (typeof dateReq.date === 'string') {
            dateReqDate = dateReq.date;
          } else if (dateReq.date.toDate) {
            dateReqDate = toISODateString(dateReq.date.toDate()) || '';
          } else if (typeof dateReq.date.seconds === 'number') {
            dateReqDate = toISODateString(new Date(dateReq.date.seconds * 1000)) || '';
          }
        }
        return dateReqDate === date;
      });

      if (dateReq?.timeSlots) {
        const timeSlotInfo = dateReq.timeSlots.find((ts: any) => ts.time === timeSlot);
        if (timeSlotInfo?.roles) {
          const roleInfo = timeSlotInfo.roles.find((r: any) => r.name === role);
          required = roleInfo?.count || 0;
        }
      }
    } else {
      // 모든 날짜에서 최대 요구사항 찾기
      jobPosting.dateSpecificRequirements.forEach((dateReq: any) => {
        if (dateReq?.timeSlots) {
          const timeSlotInfo = dateReq.timeSlots.find((ts: any) => ts.time === timeSlot);
          if (timeSlotInfo?.roles) {
            const roleInfo = timeSlotInfo.roles.find((r: any) => r.name === role);
            if (roleInfo?.count) {
              required = Math.max(required, roleInfo.count);
            }
          }
        }
      });
    }
  }

  return { confirmed, required };
};
