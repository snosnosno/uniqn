# 21. React Native Web 가이드

## 목차
1. [개요](#1-개요)
2. [Expo 웹 설정](#2-expo-웹-설정)
3. [플랫폼 분기 패턴](#3-플랫폼-분기-패턴)
4. [반응형 디자인](#4-반응형-디자인)
5. [웹 최적화](#5-웹-최적화)
6. [SEO 및 메타데이터](#6-seo-및-메타데이터)
7. [라이브러리 호환성](#7-라이브러리-호환성)
8. [웹 전용 기능](#8-웹-전용-기능)
9. [테스트 전략](#9-테스트-전략)
10. [배포](#10-배포)

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

### 장점

| 장점 | 설명 |
|------|------|
| **코드 재사용** | iOS, Android, Web 간 90%+ 코드 공유 |
| **일관된 UX** | 모든 플랫폼에서 동일한 사용자 경험 |
| **개발 효율** | 버그 수정, 기능 추가가 모든 플랫폼에 적용 |
| **Expo 통합** | Expo Router로 웹/앱 네비게이션 통합 |
| **점진적 채택** | 필요한 부분만 플랫폼별 분기 가능 |

### UNIQN에서의 활용

```typescript
// UNIQN 앱에서 React Native Web 활용 시나리오

// 1. 구인공고 페이지 - 웹에서 SEO 필요
//    → 웹 메타태그 + 모바일 동일 UI

// 2. QR 출퇴근 - 플랫폼별 구현 필요
//    → 네이티브: expo-camera
//    → 웹: html5-qrcode

// 3. 구인자 대시보드 - 데스크톱 최적화
//    → 반응형 레이아웃으로 넓은 화면 활용

// 4. 알림 - 플랫폼별 처리
//    → 네이티브: FCM Push
//    → 웹: Web Push API
```

---

## 2. Expo 웹 설정

### 2.1 프로젝트 초기 설정

```bash
# Expo 프로젝트 생성
npx create-expo-app@latest uniqn-app --template tabs

# 웹 번들러 설치 (Metro bundler for web)
npx expo install @expo/metro-runtime
```

### 2.2 app.json 웹 설정

```json
{
  "expo": {
    "name": "UNIQN",
    "slug": "uniqn",
    "version": "1.0.0",
    "platforms": ["ios", "android", "web"],
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/favicon.png",
      "name": "UNIQN - 홀덤 스태프 매칭",
      "shortName": "UNIQN",
      "lang": "ko",
      "themeColor": "#3B82F6",
      "backgroundColor": "#ffffff",
      "display": "standalone",
      "orientation": "portrait",
      "scope": "/",
      "startUrl": "/"
    },
    "plugins": [
      "expo-router",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ]
    ]
  }
}
```

### 2.3 metro.config.js 웹 최적화

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 웹 번들 최적화
config.resolver.resolverMainFields = ['browser', 'main'];

// 플랫폼별 확장자 지원
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'web.tsx',
  'web.ts',
  'web.jsx',
  'web.js',
];

module.exports = config;
```

### 2.4 개발 명령어

```bash
# 웹 개발 서버
npx expo start --web

# iOS 시뮬레이터
npx expo start --ios

# Android 에뮬레이터
npx expo start --android

# 웹 빌드 (정적 출력)
npx expo export --platform web

# 웹 빌드 (프로덕션)
npx expo export --platform web --output-dir dist
```

---

## 3. 플랫폼 분기 패턴

### 3.1 Platform API 활용

```typescript
// src/utils/platform.ts
import { Platform, Dimensions } from 'react-native';

// 기본 플랫폼 체크
export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isMobile = isIOS || isAndroid;
export const isNative = !isWeb;

// 플랫폼별 값 선택
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

// 사용 예시
const fontSize = platformSelect({
  web: 16,
  native: 14,
  default: 14,
});
```

### 3.2 파일 기반 플랫폼 분기

```
src/components/QRScanner/
├── index.tsx           # 공통 인터페이스 & export
├── QRScanner.tsx       # 기본 구현 (fallback)
├── QRScanner.native.tsx  # iOS/Android 구현
└── QRScanner.web.tsx     # 웹 구현
```

```typescript
// src/components/QRScanner/index.tsx
// Metro bundler가 자동으로 플랫폼별 파일 선택
export { QRScanner } from './QRScanner';
export type { QRScannerProps } from './types';

// src/components/QRScanner/types.ts
export interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
  style?: ViewStyle;
}

// src/components/QRScanner/QRScanner.native.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { QRScannerProps } from './types';

export function QRScanner({ onScan, onError, style }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>카메라 권한이 필요합니다</Text>
        <Button title="권한 요청" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <CameraView
      style={[styles.camera, style]}
      barcodeScannerSettings={{
        barcodeTypes: ['qr'],
      }}
      onBarcodeScanned={({ data }) => onScan(data)}
    />
  );
}

// src/components/QRScanner/QRScanner.web.tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Html5Qrcode } from 'html5-qrcode';
import { QRScannerProps } from './types';

export function QRScanner({ onScan, onError, style }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {} // 에러 무시 (스캔 시도 중)
      )
      .then(() => setIsReady(true))
      .catch((err) => onError?.(err));

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScan, onError]);

  return (
    <View style={[styles.container, style]}>
      <div id="qr-reader" ref={containerRef as any} style={webStyles.scanner} />
      {!isReady && <Text style={styles.loading}>카메라 로딩 중...</Text>}
    </View>
  );
}

const webStyles = {
  scanner: {
    width: '100%',
    maxWidth: 400,
  },
};
```

### 3.3 조건부 import 패턴

```typescript
// src/services/storage/index.ts
import { isWeb } from '@/utils/platform';

// 플랫폼별 동적 import
export const StorageService = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      return localStorage.getItem(key);
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      localStorage.setItem(key, value);
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem(key);
    }
  },
};
```

### 3.4 네이티브 전용 기능 처리

```typescript
// src/services/biometric.ts
import { isWeb } from '@/utils/platform';

export const BiometricService = {
  async isAvailable(): Promise<boolean> {
    if (isWeb) {
      // 웹에서는 생체 인증 미지원
      return false;
    }

    try {
      const LocalAuthentication = await import('expo-local-authentication');
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  },

  async authenticate(): Promise<{ success: boolean; error?: string }> {
    if (isWeb) {
      return { success: false, error: '웹에서는 생체 인증을 사용할 수 없습니다.' };
    }

    try {
      const LocalAuthentication = await import('expo-local-authentication');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: '생체 인증으로 로그인',
        cancelLabel: '취소',
        fallbackLabel: '비밀번호 사용',
      });

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return { success: false, error: '인증 실패' };
    }
  },
};

// 사용 예시
function LoginScreen() {
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    BiometricService.isAvailable().then(setBiometricAvailable);
  }, []);

  return (
    <View>
      {/* 기본 로그인 폼 */}
      <LoginForm />

      {/* 생체 인증 버튼 (가능한 경우만 표시) */}
      {biometricAvailable && (
        <TouchableOpacity onPress={handleBiometricLogin}>
          <Text>생체 인증으로 로그인</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

---

## 4. 반응형 디자인

### 4.1 useResponsive 훅

```typescript
// src/hooks/useResponsive.ts
import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ResponsiveConfig {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isXs: boolean;    // < 480px (모바일 세로)
  isSm: boolean;    // 480-639px (모바일 가로)
  isMd: boolean;    // 640-767px (태블릿 세로)
  isLg: boolean;    // 768-1023px (태블릿 가로)
  isXl: boolean;    // 1024-1279px (데스크톱)
  is2xl: boolean;   // >= 1280px (대형 모니터)
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useResponsive(): ResponsiveConfig {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const breakpoint: Breakpoint =
      width < 480 ? 'xs' :
      width < 640 ? 'sm' :
      width < 768 ? 'md' :
      width < 1024 ? 'lg' :
      width < 1280 ? 'xl' : '2xl';

    return {
      width,
      height,
      breakpoint,
      isXs: breakpoint === 'xs',
      isSm: breakpoint === 'sm',
      isMd: breakpoint === 'md',
      isLg: breakpoint === 'lg',
      isXl: breakpoint === 'xl',
      is2xl: breakpoint === '2xl',
      isMobile: width < 640,
      isTablet: width >= 640 && width < 1024,
      isDesktop: width >= 1024,
    };
  }, [width, height]);
}
```

### 4.2 반응형 스타일 유틸리티

```typescript
// src/utils/responsive.ts
import { Dimensions, StyleSheet, ViewStyle, TextStyle } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 반응형 값 계산
export function rw(percentage: number): number {
  return (SCREEN_WIDTH * percentage) / 100;
}

// 브레이크포인트별 값 선택
export function responsive<T>(options: {
  default: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
}): T {
  const width = SCREEN_WIDTH;

  if (width >= 1280 && options.xl !== undefined) return options.xl;
  if (width >= 1024 && options.lg !== undefined) return options.lg;
  if (width >= 768 && options.md !== undefined) return options.md;
  if (width >= 640 && options.sm !== undefined) return options.sm;
  return options.default;
}

// 사용 예시
const styles = StyleSheet.create({
  container: {
    padding: responsive({
      default: 16,
      md: 24,
      lg: 32,
    }),
  },
  grid: {
    flexDirection: responsive({
      default: 'column',
      md: 'row',
    }),
    flexWrap: 'wrap',
  },
  gridItem: {
    width: responsive({
      default: '100%',
      md: '50%',
      lg: '33.33%',
      xl: '25%',
    }),
  },
});
```

### 4.3 반응형 레이아웃 컴포넌트

```typescript
// src/components/common/ResponsiveGrid.tsx
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  style?: ViewStyle;
}

export function ResponsiveGrid({
  children,
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = 16,
  style,
}: ResponsiveGridProps) {
  const { breakpoint } = useResponsive();

  const columnCount =
    columns[breakpoint as keyof typeof columns] ||
    columns.xs ||
    1;

  const childArray = React.Children.toArray(children);

  return (
    <View style={[styles.container, { gap }, style]}>
      {childArray.map((child, index) => (
        <View
          key={index}
          style={{
            width: `${100 / columnCount}%`,
            paddingHorizontal: gap / 2,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
});

// 사용 예시
function JobBoardScreen() {
  const { jobs } = useJobPostings();

  return (
    <ResponsiveGrid columns={{ xs: 1, sm: 2, lg: 3, xl: 4 }} gap={16}>
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </ResponsiveGrid>
  );
}
```

### 4.4 반응형 네비게이션

```typescript
// src/components/navigation/ResponsiveNav.tsx
import { useResponsive } from '@/hooks/useResponsive';

export function ResponsiveNav() {
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    // 데스크톱: 사이드바 네비게이션
    return <SidebarNav />;
  }

  // 모바일/태블릿: 하단 탭 네비게이션
  return <BottomTabNav />;
}

// app/(app)/_layout.tsx
import { Slot } from 'expo-router';
import { useResponsive } from '@/hooks/useResponsive';

export default function AppLayout() {
  const { isDesktop } = useResponsive();

  return (
    <View style={styles.container}>
      {isDesktop && <Sidebar />}
      <View style={styles.content}>
        <Slot />
      </View>
      {!isDesktop && <BottomTabs />}
    </View>
  );
}
```

---

## 5. 웹 최적화

### 5.1 코드 스플리팅

```typescript
// src/utils/lazyImport.ts
import { lazy, Suspense, ComponentType } from 'react';
import { View, ActivityIndicator } from 'react-native';

// 지연 로딩 래퍼
export function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense
        fallback={
          fallback || (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" />
            </View>
          )
        }
      >
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// 사용 예시
// app/(app)/(manager)/create-posting/index.tsx
const CreatePostingWizard = lazyLoad(
  () => import('@/components/posting/CreatePostingWizard')
);

export default function CreatePostingScreen() {
  return <CreatePostingWizard />;
}
```

### 5.2 이미지 최적화

```typescript
// src/components/common/OptimizedImage.tsx
import { Image as ExpoImage } from 'expo-image';
import { isWeb } from '@/utils/platform';

interface OptimizedImageProps {
  source: string | { uri: string };
  width?: number;
  height?: number;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  placeholder?: string;
  alt?: string;
}

export function OptimizedImage({
  source,
  width,
  height,
  style,
  contentFit = 'cover',
  placeholder,
  alt,
}: OptimizedImageProps) {
  const uri = typeof source === 'string' ? source : source.uri;

  // 웹에서 반응형 이미지 URL 생성 (Firebase Storage resizing)
  const getOptimizedUri = (originalUri: string, targetWidth?: number) => {
    if (!isWeb || !targetWidth) return originalUri;

    // Firebase Extensions Image Resizing 또는 CDN 사용 시
    // 예: https://storage.googleapis.com/bucket/image.jpg?w=400
    if (originalUri.includes('firebasestorage.googleapis.com')) {
      return `${originalUri}&w=${targetWidth}`;
    }

    return originalUri;
  };

  return (
    <ExpoImage
      source={{ uri: getOptimizedUri(uri, width) }}
      style={[{ width, height }, style]}
      contentFit={contentFit}
      placeholder={placeholder}
      transition={200}
      // 웹 접근성
      accessibilityLabel={alt}
      // 웹에서 loading="lazy" 적용
      {...(isWeb && { loading: 'lazy' })}
    />
  );
}
```

### 5.3 리스트 가상화 (웹 호환)

```typescript
// src/components/common/VirtualizedList.tsx
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { FlatList, FlatListProps, Platform } from 'react-native';

// FlashList는 웹에서도 동작하지만, 일부 이슈가 있을 수 있음
// 필요시 웹에서는 기본 FlatList 사용

interface VirtualizedListProps<T> extends Omit<FlashListProps<T>, 'renderItem'> {
  data: T[];
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement;
  estimatedItemSize: number;
  keyExtractor: (item: T, index: number) => string;
}

export function VirtualizedList<T>({
  data,
  renderItem,
  estimatedItemSize,
  keyExtractor,
  ...rest
}: VirtualizedListProps<T>) {
  // 웹에서 데이터가 적으면 일반 FlatList 사용
  if (Platform.OS === 'web' && data.length < 50) {
    return (
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        {...rest}
      />
    );
  }

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      estimatedItemSize={estimatedItemSize}
      keyExtractor={keyExtractor}
      {...rest}
    />
  );
}
```

### 5.4 번들 분석

```bash
# 웹 번들 분석
npx expo export --platform web

# 번들 사이즈 확인 (source-map-explorer 사용)
npm install -D source-map-explorer
npx source-map-explorer dist/_expo/static/js/*.js

# 또는 webpack-bundle-analyzer (Webpack 사용 시)
```

### 5.5 캐싱 전략

```typescript
// src/config/cache.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 웹에서 더 공격적인 캐싱
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 30 * 60 * 1000,   // 30분
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

// 서비스 워커 캐싱 (웹 전용)
// public/sw.js 또는 expo 플러그인으로 설정
```

---

## 6. SEO 및 메타데이터

### 6.1 Head 컴포넌트

```typescript
// src/components/common/SEO.tsx
import Head from 'expo-router/head';
import { isWeb } from '@/utils/platform';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  noIndex?: boolean;
}

export function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  noIndex = false,
}: SEOProps) {
  if (!isWeb) return null;

  const fullTitle = `${title} | UNIQN`;
  const defaultDescription = '홀덤 딜러·스태프 매칭 플랫폼';
  const defaultImage = 'https://uniqn.app/og-image.png';

  return (
    <Head>
      {/* 기본 메타 */}
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:image" content={image || defaultImage} />
      <meta property="og:type" content={type} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:site_name" content="UNIQN" />
      <meta property="og:locale" content="ko_KR" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description || defaultDescription} />
      <meta name="twitter:image" content={image || defaultImage} />

      {/* 인덱싱 제어 */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* 앱 연결 (Smart App Banner) */}
      <meta name="apple-itunes-app" content="app-id=YOUR_APP_ID" />
      <meta name="google-play-app" content="app-id=app.uniqn" />

      {/* Canonical URL */}
      {url && <link rel="canonical" href={url} />}
    </Head>
  );
}
```

### 6.2 페이지별 SEO 적용

```typescript
// app/(app)/(tabs)/job-board/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { SEO } from '@/components/common/SEO';
import { useJobPosting } from '@/hooks/useJobPosting';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isLoading } = useJobPosting(id);

  if (isLoading) return <LoadingScreen />;
  if (!job) return <NotFoundScreen />;

  return (
    <>
      <SEO
        title={job.title}
        description={`${job.location.name}에서 ${job.roles.map(r => r.name).join(', ')} 모집 중. ${job.timeSlot} 근무, 시급 ${job.roles[0]?.hourlyRate.toLocaleString()}원~`}
        image={job.thumbnail}
        url={`https://uniqn.app/job-board/${id}`}
        type="article"
      />
      <JobDetailContent job={job} />
    </>
  );
}
```

### 6.3 구조화된 데이터 (JSON-LD)

```typescript
// src/components/common/StructuredData.tsx
import Head from 'expo-router/head';
import { isWeb } from '@/utils/platform';

interface JobPostingSchema {
  title: string;
  description: string;
  datePosted: string;
  validThrough: string;
  employmentType: string;
  hiringOrganization: {
    name: string;
    logo?: string;
  };
  jobLocation: {
    address: string;
  };
  baseSalary?: {
    value: number;
    unitText: string;
  };
}

export function JobPostingStructuredData({ job }: { job: JobPostingSchema }) {
  if (!isWeb) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.datePosted,
    validThrough: job.validThrough,
    employmentType: job.employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.hiringOrganization.name,
      logo: job.hiringOrganization.logo,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.jobLocation.address,
        addressCountry: 'KR',
      },
    },
    baseSalary: job.baseSalary && {
      '@type': 'MonetaryAmount',
      currency: 'KRW',
      value: {
        '@type': 'QuantitativeValue',
        value: job.baseSalary.value,
        unitText: job.baseSalary.unitText,
      },
    },
  };

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  );
}
```

---

## 7. 라이브러리 호환성

### 7.1 호환성 매트릭스

| 라이브러리 | iOS | Android | Web | 비고 |
|-----------|-----|---------|-----|------|
| **expo-router** | ✅ | ✅ | ✅ | 완전 지원 |
| **@tanstack/react-query** | ✅ | ✅ | ✅ | 완전 지원 |
| **zustand** | ✅ | ✅ | ✅ | 완전 지원 |
| **nativewind** | ✅ | ✅ | ✅ | Tailwind CSS for RN |
| **@shopify/flash-list** | ✅ | ✅ | ⚠️ | 웹에서 일부 이슈 |
| **react-native-reanimated** | ✅ | ✅ | ⚠️ | 웹에서 일부 제한 |
| **expo-camera** | ✅ | ✅ | ❌ | 웹 대안 필요 |
| **expo-local-authentication** | ✅ | ✅ | ❌ | 웹 미지원 |
| **@react-native-firebase/***| ✅ | ✅ | ⚠️ | 웹은 firebase/js-sdk |
| **react-native-calendars** | ✅ | ✅ | ✅ | 완전 지원 |
| **@gorhom/bottom-sheet** | ✅ | ✅ | ⚠️ | 웹에서 Modal 대체 |

### 7.2 Firebase 웹 호환

```typescript
// src/config/firebase.ts
import { Platform } from 'react-native';

// 플랫폼별 Firebase 초기화
export async function initializeFirebase() {
  if (Platform.OS === 'web') {
    // 웹: firebase/js-sdk 사용
    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');
    const { getMessaging, isSupported } = await import('firebase/messaging');

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Web Push (지원되는 경우만)
    let messaging = null;
    if (await isSupported()) {
      messaging = getMessaging(app);
    }

    return { app, auth, db, messaging };
  } else {
    // 네이티브: @react-native-firebase 사용
    const firebase = await import('@react-native-firebase/app');
    const auth = (await import('@react-native-firebase/auth')).default;
    const firestore = (await import('@react-native-firebase/firestore')).default;
    const messaging = (await import('@react-native-firebase/messaging')).default;

    return {
      app: firebase.default,
      auth: auth(),
      db: firestore(),
      messaging: messaging(),
    };
  }
}

// 통합 Firebase 서비스
// src/services/firebase/auth.ts
import { Platform } from 'react-native';

export const authService = {
  async signInWithEmail(email: string, password: string) {
    if (Platform.OS === 'web') {
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
      const auth = getAuth();
      return signInWithEmailAndPassword(auth, email, password);
    } else {
      const auth = (await import('@react-native-firebase/auth')).default;
      return auth().signInWithEmailAndPassword(email, password);
    }
  },

  // ... 다른 메서드들
};
```

### 7.3 BottomSheet 웹 대안

```typescript
// src/components/common/Sheet.tsx
import { isWeb } from '@/utils/platform';
import { Modal, View, StyleSheet, Pressable } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: string[];
}

export function Sheet({ visible, onClose, children, snapPoints = ['50%'] }: SheetProps) {
  if (isWeb) {
    // 웹: 일반 모달 사용
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.webSheet} onPress={(e) => e.stopPropagation()}>
            {children}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // 네이티브: BottomSheet 사용
  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
    >
      {children}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  webSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 32,
  },
});
```

---

## 8. 웹 전용 기능

### 8.1 키보드 단축키

```typescript
// src/hooks/useKeyboardShortcut.ts
import { useEffect } from 'react';
import { isWeb } from '@/utils/platform';

type KeyCombo = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;  // Cmd on Mac
};

export function useKeyboardShortcut(
  combo: KeyCombo,
  callback: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!isWeb || !enabled) return;

    const handler = (e: KeyboardEvent) => {
      const matchKey = e.key.toLowerCase() === combo.key.toLowerCase();
      const matchCtrl = combo.ctrl ? e.ctrlKey : !e.ctrlKey;
      const matchShift = combo.shift ? e.shiftKey : !e.shiftKey;
      const matchAlt = combo.alt ? e.altKey : !e.altKey;
      const matchMeta = combo.meta ? e.metaKey : !e.metaKey;

      if (matchKey && matchCtrl && matchShift && matchAlt && matchMeta) {
        e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [combo, callback, enabled]);
}

// 사용 예시
function SearchScreen() {
  const [showSearch, setShowSearch] = useState(false);

  // Cmd+K 또는 Ctrl+K로 검색 열기
  useKeyboardShortcut(
    { key: 'k', meta: true },
    () => setShowSearch(true)
  );

  useKeyboardShortcut(
    { key: 'k', ctrl: true },
    () => setShowSearch(true)
  );

  // ESC로 닫기
  useKeyboardShortcut(
    { key: 'Escape' },
    () => setShowSearch(false),
    showSearch
  );

  return (
    // ...
  );
}
```

### 8.2 브라우저 히스토리 통합

```typescript
// Expo Router가 자동으로 처리하지만, 커스텀 히스토리가 필요한 경우

// src/hooks/useWebHistory.ts
import { useEffect } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { isWeb } from '@/utils/platform';

export function usePreventBackNavigation(shouldPrevent: boolean, message?: string) {
  const router = useRouter();

  useEffect(() => {
    if (!isWeb || !shouldPrevent) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message || '변경사항이 저장되지 않을 수 있습니다.';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldPrevent, message]);
}

// 사용 예시 - 폼 작성 중 이탈 방지
function CreatePostingScreen() {
  const { isDirty } = useFormState();

  usePreventBackNavigation(isDirty, '작성 중인 내용이 저장되지 않습니다.');

  return (
    // ...
  );
}
```

### 8.3 웹 알림 (Web Push)

```typescript
// src/services/notifications/webPush.ts
import { isWeb } from '@/utils/platform';

export const WebPushService = {
  async requestPermission(): Promise<boolean> {
    if (!isWeb || !('Notification' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  async getToken(): Promise<string | null> {
    if (!isWeb) return null;

    try {
      const { getMessaging, getToken } = await import('firebase/messaging');
      const messaging = getMessaging();
      const token = await getToken(messaging, {
        vapidKey: process.env.EXPO_PUBLIC_VAPID_KEY,
      });
      return token;
    } catch {
      return null;
    }
  },

  showNotification(title: string, options?: NotificationOptions) {
    if (!isWeb || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        ...options,
      });
    }
  },
};

// 서비스 워커 등록 (웹 전용)
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // Firebase config
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
  });
});
```

---

## 9. 테스트 전략

### 9.1 플랫폼별 테스트

```typescript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // 플랫폼별 테스트 환경
  projects: [
    {
      displayName: 'native',
      preset: 'jest-expo/ios',
      testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
    },
    {
      displayName: 'web',
      preset: 'jest-expo/web',
      testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/__tests__/**/*.web.test.{ts,tsx}'],
    },
  ],
};
```

### 9.2 웹 특화 테스트

```typescript
// src/components/__tests__/JobCard.web.test.tsx
import { render, screen } from '@testing-library/react-native';
import { JobCard } from '../job/JobCard';

// 웹 환경 모킹
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'web',
  select: ({ web }: any) => web,
}));

describe('JobCard (Web)', () => {
  it('웹에서 hover 효과가 적용됨', () => {
    const { getByTestId } = render(
      <JobCard job={mockJob} testID="job-card" />
    );

    const card = getByTestId('job-card');
    // 웹 스타일 테스트
    expect(card).toHaveStyle({ cursor: 'pointer' });
  });

  it('SEO 메타 태그가 렌더링됨', () => {
    // SEO 컴포넌트 테스트
  });
});
```

### 9.3 E2E 테스트 (Playwright)

```typescript
// e2e/web/job-board.spec.ts
import { test, expect } from '@playwright/test';

test.describe('구인공고 (웹)', () => {
  test('공고 목록이 표시됨', async ({ page }) => {
    await page.goto('/job-board');

    // 목록 로드 대기
    await page.waitForSelector('[data-testid="job-list"]');

    // 최소 1개 이상의 공고 확인
    const jobCards = page.locator('[data-testid="job-card"]');
    await expect(jobCards.first()).toBeVisible();
  });

  test('필터가 동작함', async ({ page }) => {
    await page.goto('/job-board');

    // 필터 버튼 클릭
    await page.click('[data-testid="filter-button"]');

    // 지역 필터 선택
    await page.click('text=서울');
    await page.click('[data-testid="apply-filter"]');

    // URL 파라미터 확인
    await expect(page).toHaveURL(/region=seoul/);
  });

  test('반응형 레이아웃', async ({ page }) => {
    // 데스크톱
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/job-board');

    // 사이드바 필터가 보임
    await expect(page.locator('[data-testid="filter-sidebar"]')).toBeVisible();

    // 모바일
    await page.setViewportSize({ width: 375, height: 667 });

    // 사이드바 숨김, 필터 버튼 표시
    await expect(page.locator('[data-testid="filter-sidebar"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="filter-button"]')).toBeVisible();
  });
});
```

---

## 10. 배포

### 10.1 Firebase Hosting 설정

```json
// firebase.json
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

### 10.2 배포 스크립트

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
echo "📍 URL: https://uniqn.app"
```

### 10.3 CI/CD 웹 배포

```yaml
# .github/workflows/deploy-web.yml
name: Deploy Web

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'app/**'
      - 'package.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build web
        run: npx expo export --platform web --output-dir dist
        env:
          EXPO_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          EXPO_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
```

### 10.4 Preview 배포 (PR별)

```yaml
# .github/workflows/preview-web.yml
name: Preview Web

on:
  pull_request:
    branches: [main, develop]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build web
        run: npx expo export --platform web --output-dir dist

      - name: Deploy to Firebase Preview Channel
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
          # PR별 고유 프리뷰 URL 생성
```

---

## 요약

### React Native Web 체크리스트

```yaml
초기 설정:
  - [ ] app.json 웹 설정
  - [ ] metro.config.js 웹 번들링 설정
  - [ ] 웹 빌드 테스트 (npx expo export --platform web)

플랫폼 분기:
  - [ ] platform.ts 유틸리티 생성
  - [ ] 네이티브 전용 기능 처리 (카메라, 생체인증)
  - [ ] 플랫폼별 파일 (.web.tsx, .native.tsx)

반응형:
  - [ ] useResponsive 훅 구현
  - [ ] 브레이크포인트 정의
  - [ ] 반응형 네비게이션

최적화:
  - [ ] 코드 스플리팅
  - [ ] 이미지 최적화
  - [ ] 번들 크기 분석

SEO:
  - [ ] SEO 컴포넌트
  - [ ] 페이지별 메타태그
  - [ ] 구조화된 데이터

배포:
  - [ ] Firebase Hosting 설정
  - [ ] CI/CD 파이프라인
  - [ ] Preview 배포
```

### 성능 목표

| 항목 | 목표 |
|------|------|
| 첫 로드 (LCP) | < 2.5초 |
| 상호작용 (FID) | < 100ms |
| 시각적 안정성 (CLS) | < 0.1 |
| 번들 크기 (gzip) | < 500KB |
| Lighthouse 점수 | 90+ |

---

## 관련 문서

- [14-migration-plan.md](./14-migration-plan.md) - 마이그레이션 전체 계획
- [00-overview.md](./00-overview.md) - 프로젝트 개요
- [15-cicd.md](./15-cicd.md) - CI/CD 파이프라인
- [16-analytics.md](./16-analytics.md) - 웹 분석 설정
