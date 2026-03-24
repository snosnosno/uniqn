import { Platform } from 'react-native';

const CURRENT_SESSION_USER_KEY = 'uniqn_current_session_user';

function isSessionStorageAvailable(): boolean {
  return Platform.OS === 'web' && typeof sessionStorage !== 'undefined';
}

export function markCurrentAutoLoginSession(uid: string): void {
  if (!isSessionStorageAvailable()) {
    return;
  }

  sessionStorage.setItem(CURRENT_SESSION_USER_KEY, uid);
}

export function clearCurrentAutoLoginSession(): void {
  if (!isSessionStorageAvailable()) {
    return;
  }

  sessionStorage.removeItem(CURRENT_SESSION_USER_KEY);
}

export function isCurrentAutoLoginSession(uid: string): boolean {
  if (!isSessionStorageAvailable()) {
    return false;
  }

  return sessionStorage.getItem(CURRENT_SESSION_USER_KEY) === uid;
}
