/**
 * 정산 계산 헬퍼 회귀 테스트
 *
 * 배경(2026-07-16 전체 분석 A1): SalaryConfig에 taxSettings가 없어
 * 정산 확인 모달 금액(calculateWorkLogAmount)이 세전으로 계산되고,
 * 저장값(SettlementRepository canonical 재계산)은 세후라
 * 같은 화면에서 행·확인모달·저장값이 서로 다른 숫자를 표시했다.
 */

import { calculateWorkLogAmount, deriveSalaryConfig } from '../settlementCalc';
import type { PostingSettlementContext } from '@/domains/job-posting';
import type { WorkLog } from '@/types';

// 10:00~20:00 = 10시간, 시급 10,000원 → 세전 100,000원
const baseWorkLog = {
  role: 'dealer',
  checkInTime: '2026-07-16T10:00:00+09:00',
  checkOutTime: '2026-07-16T20:00:00+09:00',
} as unknown as WorkLog & { customRole?: string };

const hourlySalary = { type: 'hourly', amount: 10000 } as const;
const rate33 = { type: 'rate', value: 3.3 } as const;

describe('calculateWorkLogAmount — 세금 배선 (A1 회귀)', () => {
  it('taxSettings 미전달 시 세전 금액을 반환한다 (기존 동작 보존)', () => {
    const amount = calculateWorkLogAmount(baseWorkLog, [], hourlySalary);
    expect(amount).toBe(100_000);
  });

  it('공고 taxSettings(rate 3.3%)를 전달하면 세후 금액을 반환한다', () => {
    const amount = calculateWorkLogAmount(baseWorkLog, [], hourlySalary, undefined, rate33);
    // 100,000 - round(100,000 × 3.3%) = 96,700 — 저장값(canonical 재계산)과 동일해야 한다
    expect(amount).toBe(96_700);
  });

  it('workLog.customTaxSettings가 공고 taxSettings보다 우선한다', () => {
    const workLogWithCustomTax = {
      ...baseWorkLog,
      customTaxSettings: { type: 'none', value: 0 },
    } as unknown as WorkLog & { customRole?: string };
    const amount = calculateWorkLogAmount(
      workLogWithCustomTax,
      [],
      hourlySalary,
      undefined,
      rate33
    );
    expect(amount).toBe(100_000);
  });
});

describe('deriveSalaryConfig — taxSettings 파생 (A1 회귀)', () => {
  it('postingSettlement.taxSettings를 SalaryConfig로 전달한다', () => {
    const postingSettlement = {
      roles: [],
      defaultSalary: hourlySalary,
      taxSettings: rate33,
    } as unknown as PostingSettlementContext;

    const config = deriveSalaryConfig(postingSettlement);
    expect(config.taxSettings).toEqual(rate33);
  });

  it('postingSettlement 부재 시 taxSettings는 undefined다', () => {
    expect(deriveSalaryConfig(undefined).taxSettings).toBeUndefined();
  });
});
