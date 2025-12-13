# 17. Deep Linking

## 개요

앱 외부에서 특정 화면으로 직접 이동할 수 있는 딥링크 시스템입니다.
Universal Links (iOS), App Links (Android), Custom URL Scheme을 지원합니다.

### 딥링크 유형

| 유형 | 형식 | 용도 |
|------|------|------|
| **Custom Scheme** | `uniqn://jobs/123` | 앱 간 이동, 개발/테스트 |
| **Universal Links** (iOS) | `https://uniqn.app/jobs/123` | 웹→앱 전환, 공유 링크 |
| **App Links** (Android) | `https://uniqn.app/jobs/123` | 웹→앱 전환, 공유 링크 |

---

## 1. 기본 설정

### app.json 설정

```json
{
  "expo": {
    "scheme": "uniqn",
    "ios": {
      "bundleIdentifier": "com.uniqn.app",
      "associatedDomains": [
        "applinks:uniqn.app",
        "applinks:tholdem-ebc18.web.app"
      ]
    },
    "android": {
      "package": "com.uniqn.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "uniqn.app",
              "pathPrefix": "/"
            },
            {
              "scheme": "https",
              "host": "tholdem-ebc18.web.app",
              "pathPrefix": "/"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

### Expo Router 설정

```typescript
// app.config.ts
export default {
  expo: {
    scheme: 'uniqn',
    experiments: {
      typedRoutes: true,
    },
  },
};
```

---

## 2. URL 구조 설계

### 지원 경로

| 경로 | 설명 | 예시 |
|------|------|------|
| `/` | 홈 화면 | `uniqn://` |
| `/jobs` | 구인공고 목록 | `uniqn://jobs` |
| `/jobs/:id` | 구인공고 상세 | `uniqn://jobs/abc123` |
| `/applications` | 내 지원 목록 | `uniqn://applications` |
| `/applications/:id` | 지원 상세 | `uniqn://applications/xyz789` |
| `/schedule` | 일정 관리 | `uniqn://schedule` |
| `/notifications` | 알림 목록 | `uniqn://notifications` |
| `/profile` | 프로필 | `uniqn://profile` |
| `/settings` | 설정 | `uniqn://settings` |

### 쿼리 파라미터

```typescript
// 공고 목록 필터링
uniqn://jobs?location=서울&role=딜러&date=2025-01-15

// 알림에서 이동
uniqn://applications/xyz789?from=notification&notificationId=noti123

// 공유 링크 추적
https://uniqn.app/jobs/abc123?ref=share&sharedBy=user456
```

---

## 3. Expo Router 딥링크 처리

### 기본 라우트 구조

```
app/
├── _layout.tsx          # 루트 레이아웃 (딥링크 초기화)
├── index.tsx            # 홈 (/)
├── jobs/
│   ├── index.tsx        # 공고 목록 (/jobs)
│   └── [id].tsx         # 공고 상세 (/jobs/:id)
├── applications/
│   ├── index.tsx        # 지원 목록 (/applications)
│   └── [id].tsx         # 지원 상세 (/applications/:id)
├── schedule.tsx         # 일정 (/schedule)
├── notifications.tsx    # 알림 (/notifications)
├── profile.tsx          # 프로필 (/profile)
└── settings.tsx         # 설정 (/settings)
```

### 딥링크 파라미터 사용

```typescript
// app/jobs/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

export default function JobDetailScreen() {
  const { id, ref, from } = useLocalSearchParams<{
    id: string;
    ref?: string;
    from?: string;
  }>();

  // 딥링크 출처 추적
  useEffect(() => {
    if (ref === 'share') {
      analyticsService.logEvent('job_view_from_share', { job_id: id });
    }
    if (from === 'notification') {
      analyticsService.logEvent('job_view_from_notification', { job_id: id });
    }
  }, [id, ref, from]);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobService.getById(id),
  });

  if (isLoading) return <LoadingScreen />;
  if (!job) return <NotFoundScreen />;

  return <JobDetail job={job} />;
}
```

---

## 4. 딥링크 서비스

### DeepLinkService 구현

```typescript
// services/deepLink/DeepLinkService.ts
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Platform } from 'react-native';

export type DeepLinkRoute =
  | { type: 'home' }
  | { type: 'job'; jobId: string }
  | { type: 'application'; applicationId: string }
  | { type: 'schedule' }
  | { type: 'notifications' }
  | { type: 'profile' }
  | { type: 'unknown'; url: string };

class DeepLinkService {
  // URL 파싱
  parseUrl(url: string): DeepLinkRoute {
    try {
      const parsed = Linking.parse(url);
      const { path, queryParams } = parsed;

      // 경로별 라우트 매핑
      if (!path || path === '') {
        return { type: 'home' };
      }

      // /jobs/:id
      const jobMatch = path.match(/^jobs\/([^\/]+)$/);
      if (jobMatch) {
        return { type: 'job', jobId: jobMatch[1] };
      }

      // /jobs
      if (path === 'jobs') {
        return { type: 'home' }; // 또는 jobs 목록으로
      }

      // /applications/:id
      const appMatch = path.match(/^applications\/([^\/]+)$/);
      if (appMatch) {
        return { type: 'application', applicationId: appMatch[1] };
      }

      // /schedule
      if (path === 'schedule') {
        return { type: 'schedule' };
      }

      // /notifications
      if (path === 'notifications') {
        return { type: 'notifications' };
      }

      // /profile
      if (path === 'profile') {
        return { type: 'profile' };
      }

      return { type: 'unknown', url };
    } catch (error) {
      console.error('[DeepLink] Parse error:', error);
      return { type: 'unknown', url };
    }
  }

  // 라우트 네비게이션
  navigate(route: DeepLinkRoute): void {
    switch (route.type) {
      case 'home':
        router.replace('/');
        break;
      case 'job':
        router.push(`/jobs/${route.jobId}`);
        break;
      case 'application':
        router.push(`/applications/${route.applicationId}`);
        break;
      case 'schedule':
        router.push('/schedule');
        break;
      case 'notifications':
        router.push('/notifications');
        break;
      case 'profile':
        router.push('/profile');
        break;
      case 'unknown':
        console.warn('[DeepLink] Unknown route:', route.url);
        router.replace('/');
        break;
    }
  }

  // URL 처리 (파싱 + 네비게이션)
  handleUrl(url: string): void {
    const route = this.parseUrl(url);
    this.navigate(route);
  }

  // 딥링크 URL 생성
  createUrl(path: string, params?: Record<string, string>): string {
    const baseUrl = Platform.select({
      web: 'https://uniqn.app',
      default: 'uniqn:/',
    });

    let url = `${baseUrl}/${path}`;

    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    return url;
  }

  // 공유용 Universal Link 생성
  createShareUrl(path: string, params?: Record<string, string>): string {
    let url = `https://uniqn.app/${path}`;

    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    return url;
  }
}

export const deepLinkService = new DeepLinkService();
```

---

## 5. 앱 초기화 시 딥링크 처리

### Root Layout 설정

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { deepLinkService } from '@/services/deepLink/DeepLinkService';
import { useAuth } from '@/contexts/AuthContext';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading } = useAuth();

  // 앱 시작 시 딥링크 처리
  useEffect(() => {
    const handleInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('[DeepLink] Initial URL:', initialUrl);
        // 인증 완료 후 처리 (아래 useEffect에서)
      }
    };

    handleInitialUrl();
  }, []);

  // 앱 실행 중 딥링크 처리
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[DeepLink] URL received:', url);

      if (!user) {
        // 미인증 시 URL 저장 후 로그인 화면으로
        savePendingDeepLink(url);
        router.replace('/auth/login');
        return;
      }

      deepLinkService.handleUrl(url);
    });

    return () => subscription.remove();
  }, [user]);

  // 인증 상태 변경 + 대기 중인 딥링크 처리
  useEffect(() => {
    if (!isLoading && user) {
      const pendingUrl = getPendingDeepLink();
      if (pendingUrl) {
        clearPendingDeepLink();
        deepLinkService.handleUrl(pendingUrl);
      }
    }
  }, [user, isLoading]);

  // 인증되지 않은 사용자 리다이렉트
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, segments, isLoading]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="jobs/[id]" options={{ title: '공고 상세' }} />
      <Stack.Screen name="applications/[id]" options={{ title: '지원 상세' }} />
    </Stack>
  );
}

// 대기 딥링크 저장 (AsyncStorage 또는 메모리)
let pendingDeepLink: string | null = null;

function savePendingDeepLink(url: string) {
  pendingDeepLink = url;
}

function getPendingDeepLink(): string | null {
  return pendingDeepLink;
}

function clearPendingDeepLink() {
  pendingDeepLink = null;
}
```

---

## 6. 알림 탭 → 딥링크 처리

### FCM 알림 데이터 구조

```typescript
// types/notification.ts
export interface NotificationData {
  type: 'job_application' | 'confirmation_request' | 'confirmation_response' |
        'schedule_change' | 'settlement' | 'general';
  targetId?: string;       // jobId, applicationId 등
  targetScreen?: string;   // 직접 화면 지정
  deepLink?: string;       // 전체 딥링크 URL
}
```

### 알림 탭 처리 훅

```typescript
// hooks/useNotificationDeepLink.ts
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { router } from 'expo-router';
import { NotificationData } from '@/types/notification';
import { analyticsService } from '@/services/analytics/AnalyticsService';

export function useNotificationDeepLink() {
  useEffect(() => {
    // 1. 앱이 백그라운드에서 포그라운드로 올 때
    const unsubscribeOpened = messaging().onNotificationOpenedApp(
      (remoteMessage) => {
        console.log('[Notification] Opened from background:', remoteMessage);
        handleNotificationNavigation(remoteMessage.data as NotificationData);
      }
    );

    // 2. 앱이 종료 상태에서 열릴 때
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[Notification] Opened from quit:', remoteMessage);
          // 약간의 딜레이 후 네비게이션 (앱 초기화 완료 대기)
          setTimeout(() => {
            handleNotificationNavigation(remoteMessage.data as NotificationData);
          }, 1000);
        }
      });

    return () => {
      unsubscribeOpened();
    };
  }, []);
}

function handleNotificationNavigation(data?: NotificationData) {
  if (!data) {
    router.push('/notifications');
    return;
  }

  // Analytics 추적
  analyticsService.logEvent('notification_opened', {
    type: data.type,
    target_id: data.targetId,
  });

  // 딥링크가 직접 지정된 경우
  if (data.deepLink) {
    const path = data.deepLink.replace(/^(uniqn:\/\/|https:\/\/uniqn\.app\/)/, '');
    router.push(`/${path}` as any);
    return;
  }

  // 타입별 화면 이동
  switch (data.type) {
    case 'job_application':
      if (data.targetId) {
        router.push(`/jobs/${data.targetId}`);
      } else {
        router.push('/applications');
      }
      break;

    case 'confirmation_request':
    case 'confirmation_response':
      if (data.targetId) {
        router.push(`/applications/${data.targetId}`);
      } else {
        router.push('/applications');
      }
      break;

    case 'schedule_change':
      router.push('/schedule');
      break;

    case 'settlement':
      router.push('/settlement');
      break;

    case 'general':
    default:
      router.push('/notifications');
      break;
  }
}
```

### Root Layout에서 훅 사용

```typescript
// app/_layout.tsx
import { useNotificationDeepLink } from '@/hooks/useNotificationDeepLink';

export default function RootLayout() {
  // ... 기존 코드

  // 알림 딥링크 처리
  useNotificationDeepLink();

  return (
    // ...
  );
}
```

---

## 7. Universal Links / App Links 설정

### iOS: apple-app-site-association

Firebase Hosting 또는 웹서버의 `.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.uniqn.app",
        "paths": [
          "/jobs/*",
          "/applications/*",
          "/schedule",
          "/notifications",
          "/profile",
          "/settings",
          "/*"
        ]
      }
    ]
  }
}
```

### Android: assetlinks.json

Firebase Hosting 또는 웹서버의 `.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.uniqn.app",
      "sha256_cert_fingerprints": [
        "SHA256_FINGERPRINT_FROM_KEYSTORE"
      ]
    }
  }
]
```

### Firebase Hosting 설정

```json
// firebase.json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "/.well-known/apple-app-site-association",
        "destination": "/.well-known/apple-app-site-association"
      },
      {
        "source": "/.well-known/assetlinks.json",
        "destination": "/.well-known/assetlinks.json"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/.well-known/apple-app-site-association",
        "headers": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ]
      }
    ]
  }
}
```

---

## 8. 공유 기능 구현

### 공유 링크 생성

```typescript
// utils/share.ts
import { Share, Platform } from 'react-native';
import { deepLinkService } from '@/services/deepLink/DeepLinkService';
import { analyticsService } from '@/services/analytics/AnalyticsService';

interface ShareJobParams {
  jobId: string;
  jobTitle: string;
  location: string;
  userId?: string;
}

export async function shareJob(params: ShareJobParams): Promise<boolean> {
  const { jobId, jobTitle, location, userId } = params;

  // Universal Link 생성 (앱 설치 시 앱으로, 미설치 시 웹으로)
  const shareUrl = deepLinkService.createShareUrl(`jobs/${jobId}`, {
    ref: 'share',
    sharedBy: userId || 'anonymous',
  });

  const message = `[UNIQN] ${jobTitle} - ${location}\n\n지금 바로 확인하세요!\n${shareUrl}`;

  try {
    const result = await Share.share({
      message,
      url: Platform.OS === 'ios' ? shareUrl : undefined,
      title: jobTitle,
    });

    if (result.action === Share.sharedAction) {
      analyticsService.logEvent('job_share', {
        job_id: jobId,
        method: result.activityType || 'unknown',
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Share] Error:', error);
    return false;
  }
}
```

### 공유 버튼 컴포넌트

```typescript
// components/ShareButton.tsx
import { TouchableOpacity } from 'react-native';
import { ShareIcon } from '@/components/icons';
import { shareJob } from '@/utils/share';
import { useAuth } from '@/contexts/AuthContext';

interface ShareButtonProps {
  jobId: string;
  jobTitle: string;
  location: string;
}

export function ShareButton({ jobId, jobTitle, location }: ShareButtonProps) {
  const { user } = useAuth();

  const handleShare = async () => {
    await shareJob({
      jobId,
      jobTitle,
      location,
      userId: user?.uid,
    });
  };

  return (
    <TouchableOpacity
      onPress={handleShare}
      accessibilityLabel="공유하기"
      accessibilityRole="button"
    >
      <ShareIcon size={24} />
    </TouchableOpacity>
  );
}
```

---

## 9. 웹 플랫폼 지원 (React Native Web)

### 웹에서 딥링크 처리

```typescript
// services/deepLink/WebDeepLinkService.ts
import { Platform } from 'react-native';
import { router } from 'expo-router';

class WebDeepLinkService {
  initialize(): void {
    if (Platform.OS !== 'web') return;

    // 브라우저 히스토리 변경 감지
    window.addEventListener('popstate', this.handlePopState);

    // 초기 URL 처리
    this.handleInitialUrl();
  }

  private handleInitialUrl(): void {
    const path = window.location.pathname;
    const search = window.location.search;

    if (path !== '/') {
      console.log('[WebDeepLink] Initial path:', path + search);
      // Expo Router가 자동 처리
    }
  }

  private handlePopState = (): void => {
    // Expo Router가 자동으로 처리
    console.log('[WebDeepLink] Popstate:', window.location.pathname);
  };

  // 앱 스토어로 리다이렉트 (앱 미설치 시)
  redirectToStore(): void {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      window.location.href = 'https://apps.apple.com/app/uniqn/id123456789';
    } else if (isAndroid) {
      window.location.href = 'https://play.google.com/store/apps/details?id=com.uniqn.app';
    }
  }
}

export const webDeepLinkService = new WebDeepLinkService();
```

### 웹 메타 태그 (SEO + 앱 연동)

```typescript
// app/jobs/[id].tsx (웹 메타 태그)
import Head from 'expo-router/head';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const { data: job } = useQuery(['job', id], () => jobService.getById(id));

  return (
    <>
      <Head>
        <title>{job?.title || '구인공고'} | UNIQN</title>
        <meta name="description" content={job?.description?.substring(0, 160)} />

        {/* Open Graph */}
        <meta property="og:title" content={job?.title} />
        <meta property="og:description" content={job?.description?.substring(0, 160)} />
        <meta property="og:url" content={`https://uniqn.app/jobs/${id}`} />

        {/* 앱 연동 */}
        <meta property="al:ios:url" content={`uniqn://jobs/${id}`} />
        <meta property="al:ios:app_store_id" content="123456789" />
        <meta property="al:ios:app_name" content="UNIQN" />
        <meta property="al:android:url" content={`uniqn://jobs/${id}`} />
        <meta property="al:android:package" content="com.uniqn.app" />
        <meta property="al:android:app_name" content="UNIQN" />

        {/* Smart App Banner (iOS Safari) */}
        <meta name="apple-itunes-app" content={`app-id=123456789, app-argument=uniqn://jobs/${id}`} />
      </Head>

      <JobDetail job={job} />
    </>
  );
}
```

---

## 10. 테스트 및 디버깅

### 딥링크 테스트 방법

```bash
# iOS 시뮬레이터
xcrun simctl openurl booted "uniqn://jobs/test123"
xcrun simctl openurl booted "https://uniqn.app/jobs/test123"

# Android 에뮬레이터
adb shell am start -W -a android.intent.action.VIEW -d "uniqn://jobs/test123" com.uniqn.app
adb shell am start -W -a android.intent.action.VIEW -d "https://uniqn.app/jobs/test123" com.uniqn.app

# Expo Go (개발)
npx uri-scheme open "uniqn://jobs/test123" --ios
npx uri-scheme open "uniqn://jobs/test123" --android
```

### 디버그 유틸리티

```typescript
// utils/deepLinkDebug.ts (개발 환경에서만)
import * as Linking from 'expo-linking';

export async function debugDeepLinks() {
  if (!__DEV__) return;

  console.log('=== Deep Link Debug ===');

  // 현재 URL 스킴
  const prefix = Linking.createURL('/');
  console.log('URL Prefix:', prefix);

  // 초기 URL
  const initialUrl = await Linking.getInitialURL();
  console.log('Initial URL:', initialUrl);

  // 파싱 테스트
  const testUrls = [
    'uniqn://jobs/123',
    'https://uniqn.app/jobs/123',
    'uniqn://applications/456?from=notification',
  ];

  testUrls.forEach((url) => {
    console.log(`Parse "${url}":`, Linking.parse(url));
  });
}
```

### 검증 체크리스트

- [ ] Custom Scheme (`uniqn://`) 작동 확인
- [ ] Universal Links (iOS) 작동 확인
- [ ] App Links (Android) 작동 확인
- [ ] 앱 미설치 시 앱스토어/웹 폴백 확인
- [ ] 미인증 상태에서 딥링크 → 로그인 → 원래 화면 이동
- [ ] 알림 탭 → 해당 화면 이동 확인
- [ ] 공유 링크 생성 및 작동 확인
- [ ] 웹에서 동일 경로 접근 확인

---

## 11. 에러 처리

### 잘못된 딥링크 처리

```typescript
// app/[...missing].tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { analyticsService } from '@/services/analytics/AnalyticsService';
import { useEffect } from 'react';

export default function NotFoundScreen() {
  const pathname = usePathname();

  useEffect(() => {
    analyticsService.logEvent('deep_link_not_found', {
      attempted_path: pathname,
    });
  }, [pathname]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>페이지를 찾을 수 없습니다</Text>
      <Text style={styles.message}>
        요청하신 페이지가 존재하지 않거나{'\n'}
        이동되었을 수 있습니다.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.buttonText}>홈으로 이동</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## 체크리스트

### 구현 완료 기준

- [ ] Custom URL Scheme 설정 (app.json)
- [ ] Universal Links 설정 (associatedDomains)
- [ ] App Links 설정 (intentFilters)
- [ ] apple-app-site-association 파일 배포
- [ ] assetlinks.json 파일 배포
- [ ] DeepLinkService 구현
- [ ] 알림 탭 딥링크 처리
- [ ] 미인증 시 대기 딥링크 처리
- [ ] 공유 기능 구현
- [ ] 404 페이지 처리
- [ ] 웹 플랫폼 지원
- [ ] 테스트 완료
