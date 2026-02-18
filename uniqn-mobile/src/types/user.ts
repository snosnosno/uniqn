/**
 * UNIQN Mobile - 사용자 프로필 타입 정의
 *
 * @description 사용자 프로필의 단일 진실의 원천 (Single Source of Truth)
 * @version 1.0.0
 *
 * ## 사용 가이드
 *
 * - 일반 사용 (Date 타입): `UserProfile`
 * - Firestore 저장/조회: `FirestoreUserProfile`
 * - 프로필 수정: `EditableProfileFields`
 * - 개인정보 열람: `ProfileViewFields`
 */

import { Timestamp } from 'firebase/firestore';
import type { UserRole } from './role';

// ============================================================================
// Core Types
// ============================================================================

/**
 * 사용자 프로필
 *
 * @template T - 타임스탬프 타입 (기본: Date, Firestore: Timestamp)
 *
 * @example
 * // Zustand Store에서 사용 (Date)
 * const profile: UserProfile = { ... };
 *
 * // Firestore에서 사용 (Timestamp)
 * const firestoreProfile: FirestoreUserProfile = { ... };
 */
export interface UserProfile<T = Date> {
  /** Firebase Auth UID */
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
  /** 프로필 사진 URL */
  photoURL?: string;

  // 전화번호 인증 (Firebase Phone Auth)
  /** 전화번호 인증 완료 여부 */
  phoneVerified?: boolean;

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

  // 동의 정보 (Firestore 전용, Store에서는 optional)
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
    termsAgreedAt: T;
    /** 서약서 동의 일시 */
    liabilityWaiverAgreedAt: T;
  };
  /** 구인자 등록 일시 */
  employerRegisteredAt?: T;

  // 메타데이터
  /** 활성 상태 (Firestore 전용, Store에서는 optional) */
  isActive?: boolean;
  /** 생성일 */
  createdAt: T;
  /** 수정일 */
  updatedAt: T;
}

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Firestore용 UserProfile (Timestamp 사용)
 *
 * @description Firestore 문서 저장/조회 시 사용
 */
export type FirestoreUserProfile = UserProfile<Timestamp>;

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
