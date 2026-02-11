/**
 * UNIQN Mobile - notificationGrouping.ts 테스트
 *
 * @description 알림 그룹핑 유틸리티 함수들의 단위 테스트
 */

import { Timestamp } from 'firebase/firestore';
import {
  NotificationType,
  NotificationCategory,
  isGroupedNotification,
} from '@/types/notification';
import type {
  NotificationData,
  GroupedNotificationData,
  NotificationListItem,
} from '@/types/notification';

import {
  groupNotifications,
  countUnreadInGroupedList,
  groupNotificationsWithCategoryFilter,
} from '../notificationGrouping';

// ============================================================================
// Test Helpers
// ============================================================================

function createTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

function createNotification(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    id: 'notif-1',
    recipientId: 'user-1',
    type: NotificationType.NEW_APPLICATION,
    title: '새로운 지원자',
    body: '홍길동님이 지원했습니다',
    isRead: false,
    createdAt: createTimestamp(new Date()),
    ...overrides,
  } as NotificationData;
}

function createNotificationWithTime(
  minutesAgo: number,
  overrides: Partial<NotificationData> = {}
): NotificationData {
  const date = new Date(Date.now() - minutesAgo * 60 * 1000);
  return createNotification({
    createdAt: createTimestamp(date),
    ...overrides,
  });
}

// ============================================================================
// groupNotifications
// ============================================================================

describe('groupNotifications', () => {
  it('빈 배열은 빈 배열을 반환한다', () => {
    const result = groupNotifications([]);
    expect(result).toEqual([]);
  });

  it('그룹핑 비활성화 시 원본 배열을 반환한다', () => {
    const notifications = [createNotification()];
    const result = groupNotifications(notifications, { enabled: false });
    expect(result).toHaveLength(1);
    expect(isGroupedNotification(result[0])).toBe(false);
  });

  it('같은 type + jobPostingId의 알림들을 그룹화한다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    expect(result).toHaveLength(1);
    expect(isGroupedNotification(result[0])).toBe(true);

    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.count).toBe(2);
    expect(grouped.type).toBe(NotificationType.NEW_APPLICATION);
  });

  it('다른 jobPostingId는 별도 그룹으로 분리한다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
      createNotificationWithTime(15, {
        id: 'n-3',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-2', staffName: '박영희' },
        body: '박영희님이 지원했습니다',
      }),
      createNotificationWithTime(20, {
        id: 'n-4',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-2', staffName: '이민수' },
        body: '이민수님이 지원했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    expect(result).toHaveLength(2);
    expect(result.every((item) => isGroupedNotification(item))).toBe(true);
  });

  it('다른 type은 별도 그룹으로 분리한다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
      createNotificationWithTime(15, {
        id: 'n-3',
        type: NotificationType.STAFF_CHECKED_IN,
        data: { jobPostingId: 'job-1', staffName: '박영희' },
        body: '박영희님이 출근했습니다',
      }),
      createNotificationWithTime(20, {
        id: 'n-4',
        type: NotificationType.STAFF_CHECKED_IN,
        data: { jobPostingId: 'job-1', staffName: '이민수' },
        body: '이민수님이 출근했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    expect(result).toHaveLength(2);
  });

  it('그룹핑 불가능한 타입은 개별 항목으로 유지한다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.ANNOUNCEMENT,
        body: '공지사항입니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.ANNOUNCEMENT,
        body: '또 다른 공지사항입니다',
      }),
    ];
    const result = groupNotifications(notifications);
    // ANNOUNCEMENT is not in GROUPABLE_NOTIFICATION_TYPES
    expect(result).toHaveLength(2);
    expect(result.every((item) => !isGroupedNotification(item))).toBe(true);
  });

  it('minGroupSize 미달 시 원본으로 유지한다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
    ];
    const result = groupNotifications(notifications, { minGroupSize: 2 });
    expect(result).toHaveLength(1);
    expect(isGroupedNotification(result[0])).toBe(false);
  });

  it('시간 윈도우를 초과한 알림은 그룹핑하지 않는다', () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48시간 전
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotification({
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
        createdAt: createTimestamp(oldDate),
      }),
    ];
    const result = groupNotifications(notifications, {
      timeWindowMs: 24 * 60 * 60 * 1000,
    });
    // n-1 within window, n-2 outside -> n-1 alone doesn't meet minGroupSize=2
    expect(result).toHaveLength(2);
    expect(result.every((item) => !isGroupedNotification(item))).toBe(true);
  });

  it('그룹의 groupTitle이 올바르게 생성된다 (NEW_APPLICATION)', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.groupTitle).toBe('새 지원자 2명');
  });

  it('그룹의 groupTitle이 올바르게 생성된다 (APPLICATION_CANCELLED)', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.APPLICATION_CANCELLED,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원을 취소했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.APPLICATION_CANCELLED,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원을 취소했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.groupTitle).toBe('지원 취소 2건');
  });

  it('그룹의 groupTitle이 올바르게 생성된다 (STAFF_CHECKED_IN)', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.STAFF_CHECKED_IN,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 출근했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.STAFF_CHECKED_IN,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 출근했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.groupTitle).toBe('출근 2명');
  });

  it('그룹의 groupTitle이 올바르게 생성된다 (STAFF_CHECKED_OUT)', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.STAFF_CHECKED_OUT,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 퇴근했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.STAFF_CHECKED_OUT,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 퇴근했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.groupTitle).toBe('퇴근 2명');
  });

  it('그룹의 groupTitle이 올바르게 생성된다 (NO_SHOW_ALERT)', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NO_SHOW_ALERT,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님 노쇼',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NO_SHOW_ALERT,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님 노쇼',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.groupTitle).toBe('노쇼 알림 2건');
  });

  it('그룹의 unreadCount가 올바르게 계산된다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
        isRead: false,
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
        isRead: true,
      }),
      createNotificationWithTime(15, {
        id: 'n-3',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '박영희' },
        body: '박영희님이 지원했습니다',
        isRead: false,
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.unreadCount).toBe(2);
  });

  it('그룹의 context에 jobPostingId와 jobTitle이 포함된다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', jobTitle: '테스트 공고', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', jobTitle: '테스트 공고', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.context.jobPostingId).toBe('job-1');
    expect(grouped.context.jobTitle).toBe('테스트 공고');
  });

  it('그룹 내 알림이 최신순으로 정렬된다', () => {
    const notifications = [
      createNotificationWithTime(30, {
        id: 'n-old',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(5, {
        id: 'n-new',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.notifications[0].id).toBe('n-new');
    expect(grouped.notifications[1].id).toBe('n-old');
  });

  it('결과가 최신순으로 정렬된다', () => {
    const notifications = [
      createNotificationWithTime(60, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(55, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
      createNotificationWithTime(5, {
        id: 'n-3',
        type: NotificationType.ANNOUNCEMENT,
        body: '최신 공지사항',
      }),
    ];
    const result = groupNotifications(notifications);
    // n-3 (5분 전, 개별) should come before grouped (55분 전)
    expect(result).toHaveLength(2);
    expect(isGroupedNotification(result[0])).toBe(false);
    expect((result[0] as NotificationData).id).toBe('n-3');
    expect(isGroupedNotification(result[1])).toBe(true);
  });

  it('jobPostingId가 없는 알림은 그룹핑하지 않는다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: {},
        body: '알림 1',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: {},
        body: '알림 2',
      }),
    ];
    const result = groupNotifications(notifications);
    expect(result).toHaveLength(2);
    expect(result.every((item) => !isGroupedNotification(item))).toBe(true);
  });

  it('groupBody가 staffName으로부터 생성된다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    // Both are shown (2 <= maxPreview of 3)
    expect(grouped.groupBody).toContain('홍길동');
    expect(grouped.groupBody).toContain('김철수');
  });

  it('groupBody가 4개 이상일 때 "외 N명"으로 축약된다', () => {
    const notifications = [
      createNotificationWithTime(5, {
        id: 'n-1',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '홍길동' },
        body: '홍길동님이 지원했습니다',
      }),
      createNotificationWithTime(10, {
        id: 'n-2',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '김철수' },
        body: '김철수님이 지원했습니다',
      }),
      createNotificationWithTime(15, {
        id: 'n-3',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '박영희' },
        body: '박영희님이 지원했습니다',
      }),
      createNotificationWithTime(20, {
        id: 'n-4',
        type: NotificationType.NEW_APPLICATION,
        data: { jobPostingId: 'job-1', staffName: '이민수' },
        body: '이민수님이 지원했습니다',
      }),
    ];
    const result = groupNotifications(notifications);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.groupBody).toContain('외 1명');
  });
});

// ============================================================================
// countUnreadInGroupedList
// ============================================================================

describe('countUnreadInGroupedList', () => {
  it('빈 배열은 0을 반환한다', () => {
    expect(countUnreadInGroupedList([])).toBe(0);
  });

  it('개별 알림의 읽지 않은 수를 올바르게 계산한다', () => {
    const items: NotificationListItem[] = [
      createNotification({ id: 'n-1', isRead: false }),
      createNotification({ id: 'n-2', isRead: true }),
      createNotification({ id: 'n-3', isRead: false }),
    ];
    expect(countUnreadInGroupedList(items)).toBe(2);
  });

  it('모두 읽은 상태이면 0을 반환한다', () => {
    const items: NotificationListItem[] = [
      createNotification({ id: 'n-1', isRead: true }),
      createNotification({ id: 'n-2', isRead: true }),
    ];
    expect(countUnreadInGroupedList(items)).toBe(0);
  });

  it('그룹화된 알림의 unreadCount를 올바르게 합산한다', () => {
    const grouped: GroupedNotificationData = {
      groupId: 'new_application_job-1',
      type: NotificationType.NEW_APPLICATION,
      context: { jobPostingId: 'job-1' },
      notifications: [],
      count: 3,
      unreadCount: 2,
      latestCreatedAt: createTimestamp(new Date()),
      groupTitle: '새 지원자 3명',
      groupBody: '홍길동, 김철수',
    };
    expect(countUnreadInGroupedList([grouped])).toBe(2);
  });

  it('혼합된 목록의 읽지 않은 수를 올바르게 합산한다', () => {
    const grouped: GroupedNotificationData = {
      groupId: 'new_application_job-1',
      type: NotificationType.NEW_APPLICATION,
      context: { jobPostingId: 'job-1' },
      notifications: [],
      count: 3,
      unreadCount: 2,
      latestCreatedAt: createTimestamp(new Date()),
      groupTitle: '새 지원자 3명',
      groupBody: '홍길동, 김철수',
    };
    const individual = createNotification({ id: 'n-solo', isRead: false });
    const readIndividual = createNotification({ id: 'n-read', isRead: true });

    expect(countUnreadInGroupedList([grouped, individual, readIndividual])).toBe(3);
  });
});

// ============================================================================
// groupNotificationsWithCategoryFilter
// ============================================================================

describe('groupNotificationsWithCategoryFilter', () => {
  const notifications = [
    createNotificationWithTime(5, {
      id: 'n-1',
      type: NotificationType.NEW_APPLICATION,
      data: { jobPostingId: 'job-1', staffName: '홍길동' },
      body: '홍길동님이 지원했습니다',
    }),
    createNotificationWithTime(10, {
      id: 'n-2',
      type: NotificationType.NEW_APPLICATION,
      data: { jobPostingId: 'job-1', staffName: '김철수' },
      body: '김철수님이 지원했습니다',
    }),
    createNotificationWithTime(15, {
      id: 'n-3',
      type: NotificationType.STAFF_CHECKED_IN,
      data: { jobPostingId: 'job-1', staffName: '박영희' },
      body: '박영희님이 출근했습니다',
    }),
    createNotificationWithTime(20, {
      id: 'n-4',
      type: NotificationType.ANNOUNCEMENT,
      body: '공지사항입니다',
    }),
  ];

  it('categoryFilter가 null이면 전체 알림을 그룹핑한다', () => {
    const result = groupNotificationsWithCategoryFilter(notifications, null);
    // NEW_APPLICATION x2 -> grouped, STAFF_CHECKED_IN x1 -> individual, ANNOUNCEMENT x1 -> individual
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('categoryFilter가 "all"이면 전체 알림을 그룹핑한다', () => {
    const result = groupNotificationsWithCategoryFilter(notifications, 'all');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('application 카테고리로 필터링하면 지원 관련 알림만 그룹핑한다', () => {
    const result = groupNotificationsWithCategoryFilter(
      notifications,
      NotificationCategory.APPLICATION
    );
    // Only NEW_APPLICATION (2 items) -> should be grouped into 1
    expect(result).toHaveLength(1);
    expect(isGroupedNotification(result[0])).toBe(true);
    const grouped = result[0] as GroupedNotificationData;
    expect(grouped.type).toBe(NotificationType.NEW_APPLICATION);
  });

  it('attendance 카테고리로 필터링하면 출퇴근 관련 알림만 반환한다', () => {
    const result = groupNotificationsWithCategoryFilter(
      notifications,
      NotificationCategory.ATTENDANCE
    );
    // Only STAFF_CHECKED_IN (1 item) -> individual
    expect(result).toHaveLength(1);
    expect(isGroupedNotification(result[0])).toBe(false);
  });

  it('system 카테고리로 필터링하면 시스템 알림만 반환한다', () => {
    const result = groupNotificationsWithCategoryFilter(
      notifications,
      NotificationCategory.SYSTEM
    );
    // Only ANNOUNCEMENT (1 item) -> individual
    expect(result).toHaveLength(1);
    expect(isGroupedNotification(result[0])).toBe(false);
  });

  it('빈 배열에 카테고리 필터를 적용해도 빈 배열을 반환한다', () => {
    const result = groupNotificationsWithCategoryFilter(
      [],
      NotificationCategory.APPLICATION
    );
    expect(result).toEqual([]);
  });

  it('매칭되는 알림이 없는 카테고리로 필터링하면 빈 배열을 반환한다', () => {
    const result = groupNotificationsWithCategoryFilter(
      notifications,
      NotificationCategory.SETTLEMENT
    );
    expect(result).toEqual([]);
  });
});

// ============================================================================
// isGroupedNotification (re-exported)
// ============================================================================

describe('isGroupedNotification', () => {
  it('GroupedNotificationData를 올바르게 식별한다', () => {
    const grouped: GroupedNotificationData = {
      groupId: 'test-group',
      type: NotificationType.NEW_APPLICATION,
      context: {},
      notifications: [],
      count: 2,
      unreadCount: 1,
      latestCreatedAt: createTimestamp(new Date()),
      groupTitle: '새 지원자 2명',
      groupBody: '홍길동, 김철수',
    };
    expect(isGroupedNotification(grouped)).toBe(true);
  });

  it('일반 NotificationData를 올바르게 식별한다', () => {
    const notification = createNotification();
    expect(isGroupedNotification(notification)).toBe(false);
  });
});
