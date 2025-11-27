# 💳 T-HOLDEM 결제 시스템 개발 문서

**최종 업데이트**: 2025년 11월 27일
**버전**: v0.2.4 (Production Ready + 구인공고 4타입)
**상태**: 🔧 **개발 중 (57% 완료)**
**프로젝트**: T-HOLDEM 토스페이먼츠 결제 시스템

> ⚠️ **관련 문서**:
> - 📊 **칩 정의 & 가격표**: [MODEL_B_CHIP_SYSTEM_FINAL.md](./MODEL_B_CHIP_SYSTEM_FINAL.md) (마스터 문서)
> - 🔧 **구현 가이드**: [CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md](./CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md)
> - 💰 **수익 분석**: [REVENUE_MODEL_ANALYSIS.md](./REVENUE_MODEL_ANALYSIS.md)

---

## 📑 목차

1. [시스템 개요](#시스템-개요)
2. [아키텍처](#아키텍처)
3. [데이터 모델](#데이터-모델)
4. [API 명세](#api-명세)
5. [결제 플로우](#결제-플로우)
6. [보안](#보안)
7. [칩 시스템](#칩-시스템)
8. [환불 시스템](#환불-시스템)
9. [구독 시스템](#구독-시스템)
10. [알림 시스템](#알림-시스템)
11. [배포 가이드](#배포-가이드)
12. [문제 해결](#문제-해결)

---

## 🎯 시스템 개요

### 목적

T-HOLDEM 플랫폼에서 **칩 충전 결제** 및 **구독 서비스** 제공을 위한 통합 결제 시스템

### 주요 기능

- ✅ **칩 충전**: 토스페이먼츠를 통한 빨간칩 구매
- ✅ **구독 플랜**: 월 정기 파란칩 지급 (Free/Standard/Pro)
- ✅ **칩 관리**: 칩 지급, 차감, 만료 처리
- ✅ **환불 시스템**: 7일 이내 환불 요청 및 승인
- ✅ **영수증 발급**: HTML/이메일 영수증 제공
- ✅ **인증 시스템**: 전화번호/이메일 인증
- ✅ **보안**: Rate Limiting, 시그니처 검증, 남용 탐지

### 기술 스택

```typescript
// Frontend
React 18.2 + TypeScript 4.9
TailwindCSS 3.3
Zustand 5.0 (상태 관리)
React Router 6.x

// Backend
Firebase Cloud Functions (Node.js 18)
Firebase Firestore (NoSQL)
Firebase Authentication
Cloud Scheduler (Cron Jobs)

// Payment Gateway
토스페이먼츠 API v1
```

---

## 🏗️ 아키텍처

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                      사용자 (Browser)                        │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   React App (Frontend)                       │
│  - ChipRechargePackages (패키지 선택)                        │
│  - PaymentTermsPage (약관 동의)                              │
│  - TossPaymentCheckout (결제 위젯)                           │
│  - PaymentSuccessPage (결제 완료)                            │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Firebase SDK
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions (Backend)              │
│                                                               │
│  [결제]                                                       │
│  - confirmPayment()        결제 승인                          │
│  - manualGrantChips()      수동 칩 지급                       │
│                                                               │
│  [환불]                                                       │
│  - refundPayment()         환불 요청                          │
│  - approveRefund()         환불 승인                          │
│  - rejectRefund()          환불 거부                          │
│                                                               │
│  [구독]                                                       │
│  - grantMonthlyBlueChips() 월 칩 지급 (Cron)                 │
│                                                               │
│  [Scheduled]                                                  │
│  - expireChips()           칩 만료 처리 (매일 00:00)          │
│  - chipExpiryNotification() 만료 알림 (매일 09:00)           │
│                                                               │
│  [인증]                                                       │
│  - sendPhoneVerificationCode() 전화번호 인증 코드 발송        │
│  - verifyPhoneCode()       인증 코드 확인                     │
│                                                               │
│  [영수증]                                                     │
│  - sendReceiptEmail()      영수증 이메일 발송                 │
└────────────┬───────────────────────────┬────────────────────┘
             │                           │
             │                           │ API Call
             ▼                           ▼
┌──────────────────────┐    ┌────────────────────────────────┐
│  Firebase Firestore  │    │   토스페이먼츠 API              │
│  - users/            │    │   - POST /confirm              │
│  - chipBalance/      │    │   - POST /refund               │
│  - chipTransactions/ │    │                                │
│  - paymentTransactions/   │                                │
│  - refundRequests/   │    │                                │
│  - subscriptions/    │    │                                │
└──────────────────────┘    └────────────────────────────────┘
```

### 디렉토리 구조

```
T-HOLDEM-payment/
├── app2/                           # Frontend (React)
│   ├── src/
│   │   ├── components/
│   │   │   ├── payment/
│   │   │   │   ├── ChipBalance.tsx              # 칩 잔액 표시
│   │   │   │   ├── ChipRechargePackages.tsx     # 패키지 선택
│   │   │   │   ├── TossPaymentCheckout.tsx      # 결제 위젯
│   │   │   │   ├── PaymentStepIndicator.tsx     # 결제 단계 표시
│   │   │   │   └── ReceiptActions.tsx           # 영수증 액션
│   │   │   └── auth/
│   │   │       ├── PhoneVerification.tsx        # 전화번호 인증
│   │   │       └── EmailVerification.tsx        # 이메일 인증
│   │   ├── pages/
│   │   │   ├── payment/
│   │   │   │   ├── PaymentTermsPage.tsx         # 약관 동의
│   │   │   │   ├── PaymentSuccessPage.tsx       # 결제 완료
│   │   │   │   ├── PaymentFailPage.tsx          # 결제 실패
│   │   │   │   └── PaymentHistoryPage.tsx       # 결제 내역
│   │   │   ├── subscription/
│   │   │   │   └── SubscriptionPage.tsx         # 구독 플랜
│   │   │   ├── chip/
│   │   │   │   └── ChipHistoryPage.tsx          # 칩 사용 내역
│   │   │   ├── admin/
│   │   │   │   ├── ChipManagementPage.tsx       # 칩 관리
│   │   │   │   └── RefundBlacklistPage.tsx      # 환불 블랙리스트
│   │   │   └── settings/
│   │   │       └── VerificationSettingsPage.tsx # 인증 설정
│   │   ├── contexts/
│   │   │   └── ChipContext.tsx                  # 칩 상태 관리
│   │   ├── types/
│   │   │   ├── payment/
│   │   │   │   ├── chip.ts                      # 칩 타입
│   │   │   │   ├── subscription.ts              # 구독 타입
│   │   │   │   └── receipt.ts                   # 영수증 타입
│   │   │   └── auth/
│   │   │       └── verification.ts              # 인증 타입
│   │   └── utils/
│   │       └── receiptGenerator.ts              # 영수증 생성
│   └── .env.local                               # 환경변수 (Client Key)
│
├── functions/                      # Backend (Firebase Functions)
│   ├── src/
│   │   ├── payment/
│   │   │   ├── confirmPayment.ts                # 결제 승인 ✅
│   │   │   ├── grantChips.ts                    # 칩 지급 ✅
│   │   │   ├── refundPayment.ts                 # 환불 처리 ✅
│   │   │   └── verifySignature.ts               # 시그니처 검증 ✅
│   │   ├── subscription/
│   │   │   └── grantBlueChips.ts                # 구독 칩 지급 ✅
│   │   ├── scheduled/
│   │   │   ├── expireChips.ts                   # 칩 만료 처리 ✅
│   │   │   └── cleanupRateLimits.ts             # Rate Limit 정리 ✅
│   │   ├── notifications/
│   │   │   └── chipExpiryNotification.ts        # 칩 만료 알림 ✅
│   │   ├── email/
│   │   │   └── sendReceipt.ts                   # 영수증 이메일 ✅
│   │   ├── auth/
│   │   │   └── phoneVerification.ts             # 전화번호 인증 ✅
│   │   ├── middleware/
│   │   │   └── rateLimiter.ts                   # Rate Limiting ✅
│   │   └── index.ts                             # Functions Export
│   └── .env                                     # 환경변수 (Secret Key)
│
├── docs/
│   └── PAYMENT_SYSTEM_DEVELOPMENT.md           # 이 문서
│
└── PAYMENT_SYSTEM_CHECKLIST.md                # 진행 상황 체크리스트
```

---

## 📊 데이터 모델

### Firestore 컬렉션 구조

#### 1. users/{userId}/chipBalance/current

**칩 잔액 정보**

```typescript
{
  userId: string;
  redChips: number;        // 빨간칩 (유료)
  blueChips: number;       // 파란칩 (구독)
  redChipExpiry: Timestamp;  // 빨간칩 만료일 (구매일 + 1년)
  blueChipExpiry: Timestamp; // 파란칩 만료일 (다음 달 1일)
  lastUpdated: Timestamp;
}
```

**예시**:
```json
{
  "userId": "abc123",
  "redChips": 50,
  "blueChips": 30,
  "redChipExpiry": "2026-01-23T00:00:00Z",
  "blueChipExpiry": "2025-02-01T00:00:00Z",
  "lastUpdated": "2025-01-24T10:30:00Z"
}
```

#### 2. users/{userId}/chipTransactions/{transactionId}

**칩 거래 내역**

```typescript
{
  id: string;
  userId: string;
  type: 'grant' | 'purchase' | 'use' | 'expire' | 'refund';
  chipType: 'red' | 'blue';
  amount: number;            // 증감 칩 수량
  balance: number;           // 거래 후 잔액
  reason: string;
  metadata?: {
    orderId?: string;        // 결제 주문번호
    packageId?: string;      // 패키지 ID
    subscriptionId?: string; // 구독 ID
  };
  createdAt: Timestamp;
}
```

**예시**:
```json
{
  "id": "tx_abc123",
  "userId": "abc123",
  "type": "purchase",
  "chipType": "red",
  "amount": 50,
  "balance": 50,
  "reason": "빨간칩 50개 패키지 구매",
  "metadata": {
    "orderId": "ORD_abc123_pkg2_1737689400000",
    "packageId": "pkg2"
  },
  "createdAt": "2025-01-24T10:30:00Z"
}
```

#### 3. paymentTransactions/{transactionId}

**결제 거래 내역**

```typescript
{
  id: string;
  userId: string;
  orderId: string;           // ORD_{userId}_{packageId}_{timestamp}
  paymentKey: string;        // 토스페이먼츠 결제 키
  packageId: string;
  amount: number;            // 결제 금액
  chipAmount: number;        // 지급된 칩 수량
  chipType: 'red' | 'blue';
  status: 'pending' | 'success' | 'failed';
  method?: string;           // 결제 수단 (카드/계좌이체/가상계좌)
  approvedAt?: Timestamp;
  createdAt: Timestamp;
}
```

**예시**:
```json
{
  "id": "pay_abc123",
  "userId": "abc123",
  "orderId": "ORD_abc123_pkg2_1737689400000",
  "paymentKey": "tgen_abc123xyz",
  "packageId": "pkg2",
  "amount": 5500,
  "chipAmount": 50,
  "chipType": "red",
  "status": "success",
  "method": "카드",
  "approvedAt": "2025-01-24T10:30:00Z",
  "createdAt": "2025-01-24T10:29:00Z"
}
```

#### 4. refundRequests/{requestId}

**환불 요청 내역**

```typescript
{
  id: string;
  userId: string;
  transactionId: string;     // 원본 결제 거래 ID
  orderId: string;
  paymentKey: string;
  amount: number;            // 결제 금액
  refundAmount: number;      // 실제 환불 금액 (수수료 차감 후)
  chipAmount: number;        // 회수할 칩 수량
  reason: string;            // 환불 사유
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes?: string;
  processedBy?: string;      // 처리한 관리자 ID
  processedAt?: Timestamp;
  createdAt: Timestamp;
}
```

**예시**:
```json
{
  "id": "refund_abc123",
  "userId": "abc123",
  "transactionId": "pay_abc123",
  "orderId": "ORD_abc123_pkg2_1737689400000",
  "paymentKey": "tgen_abc123xyz",
  "amount": 5500,
  "refundAmount": 4400,
  "chipAmount": 50,
  "reason": "단순 변심",
  "status": "approved",
  "adminNotes": "승인",
  "processedBy": "admin_xyz",
  "processedAt": "2025-01-25T14:00:00Z",
  "createdAt": "2025-01-25T10:00:00Z"
}
```

#### 5. subscriptions/{subscriptionId}

**구독 정보**

```typescript
{
  id: string;
  userId: string;
  planType: 'free' | 'standard' | 'pro';
  status: 'active' | 'cancelled' | 'expired';
  monthlyChips: number;      // 월 지급 칩 수량
  price: number;             // 월 구독료
  autoRenew: boolean;
  lastChipGrantMonth?: string;  // "2025-01" (중복 지급 방지)
  startedAt: Timestamp;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**예시**:
```json
{
  "id": "sub_abc123",
  "userId": "abc123",
  "planType": "standard",
  "status": "active",
  "monthlyChips": 30,
  "price": 5500,
  "autoRenew": true,
  "lastChipGrantMonth": "2025-01",
  "startedAt": "2025-01-01T00:00:00Z",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-24T10:00:00Z"
}
```

#### 6. users/{userId}/receipts/{orderId}

**영수증 발송 기록**

```typescript
{
  id: string;
  userId: string;
  type: 'payment' | 'subscription' | 'refund';
  orderId: string;
  amount: number;
  emailSent: boolean;
  emailSentAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 7. phoneVerifications/{verificationId}

**전화번호 인증 기록**

```typescript
{
  userId: string;
  phoneNumber: string;
  verificationCode: string;  // 6자리
  status: 'pending' | 'verified' | 'failed' | 'expired';
  attempts: number;          // 시도 횟수
  maxAttempts: number;       // 3회
  expiresAt: Timestamp;      // 발송 후 5분
  verifiedAt?: Timestamp;
  createdAt: Timestamp;
}
```

---

## 🔌 API 명세

### 1. confirmPayment

**결제 승인 및 칩 지급**

```typescript
// Request
{
  orderId: string;      // ORD_{userId}_{packageId}_{timestamp}
  paymentKey: string;   // 토스페이먼츠 결제 키
  amount: number;       // 결제 금액
}

// Response
{
  success: boolean;
  message: string;
  chipBalance: {
    redChips: number;
    blueChips: number;
  };
}

// Error Codes
- unauthenticated: 로그인 필요
- invalid-argument: 필수 파라미터 누락
- permission-denied: 본인 결제 아님
- already-exists: 중복 결제
- failed-precondition: 금액 불일치
- internal: 서버 에러
```

**호출 예시**:
```typescript
const confirmPayment = httpsCallable(functions, 'confirmPayment');
const result = await confirmPayment({
  orderId: 'ORD_abc123_pkg2_1737689400000',
  paymentKey: 'tgen_abc123xyz',
  amount: 5500,
});
```

### 2. manualGrantChips

**관리자 수동 칩 지급**

```typescript
// Request
{
  userId: string;
  chipType: 'red' | 'blue';
  amount: number;
  reason: string;
}

// Response
{
  success: boolean;
  message: string;
  transaction: ChipTransaction;
}

// 권한: admin만 호출 가능
```

### 3. refundPayment

**환불 요청**

```typescript
// Request
{
  orderId: string;
  reason: string;
}

// Response
{
  success: boolean;
  message: string;
  refundRequestId: string;
}

// 제한사항
- 결제 후 7일 이내
- 월 1회, 연 3회 한도
- 블랙리스트 제외
```

### 4. approveRefund / rejectRefund

**환불 승인/거부 (관리자)**

```typescript
// Request
{
  refundRequestId: string;
  adminNotes?: string;
}

// Response
{
  success: boolean;
  message: string;
}

// 권한: admin만 호출 가능
```

### 5. sendPhoneVerificationCode

**전화번호 인증 코드 발송**

```typescript
// Request
{
  phoneNumber: string;  // "010-1234-5678"
  userId: string;
}

// Response
{
  success: boolean;
  message: string;
  expiresIn: number;    // 300 (5분)
  code?: string;        // 개발 환경에서만
}

// 제한사항
- 1분 쿨다운
- 중복 전화번호 방지
```

### 6. verifyPhoneCode

**전화번호 인증 코드 확인**

```typescript
// Request
{
  phoneNumber: string;
  code: string;         // "123456"
  userId: string;
}

// Response
{
  success: boolean;
  message: string;
  phoneNumber: string;
}

// 제한사항
- 3회 시도 제한
- 5분 만료
```

### 7. sendReceiptEmail

**영수증 이메일 발송**

```typescript
// Request
{
  orderId: string;
  userId: string;
  receiptType: 'payment' | 'subscription' | 'refund';
}

// Response
{
  success: boolean;
  message: string;
  email: string;
}
```

---

## 🔄 결제 플로우

### 전체 흐름도

```
[사용자] → 패키지 선택 → 약관 동의 → 결제 정보 입력 → 결제 승인 → 칩 지급 → 완료
   ↓           ↓            ↓              ↓             ↓          ↓         ↓
[UI]    ChipRecharge  PaymentTerms  TossPayment    Success     ChipBalance  Success
        Packages      Page          Checkout       Page        Update       Page
```

### 단계별 상세

#### Step 1: 패키지 선택

**컴포넌트**: `ChipRechargePackages.tsx`

```typescript
// 패키지 정의 (CHIP_PACKAGES)
const CHIP_PACKAGES = [
  { id: 'pkg1', name: '빨간칩 10개', amount: 10, price: 1100 },
  { id: 'pkg2', name: '빨간칩 50개', amount: 50, price: 5500 },
  { id: 'pkg3', name: '빨간칩 100개', amount: 100, price: 11000, bonus: 10 },
  { id: 'pkg4', name: '빨간칩 500개', amount: 500, price: 55000, bonus: 100 },
];

// 선택 후 이동
navigate('/payment/terms', { state: { selectedPackage } });
```

#### Step 2: 약관 동의

**컴포넌트**: `PaymentTermsPage.tsx`

```typescript
// 필수 약관
const requiredTerms = [
  'termsOfService',      // 결제 약관
  'refundPolicy',        // 환불 정책
  'privacyPolicy',       // 개인정보 수집 및 이용
];

// 선택 약관
const optionalTerms = [
  'marketingConsent',    // 마케팅 수신 동의
];

// 모두 동의 후 이동
navigate('/chip/recharge', { state: { selectedPackage, consents } });
```

#### Step 3: 결제 정보 입력

**컴포넌트**: `TossPaymentCheckout.tsx`

```typescript
// 토스페이먼츠 SDK 초기화
const clientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;
const tossPayments = await loadTossPayments(clientKey);

// 결제 위젯 렌더링
await tossPayments.requestPayment('카드', {
  amount: selectedPackage.price,
  orderId: `ORD_${userId}_${packageId}_${Date.now()}`,
  orderName: selectedPackage.name,
  customerName: currentUser.displayName,
  customerEmail: currentUser.email,
  successUrl: `${window.location.origin}/payment/success`,
  failUrl: `${window.location.origin}/payment/fail`,
});
```

#### Step 4: 결제 승인

**컴포넌트**: `PaymentSuccessPage.tsx`

```typescript
// URL 파라미터 추출
const searchParams = new URLSearchParams(window.location.search);
const orderId = searchParams.get('orderId');
const paymentKey = searchParams.get('paymentKey');
const amount = searchParams.get('amount');

// Cloud Function 호출
const confirmPayment = httpsCallable(functions, 'confirmPayment');
const result = await confirmPayment({ orderId, paymentKey, amount });

// 성공 시 칩 잔액 자동 업데이트 (ChipContext)
```

#### Step 5: 칩 지급

**Cloud Function**: `confirmPayment.ts`

```typescript
// 1. 토스페이먼츠 API 호출
const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ orderId, paymentKey, amount }),
});

// 2. Firestore 트랜잭션으로 칩 지급
await db.runTransaction(async (transaction) => {
  const balanceRef = db.collection('users').doc(userId).collection('chipBalance').doc('current');
  const balanceDoc = await transaction.get(balanceRef);

  const currentBalance = balanceDoc.data() || { redChips: 0, blueChips: 0 };
  const newRedChips = currentBalance.redChips + chipAmount;

  transaction.set(balanceRef, {
    redChips: newRedChips,
    redChipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1년
    lastUpdated: FieldValue.serverTimestamp(),
  }, { merge: true });

  // 거래 내역 기록
  transaction.set(transactionRef, {
    userId, type: 'purchase', chipType: 'red', amount: chipAmount,
    balance: newRedChips, reason: `${packageName} 구매`, createdAt: FieldValue.serverTimestamp(),
  });
});
```

---

## 🔒 보안

### 1. 시그니처 검증

**파일**: `functions/src/payment/verifySignature.ts`

```typescript
// HMAC-SHA256 시그니처 검증
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secretKey: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  return hash === signature;
}
```

### 2. Rate Limiting

**파일**: `functions/src/middleware/rateLimiter.ts`

```typescript
// IP 기반 Rate Limiting
const RATE_LIMITS = {
  confirmPayment: { maxRequests: 5, windowMs: 60000 },  // 1분에 5회
  refundPayment: { maxRequests: 3, windowMs: 300000 },  // 5분에 3회
};

// 남용 패턴 감지
function detectAbusePattern(userId: string, action: string): number {
  // 위험도 점수 계산 (0.0 ~ 1.0)
  // 0.7 이상 시 차단
}
```

### 3. 금액 검증

```typescript
// 서버 측 금액 검증
const expectedAmount = CHIP_PACKAGES[packageId].price;
if (amount !== expectedAmount) {
  throw new functions.https.HttpsError(
    'failed-precondition',
    '금액이 일치하지 않습니다.'
  );
}
```

### 4. 본인 확인

```typescript
// orderId에서 userId 추출 후 검증
const orderUserId = extractUserIdFromOrderId(orderId);
if (context.auth.uid !== orderUserId) {
  throw new functions.https.HttpsError(
    'permission-denied',
    '본인의 결제만 승인할 수 있습니다.'
  );
}
```

### 5. 중복 결제 방지

```typescript
// orderId 유니크 체크
const existingPayment = await db
  .collection('paymentTransactions')
  .where('orderId', '==', orderId)
  .limit(1)
  .get();

if (!existingPayment.empty) {
  throw new functions.https.HttpsError(
    'already-exists',
    '이미 처리된 결제입니다.'
  );
}
```

---

## 🎰 칩 시스템

### 칩 종류

| 칩 종류 | 획득 방법 | 만료 기간 | 용도 |
|---------|----------|----------|------|
| **빨간칩** (redChips) | 유료 구매 | 구매일 + 1년 | 토너먼트 참가 |
| **파란칩** (blueChips) | 구독 (월 지급) | 다음 달 1일 | 토너먼트 참가 |

### 칩 사용 우선순위

**파란칩 → 빨간칩** 순서로 차감

```typescript
// 칩 차감 로직
function deductChips(userId: string, amount: number) {
  const balance = getCurrentBalance(userId);

  if (balance.blueChips >= amount) {
    // 파란칩만 차감
    balance.blueChips -= amount;
  } else if (balance.blueChips + balance.redChips >= amount) {
    // 파란칩 전부 + 빨간칩 일부 차감
    const remaining = amount - balance.blueChips;
    balance.blueChips = 0;
    balance.redChips -= remaining;
  } else {
    // 잔액 부족
    throw new Error('칩이 부족합니다.');
  }
}
```

### 칩 만료 처리

**Scheduled Function**: `expireChips` (매일 00:00 실행)

```typescript
// 빨간칩 만료 (구매일 + 1년)
const now = new Date();
const usersSnapshot = await db
  .collection('users')
  .where('chipBalance.redChipExpiry', '<=', now)
  .get();

for (const userDoc of usersSnapshot.docs) {
  await db.runTransaction(async (transaction) => {
    // 빨간칩 0으로 설정
    // 만료 트랜잭션 기록 생성
  });
}

// 파란칩 만료 (다음 달 1일)
const nextMonthFirstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
if (now >= nextMonthFirstDay) {
  // 모든 사용자의 파란칩 0으로 설정
}
```

### 칩 만료 알림

**Scheduled Function**: `chipExpiryNotification` (매일 09:00 실행)

```typescript
// 30일 전, 7일 전, 3일 전, 당일 알림
const thresholds = [30, 7, 3, 0];

for (const days of thresholds) {
  const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // 해당 날짜에 만료되는 사용자 조회
  const usersSnapshot = await db
    .collection('users')
    .where('chipBalance.redChipExpiry', '>=', startOfDay(targetDate))
    .where('chipBalance.redChipExpiry', '<', endOfDay(targetDate))
    .get();

  // 알림 발송
  for (const userDoc of usersSnapshot.docs) {
    await db.collection('notifications').add({
      userId: userDoc.id,
      type: 'finance',
      title: `칩 만료 ${days}일 전 알림`,
      message: `${userDoc.data().chipBalance.redChips}개의 빨간칩이 ${days}일 후 만료됩니다.`,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}
```

---

## 💸 환불 시스템

### 환불 정책

- ✅ **기간**: 결제 후 7일 이내
- ✅ **수수료**: 20% (부분 사용 시)
- ✅ **한도**: 월 1회, 연 3회
- ✅ **제외**: 블랙리스트, 전액 사용

### 환불 플로우

```
[사용자] → 환불 요청 → [관리자] → 승인/거부 → 토스 API 호출 → 칩 회수 → 완료
   ↓           ↓            ↓           ↓              ↓            ↓         ↓
[UI]    Refund      refundPayment  ChipManagement  approveRefund  Transaction Success
        Button      Function       Page            Function       Record
```

### 환불 수수료 계산

```typescript
function calculateRefundAmount(
  originalAmount: number,
  totalChips: number,
  usedChips: number
): number {
  if (usedChips === 0) {
    // 전액 환불
    return originalAmount;
  } else {
    // 부분 환불 (20% 수수료)
    const usageRate = usedChips / totalChips;
    const refundableAmount = originalAmount * (1 - usageRate);
    return Math.floor(refundableAmount * 0.8);
  }
}
```

### 환불 한도 검증

```typescript
async function checkRefundLimit(userId: string): Promise<boolean> {
  const now = new Date();

  // 월 1회 체크
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRefunds = await db
    .collection('refundRequests')
    .where('userId', '==', userId)
    .where('createdAt', '>=', monthStart)
    .where('status', '==', 'completed')
    .get();

  if (monthlyRefunds.size >= 1) return false;

  // 연 3회 체크
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearlyRefunds = await db
    .collection('refundRequests')
    .where('userId', '==', userId)
    .where('createdAt', '>=', yearStart)
    .where('status', '==', 'completed')
    .get();

  if (yearlyRefunds.size >= 3) return false;

  return true;
}
```

---

## 📅 구독 시스템

### 구독 플랜

| 플랜 | 가격 | 월 지급 칩 | 특징 |
|------|------|-----------|------|
| **Free** | 0원 | 파란칩 5개 | 기본 플랜 |
| **Standard** | 5,500원 | 파란칩 30개 | 인기 플랜 |
| **Pro** | 14,900원 | 파란칩 80개 | 최고 가성비 |

### 월 칩 지급 로직

**Scheduled Function**: `grantMonthlyBlueChips` (매월 1일 00:00 실행)

```typescript
// 1. 활성 구독 조회
const subscriptionsSnapshot = await db
  .collection('subscriptions')
  .where('status', '==', 'active')
  .where('autoRenew', '==', true)
  .get();

// 2. 중복 지급 방지
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

for (const subscriptionDoc of subscriptionsSnapshot.docs) {
  const subscription = subscriptionDoc.data();

  if (subscription.lastChipGrantMonth === currentMonth) {
    continue; // 이미 지급됨
  }

  // 3. Firestore 트랜잭션으로 칩 지급
  await db.runTransaction(async (transaction) => {
    const balanceRef = db.collection('users').doc(subscription.userId)
      .collection('chipBalance').doc('current');

    const balanceDoc = await transaction.get(balanceRef);
    const currentBalance = balanceDoc.data() || { blueChips: 0 };

    transaction.set(balanceRef, {
      blueChips: currentBalance.blueChips + subscription.monthlyChips,
      blueChipExpiry: getNextMonthFirstDay(),
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 4. 구독 문서 업데이트
    transaction.update(subscriptionDoc.ref, {
      lastChipGrantMonth: currentMonth,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
```

---

## 🔔 알림 시스템

### 알림 타입

| 타입 | 제목 예시 | 용도 |
|------|----------|------|
| `finance` | "칩 만료 7일 전 알림" | 칩 만료, 결제 완료 |
| `system` | "환불 요청이 승인되었습니다" | 환불 승인/거부 |

### 알림 발송

```typescript
// Firestore에 알림 문서 추가
await db.collection('notifications').add({
  userId: 'abc123',
  type: 'finance',
  title: '칩 만료 7일 전 알림',
  message: '50개의 빨간칩이 7일 후 만료됩니다.',
  isRead: false,
  createdAt: FieldValue.serverTimestamp(),
});

// 프론트엔드에서 실시간 구독
const unsubscribe = onSnapshot(
  query(
    collection(db, 'notifications'),
    where('userId', '==', currentUser.uid),
    orderBy('createdAt', 'desc')
  ),
  (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setNotifications(notifications);
  }
);
```

---

## 🚀 배포 가이드

### 1. 환경 변수 설정

#### Frontend (.env.local)
```bash
# 토스페이먼츠 Client Key
REACT_APP_TOSS_CLIENT_KEY=test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq

# Firebase Config (자동 생성됨)
REACT_APP_FIREBASE_API_KEY=...
```

#### Backend (Firebase Functions Config)
```bash
# 토스페이먼츠 Secret Key 설정
firebase functions:config:set toss.secret_key="test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R"

# 확인
firebase functions:config:get
```

### 2. Cloud Scheduler 배포

```bash
# 칩 만료 처리 (매일 00:00)
gcloud scheduler jobs create pubsub expireChips \
  --schedule="0 0 * * *" \
  --time-zone="Asia/Seoul" \
  --topic="expire-chips" \
  --message-body="{}"

# 칩 만료 알림 (매일 09:00)
gcloud scheduler jobs create pubsub chipExpiryNotification \
  --schedule="0 9 * * *" \
  --time-zone="Asia/Seoul" \
  --topic="chip-expiry-notification" \
  --message-body="{}"

# 월 칩 지급 (매월 1일 00:00)
gcloud scheduler jobs create pubsub grantMonthlyBlueChips \
  --schedule="0 0 1 * *" \
  --time-zone="Asia/Seoul" \
  --topic="grant-monthly-blue-chips" \
  --message-body="{}"

# 확인
gcloud scheduler jobs list
```

### 3. Functions 배포

```bash
cd functions

# 타입 체크
npm run type-check

# 린트
npm run lint

# 배포
npm run deploy

# 특정 함수만 배포
firebase deploy --only functions:confirmPayment
firebase deploy --only functions:refundPayment
firebase deploy --only functions:expireChips
```

### 4. Firestore Security Rules 배포

```bash
firebase deploy --only firestore:rules
```

### 5. Frontend 배포

```bash
cd app2

# 빌드
npm run build

# 배포
firebase deploy --only hosting
```

---

## 🛠️ 문제 해결

### 1. 결제 승인 실패

**증상**: `confirmPayment` 호출 시 에러

**원인**:
- 토스페이먼츠 Secret Key 미설정
- 금액 불일치
- 중복 결제

**해결**:
```bash
# 1. Secret Key 확인
firebase functions:config:get toss.secret_key

# 2. Functions 로그 확인
firebase functions:log --only confirmPayment

# 3. 로컬 테스트
cd functions
npm run serve
```

### 2. 칩 지급 안 됨

**증상**: 결제 완료 후 칩 잔액 변화 없음

**원인**:
- Firestore 트랜잭션 실패
- 권한 부족

**해결**:
```typescript
// ChipBalance 컴포넌트에서 강제 새로고침
const refreshBalance = async () => {
  await loadChipBalance();
};
```

### 3. 환불 실패

**증상**: `approveRefund` 호출 시 에러

**원인**:
- 토스페이먼츠 API 호출 실패
- 칩 부족 (회수 불가)

**해결**:
```bash
# 로그 확인
firebase functions:log --only approveRefund

# 수동 칩 차감
# ChipManagementPage에서 "칩 차감" 기능 사용
```

### 4. Cloud Scheduler 미작동

**증상**: 칩 만료 처리가 자동 실행되지 않음

**원인**:
- Cloud Scheduler Job 미생성
- Pub/Sub 토픽 미생성

**해결**:
```bash
# Job 확인
gcloud scheduler jobs list

# Job 재생성
gcloud scheduler jobs delete expireChips
gcloud scheduler jobs create pubsub expireChips \
  --schedule="0 0 * * *" \
  --time-zone="Asia/Seoul" \
  --topic="expire-chips" \
  --message-body="{}"

# 수동 실행 테스트
gcloud scheduler jobs run expireChips
```

### 5. 전화번호 인증 코드 미발송

**증상**: SMS 미수신

**원인**:
- Twilio/AWS SNS 미연동 ⚠️ **[PENDING]** 실제 SMS 서비스 연동 필요

**해결**:
```typescript
// 개발 환경에서는 응답에 코드 포함됨
const result = await sendPhoneVerificationCode({ phoneNumber, userId });
console.log('개발 환경 인증 코드:', result.data.code);
```

---

## 📝 추가 문서

- [API_REFERENCE.md](../../reference/API_REFERENCE.md) - API 명세서
- [SECURITY.md](../../operations/SECURITY.md) - 보안 가이드

---

**마지막 업데이트**: 2025-01-24
**버전**: 1.0.0
**작성자**: Claude (AI)
