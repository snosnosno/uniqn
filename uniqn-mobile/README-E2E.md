# E2E 테스트 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/e2e/`, `uniqn-mobile/scripts/run-e2e.js`

## 핵심 원칙

- E2E는 Playwright + Expo Web export + Firebase Emulator 조합입니다.
- emulator mode에서는 Auth, Firestore, Functions, Storage가 모두 로컬을 사용해야 합니다.
- production Firebase 리소스를 건드리지 않습니다.

## 요구사항

```bash
Node.js 22
Java 17+
firebase-tools
npm run e2e:setup
```

## 필수 env 예시

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

## 실행 순서

```bash
# 루트
firebase emulators:start --only auth,firestore,functions,storage

# 앱
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

## 확인 포인트

- 앱 초기화가 env 누락 없이 성공하는지
- 회원가입/중복 확인이 emulator Functions와 함께 동작하는지
- 업로드 경로가 Storage emulator를 사용하는지
- global setup과 CI가 같은 emulator topology를 쓰는지
