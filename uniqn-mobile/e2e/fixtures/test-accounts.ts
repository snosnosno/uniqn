/**
 * E2E 테스트용 계정 정의
 * Firebase Emulator에서 생성될 테스트 계정
 */

export interface TestAccount {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly role: 'staff' | 'employer' | 'admin';
  readonly uid: string;
  readonly phoneNumber: string;
}

export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  staff: {
    uid: 'test-staff-uid-001',
    email: 'staff@test.com',
    password: 'TestPass1!',
    displayName: '테스트스태프',
    role: 'staff',
    phoneNumber: '+82101234567',
  },
  employer: {
    uid: 'test-employer-uid-001',
    email: 'employer@test.com',
    password: 'TestPass1!',
    displayName: '테스트구인자',
    role: 'employer',
    phoneNumber: '+82109876543',
  },
  admin: {
    uid: 'test-admin-uid-001',
    email: 'admin@test.com',
    password: 'TestPass1!',
    displayName: '테스트관리자',
    role: 'admin',
    phoneNumber: '+82105555555',
  },
} as const;

/**
 * 테스트 계정의 Firestore 프로필 데이터 생성
 */
export function createTestProfile(account: TestAccount) {
  return {
    uid: account.uid,
    email: account.email,
    name: account.displayName,
    nickname: account.displayName,
    displayName: account.displayName,
    role: account.role,
    status: 'active' as const,
    isActive: true,
    phoneNumber: account.phoneNumber,
    phoneVerified: true,
    profileCompleted: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
