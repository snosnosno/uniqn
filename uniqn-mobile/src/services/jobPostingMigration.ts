/**
 * UNIQN Mobile - 공고 데이터 마이그레이션 서비스
 *
 * @description 레거시 형식과 신규 형식 간의 데이터 변환을 중앙에서 관리
 * @version 1.0.0
 *
 * 마이그레이션 방향:
 * - 읽기 시: tournamentDates → dateSpecificRequirements (필요한 경우)
 * - 쓰기 시: dateSpecificRequirements → tournamentDates (하위 호환성)
 *
 * @see specs/react-native-app/22-migration-mapping.md
 */

import { logger } from '@/utils/logger';
import {
  convertTournamentDatesToDateRequirements,
  convertDateRequirementsToTournamentDates,
  generateId,
} from '@/utils/job-posting/dateUtils';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

/**
 * 레거시 tournamentDates 타입
 */
export interface LegacyTournamentDate {
  day: number;
  date: string;
  startTime: string;
}

/**
 * 마이그레이션 결과
 */
export interface MigrationResult<T> {
  data: T;
  migrated: boolean;
  migrationType?: 'legacy-to-new' | 'new-to-legacy' | 'none';
  warnings?: string[];
}

// ============================================================================
// Migration Detection
// ============================================================================

/**
 * 마이그레이션 가능한 데이터 타입
 *
 * @description 레거시/신규 타입 모두 호환 (any 사용으로 유연성 확보)
 */
interface MigratableData {
  tournamentDates?: LegacyTournamentDate[];
  dateSpecificRequirements?: unknown[];
}

/**
 * 마이그레이션 필요 여부 확인 (읽기 시)
 *
 * @description tournamentDates는 있지만 dateSpecificRequirements가 없는 경우
 */
export function needsMigrationForRead(data: Partial<MigratableData>): boolean {
  const hasTournamentDates =
    data.tournamentDates &&
    Array.isArray(data.tournamentDates) &&
    data.tournamentDates.length > 0;

  const hasDateRequirements =
    data.dateSpecificRequirements &&
    Array.isArray(data.dateSpecificRequirements) &&
    data.dateSpecificRequirements.length > 0;

  return Boolean(hasTournamentDates) && !hasDateRequirements;
}

/**
 * 하위 호환성을 위한 tournamentDates 생성 필요 여부 (쓰기 시)
 *
 * @description dateSpecificRequirements가 있는 경우 tournamentDates도 함께 저장
 */
export function needsBackwardCompatibilityWrite(data: Partial<MigratableData>): boolean {
  const hasDateRequirements =
    data.dateSpecificRequirements &&
    Array.isArray(data.dateSpecificRequirements) &&
    data.dateSpecificRequirements.length > 0;

  return Boolean(hasDateRequirements);
}

// ============================================================================
// Read Migration (Firestore → App)
// ============================================================================

/**
 * 공고 데이터 읽기 시 마이그레이션
 *
 * @description Firestore에서 읽은 데이터를 앱에서 사용할 형식으로 변환
 * @param data - Firestore에서 읽은 공고 데이터
 * @returns 마이그레이션된 데이터와 결과 정보
 */
export function migrateJobPostingForRead<T extends Partial<MigratableData>>(
  data: T
): MigrationResult<T> {
  const warnings: string[] = [];

  if (!needsMigrationForRead(data)) {
    return {
      data,
      migrated: false,
      migrationType: 'none',
    };
  }

  try {
    const tournamentDates = data.tournamentDates as LegacyTournamentDate[];
    const dateSpecificRequirements = convertTournamentDatesToDateRequirements(tournamentDates);

    logger.info('공고 데이터 마이그레이션 완료 (읽기)', {
      id: 'id' in data ? data.id : 'unknown',
      tournamentDatesCount: tournamentDates.length,
      dateRequirementsCount: dateSpecificRequirements.length,
    });

    return {
      data: {
        ...data,
        dateSpecificRequirements: dateSpecificRequirements as T['dateSpecificRequirements'],
      },
      migrated: true,
      migrationType: 'legacy-to-new',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    warnings.push(`마이그레이션 실패: ${errorMessage}`);

    logger.warn('공고 데이터 마이그레이션 실패 (읽기)', {
      id: 'id' in data ? data.id : 'unknown',
      error: errorMessage,
    });

    return {
      data,
      migrated: false,
      migrationType: 'none',
      warnings,
    };
  }
}

/**
 * JobPostingFormData 읽기 시 마이그레이션
 *
 * @description 폼 편집 시 레거시 데이터를 신규 형식으로 변환
 */
export function migrateFormDataForRead(
  data: Partial<MigratableData>
): MigrationResult<Partial<MigratableData>> {
  const warnings: string[] = [];

  if (!needsMigrationForRead(data)) {
    return {
      data,
      migrated: false,
      migrationType: 'none',
    };
  }

  try {
    const tournamentDates = data.tournamentDates as LegacyTournamentDate[];
    const dateSpecificRequirements = convertTournamentDatesToDateRequirements(tournamentDates);

    logger.info('폼 데이터 마이그레이션 완료 (읽기)', {
      tournamentDatesCount: tournamentDates.length,
      dateRequirementsCount: dateSpecificRequirements.length,
    });

    return {
      data: {
        ...data,
        dateSpecificRequirements,
      },
      migrated: true,
      migrationType: 'legacy-to-new',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    warnings.push(`마이그레이션 실패: ${errorMessage}`);

    logger.warn('폼 데이터 마이그레이션 실패 (읽기)', { error: errorMessage });

    return {
      data,
      migrated: false,
      migrationType: 'none',
      warnings,
    };
  }
}

// ============================================================================
// Write Migration (App → Firestore)
// ============================================================================

/**
 * 공고 생성/수정 시 하위 호환성 데이터 추가
 *
 * @description dateSpecificRequirements를 tournamentDates로 변환하여 함께 저장
 * @param input - 저장할 공고 데이터
 * @returns tournamentDates가 추가된 데이터
 */
export function migrateJobPostingForWrite<T extends Partial<MigratableData>>(
  input: T
): MigrationResult<T & { tournamentDates?: LegacyTournamentDate[] }> {
  const warnings: string[] = [];

  if (!needsBackwardCompatibilityWrite(input)) {
    return {
      data: input,
      migrated: false,
      migrationType: 'none',
    };
  }

  try {
    const dateRequirements = input.dateSpecificRequirements as DateSpecificRequirement[];
    const tournamentDates = convertDateRequirementsToTournamentDates(
      dateRequirements as Parameters<typeof convertDateRequirementsToTournamentDates>[0]
    );

    logger.info('공고 데이터 하위 호환성 변환 완료 (쓰기)', {
      dateRequirementsCount: dateRequirements.length,
      tournamentDatesCount: tournamentDates.length,
    });

    return {
      data: {
        ...input,
        tournamentDates,
      },
      migrated: true,
      migrationType: 'new-to-legacy',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    warnings.push(`하위 호환성 변환 실패 (무시): ${errorMessage}`);

    logger.warn('공고 데이터 하위 호환성 변환 실패 (쓰기)', { error: errorMessage });

    // 변환 실패해도 원본 데이터는 저장 (tournamentDates 없이)
    return {
      data: input,
      migrated: false,
      migrationType: 'none',
      warnings,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 기본 DateSpecificRequirement 생성
 *
 * @description 새 날짜 추가 시 기본 구조 생성
 */
export function createDefaultDateRequirement(
  date: string,
  defaultStartTime = '09:00'
): DateSpecificRequirement {
  return {
    date,
    timeSlots: [
      {
        id: generateId(),
        startTime: defaultStartTime,
        isTimeToBeAnnounced: false,
        roles: [
          {
            id: generateId(),
            role: 'dealer',
            headcount: 1,
          },
        ],
      },
    ],
  };
}

/**
 * 역할 마이그레이션 (레거시 → 신규)
 *
 * @description 레거시 역할 키를 신규 역할 키로 변환
 */
export function migrateRoleKey(legacyRole: string): string {
  const ROLE_MIGRATION_MAP: Record<string, string> = {
    floorman: 'floor',
    supervisor: 'manager',
    chip_runner: 'staff',
  };

  return ROLE_MIGRATION_MAP[legacyRole] || legacyRole;
}

/**
 * 역할 목록 마이그레이션
 *
 * @description 레거시 역할 배열을 신규 형식으로 변환
 */
export function migrateRoles<T extends { role: string }>(roles: T[]): T[] {
  return roles.map((r) => ({
    ...r,
    role: migrateRoleKey(r.role),
  }));
}
