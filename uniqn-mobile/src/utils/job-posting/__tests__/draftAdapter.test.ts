import { draftToFormData } from '../draftAdapter';
import { INITIAL_JOB_POSTING_DRAFT, type JobPostingDraft } from '@/types/jobPostingDraft';

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
