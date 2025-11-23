/**
 * JobPostingForm Sections - Export Index
 *
 * 모든 섹션 컴포넌트를 중앙에서 export하여 import 경로 단순화
 *
 * @example
 * ```tsx
 * // Before
 * import BasicInfoSection from '../sections/BasicInfoSection';
 * import SalarySection from '../sections/SalarySection';
 *
 * // After
 * import { BasicInfoSection, SalarySection } from '../sections';
 * ```
 */

export { default as BasicInfoSection } from './BasicInfoSection';
export { default as DateRequirementsSection } from './DateRequirementsSection';
export { default as PreQuestionsSection } from './PreQuestionsSection';
export { default as SalarySection } from './SalarySection';
export { default as FixedWorkScheduleSection } from './FixedWorkScheduleSection';

// Re-export types for convenience
export type { BasicInfoSectionProps } from '../../../../types/jobPosting/basicInfoProps';
export type { DateRequirementsSectionProps } from '../../../../types/jobPosting/dateRequirementsProps';
export type { PreQuestionsSectionProps } from '../../../../types/jobPosting/preQuestionsProps';
export type { SalarySectionProps } from '../../../../types/jobPosting/salaryProps';
export type { FixedWorkScheduleSectionProps } from '../../../../types/jobPosting';
