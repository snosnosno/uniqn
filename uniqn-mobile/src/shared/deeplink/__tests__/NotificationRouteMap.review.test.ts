import { getRouteForNotificationType } from '../NotificationRouteMap';
import { NotificationType } from '@/types/notification';

describe('리뷰 알림 라우팅 — 항상 허브', () => {
  it.each([
    NotificationType.REVIEW_REQUEST,
    NotificationType.REVIEW_RECEIVED,
    NotificationType.REVIEW_REMINDER,
  ])('%s 는 workLogId 가 있어도 허브(reviews/pending)로 보낸다', (type) => {
    expect(getRouteForNotificationType(type, { workLogId: 'wl-1' })).toEqual({
      name: 'reviews/pending',
    });
    expect(getRouteForNotificationType(type, {})).toEqual({ name: 'reviews/pending' });
  });
});
