import { zodResolver } from '@hookform/resolvers/zod';
import { getRowState, firstUnsetRow, orderGroupsFor, errorRowTargets } from '../orderRowMeta';
import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const fixedComplete: OrderSheetFormValues = {
  postingType: 'fixed',
  title: '주말 고정 딜러',
  location: { name: '강남 홀덤펍', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [],
  fixedSchedule: {
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    roles: [{ role: 'dealer', count: 3 }],
  },
  salary: { type: 'daily', amount: 200000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

describe('orderRowMeta — fixed(S2)', () => {
  it('fixed 섹션은 근무조건·역할 행을 포함하고 날짜/시간 행이 없다', () => {
    const groups = orderGroupsFor('fixed');
    const rows = groups.flatMap((g) => g.rows);
    expect(rows).toContain('workConditions');
    expect(rows).toContain('roles');
    expect(rows).not.toContain('dates');
    expect(rows).not.toContain('time');
  });

  it('완성된 고정은 workConditions/roles/salary가 모두 set이다', () => {
    expect(getRowState(fixedComplete, 'workConditions').unset).toBe(false);
    expect(getRowState(fixedComplete, 'roles').unset).toBe(false);
    expect(getRowState(fixedComplete, 'salary').unset).toBe(false);
    expect(firstUnsetRow(fixedComplete)).toBeNull();
  });

  it('협의 미설정 + 출근시간 없음이면 workConditions가 unset이다', () => {
    const v = {
      ...fixedComplete,
      fixedSchedule: {
        daysPerWeek: 5,
        isStartTimeNegotiable: false,
        roles: fixedComplete.fixedSchedule!.roles,
      },
    };
    expect(getRowState(v, 'workConditions').unset).toBe(true);
  });

  it('협의면 출근시간 없이도 workConditions가 set이다', () => {
    const v = {
      ...fixedComplete,
      fixedSchedule: {
        daysPerWeek: 0,
        isStartTimeNegotiable: true,
        roles: fixedComplete.fixedSchedule!.roles,
      },
    };
    expect(getRowState(v, 'workConditions').unset).toBe(false);
  });

  it('역할 없으면 roles가 unset이다', () => {
    const v = {
      ...fixedComplete,
      fixedSchedule: { ...fixedComplete.fixedSchedule!, roles: [] },
    };
    expect(getRowState(v, 'roles').unset).toBe(true);
  });
});

// Fix 2(S2): errorRowTargets 의 fixed 분기가 zodResolver 실측 에러 형상을 올바른 행으로 라우팅하는지
// 직접 검증(mock 아님, 실제 로직). region 은 유효 slug '서울 강남구' — 'seoul-gangnam' 은 isRegionSlug
// 미등록이라 location 게이트에 먼저 걸려 fixedSchedule 에러가 가려진다(파일 상단 fixedComplete 는 zod 미경유).
const fixedResolverBase: OrderSheetFormValues = {
  postingType: 'fixed',
  title: '주말 고정 딜러',
  location: { name: '강남 홀덤펍', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [],
  fixedSchedule: {
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    roles: [{ role: 'dealer', count: 3 }],
  },
  salary: { type: 'daily', amount: 200000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

describe('errorRowTargets — fixed 분기 라우팅 (S2 Fix 2, zodResolver 실측)', () => {
  const resolver = zodResolver(orderSheetValuesSchema);
  const resolve = async (values: OrderSheetFormValues) =>
    (await resolver(values, undefined, { fields: {}, shouldUseNativeValidation: false })).errors;

  it('fixedSchedule.roles min(1) 위반은 roles 행으로 라우팅된다(근무조건 행 아님)', async () => {
    const errors = await resolve({
      ...fixedResolverBase,
      fixedSchedule: { ...fixedResolverBase.fixedSchedule!, roles: [] },
    });
    const targets = errorRowTargets(errors as Record<string, unknown>);
    expect(targets).toContainEqual({ key: 'roles', groupIndex: 0 });
    // 라우팅이 실제로 형상을 구분함을 증명 — roles 에러는 근무조건 행으로 새지 않는다(vacuous 방지).
    expect(targets).not.toContainEqual({ key: 'workConditions', groupIndex: 0 });
  });

  it('비협의 + 출근시간 부재(startTime superRefine)는 근무조건 행으로 라우팅된다(역할 행 아님)', async () => {
    const errors = await resolve({
      ...fixedResolverBase,
      fixedSchedule: {
        daysPerWeek: 5,
        isStartTimeNegotiable: false,
        roles: fixedResolverBase.fixedSchedule!.roles,
      },
    });
    const targets = errorRowTargets(errors as Record<string, unknown>);
    expect(targets).toContainEqual({ key: 'workConditions', groupIndex: 0 });
    expect(targets).not.toContainEqual({ key: 'roles', groupIndex: 0 });
  });
});
