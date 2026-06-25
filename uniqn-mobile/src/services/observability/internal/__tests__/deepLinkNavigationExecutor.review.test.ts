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
