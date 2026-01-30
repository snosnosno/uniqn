/**
 * UNIQN Mobile - 공고 관리 서비스 (구인자용)
 *
 * @description 공고 작성, 수정, 삭제, 상태 관리 서비스
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { migrateJobPostingForWrite } from './jobPostingMigration';
import { jobPostingRepository } from '@/repositories';
import type { CreateJobPostingResult, JobPostingStats } from '@/repositories';
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
// Types (Re-export from Repository)
// ============================================================================

export type { CreateJobPostingResult, JobPostingStats };

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
 * 단일 공고 생성 (내부 함수)
 *
 * @description Repository 패턴 사용
 * - 서비스: 역할 변환, 마이그레이션 적용
 * - Repository: Firebase 저장, 트랜잭션 처리
 */
async function createSinglePosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult> {
  // 역할 변환 (FormRoleWithCount → RoleRequirement) - salary 포함
  const convertedRoles = convertToRoleRequirements(
    input.roles as { role?: string; name?: string; count: number; filled?: number; isCustom?: boolean; salary?: SalaryInfo }[]
  );

  // input에서 roles 분리 (변환된 roles 사용)
  const { roles: _inputRoles, ...restInput } = input;

  // 하위 호환성: dateSpecificRequirements → tournamentDates 변환 (Phase 8)
  const migrationResult = migrateJobPostingForWrite(restInput);
  const migratedInput = migrationResult.data;

  // Repository 호출을 위한 입력 준비
  const preparedInput: CreateJobPostingInput = {
    ...migratedInput,
    roles: convertedRoles,
  };

  // Repository를 통해 공고 생성
  return jobPostingRepository.createWithTransaction(preparedInput, {
    ownerId,
    ownerName,
  });
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
    throw handleServiceError(error, {
      operation: '공고 생성',
      component: 'jobManagementService',
      context: { ownerId },
    });
  }
}

/**
 * 공고 수정 (구인자 전용)
 *
 * @description Repository 패턴 사용
 * - 서비스: 역할 변환, 마이그레이션 적용
 * - Repository: Firebase 트랜잭션, 권한 검증, 비즈니스 규칙 검증
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

    // 역할 변환 (FormRoleWithCount → RoleRequirement)
    let convertedRoles: RoleRequirement[] | undefined;
    if (input.roles) {
      convertedRoles = convertToRoleRequirements(
        input.roles as { role?: string; name?: string; count: number; filled?: number; isCustom?: boolean; salary?: SalaryInfo }[]
      );
    }

    // input에서 roles를 분리 (변환된 roles 사용)
    const { roles: _inputRoles, ...restInput } = input;

    // 하위 호환성: dateSpecificRequirements → tournamentDates 변환 (Phase 8)
    const migrationResult = migrateJobPostingForWrite(restInput);
    const migratedInput = migrationResult.data;

    // Repository 호출을 위한 입력 준비
    const preparedInput: UpdateJobPostingInput = {
      ...migratedInput,
      ...(convertedRoles ? { roles: convertedRoles } : {}),
    };

    // Repository를 통해 공고 수정
    const result = await jobPostingRepository.updateWithTransaction(
      jobPostingId,
      preparedInput,
      ownerId
    );

    logger.info('공고 수정 완료', { jobPostingId });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 수정',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}

/**
 * 공고 삭제 (Soft Delete)
 *
 * @description Repository 패턴 사용
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

    await jobPostingRepository.deleteWithTransaction(jobPostingId, ownerId);

    logger.info('공고 삭제 완료', { jobPostingId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 삭제',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}

/**
 * 공고 마감
 *
 * @description Repository 패턴 사용
 */
export async function closeJobPosting(
  jobPostingId: string,
  ownerId: string
): Promise<void> {
  try {
    logger.info('공고 마감 시작', { jobPostingId, ownerId });

    await jobPostingRepository.closeWithTransaction(jobPostingId, ownerId);

    logger.info('공고 마감 완료', { jobPostingId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 마감',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}

/**
 * 공고 재오픈
 *
 * @description Repository 패턴 사용
 */
export async function reopenJobPosting(
  jobPostingId: string,
  ownerId: string
): Promise<void> {
  try {
    logger.info('공고 재오픈 시작', { jobPostingId, ownerId });

    await jobPostingRepository.reopenWithTransaction(jobPostingId, ownerId);

    logger.info('공고 재오픈 완료', { jobPostingId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 재오픈',
      component: 'jobManagementService',
      context: { jobPostingId },
    });
  }
}

/**
 * 내 공고 통계 조회
 *
 * @description Repository 패턴 사용
 */
export async function getMyJobPostingStats(
  ownerId: string
): Promise<JobPostingStats> {
  try {
    logger.info('내 공고 통계 조회', { ownerId });

    const stats = await jobPostingRepository.getStatsByOwnerId(ownerId);

    logger.info('내 공고 통계 조회 완료', { ownerId, stats });

    return stats;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '내 공고 통계 조회',
      component: 'jobManagementService',
      context: { ownerId },
    });
  }
}

/**
 * 공고 상태 일괄 변경
 *
 * @description Repository 패턴 사용
 */
export async function bulkUpdateJobPostingStatus(
  jobPostingIds: string[],
  status: JobPostingStatus,
  ownerId: string
): Promise<number> {
  try {
    logger.info('공고 상태 일괄 변경 시작', { count: jobPostingIds.length, status, ownerId });

    const successCount = await jobPostingRepository.bulkUpdateStatus(
      jobPostingIds,
      status,
      ownerId
    );

    logger.info('공고 상태 일괄 변경 완료', { successCount });

    return successCount;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 상태 일괄 변경',
      component: 'jobManagementService',
      context: { status, ownerId },
    });
  }
}
