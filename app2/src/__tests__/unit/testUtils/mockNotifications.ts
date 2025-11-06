import { Timestamp } from 'firebase/firestore';

// Notification 인터페이스 (기존 타입과 동일)
export interface Notification {
  id: string;
  userId: string;
  type: 'system' | 'work' | 'schedule' | 'finance';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Timestamp;
  relatedId?: string;
  actionUrl?: string;
}

// useNotifications Hook 반환 타입
export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

/**
 * Mock Notification Factory 함수
 * @param overrides - 기본값을 덮어쓸 속성들
 * @returns Notification 객체
 */
export const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: `notif-${Math.random().toString(36).substr(2, 9)}`,
  userId: 'test-user-1',
  type: 'work',
  title: '테스트 알림',
  message: '테스트 메시지입니다.',
  isRead: false,
  createdAt: Timestamp.now(),
  ...overrides
});

// 사전 정의된 Notification Fixtures
export const mockNotifications = {
  // 안읽은 일반 알림
  unread: createMockNotification({
    id: 'notif-1',
    type: 'work',
    title: '근무 배정 알림',
    message: '2025-11-15 저녁 근무에 배정되었습니다.',
    isRead: false,
    relatedId: 'event-1',
    actionUrl: '/app/work-logs'
  }),

  // 읽은 알림
  read: createMockNotification({
    id: 'notif-2',
    type: 'finance',
    title: '급여 지급 완료',
    message: '10월 급여가 지급되었습니다.',
    isRead: true,
    relatedId: 'payment-1',
    actionUrl: '/app/salary'
  }),

  // 시스템 알림 (긴급)
  systemUrgent: createMockNotification({
    id: 'notif-3',
    type: 'system',
    title: '🚨 시스템 점검 공지',
    message: '오늘 밤 11시부터 시스템 점검이 예정되어 있습니다.',
    isRead: false
  }),

  // 일정 변경 알림
  scheduleChange: createMockNotification({
    id: 'notif-4',
    type: 'schedule',
    title: '일정 변경 알림',
    message: '2025-11-20 근무 일정이 변경되었습니다.',
    isRead: false,
    relatedId: 'event-2',
    actionUrl: '/app/schedule'
  }),

  // 업무 관련 안읽은 알림
  workUnread: createMockNotification({
    id: 'notif-5',
    type: 'work',
    title: '새로운 근무 요청',
    message: '2025-11-25 근무 요청이 있습니다.',
    isRead: false,
    relatedId: 'event-3',
    actionUrl: '/app/work-logs'
  }),

  // 재정 관련 안읽은 알림
  financeUnread: createMockNotification({
    id: 'notif-6',
    type: 'finance',
    title: '급여 명세서 확인 필요',
    message: '11월 급여 명세서를 확인해주세요.',
    isRead: false,
    relatedId: 'payment-2',
    actionUrl: '/app/salary'
  }),

  // 읽은 일정 알림
  scheduleRead: createMockNotification({
    id: 'notif-7',
    type: 'schedule',
    title: '일정 확인 완료',
    message: '다음 주 근무 일정이 확정되었습니다.',
    isRead: true,
    relatedId: 'event-4',
    actionUrl: '/app/schedule'
  }),

  // 읽은 시스템 알림
  systemRead: createMockNotification({
    id: 'notif-8',
    type: 'system',
    title: '시스템 업데이트 완료',
    message: '최신 버전으로 업데이트되었습니다.',
    isRead: true
  })
};

/**
 * 대량 알림 생성 (스크롤 테스트용)
 * @param count - 생성할 알림 개수
 * @returns Notification 배열
 */
export const createMockNotifications = (count: number): Notification[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockNotification({
      id: `notif-${index + 1}`,
      title: `알림 ${index + 1}`,
      message: `테스트 메시지 ${index + 1}`,
      isRead: index % 3 === 0 // 1/3은 읽음 상태
    })
  );
};

/**
 * useNotifications Hook Mock 함수
 * @param overrides - 기본값을 덮어쓸 속성들
 * @returns UseNotificationsReturn 객체
 */
export const createMockUseNotifications = (
  overrides: Partial<UseNotificationsReturn> = {}
): UseNotificationsReturn => ({
  notifications: [mockNotifications.unread, mockNotifications.read],
  unreadCount: 1,
  loading: false,
  error: null,
  markAsRead: jest.fn().mockResolvedValue(undefined),
  markAllAsRead: jest.fn().mockResolvedValue(undefined),
  ...overrides
});
