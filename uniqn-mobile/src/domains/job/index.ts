/**
 * 구인공고 도메인 모듈
 *
 * @description Phase 7 - 도메인 모듈 구조 완성
 * 구인공고 관련 도메인 로직을 중앙에서 export
 *
 * ## 향후 확장 계획
 * - JobPostingValidator: 공고 유효성 검증
 * - JobPostingFormatter: 공고 데이터 포맷팅
 * - JobPostingMatcher: 스태프-공고 매칭 로직
 */

// ============================================================================
// Types (Re-export from @/types)
// ============================================================================

export type {
  // 공고 기본 타입
  JobPostingStatus,
  SalaryType,
  SalaryInfo,
  Allowances,
  TaxSettings,
  TaxType,
  TaxableItems,
  JobRoleStats,
  RoleRequirement,
  JobPosting,
  JobPostingFilters,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  // 카드용 타입
  CardRole,
  CardTimeSlot,
  CardDateRequirement,
  JobPostingCard,
} from '@/types/jobPosting';

export { toJobPostingCard } from '@/types/jobPosting';

// 날짜별 요구사항 타입
export type {
  RoleRequirement as FormRoleRequirement,
  TimeSlot as FormTimeSlot,
  DateSpecificRequirement as FormDateSpecificRequirement,
  DateConstraint,
} from '@/types/jobPosting/dateRequirement';

export {
  getDateString,
  sortDateRequirements as sortFormDateRequirements,
  createDefaultTimeSlot,
  createDefaultRole,
} from '@/types/jobPosting/dateRequirement';

// 공고 타입별 설정
export type {
  PostingType,
  TournamentApprovalStatus,
  FixedConfig,
  FixedJobPostingData,
  RoleWithCount,
  TournamentConfig,
  UrgentConfig,
} from '@/types/postingConfig';

export {
  POSTING_TYPE_LABELS,
  POSTING_TYPE_BADGE_STYLES,
  getDateFromRequirement,
  sortDateRequirements,
} from '@/types/postingConfig';

// 사전질문 타입
export type { PreQuestion, PreQuestionAnswer } from '@/types/preQuestion';

export {
  PRE_QUESTION_TYPE_LABELS,
  initializePreQuestionAnswers,
  validateRequiredAnswers,
  findUnansweredRequired,
  updateAnswer,
} from '@/types/preQuestion';

// 공고 템플릿 타입
export type {
  TemplateFormData,
  TemplateExcludedFields,
  JobPostingTemplate,
  CreateTemplateInput,
  TemplateListResult,
} from '@/types/jobTemplate';

export { extractTemplateData, templateToFormData } from '@/types/jobTemplate';

// 폼 타입
export type { JobPostingFormData, TournamentDay, FormRoleWithCount } from '@/types/jobPostingForm';

export {
  INITIAL_JOB_POSTING_FORM_DATA,
  DEFAULT_ROLES,
  POSTING_TYPE_INFO,
  validateStep,
  validateForm,
} from '@/types/jobPostingForm';
