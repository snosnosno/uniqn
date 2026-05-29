# EAS Build 가이드

최종 업데이트: 2026-04-13  
기준 코드: `uniqn-mobile/eas.json`, `uniqn-mobile/app.config.ts`

## 현재 프로필

- `development`: 로컬 개발 / emulator 검증
- `preview`: 내부 검수
- `production`: 스토어 출시

## 빌드 가드

`app.config.ts`는 EAS 빌드 시 `google-services.json` (Android) 또는 `GoogleService-Info.plist` (iOS)에 현재 프로필의 package/bundle identifier가 포함되어 있는지 검증합니다. FCM 푸시 알림에 Firebase 네이티브 config가 여전히 필요합니다.

> **주의**: `@react-native-firebase` SDK는 제거됨. 하지만 native push(FCM)를 위해 google-services.json / GoogleService-Info.plist는 유지 필요.

## 필수 env

```env
EXPO_PUBLIC_RELEASE_CHANNEL=development
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

선택 env:

```env
EXPO_PUBLIC_ENABLE_APPLE_LOGIN=true
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
EXPO_PUBLIC_PORTONE_STORE_ID=store-xxxxxxxx
EXPO_PUBLIC_PORTONE_INICIS_CHANNEL_KEY=channel-key-xxxxxxxx
EXPO_PUBLIC_PORTONE_INICIS_DIRECT_AGENCY=PASS
EXPO_PUBLIC_PORTONE_INICIS_LOGO_URL=https://uniqn.app/portone-logo.png
EXPO_PUBLIC_PORTONE_INICIS_FRGND_INFO=N
EXPO_PUBLIC_USE_EMULATOR=false
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

## Supabase Edge Functions

푸시 알림 트리거 등은 Supabase Edge Functions에서 처리됩니다:

```bash
cd uniqn-mobile
supabase functions deploy <function-name>
supabase functions list
```
