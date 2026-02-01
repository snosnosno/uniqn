# 15. CI/CD 파이프라인

## 개요

UNIQN React Native 앱의 지속적 통합(CI) 및 지속적 배포(CD) 파이프라인 현황입니다.
Expo EAS Build를 활용하여 Windows 환경에서도 iOS/Android 빌드가 가능합니다.

---

## 1. 파이프라인 아키텍처

### 1.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CI/CD Pipeline (현재 구현)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Push/PR] ──► [Quality Check] ──► [Tests] ──► [Bundle Check]          │
│                                         │                               │
│                                         ▼                               │
│                               ┌─────────────────┐                       │
│                               │  EAS Build Check│ (PR only)            │
│                               └────────┬────────┘                       │
│                                        │                                │
│         ┌──────────────────────────────┼──────────────────────┐        │
│         ▼                              ▼                      ▼        │
│  ┌────────────┐              ┌────────────┐            ┌────────────┐  │
│  │    Dev     │              │  Preview   │            │ Production │  │
│  │   Build    │              │   Build    │            │   Build    │  │
│  │ (수동 실행) │              │ (수동 실행) │            │ (태그 기반) │  │
│  └─────┬──────┘              └─────┬──────┘            └─────┬──────┘  │
│        │                           │                         │         │
│        ▼                           ▼                         ▼         │
│  [Internal Test]           [TestFlight/            [App Store/         │
│                             Internal Track]         Google Play]       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 환경 구성

| 환경 | 브랜치 | 빌드 프로필 | 배포 대상 |
|------|--------|-------------|-----------|
| Development | `develop`, feature/* | `development` | 내부 테스트 |
| Preview (Staging) | `staging` | `preview` | TestFlight, Internal Track |
| Production | `main` + 태그 | `production` | App Store, Google Play |

---

## 2. GitHub Actions 워크플로우

### 2.1 CI 워크플로우 (현재 구현)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, master, develop]
    paths:
      - 'uniqn-mobile/**'
      - '.github/workflows/ci.yml'
  push:
    branches: [main, master, develop]
    paths:
      - 'uniqn-mobile/**'
      - '.github/workflows/ci.yml'

defaults:
  run:
    working-directory: uniqn-mobile

jobs:
  # ────────────────────────────────────────────
  # 코드 품질 검사
  # ────────────────────────────────────────────
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: uniqn-mobile/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: TypeScript Check
        run: npm run type-check

      - name: ESLint
        run: npm run lint

      - name: Prettier Check
        run: npm run format:check

  # ────────────────────────────────────────────
  # 테스트
  # ────────────────────────────────────────────
  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: uniqn-mobile/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run Tests with Coverage
        run: npm run test:coverage

      - name: Upload Coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./uniqn-mobile/coverage/lcov.info
          flags: uniqn-mobile
          fail_ci_if_error: false
        env:
          CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}

  # ────────────────────────────────────────────
  # 번들 크기 검사
  # ────────────────────────────────────────────
  bundle-check:
    name: Bundle Size Check
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: uniqn-mobile/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build Web Bundle
        run: npm run build:web

      - name: Check Bundle Size
        id: bundle-check
        run: node scripts/check-bundle-size.js

      - name: Comment Bundle Size on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const bundleReport = fs.readFileSync('bundle-size-report.txt', 'utf8');

            const body = `## 📦 Bundle Size Report\n\n${bundleReport}\n\n**Target**: < 500KB (gzip)`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });

  # ────────────────────────────────────────────
  # EAS 빌드 검증 (PR only)
  # ────────────────────────────────────────────
  eas-check:
    name: EAS Build Check
    runs-on: ubuntu-latest
    needs: [test, bundle-check]
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: uniqn-mobile/package-lock.json

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: EAS Build Dry Run (iOS)
        run: eas build --platform ios --profile preview --non-interactive --dry-run
        continue-on-error: true

      - name: EAS Build Dry Run (Android)
        run: eas build --platform android --profile preview --non-interactive --dry-run
        continue-on-error: true
```

### 2.2 프로덕션 빌드 (향후 구현 예정)

```yaml
# .github/workflows/build-prod.yml (예정)
name: Production Build & Deploy

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy (e.g., 1.0.0)'
        required: true

jobs:
  validate:
    name: Pre-release Validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: uniqn-mobile/package-lock.json
      - run: npm ci
      - run: npm run quality
      - run: npm run test:coverage

  build-ios:
    name: iOS Production Build
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform ios --profile production --non-interactive
      - run: eas submit --platform ios --latest --non-interactive

  build-android:
    name: Android Production Build
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform android --profile production --non-interactive
      - run: eas submit --platform android --latest --non-interactive
```

---

## 3. EAS Build 설정

### 3.1 eas.json (현재 구현)

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "base": {
      "node": "22.12.0"
    },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development"
      },
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "channel": "staging",
      "env": {
        "APP_ENV": "staging"
      },
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "extends": "base",
      "distribution": "store",
      "channel": "production",
      "autoIncrement": true,
      "env": {
        "APP_ENV": "production"
      },
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "${APPLE_ID}",
        "ascAppId": "${ASC_APP_ID}",
        "appleTeamId": "${APPLE_TEAM_ID}"
      },
      "android": {
        "serviceAccountKeyPath": "./playstore-credentials.json",
        "track": "internal"
      }
    }
  }
}
```

### 3.2 app.config.ts (현재 구현)

```typescript
// app.config.ts
import { ExpoConfig, ConfigContext } from 'expo/config';

const VERSION = '1.0.0';
const BUILD_NUMBER = 1;

type Environment = 'development' | 'staging' | 'production';

const getEnvironment = (): Environment => {
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  if (buildProfile === 'production') return 'production';
  if (buildProfile === 'preview') return 'staging';
  return 'development';
};

const environment = getEnvironment();

const ENV_CONFIG = {
  development: {
    appName: 'UNIQN (Dev)',
    bundleIdentifier: 'com.uniqn.mobile.dev',
    androidPackage: 'com.uniqn.mobile.dev',
  },
  staging: {
    appName: 'UNIQN (Staging)',
    bundleIdentifier: 'com.uniqn.mobile.staging',
    androidPackage: 'com.uniqn.mobile.staging',
  },
  production: {
    appName: 'UNIQN',
    bundleIdentifier: 'com.uniqn.mobile',
    androidPackage: 'com.uniqn.mobile',
  },
} as const;

const envConfig = ENV_CONFIG[environment];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: envConfig.appName,
  slug: 'uniqn',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'uniqn',

  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: envConfig.bundleIdentifier,
    buildNumber: String(BUILD_NUMBER),
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      NSCameraUsageDescription: 'QR 코드 스캔을 위해 카메라 접근이 필요합니다.',
      NSPhotoLibraryUsageDescription: '프로필 사진 등록을 위해 사진 라이브러리 접근이 필요합니다.',
      NSFaceIDUsageDescription: '빠른 로그인을 위해 Face ID를 사용합니다.',
    },
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: envConfig.androidPackage,
    versionCode: BUILD_NUMBER,
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.CAMERA',
      'android.permission.VIBRATE',
    ],
  },

  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-camera', {
      cameraPermission: 'QR 코드 스캔을 위해 카메라 접근이 필요합니다.',
    }],
    ['expo-local-authentication', {
      faceIDPermission: '빠른 로그인을 위해 Face ID를 사용합니다.',
    }],
    '@react-native-community/datetimepicker',
    ['expo-notifications', {
      icon: './assets/icon.png',
      color: '#A855F7',
    }],
    ['@sentry/react-native/expo', {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    }],
  ],

  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '9bca3314-2a12-4654-ad9c-3ae43f8cf125',
    },
    version: VERSION,
    buildNumber: BUILD_NUMBER,
    environment,
    buildDate: new Date().toISOString(),
    socialLoginEnabled: environment === 'development',
  },

  updates: {
    enabled: true,
    fallbackToCacheTimeout: 0,
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID || '9bca3314-2a12-4654-ad9c-3ae43f8cf125'}`,
  },

  runtimeVersion: {
    policy: 'sdkVersion',
  },
});
```

---

## 4. 환경 변수 관리

### 4.1 GitHub Secrets 구성

```yaml
# 필수 Secrets
EXPO_TOKEN: "expo_xxxxxxxxxxxxxx"        # Expo 액세스 토큰
CODECOV_TOKEN: "codecov_token"           # 커버리지 리포트

# Apple (iOS 배포용) - 향후 설정
APPLE_ID: "developer@uniqn.app"
APPLE_TEAM_ID: "XXXXXXXXXX"
ASC_APP_ID: "1234567890"

# Google Play (Android 배포용) - 향후 설정
# playstore-credentials.json 파일로 관리

# Sentry
SENTRY_ORG: "your-org"
SENTRY_PROJECT: "uniqn-mobile"
```

### 4.2 EAS Secrets

```bash
# EAS 시크릿 설정
eas secret:create --scope project --name SENTRY_DSN --value "https://xxx@sentry.io/xxx"

# 시크릿 목록 확인
eas secret:list
```

---

## 5. 코드 품질 자동화

### 5.1 Pre-commit Hooks (현재 구현)

```json
// package.json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx}\" \"app/**/*.{ts,tsx,js,jsx}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx}\" \"app/**/*.{ts,tsx,js,jsx}\"",
    "quality": "npm run type-check && npm run lint && npm run format:check",
    "test": "jest",
    "test:coverage": "jest --coverage"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

### 5.2 ESLint 설정

```javascript
// 주요 ESLint 규칙 (현재 적용)
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'expo',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
};
```

---

## 6. 테스트 자동화

### 6.1 Jest 설정 (현재 구현)

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/types/**',
  ],
  testEnvironment: 'jsdom',
};
```

### 6.2 테스트 커버리지 목표

| 항목 | 현재 | MVP 목표 | 출시 목표 |
|------|:----:|:--------:|:---------:|
| 전체 커버리지 | 14% | 40% | 60% |
| Services | 40% | 60% | 80% |
| Shared 모듈 | 80% | 80% | 90% |

---

## 7. OTA 업데이트

### 7.1 EAS Update 설정 (현재 구현)

```typescript
// app.config.ts (업데이트 관련)
updates: {
  enabled: true,
  fallbackToCacheTimeout: 0,
  url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
},
runtimeVersion: {
  policy: 'sdkVersion',
},
```

### 7.2 OTA 업데이트 명령어

```bash
# 업데이트 발행
eas update --branch staging --message "버그 수정: 로그인 오류"

# 특정 채널에 업데이트
eas update --channel production --message "긴급 수정"
```

---

## 8. 로컬 개발 명령어

```bash
# ─────────────────────────────────────────
# 개발
# ─────────────────────────────────────────
npm start                    # Expo 개발 서버
npm run ios                  # iOS 시뮬레이터
npm run android              # Android 에뮬레이터
npm run web                  # 웹 브라우저

# ─────────────────────────────────────────
# 품질 검사
# ─────────────────────────────────────────
npm run type-check           # TypeScript 검사
npm run lint                 # ESLint
npm run format:check         # Prettier 검사
npm run quality              # 전체 품질 검사

# ─────────────────────────────────────────
# 테스트
# ─────────────────────────────────────────
npm test                     # 테스트 실행
npm run test:coverage        # 커버리지 포함

# ─────────────────────────────────────────
# 빌드
# ─────────────────────────────────────────
npm run build:web            # 웹 빌드
npm run analyze:bundle       # 번들 분석

# ─────────────────────────────────────────
# EAS 빌드 (클라우드)
# ─────────────────────────────────────────
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile preview --platform all
eas build --profile production --platform all

# ─────────────────────────────────────────
# EAS 제출 (향후)
# ─────────────────────────────────────────
eas submit --platform ios --latest
eas submit --platform android --latest

# ─────────────────────────────────────────
# OTA 업데이트
# ─────────────────────────────────────────
eas update --branch staging --message "업데이트 메시지"
eas update --branch production --message "업데이트 메시지"

# ─────────────────────────────────────────
# 빌드 상태 확인
# ─────────────────────────────────────────
eas build:list --limit 5
eas build:view <build-id>
```

---

## 9. 배포 체크리스트

### 9.1 PR 머지 전 확인

```markdown
## PR 체크리스트

### 코드 품질 (자동)
- [ ] TypeScript 에러 없음
- [ ] ESLint 에러 없음
- [ ] Prettier 포맷 통과
- [ ] 테스트 통과

### 코드 리뷰 (수동)
- [ ] 비즈니스 로직 검증
- [ ] 에러 처리 확인
- [ ] 다크모드 지원 확인
```

### 9.2 프로덕션 배포 전 확인 (향후)

```markdown
## 프로덕션 배포 체크리스트

### 코드 품질
- [ ] TypeScript 에러 없음
- [ ] ESLint 에러 없음
- [ ] 테스트 통과

### 기능 검증
- [ ] Staging에서 전체 기능 테스트 완료
- [ ] 크리티컬 플로우 수동 테스트
  - [ ] 회원가입/로그인
  - [ ] 지원하기
  - [ ] QR 출퇴근
  - [ ] 정산

### 빌드 및 배포
- [ ] 버전 번호 업데이트
- [ ] 릴리스 노트 작성
- [ ] Firebase 설정 확인
```

---

## 10. 향후 계획

### 10.1 CI/CD 개선 로드맵

```yaml
Phase 3 (예정):
  - E2E 테스트 (Maestro) 추가
  - 자동 버전 범핑
  - 릴리스 자동화

Phase 4 (예정):
  - 프로덕션 배포 파이프라인
  - App Store / Google Play 자동 제출
  - 단계적 출시 (Phased Release)
  - Fastlane 연동 (메타데이터 관리)
```

### 10.2 모니터링 연동 (예정)

```yaml
Sentry:
  - 릴리스 연동
  - 소스맵 업로드
  - 에러 알림

Slack:
  - 빌드 성공/실패 알림
  - 배포 알림
```

---

## 요약

| 항목 | 도구/서비스 | 상태 |
|------|-------------|:----:|
| CI 플랫폼 | GitHub Actions | ✅ 구현 |
| 빌드 서비스 | Expo EAS Build | ✅ 구현 |
| 코드 품질 | ESLint, Prettier, TypeScript, Husky | ✅ 구현 |
| 테스트 | Jest, React Native Testing Library | ✅ 구현 |
| 커버리지 | Codecov | ✅ 구현 |
| 번들 분석 | source-map-explorer | ✅ 구현 |
| OTA 업데이트 | EAS Update | ✅ 설정 |
| iOS 배포 | App Store Connect (EAS Submit) | 예정 |
| Android 배포 | Google Play Console (EAS Submit) | 예정 |
| 에러 모니터링 | Sentry | ✅ 구현 |
| 알림 | Slack | 예정 |

---

## 관련 문서

- [18-app-store-guide.md](./18-app-store-guide.md) - 스토어 제출 가이드라인
- [16-analytics.md](./16-analytics.md) - 앱 분석 및 모니터링
- [14-migration-plan.md](./14-migration-plan.md) - 마이그레이션 완료 보고서

---

*마지막 업데이트: 2026-02-02*
*CI/CD 상태: 기본 CI 파이프라인 구현 완료*
