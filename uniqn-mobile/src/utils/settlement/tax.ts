/**
 * UNIQN Mobile - 세금 계산 유틸리티
 */

import type { TaxType } from '@/types/schedule';
import { PROVIDED_FLAG } from './constants';

/** 세금 적용 대상 항목 */
export interface TaxableItems {
  /** 기본급 */
  basePay?: boolean;
  /** 식비 */
  meal?: boolean;
  /** 교통비 */
  transportation?: boolean;
  /** 숙박비 */
  accommodation?: boolean;
  /** 추가수당 */
  additional?: boolean;
}

/** 기본 세금 적용 대상 (모두 적용) */
export const DEFAULT_TAXABLE_ITEMS: TaxableItems = {
  basePay: true,
  meal: true,
  transportation: true,
  accommodation: true,
  additional: true,
};

export interface TaxSettings {
  /** 세금 유형 */
  type: TaxType;
  /** 세율(%) 또는 고정 금액 */
  value: number;
  /** 세금 적용 대상 항목 */
  taxableItems?: TaxableItems;
}

/** 기본 세금 설정 (없음) */
export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  type: 'none',
  value: 0,
};

/**
 * 세금 금액 계산 (기본 - 전체 금액에 적용)
 */
export function calculateTaxAmount(taxSettings: TaxSettings, totalAmount: number): number {
  if (taxSettings.type === 'none') return 0;
  if (taxSettings.type === 'fixed') return taxSettings.value;
  // rate
  return Math.round(totalAmount * (taxSettings.value / 100));
}

/** 세금 계산용 상세 금액 */
export interface TaxableAmounts {
  basePay: number;
  meal?: number;
  transportation?: number;
  accommodation?: number;
  additional?: number;
}

/**
 * 항목별 세금 적용 여부를 고려한 세금 금액 계산
 *
 * @description taxableItems에 따라 각 항목별로 세금 적용 여부를 결정
 */
export function calculateTaxAmountByItems(
  taxSettings: TaxSettings,
  amounts: TaxableAmounts
): number {
  if (taxSettings.type === 'none') return 0;

  // 고정 금액인 경우 그대로 반환
  if (taxSettings.type === 'fixed') return taxSettings.value;

  // taxableItems 기본값 적용
  const taxableItems = taxSettings.taxableItems || DEFAULT_TAXABLE_ITEMS;

  // 세금 적용 대상 금액 합산
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
  return Math.round(taxableAmount * (taxSettings.value / 100));
}

/**
 * 세후 금액 계산
 */
export function calculateAfterTaxAmount(taxSettings: TaxSettings, totalAmount: number): number {
  const taxAmount = calculateTaxAmount(taxSettings, totalAmount);
  return totalAmount - taxAmount;
}
