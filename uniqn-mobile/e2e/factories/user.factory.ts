/**
 * User 테스트 데이터 팩토리
 */

interface UserFactoryOptions {
  email?: string;
  password?: string;
  name?: string;
  nickname?: string;
  role?: 'staff' | 'employer' | 'admin';
  phoneNumber?: string;
}

let userCounter = 0;

/**
 * 고유한 테스트 유저 데이터 생성
 */
export function createTestUser(options: UserFactoryOptions = {}) {
  userCounter++;
  const id = `test-user-${Date.now()}-${userCounter}`;

  return {
    uid: id,
    email: options.email ?? `testuser${userCounter}@test.com`,
    password: options.password ?? 'TestPass1!',
    name: options.name ?? `테스트유저${userCounter}`,
    nickname: options.nickname ?? `닉네임${userCounter}`,
    role: options.role ?? 'staff',
    phoneNumber: options.phoneNumber ?? `+8210${String(userCounter).padStart(8, '0')}`,
  };
}

/**
 * 잘못된 로그인 데이터 생성
 */
export function createInvalidLoginData() {
  return {
    wrongEmail: 'nonexistent@test.com',
    wrongPassword: 'WrongPass1!',
    invalidEmail: 'not-an-email',
    weakPassword: '1234',
    emptyEmail: '',
    emptyPassword: '',
  };
}

/**
 * 회원가입용 데이터 생성
 */
export function createSignupData(options: UserFactoryOptions = {}) {
  const user = createTestUser(options);
  return {
    ...user,
    passwordConfirm: user.password,
    birthDate: '19950315',
    gender: 'male' as const,
    agreeTerms: true,
    agreePrivacy: true,
    agreeMarketing: false,
  };
}

/**
 * XSS 공격 페이로드
 */
export const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  'javascript:alert(1)',
  '<img onerror=alert(1) src=x>',
  '"><script>alert(document.cookie)</script>',
  "'; DROP TABLE users; --",
] as const;
