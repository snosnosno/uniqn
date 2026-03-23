import type { JobPostingFormData, JobPostingTemplate } from '@/types';
import { extractTemplateData, templateToFormData } from '@/types/jobTemplate';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import { buildSeedTimeSlots } from '@/utils/job-posting/draftRoles';

function createTemplate(formData: JobPostingFormData): JobPostingTemplate {
  return {
    id: 'template-1',
    name: 'Reusable Template',
    createdBy: 'user-1',
    createdAt: new Date() as never,
    templateData: extractTemplateData(formData),
  };
}

describe('jobTemplate dated template helpers', () => {
  it('stores a per-date seed schedule instead of aggregated role counts', () => {
    const template = createTemplate({
      ...INITIAL_JOB_POSTING_FORM_DATA,
      postingType: 'regular',
      title: 'Tournament Template',
      roles: [
        {
          name: '?쒕윭',
          count: 6,
          salary: { type: 'hourly', amount: 13000 },
        },
      ],
      dateSpecificRequirements: [
        {
          date: '2026-04-10',
          timeSlots: [
            {
              id: 'slot-day-1',
              startTime: '18:00',
              roles: [
                {
                  id: 'dealer-day-1',
                  role: 'dealer',
                  headcount: 2,
                  salary: { type: 'hourly', amount: 13000 },
                },
              ],
            },
          ],
        },
        {
          date: '2026-04-11',
          timeSlots: [
            {
              id: 'slot-day-2',
              startTime: '18:00',
              roles: [
                {
                  id: 'dealer-day-2',
                  role: 'dealer',
                  headcount: 2,
                  salary: { type: 'hourly', amount: 13000 },
                },
              ],
            },
          ],
        },
        {
          date: '2026-04-12',
          timeSlots: [
            {
              id: 'slot-day-3',
              startTime: '18:00',
              roles: [
                {
                  id: 'dealer-day-3',
                  role: 'dealer',
                  headcount: 2,
                  salary: { type: 'hourly', amount: 13000 },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(template.templateData.schedule).toMatchObject({
      kind: 'dated',
      templateTimeSlots: [
        {
          startTime: '18:00',
        },
      ],
    });
    expect(
      template.templateData.schedule &&
        template.templateData.schedule.kind === 'dated' &&
        template.templateData.schedule.templateTimeSlots[0]?.roles
    ).toMatchObject([
      {
        role: 'dealer',
        count: 2,
      },
    ]);

    const loaded = templateToFormData(template);

    expect(loaded.roles).toMatchObject([
      {
        name: '?쒕윭',
        count: 2,
        salary: { type: 'hourly', amount: 13000 },
      },
    ]);

    const seededSlots = buildSeedTimeSlots({
      roles: loaded.roles ?? [],
      dateSpecificRequirements: loaded.dateSpecificRequirements,
      datedTemplateTimeSlots: loaded.datedTemplateTimeSlots,
    });

    expect(seededSlots[0]?.roles).toMatchObject([
      {
        role: 'dealer',
        headcount: 2,
      },
    ]);
  });

  it('rebuilds the seed schedule from edited roles while keeping template timing when only salary changes', () => {
    const template = createTemplate({
      ...INITIAL_JOB_POSTING_FORM_DATA,
      postingType: 'regular',
      title: 'Reusable Template',
      roles: [
        {
          name: '?쒕윭',
          count: 2,
          salary: { type: 'hourly', amount: 13000 },
        },
      ],
      dateSpecificRequirements: [
        {
          date: '2026-04-10',
          timeSlots: [
            {
              id: 'slot-day-1',
              startTime: '18:00',
              roles: [
                {
                  id: 'dealer-day-1',
                  role: 'dealer',
                  headcount: 2,
                  salary: { type: 'hourly', amount: 13000 },
                },
              ],
            },
          ],
        },
      ],
    });
    const loaded = {
      ...INITIAL_JOB_POSTING_FORM_DATA,
      ...templateToFormData(template),
    } as JobPostingFormData;

    const salaryEditedData: JobPostingFormData = {
      ...loaded,
      roles: [
        {
          name: '?쒕윭',
          count: 2,
          salary: { type: 'hourly', amount: 15000 },
        },
      ],
    };

    const salaryEditedTemplate = extractTemplateData(salaryEditedData);

    expect(salaryEditedTemplate.schedule).toMatchObject({
      kind: 'dated',
      templateTimeSlots: [{ startTime: '18:00' }],
    });
    expect(
      salaryEditedTemplate.schedule &&
        salaryEditedTemplate.schedule.kind === 'dated' &&
        salaryEditedTemplate.schedule.templateTimeSlots[0]?.roles
    ).toMatchObject([
      {
        role: 'dealer',
        count: 2,
      },
    ]);

    const countEditedData: JobPostingFormData = {
      ...loaded,
      roles: [
        {
          name: '?쒕윭',
          count: 3,
          salary: { type: 'hourly', amount: 15000 },
        },
      ],
    };

    const countEditedTemplate = extractTemplateData(countEditedData);

    expect(countEditedTemplate.schedule).toMatchObject({
      kind: 'dated',
      templateTimeSlots: [{ startTime: '09:00' }],
    });
    expect(
      countEditedTemplate.schedule &&
        countEditedTemplate.schedule.kind === 'dated' &&
        countEditedTemplate.schedule.templateTimeSlots[0]?.roles
    ).toMatchObject([
      {
        role: 'dealer',
        count: 3,
      },
    ]);
  });
});
