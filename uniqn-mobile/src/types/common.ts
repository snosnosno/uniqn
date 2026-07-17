/**
 * UNIQN Mobile - 공통 타입 정의
 *
 * @description 프로젝트 전반에서 사용되는 기본 타입들
 * @version 1.1.0
 *
 * 역할 타입(UserRole, StaffRole)은 role.ts에서 정의.
 * 역할 타입 사용 시 '@/types/role'에서 직접 import할 것.
 */

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
 *
 * 타임스탬프 표현(`T`)은 도메인마다 런타임 진실이 다르다:
 *  - 기본값 `Date` — 매퍼가 `new Date(row.created_at)`로 Date를 생산하는 도메인
 *    (Board·Notification·WorkLog 등). 타입=런타임 정합.
 *  - `string` — zod `timestampSchema`(normalizeToIsoString)로 ISO string으로
 *    통일되는 도메인(JobPosting·Application). `FirebaseDocument<string>`로 졸업.
 * 전 도메인이 string으로 졸업하면 기본값을 string으로 flip 후 파라미터를 제거한다.
 */
export interface BaseDocument<T = Date> {
  id: string;
  createdAt?: T;
  updatedAt?: T;
}

/**
 * 8개 파일 14개 도메인 인터페이스(Announcement·Application·Board*·Inquiry·
 * JobPostingDocumentV3·NotificationData·Report·ScheduleEvent·WorkLog 등)가 상속하는
 * 문서 베이스 — 실질 정본이다. 이름의 `Firebase` 접두는 Firebase 시대 잔재일 뿐
 * `BaseDocument` 와 동일하며, 이름 일괄 치환은 광역 변경이라 별도 PR로 분리한다.
 */
export type FirebaseDocument<T = Date> = BaseDocument<T>;

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
