import type {
  CardDateRequirement,
  JobPosting,
  JobPostingCard,
  PostingAudience,
  PostingCardViewModel,
  PostingDetailViewModel,
  PostingFacts,
  PostingManagementViewModel,
  PostingSurface,
} from '@/types';
import { buildPostingFacts } from './facts';

function projectCard(facts: PostingFacts): PostingCardViewModel {
  return {
    id: facts.posting.id,
    title: facts.title,
    description: facts.description,
    workflow: facts.workflow,
    location: facts.location.shortLabel,
    fullLocation: facts.location.fullLabel,
    regionLabel: facts.location.regionLabel,
    workDate: facts.schedule.workDate,
    timeSlot: facts.schedule.timeSlot,
    roles: facts.posting.roleCatalog.map((role) => role.role),
    dateRequirements: facts.schedule.dateRequirements,
    defaultSalary: facts.compensation.defaultSalary,
    allowances: facts.posting.compensation.allowances,
    allowanceLabels: facts.compensation.allowanceLabels,
    taxSettings: facts.posting.compensation.taxSettings,
    taxLabel: facts.compensation.taxLabel,
    useSameSalary: facts.compensation.display.useSameSalary,
    status: facts.status,
    isUrgent: facts.isUrgent,
    totalApplicants: facts.stats.totalApplicants,
    postingType: facts.postingType,
    ownerName: facts.owner.name,
    contactPhone: facts.owner.contactPhone,
    ownerId: facts.owner.id,
    daysPerWeek: facts.schedule.daysPerWeek,
    startTime: facts.schedule.startTime,
    requiredRolesWithCount: facts.schedule.requiredRolesWithCount,
    tournamentConfig: facts.tournamentConfig,
    salaryRows: facts.compensation.display.previewRows,
    fullSalaryRows: facts.compensation.display.rows,
    salaryOverflowCount: facts.compensation.display.overflowCount,
    scheduleDisplay: facts.schedule.display,
    salaryDisplay: facts.compensation.display,
    roleAvailability: facts.roleAvailability,
    applicationEligibility: facts.application,
  };
}

function projectDetail(facts: PostingFacts): PostingDetailViewModel {
  return {
    id: facts.posting.id,
    title: facts.title,
    description: facts.description,
    workflow: facts.workflow,
    status: facts.status,
    postingType: facts.postingType,
    isUrgent: facts.isUrgent,
    locationLabel: facts.location.fullLabel,
    regionLabel: facts.location.regionLabel,
    contactPhone: facts.owner.contactPhone,
    workDate: facts.schedule.workDate,
    timeSlot: facts.schedule.timeSlot,
    dateRequirements: facts.schedule.dateRequirements,
    daysPerWeek: facts.schedule.daysPerWeek,
    startTime: facts.schedule.startTime,
    isStartTimeNegotiable: facts.schedule.isStartTimeNegotiable,
    requiredRolesWithCount: facts.schedule.requiredRolesWithCount,
    salaryRows: facts.compensation.display.rows,
    defaultSalary: facts.compensation.defaultSalary,
    useSameSalary: facts.compensation.display.useSameSalary,
    allowances: facts.posting.compensation.allowances,
    allowanceLabels: facts.compensation.allowanceLabels,
    taxSettings: facts.posting.compensation.taxSettings,
    taxLabel: facts.compensation.taxLabel,
    questions: facts.questions.items,
    ownerName: facts.owner.name,
    ownerId: facts.owner.id,
    totalApplicants: facts.stats.totalApplicants,
    viewCount: facts.posting.viewCount,
    totalPositions: facts.stats.totalPositions,
    filledPositions: facts.stats.filledPositions,
    tournamentConfig: facts.tournamentConfig,
    scheduleDisplay: facts.schedule.display,
    salaryDisplay: facts.compensation.display,
    roleAvailability: facts.roleAvailability,
    applicationEligibility: facts.application,
  };
}

function projectManagement(facts: PostingFacts): PostingManagementViewModel {
  return {
    ...projectDetail(facts),
    totalApplicants: facts.stats.totalApplicants,
    confirmedApplicants: facts.stats.confirmedApplicants,
    pendingApplicants: Math.max(
      0,
      facts.stats.activeApplicants -
        facts.stats.confirmedApplicants -
        facts.stats.cancellationPendingApplicants
    ),
  };
}

export function projectPostingCard(facts: PostingFacts): PostingCardViewModel {
  return projectCard(facts);
}

export function projectPostingDetail(facts: PostingFacts): PostingDetailViewModel {
  return projectDetail(facts);
}

export function projectPostingManagement(facts: PostingFacts): PostingManagementViewModel {
  return projectManagement(facts);
}

function getMatchingDateRequirement(
  card: Pick<JobPostingCard, 'dateRequirements' | 'workDate'>,
  date: string
): CardDateRequirement | undefined {
  return card.dateRequirements.find((requirement) => requirement.date === date);
}

export function matchesPostingDate(
  card: Pick<JobPostingCard, 'dateRequirements' | 'workDate'>,
  date?: string
): boolean {
  if (!date) {
    return true;
  }

  if (card.dateRequirements.length > 0) {
    return Boolean(getMatchingDateRequirement(card, date));
  }

  return card.workDate === date;
}

export function focusPostingCardToDate(card: JobPostingCard, date?: string): JobPostingCard {
  if (!date || card.workflow.isFixed || card.scheduleDisplay.variant === 'legacy') {
    return card;
  }

  const matchingRequirement = getMatchingDateRequirement(card, date);
  if (!matchingRequirement) {
    return card;
  }

  const wasGroupedRange =
    card.displayContext?.wasGroupedRange ??
    (card.workflow.usesGroupedDateRanges || card.scheduleDisplay.variant === 'grouped_dates');

  return {
    ...card,
    workflow: {
      ...card.workflow,
      usesGroupedDateRanges: false,
    },
    dateRequirements: [matchingRequirement],
    scheduleDisplay: {
      ...card.scheduleDisplay,
      variant: 'dated_requirements',
      dateRequirements: [matchingRequirement],
      dateGroups: [],
    },
    displayContext: {
      ...card.displayContext,
      focusedDate: date,
      wasGroupedRange,
    },
  };
}

export function projectPostingSurface(
  facts: PostingFacts,
  options: {
    audience: PostingAudience;
    surface: PostingSurface;
  }
): PostingCardViewModel | PostingDetailViewModel | PostingManagementViewModel {
  if (options.surface === 'card') {
    return projectCard(facts);
  }

  if (options.surface === 'manage') {
    return projectManagement(facts);
  }

  return projectDetail(facts);
}

export function toJobPostingCard(posting: JobPosting): JobPostingCard {
  return projectCard(buildPostingFacts(posting));
}
