/**
 * UNIQN Mobile - 세금 계산 유틸리티
 */

import type { TaxType } from '@/types/schedule';
import {
  DEFAULT_TAXABLE_ITEMS,
  calculateItemizedRateTax,
  type TaxableAmountsInput,
  type TaxableItemsConfig,
} from './taxCore';

export type TaxableItems = TaxableItemsConfig;

export interface TaxSettings {
  type: TaxType;
  value: number;
  taxableItems?: TaxableItems;
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  type: 'none',
  value: 0,
};

export type TaxableAmounts = TaxableAmountsInput;

export { DEFAULT_TAXABLE_ITEMS };

export function calculateTaxAmount(taxSettings: TaxSettings, totalAmount: number): number {
  if (taxSettings.type === 'none') return 0;
  if (taxSettings.type === 'fixed') return taxSettings.value;
  return Math.round(totalAmount * (taxSettings.value / 100));
}

export function calculateTaxAmountByItems(
  taxSettings: TaxSettings,
  amounts: TaxableAmounts
): number {
  if (taxSettings.type === 'none') return 0;
  if (taxSettings.type === 'fixed') return taxSettings.value;

  return calculateItemizedRateTax(
    amounts,
    taxSettings.value,
    taxSettings.taxableItems || DEFAULT_TAXABLE_ITEMS
  ).taxAmount;
}

export function calculateAfterTaxAmount(taxSettings: TaxSettings, totalAmount: number): number {
  const taxAmount = calculateTaxAmount(taxSettings, totalAmount);
  return totalAmount - taxAmount;
}

export function serializeTaxSettings(taxSettings: TaxSettings): TaxSettings {
  return {
    type: taxSettings.type,
    value: taxSettings.value,
    ...(taxSettings.taxableItems ? { taxableItems: { ...taxSettings.taxableItems } } : {}),
  };
}
