import { PROVIDED_FLAG } from './constants';

export interface TaxableItemsConfig {
  basePay?: boolean;
  meal?: boolean;
  transportation?: boolean;
  accommodation?: boolean;
  additional?: boolean;
}

export interface TaxableAmountsInput {
  basePay: number;
  meal?: number;
  transportation?: number;
  accommodation?: number;
  additional?: number;
}

export const DEFAULT_TAXABLE_ITEMS: TaxableItemsConfig = {
  basePay: true,
  meal: true,
  transportation: true,
  accommodation: true,
  additional: true,
};

export function calculateTaxableAmountByItems(
  amounts: TaxableAmountsInput,
  taxableItems: TaxableItemsConfig = DEFAULT_TAXABLE_ITEMS
): number {
  let taxableAmount = 0;

  if (taxableItems.basePay !== false) {
    taxableAmount += amounts.basePay;
  }

  if (
    taxableItems.meal !== false &&
    amounts.meal &&
    amounts.meal !== PROVIDED_FLAG &&
    amounts.meal > 0
  ) {
    taxableAmount += amounts.meal;
  }

  if (
    taxableItems.transportation !== false &&
    amounts.transportation &&
    amounts.transportation !== PROVIDED_FLAG &&
    amounts.transportation > 0
  ) {
    taxableAmount += amounts.transportation;
  }

  if (
    taxableItems.accommodation !== false &&
    amounts.accommodation &&
    amounts.accommodation !== PROVIDED_FLAG &&
    amounts.accommodation > 0
  ) {
    taxableAmount += amounts.accommodation;
  }

  if (taxableItems.additional !== false && amounts.additional && amounts.additional > 0) {
    taxableAmount += amounts.additional;
  }

  return taxableAmount;
}

export function calculateItemizedRateTax(
  amounts: TaxableAmountsInput,
  rate: number,
  taxableItems: TaxableItemsConfig = DEFAULT_TAXABLE_ITEMS
) {
  const taxableAmount = calculateTaxableAmountByItems(amounts, taxableItems);
  return {
    taxableAmount,
    taxAmount: Math.round(taxableAmount * (rate / 100)),
  };
}
