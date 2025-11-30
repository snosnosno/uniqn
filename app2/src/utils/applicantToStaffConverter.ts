import { Timestamp } from 'firebase/firestore';
import { logger } from './logger';
import { createWorkLogId, createWorkLog, SimpleWorkLogInput } from './workLogSimplified';

/**
 * 지원자 정보로부터 스태프 문서를 생성하는 유틸리티
 */

export interface ApplicantData {
  applicantId: string;
  applicantName: string;
  email?: string;
  phone?: string;
  role?: string;
  timeSlot?: string;
  date?: string;
}

/**
 * 스태프 문서 데이터 인터페이스
 */
export interface StaffDocumentData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  timeSlot: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  status: 'active';
  eventIds: string[];
  confirmedAt: Timestamp;
  confirmedBy: string;
}

/**
 * WorkLog 문서 데이터 인터페이스 (createWorkLog 반환 타입)
 */
export interface WorkLogDocumentData {
  eventId: string;
  staffId: string;
  staffName: string;
  role: string;
  date: string;
  scheduledStartTime: Timestamp | null;
  scheduledEndTime: Timestamp | null;
  actualStartTime: null;
  actualEndTime: null;
  status: 'not_started' | 'checked_in' | 'completed' | 'absent';
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  hoursWorked: number;
  overtime: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StaffCreationResult {
  staffId: string;
  staffData: StaffDocumentData | null;
  workLogId?: string | undefined;
  workLogData?: WorkLogDocumentData | undefined;
  success: boolean;
  error?: string | undefined;
}

/**
 * 단일 지원자를 스태프로 변환
 * @param applicant 지원자 정보
 * @param eventId 이벤트 ID
 * @param managerId 관리자 ID
 * @returns 스태프 생성 결과
 */
export async function createStaffFromApplicant(
  applicant: ApplicantData,
  eventId: string,
  managerId: string
): Promise<StaffCreationResult> {
  try {
    const now = Timestamp.now();
    const staffId = applicant.applicantId;

    // 1. 스태프 문서 데이터 준비
    const staffData: StaffDocumentData = {
      id: staffId,
      name: applicant.applicantName,
      email: applicant.email || '',
      phone: applicant.phone || '',
      role: applicant.role || '',
      timeSlot: applicant.timeSlot || '',
      createdAt: now,
      updatedAt: now,
      createdBy: managerId,
      status: 'active' as const,
      // 추가 필드
      eventIds: [eventId],
      confirmedAt: now,
      confirmedBy: managerId,
    };

    // 2. WorkLog 데이터 준비 (날짜와 시간이 있는 경우)
    let workLogId: string | undefined;
    let workLogData: WorkLogDocumentData | undefined;

    if (applicant.date && applicant.timeSlot && applicant.timeSlot !== '미정') {
      workLogId = createWorkLogId(eventId, staffId, applicant.date);

      // 단순화된 WorkLog 생성
      const workLogInput: SimpleWorkLogInput = {
        eventId,
        staffId,
        staffName: applicant.applicantName,
        role: applicant.role || '',
        date: applicant.date,
        timeSlot: applicant.timeSlot,
        status: 'not_started',
      };

      workLogData = createWorkLog(workLogInput);
    }

    logger.info('스태프 생성 준비 완료', {
      component: 'applicantToStaffConverter',
      data: {
        staffId,
        eventId,
        hasWorkLog: !!workLogData,
      },
    });

    return {
      staffId,
      staffData,
      workLogId,
      workLogData,
      success: true,
    };
  } catch (error) {
    logger.error('스태프 변환 실패', error as Error, {
      component: 'applicantToStaffConverter',
      data: { applicant, eventId },
    });

    return {
      staffId: applicant.applicantId,
      staffData: null,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * 다중 지원자를 일괄 변환
 * @param applicants 지원자 목록
 * @param eventId 이벤트 ID
 * @param managerId 관리자 ID
 * @param onProgress 진행 상황 콜백
 * @returns 변환 결과 목록
 */
export async function batchConvertApplicants(
  applicants: ApplicantData[],
  eventId: string,
  managerId: string,
  onProgress?: (current: number, total: number) => void
): Promise<StaffCreationResult[]> {
  const results: StaffCreationResult[] = [];
  const total = applicants.length;

  for (let i = 0; i < total; i++) {
    const applicant = applicants[i];
    if (!applicant) continue;

    const result = await createStaffFromApplicant(applicant, eventId, managerId);
    results.push(result);

    // 진행 상황 콜백
    if (onProgress) {
      onProgress(i + 1, total);
    }

    // 대량 처리 시 서버 부하 방지를 위한 지연
    if (total > 10 && i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  logger.info('일괄 변환 완료', {
    component: 'applicantToStaffConverter',
    data: {
      total,
      successCount,
      failureCount,
    },
  });

  return results;
}

/**
 * 변환 검증
 * @param results 변환 결과 목록
 * @returns 검증 결과
 */
export function validateConversion(results: StaffCreationResult[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  results.forEach((result, index) => {
    if (!result.success) {
      errors.push(`변환 실패 #${index + 1}: ${result.error || '알 수 없는 오류'}`);
    }

    if (result.success && !result.workLogData) {
      warnings.push(`WorkLog 미생성 #${index + 1}: 날짜 또는 시간 정보 없음`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 스태프 변환 시 중복 검사
 * @param staffId 검사할 스태프 ID
 * @param existingStaffIds 기존 스태프 ID 목록
 * @returns 중복 여부
 */
export function checkDuplicateStaff(staffId: string, existingStaffIds: string[]): boolean {
  return existingStaffIds.includes(staffId);
}

/**
 * 시간대 충돌 검사
 * @param date 날짜
 * @param timeSlot 시간대
 * @param existingWorkLogs 기존 WorkLog 목록
 * @returns 충돌 여부
 */
export function checkTimeSlotConflict(
  date: string,
  timeSlot: string,
  existingWorkLogs: Array<{ date: string; timeSlot?: string; staffId: string }>
): boolean {
  return existingWorkLogs.some((log) => log.date === date && log.timeSlot === timeSlot);
}

/**
 * 변환 롤백 데이터 준비
 * @param results 변환 결과 목록
 * @returns 롤백 데이터
 */
export function prepareRollbackData(results: StaffCreationResult[]): {
  staffIds: string[];
  workLogIds: string[];
} {
  const staffIds: string[] = [];
  const workLogIds: string[] = [];

  results.forEach((result) => {
    if (result.success) {
      staffIds.push(result.staffId);
      if (result.workLogId) {
        workLogIds.push(result.workLogId);
      }
    }
  });

  return {
    staffIds,
    workLogIds,
  };
}
