import type { JobPosting, JobPostingFormData } from '@/types';
import { STAFF_ROLES } from '@/constants';
import { parseJobPostingDocument } from '@/schemas';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { getDateString } from '@/types/jobPosting/dateRequirement';
import { mergeJobPostingInput, serializeJobPostingV3 } from '@/domains/job-posting';
import {
  buildCreateJobPostingInput,
  buildJobPostingFormData,
  buildUpdateJobPostingInput,
} from '@/utils/job-posting/submission';

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
          question: 'Do you have live game experience?',
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
          question: 'Do you have live game experience?',
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
    expect(result.location).toEqual({
      name: 'Seoul Gangnam',
      district: 'Teheran-ro',
    });
    expect(Object.prototype.hasOwnProperty.call(result.location, 'address')).toBe(false);
    expect(result.compensation).toEqual({
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 12000 },
      allowances: {},
    });
    expect(result.questions.items).toEqual(formData.preQuestions);
  });

  it('omits schedule mutations but preserves role salary updates when confirmed applicants exist', () => {
    const formData = createFormData({
      workDate: '2026-03-22',
      dateSpecificRequirements: [createDateRequirement('2026-03-22')],
      usesPreQuestions: true,
      preQuestions: [
        {
          id: 'q1',
          question: 'Can you arrive 30 minutes early?',
          type: 'text',
          required: false,
        },
      ],
    });

    const result = buildUpdateJobPostingInput(formData, {
      hasConfirmedApplicants: true,
    });

    expect(result.schedule).toBeUndefined();
    expect(result.roleCatalog).toEqual([
      { role: 'dealer', salary: { type: 'hourly', amount: 12000 } },
    ]);
    expect(result.questions).toEqual({
      items: formData.preQuestions,
    });
  });

  it('builds canonical update payloads for fixed postings', () => {
    const formData = createFormData({
      postingType: 'fixed',
      workDate: '',
      dateSpecificRequirements: [],
      daysPerWeek: 3,
      startTime: '18:30',
      isStartTimeNegotiable: false,
      roles: [
        {
          name: DEALER_ROLE_NAME,
          count: 3,
          salary: { type: 'hourly', amount: 14000 },
        },
      ],
    });

    const result = buildUpdateJobPostingInput(formData);

    expect(result.postingType).toBe('fixed');
    expect(result.schedule?.kind).toBe('fixed');
    if (result.schedule?.kind === 'fixed') {
      expect(result.schedule.daysPerWeek).toBe(3);
      expect(result.schedule.startTime).toBe('18:30');
      expect(result.schedule.roleRequirements).toEqual([{ role: 'dealer', count: 3, filled: 0 }]);
    }
    expect(result.roleCatalog).toEqual([
      { role: 'dealer', salary: { type: 'hourly', amount: 14000 } },
    ]);
  });

  it('keeps hidden pre-question drafts out of canonical payloads when the toggle is off', () => {
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

    const result = buildCreateJobPostingInput(formData);

    expect(result.questions.items).toEqual([]);
    expect(formData.preQuestions).toHaveLength(1);
  });

  it('builds legacy form state from canonical postings', () => {
    const result = buildJobPostingFormData(createPosting());

    expect(result.workDate).toBe('2026-03-25');
    expect(result.location?.address).toBe('Teheran-ro');
    expect(result.location?.district).toBe('Teheran-ro');
    expect(result.detailedAddress).toBe('Suite 101');
    expect(result.dateSpecificRequirements).toHaveLength(2);
    expect(result.roles[0]?.name).toBe(DEALER_ROLE_NAME);
    expect(result.defaultSalary?.amount).toBe(12000);
    expect(result.usesPreQuestions).toBe(true);
    expect(result.preQuestions[0]?.question).toBe('Do you have live game experience?');
  });

  it('keeps clear intent for optional fields in update payloads and serialization', () => {
    const currentPosting = createPosting();
    const formData = buildJobPostingFormData(currentPosting);
    const clearedFormData: JobPostingFormData = {
      ...formData,
      description: '',
      detailedAddress: '',
      location: {
        ...formData.location!,
        detailedAddress: '',
      },
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

  it('prefers canonical nested detailedAddress when facade state is stale', () => {
    const currentPosting = createPosting();
    const formData = buildJobPostingFormData(currentPosting);
    const nextFormData: JobPostingFormData = {
      ...formData,
      detailedAddress: 'Suite 101',
      location: {
        ...formData.location!,
        detailedAddress: 'Room 202',
      },
    };

    const updateInput = buildUpdateJobPostingInput(nextFormData);

    expect(updateInput.location?.detailedAddress).toBe('Room 202');
  });

  it('preserves canonical location data through serialize -> parse -> form round-trip', () => {
    const createInput = buildCreateJobPostingInput(createFormData());
    const serialized = serializeJobPostingV3(createInput, {
      ownerId: 'employer-1',
      ownerName: 'Owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const parsed = parseJobPostingDocument(serialized);

    expect(parsed).not.toBeNull();

    const formData = buildJobPostingFormData(parsed!);

    expect(formData.location).toEqual({
      name: 'Seoul Gangnam',
      district: 'Teheran-ro',
      address: 'Teheran-ro',
    });
  });
});
