/**
 * applicantTransform.ts - 지원자 데이터 변환 유틸리티
 *
 * 주요 기능:
 * - 날짜 변환 (Timestamp → String)
 * - 선택사항 변환 (Applicant → Selection[])
 * - 날짜별 그룹화
 *
 * @module utils/applicants/applicantTransform
 */

import { logger } from '../logger';
import { Applicant } from '../../components/applicants/ApplicantListTab/types';
import { ApplicationHistoryService } from '../../services/ApplicationHistoryService';
import { JobPosting, DateSpecificRequirement, TimeSlot } from '../../types/jobPosting';
import type { Selection, DateGroupedSelections } from '../../types/applicants/selection';

/**
 * 구인공고에서 특정 시간대의 역할 정보를 가져오는 함수
 * 역할 정보가 누락된 경우 대체 로직으로 사용
 */
const getRoleFromJobPosting = (
  jobPosting: JobPosting | undefined,
  timeSlot: string,
  date: string
): string | undefined => {
  if (!jobPosting?.dateSpecificRequirements) {
    return undefined;
  }

  try {
    // 날짜 매칭을 위한 날짜 정규화
    const normalizedDate = convertDateToString(date);

    // 해당 날짜의 요구사항 찾기
    const dateReq = jobPosting.dateSpecificRequirements.find((req: DateSpecificRequirement) => {
      const reqDate = convertDateToString(req.date);
      return reqDate === normalizedDate;
    });

    if (!dateReq?.timeSlots) {
      return undefined;
    }

    // 해당 시간대의 TimeSlot 찾기
    const timeSlotObj = dateReq.timeSlots.find(
      (ts: TimeSlot) => ts.time === timeSlot || (ts.isTimeToBeAnnounced && timeSlot === '미정')
    );

    if (!timeSlotObj?.roles || timeSlotObj.roles.length === 0) {
      return undefined;
    }

    // 첫 번째 역할 반환
    const role = timeSlotObj.roles[0]?.name;

    if (role) {
      logger.info('✅ 구인공고에서 역할 정보 복원:', {
        component: 'getRoleFromJobPosting',
        data: {
          date: normalizedDate,
          timeSlot,
          foundRole: role,
        },
      });
      return role;
    }
  } catch (error) {
    logger.error(
      '❌ 구인공고 역할 정보 조회 실패:',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'getRoleFromJobPosting',
        data: { timeSlot, date },
      }
    );
  }

  return undefined;
};

/**
 * 날짜 값을 안전하게 문자열로 변환하는 함수
 * UTC 시간대 문제를 방지하기 위해 로컬 날짜로 처리
 */
export const convertDateToString = (rawDate: any): string => {
  if (!rawDate) return '';

  if (typeof rawDate === 'string') {
    return rawDate;
  } else if (rawDate.toDate) {
    // Firestore Timestamp 객체
    try {
      const date = rawDate.toDate();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      logger.error(
        '❌ Timestamp 변환 오류:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'applicantTransform',
          data: { rawDate },
        }
      );
      return '';
    }
  } else if (rawDate.seconds) {
    // seconds 속성이 있는 경우
    try {
      const date = new Date(rawDate.seconds * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      logger.error(
        '❌ seconds 변환 오류:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'applicantTransform',
          data: { rawDate },
        }
      );
      return '';
    }
  } else if (rawDate instanceof Date) {
    // Date 객체
    try {
      const year = rawDate.getFullYear();
      const month = String(rawDate.getMonth() + 1).padStart(2, '0');
      const day = String(rawDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      logger.error(
        '❌ Date 변환 오류:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'applicantTransform',
          data: { rawDate },
        }
      );
      return '';
    }
  } else {
    // 다른 타입인 경우 문자열로 변환
    try {
      const dateStr = String(rawDate);
      // 날짜 형식인지 확인 (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      return '';
    } catch (error) {
      logger.error(
        '❌ 날짜 변환 오류:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'applicantTransform',
          data: { rawDate },
        }
      );
      return '';
    }
  }
};

/**
 * 날짜 포맷팅 함수 (MM-DD(요일))
 * UTC 시간대 문제 해결을 위해 로컬 날짜로 변환
 */
export const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr || dateStr === 'no-date') return '날짜 미정';

  try {
    // UTC 문자열을 로컬 날짜로 변환
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
      return '날짜 미정';
    }

    const date = new Date(year, month - 1, day);

    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

    return `${monthStr}-${dayStr}(${dayOfWeek})`;
  } catch (error) {
    logger.error('날짜 포맷팅 오류:', error instanceof Error ? error : new Error(String(error)), {
      component: 'applicantTransform',
      data: { dateStr },
    });
    return dateStr;
  }
};

/**
 * 지원자의 선택 사항을 가져오는 함수
 * @param applicant 지원자 정보
 * @param jobPosting 구인공고 (역할 정보 복원용)
 * @returns Selection 배열
 */
export const getApplicantSelections = (
  applicant: Applicant,
  jobPosting?: JobPosting
): Selection[] => {
  // 🚀 최우선: dateAssignments 사용 (최신 버전)
  if (
    applicant.dateAssignments &&
    Array.isArray(applicant.dateAssignments) &&
    applicant.dateAssignments.length > 0
  ) {
    const selections = applicant.dateAssignments.flatMap((dateAssignment) => {
      return dateAssignment.selections.map((selection) => {
        let effectiveRole = selection.role || '';

        // 역할 정보 복원
        if (!effectiveRole && jobPosting && selection.timeSlot && dateAssignment.date) {
          const recoveredRole = getRoleFromJobPosting(
            jobPosting,
            selection.timeSlot,
            dateAssignment.date
          );
          if (recoveredRole) {
            effectiveRole = recoveredRole;
          }
        }

        return {
          role: effectiveRole,
          time: selection.timeSlot,
          date: dateAssignment.date,
          dates: [dateAssignment.date],
          isGrouped: dateAssignment.isConsecutive || false,
          ...(dateAssignment.groupId && { groupId: dateAssignment.groupId }),
          checkMethod: dateAssignment.checkMethod || 'individual',
        };
      });
    });

    return selections;
  }

  // 🔥 우선순위 1: assignments 사용
  if (
    applicant.assignments &&
    Array.isArray(applicant.assignments) &&
    applicant.assignments.length > 0
  ) {
    const selections: Selection[] = [];

    applicant.assignments.forEach((assignment, index) => {
      let effectiveRole = '';

      // 역할 결정 로직
      if (
        assignment.checkMethod === 'group' &&
        assignment.roles &&
        Array.isArray(assignment.roles) &&
        assignment.roles.length > 0
      ) {
        effectiveRole = assignment.roles[0] || '';
      } else if (assignment.role) {
        effectiveRole = assignment.role;
      } else if (
        jobPosting &&
        assignment.timeSlot &&
        assignment.dates &&
        assignment.dates.length > 0 &&
        assignment.dates[0]
      ) {
        const recoveredRole = getRoleFromJobPosting(
          jobPosting,
          assignment.timeSlot,
          assignment.dates[0]
        );
        if (recoveredRole) {
          effectiveRole = recoveredRole;
        }
      }

      const isGroupSelection =
        assignment.checkMethod === 'group' ||
        (assignment.isGrouped && assignment.dates && assignment.dates.length > 1);

      if (isGroupSelection && assignment.dates && assignment.dates.length >= 1) {
        // 그룹 선택
        if (assignment.roles && Array.isArray(assignment.roles)) {
          assignment.roles.forEach((role: string) => {
            const finalRole = role || effectiveRole || '';
            selections.push({
              role: finalRole,
              time: assignment.timeSlot,
              date: assignment.dates![0] || '',
              dates: assignment.dates!,
              isGrouped: true,
              groupId: assignment.groupId || `group-${index}`,
              checkMethod: 'group' as const,
              ...(assignment.duration && {
                duration: {
                  type: assignment.duration.type,
                  endDate: assignment.duration.endDate,
                },
              }),
            });
          });
        } else if (effectiveRole) {
          selections.push({
            role: effectiveRole,
            time: assignment.timeSlot,
            date: assignment.dates[0] || '',
            dates: assignment.dates,
            isGrouped: true,
            groupId: assignment.groupId || `group-${index}`,
            checkMethod: 'group' as const,
            ...(assignment.duration && {
              duration: {
                type: assignment.duration.type,
                endDate: assignment.duration.endDate,
              },
            }),
          });
        }
      } else {
        // 개별 선택
        if (assignment.roles && Array.isArray(assignment.roles)) {
          assignment.roles.forEach((role: string) => {
            const finalRole = role || effectiveRole || '';
            selections.push({
              role: finalRole,
              time: assignment.timeSlot,
              date: assignment.dates?.[0] || '',
              dates: assignment.dates,
              isGrouped: false,
              checkMethod: assignment.checkMethod || 'individual',
              ...(assignment.duration && {
                duration: {
                  type: assignment.duration.type,
                  endDate: assignment.duration.endDate,
                },
              }),
            });
          });
        } else if (effectiveRole) {
          selections.push({
            role: effectiveRole,
            time: assignment.timeSlot,
            date: assignment.dates?.[0] || '',
            dates: assignment.dates,
            isGrouped: false,
            checkMethod: assignment.checkMethod || 'individual',
            ...(assignment.groupId && { groupId: assignment.groupId }),
            ...(assignment.duration && {
              duration: {
                type: assignment.duration.type,
                endDate: assignment.duration.endDate,
              },
            }),
          });
        }
      }
    });

    return selections;
  }

  // 🔧 Fallback: assignedGroups 사용
  if (
    applicant.assignedGroups &&
    Array.isArray(applicant.assignedGroups) &&
    applicant.assignedGroups.length > 0
  ) {
    const selections: Selection[] = [];

    applicant.assignedGroups.forEach((group) => {
      const firstDate = group.dates && group.dates.length > 0 ? group.dates[0] : null;

      selections.push({
        role: group.role,
        time: group.timeSlot,
        date: firstDate || '',
        dates: group.dates,
        checkMethod: group.checkMethod || 'individual',
        isGrouped: group.dates && group.dates.length > 1,
        ...(group.groupId && { groupId: group.groupId }),
        ...(group.duration && { duration: group.duration }),
      });
    });

    return selections;
  }

  // 확정 상태
  if (applicant.status === 'confirmed') {
    try {
      const confirmed = ApplicationHistoryService.getConfirmedSelections(applicant as any);
      // Assignment[]를 Selection[]로 변환
      return confirmed.map((assignment) => ({
        role: assignment.role || '',
        time: assignment.timeSlot || '',
        date: assignment.dates?.[0] || '',
        dates: assignment.dates || [],
        checkMethod: assignment.checkMethod || 'individual',
        ...(assignment.groupId && { groupId: assignment.groupId }),
        isGrouped: assignment.isGrouped || false,
        ...(assignment.duration && { duration: assignment.duration }),
      }));
    } catch (error) {
      logger.warn('⚠️ 확정된 선택사항 조회 실패:', {
        component: 'applicantTransform',
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      return [];
    }
  }

  // ApplicationHistory 서비스 사용
  try {
    const originalData = ApplicationHistoryService.getOriginalApplicationData(applicant as any);
    const roles = originalData.map((assignment) => assignment.role).filter(Boolean);
    const times = originalData.map((assignment) => assignment.timeSlot).filter(Boolean);
    const dates = originalData.flatMap((assignment) => assignment.dates || []).filter(Boolean);

    if (roles.length > 0 || times.length > 0 || dates.length > 0) {
      const selections = [];
      const maxLength = Math.max(roles.length, times.length, dates.length);

      for (let i = 0; i < maxLength; i++) {
        const roleValue = roles[i] ?? '';
        const timeValue = times[i] ?? '';
        const dateValue = convertDateToString(dates[i]);
        const duration = (applicant as any).assignedDurations?.[i] || undefined;

        selections.push({
          role: roleValue,
          time: timeValue,
          date: dateValue,
          ...(duration && { duration }),
        });
      }

      return selections;
    }
  } catch (error) {
    logger.warn('⚠️ ApplicationHistory 원본 데이터 접근 실패:', {
      component: 'applicantTransform',
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  // 레거시 배열 데이터
  const hasMultiple = !!(
    applicant.assignedRoles?.length ||
    applicant.assignedTimes?.length ||
    applicant.assignedDates?.length ||
    (applicant.assignments && applicant.assignments.length > 1)
  );

  if (hasMultiple) {
    const selections = [];
    const rolesArray = applicant.assignedRoles ?? [];
    const timesArray = applicant.assignedTimes ?? [];
    const datesArray = applicant.assignedDates ?? [];

    const finalLength = Math.max(rolesArray.length, timesArray.length, datesArray.length, 1);

    for (let i = 0; i < finalLength; i++) {
      const roleValue = rolesArray[i] ?? rolesArray[0] ?? '';
      const timeValue = timesArray[i] ?? timesArray[0] ?? '';

      let dateValue = '';
      if (datesArray.length > 0) {
        dateValue = convertDateToString(datesArray[i] ?? datesArray[0] ?? '');
      } else if (applicant.assignedDate) {
        dateValue = convertDateToString(applicant.assignedDate);
      }

      const duration = (applicant as any).assignedDurations?.[i] || undefined;

      selections.push({
        role: roleValue,
        time: timeValue,
        date: dateValue,
        dates: [dateValue],
        checkMethod: 'individual' as const,
        isGrouped: false,
        ...(duration && { duration }),
      });
    }

    return selections;
  }

  // 단일 필드
  if (applicant.assignedRole && applicant.assignedTime) {
    const singleDateValue = convertDateToString(applicant.assignedDate);

    return [
      {
        role: applicant.assignedRole,
        time: applicant.assignedTime,
        date: singleDateValue,
        dates: [singleDateValue],
        checkMethod: 'individual' as const,
        isGrouped: false,
      },
    ];
  }

  return [];
};

/**
 * 지원자의 선택 사항을 날짜별로 그룹화하는 함수
 */
export const getApplicantSelectionsByDate = (
  applicant: Applicant,
  jobPosting?: JobPosting
): DateGroupedSelections[] => {
  const selections = getApplicantSelections(applicant, jobPosting);

  if (selections.length === 0) {
    return [];
  }

  // 날짜별로 그룹화
  const dateGroups = new Map<string, Selection[]>();

  selections.forEach((selection) => {
    const dateKey = selection.date || 'no-date';
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, []);
    }
    dateGroups.get(dateKey)?.push(selection);
  });

  // Map을 배열로 변환하고 날짜순 정렬
  const groupedSelections: DateGroupedSelections[] = Array.from(dateGroups.entries())
    .map(([date, selections]) => ({
      date,
      displayDate: formatDateDisplay(date),
      selections,
      selectedCount: 0,
      totalCount: selections.length,
    }))
    .sort((a, b) => {
      if (a.date === 'no-date') return 1;
      if (b.date === 'no-date') return -1;
      return a.date.localeCompare(b.date);
    });

  return groupedSelections;
};
