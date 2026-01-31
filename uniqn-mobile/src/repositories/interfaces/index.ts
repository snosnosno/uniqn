/**
 * UNIQN Mobile - Repository Interfaces Barrel Export
 *
 * @description Repository 인터페이스 중앙 export
 * @version 1.0.0
 */

// Application Repository
export type {
  IApplicationRepository,
  ApplicationWithJob,
  ApplyContext,
} from './IApplicationRepository';

// JobPosting Repository
export type {
  IJobPostingRepository,
  PaginatedJobPostings,
  PostingTypeCounts,
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
} from './IJobPostingRepository';

// WorkLog Repository
export type {
  IWorkLogRepository,
  WorkLogStats,
  MonthlyPayrollSummary,
  WorkLogFilterOptions,
} from './IWorkLogRepository';

// User Repository
export type {
  IUserRepository,
  DeletionReason,
  DeletionRequest,
  UserDataExport,
} from './IUserRepository';
