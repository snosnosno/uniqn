/**
 * 보장시간(guaranteedHours) 계약 — 표시 전용, 금액 미반영 (SETTLE-2)
 *
 * @description 감사는 '수당 배지로는 보이는데 금액 계산에 한 줄도 반영되지 않는다' 를 결함으로
 *   올렸다. 제품 결정은 **표시 전용 유지**다 — 이미 '보장 5시간' 으로 공고를 낸 사장에게
 *   예고 없는 인건비 상승을 만들지 않는다. 대신 금액처럼 보이던 자리에서 빼서 근무 조건으로
 *   분류했다(WelfareSheet 구분선 · SettlementTab 급여계산 블록 · 공고 조건 칩).
 *
 *   이 파일은 그 결정을 **실행 가능한 계약**으로 고정한다. 보장시간을 계산에 넣으려는
 *   다음 변경은 여기서 먼저 빨갛게 걸리고, 그때 제품 결정을 다시 하면 된다.
 *
 *   ⚠️ 계산 구현이 둘(SettlementCalculator = 서버·서비스 계층 / helpers = UI 계층)이라
 *   양쪽 모두 잠근다. 과거에 이 둘이 발산한 이력이 helpers.test.ts 헤더에 기록돼 있다.
 */

import { SettlementCalculator } from '../SettlementCalculator';
import { calculateSettlement } from '../helpers';
import { getAllowanceItems, getGuaranteedHoursLabel } from '@/utils/allowanceUtils';
import type { SalaryInfo, Allowances } from '@/utils/settlement';

const SALARY: SalaryInfo = { type: 'hourly', amount: 10000 };
const START = new Date('2026-07-01T09:00:00.000Z');
/** 실근무 3시간 */
const END = new Date('2026-07-01T12:00:00.000Z');

const WITHOUT: Allowances = {};
const WITH_GUARANTEE: Allowances = { guaranteedHours: 5 };

describe('보장시간은 금액 계산에 반영되지 않는다 (표시 전용 계약)', () => {
  it('SettlementCalculator — 보장 5시간이 있어도 실근무 3시간으로 계산한다', () => {
    const without = SettlementCalculator.calculate({
      startTime: START,
      endTime: END,
      salaryInfo: SALARY,
      allowances: WITHOUT,
    });
    const withGuarantee = SettlementCalculator.calculate({
      startTime: START,
      endTime: END,
      salaryInfo: SALARY,
      allowances: WITH_GUARANTEE,
    });

    expect(without.basePay).toBe(30000);
    expect(withGuarantee.basePay).toBe(without.basePay);
    expect(withGuarantee.totalPay).toBe(without.totalPay);
  });

  it('helpers(UI 경로) — 같은 계약을 공유한다', () => {
    const without = calculateSettlement(START, END, SALARY, WITHOUT);
    const withGuarantee = calculateSettlement(START, END, SALARY, WITH_GUARANTEE);

    expect(without.basePay).toBe(30000);
    expect(withGuarantee.basePay).toBe(without.basePay);
    expect(withGuarantee.totalPay).toBe(without.totalPay);
  });

  it('두 구현이 서로 같은 값을 낸다 (발산 방지)', () => {
    const calc = SettlementCalculator.calculate({
      startTime: START,
      endTime: END,
      salaryInfo: SALARY,
      allowances: WITH_GUARANTEE,
    });
    const helper = calculateSettlement(START, END, SALARY, WITH_GUARANTEE);

    expect(helper.basePay).toBe(calc.basePay);
    expect(helper.totalPay).toBe(calc.totalPay);
  });
});

describe('보장시간은 수당 목록에 섞이지 않는다', () => {
  it('getAllowanceItems 는 보장시간을 포함하지 않는다', () => {
    const items = getAllowanceItems({ guaranteedHours: 5, meal: 10000 });

    expect(items).toEqual(['식비 10,000원']);
    expect(items.some((i) => i.includes('보장'))).toBe(false);
  });

  it('보장시간은 전용 라벨로 분리 제공된다', () => {
    expect(getGuaranteedHoursLabel({ guaranteedHours: 5 })).toBe('보장 5시간');
    expect(getGuaranteedHoursLabel({})).toBeNull();
    expect(getGuaranteedHoursLabel(undefined)).toBeNull();
    expect(getGuaranteedHoursLabel({ guaranteedHours: 0 })).toBeNull();
  });
});
