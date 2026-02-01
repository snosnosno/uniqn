# 17. Deep Linking

## 개요

앱 외부에서 특정 화면으로 직접 이동할 수 있는 딥링크 시스템입니다.
Custom URL Scheme을 지원하며, Universal Links (iOS), App Links (Android)는 도메인 설정 후 활성화 예정입니다.

### 현재 구현 상태 (v2.0)

| 항목 | 상태 | 설명 |
|------|------|------|
| **Custom Scheme** | ✅ 활성 | `uniqn://` |
| **Universal Links** | 🔲 예정 | `https://uniqn.app` (도메인 설정 후) |
| **App Links** | 🔲 예정 | `https://uniqn.app` (도메인 설정 후) |
| **알림 딥링크** | ✅ 활성 | 29개 알림 타입 전체 매핑 |

### 아키텍처 (v2.0)

```
┌─────────────────────────────────────────────────────────────┐
│  Hook Layer                                                  │
│  ├─ useNotificationHandler (푸시 알림 + 딥링크 통합)         │
│  └─ useDeepLink (프로그래매틱 네비게이션)                    │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                               │
│  └─ deepLinkService.ts (v2.0)                               │
│      ├─ parseDeepLink(): URL 파싱                           │
│      ├─ navigateToDeepLink(): 딥링크 네비게이션             │
│      ├─ navigateFromNotification(): 알림 네비게이션         │
│      └─ setupDeepLinkListener(): 리스너 등록                │
├─────────────────────────────────────────────────────────────┤
│  Shared Layer (SSOT)                                        │
│  └─ @/shared/deeplink/                                      │
│      ├─ RouteRegistry.ts: Expo Router 경로 정의             │
│      ├─ RouteMapper.ts: 라우트 ↔ Expo 경로 변환            │
│      └─ NotificationRouteMap.ts: 29개 알림 타입 매핑        │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 기본 설정

### app.json 설정

```json
{
  "expo": {
    "name": "UNIQN",
    "slug": "uniqn",
    "version": "1.0.0",
    "scheme": "uniqn",
    "ios": {
      "bundleIdentifier": "com.uniqn.mobile",
      "supportsTablet": true,
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "package": "com.uniqn.mobile",
      "googleServicesFile": "./google-services.json",
      "edgeToEdgeEnabled": true
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-notifications", { "color": "#A855F7", "defaultChannel": "default" }]
    ]
  }
}
```

### Universal Links / App Links (향후 활성화)

도메인 설정 완료 후 추가할 설정:

```json
{
  "expo": {
    "ios": {
      "associatedDomains": [
        "applinks:uniqn.app",
        "applinks:tholdem-ebc18.web.app"
      ]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "https", "host": "uniqn.app", "pathPrefix": "/" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

---

## 2. URL 구조 설계

### 지원 경로 (실제 구현)

| 딥링크 경로 | Expo Router 경로 | 설명 |
|-------------|------------------|------|
| `uniqn://` | `/(app)/(tabs)` | 홈 화면 |
| `uniqn://jobs` | `/(app)/(tabs)` | 구인공고 목록 (홈) |
| `uniqn://jobs/:id` | `/(app)/jobs/[id]` | 구인공고 상세 |
| `uniqn://schedule` | `/(app)/(tabs)/schedule` | 내 스케줄 |
| `uniqn://notifications` | `/(app)/notifications` | 알림 목록 |
| `uniqn://profile` | `/(app)/(tabs)/profile` | 프로필 |
| `uniqn://settings` | `/(app)/settings` | 설정 |
| `uniqn://support` | `/(app)/support` | 고객지원 |
| `uniqn://notices` | `/(app)/notices` | 공지사항 |
| `uniqn://employer/my-postings` | `/(employer)/my-postings` | 내 공고 관리 |
| `uniqn://employer/postings/:id` | `/(employer)/my-postings/[id]` | 공고 상세 |
| `uniqn://employer/applicants/:jobId` | `/(employer)/my-postings/[id]/applicants` | 지원자 목록 |
| `uniqn://employer/settlement/:jobId` | `/(employer)/my-postings/[id]/settlements` | 정산 |
| `uniqn://admin/reports` | `/(admin)/reports` | 신고 관리 |
| `uniqn://admin/reports/:id` | `/(admin)/reports/[id]` | 신고 상세 |
| `uniqn://admin/inquiries` | `/(admin)/inquiries` | 문의 관리 |
| `uniqn://admin/tournaments` | `/(admin)/tournaments` | 대회 승인 |

### 제거된 경로 (v2.0)

| 경로 | 이유 | 대체 |
|------|------|------|
| `/applications/:id` | 지원 상세 화면 없음 | `/schedule` |
| `/schedule/:date` | 날짜별 라우트 없음 | `/schedule` |
| `/settings/notifications` | 알림 설정 라우트 없음 | `/settings` |

---

## 3. Shared 모듈 (SSOT)

### RouteRegistry.ts

```typescript
// src/shared/deeplink/RouteRegistry.ts
export const EXPO_ROUTES = {
  // === 탭 ===
  home: '/(app)/(tabs)',
  schedule: '/(app)/(tabs)/schedule',
  profile: '/(app)/(tabs)/profile',
  employerTab: '/(app)/(tabs)/employer',
  qr: '/(app)/(tabs)/qr',

  // === 앱 (인증 필요) ===
  notifications: '/(app)/notifications',
  jobDetail: '/(app)/jobs/[id]',
  jobApply: '/(app)/jobs/[id]/apply',
  settings: '/(app)/settings',
  notices: '/(app)/notices',
  support: '/(app)/support',

  // === 구인자 ===
  myPostings: '/(employer)/my-postings',
  postingDetail: '/(employer)/my-postings/[id]',
  postingApplicants: '/(employer)/my-postings/[id]/applicants',
  postingSettlements: '/(employer)/my-postings/[id]/settlements',

  // === 관리자 ===
  adminDashboard: '/(admin)',
  adminReports: '/(admin)/reports',
  adminReportDetail: '/(admin)/reports/[id]',
  adminInquiries: '/(admin)/inquiries',
  adminTournaments: '/(admin)/tournaments',

  // === 공개 ===
  publicJobs: '/(public)/jobs',
  publicJobDetail: '/(public)/jobs/[id]',

  // === 인증 ===
  login: '/(auth)/login',
  signup: '/(auth)/signup',
} as const;

// 권한 필요 라우트
export const AUTH_REQUIRED_ROUTES = ['notifications', 'schedule', 'profile', ...];
export const EMPLOYER_REQUIRED_ROUTES = ['myPostings', 'postingDetail', ...];
export const ADMIN_REQUIRED_ROUTES = ['adminDashboard', 'adminReports', ...];
```

### RouteMapper.ts

```typescript
// src/shared/deeplink/RouteMapper.ts
export class RouteMapper {
  /** 라우트 이름 → Expo Router 경로 */
  static toExpoPath(route: DeepLinkRoute): string {
    const basePath = EXPO_ROUTES[route.name as ExpoRouteName];
    if (!basePath) return EXPO_ROUTES.home;

    // 파라미터 치환: [id] → 실제 값
    if (route.params) {
      return Object.entries(route.params).reduce(
        (path, [key, value]) => path.replace(`[${key}]`, value),
        basePath
      );
    }
    return basePath;
  }

  /** 인증 필요 여부 확인 */
  static requiresAuth(routeName: string): boolean {
    return AUTH_REQUIRED_ROUTES.includes(routeName as ExpoRouteName);
  }

  /** 구인자 권한 필요 여부 */
  static requiresEmployer(routeName: string): boolean {
    return EMPLOYER_REQUIRED_ROUTES.includes(routeName as ExpoRouteName);
  }

  /** 관리자 권한 필요 여부 */
  static requiresAdmin(routeName: string): boolean {
    return ADMIN_REQUIRED_ROUTES.includes(routeName as ExpoRouteName);
  }
}
```

### NotificationRouteMap.ts

```typescript
// src/shared/deeplink/NotificationRouteMap.ts

/** 29개 알림 타입 → 라우트 매핑 */
export const NOTIFICATION_ROUTE_MAP: Record<
  NotificationType,
  (data?: Record<string, string>) => DeepLinkRoute
> = {
  // === 지원/확정 관련 (스태프용) ===
  application_received: () => ({ name: 'schedule' }),
  application_confirmed: (data) => ({ name: 'job', params: { id: data?.jobPostingId ?? '' } }),
  application_rejected: (data) => ({ name: 'job', params: { id: data?.jobPostingId ?? '' } }),
  confirmation_request: () => ({ name: 'schedule' }),
  confirmation_reminder: () => ({ name: 'schedule' }),
  confirmation_expired: () => ({ name: 'schedule' }),
  confirmation_accepted: (data) => ({ name: 'job', params: { id: data?.jobPostingId ?? '' } }),
  confirmation_declined: () => ({ name: 'schedule' }),

  // === 근무 관련 ===
  work_reminder: () => ({ name: 'schedule' }),
  work_tomorrow: () => ({ name: 'schedule' }),
  checkin_reminder: () => ({ name: 'schedule' }),
  checkout_reminder: () => ({ name: 'schedule' }),
  work_completed: () => ({ name: 'schedule' }),

  // === 정산 관련 ===
  settlement_completed: (data) => ({
    name: 'employer/settlement',
    params: { jobId: data?.jobPostingId ?? '' },
  }),
  settlement_received: () => ({ name: 'schedule' }),

  // === 구인자용 알림 ===
  new_applicant: (data) => ({
    name: 'employer/applicants',
    params: { jobId: data?.jobPostingId ?? '' },
  }),
  applicant_confirmed: (data) => ({
    name: 'employer/applicants',
    params: { jobId: data?.jobPostingId ?? '' },
  }),
  applicant_declined: (data) => ({
    name: 'employer/applicants',
    params: { jobId: data?.jobPostingId ?? '' },
  }),
  cancellation_request: (data) => ({
    name: 'employer/applicants',
    params: { jobId: data?.jobPostingId ?? '' },
  }),
  posting_expired: (data) => ({
    name: 'employer/posting',
    params: { id: data?.jobPostingId ?? '' },
  }),

  // === 관리자용 알림 ===
  report_submitted: (data) => ({
    name: 'admin/report',
    params: { id: data?.reportId ?? '' },
  }),
  report_resolved: (data) => ({
    name: 'admin/report',
    params: { id: data?.reportId ?? '' },
  }),
  inquiry_submitted: (data) => ({
    name: 'admin/inquiry',
    params: { id: data?.inquiryId ?? '' },
  }),
  inquiry_answered: (data) => ({
    name: 'support/inquiry',
    params: { id: data?.inquiryId ?? '' },
  }),
  tournament_pending: () => ({ name: 'admin/tournaments' }),
  tournament_approved: (data) => ({
    name: 'employer/posting',
    params: { id: data?.jobPostingId ?? '' },
  }),
  tournament_rejected: (data) => ({
    name: 'employer/posting',
    params: { id: data?.jobPostingId ?? '' },
  }),

  // === 일반 ===
  announcement: () => ({ name: 'notices' }),
  system: () => ({ name: 'notifications' }),
};
```

---

## 4. 딥링크 서비스 (v2.0)

### deepLinkService.ts

```typescript
// src/services/deepLinkService.ts
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { RouteMapper, NOTIFICATION_ROUTE_MAP } from '@/shared/deeplink';

export const APP_SCHEME = 'uniqn';
export const WEB_DOMAIN = 'uniqn.app';

const SCHEME_PREFIX = `${APP_SCHEME}://`;
const WEB_PREFIX = `https://${WEB_DOMAIN}`;
const COLD_START_NAVIGATION_DELAY_MS = 500;

/** 안전한 알림 링크 패턴 (상대 경로만 허용) */
const SAFE_LINK_PATTERN = /^\/[a-zA-Z0-9\-_/]*$/;

/**
 * 알림 링크 유효성 검증 (보안)
 */
export function validateNotificationLink(link?: string): string | undefined {
  if (!link) return undefined;
  const trimmedLink = link.trim();
  if (!SAFE_LINK_PATTERN.test(trimmedLink)) {
    logger.warn('위험한 알림 링크 차단', { link: trimmedLink.substring(0, 50) });
    return undefined;
  }
  return trimmedLink;
}

/**
 * 딥링크 URL 파싱
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  // Custom Scheme, Universal Link, 상대 경로 처리
  // pathToRoute()로 라우트 객체 생성
  // ...
}

/**
 * 딥링크로 네비게이션
 */
export async function navigateToDeepLink(url: string): Promise<boolean> {
  const parsed = parseDeepLink(url);
  if (!parsed.isValid || !parsed.route) return false;

  const expoPath = RouteMapper.toExpoPath(parsed.route);
  router.push(expoPath);
  return true;
}

/**
 * 알림에서 네비게이션
 */
export async function navigateFromNotification(
  type: NotificationType,
  data?: Record<string, string>,
  link?: string
): Promise<boolean> {
  // 1. link 필드 검증 후 사용
  const validatedLink = validateNotificationLink(link);
  if (validatedLink) {
    const parsed = parseDeepLink(validatedLink);
    if (parsed.isValid && parsed.route) {
      router.push(RouteMapper.toExpoPath(parsed.route));
      return true;
    }
  }

  // 2. 알림 타입별 매핑 사용
  const routeGenerator = NOTIFICATION_ROUTE_MAP[type];
  if (routeGenerator) {
    const route = routeGenerator(data);
    router.push(RouteMapper.toExpoPath(route));
    return true;
  }

  // 3. 기본값: 알림 목록
  router.push('/(app)/notifications');
  return true;
}

/**
 * 딥링크 리스너 등록
 */
export function setupDeepLinkListener(onDeepLink?: (url: string) => void): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    onDeepLink?.(url);
    navigateToDeepLink(url);
  });

  // 콜드 스타트 처리
  Linking.getInitialURL().then((url) => {
    if (url) {
      setTimeout(() => navigateToDeepLink(url), COLD_START_NAVIGATION_DELAY_MS);
    }
  });

  return () => subscription.remove();
}

/**
 * 딥링크 URL 생성
 */
export function createDeepLink(
  route: DeepLinkRoute,
  options: { useWebUrl?: boolean } = {}
): string {
  const expoPath = RouteMapper.toExpoPath(route);
  const cleanPath = expoPath.replace(/\/\([^)]+\)/g, '').replace(/^\//, '') || 'home';
  const prefix = options.useWebUrl ? WEB_PREFIX : SCHEME_PREFIX;
  return `${prefix}${cleanPath}`;
}
```

---

## 5. 훅 (Hooks)

### useNotificationHandler

통합 알림 핸들러 훅 - 푸시 알림 수신, 터치 처리, 딥링크 네비게이션 통합

```typescript
// src/hooks/useNotificationHandler.ts
export function useNotificationHandler(options: UseNotificationHandlerOptions = {}) {
  const { showForegroundToast = true, autoInitialize = true } = options;

  // 포그라운드 알림 수신 처리
  const handleNotificationReceived = useCallback((notification: NotificationPayload) => {
    if (showForegroundToast && notification.title) {
      addToast({ type: 'info', message: notification.body || notification.title });
    }
  }, []);

  // 알림 터치 → 딥링크 네비게이션
  const handleNotificationResponse = useCallback(
    async (notification: NotificationPayload, actionIdentifier: string) => {
      const type = notification.data?.type as NotificationType;
      const data = notification.data as Record<string, string>;
      await navigateFromNotification(type, data, data?.link);
    },
    []
  );

  // 초기화
  useEffect(() => {
    if (autoInitialize) {
      pushNotificationService.initialize();
      pushNotificationService.setNotificationReceivedHandler(handleNotificationReceived);
      pushNotificationService.setNotificationResponseHandler(handleNotificationResponse);
    }
  }, []);

  // 딥링크 리스너
  useEffect(() => {
    return deepLinkService.setupDeepLinkListener();
  }, []);

  return {
    isInitialized,
    permissionStatus,
    requestPermission,
    registerToken,
    unregisterToken,
    setBadge,
    clearBadge,
    openSettings,
  };
}
```

### useDeepLinkSetup

인증 필요 딥링크 처리 (로그인 후 대기 딥링크 처리)

```typescript
// src/hooks/useDeepLink.ts
export function useDeepLinkSetup(options: UseDeepLinkSetupOptions = {}) {
  const { onAuthRequired, enabled = true } = options;
  const user = useAuthStore((state) => state.user);
  const pendingDeepLinkRef = useRef<string | null>(null);

  const handleDeepLink = useCallback((url: string) => {
    const parsed = parseDeepLink(url);
    if (!parsed.isValid || !parsed.route) return;

    // 인증 필요 라우트 체크 (SSOT: RouteMapper)
    const requiresAuth = RouteMapper.requiresAuth(parsed.route.name);

    if (requiresAuth && !user) {
      pendingDeepLinkRef.current = url;
      onAuthRequired?.(url);
      return;
    }

    navigateToDeepLink(url);
  }, [user, onAuthRequired]);

  // 인증 후 대기 딥링크 처리
  useEffect(() => {
    if (user && pendingDeepLinkRef.current) {
      navigateToDeepLink(pendingDeepLinkRef.current);
      pendingDeepLinkRef.current = null;
    }
  }, [user]);

  useEffect(() => {
    if (!enabled) return;
    return setupDeepLinkListener(handleDeepLink);
  }, [enabled, handleDeepLink]);
}
```

### useDeepLinkNavigation

프로그래매틱 딥링크 네비게이션

```typescript
// src/hooks/useDeepLink.ts
export function useDeepLinkNavigation() {
  const navigate = useCallback((route: DeepLinkRoute) => {
    return navigateToDeepLink(createDeepLink(route));
  }, []);

  const navigateToJob = useCallback((jobId: string) => {
    return navigate({ name: 'job', params: { id: jobId } });
  }, [navigate]);

  // v2.0: 지원 상세 화면 없음 → 스케줄로 이동
  const navigateToApplication = useCallback((_applicationId: string) => {
    return navigate({ name: 'schedule' });
  }, [navigate]);

  const navigateToSchedule = useCallback(() => {
    return navigate({ name: 'schedule' });
  }, [navigate]);

  const createShareUrl = useCallback((type: 'job', id: string) => {
    return createJobDeepLink(id, true); // 웹 URL
  }, []);

  return {
    navigate,
    navigateToJob,
    navigateToApplication,
    navigateToSchedule,
    createShareUrl,
  };
}
```

---

## 6. Root Layout 통합

```typescript
// app/_layout.tsx
function MainNavigator() {
  // 인증 가드
  useAuthGuard();

  // Analytics 추적
  useNavigationTracking();

  // 푸시 알림 + 딥링크 통합 처리
  useNotificationHandler();

  // 네트워크 상태
  const { isOnline } = useNetworkStatus();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(employer)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <InAppMessageManager />
      <ToastManager />
      <ModalManager />
    </>
  );
}
```

---

## 7. 공유 기능

```typescript
// utils/share.ts
import { Share, Platform } from 'react-native';
import { createJobDeepLink } from '@/services/deepLinkService';

export async function shareJob(params: {
  jobId: string;
  jobTitle: string;
  location: string;
}): Promise<boolean> {
  const { jobId, jobTitle, location } = params;

  // Universal Link (앱 설치 시 앱으로, 미설치 시 웹으로)
  const shareUrl = createJobDeepLink(jobId, true);

  const message = `[UNIQN] ${jobTitle} - ${location}\n\n지금 바로 확인하세요!\n${shareUrl}`;

  const result = await Share.share({
    message,
    url: Platform.OS === 'ios' ? shareUrl : undefined,
    title: jobTitle,
  });

  return result.action === Share.sharedAction;
}
```

---

## 8. 테스트

### 딥링크 테스트 방법

```bash
# iOS 시뮬레이터
xcrun simctl openurl booted "uniqn://jobs/test123"
xcrun simctl openurl booted "uniqn://schedule"

# Android 에뮬레이터
adb shell am start -W -a android.intent.action.VIEW -d "uniqn://jobs/test123" com.uniqn.mobile
adb shell am start -W -a android.intent.action.VIEW -d "uniqn://notifications" com.uniqn.mobile

# Expo Dev Client
npx uri-scheme open "uniqn://jobs/test123" --ios
npx uri-scheme open "uniqn://jobs/test123" --android
```

### 검증 체크리스트

- [x] Custom Scheme (`uniqn://`) 작동 확인
- [ ] Universal Links (iOS) - 도메인 설정 후 확인
- [ ] App Links (Android) - 도메인 설정 후 확인
- [x] 미인증 상태에서 딥링크 → 로그인 → 원래 화면 이동
- [x] 알림 탭 → 해당 화면 이동 (29개 타입 전체)
- [x] 공유 링크 생성 확인
- [x] 404 페이지 폴백 처리

---

## 9. 에러 처리

### 404 페이지

```typescript
// app/+not-found.tsx
export default function NotFoundScreen() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent('deep_link_not_found', { attempted_path: pathname });
  }, [pathname]);

  return (
    <View className="flex-1 items-center justify-center p-5">
      <Text className="text-xl font-bold">페이지를 찾을 수 없습니다</Text>
      <Text className="text-gray-500 text-center mt-2">
        요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
      </Text>
      <Button onPress={() => router.replace('/')}>홈으로 이동</Button>
    </View>
  );
}
```

---

## 체크리스트

### 구현 완료

- [x] Custom URL Scheme 설정 (`uniqn://`)
- [x] deepLinkService v2.0 구현
- [x] Shared 모듈 (RouteRegistry, RouteMapper, NotificationRouteMap)
- [x] 29개 알림 타입 전체 딥링크 매핑
- [x] useNotificationHandler 통합 훅
- [x] 인증 필요 딥링크 대기 처리
- [x] 공유 기능 구현
- [x] 404 페이지 처리

### 향후 작업

- [ ] Universal Links 설정 (apple-app-site-association)
- [ ] App Links 설정 (assetlinks.json)
- [ ] Firebase Hosting에 well-known 파일 배포
- [ ] 웹 플랫폼 딥링크 지원

---

*마지막 업데이트: 2026-02-02*
*딥링크 서비스 버전: v2.0.0*
