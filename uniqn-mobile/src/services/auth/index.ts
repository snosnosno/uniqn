/**
 * UNIQN Mobile - Auth 도메인 배럴 Export
 *
 * @description 인증 관련 서비스 (auth, accountDeletion, storage, biometric)
 * @version 1.0.0
 */

// ============================================================================
// Auth Service
// ============================================================================
export {
  login,
  signUp,
  signOut,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  reauthenticate,
  getCurrentUser,
  requireCurrentUser,
  onAuthStateChanged,
  signInWithApple,
  signInWithGoogle,
  signInWithKakao,
  completeSocialProfile,
  changePassword,
  updateProfilePhotoURL,
  checkEmailExists,
  checkNicknameExists,
  checkPhoneExists,
  registerAsEmployer,
  updateMarketingConsent,
  rollbackPhoneOnlyAccount,
  getCurrentUserUid,
  getLinkedPhoneNumber,
  unlinkPhoneProvider,
  markOrphanAccount,
  type UserProfile,
  type AuthResult,
  type SocialProfileData,
} from './authService';

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
  type UploadResult,
} from './storageService';

// ============================================================================
// Account Deletion Service
// ============================================================================
export {
  requestAccountDeletion,
  retryAppleTokenRevocation,
  cancelAccountDeletion,
  getMyData,
  updateMyData,
  exportMyData,
  permanentlyDeleteAccount,
  getDeletionStatus,
  DELETION_REASONS,
  type DeletionReason,
  type DeletionRequest,
  type DeletionResult,
  type UserData,
  type UserDataExport,
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
