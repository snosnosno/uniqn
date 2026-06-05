/**
 * UNIQN Mobile - Push Notification Constants
 *
 * @description 기본 알림 채널 + Expo Push Token 재시도 지연 상수
 */

import type { NotificationChannel } from './pushNotificationTypes';

/**
 * 기본 알림 채널 (Android)
 *
 * @description notification.ts의 AndroidChannelId와 일치해야 함
 * - default: 기본 알림
 * - applications: 지원 관련 알림
 * - reminders: 출퇴근, 스케줄 리마인더
 * - settlement: 정산 관련 알림
 * - announcements: 공지, 시스템 알림
 */
export const DEFAULT_CHANNELS: NotificationChannel[] = [
  {
    id: 'default',
    name: '기본 알림',
    description: '일반 알림',
    importance: 'default',
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  {
    id: 'applications',
    name: '지원 알림',
    description: '새 지원자, 지원 확정/거절 관련 알림',
    importance: 'high',
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  {
    id: 'reminders',
    name: '출퇴근/스케줄 알림',
    description: '출퇴근 확인, 스케줄 변경, 리마인더 알림',
    importance: 'high',
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  {
    id: 'settlement',
    name: '정산 알림',
    description: '정산 완료, 정산 요청 관련 알림',
    importance: 'default',
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  {
    id: 'announcements',
    name: '공지/시스템 알림',
    description: '공지사항, 시스템 점검, 앱 업데이트 알림',
    importance: 'default',
    sound: 'default',
    vibrate: false,
    badge: false,
  },
];

export const EXPO_PUSH_TOKEN_RETRY_DELAYS_MS = [750, 2000] as const;
