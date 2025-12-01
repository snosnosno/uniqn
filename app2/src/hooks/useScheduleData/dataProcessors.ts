import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import { ScheduleEvent, AttendanceStatus } from '../../types/schedule';
import {
  // safeDateToString, // 현재 사용하지 않음
  // parseTimeString, // 현재 사용하지 않음
  extractDateFromFields,
} from '../../utils/scheduleUtils';
import { timestampToLocalDateString } from '../../utils/dateUtils';
import { parseAssignedTime, convertTimeToTimestamp } from '../../utils/workLogUtils';
import { getRoleForApplicationStatus } from './roleUtils';
import {
  ApplicationData,
  WorkLogData,
  JobPostingData,
  ExtendedApplicationData,
  ExtendedWorkLogData,
  DateAssignment,
  DateAssignmentSelection,
} from './types';
import type { Application, WorkLog } from '../../types/unifiedData';
import type { Assignment } from '../../types/application';

/** 확장된 Application 데이터 타입 (레거시 + 신규 필드 통합) */
type ProcessableApplicationData = (ApplicationData | Application) &
  Partial<ExtendedApplicationData>;

/**
 * 지원서 데이터를 스케줄 이벤트로 처리
 */
export const processApplicationData = async (
  docId: string,
  data: ProcessableApplicationData
): Promise<ScheduleEvent[]> => {
  const events: ScheduleEvent[] = [];

  try {
    // 공고 정보 가져오기
    let jobPostingData: JobPostingData | null = null;
    const jobId = data.eventId || data.postId; // eventId 우선 사용
    if (jobId) {
      try {
        const jobPostingDoc = await getDoc(doc(db, 'jobPostings', jobId));
        if (jobPostingDoc.exists()) {
          jobPostingData = {
            id: jobPostingDoc.id,
            ...jobPostingDoc.data(),
          } as JobPostingData;
        }
      } catch (error) {
        logger.error(
          '공고 정보 조회 실패:',
          error instanceof Error ? error : new Error(String(error)),
          {
            component: 'useScheduleData',
            data: { jobId },
          }
        );
      }
    }

    // 기본 날짜 처리
    let baseDate = '';

    // assignments에서 첫 번째 날짜가 있으면 우선 사용 (Application 타입인 경우만)
    if (data.assignments?.[0]?.dates?.[0]) {
      baseDate = data.assignments[0].dates[0];
    }

    // 공고 날짜 사용 (fallback)
    if (!baseDate && jobPostingData?.startDate) {
      baseDate = timestampToLocalDateString(jobPostingData.startDate);
    }

    // 날짜가 여전히 없으면 추가 처리
    if (!baseDate) {
      const fallbackDate = extractDateFromFields(data as unknown as { [key: string]: unknown }, [
        'createdAt',
        'updatedAt',
        'appliedAt',
      ]);
      if (fallbackDate) {
        baseDate = fallbackDate;
      } else if (jobPostingData) {
        const jobFallbackDate = extractDateFromFields(
          jobPostingData as unknown as { [key: string]: unknown },
          ['createdAt', 'updatedAt']
        );
        if (jobFallbackDate) {
          baseDate = jobFallbackDate;
        }
      }
    }

    // assignedTime 파싱 - assignments에서 가져오기 (Application 타입인 경우만)
    let assignedTime = data.assignments?.[0]?.timeSlot || '';

    // 🔥 assignedTime이 없을 때 공고의 기본 시간 사용
    if (!assignedTime && jobPostingData) {
      // 1. timeSlots 배열에서 첫 번째 시간대 사용
      if (jobPostingData.timeSlots && jobPostingData.timeSlots.length > 0) {
        const firstSlot = jobPostingData.timeSlots[0];
        if (firstSlot) {
          // TimeSlot 객체에서 시간 문자열 생성
          assignedTime = `${firstSlot.startTime}-${firstSlot.endTime}`;
        }
      }
      // 2. dateSpecificRequirements에서 해당 날짜의 시간대 찾기
      else if (jobPostingData.dateSpecificRequirements && baseDate) {
        const dateReq = jobPostingData.dateSpecificRequirements.find(
          (req) => req.date === baseDate
        );
        if (dateReq && dateReq.timeSlots && dateReq.timeSlots.length > 0) {
          assignedTime = dateReq.timeSlots[0] || '';
        }
      }
    }

    const { startTime, endTime } = parseAssignedTime(assignedTime);
    const startTimestamp = startTime ? convertTimeToTimestamp(startTime, baseDate) : null;
    const endTimestamp = endTime ? convertTimeToTimestamp(endTime, baseDate) : null;

    // 상태별 type 매핑 (통일된 상태 사용)
    const typeMap: Record<string, ScheduleEvent['type']> = {
      applied: 'applied',
      confirmed: 'confirmed',
      rejected: 'cancelled',
      cancelled: 'cancelled',
      completed: 'completed',
    };

    // 🔥 이벤트 이름과 위치 결정 (스냅샷 우선)
    let eventName = data.postTitle || '제목 없음';
    let location = jobPostingData?.location || '';

    if (data.snapshotData) {
      eventName = data.snapshotData.title || eventName;
      location = data.snapshotData.location || location;
    }

    // 기본 스케줄 이벤트 생성
    const baseEvent: ScheduleEvent & { assignedTime?: string } = {
      id: docId,
      type: typeMap[data.status] || 'applied',
      date: baseDate,
      startTime: startTimestamp,
      endTime: endTimestamp,
      eventId: data.eventId || data.postId || '', // eventId 우선 사용, 없으면 postId 사용 (하위 호환성)
      eventName: eventName,
      location: location,
      ...(jobPostingData?.detailedAddress && { detailedAddress: jobPostingData.detailedAddress }),
      role: getRoleForApplicationStatus(data, baseDate),
      status: 'not_started' as AttendanceStatus, // 지원 상태에서는 출석 상태가 not_started
      applicationStatus: data.status as 'applied' | 'confirmed' | 'rejected' | 'completed',
      notes: '',
      sourceCollection: 'applications' as const,
      sourceId: docId,
      applicationId: docId,
      // assignedTime 추가 (formatEventTime에서 사용)
      ...(assignedTime && { assignedTime: assignedTime }),
      // 🔥 스냅샷 데이터 포함 (공고 삭제 대비)
      ...(data.snapshotData && { snapshotData: data.snapshotData }),
    };

    // 🚀 dateAssignments 구조 최우선 처리 (날짜 기반 구조 - 최신 버전)
    if (
      data.dateAssignments &&
      Array.isArray(data.dateAssignments) &&
      data.dateAssignments.length > 0
    ) {
      const dateAssignments = data.dateAssignments;

      dateAssignments.forEach((dateAssignment: DateAssignment, dateIndex: number) => {
        const dateStr = dateAssignment.date;

        dateAssignment.selections.forEach(
          (selection: DateAssignmentSelection, selectionIndex: number) => {
            const timeStr = selection.timeSlot || '';
            const { startTime, endTime } = parseAssignedTime(timeStr);
            const startTimestamp = startTime ? convertTimeToTimestamp(startTime, dateStr) : null;
            const endTimestamp = endTime ? convertTimeToTimestamp(endTime, dateStr) : null;

            // 고유한 ID 생성: docId_date인덱스_selection인덱스
            const uniqueId = `${docId}_d${dateIndex}_s${selectionIndex}`;

            const event: ScheduleEvent & { assignedTime?: string } = {
              ...baseEvent,
              id: uniqueId,
              date: dateStr,
              startTime: startTimestamp,
              endTime: endTimestamp,
              role: selection.role,
              assignedTime: timeStr,
            };

            events.push(event);
          }
        );
      });

      return events;
    }

    // 🆕 assignments 구조 차우선 처리 (기존 그룹 중심 구조)
    if (data.assignments && Array.isArray(data.assignments) && data.assignments.length > 0) {
      const assignments = data.assignments;

      assignments.forEach((assignment: Assignment, assignmentIndex: number) => {
        if (assignment.dates && Array.isArray(assignment.dates)) {
          assignment.dates.forEach((dateStr: string, _dateIndex: number) => {
            const timeStr = assignment.timeSlot || '';
            const { startTime, endTime } = parseAssignedTime(timeStr);
            const startTimestamp = startTime ? convertTimeToTimestamp(startTime, dateStr) : null;
            const endTimestamp = endTime ? convertTimeToTimestamp(endTime, dateStr) : null;

            // 고유한 ID 생성: docId_assignment인덱스_날짜
            const uniqueId = `${docId}_a${assignmentIndex}_${dateStr.replace(/-/g, '')}`;

            const event: ScheduleEvent & { assignedTime?: string } = {
              ...baseEvent,
              id: uniqueId,
              date: dateStr,
              role: assignment.role || '',
              startTime: startTimestamp,
              endTime: endTimestamp,
              ...(timeStr && { assignedTime: timeStr }),
            };
            events.push(event);
          });
        }
      });
    }
    // Note: The assignments case is handled in the if block above
    // This else block handles cases with no assignments
    else {
      events.push(baseEvent);
    }
  } catch (error) {
    logger.error(
      'Application 데이터 처리 중 오류:',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'useScheduleData',
        data: { docId },
      }
    );
  }

  return events;
};

/** 확장된 WorkLog 데이터 타입 (레거시 + 신규 필드 통합) */
type ProcessableWorkLogData = (WorkLogData | WorkLog) & Partial<ExtendedWorkLogData>;

/**
 * 근무 기록 데이터를 스케줄 이벤트로 처리
 */
export const processWorkLogData = async (
  docId: string,
  data: ProcessableWorkLogData
): Promise<ScheduleEvent> => {
  // jobPosting 정보 가져오기
  let jobPostingData: JobPostingData | null = null;
  let eventName = '근무'; // 기본값
  let location = '';
  let snapshotData: ScheduleEvent['snapshotData'] = undefined;

  // 🔥 스냅샷 데이터 우선 사용 (삭제된 공고 대비)
  if (data.snapshotData) {
    snapshotData = data.snapshotData;
    eventName = snapshotData.title || '근무';
    location = snapshotData.location || '';
  }

  if (data.eventId) {
    try {
      const jobPostingDoc = await getDoc(doc(db, 'jobPostings', data.eventId));
      if (jobPostingDoc.exists()) {
        jobPostingData = {
          id: jobPostingDoc.id,
          ...jobPostingDoc.data(),
        } as JobPostingData;

        // 스냅샷이 없으면 JobPosting에서 생성
        if (!snapshotData) {
          eventName = jobPostingData.title || '근무';
          location = jobPostingData.location || '';

          // 🔥 JobPosting에서 스냅샷 데이터 생성 (급여 정보 포함)
          // salaryType을 유효한 타입으로 변환
          const validSalaryTypes = ['hourly', 'daily', 'monthly', 'other'] as const;
          const salaryType = validSalaryTypes.includes(
            jobPostingData.salaryType as (typeof validSalaryTypes)[number]
          )
            ? (jobPostingData.salaryType as 'hourly' | 'daily' | 'monthly' | 'other')
            : 'other';

          // roleSalaries 배열을 Record로 변환
          const roleSalariesRecord: Record<string, { type: string; amount: number }> = {};
          if (Array.isArray(jobPostingData.roleSalaries)) {
            jobPostingData.roleSalaries.forEach((rs) => {
              roleSalariesRecord[rs.role] = {
                type: rs.salaryType || 'hourly',
                amount: rs.salaryAmount || 0,
              };
            });
          }

          snapshotData = {
            title: jobPostingData.title,
            location: jobPostingData.location || '',
            detailedAddress: jobPostingData.detailedAddress,
            district: jobPostingData.district,
            salary: {
              type: salaryType,
              amount: jobPostingData.salaryAmount ? parseFloat(jobPostingData.salaryAmount) : 0,
              useRoleSalary: jobPostingData.useRoleSalary || false,
              roleSalaries: roleSalariesRecord,
            },
            allowances: {
              meal: jobPostingData.benefits?.mealAllowance
                ? parseInt(jobPostingData.benefits.mealAllowance)
                : 0,
              transportation:
                typeof jobPostingData.benefits?.transportation === 'string'
                  ? parseInt(jobPostingData.benefits.transportation)
                  : 0,
              accommodation: jobPostingData.benefits?.accommodation
                ? parseInt(jobPostingData.benefits.accommodation)
                : 0,
            },
            taxSettings: jobPostingData.taxSettings
              ? {
                  enabled: jobPostingData.taxSettings.applyTax || false,
                  taxRate: jobPostingData.taxSettings.taxRate,
                }
              : undefined,
            createdBy: jobPostingData.createdBy || '',
            snapshotAt: Timestamp.now(),
            snapshotReason: 'worklog_created',
          };
        }
      }
    } catch (error) {
      logger.error(
        '공고 정보 조회 실패:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'processWorkLogData',
          data: { eventId: data.eventId },
        }
      );
    }
  }

  // workLogMapper를 통해 정규화된 데이터 사용
  const { normalizeWorkLog } = await import('../../utils/workLogMapper');
  const normalizedLog = normalizeWorkLog(data);

  // 예정 시간과 실제 시간 처리 (Timestamp 타입으로 확정)
  const scheduledStart = normalizedLog.scheduledStartTime as Timestamp | null;
  const scheduledEnd = normalizedLog.scheduledEndTime as Timestamp | null;
  const actualStart = normalizedLog.actualStartTime as Timestamp | null;
  const actualEnd = normalizedLog.actualEndTime as Timestamp | null;

  // 이미 Timestamp 형태로 정규화되어 있으므로 직접 사용
  const scheduledTimeData = {
    startTime: scheduledStart,
    endTime: scheduledEnd,
  };

  const actualTimeData = {
    startTime: actualStart,
    endTime: actualEnd,
  };

  // workLog status 기반 type 설정 (상태 통일)
  const typeMap: Record<string, ScheduleEvent['type']> = {
    scheduled: 'confirmed',
    in_progress: 'confirmed',
    checked_in: 'confirmed',
    checked_out: 'completed', // checked_out과 completed 통일
    completed: 'completed',
    absent: 'cancelled',
    cancelled: 'cancelled',
  };

  // 출퇴근 완료 여부 확인
  const isCompleted =
    normalizedLog.status === 'completed' ||
    normalizedLog.status === 'checked_out' ||
    (normalizedLog.actualStartTime && normalizedLog.actualEndTime);

  // 근무 시간 계산 (분 단위) - 예정 시간 기준으로 변경
  let totalWorkMinutes = 0;

  // 예정 시간 기준으로 계산 (스태프탭에서 수정한 시간)
  if (scheduledTimeData.startTime && scheduledTimeData.endTime) {
    // Timestamp 타입 확인 후 toDate() 호출
    if (
      scheduledTimeData.startTime &&
      'toDate' in scheduledTimeData.startTime &&
      scheduledTimeData.endTime &&
      'toDate' in scheduledTimeData.endTime
    ) {
      const start = scheduledTimeData.startTime.toDate();
      const end = scheduledTimeData.endTime.toDate();
      totalWorkMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    }
  }
  // QR 기능 활성화 시 실제 시간 사용 - 현재는 주석 처리
  // else if (actualTimeData.startTime && actualTimeData.endTime) {
  //   if (actualTimeData.startTime && 'toDate' in actualTimeData.startTime &&
  //       actualTimeData.endTime && 'toDate' in actualTimeData.endTime) {
  //     const start = actualTimeData.startTime.toDate();
  //     const end = actualTimeData.endTime.toDate();
  //     totalWorkMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  //   }
  // }
  else if (normalizedLog.totalWorkMinutes) {
    totalWorkMinutes = normalizedLog.totalWorkMinutes;
  } else if (normalizedLog.hoursWorked) {
    totalWorkMinutes = normalizedLog.hoursWorked * 60;
  }

  // 급여 계산 (통합 유틸리티 사용)
  let payrollAmount = 0;

  // 통합 급여 계산 유틸리티 사용
  if (totalWorkMinutes > 0 && normalizedLog.role) {
    const { calculateSingleWorkLogPayroll } = await import('../../utils/payrollCalculations');
    // Note: JobPostingData와 JobPosting 타입이 약간 다르지만, 급여 계산에 필요한 필드는 호환됨
    payrollAmount = calculateSingleWorkLogPayroll(
      normalizedLog,
      normalizedLog.role,
      jobPostingData as Parameters<typeof calculateSingleWorkLogPayroll>[2]
    );
  }

  return {
    id: docId,
    type: isCompleted ? 'completed' : typeMap[normalizedLog.status || ''] || 'confirmed',
    date: normalizedLog.date,
    startTime: scheduledTimeData.startTime,
    endTime: scheduledTimeData.endTime,
    actualStartTime: actualTimeData.startTime,
    actualEndTime: actualTimeData.endTime,
    eventId: normalizedLog.eventId || '',
    eventName: eventName,
    location: location,
    ...(jobPostingData?.detailedAddress && { detailedAddress: jobPostingData.detailedAddress }),
    role: normalizedLog.role || '',
    status: (normalizedLog.status as AttendanceStatus) || 'not_started',
    notes: normalizedLog.notes || '',
    sourceCollection: 'workLogs' as const,
    sourceId: docId,
    workLogId: docId,
    // 급여 계산 정보 추가 (정산 상태 없이)
    ...(totalWorkMinutes > 0 && {
      payrollAmount: payrollAmount,
    }),
    // 🔥 스냅샷 데이터 포함 (공고 삭제 대비) - JobPosting에서 생성된 스냅샷 포함
    ...(snapshotData && { snapshotData }),
  };
};

/**
 * 스케줄 통계 계산
 */
export const calculateStats = (
  events: ScheduleEvent[]
): {
  totalEvents: number;
  pendingCount: number;
  confirmedCount: number;
  rejectedCount: number;
  byRole: { [key: string]: number };
  byLocation: { [key: string]: number };
  byDate: { [key: string]: number };
} => {
  const stats = {
    totalEvents: events.length,
    pendingCount: 0,
    confirmedCount: 0,
    rejectedCount: 0,
    byRole: {} as { [key: string]: number },
    byLocation: {} as { [key: string]: number },
    byDate: {} as { [key: string]: number },
  };

  events.forEach((event) => {
    // 상태별 카운트 - applicationStatus 사용
    if (event.applicationStatus === 'applied') {
      stats.pendingCount++;
    } else if (event.applicationStatus === 'confirmed') {
      stats.confirmedCount++;
    } else if (event.applicationStatus === 'rejected') {
      stats.rejectedCount++;
    } else if (event.type === 'confirmed') {
      // workLogs 등의 확정된 일정
      stats.confirmedCount++;
    }

    // 역할별 카운트
    if (event.role) {
      stats.byRole[event.role] = (stats.byRole[event.role] || 0) + 1;
    }

    // 위치별 카운트
    if (event.location) {
      stats.byLocation[event.location] = (stats.byLocation[event.location] || 0) + 1;
    }

    // 날짜별 카운트
    if (event.date) {
      stats.byDate[event.date] = (stats.byDate[event.date] || 0) + 1;
    }
  });

  return stats;
};
