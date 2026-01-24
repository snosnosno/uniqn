/**
 * UNIQN Mobile - 지원자 → 스태프 변환 서비스
 *
 * @description 지원자를 스태프로 변환하고 WorkLog 생성
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError, ValidationError, BusinessError, ERROR_CODES } from '@/errors';
import type { Application, Staff, JobPosting } from '@/types';
import { FIXED_DATE_MARKER } from '@/types/assignment';
import { STAFF_ROLES } from '@/constants';

// 표준 역할 키 목록 (other 제외)
const STANDARD_ROLE_KEYS: string[] = STAFF_ROLES.filter((r) => r.key !== 'other').map((r) => r.key);

/**
 * 역할이 표준 역할인지 확인하고, 커스텀 역할이면 { role: 'other', customRole } 반환
 */
function normalizeRole(roleValue: string): { role: string; customRole?: string } {
  if (STANDARD_ROLE_KEYS.includes(roleValue)) {
    return { role: roleValue };
  }
  // 커스텀 역할
  return { role: 'other', customRole: roleValue };
}

// ============================================================================
// Constants
// ============================================================================

const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const WORK_LOGS_COLLECTION = 'workLogs';
const STAFF_COLLECTION = 'staff';

// ============================================================================
// Types
// ============================================================================

export interface ConversionResult {
  applicationId: string;
  staffId: string;
  workLogIds: string[];
  isNewStaff: boolean;
  message: string;
}

export interface BulkConversionResult {
  successCount: number;
  failedCount: number;
  results: ConversionResult[];
  failedApplications: {
    applicationId: string;
    error: string;
  }[];
}

export interface ConversionOptions {
  /** 이미 스태프인 경우 건너뛰기 (기본: false, 에러 발생) */
  skipExisting?: boolean;
  /** WorkLog 생성 여부 (기본: true) */
  createWorkLogs?: boolean;
  /** 변환 메모 */
  notes?: string;
}

// ============================================================================
// Applicant Conversion Service
// ============================================================================

/**
 * 지원자를 스태프로 변환 (트랜잭션)
 *
 * 비즈니스 로직:
 * 1. 지원서 상태 확인 (confirmed 필수)
 * 2. 이미 스태프인지 확인 (중복 방지)
 * 3. staff 문서 생성 또는 업데이트
 * 4. Assignment별 WorkLog 생성
 * 5. 지원서 상태를 completed로 변경
 */
export async function convertApplicantToStaff(
  applicationId: string,
  jobPostingId: string,
  managerId: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const { skipExisting = false, createWorkLogs = true, notes } = options;

  try {
    logger.info('지원자→스태프 변환 시작', { applicationId, jobPostingId, managerId });

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 지원서 읽기
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 지원입니다',
        });
      }

      const applicationData = applicationDoc.data() as Application;

      // 확정 상태 확인
      if (applicationData.status !== 'confirmed') {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '확정된 지원만 스태프로 변환할 수 있습니다',
        });
      }

      // 2. 공고 읽기 (권한 확인)
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const jobData = jobDoc.data() as JobPosting;

      // 공고 소유자 확인
      if (jobData.ownerId !== managerId) {
        throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 3. 스태프 중복 확인
      const staffRef = doc(getFirebaseDb(), STAFF_COLLECTION, applicationData.applicantId);
      const staffDoc = await transaction.get(staffRef);
      const isNewStaff = !staffDoc.exists();

      if (staffDoc.exists() && !skipExisting) {
        // 해당 공고에서 이미 스태프인지 확인
        const existingWorkLogsQuery = query(
          collection(getFirebaseDb(), WORK_LOGS_COLLECTION),
          where('staffId', '==', applicationData.applicantId),
          where('jobPostingId', '==', jobPostingId)
        );
        const existingWorkLogs = await getDocs(existingWorkLogsQuery);

        if (!existingWorkLogs.empty) {
          throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED, {
            userMessage: '이미 해당 공고의 스태프입니다',
          });
        }
      }

      // 4. 스태프 문서 생성/업데이트
      const now = serverTimestamp();
      if (isNewStaff) {
        const staffData: Omit<Staff, 'id'> = {
          userId: applicationData.applicantId,
          name: applicationData.applicantName,
          phone: applicationData.applicantPhone ?? '',
          email: applicationData.applicantEmail ?? '',
          role: applicationData.appliedRole,
          isActive: true,
          totalWorkCount: 0,
          rating: 0,
          createdAt: now as Timestamp,
          updatedAt: now as Timestamp,
        };
        transaction.set(staffRef, staffData);
      } else {
        transaction.update(staffRef, {
          isActive: true,
          updatedAt: now,
        });
      }

      // 5. WorkLog 생성 (Assignment별)
      const workLogIds: string[] = [];

      if (createWorkLogs) {
        const assignments = applicationData.assignments ?? [];
        const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);

        // 고정공고 또는 레거시: assignments가 없거나 dates가 FIXED_DATE_MARKER인 경우
        const isFixedOrLegacy =
          assignments.length === 0 ||
          (assignments.length === 1 && assignments[0].dates[0] === FIXED_DATE_MARKER);

        if (isFixedOrLegacy) {
          // 단일 WorkLog 생성 (고정공고/레거시)
          const rawRole = assignments[0]?.roleIds?.[0] ?? applicationData.appliedRole;
          const { role, customRole } = normalizeRole(rawRole);
          const workLogRef = doc(workLogsRef);
          const workLogData = {
            staffId: applicationData.applicantId,
            staffName: applicationData.applicantName,
            staffNickname: applicationData.applicantNickname ?? null,
            staffPhotoURL: applicationData.applicantPhotoURL ?? null,
            jobPostingId,
            jobPostingName: jobData.title,
            // 하위 호환성: eventId도 함께 저장
            eventId: jobPostingId,
            eventName: jobData.title,
            ownerId: jobData.ownerId, // 구인자 ID (신고 기능 등에서 사용)
            role,
            customRole: customRole ?? null,
            date: null, // 고정공고는 날짜 없음
            timeSlot: null, // 고정공고는 시간 협의
            isFixedPosting: true, // 고정공고 플래그
            status: 'scheduled',
            attendanceStatus: 'not_started',
            checkInTime: null,
            checkOutTime: null,
            workDuration: null,
            payrollAmount: null,
            isSettled: false,
            checkMethod: 'individual',
            createdAt: now,
            updatedAt: now,
          };

          transaction.set(workLogRef, workLogData);
          workLogIds.push(workLogRef.id);
        } else {
          // Assignment별 WorkLog 생성 (일반 공고)
          for (const assignment of assignments) {
            // v3.0: roleIds 사용 (커스텀 역할 지원)
            const rawRole = assignment.roleIds[0] ?? applicationData.appliedRole;
            const { role, customRole } = normalizeRole(rawRole);

            for (const date of assignment.dates) {
              const workLogRef = doc(workLogsRef);
              const workLogData = {
                staffId: applicationData.applicantId,
                staffName: applicationData.applicantName,
                staffNickname: applicationData.applicantNickname ?? null,
                staffPhotoURL: applicationData.applicantPhotoURL ?? null,
                jobPostingId,
                jobPostingName: jobData.title,
                // 하위 호환성: eventId도 함께 저장
                eventId: jobPostingId,
                eventName: jobData.title,
                ownerId: jobData.ownerId, // 구인자 ID (신고 기능 등에서 사용)
                role,
                customRole: customRole ?? null,
                date,
                timeSlot: assignment.timeSlot,
                // 미정 시간 정보
                isTimeToBeAnnounced: assignment.isTimeToBeAnnounced ?? false,
                tentativeDescription: assignment.tentativeDescription ?? null,
                status: 'scheduled',
                attendanceStatus: 'not_started',
                checkInTime: null,
                checkOutTime: null,
                workDuration: null,
                payrollAmount: null,
                isSettled: false,
                assignmentGroupId: assignment.groupId,
                checkMethod: assignment.checkMethod ?? 'individual',
                createdAt: now,
                updatedAt: now,
              };

              transaction.set(workLogRef, workLogData);
              workLogIds.push(workLogRef.id);
            }
          }
        }
      }

      // 6. 지원서 상태 업데이트
      transaction.update(applicationRef, {
        status: 'completed',
        processedBy: managerId,
        processedAt: serverTimestamp(),
        notes: notes ?? applicationData.notes,
        updatedAt: serverTimestamp(),
      });

      return {
        applicationId,
        staffId: applicationData.applicantId,
        workLogIds,
        isNewStaff,
        message: `${applicationData.applicantName}님이 스태프로 ${isNewStaff ? '등록' : '배정'}되었습니다`,
      };
    });

    logger.info('지원자→스태프 변환 완료', {
      applicationId,
      staffId: result.staffId,
      workLogIds: result.workLogIds,
    });

    return result;
  } catch (error) {
    logger.error('지원자→스태프 변환 실패', error as Error, { applicationId });
    throw error instanceof ValidationError || error instanceof BusinessError
      ? error
      : mapFirebaseError(error);
  }
}

/**
 * 일괄 변환 (배치)
 *
 * @description 여러 지원자를 한 번에 스태프로 변환
 */
export async function batchConvertApplicants(
  applicationIds: string[],
  jobPostingId: string,
  managerId: string,
  options: ConversionOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<BulkConversionResult> {
  try {
    logger.info('일괄 스태프 변환 시작', {
      count: applicationIds.length,
      jobPostingId,
      managerId,
    });

    const result: BulkConversionResult = {
      successCount: 0,
      failedCount: 0,
      results: [],
      failedApplications: [],
    };

    // 순차적으로 처리 (트랜잭션 충돌 방지)
    for (let i = 0; i < applicationIds.length; i++) {
      const applicationId = applicationIds[i];

      try {
        const conversionResult = await convertApplicantToStaff(
          applicationId,
          jobPostingId,
          managerId,
          { ...options, skipExisting: true }
        );
        result.successCount++;
        result.results.push(conversionResult);
      } catch (error) {
        result.failedCount++;
        result.failedApplications.push({
          applicationId,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
        logger.warn('일괄 변환 중 실패', { applicationId, error });
      }

      // 진행 상황 콜백
      if (onProgress) {
        onProgress(i + 1, applicationIds.length);
      }
    }

    logger.info('일괄 스태프 변환 완료', {
      successCount: result.successCount,
      failedCount: result.failedCount,
    });

    return result;
  } catch (error) {
    logger.error('일괄 스태프 변환 실패', error as Error);
    throw mapFirebaseError(error);
  }
}

/**
 * 스태프 존재 여부 확인
 */
export async function isAlreadyStaff(
  userId: string,
  jobPostingId?: string
): Promise<boolean> {
  try {
    const staffRef = doc(getFirebaseDb(), STAFF_COLLECTION, userId);
    const staffDoc = await getDoc(staffRef);

    if (!staffDoc.exists()) {
      return false;
    }

    // jobPostingId가 지정된 경우 해당 공고의 WorkLog 존재 확인
    if (jobPostingId) {
      const workLogsQuery = query(
        collection(getFirebaseDb(), WORK_LOGS_COLLECTION),
        where('staffId', '==', userId),
        where('jobPostingId', '==', jobPostingId)
      );
      const workLogs = await getDocs(workLogsQuery);
      return !workLogs.empty;
    }

    return true;
  } catch (error) {
    logger.error('스태프 존재 확인 실패', error as Error, { userId, jobPostingId });
    return false;
  }
}

/**
 * 변환 가능 여부 확인
 */
export async function canConvertToStaff(applicationId: string): Promise<{
  canConvert: boolean;
  reason?: string;
}> {
  try {
    const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
    const applicationDoc = await getDoc(applicationRef);

    if (!applicationDoc.exists()) {
      return { canConvert: false, reason: '존재하지 않는 지원입니다' };
    }

    const applicationData = applicationDoc.data() as Application;

    // completed 상태 먼저 체크 (이미 변환된 경우)
    if (applicationData.status === 'completed') {
      return { canConvert: false, reason: '이미 스태프로 변환되었습니다' };
    }

    // confirmed 상태인지 체크
    if (applicationData.status !== 'confirmed') {
      return {
        canConvert: false,
        reason: `확정된 지원만 변환 가능합니다 (현재: ${applicationData.status})`,
      };
    }

    return { canConvert: true };
  } catch (error) {
    logger.error('변환 가능 여부 확인 실패', error as Error, { applicationId });
    return { canConvert: false, reason: '확인 중 오류가 발생했습니다' };
  }
}

/**
 * 스태프 변환 취소 (롤백)
 *
 * @description completed 상태를 confirmed로 되돌림
 */
export async function revertStaffConversion(
  applicationId: string,
  managerId: string
): Promise<void> {
  try {
    logger.info('스태프 변환 취소 시작', { applicationId, managerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 지원서 읽기
      const applicationRef = doc(getFirebaseDb(), APPLICATIONS_COLLECTION, applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 지원입니다',
        });
      }

      const applicationData = applicationDoc.data() as Application;

      if (applicationData.status !== 'completed') {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '완료된 지원만 취소할 수 있습니다',
        });
      }

      // 공고 소유자 확인
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const jobData = jobDoc.data() as JobPosting;
      if (jobData.ownerId !== managerId) {
        throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 지원서 상태 복원
      transaction.update(applicationRef, {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });

      // Note: WorkLog 삭제는 별도 로직 필요 (선택적)
    });

    logger.info('스태프 변환 취소 완료', { applicationId });
  } catch (error) {
    logger.error('스태프 변환 취소 실패', error as Error, { applicationId });
    throw error instanceof ValidationError ? error : mapFirebaseError(error);
  }
}
