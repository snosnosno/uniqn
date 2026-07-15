import { STAFF_ROLES } from '@/constants';
import type {
  CreateJobPostingInput,
  FormRoleWithCount,
  JobPosting,
  JobPostingFormData,
  PostingRoleCatalogEntry,
  UpdateJobPostingInput,
} from '@/types';
import type {
  PostingDateRequirement,
  PostingSlotRoleRequirement,
  PostingTimeSlot,
} from '@/types/jobPosting';
import type { JobPostingDraft, JobPostingDraftDatedSchedule } from '@/types/jobPostingDraft';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { DateSpecificRequirement, TimeSlot } from '@/types/jobPosting/dateRequirement';
import { toDateString } from '@/utils/date';
import { buildSeedTimeSlots } from './draftRoles';

function findRoleOptionByName(name: string) {
  return STAFF_ROLES.find((role) => role.name === name);
}

function getRoleKey(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role ?? '';
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getFormDetailedAddress(formData: JobPostingFormData): string | undefined {
  return normalizeOptionalText(formData.location?.detailedAddress ?? formData.detailedAddress);
}

/**
 * venue_id 전수배선 가드 — region 유실 함정(#194, `hasRegionField`) 패턴 재사용.
 * 소스에 `venueId` own-property 가 있을 때만 매핑한다. 없으면 키 자체를 생략해
 * 일반 공고(운영처 미연결) lifecycle 을 불변으로 유지하고, update 경로에서
 * 기존 venue_id 를 clobber 하지 않는다.
 */
function hasVenueIdField(source: { venueId?: string }): boolean {
  return Object.prototype.hasOwnProperty.call(source, 'venueId');
}

function toCanonicalPostingLocation(
  location: JobPostingFormData['location'] | JobPostingDraft['location'] | JobPosting['location']
) {
  if (!location) {
    return null;
  }

  const district = location.district ?? location.address;
  const region = location.region;
  const detailedAddress = location.detailedAddress;

  return {
    name: location.name,
    ...(district !== undefined ? { district } : {}),
    ...(region !== undefined ? { region } : {}),
    ...(detailedAddress !== undefined ? { detailedAddress } : {}),
  };
}

function toCreateInputLocation(
  location: JobPostingDraft['location'] | JobPosting['location']
): CreateJobPostingInput['location'] | null {
  if (!location) {
    return null;
  }

  const district = normalizeOptionalText(location.district ?? location.address);
  const region = normalizeOptionalText(location.region);
  const detailedAddress = normalizeOptionalText(location.detailedAddress);

  return {
    name: location.name.trim(),
    ...(district ? { district } : {}),
    ...(region ? { region } : {}),
    ...(detailedAddress ? { detailedAddress } : {}),
  };
}

function toUpdateInputLocation(
  location: JobPostingDraft['location']
): UpdateJobPostingInput['location'] {
  if (!location) {
    return undefined;
  }

  const district = normalizeOptionalText(location.district ?? location.address);
  const region = normalizeOptionalText(location.region);
  const detailedAddress = normalizeOptionalText(location.detailedAddress);
  const hasDistrictField =
    Object.prototype.hasOwnProperty.call(location, 'district') ||
    Object.prototype.hasOwnProperty.call(location, 'address');
  const hasRegionField = Object.prototype.hasOwnProperty.call(location, 'region');
  const hasDetailedAddressField = Object.prototype.hasOwnProperty.call(location, 'detailedAddress');

  return {
    name: location.name.trim(),
    ...(hasDistrictField ? { district } : {}),
    ...(hasRegionField ? { region } : {}),
    ...(hasDetailedAddressField ? { detailedAddress } : {}),
  };
}

function toFormLocation(
  location: JobPostingDraft['location'] | JobPosting['location']
): JobPostingFormData['location'] {
  if (!location) {
    return null;
  }

  return {
    ...location,
    ...((location.address ?? location.district)
      ? { address: location.address ?? location.district }
      : {}),
  };
}

function toCatalogEntry(role: FormRoleWithCount): PostingRoleCatalogEntry {
  const matchedRole = findRoleOptionByName(role.name);

  if (!matchedRole || role.isCustom || matchedRole.key === 'other') {
    return {
      role: 'other',
      customRole: role.name.trim(),
      ...(role.salary ? { salary: role.salary } : {}),
    };
  }

  return {
    role: matchedRole.key,
    ...(role.salary ? { salary: role.salary } : {}),
  };
}

function dedupeRoleCatalog(entries: PostingRoleCatalogEntry[]): PostingRoleCatalogEntry[] {
  const deduped = new Map<string, PostingRoleCatalogEntry>();

  entries.forEach((entry) => {
    if (!getRoleKey(entry)) {
      return;
    }

    const current = deduped.get(getRoleKey(entry));
    deduped.set(getRoleKey(entry), {
      ...current,
      ...entry,
      salary: entry.salary ?? current?.salary,
    });
  });

  return Array.from(deduped.values());
}

function toCanonicalSlotRole(role: {
  id?: string;
  role?: string;
  customRole?: string;
  headcount?: number;
}): PostingSlotRoleRequirement {
  return {
    ...(role.id ? { id: role.id } : {}),
    role: (role.role as PostingSlotRoleRequirement['role']) ?? 'dealer',
    ...(role.customRole ? { customRole: role.customRole } : {}),
    count: Math.max(1, role.headcount ?? 1),
    // dead counter `filled`(SP3 제거) — canonical slot role 로 복사하지 않는다.
  };
}

function toCanonicalTimeSlot(slot: TimeSlot): PostingTimeSlot {
  return {
    ...(slot.id ? { id: slot.id } : {}),
    ...(slot.startTime ? { startTime: slot.startTime } : {}),
    ...(slot.isTimeToBeAnnounced !== undefined
      ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
      : {}),
    ...(slot.tentativeDescription ? { tentativeDescription: slot.tentativeDescription } : {}),
    roles: (slot.roles ?? []).map(toCanonicalSlotRole),
  };
}

function toLegacyTimeSlotRole(
  role: PostingSlotRoleRequirement,
  roleCatalog: PostingRoleCatalogEntry[]
) {
  return {
    ...(role.id ? { id: role.id } : {}),
    role: role.role,
    ...(role.customRole ? { customRole: role.customRole } : {}),
    headcount: role.count,
    salary: roleCatalog.find((entry) => getRoleKey(entry) === getRoleKey(role))?.salary,
    // dead counter `filled`(SP3 제거) — 레거시 슬롯 타입은 항상 0(미사용 카운터).
    filled: 0,
  };
}

function toLegacyTimeSlot(slot: PostingTimeSlot, roleCatalog: PostingRoleCatalogEntry[]): TimeSlot {
  return {
    ...(slot.id ? { id: slot.id } : {}),
    ...(slot.startTime ? { startTime: slot.startTime } : {}),
    ...(slot.isTimeToBeAnnounced !== undefined
      ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
      : {}),
    ...(slot.tentativeDescription ? { tentativeDescription: slot.tentativeDescription } : {}),
    roles: (slot.roles ?? []).map((role) => toLegacyTimeSlotRole(role, roleCatalog)),
  };
}

function extractTemplateTimeSlots(formData: JobPostingFormData): PostingTimeSlot[] {
  const seedTimeSlots = buildSeedTimeSlots(formData);
  return seedTimeSlots.map(toCanonicalTimeSlot);
}

function buildRoleCatalogFromFormData(formData: JobPostingFormData): PostingRoleCatalogEntry[] {
  const roleEntries = (formData.roles ?? []).map(toCatalogEntry);
  const slotEntries =
    formData.dateSpecificRequirements?.flatMap((requirement) =>
      requirement.timeSlots.flatMap((slot) =>
        slot.roles.map((role) => ({
          role: (role.role as PostingRoleCatalogEntry['role']) ?? 'dealer',
          ...(role.customRole ? { customRole: role.customRole } : {}),
          ...(role.salary ? { salary: role.salary } : {}),
        }))
      )
    ) ?? [];

  const catalog = dedupeRoleCatalog([...slotEntries, ...roleEntries]);

  if (formData.useSameSalary) {
    const sharedSalary =
      formData.defaultSalary ?? formData.roles?.find((role) => role.salary)?.salary;

    if (sharedSalary) {
      return catalog.map((entry) => ({
        ...entry,
        salary: sharedSalary,
      }));
    }
  }

  return catalog;
}

function buildCompensation(formData: JobPostingFormData): CreateJobPostingInput['compensation'] {
  const firstRoleWithSalary = formData.roles.find((role) => role.salary);
  const defaultSalary =
    formData.useSameSalary && firstRoleWithSalary?.salary
      ? firstRoleWithSalary.salary
      : formData.defaultSalary;

  return {
    mode: formData.useSameSalary ? 'shared' : 'by_role',
    ...(defaultSalary ? { defaultSalary } : {}),
    ...(formData.allowances ? { allowances: formData.allowances } : {}),
    ...(formData.taxSettings ? { taxSettings: formData.taxSettings } : {}),
  };
}

function getPrimaryWorkDate(dateSpecificRequirements?: DateSpecificRequirement[]): string {
  const requirement = dateSpecificRequirements?.find((candidate) => {
    return toDateString(candidate.date).length > 0;
  });

  return requirement ? toDateString(requirement.date) : '';
}

function buildDatedDraft(formData: JobPostingFormData): JobPostingDraftDatedSchedule {
  const requirements = (formData.dateSpecificRequirements ?? [])
    .map((requirement) => ({
      date: toDateString(requirement.date),
      ...(requirement.isGrouped !== undefined ? { isGrouped: requirement.isGrouped } : {}),
      timeSlots: (requirement.timeSlots ?? []).map(toCanonicalTimeSlot),
    }))
    .filter((requirement) => requirement.date);

  return {
    kind: 'dated',
    primaryDate: getPrimaryWorkDate(formData.dateSpecificRequirements) || formData.workDate,
    allDates: requirements.map((requirement) => requirement.date),
    requirements,
    templateTimeSlots: extractTemplateTimeSlots(formData),
  };
}

export function buildFixedSyntheticRequirement(
  roles: PostingSlotRoleRequirement[],
  startTime?: string
): PostingDateRequirement {
  return {
    date: null,
    timeSlots: [
      {
        ...(startTime ? { startTime } : {}),
        isTimeToBeAnnounced: false,
        roles,
      },
    ],
  };
}

function buildFixedDraft(
  formData: JobPostingFormData
): Extract<JobPostingDraft['schedule'], { kind: 'fixed' }> {
  const roles: PostingSlotRoleRequirement[] = (formData.roles ?? []).map((role) => {
    const catalogEntry = toCatalogEntry(role);

    return {
      role: catalogEntry.role,
      ...(catalogEntry.customRole ? { customRole: catalogEntry.customRole } : {}),
      count: role.count,
    };
  });

  return {
    kind: 'fixed',
    daysPerWeek: formData.daysPerWeek,
    ...(formData.startTime ? { startTime: formData.startTime } : {}),
    ...(formData.isStartTimeNegotiable !== undefined
      ? { isStartTimeNegotiable: formData.isStartTimeNegotiable }
      : {}),
    requirements: [buildFixedSyntheticRequirement(roles, formData.startTime)],
  };
}

export function formDataToDraft(formData: JobPostingFormData): JobPostingDraft {
  const roleCatalog = buildRoleCatalogFromFormData(formData);
  const detailedAddress = getFormDetailedAddress(formData);

  return {
    postingType: formData.postingType,
    title: formData.title,
    description: formData.description,
    location: (() => {
      const canonicalLocation = toCanonicalPostingLocation(formData.location);

      if (!canonicalLocation) {
        return null;
      }

      return {
        ...canonicalLocation,
        ...(detailedAddress ? { detailedAddress } : {}),
      };
    })(),
    ...(hasVenueIdField(formData) ? { venueId: formData.venueId } : {}),
    contactPhone: formData.contactPhone,
    tags: formData.tags,
    schedule:
      formData.postingType === 'fixed' ? buildFixedDraft(formData) : buildDatedDraft(formData),
    roleCatalog,
    compensation: buildCompensation(formData),
    questions: {
      items: formData.usesPreQuestions ? formData.preQuestions : [],
    },
  };
}

function toFormRole(role: PostingRoleCatalogEntry, count: number): FormRoleWithCount {
  const matchedRole = STAFF_ROLES.find((candidate) => candidate.key === role.role);
  const isCustom = role.role === 'other';

  return {
    name: isCustom ? role.customRole || '' : matchedRole?.name || role.role,
    count,
    isCustom,
    ...(role.salary ? { salary: role.salary } : {}),
  };
}

function buildFixedFormRoles(draft: JobPostingDraft): FormRoleWithCount[] {
  if (draft.schedule.kind !== 'fixed') {
    return [];
  }

  const roles = draft.schedule.requirements[0]?.timeSlots[0]?.roles ?? [];

  return roles.map((requirement) => {
    const catalogEntry = draft.roleCatalog.find(
      (entry) => getRoleKey(entry) === getRoleKey(requirement)
    ) ?? {
      role: requirement.role ?? 'dealer',
      ...(requirement.customRole ? { customRole: requirement.customRole } : {}),
    };

    return toFormRole(catalogEntry, requirement.count);
  });
}

function buildDatedFormRoles(draft: JobPostingDraft): FormRoleWithCount[] {
  if (draft.schedule.kind !== 'dated') {
    return [];
  }

  const seedRequirement = draft.schedule.requirements.find(
    (requirement) => requirement.timeSlots.length > 0
  );
  const sourceSlots = seedRequirement?.timeSlots ?? draft.schedule.templateTimeSlots;

  const totals = new Map<string, { role: PostingRoleCatalogEntry; count: number }>();

  const collectFromSlots = (slots: PostingTimeSlot[], addToExisting: boolean) => {
    slots.forEach((slot) => {
      slot.roles.forEach((role) => {
        const key = getRoleKey(role);
        const catalogRole = draft.roleCatalog.find((entry) => getRoleKey(entry) === key) ?? {
          role: role.role ?? 'dealer',
          ...(role.customRole ? { customRole: role.customRole } : {}),
        };
        const existing = totals.get(key);

        if (existing) {
          if (addToExisting) {
            existing.count += role.count;
          }
          return;
        }

        totals.set(key, {
          role: catalogRole,
          count: role.count,
        });
      });
    });
  };

  collectFromSlots(sourceSlots, true);

  draft.schedule.requirements.forEach((requirement) => {
    if (requirement === seedRequirement) {
      return;
    }
    collectFromSlots(requirement.timeSlots, false);
  });

  return Array.from(totals.values()).map((entry) => toFormRole(entry.role, entry.count));
}

export function draftToFormData(draft: JobPostingDraft): JobPostingFormData {
  const roles =
    draft.schedule.kind === 'fixed' ? buildFixedFormRoles(draft) : buildDatedFormRoles(draft);
  const firstSalary = draft.roleCatalog.find((role) => role.salary)?.salary;

  return {
    ...INITIAL_JOB_POSTING_FORM_DATA,
    postingType: draft.postingType,
    title: draft.title,
    location: toFormLocation(draft.location),
    detailedAddress: draft.location?.detailedAddress ?? '',
    contactPhone: draft.contactPhone,
    description: draft.description,
    workDate: draft.schedule.kind === 'dated' ? draft.schedule.primaryDate : '',
    startTime: draft.schedule.kind === 'fixed' ? (draft.schedule.startTime ?? '') : '',
    isStartTimeNegotiable:
      draft.schedule.kind === 'fixed' ? (draft.schedule.isStartTimeNegotiable ?? false) : false,
    dateSpecificRequirements:
      draft.schedule.kind === 'dated'
        ? draft.schedule.requirements.map((requirement) => ({
            // kind==='dated' 분기 — dated requirement.date는 항상 string (fixed만 null)
            date: requirement.date ?? '',
            isGrouped: requirement.isGrouped,
            timeSlots: requirement.timeSlots.map((slot) =>
              toLegacyTimeSlot(slot, draft.roleCatalog)
            ),
          }))
        : [],
    datedTemplateTimeSlots:
      draft.schedule.kind === 'dated'
        ? draft.schedule.templateTimeSlots.map((slot) => toLegacyTimeSlot(slot, draft.roleCatalog))
        : [],
    daysPerWeek: draft.schedule.kind === 'fixed' ? (draft.schedule.daysPerWeek ?? 0) : 0,
    roles: roles.length > 0 ? roles : [...INITIAL_JOB_POSTING_FORM_DATA.roles],
    defaultSalary: draft.compensation.defaultSalary ?? firstSalary,
    allowances: draft.compensation.allowances ?? {},
    useSameSalary: draft.compensation.mode === 'shared',
    taxSettings: draft.compensation.taxSettings,
    usesPreQuestions: (draft.questions.items ?? []).length > 0,
    preQuestions: draft.questions.items ?? [],
    tags: draft.tags ?? [],
    ...(hasVenueIdField(draft) ? { venueId: draft.venueId } : {}),
  };
}

export function applyFormDataPatch(
  draft: JobPostingDraft,
  patch: Partial<JobPostingFormData>
): JobPostingDraft {
  const nextFormData = {
    ...draftToFormData(draft),
    ...patch,
  };

  return formDataToDraft(nextFormData);
}

export function draftToCreateJobPostingInput(draft: JobPostingDraft): CreateJobPostingInput {
  const location = toCreateInputLocation(draft.location);

  return {
    postingType: draft.postingType,
    title: draft.title,
    ...(normalizeOptionalText(draft.description)
      ? { description: normalizeOptionalText(draft.description) }
      : {}),
    location: location!,
    ...(normalizeOptionalText(draft.contactPhone)
      ? { contactPhone: normalizeOptionalText(draft.contactPhone) }
      : {}),
    ...(hasVenueIdField(draft) ? { venueId: draft.venueId } : {}),
    tags: draft.tags,
    schedule:
      draft.schedule.kind === 'fixed'
        ? {
            kind: 'fixed',
            daysPerWeek: draft.schedule.daysPerWeek,
            ...(draft.schedule.startTime ? { startTime: draft.schedule.startTime } : {}),
            ...(draft.schedule.isStartTimeNegotiable !== undefined
              ? { isStartTimeNegotiable: draft.schedule.isStartTimeNegotiable }
              : {}),
            requirements: draft.schedule.requirements.map((requirement) => ({
              date: null,
              timeSlots: requirement.timeSlots.map((slot) => ({
                ...(slot.startTime ? { startTime: slot.startTime } : {}),
                isTimeToBeAnnounced: false,
                roles: slot.roles.map((role) => ({
                  ...(role.id ? { id: role.id } : {}),
                  role: role.role ?? 'dealer',
                  ...(role.customRole ? { customRole: role.customRole } : {}),
                  count: role.count,
                  // dead counter `filled`(SP3 제거) — 복사하지 않는다.
                })),
              })),
            })),
          }
        : {
            kind: 'dated',
            primaryDate: draft.schedule.primaryDate,
            // kind==='dated' 분기 — dated requirement.date는 항상 string (fixed만 null)
            allDates: draft.schedule.requirements
              .map((r) => r.date)
              .filter((d): d is string => d !== null),
            requirements: draft.schedule.requirements.map((requirement) => ({
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
                  role: role.role ?? 'dealer',
                  ...(role.customRole ? { customRole: role.customRole } : {}),
                  count: role.count,
                  // dead counter `filled`(SP3 제거) — 복사하지 않는다.
                })),
              })),
            })),
          },
    roleCatalog: draft.roleCatalog,
    compensation: draft.compensation,
    questions: draft.questions,
    ...(draft.conditions !== undefined ? { conditions: draft.conditions } : {}),
  };
}

export function draftToUpdateJobPostingInput(
  draft: JobPostingDraft,
  options?: { hasConfirmedApplicants?: boolean }
): UpdateJobPostingInput {
  const canonicalInput = draftToCreateJobPostingInput(draft);
  const hasConfirmedApplicants = options?.hasConfirmedApplicants ?? false;
  // venue_id 는 운영처 연결(구조 메타)이라 confirmed 여부와 무관하게 보존한다.
  // 가드로 draft 에 venueId 가 없으면 키를 생략해 일반 공고 update payload 를 불변 유지.
  const venueIdPatch = hasVenueIdField(draft) ? { venueId: draft.venueId } : {};
  const updateInput: UpdateJobPostingInput = {
    postingType: canonicalInput.postingType,
    title: canonicalInput.title,
    description: normalizeOptionalText(draft.description),
    location: toUpdateInputLocation(draft.location),
    contactPhone: normalizeOptionalText(draft.contactPhone),
    ...venueIdPatch,
    tags: canonicalInput.tags,
    compensation: canonicalInput.compensation,
    questions: canonicalInput.questions,
    schedule: canonicalInput.schedule,
    roleCatalog: canonicalInput.roleCatalog,
    // 모집 조건 보존 — hasConfirmedApplicants 제한 분기에는 넣지 않는다. serialize 의
    // current-폴백이 DB 값에서 conditions 를 보존하므로 1번째 조립부만으로 계약이 성립.
    ...(draft.conditions !== undefined ? { conditions: draft.conditions } : {}),
  };

  if (hasConfirmedApplicants) {
    return {
      postingType: updateInput.postingType,
      title: updateInput.title,
      description: updateInput.description,
      location: updateInput.location,
      contactPhone: updateInput.contactPhone,
      ...venueIdPatch,
      tags: updateInput.tags,
      compensation: updateInput.compensation,
      questions: updateInput.questions,
      roleCatalog: updateInput.roleCatalog,
    };
  }

  return updateInput;
}

function buildFixedDraftFromPosting(
  posting: JobPosting
): Extract<JobPostingDraft['schedule'], { kind: 'fixed' }> {
  const fixedSchedule = posting.schedule.kind === 'fixed' ? posting.schedule : undefined;
  const roles = fixedSchedule?.requirements[0]?.timeSlots[0]?.roles ?? [];

  return {
    kind: 'fixed',
    daysPerWeek: fixedSchedule?.daysPerWeek,
    ...(fixedSchedule?.startTime ? { startTime: fixedSchedule.startTime } : {}),
    ...(fixedSchedule?.isStartTimeNegotiable !== undefined
      ? { isStartTimeNegotiable: fixedSchedule.isStartTimeNegotiable }
      : {}),
    requirements: [
      {
        date: null,
        timeSlots: [
          {
            ...(fixedSchedule?.startTime ? { startTime: fixedSchedule.startTime } : {}),
            isTimeToBeAnnounced: false,
            roles: roles.map((role) => ({
              ...(role.id ? { id: role.id } : {}),
              role: role.role ?? 'dealer',
              ...(role.customRole ? { customRole: role.customRole } : {}),
              count: role.count,
              // dead counter `filled`(SP3 제거) — 복사하지 않는다.
            })),
          },
        ],
      },
    ],
  };
}

function buildDatedDraftFromPosting(posting: JobPosting): JobPostingDraftDatedSchedule {
  const requirements = posting.schedule.kind === 'dated' ? posting.schedule.requirements : [];
  const templateTimeSlots =
    requirements[0]?.timeSlots.map((slot) => ({
      ...(slot.id ? { id: slot.id } : {}),
      ...(slot.startTime ? { startTime: slot.startTime } : {}),
      ...(slot.isTimeToBeAnnounced !== undefined
        ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
        : {}),
      ...(slot.tentativeDescription ? { tentativeDescription: slot.tentativeDescription } : {}),
      roles: slot.roles.map((role) => ({
        ...(role.id ? { id: role.id } : {}),
        role: role.role,
        ...(role.customRole ? { customRole: role.customRole } : {}),
        count: role.count,
        // dead counter `filled`(SP3 제거) — 복사하지 않는다.
      })),
    })) ??
    (INITIAL_JOB_POSTING_DRAFT.schedule.kind === 'dated'
      ? INITIAL_JOB_POSTING_DRAFT.schedule.templateTimeSlots
      : []);

  return {
    kind: 'dated',
    primaryDate: posting.workDate,
    // dated posting.schedule.requirements.date는 항상 string (fixed만 null)
    allDates: requirements.map((r) => r.date).filter((d): d is string => d !== null),
    requirements: requirements.map((requirement) => ({
      date: requirement.date,
      ...(requirement.isGrouped !== undefined ? { isGrouped: requirement.isGrouped } : {}),
      timeSlots: requirement.timeSlots.map((slot) => ({
        ...(slot.id ? { id: slot.id } : {}),
        ...(slot.startTime ? { startTime: slot.startTime } : {}),
        ...(slot.isTimeToBeAnnounced !== undefined
          ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
          : {}),
        ...(slot.tentativeDescription ? { tentativeDescription: slot.tentativeDescription } : {}),
        roles: slot.roles.map((role) => ({
          ...(role.id ? { id: role.id } : {}),
          role: role.role,
          ...(role.customRole ? { customRole: role.customRole } : {}),
          count: role.count,
          // dead counter `filled`(SP3 제거) — 복사하지 않는다.
        })),
      })),
    })),
    templateTimeSlots,
  };
}

export function jobPostingToDraft(posting: JobPosting): JobPostingDraft {
  return {
    postingType: posting.postingType ?? 'regular',
    title: posting.title,
    description: posting.description ?? '',
    location: toCanonicalPostingLocation(posting.location),
    ...(hasVenueIdField(posting) ? { venueId: posting.venueId } : {}),
    contactPhone: posting.contactPhone ?? '',
    tags: posting.tags ?? [],
    schedule:
      posting.schedule.kind === 'fixed'
        ? buildFixedDraftFromPosting(posting)
        : buildDatedDraftFromPosting(posting),
    roleCatalog: posting.roleCatalog,
    compensation: {
      mode: posting.compensation.mode,
      ...(posting.compensation.defaultSalary
        ? { defaultSalary: posting.compensation.defaultSalary }
        : {}),
      ...(posting.compensation.allowances ? { allowances: posting.compensation.allowances } : {}),
      ...(posting.compensation.taxSettings
        ? { taxSettings: posting.compensation.taxSettings }
        : {}),
    },
    questions: {
      items: posting.questions.items ?? [],
    },
    ...(posting.conditions !== undefined ? { conditions: posting.conditions } : {}),
  };
}
