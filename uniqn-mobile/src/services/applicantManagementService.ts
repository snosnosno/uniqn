/**
 * UNIQN Mobile - 지원자 관리 서비스 (구인자용)
 *
 * @description 지원자 목록 조회, 확정, 거절, 대기자 관리 서비스
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError, MaxCapacityReachedError } from '@/errors';
import type {
  Application,
  ApplicationStatus,
  ApplicationStats,
  ConfirmApplicationInput,
  RejectApplicationInput,
  JobPosting,
  StaffRole,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const APPLICATIONS_COLLECTION = 'applications';
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const WORK_LOGS_COLLECTION = 'workLogs';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantWithDetails extends Application {
  jobPosting?: JobPosting;
}

export interface ApplicantListResult {
  applicants: ApplicantWithDetails[];
  stats: ApplicationStats;
}

export interface ConfirmResult {
  applicationId: string;
  workLogId: string;
  message: string;
}

export interface BulkConfirmResult {
  successCount: number;
  failedCount: number;
  failedIds: string[];
  workLogIds: string[];
}

// ============================================================================
// Applicant Management Service
// ============================================================================

/**
 * 공고별 지원자 목록 조회 (구인자용)
 */
export async function getApplicantsByJobPosting(
  jobPostingId: string,
  ownerId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): Promise<ApplicantListResult> {
  try {
    logger.info('지원자 목록 조회', { jobPostingId, ownerId, statusFilter });

    // 공고 소유자 확인
    const jobRef = doc(db, JOB_POSTINGS_COLLECTION, jobPostingId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new Error('존재하지 않는 공고입니다');
    }

    const jobData = jobDoc.data() as JobPosting;
    if (jobData.ownerId !== ownerId) {
      throw new Error('본인의 공고만 조회할 수 있습니다');
    }

    // 지원자 목록 조회
    const applicationsRef = collection(db, APPLICATIONS_COLLECTION);
    let q = query(
      applicationsRef,
      where('jobPostingId', '==', jobPostingId),
      orderBy('createdAt', 'desc')
    );

    // 상태 필터 적용
    if (statusFilter) {
      const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
      if (statuses.length === 1) {
        q = query(
          applicationsRef,
          where('jobPostingId', '==', jobPostingId),
          where('status', '==', statuses[0]),
          orderBy('createdAt', 'desc')
        );
      }
      // 복수 상태 필터는 클라이언트에서 처리 (Firestore 제약)
    }

    const snapshot = await getDocs(q);
    const applicants: ApplicantWithDetails[] = [];
    const stats: ApplicationStats = {
      total: 0,
      applied: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      waitlisted: 0,
      completed: 0,
    };

    snapshot.docs.forEach((docSnapshot) => {
      const application = {
        ...docSnapshot.data(),
        id: docSnapshot.id,
        jobPosting: { ...jobData, id: jobDoc.id },
      } as ApplicantWithDetails;

      // 복수 상태 필터 적용
      if (statusFilter && Array.isArray(statusFilter) && statusFilter.length > 1) {
        if (!statusFilter.includes(application.status)) {
          return;
        }
      }

      applicants.push(application);

      // 통계 집계
      stats.total++;
      const statusKey = application.status as keyof typeof stats;
      if (statusKey in stats && statusKey !== 'total') {
        stats[statusKey]++;
      }
    });

    logger.info('지원자 목록 조회 완료', {
      jobPostingId,
      count: applicants.length,
      stats,
    });

    return { applicants, stats };
  } catch (error) {
    logger.error('지원자 목록 조회 실패', error as Error, { jobPostingId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 지원 확정 (트랜잭션)
 *
 * 비즈니스 로직:
 * 1. 공고 소유자 확인
 * 2. 정원 확인
 * 3. 지원 상태 변경 (confirmed)
 * 4. 공고 filledPositions 증가
 * 5. 근무 기록(WorkLog) 생성
 */
export async function confirmApplication(
  input: ConfirmApplicationInput,
  ownerId: string
): Promise<ConfirmResult> {
  try {
    logger.info('지원 확정 시작', { applicationId: input.applicationId, ownerId });

    const result = await runTransaction(db, async (transaction) => {
      // 1. 지원서 읽기
      const applicationRef = doc(db, APPLICATIONS_COLLECTION, input.applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new Error('존재하지 않는 지원입니다');
      }

      const applicationData = applicationDoc.data() as Application;

      // 이미 처리된 경우
      if (applicationData.status !== 'applied' && applicationData.status !== 'pending') {
        throw new Error(`이미 ${applicationData.status === 'confirmed' ? '확정' : '처리'}된 지원입니다`);
      }

      // 2. 공고 읽기
      const jobRef = doc(db, JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('존재하지 않는 공고입니다');
      }

      const jobData = jobDoc.data() as JobPosting;

      // 공고 소유자 확인
      if (jobData.ownerId !== ownerId) {
        throw new Error('본인의 공고만 관리할 수 있습니다');
      }

      // 3. 정원 확인
      const currentFilled = jobData.filledPositions ?? 0;
      const totalPositions = jobData.totalPositions ?? 0;

      if (totalPositions > 0 && currentFilled >= totalPositions) {
        throw new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다. 대기자로 등록하시겠습니까?',
          jobPostingId: applicationData.jobPostingId,
          maxCapacity: totalPositions,
          currentCount: currentFilled,
        });
      }

      // 역할별 정원 확인
      const appliedRole = applicationData.appliedRole;
      const roleReq = jobData.roles.find((r) => r.role === appliedRole);
      if (roleReq && roleReq.filled >= roleReq.count) {
        throw new MaxCapacityReachedError({
          userMessage: `${appliedRole} 역할의 모집 인원이 마감되었습니다`,
          jobPostingId: applicationData.jobPostingId,
          maxCapacity: roleReq.count,
          currentCount: roleReq.filled,
        });
      }

      // 4. 근무 기록(WorkLog) 생성
      const workLogsRef = collection(db, WORK_LOGS_COLLECTION);
      const workLogRef = doc(workLogsRef);
      const now = serverTimestamp();

      const workLogData = {
        staffId: applicationData.applicantId,
        staffName: applicationData.applicantName,
        eventId: applicationData.jobPostingId,
        eventName: jobData.title,
        role: applicationData.appliedRole,
        date: jobData.workDate,
        status: 'scheduled', // not_started → scheduled
        attendanceStatus: 'not_started',
        checkInTime: null,
        checkOutTime: null,
        workDuration: null,
        payrollAmount: null,
        isSettled: false,
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(workLogRef, workLogData);

      // 5. 지원 상태 변경
      transaction.update(applicationRef, {
        status: 'confirmed',
        processedBy: ownerId,
        processedAt: serverTimestamp(),
        notes: input.notes,
        updatedAt: serverTimestamp(),
      });

      // 6. 공고 filledPositions 증가 + 역할별 filled 증가
      const updatedRoles = jobData.roles.map((r) => {
        if (r.role === appliedRole) {
          return { ...r, filled: r.filled + 1 };
        }
        return r;
      });

      transaction.update(jobRef, {
        filledPositions: increment(1),
        roles: updatedRoles,
        updatedAt: serverTimestamp(),
      });

      return {
        applicationId: input.applicationId,
        workLogId: workLogRef.id,
        message: `${applicationData.applicantName}님의 지원이 확정되었습니다`,
      };
    });

    logger.info('지원 확정 완료', {
      applicationId: input.applicationId,
      workLogId: result.workLogId,
    });

    return result;
  } catch (error) {
    logger.error('지원 확정 실패', error as Error, { applicationId: input.applicationId });
    throw error instanceof Error || error instanceof MaxCapacityReachedError
      ? error
      : mapFirebaseError(error);
  }
}

/**
 * 지원 거절 (트랜잭션)
 */
export async function rejectApplication(
  input: RejectApplicationInput,
  ownerId: string
): Promise<void> {
  try {
    logger.info('지원 거절 시작', { applicationId: input.applicationId, ownerId });

    await runTransaction(db, async (transaction) => {
      // 지원서 읽기
      const applicationRef = doc(db, APPLICATIONS_COLLECTION, input.applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new Error('존재하지 않는 지원입니다');
      }

      const applicationData = applicationDoc.data() as Application;

      // 이미 처리된 경우
      if (applicationData.status === 'confirmed') {
        throw new Error('이미 확정된 지원은 거절할 수 없습니다');
      }

      if (applicationData.status === 'rejected') {
        throw new Error('이미 거절된 지원입니다');
      }

      // 공고 소유자 확인
      const jobRef = doc(db, JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('존재하지 않는 공고입니다');
      }

      const jobData = jobDoc.data() as JobPosting;
      if (jobData.ownerId !== ownerId) {
        throw new Error('본인의 공고만 관리할 수 있습니다');
      }

      // 지원 상태 변경
      transaction.update(applicationRef, {
        status: 'rejected',
        processedBy: ownerId,
        processedAt: serverTimestamp(),
        rejectionReason: input.reason,
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('지원 거절 완료', { applicationId: input.applicationId });
  } catch (error) {
    logger.error('지원 거절 실패', error as Error, { applicationId: input.applicationId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 일괄 확정 (구인자용)
 */
export async function bulkConfirmApplications(
  applicationIds: string[],
  ownerId: string
): Promise<BulkConfirmResult> {
  try {
    logger.info('일괄 확정 시작', { count: applicationIds.length, ownerId });

    const result: BulkConfirmResult = {
      successCount: 0,
      failedCount: 0,
      failedIds: [],
      workLogIds: [],
    };

    // 순차적으로 처리 (트랜잭션 충돌 방지)
    for (const applicationId of applicationIds) {
      try {
        const confirmResult = await confirmApplication({ applicationId }, ownerId);
        result.successCount++;
        result.workLogIds.push(confirmResult.workLogId);
      } catch (error) {
        result.failedCount++;
        result.failedIds.push(applicationId);
        logger.warn('일괄 확정 중 실패', { applicationId, error });
      }
    }

    logger.info('일괄 확정 완료', {
      successCount: result.successCount,
      failedCount: result.failedCount,
    });

    return result;
  } catch (error) {
    logger.error('일괄 확정 실패', error as Error);
    throw mapFirebaseError(error);
  }
}

/**
 * 대기자로 등록
 */
export async function addToWaitlist(
  applicationId: string,
  ownerId: string
): Promise<void> {
  try {
    logger.info('대기자 등록 시작', { applicationId, ownerId });

    await runTransaction(db, async (transaction) => {
      const applicationRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
      const applicationDoc = await transaction.get(applicationRef);

      if (!applicationDoc.exists()) {
        throw new Error('존재하지 않는 지원입니다');
      }

      const applicationData = applicationDoc.data() as Application;

      // 공고 소유자 확인
      const jobRef = doc(db, JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('존재하지 않는 공고입니다');
      }

      const jobData = jobDoc.data() as JobPosting;
      if (jobData.ownerId !== ownerId) {
        throw new Error('본인의 공고만 관리할 수 있습니다');
      }

      // 대기자 순번 계산
      const waitlistQuery = query(
        collection(db, APPLICATIONS_COLLECTION),
        where('jobPostingId', '==', applicationData.jobPostingId),
        where('status', '==', 'waitlisted'),
        orderBy('waitlistOrder', 'desc')
      );
      const waitlistSnapshot = await getDocs(waitlistQuery);
      const nextOrder = waitlistSnapshot.empty ? 1 : (waitlistSnapshot.docs[0].data().waitlistOrder ?? 0) + 1;

      // 대기자로 등록
      transaction.update(applicationRef, {
        status: 'waitlisted',
        waitlistOrder: nextOrder,
        processedBy: ownerId,
        processedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('대기자 등록 완료', { applicationId });
  } catch (error) {
    logger.error('대기자 등록 실패', error as Error, { applicationId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 대기자 확정 승격 (정원 확보 시)
 */
export async function promoteFromWaitlist(
  applicationId: string,
  ownerId: string
): Promise<ConfirmResult> {
  try {
    logger.info('대기자 승격 시작', { applicationId, ownerId });

    // 일반 확정과 동일 로직
    const result = await confirmApplication({ applicationId }, ownerId);

    // 승격 시간 기록
    const applicationRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
    await runTransaction(db, async (transaction) => {
      transaction.update(applicationRef, {
        waitlistPromotedAt: serverTimestamp(),
      });
    });

    logger.info('대기자 승격 완료', { applicationId });

    return result;
  } catch (error) {
    logger.error('대기자 승격 실패', error as Error, { applicationId });
    throw error;
  }
}

/**
 * 지원 읽음 처리 (구인자가 지원서를 확인)
 */
export async function markApplicationAsRead(
  applicationId: string,
  ownerId: string
): Promise<void> {
  try {
    const applicationRef = doc(db, APPLICATIONS_COLLECTION, applicationId);
    const applicationDoc = await getDoc(applicationRef);

    if (!applicationDoc.exists()) {
      throw new Error('존재하지 않는 지원입니다');
    }

    const applicationData = applicationDoc.data() as Application;

    // 공고 소유자 확인
    const jobRef = doc(db, JOB_POSTINGS_COLLECTION, applicationData.jobPostingId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists() || (jobDoc.data() as JobPosting).ownerId !== ownerId) {
      throw new Error('본인의 공고만 조회할 수 있습니다');
    }

    await runTransaction(db, async (transaction) => {
      transaction.update(applicationRef, {
        isRead: true,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    logger.error('지원 읽음 처리 실패', error as Error, { applicationId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 역할별 지원자 통계
 */
export async function getApplicantStatsByRole(
  jobPostingId: string,
  ownerId: string
): Promise<Record<StaffRole, ApplicationStats>> {
  try {
    logger.info('역할별 지원자 통계 조회', { jobPostingId, ownerId });

    const { applicants } = await getApplicantsByJobPosting(jobPostingId, ownerId);

    const statsByRole: Record<string, ApplicationStats> = {};

    applicants.forEach((app) => {
      const role = app.appliedRole;

      if (!statsByRole[role]) {
        statsByRole[role] = {
          total: 0,
          applied: 0,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          waitlisted: 0,
          completed: 0,
        };
      }

      statsByRole[role].total++;
      const statusKey = app.status as keyof ApplicationStats;
      if (statusKey in statsByRole[role] && statusKey !== 'total') {
        statsByRole[role][statusKey]++;
      }
    });

    logger.info('역할별 지원자 통계 조회 완료', { jobPostingId, statsByRole });

    return statsByRole as Record<StaffRole, ApplicationStats>;
  } catch (error) {
    logger.error('역할별 지원자 통계 조회 실패', error as Error, { jobPostingId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}
