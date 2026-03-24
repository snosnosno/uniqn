import type { JobPostingFormData, JobPostingTemplate } from '@/types';
import { STAFF_ROLES } from '@/constants';
import { buildSeedTimeSlots } from '@/utils/job-posting/draftRoles';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import { extractTemplateData, templateToFormData } from '@/types/jobTemplate';

const DEALER_ROLE_NAME = STAFF_ROLES.find((role) => role.key === 'dealer')?.name ?? 'dealer';

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
          name: DEALER_ROLE_NAME,
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
      templateTimeSlots: [{ startTime: '18:00' }],
    });
    expect(
      template.templateData.schedule &&
        template.templateData.schedule.kind === 'dated' &&
        template.templateData.schedule.templateTimeSlots[0]?.roles
    ).toMatchObject([{ role: 'dealer', count: 2 }]);

    const loaded = templateToFormData(template);

    expect(loaded.roles).toMatchObject([
      {
        name: DEALER_ROLE_NAME,
        count: 2,
        salary: { type: 'hourly', amount: 13000 },
      },
    ]);

    const seededSlots = buildSeedTimeSlots({
      roles: loaded.roles ?? [],
      dateSpecificRequirements: loaded.dateSpecificRequirements,
      datedTemplateTimeSlots: loaded.datedTemplateTimeSlots,
    });

    expect(seededSlots[0]?.roles).toMatchObject([{ role: 'dealer', headcount: 2 }]);
  });

  it('preserves template timing for salary-only edits and regenerates slots when counts change', () => {
    const template = createTemplate({
      ...INITIAL_JOB_POSTING_FORM_DATA,
      postingType: 'regular',
      title: 'Reusable Template',
      roles: [
        {
          name: DEALER_ROLE_NAME,
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

    const salaryEditedTemplate = extractTemplateData({
      ...loaded,
      roles: [
        {
          name: DEALER_ROLE_NAME,
          count: 2,
          salary: { type: 'hourly', amount: 15000 },
        },
      ],
    });

    expect(salaryEditedTemplate.schedule).toMatchObject({
      kind: 'dated',
      templateTimeSlots: [{ startTime: '18:00' }],
    });

    const countEditedTemplate = extractTemplateData({
      ...loaded,
      roles: [
        {
          name: DEALER_ROLE_NAME,
          count: 3,
          salary: { type: 'hourly', amount: 15000 },
        },
      ],
    });

    expect(countEditedTemplate.schedule).toMatchObject({
      kind: 'dated',
      templateTimeSlots: [{ startTime: '09:00' }],
    });
    expect(
      countEditedTemplate.schedule &&
        countEditedTemplate.schedule.kind === 'dated' &&
        countEditedTemplate.schedule.templateTimeSlots[0]?.roles
    ).toMatchObject([{ role: 'dealer', count: 3 }]);
  });
});
