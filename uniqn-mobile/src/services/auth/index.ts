/**
 * UNIQN Mobile - Auth 도메인 배럴 Export
 *
 * @description 인증 관련 서비스 (auth, accountDeletion, storage, biometric)
 * @version 2.0.0
 */

// ============================================================================
// Auth Types (공유 타입)
// ============================================================================
export { type UserProfile, type AuthResult, type SocialProfileData } from './authTypes';
export type {
  PortOneInicisIdentityConfig,
  PortOneInicisIdentityRequest,
  PortOneInicisIdentityRequestInput,
  PortOneIdentityVerificationResult,
  PendingPortOneIdentityRequest,
  PortOneInicisDirectAgency,
  VerifiedPortOneIdentity,
  VerifyAndSavePortOneProfilePayload,
  VerifyAndSavePortOneProfileResult,
  VerifyPortOneIdentityPayload,
  VerifyPortOneIdentityResult,
} from './portOneIdentityService';

// ============================================================================
// Auth Core Service (로그인, 회원가입, 세션)
// ============================================================================
export {
  login,
  signUp,
  signOut,
  resetPassword,
  completePasswordReset,
  hasRecoverySession,
  adoptRecoverySessionFromUrl,
  getUserProfile,
  reauthenticate,
  getCurrentUserAsync,
  requireCurrentUser,
  onAuthStateChanged,
  checkEmailExists,
  checkNicknameExists,
  checkPhoneExists,
  getLinkedPhoneNumber,
} from './authCoreService';

export {
  requireMatchingCurrentUser,
  requireCurrentUserRole,
  requireAdminUser,
} from './authorizationService';
export {
  buildPortOneInicisIdentityRequest,
  callReverifyIdentity,
  callVerifyAndSavePortOneProfile,
  callVerifyPortOneIdentity,
  clearPendingPortOneIdentityRequest,
  clearPortOneIdentityVerificationResult,
  createPortOneIdentityVerificationId,
  getPendingPortOneIdentityRequest,
  getPortOneInicisIdentityConfig,
  isPortOneInicisIdentityConfigured,
  savePendingPortOneIdentityRequest,
  savePortOneIdentityVerificationResult,
} from './portOneIdentityService';

export {
  clearSignupDraft,
  loadSignupDraft,
  saveSignupDraft,
  type SignupDraftMode,
  type SignupDraftPayload,
} from './signupDraftService';

// ============================================================================
// Social Login Service (Apple, Google, 카카오)
// ============================================================================
export {
  signInWithApple,
  signInWithGoogle,
  signInWithKakao,
  completeSocialProfile,
} from './socialLoginService';
export {
  getAppleLoginAvailability,
  type AppleLoginAvailability,
  type AppleLoginAvailabilityReason,
} from './appleAuthService';

// ============================================================================
// Profile Service (프로필, 비밀번호, 구인자 등록)
// ============================================================================
export {
  updateUserProfile,
  updateMarketingConsent,
  changePassword,
  registerAsEmployer,
  updateProfilePhotoURL,
  completeProfile,
  type CompleteProfileData,
} from './profileService';

// ============================================================================
// Storage Service
// ============================================================================
export {
  uploadProfileImage,
  deleteProfileImage,
  replaceProfileImage,
  uploadAnnouncementImage,
  deleteAnnouncementImage,
  replaceAnnouncementImage,
  uploadMultipleAnnouncementImages,
  deleteMultipleAnnouncementImages,
  uploadBoardImage,
  deleteBoardImage,
  uploadMultipleBoardImages,
  deleteMultipleBoardImages,
  type UploadResult,
} from './storageService';

// Account Deletion Service
export {
  requestAccountDeletion,
  retryAppleTokenRevocation,
  cancelAccountDeletion,
  getMyData,
  getDeletionStatus,
  DELETION_GRACE_PERIOD_DAYS,
  DELETION_REASONS,
  type DeletionReason,
  type DeletionRequest,
  type DeletionResult,
} from './accountDeletionService';

// ============================================================================
// Biometric Service
// ============================================================================
export {
  checkBiometricStatus,
  getBiometricTypeName,
  authenticateWithBiometric,
  saveBiometricCredentials,
  getBiometricCredentials,
  clearBiometricCredentials,
  setBiometricEnabled,
  isBiometricEnabled,
  biometricService,
  type BiometricType,
  type BiometricStatus,
  type BiometricAuthResult,
  type BiometricCredentials,
} from './biometricService';
