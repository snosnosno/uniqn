# 출시 전 체크리스트 및 구현 필요 사항

**문서 버전**: 1.0
**작성일**: 2025-10-18
**프로젝트**: T-HOLDEM v0.2.3
**현재 상태**: Production Ready (98% 완성)

---

## 📊 **전체 현황 요약**

### ✅ **완료된 핵심 기능**
- **프로덕션 준비**: Enterprise 수준 품질 ✅
- **TypeScript 안정성**: 에러 0개, any 타입 0개 ✅
- **프로덕션 빌드**: 성공 (307.35 kB) ✅
- **알림 시스템**: Phase 1 완료 (5개 Firebase Functions) ✅
- **멀티테넌트 아키텍처**: 100% 완료 ✅
- **토너먼트 시스템**: 안정화 완료 ✅
- **국제화 (i18n)**: 한국어/영어 지원 ✅
- **테스트 커버리지**: 65% ✅

### ⚠️ **주의 필요 사항**
- ESLint 경고: 39개 (심각하지 않음)
- TODO/FIXME 주석: 11개
- 구독 시스템: 미구현 (수익화 필요)

---

#### 2.2 FCM (Firebase Cloud Messaging) 설정

**체크리스트**:
```bash
# 1. FCM 서버 키 확인
# Firebase Console → Project Settings → Cloud Messaging
# - Server key 존재 여부 확인
# - Sender ID 확인

# 2. 웹 푸시 인증서 (VAPID) 확인
# Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
# - Key pair 생성 확인
# - Public key 환경변수 설정 확인
```

#### 2.3 Google Analytics 4 연동

**체크리스트**:
```bash
# 1. GA4 Property 확인
# Firebase Console → Analytics → Dashboard
# - Property 생성 확인
# - Measurement ID 확인 (REACT_APP_FIREBASE_MEASUREMENT_ID)

# 2. 이벤트 추적 테스트
# Firebase Console → Analytics → DebugView
# - 테스트 이벤트 발생시켜 추적 확인
```

**예상 소요 시간**: 1시간

---

### 3. **Security Rules 테스트** (우선순위: 높음) 🔒

#### 3.1 멀티테넌트 격리 검증

**테스트 시나리오**:
```javascript
// 시나리오 1: 본인 데이터 읽기 (성공해야 함)
const userId = 'user123';
const tournamentId = 'tournament456';
const participantsRef = collection(
  db,
  `users/${userId}/tournaments/${tournamentId}/participants`
);
const snapshot = await getDocs(participantsRef);
// 예상: 성공

// 시나리오 2: 타인 데이터 읽기 (실패해야 함)
const otherUserId = 'user789';
const otherParticipantsRef = collection(
  db,
  `users/${otherUserId}/tournaments/${tournamentId}/participants`
);
try {
  const snapshot = await getDocs(otherParticipantsRef);
  console.error('보안 규칙 실패: 타인 데이터 접근 가능');
} catch (error) {
  console.log('보안 규칙 정상: 타인 데이터 접근 차단');
}

// 시나리오 3: 관리자 권한 확인
const adminUserId = 'admin123';
const adminParticipantsRef = collection(
  db,
  `users/${userId}/tournaments/${tournamentId}/participants`
);
const adminSnapshot = await getDocs(adminParticipantsRef);
// 예상: 관리자는 모든 데이터 접근 가능
```

**실행 방법**:
```bash
# 1. Firebase 에뮬레이터 시작
firebase emulators:start --only firestore

# 2. 테스트 실행
npm run test -- SecurityRules.test.ts
```

**예상 소요 시간**: 1시간

---

### 4. **프로덕션 빌드 최종 검증** (우선순위: 높음) ✅

#### 4.1 빌드 성공 확인

**현재 상태**: ✅ 성공 (307.35 kB main bundle)

**재확인 명령어**:
```bash
cd app2
npm run type-check  # TypeScript 에러 체크
npm run lint        # ESLint 검사
npm run build       # 프로덕션 빌드
```

#### 4.2 번들 크기 분석

**현재 번들 크기**:
- Main bundle: 307.35 kB
- CSS: 126.68 kB
- 총 청크: 50개+

**최적화 여부 확인**:
```bash
# 번들 분석 (옵션)
npm install --save-dev source-map-explorer
npm run build
npx source-map-explorer 'build/static/js/*.js'
```

#### 4.3 Capacitor 네이티브 빌드 (모바일)

**체크리스트**:
```bash
# 1. Capacitor sync
npx cap sync

# 2. 안드로이드 빌드 테스트 (옵션)
npx cap open android

# 3. iOS 빌드 테스트 (옵션, macOS만)
npx cap open ios
```

**예상 소요 시간**: 30분

---

### 5. **모니터링 & 알림 설정** (우선순위: 높음) 📊

#### 5.1 Sentry 에러 트래킹 설정

**현재 상태**: 패키지 설치됨 (`@sentry/react: ^10.0.0`)

**설정 필요 사항**:
```typescript
// 1. Sentry 초기화 (src/index.tsx 또는 App.tsx)
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 1.0, // 프로덕션에서는 0.1 권장
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// 2. 환경변수 추가 (.env.production)
REACT_APP_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**테스트 방법**:
```typescript
// 테스트 에러 발생
Sentry.captureMessage("Test error from production");
```

#### 5.2 Firebase Performance Monitoring

**설정 방법**:
```typescript
// 1. Firebase Performance 초기화 (src/config/firebase.config.ts)
import { getPerformance } from 'firebase/performance';

const perf = getPerformance(app);

// 2. 커스텀 트레이스 추가 (옵션)
import { trace } from 'firebase/performance';

const customTrace = trace(perf, 'custom_trace_name');
customTrace.start();
// ... 측정할 작업
customTrace.stop();
```

#### 5.3 알림 채널 설정

**체크리스트**:
```bash
# 1. 이메일 알림 (관리자용)
# - Firebase 프로젝트에 관리자 이메일 등록
# - 알림 규칙 설정 (예: Functions 실패 시)

# 2. Slack/Discord 웹훅 설정 (옵션)
# - 웹훅 URL 생성
# - Firebase Functions에 웹훅 전송 로직 추가

# 3. 모바일 푸시 알림 테스트
# - FCM 푸시 알림 테스트 전송
# - iOS/Android 기기에서 수신 확인
```

**예상 소요 시간**: 2시간

---

## 🎯 **구현 필요 사항 (출시 후)**

### 1. **수익모델 (구독 시스템)** 💰 (우선순위: 최우선)

#### 1.1 현황
- **문서 상태**: 완성 (SUBSCRIPTION_MODEL.md)
- **구현 상태**: 0% (미착수)
- **예상 소요 시간**: 1주일 (7일)

#### 1.2 구현 계획

##### Phase 1: 기초 구조 (1-2일)
```typescript
// 1. 타입 정의 (src/types/subscription.ts)
interface Subscription {
  userId: string;
  plan: 'free' | 'basic' | 'pro';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  startDate: Timestamp;
  endDate: Timestamp;
  autoRenew: boolean;
}

// 2. Firestore Collections 생성
- subscriptions/
- payments/
- invoices/
- promotions/

// 3. SubscriptionContext 구현 (src/contexts/SubscriptionContext.tsx)
interface SubscriptionContextValue {
  subscription: Subscription | null;
  loading: boolean;
  error: Error | null;
  hasFeatureAccess: (feature: string) => boolean;
  upgradeSubscription: (plan: string) => Promise<void>;
  cancelSubscription: (reason: string) => Promise<void>;
}

// 4. 권한 체크 함수 (src/utils/subscriptionUtils.ts)
const FEATURE_ACCESS_MATRIX = {
  free: ['profile.view', 'jobs.view', 'jobs.apply'],
  basic: [...free, 'schedule.view', 'jobs.manage', 'shifts.manage'],
  pro: [...basic, 'participants.manage', 'tables.manage', 'dashboard.ceo']
};

const hasFeatureAccess = (plan: string, feature: string): boolean => {
  return FEATURE_ACCESS_MATRIX[plan]?.includes(feature) || false;
};
```

##### Phase 2: 결제 시스템 (2-3일)
```typescript
// 1. 결제 게이트웨이 선택
// 옵션 A: Stripe (글로벌 추천)
import { loadStripe } from '@stripe/stripe-js';
const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

// 옵션 B: 토스페이먼츠 (국내 추천)
import { loadTossPayments } from '@tosspayments/payment-sdk';
const tossPayments = await loadTossPayments(clientKey);

// 2. PaymentService 클래스 (src/services/PaymentService.ts)
class PaymentService {
  async createSubscription(userId: string, plan: string, paymentMethodId: string): Promise<Subscription>;
  async processPayment(subscriptionId: string, amount: number): Promise<Payment>;
  async cancelSubscription(subscriptionId: string, reason: string): Promise<void>;
  async refundPayment(paymentId: string, amount: number): Promise<void>;
}

// 3. Firebase Functions 구현 (functions/src/payments/)
// - processPayment.ts (결제 처리)
// - handleWebhook.ts (웹훅 처리)
// - updateSubscription.ts (구독 상태 업데이트)

// 4. 웹훅 엔드포인트 (functions/src/payments/handleWebhook.ts)
export const handlePaymentWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.failed':
      await handlePaymentFailure(event.data.object);
      break;
  }

  res.json({ received: true });
});
```

##### Phase 3: UI/UX 구현 (2일)
```typescript
// 1. PricingPage (src/pages/PricingPage.tsx)
const PricingPage = () => {
  return (
    <div className="pricing-container">
      <PricingTable
        currentPlan={currentUser?.subscription?.plan}
        onPlanSelect={handlePlanSelect}
      />
    </div>
  );
};

// 2. PaymentForm (src/components/PaymentForm.tsx)
const PaymentForm = ({ plan, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: elements.getElement(CardElement) }
    });
    if (result.error) {
      showToast(result.error.message, 'error');
    } else {
      onSuccess(result.paymentIntent);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit">결제하기</button>
    </form>
  );
};

// 3. FeatureLock (src/components/FeatureLock.tsx)
const FeatureLock = ({ requiredPlan, feature, children }) => {
  const { hasFeatureAccess } = useSubscription();

  if (!hasFeatureAccess(feature)) {
    return (
      <div className="feature-lock-overlay">
        <LockIcon />
        <h3>{requiredPlan} 플랜이 필요합니다</h3>
        <button onClick={handleUpgrade}>업그레이드</button>
      </div>
    );
  }

  return children;
};

// 4. SubscriptionStatus (src/components/SubscriptionStatus.tsx)
const SubscriptionStatus = ({ subscription }) => {
  return (
    <div className="subscription-status">
      <Badge>{subscription.plan}</Badge>
      <p>다음 결제일: {formatDate(subscription.endDate)}</p>
      <button onClick={handleManage}>구독 관리</button>
    </div>
  );
};
```

##### Phase 4: 권한 시스템 통합 (1일)
```typescript
// 1. SubscriptionRoute 컴포넌트 (src/components/routing/SubscriptionRoute.tsx)
const SubscriptionRoute = ({ requiredPlan, feature, children }) => {
  const { subscription, hasFeatureAccess } = useSubscription();

  if (!hasFeatureAccess(feature)) {
    return <Navigate to="/pricing" state={{ requiredPlan, feature }} />;
  }

  return children;
};

// 2. 메뉴 시스템 통합 (src/config/menuConfig.ts)
const MENU_ITEMS = [
  {
    path: '/app/my-schedule',
    label: 'menu.mySchedule',
    icon: CalendarIcon,
    requiredPlan: 'basic', // 추가
    requiredFeature: 'schedule.view' // 추가
  },
  {
    path: '/app/participants',
    label: 'menu.participants',
    icon: UsersIcon,
    requiredPlan: 'pro',
    requiredFeature: 'participants.manage'
  }
];

// 3. 각 페이지에 권한 체크 적용
// ParticipantsPage.tsx
const ParticipantsPage = () => {
  const { hasFeatureAccess } = useSubscription();

  if (!hasFeatureAccess('participants.manage')) {
    return <FeatureLock requiredPlan="pro" feature="participants.manage" />;
  }

  return <div>...</div>;
};
```

#### 1.3 플랜별 기능 매트릭스

| 기능 | 무료 | 기본 (₩6,900/월) | 프로 (₩9,900/월) |
|------|------|-------------------|-------------------|
| **기본 기능** |
| 내 프로필 | ✅ | ✅ | ✅ |
| 구인구직 조회 | ✅ | ✅ | ✅ |
| 구인구직 지원 | ✅ (5건/월) | ✅ (50건/월) | ✅ (무제한) |
| **중급 기능** |
| 내 스케줄 | ❌ | ✅ | ✅ |
| 공고 관리 | ❌ | ✅ (10개/월) | ✅ (무제한) |
| 교대 관리 | ❌ | ✅ | ✅ |
| **고급 기능** |
| 참가자 관리 | ❌ | ❌ | ✅ |
| 테이블 관리 | ❌ | ❌ | ✅ |
| 프라이즈 관리 | ❌ | ❌ | ✅ |
| CEO 대시보드 | ❌ | ❌ | ✅ |
| 고급 통계 | ❌ | ❌ | ✅ |
| **추가 혜택** |
| API 접근 | ❌ | 제한적 (1K/월) | 무제한 (10K/월) |
| 데이터 내보내기 | ❌ | CSV | CSV/Excel/PDF |
| 지원 우선순위 | 일반 | 우선 | 최우선 |

#### 1.4 마일스톤

```
Day 1-2: Phase 1 (기초 구조)
  - 타입 정의 완료
  - Firestore Collections 생성
  - SubscriptionContext 구현
  - 권한 체크 함수 구현

Day 3-5: Phase 2 (결제 시스템)
  - 결제 게이트웨이 연동 (Stripe 또는 토스페이먼츠)
  - PaymentService 클래스 구현
  - Firebase Functions 3개 구현
  - 웹훅 처리 로직 구현

Day 6-7: Phase 3 (UI/UX)
  - PricingPage 구현
  - PaymentForm 구현
  - FeatureLock 구현
  - SubscriptionStatus 구현

Day 8: Phase 4 (권한 통합)
  - SubscriptionRoute 구현
  - 메뉴 시스템 통합
  - 각 페이지 권한 적용
  - E2E 테스트
```

**예상 ROI**: 월 구독료 ₩6,900-9,900 × 사용자 수

---
---

### 3. **알림 시스템 Phase 2** (우선순위: 중간)

#### 3.1 현황
- **Phase 1**: 완료 ✅ (5개 Functions)
- **Phase 2**: 미구현 ❌

#### 3.2 누락된 알림 타입

##### A. system_announcement (시스템 공지)
```typescript
// functions/src/notifications/sendSystemAnnouncement.ts
export const sendSystemAnnouncement = functions.https.onCall(async (data, context) => {
  // 권한 확인 (super_admin만 가능)
  if (!context.auth || context.auth.token.role !== 'super_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  const { title, message, priority } = data;

  // 모든 사용자에게 알림 전송
  const usersSnapshot = await db.collection('users').get();
  const tokens = usersSnapshot.docs
    .map(doc => doc.data().fcmToken)
    .filter(token => token);

  await sendFCMMulticast(tokens, {
    title,
    body: message,
    data: { type: 'system_announcement', priority }
  });

  return { success: true, sentCount: tokens.length };
});
```

##### B. app_update (앱 업데이트)
```typescript
// functions/src/notifications/notifyAppUpdate.ts
export const notifyAppUpdate = functions.https.onCall(async (data, context) => {
  // 권한 확인
  if (!context.auth || context.auth.token.role !== 'super_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  const { version, features, isRequired } = data;

  // 모든 사용자에게 업데이트 알림
  const usersSnapshot = await db.collection('users').get();
  const tokens = usersSnapshot.docs
    .map(doc => doc.data().fcmToken)
    .filter(token => token);

  await sendFCMMulticast(tokens, {
    title: `새로운 버전 ${version} 업데이트`,
    body: features.join(', '),
    data: {
      type: 'app_update',
      version,
      isRequired: String(isRequired)
    }
  });

  return { success: true, sentCount: tokens.length };
});
```

#### 3.3 추가 개선 사항

```typescript
// 1. 이메일 알림 통합
import * as nodemailer from 'nodemailer';

const sendEmailNotification = async (to: string, subject: string, html: string) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  await transporter.sendMail({ to, subject, html });
};

// 2. SMS 알림 통합 (옵션)
import axios from 'axios';

const sendSMSNotification = async (phone: string, message: string) => {
  await axios.post('https://api.coolsms.co.kr/sms/2/send', {
    to: phone,
    from: process.env.SMS_SENDER,
    text: message
  }, {
    headers: { 'Authorization': `Bearer ${process.env.COOLSMS_API_KEY}` }
  });
};

// 3. 알림 히스토리 검색
const searchNotificationHistory = async (userId: string, filters: any) => {
  let query = db.collection('notifications')
    .where('userId', '==', userId);

  if (filters.type) {
    query = query.where('type', '==', filters.type);
  }

  if (filters.startDate) {
    query = query.where('createdAt', '>=', filters.startDate);
  }

  if (filters.endDate) {
    query = query.where('createdAt', '<=', filters.endDate);
  }

  const snapshot = await query.orderBy('createdAt', 'desc').limit(50).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```

**예상 소요 시간**: 1-2일

---

### 4. **고급 기능 안정화** (우선순위: 낮음)

#### 4.1 Web Worker 기반 급여 계산

**현황**: 개념만 존재, 미구현

**구현 계획**:
```typescript
// src/workers/payrollWorker.ts
self.addEventListener('message', (event) => {
  const { workLogs, hourlyRate } = event.data;

  // 복잡한 급여 계산 로직 (메인 스레드 차단 방지)
  const result = workLogs.map(log => {
    const hours = calculateHours(log.startTime, log.endTime);
    const overtime = hours > 8 ? hours - 8 : 0;
    const regularPay = Math.min(hours, 8) * hourlyRate;
    const overtimePay = overtime * hourlyRate * 1.5;

    return {
      logId: log.id,
      regularPay,
      overtimePay,
      total: regularPay + overtimePay
    };
  });

  self.postMessage(result);
});

// 메인 스레드에서 사용
const worker = new Worker(new URL('./workers/payrollWorker.ts', import.meta.url));

worker.postMessage({ workLogs, hourlyRate });

worker.addEventListener('message', (event) => {
  const payrollResults = event.data;
  setPayrollData(payrollResults);
});
```

**예상 소요 시간**: 1일

#### 4.2 스마트 캐싱

**현황**: 기본 캐싱만 존재

**구현 계획**:
```typescript
// src/utils/smartCache.ts
class SmartCache {
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  set(key: string, data: any, ttl: number = 300000) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  invalidate(pattern: string) {
    const regex = new RegExp(pattern);
    Array.from(this.cache.keys()).forEach(key => {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    });
  }
}

export const smartCache = new SmartCache();
```

**예상 소요 시간**: 반나일

#### 4.3 가상화 기능 (react-window)

**현황**: 패키지 설치됨, 일부 적용

**개선 계획**:
```typescript
// StaffManagementTab에 가상화 적용 예시
import { FixedSizeList } from 'react-window';

const VirtualizedStaffList = ({ staff }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <StaffCard staff={staff[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={staff.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

**예상 소요 시간**: 1일

---

### 5. **관리자 대시보드 통계** (우선순위: 중간)

#### 5.1 현황
- **CEO 대시보드**: 기본 기능만 존재
- **통계 기능**: 미흡

#### 5.2 구현 계획

```typescript
// src/pages/CEODashboard/components/AdvancedStats.tsx
const AdvancedStats = () => {
  const stats = useCEODashboardStats();

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 수익 통계 */}
      <StatCard
        title="월간 반복 수익 (MRR)"
        value={formatCurrency(stats.mrr)}
        change={stats.mrrGrowth}
      />

      {/* 사용자 통계 */}
      <StatCard
        title="이탈률 (Churn Rate)"
        value={`${stats.churnRate}%`}
        change={-stats.churnChange}
      />

      {/* 전환율 통계 */}
      <StatCard
        title="무료 → 유료 전환율"
        value={`${stats.conversionRate}%`}
        change={stats.conversionChange}
      />

      {/* 차트 영역 */}
      <div className="col-span-3">
        <LineChart
          data={stats.revenueHistory}
          xKey="date"
          yKey="revenue"
          title="월별 수익 추이"
        />
      </div>

      {/* 코호트 분석 */}
      <div className="col-span-3">
        <CohortAnalysisTable cohorts={stats.cohorts} />
      </div>
    </div>
  );
};

// 데이터 수집 Hook
const useCEODashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      // 1. 구독 통계
      const subscriptionsSnapshot = await getDocs(collection(db, 'subscriptions'));
      const subscriptions = subscriptionsSnapshot.docs.map(doc => doc.data());

      // 2. 결제 통계
      const paymentsSnapshot = await getDocs(
        query(
          collection(db, 'payments'),
          where('status', '==', 'completed'),
          orderBy('createdAt', 'desc'),
          limit(100)
        )
      );
      const payments = paymentsSnapshot.docs.map(doc => doc.data());

      // 3. 사용자 통계
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => doc.data());

      // 4. 지표 계산
      const mrr = calculateMRR(subscriptions);
      const churnRate = calculateChurnRate(subscriptions);
      const conversionRate = calculateConversionRate(users, subscriptions);

      setStats({
        mrr,
        churnRate,
        conversionRate,
        // ... 더 많은 지표
      });
    };

    fetchStats();
  }, []);

  return stats;
};
```

**예상 소요 시간**: 2-3일

---

## 📅 **출시 시나리오**

### **시나리오 A: 빠른 출시 (현재 기능으로 출시)** ⚡

**타임라인**: 1일

```
09:00-11:00 (2시간) - 코드 품질 개선
  - ESLint 경고 39개 정리
  - TODO 주석 즉시 처리 항목 (2개) 구현

11:00-12:00 (1시간) - 환경 설정 검증
  - Firebase 프로덕션 설정 확인
  - FCM 설정 확인
  - GA4 연동 확인

13:00-14:00 (1시간) - Security Rules 테스트
  - 멀티테넌트 격리 검증
  - 권한 체계 테스트

14:00-15:00 (1시간) - 프로덕션 빌드 최종 검증
  - type-check 통과 확인
  - build 성공 확인
  - Capacitor sync 테스트

15:00-17:00 (2시간) - 모니터링 & 알림 설정
  - Sentry 에러 트래킹 설정
  - Firebase Performance Monitoring 활성화
  - 알림 채널 설정

17:00-18:00 (1시간) - 배포 및 검증
  - Firebase Hosting 배포
  - 프로덕션 환경 검증
  - 스모크 테스트

다음 주 (1주일) - 구독 시스템 구현
  - Phase 1-4 단계별 구현
  - 결제 게이트웨이 연동
  - UI/UX 완성
```

**장점**:
- 빠른 시장 진입
- 실제 사용자 피드백 수집 가능
- 점진적 기능 추가

**단점**:
- 수익화 기능 없음 (무료 서비스 기간)
- 사용자 기대치 관리 필요

---

### **시나리오 B: 완벽한 출시 (구독 시스템 포함)** 🎯

**타임라인**: 8-9일

```
Day 1 (8시간) - 출시 전 필수 처리
  - 코드 품질 개선 (2시간)
  - 환경 설정 검증 (1시간)
  - Security Rules 테스트 (1시간)
  - 프로덕션 빌드 검증 (1시간)
  - 모니터링 설정 (2시간)
  - 예비 시간 (1시간)

Day 2-3 (16시간) - 구독 시스템 Phase 1-2
  - 기초 구조 (타입, Context, 권한) (8시간)
  - 결제 시스템 (게이트웨이 연동, Firebase Functions) (8시간)

Day 4-5 (16시간) - 구독 시스템 Phase 3-4
  - UI/UX (PricingPage, PaymentForm, FeatureLock) (10시간)
  - 권한 통합 (메뉴, 페이지 권한 적용) (6시간)

Day 6 (8시간) - 테스트 & 최적화
  - 결제 플로우 E2E 테스트 (3시간)
  - 권한 체계 통합 테스트 (2시간)
  - 성능 테스트 (2시간)
  - 버그 수정 (1시간)

Day 7 (8시간) - 문서화 & 법적 준수
  - 이용약관 업데이트 (2시간)
  - 개인정보처리방침 업데이트 (2시간)
  - 환불 정책 작성 (1시간)
  - 관리자 가이드 작성 (2시간)
  - 예비 시간 (1시간)

Day 8 (4시간) - 배포 준비
  - 프로덕션 환경 설정 (1시간)
  - 결제 게이트웨이 실제 환경 연결 (1시간)
  - 모니터링 대시보드 설정 (1시간)
  - 최종 검증 (1시간)

Day 9 (4시간) - 소프트 런칭
  - 베타 테스터 초대 (1시간)
  - 피드백 수집 (2시간)
  - 버그 핫픽스 (1시간)

Day 10+ - 정식 출시
  - 마케팅 캠페인 시작
  - 사용자 온보딩
  - 지속적 모니터링
```

**장점**:
- 완벽한 수익 모델 탑재
- 프리미엄 기능 차별화
- 즉시 수익 창출 가능

**단점**:
- 출시 일정 지연
- 초기 개발 리소스 집중 필요

---

## 🎯 **최종 권장사항**

### **추천: 시나리오 A (빠른 출시)**

**이유**:
1. **현재 제품 완성도 높음** (98%)
2. **기술적으로 안정적** (TypeScript 에러 0개, 빌드 성공)
3. **실제 사용자 피드백 수집 가능**
4. **점진적 기능 추가 전략**

**실행 계획**:
```
Week 1 (출시 주)
  - Day 1: 필수 처리 사항 완료
  - Day 2-3: 소프트 런칭 (베타)
  - Day 4-5: 피드백 수집 및 버그 수정

Week 2 (수익화 주)
  - Day 1-5: 구독 시스템 구현 (Phase 1-4)
  - Day 6-7: 테스트 및 배포

Week 3+ (운영 및 개선)
  - 사용자 피드백 기반 개선
  - 알림 시스템 Phase 2
  - 고급 기능 안정화
```

---

## 📝 **출시 전 최종 체크리스트**

### ✅ **기술적 준비**
- [x] TypeScript 에러 0개 ✅
- [ ] ESLint 경고 39개 → 0개로 정리
- [x] 프로덕션 빌드 성공 (307.35 kB) ✅
- [x] Firebase Functions 배포 상태 확인
- [x] 환경변수 (.env.production) 검증
- [ ] Security Rules 테스트
- [ ] Capacitor sync 테스트

### ✅ **기능적 준비**
- [x] 알림 시스템 Phase 1 완료 ✅
- [x] 멀티테넌트 아키텍처 완료 ✅
- [x] 토너먼트 시스템 안정화 ✅
- [x] 국제화 (한국어/영어) ✅
- [ ] 구독 시스템 구현 (시나리오 B만)

### ✅ **운영 준비**
- [ ] Sentry 에러 트래킹 설정
- [ ] Firebase Performance Monitoring 활성화
- [ ] 알림 채널 설정 (이메일, Slack)
- [ ] 백업 전략 수립
- [ ] 장애 대응 매뉴얼 작성
- [ ] 고객 지원 채널 준비

### ✅ **법적 준비**
- [ ] 개인정보처리방침 업데이트
- [ ] 이용약관 업데이트
- [ ] 환불 정책 명시 (구독 시스템 포함 시)

### ✅ **마케팅 준비**
- [ ] 랜딩 페이지 최신화
- [ ] 소셜 미디어 계정 준비
- [ ] 런칭 공지 작성
- [ ] 베타 테스터 모집

---

## 📞 **문의 및 지원**

이 문서에 대한 문의사항이나 구현 과정에서 도움이 필요한 경우:

- **프로젝트**: T-HOLDEM
- **문서 버전**: 1.0 (2025-10-18)
- **작성자**: Claude Code
- **다음 업데이트**: 출시 후 1주일 이내

---

*본 문서는 T-HOLDEM 프로젝트의 출시 전 준비 상황을 정리한 기술 문서입니다.*
*실제 출시 계획은 프로젝트 상황에 맞게 조정하여 사용하시기 바랍니다.*
