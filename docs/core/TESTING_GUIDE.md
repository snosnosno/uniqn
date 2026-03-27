# UNIQN 모바일 테스트 가이드

최종 업데이트: 2026-03-26

## 테스트 스택

- 단위/통합 테스트: Jest + `jest-expo`
- E2E 테스트: Playwright + Expo Web build + Firebase Emulator

## 공통 요구사항

```bash
Node.js 22
Java 17+
firebase-tools
```

## 기본 검증 순서

```bash
cd uniqn-mobile
npm ci
npm run quality
npm test
```

공유 로직을 크게 건드렸다면 coverage도 확인합니다.

```bash
cd uniqn-mobile
npm run test:coverage
```

## E2E 환경 계약

E2E는 Firebase production 리소스를 만지지 않도록 emulator mode를 강제합니다.

필수 env:

```env
EXPO_PUBLIC_RELEASE_CHANNEL=development
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tholdem-ebc18.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tholdem-ebc18
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tholdem-ebc18.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_REGION=asia-northeast3
EXPO_PUBLIC_USE_EMULATOR=true
```

## E2E 실행

```bash
# 1. 루트에서 emulator 실행
cd ..
firebase emulators:start --only auth,firestore,functions,storage

# 2. 앱에서 웹 빌드
cd uniqn-mobile
npm run build:web

# 3. Playwright 실행
npm run e2e
```

보조 명령:

```bash
npm run e2e:ui
npm run e2e:headed
npm run e2e:report
```

## 반드시 유지할 보장

- emulator mode에서는 Auth/Firestore/Functions/Storage가 모두 로컬 endpoint로 연결되어야 함
- 이미지 업로드 경로는 emulator mode에서 production bucket URL을 만들면 안 됨
- CI, 로컬 실행, global setup이 같은 emulator topology를 사용해야 함

## CI 기준

CI는 Node 22 기준으로 다음을 통과해야 합니다.

```bash
cd uniqn-mobile
npm run quality
npm test
npm run build:web
npm run e2e
```

그리고 backend는 별도로 아래 검증을 통과해야 합니다.

```bash
cd functions
npm ci
npm run build
```
