import { generateId } from '@/utils/generateId';
import type { PostingType } from './postingConfig';
import type {
  PostingCompensation,
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

export type JobPostingDraftFixedSchedule = Extract<PostingSchedule, { kind: 'fixed' }>;

export type JobPostingDraftSchedule = JobPostingDraftDatedSchedule | JobPostingDraftFixedSchedule;

export interface JobPostingDraft {
  postingType: PostingType;
  title: string;
  description: string;
  location: PostingLocation | null;
  contactPhone: string;
  /** 운영처(venue) 컨테이너 self-FK (주간 배치 그리드). 일반 공고 draft 는 미설정. */
  venueId?: string;
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
      roles: [createDefaultSlotRole('dealer'), createDefaultSlotRole('floor')],
    },
  ];
}

export const DEFAULT_DRAFT_ROLE_CATALOG: PostingRoleCatalogEntry[] = [
  { role: 'dealer' },
  { role: 'floor' },
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
