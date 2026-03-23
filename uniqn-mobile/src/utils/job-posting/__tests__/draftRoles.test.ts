import type { JobPostingFormData, JobPostingTemplate } from '@/types';
import { extractTemplateData, templateToFormData } from '@/types/jobTemplate';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import {
  buildSeedTimeSlots,
  shouldPreserveNonFixedDraftRoles,
} from '@/utils/job-posting/draftRoles';

function createDateRequirement(date: string): DateSpecificRequirement {
  return {
    date,
    timeSlots: [
      {
        id: `slot-${date}`,
        startTime: '18:00',
        roles: [
          {
            id: `dealer-${date}`,
            role: 'dealer',
            headcount: 2,
            salary: { type: 'hourly', amount: 13000 },
          },
          {
            id: `custom-${date}`,
            role: 'other',
            customRole: '조명',
            headcount: 1,
            salary: { type: 'daily', amount: 90000 },
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
    title: 'Template Draft',
    location: {
      name: 'Seoul Gangnam',
      address: 'Teheran-ro',
    },
    dateSpecificRequirements: [createDateRequirement('2026-03-28')],
    roles: [
      {
        name: '딜러',
        count: 2,
        salary: { type: 'hourly', amount: 13000 },
      },
      {
        name: '조명',
        count: 1,
        isCustom: true,
        salary: { type: 'daily', amount: 90000 },
      },
    ],
    useSameSalary: false,
    ...overrides,
  };
}

function createTemplate(formData: JobPostingFormData): JobPostingTemplate {
  return {
    id: 'template-1',
    name: 'Dated Template',
    createdBy: 'user-1',
    createdAt: new Date() as never,
    templateData: extractTemplateData(formData),
  };
}

describe('draft role helpers', () => {
  it('preserves template-loaded non-fixed roles before dates are re-added', () => {
    const loaded = templateToFormData(createTemplate(createFormData()));

    expect(
      shouldPreserveNonFixedDraftRoles({
        postingType: loaded.postingType!,
        dateSpecificRequirements: loaded.dateSpecificRequirements,
        datedTemplateTimeSlots: loaded.datedTemplateTimeSlots,
      })
    ).toBe(true);
  });

  it('preserves standard-role templates even when counts and salary are default values', () => {
    const loaded = templateToFormData(
      createTemplate(
        createFormData({
          dateSpecificRequirements: [
            {
              date: '2026-04-02',
              timeSlots: [
                {
                  id: 'slot-standard',
                  startTime: '15:00',
                  roles: [
                    { id: 'dealer-standard', role: 'dealer', headcount: 1 },
                    { id: 'floor-standard', role: 'floor', headcount: 1 },
                  ],
                },
              ],
            },
          ],
          roles: [
            { name: '딜러', count: 1, isCustom: false },
            { name: '플로어', count: 1, isCustom: false },
          ],
        })
      )
    );

    expect(
      shouldPreserveNonFixedDraftRoles({
        postingType: loaded.postingType!,
        dateSpecificRequirements: loaded.dateSpecificRequirements,
        datedTemplateTimeSlots: loaded.datedTemplateTimeSlots,
      })
    ).toBe(true);
  });

  it('does not preserve a blank non-fixed draft without template seed slots', () => {
    expect(
      shouldPreserveNonFixedDraftRoles({
        postingType: 'regular',
        dateSpecificRequirements: [],
        datedTemplateTimeSlots: [],
      })
    ).toBe(false);
  });

  it('seeds new dated slots from the loaded template time slots', () => {
    const loaded = templateToFormData(createTemplate(createFormData()));
    const seededSlots = buildSeedTimeSlots({
      roles: loaded.roles ?? [],
      dateSpecificRequirements: loaded.dateSpecificRequirements,
      datedTemplateTimeSlots: loaded.datedTemplateTimeSlots,
    });

    expect(seededSlots).toHaveLength(1);
    expect(seededSlots[0]).toMatchObject({
      startTime: '18:00',
    });
    expect(seededSlots[0]?.roles).toMatchObject([
      {
        role: 'dealer',
        headcount: 2,
        salary: { type: 'hourly', amount: 13000 },
      },
      {
        role: 'other',
        customRole: '조명',
        headcount: 1,
        salary: { type: 'daily', amount: 90000 },
      },
    ]);
  });
});
