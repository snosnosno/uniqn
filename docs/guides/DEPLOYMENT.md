# T-HOLDEM 배포 가이드

**최종 업데이트**: 2026년 3월 14일
**기준 코드**: `uniqn-mobile/`, `functions/`, `firebase.json`, `uniqn-mobile/wrangler.toml`

현재 배포 경로는 세 갈래입니다.

- 모바일 앱: Expo EAS Build / Submit
- 웹 앱: Cloudflare Pages
- 백엔드: Firebase Functions / Firestore Rules / Storage Rules

`app2/` 기준 Firebase Hosting 배포는 현재 기본 배포 경로가 아닙니다.

## 사전 요구사항

```bash
# 공통
Node.js 22
npm
git

# 모바일 빌드
eas-cli

# 웹 배포
wrangler

# 백엔드 배포
firebase-tools
```

권장 설치:

```bash
npm install -g eas-cli
npm install -g firebase-tools
npm install -g wrangler
```

## 1. 모바일 앱 배포

모바일 앱 설정은 [`uniqn-mobile/eas.json`](../../uniqn-mobile/eas.json)과 [`uniqn-mobile/app.config.ts`](../../uniqn-mobile/app.config.ts)에 정의되어 있습니다.

### 로컬 확인

```bash
cd uniqn-mobile
npm install
npm run quality
npm test
```

### EAS 빌드

```bash
cd uniqn-mobile

# 개발 빌드
eas build --profile development --platform ios
eas build --profile development --platform android

# 스테이징 / 내부 테스트
eas build --profile preview --platform all

# 출시 빌드
eas build --profile production --platform all
```

### 제출

```bash
cd uniqn-mobile
eas submit --platform ios --latest
eas submit --platform android --latest
```

### 모바일 환경 변수

로컬은 `uniqn-mobile/.env.local`, CI/EAS는 EAS Secrets를 사용합니다.

필수:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

선택:

```env
EXPO_PUBLIC_RELEASE_CHANNEL=production
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=
EXPO_PUBLIC_FIREBASE_REGION=asia-northeast3
```

EAS 프로파일별 `APP_ENV`, `EXPO_PUBLIC_RELEASE_CHANNEL`, `SENTRY_ORG`, `SENTRY_PROJECT`는 이미 [`uniqn-mobile/eas.json`](../../uniqn-mobile/eas.json)에 정의되어 있습니다.

## 2. 웹 배포

웹 빌드는 Expo Web export를 사용하고, 배포는 Cloudflare Pages를 사용합니다.
배포 스크립트는 [`uniqn-mobile/scripts/deploy-cloudflare.js`](../../uniqn-mobile/scripts/deploy-cloudflare.js), 설정은 [`uniqn-mobile/wrangler.toml`](../../uniqn-mobile/wrangler.toml)에 있습니다.

### 웹 빌드

```bash
cd uniqn-mobile
npm run build:web
```

### Cloudflare 배포

```bash
cd uniqn-mobile
npm run deploy:cloudflare
```

커밋되지 않은 변경사항이 있어도 강제로 배포하려면:

```bash
cd uniqn-mobile
npm run deploy:cloudflare -- --force
```

## 3. Firebase 백엔드 배포

Firebase 설정은 루트 [`firebase.json`](../../firebase.json)에 있습니다.
현재 Firebase는 Hosting이 아니라 Functions / Firestore / Storage / Emulator 중심으로 사용합니다.

### Functions 준비

```bash
cd functions
npm install
cp .env.example .env
```

필수 변수:

```env
RECAPTCHA_SECRET_KEY=
WEB_API_KEY=
```

### Functions 배포

```bash
cd ..
firebase deploy --only functions
```

`firebase.json`의 `predeploy`로 인해 배포 전에 `functions` 빌드가 자동 실행됩니다.

### 규칙 배포

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

### 전체 Firebase 배포가 필요한 경우

```bash
firebase deploy
```

## 4. 배포 전 체크리스트

### 모바일

- `cd uniqn-mobile && npm run quality`
- `cd uniqn-mobile && npm test`
- `.env.local` 또는 EAS Secrets 확인
- `google-services.json`, `GoogleService-Info.plist` 존재 확인

### 웹

- `cd uniqn-mobile && npm run build:web`
- `cd uniqn-mobile && npm run deploy:cloudflare`

### 백엔드

- `cd functions && npm run build`
- `cd functions && npm test`
- `functions/.env` 확인
- `firebase deploy --only functions` 전 로그 확인

## 5. 관련 문서

- [`CLAUDE.md`](../../CLAUDE.md)
- [`uniqn-mobile/docs/EAS_BUILD_GUIDE.md`](../../uniqn-mobile/docs/EAS_BUILD_GUIDE.md)
- [`uniqn-mobile/README-E2E.md`](../../uniqn-mobile/README-E2E.md)
- [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md)
