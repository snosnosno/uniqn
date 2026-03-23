import type {
  JobPosting,
  PostingApplicationEligibility,
  PostingFacts,
  PostingRoleAvailability,
  PostingSalaryDisplay,
  PostingScheduleDisplay,
} from '@/types';
import { FIXED_TIME_MARKER } from '@/types/assignment';
import { getRoleDisplayName } from '@/types/unified';
import { getAllowanceItems } from '@/utils/allowanceUtils';
import { isSupportedReleasePosting } from '@/utils/jobPostingVisibility';
import {
  getPostingDefaultSalary,
  getPostingDateGroups,
  getPostingDateRequirements,
  getPostingLegacyTimeSlot,
  getPostingLocationLabels,
  getPostingRequiredRolesWithCount,
  getPostingRoleKey,
  getPostingRoleStats,
  getPostingSalaryRows,
  getPostingTaxLabel,
} from './core';
import { selectPostingWorkflow } from './selectors';

export function buildPostingFacts(posting: JobPosting): PostingFacts {
  const workflow = selectPostingWorkflow(posting);
  const location = getPostingLocationLabels(posting);
  const roleStats = getPostingRoleStats(posting);
  const roleAvailabilityItems = roleStats.map((role) => {
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
  const availableRoleItems = roleAvailabilityItems.filter((item) => item.isAvailable);
  const roleAvailability: PostingRoleAvailability = {
    items: roleAvailabilityItems,
    availableItems: availableRoleItems,
    totalCount: roleAvailabilityItems.reduce((sum, item) => sum + item.count, 0),
    filledCount: roleAvailabilityItems.reduce((sum, item) => sum + item.filled, 0),
    remainingCount: roleAvailabilityItems.reduce((sum, item) => sum + item.remaining, 0),
    hasAvailableRoles: availableRoleItems.length > 0,
  };
  const salaryRows = getPostingSalaryRows(posting);
  const defaultSalary = getPostingDefaultSalary(posting);
  const filledPositions = posting.stats?.filledPositions ?? posting.filledPositions;
  const allowanceLabels = getAllowanceItems(posting.compensation.allowances, {
    includeEmoji: true,
  });
  const dateRequirements = getPostingDateRequirements(posting);
  const requiredRolesWithCount = getPostingRequiredRolesWithCount(posting);
  const scheduleDisplay: PostingScheduleDisplay = {
    variant: workflow.isFixed
      ? 'fixed'
      : workflow.usesGroupedDateRanges
        ? 'grouped_dates'
        : dateRequirements.length > 0
          ? 'dated_requirements'
          : 'legacy',
    dateRequirements,
    dateGroups: workflow.usesGroupedDateRanges ? getPostingDateGroups(posting) : [],
    workDate: posting.workDate,
    timeSlot: getPostingLegacyTimeSlot(posting),
    fixed:
      posting.schedule.kind === 'fixed'
        ? {
            daysPerWeek: posting.schedule.daysPerWeek,
            startTime: posting.schedule.startTime,
            isStartTimeNegotiable: posting.schedule.isStartTimeNegotiable,
            roles: requiredRolesWithCount,
          }
        : undefined,
  };
  const salaryDisplay: PostingSalaryDisplay = {
    defaultSalary,
    rows: salaryRows,
    previewRows: salaryRows.slice(0, 3),
    overflowCount: Math.max(0, salaryRows.length - 3),
    useSameSalary: posting.compensation.mode === 'shared',
    hasRoleSpecificSalary: posting.compensation.mode === 'by_role' && salaryRows.length > 0,
  };
  const postingFull = posting.totalPositions > 0 && filledPositions >= posting.totalPositions;
  const unsupportedWorkflow = !isSupportedReleasePosting(posting);
  const canApply =
    posting.status === 'active' &&
    !postingFull &&
    roleAvailability.hasAvailableRoles &&
    !unsupportedWorkflow;
  let applicationReason: PostingApplicationEligibility['reason'];
  if (unsupportedWorkflow) {
    applicationReason = 'unsupported_workflow';
  } else if (posting.status !== 'active') {
    applicationReason = 'inactive';
  } else if (postingFull) {
    applicationReason = 'posting_full';
  } else if (!roleAvailability.hasAvailableRoles) {
    applicationReason = 'role_full';
  }
  const application: PostingApplicationEligibility = {
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
    reason: applicationReason,
  };
  const questions = posting.questions.items ?? [];

  return {
    posting: {
      ...posting,
      roles: roleStats,
    },
    title: posting.title,
    description: posting.description,
    status: posting.status,
    postingType: posting.postingType,
    isUrgent: workflow.isUrgent,
    workflow,
    location,
    owner: {
      id: posting.ownerId,
      name: posting.ownerName,
      contactPhone: posting.contactPhone,
    },
    schedule: {
      kind: posting.schedule.kind,
      workDate: scheduleDisplay.workDate,
      timeSlot: scheduleDisplay.timeSlot,
      dateRequirements,
      daysPerWeek: posting.schedule.kind === 'fixed' ? posting.schedule.daysPerWeek : undefined,
      startTime: posting.schedule.kind === 'fixed' ? posting.schedule.startTime : undefined,
      isStartTimeNegotiable:
        posting.schedule.kind === 'fixed' ? posting.schedule.isStartTimeNegotiable : undefined,
      requiredRolesWithCount,
      display: scheduleDisplay,
    },
    compensation: {
      mode: posting.compensation.mode,
      defaultSalary,
      salaryRows,
      allowanceLabels,
      taxLabel: getPostingTaxLabel(posting),
      display: salaryDisplay,
    },
    roleAvailability,
    application,
    stats: {
      totalPositions: posting.totalPositions,
      filledPositions,
      totalApplicants: posting.stats?.totalApplicants ?? 0,
      activeApplicants: posting.stats?.activeApplicants ?? 0,
      confirmedApplicants: posting.stats?.confirmedApplicants ?? 0,
      cancellationPendingApplicants: posting.stats?.cancellationPendingApplicants ?? 0,
    },
    questions: {
      items: questions,
      enabled: questions.length > 0,
    },
    tournamentConfig: posting.tournamentConfig,
  };
}
