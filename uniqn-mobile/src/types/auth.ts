/**
 * UNIQN Mobile - 인증 관련 타입 정의
 *
 * @version 1.0.0
 */

/**
 * 인증 상태
 */
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

/**
 * 인증된 사용자 정보
 *
 * ⚠️ 이메일 인증은 사용하지 않음 - 휴대폰 본인인증으로 대체
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean; // Firebase 기본 필드 (미사용, 휴대폰 본인인증으로 대체)
  phoneNumber: string | null;
  providerIds?: string[];
}

/**
 * 소셜 로그인 제공자
 */
export type SocialProvider = 'google' | 'apple' | 'kakao';
