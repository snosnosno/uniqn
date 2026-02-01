# 06. Firebase 연동 전략

> **마지막 업데이트**: 2026년 2월

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
```

### 초기화 설정 (지연 초기화 + Proxy 패턴)
```typescript
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import Constants from 'expo-constants';

// 환경변수에서 Firebase 설정 가져오기
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.FIREBASE_APP_ID,
};

// 지연 초기화 (앱 시작 시점 최적화)
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _functions: Functions | null = null;

const getFirebaseApp = (): FirebaseApp => {
  if (!_app) {
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return _app;
};

// Proxy 패턴으로 지연 접근
export const auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_auth) {
      _auth = getAuth(getFirebaseApp());
    }
    return (_auth as any)[prop];
  },
});

export const db = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_db) {
      _db = getFirestore(getFirebaseApp());
    }
    return (_db as any)[prop];
  },
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(_, prop) {
    if (!_storage) {
      _storage = getStorage(getFirebaseApp());
    }
    return (_storage as any)[prop];
  },
});

export const functions = new Proxy({} as Functions, {
  get(_, prop) {
    if (!_functions) {
      _functions = getFunctions(getFirebaseApp(), 'asia-northeast3');
    }
    return (_functions as any)[prop];
  },
});

// 실제 인스턴스 반환 함수 (필요한 경우)
export const getAuthInstance = () => {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
};

export const getDbInstance = () => {
  if (!_db) _db = getFirestore(getFirebaseApp());
  return _db;
};
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
          "ios": {
            "useFrameworks": "static"
          }
        }
      ]
    ],
    "extra": {
      "eas": { "projectId": "..." },
      "FIREBASE_API_KEY": "...",
      "FIREBASE_AUTH_DOMAIN": "...",
      "FIREBASE_PROJECT_ID": "tholdem-ebc18",
      "FIREBASE_STORAGE_BUCKET": "...",
      "FIREBASE_MESSAGING_SENDER_ID": "...",
      "FIREBASE_APP_ID": "..."
    }
  }
}
```

---

## Authentication 서비스

### authService
```typescript
// src/services/auth/authService.ts
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '@/stores/authStore';
import { AuthError } from '@/utils/errors';
import type { User } from '@/types';

// 본인인증 데이터 타입
interface IdentityVerificationData {
  name: string;              // 실명
  birthDate: string;         // 생년월일 (YYYYMMDD)
  gender: 'M' | 'F';         // 성별
  phone: string;             // 휴대폰 번호
  ci: string;                // 연계정보 (중복가입 방지)
  method: 'pass' | 'kakao' | 'nice';  // 인증 방법
}

// Google Sign-In 설정
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export const authService = {
  // 이메일 로그인
  async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      const credential = await auth().signInWithEmailAndPassword(email, password);
      return await this.fetchAndSetUser(credential.user);
    } catch (error: any) {
      throw new AuthError(error.code, this.getErrorMessage(error.code));
    }
  },

  // 회원가입 (본인인증 필수)
  async signUpWithEmail(
    email: string,
    password: string,
    profileData: Partial<User>,
    identityData: IdentityVerificationData  // 본인인증 데이터 필수
  ): Promise<User> {
    try {
      // 1. CI 값으로 중복 가입 확인
      const existingUser = await firestore()
        .collection('users')
        .where('identity.ci', '==', identityData.ci)
        .limit(1)
        .get();

      if (!existingUser.empty) {
        throw new AuthError('DUPLICATE_USER', '이미 가입된 회원입니다.');
      }

      // 2. Firebase Auth 계정 생성
      const credential = await auth().createUserWithEmailAndPassword(email, password);

      // 3. Firestore에 프로필 + 본인인증 정보 저장
      await firestore().collection('users').doc(credential.user.uid).set({
        ...profileData,
        email,
        role: 'staff',  // 기본 역할
        // 본인인증 정보 (필수)
        identity: {
          verified: true,
          name: identityData.name,
          birthDate: identityData.birthDate,
          gender: identityData.gender,
          phoneLastFour: identityData.phone.slice(-4),
          ci: identityData.ci,  // 중복 확인용
          verifiedAt: firestore.FieldValue.serverTimestamp(),
          method: identityData.method,
        },
        displayName: identityData.name,  // 실명 사용
        phone: identityData.phone,
        consentCompleted: false,
        profileCompleted: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // 4. 이메일 인증 발송 - 사용하지 않음 (휴대폰 본인인증으로 대체)
      // await credential.user.sendEmailVerification();

      return await this.fetchAndSetUser(credential.user);
    } catch (error: any) {
      throw new AuthError(error.code, this.getErrorMessage(error.code));
    }
  },

  // Google 로그인 (기존 사용자만)
  // 신규 사용자는 회원가입 플로우(본인인증 필수)로 유도
  async signInWithGoogle(): Promise<User | { requiresSignup: true; email: string }> {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const credential = await auth().signInWithCredential(googleCredential);

      // 기존 사용자 확인
      const userDoc = await firestore()
        .collection('users')
        .doc(credential.user.uid)
        .get();

      if (!userDoc.exists) {
        // 신규 사용자: 로그아웃 후 회원가입 플로우로 유도
        // (본인인증 필수이므로 Google 로그인만으로 가입 불가)
        await auth().signOut();
        return {
          requiresSignup: true,
          email: credential.user.email || '',
        };
      }

      // 본인인증 완료 여부 확인
      const userData = userDoc.data();
      if (!userData?.identity?.verified) {
        // 본인인증 미완료 사용자
        throw new AuthError(
          'IDENTITY_NOT_VERIFIED',
          '본인인증이 필요합니다. 회원가입을 완료해주세요.'
        );
      }

      return await this.fetchAndSetUser(credential.user);
    } catch (error: any) {
      throw new AuthError(error.code || 'GOOGLE_SIGN_IN_ERROR', '구글 로그인에 실패했습니다.');
    }
  },

  // 로그아웃
  async signOut(): Promise<void> {
    try {
      await auth().signOut();
      try {
        await GoogleSignin.signOut();
      } catch {
        // Google 로그인이 아닌 경우 무시
      }
      useAuthStore.getState().logout();
    } catch (error: any) {
      throw new AuthError(error.code, '로그아웃에 실패했습니다.');
    }
  },

  // 비밀번호 재설정
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error: any) {
      throw new AuthError(error.code, this.getErrorMessage(error.code));
    }
  },

  // 사용자 데이터 조회 및 Store 업데이트
  async fetchAndSetUser(firebaseUser: FirebaseAuthTypes.User): Promise<User> {
    const userDoc = await firestore()
      .collection('users')
      .doc(firebaseUser.uid)
      .get();

    const userData = userDoc.data();

    // 패널티 확인
    if (userData?.penalty?.isBlocked) {
      const now = new Date();
      const blockedUntil = userData.penalty.blockedUntil?.toDate();
      if (blockedUntil && blockedUntil > now) {
        throw new AuthError('ACCOUNT_BLOCKED', '계정이 정지되었습니다.');
      }
    }

    const user: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: userData?.displayName || firebaseUser.displayName,
      photoURL: userData?.photoURL || firebaseUser.photoURL,
      role: userData?.role || 'user',
      consentCompleted: userData?.consentCompleted || false,
      profileCompleted: userData?.profileCompleted || false,
    };

    useAuthStore.getState().setUser(user);
    return user;
  },

  // 인증 상태 리스너
  onAuthStateChanged(callback: (user: FirebaseAuthTypes.User | null) => void) {
    return auth().onAuthStateChanged(callback);
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

### useAuthListener 훅
```typescript
// src/hooks/useAuthListener.ts
import { useEffect } from 'react';
import { authService } from '@/services/auth/authService';
import { useAuthStore } from '@/stores/authStore';

export function useAuthListener() {
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await authService.fetchAndSetUser(firebaseUser);
        } catch (error) {
          // 패널티 등의 이유로 로그인 불가
          logout();
        }
      } else {
        logout();
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);
}
```

---

## Firestore 서비스

### 기본 CRUD 서비스
```typescript
// src/services/firebase/firestoreService.ts
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { AppError } from '@/utils/errors';

type QueryConstraint = FirebaseFirestoreTypes.QueryConstraint;
type DocumentData = FirebaseFirestoreTypes.DocumentData;

export const firestoreService = {
  // 문서 조회
  async getDoc<T>(
    collectionPath: string,
    docId: string
  ): Promise<T | null> {
    try {
      const doc = await firestore().collection(collectionPath).doc(docId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as T;
    } catch (error) {
      throw new AppError('FIRESTORE_ERROR', 'FETCH_FAILED', '데이터 조회에 실패했습니다.');
    }
  },

  // 컬렉션 조회
  async getDocs<T>(
    collectionPath: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    try {
      let query: FirebaseFirestoreTypes.Query = firestore().collection(collectionPath);

      for (const constraint of constraints) {
        query = query.where(
          constraint.fieldPath,
          constraint.opStr,
          constraint.value
        );
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
    } catch (error) {
      throw new AppError('FIRESTORE_ERROR', 'FETCH_FAILED', '데이터 조회에 실패했습니다.');
    }
  },

  // 문서 생성
  async addDoc<T extends DocumentData>(
    collectionPath: string,
    data: Omit<T, 'id'>
  ): Promise<string> {
    try {
      const docRef = await firestore().collection(collectionPath).add({
        ...data,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      throw new AppError('FIRESTORE_ERROR', 'CREATE_FAILED', '데이터 생성에 실패했습니다.');
    }
  },

  // 문서 업데이트
  async updateDoc(
    collectionPath: string,
    docId: string,
    data: Partial<DocumentData>
  ): Promise<void> {
    try {
      await firestore().collection(collectionPath).doc(docId).update({
        ...data,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      throw new AppError('FIRESTORE_ERROR', 'UPDATE_FAILED', '데이터 수정에 실패했습니다.');
    }
  },

  // 문서 삭제
  async deleteDoc(collectionPath: string, docId: string): Promise<void> {
    try {
      await firestore().collection(collectionPath).doc(docId).delete();
    } catch (error) {
      throw new AppError('FIRESTORE_ERROR', 'DELETE_FAILED', '데이터 삭제에 실패했습니다.');
    }
  },

  // 배치 쓰기
  async batchWrite(
    operations: Array<{
      type: 'set' | 'update' | 'delete';
      collection: string;
      docId: string;
      data?: DocumentData;
    }>
  ): Promise<void> {
    try {
      const batch = firestore().batch();

      for (const op of operations) {
        const docRef = firestore().collection(op.collection).doc(op.docId);

        switch (op.type) {
          case 'set':
            batch.set(docRef, {
              ...op.data,
              updatedAt: firestore.FieldValue.serverTimestamp(),
            });
            break;
          case 'update':
            batch.update(docRef, {
              ...op.data,
              updatedAt: firestore.FieldValue.serverTimestamp(),
            });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      }

      await batch.commit();
    } catch (error) {
      throw new AppError('FIRESTORE_ERROR', 'BATCH_FAILED', '일괄 처리에 실패했습니다.');
    }
  },

  // 실시간 구독
  subscribe<T>(
    collectionPath: string,
    constraints: QueryConstraint[],
    onData: (data: T[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    let query: FirebaseFirestoreTypes.Query = firestore().collection(collectionPath);

    for (const constraint of constraints) {
      query = query.where(
        constraint.fieldPath,
        constraint.opStr,
        constraint.value
      );
    }

    return query.onSnapshot(
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        onData(data);
      },
      (error) => {
        onError?.(error);
      }
    );
  },
};
```

### 구인공고 서비스
```typescript
// src/services/job/jobPostingService.ts
import firestore from '@react-native-firebase/firestore';
import { firestoreService } from '@/services/firebase/firestoreService';
import type { JobPosting, JobFilters, Application } from '@/types';

export const jobPostingService = {
  // 필터링된 공고 조회
  async getFiltered(filters: JobFilters): Promise<JobPosting[]> {
    let query = firestore()
      .collection('jobPostings')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc');

    // 지역 필터
    if (filters.location.length > 0) {
      query = query.where('location.district', 'in', filters.location);
    }

    // 날짜 필터
    if (filters.dateFrom) {
      query = query.where('dates', 'array-contains-any', [filters.dateFrom]);
    }

    // 공고 유형 필터
    if (filters.postingType.length > 0) {
      query = query.where('postingType', 'in', filters.postingType);
    }

    const snapshot = await query.limit(50).get();

    let jobs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JobPosting[];

    // 클라이언트 측 추가 필터링 (Firestore 제한)
    if (filters.salaryMin) {
      jobs = jobs.filter((job) => job.salary >= filters.salaryMin!);
    }
    if (filters.salaryMax) {
      jobs = jobs.filter((job) => job.salary <= filters.salaryMax!);
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      jobs = jobs.filter(
        (job) =>
          job.title.toLowerCase().includes(query) ||
          job.location.address.toLowerCase().includes(query)
      );
    }

    return jobs;
  },

  // 상세 조회
  async getById(id: string): Promise<JobPosting | null> {
    return firestoreService.getDoc<JobPosting>('jobPostings', id);
  },

  // 지원하기
  async apply(jobId: string, applicationData: Partial<Application>): Promise<string> {
    const applicationId = await firestoreService.addDoc('applications', {
      ...applicationData,
      jobId,
      status: 'pending',
    });

    // 공고 지원자 수 업데이트
    await firestore()
      .collection('jobPostings')
      .doc(jobId)
      .update({
        applicantCount: firestore.FieldValue.increment(1),
      });

    return applicationId;
  },

  // 지원 취소
  async cancelApplication(applicationId: string, jobId: string): Promise<void> {
    await firestoreService.updateDoc('applications', applicationId, {
      status: 'cancelled',
    });

    await firestore()
      .collection('jobPostings')
      .doc(jobId)
      .update({
        applicantCount: firestore.FieldValue.increment(-1),
      });
  },

  // 내 지원 목록
  async getMyApplications(userId: string): Promise<Application[]> {
    const snapshot = await firestore()
      .collection('applications')
      .where('applicantId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Application[];
  },
};
```

---

## Storage 서비스

```typescript
// src/services/firebase/storageService.ts
import storage from '@react-native-firebase/storage';
import { AppError } from '@/utils/errors';

export const storageService = {
  // 이미지 업로드
  async uploadImage(
    path: string,
    uri: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      const reference = storage().ref(path);
      const task = reference.putFile(uri);

      if (onProgress) {
        task.on('state_changed', (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        });
      }

      await task;
      return await reference.getDownloadURL();
    } catch (error) {
      throw new AppError('STORAGE_ERROR', 'UPLOAD_FAILED', '이미지 업로드에 실패했습니다.');
    }
  },

  // 프로필 이미지 업로드
  async uploadProfileImage(
    userId: string,
    uri: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const path = `profiles/${userId}/${Date.now()}.jpg`;
    return this.uploadImage(path, uri, onProgress);
  },

  // 이미지 삭제
  async deleteImage(url: string): Promise<void> {
    try {
      const reference = storage().refFromURL(url);
      await reference.delete();
    } catch (error) {
      // 이미 삭제된 경우 무시
      console.warn('Image already deleted or not found');
    }
  },
};
```

---

## Push Notification (FCM)

### FCM 설정
```typescript
// src/services/notification/fcmService.ts
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const FCM_TOKEN_KEY = 'fcm_token';

export const fcmService = {
  // 권한 요청
  async requestPermission(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  },

  // FCM 토큰 조회 및 저장
  async getAndSaveToken(userId: string): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) return null;

      const token = await messaging().getToken();
      const savedToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);

      // 토큰이 변경된 경우에만 저장
      if (token !== savedToken) {
        await firestore().collection('users').doc(userId).update({
          fcmToken: token,
          fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
          platform: Platform.OS,
        });
        await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      }

      return token;
    } catch (error) {
      console.error('FCM token error:', error);
      return null;
    }
  },

  // 토큰 갱신 리스너
  onTokenRefresh(userId: string, callback?: (token: string) => void) {
    return messaging().onTokenRefresh(async (token) => {
      await firestore().collection('users').doc(userId).update({
        fcmToken: token,
        fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
      });
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      callback?.(token);
    });
  },

  // 포그라운드 메시지 핸들러
  onForegroundMessage(
    callback: (message: messaging.RemoteMessage) => void
  ) {
    return messaging().onMessage(callback);
  },

  // 백그라운드 메시지 핸들러 (앱 외부에서 호출)
  setBackgroundMessageHandler(
    handler: (message: messaging.RemoteMessage) => Promise<void>
  ) {
    messaging().setBackgroundMessageHandler(handler);
  },

  // 알림 클릭 핸들러
  onNotificationOpenedApp(
    callback: (message: messaging.RemoteMessage) => void
  ) {
    return messaging().onNotificationOpenedApp(callback);
  },

  // 앱이 종료된 상태에서 알림으로 열린 경우
  async getInitialNotification(): Promise<messaging.RemoteMessage | null> {
    return messaging().getInitialNotification();
  },
};
```

### FCM 초기화 훅
```typescript
// src/hooks/useFCM.ts
import { useEffect } from 'react';
import { fcmService } from '@/services/notification/fcmService';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { navigation } from '@/utils/navigation';

export function useFCM() {
  const user = useAuthStore((s) => s.user);
  const { show: showToast } = useToastStore();

  useEffect(() => {
    if (!user?.uid) return;

    // 토큰 등록
    fcmService.getAndSaveToken(user.uid);

    // 토큰 갱신 리스너
    const unsubscribeToken = fcmService.onTokenRefresh(user.uid);

    // 포그라운드 메시지 핸들러
    const unsubscribeMessage = fcmService.onForegroundMessage((message) => {
      showToast({
        type: 'info',
        message: message.notification?.body || '새 알림이 있습니다.',
      });
    });

    // 알림 클릭 핸들러
    const unsubscribeOpened = fcmService.onNotificationOpenedApp((message) => {
      handleNotificationNavigation(message.data);
    });

    // 앱 종료 상태에서 열린 경우
    fcmService.getInitialNotification().then((message) => {
      if (message) {
        handleNotificationNavigation(message.data);
      }
    });

    return () => {
      unsubscribeToken();
      unsubscribeMessage();
      unsubscribeOpened();
    };
  }, [user?.uid]);
}

function handleNotificationNavigation(data?: Record<string, string>) {
  if (!data?.type) return;

  switch (data.type) {
    case 'job_application':
      navigation.toJobPostingDetail(data.jobId);
      break;
    case 'schedule_update':
      navigation.toScheduleDetail(data.scheduleId);
      break;
    case 'message':
      navigation.toNotifications();
      break;
    default:
      navigation.toNotifications();
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
├── applications/               # 지원
│   └── {applicationId}/
│       └── application data
│
├── workLogs/                   # 근무 기록
│   └── {workLogId}/
│       └── work log data
│
├── inquiries/                  # 문의
│   └── {inquiryId}/
│       └── inquiry data
│
└── staff/                      # 스태프 정보
    └── {staffId}/
        └── staff data
```

### 인덱스 설정
```
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
      "collectionGroup": "workLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "staffId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 오프라인 지원

### 오프라인 캐시 설정
```typescript
// Firestore 오프라인 지원 (기본 활성화)
firestore().settings({
  persistence: true,
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
});

// 네트워크 상태 확인
import NetInfo from '@react-native-community/netinfo';

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
}

// 오프라인 시 캐시된 데이터 사용
async function getJobsWithOfflineSupport(): Promise<JobPosting[]> {
  try {
    const online = await isOnline();

    if (!online) {
      // 캐시에서 읽기
      const snapshot = await firestore()
        .collection('jobPostings')
        .get({ source: 'cache' });

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as JobPosting[];
    }

    // 온라인: 서버에서 읽기
    const snapshot = await firestore()
      .collection('jobPostings')
      .get({ source: 'server' });

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JobPosting[];
  } catch (error) {
    // 네트워크 오류 시 캐시 시도
    const snapshot = await firestore()
      .collection('jobPostings')
      .get({ source: 'cache' });

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JobPosting[];
  }
}
```

---

## Geo-Query 솔루션

### 개요

Firestore는 네이티브 geo-query를 지원하지 않으므로 **Geohash** 기반 솔루션을 사용합니다.

```yaml
솔루션: Geohash + 클라이언트 필터링
라이브러리: geofire-common (경량, Firebase 공식 권장)
정확도: 1~12자리 (1자리 ≈ 5,000km, 6자리 ≈ 1.2km, 9자리 ≈ 5m)
```

### 패키지 설치

```bash
npm install geofire-common
```

### Geohash 유틸리티

```typescript
// src/utils/geo.ts
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoQueryResult<T> {
  data: T;
  distance: number; // km
}

/**
 * 좌표를 Geohash로 변환
 */
export function encodeGeohash(point: GeoPoint, precision: number = 9): string {
  return geohashForLocation([point.latitude, point.longitude], precision);
}

/**
 * 반경 내 검색을 위한 Geohash 범위 계산
 * @param center 중심 좌표
 * @param radiusKm 반경 (km)
 */
export function getGeohashBounds(center: GeoPoint, radiusKm: number) {
  return geohashQueryBounds([center.latitude, center.longitude], radiusKm * 1000);
}

/**
 * 두 지점 간 거리 계산 (km)
 */
export function calculateDistance(from: GeoPoint, to: GeoPoint): number {
  return distanceBetween(
    [from.latitude, from.longitude],
    [to.latitude, to.longitude]
  );
}

/**
 * 결과를 거리순으로 정렬 및 필터링
 */
export function filterByRadius<T extends { location: { geohash: string; latitude: number; longitude: number } }>(
  items: T[],
  center: GeoPoint,
  radiusKm: number
): GeoQueryResult<T>[] {
  return items
    .map((item) => ({
      data: item,
      distance: calculateDistance(center, {
        latitude: item.location.latitude,
        longitude: item.location.longitude,
      }),
    }))
    .filter((result) => result.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}
```

### 데이터 저장 시 Geohash 포함

```typescript
// src/services/job/jobPostingService.ts
import firestore from '@react-native-firebase/firestore';
import { encodeGeohash } from '@/utils/geo';

export async function createJobPosting(data: JobPostingInput): Promise<string> {
  const geohash = encodeGeohash({
    latitude: data.location.latitude,
    longitude: data.location.longitude,
  });

  const docRef = await firestore().collection('jobPostings').add({
    ...data,
    location: {
      ...data.location,
      geohash, // Geohash 저장
    },
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  return docRef.id;
}
```

### 위치 기반 검색 서비스

```typescript
// src/services/job/geoJobService.ts
import firestore from '@react-native-firebase/firestore';
import { getGeohashBounds, filterByRadius, GeoPoint, GeoQueryResult } from '@/utils/geo';
import type { JobPosting } from '@/types';

interface GeoSearchOptions {
  center: GeoPoint;
  radiusKm: number;
  limit?: number;
  filters?: {
    status?: string;
    roles?: string[];
  };
}

export async function searchJobsByLocation(
  options: GeoSearchOptions
): Promise<GeoQueryResult<JobPosting>[]> {
  const { center, radiusKm, limit = 50, filters } = options;

  // 1. Geohash 범위 계산
  const bounds = getGeohashBounds(center, radiusKm);

  // 2. 병렬 쿼리 실행 (각 범위별)
  const promises = bounds.map(([start, end]) => {
    let query = firestore()
      .collection('jobPostings')
      .where('location.geohash', '>=', start)
      .where('location.geohash', '<=', end);

    // 추가 필터 (선택적)
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }

    return query.limit(limit).get();
  });

  const snapshots = await Promise.all(promises);

  // 3. 결과 병합 및 중복 제거
  const seen = new Set<string>();
  const allItems: JobPosting[] = [];

  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        allItems.push({ id: doc.id, ...doc.data() } as JobPosting);
      }
    }
  }

  // 4. 정확한 거리 계산 및 필터링 (클라이언트 측)
  const filtered = filterByRadius(allItems, center, radiusKm);

  // 5. 클라이언트 측 추가 필터링
  let result = filtered;
  if (filters?.roles?.length) {
    result = result.filter((item) =>
      filters.roles!.some((role) => item.data.requiredRoles?.includes(role))
    );
  }

  return result.slice(0, limit);
}
```

### React Hook

```typescript
// src/hooks/queries/useNearbyJobs.ts
import { useQuery } from '@tanstack/react-query';
import { searchJobsByLocation } from '@/services/job/geoJobService';
import { useUserLocation } from '@/hooks/useUserLocation';

interface UseNearbyJobsOptions {
  radiusKm?: number;
  enabled?: boolean;
}

export function useNearbyJobs({ radiusKm = 10, enabled = true }: UseNearbyJobsOptions = {}) {
  const { location, isLoading: locationLoading } = useUserLocation();

  return useQuery({
    queryKey: ['nearbyJobs', location?.latitude, location?.longitude, radiusKm],
    queryFn: () =>
      searchJobsByLocation({
        center: location!,
        radiusKm,
        filters: { status: 'active' },
      }),
    enabled: enabled && !!location && !locationLoading,
    staleTime: 2 * 60 * 1000, // 2분
  });
}
```

### Firestore 인덱스 설정

```json
// firestore.indexes.json에 추가
{
  "indexes": [
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "location.geohash", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 성능 고려사항

```yaml
반경별 권장 설정:
  1km 이하: precision 7, 쿼리 범위 좁음
  1-5km: precision 6, 일반적 사용
  5-20km: precision 5, 범위 넓음
  20km 이상: precision 4, 다중 쿼리 증가

최적화 전략:
  - 캐싱: 위치 변경 100m 미만 시 캐시 재사용
  - 페이지네이션: 대량 결과 시 cursor 기반 로딩
  - 인덱스: location.geohash + status 복합 인덱스 필수
```

---

## Security Rules 테스트

### 개요

Firebase Security Rules는 프로덕션 배포 전 반드시 테스트해야 합니다.

### 테스트 환경 설정

```bash
# Firebase Emulator 설치
npm install -g firebase-tools
firebase init emulators

# 에뮬레이터 실행
firebase emulators:start --only firestore
```

### 테스트 유틸리티

```typescript
// tests/rules/testUtils.ts
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

export async function setupTestEnv() {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
  return testEnv;
}

export async function cleanupTestEnv() {
  await testEnv?.cleanup();
}

export function getAuthenticatedContext(uid: string, customClaims?: object) {
  return testEnv.authenticatedContext(uid, customClaims);
}

export function getUnauthenticatedContext() {
  return testEnv.unauthenticatedContext();
}

export { assertFails, assertSucceeds };
```

### Security Rules 테스트 케이스

```typescript
// tests/rules/jobPostings.test.ts
import {
  setupTestEnv,
  cleanupTestEnv,
  getAuthenticatedContext,
  getUnauthenticatedContext,
  assertFails,
  assertSucceeds,
} from './testUtils';

describe('jobPostings Security Rules', () => {
  beforeAll(async () => {
    await setupTestEnv();
  });

  afterAll(async () => {
    await cleanupTestEnv();
  });

  describe('읽기 권한', () => {
    it('인증된 사용자는 active 공고를 읽을 수 있다', async () => {
      const db = getAuthenticatedContext('user1').firestore();
      await assertSucceeds(
        db.collection('jobPostings').where('status', '==', 'active').get()
      );
    });

    it('비인증 사용자는 공고를 읽을 수 없다', async () => {
      const db = getUnauthenticatedContext().firestore();
      await assertFails(db.collection('jobPostings').get());
    });
  });

  describe('쓰기 권한', () => {
    it('공고 작성자만 수정할 수 있다', async () => {
      const ownerDb = getAuthenticatedContext('owner1').firestore();
      const otherDb = getAuthenticatedContext('other1').firestore();

      // 작성자는 수정 가능
      await assertSucceeds(
        ownerDb.collection('jobPostings').doc('job1').update({ title: 'Updated' })
      );

      // 다른 사용자는 수정 불가
      await assertFails(
        otherDb.collection('jobPostings').doc('job1').update({ title: 'Hacked' })
      );
    });

    it('admin은 모든 공고를 삭제할 수 있다', async () => {
      const adminDb = getAuthenticatedContext('admin1', { role: 'admin' }).firestore();
      await assertSucceeds(
        adminDb.collection('jobPostings').doc('job1').delete()
      );
    });
  });

  describe('데이터 검증', () => {
    it('필수 필드 없이 생성 불가', async () => {
      const db = getAuthenticatedContext('user1').firestore();
      await assertFails(
        db.collection('jobPostings').add({
          // title 필드 누락
          description: 'Test',
        })
      );
    });

    it('유효하지 않은 status 값 거부', async () => {
      const db = getAuthenticatedContext('user1').firestore();
      await assertFails(
        db.collection('jobPostings').add({
          title: 'Test',
          status: 'invalid_status', // 유효하지 않은 값
        })
      );
    });
  });
});
```

### 사용자 문서 테스트

```typescript
// tests/rules/users.test.ts
import {
  setupTestEnv,
  cleanupTestEnv,
  getAuthenticatedContext,
  assertFails,
  assertSucceeds,
} from './testUtils';

describe('users Security Rules', () => {
  beforeAll(async () => {
    await setupTestEnv();
  });

  afterAll(async () => {
    await cleanupTestEnv();
  });

  it('자신의 프로필만 읽을 수 있다', async () => {
    const user1Db = getAuthenticatedContext('user1').firestore();

    // 자신의 문서는 읽기 가능
    await assertSucceeds(user1Db.collection('users').doc('user1').get());

    // 다른 사용자 문서는 읽기 불가 (공개 필드 제외)
    await assertFails(user1Db.collection('users').doc('user2').get());
  });

  it('자신의 프로필만 수정할 수 있다', async () => {
    const user1Db = getAuthenticatedContext('user1').firestore();

    await assertSucceeds(
      user1Db.collection('users').doc('user1').update({
        displayName: 'New Name',
      })
    );

    await assertFails(
      user1Db.collection('users').doc('user2').update({
        displayName: 'Hacked',
      })
    );
  });

  it('role 필드는 admin만 수정 가능', async () => {
    const userDb = getAuthenticatedContext('user1').firestore();
    const adminDb = getAuthenticatedContext('admin1', { role: 'admin' }).firestore();

    // 일반 사용자는 role 변경 불가
    await assertFails(
      userDb.collection('users').doc('user1').update({ role: 'admin' })
    );

    // admin은 role 변경 가능
    await assertSucceeds(
      adminDb.collection('users').doc('user1').update({ role: 'manager' })
    );
  });
});
```

### CI/CD 통합

```yaml
# .github/workflows/test-rules.yml
name: Test Security Rules

on:
  push:
    paths:
      - 'firestore.rules'
      - 'tests/rules/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Firebase CLI
        run: npm install -g firebase-tools

      - name: Start Emulator and Run Tests
        run: |
          firebase emulators:exec --only firestore "npm run test:rules"
```

### 테스트 스크립트

```json
// package.json
{
  "scripts": {
    "test:rules": "jest tests/rules --config jest.rules.config.js",
    "test:rules:watch": "firebase emulators:exec --only firestore 'jest tests/rules --watch'"
  }
}
```
```
