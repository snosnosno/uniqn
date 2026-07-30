/**
 * getRouteFromNotification — 리뷰 알림 탭 라우팅 단위 테스트
 *
 * 검증 목표:
 *  - REVIEW_REQUEST / REVIEW_REMINDER 는 link 가 있어도 무시하고 허브(reviews/pending) 로 보낸다.
 *  - REVIEW_RECEIVED 는 기존대로 link 우선(→상세) 로직을 유지한다.
 *
 * 순수 라우팅 함수만 검증하므로 expo-router / react-native 는 모킹한다.
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

describe('getRouteFromNotification — 리뷰 알림 탭 라우팅', () => {
  describe('REVIEW_REQUEST: link 무시 → 허브(reviews/pending)', () => {
    it('유효한 link(/reviews/wl-1) 가 있어도 허브로 이동한다', () => {
      expect(
        getRouteFromNotification(NotificationType.REVIEW_REQUEST, undefined, '/reviews/wl-1')
      ).toEqual({ name: 'reviews/pending' });
    });

    it('link 가 없어도 허브로 이동한다 (폴백도 허브)', () => {
      expect(getRouteFromNotification(NotificationType.REVIEW_REQUEST, undefined)).toEqual({
        name: 'reviews/pending',
      });
    });
  });

  describe('REVIEW_REMINDER: link 무시 → 허브(reviews/pending)', () => {
    it('유효한 link(/reviews/wl-1) 가 있어도 허브로 이동한다', () => {
      expect(
        getRouteFromNotification(NotificationType.REVIEW_REMINDER, undefined, '/reviews/wl-1')
      ).toEqual({ name: 'reviews/pending' });
    });
  });

  describe('REVIEW_RECEIVED: link 우선 → 상세(reviews/detail)', () => {
    it('유효한 link(/reviews/wl-1) 가 있으면 상세 화면으로 이동한다', () => {
      expect(
        getRouteFromNotification(NotificationType.REVIEW_RECEIVED, undefined, '/reviews/wl-1')
      ).toEqual({ name: 'reviews/detail', params: { workLogId: 'wl-1' } });
    });
  });
});

/**
 * link vs data 구체성 판정 회귀 테스트.
 *
 * DB 트리거·RPC 는 지원 생애주기 알림에 link='/schedule' 만 심으면서 data 에는
 * applicationId 를 함께 넣는다. link 를 무조건 우선하던 기존 구현에서는 그 applicationId 가
 * 통째로 버려져, 스케줄 탭의 정밀 착지(근무월 점프 → 날짜 선택 → 상세 시트)가 죽어 있었다.
 */
describe('getRouteFromNotification — link 와 data 매핑의 구체성 판정', () => {
  const APPLICATION_LIFECYCLE_TYPES = [
    NotificationType.APPLICATION_CONFIRMED,
    NotificationType.CONFIRMATION_CANCELLED,
    NotificationType.APPLICATION_REJECTED,
    NotificationType.CANCELLATION_APPROVED,
    NotificationType.CANCELLATION_REJECTED,
  ];

  it.each(APPLICATION_LIFECYCLE_TYPES)(
    '%s: 굵은 link(/schedule) 보다 data.applicationId 매핑을 쓴다',
    (type) => {
      expect(getRouteFromNotification(type, { applicationId: 'app-1' }, '/schedule')).toEqual({
        name: 'schedule',
        params: { applicationId: 'app-1' },
      });
    }
  );

  it('data 에 applicationId 가 없으면 link 그대로 스케줄 탭으로 간다', () => {
    expect(
      getRouteFromNotification(NotificationType.APPLICATION_CONFIRMED, {}, '/schedule')
    ).toEqual({ name: 'schedule' });
  });

  it('link 가 더 구체적이면 link 를 유지한다 (NO_SHOW_ALERT: 매핑은 schedule, link 는 지원자 목록)', () => {
    expect(
      getRouteFromNotification(
        NotificationType.NO_SHOW_ALERT,
        { jobPostingId: 'job-1' },
        '/employer/applicants/job-1'
      )
    ).toEqual({ name: 'employer/applicants', params: { jobId: 'job-1' } });
  });

  it('ROLE_CHANGED: DB 가 심은 link(/settings) 를 무시하고 프로필 탭으로 간다', () => {
    expect(getRouteFromNotification(NotificationType.ROLE_CHANGED, undefined, '/settings')).toEqual(
      { name: 'profile' }
    );
  });

  it('link 가 없으면 기존대로 타입 매핑으로 폴백한다', () => {
    expect(
      getRouteFromNotification(NotificationType.CANCELLATION_REQUESTED, { jobPostingId: 'job-2' })
    ).toEqual({ name: 'employer/cancellation-requests', params: { jobId: 'job-2' } });
  });
});
