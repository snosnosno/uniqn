/**
 * UNIQN Mobile - MMKV Storage 설정
 *
 * @description 고성능 key-value 스토리지 (AsyncStorage 대체)
 * @version 1.1.0
 *
 * 특징:
 * - AsyncStorage보다 30배 빠름
 * - 동기식 API 지원
 * - Zustand persist 미들웨어 호환
 * - SecureStore 연동 암호화 지원 (민감 데이터용)
 *
 * @see https://github.com/mrousavy/react-native-mmkv
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { StateStorage } from 'zustand/middleware';
import { logger } from '@/utils/logger';

// 경고 중복 방지 플래그
let mmkvWarningShown = false;

// ============================================================================
// MMKV Instance (Conditional Import)
// ============================================================================

/**
 * MMKV 인스턴스 타입
 */
type MMKVInstance = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
  contains: (key: string) => boolean;
  getAllKeys: () => string[];
  clearAll: () => void;
};

/**
 * MMKV 인스턴스
 *
 * 웹에서는 localStorage 폴백 사용
 * 네이티브에서는 react-native-mmkv 사용
 */
let mmkvInstance: MMKVInstance | null = null;

/** 암호화된 민감 데이터용 MMKV 인스턴스 */
let secureMMKVInstance: MMKVInstance | null = null;

/** 암호화 키 관련 상수 */
const ENCRYPTION_KEY_ID = 'mmkv-encryption-key';

/**
 * 웹 환경용 localStorage 래퍼 생성
 */
function createWebStorageWrapper(prefix = ''): MMKVInstance {
  return {
    getString: (key: string) => {
      try {
        return localStorage.getItem(prefix + key) ?? undefined;
      } catch {
        return undefined;
      }
    },
    set: (key: string, value: string) => {
      try {
        localStorage.setItem(prefix + key, value);
      } catch (e) {
        logger.warn('[MMKV] localStorage set 실패', { error: e });
      }
    },
    delete: (key: string) => {
      try {
        localStorage.removeItem(prefix + key);
      } catch (e) {
        logger.warn('[MMKV] localStorage delete 실패', { error: e });
      }
    },
    contains: (key: string) => {
      try {
        return localStorage.getItem(prefix + key) !== null;
      } catch {
        return false;
      }
    },
    getAllKeys: () => {
      try {
        return Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      } catch {
        return [];
      }
    },
    clearAll: () => {
      try {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
        keys.forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        logger.warn('[MMKV] localStorage clear 실패', { error: e });
      }
    },
  };
}

/**
 * 메모리 스토리지 폴백 생성
 */
function createMemoryStorageFallback(): MMKVInstance {
  const memoryStorage = new Map<string, string>();
  return {
    getString: (key: string) => memoryStorage.get(key),
    set: (key: string, value: string) => memoryStorage.set(key, value),
    delete: (key: string) => memoryStorage.delete(key),
    contains: (key: string) => memoryStorage.has(key),
    getAllKeys: () => Array.from(memoryStorage.keys()),
    clearAll: () => memoryStorage.clear(),
  };
}

/**
 * Expo Go 환경인지 확인
 */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

/**
 * MMKV 초기화
 *
 * 웹: localStorage 사용
 * 네이티브: MMKV 사용 (설치 필요)
 * Expo Go: 메모리 스토리지 (네이티브 모듈 미지원)
 */
function initializeMMKV(): MMKVInstance {
  if (Platform.OS === 'web') {
    return createWebStorageWrapper();
  }

  // Expo Go에서는 네이티브 모듈 사용 불가
  if (isExpoGo()) {
    if (!mmkvWarningShown) {
      mmkvWarningShown = true;
      logger.info('[MMKV] Expo Go 환경 - 메모리 스토리지 사용 (정상)');
    }
    return createMemoryStorageFallback();
  }

  // 네이티브 환경: MMKV 사용 시도
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv');
    return new MMKV({
      id: 'uniqn-storage',
    });
  } catch {
    if (!mmkvWarningShown) {
      mmkvWarningShown = true;
      logger.warn('[MMKV] 네이티브 모듈 로드 실패 - 메모리 스토리지 사용');
    }
    return createMemoryStorageFallback();
  }
}

/**
 * 암호화된 MMKV 인스턴스 초기화
 *
 * SecureStore에서 암호화 키를 가져오거나 새로 생성
 * 민감한 데이터 저장에 사용
 */
async function initializeSecureMMKV(): Promise<MMKVInstance> {
  if (Platform.OS === 'web') {
    // 웹: 별도 prefix로 localStorage 사용 (완전한 암호화 불가)
    logger.warn('[MMKV] 웹 환경에서는 암호화가 제한적입니다.');
    return createWebStorageWrapper('secure-');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv');
    const SecureStore = await import('expo-secure-store');

    // SecureStore에서 기존 암호화 키 가져오기 또는 생성
    let encryptionKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_ID);

    if (!encryptionKey) {
      // 새 암호화 키 생성 (32자 랜덤 문자열)
      encryptionKey = generateEncryptionKey();
      await SecureStore.setItemAsync(ENCRYPTION_KEY_ID, encryptionKey, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }

    return new MMKV({
      id: 'uniqn-secure-storage',
      encryptionKey,
    });
  } catch (error) {
    logger.warn('[MMKV] 암호화된 MMKV 초기화 실패, 일반 스토리지 사용', { error });
    return initializeMMKV();
  }
}

/**
 * 암호화 키 생성 (32자)
 */
function generateEncryptionKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * MMKV 인스턴스 가져오기 (싱글톤)
 * 항상 non-null 인스턴스를 반환 (초기화 보장)
 */
export function getMMKVInstance(): MMKVInstance {
  if (!mmkvInstance) {
    mmkvInstance = initializeMMKV();
  }
  return mmkvInstance;
}

/**
 * 암호화된 MMKV 인스턴스 가져오기 (싱글톤, 비동기)
 *
 * 민감한 데이터 저장에 사용 (토큰, 개인정보 등)
 * SecureStore에 저장된 키로 암호화됨
 *
 * @example
 * ```ts
 * const secureStorage = await getSecureMMKVInstance();
 * secureStorage.set('sensitiveData', JSON.stringify(data));
 * ```
 */
export async function getSecureMMKVInstance(): Promise<MMKVInstance> {
  if (!secureMMKVInstance) {
    secureMMKVInstance = await initializeSecureMMKV();
  }
  return secureMMKVInstance;
}

// ============================================================================
// Zustand StateStorage Adapter
// ============================================================================

/**
 * Zustand persist 미들웨어용 MMKV 스토리지 어댑터
 *
 * @example
 * ```ts
 * import { mmkvStorage } from '@/lib/mmkvStorage';
 *
 * const useStore = create(
 *   persist(
 *     (set) => ({ ... }),
 *     {
 *       name: 'my-store',
 *       storage: createJSONStorage(() => mmkvStorage),
 *     }
 *   )
 * );
 * ```
 */
export const mmkvStorage: StateStorage = {
  getItem: (name: string): string | null => {
    const storage = getMMKVInstance();
    const value = storage.getString(name);
    return value ?? null;
  },

  setItem: (name: string, value: string): void => {
    const storage = getMMKVInstance();
    storage.set(name, value);
  },

  removeItem: (name: string): void => {
    const storage = getMMKVInstance();
    storage.delete(name);
  },
};

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * 스토리지 키 상수
 *
 * 일관된 키 관리를 위해 중앙 집중화
 */
export const STORAGE_KEYS = {
  // 인증
  AUTH: 'auth-storage',
  AUTH_TOKEN: 'auth-token',
  REFRESH_TOKEN: 'refresh-token',

  // 사용자 설정
  THEME: 'theme-storage',
  NOTIFICATIONS: 'notification-storage',
  PREFERENCES: 'user-preferences',

  // 캐시
  JOB_POSTINGS_CACHE: 'job-postings-cache',
  SCHEDULES_CACHE: 'schedules-cache',

  // 임시 데이터
  FORM_DRAFT: 'form-draft',
  SEARCH_HISTORY: 'search-history',
  RECENT_JOBS: 'recent-jobs',

  // 토큰 갱신
  TOKEN_REFRESH_STATE: 'token-refresh-state',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 스토리지에서 JSON 데이터 읽기
 */
export function getStorageItem<T>(key: StorageKey): T | null {
  const storage = getMMKVInstance();
  const value = storage.getString(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    logger.warn('[MMKV] JSON 파싱 실패', { key });
    return null;
  }
}

/**
 * 스토리지에 JSON 데이터 저장
 */
export function setStorageItem<T>(key: StorageKey, value: T): void {
  const storage = getMMKVInstance();
  try {
    storage.set(key, JSON.stringify(value));
  } catch (e) {
    logger.warn('[MMKV] JSON 직렬화 실패', { key, error: e });
  }
}

/**
 * 스토리지에서 항목 삭제
 */
export function removeStorageItem(key: StorageKey): void {
  const storage = getMMKVInstance();
  storage.delete(key);
}

/**
 * 특정 접두사로 시작하는 모든 키 삭제
 */
export function clearStorageByPrefix(prefix: string): void {
  const storage = getMMKVInstance();
  const allKeys = storage.getAllKeys();
  allKeys.forEach((key) => {
    if (key.startsWith(prefix)) {
      storage.delete(key);
    }
  });
}

/**
 * 전체 스토리지 초기화
 *
 * ⚠️ 주의: 모든 데이터가 삭제됨
 */
export function clearAllStorage(): void {
  const storage = getMMKVInstance();
  storage.clearAll();
}

// ============================================================================
// AsyncStorage → MMKV Migration
// ============================================================================

const MIGRATION_COMPLETED_KEY = '@uniqn:mmkv_migration_completed';

/**
 * AsyncStorage에서 MMKV로 데이터 마이그레이션
 *
 * 마이그레이션 대상:
 * - @uniqn:update_dismissed_* (업데이트 모달 "나중에" 기록)
 * - uniqn-in-app-messages (인앱 메시지 표시 이력)
 *
 * @returns 마이그레이션 성공 여부
 */
export async function migrateFromAsyncStorage(): Promise<boolean> {
  // 웹 환경에서는 스킵
  if (Platform.OS === 'web') {
    return true;
  }

  const storage = getMMKVInstance();

  // 이미 마이그레이션 완료된 경우 스킵
  if (storage.contains(MIGRATION_COMPLETED_KEY)) {
    return true;
  }

  try {
    // AsyncStorage 동적 import (설치되지 않은 경우 대비)
    const AsyncStorage = await import('@react-native-async-storage/async-storage').then(
      (m) => m.default
    );

    const allKeys = await AsyncStorage.getAllKeys();
    let migratedCount = 0;

    // 마이그레이션 대상 키 패턴
    const migrationPatterns = [
      '@uniqn:update_dismissed_', // useVersionCheck
      'uniqn-in-app-messages', // inAppMessageStore (Zustand persist)
    ];

    for (const key of allKeys) {
      const shouldMigrate = migrationPatterns.some(
        (pattern) => key === pattern || key.startsWith(pattern)
      );

      if (shouldMigrate) {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
          storage.set(key, value);
          migratedCount++;
          logger.info('[MMKV] 마이그레이션 완료', { key });
        }
      }
    }

    // 마이그레이션 완료 플래그 설정
    storage.set(MIGRATION_COMPLETED_KEY, Date.now().toString());

    if (migratedCount > 0) {
      logger.info('[MMKV] AsyncStorage → MMKV 마이그레이션 완료', {
        migratedCount,
      });
    }

    return true;
  } catch (error) {
    logger.warn('[MMKV] 마이그레이션 실패 (AsyncStorage 미설치 또는 에러)', {
      error,
    });
    // 마이그레이션 실패해도 앱 실행에는 영향 없음
    storage.set(MIGRATION_COMPLETED_KEY, Date.now().toString());
    return false;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  mmkvStorage,
  getMMKVInstance,
  getSecureMMKVInstance,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  clearStorageByPrefix,
  clearAllStorage,
  migrateFromAsyncStorage,
  STORAGE_KEYS,
};
