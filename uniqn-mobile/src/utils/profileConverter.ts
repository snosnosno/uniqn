/**
 * UNIQN Mobile - Profile Converter Utility
 *
 * @description AuthResult의 profile을 Store용 UserProfile로 변환
 */

import { Timestamp } from '@/lib/firebase';
import type { UserProfile } from '@/types';

/**
 * Timestamp 또는 Date를 Date로 변환
 */
function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

/**
 * AuthResult의 Firestore profile을 Store용 profile(Date 기반)로 변환
 *
 * @description Firestore에서 조회한 profile의 Timestamp 필드를 Date로 변환하고,
 *              Store에서 필요한 모든 필드를 포함하여 반환합니다.
 *
 * @example
 * ```typescript
 * const result = await login(data);
 * setProfile(toStoreProfile(result.profile));
 * ```
 */
export function toStoreProfile(profile: {
  uid: string;
  email: string;
  name: string;
  nickname?: string;
  phone?: string;
  role: string;
  photoURL?: string;
  phoneVerified?: boolean;
  birthDate?: string;
  gender?: 'male' | 'female';
  socialProvider?: string;
  termsAgreed?: boolean;
  privacyAgreed?: boolean;
  marketingAgreed?: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}): UserProfile {
  return {
    uid: profile.uid,
    email: profile.email,
    name: profile.name,
    nickname: profile.nickname,
    phone: profile.phone,
    role: profile.role as UserProfile['role'],
    photoURL: profile.photoURL,
    phoneVerified: profile.phoneVerified,
    birthDate: profile.birthDate,
    gender: profile.gender,
    socialProvider: profile.socialProvider as UserProfile['socialProvider'],
    termsAgreed: profile.termsAgreed,
    privacyAgreed: profile.privacyAgreed,
    marketingAgreed: profile.marketingAgreed,
    createdAt: toDate(profile.createdAt),
    updatedAt: toDate(profile.updatedAt),
  };
}
