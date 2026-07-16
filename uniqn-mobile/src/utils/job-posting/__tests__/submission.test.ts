import type { JobPosting, JobPostingFormData } from '@/types';
import { STAFF_ROLES } from '@/constants';
import { parseJobPostingDocument } from '@/schemas';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { toDateString } from '@/utils/date';
import { mergeJobPostingInput, serializeJobPostingV3 } from '@/domains/job-posting';
import {
  draftToCreateJobPostingInput,
  draftToFormData,
  draftToUpdateJobPostingInput,
  formDataToDraft,
  jobPostingToDraft,
} from '@/utils/job-posting/draftAdapter';

const DEALER_ROLE_NAME = STAFF_ROLES.find((role) => role.key === 'dealer')?.name ?? 'dealer';

function createDateRequirement(date: string): DateSpecificRequirement {
  return {
    date,
    timeSlots: [
      {
        id: `slot-${date}`,
        startTime: '18:00',
        roles: [
          {
            id: `role-${date}`,
            role: 'dealer',
            headcount: 2,
            filled: 0,
          },
        ],
      },
    ],
  };
}

function createFormData(overrides: Partial<JobPostingFormData> = {}): JobPostingFormData {
  return {
    ...INITIAL_JOB_POSTING_FORM_DATA,
    postingType: 'regular',
    title: 'Canonical Posting',
    description: 'Form draft',
    location: {
      name: 'Seoul Gangnam',
      address: 'Teheran-ro',
    },
    roles: [
      {
        name: DEALER_ROLE_NAME,
        count: 2,
        salary: { type: 'hourly', amount: 12000 },
      },
    ],
    ...overrides,
  };
}

function createPosting(): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: 'Canonical Posting',
    description: 'Saved posting',
    status: 'active',
    ownerId: 'employer-1',
    ownerName: 'Owner',
    postingType: 'regular',
    workDate: '2026-03-25',
    workDates: ['2026-03-25', '2026-03-26'],
    roleKeys: ['dealer'],
    totalPositions: 2,
    filledPositions: 0,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    location: {
      name: 'Seoul Gangnam',
      district: 'Teheran-ro',
      detailedAddress: 'Suite 101',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-03-25',
      allDates: ['2026-03-25', '2026-03-26'],
      requirements: [createDateRequirement('2026-03-25'), createDateRequirement('2026-03-26')].map(
        (requirement) => ({
          date: toDateString(requirement.date),
          timeSlots: requirement.timeSlots.map((slot) => ({
            id: slot.id,
            startTime: slot.startTime,
            roles: slot.roles.map((role) => ({
              id: role.id,
              role: role.role,
              count: role.headcount ?? 0,
              filled: role.filled,
            })),
          })),
        })
      ),
    },
    roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 12000 } }],
    compensation: {
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 12000 },
      allowances: { meal: 10000 },
    },
    questions: {
      items: [
        {
          id: 'q1',
          question: 'Do you have live game experience?',
          type: 'text',
          required: true,
        },
      ],
    },
  };
}

// submission.ts는 buildJobPostingDraft 단일 존치로 슬림화(S4). 래퍼(buildCreate/Update/FormData)가
// 은퇴하며, 그 유일 계약을 draftAdapter 직접 경로(draftToCreate/Update·formDataToDraft·jobPostingToDraft)로
// 이식해 어서션 의미를 보존한다. 파일명은 경로 이력 보존을 위해 유지한다.
describe('formData 백컴팻(draftAdapter 직접 경로)', () => {
  it('토글 off면 숨은 pre-question 초안이 canonical payload에서 빠진다', () => {
    const formData = createFormData({
      usesPreQuestions: false,
      preQuestions: [
        {
          id: 'q1',
          question: 'Hidden draft question',
          type: 'text',
          required: false,
        },
      ],
    });

    const result = draftToCreateJobPostingInput(formDataToDraft(formData));

    expect(result.questions.items).toEqual([]);
    expect(formData.preQuestions).toHaveLength(1);
  });

  it('optional 필드 clear-intent가 update payload와 직렬화에 반영된다', () => {
    const currentPosting = createPosting();
    const formData = draftToFormData(jobPostingToDraft(currentPosting));
    const clearedFormData: JobPostingFormData = {
      ...formData,
      description: '',
      detailedAddress: '',
      location: {
        ...formData.location!,
        detailedAddress: '',
      },
    };

    const updateInput = draftToUpdateJobPostingInput(formDataToDraft(clearedFormData));

    expect(Object.prototype.hasOwnProperty.call(updateInput, 'description')).toBe(true);
    expect(updateInput.description).toBeUndefined();
    expect(updateInput.location).toBeDefined();
    expect(
      Object.prototype.hasOwnProperty.call(updateInput.location ?? {}, 'detailedAddress')
    ).toBe(true);
    expect(updateInput.location?.detailedAddress).toBeUndefined();

    const merged = mergeJobPostingInput(currentPosting, updateInput);
    const serialized = serializeJobPostingV3(merged, {
      ownerId: currentPosting.ownerId,
      ownerName: currentPosting.ownerName,
      status: currentPosting.status,
      current: currentPosting,
      createdAt: currentPosting.createdAt,
      updatedAt: currentPosting.updatedAt,
    });

    expect(Object.prototype.hasOwnProperty.call(serialized, 'description')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(serialized.location, 'detailedAddress')).toBe(
      false
    );
  });

  it('facade 상태가 stale일 때 canonical nested detailedAddress를 우선한다', () => {
    const currentPosting = createPosting();
    const formData = draftToFormData(jobPostingToDraft(currentPosting));
    const nextFormData: JobPostingFormData = {
      ...formData,
      detailedAddress: 'Suite 101',
      location: {
        ...formData.location!,
        detailedAddress: 'Room 202',
      },
    };

    const updateInput = draftToUpdateJobPostingInput(formDataToDraft(nextFormData));

    expect(updateInput.location?.detailedAddress).toBe('Room 202');
  });

  it('canonical location이 serialize → parse → draft 왕복에서 보존된다', () => {
    // 렌즈 교체: form 방향(buildJobPostingFormData) 사멸 → jobPostingToDraft 로 location 보존을 확인.
    const createInput = draftToCreateJobPostingInput(formDataToDraft(createFormData()));
    const serialized = serializeJobPostingV3(createInput, {
      ownerId: 'employer-1',
      ownerName: 'Owner',
      // jobPostingDocumentSchema 가 workspaceId 를 required v4 uuid 로 요구.
      // serializeJobPostingV3 는 options.workspaceId 미지정 시 필드 omit → zod 검증 실패.
      // version digit 4, variant digit 8 인 valid uuid v4 사용.
      workspaceId: '11111111-1111-4111-8111-111111111111',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const parsed = parseJobPostingDocument(serialized);

    expect(parsed).not.toBeNull();

    const draft = jobPostingToDraft(parsed!);

    // toCanonicalPostingLocation: address→district 정규화, address 키는 canonical draft에 남지 않는다.
    expect(draft.location).toEqual({
      name: 'Seoul Gangnam',
      district: 'Teheran-ro',
    });
  });
});
