/**
 * UNIQN Mobile - Auth 도메인 배럴 Export
 *
 * @description 인증 관련 서비스 (auth, accountDeletion, storage, biometric)
 *
 * ⚠️ **실제 소비되는 심볼만** 재수출한다. 구현 모듈이 export 한다고 해서 여기에 올리지 말 것 —
 * 안 쓰이는 재수출은 공개 표면만 넓히고 사문으로 남는다. 새로 필요해지면 그때 추가하라.
 * (`@/services` 배럴은 이 배럴을 거치지 않고 구현 모듈에서 직접 재수출한다.)
 *
 * @version 3.0.0
 */

// ============================================================================
// Auth Core Service (로그인, 회원가입, 세션)
// ============================================================================
export { checkEmailExists, checkNicknameExists, getUserProfile, signOut } from './authCoreService';

// ============================================================================
// 본인확인 (PortOne 이니시스)
// ============================================================================
export { isIdentityVerificationInvalidError } from './portOneIdentityService';
export type { VerifiedPortOneIdentity } from './portOneIdentityService';

// ============================================================================
// 회원가입 임시저장
// ============================================================================
export { clearSignupDraft, loadSignupDraft, saveSignupDraft } from './signupDraftService';

// ============================================================================
// Profile Service (프로필, 구인자 등록)
// ============================================================================
export { completeProfile, registerAsEmployer, updateMarketingConsent } from './profileService';

// ============================================================================
// Storage Service
// ============================================================================
export {
  deleteMultipleAnnouncementImages,
  uploadMultipleAnnouncementImages,
  uploadMultipleBoardImages,
} from './storageService';

// ============================================================================
// Account Deletion Service
// ============================================================================
export { cancelAccountDeletion } from './accountDeletionService';

// ============================================================================
// Biometric Service
// ============================================================================
export {
  authenticateWithBiometric,
  checkBiometricStatus,
  clearBiometricCredentials,
  getBiometricCredentials,
  getBiometricTypeName,
  isBiometricEnabled,
  saveBiometricCredentials,
  setBiometricEnabled,
} from './biometricService';
export type { BiometricAuthResult, BiometricStatus } from './biometricService';
