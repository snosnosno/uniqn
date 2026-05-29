import type {
  JobPostingStatus,
  PostingCardDisplayContext,
  PostingSalaryRow,
  PostingScheduleDisplay,
  PostingWorkflow,
  RoleWithCount,
  SalaryInfo,
  PostingSalaryDisplay,
} from '@/types';
import { FIXED_DATE_MARKER, FIXED_TIME_MARKER } from '@/types/assignment';
import { WorkLogCreator } from '@/domains/schedule';
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

export const FOCUSED_GROUP_DATE_HINT = '그룹 일정 중 선택 날짜만 표시';

export interface PostingScheduleSource {
  workflow: Pick<PostingWorkflow, 'isFixed' | 'usesGroupedDateRanges'>;
  scheduleDisplay: PostingScheduleDisplay;
  workDate?: string;
  timeSlot?: string;
  daysPerWeek?: number;
  startTime?: string;
  isStartTimeNegotiable?: boolean;
  requiredRolesWithCount?: RoleWithCount[];
  displayContext?: PostingCardDisplayContext;
}

export interface PostingCompensationSource {
  salaryDisplay: PostingSalaryDisplay;
  defaultSalary?: SalaryInfo;
  allowanceLabels?: string[];
  taxLabel?: string;
}

export interface PostingStatusMeta {
  label: string;
  variant: 'success' | 'default' | 'error' | 'warning' | 'primary' | 'secondary';
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
    case 'draft':
      return { label: '임시저장', variant: 'secondary' };
    case 'pending':
      return { label: '승인대기', variant: 'warning' };
    case 'approved':
      return { label: '승인완료', variant: 'primary' };
    case 'capacity_full':
      return { label: '정원 마감', variant: 'default' };
    case 'closed':
    case 'expired':
      return { label: status === 'closed' ? '마감' : '만료됨', variant: 'default' };
    case 'cancelled':
    case 'rejected':
      return { label: status === 'cancelled' ? '취소됨' : '거절됨', variant: 'error' };
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

export function buildPostingScheduleModel(
  source: PostingScheduleSource,
  filledCounts?: Map<string, number>
): PostingScheduleModel {
  if (source.workflow.isFixed) {
    const fixed = source.scheduleDisplay.fixed;
    const daysValue = fixed?.daysPerWeek ?? source.daysPerWeek;
    const timeValue = fixed?.startTime ?? source.startTime;
    const isNegotiable = fixed?.isStartTimeNegotiable ?? source.isStartTimeNegotiable ?? !timeValue;
    // 고정공고는 work_logs 키가 date='FIXED_SCHEDULE', slotKey=startTime ?? 'NEGOTIABLE'(협의) 로 정규화된다(SP2).
    const fixedSlotKey = isNegotiable ? FIXED_TIME_MARKER : timeValue || FIXED_TIME_MARKER;
    const roles = toRoleModels(fixed?.roles ?? source.requiredRolesWithCount ?? [], {
      date: FIXED_DATE_MARKER,
      slotKey: fixedSlotKey,
      filledCounts,
    });
    const totalCount = roles.reduce((sum, role) => sum + role.count, 0);
    const filledCount = roles.reduce((sum, role) => sum + role.filled, 0);

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
          matchDate: undefined as string | undefined,
          // grouped 는 단일 날짜가 아니라 범위 — 범위 내 hydrate 엔트리를 slot+role 별로 합산한다.
          matchRange: { startDate: group.startDate, endDate: group.endDate } as
            | { startDate: string; endDate: string }
            | undefined,
        }))
      : source.scheduleDisplay.dateRequirements.map((requirement, index) => ({
          key: `${requirement.date}-${index}`,
          label: formatDateLabel(requirement.date),
          dayCount: 1,
          timeSlots: requirement.timeSlots,
          matchDate: requirement.date as string | undefined,
          matchRange: undefined as { startDate: string; endDate: string } | undefined,
        }));

  if (sectionSources.length > 0) {
    const sections = sectionSources.map((section) => {
      const timeSlots = section.timeSlots.map((slot, slotIndex) => {
        const timeLabel = formatTimeLabel(slot);

        return {
          key: `${section.key}-${timeLabel}-${slotIndex}`,
          timeLabel,
          roles: toRoleModels(
            slot.roles,
            section.matchDate
              ? { date: section.matchDate, slotKey: slotMatchKey(slot), filledCounts }
              : section.matchRange
                ? { range: section.matchRange, slotKey: slotMatchKey(slot), filledCounts }
                : undefined
          ),
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
  const hasValidDefaultSalary =
    source.defaultSalary !== undefined &&
    source.defaultSalary.type !== 'other' &&
    (source.defaultSalary.amount ?? 0) > 0;
  const fallbackRowText = pickMaxSalaryRowText(rows) ?? rows[0]?.text;
  const primaryText = hasValidDefaultSalary
    ? formatSalaryValue(source.defaultSalary!)
    : fallbackRowText || UNKNOWN_SALARY_LABEL;

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

function pickMaxSalaryRowText(rows: readonly PostingSalaryRow[]): string | undefined {
  if (rows.length === 0) return undefined;
  let best: PostingSalaryRow | undefined;
  let bestAmount = -1;
  for (const row of rows) {
    const amount = row.salary?.type === 'other' ? 0 : (row.salary?.amount ?? 0);
    if (amount > bestAmount) {
      bestAmount = amount;
      best = row;
    }
  }
  return best?.text;
}

function slotMatchKey(slot: TimeSlotSource): string {
  if (slot.isTimeToBeAnnounced) return UNKNOWN_TIME_LABEL;
  // 서버 _posting_slot_key / apply 경로(slotCapacity)와 동일하게 range 문자열("14:00~22:00")에서
  // 시작시간만 추출해 hydrate 키를 맞춘다. discrete HH:MM 값에는 항등(무변경).
  const normalized = WorkLogCreator.extractStartTime(slot.startTime || slot.time || '');
  return normalized || UNKNOWN_TIME_LABEL;
}

function roleMatchKey(role: RoleSource): string {
  // 서버 _posting_role_key 와 정합: role='other' 면 customRole 유무와 무관하게 'other:' 접두.
  // (custom 없는 bare 'other' 도 SQL 은 'other:' 를 만들므로 hydrate 키가 일치해야 함)
  if (role.role === 'other') return `other:${role.customRole ?? ''}`;
  return role.role || role.name || '';
}

/**
 * grouped 날짜범위 hydrate 합산: submap 키(`date__slot__role`)를 파싱하여
 * startDate <= date <= endDate(YYYY-MM-DD 문자열 비교) + slot/role 일치 엔트리를 합산한다.
 */
function sumHydrateForRange(
  submap: Map<string, number> | undefined,
  range: { startDate: string; endDate: string },
  slotKey: string,
  roleKey: string
): number {
  if (!submap) return 0;
  let total = 0;
  for (const [key, value] of submap) {
    const firstSep = key.indexOf('__');
    if (firstSep < 0) continue;
    const date = key.slice(0, firstSep);
    const rest = key.slice(firstSep + 2);
    if (date < range.startDate || date > range.endDate) continue;
    if (rest !== `${slotKey}__${roleKey}`) continue;
    total += value;
  }
  return total;
}

type RoleHydrateCtx =
  | { date: string; slotKey: string; filledCounts?: Map<string, number> }
  | {
      range: { startDate: string; endDate: string };
      slotKey: string;
      filledCounts?: Map<string, number>;
    };

function toRoleModels(
  roles: readonly RoleSource[],
  ctx?: RoleHydrateCtx
): PostingRoleDisplayModel[] {
  return roles.map((role, index) => {
    const label = getRoleDisplayName(role.role || role.name || '', role.customRole);
    const count = role.count ?? role.headcount ?? 0;
    const hydrated = ctx
      ? 'range' in ctx
        ? sumHydrateForRange(ctx.filledCounts, ctx.range, ctx.slotKey, roleMatchKey(role))
        : ctx.filledCounts?.get(`${ctx.date}__${ctx.slotKey}__${roleMatchKey(role)}`)
      : undefined;
    const filled = hydrated ?? role.filled ?? 0;
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
