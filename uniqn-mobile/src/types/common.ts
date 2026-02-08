/**
 * UNIQN Mobile - 공통 타입 정의
 *
 * @description 프로젝트 전반에서 사용되는 기본 타입들
 * @version 1.1.0
 *
 * Phase 8 변경사항:
 * - UserRole, StaffRole → role.ts로 이동
 * - 하위 호환성을 위해 re-export 유지
 */

import { Timestamp } from 'firebase/firestore';

// Phase 8: 역할 타입은 role.ts에서 정의 (하위 호환성을 위해 re-export)
import type { UserRole, StaffRole } from './role';
export type { UserRole, StaffRole };

/**
 * FCM 토큰 레코드 (Map 구조)
 * Firestore 필드: users/{userId}.fcmTokens.{tokenKey}
 */
export interface FcmTokenRecord {
  token: string;
  type: 'expo' | 'fcm';
  platform: 'ios' | 'android';
  registeredAt: Timestamp | Date;
  lastRefreshedAt: Timestamp | Date;
}

/**
 * Firebase 문서 기본 타입
 */
export interface FirebaseDocument {
  id: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

/**
 * 사용자 타입
 */
export interface User extends FirebaseDocument {
  email: string;
  name: string;
  nickname?: string;
  role: UserRole;
  phone?: string;
  profileImage?: string;
  isActive: boolean;
  fcmTokens?: Record<string, FcmTokenRecord>; // 멀티 디바이스 지원 (Map 구조)
}

// StaffRole은 role.ts에서 정의됨 (re-export는 위에서 처리)

/**
 * 스태프 타입
 */
export interface Staff extends FirebaseDocument {
  /** 연결된 사용자 ID */
  userId?: string;
  name: string;
  phone: string;
  role: StaffRole;
  status?: 'active' | 'inactive';
  /** 활성 상태 (v2.0) */
  isActive?: boolean;
  email?: string;
  bankName?: string;
  accountNumber?: string;
  notes?: string;
  /** 총 근무 횟수 */
  totalWorkCount?: number;
  /** 평점 */
  rating?: number;
}

/**
 * API 응답 타입
 */
export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

/**
 * 페이지네이션 정보
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/**
 * 폼 에러 타입
 */
export interface FormErrors {
  [key: string]: string | undefined;
}

/**
 * 지역/장소 타입
 */
export interface Location {
  name: string;
  address?: string;
  district?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Timestamp 변환 유틸리티
 */
export const toDate = (timestamp: Timestamp | Date | undefined): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
};

/**
 * 날짜 문자열 타입 (YYYY-MM-DD)
 */
export type DateString = `${number}-${number}-${number}`;

/**
 * 시간 문자열 타입 (HH:MM)
 */
export type TimeString = `${number}:${number}`;
