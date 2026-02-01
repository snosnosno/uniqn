/**
 * 세금 계산기
 *
 * @description Phase 6 - 정산 계산기 통합
 * 세금 계산 로직을 분리하여 재사용성 향상
 */

import type { TaxSettings, TaxableItems } from '@/utils/settlement';

// ============================================================================
// Types
// ============================================================================

/**
 * 세금 계산 결과
 */
export interface TaxBreakdown {
  /** 과세 대상 금액 */
  taxableAmount: number;
  /** 세금 금액 */
  taxAmount: number;
  /** 세율 (rate 타입일 때만 유효) */
  taxRate: number;
  /** 세금 타입 */
  taxType: 'none' | 'fixed' | 'rate';
}

/**
 * 항목별 금액 정보
 */
export interface TaxableAmounts {
  basePay: number;
  meal?: number;
  transportation?: number;
  accommodation?: number;
  additional?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** "제공" 상태를 나타내는 특별 값 */
const PROVIDED_FLAG = -1;

/** 기본 세금 적용 대상 (모두 적용) */
const DEFAULT_TAXABLE_ITEMS: TaxableItems = {
  basePay: true,
  meal: true,
  transportation: true,
  accommodation: true,
  additional: true,
};

// ============================================================================
// TaxCalculator
// ============================================================================

/**
 * 세금 계산기
 *
 * @description 다양한 세금 타입(없음/고정/비율)과 항목별 과세 여부를 지원
 */
export class TaxCalculator {
  /**
   * 기본 세금 계산
   *
   * @param grossPay - 세전 총 금액
   * @param settings - 세금 설정
   * @returns 세금 계산 결과
   */
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

    // rate
    const taxAmount = Math.round(grossPay * (settings.value / 100));
    return {
      taxableAmount: grossPay,
      taxAmount,
      taxRate: settings.value,
      taxType: 'rate',
    };
  }

  /**
   * 항목별 세금 계산
   *
   * @description taxableItems 설정에 따라 각 항목별로 과세 여부 결정
   * @param grossPay - 세전 총 금액 (참고용)
   * @param amounts - 항목별 금액
   * @param settings - 세금 설정
   * @returns 세금 계산 결과
   */
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

    // 고정 세금은 항목 무관
    if (settings.type === 'fixed') {
      return {
        taxableAmount: grossPay,
        taxAmount: settings.value,
        taxRate: 0,
        taxType: 'fixed',
      };
    }

    // 과세 대상 항목 결정
    const taxableItems = settings.taxableItems || DEFAULT_TAXABLE_ITEMS;
    let taxableAmount = 0;

    // 기본급
    if (taxableItems.basePay !== false) {
      taxableAmount += amounts.basePay;
    }

    // 식비 (PROVIDED_FLAG 제외)
    if (
      taxableItems.meal !== false &&
      amounts.meal &&
      amounts.meal !== PROVIDED_FLAG &&
      amounts.meal > 0
    ) {
      taxableAmount += amounts.meal;
    }

    // 교통비 (PROVIDED_FLAG 제외)
    if (
      taxableItems.transportation !== false &&
      amounts.transportation &&
      amounts.transportation !== PROVIDED_FLAG &&
      amounts.transportation > 0
    ) {
      taxableAmount += amounts.transportation;
    }

    // 숙박비 (PROVIDED_FLAG 제외)
    if (
      taxableItems.accommodation !== false &&
      amounts.accommodation &&
      amounts.accommodation !== PROVIDED_FLAG &&
      amounts.accommodation > 0
    ) {
      taxableAmount += amounts.accommodation;
    }

    // 추가수당
    if (taxableItems.additional !== false && amounts.additional && amounts.additional > 0) {
      taxableAmount += amounts.additional;
    }

    // 세율 적용
    const taxAmount = Math.round(taxableAmount * (settings.value / 100));

    return {
      taxableAmount,
      taxAmount,
      taxRate: settings.value,
      taxType: 'rate',
    };
  }
}
