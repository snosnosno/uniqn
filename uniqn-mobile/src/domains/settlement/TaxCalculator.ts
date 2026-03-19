/**
 * 세금 계산기
 *
 * @description 정산 도메인에서 사용하는 세금 계산 로직
 */

import type { TaxSettings } from '@/utils/settlement';
import {
  DEFAULT_TAXABLE_ITEMS,
  calculateItemizedRateTax,
  type TaxableAmountsInput,
} from '@/utils/settlement/taxCore';

export interface TaxBreakdown {
  taxableAmount: number;
  taxAmount: number;
  taxRate: number;
  taxType: 'none' | 'fixed' | 'rate';
}

export type TaxableAmounts = TaxableAmountsInput;

export class TaxCalculator {
  static calculate(grossPay: number, settings: TaxSettings): TaxBreakdown {
    if (settings.type === 'none') {
      return {
        taxableAmount: grossPay,
        taxAmount: 0,
        taxRate: 0,
        taxType: 'none',
      };
    }

    if (settings.type === 'fixed') {
      return {
        taxableAmount: grossPay,
        taxAmount: settings.value,
        taxRate: 0,
        taxType: 'fixed',
      };
    }

    const taxAmount = Math.round(grossPay * (settings.value / 100));
    return {
      taxableAmount: grossPay,
      taxAmount,
      taxRate: settings.value,
      taxType: 'rate',
    };
  }

  static calculateByItems(
    grossPay: number,
    amounts: TaxableAmounts,
    settings: TaxSettings
  ): TaxBreakdown {
    if (settings.type === 'none') {
      return {
        taxableAmount: grossPay,
        taxAmount: 0,
        taxRate: 0,
        taxType: 'none',
      };
    }

    if (settings.type === 'fixed') {
      return {
        taxableAmount: grossPay,
        taxAmount: settings.value,
        taxRate: 0,
        taxType: 'fixed',
      };
    }

    const { taxableAmount, taxAmount } = calculateItemizedRateTax(
      amounts,
      settings.value,
      settings.taxableItems || DEFAULT_TAXABLE_ITEMS
    );

    return {
      taxableAmount,
      taxAmount,
      taxRate: settings.value,
      taxType: 'rate',
    };
  }
}
