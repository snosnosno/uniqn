# 📱 T-HOLDEM 모바일 앱 개발 가이드

**최종 업데이트**: 2025년 9월 10일  
**버전**: v0.1.0 (개발 단계)  
**상태**: 🚧 **계획 단계 - MVP 이후**

> [!NOTE]
> **안내**: 이 문서는 MVP(v0.1.0) 이후 진행될 네이티브 모바일 앱 개발을 위한 계획 문서입니다.

## 📋 목차

1. [개요](#-개요)
2. [모바일 앱 전략](#-모바일-앱-전략)
3. [React Native 개발](#-react-native-개발)
4. [Flutter 개발](#-flutter-개발)
5. [API 연동](#-api-연동)
6. [PWA 대안](#-pwa-대안)
7. [배포 전략](#-배포-전략)
8. [로드맵](#-로드맵)

## 🎯 개요

T-HOLDEM 프로젝트의 모바일 앱 개발을 위한 종합 가이드입니다. 현재 웹 기반 플랫폼을 모바일 네이티브 앱으로 확장하는 전략과 구현 방법을 제시합니다.

### 현재 상황
- **웹 플랫폼**: React 18 + TypeScript + Firebase ✅
- **PWA 지원**: 기본 구현 (반응형 디자인) ✅
- **모바일 최적화**: 터치 인터페이스, 뷰포트 최적화 ✅
- **네이티브 앱**: 준비 단계 📱

### 타겟 플랫폼
- **우선순위**: Android (한국 시장 점유율 75%)
- **2차**: iOS (프리미엄 사용자층)
- **보완**: PWA (크로스 플랫폼 대안)

## 🚀 모바일 앱 전략

### 1. 플랫폼 선택 기준

| 요소 | React Native | Flutter | PWA |
|------|-------------|---------|-----|
| **개발 속도** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **성능** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **기존 코드 재사용** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Firebase 연동** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **유지보수** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

### 2. 권장 접근법

**Phase 1: PWA 고도화** (2주)
- 오프라인 지원 추가
- 푸시 알림 구현
- 앱 설치 프롬프트
- 네이티브 기능 Polyfill

**Phase 2: React Native 개발** (8주)
- 기존 React 컴포넌트 재활용
- Firebase SDK 연동
- 네이티브 모듈 개발
- E2E 테스트 자동화

**Phase 3: 배포 및 최적화** (4주)
- Play Store / App Store 배포
- 성능 최적화
- 사용자 피드백 반영
- 운영 체계 구축

### 3. 핵심 기능 우선순위

**필수 기능 (MVP)**:
- 사용자 인증 (Firebase Auth)
- 구인공고 조회 및 지원
- 내 스케줄 확인
- 출석 체크 (QR 코드)
- 푸시 알림

**고급 기능**:
- 오프라인 데이터 동기화
- 실시간 채팅
- 위치 기반 서비스
- 생체 인증
- 카메라 통합

## ⚛️ React Native 개발

### 환경 설정

```bash
# React Native CLI 설치
npm install -g react-native-cli

# 프로젝트 생성
npx react-native init TholdemMobile --template react-native-template-typescript

# 필수 패키지 설치
cd TholdemMobile
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
npm install @react-navigation/native @react-navigation/stack
npm install react-native-vector-icons react-native-qrcode-scanner
npm install @tanstack/react-query react-native-async-storage
```

### 프로젝트 구조

```
TholdemMobile/
├── src/
│   ├── components/      # 웹에서 재사용 가능한 컴포넌트
│   ├── screens/         # 네이티브 스크린
│   ├── navigation/      # React Navigation 설정
│   ├── services/        # Firebase 서비스 (웹과 공유)
│   ├── hooks/          # 커스텀 훅 (웹과 공유)
│   ├── utils/          # 유틸리티 (웹과 공유)
│   └── types/          # TypeScript 타입 (웹과 공유)
├── android/
├── ios/
└── shared/             # 웹과 공유하는 코드
```

### Firebase 설정

```typescript
// firebase.config.ts
import { initializeApp, getApps } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}

export { auth, firestore };
```

### 컴포넌트 재사용 전략

```typescript
// shared/components/JobCard.tsx (웹과 공유)
import React from 'react';
import { JobPosting } from '../types';

interface JobCardProps {
  job: JobPosting;
  onPress: (id: string) => void;
  // 플랫폼별 스타일 Props
  containerStyle?: any;
  textStyle?: any;
}

export const JobCard: React.FC<JobCardProps> = ({ 
  job, 
  onPress, 
  containerStyle, 
  textStyle 
}) => {
  // 플랫폼 독립적 로직
  const handlePress = () => onPress(job.id);
  
  // 플랫폼별 렌더링은 하위 컴포넌트에서 처리
  return (
    <PlatformJobCard 
      job={job}
      onPress={handlePress}
      containerStyle={containerStyle}
      textStyle={textStyle}
    />
  );
};
```

### 상태 관리

```typescript
// hooks/useJobPostings.ts (웹과 공유)
import { useQuery } from '@tanstack/react-query';
import { getJobPostings } from '../services/jobPostingService';

export const useJobPostings = () => {
  return useQuery({
    queryKey: ['jobPostings'],
    queryFn: getJobPostings,
    staleTime: 5 * 60 * 1000, // 5분
    cacheTime: 10 * 60 * 1000, // 10분
    refetchOnWindowFocus: false,
  });
};
```

## 🎨 Flutter 개발

### 환경 설정

```bash
# Flutter 설치 확인
flutter doctor

# 프로젝트 생성
flutter create tholdem_mobile
cd tholdem_mobile

# 의존성 추가 (pubspec.yaml)
dependencies:
  firebase_core: ^2.24.2
  firebase_auth: ^4.15.3
  firebase_firestore: ^4.13.6
  provider: ^6.1.1
  go_router: ^12.1.3
  qr_code_scanner: ^1.0.1
```

### 프로젝트 구조

```
lib/
├── main.dart
├── models/             # 데이터 모델
├── services/           # Firebase 서비스
├── screens/            # UI 스크린
├── widgets/            # 재사용 위젯
├── providers/          # 상태 관리
└── utils/             # 유틸리티
```

### Firebase 설정

```dart
// main.dart
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(MyApp());
}
```

### 데이터 모델

```dart
// models/job_posting.dart
class JobPosting {
  final String id;
  final String title;
  final String description;
  final String location;
  final DateTime createdAt;

  JobPosting({
    required this.id,
    required this.title,
    required this.description,
    required this.location,
    required this.createdAt,
  });

  factory JobPosting.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data()! as Map<String, dynamic>;
    return JobPosting(
      id: doc.id,
      title: data['title'] ?? '',
      description: data['description'] ?? '',
      location: data['location'] ?? '',
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    );
  }
}
```

## 🔌 API 연동

### REST API 설계 (모바일 전용)

```typescript
// API 엔드포인트 설계
GET /api/mobile/v1/jobs              // 구인공고 목록
GET /api/mobile/v1/jobs/:id          // 구인공고 상세
POST /api/mobile/v1/applications     // 지원서 제출
GET /api/mobile/v1/my-schedule       // 내 스케줄
POST /api/mobile/v1/attendance       // 출석 체크
GET /api/mobile/v1/notifications     // 알림 목록
```

### Firebase Functions (모바일 최적화)

```typescript
// functions/src/mobile-api.ts
import { https } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

export const getMobileJobPostings = https.onRequest(async (req, res) => {
  try {
    const { limit = 20, lastDoc, status = 'open' } = req.query;
    
    let query = db.collection('jobPostings')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit as string));
    
    if (lastDoc) {
      const lastDocSnapshot = await db.doc(`jobPostings/${lastDoc}`).get();
      query = query.startAfter(lastDocSnapshot);
    }
    
    const snapshot = await query.get();
    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // 모바일에 필요한 필드만 선택적으로 전송
      requiredFields: doc.data().dateSpecificRequirements?.map(req => ({
        date: req.date,
        totalSlots: req.timeSlots?.length || 0,
      })),
    }));
    
    res.json({
      success: true,
      data: jobs,
      hasMore: snapshot.docs.length === parseInt(limit as string),
      lastDoc: snapshot.docs[snapshot.docs.length - 1]?.id,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 오프라인 동기화

```typescript
// services/offlineSync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export class OfflineSyncService {
  private static readonly CACHE_KEY = 'tholdem_offline_data';
  
  static async cacheData(key: string, data: any): Promise<void> {
    try {
      const cachedData = await this.getCachedData();
      cachedData[key] = {
        data,
        timestamp: Date.now(),
        version: '1.0',
      };
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cachedData));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }
  
  static async getCachedData(): Promise<Record<string, any>> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return {};
    }
  }
  
  static async syncWhenOnline(): Promise<void> {
    // 온라인 상태일 때 캐시된 데이터 동기화
    const cachedData = await this.getCachedData();
    
    for (const [key, value] of Object.entries(cachedData)) {
      if (value.timestamp > Date.now() - 24 * 60 * 60 * 1000) { // 24시간 이내
        // 서버와 동기화 로직
        await this.syncToServer(key, value.data);
      }
    }
  }
}
```

## 🌐 PWA 대안

### Service Worker 구현

```javascript
// public/sw.js
const CACHE_NAME = 'tholdem-v4.1.0';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/api/jobs',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에서 찾으면 반환, 없으면 네트워크 요청
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
```

### 앱 설치 프롬프트

```typescript
// hooks/useInstallPrompt.ts
import { useState, useEffect } from 'react';

export const useInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);
  
  const handleInstallClick = async () => {
    if (!installPrompt) return;
    
    const result = await installPrompt.prompt();
    console.log('Install prompt result:', result);
    
    setInstallPrompt(null);
    setIsInstallable(false);
  };
  
  return { isInstallable, handleInstallClick };
};
```

## 📦 배포 전략

### Android 배포 (Play Store)

```bash
# 키스토어 생성
keytool -genkeypair -v -keystore tholdem-release-key.keystore -name tholdem -keyalg RSA -keysize 2048 -validity 10000

# 빌드 설정 (android/app/build.gradle)
android {
    ...
    signingConfigs {
        release {
            storeFile file('tholdem-release-key.keystore')
            storePassword 'your-password'
            keyAlias 'tholdem'
            keyPassword 'your-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}

# 릴리스 빌드
cd android
./gradlew assembleRelease
```

### iOS 배포 (App Store)

```bash
# iOS 빌드 (Xcode 필요)
npx react-native run-ios --configuration Release

# 배포용 아카이브
# Xcode에서 Product > Archive 실행
# Organizer에서 App Store Connect로 업로드
```

### CI/CD 파이프라인

```yaml
# .github/workflows/mobile-deploy.yml
name: Mobile Deploy
on:
  push:
    branches: [main]
    paths: ['mobile/**']

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
        working-directory: ./mobile
      - name: Build Android
        run: |
          cd mobile/android
          ./gradlew assembleRelease
      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1.1.1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_STORE_JSON }}
          packageName: com.tholdem.mobile
          releaseFiles: mobile/android/app/build/outputs/apk/release/app-release.apk
          track: internal
```

## 🗓 로드맵

### Q4 2025: Foundation
- [x] PWA 기본 구현
- [x] Firebase 연동 완료
- [x] 반응형 디자인
- [ ] PWA 고도화 (오프라인, 푸시)
- [ ] 모바일 API 설계

### Q1 2026: Native Development
- [ ] React Native 프로젝트 설정
- [ ] 핵심 화면 구현 (로그인, 구인공고, 스케줄)
- [ ] Firebase 연동 및 동기화
- [ ] E2E 테스트 자동화

### Q2 2026: Beta Release
- [ ] Android Beta 배포
- [ ] 사용자 테스트 및 피드백 수집
- [ ] 성능 최적화
- [ ] iOS 개발 시작

### Q3 2026: Production
- [ ] Play Store 정식 출시
- [ ] App Store 출시
- [ ] 마케팅 캠페인
- [ ] 사용자 지원 체계 구축

## 📞 참고 문서

- **아키텍처**: [ARCHITECTURE.md](../ARCHITECTURE.md) - 전체 시스템 구조
- **API 명세**: [API_REFERENCE.md](../API_REFERENCE.md) - Firebase API 사용법
- **데이터 스키마**: [DATA_SCHEMA.md](../DATA_SCHEMA.md) - 데이터 구조 정의
- **배포 가이드**: [DEPLOYMENT.md](../DEPLOYMENT.md) - 웹 배포 참고

---

*모바일 앱 개발 관련 문의사항은 GitHub Issues를 통해 제기해 주세요.*