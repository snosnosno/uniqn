import { removeUndefined } from '@/utils/removeUndefined';
import { buildFixedSyntheticRequirement, formDataToDraft } from '@/utils/job-posting/draftAdapter';
import type {
  JobPostingDraft,
  JobPostingDraftDatedSchedule,
  JobPostingDraftFixedSchedule,
} from './jobPostingDraft';
import { INITIAL_JOB_POSTING_DRAFT } from './jobPostingDraft';
import type { JobPostingFormData } from './jobPostingForm';
import type {
  PostingCompensation,
  PostingConditions,
  PostingLocation,
  PostingQuestions,
  PostingRoleCatalogEntry,
  PostingSlotRoleRequirement,
} from './jobPosting';
import type { PostingType } from './postingConfig';

export interface JobPostingTemplateData {
  postingType?: PostingType;
  title?: string;
  description?: string;
  location?: PostingLocation;
  contactPhone?: string;
  /** 운영처(venue) 컨테이너 self-FK (주간 배치 그리드). 일반 템플릿은 미설정. */
  venueId?: string;
  tags?: string[];
  roleCatalog?: PostingRoleCatalogEntry[];
  compensation?: PostingCompensation;
  questions?: PostingQuestions;
  conditions?: PostingConditions;
  schedule?: JobPostingDraft['schedule'];
}

export type TemplateFormData = JobPostingTemplateData;

export interface JobPostingTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  templateData: TemplateFormData;
  usageCount: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  draft?: JobPostingDraft;
  formData?: JobPostingFormData;
}

export interface TemplateListResult {
  templates: JobPostingTemplate[];
  total: number;
}

function cloneDatedSchedule(schedule: JobPostingDraftDatedSchedule): JobPostingDraftDatedSchedule {
  return {
    ...schedule,
    allDates: [...schedule.allDates],
    requirements: schedule.requirements.map((requirement) => ({
      ...requirement,
      timeSlots: requirement.timeSlots.map((slot) => ({
        ...slot,
        roles: slot.roles.map((role) => ({
          ...role,
        })),
      })),
    })),
    templateTimeSlots: schedule.templateTimeSlots.map((slot) => ({
      ...slot,
      roles: slot.roles.map((role) => ({
        ...role,
      })),
    })),
  };
}

function buildTemplateDatedSchedule(draft: JobPostingDraft): JobPostingDraftDatedSchedule {
  if (draft.schedule.kind !== 'dated') {
    return cloneDatedSchedule(INITIAL_JOB_POSTING_DRAFT.schedule as JobPostingDraftDatedSchedule);
  }

  const seedTimeSlots =
    draft.schedule.requirements[0]?.timeSlots.length > 0
      ? draft.schedule.requirements[0].timeSlots
      : draft.schedule.templateTimeSlots;

  return {
    kind: 'dated',
    primaryDate: '',
    allDates: [],
    requirements: [],
    templateTimeSlots: seedTimeSlots.map((slot) => ({
      ...slot,
      roles: slot.roles.map((role) => ({
        ...role,
      })),
    })),
  };
}

function isJobPostingDraft(value: JobPostingDraft | JobPostingFormData): value is JobPostingDraft {
  return 'schedule' in value && 'roleCatalog' in value && 'compensation' in value;
}

export function extractTemplateData(
  draftOrFormData: JobPostingDraft | JobPostingFormData
): TemplateFormData {
  const draft = isJobPostingDraft(draftOrFormData)
    ? draftOrFormData
    : formDataToDraft(draftOrFormData);

  const templateData: JobPostingTemplateData = {
    postingType: draft.postingType,
    title: draft.title,
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.location ? { location: draft.location } : {}),
    ...(draft.contactPhone ? { contactPhone: draft.contactPhone } : {}),
    ...(draft.tags.length > 0 ? { tags: draft.tags } : {}),
    roleCatalog: draft.roleCatalog,
    compensation: draft.compensation,
    questions: draft.questions,
    ...(draft.conditions !== undefined ? { conditions: draft.conditions } : {}),
    schedule:
      draft.schedule.kind === 'fixed'
        ? {
            ...draft.schedule,
            requirements: draft.schedule.requirements.map((requirement) => ({
              date: null,
              timeSlots: requirement.timeSlots.map((slot) => ({
                ...slot,
                // fixed 스케줄은 시간 미정 개념이 없다 — 합성 슬롯 불변식(isTimeToBeAnnounced:false)을
                // buildFixedSyntheticRequirement 와 동일하게 명시 고정한다.
                isTimeToBeAnnounced: false,
                roles: slot.roles.map((role) => ({ ...role })),
              })),
            })),
          }
        : buildTemplateDatedSchedule(draft),
  };

  return removeUndefined(templateData as Record<string, unknown>) as TemplateFormData;
}

export function templateToDraft(template: JobPostingTemplate): JobPostingDraft {
  const { templateData } = template;
  const base = INITIAL_JOB_POSTING_DRAFT;
  const legacyTemplateData = templateData as JobPostingTemplateData & {
    datedTemplateTimeSlots?: {
      id?: string;
      startTime?: string;
      isTimeToBeAnnounced?: boolean;
      tentativeDescription?: string;
      roles?: {
        id?: string;
        role?: string;
        customRole?: string;
        headcount?: number;
        filled?: number;
      }[];
    }[];
  };

  return {
    postingType: templateData.postingType ?? base.postingType,
    title: templateData.title ?? '',
    description: templateData.description ?? '',
    location: templateData.location ?? null,
    // venue_id 전수배선 — 운영처 "공고 열기" 경로에서 주입된 venueId 만 매핑.
    // 일반 템플릿은 미설정이라 키 생략(고정공고 lifecycle 불변).
    ...(templateData.venueId !== undefined ? { venueId: templateData.venueId } : {}),
    contactPhone: templateData.contactPhone ?? '',
    tags: templateData.tags ?? [],
    schedule:
      templateData.schedule?.kind === 'fixed'
        ? (() => {
            const legacyFixed = templateData.schedule as JobPostingDraftFixedSchedule & {
              roleRequirements?: {
                id?: string;
                role?: PostingSlotRoleRequirement['role'];
                customRole?: string;
                count?: number;
                filled?: number;
              }[];
            };
            const legacyRoles = (legacyFixed.roleRequirements ?? []).map((role) => ({
              ...(role.id ? { id: role.id } : {}),
              ...(role.role ? { role: role.role } : {}),
              ...(role.customRole ? { customRole: role.customRole } : {}),
              count: role.count ?? 1,
              ...(role.filled !== undefined ? { filled: role.filled } : {}),
            }));
            const sourceRoles = legacyFixed.requirements?.[0]?.timeSlots?.[0]?.roles ?? legacyRoles;

            return {
              kind: 'fixed' as const,
              daysPerWeek: legacyFixed.daysPerWeek,
              ...(legacyFixed.startTime ? { startTime: legacyFixed.startTime } : {}),
              ...(legacyFixed.isStartTimeNegotiable !== undefined
                ? { isStartTimeNegotiable: legacyFixed.isStartTimeNegotiable }
                : {}),
              requirements: [
                buildFixedSyntheticRequirement(
                  sourceRoles.map((role) => ({ ...role })),
                  legacyFixed.startTime
                ),
              ],
            };
          })()
        : templateData.schedule?.kind === 'dated'
          ? cloneDatedSchedule(templateData.schedule)
          : legacyTemplateData.datedTemplateTimeSlots
            ? {
                kind: 'dated',
                primaryDate: '',
                allDates: [],
                requirements: [],
                templateTimeSlots: legacyTemplateData.datedTemplateTimeSlots.map((slot) => ({
                  ...(slot.id ? { id: slot.id } : {}),
                  ...(slot.startTime ? { startTime: slot.startTime } : {}),
                  ...(slot.isTimeToBeAnnounced !== undefined
                    ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
                    : {}),
                  ...(slot.tentativeDescription
                    ? { tentativeDescription: slot.tentativeDescription }
                    : {}),
                  roles: (slot.roles ?? []).map((role) => ({
                    ...(role.id ? { id: role.id } : {}),
                    role: role.role as PostingSlotRoleRequirement['role'],
                    ...(role.customRole ? { customRole: role.customRole } : {}),
                    count: role.headcount ?? 1,
                    ...(role.filled !== undefined ? { filled: role.filled } : {}),
                  })),
                })),
              }
            : cloneDatedSchedule(base.schedule as JobPostingDraftDatedSchedule),
    roleCatalog: templateData.roleCatalog ?? base.roleCatalog,
    compensation: templateData.compensation ?? base.compensation,
    questions: templateData.questions ?? base.questions,
    ...(templateData.conditions !== undefined ? { conditions: templateData.conditions } : {}),
  };
}
