/**
 * 인증 헬퍼 — localStorage 주입 및 세션 관리
 */
import type { Page } from '@playwright/test';
import { TEST_ACCOUNTS, type TestAccount } from '../fixtures/test-accounts';

type RoleName = keyof typeof TEST_ACCOUNTS;

/**
 * localStorage에 인증 상태 주입 (storageState 대안)
 *
 * 주의: Firebase Auth 세션(IndexedDB)은 주입하지 않으므로
 * 앱 초기화 시 Firebase Auth 확인에서 실패할 수 있음.
 * 가능하면 storageState 파일 사용을 권장.
 */
export async function injectAuthState(
  page: Page,
  role: RoleName
): Promise<void> {
  const account = TEST_ACCOUNTS[role];

  const authStorage = JSON.stringify({
    state: {
      user: {
        uid: account.uid,
        email: account.email,
        displayName: account.displayName,
        photoURL: null,
        emailVerified: true,
        phoneNumber: account.phoneNumber,
      },
      profile: {
        uid: account.uid,
        email: account.email,
        name: account.displayName,
        nickname: account.displayName,
        displayName: account.displayName,
        role: account.role,
        isActive: true,
        phoneNumber: account.phoneNumber,
        phoneVerified: true,
        profileCompleted: true,
      },
      isInitialized: true,
    },
    version: 0,
  });

  await page.addInitScript((storage) => {
    localStorage.setItem('auth-storage', storage);
  }, authStorage);
}

/**
 * 인증 상태 초기화
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem('auth-storage');
  });
}

/**
 * 테스트 계정 정보 반환
 */
export function getTestAccount(role: RoleName): TestAccount {
  return TEST_ACCOUNTS[role];
}
