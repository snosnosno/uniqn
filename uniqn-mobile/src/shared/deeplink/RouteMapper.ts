/**
 * UNIQN Mobile - 라우트 매퍼
 *
 * @description DeepLinkRoute와 Expo Router 경로 간 변환
 * @version 2.0.0
 *
 * StatusMapper 패턴을 따름 (shared/status/StatusMapper.ts 참조)
 */

import type { UserRole } from '@/types/role';
import {
  EXPO_ROUTES,
  AUTH_REQUIRED_ROUTES,
  EMPLOYER_REQUIRED_ROUTES,
  ADMIN_REQUIRED_ROUTES,
  type ExpoRouteName,
} from './RouteRegistry';
import type { DeepLinkRoute } from './types';

// ============================================================================
// RouteMapper Class
// ============================================================================

/**
 * 딥링크 라우트와 Expo Router 경로 간 변환 유틸리티
 */
export class RouteMapper {
  /**
   * DeepLinkRoute를 Expo Router 경로로 변환
   *
   * @param route - 딥링크 라우트
   * @returns Expo Router 경로 문자열
   */
  static toExpoPath(route: DeepLinkRoute): string {
    switch (route.name) {
      // === 공개 라우트 ===
      case 'home':
        return EXPO_ROUTES.home;

      case 'jobs':
        return EXPO_ROUTES.home; // 홈 = 구인구직

      case 'job':
        return EXPO_ROUTES.jobDetail.replace('[id]', route.params.id);

      // === 인증 필요 라우트 ===
      case 'notifications':
        return EXPO_ROUTES.notifications;

      case 'schedule':
        return EXPO_ROUTES.schedule;

      case 'profile':
        return EXPO_ROUTES.profile;

      case 'settings':
        return EXPO_ROUTES.settings;

      case 'support':
        return EXPO_ROUTES.support;

      case 'notices':
        return EXPO_ROUTES.notices;

      // === 구인자 라우트 ===
      case 'employer/my-postings':
        return EXPO_ROUTES.employerTab;

      case 'employer/posting':
        return EXPO_ROUTES.postingDetail.replace('[id]', route.params.id);

      case 'employer/applicants':
        return EXPO_ROUTES.postingApplicants.replace('[id]', route.params.jobId);

      case 'employer/settlement':
        return EXPO_ROUTES.postingSettlements.replace('[id]', route.params.jobId);

      // === 관리자 라우트 ===
      case 'admin/dashboard':
        return EXPO_ROUTES.adminDashboard;

      case 'admin/reports':
        return EXPO_ROUTES.adminReports;

      case 'admin/report':
        return EXPO_ROUTES.adminReportDetail.replace('[id]', route.params.id);

      case 'admin/inquiries':
        return EXPO_ROUTES.adminInquiries;

      case 'admin/inquiry':
        return EXPO_ROUTES.adminInquiryDetail.replace('[id]', route.params.id);

      case 'admin/tournaments':
        return EXPO_ROUTES.adminTournaments;

      default:
        // 알 수 없는 라우트는 홈으로 폴백
        return EXPO_ROUTES.home;
    }
  }

  /**
   * 라우트가 인증을 필요로 하는지 확인
   *
   * @param routeName - 딥링크 라우트 이름
   * @returns 인증 필요 여부
   */
  static requiresAuth(routeName: DeepLinkRoute['name']): boolean {
    const publicRoutes: DeepLinkRoute['name'][] = ['home', 'jobs', 'job'];
    return !publicRoutes.includes(routeName);
  }

  /**
   * 라우트가 특정 역할을 필요로 하는지 확인
   *
   * @param routeName - 딥링크 라우트 이름
   * @returns 필요한 역할 (null이면 역할 제한 없음)
   */
  static getRequiredRole(routeName: DeepLinkRoute['name']): UserRole | null {
    if (routeName.startsWith('employer/')) return 'employer';
    if (routeName.startsWith('admin/')) return 'admin';
    return null;
  }

  /**
   * Expo 라우트가 인증을 필요로 하는지 확인
   *
   * @param routeName - Expo 라우트 이름
   * @returns 인증 필요 여부
   */
  static expoRouteRequiresAuth(routeName: ExpoRouteName): boolean {
    return AUTH_REQUIRED_ROUTES.includes(routeName);
  }

  /**
   * Expo 라우트가 구인자 권한을 필요로 하는지 확인
   *
   * @param routeName - Expo 라우트 이름
   * @returns 구인자 권한 필요 여부
   */
  static expoRouteRequiresEmployer(routeName: ExpoRouteName): boolean {
    return EMPLOYER_REQUIRED_ROUTES.includes(routeName);
  }

  /**
   * Expo 라우트가 관리자 권한을 필요로 하는지 확인
   *
   * @param routeName - Expo 라우트 이름
   * @returns 관리자 권한 필요 여부
   */
  static expoRouteRequiresAdmin(routeName: ExpoRouteName): boolean {
    return ADMIN_REQUIRED_ROUTES.includes(routeName);
  }
}
