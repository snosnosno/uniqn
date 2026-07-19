import type { ApplicationStatus, JobPostingAggregateStats, PostingSchedule } from '@/types';

const ACTIVE_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  'applied',
  'confirmed',
  'cancellation_pending',
]);

const CONFIRMED_APPLICATION_STATUSES = new Set<ApplicationStatus>(['confirmed']);

const CANCELLATION_PENDING_STATUSES = new Set<ApplicationStatus>(['cancellation_pending']);

// SP3: calculateFilledPositionsFromSchedule 제거됨.
// filled_positions 는 work_logs 기반 DB 컬럼·트리거(SP2)가 권위이며 schedule role 에서 파생하지 않는다.
// 충원 수치는 표시 시점 hydrate RPC(SP3 Task 4)가 제공한다.

function getRoleKey(role: { role?: string; customRole?: string }): string | null {
  // 빈 role 필드는 키 충돌·무의미 집계를 막기 위해 스킵
  if (!role.role) {
    return null;
  }

  if (role.role === 'other') {
    return role.customRole ? `other:${role.customRole}` : 'other:';
  }

  return role.role;
}

/**
 * 좌석 단위(seat basis) 모집 인원 계산.
 * 모든 날짜 × 타임슬롯 × 역할의 count 총합. 날짜마다 다른 사람을 투입하는
 * 대회 이벤트를 기본 모델로 하며, DB `_total_positions_from_schedule`(트리거
 * 재계산)과 동치 규칙 — 빈 role 스킵, 음수 count 0 처리.
 * (2026-07-17 좌석 기준 통일 설계 — 구 peak(회전 가정) 모델 대체)
 */
export function calculateTotalPositionsFromSchedule(schedule: PostingSchedule): number {
  let total = 0;

  schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        if (getRoleKey(role) === null) {
          return;
        }
        total += Math.max(0, role.count ?? 0);
      });
    });
  });

  return total;
}

export function createInitialPostingStats(_schedule: PostingSchedule): JobPostingAggregateStats {
  return {
    totalApplicants: 0,
    activeApplicants: 0,
    confirmedApplicants: 0,
    cancellationPendingApplicants: 0,
    // 신규 공고 충원 0 — filled_positions 는 work_logs 트리거(SP2)가 권위
    filledPositions: 0,
  };
}

export function normalizePostingAggregateStats(
  stats: Partial<JobPostingAggregateStats> | undefined,
  _schedule: PostingSchedule,
  options?: {
    authoritativeFilledPositions?: number;
  }
): JobPostingAggregateStats {
  // filled_positions 권위 = work_logs 트리거(SP2) 또는 DB 컬럼. schedule 파생 금지.
  // authoritativeFilledPositions 미지정 시 0 (표시 시점 hydrate RPC 가 덮어씀).
  const filledPositions =
    typeof options?.authoritativeFilledPositions === 'number'
      ? options.authoritativeFilledPositions
      : 0;

  return {
    totalApplicants: stats?.totalApplicants ?? 0,
    activeApplicants: stats?.activeApplicants ?? 0,
    confirmedApplicants: stats?.confirmedApplicants ?? 0,
    cancellationPendingApplicants: stats?.cancellationPendingApplicants ?? 0,
    filledPositions,
  };
}

function isActiveStatus(status?: ApplicationStatus | null): boolean {
  return status ? ACTIVE_APPLICATION_STATUSES.has(status) : false;
}

function isConfirmedStatus(status?: ApplicationStatus | null): boolean {
  return status ? CONFIRMED_APPLICATION_STATUSES.has(status) : false;
}

function isCancellationPendingStatus(status?: ApplicationStatus | null): boolean {
  return status ? CANCELLATION_PENDING_STATUSES.has(status) : false;
}

export function transitionPostingAggregateStats(
  current: Partial<JobPostingAggregateStats> | undefined,
  options?: {
    fromStatus?: ApplicationStatus | null;
    toStatus?: ApplicationStatus | null;
    filledPositionsDelta?: number;
    totalApplicantsDelta?: number;
  }
): JobPostingAggregateStats {
  const next: JobPostingAggregateStats = {
    totalApplicants: current?.totalApplicants ?? 0,
    activeApplicants: current?.activeApplicants ?? 0,
    confirmedApplicants: current?.confirmedApplicants ?? 0,
    cancellationPendingApplicants: current?.cancellationPendingApplicants ?? 0,
    filledPositions: current?.filledPositions ?? 0,
  };

  const fromStatus = options?.fromStatus;
  const toStatus = options?.toStatus;

  if (fromStatus && fromStatus !== toStatus) {
    if (isActiveStatus(fromStatus)) {
      next.activeApplicants = Math.max(0, next.activeApplicants - 1);
    }
    if (isConfirmedStatus(fromStatus)) {
      next.confirmedApplicants = Math.max(0, next.confirmedApplicants - 1);
    }
    if (isCancellationPendingStatus(fromStatus)) {
      next.cancellationPendingApplicants = Math.max(0, next.cancellationPendingApplicants - 1);
    }
  }

  if (toStatus && fromStatus !== toStatus) {
    if (isActiveStatus(toStatus)) {
      next.activeApplicants += 1;
    }
    if (isConfirmedStatus(toStatus)) {
      next.confirmedApplicants += 1;
    }
    if (isCancellationPendingStatus(toStatus)) {
      next.cancellationPendingApplicants += 1;
    }
  }

  if ((options?.totalApplicantsDelta ?? 0) !== 0) {
    next.totalApplicants = Math.max(0, next.totalApplicants + (options?.totalApplicantsDelta ?? 0));
  }

  if ((options?.filledPositionsDelta ?? 0) !== 0) {
    next.filledPositions = Math.max(0, next.filledPositions + (options?.filledPositionsDelta ?? 0));
  }

  return next;
}
