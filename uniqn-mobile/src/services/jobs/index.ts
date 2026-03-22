/**
 * UNIQN Mobile - jobs domain barrel
 *
 * @description Active public services for job postings, applications, and
 * employer management. Legacy applicant-to-staff conversion is intentionally
 * excluded from this barrel.
 */

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

export {
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  closeJobPosting,
  reopenJobPosting,
  getMyJobPostingStats,
  bulkUpdateJobPostingStatus,
  updateJobPostingSettlementSettings,
  type CreateJobPostingResult,
  type JobPostingStats,
} from './jobManagementService';

export {
  getTemplates,
  saveTemplate,
  loadTemplate,
  deleteTemplate,
  updateTemplate,
} from './templateService';

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
