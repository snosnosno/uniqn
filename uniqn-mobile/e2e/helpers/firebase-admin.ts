/**
 * Firebase Admin SDK 유틸리티 (테스트 데이터 시딩용)
 */
import { initializeApp, getApps, deleteApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { E2E_CONFIG } from '../config';

let adminApp: App | null = null;

/**
 * Firebase Admin 앱 초기화 (에뮬레이터 연결)
 */
export function getAdminApp(): App {
  if (adminApp) return adminApp;

  process.env.FIREBASE_AUTH_EMULATOR_HOST = E2E_CONFIG.emulator.authHost;
  process.env.FIRESTORE_EMULATOR_HOST = E2E_CONFIG.emulator.firestoreHost;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  adminApp = initializeApp({ projectId: E2E_CONFIG.projectId });
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/**
 * Firestore에 테스트 데이터 시딩
 */
export async function seedDocument(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const db = getAdminDb();
  await db.collection(collectionPath).doc(docId).set(data, { merge: true });
}

/**
 * Firestore 문서 삭제
 */
export async function deleteDocument(
  collectionPath: string,
  docId: string
): Promise<void> {
  const db = getAdminDb();
  await db.collection(collectionPath).doc(docId).delete();
}

/**
 * Admin 앱 정리
 */
export async function cleanupAdmin(): Promise<void> {
  if (adminApp) {
    await deleteApp(adminApp);
    adminApp = null;
  }
}
