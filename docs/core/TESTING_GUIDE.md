# 테스트 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/`, `functions/`

## 테스트 스택

- 앱 단위/통합 테스트: Jest + `jest-expo`
- 앱 E2E: Playwright + Expo Web export + Firebase Emulator
- Functions 테스트: Mocha + Firebase Emulator

## 공통 요구사항

```bash
Node.js 22
Java 17+
firebase-tools
```

## 앱 기본 검증

```bash
cd uniqn-mobile
npm ci
npm run quality
npm test
```

공유 로직이나 스키마를 크게 건드렸다면:

```bash
npm run test:coverage
```

## 앱 E2E

필수 env 예시:

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

실행 순서:

```bash
# 루트
firebase emulators:start --only auth,firestore,functions,storage

# 별도 터미널
cd uniqn-mobile
npm run build:web
npm run e2e
```

보조 명령:

```bash
npm run e2e:ui
npm run e2e:headed
npm run e2e:report
```

## Functions 검증

```bash
cd functions
npm ci
npm run build
npm test
```

## 반드시 확인할 계약

- emulator mode에서는 Auth, Firestore, Functions, Storage가 모두 로컬 endpoint를 사용해야 합니다.
- `uniqn-mobile/.env.local`과 CI/EAS env 이름이 일치해야 합니다.
- 문서에 적힌 스크립트는 `package.json` 실제 스크립트와 일치해야 합니다.
