import {
  valuesToDraft,
  draftToValues,
  templateToValues,
  gridParamsToValues,
  valuesToCreateInput,
  initialOrderSheetValues,
} from '../mappers';
import { buildCreateJobPostingInput } from '@/utils/job-posting/submission';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { JobPostingFormData } from '@/types/jobPostingForm';
import type { JobPostingTemplate } from '@/types/jobTemplate';
import type { CreateJobPostingInput } from '@/types/jobPosting';

const baseValues: OrderSheetValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  dates: ['2026-07-14', '2026-07-15'],
  timeSlots: [
    {
      startTime: '19:00',
      roles: [
        { role: 'dealer', count: 2 },
        { role: 'serving', count: 1 },
      ],
    },
  ],
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: { meal: -1, transportation: 10000 },
  conditions: { dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' },
  usesPreQuestions: false,
  preQuestions: [],
};

describe('valuesToDraft', () => {
  it('dated 스케줄을 canonical하게 만든다 (날짜별 requirements, 시간대·역할 보존)', () => {
    const draft = valuesToDraft(baseValues);
    expect(draft.schedule.kind).toBe('dated');
    if (draft.schedule.kind !== 'dated') return;
    expect(draft.schedule.allDates).toEqual(['2026-07-14', '2026-07-15']);
    expect(draft.schedule.primaryDate).toBe('2026-07-14');
    expect(draft.schedule.requirements).toHaveLength(2);
    expect(draft.schedule.requirements[0]?.timeSlots[0]?.roles).toEqual([
      { id: expect.any(String), role: 'dealer', count: 2 },
      { id: expect.any(String), role: 'serving', count: 1 },
    ]);
  });
  it('동일급여면 compensation.mode=shared + defaultSalary', () => {
    const draft = valuesToDraft(baseValues);
    expect(draft.compensation.mode).toBe('shared');
    expect(draft.compensation.defaultSalary).toEqual({ type: 'hourly', amount: 20000 });
  });
  it('roleCatalog는 슬롯 역할의 중복 제거 합집합', () => {
    const draft = valuesToDraft(baseValues);
    expect(draft.roleCatalog.map((r) => r.role).sort()).toEqual(['dealer', 'serving']);
  });
  it('conditions·allowances(-1 제공 플래그 포함)를 보존한다', () => {
    const draft = valuesToDraft(baseValues);
    expect(draft.conditions).toEqual(baseValues.conditions);
    expect(draft.compensation.allowances).toEqual({ meal: -1, transportation: 10000 });
  });
  it('useSameSalary=false면 mode=by_role + roleCatalog에 역할별 급여가 실린다 (2026-07-14 결정)', () => {
    const byRole: OrderSheetValues = {
      ...baseValues,
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
        { role: 'serving', salary: { type: 'other', amount: 0 } }, // 역할별 협의도 가능
      ],
    };
    const draft = valuesToDraft(byRole);
    expect(draft.compensation.mode).toBe('by_role');
    expect(draft.roleCatalog.find((r) => r.role === 'dealer')?.salary).toEqual({
      type: 'hourly',
      amount: 25000,
    });
    expect(draft.roleCatalog.find((r) => r.role === 'serving')?.salary).toEqual({
      type: 'other',
      amount: 0,
    });
  });
  it('협의(other) 급여는 amount 0으로 발행된다', () => {
    const draft = valuesToDraft({ ...baseValues, salary: { type: 'other', amount: 0 } });
    expect(draft.compensation.defaultSalary).toEqual({ type: 'other', amount: 0 });
  });
  it('날짜별 requirements가 슬롯 배열 참조를 공유하지 않고 slot/role에 id가 부여된다 (gridPrefill 관례)', () => {
    const draft = valuesToDraft(baseValues);
    if (draft.schedule.kind !== 'dated') return;
    expect(draft.schedule.requirements[0]?.timeSlots).not.toBe(
      draft.schedule.requirements[1]?.timeSlots
    );
    expect(draft.schedule.requirements[0]?.timeSlots[0]?.id).toBeTruthy();
  });
});

describe('draftToValues ↔ valuesToDraft 왕복', () => {
  it('values→draft→values가 동치다 (values에는 id가 없어 draft에서 생성된 slot/role id는 왕복에 영향 없음)', () => {
    const roundTrip = draftToValues(valuesToDraft(baseValues));
    expect(roundTrip).toEqual(baseValues);
  });
  it('fixed 스케줄 draft는 throw한다 (키오스크 범위 밖)', () => {
    const fixedDraft = {
      ...INITIAL_JOB_POSTING_DRAFT,
      schedule: { kind: 'fixed' as const, requirements: [] },
    };
    expect(() => draftToValues(fixedDraft)).toThrow();
  });
  it('날짜별 시간대가 상이한 draft는 throw한다 (조용한 평탄화 금지 — 프리셋에서 스킵, 리뷰 M8)', () => {
    const base = valuesToDraft(baseValues);
    if (base.schedule.kind !== 'dated') return;
    const heterogeneous = {
      ...base,
      schedule: {
        ...base.schedule,
        requirements: [
          {
            date: '2026-07-14',
            timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 1 }] }],
          },
          {
            date: '2026-07-15',
            timeSlots: [{ startTime: '21:00', roles: [{ role: 'dealer' as const, count: 1 }] }],
          },
        ],
      },
    };
    expect(() => draftToValues(heterogeneous)).toThrow();
  });
  it('레거시 협의(other) 공고는 협의로 유지된다 (2026-07-14 결정 — hourly 강제 변환 금지)', () => {
    const draft = valuesToDraft({ ...baseValues, salary: { type: 'other', amount: 0 } });
    expect(draftToValues(draft).salary).toEqual({ type: 'other', amount: 0 });
  });
  it('shared 모드에서는 roleSalaries가 되채워지지 않는다 (Design B 두 번째 변경 회귀 가드 — draftToValues by_role 게이트)', () => {
    // Design B 첫 변경으로 shared draft 의 roleCatalog 엔트리는 모두 defaultSalary 를 갖는다.
    // draftToValues 가 by_role 게이트 없이 roleCatalog salary 를 전수 복원하면 roleSalaries 가 오염돼
    // 왕복이 깨진다(shared 인데 roleSalaries != []). shared → roleSalaries=[] 를 명시 고정한다.
    const draft = valuesToDraft(baseValues); // useSameSalary: true
    expect(draft.roleCatalog.every((r) => r.salary !== undefined)).toBe(true); // 첫 변경 확인
    expect(draftToValues(draft).roleSalaries).toEqual([]); // 두 번째 변경(게이트) 확인
  });
});

describe('신·구 동등성 (레거시 폼 경로 대비)', () => {
  // ⚠️ 동어반복 금지(리뷰 HIGH): buildCreateJobPostingInput(draft)는 draftToCreateJobPostingInput을
  // 그대로 부르므로 valuesToDraft 결과를 넣어 비교하면 같은 함수를 두 번 부르는 것이다.
  // 반드시 JobPostingFormData(레거시 폼 표현) 픽스처를 경유해 비교한다.

  // draft 슬롯/역할의 생성 id 는 비결정적이라 구조 비교 전 벗긴다(브리프 "id 등 생성 필드는 normalize 후 비교").
  const stripReqIds = (reqs: CreateJobPostingInput['schedule']['requirements']) =>
    reqs.map((req) => ({
      ...req,
      timeSlots: req.timeSlots.map(({ id: _slotId, ...slot }) => ({
        ...slot,
        roles: slot.roles.map(({ id: _roleId, ...role }) => role),
      })),
    }));

  it('같은 입력 의도의 레거시 formData와 CreateJobPostingInput이 동등하다', () => {
    // baseValues 와 같은 의도(단일 시간대 19:00·딜러2+서빙1·shared 시급 20,000·복지 동일·2일)로
    // 레거시 폼 표현(JobPostingFormData)을 조립한다. roles=[]로 두어 roleCatalog 는 슬롯에서만 파생.
    // (submission.test.ts:37 createFormData 픽스처 패턴 참조 — INITIAL 스프레드 + 오버라이드)
    const legacyFormData: JobPostingFormData = {
      ...INITIAL_JOB_POSTING_FORM_DATA,
      postingType: 'regular',
      title: '주말 딜러 구합니다',
      location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
      contactPhone: '010-1234-5678',
      description: '',
      roles: [],
      useSameSalary: true,
      defaultSalary: { type: 'hourly', amount: 20000 },
      allowances: { meal: -1, transportation: 10000 },
      workDate: '2026-07-14',
      dateSpecificRequirements: [
        {
          date: '2026-07-14',
          timeSlots: [
            {
              startTime: '19:00',
              roles: [
                { role: 'dealer', headcount: 2 },
                { role: 'serving', headcount: 1 },
              ],
            },
          ],
        },
        {
          date: '2026-07-15',
          timeSlots: [
            {
              startTime: '19:00',
              roles: [
                { role: 'dealer', headcount: 2 },
                { role: 'serving', headcount: 1 },
              ],
            },
          ],
        },
      ],
      usesPreQuestions: false,
      preQuestions: [],
    };
    const legacy = buildCreateJobPostingInput(legacyFormData);
    const kiosk = valuesToCreateInput(baseValues);
    expect(kiosk.compensation).toEqual(legacy.compensation);
    expect(stripReqIds(kiosk.schedule.requirements)).toEqual(
      stripReqIds(legacy.schedule.requirements)
    ); // id 등 생성 필드는 normalize 후 비교
    expect(kiosk.roleCatalog).toEqual(legacy.roleCatalog);
  });
});

describe('gridParamsToValues (정규화 + 직접 조립 — INITIAL 경유 금지)', () => {
  it('venueId·date·count가 주문서 값으로 흡수된다', () => {
    const values = gridParamsToValues({
      venueId: '00000000-0000-4000-8000-000000000001',
      date: '2026-07-20',
      count: 3,
    });
    expect(values.venueId).toBe('00000000-0000-4000-8000-000000000001');
    expect(values.dates).toEqual(['2026-07-20']);
    expect(values.timeSlots?.[0]?.roles?.[0]).toMatchObject({ role: 'dealer', count: 3 });
    expect(values.useSameSalary).toBe(true); // INITIAL의 by_role 유입 차단 확인
  });
  it('비정상 파라미터는 정규화된다 (비-UUID venueId drop, count 1..99 클램프 — 보안 리뷰)', () => {
    expect('venueId' in gridParamsToValues({ venueId: 'not-a-uuid', date: '2026-07-20' })).toBe(
      false
    );
    expect(
      gridParamsToValues({ date: '2026-07-20', count: 500 }).timeSlots?.[0]?.roles?.[0]?.count
    ).toBe(99);
  });
  it('파라미터 없으면 initialOrderSheetValues와 동일 (venueId 키 부재 무회귀 계약)', () => {
    expect(gridParamsToValues({})).toEqual(initialOrderSheetValues());
  });
});

describe('templateToValues', () => {
  it('템플릿 로드 시 날짜는 비운다', () => {
    const template: JobPostingTemplate = {
      id: 't1',
      userId: 'u1',
      name: '주말 딜러',
      description: null,
      createdAt: null,
      updatedAt: null,
      usageCount: 0,
      templateData: {
        title: '주말 딜러 구합니다',
        compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 20000 } },
      },
    };
    const values = templateToValues(template);
    expect(values.dates).toEqual([]);
    expect(values.title).toBe('주말 딜러 구합니다');
  });
});
