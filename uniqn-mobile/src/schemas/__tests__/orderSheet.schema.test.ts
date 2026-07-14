import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';

// RHF 3제네릭 계약 컴파일 검증(리뷰 스파이크): 단일 제네릭은 zod4×@hookform/resolvers5.2×RHF7 에서
// 컴파일 불가 → useForm<OrderSheetFormValues, unknown, OrderSheetValues> 전용이다. zodResolver 반환이
// 이 3제네릭 Resolver(z.input↔z.output 분리)와 호환되는지 tsc가 확인한다. 런타임엔 함수 여부만 스모크.
const orderSheetResolver: Resolver<OrderSheetFormValues, unknown, OrderSheetValues> =
  zodResolver(orderSheetValuesSchema);

const validInput: OrderSheetFormValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍' },
  contactPhone: '010-1234-5678',
  dates: ['2026-07-14'],
  timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] }],
  salary: { type: 'hourly', amount: 20000 },
};

describe('orderSheetValuesSchema — RHF 3제네릭 계약', () => {
  it('zodResolver가 3제네릭 Resolver로 컴파일·구성된다', () => {
    expect(typeof orderSheetResolver).toBe('function');
  });
});

describe('orderSheetValuesSchema — z.input/z.output 경계', () => {
  it('default 필드가 z.output에서 채워진다 (description·useSameSalary·roleSalaries·allowances·conditions·preQuestions)', () => {
    const parsed = orderSheetValuesSchema.parse(validInput);
    expect(parsed.description).toBe('');
    expect(parsed.useSameSalary).toBe(true);
    expect(parsed.roleSalaries).toEqual([]);
    expect(parsed.allowances).toEqual({});
    expect(parsed.conditions).toEqual({});
    expect(parsed.usesPreQuestions).toBe(false);
    expect(parsed.preQuestions).toEqual([]);
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

describe('orderSheetValuesSchema — 역할별 급여(by_role) 전수 커버 게이트(superRefine)', () => {
  // 다역할 입력 — dealer/floor + 기타(칩카운터). 커버 판정 키는 role(기타는 customRole 단위).
  const multiRoleInput: OrderSheetFormValues = {
    ...validInput,
    timeSlots: [
      {
        startTime: '19:00',
        roles: [
          { role: 'dealer', count: 1 },
          { role: 'floor', count: 1 },
          { role: 'other', customRole: '칩카운터', count: 1 },
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

  it('동일급여 OFF에서 고유 역할 일부만 커버하면 거부된다', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...multiRoleInput,
      useSameSalary: false,
      // dealer만 커버, floor·기타(칩카운터) 미커버
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('roleSalaries'))).toBe(true);
    }
  });

  it('동일급여 OFF에서 고유 역할을 전수 커버하면 통과한다 (기타는 customRole 단위·협의 허용)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...multiRoleInput,
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
        { role: 'floor', salary: { type: 'hourly', amount: 20000 } },
        { role: 'other', customRole: '칩카운터', salary: { type: 'other', amount: 0 } },
      ],
    });
    expect(result.success).toBe(true);
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
});
