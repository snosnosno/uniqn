import type { Timestamp } from 'firebase/firestore';
import { removeUndefined } from '@/utils/firestore/removeUndefined';
import { draftToFormData, formDataToDraft } from '@/utils/job-posting/draftAdapter';
import type { JobPostingDraft, JobPostingDraftDatedSchedule } from './jobPostingDraft';
import { INITIAL_JOB_POSTING_DRAFT } from './jobPostingDraft';
import type { JobPostingFormData } from './jobPostingForm';
import type {
  PostingCompensation,
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
  tags?: string[];
  roleCatalog?: PostingRoleCatalogEntry[];
  compensation?: PostingCompensation;
  questions?: PostingQuestions;
  schedule?: JobPostingDraft['schedule'];
}

export type TemplateFormData = JobPostingTemplateData;

export interface JobPostingTemplate {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Timestamp;
  templateData: TemplateFormData;
  usageCount?: number;
  lastUsedAt?: Timestamp;
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
    schedule:
      draft.schedule.kind === 'fixed'
        ? {
            ...draft.schedule,
            roleRequirements: draft.schedule.roleRequirements.map((role) => ({
              ...role,
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
    contactPhone: templateData.contactPhone ?? '',
    tags: templateData.tags ?? [],
    schedule:
      templateData.schedule?.kind === 'fixed'
        ? {
            ...templateData.schedule,
            roleRequirements: (templateData.schedule.roleRequirements ?? []).map((role) => ({
              ...role,
            })),
          }
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
  };
}

export function templateToFormData(template: JobPostingTemplate): Partial<JobPostingFormData> {
  return draftToFormData(templateToDraft(template));
}
