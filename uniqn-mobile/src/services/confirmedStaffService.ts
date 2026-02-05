/**
 * UNIQN Mobile - 확정 스태프 관리 서비스
 *
 * @description 구인자용 확정 스태프 조회/관리 서비스
 * @version 2.0.0 - Repository 패턴 적용
 *
 * 변경사항:
 * - Firebase 직접 호출 제거 → confirmedStaffRepository 사용
 * - 트랜잭션 로직 캡슐화
 * - 비즈니스 로직 (상태 매핑, 이름 조회, 그룹화) 유지
 *
 * 기능:
 * - 확정 스태프 목록 조회 (workLogs 기반)
 * - 역할 변경
 * - 근무 시간 수정 (시간 수정 이력 저장)
 * - 스태프 삭제/취소
 * - 노쇼 처리
 */

import type { Unsubscribe } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { confirmedStaffRepository, userRepository } from '@/repositories';
import {
  workLogToConfirmedStaff,
  groupStaffByDate,
  calculateStaffStats,
  type ConfirmedStaff,
  type ConfirmedStaffGroup,
  type ConfirmedStaffStats,
  type UpdateStaffRoleInput,
  type UpdateWorkTimeInput,
  type DeleteConfirmedStaffInput,
  type ConfirmedStaffStatus,
} from '@/types/confirmedStaff';
import { STAFF_ROLES } from '@/constants';
import { StatusMapper } from '@/shared/status';
import { TimeNormalizer } from '@/shared/time';
import type { WorkLog } from '@/types';

// 표준 역할 키 목록 (other 제외)
const STANDARD_ROLE_KEYS: string[] = STAFF_ROLES.filter((r) => r.key !== 'other').map((r) => r.key);

// ============================================================================
// Types
// ============================================================================

export interface GetConfirmedStaffResult {
  staff: ConfirmedStaff[];
  grouped: ConfirmedStaffGroup[];
  stats: ConfirmedStaffStats;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 사용자 이름 조회
 *
 * @description Repository 패턴 적용 - userRepository.getById 사용
 */
async function getStaffName(staffId: string): Promise<string> {
  try {
    const user = await userRepository.getById(staffId);
    if (user) {
      return user.nickname || user.name || `스태프 ${staffId.slice(-4)}`;
    }
    return `스태프 ${staffId.slice(-4)}`;
  } catch (error) {
    logger.warn('스태프 이름 조회 실패', { staffId, error });
    return `스태프 ${staffId.slice(-4)}`;
  }
}

/**
 * WorkLog 상태를 ConfirmedStaffStatus로 변환
 *
 * @description StatusMapper로 위임
 * @note no_show는 WorkLogStatus에 없으므로 별도 처리
 */
function mapWorkLogStatus(status: string): ConfirmedStaffStatus {
  // no_show는 WorkLogStatus에 없으므로 직접 처리
  if (status === 'no_show') {
    return 'no_show';
  }
  // confirmed는 레거시 상태, scheduled로 정규화
  if (status === 'confirmed') {
    return 'scheduled';
  }
  // 나머지는 StatusMapper로 위임
  return StatusMapper.toConfirmedStaff(status as import('@/shared/status').WorkLogStatus);
}

/**
 * WorkLog 배열을 ConfirmedStaff 배열로 변환
 *
 * @description 스태프 이름 조회 + 상태 정규화 포함
 */
async function workLogsToConfirmedStaff(workLogs: WorkLog[]): Promise<ConfirmedStaff[]> {
  // 스태프 이름 조회 (병렬)
  const staffIds = [...new Set(workLogs.map((wl) => wl.staffId))];
  const nameMap = new Map<string, string>();

  await Promise.all(
    staffIds.map(async (staffId) => {
      const name = await getStaffName(staffId);
      nameMap.set(staffId, name);
    })
  );

  // WorkLog를 ConfirmedStaff로 변환
  return workLogs.map((workLog) => {
    const confirmedStaff = workLogToConfirmedStaff(workLog, nameMap.get(workLog.staffId));
    // 상태 정규화
    confirmedStaff.status = mapWorkLogStatus(workLog.status);
    return confirmedStaff;
  });
}

// ============================================================================
// Confirmed Staff Service
// ============================================================================

/**
 * 공고별 확정 스태프 목록 조회
 *
 * @description workLogs 컬렉션에서 jobPostingId로 필터링하여 조회
 * @param jobPostingId 공고 ID
 * @returns 확정 스태프 목록, 날짜별 그룹, 통계
 */
export async function getConfirmedStaff(jobPostingId: string): Promise<GetConfirmedStaffResult> {
  logger.info('확정 스태프 목록 조회', { jobPostingId });

  // Repository에서 WorkLog 조회
  const workLogs = await confirmedStaffRepository.getByJobPostingId(jobPostingId);

  // WorkLog → ConfirmedStaff 변환 (비즈니스 로직)
  const staff = await workLogsToConfirmedStaff(workLogs);

  // 날짜별 그룹화
  const grouped = groupStaffByDate(staff);

  // 통계 계산
  const stats = calculateStaffStats(staff);

  logger.info('확정 스태프 목록 조회 완료', {
    jobPostingId,
    staffCount: staff.length,
    dateCount: grouped.length,
  });

  return { staff, grouped, stats };
}

/**
 * 날짜별 확정 스태프 조회
 */
export async function getConfirmedStaffByDate(
  jobPostingId: string,
  date: string
): Promise<ConfirmedStaff[]> {
  logger.info('날짜별 확정 스태프 조회', { jobPostingId, date });

  // Repository에서 WorkLog 조회
  const workLogs = await confirmedStaffRepository.getByJobPostingAndDate(jobPostingId, date);

  // WorkLog → ConfirmedStaff 변환
  const staff = await workLogsToConfirmedStaff(workLogs);

  return staff;
}

/**
 * 역할 변경
 *
 * @description 스태프의 역할 변경 및 이력 저장
 */
export async function updateStaffRole(input: UpdateStaffRoleInput): Promise<void> {
  logger.info('스태프 역할 변경', { ...input });

  // 표준 역할 여부 확인 (비즈니스 로직)
  const isStandardRole = STANDARD_ROLE_KEYS.includes(input.newRole);

  await confirmedStaffRepository.updateRoleWithTransaction({
    workLogId: input.workLogId,
    newRole: input.newRole,
    isStandardRole,
    reason: input.reason,
    changedBy: input.changedBy ?? 'system',
  });

  logger.info('스태프 역할 변경 완료', { workLogId: input.workLogId });
}

/**
 * 근무 시간 수정
 *
 * @description 출퇴근 시간 수정 및 이력 저장 (checkInTime/checkOutTime 사용)
 * @note null은 '미정' 상태를 의미
 */
export async function updateWorkTime(input: UpdateWorkTimeInput): Promise<void> {
  // TimeInput을 Date로 변환 (비즈니스 로직)
  const checkInDate = TimeNormalizer.parseTime(input.checkInTime);
  const checkOutDate = TimeNormalizer.parseTime(input.checkOutTime);

  logger.info('근무 시간 수정', {
    workLogId: input.workLogId,
    checkInTime: checkInDate?.toISOString() ?? '미정',
    checkOutTime: checkOutDate?.toISOString() ?? '미정',
  });

  await confirmedStaffRepository.updateWorkTimeWithTransaction({
    workLogId: input.workLogId,
    checkInTime: checkInDate,
    checkOutTime: checkOutDate,
    reason: input.reason,
    modifiedBy: input.modifiedBy ?? 'system',
  });

  logger.info('근무 시간 수정 완료', { workLogId: input.workLogId });
}

/**
 * 확정 스태프 삭제 (취소)
 *
 * @description 스태프 확정 취소 및 관련 데이터 정리
 * - WorkLog 삭제 또는 cancelled 상태로 변경
 * - Application 상태 복원
 * - JobPosting filledPositions 감소
 */
export async function deleteConfirmedStaff(input: DeleteConfirmedStaffInput): Promise<void> {
  logger.info('확정 스태프 삭제', { ...input });

  await confirmedStaffRepository.deleteWithTransaction({
    workLogId: input.workLogId,
    jobPostingId: input.jobPostingId,
    staffId: input.staffId,
    reason: input.reason,
  });

  logger.info('확정 스태프 삭제 완료', { ...input });
}

/**
 * 노쇼 처리
 *
 * @description 스태프 노쇼 상태로 변경
 */
export async function markAsNoShow(workLogId: string, reason?: string): Promise<void> {
  logger.info('노쇼 처리', { workLogId, reason });

  await confirmedStaffRepository.markAsNoShow({ workLogId, reason });

  logger.info('노쇼 처리 완료', { workLogId });
}

/**
 * 스태프 상태 변경
 *
 * @description 일반적인 상태 변경 (예: 근무 완료 처리)
 */
export async function updateStaffStatus(
  workLogId: string,
  status: ConfirmedStaffStatus
): Promise<void> {
  logger.info('스태프 상태 변경', { workLogId, status });

  await confirmedStaffRepository.updateStatus(workLogId, status);

  logger.info('스태프 상태 변경 완료', { workLogId, status });
}

// ============================================================================
// Real-time Subscriptions
// ============================================================================

/**
 * 확정 스태프 목록 실시간 구독
 *
 * @description 새 데이터는 jobPostingId로 조회, 기존 데이터는 마이그레이션 필요
 */
export function subscribeToConfirmedStaff(
  jobPostingId: string,
  callbacks: {
    onUpdate: (result: GetConfirmedStaffResult) => void;
    onError?: (error: Error) => void;
  }
): Unsubscribe {
  logger.info('확정 스태프 실시간 구독 시작', { jobPostingId });

  return confirmedStaffRepository.subscribeByJobPostingId(jobPostingId, {
    onUpdate: async (workLogs) => {
      try {
        // WorkLog → ConfirmedStaff 변환 (비즈니스 로직)
        const staff = await workLogsToConfirmedStaff(workLogs);
        const grouped = groupStaffByDate(staff);
        const stats = calculateStaffStats(staff);

        callbacks.onUpdate({ staff, grouped, stats });
      } catch (error) {
        logger.error('확정 스태프 구독 처리 에러', toError(error), { jobPostingId });
        callbacks.onError?.(toError(error));
      }
    },
    onError: callbacks.onError,
  });
}
