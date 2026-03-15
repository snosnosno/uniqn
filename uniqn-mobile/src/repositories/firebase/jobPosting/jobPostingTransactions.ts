/**
 * UNIQN Mobile - JobPosting Repository 쓰기/트랜잭션 연산
 *
 * @description 공고 생성, 수정, 삭제, 마감, 재오픈, 일괄 상태 변경 등 쓰기 연산
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  updateDoc,
  increment,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, PermissionError, ERROR_CODES, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseJobPostingDocument, parseJobPostingDocuments } from '@/schemas';
import { COLLECTIONS, FIELDS, FIREBASE_LIMITS, STATUS } from '@/constants';
import { serializeJobPostingV3, toCreateJobPostingInput } from '@/domains/job-posting';
import { removeUndefined } from '@/utils/firestore/removeUndefined';
import type {
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
} from '../../interfaces';
import type {
  JobPosting,
  JobPostingStatus,
  CreateJobPostingInput,
  UpdateJobPostingInput,
} from '@/types';

// ============================================================================
// Simple Write Operations
// ============================================================================

export async function incrementViewCount(jobPostingId: string): Promise<void> {
  try {
    const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);

    await updateDoc(docRef, {
      viewCount: increment(1),
    });

    logger.debug('조회수 증가', { jobPostingId });
  } catch (error) {
    // 조회수 증가 실패는 무시 (사용자 경험에 영향 없음)
    logger.warn('조회수 증가 실패', { jobPostingId, error: toError(error) });
  }
}

export async function updateStatus(jobPostingId: string, status: JobPostingStatus): Promise<void> {
  try {
    logger.info('공고 상태 변경', { jobPostingId, status });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);

    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    logger.info('공고 상태 변경 완료', { jobPostingId, status });
  } catch (error) {
    logger.error('공고 상태 변경 실패', toError(error), {
      jobPostingId,
      status,
    });
    throw handleServiceError(error, {
      operation: '공고 상태 변경',
      component: 'JobPostingRepository',
      context: { jobPostingId, status },
    });
  }
}

// ============================================================================
// Transaction Operations
// ============================================================================

// Note: 인터페이스 메서드명 "createWithTransaction"이지만 실제로는 setDoc 단독 사용.
// 여러 곳(IJobPostingRepository, jobManagementService, tests)에서 참조하므로 이름 유지.
// 향후 공고 생성과 동시에 알림/활동 로그를 원자적으로 생성해야 하면 실제 트랜잭션으로 전환 필요.
export async function createWithTransaction(
  input: CreateJobPostingInput,
  context: CreateJobPostingContext
): Promise<CreateJobPostingResult> {
  try {
    logger.info('공고 생성', {
      ownerId: context.ownerId,
      title: input.title,
    });

    const jobsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
    const newDocRef = doc(jobsRef);
    const now = Timestamp.now();
    const current: Partial<JobPosting> = {
      id: newDocRef.id,
      viewCount: 0,
      applicationCount: 0,
      filledPositions: 0,
      ...(input.postingType === 'tournament'
        ? {
            tournamentConfig: {
              approvalStatus: STATUS.TOURNAMENT.PENDING,
              submittedAt: now,
            },
          }
        : {}),
      ...(input.postingType === 'fixed'
        ? {
            fixedConfig: {
              durationDays: 7 as const,
              createdAt: now,
              expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
            },
          }
        : {}),
    };

    const serialized = serializeJobPostingV3(input, {
      ownerId: context.ownerId,
      ownerName: context.ownerName,
      status: STATUS.JOB_POSTING.ACTIVE,
      current,
      createdAt: now,
      updatedAt: now,
    });
    const { id: _id, ...jobPostingData } = removeUndefined(
      serialized as unknown as Record<string, unknown>
    );

    await setDoc(newDocRef, jobPostingData);

    const jobPosting = parseJobPostingDocument({
      id: newDocRef.id,
      ...jobPostingData,
    });

    if (!jobPosting) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '생성된 공고 데이터를 확인할 수 없습니다',
      });
    }

    logger.info('공고 생성 완료', { id: newDocRef.id });

    return { id: newDocRef.id, jobPosting };
  } catch (error) {
    logger.error('공고 생성 실패', toError(error), {
      ownerId: context.ownerId,
    });
    throw handleServiceError(error, {
      operation: '공고 생성',
      component: 'JobPostingRepository',
      context: { ownerId: context.ownerId },
    });
  }
}

export async function updateWithTransaction(
  jobPostingId: string,
  input: UpdateJobPostingInput,
  ownerId: string
): Promise<JobPosting> {
  try {
    logger.info('공고 수정 (트랜잭션)', { jobPostingId, ownerId });

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({
        id: jobDoc.id,
        ...jobDoc.data(),
      });
      if (!currentData) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '공고 데이터가 올바르지 않습니다',
        });
      }

      // 본인 확인
      if (currentData.ownerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 수정할 수 있습니다',
        });
      }

      // 확정된 지원자가 있는 경우 일정/역할 수정 불가
      const hasConfirmedApplicants = (currentData.filledPositions ?? 0) > 0;
      const hasScheduleMutation =
        input.workDate !== undefined ||
        input.timeSlot !== undefined ||
        input.startTime !== undefined ||
        input.dateSpecificRequirements !== undefined ||
        input.daysPerWeek !== undefined ||
        input.isStartTimeNegotiable !== undefined ||
        input.roles !== undefined;

      if (hasConfirmedApplicants) {
        if (hasScheduleMutation) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '확정된 지원자가 있는 경우 일정 및 역할을 수정할 수 없습니다',
          });
        }
      }

      const baseInput = toCreateJobPostingInput(currentData);
      const mergedInput: CreateJobPostingInput = {
        ...baseInput,
        ...input,
        location: input.location
          ? {
              ...baseInput.location,
              ...input.location,
            }
          : baseInput.location,
        roles: input.roles ?? baseInput.roles,
      };
      const updatedAt = Timestamp.now();
      const serialized = serializeJobPostingV3(mergedInput, {
        ownerId: currentData.ownerId,
        ownerName: currentData.ownerName,
        status: input.status ?? currentData.status,
        current: currentData,
        createdAt: currentData.createdAt,
        updatedAt,
      });
      const { id: _id, ...nextDocument } = removeUndefined(
        serialized as unknown as Record<string, unknown>
      );

      transaction.set(jobRef, nextDocument);

      const parsed = parseJobPostingDocument({
        id: jobPostingId,
        ...nextDocument,
      });

      if (!parsed) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '수정된 공고 데이터를 확인할 수 없습니다',
        });
      }

      return parsed;
    });

    logger.info('공고 수정 완료', { jobPostingId });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('공고 수정 실패', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: '공고 수정',
      component: 'JobPostingRepository',
      context: { jobPostingId },
    });
  }
}

export async function deleteWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('공고 삭제 (트랜잭션)', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({
        id: jobDoc.id,
        ...jobDoc.data(),
      });
      if (!currentData) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '공고 데이터가 올바르지 않습니다',
        });
      }

      // 본인 확인
      if (currentData.ownerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 삭제할 수 있습니다',
        });
      }

      // 확정된 지원자가 있는 경우 삭제 불가
      const hasConfirmedApplicants = (currentData.filledPositions ?? 0) > 0;
      if (hasConfirmedApplicants) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '확정된 지원자가 있는 공고는 삭제할 수 없습니다. 마감 처리를 해주세요',
        });
      }

      // Soft Delete: status를 cancelled로 변경
      transaction.update(jobRef, {
        status: STATUS.JOB_POSTING.CANCELLED,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('공고 삭제 완료', { jobPostingId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('공고 삭제 실패', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: '공고 삭제',
      component: 'JobPostingRepository',
      context: { jobPostingId },
    });
  }
}

export async function closeWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('공고 마감 (트랜잭션)', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({
        id: jobDoc.id,
        ...jobDoc.data(),
      });
      if (!currentData) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '공고 데이터가 올바르지 않습니다',
        });
      }

      // 본인 확인
      if (currentData.ownerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 마감할 수 있습니다',
        });
      }

      // 이미 마감된 경우
      if (currentData.status === STATUS.JOB_POSTING.CLOSED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 마감된 공고입니다',
        });
      }

      transaction.update(jobRef, {
        status: STATUS.JOB_POSTING.CLOSED,
        closedAt: serverTimestamp(),
        closedReason: 'manual',
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('공고 마감 완료', { jobPostingId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('공고 마감 실패', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: '공고 마감',
      component: 'JobPostingRepository',
      context: { jobPostingId },
    });
  }
}

export async function reopenWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('공고 재오픈 (트랜잭션)', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({
        id: jobDoc.id,
        ...jobDoc.data(),
      });
      if (!currentData) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '공고 데이터가 올바르지 않습니다',
        });
      }

      // 본인 확인
      if (currentData.ownerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 재오픈할 수 있습니다',
        });
      }

      // 활성 상태인 경우
      if (currentData.status === STATUS.JOB_POSTING.ACTIVE) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 활성 상태인 공고입니다',
        });
      }

      // 취소된 공고는 재오픈 불가
      if (currentData.status === STATUS.JOB_POSTING.CANCELLED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '삭제된 공고는 재오픈할 수 없습니다. 새 공고를 작성해주세요',
        });
      }

      // 고정공고인 경우 expiresAt 갱신
      const updateData: Record<string, unknown> = {
        status: STATUS.JOB_POSTING.ACTIVE,
        updatedAt: serverTimestamp(),
      };

      if (currentData.postingType === 'fixed') {
        updateData.fixedConfig = {
          ...currentData.fixedConfig,
          durationDays: 7,
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        };
      }

      transaction.update(jobRef, updateData);
    });

    logger.info('공고 재오픈 완료', { jobPostingId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('공고 재오픈 실패', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: '공고 재오픈',
      component: 'JobPostingRepository',
      context: { jobPostingId },
    });
  }
}

export async function updateSettlementSettings(
  jobPostingId: string,
  data: {
    roles: Record<string, unknown>[];
    allowances: Record<string, unknown>;
    taxSettings: { type: string; value: number; taxableItems?: string[] };
  },
  ownerId: string
): Promise<void> {
  try {
    logger.info('정산 설정 저장', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({
        id: jobDoc.id,
        ...jobDoc.data(),
      });
      if (!currentData) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '공고 데이터가 올바르지 않습니다',
        });
      }

      if (currentData.ownerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 수정할 수 있습니다',
        });
      }

      const baseInput = toCreateJobPostingInput(currentData);
      const mergedInput: CreateJobPostingInput = {
        ...baseInput,
        roles: data.roles as unknown as CreateJobPostingInput['roles'],
        allowances: data.allowances as CreateJobPostingInput['allowances'],
        taxSettings: data.taxSettings as CreateJobPostingInput['taxSettings'],
      };
      const updatedAt = Timestamp.now();
      const serialized = serializeJobPostingV3(mergedInput, {
        ownerId: currentData.ownerId,
        ownerName: currentData.ownerName,
        status: currentData.status,
        current: currentData,
        createdAt: currentData.createdAt,
        updatedAt,
      });
      const { id: _id, ...nextDocument } = removeUndefined(
        serialized as unknown as Record<string, unknown>
      );

      transaction.set(jobRef, nextDocument);
    });

    logger.info('정산 설정 저장 완료', { jobPostingId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('정산 설정 저장 실패', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: '정산 설정 저장',
      component: 'JobPostingRepository',
      context: { jobPostingId, ownerId },
    });
  }
}

export async function getStatsByOwnerId(ownerId: string): Promise<JobPostingStats> {
  try {
    logger.info('소유자별 공고 통계 조회', { ownerId });

    const jobsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
    const q = query(jobsRef, where(FIELDS.JOB_POSTING.ownerId, '==', ownerId));

    const snapshot = await getDocs(q);
    const jobPostings = parseJobPostingDocuments(
      snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }))
    );

    const stats: JobPostingStats = {
      total: 0,
      active: 0,
      closed: 0,
      cancelled: 0,
      totalApplications: 0,
      totalViews: 0,
    };

    jobPostings.forEach((data) => {
      stats.total++;
      stats.totalApplications += data.applicationCount ?? 0;
      stats.totalViews += data.viewCount ?? 0;

      switch (data.status) {
        case STATUS.JOB_POSTING.ACTIVE:
          stats.active++;
          break;
        case STATUS.JOB_POSTING.CLOSED:
          stats.closed++;
          break;
        case STATUS.JOB_POSTING.CANCELLED:
          stats.cancelled++;
          break;
      }
    });

    logger.info('소유자별 공고 통계 조회 완료', { ownerId, stats });

    return stats;
  } catch (error) {
    logger.error('소유자별 공고 통계 조회 실패', toError(error), { ownerId });
    throw handleServiceError(error, {
      operation: '소유자별 공고 통계 조회',
      component: 'JobPostingRepository',
      context: { ownerId },
    });
  }
}

export async function bulkUpdateStatus(
  jobPostingIds: string[],
  status: JobPostingStatus,
  ownerId: string
): Promise<number> {
  try {
    logger.info('공고 상태 일괄 변경', {
      count: jobPostingIds.length,
      status,
      ownerId,
    });

    let successCount = 0;

    // Firestore 배치 작업 제한
    for (let i = 0; i < jobPostingIds.length; i += FIREBASE_LIMITS.BATCH_MAX_OPERATIONS) {
      const batch = jobPostingIds.slice(i, i + FIREBASE_LIMITS.BATCH_MAX_OPERATIONS);

      const batchCount = await runTransaction(getFirebaseDb(), async (transaction) => {
        let count = 0;
        for (const jobPostingId of batch) {
          const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
          const jobDoc = await transaction.get(jobRef);

          if (jobDoc.exists()) {
            const data = parseJobPostingDocument({
              id: jobDoc.id,
              ...jobDoc.data(),
            });
            if (data && data.ownerId === ownerId) {
              transaction.update(jobRef, {
                status,
                updatedAt: serverTimestamp(),
              });
              count++;
            }
          }
        }
        return count;
      });
      successCount += batchCount;
    }

    logger.info('공고 상태 일괄 변경 완료', { successCount });

    return successCount;
  } catch (error) {
    logger.error('공고 상태 일괄 변경 실패', toError(error), {
      status,
      ownerId,
    });
    throw handleServiceError(error, {
      operation: '공고 상태 일괄 변경',
      component: 'JobPostingRepository',
      context: { status, ownerId },
    });
  }
}
