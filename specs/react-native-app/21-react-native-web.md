# 21. React Native Web 가이드

> **최종 업데이트**: 2026-02-02
> **구현 상태**: v1.0.0 완료 (Phase 2)
> **완성도**: 85%+

## 목차
1. [개요](#1-개요)
2. [Expo 웹 설정](#2-expo-웹-설정)
3. [플랫폼 분기 패턴](#3-플랫폼-분기-패턴)
4. [반응형 디자인](#4-반응형-디자인)
5. [웹 전용 기능](#5-웹-전용-기능)
6. [라이브러리 호환성](#6-라이브러리-호환성)
7. [배포](#7-배포)
8. [구현 현황](#8-구현-현황)

---

## 1. 개요

### React Native Web이란?

React Native Web은 React Native 컴포넌트를 웹 브라우저에서 실행할 수 있게 해주는 라이브러리입니다. Expo와 함께 사용하면 단일 코드베이스로 iOS, Android, Web 앱을 동시에 개발할 수 있습니다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    React Native + Expo + Web                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                        단일 코드베이스                                    │
│                     ┌─────────────────┐                                  │
│                     │   React Native  │                                  │
│                     │   Components    │                                  │
│                     │   (245개)       │                                  │
│                     └────────┬────────┘                                  │
│                              │                                           │
│              ┌───────────────┼───────────────┐                          │
│              ▼               ▼               ▼                          │
│       ┌──────────┐    ┌──────────┐    ┌──────────┐                     │
│       │   iOS    │    │ Android  │    │   Web    │                     │
│       │  Native  │    │  Native  │    │  Browser │                     │
│       └──────────┘    └──────────┘    └──────────┘                     │
│           │               │               │                             │
│           ▼               ▼               ▼                             │
│       App Store      Google Play     Firebase Hosting                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### UNIQN에서의 활용

| 기능 | 네이티브 구현 | 웹 구현 |
|------|-------------|--------|
| **QR 스캐너** | expo-camera | jsQR + getUserMedia |
| **모달/시트** | @gorhom/bottom-sheet | react-dom createPortal |
| **네트워크 감지** | @react-native-community/netinfo | navigator.onLine |
| **저장소** | react-native-mmkv | localStorage |
| **생체 인증** | expo-local-authentication | 미지원 |
| **푸시 알림** | FCM + expo-notifications | 미지원 (앱 구조상) |

---

## 2. Expo 웹 설정

### app.config.ts 웹 설정

**파일**: `uniqn-mobile/app.config.ts`

```typescript
export default {
  expo: {
    name: 'UNIQN',
    slug: 'uniqn',
    version: '1.0.0',
    platforms: ['ios', 'android', 'web'],
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',  // Metro bundler 사용 (Webpack 대신)
    },
    // ...
  }
};
```

### metro.config.js 웹 최적화

**파일**: `uniqn-mobile/metro.config.js`

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Firebase 웹 번들링 지원
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: './global.css' });
```

### 개발 명령어

```bash
# 웹 개발 서버
npm run web              # expo start --web

# 웹 빌드 (정적 출력)
npm run build:web        # expo export -p web

# 번들 분석
npm run analyze:bundle   # expo export -p web && source-map-explorer ...
```

---

## 3. 플랫폼 분기 패턴

### platform.ts 유틸리티

**파일**: `src/utils/platform.ts`

```typescript
import { Platform, Dimensions } from 'react-native';

// ========================================
// 1. 기본 플랫폼 감지 플래그
// ========================================
export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isMobile = isIOS || isAndroid;
export const isNative = !isWeb;

// ========================================
// 2. 플랫폼별 값 선택
// ========================================
export function platformSelect<T>(options: {
  web?: T;
  ios?: T;
  android?: T;
  native?: T;
  default: T;
}): T {
  if (isWeb && options.web !== undefined) return options.web;
  if (isIOS && options.ios !== undefined) return options.ios;
  if (isAndroid && options.android !== undefined) return options.android;
  if (isMobile && options.native !== undefined) return options.native;
  return options.default;
}

// ========================================
// 3. 화면 크기 및 브레이크포인트
// ========================================
export function getScreenDimensions() {
  return Dimensions.get('window');
}

export function getBreakpoint(): 'sm' | 'md' | 'lg' | 'xl' {
  const { width } = getScreenDimensions();
  if (width < 640) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  return 'xl';
}

// ========================================
// 4. 반응형 헬퍼 함수
// ========================================
export function isSmallScreen(): boolean {
  return getScreenDimensions().width < 640;
}

export function isMediumScreen(): boolean {
  const { width } = getScreenDimensions();
  return width >= 640 && width < 1024;
}

export function isLargeScreen(): boolean {
  return getScreenDimensions().width >= 1024;
}

export function isDesktop(): boolean {
  return isWeb && isLargeScreen();
}

export function isMobileDevice(): boolean {
  return isNative || isSmallScreen();
}

// ========================================
// 5. OS 정보
// ========================================
export function getOSVersion(): string | null {
  return Platform.Version?.toString() ?? null;
}

export const platformInfo = {
  os: Platform.OS,
  version: Platform.Version,
  isWeb,
  isIOS,
  isAndroid,
  isMobile,
  isNative,
};
```

### 파일 기반 플랫폼 분기

Metro bundler는 자동으로 `.web.tsx`, `.native.tsx` 확장자를 인식합니다.

```
src/components/qr/
├── index.tsx                # export { QRCodeScanner } from './QRCodeScanner'
├── QRCodeScanner.tsx        # 네이티브 버전 (expo-camera)
├── QRCodeScanner.web.tsx    # 웹 버전 (jsQR + getUserMedia)
└── types.ts                 # 공통 타입
```

**현재 플랫폼별 파일 목록**:
| 파일 | 네이티브 | 웹 |
|------|---------|-----|
| QRCodeScanner | expo-camera 사용 | jsQR + getUserMedia |

### 조건부 렌더링

```typescript
import { isWeb, isNative } from '@/utils/platform';

function MyComponent() {
  if (isWeb) {
    return <WebSpecificUI />;
  }
  return <NativeUI />;
}

// 또는 platformSelect 사용
const fontSize = platformSelect({
  web: 16,
  native: 14,
  default: 14,
});
```

---

## 4. 반응형 디자인

### 브레이크포인트 상수

**파일**: `src/constants/index.ts`

```typescript
export const BREAKPOINTS = {
  SM: 640,    // 모바일 시작
  MD: 768,    // 태블릿
  LG: 1024,   // 데스크톱
  XL: 1280,   // 큰 데스크톱
} as const;
```

### NativeWind (Tailwind CSS) 반응형

**파일**: `tailwind.config.js`

```javascript
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
    },
  },
  darkMode: 'class',
};
```

### 반응형 클래스 사용

```tsx
// NativeWind 반응형 클래스
<View className="
  flex-col            // 기본: 세로 배치
  md:flex-row         // 768px+: 가로 배치
  p-4                 // 기본: padding 16px
  md:p-6              // 768px+: padding 24px
  lg:p-8              // 1024px+: padding 32px
">
  <Text className="
    text-base         // 기본: 16px
    lg:text-lg        // 1024px+: 18px
  ">
    반응형 텍스트
  </Text>
</View>
```

### useWindowDimensions 활용

```typescript
import { useWindowDimensions } from 'react-native';

function ResponsiveComponent() {
  const { width } = useWindowDimensions();

  const columns = width < 640 ? 1 : width < 1024 ? 2 : 3;

  return (
    <FlashList
      data={items}
      numColumns={columns}
      // ...
    />
  );
}
```

---

## 5. 웹 전용 기능

### 5.1 웹 모달 (Portal 패턴)

**파일**: `src/components/ui/Modal.tsx`, `SheetModal.tsx`, `BottomSheet.tsx`

```typescript
// @ts-expect-error - react-dom 타입
import { createPortal } from 'react-dom';

function WebModalPortal({
  children,
  visible
}: {
  children: React.ReactNode;
  visible: boolean;
}) {
  // SSR 안전성 체크
  if (!visible) return null;
  if (typeof document === 'undefined') return <>{children}</>;

  return createPortal(children, document.body);
}

// 사용 (웹에서만 Portal 사용)
export function Modal({ visible, children, onClose }: ModalProps) {
  if (isWeb) {
    return (
      <WebModalPortal visible={visible}>
        <ModalContent onClose={onClose}>
          {children}
        </ModalContent>
      </WebModalPortal>
    );
  }

  // 네이티브: RN Modal 사용
  return (
    <RNModal visible={visible} onRequestClose={onClose}>
      {children}
    </RNModal>
  );
}
```

### 5.2 QR 코드 스캐너 (웹 버전)

**파일**: `src/components/qr/QRCodeScanner.web.tsx`

```typescript
import jsQR from 'jsqr';

export function QRCodeScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // 브라우저 카메라 접근
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    .then(stream => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    })
    .catch(err => onError?.(err));

    // 프레임별 QR 코드 스캔
    const interval = setInterval(() => {
      if (canvasRef.current && videoRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code) {
            onScan(code.data);
          }
        }
      }
    }, 100);

    return () => {
      clearInterval(interval);
      // 카메라 스트림 정리
    };
  }, []);

  return (
    <View>
      <video ref={videoRef} autoPlay playsInline />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </View>
  );
}
```

### 5.3 키보드 단축키

**현재 구현**: 기본 수준 (ESC 키만)

```typescript
// src/components/ui/Modal.tsx
useEffect(() => {
  if (!isWeb || !visible) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [visible, onClose]);
```

### 5.4 네트워크 상태 감지 (웹)

**파일**: `src/lib/queryClient.ts`

```typescript
// 웹 네트워크 상태 감지
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const handleOnline = () => {
    onlineManager.setOnline(true);
    logger.info('네트워크 상태 변경: 온라인');
  };
  const handleOffline = () => {
    onlineManager.setOnline(false);
    logger.info('네트워크 상태 변경: 오프라인');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  onlineManager.setOnline(navigator.onLine);
}
```

---

## 6. 라이브러리 호환성

### 호환성 매트릭스

| 라이브러리 | iOS | Android | Web | 비고 |
|-----------|-----|---------|-----|------|
| **expo-router** | ✅ | ✅ | ✅ | 완전 지원 |
| **@tanstack/react-query** | ✅ | ✅ | ✅ | 완전 지원 |
| **zustand** | ✅ | ✅ | ✅ | 완전 지원 |
| **nativewind** | ✅ | ✅ | ✅ | Tailwind CSS for RN |
| **@shopify/flash-list** | ✅ | ✅ | ⚠️ | 웹에서 일부 이슈 |
| **react-native-reanimated** | ✅ | ✅ | ⚠️ | 웹에서 일부 제한 |
| **expo-camera** | ✅ | ✅ | ❌ | 웹 대안 필요 (jsQR) |
| **expo-local-authentication** | ✅ | ✅ | ❌ | 웹 미지원 |
| **@react-native-firebase/** | ✅ | ✅ | ⚠️ | 웹은 firebase/js-sdk |
| **react-native-calendars** | ✅ | ✅ | ✅ | 완전 지원 |
| **@gorhom/bottom-sheet** | ✅ | ✅ | ⚠️ | 웹에서 Portal 대체 |
| **react-native-mmkv** | ✅ | ✅ | ❌ | 웹은 localStorage |

### MMKV 웹 폴백

**파일**: `src/lib/mmkvStorage.ts`

```typescript
// 웹에서는 localStorage 사용
class WebStorage {
  private prefix = 'uniqn_';

  getString(key: string): string | undefined {
    const value = localStorage.getItem(this.prefix + key);
    return value ?? undefined;
  }

  set(key: string, value: string): void {
    localStorage.setItem(this.prefix + key, value);
  }

  delete(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }
}

// 플랫폼별 스토리지
export const storage = Platform.OS === 'web'
  ? new WebStorage()
  : new MMKV();
```

---

## 7. 배포

### Firebase Hosting 설정

**파일**: `firebase.json`

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=604800"
          }
        ]
      }
    ]
  }
}
```

### 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy-web.sh

echo "🏗️ 웹 빌드 시작..."
npx expo export --platform web --output-dir dist

echo "🧹 불필요한 파일 정리..."
rm -rf dist/.expo

echo "🚀 Firebase Hosting 배포..."
firebase deploy --only hosting

echo "✅ 배포 완료!"
```

### Package.json 스크립트

```json
{
  "scripts": {
    "web": "expo start --web",
    "build:web": "expo export -p web",
    "deploy:web": "npm run build:web && firebase deploy --only hosting",
    "analyze:bundle": "expo export -p web && source-map-explorer dist/_expo/static/js/*.js"
  }
}
```

---

## 8. 구현 현황

### 전체 평가: ✅ 85% 완료

| 항목 | 구현 수준 | 파일 위치 | 평가 |
|------|---------|----------|------|
| **플랫폼 분기** | ✅ 완벽 | utils/platform.ts | 모든 필요 함수 제공 |
| **반응형 디자인** | ✅ 충분 | constants/, NativeWind | Tailwind 반응형 지원 |
| **웹 모달 (Portal)** | ✅ 완벽 | components/ui/Modal.tsx, SheetModal.tsx | SSR 안전, z-index 처리 |
| **QR 스캐너** | ✅ 완벽 | components/qr/QRCodeScanner.web.tsx | jsQR 사용 |
| **네트워크 상태** | ✅ 완벽 | lib/queryClient.ts | online/offline 이벤트 |
| **앱 설정** | ✅ 기본 | app.config.ts | Metro bundler 설정 |
| **Metro 설정** | ✅ 완료 | metro.config.js | Firebase 지원, NativeWind |
| **NativeWind CSS** | ✅ 완벽 | tailwind.config.js | dark: 지원 |
| **키보드 단축키** | ⚠️ 기본 | Modal.tsx (ESC만) | 전체 시스템 없음 |
| **SEO** | ❌ 미구현 | 없음 | 모바일 앱 중심 설계 |
| **PWA** | ❌ 미구현 | 없음 | 필요시 별도 구현 |
| **웹 알림** | ❌ 미구현 | 없음 | 앱 구조상 미지원 |

### 파일 수

| 영역 | 웹 관련 파일 |
|------|------------|
| 플랫폼 분기 파일 (.web.tsx) | 1개 (QRCodeScanner) |
| 플랫폼 유틸리티 | 1개 (platform.ts) |
| 웹 호환 스토리지 | 2개 (mmkvStorage, secureStorage) |
| Portal 모달 | 3개 (Modal, SheetModal, BottomSheet) |

### 성능 목표

| 항목 | 목표 | 현재 |
|------|------|------|
| 첫 로드 (LCP) | < 2.5초 | ✅ 달성 |
| 번들 크기 (gzip) | < 500KB | ⚠️ 확인 필요 |
| 화면 전환 | < 300ms | ✅ 달성 |
| Lighthouse 점수 | 90+ | ⚠️ 확인 필요 |

### 미구현 기능 (필요시 구현)

1. **SEO**: 검색 엔진 최적화가 필요하면 Next.js 별도 웹사이트 권장
2. **PWA**: Progressive Web App 기능 (오프라인, 홈 화면 추가)
3. **키보드 단축키**: 전체 앱 단축키 시스템 (Cmd+K 검색 등)
4. **웹 알림**: Web Notifications API

---

## 관련 문서

- [00-overview.md](./00-overview.md) - 프로젝트 개요
- [15-cicd.md](./15-cicd.md) - CI/CD 파이프라인
- [20-offline-caching.md](./20-offline-caching.md) - 오프라인 지원
