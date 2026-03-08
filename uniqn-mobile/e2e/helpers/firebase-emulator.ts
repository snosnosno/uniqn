/**
 * Firebase Emulator 유틸리티
 */

const AUTH_EMULATOR_URL = 'http://localhost:9099';
const FIRESTORE_EMULATOR_URL = 'http://localhost:8080';

/**
 * Firebase Auth 에뮬레이터 상태 확인
 */
export async function isAuthEmulatorRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${AUTH_EMULATOR_URL}/`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Firebase Auth 에뮬레이터의 모든 사용자 삭제
 */
export async function clearAuthEmulator(projectId: string): Promise<void> {
  await fetch(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${projectId}/accounts`,
    { method: 'DELETE' }
  );
}

/**
 * Firestore 에뮬레이터의 모든 데이터 삭제
 */
export async function clearFirestoreEmulator(projectId: string): Promise<void> {
  await fetch(
    `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
}
