/**
 * UNIQN Mobile - 보안 스토리지
 *
 * @description 플랫폼별 보안 스토리지 래퍼
 * @version 1.0.0
 *
 * 플랫폼별 동작:
 * - iOS/Android: expo-secure-store (키체인/키스토어)
 * - Web: localStorage with prefix (보안 제한적)
 *
 * 보안 기능:
 * - 자동 만료 (TTL)
 * - 네이티브 암호화 (iOS/Android)
 * - 민감 데이터 분류
 */

import { Platform } from 'react-native';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * 저장 옵션
 */
export interface SecureStorageOptions {
  /**
   * 만료 시간 (초)
   * 0이면 만료 없음
   */
  expiresIn?: number;

  /**
   * iOS 키체인 접근 수준
   */
  keychainAccessible?: KeychainAccessible;
}

/**
 * 저장된 데이터 형식
 */
interface StoredData<T> {
  value: T;
  expiresAt: number | null;
  storedAt: number;
}

/**
 * iOS 키체인 접근 수준
 */
export type KeychainAccessible =
  | 'AFTER_FIRST_UNLOCK'
  | 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY'
  | 'ALWAYS'
  | 'ALWAYS_THIS_DEVICE_ONLY'
  | 'WHEN_UNLOCKED'
  | 'WHEN_UNLOCKED_THIS_DEVICE_ONLY'
  | 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_PREFIX = '@uniqn_secure:';
const DEFAULT_KEYCHAIN_ACCESSIBLE: KeychainAccessible = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

// ============================================================================
// Platform-specific Imports
// ============================================================================

let SecureStore: typeof import('expo-secure-store') | null = null;

/**
 * SecureStore 모듈 로드 (네이티브 전용)
 */
async function loadSecureStore(): Promise<typeof import('expo-secure-store') | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (SecureStore) {
    return SecureStore;
  }

  try {
    SecureStore = await import('expo-secure-store');
    return SecureStore;
  } catch (error) {
    logger.warn('expo-secure-store 로드 실패, localStorage 사용', { error });
    return null;
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 보안 스토리지에 값 저장
 *
 * @example
 * ```typescript
 * // 기본 저장
 * await secureStorage.setItem('authToken', 'xxx');
 *
 * // TTL 설정 (1시간)
 * await secureStorage.setItem('sessionId', 'yyy', { expiresIn: 3600 });
 *
 * // 객체 저장
 * await secureStorage.setItem('user', { id: '1', name: 'John' });
 * ```
 */
export async function setItem<T>(
  key: string,
  value: T,
  options: SecureStorageOptions = {}
): Promise<void> {
  const { expiresIn, keychainAccessible = DEFAULT_KEYCHAIN_ACCESSIBLE } = options;

  try {
    const storageKey = STORAGE_PREFIX + key;

    // 저장 데이터 구성
    const data: StoredData<T> = {
      value,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
      storedAt: Date.now(),
    };

    const serialized = JSON.stringify(data);

    if (Platform.OS === 'web') {
      // 웹: localStorage
      localStorage.setItem(storageKey, serialized);
    } else {
      // 네이티브: SecureStore
      const store = await loadSecureStore();
      if (store) {
        await store.setItemAsync(storageKey, serialized, {
          keychainAccessible: getSecureStoreAccessible(keychainAccessible),
        });
      } else {
        // 폴백: AsyncStorage 형태
        localStorage.setItem(storageKey, serialized);
      }
    }

    logger.debug('SecureStorage 저장', { key, hasExpiry: !!expiresIn });
  } catch (error) {
    logger.error('SecureStorage 저장 실패', error as Error, { key });
    throw error;
  }
}

/**
 * 보안 스토리지에서 값 조회
 *
 * @example
 * ```typescript
 * const token = await secureStorage.getItem<string>('authToken');
 * const user = await secureStorage.getItem<User>('user');
 * ```
 */
export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const storageKey = STORAGE_PREFIX + key;
    let serialized: string | null = null;

    if (Platform.OS === 'web') {
      serialized = localStorage.getItem(storageKey);
    } else {
      const store = await loadSecureStore();
      if (store) {
        serialized = await store.getItemAsync(storageKey);
      } else {
        serialized = localStorage.getItem(storageKey);
      }
    }

    if (!serialized) {
      return null;
    }

    const data: StoredData<T> = JSON.parse(serialized);

    // 만료 확인
    if (data.expiresAt && Date.now() > data.expiresAt) {
      logger.debug('SecureStorage 만료됨', { key });
      await deleteItem(key);
      return null;
    }

    return data.value;
  } catch (error) {
    logger.error('SecureStorage 조회 실패', error as Error, { key });
    return null;
  }
}

/**
 * 보안 스토리지에서 값 삭제
 */
export async function deleteItem(key: string): Promise<void> {
  try {
    const storageKey = STORAGE_PREFIX + key;

    if (Platform.OS === 'web') {
      localStorage.removeItem(storageKey);
    } else {
      const store = await loadSecureStore();
      if (store) {
        await store.deleteItemAsync(storageKey);
      } else {
        localStorage.removeItem(storageKey);
      }
    }

    logger.debug('SecureStorage 삭제', { key });
  } catch (error) {
    logger.error('SecureStorage 삭제 실패', error as Error, { key });
    throw error;
  }
}

/**
 * 여러 키 삭제
 */
export async function deleteItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => deleteItem(key)));
}

/**
 * 모든 UNIQN 관련 데이터 삭제
 */
export async function clearAll(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => localStorage.removeItem(key));
    } else {
      // 네이티브에서는 알려진 키만 삭제 (SecureStore는 전체 목록 조회 불가)
      const knownKeys = [
        'authToken',
        'refreshToken',
        'userId',
        'fcmToken',
        'sessionId',
        'biometricEnabled',
      ];
      await deleteItems(knownKeys);
    }

    logger.info('SecureStorage 전체 삭제 완료');
  } catch (error) {
    logger.error('SecureStorage 전체 삭제 실패', error as Error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * expo-secure-store accessible 옵션 변환
 */
function getSecureStoreAccessible(
  accessible: KeychainAccessible
): import('expo-secure-store').SecureStoreOptions['keychainAccessible'] {
  const mapping: Record<KeychainAccessible, number> = {
    AFTER_FIRST_UNLOCK: 0,
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    ALWAYS: 2,
    ALWAYS_THIS_DEVICE_ONLY: 3,
    WHEN_UNLOCKED: 4,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 5,
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 6,
  };

  return mapping[accessible] ?? mapping.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
}

/**
 * 값이 만료되었는지 확인
 */
export async function isExpired(key: string): Promise<boolean> {
  try {
    const storageKey = STORAGE_PREFIX + key;
    let serialized: string | null = null;

    if (Platform.OS === 'web') {
      serialized = localStorage.getItem(storageKey);
    } else {
      const store = await loadSecureStore();
      if (store) {
        serialized = await store.getItemAsync(storageKey);
      } else {
        serialized = localStorage.getItem(storageKey);
      }
    }

    if (!serialized) {
      return true; // 존재하지 않음 = 만료됨
    }

    const data: StoredData<unknown> = JSON.parse(serialized);
    return data.expiresAt !== null && Date.now() > data.expiresAt;
  } catch {
    return true;
  }
}

/**
 * 키 존재 여부 확인
 */
export async function hasItem(key: string): Promise<boolean> {
  const value = await getItem(key);
  return value !== null;
}

/**
 * 저장된 시간 조회
 */
export async function getStoredAt(key: string): Promise<number | null> {
  try {
    const storageKey = STORAGE_PREFIX + key;
    let serialized: string | null = null;

    if (Platform.OS === 'web') {
      serialized = localStorage.getItem(storageKey);
    } else {
      const store = await loadSecureStore();
      if (store) {
        serialized = await store.getItemAsync(storageKey);
      } else {
        serialized = localStorage.getItem(storageKey);
      }
    }

    if (!serialized) {
      return null;
    }

    const data: StoredData<unknown> = JSON.parse(serialized);
    return data.storedAt;
  } catch {
    return null;
  }
}

// ============================================================================
// Predefined Keys
// ============================================================================

/**
 * 인증 토큰 관련 함수
 */
export const authStorage = {
  async setAuthToken(token: string): Promise<void> {
    await setItem('authToken', token, {
      keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    });
  },

  async getAuthToken(): Promise<string | null> {
    return getItem<string>('authToken');
  },

  async setRefreshToken(token: string): Promise<void> {
    await setItem('refreshToken', token, {
      keychainAccessible: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    });
  },

  async getRefreshToken(): Promise<string | null> {
    return getItem<string>('refreshToken');
  },

  async clearTokens(): Promise<void> {
    await deleteItems(['authToken', 'refreshToken']);
  },
};

/**
 * 사용자 세션 관련 함수
 */
export const sessionStorage = {
  async setUserId(userId: string): Promise<void> {
    await setItem('userId', userId);
  },

  async getUserId(): Promise<string | null> {
    return getItem<string>('userId');
  },

  async setFCMToken(token: string): Promise<void> {
    await setItem('fcmToken', token);
  },

  async getFCMToken(): Promise<string | null> {
    return getItem<string>('fcmToken');
  },

  async clearSession(): Promise<void> {
    await deleteItems(['userId', 'fcmToken', 'sessionId']);
    await authStorage.clearTokens();
  },
};

/**
 * 설정 관련 함수
 */
export const settingsStorage = {
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await setItem('biometricEnabled', enabled);
  },

  async isBiometricEnabled(): Promise<boolean> {
    return (await getItem<boolean>('biometricEnabled')) ?? false;
  },

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await setItem('theme', theme);
  },

  async getTheme(): Promise<'light' | 'dark' | 'system' | null> {
    return getItem<'light' | 'dark' | 'system'>('theme');
  },

  /**
   * 자동 로그인 설정
   * 기본값: true (자동 로그인 활성화)
   */
  async setAutoLoginEnabled(enabled: boolean): Promise<void> {
    await setItem('autoLoginEnabled', enabled);
    logger.info('자동 로그인 설정 변경', { enabled });
  },

  async isAutoLoginEnabled(): Promise<boolean> {
    // 기본값: true (자동 로그인 기본 활성화)
    return (await getItem<boolean>('autoLoginEnabled')) ?? true;
  },
};

// ============================================================================
// Export
// ============================================================================

export const secureStorage = {
  // Core
  setItem,
  getItem,
  deleteItem,
  deleteItems,
  clearAll,

  // Helpers
  isExpired,
  hasItem,
  getStoredAt,

  // Predefined
  auth: authStorage,
  session: sessionStorage,
  settings: settingsStorage,
};

export default secureStorage;
