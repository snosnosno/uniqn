import type { ApplicationStatus, JobPostingAggregateStats, PostingSchedule } from '@/types';

const ACTIVE_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  'applied',
  'confirmed',
  'cancellation_pending',
]);

const CONFIRMED_APPLICATION_STATUSES = new Set<ApplicationStatus>(['confirmed']);

const CANCELLATION_PENDING_STATUSES = new Set<ApplicationStatus>(['cancellation_pending']);

export function calculateFilledPositionsFromSchedule(schedule: PostingSchedule): number {
  if (schedule.kind === 'fixed') {
    return (schedule.roleRequirements ?? []).reduce((sum, role) => sum + (role.filled ?? 0), 0);
  }

  return schedule.requirements.reduce((dateSum, requirement) => {
    return (
      dateSum +
      requirement.timeSlots.reduce((slotSum, slot) => {
        return slotSum + slot.roles.reduce((roleSum, role) => roleSum + (role.filled ?? 0), 0);
      }, 0)
    );
  }, 0);
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
