import type { UnsubscribeFn } from '@/types/common';
import { logger } from '@/utils/logger';
import { toError, BusinessError, ERROR_CODES } from '@/errors';
import { confirmedStaffRepository, userRepository, workLogRepository } from '@/repositories';
import { requireCurrentUser } from '@/services/auth/authCoreService';
import { cancelConfirmation } from '@/services/jobs/applicationHistoryService';
import { enqueueScheduleBoardSync } from '@/services/jobs/jobManagementService';
import { workLogToConfirmedStaff, groupStaffByDate, calculateStaffStats } from '@/domains/staff';
import type {
  ConfirmedStaff,
  ConfirmedStaffGroup,
  ConfirmedStaffStats,
  UpdateStaffRoleInput,
  UpdateWorkTimeInput,
  DeleteConfirmedStaffInput,
  AddDirectStaffInput,
} from '@/types/confirmedStaff';
import type { UserPhoneSearchResult } from '@/repositories';
import { STAFF_ROLES, STATUS } from '@/constants';
import { StatusMapper, type WorkLogStatus } from '@/shared/status';
import { TimeNormalizer } from '@/shared/time';
import type { WorkLog } from '@/types';

const STANDARD_ROLE_KEYS: string[] = STAFF_ROLES.filter((role) => role.key !== 'other').map(
  (role) => role.key
);

export interface GetConfirmedStaffResult {
  staff: ConfirmedStaff[];
  grouped: ConfirmedStaffGroup[];
  stats: ConfirmedStaffStats;
}

async function getStaffName(staffId: string): Promise<string> {
  try {
    const user = await userRepository.getById(staffId);
    if (user) {
      return user.nickname || user.name || `스태프 ${staffId.slice(-4)}`;
    }

    return `스태프 ${staffId.slice(-4)}`;
  } catch (error) {
    logger.warn('Failed to resolve confirmed staff name', { staffId, error: toError(error) });
    return `스태프 ${staffId.slice(-4)}`;
  }
}

function isNoShowWorkLog(workLog: WorkLog): boolean {
  return workLog.status === STATUS.WORK_LOG.NO_SHOW || Boolean(workLog.noShowAt);
}

function isVisibleConfirmedStaffWorkLog(workLog: WorkLog): boolean {
  return workLog.status !== STATUS.WORK_LOG.CANCELLED || isNoShowWorkLog(workLog);
}

function mapWorkLogStatus(workLog: WorkLog): ConfirmedStaff['status'] {
  if (isNoShowWorkLog(workLog)) {
    return STATUS.CONFIRMED_STAFF.NO_SHOW;
  }

  return StatusMapper.toConfirmedStaff(workLog.status);
}

async function workLogsToConfirmedStaff(workLogs: WorkLog[]): Promise<ConfirmedStaff[]> {
  const visibleWorkLogs = workLogs.filter(isVisibleConfirmedStaffWorkLog);
  const staffIds = [...new Set(visibleWorkLogs.map((workLog) => workLog.staffId))];
  const nameMap = new Map<string, string>();

  await Promise.all(
    staffIds.map(async (staffId) => {
      nameMap.set(staffId, await getStaffName(staffId));
    })
  );

  return visibleWorkLogs.map((workLog) => {
    const confirmedStaff = workLogToConfirmedStaff(workLog, nameMap.get(workLog.staffId));
    confirmedStaff.status = mapWorkLogStatus(workLog);
    confirmedStaff.isNoShow = isNoShowWorkLog(workLog);
    confirmedStaff.noShowReason = workLog.noShowReason;
    confirmedStaff.noShowAt = workLog.noShowAt;
    return confirmedStaff;
  });
}

function buildApplicationId(jobPostingId: string, staffId: string): string {
  return `${jobPostingId}_${staffId}`;
}

export async function getConfirmedStaff(jobPostingId: string): Promise<GetConfirmedStaffResult> {
  logger.info('Fetching confirmed staff list', { jobPostingId });

  const workLogs = await confirmedStaffRepository.getByJobPostingId(jobPostingId);
  const staff = await workLogsToConfirmedStaff(workLogs);
  const grouped = groupStaffByDate(staff);
  const stats = calculateStaffStats(staff);

  logger.info('Fetched confirmed staff list', {
    jobPostingId,
    staffCount: staff.length,
    dateCount: grouped.length,
  });

  return { staff, grouped, stats };
}

export async function getConfirmedStaffByDate(
  jobPostingId: string,
  date: string
): Promise<ConfirmedStaff[]> {
  logger.info('Fetching confirmed staff by date', { jobPostingId, date });

  const workLogs = await confirmedStaffRepository.getByJobPostingAndDate(jobPostingId, date);
  return workLogsToConfirmedStaff(workLogs);
}

export async function updateStaffRole(input: UpdateStaffRoleInput): Promise<void> {
  logger.info('Updating confirmed staff role', { ...input });

  const actorId = (await requireCurrentUser()).id;

  await confirmedStaffRepository.updateRoleWithTransaction({
    workLogId: input.workLogId,
    newRole: input.newRole,
    isStandardRole: STANDARD_ROLE_KEYS.includes(input.newRole),
    reason: input.reason,
    changedBy: input.changedBy ?? 'system',
    actorId,
  });

  logger.info('Updated confirmed staff role', { workLogId: input.workLogId });
}

export async function updateWorkTime(input: UpdateWorkTimeInput): Promise<void> {
  const checkInDate = TimeNormalizer.parseTime(input.checkInTime);
  const checkOutDate = TimeNormalizer.parseTime(input.checkOutTime);
  const actorId = (await requireCurrentUser()).id;
  const modifiedBy = input.modifiedBy ?? actorId;

  logger.info('Updating confirmed staff work time', {
    workLogId: input.workLogId,
    checkInTime: checkInDate?.toISOString() ?? 'unset',
    checkOutTime: checkOutDate?.toISOString() ?? 'unset',
  });

  await confirmedStaffRepository.updateWorkTimeWithTransaction({
    workLogId: input.workLogId,
    checkInTime: checkInDate,
    checkOutTime: checkOutDate,
    reason: input.reason,
    modifiedBy,
    actorId,
  });

  logger.info('Updated confirmed staff work time', { workLogId: input.workLogId });
}

export async function cancelConfirmedStaffConfirmation(
  input: DeleteConfirmedStaffInput
): Promise<void> {
  const currentUser = await requireCurrentUser();
  logger.info('Cancelling confirmed staff confirmation', { ...input });

  const workLog = await workLogRepository.getById(input.workLogId);
  if (!workLog) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
      userMessage: '근무 기록을 찾을 수 없습니다.',
    });
  }

  if (workLog.jobPostingId !== input.jobPostingId || workLog.staffId !== input.staffId) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '확정 취소 대상 정보가 일치하지 않습니다.',
    });
  }

  // 직접추가분(지원서 미연동)은 확정취소 RPC 가 아니라 전용 삭제 경로를 탄다.
  if (!workLog.applicationId) {
    await confirmedStaffRepository.removeDirectStaff({ workLogId: input.workLogId });
    logger.info('직접 추가 스태프 삭제 완료', { workLogId: input.workLogId });
    return;
  }

  await cancelConfirmation(
    buildApplicationId(workLog.jobPostingId, workLog.staffId),
    currentUser.id,
    input.reason
  );

  logger.info('Cancelled confirmed staff confirmation', {
    workLogId: input.workLogId,
    applicationId: buildApplicationId(workLog.jobPostingId, workLog.staffId),
  });
}

// Backward-compatible internal alias for direct imports in legacy tests/modules.
export async function deleteConfirmedStaff(input: DeleteConfirmedStaffInput): Promise<void> {
  await cancelConfirmedStaffConfirmation(input);
}

export async function markAsNoShow(workLogId: string, reason?: string): Promise<void> {
  const currentUser = await requireCurrentUser();
  logger.info('Marking confirmed staff as no-show', { workLogId, reason });

  await confirmedStaffRepository.markAsNoShow({ workLogId, ownerId: currentUser.id, reason });

  logger.info('Marked confirmed staff as no-show', { workLogId });
}

export async function updateStaffStatus(workLogId: string, status: WorkLogStatus): Promise<void> {
  const currentUser = await requireCurrentUser();
  logger.info('Updating confirmed staff status', { workLogId, status });

  const workLog = await workLogRepository.getById(workLogId);
  await confirmedStaffRepository.updateStatus({ workLogId, ownerId: currentUser.id, status });

  if (workLog?.jobPostingId) {
    try {
      // T-B12: 직접 sync 호출 → outbox enqueue로 전환
      await enqueueScheduleBoardSync(workLog.jobPostingId, 'update', {
        jobPostingId: workLog.jobPostingId,
        workLogId,
        reason: 'confirmed_staff_status_update',
        status,
      });
    } catch (error) {
      logger.warn('Schedule board enqueue failed after confirmed staff status update', {
        component: 'confirmedStaffService',
        workLogId,
        jobPostingId: workLog.jobPostingId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Updated confirmed staff status', { workLogId, status });
}

/**
 * 전화번호 정확 일치로 앱 가입자를 검색합니다(스태프 직접 추가용, 구인자 전용).
 */
export async function searchStaffByPhone(phone: string): Promise<UserPhoneSearchResult[]> {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) {
    return [];
  }
  return userRepository.searchByPhone(phone);
}

/**
 * 지원 절차 없이 앱 가입자를 스태프로 직접 추가합니다.
 * 정원 가드/정원 카운트 정합은 RPC(add_direct_staff)가 보장합니다.
 */
export async function addDirectStaff(input: AddDirectStaffInput): Promise<string[]> {
  await requireCurrentUser();
  logger.info('스태프 직접 추가 시작', {
    jobPostingId: input.jobPostingId,
    staffId: input.staffId,
    assignments: input.assignments.length,
  });

  const workLogIds = await confirmedStaffRepository.addDirectStaff({
    jobPostingId: input.jobPostingId,
    staffId: input.staffId,
    assignments: input.assignments,
  });

  // 스케줄 보드 동기화(enqueue 실패는 비치명적 — confirm 경로와 동일 정책)
  try {
    await enqueueScheduleBoardSync(input.jobPostingId, 'update', {
      jobPostingId: input.jobPostingId,
      reason: 'direct_staff_add',
    });
  } catch (error) {
    logger.warn('Schedule board enqueue failed after direct staff add', {
      component: 'confirmedStaffService',
      jobPostingId: input.jobPostingId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info('스태프 직접 추가 완료', {
    jobPostingId: input.jobPostingId,
    count: workLogIds.length,
  });
  return workLogIds;
}

export function subscribeToConfirmedStaff(
  jobPostingId: string,
  callbacks: {
    onUpdate: (result: GetConfirmedStaffResult) => void;
    onError?: (error: Error) => void;
  }
): UnsubscribeFn {
  logger.info('Subscribing to confirmed staff updates', { jobPostingId });

  return confirmedStaffRepository.subscribeByJobPostingId(jobPostingId, {
    onUpdate: async (workLogs) => {
      try {
        const staff = await workLogsToConfirmedStaff(workLogs);
        const grouped = groupStaffByDate(staff);
        const stats = calculateStaffStats(staff);

        callbacks.onUpdate({ staff, grouped, stats });
      } catch (error) {
        logger.error('Failed to process confirmed staff subscription update', toError(error), {
          jobPostingId,
        });
        callbacks.onError?.(toError(error));
      }
    },
    onError: callbacks.onError,
  });
}
