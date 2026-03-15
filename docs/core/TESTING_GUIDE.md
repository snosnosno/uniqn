# UNIQN 모바일 테스트 가이드

**최종 업데이트**: 2026년 3월 14일
**대상**: `uniqn-mobile/`
**상태**: Jest + Playwright E2E 운영 중

> 이 문서는 현재 주력 앱인 `uniqn-mobile/` 기준입니다.
> 레거시 웹앱 `app2/` 테스트 절차는 더 이상 기본 기준이 아닙니다.

## 개요

현재 코드베이스에서 사용하는 테스트 축은 두 가지입니다.

- 단위/통합 테스트: Jest + `jest-expo`
- E2E 테스트: Playwright + Firebase Emulator + Expo Web 빌드

핵심 스크립트는 [`uniqn-mobile/package.json`](../../uniqn-mobile/package.json)에 정의되어 있습니다.

## 빠른 시작

```bash
cd uniqn-mobile
npm install

# 정적 품질 검사
npm run quality

# Jest 테스트
npm test

# 커버리지
npm run test:coverage
```

## 필수 요구사항

```bash
# Node.js 22
node --version

# Java 17+ (Firebase Emulator)
java --version

# Firebase CLI
firebase --version

# Playwright 브라우저 설치
npm run e2e:setup
```

## Jest 테스트

Jest 설정은 [`uniqn-mobile/jest.config.js`](../../uniqn-mobile/jest.config.js)에 있습니다.

```bash
cd uniqn-mobile

# 전체 테스트
npm test

# 커버리지 리포트
npm run test:coverage
```

현재 기본 검증 순서는 아래입니다.

```bash
cd uniqn-mobile
npm run quality
npm test
```

## E2E 테스트

Playwright 설정은 [`uniqn-mobile/e2e/playwright.config.ts`](../../uniqn-mobile/e2e/playwright.config.ts)에 있습니다.
테스트는 Expo Web 산출물을 `serve`로 띄우고, Firebase Auth/Firestore Emulator에 연결한 뒤 실행됩니다.

### 사전 설정

1. `uniqn-mobile/.env.local` 생성
2. Firebase 필수 값 입력
3. E2E용으로 `EXPO_PUBLIC_USE_EMULATOR=true` 추가

예시:

```env
EXPO_PUBLIC_RELEASE_CHANNEL=development
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tholdem-ebc18.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tholdem-ebc18
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tholdem-ebc18.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id_here
EXPO_PUBLIC_USE_EMULATOR=true
```

### 실행 순서

```bash
# 1. 프로젝트 루트에서 Emulator 실행
cd ..
firebase emulators:start --only auth,firestore

# 2. 새 터미널에서 웹 빌드
cd uniqn-mobile
npm run build:web

# 3. E2E 실행
npm run e2e
```

### 자주 쓰는 명령어

```bash
# UI 모드
npm run e2e:ui

# headed 모드
npm run e2e:headed

# 리포트 열기
npm run e2e:report

# 특정 테스트 파일
npm run e2e -- tests/p1-important/public-pages.spec.ts

# grep 실행
npm run e2e -- --grep "로그인"
```

## 테스트 구조

```text
uniqn-mobile/
├── src/__tests__/             # Jest 테스트
├── e2e/
│   ├── playwright.config.ts
│   ├── global-setup.ts
│   ├── global-teardown.ts
│   ├── fixtures/
│   ├── helpers/
│   └── tests/
└── jest.config.js
```

## CI 기준 권장 순서

```bash
cd uniqn-mobile
npm ci
npm run quality
npm test
npm run build:web
npm run e2e
```

CI에서 Node 버전은 `22`를 권장합니다. Functions 런타임도 Node.js 22를 사용합니다.

## 문제 해결

### Emulator 연결 실패

```bash
firebase emulators:start --only auth,firestore
```

`EXPO_PUBLIC_USE_EMULATOR=true`가 `.env.local`에 빠져 있으면 앱이 실제 Firebase로 붙으려 할 수 있습니다.

### E2E 시작 직후 실패

```bash
cd uniqn-mobile
npm run build:web
npm run e2e
```

Playwright는 `dist`를 기준으로 웹 서버를 띄우므로, 먼저 `build:web`가 필요합니다.

### 리포트 확인

```bash
cd uniqn-mobile
npm run e2e:report
```

### Jest만 빠르게 돌리고 싶을 때

```bash
cd uniqn-mobile
npm test -- --runInBand
```

## 참고 문서

- [`CLAUDE.md`](../../CLAUDE.md)
- [`uniqn-mobile/README-E2E.md`](../../uniqn-mobile/README-E2E.md)
- [`uniqn-mobile/e2e/playwright.config.ts`](../../uniqn-mobile/e2e/playwright.config.ts)
- [`uniqn-mobile/jest.config.js`](../../uniqn-mobile/jest.config.js)
