import type { UserRole } from '@/types/role';
import { buildBoardNoticePostId } from '@/shared/board/boardIds';
import {
  EXPO_ROUTES,
  AUTH_REQUIRED_ROUTES,
  EMPLOYER_REQUIRED_ROUTES,
  ADMIN_REQUIRED_ROUTES,
  type ExpoRouteName,
} from './RouteRegistry';
import type { DeepLinkRoute } from './types';

export class RouteMapper {
  static toExpoPath(route: DeepLinkRoute): string {
    switch (route.name) {
      case 'home':
        return EXPO_ROUTES.home;
      case 'jobs':
        return EXPO_ROUTES.home;
      case 'job':
        return EXPO_ROUTES.publicJobDetail.replace('[id]', route.params.id);
      case 'login':
        return EXPO_ROUTES.login;
      case 'signup':
        return EXPO_ROUTES.signup;
      case 'forgot-password':
        return EXPO_ROUTES.forgotPassword;

      case 'notifications':
        return EXPO_ROUTES.notifications;
      case 'schedule':
        return EXPO_ROUTES.schedule;
      case 'board':
        return EXPO_ROUTES.board;
      case 'board/post':
        return EXPO_ROUTES.noticeDetail.replace('[postId]', route.params.postId);
      case 'profile':
        return EXPO_ROUTES.profile;
      case 'settings':
        return EXPO_ROUTES.settings;
      case 'settings/profile':
        return EXPO_ROUTES.settingsProfile;
      case 'settings/change-password':
        return EXPO_ROUTES.settingsChangePassword;
      case 'settings/delete-account':
        return EXPO_ROUTES.settingsDeleteAccount;
      case 'settings/privacy':
        return EXPO_ROUTES.settingsPrivacy;
      case 'settings/terms':
        return EXPO_ROUTES.settingsTerms;
      case 'settings/employer-terms':
        return EXPO_ROUTES.settingsEmployerTerms;
      case 'settings/liability-waiver':
        return EXPO_ROUTES.settingsLiabilityWaiver;
      case 'settings/my-data':
        return EXPO_ROUTES.settingsMyData;
      case 'settings/business-info':
        return EXPO_ROUTES.settingsBusinessInfo;
      case 'support':
        return EXPO_ROUTES.support;
      case 'support/faq':
        return EXPO_ROUTES.supportFaq;
      case 'support/create-inquiry':
        return EXPO_ROUTES.supportCreateInquiry;
      case 'support/my-inquiries':
        return EXPO_ROUTES.supportMyInquiries;
      case 'support/inquiry':
        return EXPO_ROUTES.supportInquiryDetail.replace('[id]', route.params.id);
      case 'notices':
        return EXPO_ROUTES.notices;
      case 'notice':
        return EXPO_ROUTES.noticeDetail.replace(
          '[postId]',
          buildBoardNoticePostId(route.params.id)
        );

      case 'employer/my-postings':
        return EXPO_ROUTES.employerTab;
      case 'employer/posting-create':
        return EXPO_ROUTES.postingCreate;
      case 'employer/posting':
        return EXPO_ROUTES.postingDetail.replace('[id]', route.params.id);
      case 'employer/posting-edit':
        return EXPO_ROUTES.postingEdit.replace('[id]', route.params.id);
      case 'employer/applicants':
        return EXPO_ROUTES.postingApplicants.replace('[id]', route.params.jobId);
      case 'employer/settlement':
        return EXPO_ROUTES.postingSettlements.replace('[id]', route.params.jobId);

      case 'admin/dashboard':
        return EXPO_ROUTES.adminDashboard;
      case 'admin/users':
        return EXPO_ROUTES.adminUsers;
      case 'admin/user':
        return EXPO_ROUTES.adminUserDetail.replace('[id]', route.params.id);
      case 'admin/stats':
        return EXPO_ROUTES.adminStats;
      case 'admin/reports':
        return EXPO_ROUTES.adminReports;
      case 'admin/report':
        return EXPO_ROUTES.adminReportDetail.replace('[id]', route.params.id);
      case 'admin/board-reports':
        return EXPO_ROUTES.adminBoardReports;
      case 'admin/board-report':
        return EXPO_ROUTES.adminBoardReportDetail.replace('[id]', route.params.id);
      case 'admin/announcements':
        return EXPO_ROUTES.adminAnnouncements;
      case 'admin/announcement-create':
        return EXPO_ROUTES.adminAnnouncementCreate;
      case 'admin/announcement':
        return EXPO_ROUTES.adminAnnouncementDetail.replace('[id]', route.params.id);
      case 'admin/announcement-edit':
        return EXPO_ROUTES.adminAnnouncementEdit.replace('[id]', route.params.id);
      case 'admin/inquiries':
        return EXPO_ROUTES.adminInquiries;
      case 'admin/inquiry':
        return EXPO_ROUTES.adminInquiryDetail.replace('[id]', route.params.id);
      case 'admin/tournaments':
        return EXPO_ROUTES.adminTournaments;

      case 'reviews/detail':
        return EXPO_ROUTES.reviewDetail.replace('[workLogId]', route.params.workLogId);
      case 'reviews/pending':
        return EXPO_ROUTES.reviewsPending;

      default:
        return EXPO_ROUTES.home;
    }
  }

  static requiresAuth(routeName: DeepLinkRoute['name']): boolean {
    const publicRoutes: DeepLinkRoute['name'][] = ['job', 'login', 'signup', 'forgot-password'];

    return !publicRoutes.includes(routeName);
  }

  static getRequiredRole(routeName: DeepLinkRoute['name']): UserRole | null {
    if (routeName.startsWith('employer/')) return 'employer';
    if (routeName.startsWith('admin/')) return 'admin';
    return null;
  }

  static expoRouteRequiresAuth(routeName: ExpoRouteName): boolean {
    return AUTH_REQUIRED_ROUTES.includes(routeName);
  }

  static expoRouteRequiresEmployer(routeName: ExpoRouteName): boolean {
    return EMPLOYER_REQUIRED_ROUTES.includes(routeName);
  }

  static expoRouteRequiresAdmin(routeName: ExpoRouteName): boolean {
    return ADMIN_REQUIRED_ROUTES.includes(routeName);
  }
}
