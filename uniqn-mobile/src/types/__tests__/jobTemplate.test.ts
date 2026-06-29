import type { JobPostingFormData, JobPostingTemplate } from '@/types';
import { STAFF_ROLES } from '@/constants';
import { buildSeedTimeSlots } from '@/utils/job-posting/draftRoles';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { extractTemplateData, templateToDraft, templateToFormData } from '@/types/jobTemplate';

const DEALER_ROLE_NAME = STAFF_ROLES.find((role) => role.key === 'dealer')?.name ?? 'dealer';

function createTemplate(formData: JobPostingFormData): JobPostingTemplate {
  return {
    id: 'template-1',
    userId: 'user-1',
    name: 'Reusable Template',
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z',
    usageCount: 0,
    templateData: extractTemplateData(formData),
  };
}

describe('jobTemplate fixed schedule', () => {
  // fixed 합성 슬롯 불변식: isTimeToBeAnnounced 가 소스에 없어도 템플릿 추출 시 false 로 고정돼야 한다.
  // (buildFixedSyntheticRequirement 와 동일 — 누락 시 시간 미정 상태로 오인되는 발산 방지)
  it('forces isTimeToBeAnnounced:false on fixed synthetic slot even when source omits it', () => {
    const fixedDraft: JobPostingDraft = {
      ...INITIAL_JOB_POSTING_DRAFT,
      postingType: 'fixed',
      schedule: {
        kind: 'fixed',
        daysPerWeek: 5,
        startTime: '19:00',
        requirements: [
          {
            date: null,
            // isTimeToBeAnnounced 의도적 미설정
            timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
        ],
      },
    } as JobPostingDraft;

    const templateData = extractTemplateData(fixedDraft);
    const schedule = templateData.schedule as
      | { kind: string; requirements: { timeSlots: { isTimeToBeAnnounced?: boolean }[] }[] }
      | undefined;

    expect(schedule?.kind).toBe('fixed');
    expect(schedule?.requirements[0].timeSlots[0].isTimeToBeAnnounced).toBe(false);
  });

  // P1 라운드트립: 고정공고를 템플릿으로 저장 → 다시 불러오면 동일한 폼으로 복원돼야 한다.
  // (LoadTemplateModal 의 fixed 차단 가드 해제 안전성 보장 — 깨지면 차단 유지 근거)
  it('restores a fixed posting template back to a loadable form (save → load round-trip)', () => {
    const template = createTemplate({
      ...INITIAL_JOB_POSTING_FORM_DATA,
      postingType: 'fixed',
      title: '서울 딜러 고정',
      daysPerWeek: 5,
      startTime: '19:00',
      isStartTimeNegotiable: false,
      roles: [
        {
          name: DEALER_ROLE_NAME,
          count: 3,
          salary: { type: 'hourly', amount: 14000 },
        },
      ],
    } as JobPostingFormData);

    expect(template.templateData.schedule?.kind).toBe('fixed');

    const loaded = {
      ...INITIAL_JOB_POSTING_FORM_DATA,
      ...templateToFormData(template),
    } as JobPostingFormData;

    expect(loaded.postingType).toBe('fixed');
    expect(loaded.daysPerWeek).toBe(5);
    expect(loaded.startTime).toBe('19:00');
    expect(loaded.isStartTimeNegotiable).toBe(false);
    expect(loaded.roles).toMatchObject([
      {
        name: DEALER_ROLE_NAME,
        count: 3,
        salary: { type: 'hourly', amount: 14000 },
      },
    ]);
  });

  // 협의 출근시간(isStartTimeNegotiable:true, startTime 없음) 고정공고도 round-trip 보존
  it('restores a negotiable-start fixed template without a startTime', () => {
    const template = createTemplate({
      ...INITIAL_JOB_POSTING_FORM_DATA,
      postingType: 'fixed',
      title: '협의 고정',
      daysPerWeek: 3,
      startTime: '',
      isStartTimeNegotiable: true,
      roles: [{ name: DEALER_ROLE_NAME, count: 1 }],
    } as JobPostingFormData);

    const loaded = {
      ...INITIAL_JOB_POSTING_FORM_DATA,
      ...templateToFormData(template),
    } as JobPostingFormData;

    expect(loaded.postingType).toBe('fixed');
    expect(loaded.daysPerWeek).toBe(3);
    expect(loaded.isStartTimeNegotiable).toBe(true);
    expect(loaded.startTime).toBe('');
  });
});

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

// R8: venue_id 전수배선 — 운영처 "공고 열기" 경로가 templateData.venueId 를 draft 로 전달.
describe('jobTemplate venue_id 매핑 (templateToDraft)', () => {
  function makeTemplate(templateData: JobPostingTemplate['templateData']): JobPostingTemplate {
    return {
      id: 'template-venue-1',
      userId: 'user-1',
      name: 'Venue Template',
      createdAt: '2026-06-30T00:00:00Z',
      updatedAt: '2026-06-30T00:00:00Z',
      usageCount: 0,
      templateData,
    };
  }

  it('templateData.venueId 가 있으면 draft.venueId 로 매핑한다', () => {
    const draft = templateToDraft(makeTemplate({ title: 'A', venueId: 'venue-container-1' }));
    expect(draft.venueId).toBe('venue-container-1');
  });

  it('templateData.venueId 가 없으면 draft 에 venueId 키가 부재한다 (무회귀)', () => {
    const draft = templateToDraft(makeTemplate({ title: 'A' }));
    expect(Object.prototype.hasOwnProperty.call(draft, 'venueId')).toBe(false);
  });
});
