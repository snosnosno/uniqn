import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { ValidationError, BusinessError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import type { Staff } from '@/types';
import { normalizeAssignmentRole } from '@/types/assignment';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';
import type { ConversionResult, ConversionOptions } from '../../interfaces';
import { resolvePrimaryApplicationRole } from './applicationRoleUtils';

export async function convertApplicantToStaffTransaction(
  applicationId: string,
  jobPostingId: string,
  managerId: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const { skipExisting = false, createWorkLogs = true, notes } = options;

  try {
    logger.info('지원자 스태프 전환 시작', { applicationId, jobPostingId, managerId });

    const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
    const applicationPreSnap = await getDoc(applicationRef);
    const applicantId = applicationPreSnap.data()?.applicantId as string | undefined;

    const existingWorkLogIds: string[] = [];
    if (!skipExisting && applicantId) {
      const existingWorkLogsQuery = query(
        collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS),
        where(FIELDS.WORK_LOG.staffId, '==', applicantId),
        where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId)
      );
      const existingWorkLogsSnap = await getDocs(existingWorkLogsQuery);
      existingWorkLogsSnap.docs.forEach((snapshot) => existingWorkLogIds.push(snapshot.id));
    }

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 지원서입니다.',
        });
      }

      const applicationData = parseApplicationDocument({
        id: applicationDoc.id,
        ...applicationDoc.data(),
      });

      if (!applicationData) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '지원서 데이터 형식이 올바르지 않습니다.',
        });
      }

      if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '확정된 지원만 스태프로 전환할 수 있습니다.',
        });
      }

      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 공고입니다.',
        });
      }

      const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });

      if (!jobData) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '공고 데이터 형식이 올바르지 않습니다.',
        });
      }

      if (jobData.ownerId !== managerId) {
        throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '본인 공고만 관리할 수 있습니다.',
        });
      }

      if (jobData.schedule.kind !== 'dated') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '고정 공고 스태프 전환은 V3 canonical 전환에서 지원하지 않습니다.',
        });
      }

      const staffRef = doc(getFirebaseDb(), COLLECTIONS.STAFF, applicationData.applicantId);
      const staffDoc = await transaction.get(staffRef);
      const isNewStaff = !staffDoc.exists();

      if (staffDoc.exists() && !skipExisting) {
        for (const workLogId of existingWorkLogIds) {
          const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);
          const workLogSnap = await transaction.get(workLogRef);
          if (!workLogSnap.exists()) {
            continue;
          }

          const workLogData = workLogSnap.data();
          if (
            workLogData?.staffId === applicationData.applicantId &&
            workLogData?.jobPostingId === jobPostingId
          ) {
            throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED, {
              userMessage: '이미 해당 공고의 스태프입니다.',
            });
          }
        }
      }

      const now = serverTimestamp();

      if (isNewStaff) {
        const primaryRole = resolvePrimaryApplicationRole(applicationData);
        const staffData: Omit<Staff, 'id'> = {
          userId: applicationData.applicantId,
          name: applicationData.applicantName,
          phone: applicationData.applicantPhone ?? '',
          email: applicationData.applicantEmail ?? '',
          role: primaryRole.role,
          ...(primaryRole.customRole ? { customRole: primaryRole.customRole } : {}),
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

      const workLogIds: string[] = [];

      if (createWorkLogs) {
        const assignments = applicationData.assignments ?? [];
        if (assignments.length === 0) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: '배정 정보가 없는 지원서는 스태프로 전환할 수 없습니다.',
          });
        }

        const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

        for (const assignment of assignments) {
          const normalizedRole = normalizeAssignmentRole(assignment.roleIds[0]);

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
              role: normalizedRole.role,
              customRole: normalizedRole.customRole ?? null,
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
        message: `${applicationData.applicantName}님이 스태프로 ${isNewStaff ? '등록' : '배정'}되었습니다.`,
      };
    });

    logger.info('지원자 스태프 전환 완료', {
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
      operation: '지원자 스태프 전환',
      component: 'ApplicationRepository',
      context: { applicationId },
    });
  }
}

export async function revertStaffConversionTransaction(
  applicationId: string,
  managerId: string
): Promise<void> {
  try {
    logger.info('스태프 전환 취소 시작', { applicationId, managerId });

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
      workLogDocIds = workLogsSnap.docs.map((snapshot) => snapshot.id);
    }

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const appDoc = await transaction.get(applicationRef);

      if (!appDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 지원서입니다.',
        });
      }

      const applicationData = parseApplicationDocument({
        id: appDoc.id,
        ...appDoc.data(),
      });

      if (!applicationData) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '지원서 데이터 형식이 올바르지 않습니다.',
        });
      }

      if (applicationData.status !== STATUS.APPLICATION.COMPLETED) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '완료된 지원만 취소할 수 있습니다.',
        });
      }

      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '존재하지 않는 공고입니다.',
        });
      }

      const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });

      if (!jobData) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '공고 데이터 형식이 올바르지 않습니다.',
        });
      }

      if (jobData.ownerId !== managerId) {
        throw new ValidationError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '본인 공고만 관리할 수 있습니다.',
        });
      }

      for (const workLogId of workLogDocIds) {
        const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);
        const workLogSnap = await transaction.get(workLogRef);
        if (!workLogSnap.exists()) {
          continue;
        }

        const workLogData = workLogSnap.data();
        if (workLogData?.status === STATUS.WORK_LOG.SCHEDULED) {
          transaction.update(workLogRef, {
            status: STATUS.WORK_LOG.CANCELLED,
            cancelledReason: '스태프 전환 취소',
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      transaction.update(applicationRef, {
        status: STATUS.APPLICATION.CONFIRMED,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('스태프 전환 취소 완료', {
      applicationId,
      cancelledWorkLogs: workLogDocIds.length,
    });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '스태프 전환 취소',
      component: 'ApplicationRepository',
      context: { applicationId },
    });
  }
}

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
    logger.error('스태프 존재 여부 확인 실패', toError(error), { userId, jobPostingId });
    return false;
  }
}

export async function canConvertToStaffQuery(applicationId: string): Promise<{
  canConvert: boolean;
  reason?: string;
}> {
  try {
    const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
    const applicationDoc = await getDoc(applicationRef);

    if (!applicationDoc.exists()) {
      return { canConvert: false, reason: '존재하지 않는 지원서입니다.' };
    }

    const applicationData = parseApplicationDocument({
      id: applicationDoc.id,
      ...applicationDoc.data(),
    });

    if (!applicationData) {
      return { canConvert: false, reason: '지원서 데이터 형식이 올바르지 않습니다.' };
    }

    if (applicationData.status === STATUS.APPLICATION.COMPLETED) {
      return { canConvert: false, reason: '이미 스태프로 전환되었습니다.' };
    }

    if (applicationData.status !== STATUS.APPLICATION.CONFIRMED) {
      return {
        canConvert: false,
        reason: `확정된 지원만 전환할 수 있습니다. 현재 상태: ${applicationData.status}`,
      };
    }

    return { canConvert: true };
  } catch (error) {
    logger.error('전환 가능 여부 확인 실패', toError(error), { applicationId });
    return { canConvert: false, reason: '확인 중 오류가 발생했습니다.' };
  }
}
