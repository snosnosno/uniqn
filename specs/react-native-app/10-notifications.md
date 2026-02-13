# 10. 알림 시스템 설계

> **구현 완료**: v1.0.0 기준 알림 시스템 전체 구현됨
> **파일 위치**: `src/services/notificationService.ts`, `src/services/pushNotificationService.ts`, `src/stores/notificationStore.ts`, `src/hooks/useNotifications*.ts`, `src/components/notifications/`
>
> 📚 **관련 문서**:
> - 📋 **구현 현황/테스트**: [NOTIFICATION_IMPLEMENTATION_STATUS.md](../../docs/features/NOTIFICATION_IMPLEMENTATION_STATUS.md) (Phase 진행도, 타임존 이슈)
> - 💼 **운영 가이드**: [NOTIFICATION_OPERATIONS.md](../../docs/operations/NOTIFICATION_OPERATIONS.md) (Functions 관리, 모니터링)
>
> 이 문서는 **모바일앱 개발자용**입니다. 클라이언트 측 구현 상세(FCM, Zustand, UI, 30개 알림 타입)에 집중합니다.

## 목차

1. [알림 시스템 개요](#1-알림-시스템-개요)
2. [알림 타입 정의](#2-알림-타입-정의)
3. [알림 데이터 구조](#3-알림-데이터-구조)
4. [FCM 푸시 알림](#4-fcm-푸시-알림)
5. [인앱 알림](#5-인앱-알림)
6. [알림 설정 관리](#6-알림-설정-관리)
7. [알림 그룹화](#7-알림-그룹화)
8. [딥링크 처리](#8-딥링크-처리)
9. [알림 UI 컴포넌트](#9-알림-ui-컴포넌트)
10. [오프라인 지원](#10-오프라인-지원)
11. [성능 최적화](#11-성능-최적화)

---

## 1. 알림 시스템 개요

### 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Notification Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                          ┌──────────────────────┐ │
│  │   Trigger    │                          │    Client App        │ │
│  │   Points     │                          │                      │ │
│  │              │                          │  ┌────────────────┐  │ │
│  │ • Apply      │    ┌─────────────┐       │  │ Expo Notif.    │  │ │
│  │ • Confirm    │───▶│  Firebase   │──────▶│  │ (FCM/APNS)     │  │ │
│  │ • Check-in   │    │  Functions  │       │  └────────────────┘  │ │
│  │ • Settle     │    │             │       │          │           │ │
│  │ • etc...     │    │  ┌───────┐  │       │          ▼           │ │
│  └──────────────┘    │  │  FCM  │  │       │  ┌────────────────┐  │ │
│                      │  └───────┘  │       │  │ useNotification│  │ │
│                      │             │       │  │ Handler        │  │ │
│  ┌──────────────┐    │  ┌───────┐  │       │  └────────────────┘  │ │
│  │  Firestore   │───▶│  │ Write │  │       │          │           │ │
│  │  Triggers    │    │  └───────┘  │       │          ▼           │ │
│  └──────────────┘    └─────────────┘       │  ┌────────────────┐  │ │
│                                            │  │ • Show Toast   │  │ │
│                                            │  │ • Update Badge │  │ │
│                                            │  │ • Navigate     │  │ │
│                                            │  │ • Store (MMKV) │  │ │
│                                            │  └────────────────┘  │ │
│                                            └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 알림 전송 경로

| 경로 | 사용 시점 | 특징 |
|------|----------|------|
| **Push (FCM)** | 앱 백그라운드/종료 시 | 시스템 알림, 뱃지 업데이트 |
| **In-App** | 앱 포그라운드 시 | 토스트, 배너, 뱃지 |
| **Realtime** | 실시간 구독 | Firestore onSnapshot |
| **Cached** | 오프라인 시 | MMKV 로컬 캐시 (최신 50개) |

### 파일 구조

```
src/
├── types/
│   └── notification.ts          # 알림 타입 정의 (30개 타입)
├── stores/
│   └── notificationStore.ts     # Zustand + MMKV 영구저장
├── services/
│   ├── notificationService.ts   # 알림 CRUD, 실시간 구독
│   └── pushNotificationService.ts # FCM 토큰, Expo Notifications
├── hooks/
│   ├── useNotifications.ts      # 알림 목록 훅
│   ├── useNotificationHandler.ts # 알림 수신/터치 처리
│   ├── useNotificationRealtime.ts # 실시간 구독
│   ├── useUnreadCountRealtime.ts # 미읽음 수 실시간
│   ├── useMarkAsRead.ts         # 읽음 처리
│   ├── useDeleteNotification.ts # 삭제 (Optimistic)
│   └── useGroupedNotifications.ts # 그룹화 + 필터링
├── components/notifications/
│   ├── NotificationList.tsx     # 알림 목록 (FlashList)
│   ├── NotificationItem.tsx     # 개별 알림 카드
│   ├── NotificationGroupItem.tsx # 그룹화된 알림
│   ├── NotificationBadge.tsx    # 미읽음 배지
│   ├── NotificationIcon.tsx     # 타입별 아이콘
│   └── NotificationSettings.tsx # 설정 UI
└── repositories/
    └── notificationRepository.ts # Firestore 접근
```

---

## 2. 알림 타입 정의

### NotificationType (30가지)

```typescript
// src/types/notification.ts
export type NotificationType =
  // === 지원 관련 (7개) ===
  | 'new_application'           // 새로운 지원자 (구인자에게)
  | 'application_cancelled'     // 지원 취소됨
  | 'application_confirmed'     // 확정됨 (스태프에게)
  | 'confirmation_cancelled'    // 확정 취소됨
  | 'application_rejected'      // 거절됨
  | 'cancellation_approved'     // 취소 요청 승인됨
  | 'cancellation_rejected'     // 취소 요청 거절됨

  // === 출퇴근/스케줄 관련 (8개) ===
  | 'staff_checked_in'          // 출근 체크인 (구인자에게)
  | 'staff_checked_out'         // 퇴근 체크아웃 (구인자에게)
  | 'check_in_confirmed'        // 출근 확인 (스태프 본인에게)
  | 'check_out_confirmed'       // 퇴근 확인 (스태프 본인에게)
  | 'checkin_reminder'          // 출근 리마인더 ⭐ urgent
  | 'no_show_alert'             // 노쇼 알림 ⭐ urgent
  | 'schedule_change'           // 근무 시간 변경
  | 'schedule_created'          // 새로운 근무 배정
  | 'schedule_cancelled'        // 근무 취소

  // === 정산 관련 (2개) ===
  | 'settlement_completed'      // 정산 완료 (스태프에게)
  | 'settlement_requested'      // 정산 요청 (구인자에게)

  // === 공고 관련 (3개) ===
  | 'job_updated'               // 공고 수정됨
  | 'job_cancelled'             // 공고 취소됨
  | 'job_closed'                // 공고 마감됨

  // === 시스템 (3개) ===
  | 'announcement'              // 공지사항
  | 'maintenance'               // 시스템 점검
  | 'app_update'                // 앱 업데이트

  // === 관리자 (5개) ===
  | 'inquiry_answered'          // 문의 답변 완료
  | 'report_resolved'           // 신고 처리 완료
  | 'new_report'                // 새로운 신고 접수
  | 'new_inquiry'               // 새로운 문의 접수
  | 'tournament_approval_request'; // 대회공고 승인 요청
```

### 알림 카테고리

```typescript
export type NotificationCategory =
  | 'applications'   // 지원 관련
  | 'schedule'       // 출퇴근/스케줄
  | 'settlement'     // 정산
  | 'jobs'           // 공고
  | 'system'         // 시스템
  | 'admin';         // 관리자

// 타입 → 카테고리 매핑
export const NOTIFICATION_CATEGORY_MAP: Record<NotificationType, NotificationCategory> = {
  new_application: 'applications',
  application_cancelled: 'applications',
  application_confirmed: 'applications',
  // ... 모든 타입 매핑
  announcement: 'system',
  maintenance: 'system',
  app_update: 'system',
};
```

### 우선순위 매핑

```typescript
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

export const NOTIFICATION_PRIORITY_MAP: Record<NotificationType, NotificationPriority> = {
  // urgent: 즉시 알림 필요
  checkin_reminder: 'urgent',
  no_show_alert: 'urgent',

  // high: 중요한 알림
  new_application: 'high',
  application_confirmed: 'high',
  confirmation_cancelled: 'high',
  cancellation_rejected: 'high',
  schedule_change: 'high',
  schedule_created: 'high',
  schedule_cancelled: 'high',
  settlement_completed: 'high',
  job_cancelled: 'high',
  maintenance: 'high',
  new_report: 'high',
  tournament_approval_request: 'high',

  // normal: 일반 알림
  application_cancelled: 'normal',
  application_rejected: 'normal',
  cancellation_approved: 'normal',
  staff_checked_in: 'normal',
  staff_checked_out: 'normal',
  check_in_confirmed: 'normal',
  check_out_confirmed: 'normal',
  settlement_requested: 'normal',
  job_closed: 'normal',
  announcement: 'normal',
  inquiry_answered: 'normal',
  report_resolved: 'normal',
  new_inquiry: 'normal',

  // low: 낮은 우선순위
  job_updated: 'low',
  app_update: 'low',
};
```

### Android 알림 채널 매핑

```typescript
export const ANDROID_CHANNEL_MAP: Record<NotificationCategory, string> = {
  applications: 'applications',  // HIGH 중요도
  schedule: 'reminders',         // HIGH 중요도
  settlement: 'settlement',      // DEFAULT 중요도
  jobs: 'default',               // DEFAULT 중요도
  system: 'announcements',       // LOW 중요도
  admin: 'default',              // DEFAULT 중요도
};
```

---

## 3. 알림 데이터 구조

### NotificationData 인터페이스

```typescript
// src/types/notification.ts
export interface NotificationData extends FirebaseDocument {
  /** 수신자 ID */
  recipientId: string;
  /** 알림 타입 */
  type: NotificationType;
  /** 카테고리 (type에서 자동 계산) */
  category?: NotificationCategory;
  /** 제목 */
  title: string;
  /** 본문 */
  body: string;
  /** 딥링크 경로 */
  link?: string;
  /** 추가 데이터 */
  data?: Record<string, string>;
  /** 읽음 여부 */
  isRead: boolean;
  /** 우선순위 */
  priority?: NotificationPriority;
  /** 생성 시간 */
  createdAt: Timestamp;
  /** 읽은 시간 */
  readAt?: Timestamp;
}
```

### NotificationSettings (사용자 설정)

```typescript
export interface NotificationSettings {
  /** 전체 알림 활성화 */
  enabled: boolean;
  /** 전체 푸시 알림 활성화 */
  pushEnabled?: boolean;
  /** 카테고리별 설정 */
  categories: {
    [category in NotificationCategory]: {
      enabled: boolean;      // 카테고리 알림 활성화
      pushEnabled: boolean;  // 카테고리 푸시 활성화
    };
  };
  /** 방해 금지 시간 */
  quietHours?: {
    enabled: boolean;
    start: string;  // "22:00"
    end: string;    // "08:00"
  };
  /** 알림 그룹화 설정 */
  grouping?: {
    enabled: boolean;        // 기본: true
    minGroupSize: number;    // 기본: 2
    timeWindowHours: number; // 기본: 24
  };
  updatedAt?: Timestamp;
}

// 기본 설정
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  pushEnabled: true,
  categories: {
    applications: { enabled: true, pushEnabled: true },
    schedule: { enabled: true, pushEnabled: true },
    settlement: { enabled: true, pushEnabled: true },
    jobs: { enabled: true, pushEnabled: true },
    system: { enabled: true, pushEnabled: false },
    admin: { enabled: true, pushEnabled: true },
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
  grouping: {
    enabled: true,
    minGroupSize: 2,
    timeWindowHours: 24,
  },
};
```

### Firestore 저장 구조

```
notifications/{notificationId}
├── recipientId: string
├── type: NotificationType
├── title: string
├── body: string
├── link?: string
├── data?: Record<string, string>
├── isRead: boolean
├── priority?: NotificationPriority
├── createdAt: Timestamp
└── readAt?: Timestamp

users/{userId}
├── fcmTokens: string[]  // arrayUnion으로 중복 방지
└── notificationSettings/default
    ├── enabled: boolean
    ├── pushEnabled: boolean
    ├── categories: {...}
    ├── quietHours: {...}
    └── grouping: {...}
```

---

## 4. FCM 푸시 알림

### 토큰 관리 흐름

```
┌─────────────────────────────────────────────────────────┐
│ pushNotificationService.initialize()                     │
│  - Expo Notifications 동적 로드                           │
│  - Android 채널 설정 (5개)                               │
│  - 알림 핸들러 등록 (포그라운드/백그라운드)               │
│  - AppState 리스너 설정                                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ pushNotificationService.getToken()                       │
│  - 권한 확인                                              │
│  - 개발: Expo Push Token (getExpoPushTokenAsync)         │
│  - 프로덕션: FCM Token (getDevicePushTokenAsync)        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ registerFCMToken(userId, token)                          │
│ → notificationRepository.registerFCMToken()             │
│ → Firestore users/{userId}/fcmTokens [arrayUnion]       │
└─────────────────────────────────────────────────────────┘
```

### pushNotificationService 구현

```typescript
// src/services/pushNotificationService.ts
class PushNotificationService {
  private notificationsModule: typeof Notifications | null = null;
  private isInitialized = false;
  private tokenRefreshInterval = 12 * 60 * 60 * 1000; // 12시간

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Expo Notifications 동적 로드
      this.notificationsModule = await import('expo-notifications');

      // Android 채널 생성
      if (Platform.OS === 'android') {
        await this.createNotificationChannels();
      }

      // 포그라운드 알림 핸들러
      this.notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      this.isInitialized = true;
      logger.info('[PushNotificationService] 초기화 완료');
    } catch (error) {
      logger.error('[PushNotificationService] 초기화 실패', error);
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.notificationsModule) return null;

    // 권한 확인
    const { status } = await this.notificationsModule.getPermissionsAsync();
    if (status !== 'granted') return null;

    try {
      // 개발 환경: Expo Push Token
      if (__DEV__) {
        const { data } = await this.notificationsModule.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        return data;
      }

      // 프로덕션: FCM Token (Android) / APNS Token (iOS)
      const { data } = await this.notificationsModule.getDevicePushTokenAsync();
      return data;
    } catch (error) {
      logger.error('[PushNotificationService] 토큰 발급 실패', error);
      return null;
    }
  }

  async registerToken(userId: string): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    await notificationRepository.registerFCMToken(userId, token);
    logger.info('[PushNotificationService] 토큰 등록 완료');
    return true;
  }

  async unregisterToken(userId: string): Promise<void> {
    const token = await this.getToken();
    if (token) {
      await notificationRepository.unregisterFCMToken(userId, token);
    }
    logger.info('[PushNotificationService] 토큰 해제 완료');
  }

  async requestPermission(): Promise<boolean> {
    if (!this.notificationsModule) return false;

    const { status } = await this.notificationsModule.requestPermissionsAsync();
    return status === 'granted';
  }

  private async createNotificationChannels(): Promise<void> {
    const channels = [
      { id: 'applications', name: '지원/확정 알림', importance: AndroidImportance.HIGH },
      { id: 'reminders', name: '출근 리마인더', importance: AndroidImportance.HIGH },
      { id: 'settlement', name: '정산 알림', importance: AndroidImportance.DEFAULT },
      { id: 'announcements', name: '공지사항', importance: AndroidImportance.LOW },
      { id: 'default', name: '일반 알림', importance: AndroidImportance.DEFAULT },
    ];

    for (const channel of channels) {
      await this.notificationsModule!.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F46E5',
      });
    }
  }

  setNotificationReceivedHandler(
    handler: (notification: Notification) => void
  ): () => void {
    if (!this.notificationsModule) return () => {};

    const subscription = this.notificationsModule.addNotificationReceivedListener(handler);
    return () => subscription.remove();
  }

  setNotificationResponseHandler(
    handler: (notification: Notification, actionId?: string) => void
  ): () => void {
    if (!this.notificationsModule) return () => {};

    const subscription = this.notificationsModule.addNotificationResponseReceivedListener(
      (response) => handler(response.notification, response.actionIdentifier)
    );
    return () => subscription.remove();
  }

  async setBadge(count: number): Promise<void> {
    await this.notificationsModule?.setBadgeCountAsync(count);
  }

  async clearBadge(): Promise<void> {
    await this.setBadge(0);
  }
}

export const pushNotificationService = new PushNotificationService();
```

### useNotificationHandler 훅

```typescript
// src/hooks/useNotificationHandler.ts
interface UseNotificationHandlerOptions {
  showForegroundToast?: boolean;
  onNotificationReceived?: (notification: NotificationData) => void;
  onNotificationTapped?: (notification: NotificationData, actionId?: string) => void;
  autoInitialize?: boolean;
  autoRegisterToken?: boolean;
}

export function useNotificationHandler(options: UseNotificationHandlerOptions = {}) {
  const {
    showForegroundToast = true,
    onNotificationReceived,
    onNotificationTapped,
    autoInitialize = true,
    autoRegisterToken = true,
  } = options;

  const { user } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [isTokenRegistered, setIsTokenRegistered] = useState(false);

  // 초기화
  useEffect(() => {
    if (autoInitialize) {
      pushNotificationService.initialize().then(() => {
        setIsInitialized(true);
      });
    }
  }, [autoInitialize]);

  // 토큰 자동 등록
  useEffect(() => {
    if (autoRegisterToken && user && isInitialized && permissionStatus === 'granted') {
      pushNotificationService.registerToken(user.uid).then((success) => {
        setIsTokenRegistered(success);
      });
    }
  }, [user, isInitialized, permissionStatus, autoRegisterToken]);

  // 포그라운드 알림 수신 핸들러
  useEffect(() => {
    const unsubscribe = pushNotificationService.setNotificationReceivedHandler(
      (notification) => {
        const data = notification.request.content.data as NotificationData;

        if (showForegroundToast) {
          toast.info(notification.request.content.body || '');
        }

        onNotificationReceived?.(data);
      }
    );

    return unsubscribe;
  }, [showForegroundToast, onNotificationReceived]);

  // 알림 터치 핸들러
  useEffect(() => {
    const unsubscribe = pushNotificationService.setNotificationResponseHandler(
      (notification, actionId) => {
        const data = notification.request.content.data as NotificationData;

        // Analytics 이벤트
        analyticsService.trackEvent('notification_tapped', {
          notification_type: data.type,
          action: actionId,
        });

        // 딥링크 네비게이션
        if (data.link) {
          deepLinkService.handleNotificationNavigation(data.type, data.data, data.link);
        }

        onNotificationTapped?.(data, actionId);
      }
    );

    return unsubscribe;
  }, [onNotificationTapped]);

  return {
    isInitialized,
    permissionStatus,
    isTokenRegistered,
    requestPermission: async () => {
      const granted = await pushNotificationService.requestPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      return granted;
    },
    registerToken: () => pushNotificationService.registerToken(user!.uid),
    unregisterToken: () => pushNotificationService.unregisterToken(user!.uid),
    setBadge: pushNotificationService.setBadge,
    clearBadge: pushNotificationService.clearBadge,
    openSettings: Linking.openSettings,
  };
}
```

---

## 5. 인앱 알림

### notificationStore (Zustand + MMKV)

```typescript
// src/stores/notificationStore.ts
interface NotificationState {
  // 데이터
  notifications: NotificationData[];
  unreadCount: number;
  unreadByCategory: Record<NotificationCategory, number>;
  settings: NotificationSettings;
  filter: NotificationFilter;

  // 상태
  isLoading: boolean;
  hasMore: boolean;
  lastFetchedAt: number | null;

  // 액션
  setNotifications: (notifications: NotificationData[]) => void;
  addNotification: (notification: NotificationData) => void;
  updateNotification: (id: string, updates: Partial<NotificationData>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  markCategoryAsRead: (category: NotificationCategory) => void;
  setSettings: (settings: NotificationSettings) => void;
  updateCategorySetting: (
    category: NotificationCategory,
    updates: Partial<CategorySetting>
  ) => void;
  toggleNotifications: (enabled: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      unreadByCategory: {
        applications: 0,
        schedule: 0,
        settlement: 0,
        jobs: 0,
        system: 0,
        admin: 0,
      },
      settings: DEFAULT_NOTIFICATION_SETTINGS,
      filter: { category: null },
      isLoading: false,
      hasMore: true,
      lastFetchedAt: null,

      setNotifications: (notifications) => {
        const unreadByCategory = calculateUnreadByCategory(notifications);
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.isRead).length,
          unreadByCategory,
          lastFetchedAt: Date.now(),
        });
      },

      addNotification: (notification) => {
        set((state) => {
          const exists = state.notifications.some((n) => n.id === notification.id);
          if (exists) return state;

          const category = NOTIFICATION_CATEGORY_MAP[notification.type];
          const isUnread = !notification.isRead;

          return {
            notifications: [notification, ...state.notifications].slice(0, 100),
            unreadCount: state.unreadCount + (isUnread ? 1 : 0),
            unreadByCategory: isUnread
              ? { ...state.unreadByCategory, [category]: state.unreadByCategory[category] + 1 }
              : state.unreadByCategory,
          };
        });
      },

      markAsRead: (notificationId) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === notificationId);
          if (!notification || notification.isRead) return state;

          const category = NOTIFICATION_CATEGORY_MAP[notification.type];

          return {
            notifications: state.notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true, readAt: Timestamp.now() } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
            unreadByCategory: {
              ...state.unreadByCategory,
              [category]: Math.max(0, state.unreadByCategory[category] - 1),
            },
          };
        });

        // Firestore 업데이트
        notificationService.markAsRead(notificationId);
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            isRead: true,
            readAt: n.readAt || Timestamp.now(),
          })),
          unreadCount: 0,
          unreadByCategory: {
            applications: 0,
            schedule: 0,
            settlement: 0,
            jobs: 0,
            system: 0,
            admin: 0,
          },
        }));

        // Firestore 배치 업데이트
        notificationService.markAllAsRead(get().notifications.filter((n) => !n.isRead));
      },

      // ... 기타 액션
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        settings: state.settings,
        lastFetchedAt: state.lastFetchedAt,
        // 최신 50개만 캐싱
        cachedNotifications: state.notifications.slice(0, 50),
      }),
    }
  )
);

// Selector (UI 리렌더링 최소화)
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectUnreadByCategory = (state: NotificationState) => state.unreadByCategory;
export const selectSettings = (state: NotificationState) => state.settings;
```

### 실시간 알림 구독

```typescript
// src/hooks/useNotificationRealtime.ts
export function useNotificationRealtime() {
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!user) return;

    // RealtimeManager로 중복 구독 방지
    const unsubscribe = RealtimeManager.subscribe(
      RealtimeManager.Keys.notifications(user.uid),
      () => {
        const q = query(
          collection(db, 'notifications'),
          where('recipientId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(50)
        );

        return onSnapshot(
          q,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const notification = docToNotification(change.doc);
                addNotification(notification);
              }
            });
          },
          (error) => {
            logger.error('[useNotificationRealtime] 구독 에러', error);
          }
        );
      }
    );

    return () => {
      RealtimeManager.unsubscribe(RealtimeManager.Keys.notifications(user.uid));
    };
  }, [user?.uid]);
}
```

### 미읽음 수 실시간 구독

```typescript
// src/hooks/useUnreadCountRealtime.ts
export function useUnreadCountRealtime() {
  const { user } = useAuthStore();
  const setBadge = pushNotificationService.setBadge;

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      where('isRead', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      useNotificationStore.setState({ unreadCount: count });
      setBadge(count);
    });

    return () => unsubscribe();
  }, [user?.uid]);
}
```

---

## 6. 알림 설정 관리

### 설정 저장/조회

```typescript
// src/services/notificationService.ts
export const notificationService = {
  async getSettings(userId: string): Promise<NotificationSettings> {
    const doc = await getDoc(
      doc(db, 'users', userId, 'notificationSettings', 'default')
    );

    if (!doc.exists()) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...doc.data(),
    };
  },

  async saveSettings(
    userId: string,
    settings: Partial<NotificationSettings>
  ): Promise<void> {
    await setDoc(
      doc(db, 'users', userId, 'notificationSettings', 'default'),
      {
        ...settings,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};
```

### 설정 훅

```typescript
// src/hooks/useNotificationSettings.ts
export function useNotificationSettingsQuery() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.notifications.settings(),
    queryFn: () => notificationService.getSettings(user!.uid),
    enabled: !!user,
    staleTime: cachingPolicies.stable, // 30분
  });
}

export function useSaveNotificationSettings() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { setSettings } = useNotificationStore();

  return useMutation({
    mutationFn: (settings: Partial<NotificationSettings>) =>
      notificationService.saveSettings(user!.uid, settings),
    onMutate: async (newSettings) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.settings() });
      const previous = queryClient.getQueryData(queryKeys.notifications.settings());

      queryClient.setQueryData(
        queryKeys.notifications.settings(),
        (old: NotificationSettings) => ({ ...old, ...newSettings })
      );

      setSettings({ ...useNotificationStore.getState().settings, ...newSettings });

      return { previous };
    },
    onError: (err, newSettings, context) => {
      queryClient.setQueryData(queryKeys.notifications.settings(), context?.previous);
    },
  });
}
```

---

## 7. 알림 그룹화

### 그룹화 가능한 타입

```typescript
// 같은 컨텍스트로 묶을 수 있는 알림 타입
export const GROUPABLE_NOTIFICATION_TYPES: NotificationType[] = [
  'new_application',        // 같은 공고의 여러 지원자
  'application_cancelled',  // 취소된 지원
  'staff_checked_in',       // 같은 이벤트에서 여러 출근
  'staff_checked_out',      // 같은 이벤트에서 여러 퇴근
  'no_show_alert',          // 같은 이벤트의 노쇼
];
```

### GroupedNotificationData

```typescript
export interface GroupedNotificationData {
  groupId: string;                    // type + jobPostingId
  type: NotificationType;
  context: {
    jobPostingId?: string;
    jobTitle?: string;
  };
  notifications: NotificationData[];  // 최신순 정렬
  count: number;                      // "새 지원자 5명"
  unreadCount: number;
  latestCreatedAt: Timestamp;         // 정렬용
  groupTitle: string;                 // "새 지원자 5명"
  groupBody: string;                  // 최근 지원자 이름
}
```

### useGroupedNotifications 훅

```typescript
// src/hooks/useGroupedNotifications.ts
export function useGroupedNotifications() {
  const { notifications, settings, filter } = useNotificationStore();

  const grouped = useMemo(() => {
    if (!settings.grouping?.enabled) {
      return notifications.map((n) => ({ type: 'single', notification: n }));
    }

    const groups = new Map<string, GroupedNotificationData>();
    const singles: NotificationData[] = [];

    for (const notification of notifications) {
      // 필터 적용
      if (filter.category && NOTIFICATION_CATEGORY_MAP[notification.type] !== filter.category) {
        continue;
      }

      // 그룹화 가능 여부 확인
      if (!GROUPABLE_NOTIFICATION_TYPES.includes(notification.type)) {
        singles.push(notification);
        continue;
      }

      const groupKey = `${notification.type}_${notification.data?.jobPostingId || 'unknown'}`;
      const existing = groups.get(groupKey);

      if (existing) {
        existing.notifications.push(notification);
        existing.count++;
        if (!notification.isRead) existing.unreadCount++;
        if (notification.createdAt > existing.latestCreatedAt) {
          existing.latestCreatedAt = notification.createdAt;
        }
      } else {
        groups.set(groupKey, {
          groupId: groupKey,
          type: notification.type,
          context: {
            jobPostingId: notification.data?.jobPostingId,
            jobTitle: notification.data?.jobTitle,
          },
          notifications: [notification],
          count: 1,
          unreadCount: notification.isRead ? 0 : 1,
          latestCreatedAt: notification.createdAt,
          groupTitle: getGroupTitle(notification.type, 1),
          groupBody: notification.body,
        });
      }
    }

    // 그룹 완성 (최소 그룹 크기 적용)
    const minSize = settings.grouping?.minGroupSize || 2;
    const result: (GroupedNotificationData | NotificationData)[] = [];

    for (const group of groups.values()) {
      if (group.count >= minSize) {
        group.groupTitle = getGroupTitle(group.type, group.count);
        group.notifications.sort((a, b) =>
          b.createdAt.toMillis() - a.createdAt.toMillis()
        );
        result.push(group);
      } else {
        singles.push(...group.notifications);
      }
    }

    // 단일 알림 추가
    result.push(...singles);

    // 시간순 정렬
    return result.sort((a, b) => {
      const timeA = 'latestCreatedAt' in a ? a.latestCreatedAt : a.createdAt;
      const timeB = 'latestCreatedAt' in b ? b.latestCreatedAt : b.createdAt;
      return timeB.toMillis() - timeA.toMillis();
    });
  }, [notifications, settings.grouping, filter]);

  return grouped;
}

function getGroupTitle(type: NotificationType, count: number): string {
  const titles: Record<NotificationType, (count: number) => string> = {
    new_application: (c) => `새 지원자 ${c}명`,
    application_cancelled: (c) => `지원 취소 ${c}건`,
    staff_checked_in: (c) => `출근 ${c}명`,
    staff_checked_out: (c) => `퇴근 ${c}명`,
    no_show_alert: (c) => `노쇼 ${c}건`,
    // ... 기타 타입
  };

  return titles[type]?.(count) || `알림 ${count}건`;
}
```

---

## 8. 딥링크 처리

### 알림 타입별 딥링크 매핑

```typescript
// src/services/deepLinkService.ts
const NOTIFICATION_LINK_MAP: Record<NotificationType, (data: Record<string, string>) => string> = {
  // 지원 관련
  new_application: (d) => `/(employer)/my-postings/${d.jobPostingId}/applicants`,
  application_confirmed: (d) => `/(app)/schedule/${d.scheduleId || ''}`,
  application_rejected: (d) => `/(app)/(tabs)/index`,
  confirmation_cancelled: (d) => `/(app)/schedule`,

  // 출퇴근
  staff_checked_in: (d) => `/(employer)/my-postings/${d.jobPostingId}/attendance`,
  staff_checked_out: (d) => `/(employer)/my-postings/${d.jobPostingId}/settlements`,
  check_in_confirmed: (d) => `/(app)/schedule/${d.scheduleId || ''}`,
  check_out_confirmed: (d) => `/(app)/schedule/${d.scheduleId || ''}`,
  checkin_reminder: (d) => `/(app)/schedule?date=${d.workDate}`,
  no_show_alert: (d) => `/(employer)/my-postings/${d.jobPostingId}/attendance`,
  schedule_change: (d) => `/(app)/schedule?date=${d.workDate}`,

  // 정산
  settlement_completed: (d) => `/(app)/profile?tab=earnings`,
  settlement_requested: (d) => `/(employer)/my-postings/${d.jobPostingId}/settlements`,

  // 공고
  job_updated: (d) => `/(app)/jobs/${d.jobPostingId}`,
  job_cancelled: (d) => `/(app)/(tabs)/index`,
  job_closed: (d) => `/(app)/jobs/${d.jobPostingId}`,

  // 시스템
  announcement: (d) => `/(app)/notices/${d.announcementId}`,
  maintenance: () => `/(app)/notices`,
  app_update: () => `/(app)/settings`,

  // 관리자
  inquiry_answered: (d) => `/(app)/support/inquiries/${d.inquiryId}`,
  report_resolved: (d) => `/(app)/support/reports/${d.reportId}`,
  new_report: (d) => `/(admin)/reports/${d.reportId}`,
  new_inquiry: (d) => `/(admin)/inquiries/${d.inquiryId}`,
  tournament_approval_request: (d) => `/(admin)/tournaments/${d.jobPostingId}`,
};

export const deepLinkService = {
  handleNotificationNavigation(
    type: NotificationType,
    data?: Record<string, string>,
    link?: string
  ): void {
    // 명시적 link가 있으면 우선 사용
    if (link) {
      router.push(link);
      return;
    }

    // 타입별 기본 링크 사용
    const linkFn = NOTIFICATION_LINK_MAP[type];
    if (linkFn && data) {
      router.push(linkFn(data));
    }
  },
};
```

---

## 9. 알림 UI 컴포넌트

### NotificationList

```typescript
// src/components/notifications/NotificationList.tsx
interface NotificationListProps {
  onNotificationPress?: (notification: NotificationData) => void;
}

export function NotificationList({ onNotificationPress }: NotificationListProps) {
  const grouped = useGroupedNotifications();
  const { isLoading, hasMore, loadMore, refresh } = useNotificationList();

  const renderItem = useCallback(
    ({ item }: { item: GroupedNotificationData | NotificationData }) => {
      if ('notifications' in item) {
        return (
          <NotificationGroupItem
            group={item}
            onPress={() => onNotificationPress?.(item.notifications[0])}
          />
        );
      }
      return (
        <NotificationItem
          notification={item}
          onPress={() => onNotificationPress?.(item)}
        />
      );
    },
    [onNotificationPress]
  );

  return (
    <FlashList
      data={grouped}
      renderItem={renderItem}
      estimatedItemSize={80}
      onEndReached={hasMore ? loadMore : undefined}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refresh} />
      }
      ListEmptyComponent={<EmptyNotifications />}
    />
  );
}
```

### NotificationItem

```typescript
// src/components/notifications/NotificationItem.tsx
interface NotificationItemProps {
  notification: NotificationData;
  onPress: () => void;
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const { markAsRead } = useNotificationStore();

  const handlePress = () => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      className={`
        px-4 py-3 border-b border-gray-100 dark:border-gray-800
        ${notification.isRead
          ? 'bg-white dark:bg-gray-900'
          : 'bg-purple-50 dark:bg-purple-900/20'}
      `}
    >
      <View className="flex-row items-start gap-3">
        {/* 읽음 표시 */}
        {!notification.isRead && (
          <View className="w-2 h-2 rounded-full bg-purple-600 mt-2" />
        )}

        {/* 아이콘 */}
        <NotificationIcon type={notification.type} />

        {/* 내용 */}
        <View className="flex-1">
          <Text
            className={`
              text-base
              ${notification.isRead
                ? 'text-gray-700 dark:text-gray-300'
                : 'text-gray-900 dark:text-white font-medium'}
            `}
          >
            {notification.title}
          </Text>
          <Text
            className="text-sm text-gray-500 dark:text-gray-400 mt-0.5"
            numberOfLines={2}
          >
            {notification.body}
          </Text>
          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {formatRelativeTime(notification.createdAt.toDate())}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
```

### NotificationBadge

```typescript
// src/components/notifications/NotificationBadge.tsx
interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  inline?: boolean;
}

export function NotificationBadge({
  count,
  maxCount = 99,
  inline = false,
}: NotificationBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : String(count);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      className={`
        bg-red-500 rounded-full items-center justify-center
        ${inline
          ? 'min-w-[20px] h-[20px] px-1.5 ml-2'
          : 'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1'}
      `}
    >
      <Text className="text-white text-xs font-bold">{displayCount}</Text>
    </Animated.View>
  );
}
```

### NotificationSettings

```typescript
// src/components/notifications/NotificationSettings.tsx
export function NotificationSettings() {
  const { data: settings, isLoading } = useNotificationSettingsQuery();
  const { mutate: saveSettings } = useSaveNotificationSettings();

  if (isLoading || !settings) return <LoadingSpinner />;

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* 전체 알림 */}
      <SettingSection title="알림">
        <SettingRow
          title="알림 받기"
          description="모든 알림을 켜거나 끕니다"
          value={settings.enabled}
          onToggle={(enabled) => saveSettings({ enabled })}
        />
        <SettingRow
          title="푸시 알림"
          description="백그라운드 푸시 알림"
          value={settings.pushEnabled ?? true}
          onToggle={(pushEnabled) => saveSettings({ pushEnabled })}
          disabled={!settings.enabled}
        />
      </SettingSection>

      {/* 카테고리별 설정 */}
      <SettingSection title="알림 종류">
        {Object.entries(settings.categories).map(([category, setting]) => (
          <SettingRow
            key={category}
            title={CATEGORY_LABELS[category as NotificationCategory]}
            value={setting.enabled}
            onToggle={(enabled) =>
              saveSettings({
                categories: {
                  ...settings.categories,
                  [category]: { ...setting, enabled },
                },
              })
            }
            disabled={!settings.enabled}
          />
        ))}
      </SettingSection>

      {/* 방해금지 시간 */}
      <SettingSection title="방해금지 시간">
        <SettingRow
          title="방해금지 모드"
          description={
            settings.quietHours?.enabled
              ? `${settings.quietHours.start} ~ ${settings.quietHours.end}`
              : '사용 안함'
          }
          value={settings.quietHours?.enabled ?? false}
          onToggle={(enabled) =>
            saveSettings({ quietHours: { ...settings.quietHours!, enabled } })
          }
          disabled={!settings.enabled}
        />
      </SettingSection>

      {/* 그룹화 설정 */}
      <SettingSection title="그룹화">
        <SettingRow
          title="알림 그룹화"
          description="같은 유형의 알림을 묶어서 표시"
          value={settings.grouping?.enabled ?? true}
          onToggle={(enabled) =>
            saveSettings({ grouping: { ...settings.grouping!, enabled } })
          }
        />
      </SettingSection>
    </ScrollView>
  );
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  applications: '지원/확정 알림',
  schedule: '출퇴근/스케줄 알림',
  settlement: '정산 알림',
  jobs: '공고 알림',
  system: '공지사항',
  admin: '관리자 알림',
};
```

---

## 10. 오프라인 지원

### MMKV 캐싱

```typescript
// notificationStore의 persist 설정
persist(
  (set, get) => ({ /* ... */ }),
  {
    name: 'notification-storage',
    storage: createJSONStorage(() => mmkvStorage),
    partialize: (state) => ({
      settings: state.settings,              // 설정 영구 저장
      lastFetchedAt: state.lastFetchedAt,   // 동기화 시점
      cachedNotifications: state.notifications.slice(0, 50), // 최신 50개만
    }),
  }
)
```

### 오프라인 모드 훅

```typescript
// src/hooks/useNotificationList.ts
export function useNotificationList() {
  const { isConnected } = useNetworkStatus();
  const { notifications, lastFetchedAt, setNotifications } = useNotificationStore();

  const query = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => notificationService.fetchNotifications(),
    enabled: isConnected,
    staleTime: cachingPolicies.frequent, // 2분
  });

  // 오프라인 시 캐시 사용
  useEffect(() => {
    if (!isConnected && notifications.length > 0) {
      return; // 캐시된 데이터 유지
    }

    if (query.data) {
      setNotifications(query.data);
    }
  }, [isConnected, query.data]);

  // 온라인 복귀 시 동기화
  useEffect(() => {
    if (isConnected && lastFetchedAt) {
      const shouldSync = Date.now() - lastFetchedAt > 5 * 60 * 1000; // 5분 이상 경과
      if (shouldSync) {
        syncMissedNotifications(lastFetchedAt);
      }
    }
  }, [isConnected, lastFetchedAt]);

  return {
    notifications: query.data || notifications,
    isLoading: query.isLoading,
    isOffline: !isConnected,
    refresh: query.refetch,
  };
}
```

---

## 11. 성능 최적화

### 최적화 전략

| 최적화 | 구현 | 효과 |
|--------|------|------|
| **증분 카운팅** | addNotification 시 O(1) 업데이트 | 전체 재계산 방지 |
| **MMKV 캐싱** | 최신 50개 알림 로컬 저장 | 오프라인 지원, 빠른 초기 로드 |
| **Selector 구독** | selectUnreadCount 등 분리 | UI 리렌더링 최소화 |
| **FlashList** | FlatList 대신 사용 | 1000+ 항목도 60fps |
| **Reanimated** | 애니메이션 네이티브 스레드 | 메인 스레드 부하 감소 |
| **Query 캐싱** | staleTime 정책 적용 | 불필요한 API 호출 감소 |
| **RealtimeManager** | 중복 구독 방지 | 메모리 누수 방지 |
| **Optimistic Update** | 삭제/읽음 처리 시 즉시 반영 | 체감 속도 향상 |

### Query Keys 중앙 관리

```typescript
// src/lib/queryClient.ts
export const queryKeys = {
  notifications: {
    all: ['notifications'],
    list: (filter?: NotificationFilter) => ['notifications', 'list', filter],
    lists: ['notifications', 'lists'],
    unread: ['notifications', 'unread'],
    unreadCount: ['notifications', 'unreadCount'],
    settings: () => ['notifications', 'settings'],
    detail: (id: string) => ['notifications', 'detail', id],
  },
};

// 캐싱 정책
export const cachingPolicies = {
  realtime: 0,              // 항상 fresh (unreadCount)
  frequent: 2 * 60 * 1000,  // 2분 (알림 목록)
  standard: 5 * 60 * 1000,  // 5분 (기본)
  stable: 30 * 60 * 1000,   // 30분 (설정)
  offlineFirst: Infinity,   // 무제한
};
```

---

## 요약

### 알림 체크리스트

- [x] 30가지 알림 타입 정의
- [x] 6개 카테고리 분류 (applications, schedule, settlement, jobs, system, admin)
- [x] 4단계 우선순위 (urgent, high, normal, low)
- [x] FCM 푸시 알림 (Expo Notifications)
- [x] 실시간 알림 구독 (Firestore + RealtimeManager)
- [x] 알림 설정 관리 (카테고리별, 푸시별)
- [x] 알림 그룹화 (같은 타입 + 컨텍스트)
- [x] 딥링크 통합 (타입별 네비게이션)
- [x] 오프라인 지원 (MMKV 캐시)
- [x] 성능 최적화 (증분 카운팅, Selector, FlashList)

### 트리거 포인트 요약

| 이벤트 | 수신자 | 알림 타입 | 우선순위 |
|--------|--------|-----------|----------|
| 지원 생성 | 구인자 | new_application | high |
| 확정 | 스태프 | application_confirmed | high |
| 거절 | 스태프 | application_rejected | normal |
| 확정 취소 | 스태프 | confirmation_cancelled | high |
| D-1 / 30분 전 | 스태프 | checkin_reminder | **urgent** |
| 출근 체크인 | 구인자 | staff_checked_in | normal |
| 노쇼 (+30분) | 구인자 | no_show_alert | **urgent** |
| 퇴근 체크아웃 | 구인자 | staff_checked_out | normal |
| 시간 변경 | 스태프 | schedule_change | high |
| 정산 완료 | 스태프 | settlement_completed | high |
| 공지사항 | 전체 | announcement | normal |
| 대회공고 승인 요청 | 관리자 | tournament_approval_request | high |

### 출시 전 TODO

```yaml
EAS Build 필요:
  - app.config.ts에서 expo-notifications 플러그인 활성화
  - Firebase 설정 파일 추가:
    - Android: google-services.json
    - iOS: GoogleService-Info.plist
  - EAS Build 실행: eas build --platform all
  - 실제 디바이스 테스트

알림 그룹핑 (P2):
  - Android Notification Channels로 그룹핑 구현
```
