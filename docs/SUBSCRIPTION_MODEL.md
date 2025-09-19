# T-HOLDEM 수익모델 구현 문서

## 📋 개요

T-HOLDEM 프로젝트의 구독 기반 수익모델 구현을 위한 종합 기술 문서입니다.

### 버전 정보
- 문서 버전: 1.0
- 작성일: 2025-01-20
- 대상 플랫폼: T-HOLDEM v0.2.2

---

## 🎯 구독 플랜 구조

### 플랜별 기능 매트릭스

| 기능 | 무료 | 기본 (월 6,900원) | 프로 (월 9,900원) |
|------|------|-------------------|-------------------|
| **기본 기능** |
| 내 프로필 | ✅ | ✅ | ✅ |
| 구인구직 조회 | ✅ | ✅ | ✅ |
| 구인구직 지원 | ✅ | ✅ | ✅ |
| **중급 기능** |
| 내 스케줄 | ❌ | ✅ | ✅ |
| 공고 관리 | ❌ | ✅ | ✅ |
| 교대 관리 | ❌ | ✅ | ✅ |
| **고급 기능** |
| 참가자 관리 | ❌ | ❌ | ✅ |
| 테이블 관리 | ❌ | ❌ | ✅ |
| 프라이즈 관리 | ❌ | ❌ | ✅ |
| CEO 대시보드 | ❌ | ❌ | ✅ |
| 고급 통계 | ❌ | ❌ | ✅ |
| **추가 혜택** |
| API 접근 | ❌ | 제한적 | 무제한 |
| 데이터 내보내기 | ❌ | CSV | CSV/Excel/PDF |
| 지원 우선순위 | 일반 | 우선 | 최우선 |

### 플랜 전환 규칙
```typescript
const PLAN_TRANSITION_RULES = {
  // 업그레이드: 즉시 적용
  upgrade: {
    immediate: true,
    prorated: true // 비례 계산
  },

  // 다운그레이드: 현재 주기 종료 후
  downgrade: {
    immediate: false,
    effectiveAt: 'currentPeriodEnd'
  },

  // 취소: 현재 주기 종료 후
  cancellation: {
    immediate: false,
    gracePeriod: 3 // 일
  }
};
```

---

## 🛠 기술 스택

### 결제 시스템 옵션

#### 옵션 1: Stripe (권장)
```typescript
// 장점
- 글로벌 결제 지원
- 구독 관리 자동화
- 풍부한 API 및 문서
- 강력한 보안

// 단점
- 한국 카드사 수수료 높음
- 복잡한 초기 설정

// 필요 패키지
"@stripe/stripe-js": "^2.4.0",
"stripe": "^14.11.0",
"@types/stripe": "^8.0.417"
```

#### 옵션 2: 토스페이먼츠
```typescript
// 장점
- 낮은 수수료 (2.9%)
- 한국 시장 최적화
- 간편한 연동

// 단점
- 해외 결제 제한적
- API 문서 부족

// 필요 패키지
"@tosspayments/payment-sdk": "^1.6.0"
```

#### 옵션 3: 아임포트
```typescript
// 장점
- 다양한 PG사 통합
- 한국 결제 수단 다양

// 단점
- 설정 복잡
- 구독 관리 기능 제한적

// 필요 패키지
"iamport-react-native": "^0.9.4"
```

### 추천 선택
**1순위: Stripe** (글로벌 확장성)
**2순위: 토스페이먼츠** (국내 수수료 절약)

---

## 🗄 데이터베이스 스키마

### Firestore 컬렉션 구조

#### 1. subscriptions 컬렉션
```typescript
interface Subscription {
  // 기본 정보
  userId: string;
  plan: 'free' | 'basic' | 'pro';
  status: 'active' | 'cancelled' | 'expired' | 'trial' | 'past_due';

  // 날짜 정보
  startDate: Timestamp;
  endDate: Timestamp;
  trialEndsAt?: Timestamp;
  cancelledAt?: Timestamp;

  // 결제 정보
  autoRenew: boolean;
  paymentMethodId?: string;
  customerId?: string; // Stripe customer ID

  // 메타 정보
  cancelReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 2. payments 컬렉션
```typescript
interface Payment {
  // 연결 정보
  subscriptionId: string;
  userId: string;

  // 금액 정보
  amount: number;
  currency: 'KRW' | 'USD';
  tax?: number;
  discount?: number;
  total: number;

  // 결제 정보
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'card' | 'bank_transfer' | 'virtual_account';
  transactionId: string;
  gatewayTransactionId?: string;

  // 날짜 정보
  createdAt: Timestamp;
  completedAt?: Timestamp;
  failedAt?: Timestamp;
  refundedAt?: Timestamp;

  // 에러 정보
  failureReason?: string;
  errorCode?: string;

  // 환불 정보
  refundAmount?: number;
  refundReason?: string;
}
```

#### 3. invoices 컬렉션
```typescript
interface Invoice {
  // 기본 정보
  subscriptionId: string;
  userId: string;
  invoiceNumber: string;

  // 금액 정보
  subtotal: number;
  tax: number;
  discount: number;
  total: number;

  // 상태 정보
  status: 'draft' | 'sent' | 'paid' | 'void' | 'overdue';

  // 날짜 정보
  issueDate: Timestamp;
  dueDate: Timestamp;
  paidAt?: Timestamp;

  // 아이템 정보
  items: InvoiceItem[];

  // 메타 정보
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}
```

#### 4. promotions 컬렉션
```typescript
interface Promotion {
  // 기본 정보
  code: string;
  name: string;
  description: string;

  // 할인 정보
  type: 'percentage' | 'fixed_amount' | 'trial_extension';
  value: number; // 백분율 또는 금액

  // 유효 기간
  validFrom: Timestamp;
  validUntil: Timestamp;

  // 사용 제한
  usageLimit: number;
  usedCount: number;
  maxUsesPerUser: number;

  // 적용 대상
  applicablePlans: ('basic' | 'pro')[];
  newUsersOnly: boolean;

  // 상태
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 🔌 API 엔드포인트 설계

### Firebase Functions 엔드포인트

#### 구독 관리
```typescript
// 구독 생성
POST /api/subscriptions/create
{
  "userId": "string",
  "plan": "basic" | "pro",
  "paymentMethodId": "string",
  "promoCode?": "string"
}

// 구독 업그레이드
POST /api/subscriptions/upgrade
{
  "subscriptionId": "string",
  "newPlan": "basic" | "pro"
}

// 구독 다운그레이드
POST /api/subscriptions/downgrade
{
  "subscriptionId": "string",
  "newPlan": "basic" | "free",
  "reason?": "string"
}

// 구독 취소
POST /api/subscriptions/cancel
{
  "subscriptionId": "string",
  "reason": "string",
  "immediately": boolean
}

// 구독 상태 조회
GET /api/subscriptions/status/:userId
```

#### 결제 처리
```typescript
// 결제 처리
POST /api/payments/process
{
  "subscriptionId": "string",
  "paymentMethodId": "string",
  "amount": number
}

// 웹훅 처리 (결제 게이트웨이)
POST /api/payments/webhook
{
  "event": "string",
  "data": "object"
}

// 결제 이력 조회
GET /api/payments/history/:userId
{
  "limit?": number,
  "offset?": number
}

// 환불 처리
POST /api/payments/refund
{
  "paymentId": "string",
  "amount": number,
  "reason": "string"
}
```

#### 인보이스 관리
```typescript
// 인보이스 목록 조회
GET /api/invoices/list/:userId
{
  "limit?": number,
  "status?": "string"
}

// 인보이스 상세 조회
GET /api/invoices/:invoiceId

// 인보이스 발송
POST /api/invoices/:invoiceId/send

// 인보이스 다운로드
GET /api/invoices/:invoiceId/download
```

#### 프로모션 관리
```typescript
// 쿠폰 적용
POST /api/promotions/apply
{
  "code": "string",
  "userId": "string",
  "plan": "string"
}

// 쿠폰 유효성 검증
GET /api/promotions/validate/:code
```

---

## 🔒 보안 고려사항

### 결제 보안 체크리스트

#### PCI DSS 컴플라이언스
- [ ] 카드 정보 직접 저장 금지
- [ ] 결제 토큰화 사용
- [ ] HTTPS 필수 적용
- [ ] 데이터 암호화 (AES-256)
- [ ] 정기 보안 스캔
- [ ] 접근 권한 최소화

#### API 보안
- [ ] Rate limiting (사용자당 100req/min)
- [ ] API 키 인증
- [ ] CORS 설정
- [ ] SQL Injection 방어
- [ ] XSS 공격 방어
- [ ] CSRF 토큰 사용

#### 웹훅 보안
- [ ] 서명 검증 (HMAC-SHA256)
- [ ] IP 화이트리스트
- [ ] 타임스탬프 검증
- [ ] 중복 처리 방지
- [ ] 로그 암호화

```typescript
// 웹훅 서명 검증 예시
const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};
```

---

## 🎨 사용자 경험 (UX) 설계

### 구독 플로우

#### 1. 플랜 선택 플로우
```
홈페이지 → 플랜 비교 → 플랜 선택 → 회원가입/로그인
→ 결제 정보 입력 → 확인 → 결제 처리 → 활성화 → 완료
```

#### 2. 업그레이드 플로우
```
잠긴 기능 클릭 → 업그레이드 안내 → 플랜 비교
→ 플랜 선택 → 결제 정보 확인 → 결제 → 즉시 활성화
```

#### 3. 취소 플로우
```
설정 → 구독 관리 → 취소 신청 → 취소 사유 선택
→ 대안 제안 → 최종 확인 → 취소 처리 → 확인 이메일
```

### 필수 UI 컴포넌트

#### PricingTable 컴포넌트
```typescript
interface PricingTableProps {
  currentPlan?: 'free' | 'basic' | 'pro';
  showDiscount?: boolean;
  highlightPlan?: 'basic' | 'pro';
  onPlanSelect: (plan: string) => void;
}
```

#### PaymentForm 컴포넌트
```typescript
interface PaymentFormProps {
  plan: 'basic' | 'pro';
  promoCode?: string;
  onSuccess: (subscription: Subscription) => void;
  onError: (error: PaymentError) => void;
}
```

#### SubscriptionStatus 컴포넌트
```typescript
interface SubscriptionStatusProps {
  subscription: Subscription;
  showBilling?: boolean;
  showUsage?: boolean;
}
```

#### FeatureLock 컴포넌트
```typescript
interface FeatureLockProps {
  requiredPlan: 'basic' | 'pro';
  feature: string;
  description: string;
  onUpgrade: () => void;
}
```

### 모바일 최적화
- 터치 친화적 인터페이스
- 간소화된 결제 플로우
- 카카오페이, 네이버페이 지원
- 반응형 디자인

---

## 🧠 비즈니스 로직

### 구독 정책

```typescript
const SUBSCRIPTION_CONFIG = {
  // 무료 체험
  trial: {
    days: 7,
    availableOnce: true,
    requiresPaymentMethod: true
  },

  // 결제 주기
  billing: {
    cycle: 'monthly',
    gracePeriodDays: 3,
    retryAttempts: 3,
    retryIntervalDays: [1, 3, 7]
  },

  // 업그레이드/다운그레이드
  changes: {
    upgradeImmediate: true,
    downgradeAtEndOfPeriod: true,
    prorationEnabled: true
  },

  // 환불 정책
  refund: {
    allowedDays: 7,
    partialRefundEnabled: true,
    autoRefundLimit: 100000 // KRW
  },

  // 할인 정책
  discounts: {
    yearly: 0.2, // 20% 연간 결제 할인
    bulk: {      // 단체 할인
      5: 0.1,    // 5명 이상 10%
      10: 0.15,  // 10명 이상 15%
      20: 0.2    // 20명 이상 20%
    },
    firstTime: 0.3 // 첫 결제 30% 할인
  }
};
```

### 기능 접근 제어

```typescript
// 권한 매트릭스
const FEATURE_ACCESS_MATRIX = {
  free: [
    'profile.view',
    'profile.edit',
    'jobs.view',
    'jobs.apply'
  ],
  basic: [
    ...FEATURE_ACCESS_MATRIX.free,
    'schedule.view',
    'schedule.edit',
    'jobs.manage',
    'shifts.manage'
  ],
  pro: [
    ...FEATURE_ACCESS_MATRIX.basic,
    'participants.manage',
    'tables.manage',
    'prizes.manage',
    'dashboard.ceo',
    'analytics.advanced',
    'api.unlimited',
    'export.all'
  ]
};

// 기능 체크 함수
const hasFeatureAccess = (
  userPlan: string,
  feature: string
): boolean => {
  return FEATURE_ACCESS_MATRIX[userPlan]?.includes(feature) || false;
};
```

### 사용량 제한

```typescript
const USAGE_LIMITS = {
  free: {
    jobApplications: 5, // 월 지원 건수
    profileViews: 10,   // 월 프로필 조회
    apiCalls: 0
  },
  basic: {
    jobApplications: 50,
    profileViews: 100,
    jobPostings: 10,    // 월 공고 등록
    apiCalls: 1000      // 월 API 호출
  },
  pro: {
    jobApplications: -1,  // 무제한
    profileViews: -1,
    jobPostings: -1,
    apiCalls: 10000
  }
};
```

---

## 📊 분석 및 모니터링

### 핵심 KPI 지표

#### 수익 지표
```typescript
interface RevenueMetrics {
  // 월간 반복 수익
  mrr: number;

  // 연간 반복 수익
  arr: number;

  // 평균 사용자당 매출
  arpu: number;

  // 고객 생애 가치
  ltv: number;

  // 고객 획득 비용
  cac: number;

  // LTV/CAC 비율
  ltvToCacRatio: number;
}
```

#### 사용자 지표
```typescript
interface UserMetrics {
  // 이탈률
  churnRate: number;

  // 전환율
  conversionRate: {
    freeToBasic: number;
    freeToTrial: number;
    trialToPaid: number;
    basicToPro: number;
  };

  // 활성 사용자
  activeUsers: {
    free: number;
    basic: number;
    pro: number;
    trial: number;
  };

  // 결제 실패율
  paymentFailureRate: number;
}
```

### 이벤트 추적

```typescript
// Google Analytics 4 이벤트
const GA4_EVENTS = {
  // 플랜 관련
  'view_pricing': { page: 'pricing' },
  'select_plan': { plan: 'basic|pro' },
  'start_trial': { plan: 'basic|pro' },
  'cancel_trial': { reason: string },

  // 결제 관련
  'begin_checkout': { plan: string, amount: number },
  'add_payment_info': { method: string },
  'purchase': {
    transaction_id: string,
    plan: string,
    amount: number,
    currency: 'KRW'
  },
  'payment_failed': {
    error_code: string,
    plan: string
  },

  // 구독 관리
  'subscription_upgraded': {
    from_plan: string,
    to_plan: string
  },
  'subscription_cancelled': {
    plan: string,
    reason: string
  },

  // 기능 사용
  'feature_locked_clicked': {
    feature: string,
    required_plan: string
  },
  'upgrade_prompt_shown': {
    feature: string,
    context: string
  }
};
```

### 대시보드 지표

#### 실시간 모니터링
- 활성 구독자 수
- 일일 결제 성공/실패 건수
- 서비스 상태 (결제 API 응답시간)
- 오류율 (결제, 구독 변경)

#### 주간 리포트
- MRR 증감
- 신규 구독자 수
- 이탈자 수 및 사유
- 플랜별 분포 변화

#### 월간 분석
- 코호트 분석
- LTV 추이
- CAC 변화
- 프로모션 효과 분석

---

## 🌍 국제화 (i18n)

### 다국어 지원 구조

#### 언어 지원 계획
- **1단계**: 한국어 (ko)
- **2단계**: 영어 (en)
- **3단계**: 일본어 (ja), 중국어 (zh)

#### 번역 키 구조
```typescript
// subscription.json
{
  "subscription": {
    "plans": {
      "free": "무료",
      "basic": "기본",
      "pro": "프로",
      "titles": {
        "free": "무료 플랜",
        "basic": "기본 플랜",
        "pro": "프로 플랜"
      }
    },
    "features": {
      "profile": "내 프로필",
      "jobBoard": "구인구직",
      "schedule": "내 스케줄",
      "jobManagement": "공고 관리",
      "shiftManagement": "교대 관리",
      "participants": "참가자 관리",
      "tables": "테이블 관리",
      "prizes": "프라이즈 관리"
    },
    "billing": {
      "monthly": "월간",
      "yearly": "연간",
      "trial": "무료 체험",
      "upgrade": "업그레이드",
      "downgrade": "다운그레이드",
      "cancel": "취소"
    }
  },
  "payment": {
    "methods": {
      "card": "신용카드",
      "bank": "계좌이체",
      "virtual": "가상계좌"
    },
    "status": {
      "pending": "처리 중",
      "completed": "완료",
      "failed": "실패",
      "refunded": "환불됨"
    },
    "errors": {
      "insufficient_funds": "잔액 부족",
      "expired_card": "카드 만료",
      "invalid_card": "유효하지 않은 카드",
      "network_error": "네트워크 오류"
    }
  }
}
```

#### 통화 및 가격 현지화
```typescript
const PRICING_BY_REGION = {
  KR: {
    currency: 'KRW',
    basic: 6900,
    pro: 9900,
    tax: 0.1 // 10% VAT
  },
  US: {
    currency: 'USD',
    basic: 5.99,
    pro: 8.99,
    tax: 0 // varies by state
  },
  JP: {
    currency: 'JPY',
    basic: 680,
    pro: 980,
    tax: 0.1 // 10% consumption tax
  }
};
```

---

## 🧪 테스트 전략

### 테스트 피라미드

#### 단위 테스트 (Unit Tests)
```typescript
// 구독 상태 계산 로직
describe('Subscription Status Calculator', () => {
  test('should calculate trial remaining days', () => {
    const subscription = {
      status: 'trial',
      trialEndsAt: addDays(new Date(), 3)
    };
    expect(getTrialDaysRemaining(subscription)).toBe(3);
  });

  test('should determine if subscription is active', () => {
    const activeSubscription = {
      status: 'active',
      endDate: addDays(new Date(), 10)
    };
    expect(isSubscriptionActive(activeSubscription)).toBe(true);
  });
});

// 권한 체크 함수
describe('Feature Access Control', () => {
  test('should allow basic plan users to access schedule', () => {
    expect(hasFeatureAccess('basic', 'schedule.view')).toBe(true);
  });

  test('should block free users from advanced features', () => {
    expect(hasFeatureAccess('free', 'participants.manage')).toBe(false);
  });
});

// 가격 계산
describe('Price Calculator', () => {
  test('should apply promo code discount', () => {
    const price = calculatePrice({
      plan: 'basic',
      promoCode: 'WELCOME30',
      region: 'KR'
    });
    expect(price.total).toBe(4830); // 6900 * 0.7
  });
});
```

#### 통합 테스트 (Integration Tests)
```typescript
// 결제 플로우 테스트
describe('Payment Flow Integration', () => {
  test('should create subscription after successful payment', async () => {
    const paymentResult = await processPayment({
      userId: 'test-user',
      plan: 'basic',
      paymentMethodId: 'pm_test_card'
    });

    expect(paymentResult.status).toBe('completed');

    const subscription = await getSubscription(paymentResult.subscriptionId);
    expect(subscription.status).toBe('active');
    expect(subscription.plan).toBe('basic');
  });
});

// 웹훅 처리 테스트
describe('Webhook Processing', () => {
  test('should handle payment success webhook', async () => {
    const webhook = {
      event: 'payment.completed',
      data: { subscriptionId: 'sub_test' }
    };

    await processWebhook(webhook);

    const subscription = await getSubscription('sub_test');
    expect(subscription.status).toBe('active');
  });
});
```

#### E2E 테스트 (End-to-End Tests)
```typescript
// 사용자 구독 여정
describe('User Subscription Journey', () => {
  test('should complete full subscription flow', async () => {
    await page.goto('/pricing');

    // 플랜 선택
    await page.click('[data-testid="basic-plan-button"]');

    // 로그인 (이미 로그인된 상태라고 가정)

    // 결제 정보 입력
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/25');
    await page.fill('[data-testid="card-cvc"]', '123');

    // 결제 버튼 클릭
    await page.click('[data-testid="pay-button"]');

    // 성공 페이지 확인
    await expect(page).toHaveURL('/subscription/success');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // 구독 상태 확인
    await page.goto('/settings/billing');
    await expect(page.locator('[data-testid="current-plan"]')).toContainText('기본 플랜');
  });
});
```

### 테스트 환경 설정

#### 결제 테스트 환경
```typescript
// Stripe 테스트 모드 설정
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

// 테스트 카드 정보
const TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  insufficient_funds: '4000000000009995',
  expired: '4000000000000069'
};
```

#### Mock 서비스
```typescript
// Firebase Functions 로컬 에뮬레이터
const functions = getFunctions(app);
if (process.env.NODE_ENV === 'development') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// 결제 서비스 Mock
jest.mock('../services/PaymentService', () => ({
  processPayment: jest.fn(),
  createCustomer: jest.fn(),
  updateSubscription: jest.fn()
}));
```

### 성능 테스트

#### 로드 테스트 시나리오
```typescript
// 결제 API 부하 테스트
const loadTest = {
  scenarios: {
    payment_processing: {
      executor: 'constant-vus',
      vus: 100, // 동시 사용자 100명
      duration: '5m',
      target: '/api/payments/process'
    },
    subscription_checks: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '1m', target: 0 }
      ],
      target: '/api/subscriptions/status'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%가 500ms 이하
    http_req_failed: ['rate<0.01']    // 실패율 1% 이하
  }
};
```

---

## 🚀 마케팅 및 프로모션

### 프로모션 시스템 설계

#### 쿠폰 타입
```typescript
interface Coupon {
  // 기본 정보
  code: string;
  name: string;
  description: string;

  // 할인 타입
  discountType: 'percentage' | 'fixed_amount' | 'free_trial';
  discountValue: number;

  // 적용 조건
  minimumAmount?: number;
  applicablePlans: ('basic' | 'pro')[];
  firstTimeOnly: boolean;

  // 사용 제한
  usageLimit: number;
  usedCount: number;
  maxUsesPerUser: number;

  // 유효 기간
  validFrom: Date;
  validUntil: Date;

  // 상태
  isActive: boolean;
}
```

#### 마케팅 캠페인 예시
```typescript
const MARKETING_CAMPAIGNS = {
  // 신규 가입자 환영 캠페인
  welcome: {
    trigger: 'user_registered',
    discount: '30%',
    validDays: 7,
    code: 'WELCOME30'
  },

  // 무료 체험 종료 알림
  trial_ending: {
    trigger: 'trial_ends_in_3_days',
    discount: '20%',
    validDays: 3,
    code: 'SAVE20'
  },

  // 업그레이드 유도 캠페인
  upgrade: {
    trigger: 'feature_locked_clicked_3_times',
    discount: '50%',
    validDays: 1,
    code: 'UPGRADE50'
  },

  // 재가입 유도 캠페인
  winback: {
    trigger: 'cancelled_30_days_ago',
    discount: '40%',
    validDays: 14,
    code: 'COMEBACK40'
  }
};
```

### A/B 테스트 설계

#### 테스트 시나리오
```typescript
const AB_TESTS = {
  pricing_page_layout: {
    variants: {
      control: 'current_3_column_layout',
      variant_a: 'horizontal_comparison',
      variant_b: 'feature_focused_layout'
    },
    metrics: ['conversion_rate', 'time_on_page', 'plan_selection'],
    duration: '4_weeks',
    traffic_split: [50, 25, 25]
  },

  trial_length: {
    variants: {
      control: '7_days',
      variant_a: '14_days',
      variant_b: '30_days'
    },
    metrics: ['trial_to_paid_conversion', 'feature_usage'],
    duration: '6_weeks',
    traffic_split: [40, 30, 30]
  },

  payment_form: {
    variants: {
      control: 'single_page_form',
      variant_a: 'multi_step_wizard',
      variant_b: 'inline_validation'
    },
    metrics: ['form_completion_rate', 'payment_success_rate'],
    duration: '3_weeks',
    traffic_split: [50, 25, 25]
  }
};
```

---

## 📋 법적 준수사항

### 필수 문서 및 정책

#### 1. 이용약관 업데이트
```markdown
## 구독 서비스 약관

### 제1조 (구독 서비스)
1. 회사는 유료 구독 기반 서비스를 제공합니다.
2. 구독 플랜별 제공 기능은 별도로 안내합니다.
3. 구독료는 매월 자동으로 청구됩니다.

### 제2조 (결제 및 환불)
1. 결제는 신용카드, 계좌이체 등을 통해 가능합니다.
2. 7일 이내 환불 요청 시 전액 환불됩니다.
3. 부분 사용 시 비례 환불이 적용됩니다.

### 제3조 (구독 변경 및 해지)
1. 언제든지 플랜 변경이 가능합니다.
2. 구독 해지는 현재 결제 주기 종료 후 적용됩니다.
3. 해지 시 데이터는 30일간 보관됩니다.
```

#### 2. 개인정보처리방침 업데이트
```markdown
## 결제 정보 처리

### 수집 항목
- 신용카드 정보 (토큰화하여 저장)
- 결제 이력
- 구독 상태 정보

### 처리 목적
- 구독료 결제 처리
- 결제 이력 관리
- 부정 결제 방지

### 보관 기간
- 결제 정보: 서비스 해지 후 5년
- 결제 이력: 서비스 해지 후 5년
- 구독 정보: 서비스 해지 후 3년
```

#### 3. 자동갱신 고지 의무
```typescript
// 갱신 알림 일정
const RENEWAL_NOTIFICATIONS = {
  // 갱신 7일 전
  first_notice: {
    days_before: 7,
    channels: ['email', 'app_notification'],
    template: 'renewal_reminder_7d'
  },

  // 갱신 1일 전
  final_notice: {
    days_before: 1,
    channels: ['email', 'sms'],
    template: 'renewal_reminder_1d'
  },

  // 갱신 완료 후
  confirmation: {
    days_after: 0,
    channels: ['email'],
    template: 'renewal_confirmation'
  }
};
```

### 국가별 규제 준수

#### 한국 (전자상거래법)
- [ ] 청약철회권 7일 보장
- [ ] 자동갱신 사전 고지 (7일 전)
- [ ] 부당한 결제 유도 금지
- [ ] 환불 규정 명시

#### EU (GDPR)
- [ ] 명시적 동의 획득
- [ ] 개인정보 처리 목적 제한
- [ ] 잊혀질 권리 보장
- [ ] 데이터 포팅 권리 지원

#### 미국 (PCI DSS)
- [ ] 카드 정보 암호화
- [ ] 정기 보안 스캔
- [ ] 접근 권한 관리
- [ ] 보안 사고 대응 체계

---

## ⚡ 성능 최적화

### 캐싱 전략

#### 클라이언트 사이드 캐싱
```typescript
// 구독 상태 캐싱
const CACHE_CONFIG = {
  // 로컬 스토리지 (오프라인 지원)
  localStorage: {
    subscriptionStatus: '1d',     // 1일
    userPlan: '1d',
    paymentMethods: '7d'          // 7일
  },

  // 세션 스토리지 (세션 동안만)
  sessionStorage: {
    checkoutData: 'session',      // 세션 종료시까지
    selectedPlan: 'session',
    promoCode: 'session'
  },

  // 메모리 캐시 (React Query)
  queryCache: {
    subscriptionDetails: '5m',    // 5분
    billingHistory: '10m',        // 10분
    invoices: '30m',              // 30분
    usageStats: '1h'              // 1시간
  }
};
```

#### 서버 사이드 캐싱
```typescript
// Redis 캐싱 전략
const REDIS_CACHE = {
  // 사용자 구독 정보
  'user:subscription:{userId}': {
    ttl: 300, // 5분
    pipeline: true
  },

  // 결제 처리 상태
  'payment:status:{paymentId}': {
    ttl: 3600, // 1시간
    pipeline: false
  },

  // 프로모션 코드 검증
  'promo:validation:{code}': {
    ttl: 86400, // 24시간
    pipeline: false
  },

  // API 응답 캐싱
  'api:response:{endpoint}:{params}': {
    ttl: 1800, // 30분
    pipeline: true
  }
};
```

### 데이터베이스 최적화

#### Firestore 인덱스 설계
```typescript
// 복합 인덱스 (성능 최적화)
const FIRESTORE_INDEXES = [
  // 구독 조회 최적화
  {
    collection: 'subscriptions',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'status', order: 'ASCENDING' },
      { field: 'endDate', order: 'DESCENDING' }
    ]
  },

  // 결제 이력 조회 최적화
  {
    collection: 'payments',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'status', order: 'ASCENDING' },
      { field: 'createdAt', order: 'DESCENDING' }
    ]
  },

  // 인보이스 조회 최적화
  {
    collection: 'invoices',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'status', order: 'ASCENDING' },
      { field: 'dueDate', order: 'ASCENDING' }
    ]
  }
];
```

#### 쿼리 최적화
```typescript
// 배치 처리로 읽기 작업 최적화
const getBillingData = async (userId: string) => {
  const batch = db.batch();

  const subscriptionRef = doc(db, 'subscriptions', userId);
  const paymentsRef = collection(db, 'payments');
  const invoicesRef = collection(db, 'invoices');

  // 병렬 쿼리 실행
  const [subscription, payments, invoices] = await Promise.all([
    getDoc(subscriptionRef),
    getDocs(query(paymentsRef, where('userId', '==', userId), limit(10))),
    getDocs(query(invoicesRef, where('userId', '==', userId), limit(5)))
  ]);

  return {
    subscription: subscription.data(),
    payments: payments.docs.map(doc => doc.data()),
    invoices: invoices.docs.map(doc => doc.data())
  };
};
```

### 프론트엔드 최적화

#### 코드 스플리팅
```typescript
// 페이지별 지연 로딩
const PricingPage = lazy(() => import('./pages/PricingPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const SubscriptionSettings = lazy(() => import('./pages/SubscriptionSettings'));

// 컴포넌트별 지연 로딩
const PaymentForm = lazy(() => import('./components/PaymentForm'));
const InvoiceList = lazy(() => import('./components/InvoiceList'));
```

#### 번들 크기 최적화
```typescript
// 트리 쉐이킹을 위한 imports
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// 불필요한 라이브러리 제외
// ❌ import _ from 'lodash';
// ✅ import debounce from 'lodash/debounce';
```

---

## 🛠 관리자 도구

### 백오피스 대시보드

#### 구독 현황 대시보드
```typescript
interface AdminDashboard {
  // 실시간 지표
  realtime: {
    activeSubscriptions: number;
    todayRevenue: number;
    pendingPayments: number;
    failedPayments: number;
  };

  // 구독 분석
  subscriptions: {
    totalCount: number;
    byPlan: Record<string, number>;
    churnRate: number;
    growthRate: number;
  };

  // 수익 분석
  revenue: {
    mrr: number;
    arr: number;
    revenueGrowth: number;
    averageRevenue: number;
  };

  // 사용자 분석
  users: {
    newSignups: number;
    conversions: number;
    conversionRate: number;
    activeUsers: number;
  };
}
```

#### 사용자별 구독 관리
```typescript
interface UserSubscriptionAdmin {
  // 사용자 정보
  user: {
    id: string;
    email: string;
    name: string;
    registeredAt: Date;
  };

  // 구독 정보
  subscription: {
    plan: string;
    status: string;
    startDate: Date;
    endDate: Date;
    autoRenew: boolean;
  };

  // 결제 이력
  payments: Payment[];

  // 사용량 통계
  usage: {
    features: Record<string, number>;
    apiCalls: number;
    lastActivity: Date;
  };

  // 관리 액션
  actions: {
    changePlan: (plan: string) => Promise<void>;
    cancelSubscription: (reason: string) => Promise<void>;
    refundPayment: (paymentId: string, amount: number) => Promise<void>;
    extendTrial: (days: number) => Promise<void>;
    sendEmail: (template: string) => Promise<void>;
  };
}
```

### 수익 리포팅 시스템

#### 월간 수익 리포트
```typescript
interface MonthlyRevenueReport {
  period: {
    month: number;
    year: number;
  };

  revenue: {
    total: number;
    byPlan: Record<string, number>;
    newSubscriptions: number;
    renewals: number;
    upgrades: number;
    refunds: number;
  };

  subscriptions: {
    new: number;
    cancelled: number;
    netGrowth: number;
    churnRate: number;
  };

  comparisons: {
    previousMonth: number;
    previousYear: number;
    growthRate: number;
  };
}
```

#### 코호트 분석
```typescript
interface CohortAnalysis {
  cohorts: Array<{
    month: string;
    newUsers: number;
    retention: Array<{
      month: number;
      activeUsers: number;
      retentionRate: number;
    }>;
  }>;

  averageRetention: Array<{
    month: number;
    rate: number;
  }>;

  ltvProjection: {
    month1: number;
    month6: number;
    month12: number;
  };
}
```

---

## 🔧 구현 체크리스트

### Phase 1: 기초 구조 (1-2일)
- [ ] 구독 관련 타입 정의 (`types/subscription.ts`)
- [ ] Firebase Collections 설계 및 생성
- [ ] SubscriptionContext 구현
- [ ] useSubscription 훅 구현
- [ ] 기본 권한 체크 함수 구현

### Phase 2: 결제 시스템 (2-3일)
- [ ] 결제 서비스 선택 및 SDK 연동
- [ ] PaymentService 클래스 구현
- [ ] 결제 플로우 UI 구현
- [ ] 웹훅 처리 Firebase Function 구현
- [ ] 결제 성공/실패 처리 로직

### Phase 3: UI/UX 구현 (2일)
- [ ] PricingPage 구현
- [ ] PaymentForm 컴포넌트 구현
- [ ] SubscriptionStatus 컴포넌트 구현
- [ ] FeatureLock 컴포넌트 구현
- [ ] 업그레이드 프롬프트 UI

### Phase 4: 권한 시스템 통합 (1일)
- [ ] RoleBasedRoute 확장 (SubscriptionRoute)
- [ ] 메뉴 시스템에 구독 권한 적용
- [ ] 각 페이지에 권한 체크 적용
- [ ] 잠긴 기능 UI 처리

### Phase 5: 관리 기능 (1-2일)
- [ ] 구독 관리 페이지 구현
- [ ] 결제 이력 페이지 구현
- [ ] 인보이스 생성 및 다운로드
- [ ] 관리자 대시보드 기능

### Phase 6: 테스트 및 최적화 (1일)
- [ ] 단위 테스트 작성
- [ ] E2E 테스트 시나리오 구현
- [ ] 성능 테스트 및 최적화
- [ ] 에러 처리 및 로깅

### Phase 7: 프로덕션 배포 (반나절)
- [ ] 프로덕션 환경 설정
- [ ] 결제 게이트웨이 실제 환경 연결
- [ ] 모니터링 및 알림 설정
- [ ] 소프트 런칭 및 베타 테스트

---

## 📞 문의 및 지원

이 문서에 대한 문의사항이나 구현 과정에서 도움이 필요한 경우:

- **프로젝트 관리자**: T-HOLDEM Development Team
- **문서 버전**: 1.0 (2025-01-20)
- **업데이트 주기**: 분기별 또는 주요 변경사항 발생시

---

*본 문서는 T-HOLDEM 프로젝트의 수익모델 구현을 위한 기술 명세서입니다. 실제 구현 시 프로젝트 상황에 맞게 조정하여 사용하시기 바랍니다.*