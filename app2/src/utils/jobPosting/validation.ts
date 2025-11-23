import { FixedJobPosting } from '../../types/jobPosting/jobPosting';
import { logger } from '../logger';

/**
 * FixedJobPosting 데이터 무결성 검증 함수
 *
 * @param posting - 검증할 고정공고 데이터
 * @returns 검증 성공 시 true, 실패 시 false
 *
 * 검증 항목:
 * 1. fixedConfig 필드 존재 여부
 * 2. fixedData 필드 존재 여부
 * 3. requiredRoles와 requiredRolesWithCount 동기화 상태
 * 4. daysPerWeek 유효 범위 (1-7)
 * 5. requiredRolesWithCount 비어있지 않은지
 * 6. viewCount 음수가 아닌지
 */
export function validateFixedJobPosting(posting: FixedJobPosting): boolean {
  const postingId = posting.id || 'unknown';

  // 1. fixedConfig 필드 존재 여부 확인
  if (!posting.fixedConfig) {
    logger.warn('FixedJobPosting 검증 실패: fixedConfig 필드 없음', {
      postingId,
      component: 'validateFixedJobPosting',
    });
    return false;
  }

  // 2. fixedData 필드 존재 여부 확인
  if (!posting.fixedData) {
    logger.warn('FixedJobPosting 검증 실패: fixedData 필드 없음', {
      postingId,
      component: 'validateFixedJobPosting',
    });
    return false;
  }

  // 3. requiredRoles와 requiredRolesWithCount 동기화 확인
  const { requiredRolesWithCount } = posting.fixedData;
  const { requiredRoles } = posting;

  if (!requiredRolesWithCount || !Array.isArray(requiredRolesWithCount)) {
    logger.warn('FixedJobPosting 검증 실패: requiredRolesWithCount 배열 없음', {
      postingId,
      component: 'validateFixedJobPosting',
    });
    return false;
  }

  if (!requiredRoles || !Array.isArray(requiredRoles)) {
    logger.warn('FixedJobPosting 검증 실패: requiredRoles 배열 없음', {
      postingId,
      component: 'validateFixedJobPosting',
    });
    return false;
  }

  // requiredRoles는 requiredRolesWithCount에서 name만 추출한 배열이어야 함
  const expectedRoles = requiredRolesWithCount.map((role) => role.name).sort();
  const actualRoles = [...requiredRoles].sort();

  if (JSON.stringify(expectedRoles) !== JSON.stringify(actualRoles)) {
    logger.warn('FixedJobPosting 검증 실패: requiredRoles와 requiredRolesWithCount 불일치', {
      component: 'validateFixedJobPosting',
      additionalData: {
        postingId,
        expectedRoles,
        actualRoles,
      },
    });
    return false;
  }

  // 4. daysPerWeek 유효 범위 확인 (1-7)
  const { workSchedule } = posting.fixedData;
  if (!workSchedule) {
    logger.warn('FixedJobPosting 검증 실패: workSchedule 필드 없음', {
      postingId,
      component: 'validateFixedJobPosting',
    });
    return false;
  }

  const { daysPerWeek } = workSchedule;
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    logger.warn('FixedJobPosting 검증 실패: daysPerWeek 범위 오류 (1-7)', {
      component: 'validateFixedJobPosting',
      additionalData: {
        postingId,
        daysPerWeek,
      },
    });
    return false;
  }

  // 5. requiredRolesWithCount 비어있지 않은지 확인
  if (requiredRolesWithCount.length === 0) {
    logger.warn('FixedJobPosting 검증 실패: requiredRolesWithCount 비어있음', {
      postingId,
      component: 'validateFixedJobPosting',
    });
    return false;
  }

  // 6. viewCount 음수가 아닌지 확인
  const { viewCount } = posting.fixedData;
  if (viewCount !== undefined && viewCount < 0) {
    logger.warn('FixedJobPosting 검증 실패: viewCount 음수', {
      component: 'validateFixedJobPosting',
      additionalData: {
        postingId,
        viewCount,
      },
    });
    return false;
  }

  // 모든 검증 통과
  logger.info('FixedJobPosting 검증 성공', {
    postingId,
    component: 'validateFixedJobPosting',
  });
  return true;
}
