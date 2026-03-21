import type {
  JobPostingStatus,
  PostingSalaryRow,
  PostingScheduleDisplay,
  PostingWorkflow,
  RoleWithCount,
  SalaryInfo,
  PostingSalaryDisplay,
} from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { formatDateRangeWithCount, formatDateShortWithDay, getDayCount } from '@/utils/date';
import { formatSalary } from '@/utils/formatters';

const UNKNOWN_DATE_LABEL = '날짜 미정';
const UNKNOWN_TIME_LABEL = '미정';
const NEGOTIABLE_LABEL = '협의';
const UNKNOWN_SALARY_LABEL = '급여 미정';

interface RoleSource {
  id?: string;
  role?: string;
  name?: string;
  customRole?: string;
  count?: number;
  headcount?: number;
  filled?: number;
}

interface TimeSlotSource {
  id?: string;
  startTime?: string;
  time?: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles: RoleSource[];
}

export interface PostingScheduleSource {
  workflow: Pick<PostingWorkflow, 'isFixed' | 'usesGroupedDateRanges'>;
  scheduleDisplay: PostingScheduleDisplay;
  workDate?: string;
  timeSlot?: string;
  daysPerWeek?: number;
  startTime?: string;
  isStartTimeNegotiable?: boolean;
  requiredRolesWithCount?: RoleWithCount[];
}

export interface PostingCompensationSource {
  salaryDisplay: PostingSalaryDisplay;
  defaultSalary?: SalaryInfo;
  allowanceLabels?: string[];
  taxLabel?: string;
}

export interface PostingStatusMeta {
  label: string;
  variant: 'success' | 'default' | 'error';
}

export interface PostingRoleDisplayModel {
  key: string;
  label: string;
  count: number;
  filled: number;
  isFilled: boolean;
}

export interface PostingTimeSlotDisplayModel {
  key: string;
  timeLabel: string;
  roles: PostingRoleDisplayModel[];
}

export interface PostingDateSectionDisplayModel {
  key: string;
  label: string;
  dayCount: number;
  totalCount: number;
  filledCount: number;
  timeSlots: PostingTimeSlotDisplayModel[];
}

export interface PostingFixedScheduleModel {
  daysLabel: string;
  timeLabel: string;
  roles: PostingRoleDisplayModel[];
  totalCount: number;
  filledCount: number;
}

export type PostingScheduleModel =
  | {
      variant: 'fixed';
      fixed: PostingFixedScheduleModel;
      isPartial: boolean;
    }
  | {
      variant: 'dated';
      usesGroupedRanges: boolean;
      sections: PostingDateSectionDisplayModel[];
      isPartial: boolean;
    }
  | {
      variant: 'legacy';
      dateLabel: string;
      timeLabel: string;
      isPartial: boolean;
    };

export interface PostingCompensationModel {
  useSameSalary: boolean;
  primaryText: string;
  rows: PostingSalaryRow[];
  allowanceLabels: string[];
  taxLabel?: string;
  overflowCount: number;
  isPartial: boolean;
}

export function getPostingStatusMeta(status: JobPostingStatus): PostingStatusMeta {
  switch (status) {
    case 'closed':
      return { label: '마감', variant: 'default' };
    case 'cancelled':
      return { label: '취소됨', variant: 'error' };
    case 'active':
    default:
      return { label: '모집중', variant: 'success' };
  }
}

export function shouldShowUrgentBadge(
  postingType: string | undefined,
  isUrgent: boolean | undefined
) {
  return Boolean(isUrgent && postingType !== 'urgent');
}

export function buildPostingScheduleModel(source: PostingScheduleSource): PostingScheduleModel {
  if (source.workflow.isFixed) {
    const fixed = source.scheduleDisplay.fixed;
    const roles = toRoleModels(fixed?.roles ?? source.requiredRolesWithCount ?? []);
    const totalCount = roles.reduce((sum, role) => sum + role.count, 0);
    const filledCount = roles.reduce((sum, role) => sum + role.filled, 0);
    const daysValue = fixed?.daysPerWeek ?? source.daysPerWeek;
    const timeValue = fixed?.startTime ?? source.startTime;
    const isNegotiable = fixed?.isStartTimeNegotiable ?? source.isStartTimeNegotiable ?? !timeValue;

    return {
      variant: 'fixed',
      fixed: {
        daysLabel: formatDaysPerWeek(daysValue),
        timeLabel: formatFixedTime(timeValue, isNegotiable),
        roles,
        totalCount,
        filledCount,
      },
      isPartial: daysValue === undefined || isNegotiable,
    };
  }

  const sectionSources =
    source.workflow.usesGroupedDateRanges && source.scheduleDisplay.dateGroups.length > 0
      ? source.scheduleDisplay.dateGroups.map((group) => ({
          key: group.id || `${group.startDate}-${group.endDate}`,
          label:
            getDayCount(group.startDate, group.endDate) <= 1
              ? formatDateLabel(group.startDate)
              : formatDateRangeWithCount(group.startDate, group.endDate),
          dayCount: getDayCount(group.startDate, group.endDate),
          timeSlots: group.timeSlots,
        }))
      : source.scheduleDisplay.dateRequirements.map((requirement, index) => ({
          key: `${requirement.date}-${index}`,
          label: formatDateLabel(requirement.date),
          dayCount: 1,
          timeSlots: requirement.timeSlots,
        }));

  if (sectionSources.length > 0) {
    const sections = sectionSources.map((section) => {
      const timeSlots = section.timeSlots.map((slot, slotIndex) => {
        const timeLabel = formatTimeLabel(slot);

        return {
          key: `${section.key}-${timeLabel}-${slotIndex}`,
          timeLabel,
          roles: toRoleModels(slot.roles),
        };
      });
      const totalCount = timeSlots.reduce(
        (sum, slot) => sum + slot.roles.reduce((roleSum, role) => roleSum + role.count, 0),
        0
      );
      const filledCount = timeSlots.reduce(
        (sum, slot) => sum + slot.roles.reduce((roleSum, role) => roleSum + role.filled, 0),
        0
      );

      return {
        key: section.key,
        label: section.label,
        dayCount: section.dayCount,
        totalCount,
        filledCount,
        timeSlots,
      };
    });

    return {
      variant: 'dated',
      usesGroupedRanges: source.workflow.usesGroupedDateRanges,
      sections,
      isPartial: sections.some((section) =>
        section.timeSlots.some((slot) => slot.timeLabel === UNKNOWN_TIME_LABEL)
      ),
    };
  }

  const dateLabel = formatDateLabel(source.scheduleDisplay.workDate || source.workDate);
  const timeLabel = source.scheduleDisplay.timeSlot || source.timeSlot || UNKNOWN_TIME_LABEL;

  return {
    variant: 'legacy',
    dateLabel,
    timeLabel,
    isPartial: dateLabel === UNKNOWN_DATE_LABEL || timeLabel === UNKNOWN_TIME_LABEL,
  };
}

export function buildPostingCompensationModel(
  source: PostingCompensationSource,
  options: { display: 'card' | 'detail' }
): PostingCompensationModel {
  const rows =
    options.display === 'card' ? source.salaryDisplay.previewRows : source.salaryDisplay.rows;
  const primaryText =
    source.defaultSalary !== undefined
      ? formatSalaryValue(source.defaultSalary)
      : rows[0]?.text || UNKNOWN_SALARY_LABEL;

  return {
    useSameSalary: source.salaryDisplay.useSameSalary,
    primaryText,
    rows,
    allowanceLabels: source.allowanceLabels ?? [],
    taxLabel: source.taxLabel,
    overflowCount: options.display === 'card' ? source.salaryDisplay.overflowCount : 0,
    isPartial: primaryText === UNKNOWN_SALARY_LABEL,
  };
}

function toRoleModels(roles: readonly RoleSource[]): PostingRoleDisplayModel[] {
  return roles.map((role, index) => {
    const label = getRoleDisplayName(role.role || role.name || '', role.customRole);
    const count = role.count ?? role.headcount ?? 0;
    const filled = role.filled ?? 0;
    const keySource =
      role.role === 'other' && role.customRole
        ? `other:${role.customRole}`
        : role.role || role.name;

    return {
      key: `${keySource || 'role'}-${count}-${index}`,
      label,
      count,
      filled,
      isFilled: count > 0 && filled >= count,
    };
  });
}

function formatDateLabel(date: string | undefined): string {
  if (!date) {
    return UNKNOWN_DATE_LABEL;
  }

  return formatDateShortWithDay(date) || UNKNOWN_DATE_LABEL;
}

function formatTimeLabel(slot: TimeSlotSource): string {
  if (slot.isTimeToBeAnnounced) {
    return slot.tentativeDescription
      ? `${UNKNOWN_TIME_LABEL} (${slot.tentativeDescription})`
      : UNKNOWN_TIME_LABEL;
  }

  return slot.startTime || slot.time || UNKNOWN_TIME_LABEL;
}

function formatDaysPerWeek(daysPerWeek?: number): string {
  if (!daysPerWeek || daysPerWeek <= 0) {
    return NEGOTIABLE_LABEL;
  }

  return `주 ${daysPerWeek}일`;
}

function formatFixedTime(startTime?: string, isNegotiable?: boolean): string {
  if (isNegotiable || !startTime) {
    return NEGOTIABLE_LABEL;
  }

  return startTime;
}

function formatSalaryValue(salary: SalaryInfo): string {
  if (salary.type === 'other') {
    return NEGOTIABLE_LABEL;
  }

  return formatSalary(salary.type, salary.amount);
}
