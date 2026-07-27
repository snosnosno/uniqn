import {
  draftToCreateJobPostingInput,
  draftToUpdateJobPostingInput,
  formDataToDraft,
  jobPostingToDraft,
} from '../draftAdapter';
// S4(레거시 은퇴): draftToFormData(폼 읽기 방향) 제거 후, 라이브 읽기 렌즈는 주문서 매퍼 draftToValues 로 단일화.
import { draftToValues } from '@/utils/order-sheet/mappers';
import { INITIAL_JOB_POSTING_DRAFT, type JobPostingDraft } from '@/types/jobPostingDraft';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { JobPosting } from '@/types';

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

// S4 이주: 구 draftToFormData(폼 roles) 렌즈 → draftToValues(주문서 라이브 읽기) 렌즈.
// 역할 surfacing 은 values.scheduleGroups?.[].timeSlots[].roles(canonical role/count)로 어서션.
describe('draftAdapter dated seed handling (draftToValues 렌즈)', () => {
  it('빈 요청의 신규 draft 는 기본 dated 역할로 딜러·플로어를 노출한다', () => {
    const values = draftToValues(INITIAL_JOB_POSTING_DRAFT);

    // requirements 없는 draft → templateTimeSlots(기본 딜러/플로어 count 1) 단일 그룹으로 복원.
    expect(values.scheduleGroups?.[0]?.timeSlots[0]?.roles).toMatchObject([
      { role: 'dealer', count: 1 },
      { role: 'floor', count: 1 },
    ]);
  });

  it('역할을 첫 요청 기준으로 노출하고 날짜 전체를 합산하지 않는다', () => {
    const values = draftToValues(createDatedDraft());

    // draftToValues 는 canonical location 을 그대로 전달 — 폼 레거시 address 가 아니라 district 축.
    expect(values.location?.district).toBe('Gangnam-daero');
    // 첫 날짜 그룹은 count 2(합산 7 아님) — 날짜별 requirements 가 개별 그룹으로 분리 보존된다.
    expect(values.scheduleGroups?.[0]?.timeSlots[0]?.roles).toMatchObject([
      { role: 'dealer', count: 2 },
    ]);
    // 둘째 날짜 그룹은 count 5 로 독립 유지(합산 발산 회귀 가드).
    expect(values.scheduleGroups?.[1]?.timeSlots[0]?.roles).toMatchObject([
      { role: 'dealer', count: 5 },
    ]);
    // by_role 급여(13000)는 roleSalaries 로 복원.
    expect(values.roleSalaries).toMatchObject([
      { role: 'dealer', salary: { type: 'hourly', amount: 13000 } },
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

  // fixed draft→form 왕복(구 draftToFormData)은 삭제 — 라이브 동등물이 주문서 매퍼 fixed 왕복
  // ('draftToValues가 fixed draft를 폼 값으로 복원한다' — mappers.test.ts '고정(fixed) 매퍼 왕복 (S2)')에 존재.
});

describe('draftAdapter location.region 보존', () => {
  function draftWithRegion(): JobPostingDraft {
    const base = createDatedDraft();
    return {
      ...base,
      location: { ...base.location!, region: '서울 강남구' },
    };
  }

  it('draftToValues 가 region 을 보존한다 (주문서 값 표시)', () => {
    const values = draftToValues(draftWithRegion());
    expect(values.location?.region).toBe('서울 강남구');
  });

  it('draftToCreateJobPostingInput 가 region 을 저장 페이로드에 포함한다', () => {
    const input = draftToCreateJobPostingInput(draftWithRegion());
    expect((input.location as { region?: string }).region).toBe('서울 강남구');
  });

  it('formDataToDraft → draftToCreateJobPostingInput 전체 경로에서 region 이 살아남는다', () => {
    // 구 draftToFormData 로 폼을 만들던 레그를 직접 폼 픽스처로 대체(형상 소멸) — 검사 대상은
    // formDataToDraft(레거시 폼→draft, 존치) 경로의 region 보존이라 계약 판별력 동일.
    const form = {
      ...INITIAL_JOB_POSTING_FORM_DATA,
      location: { name: 'Seoul', address: 'Gangnam-daero', region: '서울 강남구' },
    };
    const input = draftToCreateJobPostingInput(formDataToDraft(form));
    expect((input.location as { region?: string }).region).toBe('서울 강남구');
  });
});

// R8(최고 회귀위험): venue_id 를 draft 경로 전수배선. region 유실 함정(#194) 패턴 재현 방지.
describe('draftAdapter venue_id 전수배선', () => {
  const VENUE_ID = 'venue-container-1';

  function draftWithVenueId(): JobPostingDraft {
    return { ...createDatedDraft(), venueId: VENUE_ID };
  }

  function postingWithVenueId(): JobPosting {
    return {
      ...createDatedDraft(),
      id: 'posting-1',
      status: 'active',
      ownerId: 'owner-1',
      workDate: '2026-04-10',
      totalPositions: 7,
      filledPositions: 0,
      venueId: VENUE_ID,
    } as unknown as JobPosting;
  }

  it('draftToValues 가 venueId 를 보존한다 (주문서 값 표시)', () => {
    const values = draftToValues(draftWithVenueId());
    expect(values.venueId).toBe(VENUE_ID);
  });

  it('formDataToDraft 가 폼의 venueId 를 draft 로 보존한다 (form→draft)', () => {
    const form = { ...INITIAL_JOB_POSTING_FORM_DATA, venueId: VENUE_ID };
    expect(formDataToDraft(form).venueId).toBe(VENUE_ID);
  });

  it('draftToCreateJobPostingInput 가 venueId 를 생성 페이로드에 포함한다', () => {
    const input = draftToCreateJobPostingInput(draftWithVenueId());
    expect((input as { venueId?: string }).venueId).toBe(VENUE_ID);
  });

  // form→draft→form 왕복(구 draftToFormData)은 삭제 — venueId 보존은 위 draftToValues 렌즈 +
  // formDataToDraft(form→draft) 어서션이 커버(형상 소멸분 제거).

  it('jobPostingToDraft → draftToUpdateJobPostingInput 왕복에서 venueId 가 보존된다 (clobber 방지)', () => {
    const draft = jobPostingToDraft(postingWithVenueId());
    expect(draft.venueId).toBe(VENUE_ID);
    const update = draftToUpdateJobPostingInput(draft);
    expect((update as { venueId?: string }).venueId).toBe(VENUE_ID);
  });

  it('draft 직접 조립 경로에서도 venueId 를 보존한다', () => {
    const update = draftToUpdateJobPostingInput(draftWithVenueId());
    expect((update as { venueId?: string }).venueId).toBe(VENUE_ID);
  });

  // 무회귀: venue_id 없는 일반 공고는 어떤 경로에서도 venueId 키가 생기지 않아야 한다.
  // (구 form 레그는 draftToFormData 소멸로 제거 — draft/create/update 레그로 계약 유지.)
  it('venueId 없는 일반 공고는 draft/create/update 에 venueId 키가 부재한다', () => {
    const draft = createDatedDraft();
    expect(Object.prototype.hasOwnProperty.call(draft, 'venueId')).toBe(false);

    const create = draftToCreateJobPostingInput(draft);
    expect(Object.prototype.hasOwnProperty.call(create, 'venueId')).toBe(false);

    const update = draftToUpdateJobPostingInput(draft);
    expect(Object.prototype.hasOwnProperty.call(update, 'venueId')).toBe(false);
  });

  // 무회귀: 고정공고 lifecycle 도 venueId 미설정 시 불변(왕복 동일).
  it('고정공고 round-trip 은 venueId 미설정 시 무회귀(키 부재)', () => {
    const fixedForm = {
      ...INITIAL_JOB_POSTING_FORM_DATA,
      postingType: 'fixed' as const,
      title: 'Fixed posting',
      location: { name: 'Seoul' },
      daysPerWeek: 5,
      startTime: '19:00',
      isStartTimeNegotiable: false,
      roles: [{ name: '딜러', count: 3, isCustom: false }],
    };
    const draft = formDataToDraft(fixedForm);
    expect(Object.prototype.hasOwnProperty.call(draft, 'venueId')).toBe(false);
    const create = draftToCreateJobPostingInput(draft);
    expect(Object.prototype.hasOwnProperty.call(create, 'venueId')).toBe(false);
  });
});
