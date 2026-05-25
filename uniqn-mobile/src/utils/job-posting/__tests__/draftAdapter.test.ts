import {
  applyFormDataPatch,
  draftToCreateJobPostingInput,
  draftToFormData,
  formDataToDraft,
} from '../draftAdapter';
import { INITIAL_JOB_POSTING_DRAFT, type JobPostingDraft } from '@/types/jobPostingDraft';
import { INITIAL_JOB_POSTING_FORM_DATA, type FormRoleWithCount } from '@/types/jobPostingForm';

function createDatedDraft(): JobPostingDraft {
  return {
    postingType: 'regular',
    title: 'Tournament Draft',
    description: '',
    location: {
      name: 'Seoul',
      district: 'Gangnam-daero',
    },
    contactPhone: '',
    tags: [],
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-10',
      allDates: ['2026-04-10', '2026-04-11'],
      requirements: [
        {
          date: '2026-04-10',
          timeSlots: [
            {
              id: 'slot-1',
              startTime: '18:00',
              roles: [
                {
                  id: 'dealer-1',
                  role: 'dealer',
                  count: 2,
                },
              ],
            },
          ],
        },
        {
          date: '2026-04-11',
          timeSlots: [
            {
              id: 'slot-2',
              startTime: '18:00',
              roles: [
                {
                  id: 'dealer-2',
                  role: 'dealer',
                  count: 5,
                },
              ],
            },
          ],
        },
      ],
      templateTimeSlots: [
        {
          id: 'template-slot',
          startTime: '18:00',
          roles: [
            {
              id: 'template-dealer',
              role: 'dealer',
              count: 2,
            },
          ],
        },
      ],
    },
    roleCatalog: [
      {
        role: 'dealer',
        salary: { type: 'hourly', amount: 13000 },
      },
    ],
    compensation: {
      mode: 'by_role',
      allowances: {},
    },
    questions: {
      items: [],
    },
  };
}

describe('draftAdapter dated seed handling', () => {
  it('uses dealer and floor as the default dated roles for a fresh draft', () => {
    const formData = draftToFormData(INITIAL_JOB_POSTING_DRAFT);

    expect(formData.roles).toMatchObject([
      {
        name: '딜러',
        count: 1,
      },
      {
        name: '플로어',
        count: 1,
      },
    ]);
  });

  it('keeps form roles aligned with the first populated requirement instead of aggregating all dates', () => {
    const formData = draftToFormData(createDatedDraft());

    expect(formData.location?.address).toBe('Gangnam-daero');
    expect(formData.roles).toMatchObject([
      {
        name: '딜러',
        count: 2,
        salary: { type: 'hourly', amount: 13000 },
      },
    ]);
  });

  it('surfaces a custom timeSlot role in formData.roles after a patch round-trip', () => {
    const draft = createDatedDraft();
    const currentFormData = draftToFormData(draft);
    const requirement = currentFormData.dateSpecificRequirements?.[0];
    if (!requirement) {
      throw new Error('expected a dated requirement');
    }

    const nextRequirements = [
      {
        ...requirement,
        timeSlots: requirement.timeSlots.map((slot) => ({
          ...slot,
          roles: [
            ...slot.roles,
            {
              id: 'custom-manager',
              role: 'other' as const,
              customRole: '매니저',
              headcount: 1,
              filled: 0,
            },
          ],
        })),
      },
      ...(currentFormData.dateSpecificRequirements ?? []).slice(1),
    ];

    const nextDraft = applyFormDataPatch(draft, { dateSpecificRequirements: nextRequirements });
    const nextFormData = draftToFormData(nextDraft);

    expect(nextFormData.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '매니저', isCustom: true, count: 1 }),
      ])
    );
  });

  it('is idempotent when the same custom role patch is applied twice', () => {
    const draft = createDatedDraft();
    const formData = draftToFormData(draft);
    const requirement = formData.dateSpecificRequirements?.[0];
    if (!requirement) {
      throw new Error('expected a dated requirement');
    }

    const patched = [
      {
        ...requirement,
        timeSlots: requirement.timeSlots.map((slot) => ({
          ...slot,
          roles: [
            ...slot.roles,
            {
              id: 'custom-manager',
              role: 'other' as const,
              customRole: '매니저',
              headcount: 1,
              filled: 0,
            },
          ],
        })),
      },
    ];

    const firstDraft = applyFormDataPatch(draft, { dateSpecificRequirements: patched });
    const firstFormData = draftToFormData(firstDraft);
    const secondDraft = applyFormDataPatch(firstDraft, { roles: firstFormData.roles });
    const secondFormData = draftToFormData(secondDraft);

    expect(secondFormData.roles).toEqual(firstFormData.roles);
  });

  it('surfaces roles added only to a later dated requirement', () => {
    const draft = createDatedDraft();
    const formData = draftToFormData(draft);
    const requirements = formData.dateSpecificRequirements ?? [];
    if (requirements.length < 2) {
      throw new Error('expected at least two dated requirements');
    }

    const [firstRequirement, secondRequirement, ...rest] = requirements;

    const nextRequirements = [
      firstRequirement!,
      {
        ...secondRequirement!,
        timeSlots: secondRequirement!.timeSlots.map((slot) => ({
          ...slot,
          roles: [
            ...slot.roles,
            {
              id: 'later-serving',
              role: 'serving' as const,
              headcount: 3,
              filled: 0,
            },
          ],
        })),
      },
      ...rest,
    ];

    const nextDraft = applyFormDataPatch(draft, {
      dateSpecificRequirements: nextRequirements,
    });
    const nextFormData = draftToFormData(nextDraft);

    const serving = nextFormData.roles.find((role) => role.name === '서빙');
    expect(serving).toBeDefined();
    expect(serving?.count).toBe(3);

    const dealer = nextFormData.roles.find((role) => role.name === '딜러');
    expect(dealer?.count).toBe(2);
  });

  it('copies shared salary to a newly added role when useSameSalary is on (fixed)', () => {
    const draft: JobPostingDraft = {
      ...INITIAL_JOB_POSTING_DRAFT,
      postingType: 'fixed',
      schedule: {
        kind: 'fixed',
        daysPerWeek: 5,
        startTime: '10:00',
        requirements: [
          {
            date: null,
            timeSlots: [
              {
                startTime: '10:00',
                isTimeToBeAnnounced: false,
                roles: [
                  { role: 'dealer', count: 1 },
                  { role: 'floor', count: 1 },
                ],
              },
            ],
          },
        ],
      },
      roleCatalog: [
        { role: 'dealer', salary: { type: 'hourly', amount: 15000 } },
        { role: 'floor', salary: { type: 'hourly', amount: 15000 } },
      ],
      compensation: {
        mode: 'shared',
        defaultSalary: { type: 'hourly', amount: 15000 },
      },
    };

    const formData = draftToFormData(draft);
    expect(formData.useSameSalary).toBe(true);

    const nextRoles: FormRoleWithCount[] = [
      ...formData.roles,
      { name: '서빙', count: 1, isCustom: false },
    ];

    const nextDraft = applyFormDataPatch(draft, { roles: nextRoles });
    const nextFormData = draftToFormData(nextDraft);

    const serving = nextFormData.roles.find((role) => role.name === '서빙');
    expect(serving).toBeDefined();
    expect(serving?.salary).toEqual({ type: 'hourly', amount: 15000 });
  });

  it('copies shared salary to a newly added slot role when useSameSalary is on (dated)', () => {
    const draft: JobPostingDraft = {
      ...createDatedDraft(),
      compensation: {
        mode: 'shared',
        defaultSalary: { type: 'hourly', amount: 13000 },
      },
    };

    const formData = draftToFormData(draft);
    expect(formData.useSameSalary).toBe(true);

    const requirement = formData.dateSpecificRequirements?.[0];
    if (!requirement) {
      throw new Error('expected a dated requirement');
    }

    const nextRequirements = [
      {
        ...requirement,
        timeSlots: requirement.timeSlots.map((slot) => ({
          ...slot,
          roles: [
            ...slot.roles,
            {
              id: 'slot-serving',
              role: 'serving' as const,
              headcount: 1,
              filled: 0,
            },
          ],
        })),
      },
      ...(formData.dateSpecificRequirements ?? []).slice(1),
    ];

    const nextDraft = applyFormDataPatch(draft, {
      dateSpecificRequirements: nextRequirements,
    });
    const nextFormData = draftToFormData(nextDraft);

    const serving = nextFormData.roles.find((role) => role.name === '서빙');
    expect(serving).toBeDefined();
    expect(serving?.salary).toEqual({ type: 'hourly', amount: 13000 });
  });

  it('falls back to template seed slots when dated requirements are removed', () => {
    const draft = createDatedDraft();
    if (draft.schedule.kind !== 'dated') {
      throw new Error('expected dated draft');
    }

    draft.schedule = {
      ...draft.schedule,
      requirements: [],
    };

    const formData = draftToFormData(draft);

    expect(formData.roles).toMatchObject([
      {
        name: '딜러',
        count: 2,
      },
    ]);
  });
});

describe('draftAdapter fixed (통일 구조)', () => {
  const fixedForm = {
    ...INITIAL_JOB_POSTING_FORM_DATA,
    postingType: 'fixed' as const,
    title: 'Fixed posting',
    location: { name: 'Seoul' },
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    roles: [
      { name: '딜러', count: 3, isCustom: false },
      { name: 'VIP Host', count: 2, isCustom: true },
    ],
  };

  it('buildFixedDraft stores roles in synthetic requirements[0].timeSlots[0].roles', () => {
    const draft = formDataToDraft(fixedForm);
    expect(draft.schedule.kind).toBe('fixed');
    const fixed = draft.schedule as Extract<typeof draft.schedule, { kind: 'fixed' }>;
    expect(fixed.requirements).toHaveLength(1);
    expect(fixed.requirements[0].date).toBeNull();
    expect(fixed.requirements[0].timeSlots[0].roles.map((r) => r.count).sort()).toEqual([2, 3]);
    expect((fixed as { roleRequirements?: unknown }).roleRequirements).toBeUndefined();
  });

  it('draftToCreateJobPostingInput emits requirements (no roleRequirements key)', () => {
    const input = draftToCreateJobPostingInput(formDataToDraft(fixedForm));
    expect(input.schedule.kind).toBe('fixed');
    const fixed = input.schedule as Extract<typeof input.schedule, { kind: 'fixed' }>;
    expect(fixed.requirements[0].timeSlots[0].roles).toHaveLength(2);
    expect((fixed as { roleRequirements?: unknown }).roleRequirements).toBeUndefined();
  });

  it('round-trips fixed roles back to form (draft -> form)', () => {
    const form = draftToFormData(formDataToDraft(fixedForm));
    expect(form.roles.map((r) => r.count).sort()).toEqual([2, 3]);
    expect(form.daysPerWeek).toBe(5);
    expect(form.startTime).toBe('19:00');
  });
});
