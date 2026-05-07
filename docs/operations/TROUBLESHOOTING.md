# 문제 해결 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/`, `functions/`

## 1. 앱 시작 실패

확인:

- `uniqn-mobile/.env.local` 존재 여부
- `uniqn-mobile/src/lib/env.ts` 필수 키 충족 여부
- `EXPO_PUBLIC_RELEASE_CHANNEL` 값

## 2. 품질 검사 실패

```bash
cd uniqn-mobile
npm run type-check
npm run lint
npm run test
npm run quality
```

## 3. 관리자 화면 접근 불가

확인:

- 로그인 상태
- `admin` 역할 여부
- `uniqn-mobile/app/(admin)/_layout.tsx` 가드

## 4. 구인자 화면 접근 불가

확인:

- `employer` 권한 여부
- `uniqn-mobile/app/(employer)/_layout.tsx` 가드

## 5. 알림 문제

확인:

- 기기 권한
- `/(app)/settings`의 푸시 토글
- `pushNotificationService`
- `functions/src/utils/notificationUtils.ts`
- unread counter 후처리 함수

## 6. 인증 문제

확인:

- `authStore` hydrate 상태
- `useAuth`, `useAuthGuard`
- Apple 로그인 가용성
- 전화번호 OTP / `checkPhoneExists`

## 7. Functions 빌드 또는 테스트 실패

```bash
cd functions
npm install
npm run build
npm test
```

env 확인:

- `RECAPTCHA_SECRET_KEY`
- `WEB_API_KEY`

## 8. Sentry 이벤트가 보이지 않음

확인:

- `EXPO_PUBLIC_SENTRY_DSN`
- `uniqn-mobile/app/_layout.tsx`
- `uniqn-mobile/src/services/observability/sentryService.ts`

## 9. 권한/역할 계산 이상

확인:

- `uniqn-mobile/src/shared/role/RoleResolver.ts`
- `uniqn-mobile/src/stores/authStore.ts`
- `uniqn-mobile/src/hooks/useAuth.ts`

## 10. 문서와 코드가 다름

현재 운영 기준 문서:

- `docs/README.md`
- `docs/reference/ARCHITECTURE.md`
- `docs/reference/API_REFERENCE.md`
- `docs/guides/DEPLOYMENT.md`

이 문서들과 코드가 다르면 코드를 기준으로 문서를 다시 고칩니다.
