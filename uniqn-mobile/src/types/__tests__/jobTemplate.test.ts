import type { JobPostingFormData, JobPostingTemplate } from '@/types';
import { STAFF_ROLES } from '@/constants';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { extractTemplateData, templateToDraft } from '@/types/jobTemplate';
// S4(레거시 은퇴): templateToFormData(폼 읽기 방향) 제거 후, 라이브 로드 렌즈는 templateToDraft + draftToValues.
import { draftToValues } from '@/utils/order-sheet/mappers';

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

  // P1 라운드트립: 고정공고를 템플릿으로 저장 → 다시 불러오면 동일 draft 로 복원돼야 한다.
  // (LoadTemplateModal 의 fixed 차단 가드 해제 안전성 보장 — 깨지면 차단 유지 근거)
  // S4 이주: 구 templateToFormData(폼) 렌즈 → templateToDraft(draft) 렌즈(:26 draft 렌즈 관례와 동형).
  // 폼 roles.salary 소멸 대응 — 급여는 roleCatalog 축, 시간·인원은 schedule.requirements[0].timeSlots[0] 로 어서션.
  it('restores a fixed posting template back to a loadable draft (save → load round-trip)', () => {
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

    const draft = templateToDraft(template);
    expect(draft.postingType).toBe('fixed');
    expect(draft.schedule.kind).toBe('fixed');
    const fixed = draft.schedule as Extract<typeof draft.schedule, { kind: 'fixed' }>;
    expect(fixed.daysPerWeek).toBe(5);
    expect(fixed.startTime).toBe('19:00');
    expect(fixed.isStartTimeNegotiable).toBe(false);
    expect(fixed.requirements[0]?.timeSlots[0]?.roles).toMatchObject([
      { role: 'dealer', count: 3 },
    ]);
    expect(draft.roleCatalog).toMatchObject([
      { role: 'dealer', salary: { type: 'hourly', amount: 14000 } },
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

    const draft = templateToDraft(template);
    expect(draft.schedule.kind).toBe('fixed');
    const fixed = draft.schedule as Extract<typeof draft.schedule, { kind: 'fixed' }>;
    expect(fixed.daysPerWeek).toBe(3);
    expect(fixed.isStartTimeNegotiable).toBe(true);
    // 협의 고정 = startTime 키 자체 부재(합성 슬롯에도 미주입).
    expect(fixed.startTime).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(fixed, 'startTime')).toBe(false);
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

    // S4 이주: 구 templateToFormData + buildSeedTimeSlots(폼 렌즈) → templateToDraft + draftToValues(라이브 로드 렌즈).
    const values = draftToValues(templateToDraft(template));

    // per-date seed 슬롯 역할이 그대로 노출(합산 count 6 아님, 시드 count 2 보존) — 이 테스트의 핵심 계약.
    expect(values.scheduleGroups?.[0]?.timeSlots[0]?.roles).toMatchObject([
      { role: 'dealer', count: 2 },
    ]);
    // 시드 슬롯 출근시간(18:00) 보존.
    expect(values.scheduleGroups?.[0]?.timeSlots[0]?.startTime).toBe('18:00');
    // by_role 급여(13000)는 roleSalaries 로 복원.
    expect(values.roleSalaries).toMatchObject([
      { role: 'dealer', salary: { type: 'hourly', amount: 13000 } },
    ]);
  });

  it('preserves template timing for salary-only edits and regenerates slots when counts change', () => {
    // S4: 이 테스트가 고정하는 계약은 extractTemplateData(폼 입력) → buildSeedTimeSlots 의 타이밍 보존/재생성이다.
    // 그 분기는 폼(formData) 입력에서만 발현하고(draft 입력은 슬롯 복사) draftToValues(주문서 값)로는 못 먹인다 —
    // 그래서 구 templateToFormData 로 만들던 loaded 를, 동등한 로드 폼 픽스처로 직접 구성한다(계약 판별력 불변).
    const loaded: JobPostingFormData = {
      ...INITIAL_JOB_POSTING_FORM_DATA,
      postingType: 'regular',
      title: 'Reusable Template',
      roles: [{ name: DEALER_ROLE_NAME, count: 2, salary: { type: 'hourly', amount: 13000 } }],
      dateSpecificRequirements: [],
      datedTemplateTimeSlots: [
        {
          startTime: '18:00',
          roles: [{ role: 'dealer', headcount: 2, salary: { type: 'hourly', amount: 13000 } }],
        },
      ],
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
