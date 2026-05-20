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
    uid: 'a1111111-1111-4111-a111-111111111111',
    email: 'review-staff@uniqn.app',
    password: 'Review2026!',
    displayName: '심사용 스태프',
    role: 'staff',
    phoneNumber: '+821011110001',
  },
  employer: {
    uid: 'b2222222-2222-4222-b222-222222222222',
    email: 'review-employer@uniqn.app',
    password: 'Review2026!',
    displayName: '심사용 구인자',
    role: 'employer',
    phoneNumber: '+821022220002',
  },
  admin: {
    uid: 'c3333333-3333-4333-c333-333333333333',
    email: 'review-admin@uniqn.app',
    password: 'Review2026!',
    displayName: '심사용 관리자',
    role: 'admin',
    phoneNumber: '+821033330003',
  },
  // PR #88 follow-up: 공고별 협업자 — review-employer 의 공고에 추가되어 "공유받은 공고" 섹션 검증용
  // (review-* 계정엔 collaborator 가 없어 별도 시드: 20260520205822_seed_review_collaborator_account.sql)
  collaborator: {
    uid: 'e5555555-5555-4555-a555-555555555555',
    email: 'review-collaborator@uniqn.app',
    password: 'Review2026!',
    displayName: '심사용 협업자',
    role: 'employer',
    phoneNumber: '+821055550005',
  },
} as const;
