# 모니터링 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/src/services/observability/`, `uniqn-mobile/supabase/functions/`

이 문서는 현재 구현된 관측성 수단만 정리합니다.

## 앱 관측성

### Analytics

- 구현: `uniqn-mobile/src/services/observability/analyticsService.ts`
- 화면 추적: `useNavigationTracking`
- 로그인, 회원가입, 공고 조회, 지원, 출퇴근, 정산 등 주요 이벤트 추적

### Sentry (React Native)

- 구현: `uniqn-mobile/src/services/observability/sentryService.ts`
- canonical 이름: `sentryService`
- 호환 alias: `crashlyticsService` (레거시 별칭, 신규 코드에서는 `sentryService` 사용)
- 초기화 진입점: `uniqn-mobile/app/_layout.tsx`
- 크래시/에러 리포팅은 Sentry로 통합 (Firebase Crashlytics 제거됨)

### 성능

- 구현: `uniqn-mobile/src/services/observability/performanceService.ts`
- 화면/API/렌더 추적용 내부 추상화 제공
- 백엔드 성능은 Supabase Logs + Sentry 트랜잭션으로 관측

### 세션

- 구현: `uniqn-mobile/src/services/observability/sessionService.ts`
- 로그인 시도, 세션 상태, 토큰 갱신 관리

## 관리자 화면에서 볼 수 있는 것

- 대시보드: `uniqn-mobile/app/(admin)/index.tsx`
- 통계: `uniqn-mobile/app/(admin)/stats/index.tsx`

현재 관리자 라우트에는 별도 운영 설정 화면이 없습니다. 아직 없는 원격 제어 기능을 현재 구현처럼 문서화하지 않습니다.

## 백엔드 관측성

- Supabase Edge Functions 로그 (`npx supabase functions logs`)
- Supabase Dashboard — Auth / PostgreSQL / Edge Functions / Storage
- PostgreSQL 쿼리 메트릭: Supabase Dashboard → Database → Query Performance
- Edge Functions 내부 Sentry 유틸: `uniqn-mobile/supabase/functions/_shared/sentry.ts`

## 장애 확인 순서

1. Sentry에서 최근 오류 확인
2. `npx supabase functions logs <function-name>` 확인
3. Supabase Dashboard → Logs (Auth/DB/Storage) 확인
4. 관리자 통계 화면에서 주요 수치 확인
5. 최근 배포와 env 변경 여부 확인

## 운영 문서 범위 밖

- 현재 코드에 없는 운영 제어 서비스
- 현재 코드에 없는 관리자 추가 설정 화면
- 웹 포털 전용 모니터링 URL
