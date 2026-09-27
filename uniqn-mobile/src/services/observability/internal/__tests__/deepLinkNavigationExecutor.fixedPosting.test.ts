/**
 * getRouteFromNotification — 고정 공고 만료·만료 예정 알림 탭 라우팅
 *
 * 만료 트리거(notify_on_job_posting_owner_expired)는 link 에 구직자 화면 '/jobs/{id}' 를 심는다.
 * 매핑과 파라미터 수가 같으면 link 가 이기므로, 우선 목록에 없으면 사장이 재오픈 버튼이 없는
 * 화면으로 간다. 이미 발송된 알림의 link 는 고칠 수 없어 클라이언트에서 흡수한다.
 */

import { getRouteFromNotification } from '../deepLinkNavigationExecutor';
import { NotificationType } from '@/types/notification';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../analyticsService', () => ({
  trackEvent: jest.fn(),
}));

describe('getRouteFromNotification — 고정 공고 만료 알림', () => {
  it('만료 알림은 DB link(/jobs/P)가 있어도 관리 화면으로 간다', () => {
    expect(
      getRouteFromNotification(
        NotificationType.FIXED_POSTING_EXPIRED,
        { jobPostingId: 'P' },
        '/jobs/P'
      )
    ).toEqual({ name: 'employer/posting', params: { id: 'P' } });
  });

  it('만료 예정 알림은 관리 화면으로 간다(link 도 /my-postings/P)', () => {
    expect(
      getRouteFromNotification(
        NotificationType.FIXED_POSTING_EXPIRING,
        { jobPostingId: 'P' },
        '/my-postings/P'
      )
    ).toEqual({ name: 'employer/posting', params: { id: 'P' } });
  });
});
