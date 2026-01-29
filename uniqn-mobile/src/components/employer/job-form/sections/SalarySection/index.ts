/**
 * UNIQN Mobile - SalarySection 배럴 export
 *
 * @description SalarySection 폴더의 모든 컴포넌트 및 타입 export
 */

// Main Component
export { SalarySection, default } from './SalarySection';

// Sub-components
export { RoleSalaryInput } from './RoleSalaryInput';
export { AllowanceInput } from './AllowanceInput';
export { EstimatedCostCard } from './EstimatedCostCard';

// Types
export type {
  SalarySectionProps,
  RoleSalaryInputProps,
  AllowanceInputProps,
  EstimatedCostCardProps,
} from './types';

// Constants
export { SALARY_TYPES, ALLOWANCE_TYPES } from './constants';
export type { AllowanceKey } from './constants';
