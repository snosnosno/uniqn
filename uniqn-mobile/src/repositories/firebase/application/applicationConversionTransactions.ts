/**
 * UNIQN Mobile - Application Conversion Transactions
 *
 * @description 지원자 → 스태프 변환 관련 트랜잭션
 * @version 1.0.0
 *
 * applicantConversionService에서 Firebase 직접 호출을 분리하여
 * Repository 패턴으로 이동한 모듈
 *
 * 수정사항:
 * - getDocs를 트랜잭션 밖(pre-fetch)으로 이동 → 원자적 검증
 * - revertConversion에서 WorkLog 취소 처리 추가
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
import { ValidationError, BusinessError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import type { Staff, StaffRole } from '@/types';
import { FIXED_DATE_MARKER } from '@/types/assignment';
import { VALID_STAFF_ROLES } from '@/types/role';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';
import type { ConversionResult, ConversionOptions } from '../../interfaces';

// Canonical role keys only. The transaction layer should depend on role ids,
// not UI-oriented metadata like labels and icons.
const STANDARD_ROLE_KEYS: string[] = VALID_STAFF_ROLES.filter((role) => role !== 'other');

/**
 * 역할이 표준 역할인지 확인하고, 커스텀 역할이면 { role: 'other', customRole } 반환
 */
function normalizeRole(roleValue: string): { role: string; customRole?: string } {
  if (STANDARD_ROLE_KEYS.includes(roleValue)) {
    return { role: roleValue };
  }
  return { role: 'other', customRole: roleValue };
}

// ============================================================================
// Conversion Transaction
// ============================================================================

/**
 * 지원자를 스태프로 변환 (트랜잭션)
 *
 * 비즈니스 로직:
 * 1. 기존 WorkLog pre-fetch (트랜잭션 밖에서 조회)
 * 2. 지원서/공고/스태프 문서 읽기 (트랜잭션 내)
 * 3. 기존 WorkLog 재검증 (트랜잭션 내 transaction.get)
 * 4. staff 문서 생성 또는 업데이트
 * 5. Assignment별 WorkLog 생성
 * 6. 지원서 상태를 completed로 변경
 */
export async function convertApplicantToStaffTransaction(
  applicationId: string,
  jobPostingId: string,
  managerId: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const { skipExisting = false, createWorkLogs = true, notes } = options;

  try {
    logger.info('지원자→스태프 변환 시작', { applicationId, jobPostingId, managerId });

    // Pre-read: 지원서를 먼저 읽어 applicantId 확보 (트랜잭션 내에서 재검증됨)
    const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
    const applicationPreSnap = await getDoc(applicationRef);
    const applicantId = applicationPreSnap.data()?.applicantId as string | undefined;

    // Pre-fetch: 기존 WorkLog 조회 (staffId + jobPostingId로 범위 축소)
    const existingWorkLogIds: string[] = [];
    if (!skipExisting && applicantId) {
      const existingWorkLogsQuery = query(
        collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS),
        where(FIELDS.WORK_LOG.staffId, '==', applicantId),
        where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId)
      );
      const existingWorkLogsSnap = await getDocs(existingWorkLogsQuery);
      existingWorkLogsSnap.docs.forEach((d) => existingWorkLogIds.push(d.id));
    }

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 지원서 읽기 (트랜잭션 내 재검증)
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 지원입니다',
        });
      }

      const applicationData = parseApplicationDocument({
        id: applicationDoc.id,
        ...applicationDoc.data(),
      });

      if (!applicationData) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '지원서 데이터 형식이 올바르지 않습니다',
        });
      }

      // 확정 상태 확인
      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '확정된 지원만 스태프로 변환할 수 있습니다',
        });
      }

      // 2. 공고 읽기 (권한 확인)
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });

      if (!jobData) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '공고 데이터 형식이 올바르지 않습니다',
        });
      }

      // 공고 소유자 확인
      if (jobData.ownerId !== managerId) {
        throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 3. 스태프 중복 확인
      const staffRef = doc(getFirebaseDb(), COLLECTIONS.STAFF, applicationData.applicantId);
      const staffDoc = await transaction.get(staffRef);
      const isNewStaff = !staffDoc.exists();

      if (staffDoc.exists() && !skipExisting) {
        // Pre-fetch한 WorkLog ID들을 트랜잭션 내에서 재검증
        for (const wlId of existingWorkLogIds) {
          const wlRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, wlId);
          const wlSnap = await transaction.get(wlRef);
          if (wlSnap.exists()) {
            const wlData = wlSnap.data();
            if (
              wlData?.staffId === applicationData.applicantId &&
              wlData?.jobPostingId === jobPostingId
            ) {
              throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED, {
                userMessage: '이미 해당 공고의 스태프입니다',
              });
            }
          }
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
          role: (applicationData.assignments[0]?.roleIds?.[0] || 'other') as StaffRole,
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
        const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

        // 고정공고 또는 레거시: assignments가 없거나 dates가 FIXED_DATE_MARKER인 경우
        const isFixedOrLegacy =
          assignments.length === 0 ||
          (assignments.length === 1 && assignments[0].dates[0] === FIXED_DATE_MARKER);

        if (isFixedOrLegacy) {
          // 단일 WorkLog 생성 (고정공고/레거시)
          const rawRole = assignments[0]?.roleIds?.[0] || 'other';
          const { role, customRole } = normalizeRole(rawRole);
          const workLogRef = doc(workLogsRef);
          const workLogData = {
            staffId: applicationData.applicantId,
            staffName: applicationData.applicantName,
            staffNickname: applicationData.applicantNickname ?? null,
            staffPhotoURL: applicationData.applicantPhotoURL ?? null,
            jobPostingId,
            jobPostingName: jobData.title,
            ownerId: jobData.ownerId,
            role,
            customRole: customRole ?? null,
            date: null,
            timeSlot: null,
            isFixedPosting: true,
            status: STATUS.WORK_LOG.SCHEDULED,
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
            const rawRole = assignment.roleIds[0] || 'other';
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
                ownerId: jobData.ownerId,
                role,
                customRole: customRole ?? null,
                date,
                timeSlot: assignment.timeSlot,
                isTimeToBeAnnounced: assignment.isTimeToBeAnnounced ?? false,
                tentativeDescription: assignment.tentativeDescription ?? null,
                status: STATUS.WORK_LOG.SCHEDULED,
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
        status: STATUS.APPLICATION.COMPLETED,
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
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원자→스태프 변환',
      component: 'ApplicationRepository',
      context: { applicationId },
    });
  }
}

// ============================================================================
// Revert Conversion Transaction
// ============================================================================

/**
 * 스태프 변환 취소 (롤백 트랜잭션)
 *
 * 비즈니스 로직:
 * 1. 관련 WorkLog pre-fetch (트랜잭션 밖)
 * 2. 지원서/공고 읽기 + 권한 확인
 * 3. 지원서 상태 confirmed로 복원
 * 4. 관련 WorkLog cancelled 처리
 */
export async function revertStaffConversionTransaction(
  applicationId: string,
  managerId: string
): Promise<void> {
  try {
    logger.info('스태프 변환 취소 시작', { applicationId, managerId });

    // Pre-fetch: 관련 WorkLog 조회
    const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
    const applicationSnap = await getDoc(applicationRef);
    const applicationRaw = applicationSnap.data();

    let workLogDocIds: string[] = [];
    if (applicationRaw?.applicantId && applicationRaw?.jobPostingId) {
      const workLogsQuery = query(
        collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS),
        where(FIELDS.WORK_LOG.staffId, '==', applicationRaw.applicantId),
        where(FIELDS.WORK_LOG.jobPostingId, '==', applicationRaw.jobPostingId)
      );
      const workLogsSnap = await getDocs(workLogsQuery);
      workLogDocIds = workLogsSnap.docs.map((d) => d.id);
    }

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 지원서 읽기
      const appDoc = await transaction.get(applicationRef);

      if (!appDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 지원입니다',
        });
      }

      const applicationData = parseApplicationDocument({
        id: appDoc.id,
        ...appDoc.data(),
      });

      if (!applicationData) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '지원서 데이터 형식이 올바르지 않습니다',
        });
      }

      if (applicationData.status !== STATUS.APPLICATION.COMPLETED) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '완료된 지원만 취소할 수 있습니다',
        });
      }

      // 공고 소유자 확인
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });

      if (!jobData) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '공고 데이터 형식이 올바르지 않습니다',
        });
      }

      if (jobData.ownerId !== managerId) {
        throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        });
      }

      // 관련 WorkLog 취소 처리 (pre-fetch한 ID를 트랜잭션 내에서 재검증)
      for (const wlId of workLogDocIds) {
        const wlRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, wlId);
        const wlSnap = await transaction.get(wlRef);
        if (wlSnap.exists()) {
          const wlData = wlSnap.data();
          // scheduled 상태만 취소 (이미 출퇴근한 건 유지)
          if (wlData?.status === STATUS.WORK_LOG.SCHEDULED) {
            transaction.update(wlRef, {
              status: STATUS.WORK_LOG.CANCELLED,
              cancelledReason: '스태프 변환 취소',
              cancelledAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      // 지원서 상태 복원
      transaction.update(applicationRef, {
        status: STATUS.APPLICATION.CONFIRMED,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('스태프 변환 취소 완료', {
      applicationId,
      cancelledWorkLogs: workLogDocIds.length,
    });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '스태프 변환 취소',
      component: 'ApplicationRepository',
      context: { applicationId },
    });
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * 스태프 존재 여부 확인
 */
export async function isAlreadyStaffQuery(userId: string, jobPostingId?: string): Promise<boolean> {
  try {
    const staffRef = doc(getFirebaseDb(), COLLECTIONS.STAFF, userId);
    const staffDoc = await getDoc(staffRef);

    if (!staffDoc.exists()) {
      return false;
    }

    if (jobPostingId) {
      const workLogsQuery = query(
        collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS),
        where(FIELDS.WORK_LOG.staffId, '==', userId),
        where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId)
      );
      const workLogs = await getDocs(workLogsQuery);
      return !workLogs.empty;
    }

    return true;
  } catch (error) {
    logger.error('스태프 존재 확인 실패', toError(error), { userId, jobPostingId });
    return false;
  }
}

/**
 * 변환 가능 여부 확인
 */
export async function canConvertToStaffQuery(applicationId: string): Promise<{
  canConvert: boolean;
  reason?: string;
}> {
  try {
    const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
    const applicationDoc = await getDoc(applicationRef);

    if (!applicationDoc.exists()) {
      return { canConvert: false, reason: '존재하지 않는 지원입니다' };
    }

    const applicationData = parseApplicationDocument({
      id: applicationDoc.id,
      ...applicationDoc.data(),
    });

    if (!applicationData) {
      return { canConvert: false, reason: '지원서 데이터 형식이 올바르지 않습니다' };
    }

    if (applicationData.status === STATUS.APPLICATION.COMPLETED) {
      return { canConvert: false, reason: '이미 스태프로 변환되었습니다' };
    }

    if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
      return {
        canConvert: false,
        reason: `확정된 지원만 변환 가능합니다 (현재: ${applicationData.status})`,
      };
    }

    return { canConvert: true };
  } catch (error) {
    logger.error('변환 가능 여부 확인 실패', toError(error), { applicationId });
    return { canConvert: false, reason: '확인 중 오류가 발생했습니다' };
  }
}
