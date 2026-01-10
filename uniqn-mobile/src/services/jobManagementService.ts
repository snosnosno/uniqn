/**
 * UNIQN Mobile - 공고 관리 서비스 (구인자용)
 *
 * @description 공고 작성, 수정, 삭제, 상태 관리 서비스
 * @version 1.0.0
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError } from '@/errors';
import { migrateJobPostingForWrite } from './jobPostingMigration';
import type {
  JobPosting,
  JobPostingStatus,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  SalaryInfo,
  RoleRequirement,
  StaffRole,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_NAME = 'jobPostings';
const DRAFTS_COLLECTION = 'jobPostingDrafts';

// ============================================================================
// Types
// ============================================================================

/**
 * 공고 작성 임시저장 데이터
 *
 * @description CreateJobPostingInput을 확장하여 6단계 폼에 필요한 추가 필드 포함
 */
export interface JobPostingDraft extends CreateJobPostingInput {
  id?: string;
  step: number;
  lastSavedAt: Timestamp;

  // 추가 필드 (6단계 폼용)
  postingType?: 'regular' | 'fixed' | 'tournament' | 'urgent';
  startTime?: string;
  tournamentDates?: { day: number; date: string; startTime: string }[];
  daysPerWeek?: number;
  workDays?: string[];
  /** @deprecated useSameSalary로 대체 */
  useRoleSalary?: boolean;
  /** 전체 동일 급여 사용 여부 */
  useSameSalary?: boolean;
  roleSalaries?: Record<string, SalaryInfo>;
  usesPreQuestions?: boolean;
  preQuestions?: {
    id: string;
    question: string;
    required: boolean;
    type: 'text' | 'textarea' | 'select';
    options?: string[];
  }[];
}

export interface CreateJobPostingResult {
  id: string;
  jobPosting: JobPosting;
}

export interface JobPostingStats {
  total: number;
  active: number;
  draft: number;
  closed: number;
  cancelled: number;
  totalApplications: number;
  totalViews: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 역할명 → StaffRole 코드 변환 맵
 *
 * @description 커스텀 역할은 원본 이름을 사용하므로 여기에 없어도 됨
 */
const ROLE_NAME_TO_CODE: Record<string, string> = {
  '딜러': 'dealer',
  '매니저': 'manager',
  '칩러너': 'chiprunner',
  '관리자': 'admin',
  '플로어': 'floor',
  '서빙': 'serving',
  '직원': 'staff',
};

/**
 * 입력 roles를 RoleRequirement[] 형식으로 변환
 *
 * @description FormRoleWithCount 또는 RoleRequirement 형식을 통합 처리
 * 커스텀 역할은 원본 이름을 코드로 사용 (중복 방지)
 */
function convertToRoleRequirements(
  roles: { role?: string; name?: string; count: number; filled?: number; isCustom?: boolean }[]
): RoleRequirement[] {
  return roles.map((r, index) => {
    // 이미 RoleRequirement 형식인 경우
    if ('role' in r && r.role) {
      return {
        role: r.role as StaffRole,
        count: r.count,
        filled: r.filled ?? 0,
      };
    }

    // FormRoleWithCount 형식인 경우
    const name = r.name || '';
    // 매핑에 있으면 사용, 없으면 원본 이름 또는 인덱스 기반 고유 키 사용
    const roleCode = ROLE_NAME_TO_CODE[name] || name || `custom_${index}`;

    return {
      role: roleCode as StaffRole,
      count: r.count,
      filled: r.filled ?? 0,
    };
  });
}

// ============================================================================
// Job Management Service
// ============================================================================

/**
 * 공고 생성 (구인자 전용)
 */
export async function createJobPosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult> {
  try {
    logger.info('공고 생성 시작', { ownerId, title: input.title });

    const jobsRef = collection(getFirebaseDb(), COLLECTION_NAME);
    const newDocRef = doc(jobsRef);
    const now = serverTimestamp();

    // 역할 변환 (FormRoleWithCount → RoleRequirement)
    const convertedRoles = convertToRoleRequirements(
      input.roles as { role?: string; name?: string; count: number; filled?: number; isCustom?: boolean }[]
    );

    // 총 모집 인원 계산
    const totalPositions = convertedRoles.reduce((sum, role) => sum + role.count, 0);

    // input에서 roles, startTime 분리 (startTime은 string → Timestamp 변환 필요)
    const {
      roles: _inputRoles,
      startTime: inputStartTime,
      ...restInput
    } = input;

    // undefined 필드 제거 함수 (Firebase는 undefined 값을 허용하지 않음)
    // 재귀적으로 중첩 객체도 정리
    const removeUndefined = <T extends Record<string, unknown>>(obj: T): T => {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => {
            // 객체 타입인 경우 재귀적으로 정리
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              return [k, removeUndefined(v as Record<string, unknown>)];
            }
            return [k, v];
          })
      ) as T;
    };

    // 하위 호환성: dateSpecificRequirements → tournamentDates 변환 (Phase 8)
    const migrationResult = migrateJobPostingForWrite(restInput);
    const migratedInput = migrationResult.data;

    const jobPostingData: Omit<JobPosting, 'id'> = removeUndefined({
      ...migratedInput,
      roles: convertedRoles,
      status: 'active',
      ownerId,
      ownerName,
      // Security Rules 필수 필드: createdBy (ownerId와 동일)
      createdBy: ownerId,
      // Security Rules 필수 필드: description (빈 문자열 허용)
      description: restInput.description || '',
      // Security Rules: postingType 기본값
      postingType: restInput.postingType || 'regular',
      totalPositions,
      filledPositions: 0,
      viewCount: 0,
      applicationCount: 0,
      // 필수 필드 기본값
      workDate: restInput.workDate || '',
      timeSlot: restInput.timeSlot || (inputStartTime ? `${inputStartTime}~` : ''),
      createdAt: now as Timestamp,
      updatedAt: now as Timestamp,
    });

    await setDoc(newDocRef, jobPostingData);

    const jobPosting: JobPosting = {
      id: newDocRef.id,
      ...jobPostingData,
    };

    logger.info('공고 생성 완료', { id: newDocRef.id, title: input.title });

    return { id: newDocRef.id, jobPosting };
  } catch (error) {
    logger.error('공고 생성 실패', error as Error, { ownerId });
    throw mapFirebaseError(error);
  }
}

/**
 * 공고 수정 (구인자 전용)
 *
 * 비즈니스 규칙:
 * - 본인 공고만 수정 가능
 * - 확정된 지원자가 있으면 일부 필드 수정 불가
 */
export async function updateJobPosting(
  jobPostingId: string,
  input: UpdateJobPostingInput,
  ownerId: string
): Promise<JobPosting> {
  try {
    logger.info('공고 수정 시작', { jobPostingId, ownerId });

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('존재하지 않는 공고입니다');
      }

      const currentData = jobDoc.data() as JobPosting;

      // 본인 확인
      if (currentData.ownerId !== ownerId) {
        throw new Error('본인의 공고만 수정할 수 있습니다');
      }

      // 확정된 지원자가 있는 경우 일정/역할 수정 불가
      const hasConfirmedApplicants = (currentData.filledPositions ?? 0) > 0;
      if (hasConfirmedApplicants) {
        if (input.workDate || input.timeSlot || input.roles) {
          throw new Error('확정된 지원자가 있는 경우 일정 및 역할을 수정할 수 없습니다');
        }
      }

      // 총 모집 인원 재계산 (역할이 변경된 경우)
      let totalPositions = currentData.totalPositions;
      if (input.roles) {
        totalPositions = input.roles.reduce((sum, role) => sum + role.count, 0);
      }

      // undefined 필드 제거 (Firebase는 undefined 값을 허용하지 않음)
      const removeUndefined = <T extends Record<string, unknown>>(obj: T): T => {
        return Object.fromEntries(
          Object.entries(obj).filter(([, v]) => v !== undefined)
        ) as T;
      };

      // 하위 호환성: dateSpecificRequirements → tournamentDates 변환 (Phase 8)
      const migrationResult = migrateJobPostingForWrite(input);
      const migratedInput = migrationResult.data;

      const updateData = removeUndefined({
        ...migratedInput,
        totalPositions,
        updatedAt: serverTimestamp(),
      });

      transaction.update(jobRef, updateData);

      return {
        ...currentData,
        ...updateData,
        id: jobPostingId,
      } as JobPosting;
    });

    logger.info('공고 수정 완료', { jobPostingId });

    return result;
  } catch (error) {
    logger.error('공고 수정 실패', error as Error, { jobPostingId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 공고 삭제 (Soft Delete)
 *
 * 비즈니스 규칙:
 * - 본인 공고만 삭제 가능
 * - 확정된 지원자가 있으면 삭제 불가 (마감으로 변경 권장)
 */
export async function deleteJobPosting(
  jobPostingId: string,
  ownerId: string
): Promise<void> {
  try {
    logger.info('공고 삭제 시작', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('존재하지 않는 공고입니다');
      }

      const currentData = jobDoc.data() as JobPosting;

      // 본인 확인
      if (currentData.ownerId !== ownerId) {
        throw new Error('본인의 공고만 삭제할 수 있습니다');
      }

      // 확정된 지원자가 있는 경우 삭제 불가
      const hasConfirmedApplicants = (currentData.filledPositions ?? 0) > 0;
      if (hasConfirmedApplicants) {
        throw new Error('확정된 지원자가 있는 공고는 삭제할 수 없습니다. 마감 처리를 해주세요.');
      }

      // Soft Delete: status를 cancelled로 변경
      transaction.update(jobRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('공고 삭제 완료', { jobPostingId });
  } catch (error) {
    logger.error('공고 삭제 실패', error as Error, { jobPostingId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 공고 마감
 */
export async function closeJobPosting(
  jobPostingId: string,
  ownerId: string
): Promise<void> {
  try {
    logger.info('공고 마감 시작', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('존재하지 않는 공고입니다');
      }

      const currentData = jobDoc.data() as JobPosting;

      // 본인 확인
      if (currentData.ownerId !== ownerId) {
        throw new Error('본인의 공고만 마감할 수 있습니다');
      }

      // 이미 마감된 경우
      if (currentData.status === 'closed') {
        throw new Error('이미 마감된 공고입니다');
      }

      transaction.update(jobRef, {
        status: 'closed',
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('공고 마감 완료', { jobPostingId });
  } catch (error) {
    logger.error('공고 마감 실패', error as Error, { jobPostingId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 공고 재오픈
 */
export async function reopenJobPosting(
  jobPostingId: string,
  ownerId: string
): Promise<void> {
  try {
    logger.info('공고 재오픈 시작', { jobPostingId, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const jobRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('존재하지 않는 공고입니다');
      }

      const currentData = jobDoc.data() as JobPosting;

      // 본인 확인
      if (currentData.ownerId !== ownerId) {
        throw new Error('본인의 공고만 재오픈할 수 있습니다');
      }

      // 활성 상태인 경우
      if (currentData.status === 'active') {
        throw new Error('이미 활성 상태인 공고입니다');
      }

      // 취소된 공고는 재오픈 불가
      if (currentData.status === 'cancelled') {
        throw new Error('삭제된 공고는 재오픈할 수 없습니다. 새 공고를 작성해주세요.');
      }

      transaction.update(jobRef, {
        status: 'active',
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('공고 재오픈 완료', { jobPostingId });
  } catch (error) {
    logger.error('공고 재오픈 실패', error as Error, { jobPostingId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 임시저장 (드래프트)
 */
export async function saveDraft(
  draft: Partial<CreateJobPostingInput>,
  step: number,
  ownerId: string,
  draftId?: string
): Promise<string> {
  try {
    logger.info('임시저장 시작', { ownerId, step, draftId });

    const draftsRef = collection(getFirebaseDb(), DRAFTS_COLLECTION);
    const docRef = draftId ? doc(draftsRef, draftId) : doc(draftsRef);

    const draftData: JobPostingDraft = {
      ...(draft as CreateJobPostingInput),
      id: docRef.id,
      step,
      lastSavedAt: serverTimestamp() as Timestamp,
    };

    await setDoc(docRef, {
      ...draftData,
      ownerId,
    });

    logger.info('임시저장 완료', { draftId: docRef.id });

    return docRef.id;
  } catch (error) {
    logger.error('임시저장 실패', error as Error, { ownerId });
    throw mapFirebaseError(error);
  }
}

/**
 * 임시저장 불러오기
 */
export async function getDraft(
  ownerId: string
): Promise<JobPostingDraft | null> {
  try {
    logger.info('임시저장 불러오기', { ownerId });

    const draftsRef = collection(getFirebaseDb(), DRAFTS_COLLECTION);
    const q = query(
      draftsRef,
      where('ownerId', '==', ownerId),
      orderBy('lastSavedAt', 'desc')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const draftDoc = snapshot.docs[0];
    return {
      id: draftDoc.id,
      ...draftDoc.data(),
    } as JobPostingDraft;
  } catch (error) {
    // 권한 에러는 임시저장이 없는 것으로 처리 (사용자 경험 개선)
    const firebaseError = error as { code?: string };
    if (firebaseError.code === 'permission-denied') {
      logger.info('임시저장 조회 권한 없음 (새 사용자이거나 역할 미설정)', { ownerId });
      return null;
    }
    logger.error('임시저장 불러오기 실패', error as Error, { ownerId });
    throw mapFirebaseError(error);
  }
}

/**
 * 임시저장 삭제
 */
export async function deleteDraft(draftId: string): Promise<void> {
  try {
    logger.info('임시저장 삭제', { draftId });

    const docRef = doc(getFirebaseDb(), DRAFTS_COLLECTION, draftId);
    await deleteDoc(docRef);

    logger.info('임시저장 삭제 완료', { draftId });
  } catch (error) {
    logger.error('임시저장 삭제 실패', error as Error, { draftId });
    throw mapFirebaseError(error);
  }
}

/**
 * 내 공고 통계 조회
 */
export async function getMyJobPostingStats(
  ownerId: string
): Promise<JobPostingStats> {
  try {
    logger.info('내 공고 통계 조회', { ownerId });

    const jobsRef = collection(getFirebaseDb(), COLLECTION_NAME);
    const q = query(jobsRef, where('ownerId', '==', ownerId));

    const snapshot = await getDocs(q);

    const stats: JobPostingStats = {
      total: 0,
      active: 0,
      draft: 0,
      closed: 0,
      cancelled: 0,
      totalApplications: 0,
      totalViews: 0,
    };

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() as JobPosting;
      stats.total++;
      stats.totalApplications += data.applicationCount ?? 0;
      stats.totalViews += data.viewCount ?? 0;

      switch (data.status) {
        case 'active':
          stats.active++;
          break;
        case 'draft':
          stats.draft++;
          break;
        case 'closed':
          stats.closed++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
      }
    });

    logger.info('내 공고 통계 조회 완료', { ownerId, stats });

    return stats;
  } catch (error) {
    logger.error('내 공고 통계 조회 실패', error as Error, { ownerId });
    throw mapFirebaseError(error);
  }
}

/**
 * 공고 상태 일괄 변경
 */
export async function bulkUpdateJobPostingStatus(
  jobPostingIds: string[],
  status: JobPostingStatus,
  ownerId: string
): Promise<number> {
  try {
    logger.info('공고 상태 일괄 변경 시작', { count: jobPostingIds.length, status, ownerId });

    let successCount = 0;

    // Firestore 배치 작업은 최대 500개까지
    const batchSize = 500;
    for (let i = 0; i < jobPostingIds.length; i += batchSize) {
      const batch = jobPostingIds.slice(i, i + batchSize);

      await runTransaction(getFirebaseDb(), async (transaction) => {
        for (const jobPostingId of batch) {
          const jobRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);
          const jobDoc = await transaction.get(jobRef);

          if (jobDoc.exists()) {
            const data = jobDoc.data() as JobPosting;
            if (data.ownerId === ownerId) {
              transaction.update(jobRef, {
                status,
                updatedAt: serverTimestamp(),
              });
              successCount++;
            }
          }
        }
      });
    }

    logger.info('공고 상태 일괄 변경 완료', { successCount });

    return successCount;
  } catch (error) {
    logger.error('공고 상태 일괄 변경 실패', error as Error);
    throw mapFirebaseError(error);
  }
}
