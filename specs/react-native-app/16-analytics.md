# 16. Analytics & Monitoring

## 개요

앱 사용자 행동 분석, 크래시 리포팅, 성능 모니터링을 위한 통합 분석 시스템입니다.

### 기술 스택

| 도구 | 용도 | 플랫폼 |
|------|------|--------|
| Firebase Analytics | 사용자 행동 추적 | iOS, Android, Web |
| Firebase Crashlytics | 크래시 리포팅 | iOS, Android |
| Firebase Performance | 성능 모니터링 | iOS, Android, Web |
| Sentry (선택) | 에러 추적 + 웹 크래시 | All |

---

## 1. 설치 및 설정

### 패키지 설치

```bash
# Firebase Analytics & Crashlytics
npx expo install @react-native-firebase/analytics
npx expo install @react-native-firebase/crashlytics
npx expo install @react-native-firebase/perf

# Sentry (웹 크래시 포함 시)
npx expo install @sentry/react-native
```

### app.json 설정

```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/analytics",
      "@react-native-firebase/crashlytics",
      "@react-native-firebase/perf",
      [
        "@sentry/react-native/expo",
        {
          "organization": "uniqn",
          "project": "uniqn-mobile"
        }
      ]
    ]
  }
}
```

---

## 2. Analytics Service

### 핵심 서비스 구현

```typescript
// services/analytics/AnalyticsService.ts
import analytics from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

// 이벤트 타입 정의
export type AnalyticsEventName =
  // 인증
  | 'login'
  | 'logout'
  | 'signup'
  | 'password_reset'
  // 구인공고
  | 'job_view'
  | 'job_apply'
  | 'job_save'
  | 'job_share'
  // 지원
  | 'application_submit'
  | 'application_cancel'
  | 'confirmation_accept'
  | 'confirmation_decline'
  // QR 체크인
  | 'qr_checkin'
  | 'qr_checkout'
  // 정산
  | 'settlement_request'
  | 'settlement_complete'
  // 일반
  | 'screen_view'
  | 'button_click'
  | 'error_occurred';

interface EventParams {
  [key: string]: string | number | boolean | undefined;
}

class AnalyticsService {
  private isEnabled: boolean = true;
  private userId: string | null = null;

  // 초기화
  async initialize(): Promise<void> {
    try {
      // 디버그 모드에서는 분석 비활성화 옵션
      if (__DEV__) {
        await analytics().setAnalyticsCollectionEnabled(false);
        this.isEnabled = false;
        console.log('[Analytics] Disabled in development');
        return;
      }

      await analytics().setAnalyticsCollectionEnabled(true);
      console.log('[Analytics] Initialized');
    } catch (error) {
      console.error('[Analytics] Initialization failed:', error);
    }
  }

  // 사용자 ID 설정
  async setUserId(userId: string | null): Promise<void> {
    this.userId = userId;
    try {
      await analytics().setUserId(userId);
    } catch (error) {
      console.error('[Analytics] setUserId failed:', error);
    }
  }

  // 사용자 속성 설정
  async setUserProperties(properties: {
    role?: 'staff' | 'employer' | 'admin';
    region?: string;
    experienceLevel?: string;
  }): Promise<void> {
    try {
      if (properties.role) {
        await analytics().setUserProperty('user_role', properties.role);
      }
      if (properties.region) {
        await analytics().setUserProperty('user_region', properties.region);
      }
      if (properties.experienceLevel) {
        await analytics().setUserProperty('experience_level', properties.experienceLevel);
      }
    } catch (error) {
      console.error('[Analytics] setUserProperties failed:', error);
    }
  }

  // 화면 조회 추적
  async logScreenView(screenName: string, screenClass?: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.error('[Analytics] logScreenView failed:', error);
    }
  }

  // 이벤트 추적
  async logEvent(eventName: AnalyticsEventName, params?: EventParams): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await analytics().logEvent(eventName, {
        ...params,
        platform: Platform.OS,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Analytics] logEvent failed:', error);
    }
  }

  // === 도메인별 이벤트 메서드 ===

  // 인증 이벤트
  async logLogin(method: 'email' | 'google' | 'apple' | 'kakao'): Promise<void> {
    await this.logEvent('login', { method });
  }

  async logSignup(method: 'email' | 'google' | 'apple' | 'kakao'): Promise<void> {
    await this.logEvent('signup', { method });
  }

  async logLogout(): Promise<void> {
    await this.logEvent('logout');
  }

  // 구인공고 이벤트
  async logJobView(jobId: string, jobTitle: string, location: string): Promise<void> {
    await this.logEvent('job_view', {
      job_id: jobId,
      job_title: jobTitle,
      location,
    });
  }

  async logJobApply(jobId: string, jobTitle: string): Promise<void> {
    await this.logEvent('job_apply', {
      job_id: jobId,
      job_title: jobTitle,
    });
  }

  async logJobSave(jobId: string, saved: boolean): Promise<void> {
    await this.logEvent('job_save', {
      job_id: jobId,
      action: saved ? 'save' : 'unsave',
    });
  }

  // 지원 이벤트
  async logApplicationSubmit(
    jobId: string,
    applicationId: string
  ): Promise<void> {
    await this.logEvent('application_submit', {
      job_id: jobId,
      application_id: applicationId,
    });
  }

  async logConfirmationResponse(
    applicationId: string,
    response: 'accept' | 'decline',
    declineReason?: string
  ): Promise<void> {
    await this.logEvent(
      response === 'accept' ? 'confirmation_accept' : 'confirmation_decline',
      {
        application_id: applicationId,
        decline_reason: declineReason,
      }
    );
  }

  // QR 체크인 이벤트
  async logQRCheckin(eventId: string, staffId: string): Promise<void> {
    await this.logEvent('qr_checkin', {
      event_id: eventId,
      staff_id: staffId,
    });
  }

  async logQRCheckout(
    eventId: string,
    staffId: string,
    workHours: number
  ): Promise<void> {
    await this.logEvent('qr_checkout', {
      event_id: eventId,
      staff_id: staffId,
      work_hours: workHours,
    });
  }

  // 정산 이벤트
  async logSettlementRequest(
    eventId: string,
    amount: number
  ): Promise<void> {
    await this.logEvent('settlement_request', {
      event_id: eventId,
      amount,
    });
  }

  // 에러 이벤트
  async logError(
    errorType: string,
    errorMessage: string,
    context?: string
  ): Promise<void> {
    await this.logEvent('error_occurred', {
      error_type: errorType,
      error_message: errorMessage.substring(0, 100),
      context,
    });
  }

  // 버튼 클릭 추적
  async logButtonClick(
    buttonName: string,
    screenName: string,
    additionalParams?: EventParams
  ): Promise<void> {
    await this.logEvent('button_click', {
      button_name: buttonName,
      screen_name: screenName,
      ...additionalParams,
    });
  }
}

export const analyticsService = new AnalyticsService();
```

---

## 3. Crashlytics Service

### 크래시 리포팅 구현

```typescript
// services/analytics/CrashlyticsService.ts
import crashlytics from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';

class CrashlyticsService {
  private isEnabled: boolean = true;

  // 초기화
  async initialize(): Promise<void> {
    try {
      if (__DEV__) {
        await crashlytics().setCrashlyticsCollectionEnabled(false);
        this.isEnabled = false;
        console.log('[Crashlytics] Disabled in development');
        return;
      }

      await crashlytics().setCrashlyticsCollectionEnabled(true);
      console.log('[Crashlytics] Initialized');
    } catch (error) {
      console.error('[Crashlytics] Initialization failed:', error);
    }
  }

  // 사용자 식별
  async setUserId(userId: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().setUserId(userId);
    } catch (error) {
      console.error('[Crashlytics] setUserId failed:', error);
    }
  }

  // 사용자 속성 설정
  async setAttributes(attributes: Record<string, string>): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().setAttributes(attributes);
    } catch (error) {
      console.error('[Crashlytics] setAttributes failed:', error);
    }
  }

  // 커스텀 키 설정
  async setCustomKey(key: string, value: string | number | boolean): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().setAttribute(key, String(value));
    } catch (error) {
      console.error('[Crashlytics] setCustomKey failed:', error);
    }
  }

  // 브레드크럼 로그 (크래시 전 맥락 정보)
  async log(message: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().log(message);
    } catch (error) {
      console.error('[Crashlytics] log failed:', error);
    }
  }

  // 비치명적 에러 기록
  async recordError(
    error: Error,
    context?: string,
    additionalData?: Record<string, string>
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // 추가 컨텍스트 설정
      if (context) {
        await crashlytics().log(`Context: ${context}`);
      }

      if (additionalData) {
        await crashlytics().setAttributes(additionalData);
      }

      // 에러 기록
      await crashlytics().recordError(error);
    } catch (err) {
      console.error('[Crashlytics] recordError failed:', err);
    }
  }

  // 강제 크래시 (테스트용)
  crash(): void {
    crashlytics().crash();
  }
}

export const crashlyticsService = new CrashlyticsService();
```

### 에러 바운더리 연동

```typescript
// components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { crashlyticsService } from '@/services/analytics/CrashlyticsService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Crashlytics에 에러 기록
    crashlyticsService.log(`Component Stack: ${errorInfo.componentStack}`);
    crashlyticsService.recordError(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack?.substring(0, 500) || '',
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>문제가 발생했습니다</Text>
          <Text style={styles.message}>
            앱에서 오류가 발생했습니다.{'\n'}
            다시 시도해 주세요.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## 4. Performance Monitoring

### 성능 추적 서비스

```typescript
// services/analytics/PerformanceService.ts
import perf, { FirebasePerformanceTypes } from '@react-native-firebase/perf';

class PerformanceService {
  private traces: Map<string, FirebasePerformanceTypes.Trace> = new Map();

  // HTTP 메트릭 활성화
  async initialize(): Promise<void> {
    try {
      await perf().setPerformanceCollectionEnabled(!__DEV__);
      console.log('[Performance] Initialized');
    } catch (error) {
      console.error('[Performance] Initialization failed:', error);
    }
  }

  // 커스텀 트레이스 시작
  async startTrace(traceName: string): Promise<void> {
    try {
      const trace = await perf().startTrace(traceName);
      this.traces.set(traceName, trace);
    } catch (error) {
      console.error(`[Performance] startTrace(${traceName}) failed:`, error);
    }
  }

  // 트레이스에 메트릭 추가
  async putMetric(
    traceName: string,
    metricName: string,
    value: number
  ): Promise<void> {
    const trace = this.traces.get(traceName);
    if (trace) {
      trace.putMetric(metricName, value);
    }
  }

  // 트레이스에 속성 추가
  async putAttribute(
    traceName: string,
    attributeName: string,
    value: string
  ): Promise<void> {
    const trace = this.traces.get(traceName);
    if (trace) {
      await trace.putAttribute(attributeName, value);
    }
  }

  // 트레이스 종료
  async stopTrace(traceName: string): Promise<void> {
    const trace = this.traces.get(traceName);
    if (trace) {
      await trace.stop();
      this.traces.delete(traceName);
    }
  }

  // HTTP 요청 측정
  async measureHttpRequest<T>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    request: () => Promise<T>
  ): Promise<T> {
    const metric = await perf().newHttpMetric(url, method);
    await metric.start();

    try {
      const response = await request();
      metric.setHttpResponseCode(200);
      return response;
    } catch (error: any) {
      metric.setHttpResponseCode(error.status || 500);
      throw error;
    } finally {
      await metric.stop();
    }
  }
}

export const performanceService = new PerformanceService();
```

### 성능 측정 훅

```typescript
// hooks/usePerformanceTrace.ts
import { useEffect, useRef } from 'react';
import { performanceService } from '@/services/analytics/PerformanceService';

export function usePerformanceTrace(traceName: string) {
  const isStarted = useRef(false);

  useEffect(() => {
    if (!isStarted.current) {
      performanceService.startTrace(traceName);
      isStarted.current = true;
    }

    return () => {
      if (isStarted.current) {
        performanceService.stopTrace(traceName);
        isStarted.current = false;
      }
    };
  }, [traceName]);

  return {
    putMetric: (name: string, value: number) =>
      performanceService.putMetric(traceName, name, value),
    putAttribute: (name: string, value: string) =>
      performanceService.putAttribute(traceName, name, value),
  };
}

// 사용 예시
function JobListScreen() {
  const { putMetric } = usePerformanceTrace('job_list_screen');

  const { data } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const start = Date.now();
      const result = await fetchJobs();
      putMetric('fetch_duration_ms', Date.now() - start);
      putMetric('job_count', result.length);
      return result;
    },
  });

  return <JobList jobs={data} />;
}
```

---

## 5. 화면 추적 자동화

### Navigation 연동

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { usePathname, useSegments } from 'expo-router';
import { analyticsService } from '@/services/analytics/AnalyticsService';

export default function RootLayout() {
  const pathname = usePathname();
  const segments = useSegments();

  // 화면 변경 시 자동 추적
  useEffect(() => {
    const screenName = getScreenName(pathname, segments);
    analyticsService.logScreenView(screenName);
  }, [pathname, segments]);

  return (
    // ... layout
  );
}

// 경로를 화면 이름으로 변환
function getScreenName(pathname: string, segments: string[]): string {
  const screenMap: Record<string, string> = {
    '/': 'Home',
    '/jobs': 'JobList',
    '/jobs/[id]': 'JobDetail',
    '/applications': 'ApplicationList',
    '/profile': 'Profile',
    '/schedule': 'Schedule',
    '/notifications': 'Notifications',
    '/settings': 'Settings',
  };

  // 동적 세그먼트 처리
  const normalizedPath = segments
    .map((seg) => (seg.startsWith('[') ? seg : seg))
    .join('/');

  return screenMap[`/${normalizedPath}`] || pathname;
}
```

---

## 6. 웹 플랫폼 지원 (React Native Web)

### 플랫폼별 분기

```typescript
// services/analytics/index.ts
import { Platform } from 'react-native';

// 웹에서는 Firebase JS SDK 사용
const createAnalyticsService = async () => {
  if (Platform.OS === 'web') {
    const { WebAnalyticsService } = await import('./WebAnalyticsService');
    return new WebAnalyticsService();
  } else {
    const { analyticsService } = await import('./AnalyticsService');
    return analyticsService;
  }
};

export { createAnalyticsService };
```

### 웹 Analytics 서비스

```typescript
// services/analytics/WebAnalyticsService.ts
import { getAnalytics, logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { app } from '@/config/firebase';

export class WebAnalyticsService {
  private analytics = getAnalytics(app);

  async logScreenView(screenName: string): Promise<void> {
    logEvent(this.analytics, 'screen_view', {
      firebase_screen: screenName,
      firebase_screen_class: screenName,
    });
  }

  async logEvent(eventName: string, params?: Record<string, any>): Promise<void> {
    logEvent(this.analytics, eventName, {
      ...params,
      platform: 'web',
      timestamp: Date.now(),
    });
  }

  async setUserId(userId: string | null): Promise<void> {
    if (userId) {
      setUserId(this.analytics, userId);
    }
  }

  async setUserProperties(properties: Record<string, string>): Promise<void> {
    setUserProperties(this.analytics, properties);
  }

  // 웹에서는 Crashlytics 대신 에러 로깅
  async recordError(error: Error, context?: string): Promise<void> {
    console.error('[WebAnalytics] Error:', error, context);
    this.logEvent('error_occurred', {
      error_message: error.message,
      error_stack: error.stack?.substring(0, 500),
      context,
    });
  }
}
```

---

## 7. 추적 이벤트 목록

### UNIQN 핵심 이벤트

| 카테고리 | 이벤트 | 파라미터 | 용도 |
|----------|--------|----------|------|
| **인증** | login | method | 로그인 방법별 전환율 |
| | signup | method | 가입 전환율 |
| | logout | - | 세션 종료 추적 |
| **구인공고** | job_view | job_id, job_title, location | 공고 조회수 |
| | job_apply | job_id, job_title | 지원 전환율 |
| | job_save | job_id, action | 저장 기능 사용률 |
| | job_share | job_id, method | 공유 활성도 |
| **지원** | application_submit | job_id, application_id | 지원 완료율 |
| | application_cancel | application_id, reason | 취소 분석 |
| | confirmation_accept | application_id | 확정 수락률 |
| | confirmation_decline | application_id, reason | 거절 사유 분석 |
| **근무** | qr_checkin | event_id, staff_id | 체크인 추적 |
| | qr_checkout | event_id, work_hours | 근무시간 분석 |
| **정산** | settlement_request | event_id, amount | 정산 요청 추적 |
| | settlement_complete | event_id, amount | 정산 완료 추적 |

### 사용자 속성

| 속성 | 값 | 용도 |
|------|-----|------|
| user_role | staff, employer, admin | 역할별 행동 분석 |
| user_region | 서울, 부산 등 | 지역별 활성도 |
| experience_level | beginner, intermediate, expert | 경력별 분석 |
| account_age_days | 숫자 | 사용자 성숙도 |

---

## 8. 대시보드 설정

### Firebase Console 권장 대시보드

```yaml
# 주요 지표
daily_active_users:
  metric: "Active Users"
  period: "Daily"

conversion_funnel:
  steps:
    - job_view
    - job_apply
    - confirmation_accept
    - qr_checkin

retention:
  cohort: "signup"
  periods: [1, 7, 30]

# 세그먼트
segments:
  - name: "활성 스태프"
    condition: "user_role == 'staff' AND qr_checkin in last 7 days"

  - name: "신규 사용자"
    condition: "first_open in last 7 days"
```

---

## 9. 디버깅 및 테스트

### 디버그 모드

```typescript
// 개발 중 이벤트 확인
if (__DEV__) {
  // Firebase DebugView 활성화 (iOS/Android)
  // adb shell setprop debug.firebase.analytics.app com.uniqn.app
  // 또는 Xcode scheme에서 -FIRDebugEnabled 추가
}
```

### 이벤트 검증 체크리스트

- [ ] Firebase Console > DebugView에서 이벤트 확인
- [ ] 파라미터 값이 올바르게 전달되는지 확인
- [ ] 사용자 속성이 설정되는지 확인
- [ ] 화면 조회가 자동 추적되는지 확인
- [ ] 크래시 리포트가 Crashlytics에 표시되는지 확인

---

## 10. 개인정보 보호

### GDPR/개인정보 준수

```typescript
// services/analytics/PrivacyService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyticsService } from './AnalyticsService';
import { crashlyticsService } from './CrashlyticsService';

const ANALYTICS_CONSENT_KEY = 'analytics_consent';

export const PrivacyService = {
  // 동의 상태 확인
  async hasConsent(): Promise<boolean> {
    const consent = await AsyncStorage.getItem(ANALYTICS_CONSENT_KEY);
    return consent === 'granted';
  },

  // 동의 설정
  async setConsent(granted: boolean): Promise<void> {
    await AsyncStorage.setItem(
      ANALYTICS_CONSENT_KEY,
      granted ? 'granted' : 'denied'
    );

    // 분석 수집 활성화/비활성화
    await analyticsService.initialize();
    await crashlyticsService.initialize();
  },

  // 데이터 삭제 요청 (계정 삭제 시)
  async requestDataDeletion(userId: string): Promise<void> {
    // Firebase에 데이터 삭제 요청
    // 실제로는 Cloud Function을 통해 처리
    console.log(`Data deletion requested for user: ${userId}`);
  },
};
```

### 개인정보 처리방침 연동

```typescript
// 앱 첫 실행 시 동의 요청
function OnboardingScreen() {
  const [consent, setConsent] = useState(false);

  const handleContinue = async () => {
    await PrivacyService.setConsent(consent);
    router.replace('/');
  };

  return (
    <View>
      <Text>앱 사용 개선을 위해 분석 데이터를 수집합니다.</Text>
      <Switch value={consent} onValueChange={setConsent} />
      <Text>분석 데이터 수집에 동의합니다</Text>
      <Button onPress={handleContinue}>계속</Button>
    </View>
  );
}
```

---

## 체크리스트

### 구현 완료 기준

- [ ] Firebase Analytics 초기화 완료
- [ ] Crashlytics 초기화 및 에러 바운더리 연동
- [ ] 핵심 이벤트 추적 구현
- [ ] 화면 조회 자동 추적
- [ ] 사용자 속성 설정
- [ ] 웹 플랫폼 분기 처리
- [ ] 개인정보 동의 처리
- [ ] 디버그 모드 테스트 완료
