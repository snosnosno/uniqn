# T-HOLDEM 배포 가이드

최종 업데이트: 2026-03-26

이 저장소는 출시 우선 정책을 사용합니다. 당장은 Firebase를 `dev/staging/prod`로 완전 분리하지 않고, 단일 Firebase 프로젝트를 안전하게 운영하면서 출시 후 분리를 준비합니다.

## 환경 모델

- `production`: 실제 사용자용 릴리스. EAS `production`, OTA `production`
- `preview`: 내부 검수용 앱 껍데기. 전용 Firebase 앱 등록 전까지 네이티브 빌드는 제한 또는 차단
- `development`: 로컬 개발 + Firebase Emulator 전용

중요 정책:

- `preview`와 `development`는 현재 production Firebase 프로젝트를 공유할 수 있으므로 production-safe 하지 않은 흐름은 허용하지 않습니다.
- repo에 포함된 [`uniqn-mobile/google-services.json`](../../uniqn-mobile/google-services.json)과 [`uniqn-mobile/GoogleService-Info.plist`](../../uniqn-mobile/GoogleService-Info.plist)가 현재 네이티브 Firebase 설정의 단일 소스입니다.
- 예전 secret 복원 스크립트 기반 경로는 제거했습니다.

## 공통 요구사항

```bash
Node.js 22
npm
git
firebase-tools
eas-cli
wrangler
```

## 1. 모바일 배포

모바일 설정은 [`uniqn-mobile/eas.json`](../../uniqn-mobile/eas.json)과 [`uniqn-mobile/app.config.ts`](../../uniqn-mobile/app.config.ts)에서 관리합니다.

### 배포 전 확인

```bash
cd uniqn-mobile
npm ci
npm run quality
npm test
```

### 필수 공개 환경변수 계약

로컬은 `uniqn-mobile/.env.local`, CI/EAS는 동일한 이름의 env 또는 secret를 사용합니다.

```env
EXPO_PUBLIC_RELEASE_CHANNEL=production
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_REGION=asia-northeast3
```

선택:

```env
EXPO_PUBLIC_FIREBASE_APP_ID_WEB=
EXPO_PUBLIC_FIREBASE_APP_ID_IOS=
EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=
EXPO_PUBLIC_USE_EMULATOR=false
```

### EAS 빌드

```bash
cd uniqn-mobile

# development: 로컬 개발/에뮬레이터용
eas build --profile development --platform ios
eas build --profile development --platform android

# production: 실제 출시용
eas build --profile production --platform ios
eas build --profile production --platform android
```

`preview` 프로필은 staging Firebase 앱이 등록되기 전까지 smoke/profile 용도로만 다루고, 일반적인 릴리스 검증 경로로 사용하지 않습니다.

### 제출

```bash
cd uniqn-mobile
eas submit --platform ios --latest
eas submit --platform android --latest
```

## 2. 웹 배포

웹은 Expo Web export 후 Cloudflare Pages에 배포합니다.

```bash
cd uniqn-mobile
npm run build:web
npm run deploy:cloudflare
```

이번 단계에서는 Cloudflare의 별도 staging/prod 분리를 도입하지 않습니다.

## 3. Firebase 배포

Firebase 설정은 루트 [`firebase.json`](../../firebase.json)에서 관리합니다.

### Functions 준비

```bash
cd functions
npm ci
cp .env.example .env
```

필수:

```env
RECAPTCHA_SECRET_KEY=
WEB_API_KEY=
```

기능별 선택:

```env
APPLE_PRIVATE_KEY=
APPLE_KEY_ID=
APPLE_TEAM_ID=
APPLE_CLIENT_ID=
SENTRY_DSN=
CF_ACCOUNT_ID=
CF_KV_NAMESPACE_ID=
CF_API_TOKEN=
```

### Functions 배포

```bash
cd ..
firebase deploy --only functions
```

### 규칙/인덱스/스토리지 배포

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

## 4. E2E / Emulator 계약

에뮬레이터 모드에서는 아래 구성이 항상 함께 떠 있어야 합니다.

```bash
firebase emulators:start --only auth,firestore,functions,storage
```

앱은 emulator mode에서 Auth, Firestore, Functions, Storage를 한 세트로 취급합니다. Storage만 production bucket을 바라보는 구성은 허용하지 않습니다.

## 5. 출시 체크리스트

- `cd uniqn-mobile && npm run quality`
- `cd uniqn-mobile && npm test`
- `cd uniqn-mobile && npm run build:web`
- `cd functions && npm run build`
- mobile/public env 계약이 CI/EAS와 동일한지 확인
- repo-tracked native Firebase 설정 파일이 현재 프로필과 일치하는지 확인
- preview 네이티브 빌드가 staging Firebase 앱 없이 열려 있지 않은지 확인
