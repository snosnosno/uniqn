import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { STATUS } from '../constants/status';
import { kvDelete, kvPut } from '../utils/cloudflareKV';

const OG_RELEVANT_FIELDS = [
  'title',
  'status',
  'location',
  'workDate',
  'workDates',
  'timeSlot',
  'roles',
  'defaultSalary',
  'postingType',
  'dateSpecificRequirements',
  'daysPerWeek',
  'fixedConfig',
  'tournamentConfig',
  'urgentConfig',
  'schedule',
  'compensation',
  'roleCatalog',
  'roleKeys',
] as const;

const SALARY_TYPE_LABELS: Record<string, string> = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '급여',
};

const ROLE_LABELS: Record<string, string> = {
  dealer: '딜러',
  floor: '플로어',
  serving: '서빙',
  manager: '매니저',
  chiprunner: '칩러너',
  supervisor: '슈퍼바이저',
  staff: '스태프',
  other: '기타',
};

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEB_DOMAIN = 'https://uniqn.app';
const OG_DEFAULT_IMAGE = `${WEB_DOMAIN}/og-default.png`;

type OGSalary = {
  type?: string;
  amount?: number;
};

type OGRole = {
  role?: string;
  customRole?: string;
  count?: number;
};

type OGDateRequirement = {
  date?: string;
  startTime?: string;
  endTime?: string;
};

type OGLocation = {
  name?: string;
  district?: string;
  region?: string;
};

type OGRoleCatalogEntry = {
  role?: string;
  customRole?: string;
  salary?: OGSalary;
};

type OGScheduleSlotRole = {
  role?: string;
  customRole?: string;
  count?: number;
  filled?: number;
};

type OGScheduleTimeSlot = {
  startTime?: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles?: OGScheduleSlotRole[];
};

type OGScheduleRequirement = {
  date?: string;
  timeSlots?: OGScheduleTimeSlot[];
  isGrouped?: boolean;
};

type OGSchedule = {
  kind?: 'dated' | 'fixed';
  primaryDate?: string;
  allDates?: string[];
  requirements?: OGScheduleRequirement[];
  daysPerWeek?: number;
  startTime?: string;
  isStartTimeNegotiable?: boolean;
  roleRequirements?: OGRole[];
};

type OGCompensation = {
  defaultSalary?: OGSalary;
};

type JobPostingOGData = Record<string, unknown> & {
  title?: string;
  status?: string;
  location?: OGLocation | string;
  workDate?: string;
  timeSlot?: string;
  roles?: OGRole[];
  defaultSalary?: OGSalary;
  postingType?: string;
  dateSpecificRequirements?: OGDateRequirement[];
  schedule?: OGSchedule;
  compensation?: OGCompensation;
  roleCatalog?: OGRoleCatalogEntry[];
  fixedConfig?: {
    daysPerWeek?: number;
  };
  daysPerWeek?: number;
};

function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(`${dateStr}T00:00:00+09:00`);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = WEEKDAYS_KO[date.getDay()] ?? '';
    return `${month}/${day}(${weekday})`;
  } catch {
    return dateStr;
  }
}

function getRoleLabel(role?: string, customRole?: string): string {
  if (role === 'other' && customRole) {
    return customRole;
  }

  return ROLE_LABELS[role ?? 'other'] ?? customRole ?? role ?? '';
}

function mergeRoles(roles: OGRole[]): OGRole[] {
  const merged = new Map<string, OGRole>();

  roles.forEach((role) => {
    const key = `${role.role ?? 'other'}:${role.customRole ?? ''}`;
    const nextCount = role.count ?? 0;
    const existing = merged.get(key);

    if (existing) {
      existing.count = (existing.count ?? 0) + nextCount;
      return;
    }

    merged.set(key, {
      role: role.role,
      customRole: role.customRole,
      count: role.count,
    });
  });

  return Array.from(merged.values());
}

function getDefaultSalary(data: JobPostingOGData): OGSalary | undefined {
  return data.compensation?.defaultSalary ?? data.defaultSalary;
}

export function formatOGSalary(salary?: OGSalary): string {
  if (!salary?.amount) return '급여 협의';
  const salaryType = salary.type ?? 'other';
  const typeLabel = SALARY_TYPE_LABELS[salaryType] ?? salaryType;
  return `${typeLabel} ${salary.amount.toLocaleString('ko-KR')}원`;
}

function formatTimeText(options: {
  startTime?: string;
  endTime?: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
}): string {
  if (options.tentativeDescription) {
    return options.tentativeDescription;
  }

  if (options.isTimeToBeAnnounced) {
    return '미정';
  }

  if (options.startTime && options.endTime) {
    return `${options.startTime}~${options.endTime}`;
  }

  return options.startTime ?? '';
}

function formatV3DatedSchedule(schedule?: OGSchedule): string {
  if (schedule?.kind !== 'dated') {
    return '';
  }

  const requirements = schedule.requirements ?? [];
  if (requirements.length === 0) {
    return schedule.primaryDate ? formatShortDate(schedule.primaryDate) : '';
  }

  const firstRequirement = requirements[0];
  if (!firstRequirement?.date) {
    return schedule.primaryDate ? formatShortDate(schedule.primaryDate) : '';
  }

  const firstSlot = firstRequirement.timeSlots?.[0];
  const dateText = formatShortDate(firstRequirement.date);
  const timeText = formatTimeText({
    startTime: firstSlot?.startTime,
    isTimeToBeAnnounced: firstSlot?.isTimeToBeAnnounced,
    tentativeDescription: firstSlot?.tentativeDescription,
  });

  if (requirements.length > 1) {
    const extraDateCount = requirements.length - 1;
    return timeText
      ? `${dateText} ${timeText} 외 ${extraDateCount}일`
      : `${dateText} 외 ${extraDateCount}일`;
  }

  return timeText ? `${dateText} ${timeText}` : dateText;
}

export function formatOGSchedule(data: JobPostingOGData): string {
  const v3Schedule = formatV3DatedSchedule(data.schedule);
  if (v3Schedule) {
    return v3Schedule;
  }

  const requirements = data.dateSpecificRequirements;
  if (requirements && requirements.length > 0) {
    const first = requirements[0];
    if (!first?.date) return '';

    const dateText = formatShortDate(first.date);
    const timeText = formatTimeText({
      startTime: first.startTime,
      endTime: first.endTime,
    });

    if (requirements.length > 1) {
      const extraCount = requirements.length - 1;
      return timeText ? `${dateText} ${timeText} 외 ${extraCount}일` : `${dateText} 외 ${extraCount}일`;
    }

    return timeText ? `${dateText} ${timeText}` : dateText;
  }

  if (data.workDate && data.timeSlot) {
    const timeSlot = data.timeSlot.replace(' - ', '~').replace(' ~ ', '~');
    return `${formatShortDate(data.workDate)} ${timeSlot}`;
  }

  if (data.workDate) {
    return formatShortDate(data.workDate);
  }

  return '';
}

function extractRolesFromSchedule(schedule?: OGSchedule): OGRole[] {
  if (!schedule) {
    return [];
  }

  if (schedule.kind === 'fixed') {
    return mergeRoles(schedule.roleRequirements ?? []);
  }

  return mergeRoles(
    (schedule.requirements ?? []).flatMap((requirement) =>
      (requirement.timeSlots ?? []).flatMap((slot) =>
        (slot.roles ?? []).map((role) => ({
          role: role.role,
          customRole: role.customRole,
          count: role.count,
        }))
      )
    )
  );
}

function extractRoles(data: JobPostingOGData): OGRole[] {
  const scheduleRoles = extractRolesFromSchedule(data.schedule);
  if (scheduleRoles.length > 0) {
    return scheduleRoles;
  }

  if (data.roles && data.roles.length > 0) {
    return mergeRoles(data.roles);
  }

  if (data.roleCatalog && data.roleCatalog.length > 0) {
    return mergeRoles(
      data.roleCatalog.map((role) => ({
        role: role.role,
        customRole: role.customRole,
      }))
    );
  }

  return [];
}

export function formatOGRoles(roles?: OGRole[]): string {
  if (!roles?.length) return '';

  return roles
    .map((role) => {
      const label = getRoleLabel(role.role, role.customRole);
      if (!label) {
        return '';
      }

      const count = role.count ?? 0;
      return count > 0 ? `${label} ${count}명` : label;
    })
    .filter(Boolean)
    .join(', ');
}

function formatFixedSchedule(data: JobPostingOGData): string {
  if (data.schedule?.kind === 'fixed') {
    const parts: string[] = [];

    if (typeof data.schedule.daysPerWeek === 'number') {
      parts.push(`주 ${data.schedule.daysPerWeek}일`);
    }

    const timeText = data.schedule.startTime
      ? data.schedule.startTime
      : data.schedule.isStartTimeNegotiable
        ? '시간 협의'
        : '';

    if (timeText) {
      parts.push(timeText);
    }

    return parts.join(' ');
  }

  const daysPerWeek =
    typeof data.daysPerWeek === 'number' ? data.daysPerWeek : data.fixedConfig?.daysPerWeek;

  return daysPerWeek ? `주 ${daysPerWeek}일` : '';
}

export function buildOGDescription(data: JobPostingOGData): string {
  const postingType = data.postingType ?? 'regular';
  const parts: string[] = [];

  if (postingType === 'tournament') {
    parts.push('대회');
  } else {
    parts.push(formatOGSalary(getDefaultSalary(data)));
  }

  if (postingType === 'fixed') {
    const fixedSchedule = formatFixedSchedule(data);
    if (fixedSchedule) {
      parts.push(fixedSchedule);
    }
  } else {
    const schedule = formatOGSchedule(data);
    if (schedule) {
      parts.push(schedule);
    }
  }

  const roles = formatOGRoles(extractRoles(data));
  if (roles) {
    parts.push(roles);
  }

  return parts.join(' · ');
}

function getLocationName(location?: OGLocation | string): string {
  if (!location) return '';
  if (typeof location === 'string') return location;
  return location.name ?? location.district ?? location.region ?? '';
}

export function buildOGTitle(data: JobPostingOGData): string {
  const locationName = getLocationName(data.location);
  const title = data.title ?? '';

  if (locationName) {
    return `[${locationName}] ${title}`;
  }

  return title || 'UNIQN 공고';
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  return `{${sortedKeys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function hasOGRelevantChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): boolean {
  return OG_RELEVANT_FIELDS.some(
    (field) => stableStringify(before[field]) !== stableStringify(after[field])
  );
}

export const onJobPostingOGSync = onDocumentWritten(
  { document: 'jobPostings/{jobId}', region: 'asia-northeast3' },
  async (event) => {
    const jobId = event.params.jobId;
    const after = event.data?.after?.exists ? (event.data.after.data() as JobPostingOGData) : null;
    const before = event.data?.before?.exists
      ? (event.data.before.data() as JobPostingOGData)
      : null;

    if (before && after && !hasOGRelevantChange(before, after)) {
      return;
    }

    try {
      const kvKey = `og:jobs:${jobId}`;

      if (!after) {
        logger.info('Deleting OG KV for removed job posting', { jobId });
        await kvDelete(kvKey);
        return;
      }

      if (after.status !== STATUS.JOB_POSTING.ACTIVE) {
        if (before?.status === STATUS.JOB_POSTING.ACTIVE) {
          logger.info('Deleting OG KV for inactive job posting', {
            jobId,
            status: after.status,
          });
          await kvDelete(kvKey);
        }
        return;
      }

      const ogData = {
        title: buildOGTitle(after),
        description: buildOGDescription(after),
        url: `${WEB_DOMAIN}/jobs/${jobId}`,
        image: OG_DEFAULT_IMAGE,
      };

      logger.info('Syncing OG data to Cloudflare KV', { jobId, ogData });
      await kvPut(kvKey, ogData);
    } catch (error) {
      logger.error('Failed to sync OG data to Cloudflare KV', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
);
