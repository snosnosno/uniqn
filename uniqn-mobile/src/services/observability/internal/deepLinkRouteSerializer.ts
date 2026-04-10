import { buildBoardNoticePostId } from '@/shared/board/boardIds';
import { RouteMapper, type DeepLinkRoute } from '@/shared/deeplink';
import { SCHEME_PREFIX, WEB_PREFIX } from './deepLinkConstants';

function toExternalPath(route: DeepLinkRoute): string {
  switch (route.name) {
    case 'home':
      return 'home';
    case 'jobs':
      return 'jobs';
    case 'job':
      return `jobs/${route.params.id}`;
    case 'login':
      return 'login';
    case 'signup':
      return 'signup';
    case 'forgot-password':
      return 'forgot-password';
    case 'notifications':
      return 'notifications';
    case 'schedule':
      return 'schedule';
    case 'board':
      return 'board';
    case 'board/post':
      return `board/post/${route.params.postId}`;
    case 'profile':
      return 'profile';
    case 'settings':
      return 'settings';
    case 'settings/profile':
      return 'settings/profile';
    case 'settings/change-password':
      return 'settings/change-password';
    case 'settings/delete-account':
      return 'settings/delete-account';
    case 'settings/privacy':
      return 'settings/privacy';
    case 'settings/terms':
      return 'settings/terms';
    case 'settings/employer-terms':
      return 'settings/employer-terms';
    case 'settings/liability-waiver':
      return 'settings/liability-waiver';
    case 'settings/my-data':
      return 'settings/my-data';
    case 'settings/business-info':
      return 'settings/business-info';
    case 'support':
      return 'support';
    case 'support/faq':
      return 'support/faq';
    case 'support/create-inquiry':
      return 'support/create-inquiry';
    case 'support/my-inquiries':
      return 'support/my-inquiries';
    case 'support/inquiry':
      return `support/inquiry/${route.params.id}`;
    case 'notices':
      return 'board/notice';
    case 'notice':
      return `board/post/${buildBoardNoticePostId(route.params.id)}`;
    case 'employer/my-postings':
      return 'employer/my-postings';
    case 'employer/posting-create':
      return 'employer/my-postings/create';
    case 'employer/posting':
      return `employer/my-postings/${route.params.id}`;
    case 'employer/posting-edit':
      return `employer/my-postings/${route.params.id}/edit`;
    case 'employer/applicants':
      return `employer/applicants/${route.params.jobId}`;
    case 'employer/settlement':
      return `employer/settlement/${route.params.jobId}`;
    case 'admin/dashboard':
      return 'admin';
    case 'admin/users':
      return 'admin/users';
    case 'admin/user':
      return `admin/users/${route.params.id}`;
    case 'admin/stats':
      return 'admin/stats';
    case 'admin/reports':
      return 'admin/reports';
    case 'admin/report':
      return `admin/reports/${route.params.id}`;
    case 'admin/announcements':
      return 'admin/announcements';
    case 'admin/announcement-create':
      return 'admin/announcements/create';
    case 'admin/announcement':
      return `admin/announcements/${route.params.id}`;
    case 'admin/announcement-edit':
      return `admin/announcements/${route.params.id}/edit`;
    case 'admin/inquiries':
      return 'admin/inquiries';
    case 'admin/inquiry':
      return `admin/inquiries/${route.params.id}`;
    case 'admin/tournaments':
      return 'admin/tournaments';
    case 'reviews/detail':
      return `reviews/${route.params.workLogId}`;
    case 'reviews/pending':
      return 'reviews/pending';
    default:
      return (
        RouteMapper.toExpoPath(route)
          .replace(/\/\([^)]+\)/g, '')
          .replace(/^\/+/, '') || 'home'
      );
  }
}

export function createDeepLink(
  route: DeepLinkRoute,
  options: { useWebUrl?: boolean } = {}
): string {
  const prefix = options.useWebUrl ? WEB_PREFIX : SCHEME_PREFIX;
  return `${prefix}${toExternalPath(route)}`;
}

export function createJobDeepLink(jobId: string, useWebUrl = false): string {
  return createDeepLink({ name: 'job', params: { id: jobId } }, { useWebUrl });
}

export { toExternalPath };
