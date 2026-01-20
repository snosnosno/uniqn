// Firebase 초기화 및 인증/DB 인스턴스 export
import { initializeApp } from 'firebase/app';
import { logger } from './utils/logger';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  writeBatch,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
// Import centralized config
import { firebaseConfig, emulatorConfig, validateConfig } from './config/firebase.config';

// Validate configuration on load
if (!validateConfig()) {
  logger.warn('Firebase configuration validation failed', {
    component: 'firebase.ts',
  });
}

const app = initializeApp(firebaseConfig);
export { app }; // Export app for Firebase Performance

export const auth = getAuth(app);

// Connect to Firebase Emulators for local development
const { useEmulator: isEmulator } = emulatorConfig;

// Initialize Firestore with proper settings based on environment
let db: ReturnType<typeof getFirestore>;

try {
  if (isEmulator) {
    // For emulator environment, use getFirestore
    db = getFirestore(app);
    logger.info('Firestore initialized for emulator environment', {
      component: 'firebase',
      environment: 'emulator',
    });
  } else {
    // For production, also use getFirestore for now
    // Firebase v11 cache settings are still experimental
    db = getFirestore(app);
    logger.info('Firestore initialized for production environment', {
      component: 'firebase',
      environment: 'production',
    });
  }
} catch (error) {
  // Fallback to getFirestore if initialization fails
  db = getFirestore(app);
  logger.warn('Fallback to getFirestore due to initialization error', {
    component: 'firebase',
    errorInfo: String(error),
  });
}

export { db };

// Initialize Functions (asia-northeast3 리전 명시 - CORS 오류 방지)
export const functions = getFunctions(app, 'asia-northeast3');

// Initialize Storage
export const storage = getStorage(app);

if (isEmulator) {
  // Connect Functions Emulator
  connectFunctionsEmulator(functions, 'localhost', 5001);
  logger.info('Functions emulator connected', { data: { port: 5001 } });
  try {
    // Connect Auth Emulator with additional security options
    connectAuthEmulator(auth, 'http://localhost:9099', {
      disableWarnings: true,
      // Force emulator mode to bypass token endpoint issues
    });

    // Set additional emulator-specific settings
    if (typeof window !== 'undefined') {
      // Disable token refresh for emulator mode
      window.__FIREBASE_DEFAULTS__ = {
        ...(window.__FIREBASE_DEFAULTS__ || {}),
        emulatorHosts: {
          auth: 'localhost:9099',
          firestore: 'localhost:8080',
        },
      };
    }
  } catch (error) {
    // Emulator already connected or unavailable
  }

  try {
    // Connect Firestore Emulator
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (error) {
    // Emulator already connected or unavailable
  }

  try {
    // Connect Storage Emulator
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    // Emulator already connected or unavailable
  }
}

export const setupTestData = async () => {
  const tablesCollectionRef = collection(db, 'tables');
  const snapshot = await getDocs(tablesCollectionRef);

  if (!snapshot.empty) {
    return 'SKIPPED';
  }

  const batch = writeBatch(db);

  // Create 10 tables
  for (let i = 1; i <= 10; i++) {
    const tableRef = doc(collection(db, 'tables'));
    batch.set(tableRef, {
      tableNumber: i,
      seats: Array(9).fill(null),
    });
  }

  // Create 80 participants
  for (let i = 1; i <= 80; i++) {
    const participantRef = doc(collection(db, 'participants'));
    batch.set(participantRef, {
      name: `Participant ${i}`,
      chips: 10000,
      buyInStatus: 'paid',
      status: 'active',
    });
  }

  try {
    await batch.commit();
    return 'SUCCESS';
  } catch (error) {
    logger.error(
      'Error writing test data: ',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'firebase' }
    );
    return 'ERROR';
  }
};

// 🚫 DEPRECATED: promoteToStaff 함수 완전 비활성화
// persons 컬렉션은 WorkLog의 staffInfo 필드로 완전히 통합되었습니다.
// 이 함수는 더 이상 사용되지 않으며, WorkLog 생성은 useApplicantActions에서 직접 처리됩니다.
export const promoteToStaff = async (
  documentId: string,
  userName: string,
  jobRole: string,
  postingId: string,
  _managerId: string,
  _assignedRole?: string,
  _assignedTime?: string,
  _email?: string,
  _phone?: string,
  _assignedDate?: string,
  _actualUserId?: string
) => {
  // 🚫 함수 완전 비활성화 - 더 이상 사용하지 않음
  logger.warn(
    '⚠️ promoteToStaff 함수는 deprecated되었습니다. WorkLog 생성은 useApplicantActions에서 직접 처리됩니다.',
    {
      component: 'firebase',
      data: { documentId, postingId },
    }
  );

  // 더 이상 WorkLog를 생성하지 않고 즉시 반환
  return Promise.resolve();
};
