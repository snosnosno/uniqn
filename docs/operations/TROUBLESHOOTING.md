# 문제 해결 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 코드 기준

이 문서는 `uniqn-mobile/`과 `functions/`에서 실제 자주 맞닥뜨리는 문제만 정리합니다.

## 1. 앱이 시작되지 않음

### 증상

- `npm start` 직후 env 오류
- Firebase 설정 누락 메시지

### 확인

- `uniqn-mobile/.env.local` 존재 여부
- `uniqn-mobile/src/lib/env.ts`의 필수 키 충족 여부

필수 키:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

## 2. 품질 검사 실패

### 기본 점검

```bash
cd uniqn-mobile
npm run type-check
npm run lint
npm run test
npm run quality
```

### 추가 점검

```bash
npx expo doctor
```

## 3. 관리자 화면 접근 불가

### 확인 포인트

- 로그인 상태인지
- 사용자 역할이 `admin`인지
- `uniqn-mobile/app/(admin)/_layout.tsx`의 가드에 걸리지 않는지

비관리자 계정은 관리자 라우트에서 일반 앱 홈으로 리다이렉트됩니다.

## 4. 구인자 화면 접근 불가

### 확인 포인트

- 사용자 역할이 `employer` 이상인지
- `uniqn-mobile/app/(employer)/_layout.tsx` 가드에 걸리지 않는지

## 5. 알림이 오지 않음

### 확인 포인트

- 기기 알림 권한 허용 여부
- 설정 화면의 푸시 알림 토글 상태
- `expo-notifications` 토큰 등록 실패 로그
- Functions 알림 생성 여부

관련 파일:

- `uniqn-mobile/app/(app)/settings/index.tsx`
- `uniqn-mobile/src/services/notifications/pushNotificationService.ts`
- `functions/src/utils/notificationUtils.ts`

## 6. Feature Flag가 갱신되지 않음

### 확인 포인트

- 관리자 설정 화면에서 캐시 새로고침 실행
- Remote Config 값 반영 여부
- 네이티브 환경에서는 기본값 폴백 중인지 확인

관련 파일:

- `uniqn-mobile/src/services/observability/featureFlagService.ts`
- `uniqn-mobile/app/(admin)/settings.tsx`

## 7. Functions 빌드 또는 실행 오류

```bash
cd functions
npm install
npm run build
npm test
```

환경변수 확인:

- `RECAPTCHA_SECRET_KEY`
- `WEB_API_KEY`

또한 `functions/package.json`의 Node 22 기준과 로컬 런타임을 맞춰야 합니다.

## 8. 계정 삭제/로그인 알림 동작 이상

확인 파일:

- `functions/src/account/scheduledDeletion.ts`
- `functions/src/account/loginNotification.ts`
- `functions/src/index.ts`

확인 항목:

- Functions 배포 상태
- Firestore 문서 생성 여부
- Cloud Functions 로그 오류

## 9. Sentry 이벤트가 보이지 않음

### 확인 포인트

- `EXPO_PUBLIC_SENTRY_DSN` 설정 여부
- `uniqn-mobile/app/_layout.tsx`에서 Sentry 초기화 수행 여부
- 릴리스 채널 값 확인

주의:

- canonical 서비스는 `sentryService`입니다.
- `crashlyticsService`는 기존 호출부 호환용 alias입니다.

## 10. 권한/역할 계산이 이상함

확인 파일:

- `uniqn-mobile/src/shared/role/RoleResolver.ts`
- `uniqn-mobile/src/hooks/useAuth.ts`
- `uniqn-mobile/src/hooks/useAuthGuard.ts`

현재 역할 체계:

- `admin`
- `employer`
- `staff`

## 빠른 점검 순서

1. `npm run quality`
2. env 파일 확인
3. 권한 가드 확인
4. Query/Repository 호출 경로 확인
5. Functions 로그와 Sentry 로그 확인
