/**
 * UNIQN Mobile - Lib Index
 *
 * @description 라이브러리 설정 중앙 인덱스
 * @version 1.0.0
 */

// Firebase
export { app, auth, db, storage, functions } from './firebase';

// React Query
export {
  queryClient,
  queryKeys,
  cachingPolicies,
  invalidateQueries,
} from './queryClient';

// Secure Storage
export {
  secureStorage,
  setItem,
  getItem,
  deleteItem,
  deleteItems,
  clearAll,
  isExpired,
  hasItem,
  getStoredAt,
  authStorage,
  sessionStorage,
  settingsStorage,
  type SecureStorageOptions,
  type KeychainAccessible,
} from './secureStorage';

// MMKV Storage (High-performance key-value storage)
export {
  mmkvStorage,
  getMMKVInstance,
  getSecureMMKVInstance,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  clearStorageByPrefix,
  clearAllStorage,
  STORAGE_KEYS,
  type StorageKey,
} from './mmkvStorage';
