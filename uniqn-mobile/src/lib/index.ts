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
  queryCachingOptions,
  invalidateQueries,
} from './queryClient';

// Cache Invalidation Strategy (Phase 2.3)
export {
  invalidateRelated,
  invalidateMultiple,
  invalidateDomain,
  createInvalidationHandler,
  createMultiInvalidationHandler,
  invalidationGraph,
  type InvalidationEvent,
  type InvalidationContext,
} from './invalidationStrategy';

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
  userSessionStorage,
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
