import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';

// RHF 3제네릭 계약 컴파일 검증(리뷰 스파이크): 단일 제네릭은 zod4×@hookform/resolvers5.2×RHF7 에서
// 컴파일 불가 → useForm<OrderSheetFormValues, unknown, OrderSheetValues> 전용이다. zodResolver 반환이
// 이 3제네릭 Resolver(z.input↔z.output 분리)와 호환되는지 tsc가 확인한다. 런타임엔 함수 여부만 스모크.
const orderSheetResolver: Resolver<OrderSheetFormValues, unknown, OrderSheetValues> =
  zodResolver(orderSheetValuesSchema);

const dealerSlot = [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 1 }] }];

// useSameSalary 기본값이 false(by_role)로 반전(설계 §S2.1)돼, 축별 테스트 기준 픽스처는
// shared를 명시한다. 기본값 자체는 아래 '기본값 false' describe에서 미지정 픽스처로 고정한다.
const validInput: OrderSheetFormValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [{ dates: ['2026-07-14'], timeSlots: dealerSlot }],
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
};

// useSameSalary·roleSalaries 미지정 — 기본값 경로(by_role) 검증용
const unspecifiedSalaryModeInput: OrderSheetFormValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [{ dates: ['2026-07-14'], timeSlots: dealerSlot }],
  salary: { type: 'hourly', amount: 20000 },
};

describe('orderSheetValuesSchema — RHF 3제네릭 계약', () => {
  it('zodResolver가 3제네릭 Resolver로 컴파일·구성된다', () => {
    expect(typeof orderSheetResolver).toBe('function');
  });
});

describe('orderSheetValuesSchema — z.input/z.output 경계', () => {
  it('default 필드가 z.output에서 채워진다 (description·roleSalaries·allowances·conditions·preQuestions·grouped)', () => {
    const parsed = orderSheetValuesSchema.parse(validInput);
    expect(parsed.description).toBe('');
    expect(parsed.roleSalaries).toEqual([]);
    expect(parsed.allowances).toEqual({});
    expect(parsed.conditions).toEqual({});
    expect(parsed.usesPreQuestions).toBe(false);
    expect(parsed.preQuestions).toEqual([]);
    // 그룹 grouped 기본 false — 묶음지원(usesGroupedDateRanges) 오분기 차단(F6)
    expect(parsed.scheduleGroups[0]?.grouped).toBe(false);
  });

  it('장소 null은 거부된다 (z.output에서 non-null 계약)', () => {
    const result = orderSheetValuesSchema.safeParse({ ...validInput, location: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('location'))).toBe(true);
    }
  });

  it('협의(other) 급여는 amount 0으로 통과한다', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      salary: { type: 'other', amount: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('협의가 아닌 급여의 amount 0은 거부된다 (superRefine)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      salary: { type: 'hourly', amount: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('복지 보장시간은 0 이상을 허용하고, 나머지는 -1(제공) 또는 양수를 허용한다', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      allowances: { guaranteedHours: 0, meal: -1, transportation: 10000 },
    });
    expect(result.success).toBe(true);
  });

  it('보장시간에 -1(PROVIDED_FLAG)은 거부된다 (시간값 계약 min 0)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      allowances: { guaranteedHours: -1 },
    });
    expect(result.success).toBe(false);
  });
});

describe('orderSheetValuesSchema — scheduleGroups (S1)', () => {
  it('그룹 0개는 거부된다 (min 1)', () => {
    const result = orderSheetValuesSchema.safeParse({ ...validInput, scheduleGroups: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('scheduleGroups'))).toBe(true);
    }
  });

  it('그룹 내 dates 0개·timeSlots 0개는 거부된다 (그룹당 min 1)', () => {
    const noDates = orderSheetValuesSchema.safeParse({
      ...validInput,
      scheduleGroups: [{ dates: [], timeSlots: dealerSlot }],
    });
    expect(noDates.success).toBe(false);
    const noSlots = orderSheetValuesSchema.safeParse({
      ...validInput,
      scheduleGroups: [{ dates: ['2026-07-14'], timeSlots: [] }],
    });
    expect(noSlots.success).toBe(false);
  });

  it('그룹 간 날짜 중복은 거부되고 issue path가 뒤 그룹의 dates를 가리킨다 (E1)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      scheduleGroups: [
        { dates: ['2026-07-14', '2026-07-15'], timeSlots: dealerSlot },
        { dates: ['2026-07-15'], timeSlots: dealerSlot }, // 중복 — 뒤에 온 그룹
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => JSON.stringify(i.path) === JSON.stringify(['scheduleGroups', 1, 'dates'])
        )
      ).toBe(true);
    }
  });

  it('합산 고유 날짜가 타입 상한(regular=7)을 넘으면 거부된다 (2차 Eng-M4/CEO-3 — 그룹 우회 차단)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      scheduleGroups: [
        { dates: ['2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'], timeSlots: dealerSlot },
        { dates: ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23'], timeSlots: dealerSlot },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('scheduleGroups'))).toBe(true);
    }
  });

  it('그룹 2개 합산 7일 이하는 통과한다', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      scheduleGroups: [
        { dates: ['2026-07-14', '2026-07-15'], timeSlots: dealerSlot, grouped: true },
        { dates: ['2026-07-20'], timeSlots: dealerSlot },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('orderSheetValuesSchema — 역할별 급여(by_role) 전수 커버 게이트(superRefine)', () => {
  // 다역할 — 그룹 2개에 분산(dealer/floor + 기타). 커버 판정은 전 그룹 순회 합집합.
  const multiRoleInput: OrderSheetFormValues = {
    ...validInput,
    scheduleGroups: [
      {
        dates: ['2026-07-14'],
        timeSlots: [
          {
            startTime: '19:00',
            roles: [
              { role: 'dealer', count: 1 },
              { role: 'floor', count: 1 },
            ],
          },
        ],
      },
      {
        dates: ['2026-07-16'],
        timeSlots: [
          { startTime: '21:00', roles: [{ role: 'other', customRole: '칩카운터', count: 1 }] },
        ],
      },
    ],
  };

  it('동일급여 OFF인데 roleSalaries가 비어 있으면 거부된다 (급여 미정 제출 차단)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      useSameSalary: false,
      roleSalaries: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('roleSalaries'))).toBe(true);
    }
  });

  it('동일급여 OFF에서 타 그룹의 역할까지 전수 커버해야 통과한다 (전 그룹 순회)', () => {
    const partial = orderSheetValuesSchema.safeParse({
      ...multiRoleInput,
      useSameSalary: false,
      // dealer/floor만 커버, 그룹2의 기타(칩카운터) 미커버
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
        { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
      ],
    });
    expect(partial.success).toBe(false);

    const full = orderSheetValuesSchema.safeParse({
      ...multiRoleInput,
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
        { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
        { role: 'other', customRole: '칩카운터', salary: { type: 'other', amount: 0 } },
      ],
    });
    expect(full.success).toBe(true);
  });

  it('동일급여 OFF에서 커버해도 amount<=0(비협의)이면 거부된다', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      useSameSalary: false,
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 0 } }],
    });
    expect(result.success).toBe(false);
  });

  it('동일급여 ON(shared)이면 roleSalaries가 비어도 무영향으로 통과한다', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      useSameSalary: true,
      roleSalaries: [],
    });
    expect(result.success).toBe(true);
  });

  it('전 그룹 고유 역할이 0개면 커버 게이트를 스킵한다 (Eng-M5 — 신규 폼 첫 onChange 소음 제거)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...unspecifiedSalaryModeInput,
      scheduleGroups: [{ dates: ['2026-07-14'], timeSlots: [] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('roleSalaries'))).toBe(false);
      expect(result.error.issues.some((i) => i.path.includes('timeSlots'))).toBe(true);
    }
  });
});

describe('orderSheetValuesSchema — useSameSalary 기본값 false (설계 §S2.1)', () => {
  it('미지정+역할 커버면 by_role(useSameSalary=false)로 통과한다', () => {
    const parsed = orderSheetValuesSchema.parse({
      ...unspecifiedSalaryModeInput,
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }],
    });
    expect(parsed.useSameSalary).toBe(false);
  });

  it('미지정+미커버면 커버 게이트가 기본 경로로 작동해 거부된다 (zod·UI 판정 3자 일치)', () => {
    const result = orderSheetValuesSchema.safeParse(unspecifiedSalaryModeInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('roleSalaries'))).toBe(true);
    }
  });
});

describe('orderSheetValuesSchema — 금액 상한 (Eng-M4)', () => {
  it('1억 초과 금액은 거부된다 (shared)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      salary: { type: 'hourly', amount: 100_000_001 },
    });
    expect(result.success).toBe(false);
  });

  it('1억 초과 역할별 금액도 거부된다 (by_role)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      useSameSalary: false,
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 100_000_001 } }],
    });
    expect(result.success).toBe(false);
  });

  it('정확히 1억은 허용된다', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      salary: { type: 'hourly', amount: 100_000_000 },
    });
    expect(result.success).toBe(true);
  });
});

describe('orderSheetValuesSchema — location.region 필수 (2026-07-15)', () => {
  it('region 없는 location은 거부된다 (지역을 선택해주세요, path location.region)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      location: { name: '라운더스 홀덤펍' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'location.region');
      expect(issue?.message).toBe('지역을 선택해주세요');
    }
  });

  it('유효 slug(구·시 전체·구없는 시)는 통과한다', () => {
    for (const region of ['서울 강남구', '부산', '강원 원주시']) {
      const result = orderSheetValuesSchema.safeParse({
        ...validInput,
        location: { name: '라운더스 홀덤펍', region },
      });
      expect(result.success).toBe(true);
    }
  });

  it('권역 문자열·비정상 값은 거부된다 (지역 값이 올바르지 않습니다)', () => {
    for (const region of ['서울', '경상', '없는지역']) {
      const result = orderSheetValuesSchema.safeParse({
        ...validInput,
        location: { name: '라운더스 홀덤펍', region },
      });
      expect(result.success).toBe(false);
    }
  });
});

// S2 — 고정(fixed) 공고 union 게이트. region 은 유효 slug(브리프 fixture 의 'seoul-gangnam' 은
// isRegionSlug 미등록 → 공유 location 게이트에 걸려 fixed 로직이 아닌 region 에서 거부되므로,
// 파일 내 기존 fixture 규약과 동일한 '서울 강남구'로 교정).
const baseFixed = {
  postingType: 'fixed' as const,
  title: '주말 고정 딜러',
  location: { name: '강남 홀덤펍', address: '서울 강남구', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [],
  fixedSchedule: {
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    roles: [{ role: 'dealer' as const, count: 3 }],
  },
  salary: { type: 'daily' as const, amount: 200000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

describe('주문서 스키마 — fixed union 게이트 (S2)', () => {
  it('유효한 고정 공고를 통과시킨다', () => {
    expect(orderSheetValuesSchema.safeParse(baseFixed).success).toBe(true);
  });

  it('fixedSchedule 부재면 fixed 제출을 거부한다', () => {
    const { fixedSchedule, ...noFixed } = baseFixed;
    expect(orderSheetValuesSchema.safeParse(noFixed).success).toBe(false);
  });

  it('역할이 없으면 거부한다(roles min 1)', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      fixedSchedule: { ...baseFixed.fixedSchedule, roles: [] },
    });
    expect(r.success).toBe(false);
  });

  it('협의가 아니면서 출근시간이 없으면 거부한다', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      fixedSchedule: {
        daysPerWeek: 5,
        isStartTimeNegotiable: false,
        roles: baseFixed.fixedSchedule.roles,
      },
    });
    expect(r.success).toBe(false);
  });

  it('협의면 출근시간 없이도 통과한다', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      fixedSchedule: {
        daysPerWeek: 0,
        isStartTimeNegotiable: true,
        roles: baseFixed.fixedSchedule.roles,
      },
    });
    expect(r.success).toBe(true);
  });

  it('by_role일 때 fixedSchedule.roles를 급여 커버 게이트로 검사한다', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      useSameSalary: false,
      roleSalaries: [], // dealer 미커버
    });
    expect(r.success).toBe(false);
  });

  it('dated(지원)는 여전히 scheduleGroups ≥1을 요구한다(무회귀)', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      postingType: 'regular',
      fixedSchedule: undefined,
      scheduleGroups: [],
    });
    expect(r.success).toBe(false);
  });
});
