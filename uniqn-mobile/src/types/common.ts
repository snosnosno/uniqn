/**
 * UNIQN Mobile - 공통 타입 정의
 *
 * @description 프로젝트 전반에서 사용되는 기본 타입들
 * @version 1.1.0
 *
 * 역할 타입(UserRole, StaffRole)은 role.ts에서 정의.
 * 역할 타입 사용 시 '@/types/role'에서 직접 import할 것.
 */

import type { UserRole, StaffRole } from './role';

/**
 * FCM 토큰 레코드 (Map 구조)
 * DB 필드: users.fcmTokens.{tokenKey}
 */
export interface FcmTokenRecord {
  token: string;
  type: 'expo' | 'fcm';
  platform: 'ios' | 'android';
  registeredAt: Date;
  lastRefreshedAt: Date;
}

/**
 * 문서 기본 타입
 */
export interface BaseDocument {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** @deprecated Use BaseDocument directly. Firebase 이전 레거시 타입. */
export type FirebaseDocument = BaseDocument;

/**
 * 사용자 타입
 */
export interface User extends BaseDocument {
  email: string;
  name: string;
  nickname?: string;
  role: UserRole;
  phone?: string;
  profileImage?: string;
  isActive: boolean;
  fcmTokens?: Record<string, FcmTokenRecord>; // 멀티 디바이스 지원 (Map 구조)
}

/**
 * 스태프 타입
 */
export interface Staff extends BaseDocument {
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
  /** 정규화된 지역 slug (src/constants/regions.ts). 지역 필터용. district(자유텍스트)와 별개 */
  region?: string;
  detailedAddress?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * 날짜 문자열 타입 (YYYY-MM-DD)
 */
export type DateString = `${number}-${number}-${number}`;

/**
 * 시간 문자열 타입 (HH:MM)
 */
export type TimeString = `${number}:${number}`;

// ============================================================================
// 범용 추상 타입 (Backend-agnostic)
// ============================================================================

/**
 * 실시간 구독 해제 함수
 *
 * @description Supabase RealtimeChannel.unsubscribe 등
 *              구현체에 무관한 구독 해제 타입
 */
export type UnsubscribeFn = () => void;

/**
 * 페이지네이션 커서 (구현체별 opaque 값)
 *
 * @description Supabase range offset 등
 *              구현체에 무관한 커서 타입
 */
export type PaginationCursor = unknown;

/**
 * 범용 페이지네이션 결과 (인터페이스용)
 *
 * @description Repository 인터페이스에서 사용하는 범용 페이지네이션 결과.
 *              구현체 내부에서는 별도 PaginatedResult<T>를 사용할 수 있음.
 */
export interface PaginatedResult<T> {
  items: T[];
  lastDoc: PaginationCursor;
  hasMore: boolean;
}
