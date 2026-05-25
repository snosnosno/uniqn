import type { ApplicationStatus, JobPostingAggregateStats, PostingSchedule } from '@/types';

const ACTIVE_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  'applied',
  'confirmed',
  'cancellation_pending',
]);

const CONFIRMED_APPLICATION_STATUSES = new Set<ApplicationStatus>(['confirmed']);

const CANCELLATION_PENDING_STATUSES = new Set<ApplicationStatus>(['cancellation_pending']);

export function calculateFilledPositionsFromSchedule(schedule: PostingSchedule): number {
  // fixed schedule은 통일 구조(requirements)를 우선 읽고, 레거시(roleRequirements) 역호환
  const requirements =
    schedule.kind === 'fixed' ? (schedule.requirements ?? []) : schedule.requirements;

  if (schedule.kind === 'fixed') {
    const legacy = schedule as unknown as {
      roleRequirements?: { filled?: number }[];
    };
    if (requirements.length === 0 && legacy.roleRequirements) {
      return legacy.roleRequirements.reduce((sum, role) => sum + (role.filled ?? 0), 0);
    }
    return requirements.reduce((dateSum, requirement) => {
      return (
        dateSum +
        requirement.timeSlots.reduce((slotSum, slot) => {
          return slotSum + slot.roles.reduce((roleSum, role) => roleSum + (role.filled ?? 0), 0);
        }, 0)
      );
    }, 0);
  }

  return requirements.reduce((dateSum, requirement) => {
    return (
      dateSum +
      requirement.timeSlots.reduce((slotSum, slot) => {
        return slotSum + slot.roles.reduce((roleSum, role) => roleSum + (role.filled ?? 0), 0);
      }, 0)
    );
  }, 0);
}

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
  if (schedule.kind === 'fixed') {
    // 통일 구조(requirements) 우선, 레거시(roleRequirements) 역호환
    const requirements = schedule.requirements ?? [];
    const legacy = schedule as unknown as { roleRequirements?: { count: number }[] };

    if (requirements.length === 0 && legacy.roleRequirements) {
      return legacy.roleRequirements.reduce((sum, role) => sum + role.count, 0);
    }

    // fixed는 날짜 없는 단일 슬롯 — peak 계산 없이 단순 합산
    return requirements.reduce((dateSum, requirement) => {
      return (
        dateSum +
        requirement.timeSlots.reduce((slotSum, slot) => {
          return slotSum + slot.roles.reduce((roleSum, role) => roleSum + role.count, 0);
        }, 0)
      );
    }, 0);
  }

  const peakByRole = new Map<string, number>();

  schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        const key = getRoleKey(role);
        if (key === null) {
          return;
        }
        const previous = peakByRole.get(key) ?? 0;
        if (role.count > previous) {
          peakByRole.set(key, role.count);
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

export function createInitialPostingStats(schedule: PostingSchedule): JobPostingAggregateStats {
  return {
    totalApplicants: 0,
    activeApplicants: 0,
    confirmedApplicants: 0,
    cancellationPendingApplicants: 0,
    filledPositions: calculateFilledPositionsFromSchedule(schedule),
  };
}

export function normalizePostingAggregateStats(
  stats: Partial<JobPostingAggregateStats> | undefined,
  schedule: PostingSchedule,
  options?: {
    authoritativeFilledPositions?: number;
  }
): JobPostingAggregateStats {
  const filledFromSchedule = calculateFilledPositionsFromSchedule(schedule);
  const filledPositions =
    typeof options?.authoritativeFilledPositions === 'number'
      ? options.authoritativeFilledPositions
      : filledFromSchedule;

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
