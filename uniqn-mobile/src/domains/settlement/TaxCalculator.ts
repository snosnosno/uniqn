/**
 * 세금 계산기
 *
 * @description 정산 도메인에서 사용하는 세금 계산 로직
 */

import type { TaxSettings } from '@/utils/settlement';
import { calculateTaxAmount, calculateTaxAmountByItems } from '@/utils/settlement/tax';
import {
  DEFAULT_TAXABLE_ITEMS,
  calculateTaxableAmountByItems,
  type TaxableAmountsInput,
} from '@/utils/settlement/taxCore';

export interface TaxBreakdown {
  taxableAmount: number;
  taxAmount: number;
  taxRate: number;
  taxType: 'none' | 'fixed' | 'rate';
}

export type TaxableAmounts = TaxableAmountsInput;

/**
 * `TaxBreakdown` 공통 조립 — 세액은 인자로 받은 값을 그대로 쓴다.
 *
 * `taxRate` 는 **rate 타입일 때만** settings.value 를 싣는다(none/fixed 는 0).
 * fixed 의 value 는 세율이 아니라 금액이라, 여기에 실으면 "3,000%" 같은 표시가 된다.
 */
function toBreakdown(
  taxableAmount: number,
  taxAmount: number,
  settings: TaxSettings
): TaxBreakdown {
  return {
    taxableAmount,
    taxAmount,
    taxRate: settings.type === 'rate' ? settings.value : 0,
    taxType: settings.type,
  };
}

/**
 * 세금 계산기 — 산식은 `utils/settlement/tax` + `taxCore` 단독 소유다.
 *
 * 이 클래스는 **표현 계층 어댑터**다. 계산은 전부 위임하고, 소비처가 필요로 하는
 * `TaxBreakdown`(과세표준·세액·세율·타입) 모양으로 조립하는 일만 한다.
 * none/fixed/rate 3분기를 여기에 다시 쓰지 말 것 — 종전엔 같은 분기가 이 파일에
 * 두 번(calculate/calculateByItems), tax.ts 에 두 번, 총 네 벌 있었다.
 */
export class TaxCalculator {
  static calculate(grossPay: number, settings: TaxSettings): TaxBreakdown {
    return toBreakdown(grossPay, calculateTaxAmount(settings, grossPay), settings);
  }

  static calculateByItems(
    grossPay: number,
    amounts: TaxableAmounts,
    settings: TaxSettings
  ): TaxBreakdown {
    // 과세표준은 rate 일 때만 항목별로 좁혀진다. none/fixed 는 총액을 그대로 보여준다
    // (세액이 총액과 무관하므로 항목별 합산이 의미를 갖지 않는다).
    const taxableAmount =
      settings.type === 'rate'
        ? calculateTaxableAmountByItems(amounts, settings.taxableItems || DEFAULT_TAXABLE_ITEMS)
        : grossPay;

    return toBreakdown(taxableAmount, calculateTaxAmountByItems(settings, amounts), settings);
  }
}
