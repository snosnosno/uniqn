import { buildBoardNoticePostId } from '@/shared/board/boardIds';
import { RouteMapper, type DeepLinkRoute } from '@/shared/deeplink';
import { SCHEME_PREFIX, WEB_PREFIX } from './deepLinkConstants';
import { SHARE_SOURCE_QUERY_KEY, type ShareSource } from '@/constants/shareSource';

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
    case 'employer/cancellation-requests':
      return `employer/cancellation-requests/${route.params.jobId}`;
    case 'employer/work-schedule':
      return 'employer/work-schedule';
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
  options: { useWebUrl?: boolean; source?: ShareSource } = {}
): string {
  const prefix = options.useWebUrl ? WEB_PREFIX : SCHEME_PREFIX;
  // 출처는 화이트리스트 값이라 인코딩이 사실상 무의미하지만, 이 함수가 나중에
  // 다른 값을 받게 됐을 때 조용히 깨진 URL 을 만들지 않도록 그대로 인코딩한다.
  const query = options.source
    ? `?${SHARE_SOURCE_QUERY_KEY}=${encodeURIComponent(options.source)}`
    : '';
  return `${prefix}${toExternalPath(route)}${query}`;
}

/**
 * @param source 공유 출처 (S3-5). 주면 `?src=` 가 붙는다.
 *   미지정 시 기존과 완전히 같은 URL 이 나온다 — 기존 호출부는 손대지 않아도 된다.
 */
export function createJobDeepLink(jobId: string, useWebUrl = false, source?: ShareSource): string {
  return createDeepLink({ name: 'job', params: { id: jobId } }, { useWebUrl, source });
}

export { toExternalPath };
