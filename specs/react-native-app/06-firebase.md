# 06. Firebase 연동 전략

> **마지막 업데이트**: 2026년 2월 2일

## Firebase 설정

### 패키지 선택 (현재 구현)
```yaml
# Firebase Web SDK (Modular API)
firebase: ^12.6.0

# 선택 이유:
# - Expo SDK 54와 완벽한 호환성
# - expo-dev-client 없이도 Expo Go에서 테스트 가능
# - Web, iOS, Android 단일 코드베이스
# - Tree-shaking으로 번들 크기 최적화
# - 기존 Firebase 프로젝트와 호환

# 참고: @react-native-firebase/* 패키지는 사용하지 않음
# - 네이티브 모듈 필요 (Expo Go 미지원)
# - 별도 빌드 설정 필요
```

### 초기화 설정 (지연 초기화 + Proxy 패턴)
```typescript
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth, getReactNativePersistence } from 'firebase/auth';
import {
  getFirestore, Firestore, Timestamp,
  doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove,
  collection, query, where, orderBy, limit,
  getDocs, getDoc, setDoc, deleteDoc, onSnapshot,
  writeBatch, runTransaction, increment,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { getRemoteConfig, fetchAndActivate, getValue, type RemoteConfig } from 'firebase/remote-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnv } from './env';

// Re-export Firestore utilities (중앙화된 Firebase 접근)
export {
  Timestamp, doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove,
  collection, query, where, orderBy, limit,
  getDocs, getDoc, setDoc, deleteDoc, onSnapshot,
  writeBatch, runTransaction, increment,
};

// 초기화된 인스턴스 캐시
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let firebaseFunctions: Functions | null = null;
let firebaseRemoteConfig: RemoteConfig | null = null;

// 초기화 상태 플래그
let isInitialized = false;
let initializationError: Error | null = null;

/**
 * Firebase 앱 초기화 (내부용)
 * 환경변수 검증 후 초기화 수행
 */
function initializeFirebaseApp(): FirebaseApp {
  if (initializationError) throw initializationError;
  if (firebaseApp) return firebaseApp;

  try {
    const env = getEnv();
    const firebaseConfig = {
      apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
    };

    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    isInitialized = true;
    return firebaseApp;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error('Firebase 초기화 실패');
    throw initializationError;
  }
}

// Getter 함수들
export function getFirebaseApp(): FirebaseApp { return initializeFirebaseApp(); }

export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    const app = initializeFirebaseApp();
    try {
      firebaseAuth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      firebaseAuth = getAuth(app);
    }
  }
  return firebaseAuth;
}

export function getFirebaseDb(): Firestore {
  if (!firebaseDb) firebaseDb = getFirestore(initializeFirebaseApp());
  return firebaseDb;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!firebaseStorage) firebaseStorage = getStorage(initializeFirebaseApp());
  return firebaseStorage;
}

export function getFirebaseFunctions(): Functions {
  if (!firebaseFunctions) firebaseFunctions = getFunctions(initializeFirebaseApp(), 'asia-northeast3');
  return firebaseFunctions;
}

export function getFirebaseRemoteConfig(): RemoteConfig | null {
  if (Platform.OS !== 'web') return null; // 웹에서만 완전 지원
  if (!firebaseRemoteConfig) {
    firebaseRemoteConfig = getRemoteConfig(initializeFirebaseApp());
    firebaseRemoteConfig.settings.minimumFetchIntervalMillis = __DEV__ ? 0 : 12 * 60 * 60 * 1000;
  }
  return firebaseRemoteConfig;
}

/**
 * 지연 초기화 Proxy 생성
 * 기존 코드와의 완벽한 호환성을 위해 Proxy 사용
 */
function createLazyProxy<T extends object>(getter: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const instance = getter();
      const value = (instance as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(instance) : value;
    },
    set(_, prop, value) {
      const instance = getter();
      (instance as Record<string | symbol, unknown>)[prop] = value;
      return true;
    },
    has(_, prop) { return prop in getter(); },
    ownKeys() { return Reflect.ownKeys(getter()); },
    getOwnPropertyDescriptor(_, prop) { return Object.getOwnPropertyDescriptor(getter(), prop); },
  });
}

// 레거시 호환용 export (Proxy)
export const app: FirebaseApp = createLazyProxy(getFirebaseApp);
export const auth: Auth = createLazyProxy(getFirebaseAuth);
export const db: Firestore = createLazyProxy(getFirebaseDb);
export const storage: FirebaseStorage = createLazyProxy(getFirebaseStorage);
export const functions: Functions = createLazyProxy(getFirebaseFunctions);

export function isFirebaseInitialized(): boolean { return isInitialized; }
```

### Expo 설정
```json
// app.json
{
  "expo": {
    "plugins": [
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          "ios": { "useFrameworks": "static" }
        }
      ]
    ],
    "extra": {
      "eas": { "projectId": "..." },
      "EXPO_PUBLIC_FIREBASE_API_KEY": "...",
      "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "...",
      "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "tholdem-ebc18",
      "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET": "...",
      "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "...",
      "EXPO_PUBLIC_FIREBASE_APP_ID": "..."
    }
  }
}
```

---

## Repository 패턴 (현재 구현)

### 개요

Firebase 직접 접근을 추상화하여 테스트 용이성과 유지보수성을 높임.

```yaml
인터페이스 (6개):
  - IApplicationRepository  # 지원 (가장 복잡, 트랜잭션 다수)
  - IJobPostingRepository   # 공고
  - IWorkLogRepository      # 근무 기록
  - INotificationRepository # 알림
  - IUserRepository         # 사용자
  - IEventQRRepository      # 이벤트 QR

구현체 (6개):
  - FirebaseApplicationRepository
  - FirebaseJobPostingRepository
  - FirebaseWorkLogRepository
  - FirebaseNotificationRepository
  - FirebaseUserRepository
  - FirebaseEventQRRepository
```

### IApplicationRepository 인터페이스

```typescript
// src/repositories/interfaces/IApplicationRepository.ts
export interface IApplicationRepository {
  // 조회
  getById(applicationId: string): Promise<ApplicationWithJob | null>;
  getByApplicantId(applicantId: string): Promise<ApplicationWithJob[]>;
  getByJobPostingId(jobPostingId: string): Promise<Application[]>;
  hasApplied(jobPostingId: string, applicantId: string): Promise<boolean>;
  getStatsByApplicantId(applicantId: string): Promise<Record<ApplicationStatus, number>>;
  getCancellationRequests(jobPostingId: string, ownerId: string): Promise<ApplicationWithJob[]>;

  // 트랜잭션 (원자적 처리)
  applyWithTransaction(input: CreateApplicationInput, context: ApplyContext): Promise<Application>;
  cancelWithTransaction(applicationId: string, applicantId: string): Promise<void>;
  requestCancellationWithTransaction(input: RequestCancellationInput, applicantId: string): Promise<void>;
  reviewCancellationWithTransaction(input: ReviewCancellationInput, reviewerId: string): Promise<void>;
  confirmWithTransaction(input: ConfirmApplicationInputV2, reviewerId: string): Promise<void>;
  rejectWithTransaction(input: RejectApplicationInput, reviewerId: string): Promise<void>;
  markAsRead(applicationId: string, ownerId: string): Promise<void>;
}
```

### Firebase 구현체 예시

```typescript
// src/repositories/firebase/ApplicationRepository.ts
export class FirebaseApplicationRepository implements IApplicationRepository {
  async applyWithTransaction(
    input: CreateApplicationInput,
    context: ApplyContext
  ): Promise<Application> {
    // Assignment 유효성 검증
    for (const assignment of input.assignments) {
      if (!isValidAssignment(assignment)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: '잘못된 지원 정보입니다.',
        });
      }
    }

    const result = await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 공고 정보 읽기 (트랜잭션 내 읽기 먼저)
      const jobRef = doc(getFirebaseDb(), 'jobPostings', input.jobPostingId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new ApplicationClosedError({ userMessage: '존재하지 않는 공고입니다' });
      }

      const jobData = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });

      // 2. 비즈니스 검증
      if (jobData.status !== 'active') {
        throw new ApplicationClosedError({ userMessage: '지원이 마감된 공고입니다' });
      }

      // 3. 중복 지원 검사
      const applicationId = `${input.jobPostingId}_${context.applicantId}`;
      const applicationRef = doc(getFirebaseDb(), 'applications', applicationId);
      const existingApp = await transaction.get(applicationRef);

      if (existingApp.exists()) {
        const existingData = parseApplicationDocument({ id: existingApp.id, ...existingApp.data() });
        if (existingData && existingData.status !== 'cancelled') {
          throw new AlreadyAppliedError({ userMessage: '이미 지원한 공고입니다' });
        }
      }

      // 4. 정원 확인
      const { total, filled } = getClosingStatus(jobData);
      if (total > 0 && filled >= total) {
        throw new MaxCapacityReachedError({ userMessage: '모집 인원이 마감되었습니다' });
      }

      // 5. 트랜잭션 쓰기 (원자적)
      const applicationData: Omit<Application, 'id'> = {
        applicantId: context.applicantId,
        applicantName: context.applicantName,
        jobPostingId: input.jobPostingId,
        status: 'applied',
        assignments: input.assignments,
        isRead: false,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };

      transaction.set(applicationRef, applicationData);
      transaction.update(jobRef, {
        applicationCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      return { id: applicationId, ...applicationData } as Application;
    });

    return result;
  }

  // ... 기타 메서드
}
```

### Repository 의존성 규칙

```
✅ Service → Repository → Firebase (권장)
✅ Hooks → Service → Repository (권장)
❌ Service → Firebase 직접 호출 (금지)
❌ Hooks → Firebase 직접 호출 (금지)
❌ Components → Firebase 직접 호출 (절대 금지)
```

---

## Authentication 서비스

### authService
```typescript
// src/services/authService.ts
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInWithCredential,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth, getFirebaseDb, doc, getDoc, setDoc, serverTimestamp } from '@/lib/firebase';

export const authService = {
  // 이메일 로그인
  async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      return await this.fetchAndSetUser(credential.user);
    } catch (error: any) {
      throw new AuthError(error.code, this.getErrorMessage(error.code));
    }
  },

  // 회원가입 (본인인증 데이터 필수)
  async signUpWithEmail(
    email: string,
    password: string,
    profileData: Partial<User>,
    identityData: IdentityVerificationData
  ): Promise<User> {
    // 1. CI 값으로 중복 가입 확인
    // 2. Firebase Auth 계정 생성
    // 3. Firestore에 프로필 + 본인인증 정보 저장
    // ...
  },

  // Google 로그인 (기존 사용자만)
  async signInWithGoogle(): Promise<User | { requiresSignup: true; email: string }> {
    // 신규 사용자는 회원가입 플로우(본인인증 필수)로 유도
    // ...
  },

  // 로그아웃
  async signOut(): Promise<void> {
    await signOut(getFirebaseAuth());
    useAuthStore.getState().logout();
  },

  // 인증 상태 리스너
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(getFirebaseAuth(), callback);
  },

  // 에러 메시지 변환
  getErrorMessage(code: string): string {
    const messages: Record<string, string> = {
      'auth/invalid-email': '유효하지 않은 이메일 형식입니다.',
      'auth/user-disabled': '비활성화된 계정입니다.',
      'auth/user-not-found': '등록되지 않은 이메일입니다.',
      'auth/wrong-password': '비밀번호가 일치하지 않습니다.',
      'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
      'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
      'auth/too-many-requests': '잠시 후 다시 시도해주세요.',
      'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
    };
    return messages[code] || '인증에 실패했습니다. 다시 시도해주세요.';
  },
};
```

### useAppInitialize 훅
```typescript
// src/hooks/useAppInitialize.ts
import { useEffect, useState } from 'react';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';

export function useAppInitialize() {
  const [isReady, setIsReady] = useState(false);
  const { setUser, setStatus } = useAuthStore();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          setStatus('loading');
          await authService.fetchAndSetUser(firebaseUser);
          setStatus('authenticated');
        } catch (error) {
          setStatus('unauthenticated');
        }
      } else {
        setStatus('unauthenticated');
      }
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  return { isReady };
}
```

---

## Firestore 서비스 레이어

### 서비스 목록 (37개)

```yaml
Core (8개):
  - authService: 로그인/회원가입/소셜로그인
  - jobService: 공고 조회/필터링/검색
  - applicationService: 지원 (Repository 사용)
  - scheduleService: WorkLogs + Applications 병합
  - workLogService: 근무 기록
  - notificationService: 알림 조회/읽음처리
  - reportService: 양방향 신고 시스템
  - searchService: 검색

Employer (5개):
  - jobManagementService: 공고 생성/수정/삭제
  - applicantManagementService: 지원자 확정/거절
  - settlementService: 정산 계산/처리 (가장 복잡)
  - confirmedStaffService: 확정 스태프 관리
  - applicationHistoryService: 확정/취소 이력

Admin (4개):
  - adminService: 사용자 관리
  - announcementService: 공지 관리
  - tournamentApprovalService: 대회공고 승인
  - inquiryService: 문의 관리

Infrastructure (20개):
  - pushNotificationService: expo-notifications 기반
  - eventQRService: QR 생성/검증 (3분 유효)
  - deepLinkService: 딥링크 라우팅
  - storageService: MMKV + SecureStore
  - sessionService: 토큰 관리
  - analyticsService: 이벤트 추적
  - crashlyticsService: Sentry 연동
  - performanceService: 성능 모니터링
  - featureFlagService: Remote Config (웹만)
  - templateService: 공고 템플릿
  - accountDeletionService: 계정 삭제
  - inAppMessageService: 인앱 메시지
  - applicantConversionService: 지원자 변환
  - biometricService: 생체인증
  - cacheService: 캐시 관리
  - versionService: 앱 버전 체크
  - tokenRefreshService: 토큰 갱신
  - notificationSyncService: 알림 동기화
  - settlement/* (4개): 정산 분리 모듈
```

---

## Push Notification (expo-notifications)

### FCM 설정

```typescript
// src/services/pushNotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getFirebaseDb, doc, updateDoc, serverTimestamp } from '@/lib/firebase';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const pushNotificationService = {
  // 권한 요청 및 토큰 등록
  async registerForPushNotifications(userId: string): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Expo Push Token 가져오기
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id',
    });
    const token = tokenData.data;

    // Firestore에 토큰 저장
    await updateDoc(doc(getFirebaseDb(), 'users', userId), {
      expoPushToken: token,
      pushTokenUpdatedAt: serverTimestamp(),
      platform: Platform.OS,
    });

    // Android 채널 설정
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    return token;
  },

  // 알림 리스너 설정
  addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  },

  // 알림 탭 리스너
  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },
};
```

### useNotificationHandler 훅
```typescript
// src/hooks/useNotificationHandler.ts
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { pushNotificationService } from '@/services/pushNotificationService';
import { useAuthStore } from '@/stores/authStore';
import { router } from 'expo-router';

export function useNotificationHandler() {
  const user = useAuthStore((s) => s.user);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    if (!user?.uid) return;

    // 토큰 등록
    pushNotificationService.registerForPushNotifications(user.uid);

    // 포그라운드 알림 리스너
    notificationListener.current = pushNotificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    // 알림 탭 리스너 (딥링크 처리)
    responseListener.current = pushNotificationService.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.uid]);
}

function handleNotificationNavigation(data: Record<string, unknown>) {
  const type = data?.type as string;
  const id = data?.id as string;

  switch (type) {
    case 'job_application':
      router.push(`/jobs/${id}`);
      break;
    case 'schedule_update':
      router.push(`/schedule/${id}`);
      break;
    default:
      router.push('/notifications');
  }
}
```

---

## 데이터 모델 (Firestore 컬렉션)

### 컬렉션 구조
```
firestore/
├── users/                      # 사용자
│   └── {userId}/
│       ├── profile data
│       ├── notifications/      # 서브컬렉션
│       └── qrMetadata/         # 서브컬렉션
│
├── jobPostings/                # 구인공고
│   └── {postingId}/
│       └── posting data
│
├── applications/               # 지원 (ID: {jobPostingId}_{applicantId})
│   └── {applicationId}/
│       └── application data
│
├── workLogs/                   # 근무 기록 (ID: {jobPostingId}_{staffId}_{date})
│   └── {workLogId}/
│       └── work log data
│
├── notifications/              # 알림
│   └── {notificationId}/
│       └── notification data
│
├── inquiries/                  # 문의
│   └── {inquiryId}/
│       └── inquiry data
│
├── reports/                    # 신고
│   └── {reportId}/
│       └── report data
│
├── announcements/              # 공지사항
│   └── {announcementId}/
│       └── announcement data
│
└── templates/                  # 공고 템플릿
    └── {templateId}/
        └── template data
```

### 인덱스 설정
```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "applications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "applicantId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "applications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "jobPostingId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "workLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "staffId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "workLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "jobPostingId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 트랜잭션 규칙 (필수)

### 트랜잭션 필수 사용 케이스

```typescript
// ❌ 금지: 여러 문서를 개별 업데이트 (데이터 불일치 위험)
await updateDoc(applicationRef, { status: 'confirmed' });
await updateDoc(jobPostingRef, { filledPositions: increment(1) });

// ✅ 필수: runTransaction으로 원자적 처리
await runTransaction(getFirebaseDb(), async (transaction) => {
  // 1. 모든 읽기 먼저
  const applicationDoc = await transaction.get(applicationRef);
  const jobPostingDoc = await transaction.get(jobPostingRef);

  // 2. 비즈니스 검증
  if (currentFilled >= totalPositions) {
    throw new MaxCapacityReachedError();
  }

  // 3. 모든 쓰기 실행 (원자적)
  transaction.update(applicationRef, { status: 'confirmed' });
  transaction.update(jobPostingRef, { filledPositions: increment(1) });
});
```

### 트랜잭션 필수 시나리오

| 시나리오 | 관련 문서 | 이유 |
|---------|----------|------|
| 지원하기 | applications, jobPostings | 중복 체크 + 카운트 증가 |
| 지원 취소 | applications, jobPostings | 상태 변경 + 카운트 감소 |
| 지원 확정 | applications, jobPostings, workLogs | 상태 + 정원 + WorkLog 생성 |
| 취소 요청 검토 | applications, jobPostings | 상태 변경 + 카운트 조정 |
| QR 출퇴근 | workLogs | 중복 체크인 방지 |
| 정산 처리 | workLogs, (payments) | 금액 정합성 |

---

## 에러 모니터링 (Sentry)

### 개요

Firebase Crashlytics 대신 Sentry를 사용합니다 (Expo 호환성).

```typescript
// src/services/crashlyticsService.ts (실제로는 Sentry 연동)
import * as Sentry from '@sentry/react-native';

export const crashlyticsService = {
  initialize() {
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      debug: __DEV__,
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      enableAutoSessionTracking: true,
    });
  },

  setUser(userId: string, email?: string) {
    Sentry.setUser({ id: userId, email });
  },

  clearUser() {
    Sentry.setUser(null);
  },

  logError(error: Error, context?: Record<string, unknown>) {
    Sentry.captureException(error, { extra: context });
  },

  logMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    Sentry.captureMessage(message, level);
  },

  addBreadcrumb(message: string, category?: string) {
    Sentry.addBreadcrumb({ message, category, level: 'info' });
  },
};
```

---

## 오프라인 지원

### 네트워크 상태 모니터링

```typescript
// src/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  return { isConnected };
}
```

### Firestore 오프라인 캐시

Firestore Web SDK는 기본적으로 오프라인 캐시를 지원합니다.

```typescript
// 캐시에서 데이터 읽기 (오프라인 시)
import { getDocsFromCache, getDocsFromServer } from 'firebase/firestore';

async function getJobsWithOfflineSupport(): Promise<JobPosting[]> {
  const jobsRef = collection(getFirebaseDb(), 'jobPostings');
  const q = query(jobsRef, where('status', '==', 'active'), orderBy('createdAt', 'desc'));

  try {
    // 서버 먼저 시도
    const snapshot = await getDocsFromServer(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as JobPosting[];
  } catch (error) {
    // 네트워크 오류 시 캐시 시도
    const cachedSnapshot = await getDocsFromCache(q);
    return cachedSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as JobPosting[];
  }
}
```

---

## 성능 최적화

### React Query 캐싱 정책

```typescript
// src/lib/queryClient.ts
export const cachingPolicies = {
  realtime: 0,              // 항상 fresh (notifications)
  frequent: 2 * 60 * 1000,  // 2분 (jobPostings.list)
  standard: 5 * 60 * 1000,  // 5분 (기본)
  stable: 30 * 60 * 1000,   // 30분 (settings)
  offlineFirst: Infinity,   // 무제한 (mySchedule)
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: cachingPolicies.standard,
      gcTime: 10 * 60 * 1000, // 10분
      retry: (failureCount, error) => {
        if (error instanceof NetworkError) return failureCount < 3;
        if (error instanceof AuthError) return false;
        return failureCount < 2;
      },
    },
  },
});
```

### Firestore 쿼리 최적화

```typescript
// 페이지네이션
const PAGE_SIZE = 20;

async function getJobsPaginated(lastDoc?: DocumentSnapshot) {
  let q = query(
    collection(getFirebaseDb(), 'jobPostings'),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  return getDocs(q);
}

// 선택적 필드만 읽기 (네트워크 절약)
// → Firestore는 문서 단위로 읽으므로 subcollection으로 분리 고려
```

---

## Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 헬퍼 함수
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // 사용자
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) &&
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'identity.ci']);
      allow delete: if false; // 계정 삭제는 Cloud Functions로만
    }

    // 공고
    match /jobPostings/{postingId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && resource.data.ownerId == request.auth.uid;
      allow delete: if isAuthenticated() && (resource.data.ownerId == request.auth.uid || isAdmin());
    }

    // 지원
    match /applications/{applicationId} {
      allow read: if isAuthenticated() && (
        resource.data.applicantId == request.auth.uid ||
        exists(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId)) &&
        get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId)).data.ownerId == request.auth.uid
      );
      allow create: if isAuthenticated() && request.resource.data.applicantId == request.auth.uid;
      allow update: if isAuthenticated(); // 트랜잭션으로 처리되므로 상세 규칙은 코드에서
      allow delete: if false;
    }

    // 근무 기록
    match /workLogs/{workLogId} {
      allow read: if isAuthenticated() && (
        resource.data.staffId == request.auth.uid ||
        resource.data.ownerId == request.auth.uid
      );
      allow create, update: if isAuthenticated();
      allow delete: if false;
    }

    // 알림
    match /notifications/{notificationId} {
      allow read, update: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if false; // Cloud Functions로만 생성
      allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## 마이그레이션 노트

### @react-native-firebase에서 Firebase Web SDK로

```yaml
변경 전: @react-native-firebase/*
변경 후: firebase (Web SDK Modular API)

주요 변경점:
  1. 네이티브 모듈 의존 제거
  2. Expo Go에서 바로 테스트 가능
  3. Tree-shaking 지원으로 번들 크기 감소
  4. 지연 초기화 패턴으로 앱 시작 성능 개선

코드 변경 예시:
  # Before
  import auth from '@react-native-firebase/auth';
  await auth().signInWithEmailAndPassword(email, password);

  # After
  import { signInWithEmailAndPassword } from 'firebase/auth';
  import { getFirebaseAuth } from '@/lib/firebase';
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
```
