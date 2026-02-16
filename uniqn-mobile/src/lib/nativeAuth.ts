/**
 * UNIQN Mobile - Native Firebase Auth SDK 공통 모듈
 *
 * @description @react-native-firebase/auth의 Modular API를 한곳에서 import하여
 *              authService, authBridge, PhoneVerification 등에서 중복 코드를 제거합니다.
 *              웹 플랫폼에서는 모든 함수가 null이므로 호출 전 hasNativeAuth 확인 필요.
 *
 * @version 1.0.0
 */

import { Platform } from 'react-native';

// 타입 재사용을 위한 import
type NativeAuthModule = import('@react-native-firebase/auth').FirebaseAuthTypes.Module;

// ============================================================================
// Native SDK 함수 참조
// ============================================================================

let _getAuth: (() => NativeAuthModule) | null = null;
let _signInWithEmailAndPassword:
  | typeof import('@react-native-firebase/auth').signInWithEmailAndPassword
  | null = null;
let _signInWithPhoneNumber:
  | typeof import('@react-native-firebase/auth').signInWithPhoneNumber
  | null = null;
let _linkWithCredential: typeof import('@react-native-firebase/auth').linkWithCredential | null =
  null;
let _updateProfile: typeof import('@react-native-firebase/auth').updateProfile | null = null;
let _deleteUser: typeof import('@react-native-firebase/auth').deleteUser | null = null;
let _signOut: typeof import('@react-native-firebase/auth').signOut | null = null;
let _EmailAuthProvider: typeof import('@react-native-firebase/auth').EmailAuthProvider | null =
  null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-firebase/auth');
  _getAuth = mod.getAuth;
  _signInWithEmailAndPassword = mod.signInWithEmailAndPassword;
  _signInWithPhoneNumber = mod.signInWithPhoneNumber;
  _linkWithCredential = mod.linkWithCredential;
  _updateProfile = mod.updateProfile;
  _deleteUser = mod.deleteUser;
  _signOut = mod.signOut;
  _EmailAuthProvider = mod.EmailAuthProvider;
}

// ============================================================================
// Exports
// ============================================================================

/** 네이티브 플랫폼 여부 (web이면 false) */
export const hasNativeAuth = Platform.OS !== 'web';

export const getNativeAuth = _getAuth;
export const nativeSignInWithEmailAndPassword = _signInWithEmailAndPassword;
export const nativeSignInWithPhoneNumber = _signInWithPhoneNumber;
export const nativeLinkWithCredential = _linkWithCredential;
export const nativeUpdateProfile = _updateProfile;
export const nativeDeleteUser = _deleteUser;
export const nativeSignOut = _signOut;
export const NativeEmailAuthProvider = _EmailAuthProvider;
