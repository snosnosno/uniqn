import { getRowState, firstUnsetRow, ORDER_GROUPS } from '../orderRowMeta';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const emptyValues: OrderSheetFormValues = {
  postingType: 'regular',
  title: '',
  location: null,
  contactPhone: '010-1234-5678',
  description: '',
  dates: [],
  timeSlots: [],
  salary: { type: 'hourly', amount: 0 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};
const filled: OrderSheetFormValues = {
  ...emptyValues,
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍' },
  dates: ['2026-07-14'],
  timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
  salary: { type: 'hourly', amount: 20000 },
};

describe('ORDER_GROUPS', () => {
  it('그룹 순서 = 기본정보 → 일정·모집 → 급여 → 조건 → 사전질문', () => {
    expect(ORDER_GROUPS.map((g) => g.title)).toEqual([
      '기본 정보',
      '일정 · 모집',
      '급여',
      '조건',
      '사전질문',
    ]);
  });
});

describe('getRowState', () => {
  it('필수 미입력 행은 unset=true', () => {
    expect(getRowState(emptyValues, 'title').unset).toBe(true);
    expect(getRowState(emptyValues, 'dates').unset).toBe(true);
  });
  it('선택 행은 값 없어도 unset=false, value="없음"', () => {
    const s = getRowState(emptyValues, 'welfare');
    expect(s.unset).toBe(false);
    expect(s.value).toBe('없음');
    expect(s.optional).toBe(true);
  });
  it('역할 요약은 "딜러 2" 형식으로 합산 표기', () => {
    expect(getRowState(filled, 'roles').value).toBe('딜러 2');
  });
  it('시간 요약은 "출근 19:00"', () => {
    expect(getRowState(filled, 'time').value).toBe('출근 19:00');
  });
  it('연락처는 프로필 프리필이 있으면 unset=false', () => {
    expect(getRowState(emptyValues, 'contact').unset).toBe(false);
  });
  it('빈 startTime 슬롯이 하나라도 있으면 time 행은 unset (죽은 등록버튼 방지 — H5)', () => {
    const partial = {
      ...filled,
      timeSlots: [
        ...(filled.timeSlots ?? []),
        { startTime: '', roles: [{ role: 'dealer' as const, count: 1 }] },
      ],
    };
    expect(getRowState(partial, 'time').unset).toBe(true);
  });
  it('역할 없는 슬롯이 하나라도 있으면 roles 행은 unset', () => {
    const partial = {
      ...filled,
      timeSlots: [...(filled.timeSlots ?? []), { startTime: '21:00', roles: [] }],
    };
    expect(getRowState(partial, 'roles').unset).toBe(true);
  });
  it("협의(other) 급여는 '협의'로 표기되고 unset=false", () => {
    const s = getRowState({ ...filled, salary: { type: 'other', amount: 0 } }, 'salary');
    expect(s.unset).toBe(false);
    expect(s.value).toBe('협의');
  });
  it('by_role인데 급여 없는 역할이 있으면 salary 행은 unset', () => {
    const byRole = { ...filled, useSameSalary: false, roleSalaries: [] };
    expect(getRowState(byRole, 'salary').unset).toBe(true);
  });
});

describe('firstUnsetRow', () => {
  it('빈 값이면 그룹 순서상 첫 필수 행(title)', () => {
    expect(firstUnsetRow(emptyValues)).toBe('title');
  });
  it('전부 채우면 null', () => {
    expect(firstUnsetRow(filled)).toBeNull();
  });
});
