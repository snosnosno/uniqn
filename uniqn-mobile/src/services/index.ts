/**
 * UNIQN Mobile - 서비스 레이어 배럴 Export
 *
 * @version 1.0.0
 */

// Auth Service
export {
  login,
  signUp,
  signOut,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  reauthenticate,
  getCurrentUser,
  onAuthStateChanged,
  signInWithApple,
  signInWithGoogle,
  signInWithKakao,
  type UserProfile,
  type AuthResult,
} from './authService';

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
  applyToJob,
  getMyApplications,
  getApplicationById,
  cancelApplication,
  hasAppliedToJob,
  getApplicationStats,
  type ApplicationWithJob,
} from './applicationService';

// Account Deletion Service
export {
  requestAccountDeletion,
  cancelAccountDeletion,
  getMyData,
  updateMyData,
  exportMyData,
  getDeletionStatus,
  DELETION_REASONS,
  type DeletionReason,
  type DeletionRequest,
  type UserData,
  type UserDataExport,
} from './accountDeletionService';
