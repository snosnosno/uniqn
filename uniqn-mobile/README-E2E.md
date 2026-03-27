# E2E 테스트 가이드

이 프로젝트의 E2E는 Playwright와 Firebase Emulator를 함께 사용합니다. 핵심 원칙은 간단합니다. emulator mode에서는 Auth, Firestore, Functions, Storage가 전부 로컬로 붙어야 하고, production Firebase 리소스를 건드리면 안 됩니다.

## 요구사항

```bash
Node.js 22
Java 17+
firebase-tools
npm run e2e:setup
```

## 필수 env

`uniqn-mobile/.env.local` 예시:

```env
EXPO_PUBLIC_RELEASE_CHANNEL=development
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tholdem-ebc18.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tholdem-ebc18
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tholdem-ebc18.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id_here
EXPO_PUBLIC_FIREBASE_REGION=asia-northeast3
EXPO_PUBLIC_USE_EMULATOR=true
```

## 빠른 실행

```bash
# 1. 루트에서 에뮬레이터 시작
cd ..
firebase emulators:start --only auth,firestore,functions,storage

# 2. 앱에서 웹 빌드
cd uniqn-mobile
npm run build:web

# 3. E2E 실행
npm run e2e
```

자주 쓰는 명령:

```bash
npm run e2e:ui
npm run e2e:headed
npm run e2e:report
npm run e2e -- --grep "p0-critical"
```

## 확인 포인트

- 앱 초기화가 env 누락 없이 성공하는지
- 회원가입/중복체크가 Functions emulator와 함께 동작하는지
- 이미지 업로드 경로가 Storage emulator를 사용하는지
- global setup과 CI가 같은 emulator topology를 쓰는지
