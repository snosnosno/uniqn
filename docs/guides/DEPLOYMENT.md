# 배포 가이드

최종 업데이트: 2026-04-05  
기준 코드: `uniqn-mobile/app.config.ts`, `uniqn-mobile/eas.json`, `firebase.json`

현재 저장소는 출시 우선 정책을 사용합니다. 모바일 앱은 EAS Build, 백엔드는 Firebase Functions, 웹 export는 Cloudflare 배포 스크립트를 기준으로 관리합니다.

## 환경 모델

- `development`: 로컬 개발 + emulator
- `preview`: 내부 검수용 profile
- `production`: 실제 출시용

## 설정 자산 기준

- 네이티브 Firebase 설정 기준 파일:
  - `uniqn-mobile/google-services.json`
  - `uniqn-mobile/GoogleService-Info.plist`
- 저장소 루트의 키/설정 파일은 개인 로컬 자산이며, 현재 개발 및 배포 기준에 포함하지 않습니다.
- `app.config.ts`는 profile/platform과 native Firebase 식별자 불일치 시 빌드를 차단합니다.

## 앱 배포

### 사전 검증

```bash
cd uniqn-mobile
npm ci
npm run quality
npm test
```

### 필수 공개 env

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

선택 env:

```env
EXPO_PUBLIC_FIREBASE_APP_ID_WEB=
EXPO_PUBLIC_FIREBASE_APP_ID_IOS=
EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=
EXPO_PUBLIC_USE_EMULATOR=false
EXPO_PUBLIC_ENABLE_APPLE_LOGIN=true
```

### EAS Build

```bash
cd uniqn-mobile
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile production --platform ios
eas build --profile production --platform android
```

### 스토어 제출

```bash
cd uniqn-mobile
eas submit --platform ios --latest
eas submit --platform android --latest
```

## 웹 export

```bash
cd uniqn-mobile
npm run build:web
npm run deploy:cloudflare
```

## Firebase 배포

### Functions

```powershell
cd functions
npm ci
Copy-Item .env.example .env
npm run build
cd ..
firebase deploy --only functions
```

### 규칙 / 인덱스 / 스토리지

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

## Emulator 계약

```bash
firebase emulators:start --only auth,firestore,functions,storage
```

앱은 emulator mode에서 Auth, Firestore, Functions, Storage를 한 세트로 사용해야 합니다.

## 출시 체크리스트

- `cd uniqn-mobile && npm run quality`
- `cd uniqn-mobile && npm test`
- `cd uniqn-mobile && npm run build:web`
- `cd functions && npm run build`
- env 이름이 `lib/env.ts`, `.env.example`, EAS/CI와 일치하는지 확인
- native Firebase 설정 파일이 현재 bundle/package와 일치하는지 확인
- 루트의 로컬 키 파일이 아닌 `uniqn-mobile/` 기준 자산을 사용하고 있는지 확인
- Apple 로그인 검증은 실기기 기준인지 확인
