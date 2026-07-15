import { getRowState, firstUnsetRow, orderGroupsFor } from '../orderRowMeta';
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
