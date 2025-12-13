# 15. CI/CD 파이프라인

## 개요

UNIQN React Native 앱의 지속적 통합(CI) 및 지속적 배포(CD) 파이프라인을 정의합니다.
Expo EAS Build를 활용하여 Windows 환경에서도 iOS/Android 빌드가 가능하도록 구성합니다.

---

## 1. 파이프라인 아키텍처

### 1.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CI/CD Pipeline                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Push/PR] ──► [Lint/Type Check] ──► [Unit Tests] ──► [Build Check]    │
│                                                                         │
│                              │                                          │
│                              ▼                                          │
│                    ┌─────────────────┐                                  │
│                    │   PR Merge      │                                  │
│                    └────────┬────────┘                                  │
│                              │                                          │
│         ┌────────────────────┼────────────────────┐                    │
│         ▼                    ▼                    ▼                    │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐               │
│  │    Dev     │      │  Staging   │      │   Prod     │               │
│  │   Build    │      │   Build    │      │   Build    │               │
│  └─────┬──────┘      └─────┬──────┘      └─────┬──────┘               │
│        │                    │                    │                     │
│        ▼                    ▼                    ▼                     │
│  [Internal Test]    [TestFlight/     [App Store/                      │
│                      Internal Track]  Google Play]                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 환경 구성

| 환경 | 브랜치 | 빌드 프로필 | 배포 대상 |
|------|--------|-------------|-----------|
| Development | `develop`, feature/* | `development` | 내부 테스트 |
| Staging | `staging` | `preview` | TestFlight, Internal Track |
| Production | `main` | `production` | App Store, Google Play |

---

## 2. GitHub Actions 워크플로우

### 2.1 PR 검증 (CI)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop, staging]
  push:
    branches: [develop]

env:
  NODE_VERSION: '18'

jobs:
  # ────────────────────────────────────────────
  # 코드 품질 검사
  # ────────────────────────────────────────────
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npm run type-check

      - name: Check formatting
        run: npm run format:check

  # ────────────────────────────────────────────
  # 단위/통합 테스트
  # ────────────────────────────────────────────
  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- --coverage --ci

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  # ────────────────────────────────────────────
  # 빌드 검증
  # ────────────────────────────────────────────
  build-check:
    name: Build Check
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Export web build (verification)
        run: npx expo export --platform web

      - name: Verify EAS config
        run: eas build --platform all --profile preview --non-interactive --dry-run
```

### 2.2 Development 빌드

```yaml
# .github/workflows/build-dev.yml
name: Development Build

on:
  push:
    branches: [develop]
  workflow_dispatch:

jobs:
  build:
    name: EAS Development Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Build iOS (Development)
        run: eas build --platform ios --profile development --non-interactive

      - name: Build Android (Development)
        run: eas build --platform android --profile development --non-interactive

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          fields: repo,message,commit,author,action,eventName,workflow
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 2.3 Staging 빌드 및 배포

```yaml
# .github/workflows/build-staging.yml
name: Staging Build & Deploy

on:
  push:
    branches: [staging]
  workflow_dispatch:

jobs:
  build-and-deploy:
    name: Build & Deploy to TestFlight/Internal
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --ci

      - name: Build & Submit iOS
        run: |
          eas build --platform ios --profile preview --non-interactive --auto-submit

      - name: Build & Submit Android
        run: |
          eas build --platform android --profile preview --non-interactive --auto-submit

      - name: Notify team
        if: success()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-type: application/json' \
            -d '{
              "text": "🚀 Staging 빌드 완료!\niOS: TestFlight에 업로드됨\nAndroid: Internal Track에 업로드됨"
            }'
```

### 2.4 Production 빌드 및 배포

```yaml
# .github/workflows/build-prod.yml
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
  # ────────────────────────────────────────────
  # 검증
  # ────────────────────────────────────────────
  validate:
    name: Pre-release Validation
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

      - name: Run all tests
        run: npm test -- --ci --coverage

      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi

  # ────────────────────────────────────────────
  # iOS 빌드 및 제출
  # ────────────────────────────────────────────
  build-ios:
    name: iOS Production Build
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Build iOS
        run: |
          eas build --platform ios --profile production --non-interactive

      - name: Submit to App Store
        run: |
          eas submit --platform ios --latest --non-interactive

  # ────────────────────────────────────────────
  # Android 빌드 및 제출
  # ────────────────────────────────────────────
  build-android:
    name: Android Production Build
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Build Android
        run: |
          eas build --platform android --profile production --non-interactive

      - name: Submit to Google Play
        run: |
          eas submit --platform android --latest --non-interactive

  # ────────────────────────────────────────────
  # 릴리스 노트
  # ────────────────────────────────────────────
  create-release:
    name: Create GitHub Release
    runs-on: ubuntu-latest
    needs: [build-ios, build-android]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Generate changelog
        id: changelog
        uses: metcalfc/changelog-generator@v4.1.0
        with:
          myToken: ${{ secrets.GITHUB_TOKEN }}

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: false
```

---

## 3. EAS Build 설정

### 3.1 eas.json

```json
{
  "cli": {
    "version": ">= 5.9.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development",
        "API_URL": "https://dev-api.uniqn.app"
      },
      "ios": {
        "simulator": true,
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "APP_ENV": "staging",
        "API_URL": "https://staging-api.uniqn.app"
      },
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      },
      "channel": "staging"
    },
    "production": {
      "distribution": "store",
      "env": {
        "APP_ENV": "production",
        "API_URL": "https://api.uniqn.app"
      },
      "ios": {
        "resourceClass": "large"
      },
      "android": {
        "buildType": "app-bundle"
      },
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "developer@uniqn.app",
        "ascAppId": "1234567890",
        "appleTeamId": "XXXXXXXXXX"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "production",
        "releaseStatus": "completed"
      }
    },
    "staging": {
      "ios": {
        "appleId": "developer@uniqn.app",
        "ascAppId": "1234567890",
        "appleTeamId": "XXXXXXXXXX"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### 3.2 app.config.ts (동적 설정)

```typescript
// app.config.ts
import { ExpoConfig, ConfigContext } from 'expo/config';

const APP_ENV = process.env.APP_ENV || 'development';

const envConfig = {
  development: {
    name: 'UNIQN (Dev)',
    bundleIdentifier: 'app.uniqn.dev',
    package: 'app.uniqn.dev',
    apiUrl: 'https://dev-api.uniqn.app',
    firebaseConfig: {
      projectId: 'uniqn-dev',
    },
  },
  staging: {
    name: 'UNIQN (Staging)',
    bundleIdentifier: 'app.uniqn.staging',
    package: 'app.uniqn.staging',
    apiUrl: 'https://staging-api.uniqn.app',
    firebaseConfig: {
      projectId: 'uniqn-staging',
    },
  },
  production: {
    name: 'UNIQN',
    bundleIdentifier: 'app.uniqn',
    package: 'app.uniqn',
    apiUrl: 'https://api.uniqn.app',
    firebaseConfig: {
      projectId: 'tholdem-ebc18',
    },
  },
};

const config = envConfig[APP_ENV as keyof typeof envConfig];

export default ({ config: expoConfig }: ConfigContext): ExpoConfig => ({
  ...expoConfig,
  name: config.name,
  slug: 'uniqn',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    bundleIdentifier: config.bundleIdentifier,
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'QR 코드 스캔을 위해 카메라 접근이 필요합니다.',
      NSPhotoLibraryUsageDescription: '프로필 사진 업로드를 위해 사진 접근이 필요합니다.',
      UIBackgroundModes: ['remote-notification'],
    },
    entitlements: {
      'aps-environment': APP_ENV === 'production' ? 'production' : 'development',
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: config.package,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ],
    googleServicesFile: `./google-services.${APP_ENV}.json`,
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: 'QR 코드 스캔을 위해 카메라 접근이 필요합니다.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: '프로필 사진 업로드를 위해 사진 접근이 필요합니다.',
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/firestore',
    '@react-native-firebase/messaging',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
        },
      },
    ],
  ],
  extra: {
    apiUrl: config.apiUrl,
    firebaseConfig: config.firebaseConfig,
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
  updates: {
    url: 'https://u.expo.dev/your-eas-project-id',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
```

---

## 4. 환경 변수 관리

### 4.1 Secrets 구성

```yaml
# GitHub Repository Secrets
EXPO_TOKEN: "expo_xxxxxxxxxxxxxx"        # Expo 액세스 토큰
CODECOV_TOKEN: "codecov_token"           # 커버리지 리포트
SLACK_WEBHOOK: "https://hooks.slack.com/..." # Slack 알림

# Apple (iOS 배포용)
APPLE_ID: "developer@uniqn.app"
APPLE_TEAM_ID: "XXXXXXXXXX"
ASC_KEY_ID: "XXXXXXXXXX"
ASC_ISSUER_ID: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
ASC_KEY: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Google Play (Android 배포용)
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY: "{...}"  # Base64 encoded JSON
```

### 4.2 환경별 Firebase 설정

```
# 파일 구조
/
├── google-services.development.json
├── google-services.staging.json
├── google-services.production.json  # 또는 google-services.json
├── GoogleService-Info.development.plist
├── GoogleService-Info.staging.plist
└── GoogleService-Info.production.plist
```

### 4.3 EAS Secrets

```bash
# EAS 시크릿 설정
eas secret:create --scope project --name SENTRY_DSN --value "https://xxx@sentry.io/xxx"
eas secret:create --scope project --name FIREBASE_API_KEY --value "AIzaXXX"

# 시크릿 목록 확인
eas secret:list
```

---

## 5. 코드 품질 자동화

### 5.1 Pre-commit Hooks

```json
// package.json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "jest",
    "test:ci": "jest --ci --coverage"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

```bash
# .husky/pre-push
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run type-check
npm test -- --passWithNoTests
```

### 5.2 ESLint 설정

```javascript
// .eslintrc.js
module.exports = {
  root: true,
  extends: [
    'expo',
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'react-hooks', 'import'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  rules: {
    // TypeScript
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // React
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/prop-types': 'off',

    // Import
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],

    // General
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
  },
  ignorePatterns: ['node_modules/', 'dist/', '.expo/', 'coverage/'],
};
```

### 5.3 Prettier 설정

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

---

## 6. 테스트 자동화

### 6.1 Jest CI 설정

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
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
};
```

### 6.2 E2E 테스트 (Maestro)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [staging]
  workflow_dispatch:

jobs:
  e2e-ios:
    name: iOS E2E Tests
    runs-on: macos-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          export PATH="$PATH:$HOME/.maestro/bin"

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Build iOS simulator app
        run: |
          eas build --platform ios --profile development --local

      - name: Run E2E tests
        run: |
          maestro test e2e/flows/ --env=APP_ID=app.uniqn.dev

  e2e-android:
    name: Android E2E Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: AVD cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.android/avd/*
            ~/.android/adb*
          key: avd-api-33

      - name: Create AVD and run tests
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 33
          arch: x86_64
          profile: pixel_6
          script: |
            npm ci
            npx expo prebuild --platform android
            cd android && ./gradlew assembleDebug
            adb install app/build/outputs/apk/debug/app-debug.apk
            maestro test e2e/flows/
```

---

## 7. OTA 업데이트

### 7.1 EAS Update 설정

```bash
# 업데이트 발행
eas update --branch staging --message "버그 수정: 로그인 오류"

# 특정 채널에 업데이트
eas update --channel production --message "긴급 수정"
```

### 7.2 자동 OTA 업데이트 워크플로우

```yaml
# .github/workflows/ota-update.yml
name: OTA Update

on:
  push:
    branches: [hotfix/*]
  workflow_dispatch:
    inputs:
      branch:
        description: 'Update branch (staging/production)'
        required: true
        default: 'staging'
      message:
        description: 'Update message'
        required: true

jobs:
  ota-update:
    name: Publish OTA Update
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --ci

      - name: Publish update
        run: |
          BRANCH=${{ github.event.inputs.branch || 'staging' }}
          MESSAGE=${{ github.event.inputs.message || 'Hotfix update' }}
          eas update --branch $BRANCH --message "$MESSAGE"

      - name: Notify team
        if: success()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-type: application/json' \
            -d '{
              "text": "📲 OTA 업데이트 발행됨\nBranch: ${{ github.event.inputs.branch }}\nMessage: ${{ github.event.inputs.message }}"
            }'
```

---

## 8. 모니터링 및 알림

### 8.1 빌드 알림 설정

```yaml
# 공통 알림 job
notify:
  name: Send Notifications
  runs-on: ubuntu-latest
  needs: [build-ios, build-android]
  if: always()
  steps:
    - name: Slack Notification
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ needs.build-ios.result == 'success' && needs.build-android.result == 'success' && 'success' || 'failure' }}
        fields: repo,message,commit,author,action,eventName,workflow
        mention: 'channel'
        if_mention: failure
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

    - name: Discord Notification
      if: always()
      uses: sarisia/actions-status-discord@v1
      with:
        webhook: ${{ secrets.DISCORD_WEBHOOK }}
        status: ${{ job.status }}
        title: "UNIQN 앱 빌드"
```

### 8.2 빌드 대시보드

```typescript
// scripts/build-status.ts
// EAS Build 상태 조회 스크립트

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getBuildStatus() {
  const { stdout } = await execAsync('eas build:list --json --limit 10');
  const builds = JSON.parse(stdout);

  console.log('\n📱 최근 빌드 상태\n');
  console.log('Platform | Profile    | Status     | Created');
  console.log('---------|------------|------------|------------------');

  builds.forEach((build: any) => {
    const status = build.status === 'FINISHED' ? '✅ 완료' :
                   build.status === 'IN_PROGRESS' ? '🔄 진행중' :
                   build.status === 'ERRORED' ? '❌ 실패' : build.status;

    console.log(
      `${build.platform.padEnd(8)} | ${build.profile.padEnd(10)} | ${status.padEnd(10)} | ${new Date(build.createdAt).toLocaleString()}`
    );
  });
}

getBuildStatus();
```

---

## 9. 배포 체크리스트

### 9.1 프로덕션 배포 전 확인사항

```markdown
## 프로덕션 배포 체크리스트

### 코드 품질
- [ ] 모든 PR 리뷰 완료
- [ ] TypeScript 에러 없음 (`npm run type-check`)
- [ ] ESLint 경고 없음 (`npm run lint`)
- [ ] 테스트 통과 (`npm test`)
- [ ] 커버리지 80% 이상

### 기능 검증
- [ ] Staging에서 전체 기능 테스트 완료
- [ ] E2E 테스트 통과
- [ ] 크리티컬 플로우 수동 테스트
  - [ ] 회원가입/로그인
  - [ ] 지원하기
  - [ ] QR 출퇴근
  - [ ] 정산

### 빌드 및 배포
- [ ] 버전 번호 업데이트
- [ ] 릴리스 노트 작성
- [ ] Firebase 설정 확인
- [ ] API 엔드포인트 확인

### 앱 스토어
- [ ] 앱 설명 업데이트
- [ ] 스크린샷 최신화
- [ ] 개인정보처리방침 확인
- [ ] 앱 심사 가이드라인 준수 확인
```

### 9.2 롤백 절차

```bash
# 1. OTA 업데이트 롤백
eas update:rollback --channel production

# 2. 이전 빌드로 재제출 (스토어 배포 롤백)
eas submit --platform ios --id <previous-build-id>
eas submit --platform android --id <previous-build-id>

# 3. 긴급 수정 배포
git checkout -b hotfix/critical-fix
# ... 수정 작업
git push origin hotfix/critical-fix
# GitHub Actions에서 자동 OTA 업데이트
```

---

## 10. 로컬 개발 명령어

```bash
# ─────────────────────────────────────────
# 빌드 & 실행
# ─────────────────────────────────────────
npm start                    # Expo 개발 서버
npm run ios                  # iOS 시뮬레이터
npm run android              # Android 에뮬레이터

# ─────────────────────────────────────────
# EAS 빌드 (클라우드)
# ─────────────────────────────────────────
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile preview --platform all
eas build --profile production --platform all

# ─────────────────────────────────────────
# EAS 제출
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

## 11. 버전 자동 관리

### 11.1 Semantic Versioning 전략

```
버전 형식: MAJOR.MINOR.PATCH (예: 1.2.3)

MAJOR: 호환성이 깨지는 변경 (수동)
MINOR: 새로운 기능 추가 (자동/수동)
PATCH: 버그 수정 (자동)
```

### 11.2 자동 버전 증가 스크립트

```typescript
// scripts/bump-version.ts
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

type BumpType = 'major' | 'minor' | 'patch';

interface AppJson {
  expo: {
    version: string;
    ios?: { buildNumber?: string };
    android?: { versionCode?: number };
  };
}

function bumpVersion(type: BumpType): void {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  // app.json 읽기
  const appJson: AppJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // 현재 버전 파싱
  const currentVersion = appJson.expo.version;
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  // 새 버전 계산
  let newVersion: string;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  // 버전 업데이트
  appJson.expo.version = newVersion;
  packageJson.version = newVersion;

  // iOS buildNumber 증가 (숫자로 관리)
  if (appJson.expo.ios) {
    const currentBuildNumber = parseInt(appJson.expo.ios.buildNumber || '1', 10);
    appJson.expo.ios.buildNumber = String(currentBuildNumber + 1);
  }

  // Android versionCode 증가
  if (appJson.expo.android) {
    const currentVersionCode = appJson.expo.android.versionCode || 1;
    appJson.expo.android.versionCode = currentVersionCode + 1;
  }

  // 파일 저장
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`✅ 버전 업데이트: ${currentVersion} → ${newVersion}`);
  console.log(`   iOS buildNumber: ${appJson.expo.ios?.buildNumber}`);
  console.log(`   Android versionCode: ${appJson.expo.android?.versionCode}`);
}

// CLI 실행
const type = process.argv[2] as BumpType;
if (!['major', 'minor', 'patch'].includes(type)) {
  console.error('Usage: npx ts-node scripts/bump-version.ts <major|minor|patch>');
  process.exit(1);
}

bumpVersion(type);
```

### 11.3 Git Tag 기반 자동 버전

```yaml
# .github/workflows/auto-version.yml
name: Auto Version Bump

on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - '.github/**'

jobs:
  version-bump:
    name: Bump Version
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Determine version bump type
        id: bump-type
        run: |
          # 마지막 커밋 메시지 분석
          COMMIT_MSG=$(git log -1 --pretty=%B)

          if [[ "$COMMIT_MSG" == *"BREAKING CHANGE"* ]] || [[ "$COMMIT_MSG" == *"!"* ]]; then
            echo "type=major" >> $GITHUB_OUTPUT
          elif [[ "$COMMIT_MSG" == feat:* ]] || [[ "$COMMIT_MSG" == feature:* ]]; then
            echo "type=minor" >> $GITHUB_OUTPUT
          else
            echo "type=patch" >> $GITHUB_OUTPUT
          fi

      - name: Bump version
        run: |
          npx ts-node scripts/bump-version.ts ${{ steps.bump-type.outputs.type }}

      - name: Get new version
        id: new-version
        run: |
          VERSION=$(node -p "require('./app.json').expo.version")
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Commit and tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          git add app.json package.json
          git commit -m "chore: bump version to ${{ steps.new-version.outputs.version }}"
          git tag "v${{ steps.new-version.outputs.version }}"

          git push origin main --tags

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: v${{ steps.new-version.outputs.version }}
          generate_release_notes: true
```

### 11.4 Conventional Commits 연동

```bash
# commitlint 설정
npm install -D @commitlint/cli @commitlint/config-conventional

# commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 새로운 기능 (minor bump)
        'fix',      // 버그 수정 (patch bump)
        'docs',     // 문서 수정
        'style',    // 코드 스타일
        'refactor', // 리팩토링
        'perf',     // 성능 개선
        'test',     // 테스트
        'chore',    // 기타
        'revert',   // 되돌리기
        'ci',       // CI 설정
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case']],
  },
};

# .husky/commit-msg
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit "$1"
```

---

## 12. 스토어 자동화 (Fastlane 연동)

> **참고**: EAS Submit으로 기본 제출은 가능하지만, 메타데이터 관리와 고급 기능은 Fastlane이 더 강력합니다.

### 12.1 Fastlane 설치 및 초기화

```bash
# Fastlane 설치 (macOS/Linux)
# Windows는 WSL 사용 권장
brew install fastlane

# 또는 gem으로 설치
gem install fastlane

# 프로젝트 초기화
cd ios && fastlane init
cd android && fastlane init
```

### 12.2 iOS Fastfile

```ruby
# ios/fastlane/Fastfile
default_platform(:ios)

platform :ios do
  # ────────────────────────────────────────────
  # 메타데이터 다운로드
  # ────────────────────────────────────────────
  desc "Download metadata and screenshots from App Store Connect"
  lane :download_metadata do
    download_metadata(
      api_key_path: "./fastlane/api_key.json"
    )
  end

  # ────────────────────────────────────────────
  # 스크린샷 자동 생성
  # ────────────────────────────────────────────
  desc "Generate screenshots"
  lane :screenshots do
    capture_screenshots(
      workspace: "UNIQN.xcworkspace",
      scheme: "UNIQN",
      devices: [
        "iPhone 15 Pro Max",
        "iPhone 15",
        "iPhone SE (3rd generation)",
        "iPad Pro (12.9-inch) (6th generation)"
      ],
      languages: ["ko"],
      clear_previous_screenshots: true,
      output_directory: "./fastlane/screenshots"
    )

    frame_screenshots(
      path: "./fastlane/screenshots"
    )
  end

  # ────────────────────────────────────────────
  # 메타데이터 업로드
  # ────────────────────────────────────────────
  desc "Upload metadata to App Store Connect"
  lane :upload_metadata do
    upload_to_app_store(
      api_key_path: "./fastlane/api_key.json",
      skip_binary_upload: true,
      skip_screenshots: false,
      force: true,
      metadata_path: "./fastlane/metadata",
      screenshots_path: "./fastlane/screenshots"
    )
  end

  # ────────────────────────────────────────────
  # TestFlight 배포
  # ────────────────────────────────────────────
  desc "Upload to TestFlight"
  lane :beta do |options|
    ipa_path = options[:ipa_path]

    upload_to_testflight(
      api_key_path: "./fastlane/api_key.json",
      ipa: ipa_path,
      skip_waiting_for_build_processing: false,
      distribute_external: true,
      groups: ["External Testers"],
      changelog: options[:changelog] || "버그 수정 및 성능 개선"
    )

    slack(
      message: "✅ iOS TestFlight 업로드 완료!",
      slack_url: ENV["SLACK_WEBHOOK"]
    )
  end

  # ────────────────────────────────────────────
  # 프로덕션 제출
  # ────────────────────────────────────────────
  desc "Submit to App Store Review"
  lane :release do |options|
    ipa_path = options[:ipa_path]

    upload_to_app_store(
      api_key_path: "./fastlane/api_key.json",
      ipa: ipa_path,
      submit_for_review: true,
      automatic_release: false,  # 수동 출시
      force: true,
      precheck_include_in_app_purchases: false,
      submission_information: {
        add_id_info_uses_idfa: false,
        export_compliance_uses_encryption: false,
        content_rights_contains_third_party_content: false
      },
      # 단계적 출시 설정
      phased_release: true
    )

    slack(
      message: "🚀 iOS 앱 심사 제출 완료!",
      slack_url: ENV["SLACK_WEBHOOK"]
    )
  end

  # ────────────────────────────────────────────
  # 인증서 관리
  # ────────────────────────────────────────────
  desc "Sync certificates and profiles"
  lane :sync_certs do
    match(
      type: "appstore",
      app_identifier: "app.uniqn",
      readonly: true
    )
    match(
      type: "development",
      app_identifier: "app.uniqn.dev",
      readonly: true
    )
  end
end
```

### 12.3 Android Fastfile

```ruby
# android/fastlane/Fastfile
default_platform(:android)

platform :android do
  # ────────────────────────────────────────────
  # 내부 테스트 배포
  # ────────────────────────────────────────────
  desc "Upload to Internal Testing track"
  lane :internal do |options|
    aab_path = options[:aab_path]

    upload_to_play_store(
      track: "internal",
      aab: aab_path,
      json_key: "./fastlane/google-play-key.json",
      skip_upload_metadata: true,
      skip_upload_changelogs: false,
      skip_upload_images: true,
      skip_upload_screenshots: true
    )

    slack(
      message: "✅ Android Internal Testing 업로드 완료!",
      slack_url: ENV["SLACK_WEBHOOK"]
    )
  end

  # ────────────────────────────────────────────
  # 베타 배포 (Closed Testing)
  # ────────────────────────────────────────────
  desc "Upload to Closed Testing track"
  lane :beta do |options|
    aab_path = options[:aab_path]

    upload_to_play_store(
      track: "beta",
      aab: aab_path,
      json_key: "./fastlane/google-play-key.json",
      skip_upload_metadata: true
    )
  end

  # ────────────────────────────────────────────
  # 프로덕션 배포
  # ────────────────────────────────────────────
  desc "Upload to Production with staged rollout"
  lane :release do |options|
    aab_path = options[:aab_path]
    rollout = options[:rollout] || 0.1  # 기본 10% 출시

    upload_to_play_store(
      track: "production",
      aab: aab_path,
      json_key: "./fastlane/google-play-key.json",
      rollout: rollout.to_s,  # 단계적 출시 비율
      skip_upload_metadata: false,
      metadata_path: "./fastlane/metadata/android"
    )

    slack(
      message: "🚀 Android Production 배포 완료! (#{(rollout * 100).to_i}% 출시)",
      slack_url: ENV["SLACK_WEBHOOK"]
    )
  end

  # ────────────────────────────────────────────
  # 단계적 출시 확대
  # ────────────────────────────────────────────
  desc "Increase staged rollout percentage"
  lane :increase_rollout do |options|
    new_rollout = options[:percentage] || 0.5

    upload_to_play_store(
      track: "production",
      json_key: "./fastlane/google-play-key.json",
      rollout: new_rollout.to_s,
      skip_upload_aab: true,
      skip_upload_metadata: true
    )

    puts "✅ 출시 비율이 #{(new_rollout * 100).to_i}%로 확대되었습니다."
  end

  # ────────────────────────────────────────────
  # 전체 출시
  # ────────────────────────────────────────────
  desc "Complete the staged rollout"
  lane :complete_rollout do
    upload_to_play_store(
      track: "production",
      json_key: "./fastlane/google-play-key.json",
      rollout: "1.0",
      skip_upload_aab: true,
      skip_upload_metadata: true
    )

    slack(
      message: "🎉 Android 전체 출시 완료!",
      slack_url: ENV["SLACK_WEBHOOK"]
    )
  end

  # ────────────────────────────────────────────
  # 메타데이터 업로드
  # ────────────────────────────────────────────
  desc "Upload metadata and screenshots"
  lane :upload_metadata do
    upload_to_play_store(
      track: "production",
      json_key: "./fastlane/google-play-key.json",
      skip_upload_aab: true,
      skip_upload_changelogs: true,
      metadata_path: "./fastlane/metadata/android"
    )
  end
end
```

### 12.4 메타데이터 디렉토리 구조

```
fastlane/
├── Fastfile
├── Appfile
├── api_key.json          # App Store Connect API 키
├── google-play-key.json  # Google Play 서비스 계정 키
├── metadata/
│   ├── ko/               # 한국어
│   │   ├── name.txt
│   │   ├── subtitle.txt
│   │   ├── description.txt
│   │   ├── keywords.txt
│   │   ├── release_notes.txt
│   │   ├── privacy_url.txt
│   │   └── support_url.txt
│   └── en-US/            # 영어
│       └── ...
├── screenshots/
│   └── ko/
│       ├── iPhone 15 Pro Max/
│       │   ├── 0_splash.png
│       │   ├── 1_home.png
│       │   └── ...
│       └── iPad Pro (12.9-inch)/
│           └── ...
└── android/
    └── ko-KR/
        ├── title.txt
        ├── short_description.txt
        ├── full_description.txt
        └── changelogs/
            └── default.txt
```

### 12.5 CI/CD와 Fastlane 통합

```yaml
# .github/workflows/store-deploy.yml
name: Store Deployment

on:
  workflow_dispatch:
    inputs:
      platform:
        description: 'Platform (ios/android/all)'
        required: true
        default: 'all'
      track:
        description: 'Track (internal/beta/production)'
        required: true
        default: 'internal'
      rollout:
        description: 'Rollout percentage (production only)'
        required: false
        default: '0.1'

jobs:
  deploy-ios:
    if: ${{ github.event.inputs.platform == 'ios' || github.event.inputs.platform == 'all' }}
    runs-on: macos-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Download iOS build from EAS
        run: |
          BUILD_ID=$(eas build:list --platform ios --status finished --limit 1 --json | jq -r '.[0].id')
          eas build:download --id $BUILD_ID --output ./build/UNIQN.ipa

      - name: Setup Fastlane credentials
        run: |
          echo '${{ secrets.APP_STORE_CONNECT_API_KEY }}' > ios/fastlane/api_key.json

      - name: Deploy with Fastlane
        run: |
          cd ios
          if [ "${{ github.event.inputs.track }}" == "production" ]; then
            bundle exec fastlane release ipa_path:../build/UNIQN.ipa
          else
            bundle exec fastlane beta ipa_path:../build/UNIQN.ipa
          fi
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}

  deploy-android:
    if: ${{ github.event.inputs.platform == 'android' || github.event.inputs.platform == 'all' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Download Android build from EAS
        run: |
          BUILD_ID=$(eas build:list --platform android --status finished --limit 1 --json | jq -r '.[0].id')
          eas build:download --id $BUILD_ID --output ./build/UNIQN.aab

      - name: Setup Google Play credentials
        run: |
          echo '${{ secrets.GOOGLE_PLAY_KEY }}' | base64 -d > android/fastlane/google-play-key.json

      - name: Deploy with Fastlane
        run: |
          cd android
          TRACK="${{ github.event.inputs.track }}"
          ROLLOUT="${{ github.event.inputs.rollout }}"

          if [ "$TRACK" == "production" ]; then
            bundle exec fastlane release aab_path:../build/UNIQN.aab rollout:$ROLLOUT
          elif [ "$TRACK" == "beta" ]; then
            bundle exec fastlane beta aab_path:../build/UNIQN.aab
          else
            bundle exec fastlane internal aab_path:../build/UNIQN.aab
          fi
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

### 12.6 스토어 배포 명령어 요약

```bash
# ─────────────────────────────────────────
# iOS 배포 (Fastlane)
# ─────────────────────────────────────────
cd ios

# 메타데이터 다운로드
bundle exec fastlane download_metadata

# 스크린샷 생성 (Xcode 필요)
bundle exec fastlane screenshots

# 메타데이터 업로드
bundle exec fastlane upload_metadata

# TestFlight 배포
bundle exec fastlane beta ipa_path:../build/UNIQN.ipa

# App Store 제출
bundle exec fastlane release ipa_path:../build/UNIQN.ipa

# ─────────────────────────────────────────
# Android 배포 (Fastlane)
# ─────────────────────────────────────────
cd android

# 내부 테스트 배포
bundle exec fastlane internal aab_path:../build/UNIQN.aab

# 베타 배포
bundle exec fastlane beta aab_path:../build/UNIQN.aab

# 프로덕션 배포 (10% 단계적 출시)
bundle exec fastlane release aab_path:../build/UNIQN.aab rollout:0.1

# 출시 비율 확대
bundle exec fastlane increase_rollout percentage:0.5

# 전체 출시
bundle exec fastlane complete_rollout

# 메타데이터 업로드
bundle exec fastlane upload_metadata
```

---

## 13. 고급 CI/CD 패턴

### 13.1 캐싱 최적화

```yaml
# 고급 캐싱 전략
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Cache EAS build
  uses: actions/cache@v4
  with:
    path: ~/.eas-build-local-cache
    key: ${{ runner.os }}-eas-${{ hashFiles('app.json', 'eas.json') }}

- name: Cache Fastlane
  uses: actions/cache@v4
  with:
    path: vendor/bundle
    key: ${{ runner.os }}-gems-${{ hashFiles('**/Gemfile.lock') }}
```

### 13.2 병렬 빌드 최적화

```yaml
# 병렬 빌드 전략
jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.value }}
    steps:
      - uses: actions/checkout@v4
      - id: version
        run: echo "value=$(node -p 'require(\"./app.json\").expo.version')" >> $GITHUB_OUTPUT

  build:
    needs: prepare
    strategy:
      matrix:
        include:
          - platform: ios
            profile: production
          - platform: android
            profile: production
      fail-fast: false  # 하나가 실패해도 다른 빌드 계속
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build ${{ matrix.platform }}
        run: eas build --platform ${{ matrix.platform }} --profile ${{ matrix.profile }} --non-interactive
```

### 13.3 빌드 실패 자동 복구

```yaml
# 재시도 로직
- name: Build with retry
  uses: nick-invision/retry@v2
  with:
    timeout_minutes: 60
    max_attempts: 3
    retry_wait_seconds: 30
    command: eas build --platform ios --profile production --non-interactive
    on_retry_command: |
      echo "빌드 실패, 재시도 중..."
      # 캐시 클리어 등 복구 작업
      rm -rf node_modules/.cache
      npm ci
```

---

## 요약

| 항목 | 도구/서비스 |
|------|-------------|
| CI 플랫폼 | GitHub Actions |
| 빌드 서비스 | Expo EAS Build |
| 코드 품질 | ESLint, Prettier, TypeScript, Husky |
| 테스트 | Jest, React Native Testing Library, Maestro |
| 커버리지 | Codecov |
| OTA 업데이트 | EAS Update |
| iOS 배포 | App Store Connect (EAS Submit + Fastlane) |
| Android 배포 | Google Play Console (EAS Submit + Fastlane) |
| 버전 관리 | Semantic Versioning, Conventional Commits |
| 메타데이터 관리 | Fastlane (스크린샷, 앱 설명, 릴리스 노트) |
| 알림 | Slack, Discord |

---

## 관련 문서

- [18-app-store-guide.md](./18-app-store-guide.md) - 스토어 제출 가이드라인
- [16-analytics.md](./16-analytics.md) - 앱 분석 및 모니터링
