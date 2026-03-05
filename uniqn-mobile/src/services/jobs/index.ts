/**
 * UNIQN Mobile - Jobs 도메인 배럴 Export
 *
 * @description 구인공고, 지원, 지원자 관리, 템플릿, 검색 서비스
 * @version 1.0.0
 */

// Job Service
export {
  getJobPostings,
  getJobPostingById,
  incrementViewCount,
  searchJobPostings,
  getUrgentJobPostings,
  getMyJobPostings,
  convertToCard,
  type PaginatedJobPostings,
} from './jobService';

// Application Service
export {
  applyToJobV2,
  getMyApplications,
  getApplicationById,
  cancelApplication,
  hasAppliedToJob,
  getApplicationStats,
  requestCancellation,
  reviewCancellationRequest,
  getCancellationRequests,
  type ApplicationWithJob,
} from './applicationService';

// Application History Service (확정/취소 이력 관리)
export {
  confirmApplicationWithHistory,
  cancelConfirmation,
  getOriginalApplicationData,
  getConfirmedSelections,
  isV2Application,
  getApplicationHistorySummary,
  type ConfirmWithHistoryResult,
  type CancelConfirmationResult,
} from './applicationHistoryService';

// Applicant Conversion Service (지원자→스태프 변환)
export {
  convertApplicantToStaff,
  batchConvertApplicants,
  isAlreadyStaff,
  canConvertToStaff,
  revertStaffConversion,
  type ConversionResult,
  type BulkConversionResult,
  type ConversionOptions,
} from './applicantConversionService';

// Job Management Service (구인자용 공고 관리)
export {
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  closeJobPosting,
  reopenJobPosting,
  getMyJobPostingStats,
  bulkUpdateJobPostingStatus,
  type CreateJobPostingResult,
  type JobPostingStats,
} from './jobManagementService';

// Template Service (공고 템플릿 관리)
export {
  getTemplates,
  saveTemplate,
  loadTemplate,
  deleteTemplate,
  updateTemplate,
} from './templateService';

// Applicant Management Service (구인자용 지원자 관리)
export {
  getApplicantsByJobPosting,
  subscribeToApplicants,
  subscribeToApplicantsAsync,
  verifyJobPostingOwnership,
  confirmApplication,
  rejectApplication,
  bulkConfirmApplications,
  markApplicationAsRead,
  getApplicantStatsByRole,
  type ApplicantWithDetails,
  type ApplicantListResult,
  type ConfirmResult,
  type BulkConfirmResult,
  type SubscribeToApplicantsCallbacks,
} from './applicantManagementService';

// Search Service
export {
  ClientSideSearchProvider,
  AlgoliaSearchProvider,
  createSearchProvider,
  CURRENT_SEARCH_PROVIDER,
  type SearchResult,
  type SearchOptions,
  type SearchProvider,
  type SearchServiceConfig,
} from './searchService';
