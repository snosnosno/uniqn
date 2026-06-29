/**
 * weeklyBatchNotification — "이번 주 배치 확인" 알림 payload 빌더(순수) 테스트
 *
 * 운영자에게 이번 주 배치 확인을 요청하는 알림 레코드를 결정적으로 생성한다.
 * 기존 푸시 인프라(notifications INSERT + AFTER 트리거 발송) 재사용을 전제로,
 * INSERT 가능한 형태(recipientId/type/title/body/link/data/priority)만 빌드.
 *
 * 라우트/타입 재사용 한계:
 * - 전용 weekly NotificationType 미추가(6개 Record<NotificationType,X> 전수보강 회피).
 *   의미가 가장 근접한 SCHEDULE_CREATED 재사용. notifications.type 은 free text 라 마이그 불필요.
 * - link 우선순위 함정(executor getRouteFromNotification): link 가 type 라우트맵보다 우선되므로
 *   weekly-grid 딥링크를 link 로 싣는다(Phase 2.7 라우트 등록 시 해소).
 * - link 정규식(SAFE_LINK_PATTERN)이 쿼리스트링 금지 → venueId/weekLabel 은 data 로 운반.
 */

import { NotificationType } from '@/types/notification';
import {
  buildWeeklyBatchConfirmNotification,
  WEEKLY_GRID_NOTIFICATION_LINK,
  WEEKLY_BATCH_CONFIRM_TYPE,
} from '../weeklyBatchNotification';

const baseInput = {
  recipientId: 'owner-uuid-1',
  workspaceId: 'ws-1',
  venueId: 'venue-1',
  weekLabel: '6월 5주차',
  venueName: '강남 홀덤펍',
};

describe('buildWeeklyBatchConfirmNotification', () => {
  it('재사용 타입(SCHEDULE_CREATED) + high 우선순위로 빌드한다', () => {
    const payload = buildWeeklyBatchConfirmNotification(baseInput);
    expect(payload.type).toBe(WEEKLY_BATCH_CONFIRM_TYPE);
    expect(payload.type).toBe(NotificationType.SCHEDULE_CREATED);
    expect(payload.priority).toBe('high');
  });

  it('recipientId 를 그대로 운반한다', () => {
    const payload = buildWeeklyBatchConfirmNotification(baseInput);
    expect(payload.recipientId).toBe('owner-uuid-1');
  });

  it('제목은 고정, 본문에 운영처명·주차 라벨을 포함한다', () => {
    const payload = buildWeeklyBatchConfirmNotification(baseInput);
    expect(payload.title).toBe('이번 주 배치 확인');
    expect(payload.body).toContain('강남 홀덤펍');
    expect(payload.body).toContain('6월 5주차');
  });

  it('link 는 weekly-grid 딥링크 상수(쿼리스트링 없음)다', () => {
    const payload = buildWeeklyBatchConfirmNotification(baseInput);
    expect(payload.link).toBe(WEEKLY_GRID_NOTIFICATION_LINK);
    expect(payload.link).not.toContain('?');
    // SAFE_LINK_PATTERN: /^\/[a-zA-Z0-9\-_/]*$/
    expect(payload.link).toMatch(/^\/[a-zA-Z0-9\-_/]*$/);
  });

  it('data 에 workspaceId/venueId/weekLabel 을 문자열로 운반한다', () => {
    const payload = buildWeeklyBatchConfirmNotification(baseInput);
    expect(payload.data).toMatchObject({
      workspaceId: 'ws-1',
      venueId: 'venue-1',
      weekLabel: '6월 5주차',
      venueName: '강남 홀덤펍',
    });
  });

  it('venueName 미제공 시 본문은 기본 라벨(운영처)을 쓰고 data 에 venueName 키가 없다', () => {
    const { venueName: _omit, ...withoutName } = baseInput;
    const payload = buildWeeklyBatchConfirmNotification(withoutName);
    expect(payload.body).toContain('운영처');
    expect(payload.data.venueName).toBeUndefined();
  });

  it('venueName 이 공백뿐이면 기본 라벨로 폴백한다', () => {
    const payload = buildWeeklyBatchConfirmNotification({ ...baseInput, venueName: '   ' });
    expect(payload.body).toContain('운영처');
    expect(payload.data.venueName).toBeUndefined();
  });

  it('동일 입력에 동일 출력(결정적)', () => {
    const a = buildWeeklyBatchConfirmNotification(baseInput);
    const b = buildWeeklyBatchConfirmNotification(baseInput);
    expect(a).toEqual(b);
  });

  it.each([
    ['recipientId', { ...baseInput, recipientId: '' }],
    ['workspaceId', { ...baseInput, workspaceId: '' }],
    ['venueId', { ...baseInput, venueId: '  ' }],
    ['weekLabel', { ...baseInput, weekLabel: '' }],
  ])('%s 가 비면 던진다', (_field, input) => {
    expect(() => buildWeeklyBatchConfirmNotification(input)).toThrow();
  });
});
