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
 * 사람 단위(person basis) 모집 인원 계산.
 * 같은 역할은 여러 슬롯/날짜에서 "같은 사람이 돌아가며 근무 가능"하다고 가정하여
 * 역할별 최대 동시 필요 인원(peak)의 합으로 totalPositions를 구한다.
 * (HANDOFF.md Phase 6 알고리즘 결정)
 */
export function calculateTotalPositionsFromSchedule(schedule: PostingSchedule): number {
  const peakByRole = new Map<string, number>();

  schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      // 같은 슬롯 안 동일 역할 엔트리는 동시 필요 인원이므로 합산한다.
      // (peak 를 바로 비교하면 [dealer:3, dealer:2] 같은 중복 역할이 5 아닌 3으로 과소 집계됨)
      const slotSumByRole = new Map<string, number>();
      slot.roles.forEach((role) => {
        const key = getRoleKey(role);
        if (key === null) {
          return;
        }
        slotSumByRole.set(key, (slotSumByRole.get(key) ?? 0) + role.count);
      });

      // 슬롯/날짜 간에는 같은 사람이 돌아가며 근무 가능 → 역할별 최대 동시 필요 인원(peak).
      slotSumByRole.forEach((slotSum, key) => {
        const previous = peakByRole.get(key) ?? 0;
        if (slotSum > previous) {
          peakByRole.set(key, slotSum);
        }
      });
    });
  });

  let total = 0;
  peakByRole.forEach((count) => {
    total += count;
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
