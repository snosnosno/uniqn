import type { JobPosting, JobPostingFormData } from '@/types';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { getDateString } from '@/types/jobPosting/dateRequirement';
import { mergeJobPostingInput, serializeJobPostingV3 } from '@/domains/job-posting';
import {
  buildCreateJobPostingInput,
  buildJobPostingFormData,
  buildUpdateJobPostingInput,
} from '@/utils/job-posting/submission';

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
        name: '딜러',
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
    applicationCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    location: {
      name: 'Seoul Gangnam',
      address: 'Teheran-ro',
      detailedAddress: 'Suite 101',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-03-25',
      allDates: ['2026-03-25', '2026-03-26'],
      requirements: [createDateRequirement('2026-03-25'), createDateRequirement('2026-03-26')].map(
        (requirement) => ({
          date: getDateString(requirement.date),
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
          question: '경력이 있나요?',
          type: 'text',
          required: true,
        },
      ],
    },
  };
}

describe('job posting submission helpers', () => {
  it('builds canonical create payloads for dated postings', () => {
    const formData = createFormData({
      workDate: '2026-03-20',
      dateSpecificRequirements: [
        createDateRequirement('2026-03-25'),
        createDateRequirement('2026-03-26'),
      ],
      usesPreQuestions: true,
      preQuestions: [
        {
          id: 'q1',
          question: '경력이 있나요?',
          type: 'text',
          required: true,
        },
      ],
      useSameSalary: true,
    });

    const result = buildCreateJobPostingInput(formData);

    expect(result.schedule.kind).toBe('dated');
    if (result.schedule.kind === 'dated') {
      expect(result.schedule.primaryDate).toBe('2026-03-25');
      expect(result.schedule.allDates).toEqual(['2026-03-25', '2026-03-26']);
      expect(result.schedule.requirements[0]?.timeSlots[0]?.roles[0]).toMatchObject({
        role: 'dealer',
        count: 2,
      });
    }
    expect(result.roleCatalog).toEqual([
      { role: 'dealer', salary: { type: 'hourly', amount: 12000 } },
    ]);
    expect(result.compensation).toEqual({
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 12000 },
      allowances: {},
    });
    expect(result.questions.items).toEqual(formData.preQuestions);
  });

  it('omits schedule mutations when confirmed applicants exist', () => {
    const formData = createFormData({
      workDate: '2026-03-22',
      dateSpecificRequirements: [createDateRequirement('2026-03-22')],
      usesPreQuestions: true,
      preQuestions: [
        {
          id: 'q1',
          question: '차량 이동이 가능한가요?',
          type: 'text',
          required: false,
        },
      ],
    });

    const result = buildUpdateJobPostingInput(formData, {
      hasConfirmedApplicants: true,
    });

    expect(result.schedule).toBeUndefined();
    expect(result.roleCatalog).toBeUndefined();
    expect(result.questions).toEqual({
      items: formData.preQuestions,
    });
  });

  it('builds legacy form state from canonical postings', () => {
    const result = buildJobPostingFormData(createPosting());

    expect(result.workDate).toBe('2026-03-25');
    expect(result.detailedAddress).toBe('Suite 101');
    expect(result.dateSpecificRequirements).toHaveLength(2);
    expect(result.roles[0]?.name).toBe('딜러');
    expect(result.defaultSalary?.amount).toBe(12000);
    expect(result.usesPreQuestions).toBe(true);
    expect(result.preQuestions[0]?.question).toBe('경력이 있나요?');
  });
  it('keeps clear intent for optional fields in update payloads and serialization', () => {
    const currentPosting = createPosting();
    const formData = buildJobPostingFormData(currentPosting);
    const clearedFormData: JobPostingFormData = {
      ...formData,
      description: '',
      detailedAddress: '',
    };

    const updateInput = buildUpdateJobPostingInput(clearedFormData);

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
});
