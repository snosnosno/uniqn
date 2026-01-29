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
  serverTimestamp,
  Timestamp,
  runTransaction,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  mapFirebaseError,
  BusinessError,
  PermissionError,
  ERROR_CODES,
  toError,
} from '@/errors';
import { parseJobPostingDocument, parseJobPostingDocuments } from '@/schemas';
import { FIREBASE_LIMITS } from '@/constants';
import { migrateJobPostingForWrite } from './jobPostingMigration';
import type {
  JobPosting,
  JobPostingStatus,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  RoleRequirement,
  StaffRole,
  SalaryInfo,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_NAME = 'jobPostings';

// ============================================================================
// Types
// ============================================================================

export interface CreateJobPostingResult {
  id: string;
  jobPosting: JobPosting;
}

export interface JobPostingStats {
  total: number;
  active: number;
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
 * FormRoleWithCount의 name을 role key로 변환
 *
 * @description extractRoleKeysFromDateReq와 동일한 키 형식으로 변환
 * - 일반 역할: 한글명 → 영어 코드 (딜러 → dealer)
 * - 커스텀 역할: 이름 그대로 사용
 */
function getRoleKeyFromFormRole(
  role: { name?: string; isCustom?: boolean }
): string {
  const name = role.name || '';
  // 커스텀 역할이면 이름 그대로 반환
  if (role.isCustom) {
    return name;
  }
  // 일반 역할이면 영어 코드로 변환
  return ROLE_NAME_TO_CODE[name] || name;
}

/**
 * dateSpecificRequirements에서 역할 키 Set 추출
 *
 * @description 특정 날짜의 요구사항에서 역할 키를 추출
 * 커스텀 역할(other)인 경우 customRole 값을 키로 사용
 */
function extractRoleKeysFromDateReq(
  dateReqs: CreateJobPostingInput['dateSpecificRequirements']
): Set<string> {
  const roleKeys = new Set<string>();

  dateReqs?.forEach((dateReq) => {
    dateReq.timeSlots?.forEach((slot) => {
      slot.roles?.forEach((roleReq) => {
        const rawRole = roleReq.role ?? 'dealer';
        // 커스텀 역할이면 customRole을 키로 사용
        const roleKey = rawRole === 'other' && roleReq.customRole
          ? roleReq.customRole
          : rawRole;
        roleKeys.add(roleKey as string);
      });
    });
  });

  return roleKeys;
}

/**
 * 입력 roles를 RoleRequirement[] 형식으로 변환
 *
 * @description FormRoleWithCount 또는 RoleRequirement 형식을 통합 처리
 * 커스텀 역할은 원본 이름을 코드로 사용 (중복 방지)
 * salary 정보도 함께 포함
 */
function convertToRoleRequirements(
  roles: { role?: string; name?: string; count: number; filled?: number; isCustom?: boolean; salary?: SalaryInfo; customRole?: string }[]
): RoleRequirement[] {
  return roles.map((r) => {
    // 이미 RoleRequirement 형식인 경우 (role 필드가 있음)
    if ('role' in r && r.role) {
      // role이 'other'가 아니면서 customRole이 있으면 커스텀 역할로 변환
      if (r.role !== 'other' && r.customRole) {
        return {
          role: 'other' as StaffRole,
          customRole: r.customRole,
          count: r.count,
          filled: r.filled ?? 0,
          salary: r.salary,
        };
      }
      return {
        role: r.role as StaffRole,
        customRole: r.customRole,
        count: r.count,
        filled: r.filled ?? 0,
        salary: r.salary,
      };
    }

    // FormRoleWithCount 형식인 경우 (name 필드 사용)
    const name = r.name || '';

    // 커스텀 역할 여부 확인: isCustom 플래그 또는 매핑에 없는 경우
    const isCustomRole = r.isCustom || !ROLE_NAME_TO_CODE[name];

    if (isCustomRole) {
      // 커스텀 역할: role='other', customRole=이름
      return {
        role: 'other' as StaffRole,
        customRole: name,
        count: r.count,
        filled: r.filled ?? 0,
        salary: r.salary,
      };
    }

    // 일반 역할: 한글명 → 영어 코드 변환
    const roleCode = ROLE_NAME_TO_CODE[name];
    return {
      role: roleCode as StaffRole,
      count: r.count,
      filled: r.filled ?? 0,
      salary: r.salary,
    };
  });
}

// ============================================================================
// Job Management Service
// ============================================================================

/**
 * undefined 필드 제거 함수 (Firebase는 undefined 값을 허용하지 않음)
 * 재귀적으로 중첩 객체도 정리
 */
function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
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
}

/**
 * 단일 공고 생성 (내부 함수)
 */
async function createSinglePosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult> {
  const jobsRef = collection(getFirebaseDb(), COLLECTION_NAME);
  const newDocRef = doc(jobsRef);
  const now = serverTimestamp();

  // 역할 변환 (FormRoleWithCount → RoleRequirement) - salary 포함
  const convertedRoles = convertToRoleRequirements(
    input.roles as { role?: string; name?: string; count: number; filled?: number; isCustom?: boolean; salary?: SalaryInfo }[]
  );

  // 총 모집 인원 계산
  const totalPositions = convertedRoles.reduce((sum, role) => sum + role.count, 0);

  // input에서 roles, startTime 분리 (startTime은 string → Timestamp 변환 필요)
  const {
    roles: _inputRoles,
    startTime: inputStartTime,
    ...restInput
  } = input;

  // 하위 호환성: dateSpecificRequirements → tournamentDates 변환 (Phase 8)
  const migrationResult = migrateJobPostingForWrite(restInput);
  const migratedInput = migrationResult.data;

  // dateSpecificRequirements에서 날짜만 추출하여 workDates 배열 생성 (array-contains 쿼리용)
  const workDates = (restInput.dateSpecificRequirements ?? [])
    .map((req) => {
      if (typeof req.date === 'string') return req.date;
      if (req.date && 'toDate' in req.date) {
        return (req.date as Timestamp).toDate().toISOString().split('T')[0] ?? '';
      }
      if (req.date && 'seconds' in req.date) {
        return new Date((req.date as { seconds: number }).seconds * 1000)
          .toISOString().split('T')[0] ?? '';
      }
      return '';
    })
    .filter(Boolean);

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
    // 날짜 필터용 배열 (array-contains 쿼리용)
    workDates: workDates.length > 0 ? workDates : undefined,
    // 대회공고인 경우 승인 대기 상태로 초기화
    ...(restInput.postingType === 'tournament' && {
      tournamentConfig: {
        approvalStatus: 'pending' as const,
        submittedAt: now as Timestamp,
      },
    }),
    // 고정공고인 경우 fixedConfig 추가 (게시 기간 7일)
    // Note: createdAt은 Timestamp.now() 사용 (serverTimestamp()는 Security Rules의 is timestamp 검사 실패)
    ...(restInput.postingType === 'fixed' && {
      fixedConfig: {
        durationDays: 7 as const,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      },
    }),
    createdAt: now as Timestamp,
    updatedAt: now as Timestamp,
  });

  await setDoc(newDocRef, jobPostingData);

  const jobPosting: JobPosting = {
    id: newDocRef.id,
    ...jobPostingData,
  };

  return { id: newDocRef.id, jobPosting };
}

/**
 * 날짜별 개별 공고 생성 (regular/urgent 다중 날짜용)
 *
 * @description dateSpecificRequirements의 각 날짜에 대해 개별 공고를 생성
 * 급여 정보는 roles[].salary에 포함되어 있음
 */
async function createMultiplePostingsByDate(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult[]> {
  const results: CreateJobPostingResult[] = [];

  for (const dateReq of input.dateSpecificRequirements!) {
    // 날짜 문자열 추출
    let dateStr: string;
    if (typeof dateReq.date === 'string') {
      dateStr = dateReq.date;
    } else if (dateReq.date && 'toDate' in dateReq.date) {
      // Timestamp 타입
      dateStr = (dateReq.date as Timestamp).toDate().toISOString().split('T')[0] ?? '';
    } else if (dateReq.date && 'seconds' in dateReq.date) {
      // Firestore 직렬화된 타입
      dateStr = new Date((dateReq.date as { seconds: number }).seconds * 1000)
        .toISOString().split('T')[0] ?? '';
    } else {
      dateStr = '';
    }

    // 해당 날짜의 역할 키 추출
    const dateRoleKeys = extractRoleKeysFromDateReq([dateReq]);

    // 해당 날짜에 사용되는 역할만 필터링 (급여 정보 포함)
    const filteredRoles = input.roles.filter((role) => {
      const roleKey = getRoleKeyFromFormRole(role as { name?: string; isCustom?: boolean });
      return dateRoleKeys.has(roleKey);
    }) as typeof input.roles;

    // 단일 날짜용 input 생성 (해당 날짜의 역할만 포함)
    const singleDateInput: CreateJobPostingInput = {
      ...input,
      roles: filteredRoles,
      dateSpecificRequirements: [dateReq],
      workDate: dateStr,
    };

    const result = await createSinglePosting(singleDateInput, ownerId, ownerName);
    results.push(result);

    logger.info('날짜별 공고 생성', {
      id: result.id,
      date: dateStr,
      roles: Array.from(dateRoleKeys),
    });
  }

  return results;
}

/**
 * 공고 생성 (구인자 전용)
 *
 * @description
 * - regular/urgent 타입에서 여러 날짜 선택 시 날짜별로 개별 공고 생성
 * - tournament/fixed 타입은 기존처럼 단일 공고 생성
 *
 * @returns 단일 생성 시 CreateJobPostingResult, 다중 생성 시 CreateJobPostingResult[]
 */
export async function createJobPosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult | CreateJobPostingResult[]> {
  try {
    logger.info('공고 생성 시작', { ownerId, title: input.title });

    // regular/urgent 타입이고 다중 날짜인 경우 분리 생성
    const isMultiDateType = input.postingType === 'regular' || input.postingType === 'urgent';
    const hasMultipleDates = input.dateSpecificRequirements && input.dateSpecificRequirements.length > 1;

    if (isMultiDateType && hasMultipleDates) {
      const results = await createMultiplePostingsByDate(input, ownerId, ownerName);
      logger.info('다중 공고 생성 완료', {
        count: results.length,
        ids: results.map(r => r.id),
      });
      return results;
    }

    // 단일 공고 생성
    const result = await createSinglePosting(input, ownerId, ownerName);
    logger.info('공고 생성 완료', { id: result.id, title: input.title });
    return result;
  } catch (error) {
    logger.error('공고 생성 실패', toError(error), { ownerId });
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
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
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
      if (hasConfirmedApplicants) {
        if (input.workDate || input.timeSlot || input.roles) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '확정된 지원자가 있는 경우 일정 및 역할을 수정할 수 없습니다',
          });
        }
      }

      // 역할 변환 (FormRoleWithCount → RoleRequirement) - 일관된 형식 유지
      let convertedRoles: RoleRequirement[] | undefined;
      if (input.roles) {
        convertedRoles = convertToRoleRequirements(
          input.roles as { role?: string; name?: string; count: number; filled?: number; isCustom?: boolean; salary?: SalaryInfo }[]
        );
      }

      // 총 모집 인원 재계산 (역할이 변경된 경우)
      let totalPositions = currentData.totalPositions;
      if (convertedRoles) {
        totalPositions = convertedRoles.reduce((sum, role) => sum + role.count, 0);
      }

      // undefined 필드 제거 (Firebase는 undefined 값을 허용하지 않음)
      const removeUndefinedLocal = <T extends Record<string, unknown>>(obj: T): T => {
        return Object.fromEntries(
          Object.entries(obj).filter(([, v]) => v !== undefined)
        ) as T;
      };

      // input에서 roles를 분리 (변환된 roles 사용을 위해)
      const { roles: _inputRoles, ...restInput } = input;

      // 하위 호환성: dateSpecificRequirements → tournamentDates 변환 (Phase 8)
      const migrationResult = migrateJobPostingForWrite(restInput);
      const migratedInput = migrationResult.data;

      const updateData = removeUndefinedLocal({
        ...migratedInput,
        ...(convertedRoles ? { roles: convertedRoles } : {}),
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
    logger.error('공고 수정 실패', toError(error), { jobPostingId });
    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }
    throw mapFirebaseError(error);
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
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
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
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('공고 삭제 완료', { jobPostingId });
  } catch (error) {
    logger.error('공고 삭제 실패', toError(error), { jobPostingId });
    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }
    throw mapFirebaseError(error);
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
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
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
      if (currentData.status === 'closed') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 마감된 공고입니다',
        });
      }

      transaction.update(jobRef, {
        status: 'closed',
        updatedAt: serverTimestamp(),
      });
    });

    logger.info('공고 마감 완료', { jobPostingId });
  } catch (error) {
    logger.error('공고 마감 실패', toError(error), { jobPostingId });
    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }
    throw mapFirebaseError(error);
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
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        });
      }

      const currentData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
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
      if (currentData.status === 'active') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 활성 상태인 공고입니다',
        });
      }

      // 취소된 공고는 재오픈 불가
      if (currentData.status === 'cancelled') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '삭제된 공고는 재오픈할 수 없습니다. 새 공고를 작성해주세요',
        });
      }

      // 고정공고인 경우 expiresAt 갱신 (현재 + 7일)
      const updateData: Record<string, unknown> = {
        status: 'active',
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
    logger.error('공고 재오픈 실패', toError(error), { jobPostingId });
    if (error instanceof BusinessError || error instanceof PermissionError) {
      throw error;
    }
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
    const jobPostings = parseJobPostingDocuments(
      snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
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
        case 'active':
          stats.active++;
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
    logger.error('내 공고 통계 조회 실패', toError(error), { ownerId });
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

    // Firestore 배치 작업 제한
    for (let i = 0; i < jobPostingIds.length; i += FIREBASE_LIMITS.BATCH_MAX_OPERATIONS) {
      const batch = jobPostingIds.slice(i, i + FIREBASE_LIMITS.BATCH_MAX_OPERATIONS);

      await runTransaction(getFirebaseDb(), async (transaction) => {
        for (const jobPostingId of batch) {
          const jobRef = doc(getFirebaseDb(), COLLECTION_NAME, jobPostingId);
          const jobDoc = await transaction.get(jobRef);

          if (jobDoc.exists()) {
            const data = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
            if (data && data.ownerId === ownerId) {
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
    logger.error('공고 상태 일괄 변경 실패', toError(error));
    throw mapFirebaseError(error);
  }
}
