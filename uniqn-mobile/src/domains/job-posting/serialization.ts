import type {
  CreateJobPostingInput,
  JobPosting,
  JobPostingDocumentV3,
  JobPostingStatus,
  PostingCompensation,
  PostingDateRequirement,
  PostingFixedSchedule,
  PostingLocation,
  PostingRoleCatalogEntry,
  PostingSchedule,
  PostingType,
  SalaryInfo,
  SalaryType,
  UpdateJobPostingInput,
} from '@/types/jobPosting';
import type { StaffRole } from '@/types/role';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { calculateTotalPositionsFromSchedule, normalizePostingAggregateStats } from './stats';

interface SerializeJobPostingV3Options {
  ownerId: string;
  ownerName?: string;
  status?: JobPostingStatus;
  current?: Partial<JobPosting>;
  // 문서 필드와 동일 계약 — ISO string. 쓰기 경로는 new Date().toISOString() 로 전달.
  createdAt?: string;
  updatedAt?: string;
  /**
   * 워크스페이스 ID (M3 NOT NULL 제약). 무료 공고 생성 경로는 Service 가
   * owner 의 default workspace 를 lookup 하여 주입. update 경로는 current.workspaceId 를 보존.
   */
  workspaceId?: string;
}

export const FIXED_POSTING_DURATION_DAYS = 7 as const;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * 고정 공고 만료 계약 — 신규 생성 시 fixedConfig 를 만들어 넣는다.
 *
 * 이 fallback 이 없으면 신규 고정 공고의 `fixed_config` 가 NULL 로 저장되고,
 * 자동 마감 경로가 **전부** 막힌다:
 *   - 크론 `expire-fixed-postings` / 트리거 `tr_fixed_posting_expired`
 *     → 둘 다 `(fixed_config->>'expiresAt') IS NOT NULL` 가드에서 탈락
 *   - 크론 `expire-by-last-work-date`
 *     → `posting_type IN ('regular','urgent','tournament')` 이라 fixed 는 애초에 대상 밖
 * 결과적으로 만료 시각이 없는 고정 공고는 어떤 경로로도 마감되지 않는다
 * (last_work_date writer 부재와 동일 계열 — 값을 쓰는 코드만 없었던 결함).
 *
 * urgentConfig 와 같은 형태의 fallback 이며, 기존 값이 있으면 그대로 보존한다.
 */
function buildFixedConfig(createdAtIso?: string): NonNullable<JobPostingDocumentV3['fixedConfig']> {
  const parsed = createdAtIso ? new Date(createdAtIso) : new Date();
  const createdAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  return {
    durationDays: FIXED_POSTING_DURATION_DAYS,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + FIXED_POSTING_DURATION_DAYS * DAY_IN_MS),
  };
}

export function getCanonicalPostingType(postingType?: PostingType | null): PostingType {
  return postingType ?? 'regular';
}

export function isScheduleKindCompatibleWithPostingType(
  postingType: PostingType,
  scheduleKind: PostingSchedule['kind']
): boolean {
  return postingType === 'fixed' ? scheduleKind === 'fixed' : scheduleKind === 'dated';
}

export function deriveWorkDateFieldsFromSchedule(schedule: PostingSchedule): {
  workDate: string;
  workDates?: string[];
} {
  if (schedule.kind === 'fixed') {
    return {
      workDate: '',
      workDates: undefined,
    };
  }

  return {
    workDate: schedule.primaryDate,
    workDates: schedule.allDates.length > 0 ? [...schedule.allDates] : undefined,
  };
}

function getRoleKey(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role ?? '';
}

function getRoleKeysFromCatalog(roleCatalog: PostingRoleCatalogEntry[]): string[] {
  const keys = new Set<string>();

  roleCatalog.forEach((role) => {
    const key = getRoleKey(role);
    if (key) {
      keys.add(key);
    }
  });

  return Array.from(keys);
}

/**
 * 급여 필터(P3)용 타입별 최대 급여 비정규화 — role_keys 와 동일 패턴(쓰기 시 단일 지점 계산).
 * defaultSalary + roleCatalog 전체의 급여 행을 타입별 GREATEST 집계한다(마이그레이션
 * 20260714100100 백필 SQL 과 동일 의미론 — 0 이하/비유한 값 제외, 'other'(협의)는 무시).
 * 값이 없는 타입은 null 을 명시 기록 — 편집으로 급여 타입이 사라졌을 때 UPDATE 가
 * stale 컬럼 값을 지우도록 한다(undefined 는 removeUndefined 로 탈락해 못 지움).
 */
export function getSalaryBounds(
  compensation: PostingCompensation,
  roleCatalog: PostingRoleCatalogEntry[]
): Pick<JobPostingDocumentV3, 'salaryHourlyMax' | 'salaryDailyMax' | 'salaryMonthlyMax'> {
  const maxByType: Partial<Record<SalaryType, number>> = {};

  const consider = (salary?: SalaryInfo) => {
    if (!salary) return;
    const amount = Number(salary.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rounded = Math.floor(amount);
    const current = maxByType[salary.type];
    if (current === undefined || rounded > current) {
      maxByType[salary.type] = rounded;
    }
  };

  consider(compensation.defaultSalary);
  roleCatalog.forEach((role) => consider(role.salary));

  return {
    salaryHourlyMax: maxByType.hourly ?? null,
    salaryDailyMax: maxByType.daily ?? null,
    salaryMonthlyMax: maxByType.monthly ?? null,
  };
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toCanonicalLocation(
  location: Pick<PostingLocation, 'name' | 'address' | 'district' | 'region' | 'detailedAddress'>
): JobPostingDocumentV3['location'] {
  const district =
    normalizeOptionalText(location.district) ?? normalizeOptionalText(location.address);
  const region = normalizeOptionalText(location.region);
  const detailedAddress = normalizeOptionalText(location.detailedAddress);

  return {
    name: location.name.trim(),
    ...(district ? { district } : {}),
    ...(region ? { region } : {}),
    ...(detailedAddress ? { detailedAddress } : {}),
  };
}

function normalizeRuntimeLocation(location: JobPostingDocumentV3['location']): PostingLocation {
  const district = normalizeOptionalText(location.district);
  const region = normalizeOptionalText(location.region);
  const detailedAddress = normalizeOptionalText(location.detailedAddress);

  return {
    name: location.name.trim(),
    ...(district ? { district, address: district } : {}),
    ...(region ? { region } : {}),
    ...(detailedAddress ? { detailedAddress } : {}),
  };
}

function normalizeRoleCatalog(
  roleCatalog: CreateJobPostingInput['roleCatalog']
): PostingRoleCatalogEntry[] {
  return roleCatalog.map((role) => ({
    role: role.role ?? 'dealer',
    ...(role.customRole ? { customRole: role.customRole } : {}),
    ...(role.salary ? { salary: role.salary } : {}),
  }));
}

/**
 * fixed schedule의 합성 슬롯 빌더.
 * 새 구조(requirements)와 레거시(roleRequirements) 양쪽을 모두 흡수해
 * normalizeSchedule과 deserializeJobPostingDocument 양쪽에서 공유한다.
 *
 * 목표 불변식: requirements.length===1, requirements[0].date===null,
 *              requirements[0].timeSlots.length===1, date:'' sentinel 금지.
 */
export function buildFixedSyntheticRequirement(
  schedule: Extract<CreateJobPostingInput['schedule'], { kind: 'fixed' }> | Record<string, unknown>
): PostingDateRequirement {
  const s = schedule as {
    startTime?: string;
    requirements?: PostingDateRequirement[];
    roleRequirements?: {
      id?: string;
      role?: string;
      customRole?: string;
      count: number;
    }[];
  };

  // 새 구조(requirements) 우선, 없으면 레거시(roleRequirements) 흡수
  const existingRoles = s.requirements?.[0]?.timeSlots?.[0]?.roles;
  const sourceRoles = existingRoles ?? s.roleRequirements ?? [];

  // outer schedule.startTime 우선, 없으면 inner slot startTime 으로 fallback
  // (새 구조 입력에서 outer 미지정 + inner 지정 시 시간 유실 방지)
  const innerStartTime = s.requirements?.[0]?.timeSlots?.[0]?.startTime;
  const resolvedStartTime = s.startTime ?? innerStartTime;

  return {
    date: null,
    timeSlots: [
      {
        ...(resolvedStartTime ? { startTime: resolvedStartTime } : {}),
        isTimeToBeAnnounced: false,
        roles: sourceRoles.map((role) => ({
          ...(role.id ? { id: role.id } : {}),
          // 런타임 값은 이미 StaffRole | 'other' 문자열 — 소스타입이 string|undefined라 캐스트
          ...(role.role ? { role: role.role as StaffRole | 'other' } : {}),
          ...(role.customRole ? { customRole: role.customRole } : {}),
          count: role.count,
          // dead counter `filled`(SP3 제거) — 레거시 소스에 있어도 출력으로 복사하지 않는다.
        })),
      },
    ],
  };
}

function normalizeDatedRequirements(
  requirements: PostingDateRequirement[]
): PostingDateRequirement[] {
  return requirements
    .map((requirement) => ({
      date: requirement.date,
      ...(requirement.isGrouped !== undefined ? { isGrouped: requirement.isGrouped } : {}),
      timeSlots: (requirement.timeSlots ?? []).map((slot) => ({
        ...(slot.id ? { id: slot.id } : {}),
        ...(slot.startTime ? { startTime: slot.startTime } : {}),
        ...(slot.isTimeToBeAnnounced !== undefined
          ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
          : {}),
        ...(slot.tentativeDescription ? { tentativeDescription: slot.tentativeDescription } : {}),
        roles: (slot.roles ?? []).map((role) => ({
          ...(role.id ? { id: role.id } : {}),
          ...(role.role ? { role: role.role } : {}),
          ...(role.customRole ? { customRole: role.customRole } : {}),
          count: role.count,
          // dead counter `filled`(SP3 제거) — 출력으로 복사하지 않는다.
        })),
      })),
    }))
    .filter((requirement) => requirement.date);
}

function normalizeSchedule(schedule: CreateJobPostingInput['schedule']): PostingSchedule {
  if (schedule.kind === 'fixed') {
    const fixedSchedule: PostingFixedSchedule = {
      kind: 'fixed',
      ...(schedule.daysPerWeek !== undefined ? { daysPerWeek: schedule.daysPerWeek } : {}),
      ...(schedule.startTime ? { startTime: schedule.startTime } : {}),
      ...(schedule.isStartTimeNegotiable !== undefined
        ? { isStartTimeNegotiable: schedule.isStartTimeNegotiable }
        : {}),
      requirements: [buildFixedSyntheticRequirement(schedule)],
    };

    return fixedSchedule;
  }

  const requirements = normalizeDatedRequirements(schedule.requirements ?? []);

  return {
    kind: 'dated',
    primaryDate: schedule.primaryDate || requirements[0]?.date || '',
    allDates:
      schedule.allDates && schedule.allDates.length > 0
        ? schedule.allDates
        : // dated requirement.date는 normalizeDatedRequirements filter 뒤 항상 string
          requirements.map((r) => r.date).filter((d): d is string => d !== null),
    requirements,
  };
}

function normalizeCompensation(
  compensation: CreateJobPostingInput['compensation']
): PostingCompensation {
  return {
    mode: compensation.mode,
    ...(compensation.defaultSalary ? { defaultSalary: compensation.defaultSalary } : {}),
    ...(compensation.allowances ? { allowances: compensation.allowances } : {}),
    ...(compensation.taxSettings ? { taxSettings: compensation.taxSettings } : {}),
  };
}

function buildPostingLocation(input: CreateJobPostingInput): JobPostingDocumentV3['location'] {
  return toCanonicalLocation(input.location);
}

function calculateTotalsFromSchedule(schedule: PostingSchedule): {
  totalPositions: number;
  workDate: string;
  workDates?: string[];
} {
  // filledPositions는 RPC(confirm/cancel)가 job_postings.filled_positions 컬럼에
  // 직접 쓰는 사람 단위 진실원이다. schedule의 slot-level role.filled는 dead counter이며,
  // 역할/슬롯별 (filled/count) 표시는 읽기 시 get_posting_filled_counts RPC로 hydrate한다(H0).
  // 따라서 여기서는 schedule의 role.filled를 신뢰/추론하지 않는다.
  // 신규 공고의 filledPositions는 serializeJobPostingV3에서 0으로 초기화.
  return {
    totalPositions: calculateTotalPositionsFromSchedule(schedule),
    ...deriveWorkDateFieldsFromSchedule(schedule),
  };
}

export function serializeJobPostingV3(
  input: CreateJobPostingInput,
  options: SerializeJobPostingV3Options
): JobPostingDocumentV3 {
  const current = options.current;
  const postingType = getCanonicalPostingType(input.postingType ?? current?.postingType);
  const roleCatalog = normalizeRoleCatalog(input.roleCatalog);
  const schedule = normalizeSchedule(input.schedule);
  const compensation = normalizeCompensation(input.compensation);
  const totals = calculateTotalsFromSchedule(schedule);
  // 신규 공고는 0, 편집 공고는 DB(RPC 관리)에서 온 값 그대로. schedule 추론 금지.
  const authoritativeFilledPositions = current?.filledPositions ?? 0;
  const stats = normalizePostingAggregateStats(current?.stats, schedule, {
    authoritativeFilledPositions,
  });

  // workspaceId 우선순위: options 명시 > current 보존 (update 경로 안전)
  const resolvedWorkspaceId = options.workspaceId || current?.workspaceId || undefined;

  return {
    id: current?.id || '',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: input.title.trim(),
    ...(input.description !== undefined ? { description: input.description } : {}),
    status: options.status || current?.status || 'active',
    ownerId: options.ownerId,
    ownerName: options.ownerName ?? current?.ownerName,
    ...(resolvedWorkspaceId ? { workspaceId: resolvedWorkspaceId } : {}),
    // 운영처(venue) 컨테이너 FK(주간 배치 그리드). region 유실(#194)과 동일 클래스의
    // 직렬화 경계 silent drop 을 막는다: 신규("공고 열기")는 input.venueId, 편집/정산
    // 재직렬화는 current.venueId(읽기 하이드레이션)로 보존. 일반 공고는 양쪽 모두
    // undefined → 키 자체를 생략해 venue_id 미기록(무회귀).
    ...(input.venueId !== undefined
      ? { venueId: input.venueId }
      : current?.venueId !== undefined
        ? { venueId: current.venueId }
        : {}),
    postingType,
    workDate: totals.workDate,
    ...(totals.workDates ? { workDates: totals.workDates } : {}),
    roleKeys: getRoleKeysFromCatalog(roleCatalog),
    ...getSalaryBounds(compensation, roleCatalog),
    totalPositions: totals.totalPositions,
    filledPositions: authoritativeFilledPositions,
    viewCount: current?.viewCount ?? 0,
    stats,
    createdAt: options.createdAt ?? current?.createdAt,
    updatedAt: options.updatedAt ?? current?.updatedAt,
    ...(current?.closedAt ? { closedAt: current.closedAt } : {}),
    ...(current?.closedReason ? { closedReason: current.closedReason } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
    location: buildPostingLocation(input),
    schedule,
    roleCatalog,
    compensation,
    questions: {
      items: input.questions.items ?? [],
    },
    // 모집 조건(복장·경력) — venueId 와 동일 클래스의 직렬화 경계 silent drop 방지.
    // 신규("공고 열기")는 input.conditions, 편집/정산 재직렬화는 current.conditions(읽기
    // 하이드레이션)로 보존. 양쪽 모두 undefined → 키 자체를 생략(무회귀).
    ...(input.conditions !== undefined
      ? { conditions: input.conditions }
      : current?.conditions !== undefined
        ? { conditions: current.conditions }
        : {}),
    ...(postingType === 'fixed'
      ? {
          fixedConfig: current?.fixedConfig
            ? {
                ...current.fixedConfig,
                durationDays: FIXED_POSTING_DURATION_DAYS,
              }
            : buildFixedConfig(options.createdAt),
        }
      : {}),
    ...(postingType === 'tournament' && current?.tournamentConfig
      ? { tournamentConfig: current.tournamentConfig }
      : {}),
    ...(postingType === 'urgent'
      ? {
          urgentConfig: current?.urgentConfig || {
            createdAt: new Date(),
            priority: 'high',
          },
        }
      : {}),
  };
}

export function toCreateJobPostingInput(posting: JobPosting): CreateJobPostingInput {
  return {
    postingType: posting.postingType,
    title: posting.title,
    ...(posting.description !== undefined ? { description: posting.description } : {}),
    location: toCanonicalLocation(posting.location),
    ...(posting.contactPhone ? { contactPhone: posting.contactPhone } : {}),
    ...(posting.tags ? { tags: posting.tags } : {}),
    schedule: posting.schedule,
    roleCatalog: posting.roleCatalog,
    compensation: posting.compensation,
    questions: posting.questions,
    // 수정 base — 빠지면 mergeJobPostingInput 기반 수정·정산설정 변경 1회에 conditions 소실.
    ...(posting.conditions !== undefined ? { conditions: posting.conditions } : {}),
  };
}

export function mergeJobPostingInput(
  current: JobPosting,
  patch: UpdateJobPostingInput
): CreateJobPostingInput {
  const baseInput = toCreateJobPostingInput(current);

  return {
    ...baseInput,
    ...patch,
    location: patch.location
      ? {
          ...baseInput.location,
          ...patch.location,
        }
      : baseInput.location,
    schedule: patch.schedule ?? baseInput.schedule,
    roleCatalog: patch.roleCatalog ?? baseInput.roleCatalog,
    compensation: patch.compensation ?? baseInput.compensation,
    questions: patch.questions ?? baseInput.questions,
  };
}

export function deserializeJobPostingDocument(document: JobPostingDocumentV3): JobPosting {
  const postingType = getCanonicalPostingType(document.postingType);
  const schedule =
    document.schedule.kind === 'fixed'
      ? ({
          kind: 'fixed' as const,
          ...(document.schedule.daysPerWeek !== undefined
            ? { daysPerWeek: document.schedule.daysPerWeek }
            : {}),
          ...(document.schedule.startTime ? { startTime: document.schedule.startTime } : {}),
          ...(document.schedule.isStartTimeNegotiable !== undefined
            ? { isStartTimeNegotiable: document.schedule.isStartTimeNegotiable }
            : {}),
          requirements: [
            buildFixedSyntheticRequirement(document.schedule as unknown as Record<string, unknown>),
          ],
        } satisfies PostingFixedSchedule)
      : {
          kind: 'dated' as const,
          primaryDate: document.schedule.primaryDate,
          allDates: [...document.schedule.allDates],
          requirements: document.schedule.requirements.map((requirement) => ({
            date: requirement.date,
            ...(requirement.isGrouped !== undefined ? { isGrouped: requirement.isGrouped } : {}),
            timeSlots: requirement.timeSlots.map((slot) => ({
              ...(slot.id ? { id: slot.id } : {}),
              ...(slot.startTime ? { startTime: slot.startTime } : {}),
              ...(slot.isTimeToBeAnnounced !== undefined
                ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
                : {}),
              ...(slot.tentativeDescription
                ? { tentativeDescription: slot.tentativeDescription }
                : {}),
              roles: slot.roles.map((role) => ({
                ...(role.id ? { id: role.id } : {}),
                ...(role.role ? { role: role.role } : {}),
                ...(role.customRole ? { customRole: role.customRole } : {}),
                count: role.count,
                // dead counter `filled`(SP3 제거) — 레거시 doc 에 있어도 출력으로 복사하지 않는다.
              })),
            })),
          })),
        };
  const derivedDates = deriveWorkDateFieldsFromSchedule(schedule);
  const stats = normalizePostingAggregateStats(document.stats, schedule, {
    authoritativeFilledPositions: document.filledPositions,
  });

  return {
    id: document.id,
    schemaVersion: document.schemaVersion,
    title: document.title,
    ...(document.description !== undefined ? { description: document.description } : {}),
    status: document.status,
    ownerId: document.ownerId,
    ...(document.ownerName !== undefined ? { ownerName: document.ownerName } : {}),
    ...(document.workspaceId !== undefined ? { workspaceId: document.workspaceId } : {}),
    // 읽기 하이드레이션: DB venue_id → 런타임 venueId. 미매핑 시 편집 진입(jobPostingToDraft)
    // 에서 venue 연결이 왕복 불가(#194 read 증발 동일 클래스).
    ...(document.venueId !== undefined ? { venueId: document.venueId } : {}),
    postingType,
    workDate: derivedDates.workDate,
    ...(derivedDates.workDates ? { workDates: derivedDates.workDates } : {}),
    ...(document.roleKeys ? { roleKeys: [...document.roleKeys] } : {}),
    totalPositions: document.totalPositions,
    filledPositions: stats.filledPositions,
    ...(document.viewCount !== undefined ? { viewCount: document.viewCount } : {}),
    stats,
    ...(document.createdAt !== undefined ? { createdAt: document.createdAt } : {}),
    ...(document.updatedAt !== undefined ? { updatedAt: document.updatedAt } : {}),
    ...(document.closedAt ? { closedAt: document.closedAt } : {}),
    ...(document.closedReason ? { closedReason: document.closedReason } : {}),
    ...(document.tags ? { tags: [...document.tags] } : {}),
    ...(document.contactPhone ? { contactPhone: document.contactPhone } : {}),
    location: normalizeRuntimeLocation(document.location),
    schedule,
    roleCatalog: document.roleCatalog.map((role) => ({
      role: role.role,
      ...(role.customRole ? { customRole: role.customRole } : {}),
      ...(role.salary ? { salary: { ...role.salary } } : {}),
    })),
    compensation: {
      mode: document.compensation.mode,
      ...(document.compensation.defaultSalary
        ? { defaultSalary: { ...document.compensation.defaultSalary } }
        : {}),
      ...(document.compensation.allowances
        ? { allowances: { ...document.compensation.allowances } }
        : {}),
      ...(document.compensation.taxSettings
        ? {
            taxSettings: {
              ...document.compensation.taxSettings,
              ...(document.compensation.taxSettings.taxableItems
                ? { taxableItems: { ...document.compensation.taxSettings.taxableItems } }
                : {}),
            },
          }
        : {}),
    },
    questions: {
      items: document.questions.items.map((item) => ({
        ...item,
        ...(item.options ? { options: [...item.options] } : {}),
      })),
    },
    // 읽기 하이드레이션 — 빠지면 상세·프리셋·edit 전부에서 conditions 가 항상 undefined
    // (쓰기만 되고 아무도 못 읽는 필드, #194 클래스 read 증발).
    ...(document.conditions !== undefined ? { conditions: document.conditions } : {}),
    ...(postingType === 'fixed' && document.fixedConfig
      ? {
          fixedConfig: {
            ...document.fixedConfig,
            durationDays: FIXED_POSTING_DURATION_DAYS,
          },
        }
      : {}),
    ...(postingType === 'tournament' && document.tournamentConfig
      ? {
          tournamentConfig: {
            ...document.tournamentConfig,
          },
        }
      : {}),
    ...(postingType === 'urgent' && document.urgentConfig
      ? {
          urgentConfig: {
            ...document.urgentConfig,
          },
        }
      : {}),
  };
}
