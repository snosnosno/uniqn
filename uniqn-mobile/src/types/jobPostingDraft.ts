import { generateId } from '@/utils/generateId';
import type { PostingType } from './postingConfig';
import type {
  PostingCompensation,
  PostingFixedRoleRequirement,
  PostingLocation,
  PostingQuestions,
  PostingRoleCatalogEntry,
  PostingSchedule,
  PostingSlotRoleRequirement,
  PostingTimeSlot,
} from './jobPosting';

export interface JobPostingDraftDatedSchedule extends Extract<PostingSchedule, { kind: 'dated' }> {
  templateTimeSlots: PostingTimeSlot[];
}

export interface JobPostingDraftFixedSchedule extends Extract<PostingSchedule, { kind: 'fixed' }> {
  roleRequirements: PostingFixedRoleRequirement[];
}

export type JobPostingDraftSchedule = JobPostingDraftDatedSchedule | JobPostingDraftFixedSchedule;

export interface JobPostingDraft {
  postingType: PostingType;
  title: string;
  description: string;
  location: PostingLocation | null;
  contactPhone: string;
  tags: string[];
  schedule: JobPostingDraftSchedule;
  roleCatalog: PostingRoleCatalogEntry[];
  compensation: PostingCompensation;
  questions: PostingQuestions;
}

function createDefaultSlotRole(
  role: PostingSlotRoleRequirement['role']
): PostingSlotRoleRequirement {
  return {
    id: generateId(),
    role,
    count: 1,
  };
}

function createDefaultTemplateTimeSlots(): PostingTimeSlot[] {
  return [
    {
      id: generateId(),
      startTime: '09:00',
      isTimeToBeAnnounced: false,
      roles: [createDefaultSlotRole('staff'), createDefaultSlotRole('manager')],
    },
  ];
}

export const DEFAULT_DRAFT_ROLE_CATALOG: PostingRoleCatalogEntry[] = [
  { role: 'staff' },
  { role: 'manager' },
];

export const INITIAL_JOB_POSTING_DRAFT: JobPostingDraft = {
  postingType: 'regular',
  title: '',
  description: '',
  location: null,
  contactPhone: '',
  tags: [],
  schedule: {
    kind: 'dated',
    primaryDate: '',
    allDates: [],
    requirements: [],
    templateTimeSlots: createDefaultTemplateTimeSlots(),
  },
  roleCatalog: DEFAULT_DRAFT_ROLE_CATALOG,
  compensation: {
    mode: 'by_role',
    allowances: {},
  },
  questions: {
    items: [],
  },
};
