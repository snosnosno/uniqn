/**
 * UNIQN Mobile - Firebase 설정 (지연 초기화)
 *
 * 지연 초기화 패턴 사용:
 * - ES 모듈 로드 시점에 환경변수가 준비되지 않을 수 있음
 * - Proxy를 통해 최초 사용 시점에 초기화
 * - 환경변수 검증 후 Firebase 초기화 수행
 * - 기존 코드와 100% 호환 (doc(db, ...), auth.currentUser 등)
 *
 * TODO [출시 전]: 환경별 Firebase 프로젝트 분리 (dev/staging/prod)
 * TODO [출시 전]: Firebase Analytics 초기화 추가
 * TODO [출시 전]: Crashlytics 초기화 추가
 * TODO [출시 전]: Firebase Performance Monitoring 추가
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
// @ts-expect-error - getReactNativePersistence exists at runtime but missing from types
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, Firestore, Timestamp } from 'firebase/firestore';

// Re-export Timestamp for components (중앙화된 Firebase 타입 접근)
export { Timestamp };
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnv } from './env';

/**
 * 초기화된 인스턴스 캐시
 */
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let firebaseFunctions: Functions | null = null;

/**
 * 초기화 상태 플래그
 */
let isInitialized = false;
let initializationError: Error | null = null;

/**
 * Firebase 앱 초기화 (내부용)
 * 환경변수 검증 후 초기화 수행
 */
function initializeFirebaseApp(): FirebaseApp {
  // 이미 에러가 발생한 경우 재발생
  if (initializationError) {
    throw initializationError;
  }

  // 이미 초기화된 경우 캐시된 앱 반환
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // 환경변수 검증 (실패 시 명확한 에러 메시지)
    const env = getEnv();

    const firebaseConfig = {
      apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
    };

    // Firebase 앱 초기화 (중복 방지)
    firebaseApp = getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApp();

    isInitialized = true;
    return firebaseApp;
  } catch (error) {
    initializationError = error instanceof Error
      ? error
      : new Error('Firebase 초기화 실패');
    throw initializationError;
  }
}

/**
 * Firebase App 인스턴스 반환
 */
export function getFirebaseApp(): FirebaseApp {
  return initializeFirebaseApp();
}

/**
 * Firebase Auth 인스턴스 반환
 * React Native에서 세션 지속성을 위해 AsyncStorage 사용
 */
export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    const app = initializeFirebaseApp();
    // initializeAuth는 한 번만 호출 가능, 이미 초기화된 경우 getAuth 사용
    try {
      firebaseAuth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // 이미 초기화된 경우 기존 인스턴스 반환
      firebaseAuth = getAuth(app);
    }
  }
  return firebaseAuth;
}

/**
 * Firestore 인스턴스 반환
 */
export function getFirebaseDb(): Firestore {
  if (!firebaseDb) {
    const app = initializeFirebaseApp();
    firebaseDb = getFirestore(app);
  }
  return firebaseDb;
}

/**
 * Firebase Storage 인스턴스 반환
 */
export function getFirebaseStorage(): FirebaseStorage {
  if (!firebaseStorage) {
    const app = initializeFirebaseApp();
    firebaseStorage = getStorage(app);
  }
  return firebaseStorage;
}

/**
 * Cloud Functions 인스턴스 반환
 */
export function getFirebaseFunctions(): Functions {
  if (!firebaseFunctions) {
    const app = initializeFirebaseApp();
    firebaseFunctions = getFunctions(app, 'asia-northeast3');
  }
  return firebaseFunctions;
}

/**
 * Firebase 초기화 상태 확인
 */
export function isFirebaseInitialized(): boolean {
  return isInitialized;
}

/**
 * Firebase 초기화 시도 (에러 없이 상태만 반환)
 */
export function tryInitializeFirebase(): { success: boolean; error?: string } {
  try {
    initializeFirebaseApp();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Firebase 초기화 실패',
    };
  }
}

/**
 * 지연 초기화 Proxy 생성
 * 기존 코드와의 완벽한 호환성을 위해 Proxy 사용
 * - 모든 프로퍼티 접근을 실제 인스턴스로 위임
 * - 최초 접근 시에만 초기화 수행
 */
function createLazyProxy<T extends object>(getter: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const instance = getter();
      const value = (instance as Record<string | symbol, unknown>)[prop];
      // 함수인 경우 바인딩하여 반환
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      return value;
    },
    set(_, prop, value) {
      const instance = getter();
      (instance as Record<string | symbol, unknown>)[prop] = value;
      return true;
    },
    has(_, prop) {
      const instance = getter();
      return prop in instance;
    },
    ownKeys() {
      const instance = getter();
      return Reflect.ownKeys(instance);
    },
    getOwnPropertyDescriptor(_, prop) {
      const instance = getter();
      return Object.getOwnPropertyDescriptor(instance, prop);
    },
  });
}

/**
 * 레거시 호환용 export
 * Proxy를 사용하여 기존 코드와 100% 호환
 *
 * 사용 예시 (기존과 동일):
 * - doc(db, 'collection', 'id')
 * - auth.currentUser
 * - storage.ref(...)
 */
export const app: FirebaseApp = createLazyProxy(getFirebaseApp);
export const auth: Auth = createLazyProxy(getFirebaseAuth);
export const db: Firestore = createLazyProxy(getFirebaseDb);
export const storage: FirebaseStorage = createLazyProxy(getFirebaseStorage);
export const functions: Functions = createLazyProxy(getFirebaseFunctions);

// 기본 export
export default {
  getApp: getFirebaseApp,
  getAuth: getFirebaseAuth,
  getDb: getFirebaseDb,
  getStorage: getFirebaseStorage,
  getFunctions: getFirebaseFunctions,
  isInitialized: isFirebaseInitialized,
  tryInitialize: tryInitializeFirebase,
};
