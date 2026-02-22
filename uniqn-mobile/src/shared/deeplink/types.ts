/**
 * UNIQN Mobile - 딥링크 관련 타입 정의
 *
 * @description 딥링크 라우트, 파싱 결과 타입
 * @version 2.0.0
 */

// ============================================================================
// DeepLinkRoute - 확장된 딥링크 라우트 정의
// ============================================================================

/**
 * 딥링크 라우트 정의
 *
 * @description 실제 존재하는 라우트만 정의
 * v2.0 변경사항:
 * - 제거: notification (알림 상세 없음), my-applications (라우트 없음),
 *         application (지원 상세 없음), settings/notifications (라우트 없음)
 * - 추가: admin/* (관리자 라우트)
 */
export type DeepLinkRoute =
  // === 공개 라우트 ===
  | { name: 'home' }
  | { name: 'jobs' }
  | { name: 'job'; params: { id: string } }

  // === 인증 필요 라우트 ===
  | { name: 'notifications' }
  | { name: 'schedule' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'support' }
  | { name: 'notices' }

  // === 구인자 라우트 ===
  | { name: 'employer/my-postings' }
  | { name: 'employer/posting'; params: { id: string } }
  | { name: 'employer/applicants'; params: { jobId: string } }
  | { name: 'employer/settlement'; params: { jobId: string } }

  // === 관리자 라우트 ===
  | { name: 'admin/dashboard' }
  | { name: 'admin/reports' }
  | { name: 'admin/report'; params: { id: string } }
  | { name: 'admin/inquiries' }
  | { name: 'admin/inquiry'; params: { id: string } }
  | { name: 'admin/tournaments' }

  // === 리뷰/평가 라우트 ===
  | { name: 'reviews/detail'; params: { workLogId: string } }
  | { name: 'reviews/pending' };

// ============================================================================
// ParsedDeepLink - 딥링크 파싱 결과
// ============================================================================

/**
 * 딥링크 파싱 결과
 */
export interface ParsedDeepLink {
  /** 원본 URL */
  url: string;
  /** 경로 */
  path: string;
  /** 쿼리 파라미터 */
  queryParams: Record<string, string>;
  /** 파싱된 라우트 */
  route: DeepLinkRoute | null;
  /** 유효한 딥링크 여부 */
  isValid: boolean;
}

// ============================================================================
// Navigation Context - 네비게이션 컨텍스트
// ============================================================================

/**
 * 네비게이션 실행 컨텍스트
 */
export interface NavigationContext {
  /** 소스 타입 */
  source: 'deeplink' | 'notification';
  /** 알림 타입 (notification 소스인 경우) */
  type?: string;
  /** 원본 URL (deeplink 소스인 경우) */
  url?: string;
}

// ============================================================================
// Route Groups - 라우트 그룹 상수
// ============================================================================

/**
 * Expo Router 라우트 그룹
 */
export const ROUTE_GROUPS = {
  public: '(public)',
  auth: '(auth)',
  app: '(app)',
  employer: '(employer)',
  admin: '(admin)',
} as const;

export type RouteGroup = (typeof ROUTE_GROUPS)[keyof typeof ROUTE_GROUPS];
