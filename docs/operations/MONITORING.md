# UNIQN 모니터링 가이드

**최종 업데이트**: 2026년 3월 21일
**상태**: 현재 코드 기준

이 문서는 `uniqn-mobile/`과 `functions/`의 현재 관측성 구현만 정리합니다. 레거시 웹앱 기준 성능 수치나 웹 전용 관리자 모니터링 경로는 현재 기본 운영 기준이 아닙니다.

## 기준 파일

- `uniqn-mobile/app/_layout.tsx`
- `uniqn-mobile/src/services/observability/analyticsService.ts`
- `uniqn-mobile/src/services/observability/sentryService.ts`
- `uniqn-mobile/src/services/observability/crashlyticsService.ts`
- `uniqn-mobile/src/services/observability/performanceService.ts`
- `uniqn-mobile/src/services/observability/featureFlagService.ts`
- `uniqn-mobile/app/(admin)/stats/index.tsx`
- `functions/src/index.ts`

## 현재 모니터링 스택

### 앱 에러 추적

- 실제 SDK: `@sentry/react-native`
- 초기화 위치: `uniqn-mobile/app/_layout.tsx`
- canonical 래퍼 이름: `sentryService`
- 호환 alias: `crashlyticsService`
- 새 코드는 `sentryService`를 사용하고, 기존 호출부 호환 때문에 `crashlyticsService` alias를 유지합니다.

### 에러 분류 및 전송 정책

- `recoverable-business`: `auth`, `validation`, `permission`, `business`의 `low`/`medium` 에러입니다. `handleServiceError()`로 `AppError` 정규화 후 로깅만 하고 Sentry에는 보내지 않습니다.
- `infra`: `network`, `firebase`, `security`, `unknown` 카테고리 또는 `severity: high` 에러입니다. Sentry에 non-fatal로 보냅니다.
- `critical-telemetry`: `severity: critical` 에러입니다. Sentry에 fatal로 보냅니다.
- `handleSilentError()`는 best-effort 작업 전용입니다. telemetry를 억제한 상태로 로깅만 남깁니다.
- Error Boundary는 기본/네트워크/데이터 페치 경계에서 위 정책을 따르고, 폼 경계는 사용자 입력 오류를 telemetry로 올리지 않습니다.

### 앱 이벤트 추적

- 구현 파일: `uniqn-mobile/src/services/observability/analyticsService.ts`
- 웹 환경에서는 Firebase Analytics를 사용합니다.
- 화면 전환 추적은 `useNavigationTracking`에서 연결됩니다.

### 앱 성능 추적

- 구현 파일: `uniqn-mobile/src/services/observability/performanceService.ts`
- 화면/API/렌더 추적용 내부 추상화를 제공합니다.
- 네이티브 Firebase Performance SDK는 현재 직접 의존성으로 들어 있지 않습니다.

### Feature Flag 관측

- 구현 파일: `uniqn-mobile/src/services/observability/featureFlagService.ts`
- Remote Config 사용 가능 여부와 캐시 상태를 관리합니다.
- 운영자는 `/(admin)/settings`에서 현재 플래그 상태를 확인할 수 있습니다.

### 운영 통계 화면

- 화면: `uniqn-mobile/app/(admin)/stats/index.tsx`
- 총 사용자, 오늘 신규 가입, 활성 공고, 오늘 지원, 미처리 신고, 7일 추세를 확인합니다.

## 운영자가 확인할 곳

### 1. 모바일 앱

- Sentry 대시보드
- 앱 내 관리자 통계 화면
- 관리자 설정 화면의 점검 모드 / Feature Flag 상태

### 2. Firebase

- Authentication, Firestore, Functions 로그
- Functions 실패 로그 및 트리거 실행 상태

### 3. 배포 시점 체크

- `EXPO_PUBLIC_SENTRY_DSN` 설정 여부
- `EXPO_PUBLIC_RELEASE_CHANNEL` 값 확인
- Functions 배포 후 오류 로그 확인

## 장애 대응 기본 순서

1. Sentry에서 최근 에러 확인
2. Firebase Functions 로그 확인
3. 관리자 통계 및 문의/신고 급증 여부 확인
4. 필요 시 `maintenance_mode` 상태 확인
5. Feature Flag 캐시를 새로고침해 실제 운영값 반영 여부 점검

## 문서 작성 주의

다음 내용은 현재 기준 문서에 다시 넣지 않습니다.

- Firebase Hosting 성능 수치
- 웹 전용 관리자 모니터링 URL
- 웹 전용 Performance Observer 예시를 현재 운영 코드처럼 설명하는 문구
- Crashlytics SDK가 직접 붙어 있다는 설명
