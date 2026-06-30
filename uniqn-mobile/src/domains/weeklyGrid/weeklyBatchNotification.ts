/**
 * weeklyBatchNotification — "이번 주 배치 확인" 알림 payload 빌더(순수)
 *
 * 운영자에게 이번 주 배치 확인을 요청하는 알림 레코드를 결정적으로 생성한다.
 * 기존 푸시 인프라(public.notifications 직접 INSERT + AFTER 트리거 발송) 재사용을 전제로,
 * INSERT 가능한 형태만 빌드한다(서비스 계층이 repository.createNotification 으로 적재).
 *
 * 라우트/타입 재사용 한계(설계 의도):
 * - 전용 weekly NotificationType 을 추가하지 않는다 — NotificationType 은 닫힌 union 이라
 *   값 추가 시 category/priority/channel/labels/templates/routeMap 등 6개 Record 전수보강이 강제된다.
 *   의미가 가장 근접한 SCHEDULE_CREATED(배정/high/REMINDERS)를 재사용한다.
 *   notifications.type 은 free text(enum/CHECK 없음)라 DB 마이그가 불필요하다.
 * - link 우선순위(executor getRouteFromNotification): link(검증 통과분)가 type 라우트맵보다
 *   우선 사용된다(REVIEW_REQUEST/REMINDER 예외 제외). 그래서 weekly-grid 딥링크를 link 로 싣는다.
 *   딥링크 파서(case 'employer' → 'weekly-grid')와 RouteMapper(EXPO_ROUTES.weeklyGrid)에 등록되어
 *   link 가 곧바로 employer/weekly-grid 로 해소된다. (과거엔 파서 catch-all 이 employer/my-postings 를
 *   반환해 '내 공고'로 오해소됐고, 파서가 항상 유효 route 를 돌려줬으므로 SCHEDULE_CREATED 라우트맵
 *   폴백은 발동하지 않았다 — 폴백으로 해소된다는 종전 주석은 사실이 아니었다.)
 * - link 정규식(deepLinkLinkValidator SAFE_LINK_PATTERN: /^\/[a-zA-Z0-9\-_/]*$/)이 쿼리스트링을
 *   금지하므로 venueId/weekLabel 식별자는 link 가 아니라 data 로 운반한다.
 */

import { NotificationType, type NotificationPriority } from '@/types/notification';

/**
 * weekly-grid 딥링크 경로.
 * 딥링크 파서(case 'employer' → 'weekly-grid')와 RouteMapper(EXPO_ROUTES.weeklyGrid)에 등록되어
 * employer/weekly-grid 라우트로 직접 해소된다. expo-router 실경로는 app/(employer)/weekly-grid.tsx.
 */
export const WEEKLY_GRID_NOTIFICATION_LINK = '/employer/weekly-grid';

/**
 * "이번 주 배치 확인" 알림에 재사용하는 기존 NotificationType.
 * @see 파일 상단 "라우트/타입 재사용 한계" 주석
 */
export const WEEKLY_BATCH_CONFIRM_TYPE: NotificationType = NotificationType.SCHEDULE_CREATED;

export interface WeeklyBatchConfirmInput {
  /** 수신자(운영자) user id */
  recipientId: string;
  workspaceId: string;
  /** 운영처 컨테이너 id(= venue 식별자) */
  venueId: string;
  /** 주차 라벨(예: '6월 5주차', '2026-06-29 ~ 07-05') — 내부 생성, 비-PII */
  weekLabel: string;
  /** 운영처명(컨테이너 title). 미제공/공백이면 기본 라벨 사용 */
  venueName?: string;
}

export interface WeeklyBatchNotificationPayload {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  data: Record<string, string>;
  priority: NotificationPriority;
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    throw new Error(`이번 주 배치 확인 알림: 필수값 누락(${field})`);
  }
  return trimmed;
}

/**
 * "이번 주 배치 확인" 알림 payload 를 빌드한다(순수·결정적).
 *
 * @throws recipientId/workspaceId/venueId/weekLabel 중 비어있으면 Error
 */
export function buildWeeklyBatchConfirmNotification(
  input: WeeklyBatchConfirmInput
): WeeklyBatchNotificationPayload {
  const recipientId = requireNonEmpty(input.recipientId, 'recipientId');
  const workspaceId = requireNonEmpty(input.workspaceId, 'workspaceId');
  const venueId = requireNonEmpty(input.venueId, 'venueId');
  const weekLabel = requireNonEmpty(input.weekLabel, 'weekLabel');

  const trimmedVenueName = input.venueName?.trim();
  const venueLabel = trimmedVenueName && trimmedVenueName.length > 0 ? trimmedVenueName : '운영처';

  const data: Record<string, string> = {
    workspaceId,
    venueId,
    weekLabel,
    ...(trimmedVenueName && trimmedVenueName.length > 0 ? { venueName: trimmedVenueName } : {}),
  };

  return {
    recipientId,
    type: WEEKLY_BATCH_CONFIRM_TYPE,
    title: '이번 주 배치 확인',
    body: `${venueLabel} ${weekLabel} 배치를 확인해주세요.`,
    link: WEEKLY_GRID_NOTIFICATION_LINK,
    data,
    priority: 'high',
  };
}
