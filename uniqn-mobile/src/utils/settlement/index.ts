/**
 * UNIQN Mobile - 정산 계산 유틸리티 (Barrel Export)
 * @version 2.0.0
 */

export { DEFAULT_SALARY_INFO, SALARY_TYPE_LABELS, PROVIDED_FLAG } from './constants';

export {
  formatCurrency,
  formatDuration,
  formatTime,
  formatDate,
  getSalaryTypeLabel,
} from './formatters';

export {
  type TaxableItems,
  type TaxSettings,
  type TaxableAmounts,
  DEFAULT_TAXABLE_ITEMS,
  DEFAULT_TAX_SETTINGS,
  calculateTaxAmount,
  calculateTaxAmountByItems,
  calculateAfterTaxAmount,
} from './tax';

export {
  type SettlementResult,
  type Allowances,
  type ExtendedSettlementResult,
  parseTimestamp,
  calculateHoursWorked,
  calculatePayByType,
  getRoleSalaryFromRoles,
  calculateAllowanceAmount,
  calculateSettlement,
  calculateSettlementFromWorkLog,
  calculateTotalSettlementFromRoles,
  calculateSettlementWithTax,
  calculateSettlementFromWorkLogWithTax,
  getRoleSalaryFromJobPostingCard,
  getRoleSalaryFromSettlementSource,
  calculateSettlementBreakdown,
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from './calculator';

// Re-export types for backward compatibility
export type { SalaryType, SalaryInfo } from '@/types/jobPosting';
export type { TaxType } from '@/types/schedule';
