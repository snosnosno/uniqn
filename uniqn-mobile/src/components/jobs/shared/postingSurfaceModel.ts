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
import {
  formatDateRangeWithCount,
  formatDateShortWithDay,
  generateDateRange,
  sortTimeSlotsByStart,
} from '@/utils/date';
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

export interface PostingDateSectionDayModel {
  key: string;
  date: string;
  label: string;
  totalCount: number;
  filledCount: number;
  timeSlots: PostingTimeSlotDisplayModel[];
}

export interface PostingDateSectionDisplayModel {
  key: string;
  label: string;
  dayCount: number;
  totalCount: number;
  filledCount: number;
  timeSlots: PostingTimeSlotDisplayModel[];
  /** 그룹 날짜범위 섹션일 때만: 날짜별 전개(좌석 기준 단일 소스). */
  days?: PostingDateSectionDayModel[];
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
    return buildFixedScheduleModel(source, filledCounts);
  }

  const dated = buildDatedScheduleModel(source, filledCounts);
  if (dated) {
    return dated;
  }

  return buildLegacyScheduleModel(source);
}

function buildFixedScheduleModel(
  source: PostingScheduleSource,
  filledCounts?: Map<string, number>
): Extract<PostingScheduleModel, { variant: 'fixed' }> {
  const fixed = source.scheduleDisplay.fixed;
  const daysValue = fixed?.daysPerWeek ?? source.daysPerWeek;
  const timeValue = fixed?.startTime ?? source.startTime;
  const isNegotiable = fixed?.isStartTimeNegotiable ?? source.isStartTimeNegotiable ?? !timeValue;
  // 고정공고 work_logs 키: date='FIXED_SCHEDULE', slotKey=startTime 우선(없을 때만 'NEGOTIABLE').
  // 확정 경로(facts.ts fixedAssignmentTimeSlot)·DB 정규화(_posting_slot_key)와 동일 규칙으로 통일 —
  // isNegotiable 플래그가 켜져 있어도 startTime 값이 있으면 그 값으로 hydrate 조회해야 미스매치(0 폴백)가 없다.
  const fixedSlotKey = timeValue || FIXED_TIME_MARKER;
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

function buildDatedScheduleModel(
  source: PostingScheduleSource,
  filledCounts?: Map<string, number>
): Extract<PostingScheduleModel, { variant: 'dated' }> | null {
  const isGrouped =
    source.workflow.usesGroupedDateRanges && source.scheduleDisplay.dateGroups.length > 0;

  const sections = isGrouped
    ? source.scheduleDisplay.dateGroups.map((group) => buildGroupedSection(group, filledCounts))
    : source.scheduleDisplay.dateRequirements.map((requirement, index) =>
        buildSingleDateSection(requirement, index, filledCounts)
      );

  if (sections.length === 0) {
    return null;
  }

  return {
    variant: 'dated',
    usesGroupedRanges: source.workflow.usesGroupedDateRanges,
    sections,
    isPartial: sections.some((section) =>
      section.timeSlots.some((slot) => slot.timeLabel === UNKNOWN_TIME_LABEL)
    ),
  };
}

/** 비그룹 단일 날짜 섹션 — 기존 동작 보존(단일 날짜 키 hydrate). */
function buildSingleDateSection(
  requirement: { date: string; timeSlots: TimeSlotSource[] },
  index: number,
  filledCounts?: Map<string, number>
): PostingDateSectionDisplayModel {
  const key = `${requirement.date}-${index}`;
  // 표시 정렬: 등록 순서가 아닌 시작시간 순(스크린샷 실측 10:00→11:00→10:30 버그).
  const orderedTimeSlots = sortTimeSlotsByStart(requirement.timeSlots);
  const timeSlots = orderedTimeSlots.map((slot, slotIndex) => ({
    key: `${key}-${formatTimeLabel(slot)}-${slotIndex}`,
    timeLabel: formatTimeLabel(slot),
    roles: toRoleModels(slot.roles, {
      date: requirement.date,
      slotKey: slotMatchKey(slot),
      filledCounts,
    }),
  }));

  return {
    key,
    label: formatDateLabel(requirement.date),
    dayCount: 1,
    totalCount: sumSlotCounts(timeSlots, 'count'),
    filledCount: sumSlotCounts(timeSlots, 'filled'),
    timeSlots,
  };
}

/**
 * 그룹 날짜범위 섹션 — 날짜별 전개(좌석 기준).
 * 각 날짜를 자기 날짜 키(`date__slot__role`)로 개별 hydrate 하고,
 * 섹션 요약 timeSlots 는 하루 기준(C안)으로 count=하루 요구 / filled=일별 확정 max 로 만든다.
 * 자리 총계(Σ일별)는 section.totalCount/filledCount 로 별도 보존한다.
 * (구 sumHydrateForRange 범위합산은 count 가 하루치라 6/3 차원 불일치를 냈음 — 제거)
 */
function buildGroupedSection(
  group: {
    id?: string;
    startDate: string;
    endDate: string;
    timeSlots: TimeSlotSource[];
  },
  filledCounts?: Map<string, number>
): PostingDateSectionDisplayModel {
  const sectionKey = group.id || `${group.startDate}-${group.endDate}`;
  // 표시 정렬: 등록 순서가 아닌 시작시간 순(스크린샷 실측 10:00→11:00→10:30 버그).
  // days/summary 가 같은 배열을 공유해야 slotIndex 대응이 유지된다.
  const orderedTimeSlots = sortTimeSlotsByStart(group.timeSlots);
  const dates = generateDateRange(group.startDate, group.endDate);
  const effectiveDates = dates.length > 0 ? dates : [group.startDate];

  const days: PostingDateSectionDayModel[] = effectiveDates.map((date) => {
    const timeSlots = orderedTimeSlots.map((slot, slotIndex) => ({
      key: `${sectionKey}-${date}-${formatTimeLabel(slot)}-${slotIndex}`,
      timeLabel: formatTimeLabel(slot),
      // 그룹 날짜는 범위에서 전개된 좌석 인스턴스 — 각 날짜 filled 의 유일 소스는
      // work_logs hydrate 맵(`date__slot__role`)이다. 소스 role.filled(범위 집계 dead
      // counter)를 날짜별 폴백으로 흘리면 SP3 이 제거한 과다집계가 되살아나므로,
      // filled 를 0 으로 눌러 hydrate 미적중 = 0 을 보장한다(구 sumHydrateForRange 의 miss=0 계승).
      roles: toRoleModels(
        slot.roles.map((role) => ({ ...role, filled: 0 })),
        {
          date,
          slotKey: slotMatchKey(slot),
          filledCounts,
        }
      ),
    }));

    return {
      key: `${sectionKey}-${date}`,
      date,
      label: formatDateLabel(date),
      totalCount: sumSlotCounts(timeSlots, 'count'),
      filledCount: sumSlotCounts(timeSlots, 'filled'),
      timeSlots,
    };
  });

  const dayCount = effectiveDates.length;
  // 요약 timeSlots(하루 기준·C안): 분모=하루 요구(perDayCount, 곱셈 금지), 분자=날짜별 확정의 최대값.
  // 통지원(그룹 일괄 배정) 전제에서 perDayCount − max(filled_d) 가 실제 추가 수용 인원이므로
  // max 가 유일하게 정직한 분자다(합·평균은 이 성질이 없다). 자리 총계는 section.totalCount/filledCount.
  const summaryTimeSlots: PostingTimeSlotDisplayModel[] = orderedTimeSlots.map(
    (slot, slotIndex) => {
      const timeLabel = formatTimeLabel(slot);
      return {
        key: `${sectionKey}-${timeLabel}-${slotIndex}`,
        timeLabel,
        roles: slot.roles.map((role, roleIndex) => {
          const perDayCount = role.count ?? role.headcount ?? 0;
          const filled = days.reduce(
            (max, day) => Math.max(max, day.timeSlots[slotIndex]?.roles[roleIndex]?.filled ?? 0),
            0
          );
          const base = toRoleModels([role])[0]!;
          return {
            ...base,
            count: perDayCount,
            filled,
            isFilled: perDayCount > 0 && filled >= perDayCount,
          };
        }),
      };
    }
  );

  return {
    key: sectionKey,
    label:
      dayCount <= 1
        ? formatDateLabel(group.startDate)
        : formatDateRangeWithCount(group.startDate, group.endDate),
    dayCount,
    totalCount: days.reduce((sum, day) => sum + day.totalCount, 0),
    filledCount: days.reduce((sum, day) => sum + day.filledCount, 0),
    timeSlots: summaryTimeSlots,
    days,
  };
}

function sumSlotCounts(
  timeSlots: PostingTimeSlotDisplayModel[],
  field: 'count' | 'filled'
): number {
  return timeSlots.reduce(
    (sum, slot) => sum + slot.roles.reduce((roleSum, role) => roleSum + role[field], 0),
    0
  );
}

function buildLegacyScheduleModel(
  source: PostingScheduleSource
): Extract<PostingScheduleModel, { variant: 'legacy' }> {
  const dateLabel = formatDateLabel(source.scheduleDisplay.workDate || source.workDate);
  const timeLabel = source.scheduleDisplay.timeSlot || source.timeSlot || UNKNOWN_TIME_LABEL;

  return {
    variant: 'legacy',
    dateLabel,
    timeLabel,
    isPartial: dateLabel === UNKNOWN_DATE_LABEL || timeLabel === UNKNOWN_TIME_LABEL,
  };
}

/**
 * 자리 총계(구인자 병기용) — 분자 = Σ(일별 확정), 분모 = Σ(일별 요구) = 자리 수.
 * dated 이고 다일 그룹(dayCount>1)이 있을 때만 의미가 있다(단일 날짜는 요약과 동일해 생략, 스펙 §3).
 */
export function computeSeatTotals(
  schedule: PostingScheduleModel
): { filled: number; total: number } | null {
  if (schedule.variant !== 'dated') {
    return null;
  }
  if (!schedule.sections.some((section) => section.dayCount > 1)) {
    return null;
  }
  return schedule.sections.reduce(
    (acc, section) => ({
      filled: acc.filled + section.filledCount,
      total: acc.total + section.totalCount,
    }),
    { filled: 0, total: 0 }
  );
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

type RoleHydrateCtx = { date: string; slotKey: string; filledCounts?: Map<string, number> };

function toRoleModels(
  roles: readonly RoleSource[],
  ctx?: RoleHydrateCtx
): PostingRoleDisplayModel[] {
  return roles.map((role, index) => {
    const label = getRoleDisplayName(role.role || role.name || '', role.customRole);
    const count = role.count ?? role.headcount ?? 0;
    const hydrated = ctx
      ? ctx.filledCounts?.get(`${ctx.date}__${ctx.slotKey}__${roleMatchKey(role)}`)
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
