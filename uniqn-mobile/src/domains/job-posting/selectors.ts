import type {
  JobPosting,
  PostingApplicationEligibility,
  PostingRoleAvailability,
  PostingSalaryDisplay,
  PostingScheduleDisplay,
  PostingWorkflow,
} from '@/types';
import { FIXED_TIME_MARKER } from '@/types/assignment';
import { getRoleDisplayName } from '@/types/unified';
import {
  createPostingLegacyDateRequirements,
  getPostingDateGroups,
  getPostingDateRequirements,
  getPostingDefaultSalary,
  getPostingLegacyTimeSlot,
  getPostingRequiredRolesWithCount,
  getPostingRoleKey,
  getPostingRoleStats,
  getPostingSalaryRows,
} from './core';

export type { PostingSettlementContext } from '@/types';
export {
  createPostingLegacyDateRequirements,
  getPostingRoleStats,
  getPostingDefaultSalary,
  getPostingSettlementContext,
} from './core';

export function selectPostingWorkflow(posting: JobPosting): PostingWorkflow {
  const isFixed = posting.schedule.kind === 'fixed';
  const isTournament = posting.postingType === 'tournament';
  const dateGroups = isFixed ? [] : getPostingDateGroups(posting);

  return {
    scheduleKind: posting.schedule.kind,
    isFixed,
    isDated: !isFixed,
    isTournament,
    isUrgent: posting.postingType === 'urgent',
    recruitmentType: isFixed ? 'fixed' : 'event',
    usesGroupedDateRanges: isTournament && dateGroups.length > 0,
  };
}

export function selectPostingRoleAvailability(posting: JobPosting): PostingRoleAvailability {
  const items = getPostingRoleStats(posting).map((role) => {
    const remaining = Math.max(0, role.count - role.filled);

    return {
      key: role.role === 'other' && role.customRole ? role.customRole : getPostingRoleKey(role),
      role: role.role,
      customRole: role.customRole,
      roleLabel: getRoleDisplayName(role.role, role.customRole),
      count: role.count,
      filled: role.filled,
      remaining,
      salary: role.salary,
      isAvailable: remaining > 0,
    };
  });

  const availableItems = items.filter((item) => item.isAvailable);

  return {
    items,
    availableItems,
    totalCount: items.reduce((sum, item) => sum + item.count, 0),
    filledCount: items.reduce((sum, item) => sum + item.filled, 0),
    remainingCount: items.reduce((sum, item) => sum + item.remaining, 0),
    hasAvailableRoles: availableItems.length > 0,
  };
}

export function selectPostingSalaryDisplay(posting: JobPosting): PostingSalaryDisplay {
  const rows = getPostingSalaryRows(posting);

  return {
    defaultSalary: getPostingDefaultSalary(posting),
    rows,
    previewRows: rows.slice(0, 3),
    overflowCount: Math.max(0, rows.length - 3),
    useSameSalary: posting.compensation.mode === 'shared',
    hasRoleSpecificSalary: posting.compensation.mode === 'by_role' && rows.length > 0,
  };
}

export function selectPostingScheduleDisplay(posting: JobPosting): PostingScheduleDisplay {
  const workflow = selectPostingWorkflow(posting);
  const dateRequirements = getPostingDateRequirements(posting);
  const dateGroups = workflow.usesGroupedDateRanges ? getPostingDateGroups(posting) : [];
  const fixed =
    posting.schedule.kind === 'fixed'
      ? {
          daysPerWeek: posting.schedule.daysPerWeek,
          startTime: posting.schedule.startTime,
          isStartTimeNegotiable: posting.schedule.isStartTimeNegotiable,
          roles: getPostingRequiredRolesWithCount(posting),
        }
      : undefined;

  return {
    variant: workflow.isFixed
      ? 'fixed'
      : workflow.usesGroupedDateRanges
        ? 'grouped_dates'
        : dateRequirements.length > 0
          ? 'dated_requirements'
          : 'legacy',
    dateRequirements,
    dateGroups,
    workDate: posting.workDate,
    timeSlot: getPostingLegacyTimeSlot(posting),
    fixed,
  };
}

export function selectPostingApplicationEligibility(
  posting: JobPosting
): PostingApplicationEligibility {
  const workflow = selectPostingWorkflow(posting);
  const roleAvailability = selectPostingRoleAvailability(posting);
  const postingFull =
    posting.totalPositions > 0 && posting.filledPositions >= posting.totalPositions;
  const canApply =
    posting.status === 'active' && !postingFull && roleAvailability.hasAvailableRoles;

  let reason: PostingApplicationEligibility['reason'];
  if (posting.status !== 'active') {
    reason = 'inactive';
  } else if (postingFull) {
    reason = 'posting_full';
  } else if (!roleAvailability.hasAvailableRoles) {
    reason = 'role_full';
  }

  return {
    canApply,
    selectionMode: workflow.isFixed ? 'fixed_role' : 'dated_assignment',
    requiresRoleSelection: workflow.isFixed,
    requiresAssignmentSelection: !workflow.isFixed,
    requiresPreQuestions: (posting.questions.items ?? []).length > 0,
    fixedAssignmentTimeSlot:
      posting.schedule.kind === 'fixed'
        ? posting.schedule.startTime || FIXED_TIME_MARKER
        : FIXED_TIME_MARKER,
    availableRoleOptions: roleAvailability.availableItems,
    reason,
  };
}

export function selectPostingLegacyDateRequirements(posting: JobPosting) {
  return createPostingLegacyDateRequirements(posting);
}
