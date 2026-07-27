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
import { getAllowanceItems, getGuaranteedHoursLabel } from '@/utils/allowanceUtils';
import { isSupportedReleasePosting } from '@/utils/jobPostingVisibility';
import { logger } from '@/utils/logger';
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

/**
 * filledPositions 단일 권위 해소 (SP3)
 *
 * @description top-level filled_positions 컬럼이 권위(fn_update_job_posting_stats 트리거로 갱신).
 * stats.filledPositions 는 부차 미러로, column 이 null/undefined 일 때만 fallback.
 * 두 값이 모두 존재하고 서로 다르면 divergence 를 logger.warn 으로 관측(무성 불일치 방지).
 */
function resolveFilledPositions(posting: JobPosting): number {
  // 타입상 number 이지만 레거시/부분 데이터 런타임 방어로 nullable 로 본다.
  const column: number | null | undefined = posting.filledPositions;
  const mirror: number | null | undefined = posting.stats?.filledPositions;

  if (column === null || column === undefined) {
    return mirror ?? 0;
  }

  if (mirror !== null && mirror !== undefined && mirror !== column) {
    logger.warn('filledPositions divergence between column and stats mirror', {
      component: 'job-posting/facts',
      action: 'resolveFilledPositions',
      postingId: posting.id,
      columnFilledPositions: column,
      statsFilledPositions: mirror,
    });
  }

  return column;
}

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
  const filledPositions = resolveFilledPositions(posting);
  const allowanceLabels = getAllowanceItems(posting.compensation.allowances);
  const guaranteedHoursLabel = getGuaranteedHoursLabel(posting.compensation.allowances);
  // 모집 조건 라벨(S3) — 공백만 있는 값은 미설정으로 취급(쓰기 XSS refine은 zod 완료, 표시는 RN Text)
  const dressCode = posting.conditions?.dressCode?.trim();
  const experience = posting.conditions?.experience?.trim();
  const conditionLabels = [
    // 보장시간은 금액에 반영되지 않는 근무 조건이라 수당 칩이 아니라 여기로 온다(SETTLE-2).
    ...(guaranteedHoursLabel ? [guaranteedHoursLabel] : []),
    ...(dressCode ? [`복장 ${dressCode}`] : []),
    // '경력 1년이상' 같은 칩은 문구가 이미 '경력'으로 시작 — 이중 접두 방지
    ...(experience ? [experience.startsWith('경력') ? experience : `경력 ${experience}`] : []),
  ];
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
  // capacity_full: 트리거 자동 전이로 마감된 정원. 미배포 구버전/미전이 active 공고 대비
  // derived(filled>=total) 검사도 fallback 으로 유지.
  const postingFull =
    posting.status === 'capacity_full' ||
    (posting.status === 'active' &&
      posting.totalPositions > 0 &&
      filledPositions >= posting.totalPositions);
  const unsupportedWorkflow = !isSupportedReleasePosting(posting);
  const canApply =
    posting.status === 'active' &&
    !postingFull &&
    roleAvailability.hasAvailableRoles &&
    !unsupportedWorkflow;
  let applicationReason: PostingApplicationEligibility['reason'];
  if (unsupportedWorkflow) {
    applicationReason = 'unsupported_workflow';
  } else if (postingFull) {
    applicationReason = 'posting_full';
  } else if (posting.status !== 'active') {
    applicationReason = 'inactive';
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
    conditionLabels,
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
