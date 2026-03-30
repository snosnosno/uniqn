# EAS Build 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/eas.json`, `uniqn-mobile/app.config.ts`

## 현재 프로필

- `development`: 로컬 개발 / emulator 검증
- `preview`: 내부 검수
- `production`: 스토어 출시

## 빌드 가드

`app.config.ts`는 현재 profile과 platform에 맞는 Firebase bundle/package가 repo 설정 파일에 없으면 빌드를 차단합니다.

## 필수 env

```env
EXPO_PUBLIC_RELEASE_CHANNEL=
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

## 명령

```bash
cd uniqn-mobile
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile production --platform ios
eas build --profile production --platform android
```

## 제출

```bash
cd uniqn-mobile
eas submit --platform ios --latest
eas submit --platform android --latest
```

## Apple 로그인 메모

- Apple 로그인 검증 기준은 실기기 iPhone입니다.
- iOS 시뮬레이터는 최종 검증 근거가 아닙니다.
- `EXPO_PUBLIC_ENABLE_APPLE_LOGIN=false`이면 로그인 UI를 숨깁니다.
