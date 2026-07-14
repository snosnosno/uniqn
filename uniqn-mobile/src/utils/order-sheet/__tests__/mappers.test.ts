import {
  valuesToDraft,
  draftToValues,
  templateToValues,
  formValuesToDraft,
  gridParamsToValues,
  valuesToCreateInput,
  initialOrderSheetValues,
  primaryScheduleInfo,
} from '../mappers';
import { buildCreateJobPostingInput } from '@/utils/job-posting/submission';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { JobPostingFormData } from '@/types/jobPostingForm';
import type { JobPostingTemplate } from '@/types/jobTemplate';
import type { CreateJobPostingInput } from '@/types/jobPosting';
import { singleGroup } from './orderSheetTestHelpers';

const baseSlots: OrderSheetValues['scheduleGroups'][number]['timeSlots'] = [
  {
    startTime: '19:00',
    roles: [
      { role: 'dealer', count: 2 },
      { role: 'serving', count: 1 },
    ],
  },
];

const baseValues: OrderSheetValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: singleGroup(['2026-07-14', '2026-07-15'], baseSlots),
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: { meal: -1, transportation: 10000 },
  conditions: { dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' },
  usesPreQuestions: false,
  preQuestions: [],
};

const slotAt = (
  startTime: string,
  roles: { role: 'dealer' | 'floor' | 'serving'; count: number }[]
) => ({ startTime, roles });

const stripIds = (obj: unknown): unknown =>
  JSON.parse(JSON.stringify(obj, (key, value) => (key === 'id' ? undefined : value)));

describe('valuesToDraft — 단일 그룹 (신구 등가성)', () => {
  it('구(dates+timeSlots 평탄) 산출과 동결 스냅샷이 일치한다 (Eng-L2 — S1 전 캡처)', () => {
    // S1 착수 직전(커밋 039879eab 시점) 구 매퍼의 실제 산출을 id 제거 후 동결한 것.
    // 단일 그룹은 이 산출과 완전 동일해야 한다(무회귀 계약).
    const frozen = {
      postingType: 'regular',
      title: '주말 딜러 구합니다',
      description: '',
      location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
      contactPhone: '010-1234-5678',
      tags: [],
      schedule: {
        kind: 'dated',
        primaryDate: '2026-07-14',
        allDates: ['2026-07-14', '2026-07-15'],
        requirements: [
          {
            date: '2026-07-14',
            timeSlots: [
              {
                startTime: '19:00',
                roles: [
                  { role: 'dealer', count: 2 },
                  { role: 'serving', count: 1 },
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
                  { role: 'dealer', count: 2 },
                  { role: 'serving', count: 1 },
                ],
              },
            ],
          },
        ],
        templateTimeSlots: [
          {
            startTime: '19:00',
            roles: [
              { role: 'dealer', count: 2 },
              { role: 'serving', count: 1 },
            ],
          },
        ],
      },
      roleCatalog: [
        { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
        { role: 'serving', salary: { type: 'hourly', amount: 20000 } },
      ],
      compensation: {
        mode: 'shared',
        defaultSalary: { type: 'hourly', amount: 20000 },
        allowances: { meal: -1, transportation: 10000 },
      },
      questions: { items: [] },
      conditions: { dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' },
    };
    expect(stripIds(valuesToDraft(baseValues))).toEqual(frozen);
  });
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
    // 단일 grouped=false 그룹은 isGrouped 를 기록하지 않는다(F6 — 지원자 묶음지원 오분기 차단)
    expect(draft.schedule.requirements.some((r) => 'isGrouped' in r)).toBe(false);
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

describe('valuesToDraft — 다중 그룹 (S1)', () => {
  const slotA = [slotAt('19:00', [{ role: 'dealer', count: 2 }])];
  const slotB = [slotAt('21:00', [{ role: 'floor', count: 1 }])];

  it('그룹 flatMap — grouped=true만 isGrouped 기록, false는 키 자체 미기록 (F6/Eng-C1)', () => {
    const values: OrderSheetValues = {
      ...baseValues,
      scheduleGroups: [
        { dates: ['2026-07-20', '2026-07-21'], timeSlots: slotA, grouped: true },
        { dates: ['2026-07-25'], timeSlots: slotB, grouped: false },
      ],
    };
    const draft = valuesToDraft(values);
    if (draft.schedule.kind !== 'dated') return;
    const reqs = draft.schedule.requirements;
    expect(reqs.map((r) => r.date)).toEqual(['2026-07-20', '2026-07-21', '2026-07-25']);
    expect(reqs[0]?.isGrouped).toBe(true);
    expect(reqs[1]?.isGrouped).toBe(true);
    expect(reqs[2] && 'isGrouped' in reqs[2]).toBe(false);
    expect(reqs[2]?.timeSlots[0]?.startTime).toBe('21:00');
  });

  it('그룹 입력 순서와 무관하게 requirements·allDates는 날짜 전역 정렬, primaryDate는 최소 날짜 (2차 Eng-H1)', () => {
    const values: OrderSheetValues = {
      ...baseValues,
      scheduleGroups: [
        { dates: ['2026-07-25'], timeSlots: slotB, grouped: false },
        { dates: ['2026-07-20', '2026-07-21'], timeSlots: slotA, grouped: false },
      ],
    };
    const draft = valuesToDraft(values);
    if (draft.schedule.kind !== 'dated') return;
    expect(draft.schedule.requirements.map((r) => r.date)).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-25',
    ]);
    expect(draft.schedule.allDates).toEqual(['2026-07-20', '2026-07-21', '2026-07-25']);
    expect(draft.schedule.primaryDate).toBe('2026-07-20');
    // templateTimeSlots는 첫 그룹(입력 순서) 슬롯
    expect(draft.schedule.templateTimeSlots[0]?.startTime).toBe('21:00');
  });

  it('같은 그룹의 날짜별 requirements가 timeSlots 참조를 공유하지 않는다 (F1 deepClone)', () => {
    const values: OrderSheetValues = {
      ...baseValues,
      scheduleGroups: [{ dates: ['2026-07-20', '2026-07-21'], timeSlots: slotA, grouped: false }],
    };
    const draft = valuesToDraft(values);
    if (draft.schedule.kind !== 'dated') return;
    expect(draft.schedule.requirements[0]?.timeSlots).not.toBe(
      draft.schedule.requirements[1]?.timeSlots
    );
    expect(draft.schedule.requirements[0]?.timeSlots[0]?.roles).not.toBe(
      draft.schedule.requirements[1]?.timeSlots[0]?.roles
    );
  });

  it('uniqueRoles 파생(roleCatalog·커버 게이트)은 전 그룹 순회 합집합이다', () => {
    const values: OrderSheetValues = {
      ...baseValues,
      scheduleGroups: [
        { dates: ['2026-07-20'], timeSlots: slotA, grouped: false }, // dealer
        { dates: ['2026-07-21'], timeSlots: slotB, grouped: false }, // floor
      ],
    };
    expect(
      valuesToDraft(values)
        .roleCatalog.map((r) => r.role)
        .sort()
    ).toEqual(['dealer', 'floor']);
  });
});

describe('draftToValues — 그룹핑 복원 (S1, M8 throw 제거)', () => {
  const mk = (
    date: string,
    startTime: string,
    role: 'dealer' | 'floor' = 'dealer',
    isGrouped?: boolean
  ) => ({
    date,
    timeSlots: [{ id: `s-${date}`, startTime, roles: [{ id: `r-${date}`, role, count: 1 }] }],
    ...(isGrouped === true ? { isGrouped: true } : {}),
  });

  const draftWith = (requirements: ReturnType<typeof mk>[]) => {
    const base = valuesToDraft(baseValues);
    if (base.schedule.kind !== 'dated') throw new Error('unreachable');
    return {
      ...base,
      schedule: {
        ...base.schedule,
        allDates: requirements.map((r) => r.date).sort(),
        primaryDate: requirements.map((r) => r.date).sort()[0]!,
        requirements,
      },
    };
  };

  it('구 M8 케이스(날짜별 시간대 상이)가 throw 없이 그룹으로 복원된다', () => {
    const draft = draftWith([mk('2026-07-14', '19:00'), mk('2026-07-15', '21:00')]);
    const values = draftToValues(draft);
    expect(values.scheduleGroups).toEqual([
      {
        dates: ['2026-07-14'],
        timeSlots: [slotAt('19:00', [{ role: 'dealer', count: 1 }])],
        grouped: false,
      },
      {
        dates: ['2026-07-15'],
        timeSlots: [slotAt('21:00', [{ role: 'dealer', count: 1 }])],
        grouped: false,
      },
    ]);
  });

  it('isGrouped 연속 run은 동일 시그니처 경계를 보존하며 grouped 그룹으로 복원된다 (2차 Eng-H1)', () => {
    const draft = draftWith([
      mk('2026-07-20', '19:00', 'dealer', true),
      mk('2026-07-21', '19:00', 'dealer', true),
      mk('2026-07-22', '21:00', 'dealer', true), // 시그니처 변경 — 경계
    ]);
    const values = draftToValues(draft);
    expect(values.scheduleGroups).toEqual([
      {
        dates: ['2026-07-20', '2026-07-21'],
        timeSlots: [slotAt('19:00', [{ role: 'dealer', count: 1 }])],
        grouped: true,
      },
      {
        dates: ['2026-07-22'],
        timeSlots: [slotAt('21:00', [{ role: 'dealer', count: 1 }])],
        grouped: true,
      },
    ]);
  });

  it('isGrouped run은 비연속 날짜에서 끊긴다', () => {
    const draft = draftWith([
      mk('2026-07-20', '19:00', 'dealer', true),
      mk('2026-07-22', '19:00', 'dealer', true), // 7/21 없음 — run 단절
    ]);
    const values = draftToValues(draft);
    expect(values.scheduleGroups.map((g) => g.dates)).toEqual([['2026-07-20'], ['2026-07-22']]);
    expect(values.scheduleGroups.every((g) => g.grouped)).toBe(true);
  });

  it('falsy isGrouped는 시그니처 병합 — 비연속 동일 조건 날짜들이 한 그룹으로 (정규형 수용)', () => {
    const draft = draftWith([
      mk('2026-07-20', '19:00'),
      mk('2026-07-21', '21:00'),
      mk('2026-07-23', '19:00'), // 7/20과 동일 시그니처 — 병합
    ]);
    const values = draftToValues(draft);
    expect(values.scheduleGroups).toEqual([
      {
        dates: ['2026-07-20', '2026-07-23'],
        timeSlots: [slotAt('19:00', [{ role: 'dealer', count: 1 }])],
        grouped: false,
      },
      {
        dates: ['2026-07-21'],
        timeSlots: [slotAt('21:00', [{ role: 'dealer', count: 1 }])],
        grouped: false,
      },
    ]);
  });

  it('fixed 스케줄 draft는 throw한다 (키오스크 범위 밖)', () => {
    const fixedDraft = {
      ...INITIAL_JOB_POSTING_DRAFT,
      schedule: { kind: 'fixed' as const, requirements: [] },
    };
    expect(() => draftToValues(fixedDraft)).toThrow();
  });
});

describe('draftToValues ↔ valuesToDraft 왕복', () => {
  it('values→draft→values가 동치다 (단일 그룹 — 신구 등가성)', () => {
    const roundTrip = draftToValues(valuesToDraft(baseValues));
    expect(roundTrip).toEqual(baseValues);
  });

  it('다중 그룹(grouped 포함) 왕복이 동치다', () => {
    const values: OrderSheetValues = {
      ...baseValues,
      scheduleGroups: [
        {
          dates: ['2026-07-20', '2026-07-21'],
          timeSlots: [slotAt('19:00', [{ role: 'dealer', count: 2 }])],
          grouped: true,
        },
        {
          dates: ['2026-07-25'],
          timeSlots: [slotAt('21:00', [{ role: 'dealer', count: 1 }])],
          grouped: false,
        },
      ],
    };
    expect(draftToValues(valuesToDraft(values))).toEqual(values);
  });

  it('"날짜마다 따로"(동일 조건 개별 그룹들)는 정규형(시그니처 병합 단일 그룹)으로 왕복된다', () => {
    const slots = [slotAt('19:00', [{ role: 'dealer', count: 1 }])];
    const values: OrderSheetValues = {
      ...baseValues,
      scheduleGroups: [
        { dates: ['2026-07-20'], timeSlots: slots, grouped: false },
        { dates: ['2026-07-22'], timeSlots: slots, grouped: false },
      ],
    };
    // 지원자 화면 산출이 동일해 정규형으로 수용(설계 §S1 매퍼 읽기) — 개별 그룹 경계는 유지되지 않는다.
    expect(draftToValues(valuesToDraft(values)).scheduleGroups).toEqual([
      { dates: ['2026-07-20', '2026-07-22'], timeSlots: slots, grouped: false },
    ]);
  });

  it('draft→values→draft 멱등 — isGrouped·개별 선택이 보존된다 (리뷰 Eng-M1)', () => {
    const values: OrderSheetValues = {
      ...baseValues,
      scheduleGroups: [
        {
          dates: ['2026-07-20', '2026-07-21'],
          timeSlots: [slotAt('19:00', [{ role: 'dealer', count: 2 }])],
          grouped: true,
        },
        {
          dates: ['2026-07-23'],
          timeSlots: [slotAt('21:00', [{ role: 'floor', count: 1 }])],
          grouped: false,
        },
      ],
    };
    const draft1 = valuesToDraft(values);
    const draft2 = valuesToDraft(draftToValues(draft1) as OrderSheetValues);
    expect(stripIds(draft2)).toEqual(stripIds(draft1));
  });

  it('레거시 협의(other) 공고는 협의로 유지된다 (2026-07-14 결정 — hourly 강제 변환 금지)', () => {
    const draft = valuesToDraft({ ...baseValues, salary: { type: 'other', amount: 0 } });
    expect(draftToValues(draft).salary).toEqual({ type: 'other', amount: 0 });
  });
  it('shared 모드에서는 roleSalaries가 되채워지지 않는다 (Design B 두 번째 변경 회귀 가드 — draftToValues by_role 게이트)', () => {
    const draft = valuesToDraft(baseValues); // useSameSalary: true
    expect(draft.roleCatalog.every((r) => r.salary !== undefined)).toBe(true);
    expect(draftToValues(draft).roleSalaries).toEqual([]);
  });
  it('by_role 왕복 — roleSalaries(순서 포함)와 useSameSalary=false를 보존한다 (Design B 두 번째 변경 복원 분기 커버)', () => {
    const byRoleValues: OrderSheetValues = {
      ...baseValues,
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
        { role: 'serving', salary: { type: 'other', amount: 0 } },
      ],
    };
    const roundTrip = draftToValues(valuesToDraft(byRoleValues));
    expect(roundTrip.useSameSalary).toBe(false);
    expect(roundTrip.roleSalaries).toEqual([
      { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
      { role: 'serving', salary: { type: 'other', amount: 0 } },
    ]);
    // salary(세그먼트 캐리어)는 defaultSalary=최저값 정규화(CEO-1)로 25,000이 된다 — 정규형 동치.
    expect(roundTrip).toEqual({ ...byRoleValues, salary: { type: 'hourly', amount: 25000 } });
    expect(
      stripIds(valuesToDraft(draftToValues(valuesToDraft(byRoleValues)) as OrderSheetValues))
    ).toEqual(stripIds(valuesToDraft(byRoleValues)));
  });

  it('by_role의 defaultSalary는 roleSalaries 최저값 — 유령 초기값(세그먼트 캐리어) 아님 (CEO-1)', () => {
    const byRole: OrderSheetValues = {
      ...baseValues,
      salary: { type: 'hourly', amount: 20000 },
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
        { role: 'serving', salary: { type: 'hourly', amount: 23000 } },
      ],
    };
    expect(valuesToDraft(byRole).compensation.defaultSalary).toEqual({
      type: 'hourly',
      amount: 23000,
    });
  });

  it('고아(전 그룹 어디에도 없는 역할) 엔트리는 defaultSalary 최저값 산정에서 제외한다 (리뷰 H-1)', () => {
    const withOrphan: OrderSheetValues = {
      ...baseValues,
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
        { role: 'serving', salary: { type: 'hourly', amount: 26000 } },
        { role: 'floor', salary: { type: 'hourly', amount: 15000 } }, // 고아 — 슬롯에 없음
      ],
    };
    expect(valuesToDraft(withOrphan).compensation.defaultSalary).toEqual({
      type: 'hourly',
      amount: 25000,
    });
  });

  it('by_role 전원 협의(other)면 defaultSalary도 협의로 기록된다', () => {
    const byRole: OrderSheetValues = {
      ...baseValues,
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'other', amount: 0 } },
        { role: 'serving', salary: { type: 'other', amount: 0 } },
      ],
    };
    expect(valuesToDraft(byRole).compensation.defaultSalary).toEqual({
      type: 'other',
      amount: 0,
    });
  });

  it('initialOrderSheetValues는 by_role 기본 + 빈 단일 그룹', () => {
    const initial = initialOrderSheetValues();
    expect(initial.useSameSalary).toBe(false);
    expect(initial.roleSalaries).toEqual([]);
    expect(initial.scheduleGroups).toEqual([{ dates: [], timeSlots: [], grouped: false }]);
  });
});

describe('신·구 동등성 (레거시 폼 경로 대비)', () => {
  const stripReqIds = (reqs: CreateJobPostingInput['schedule']['requirements']) =>
    reqs.map((req) => ({
      ...req,
      timeSlots: req.timeSlots.map(({ id: _slotId, ...slot }) => ({
        ...slot,
        roles: slot.roles.map(({ id: _roleId, ...role }) => role),
      })),
    }));

  it('같은 입력 의도의 레거시 formData와 CreateJobPostingInput이 동등하다', () => {
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
    );
    expect(kiosk.roleCatalog).toEqual(legacy.roleCatalog);
  });
});

describe('gridParamsToValues (정규화 + 직접 조립 — INITIAL 경유 금지)', () => {
  it('venueId·date·count가 단일 그룹 주문서 값으로 흡수된다', () => {
    const values = gridParamsToValues({
      venueId: '00000000-0000-4000-8000-000000000001',
      date: '2026-07-20',
      count: 3,
    });
    expect(values.venueId).toBe('00000000-0000-4000-8000-000000000001');
    expect(values.scheduleGroups?.[0]?.dates).toEqual(['2026-07-20']);
    expect(values.scheduleGroups?.[0]?.timeSlots?.[0]?.roles?.[0]).toMatchObject({
      role: 'dealer',
      count: 3,
    });
    expect(values.useSameSalary).toBe(false);
    expect(values.roleSalaries).toEqual([
      { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
    ]);
  });
  it('비정상 파라미터는 정규화된다 (비-UUID venueId drop, count 1..99 클램프 — 보안 리뷰)', () => {
    expect('venueId' in gridParamsToValues({ venueId: 'not-a-uuid', date: '2026-07-20' })).toBe(
      false
    );
    expect(
      gridParamsToValues({ date: '2026-07-20', count: 500 }).scheduleGroups?.[0]?.timeSlots?.[0]
        ?.roles?.[0]?.count
    ).toBe(99);
  });
  it('파라미터 없으면 initialOrderSheetValues와 동일 (venueId 키 부재 무회귀 계약)', () => {
    expect(gridParamsToValues({})).toEqual(initialOrderSheetValues());
  });
});

describe('formValuesToDraft (프리셋 저장 — z.input 폼 값 → draft, 검증 우회)', () => {
  it('optional/default 필드가 비어도 SSOT 기본값으로 채워 draft 를 만든다 (grouped ?? false 포함)', () => {
    const partial: OrderSheetFormValues = {
      postingType: 'regular',
      title: '주말 딜러',
      location: { name: '라운더스 홀덤펍' },
      contactPhone: '010-1234-5678',
      // z.input 경로 — grouped 미지정 그룹도 수용(최종 검증 NIT-2)
      scheduleGroups: [
        { dates: [], timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }] },
      ],
      salary: { type: 'hourly', amount: 20000 },
    };
    const draft = formValuesToDraft(partial);
    expect(draft.title).toBe('주말 딜러');
    expect(draft.description).toBe('');
    expect(draft.compensation.mode).toBe('by_role');
    expect(draft.questions.items).toEqual([]);
    expect(draft.location).toEqual({ name: '라운더스 홀덤펍' });
    if (draft.schedule.kind !== 'dated') return;
    expect(draft.schedule.templateTimeSlots[0]?.startTime).toBe('19:00');
  });

  it('장소 미선택(null) 상태도 저장 가능 — draft.location=null', () => {
    const partial: OrderSheetFormValues = {
      postingType: 'regular',
      title: '제목만',
      location: null,
      contactPhone: '010-0000-0000',
      scheduleGroups: [],
      salary: { type: 'hourly', amount: 20000 },
    };
    const draft = formValuesToDraft(partial);
    expect(draft.location).toBeNull();
    expect(draft.title).toBe('제목만');
  });
});

describe('templateToValues', () => {
  it('템플릿 로드 시 그룹 구조·timeSlots는 유지하고 각 그룹 dates만 비운다 (F4)', () => {
    const multiGroupDraft = valuesToDraft({
      ...baseValues,
      scheduleGroups: [
        {
          dates: ['2026-07-20', '2026-07-21'],
          timeSlots: [slotAt('19:00', [{ role: 'dealer', count: 2 }])],
          grouped: true,
        },
        {
          dates: ['2026-07-25'],
          timeSlots: [slotAt('21:00', [{ role: 'floor', count: 1 }])],
          grouped: false,
        },
      ],
    });
    const template: JobPostingTemplate = {
      id: 't2',
      userId: 'u1',
      name: '다중 그룹',
      description: null,
      createdAt: null,
      updatedAt: null,
      usageCount: 0,
      templateData: {
        title: '다중 그룹 공고',
        schedule: multiGroupDraft.schedule,
        compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 20000 } },
      },
    };
    const values = templateToValues(template);
    expect(values.scheduleGroups).toHaveLength(2);
    expect(values.scheduleGroups?.every((g) => g.dates.length === 0)).toBe(true);
    expect(values.scheduleGroups?.[0]?.timeSlots?.[0]?.startTime).toBe('19:00');
    expect(values.scheduleGroups?.[0]?.grouped).toBe(true);
    expect(values.scheduleGroups?.[1]?.timeSlots?.[0]?.startTime).toBe('21:00');
  });

  it('schedule 없는 템플릿은 빈 단일 그룹으로 시작한다', () => {
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
    expect(values.title).toBe('주말 딜러 구합니다');
    expect(values.scheduleGroups?.every((g) => g.dates.length === 0)).toBe(true);
    expect((values.scheduleGroups?.length ?? 0) >= 1).toBe(true);
  });
});

describe('primaryScheduleInfo (완료 화면 요약 — 리뷰 Eng-M2)', () => {
  it('전 그룹 최소 날짜 + 그 그룹 첫 슬롯 출근시간 + 고유 날짜 수를 산출한다', () => {
    const values: OrderSheetValues = {
      ...baseValues,
      scheduleGroups: [
        {
          dates: ['2026-07-25'],
          timeSlots: [slotAt('21:00', [{ role: 'floor', count: 1 }])],
          grouped: false,
        },
        {
          dates: ['2026-07-20', '2026-07-21'],
          timeSlots: [slotAt('19:00', [{ role: 'dealer', count: 2 }])],
          grouped: true,
        },
      ],
    };
    expect(primaryScheduleInfo(values)).toEqual({
      primaryDate: '2026-07-20',
      startTime: '19:00',
      totalDates: 3,
    });
  });
  it('빈 일정이면 undefined 필드 + 0', () => {
    expect(primaryScheduleInfo({ ...baseValues, scheduleGroups: [] })).toEqual({
      primaryDate: undefined,
      startTime: undefined,
      totalDates: 0,
    });
  });
});
