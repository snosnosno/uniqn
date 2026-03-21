import type { JobPosting, PostingFacts } from '@/types';
import { getAllowanceItems } from '@/utils/allowanceUtils';
import {
  getPostingDefaultSalary,
  getPostingLocationLabels,
  getPostingRequiredRolesWithCount,
  getPostingRoleStats,
  getPostingSalaryRows,
  getPostingTaxLabel,
} from './core';
import {
  selectPostingApplicationEligibility,
  selectPostingRoleAvailability,
  selectPostingSalaryDisplay,
  selectPostingScheduleDisplay,
  selectPostingWorkflow,
} from './selectors';

export function buildPostingFacts(posting: JobPosting): PostingFacts {
  const workflow = selectPostingWorkflow(posting);
  const location = getPostingLocationLabels(posting);
  const salaryRows = getPostingSalaryRows(posting);
  const defaultSalary = getPostingDefaultSalary(posting);
  const allowanceLabels = getAllowanceItems(posting.compensation.allowances, {
    includeEmoji: true,
  });
  const scheduleDisplay = selectPostingScheduleDisplay(posting);
  const salaryDisplay = selectPostingSalaryDisplay(posting);
  const roleAvailability = selectPostingRoleAvailability(posting);
  const application = selectPostingApplicationEligibility(posting);
  const questions = posting.questions.items ?? [];

  return {
    posting: {
      ...posting,
      roles: getPostingRoleStats(posting),
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
      dateRequirements: scheduleDisplay.dateRequirements,
      daysPerWeek: posting.schedule.kind === 'fixed' ? posting.schedule.daysPerWeek : undefined,
      startTime: posting.schedule.kind === 'fixed' ? posting.schedule.startTime : undefined,
      isStartTimeNegotiable:
        posting.schedule.kind === 'fixed' ? posting.schedule.isStartTimeNegotiable : undefined,
      requiredRolesWithCount: getPostingRequiredRolesWithCount(posting),
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
      filledPositions: posting.filledPositions,
      applicationCount: posting.applicationCount ?? 0,
    },
    questions: {
      items: questions,
      enabled: questions.length > 0,
    },
    tournamentConfig: posting.tournamentConfig,
  };
}
