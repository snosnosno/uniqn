/**
 * UNIQN Mobile - 사용자 프로필 타입 정의
 *
 * @description 사용자 프로필의 단일 진실의 원천 (Single Source of Truth)
 * @version 1.0.0
 *
 * ## 사용 가이드
 *
 * - 일반 사용 (Date 타입): `UserProfile`
 * - Firestore 저장/조회: `FirestoreUserProfile` (deprecated, UserProfile 직접 사용 권장)
 * - 프로필 수정: `EditableProfileFields`
 * - 개인정보 열람: `ProfileViewFields`
 */

import type { UserRole } from './role';

// ============================================================================
// Core Types
// ============================================================================

export interface PortOneIdentityProfile {
  provider: 'portone';
  channel: 'inicis_unified';
  identityVerificationId: string;
  verifiedAt: Date;
  name: string;
  birthDate: string;
  gender?: 'male' | 'female';
  phoneNumber?: string;
  ciHash?: string;
  isForeigner?: boolean;
}

/**
 * 사용자 프로필
 *
 * @example
 * // Zustand Store에서 사용
 * const profile: UserProfile = { ... };
 *
 * // Repository에서 반환
 * const profile: UserProfile = { ... };
 */
export interface UserProfile {
  /** Auth UID */
  uid: string;
  /** 이메일 주소 */
  email: string;
  /** 실명 (회원가입 Step2 입력, 수정 불가) */
  name: string;
  /** 서비스 닉네임 (회원가입 Step3 입력) */
  nickname?: string;
  /** 전화번호 (회원가입 Step2 SMS 인증, 수정 불가) */
  phone?: string;
  /** 사용자 역할 */
  role: UserRole;
  /** 프로필 사진 URL (삭제 시 null) */
  photoURL?: string | null;

  // 전화번호 인증
  /** 전화번호 인증 완료 여부 */
  phoneVerified?: boolean;
  /** 포트원 본인인증 완료 여부 */
  identityVerified?: boolean;
  /** 포트원 본인인증 완료 시간 */
  identityVerifiedAt?: Date;
  /** 본인인증 제공 서비스 */
  identityProvider?: 'portone_inicis';
  /** 본인인증 원본 데이터 */
  identity?: PortOneIdentityProfile;

  // 추가 정보
  /** 성별 (회원가입 Step2 입력, 수정 불가) */
  gender?: 'male' | 'female';
  /** 생년월일 YYYYMMDD (회원가입 Step2 입력, 수정 불가) */
  birthDate?: string;
  /** 지역 */
  region?: string;
  /** 경력 (년) */
  experienceYears?: number;
  /** 이력 */
  career?: string;
  /** 기타사항 */
  note?: string;
  /** 소셜 로그인 제공자 (없으면 이메일 가입) */
  socialProvider?: 'apple' | 'google' | 'kakao' | 'naver';

  // 동의 정보 (DB 전용, Store에서는 optional)
  /** 이용약관 동의 */
  termsAgreed?: boolean;
  /** 개인정보처리방침 동의 */
  privacyAgreed?: boolean;
  /** 마케팅 수신 동의 */
  marketingAgreed?: boolean;

  // 구인자 등록 정보 (employer 역할로 변경 시)
  /** 구인자 약관 동의 정보 */
  employerAgreements?: {
    /** 구인자 이용약관 동의 일시 */
    termsAgreedAt: Date;
    termsVersion?: string;
    /** 서약서 동의 일시 */
    liabilityWaiverAgreedAt: Date;
    liabilityWaiverVersion?: string;
  };
  /** 구인자 등록 일시 */
  employerRegisteredAt?: Date;

  // 버블 점수 (리뷰/평가 시스템)
  /** 버블 점수 (비정규화, reviews 컬렉션에서 계산) */
  bubbleScore?: {
    score: number;
    totalReviewCount: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    lastUpdatedAt: Date;
  };

  // 프로필 상태
  /** 사용자 상태 */
  status?: 'active' | 'inactive' | 'suspended' | 'deleted';
  /** 프로필 완성 여부 (닉네임 등 필수 프로필 입력 완료) */
  profileCompleted?: boolean;

  // 메타데이터
  /** 활성 상태 (DB 전용, Store에서는 optional) */
  isActive?: boolean;
  /** 생성일 */
  createdAt: Date;
  /** 수정일 */
  updatedAt: Date;
}

// ============================================================================
// Type Aliases
// ============================================================================

/** @deprecated Use UserProfile directly. Firebase 이전 레거시 타입. */
export type FirestoreUserProfile = UserProfile;

/**
 * 프로필 수정 가능 필드
 *
 * @description profile.tsx에서 수정 가능한 필드
 * @note name, phone, birthDate, gender는 회원가입 Step2 입력 정보이므로 수정 불가 (읽기 전용)
 */
export type EditableProfileFields = Pick<
  UserProfile,
  'nickname' | 'photoURL' | 'region' | 'experienceYears' | 'career' | 'note'
>;

/**
 * 개인정보 열람용 필드
 *
 * @description my-data.tsx에서 표시하는 읽기 전용 필드
 */
export type ProfileViewFields = Pick<
  UserProfile,
  | 'uid'
  | 'email'
  | 'name'
  | 'nickname'
  | 'phone'
  | 'birthDate'
  | 'gender'
  | 'role'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * 개인정보 수정 가능 필드 (my-data용)
 *
 * @description my-data.tsx에서 수정 가능한 필드 (닉네임만)
 */
export type MyDataEditableFields = Pick<UserProfile, 'nickname'>;
