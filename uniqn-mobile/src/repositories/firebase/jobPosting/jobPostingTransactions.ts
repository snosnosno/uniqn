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
  type Transaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import { toError, BusinessError, PermissionError, ERROR_CODES, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseJobPostingDocument, parseJobPostingDocuments } from '@/schemas';
import { COLLECTIONS, FIELDS, FIREBASE_LIMITS, STATUS } from '@/constants';
import {
  createInitialPostingStats,
  mergeJobPostingInput,
  serializeJobPostingV3,
} from '@/domains/job-posting';
import { removeUndefined } from '@/utils/firestore/removeUndefined';
import type { StaffRole } from '@/types/role';
import type {
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
} from '../../interfaces';
import type {
  JobPosting,
  JobPostingStatus,
  CreateJobPostingInput,
  PostingRoleCatalogEntry,
  UpdateJobPostingInput,
} from '@/types';

function assertFixedPostingDisabled(input: {
  postingType?: CreateJobPostingInput['postingType'];
  schedule?: CreateJobPostingInput['schedule'];
}) {
  if (input.postingType === 'fixed' || input.schedule?.kind === 'fixed') {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: 'Fixed 공고는 현재 생성 및 수정할 수 없습니다.',
    });
  }
}

export async function incrementViewCount(jobPostingId: string): Promise<void> {
  try {
    const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);

    await updateDoc(docRef, {
      viewCount: increment(1),
    });

    logger.debug('Job posting view count incremented', { jobPostingId });
  } catch (error) {
    logger.warn('Job posting view count increment failed', {
      jobPostingId,
      error: toError(error),
    });
  }
}

export async function updateStatus(jobPostingId: string, status: JobPostingStatus): Promise<void> {
  try {
    logger.info('Job posting status update', { jobPostingId, status });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);

    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });

    logger.info('Job posting status updated', { jobPostingId, status });
  } catch (error) {
    logger.error('Job posting status update failed', toError(error), {
      jobPostingId,
      status,
    });
    throw handleServiceError(error, {
      operation: 'Job posting status update',
      component: 'JobPostingRepository',
      context: { jobPostingId, status },
    });
  }
}

async function loadJobPostingForTransaction(transaction: Transaction, jobPostingId: string) {
  const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
  const jobDoc = await transaction.get(jobRef);

  if (!jobDoc.exists()) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: 'Job posting does not exist.',
    });
  }

  const jobPosting = parseJobPostingDocument({
    id: jobDoc.id,
    ...jobDoc.data(),
  });

  if (!jobPosting) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: 'Job posting data is invalid.',
    });
  }

  return { jobRef, jobPosting };
}

function assertJobPostingOwner(jobPosting: JobPosting, ownerId: string, userMessage: string) {
  if (jobPosting.ownerId !== ownerId) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage,
    });
  }
}

function assertJobPostingStatus(
  currentStatus: JobPostingStatus,
  disallowedStatus: JobPostingStatus,
  userMessage: string
) {
  if (currentStatus === disallowedStatus) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage,
    });
  }
}

function assertCanonicalSerializedJobPosting(
  document: JobPosting,
  userMessage: string,
  context: Record<string, unknown>
): JobPosting {
  const parsed = parseJobPostingDocument(document);

  if (parsed) {
    return parsed;
  }

  logger.error('Canonical job posting validation failed before write', context);
  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage,
  });
}

type SettlementRolePayload = {
  role?: StaffRole | 'other';
  name?: string;
  customRole?: string;
  salary?: PostingRoleCatalogEntry['salary'];
  count?: number;
  headcount?: number;
  filled?: number;
};

function getSettlementRoleKey(role: { role?: string; name?: string; customRole?: string }): string {
  const roleId = role.role ?? role.name ?? '';
  return roleId === 'other' && role.customRole ? `other:${role.customRole}` : roleId;
}

function mergeSettlementRoles(
  baseRoles: PostingRoleCatalogEntry[],
  incomingRoles: Record<string, unknown>[]
): PostingRoleCatalogEntry[] {
  const typedBaseRoles = [...baseRoles];
  const typedIncomingRoles = incomingRoles as SettlementRolePayload[];

  if (typedBaseRoles.length === 0) {
    return typedIncomingRoles.map((role) => ({
      role: (role.role ?? role.name ?? 'dealer') as StaffRole | 'other',
      ...(role.customRole ? { customRole: role.customRole } : {}),
      ...(role.salary ? { salary: role.salary } : {}),
    }));
  }

  const incomingByKey = new Map(
    typedIncomingRoles.map((role) => [getSettlementRoleKey(role), role] as const)
  );

  return typedBaseRoles.map((role) => {
    const incomingRole = incomingByKey.get(getSettlementRoleKey(role));
    if (!incomingRole || !Object.prototype.hasOwnProperty.call(incomingRole, 'salary')) {
      return role;
    }

    return {
      ...role,
      ...(incomingRole.salary ? { salary: incomingRole.salary } : { salary: undefined }),
    };
  });
}

export async function createWithTransaction(
  input: CreateJobPostingInput,
  context: CreateJobPostingContext
): Promise<CreateJobPostingResult> {
  try {
    assertFixedPostingDisabled(input);

    const jobsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
    const newDocRef = doc(jobsRef);
    const now = Timestamp.now();
    const current: Partial<JobPosting> = {
      id: newDocRef.id,
      viewCount: 0,
      filledPositions: 0,
      stats: createInitialPostingStats(input.schedule),
      ...(input.postingType === 'tournament'
        ? {
            tournamentConfig: {
              approvalStatus: STATUS.TOURNAMENT.PENDING,
              submittedAt: now,
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
    const jobPosting = assertCanonicalSerializedJobPosting(
      serialized,
      'Created job posting does not satisfy the canonical contract.',
      {
        ownerId: context.ownerId,
        title: input.title,
      }
    );
    const { id: _id, ...jobPostingData } = removeUndefined(
      serialized as unknown as Record<string, unknown>
    );

    await setDoc(newDocRef, jobPostingData);

    return { id: newDocRef.id, jobPosting };
  } catch (error) {
    logger.error('Job posting create failed', toError(error), {
      ownerId: context.ownerId,
    });
    throw handleServiceError(error, {
      operation: 'Job posting create',
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
    logger.info('Job posting update transaction', { jobPostingId, ownerId });
    assertFixedPostingDisabled(input);

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const { jobRef, jobPosting: currentData } = await loadJobPostingForTransaction(
        transaction,
        jobPostingId
      );

      assertJobPostingOwner(currentData, ownerId, 'Only the owner can update this job posting.');

      const hasConfirmedApplicants = (currentData.filledPositions ?? 0) > 0;
      const hasScheduleMutation = input.schedule !== undefined || input.roleCatalog !== undefined;

      if (hasConfirmedApplicants && hasScheduleMutation) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Cannot change schedule or roles after applicants are confirmed.',
        });
      }

      const mergedInput = mergeJobPostingInput(currentData, input);
      const updatedAt = Timestamp.now();
      const serialized = serializeJobPostingV3(mergedInput, {
        ownerId: currentData.ownerId,
        ownerName: currentData.ownerName,
        status: input.status ?? currentData.status,
        current: currentData,
        createdAt: currentData.createdAt,
        updatedAt,
      });
      const validatedPosting = assertCanonicalSerializedJobPosting(
        serialized,
        'Updated job posting does not satisfy the canonical contract.',
        {
          jobPostingId,
          ownerId,
        }
      );
      const { id: _id, ...nextDocument } = removeUndefined(
        serialized as unknown as Record<string, unknown>
      );

      transaction.set(jobRef, nextDocument);

      return validatedPosting;
    });

    logger.info('Job posting updated', { jobPostingId });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('Job posting update failed', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: 'Job posting update',
      component: 'JobPostingRepository',
      context: { jobPostingId },
    });
  }
}

export async function deleteWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('Job posting delete transaction', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const { jobRef, jobPosting: currentData } = await loadJobPostingForTransaction(
        transaction,
        jobPostingId
      );

      assertJobPostingOwner(currentData, ownerId, 'Only the owner can delete this job posting.');

      const hasConfirmedApplicants = (currentData.filledPositions ?? 0) > 0;
      if (hasConfirmedApplicants) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Cannot delete a posting with confirmed applicants. Close it instead.',
        });
      }

      transaction.update(jobRef, {
        status: STATUS.JOB_POSTING.CANCELLED,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('Job posting deleted', { jobPostingId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('Job posting delete failed', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: 'Job posting delete',
      component: 'JobPostingRepository',
      context: { jobPostingId },
    });
  }
}

export async function closeWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('Job posting close transaction', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const { jobRef, jobPosting: currentData } = await loadJobPostingForTransaction(
        transaction,
        jobPostingId
      );

      assertJobPostingOwner(currentData, ownerId, 'Only the owner can close this job posting.');
      assertJobPostingStatus(
        currentData.status,
        STATUS.JOB_POSTING.CLOSED,
        'Job posting is already closed.'
      );

      transaction.update(jobRef, {
        status: STATUS.JOB_POSTING.CLOSED,
        closedAt: serverTimestamp(),
        closedReason: 'manual',
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('Job posting closed', { jobPostingId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('Job posting close failed', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: 'Job posting close',
      component: 'JobPostingRepository',
      context: { jobPostingId },
    });
  }
}

export async function reopenWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
  try {
    logger.info('Job posting reopen transaction', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const { jobRef, jobPosting: currentData } = await loadJobPostingForTransaction(
        transaction,
        jobPostingId
      );

      assertJobPostingOwner(currentData, ownerId, 'Only the owner can reopen this job posting.');
      assertJobPostingStatus(
        currentData.status,
        STATUS.JOB_POSTING.ACTIVE,
        'Job posting is already active.'
      );

      if (currentData.status === STATUS.JOB_POSTING.CANCELLED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Cancelled postings cannot be reopened. Create a new posting instead.',
        });
      }

      const updateData: Record<string, unknown> = {
        status: STATUS.JOB_POSTING.ACTIVE,
        updatedAt: serverTimestamp(),
      };

      transaction.update(jobRef, updateData);
    });

    logger.info('Job posting reopened', { jobPostingId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('Job posting reopen failed', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: 'Job posting reopen',
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
    logger.info('Settlement settings update', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const { jobRef, jobPosting: currentData } = await loadJobPostingForTransaction(
        transaction,
        jobPostingId
      );

      assertJobPostingOwner(currentData, ownerId, 'Only the owner can update this job posting.');

      const mergedInput: CreateJobPostingInput = mergeJobPostingInput(currentData, {
        roleCatalog: mergeSettlementRoles(currentData.roleCatalog, data.roles),
        compensation: {
          ...currentData.compensation,
          allowances: data.allowances as CreateJobPostingInput['compensation']['allowances'],
          taxSettings: data.taxSettings as CreateJobPostingInput['compensation']['taxSettings'],
        },
      });
      const updatedAt = Timestamp.now();
      const serialized = serializeJobPostingV3(mergedInput, {
        ownerId: currentData.ownerId,
        ownerName: currentData.ownerName,
        status: currentData.status,
        current: currentData,
        createdAt: currentData.createdAt,
        updatedAt,
      });
      assertCanonicalSerializedJobPosting(
        serialized,
        'Settlement settings update produced a non-canonical job posting.',
        {
          jobPostingId,
          ownerId,
        }
      );
      const { id: _id, ...nextDocument } = removeUndefined(
        serialized as unknown as Record<string, unknown>
      );

      transaction.set(jobRef, nextDocument);
    });

    logger.info('Settlement settings updated', { jobPostingId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error('Settlement settings update failed', toError(error), { jobPostingId });
    throw handleServiceError(error, {
      operation: 'Settlement settings update',
      component: 'JobPostingRepository',
      context: { jobPostingId, ownerId },
    });
  }
}

export async function getStatsByOwnerId(ownerId: string): Promise<JobPostingStats> {
  try {
    logger.info('Job posting owner stats query', { ownerId });

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

    jobPostings.filter(isCanonicalDatedPosting).forEach((data) => {
      stats.total++;
      stats.totalApplications += data.stats?.totalApplicants ?? 0;
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

    logger.info('Job posting owner stats queried', { ownerId, stats });

    return stats;
  } catch (error) {
    logger.error('Job posting owner stats query failed', toError(error), { ownerId });
    throw handleServiceError(error, {
      operation: 'Job posting owner stats query',
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
    logger.info('Bulk job posting status update', {
      count: jobPostingIds.length,
      status,
      ownerId,
    });

    let successCount = 0;

    for (let i = 0; i < jobPostingIds.length; i += FIREBASE_LIMITS.BATCH_MAX_OPERATIONS) {
      const batch = jobPostingIds.slice(i, i + FIREBASE_LIMITS.BATCH_MAX_OPERATIONS);

      const batchCount = await runTransaction(getFirebaseDb(), async (transaction) => {
        let count = 0;
        for (const targetJobPostingId of batch) {
          const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, targetJobPostingId);
          const jobDoc = await transaction.get(jobRef);

          if (!jobDoc.exists()) {
            continue;
          }

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
        return count;
      });

      successCount += batchCount;
    }

    logger.info('Bulk job posting status updated', { successCount });

    return successCount;
  } catch (error) {
    logger.error('Bulk job posting status update failed', toError(error), {
      status,
      ownerId,
    });
    throw handleServiceError(error, {
      operation: 'Bulk job posting status update',
      component: 'JobPostingRepository',
      context: { status, ownerId },
    });
  }
}
