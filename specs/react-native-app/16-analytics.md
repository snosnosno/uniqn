# 16. Analytics & Monitoring

## 개요

UNIQN 앱의 사용자 행동 분석, 에러 모니터링, 성능 측정을 위한 통합 시스템 현황입니다.

### 기술 스택 (현재 구현)

| 도구 | 용도 | 플랫폼 | 상태 |
|------|------|--------|:----:|
| Firebase Analytics | 사용자 행동 추적 | 웹 | ✅ 구현 |
| Sentry | 에러/크래시 모니터링 | iOS, Android, Web | ✅ 구현 |
| 자체 Performance Service | 성능 측정 | iOS, Android, Web | ✅ 구현 |

> **참고**: 네이티브 앱(iOS/Android)에서는 Firebase Analytics 대신 로깅 모드로 동작합니다.
> 추후 네이티브 SDK(@react-native-firebase/analytics) 추가 시 실제 전송이 활성화됩니다.

---

## 1. 설치 및 의존성

### 현재 패키지

```json
{
  "dependencies": {
    "@sentry/react-native": "~7.2.0",
    "firebase": "^12.6.0"
  }
}
```

### app.config.ts 설정

```typescript
plugins: [
  // Sentry - 에러 모니터링
  [
    '@sentry/react-native/expo',
    {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    },
  ],
],
```

---

## 2. Analytics 서비스

### 2.1 구현 구조

```typescript
// src/services/analyticsService.ts

// 플랫폼별 동작:
// - 웹: Firebase Analytics SDK (실제 전송)
// - 네이티브: 로깅 모드 (추후 네이티브 SDK 추가 예정)
```

### 2.2 이벤트 타입 정의

```typescript
export type AnalyticsEvent =
  // 인증
  | 'login'
  | 'signup'
  | 'logout'
  | 'password_reset'
  // 구인구직
  | 'job_view'
  | 'job_apply'
  | 'job_create'
  | 'job_edit'
  | 'job_close'
  | 'job_delete'
  // 지원 관리
  | 'application_confirm'
  | 'application_reject'
  | 'application_cancel'
  // 스케줄
  | 'schedule_view'
  | 'check_in'
  | 'check_out'
  // 정산
  | 'settlement_view'
  | 'settlement_complete'
  // 알림
  | 'notification_receive'
  | 'notification_click'
  | 'notification_settings_change'
  // 화면
  | 'screen_view'
  // 검색/필터
  | 'search'
  | 'filter_apply'
  // 에러
  | 'error'
  // 커스텀
  | string;
```

### 2.3 이벤트 파라미터

```typescript
export interface AnalyticsEventParams {
  // 공통
  screen_name?: string;
  content_type?: string;
  content_id?: string;

  // 인증
  method?: 'email' | 'google' | 'apple' | 'kakao';

  // 구인구직
  job_id?: string;
  job_title?: string;
  job_location?: string;
  job_role?: string;
  job_salary_type?: string;

  // 지원
  application_id?: string;
  application_status?: string;

  // 스케줄
  schedule_date?: string;
  work_hours?: number;

  // 정산
  settlement_amount?: number;
  settlement_count?: number;

  // 검색
  search_term?: string;
  filter_type?: string;
  filter_value?: string;

  // 에러
  error_code?: string;
  error_message?: string;
  error_category?: string;

  // 추가 파라미터
  [key: string]: string | number | boolean | undefined;
}
```

### 2.4 사용자 속성

```typescript
export interface UserProperties {
  user_role?: 'staff' | 'employer' | 'admin';
  account_created_date?: string;
  total_applications?: number;
  total_jobs_posted?: number;
  has_verified_phone?: boolean;
  preferred_roles?: string;
  preferred_location?: string;
}
```

### 2.5 핵심 API

```typescript
// 초기화
analyticsService.initialize();

// 이벤트 추적
await trackEvent('job_apply', {
  job_id: 'job123',
  job_title: '홀덤 딜러 모집',
  job_role: 'dealer',
});

// 화면 조회 추적
await trackScreenView('JobListScreen');

// 사용자 속성 설정
await setUserProperties({
  user_role: 'staff',
  preferred_location: '서울',
});

// 사용자 ID 설정
await setUserId('user123');
```

### 2.6 헬퍼 함수

```typescript
// 인증 이벤트
trackLogin('email');
trackSignup('google');
trackLogout();

// 구인구직 이벤트
trackJobView('job123', '홀덤 딜러 모집');
trackJobApply('job123', '홀덤 딜러 모집', 'dealer');
trackJobCreate('job123', '새 공고');

// 출퇴근 이벤트
trackCheckIn('2026-02-02');
trackCheckOut('2026-02-02', 8.5);

// 정산 이벤트
trackSettlementComplete(150000, 3);

// 검색 이벤트
trackSearch('강남 딜러');

// 에러 이벤트
trackError('E6001', '이미 지원한 공고입니다', 'business');
```

---

## 3. 에러 모니터링 (Sentry)

### 3.1 구현 구조

```typescript
// src/services/crashlyticsService.ts
// Sentry 기반 에러 모니터링

// 플랫폼별 동작:
// - 웹: 콘솔 로깅
// - 네이티브: Sentry SDK로 전송
```

### 3.2 에러 타입

```typescript
export type CrashSeverity = 'fatal' | 'non-fatal' | 'warning';

export interface CrashContext {
  screen?: string;
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: string | number | boolean | undefined;
}
```

### 3.3 핵심 API

```typescript
// 초기화
crashlyticsService.initialize();

// 비치명적 에러 기록
await recordError(error, {
  screen: 'JobDetailScreen',
  action: 'apply_job',
});

// 치명적 에러 기록
await recordFatalError(error, {
  component: 'PaymentForm',
});

// 로그 메시지 추가
await log('사용자가 로그인 시도');

// Breadcrumb 추가
await leaveBreadcrumb('button_click', {
  button_name: 'apply_button',
  screen: 'JobDetail',
});
```

### 3.4 사용자 정보 관리

```typescript
// 사용자 ID 설정
await setUserId('user123');

// 사용자 정보 설정
await setUser({
  id: 'user123',
  email: 'user@example.com',
  name: '홍길동',
});

// 사용자 정보 초기화 (로그아웃 시)
await clearUser();
```

### 3.5 커스텀 속성

```typescript
// 단일 속성 설정
await setAttribute('screen', 'JobList');

// 여러 속성 설정
await setAttributes({
  user_role: 'staff',
  region: 'seoul',
});
```

### 3.6 통합 헬퍼 함수

```typescript
// AppError 기록 (severity 자동 판단)
await recordAppError(appError, {
  screen: 'SettlementScreen',
});

// 컴포넌트 에러 기록 (ErrorBoundary용)
await recordComponentError(error, {
  componentStack: errorInfo.componentStack,
});

// 네트워크 에러 기록
await recordNetworkError(error, {
  url: 'https://api.example.com/jobs',
  method: 'GET',
});

// 현재 화면 설정
await setScreen('JobDetailScreen');
```

---

## 4. 성능 모니터링

### 4.1 구현 구조

```typescript
// src/services/performanceService.ts
// 자체 구현 성능 측정 서비스

// 동작 방식:
// - 개발 환경: 콘솔 로깅
// - 프로덕션: 로거 출력 (Firebase Console에서 확인 가능)
```

### 4.2 Performance Trace 인터페이스

```typescript
export interface PerformanceTrace {
  name: string;
  startTime: number;
  attributes: Record<string, string>;
  metrics: Record<string, number>;
  start: () => void;
  stop: () => void;
  putAttribute: (key: string, value: string) => void;
  putMetric: (key: string, value: number) => void;
  incrementMetric: (key: string, value?: number) => void;
}
```

### 4.3 화면 로드 시간 측정

```typescript
// 화면 트레이스 시작
const trace = performanceService.startScreenTrace('JobListScreen');

// ... 화면 로드 완료 후
trace.putMetric('item_count', jobs.length);
trace.stop();
```

### 4.4 API 호출 시간 측정

```typescript
// API 트레이스 시작
const trace = performanceService.startApiTrace('getJobPostings');

const result = await fetchData();

trace.putMetric('response_size', result.length);
trace.putAttribute('status', 'success');
trace.stop();
```

### 4.5 작업 시간 측정 래퍼

```typescript
// 비동기 작업 측정
const result = await performanceService.measureAsync(
  'fetchJobs',
  async () => await jobService.getJobPostings(),
  { filter: 'active' }
);

// 동기 작업 측정
const processed = performanceService.measure(
  'processData',
  () => processJobData(rawData),
  { dataSize: String(rawData.length) }
);
```

### 4.6 기타 측정

```typescript
// 커스텀 메트릭 기록
recordMetric('job_list_render_count', 50);

// 네비게이션 시간 기록
recordNavigationTime('JobList', 'JobDetail', 150);

// 렌더링 시간 기록
recordRenderTime('JobCard', 25);
```

---

## 5. 화면 추적 자동화

### 5.1 Expo Router 연동

```typescript
// app/_layout.tsx
import { usePathname, useSegments } from 'expo-router';
import { analyticsService } from '@/services/analyticsService';

export default function RootLayout() {
  const pathname = usePathname();
  const segments = useSegments();

  // 화면 변경 시 자동 추적
  useEffect(() => {
    const screenName = getScreenName(pathname, segments);
    analyticsService.trackScreenView(screenName);
  }, [pathname, segments]);

  return (
    // ... layout
  );
}
```

### 5.2 화면 이름 매핑

```typescript
function getScreenName(pathname: string, segments: string[]): string {
  const screenMap: Record<string, string> = {
    '/': 'Home',
    '/(app)/(tabs)': 'JobList',
    '/(app)/(tabs)/schedule': 'Schedule',
    '/(app)/(tabs)/qr': 'QRScan',
    '/(app)/(tabs)/employer': 'MyPostings',
    '/(app)/(tabs)/profile': 'Profile',
    '/jobs/[id]': 'JobDetail',
    '/applications': 'ApplicationList',
    '/notifications': 'Notifications',
    '/settings': 'Settings',
  };

  const normalizedPath = segments.join('/');
  return screenMap[`/${normalizedPath}`] || pathname;
}
```

---

## 6. 추적 이벤트 목록

### UNIQN 핵심 이벤트

| 카테고리 | 이벤트 | 파라미터 | 용도 |
|----------|--------|----------|------|
| **인증** | login | method | 로그인 방법별 전환율 |
| | signup | method | 가입 전환율 |
| | logout | - | 세션 종료 추적 |
| **구인구직** | job_view | job_id, job_title | 공고 조회수 |
| | job_apply | job_id, job_title, job_role | 지원 전환율 |
| | job_create | job_id, job_title | 공고 생성 추적 |
| | job_edit | job_id | 공고 수정 추적 |
| | job_close | job_id | 공고 마감 추적 |
| **지원 관리** | application_confirm | application_id | 지원 확정 |
| | application_reject | application_id | 지원 거절 |
| | application_cancel | application_id | 지원 취소 |
| **근무** | check_in | schedule_date | 출근 체크 |
| | check_out | schedule_date, work_hours | 퇴근 체크 |
| **정산** | settlement_view | - | 정산 조회 |
| | settlement_complete | amount, count | 정산 완료 |
| **알림** | notification_receive | - | 알림 수신 |
| | notification_click | - | 알림 클릭 |

### 사용자 속성

| 속성 | 값 | 용도 |
|------|-----|------|
| user_role | staff, employer, admin | 역할별 행동 분석 |
| account_created_date | ISO 날짜 | 사용자 성숙도 |
| total_applications | 숫자 | 활동 수준 |
| total_jobs_posted | 숫자 | 구인자 활동 |
| has_verified_phone | boolean | 인증 상태 |
| preferred_location | 지역명 | 선호 지역 |

---

## 7. 플랫폼별 구현 상태

### 현재 상태

```yaml
웹:
  Analytics: ✅ Firebase Analytics SDK (실제 전송)
  에러 모니터링: ✅ 콘솔 로깅 + Sentry
  성능 모니터링: ✅ 자체 구현 (로깅)

iOS/Android:
  Analytics: ⚠️ 로깅 모드 (추후 네이티브 SDK 추가 예정)
  에러 모니터링: ✅ Sentry SDK
  성능 모니터링: ✅ 자체 구현 (로깅)
```

### 향후 계획

```yaml
Phase 3 (예정):
  - @react-native-firebase/analytics 추가
  - @react-native-firebase/performance 추가
  - 네이티브 앱에서 실제 Analytics 전송 활성화

Phase 4 (예정):
  - Firebase Console 대시보드 구성
  - 커스텀 리포트 생성
  - A/B 테스트 연동
```

---

## 8. 개인정보 보호

### 8.1 동의 관리

```typescript
// 개발 환경에서는 Analytics 비활성화
if (__DEV__) {
  analyticsService.setEnabled(false);
  crashlyticsService.setEnabled(false);
}

// 사용자 동의에 따른 활성화
const handleConsentChange = (granted: boolean) => {
  analyticsService.setEnabled(granted);
  crashlyticsService.setEnabled(granted);
};
```

### 8.2 데이터 수집 원칙

- 개인 식별 정보(PII) 직접 수집 금지
- 사용자 ID는 익명화된 Firebase UID 사용
- 에러 메시지에서 민감한 정보 마스킹
- GDPR/개인정보보호법 준수

---

## 9. 디버깅 및 테스트

### 개발 환경 로깅

```typescript
// 개발 환경에서 이벤트 로깅 확인
if (__DEV__) {
  logger.debug('Analytics Event', {
    event: eventName,
    params: cleanParams,
  });
}
```

### 테스트 체크리스트

```markdown
## Analytics 테스트

### 이벤트 추적
- [ ] 로그인/로그아웃 이벤트 발생 확인
- [ ] 공고 조회/지원 이벤트 발생 확인
- [ ] 출퇴근 이벤트 발생 확인

### 에러 모니터링
- [ ] Sentry 대시보드에서 에러 확인
- [ ] Breadcrumb 정보 확인
- [ ] 사용자 정보 연결 확인

### 성능 모니터링
- [ ] 화면 로드 시간 측정 확인
- [ ] API 호출 시간 측정 확인
```

---

## 10. 서비스 Export

### analyticsService

```typescript
export const analyticsService = {
  // 초기화
  initialize: initializeAnalytics,
  setEnabled: setAnalyticsEnabled,

  // 핵심 기능
  trackEvent,
  trackScreenView,
  setUserProperties,
  setUserId,

  // 헬퍼 함수
  trackLogin,
  trackSignup,
  trackLogout,
  trackJobView,
  trackJobApply,
  trackJobCreate,
  trackCheckIn,
  trackCheckOut,
  trackSettlementComplete,
  trackSearch,
  trackError,
};
```

### crashlyticsService

```typescript
export const crashlyticsService = {
  initialize,
  setEnabled,
  recordError,
  recordFatalError,
  recordAppError,
  recordComponentError,
  recordNetworkError,
  log,
  leaveBreadcrumb,
  getBreadcrumbs,
  clearBreadcrumbs,
  setAttribute,
  setAttributes,
  setUserId,
  setUser,
  clearUser,
  setScreen,
};
```

### performanceService

```typescript
export const performanceService = {
  setEnabled,
  startScreenTrace,
  startApiTrace,
  startTrace,
  stopTrace,
  recordMetric,
  measureAsync,
  measure,
  recordNavigationTime,
  recordRenderTime,
  stopAllTraces,
};
```

---

## 요약

| 항목 | 도구 | 상태 | 플랫폼 |
|------|------|:----:|--------|
| 사용자 행동 분석 | Firebase Analytics | ✅ 웹 / ⚠️ 네이티브 로깅 | 웹 전송, 네이티브 로깅 |
| 에러 모니터링 | Sentry | ✅ 구현 | 전체 플랫폼 |
| 성능 측정 | 자체 구현 | ✅ 구현 | 전체 플랫폼 (로깅) |
| 화면 추적 | Analytics + Router | ✅ 구현 | 전체 플랫폼 |

---

## 관련 문서

- [15-cicd.md](./15-cicd.md) - CI/CD 파이프라인
- [14-migration-plan.md](./14-migration-plan.md) - 마이그레이션 완료 보고서

---

*마지막 업데이트: 2026-02-02*
*모니터링 상태: 기본 구현 완료 (네이티브 Analytics 추가 예정)*
