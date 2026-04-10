import { Platform } from 'react-native';
import { extractAnnouncementIdFromBoardPostId, isBoardNoticePostId } from '@/shared/board/boardIds';
import type { DeepLinkRoute, ParsedDeepLink } from '@/shared/deeplink';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { SCHEME_PREFIX, WEB_PREFIX } from './deepLinkConstants';
import { isSupportedWebUrl } from './deepLinkLinkValidator';

function pathToRoute(path: string, params: Record<string, string>): DeepLinkRoute | null {
  const normalizedPath = path.replace(/^\/|\/$/g, '');
  const segments = normalizedPath ? normalizedPath.split('/') : [''];
  const [root, second, third, fourth] = segments;

  switch (root) {
    case '':
    case 'home':
      return { name: 'home' };

    case 'jobs':
      return second ? { name: 'job', params: { id: second } } : { name: 'jobs' };

    case 'login':
      return { name: 'login' };

    case 'signup':
      return { name: 'signup' };

    case 'forgot-password':
      return { name: 'forgot-password' };

    case 'notifications':
      return { name: 'notifications' };

    case 'schedule':
      return { name: 'schedule' };

    case 'board':
      if (second === undefined) {
        return { name: 'board' };
      }

      if (second === 'notice') {
        return { name: 'notices' };
      }

      if (second === 'post' && third && isBoardNoticePostId(third)) {
        return {
          name: 'notice',
          params: { id: extractAnnouncementIdFromBoardPostId(third) },
        };
      }

      if (second === 'post' && third) {
        return {
          name: 'board/post',
          params: { postId: third },
        };
      }

      return { name: 'board' };

    case 'my-applications':
    case 'my-settlements':
    case 'applications':
      return { name: 'schedule' };

    case 'profile':
      return { name: 'profile' };

    case 'settings':
      switch (second) {
        case undefined:
          return { name: 'settings' };
        case 'profile':
          return { name: 'settings/profile' };
        case 'change-password':
          return { name: 'settings/change-password' };
        case 'delete-account':
          return { name: 'settings/delete-account' };
        case 'privacy':
          return { name: 'settings/privacy' };
        case 'terms':
          return { name: 'settings/terms' };
        case 'employer-terms':
          return { name: 'settings/employer-terms' };
        case 'liability-waiver':
          return { name: 'settings/liability-waiver' };
        case 'my-data':
          return { name: 'settings/my-data' };
        case 'business-info':
          return { name: 'settings/business-info' };
        case 'about':
        case 'notifications':
          return { name: 'settings' };
        default:
          return null;
      }

    case 'support':
      switch (second) {
        case undefined:
          return { name: 'support' };
        case 'faq':
          return { name: 'support/faq' };
        case 'create-inquiry':
          return { name: 'support/create-inquiry' };
        case 'my-inquiries':
          return { name: 'support/my-inquiries' };
        case 'inquiry':
          return third ? { name: 'support/inquiry', params: { id: third } } : null;
        case 'inquiries':
          return third
            ? { name: 'support/inquiry', params: { id: third } }
            : { name: 'support/my-inquiries' };
        case 'reports':
          return { name: 'notifications' };
        default:
          return null;
      }

    case 'notices':
      return second ? { name: 'notice', params: { id: second } } : { name: 'notices' };

    case 'announcements':
      if (second === 'create') {
        return { name: 'admin/announcement-create' };
      }
      if (second && third === 'edit') {
        return { name: 'admin/announcement-edit', params: { id: second } };
      }
      return second ? { name: 'notice', params: { id: second } } : { name: 'notices' };

    case 'reviews':
      return !second || second === 'pending'
        ? { name: 'reviews/pending' }
        : { name: 'reviews/detail', params: { workLogId: second } };

    case 'my-postings':
      if (second === 'create') {
        return { name: 'employer/posting-create' };
      }
      if (second) {
        if (third === 'edit') {
          return { name: 'employer/posting-edit', params: { id: second } };
        }
        if (third === 'applicants') {
          return { name: 'employer/applicants', params: { jobId: second } };
        }
        if (third === 'settlement' || third === 'settlements') {
          return { name: 'employer/settlement', params: { jobId: second } };
        }
        return { name: 'employer/posting', params: { id: second } };
      }
      return { name: 'employer/my-postings' };

    case 'employer':
      if (second === 'my-postings' || second === 'postings') {
        if (third === 'create') {
          return { name: 'employer/posting-create' };
        }
        if (third) {
          if (fourth === 'edit') {
            return { name: 'employer/posting-edit', params: { id: third } };
          }
          if (fourth === 'applicants' || fourth === 'attendance') {
            return { name: 'employer/applicants', params: { jobId: third } };
          }
          if (fourth === 'settlement' || fourth === 'settlements') {
            return { name: 'employer/settlement', params: { jobId: third } };
          }
          return { name: 'employer/posting', params: { id: third } };
        }
        return { name: 'employer/my-postings' };
      }
      if (second === 'applicants' && third) {
        return { name: 'employer/applicants', params: { jobId: third } };
      }
      if (second === 'settlement' && third) {
        return { name: 'employer/settlement', params: { jobId: third } };
      }
      return { name: 'employer/my-postings' };

    case 'users':
      return second ? { name: 'admin/user', params: { id: second } } : { name: 'admin/users' };

    case 'stats':
      return { name: 'admin/stats' };

    case 'reports':
      return second ? { name: 'admin/report', params: { id: second } } : { name: 'admin/reports' };

    case 'inquiries':
      return second
        ? { name: 'admin/inquiry', params: { id: second } }
        : { name: 'admin/inquiries' };

    case 'tournaments':
      return { name: 'admin/tournaments' };

    case 'admin':
      switch (second) {
        case undefined:
        case 'dashboard':
          return { name: 'admin/dashboard' };
        case 'users':
          return third ? { name: 'admin/user', params: { id: third } } : { name: 'admin/users' };
        case 'stats':
          return { name: 'admin/stats' };
        case 'reports':
          return third
            ? { name: 'admin/report', params: { id: third } }
            : { name: 'admin/reports' };
        case 'announcements':
          if (third === 'create') {
            return { name: 'admin/announcement-create' };
          }
          if (third && fourth === 'edit') {
            return { name: 'admin/announcement-edit', params: { id: third } };
          }
          return third
            ? { name: 'admin/announcement', params: { id: third } }
            : { name: 'admin/announcements' };
        case 'inquiries':
          return third
            ? { name: 'admin/inquiry', params: { id: third } }
            : { name: 'admin/inquiries' };
        case 'tournaments':
          return { name: 'admin/tournaments' };
        default:
          return null;
      }

    default:
      if (params.jobId || params.jobPostingId) {
        return { name: 'job', params: { id: params.jobId || params.jobPostingId } };
      }
      if (params.notificationId) {
        return { name: 'notifications' };
      }
      return null;
  }
}

export function getCurrentWebRoute(): DeepLinkRoute | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    const queryParams: Record<string, string> = {};
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    return pathToRoute(window.location.pathname, queryParams);
  } catch {
    return null;
  }
}

export function parseDeepLink(url: string): ParsedDeepLink {
  try {
    let path = '';
    const queryParams: Record<string, string> = {};

    if (url.startsWith(SCHEME_PREFIX)) {
      const withoutScheme = url.slice(SCHEME_PREFIX.length);
      const [pathPart, queryPart] = withoutScheme.split('?');
      path = pathPart;

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
      }
    } else if (url.startsWith(WEB_PREFIX) || isSupportedWebUrl(url)) {
      const urlObj = new URL(url);
      path = urlObj.pathname;
      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
    } else if (url.startsWith('/')) {
      const [pathPart, queryPart] = url.split('?');
      path = pathPart;

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
      }
    } else {
      return {
        url,
        path: '',
        queryParams: {},
        route: null,
        isValid: false,
      };
    }

    const route = pathToRoute(path, queryParams);

    return {
      url,
      path,
      queryParams,
      route,
      isValid: route !== null,
    };
  } catch (error) {
    logger.error('딥링크 파싱 실패', toError(error), { url });
    return {
      url,
      path: '',
      queryParams: {},
      route: null,
      isValid: false,
    };
  }
}

export { pathToRoute };
