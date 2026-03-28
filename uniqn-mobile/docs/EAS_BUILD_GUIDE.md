# EAS Build 가이드

최종 업데이트: 2026-03-26

## 현재 운영 정책

- `development`: 로컬 개발 + emulator 검증용
- `preview`: 내부 검수용 앱 껍데기
- `production`: 실제 사용자 배포용

중요:

- 현재는 출시 우선 정책으로 단일 Firebase 프로젝트를 안전하게 운영합니다.
- `preview`는 staging Firebase 앱이 아직 등록되지 않았으면 일반 네이티브 빌드 경로로 사용하지 않습니다.
- [`app.config.ts`](../../app.config.ts)의 빌드 가드가 repo-tracked Firebase 설정과 맞지 않는 profile/platform 조합을 차단합니다.
- Apple 로그인 검증 기준은 iPhone 실기기입니다. simulator/dev mock은 검증 근거로 사용하지 않습니다.

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

선택:

```env
EXPO_PUBLIC_FIREBASE_APP_ID_WEB=
EXPO_PUBLIC_FIREBASE_APP_ID_IOS=
EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID=
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=
EXPO_PUBLIC_USE_EMULATOR=false
EXPO_PUBLIC_ENABLE_APPLE_LOGIN=true
```

## 빌드 명령

```bash
cd uniqn-mobile

eas build --profile development --platform ios
eas build --profile development --platform android

eas build --profile production --platform ios
eas build --profile production --platform android
```

`preview`는 dedicated staging Firebase app이 준비된 뒤에만 일반 빌드 대상으로 승격합니다.

## dry-run 기준

CI의 EAS dry-run은 `production` 프로필을 사용합니다. preview에 의존한 dry-run은 staging Firebase 앱 미등록 상태에서 잘못된 안정감을 줄 수 있으므로 사용하지 않습니다.

## 네이티브 Firebase 설정

현재 소스 오브 트루스:

- [`uniqn-mobile/google-services.json`](../google-services.json)
- [`uniqn-mobile/GoogleService-Info.plist`](../GoogleService-Info.plist)

이 파일에 없는 bundle/package 조합은 빌드 전에 차단되는 것이 정상입니다.

## Apple 로그인 검증 메모

- Apple 로그인 UI는 `EXPO_PUBLIC_ENABLE_APPLE_LOGIN=false`면 숨겨집니다.
- iOS simulator는 Apple 로그인 유효성 검증 대상이 아닙니다.
- Apple 로그인 수동 검증은 실제 Apple ID + 2FA가 설정된 iPhone에서 진행합니다.
- 최소 확인 항목:
  - 첫 로그인
  - 재로그인
  - 로그인 취소
  - 기존 계정과 충돌
  - 탈퇴 재인증 및 토큰 파기 재시도
