/**
 * E2E 테스트용 계정 정의
 * Supabase에 pre-seeded된 테스트 계정
 */

export interface TestAccount {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly role: 'staff' | 'employer' | 'admin';
  readonly uid: string;
  readonly phoneNumber: string;
}

type TestAccountKey = 'staff' | 'employer' | 'admin' | 'collaborator';

export const TEST_ACCOUNTS: Readonly<Record<TestAccountKey, TestAccount>> = {
  staff: {
    uid: '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8',
    email: 'qa-staff@uniqn.test',
    password: 'TestPass1!',
    displayName: 'QA스태프',
    role: 'staff',
    phoneNumber: '+82101234567',
  },
  employer: {
    uid: '9cf771e9-0e67-413d-8395-5b1d573ae64d',
    email: 'qa-employer@uniqn.test',
    password: 'TestPass1!',
    displayName: 'QA구인자',
    role: 'employer',
    phoneNumber: '+82109876543',
  },
  admin: {
    uid: '95337a77-9700-427e-8ff3-bc7a14abb90e',
    email: 'qa-admin@uniqn.test',
    password: 'TestPass1!',
    displayName: 'QA관리자',
    role: 'admin',
    phoneNumber: '+82105555555',
  },
  // PR #88 follow-up: 공고별 협업자 — qa-employer 의 공고에 추가되어 "공유받은 공고" 섹션 검증용
  collaborator: {
    uid: 'c1a2b3c4-d5e6-4f7a-8b9c-d0e1f2a3b4c5',
    email: 'qa-collaborator@uniqn.test',
    password: 'TestPass1!',
    displayName: 'QA협업자',
    role: 'employer',
    phoneNumber: '+82107777777',
  },
} as const;
