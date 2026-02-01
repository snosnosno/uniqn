/**
 * UNIQN Mobile - 급여 유틸리티 모듈
 *
 * @description 급여 관련 유틸리티 함수 및 타입 export
 */

// Role Extractor
export { extractRolesFromPosting, syncRolesWithExtracted } from './roleExtractor';
export type { ExtractedRole } from './roleExtractor';

// Cost Calculator
export {
  formatCurrency,
  parseCurrency,
  calculateEstimatedCost,
  calculateTotalSalary,
  calculateTotalCount,
} from './costCalculator';
