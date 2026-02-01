# 💳 UNIQN 결제 시스템 개발 문서

**최종 업데이트**: 2026년 2월 1일
**버전**: v1.0.0 (Heart/Diamond Point System)
**상태**: 📋 **구현 준비**
**프로젝트**: UNIQN 하트/다이아 포인트 시스템

> ⚠️ **관련 문서**:
> - 📊 **포인트 정의 & 가격표**: [MODEL_B_CHIP_SYSTEM_FINAL.md](./MODEL_B_CHIP_SYSTEM_FINAL.md) (마스터 문서)
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
7. [포인트 시스템](#포인트-시스템)
8. [환불 시스템](#환불-시스템)
9. [하트 획득 시스템](#하트-획득-시스템)
10. [알림 시스템](#알림-시스템)
11. [배포 가이드](#배포-가이드)
12. [문제 해결](#문제-해결)

---

## 🎯 시스템 개요

### 목적

UNIQN 플랫폼에서 **💎 다이아 충전 결제** 및 **💖 하트 획득 시스템** 제공을 위한 통합 포인트 시스템

### 핵심 포인트 구조

| 포인트 | 아이콘 | 획득 방법 | 만료 | 가치 |
|--------|--------|----------|------|------|
| 💖 하트 (Heart) | ❤️ | 무료 활동 보상 | 90일 후 만료 | ₩300/개 |
| 💎 다이아 (Diamond) | 💎 | 유료 충전 | 만료 없음 | ₩300/개 |

### 주요 기능

- ✅ **다이아 충전**: RevenueCat을 통한 앱스토어 결제
- ✅ **하트 획득**: 출석, 리뷰, 초대 등 무료 활동
- ✅ **포인트 관리**: 포인트 지급, 차감, 만료 처리
- ✅ **배치 만료 관리**: 하트 배치별 90일 만료
- ✅ **알림 시스템**: 만료 임박 알림 (7일/3일/당일)
- ✅ **환불 시스템**: 앱스토어 정책 준수
- ✅ **보안**: Rate Limiting, 남용 탐지

### 기술 스택

```yaml
Frontend (모바일앱):
  - React Native + Expo SDK 54
  - TypeScript 5.9.2
  - NativeWind 4.2.1 (Tailwind CSS)
  - Zustand 5.0.9 (상태 관리)
  - TanStack Query 5.x (서버 상태)

Backend:
  - Firebase Cloud Functions (Node.js 18)
  - Firebase Firestore (NoSQL)
  - Firebase Authentication
  - Cloud Scheduler (Cron Jobs)

Payment Gateway:
  - RevenueCat (iOS/Android 앱스토어 통합)
  - react-native-purchases SDK
```

---

## 🏗️ 아키텍처

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 (Mobile App)                       │
└────────────┬────────────────────────────────────────────────┘
             │
             │ React Native
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Expo App (Frontend)                        │
│  - PointBalance (잔액 표시)                                  │
│  - DiamondPurchasePage (패키지 선택)                         │
│  - AttendanceModal (출석 체크)                               │
│  - PointTransactionHistory (내역 조회)                       │
└────────────┬───────────────────────────┬────────────────────┘
             │                           │
             │ Firebase SDK              │ RevenueCat SDK
             ▼                           ▼
┌──────────────────────────┐    ┌────────────────────────────┐
│  Firebase Cloud Functions │    │   RevenueCat               │
│                          │    │   - App Store Connect      │
│  [포인트 관리]            │    │   - Google Play Console    │
│  - deductPoints()        │◄───│   - Webhook (구매 완료)    │
│  - grantDiamonds()       │    │                            │
│  - grantHearts()         │    └────────────────────────────┘
│                          │
│  [하트 획득]              │
│  - checkDailyAttendance()│
│  - grantSignupBonus()    │
│  - grantReferralBonus()  │
│                          │
│  [Scheduled]             │
│  - cleanupExpiredHearts()│    (매일 00:00)
│  - heartExpiry7Days()    │    (매일 09:00)
│  - heartExpiry3Days()    │    (매일 09:00)
│  - heartExpiryToday()    │    (매일 09:00)
│                          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Firebase Firestore      │
│  - users/{userId}        │
│    └─ points.diamonds    │
│  - users/{userId}/       │
│    └─ heartBatches/      │
│    └─ pointTransactions/ │
│  - purchases/            │
└──────────────────────────┘
```

### 디렉토리 구조

```
T-HOLDEM/
├── uniqn-mobile/                      # Frontend (React Native)
│   ├── src/
│   │   ├── components/
│   │   │   └── points/
│   │   │       ├── PointBalance.tsx           # 포인트 잔액 표시
│   │   │       ├── PointTransactionHistory.tsx # 거래 내역
│   │   │       ├── DiamondPackageCard.tsx     # 패키지 카드
│   │   │       └── AttendanceModal.tsx        # 출석 체크 모달
│   │   ├── stores/
│   │   │   └── pointStore.ts                  # Zustand 스토어
│   │   ├── types/
│   │   │   └── point.types.ts                 # 타입 정의
│   │   ├── lib/
│   │   │   └── purchases.ts                   # RevenueCat 연동
│   │   └── hooks/
│   │       └── usePoints.ts                   # 포인트 훅
│   └── app/
│       └── (app)/
│           └── points/
│               ├── index.tsx                  # 포인트 메인
│               └── purchase.tsx               # 다이아 충전
│
├── functions/                         # Backend (Firebase Functions)
│   └── src/
│       ├── points/
│       │   ├── deductPoints.ts                # 포인트 차감
│       │   ├── grantDiamonds.ts               # 다이아 지급
│       │   └── grantHearts.ts                 # 하트 지급
│       ├── attendance/
│       │   └── dailyAttendance.ts             # 일일 출석
│       ├── notifications/
│       │   └── heartExpiryNotifications.ts    # 만료 알림
│       └── scheduled/
│           └── cleanupExpiredHearts.ts        # 만료 하트 정리
│
└── docs/features/payment/
    ├── MODEL_B_CHIP_SYSTEM_FINAL.md           # 마스터 문서
    ├── CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md    # 구현 가이드
    ├── REVENUE_MODEL_ANALYSIS.md              # 수익 분석
    └── PAYMENT_SYSTEM_DEVELOPMENT.md          # 이 문서
```

---

## 📊 데이터 모델

### Firestore 컬렉션 구조

#### 1. users/{userId}

**사용자 포인트 정보**

```typescript
{
  // 기존 필드들...

  // 💎 다이아 잔액
  points: {
    diamonds: number;          // 다이아 총 잔액
    lastUpdated: Timestamp;    // 마지막 업데이트
  },

  // 출석 정보
  attendance: {
    lastDate: Timestamp;       // 마지막 출석일
    streak: number;            // 연속 출석 일수
    totalDays: number;         // 총 출석 일수
  },
}
```

#### 2. users/{userId}/heartBatches/{batchId}

**💖 하트 배치 (만료 관리)**

```typescript
{
  amount: number;              // 원래 하트 개수
  remainingAmount: number;     // 남은 하트 개수
  source: HeartSource;         // 획득 경로
  acquiredAt: Timestamp;       // 획득일
  expiresAt: Timestamp;        // 만료일 (획득일 + 90일)
}

// HeartSource 타입
type HeartSource =
  | 'signup'           // 첫 가입 보상 (+10)
  | 'daily_attendance' // 일일 출석 (+1)
  | 'weekly_bonus'     // 7일 연속 보너스 (+3)
  | 'review_complete'  // 리뷰 작성 (+1)
  | 'referral'         // 친구 초대 (+5)
  | 'admin_grant';     // 관리자 지급
```

**예시**:
```json
{
  "amount": 10,
  "remainingAmount": 8,
  "source": "signup",
  "acquiredAt": "2025-01-15T10:00:00Z",
  "expiresAt": "2025-04-15T10:00:00Z"
}
```

#### 3. users/{userId}/pointTransactions/{txId}

**포인트 거래 내역**

```typescript
{
  id: string;
  type: 'earn' | 'spend' | 'purchase' | 'expire' | 'refund';
  pointType: 'heart' | 'diamond';
  amount: number;              // 변동 포인트 (양수: 획득, 음수: 사용)
  balanceAfter: number;        // 거래 후 잔액
  reason: string;              // 사유
  relatedId?: string;          // 관련 문서 ID
  metadata?: {
    batchId?: string;          // 하트 배치 ID
    packageId?: string;        // 구매 패키지 ID
    batchIds?: string[];       // 사용된 배치 ID 목록
  };
  createdAt: Timestamp;
}
```

**예시**:
```json
{
  "id": "tx_abc123",
  "type": "spend",
  "pointType": "heart",
  "amount": -1,
  "balanceAfter": 9,
  "reason": "일반 공고 등록",
  "relatedId": "job_xyz789",
  "metadata": {
    "batchIds": ["batch_001"]
  },
  "createdAt": "2025-01-20T14:30:00Z"
}
```

#### 4. purchases/{purchaseId}

**다이아 구매 기록**

```typescript
{
  userId: string;
  packageId: 'starter' | 'basic' | 'popular' | 'premium';
  diamonds: number;            // 기본 다이아
  bonusDiamonds: number;       // 보너스 다이아
  totalDiamonds: number;       // 총 다이아
  price: number;               // 결제 금액 (원)
  currency: 'KRW';
  status: 'pending' | 'completed' | 'refunded';

  // RevenueCat 정보
  revenueCatTransactionId: string;
  store: 'app_store' | 'play_store';
  productId: string;           // 앱스토어 상품 ID

  refundedAt?: Timestamp;
  refundAmount?: number;
  createdAt: Timestamp;
}
```

**예시**:
```json
{
  "userId": "user_abc123",
  "packageId": "popular",
  "diamonds": 35,
  "bonusDiamonds": 5,
  "totalDiamonds": 40,
  "price": 10000,
  "currency": "KRW",
  "status": "completed",
  "revenueCatTransactionId": "rc_tx_xyz",
  "store": "app_store",
  "productId": "com.uniqn.diamond.popular",
  "createdAt": "2025-01-24T10:30:00Z"
}
```

---

## 🔌 API 명세

### 1. deductPoints

**포인트 차감 (공고 등록 등)**

```typescript
// Request
{
  amount: number;        // 차감할 포인트 수
  reason: string;        // 사유
  relatedId?: string;    // 관련 문서 ID (공고 ID 등)
}

// Response
{
  success: boolean;
  heartsUsed: number;    // 차감된 하트 수
  diamondsUsed: number;  // 차감된 다이아 수
  newBalance: {
    hearts: number;
    diamonds: number;
  };
}

// Error Codes
- unauthenticated: 로그인 필요
- invalid-argument: 유효하지 않은 금액
- failed-precondition: 포인트 부족
```

**호출 예시**:
```typescript
const deductPoints = httpsCallable(functions, 'deductPoints');
const result = await deductPoints({
  amount: 1,
  reason: '일반 공고 등록',
  relatedId: 'job_xyz789',
});
```

### 2. grantDiamonds

**다이아 지급 (RevenueCat Webhook)**

```typescript
// Request (RevenueCat Webhook에서 호출)
{
  userId: string;
  diamonds: number;
  bonusDiamonds: number;
  packageId: string;
  transactionId: string;
  store: 'app_store' | 'play_store';
  productId: string;
  price: number;
}

// Response
{
  success: boolean;
  purchaseId: string;
  diamonds: number;      // 총 지급된 다이아
}
```

### 3. grantHearts

**하트 지급 (다양한 획득 경로)**

```typescript
// Request
{
  userId: string;
  source: HeartSource;
  amount?: number;       // admin_grant용
}

// Response
{
  success: boolean;
  amount: number;        // 지급된 하트 수
  batchId: string;       // 생성된 배치 ID
}
```

### 4. checkDailyAttendance

**일일 출석 체크**

```typescript
// Request
{} // 인증된 사용자 자동 감지

// Response
{
  success: boolean;
  streak: number;        // 현재 연속 출석 일수
  heartsEarned: number;  // 획득한 하트 (1 또는 4)
  isWeeklyBonus: boolean;
  message: string;
}

// 제한사항
- 하루 1회만 가능
- 연속 출석 7일마다 +3 보너스
```

### 5. getPointBalance

**포인트 잔액 조회**

```typescript
// Request
{} // 인증된 사용자 자동 감지

// Response
{
  hearts: number;
  diamonds: number;
  heartBatches: HeartBatch[];
  expiringHearts: {
    count: number;
    expiresIn: number;   // 일수
  } | null;
}
```

---

## 🔄 결제 플로우

### 다이아 충전 흐름도

```
[사용자] → 패키지 선택 → RevenueCat 결제 → Webhook → 다이아 지급 → 완료
   ↓           ↓              ↓              ↓          ↓           ↓
[UI]    DiamondPurchase  purchaseDiamonds  Firebase   grantDiamonds  Toast
        Page             (RevenueCat SDK)  Functions  Function       알림
```

### 단계별 상세

#### Step 1: 패키지 선택

**화면**: `DiamondPurchasePage.tsx`

```typescript
// 다이아 패키지 정의
const DIAMOND_PACKAGES = [
  { id: 'starter', name: '스타터', diamonds: 3, price: 1000, badge: '💡' },
  { id: 'basic', name: '기본', diamonds: 11, price: 3300, badge: '⭐' },
  { id: 'popular', name: '인기', diamonds: 40, price: 10000, badge: '🔥', bonus: 5 },
  { id: 'premium', name: '프리미엄', diamonds: 400, price: 100000, badge: '👑', bonus: 67 },
];

// 패키지 선택 후 결제 진행
const handlePurchase = async (pkg: DiamondPackage) => {
  try {
    const offerings = await Purchases.getOfferings();
    const purchasePackage = offerings.current?.availablePackages
      .find(p => p.product.identifier === pkg.productId);

    if (purchasePackage) {
      await Purchases.purchasePackage(purchasePackage);
      // Webhook에서 자동으로 다이아 지급
    }
  } catch (error) {
    handlePurchaseError(error);
  }
};
```

#### Step 2: RevenueCat 결제

**파일**: `src/lib/purchases.ts`

```typescript
import Purchases from 'react-native-purchases';

// 결제 실행
export const purchaseDiamonds = async (pkg: PurchasesPackage) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    logger.info('다이아 구매 완료', {
      packageId: pkg.identifier,
      productId: pkg.product.identifier,
    });
    return customerInfo;
  } catch (error) {
    if (error.userCancelled) {
      logger.info('사용자가 결제를 취소했습니다');
    } else {
      logger.error('다이아 구매 실패', error);
    }
    throw error;
  }
};
```

#### Step 3: Webhook 처리 (다이아 지급)

**RevenueCat → Firebase Functions**

RevenueCat 대시보드에서 Webhook URL 설정:
```
https://asia-northeast3-{project-id}.cloudfunctions.net/revenueCatWebhook
```

**파일**: `functions/src/webhooks/revenueCatWebhook.ts`

```typescript
export const revenueCatWebhook = functions
  .region('asia-northeast3')
  .https.onRequest(async (req, res) => {
    // 1. 시그니처 검증
    const signature = req.headers['x-revenuecat-signature'];
    if (!verifySignature(req.body, signature)) {
      res.status(401).send('Invalid signature');
      return;
    }

    // 2. 이벤트 타입 확인
    const { event } = req.body;

    if (event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL') {
      const { app_user_id, product_id, price } = event;

      // 3. 다이아 지급
      await grantDiamondsFromPurchase({
        userId: app_user_id,
        productId: product_id,
        price,
        transactionId: event.transaction_id,
        store: event.store,
      });
    }

    res.status(200).send('OK');
  });
```

---

## 🔒 보안

### 1. RevenueCat Webhook 시그니처 검증

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const webhookSecret = functions.config().revenuecat.webhook_secret;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 2. Rate Limiting

```typescript
// 포인트 차감 제한
const RATE_LIMITS = {
  deductPoints: { maxRequests: 10, windowMs: 60000 },    // 1분에 10회
  checkAttendance: { maxRequests: 5, windowMs: 300000 }, // 5분에 5회
};

// 남용 패턴 감지
async function detectAbusePattern(userId: string): Promise<boolean> {
  // 최근 1시간 내 비정상적 활동 감지
  const recentTransactions = await getRecentTransactions(userId, 1);

  if (recentTransactions.length > 50) {
    return true; // 비정상적으로 많은 거래
  }

  return false;
}
```

### 3. 포인트 직접 수정 방지 (Security Rules)

```javascript
// firestore.rules
match /users/{userId} {
  // 포인트 필드는 클라이언트에서 직접 수정 불가
  allow update: if request.auth.uid == userId
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['points']);
}

match /users/{userId}/heartBatches/{batchId} {
  allow read: if request.auth.uid == userId;
  allow write: if false; // Functions만 가능
}
```

### 4. 본인 확인

```typescript
// Cloud Function에서 인증 확인
const userId = context.auth?.uid;
if (!userId) {
  throw new functions.https.HttpsError('unauthenticated', '인증이 필요합니다.');
}

// 타인의 포인트 조작 방지
if (data.targetUserId && data.targetUserId !== userId) {
  // admin 권한 확인
  const isAdmin = await checkAdminRole(userId);
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', '권한이 없습니다.');
  }
}
```

---

## 💎 포인트 시스템

### 포인트 종류

| 포인트 | 획득 방법 | 만료 기간 | 용도 |
|--------|----------|----------|------|
| **💖 하트** | 무료 활동 | 획득일 + 90일 | 공고 등록 |
| **💎 다이아** | 유료 충전 | 만료 없음 | 공고 등록 |

### 사용 우선순위

**💖 하트 (만료 임박 순) → 💎 다이아**

```typescript
// 포인트 차감 로직 (deductPoints.ts)
async function deductPointsLogic(
  userId: string,
  amount: number,
  transaction: FirebaseFirestore.Transaction
) {
  // 1. 하트 배치 조회 (만료 임박 순)
  const heartBatches = await getActiveHeartBatches(userId, transaction);

  // 2. 하트 먼저 차감
  let remainingAmount = amount;
  let heartsUsed = 0;

  for (const batch of heartBatches) {
    if (remainingAmount <= 0) break;

    const deduct = Math.min(batch.remainingAmount, remainingAmount);
    transaction.update(batch.ref, {
      remainingAmount: FieldValue.increment(-deduct),
    });

    heartsUsed += deduct;
    remainingAmount -= deduct;
  }

  // 3. 하트로 부족하면 다이아 차감
  if (remainingAmount > 0) {
    const userRef = db.doc(`users/${userId}`);
    transaction.update(userRef, {
      'points.diamonds': FieldValue.increment(-remainingAmount),
    });
  }

  return { heartsUsed, diamondsUsed: remainingAmount };
}
```

### 공고 비용

| 공고 타입 | 비용 | 설명 |
|-----------|------|------|
| 일반 공고 | 1💎 | 기본 노출 |
| 긴급 공고 | 10💎 | 상단 고정 + 뱃지 |
| 상시 공고 | 5💎 | 30일 노출 |

---

## 💸 환불 시스템

### 앱스토어 환불 정책

RevenueCat을 통한 앱스토어 결제는 **Apple/Google 환불 정책**을 따릅니다.

```yaml
iOS (App Store):
  - Apple을 통한 환불 요청
  - 앱 내 환불 버튼 제공 불가 (App Store 정책)
  - RevenueCat Webhook으로 환불 이벤트 수신

Android (Google Play):
  - Google Play를 통한 환불 요청
  - 48시간 이내 자동 환불 가능
  - RevenueCat Webhook으로 환불 이벤트 수신
```

### 환불 처리 (Webhook)

```typescript
// 환불 이벤트 처리
if (event.type === 'CANCELLATION' || event.type === 'REFUND') {
  const { app_user_id, product_id, transaction_id } = event;

  // 1. 구매 기록 조회
  const purchase = await findPurchaseByTransactionId(transaction_id);

  if (purchase) {
    // 2. 다이아 회수
    await db.runTransaction(async (transaction) => {
      const userRef = db.doc(`users/${app_user_id}`);
      const userDoc = await transaction.get(userRef);
      const currentDiamonds = userDoc.data()?.points?.diamonds || 0;

      // 회수할 다이아 (보유량 초과 방지)
      const deductAmount = Math.min(purchase.totalDiamonds, currentDiamonds);

      transaction.update(userRef, {
        'points.diamonds': FieldValue.increment(-deductAmount),
      });

      // 3. 거래 내역 기록
      const txRef = db.collection(`users/${app_user_id}/pointTransactions`).doc();
      transaction.set(txRef, {
        type: 'refund',
        pointType: 'diamond',
        amount: -deductAmount,
        balanceAfter: currentDiamonds - deductAmount,
        reason: '환불로 인한 다이아 회수',
        relatedId: purchase.id,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 4. 구매 상태 업데이트
      transaction.update(db.doc(`purchases/${purchase.id}`), {
        status: 'refunded',
        refundedAt: FieldValue.serverTimestamp(),
      });
    });
  }
}
```

---

## 💖 하트 획득 시스템

### 획득 경로

| 활동 | 하트 | 조건 |
|------|------|------|
| 첫 가입 | +10💖 | 회원가입 시 1회 |
| 일일 출석 | +1💖 | 하루 1회 |
| 7일 연속 출석 | +3💖 | 7일 연속 시 추가 |
| 리뷰 작성 | +1💖 | 근무 후 리뷰 작성 |
| 친구 초대 | +5💖 | 초대 코드로 가입 시 |

### 출석 체크 시스템

```typescript
// 일일 출석 체크 (dailyAttendance.ts)
export const checkDailyAttendance = functions
  .region('asia-northeast3')
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    if (!userId) throw new functions.https.HttpsError('unauthenticated', '인증 필요');

    const now = new Date();
    const today = startOfDay(now);

    return await db.runTransaction(async (transaction) => {
      const userRef = db.doc(`users/${userId}`);
      const userDoc = await transaction.get(userRef);
      const attendance = userDoc.data()?.attendance || {};

      // 중복 출석 확인
      const lastDate = attendance.lastDate?.toDate();
      if (lastDate && startOfDay(lastDate).getTime() === today.getTime()) {
        return { success: false, message: '이미 오늘 출석했습니다.' };
      }

      // 연속 출석 계산
      let newStreak = 1;
      if (lastDate && differenceInDays(today, startOfDay(lastDate)) === 1) {
        newStreak = (attendance.streak || 0) + 1;
      }

      // 하트 지급
      let heartsToGrant = 1;
      const isWeeklyBonus = newStreak % 7 === 0;
      if (isWeeklyBonus) heartsToGrant += 3;

      // 하트 배치 생성
      const expiresAt = addDays(now, 90);
      const batchRef = db.collection(`users/${userId}/heartBatches`).doc();
      transaction.set(batchRef, {
        amount: heartsToGrant,
        remainingAmount: heartsToGrant,
        source: isWeeklyBonus ? 'weekly_bonus' : 'daily_attendance',
        acquiredAt: FieldValue.serverTimestamp(),
        expiresAt,
      });

      // 출석 정보 업데이트
      transaction.update(userRef, {
        'attendance.lastDate': FieldValue.serverTimestamp(),
        'attendance.streak': newStreak,
        'attendance.totalDays': FieldValue.increment(1),
      });

      return {
        success: true,
        streak: newStreak,
        heartsEarned: heartsToGrant,
        isWeeklyBonus,
      };
    });
  });
```

---

## 🔔 알림 시스템

### 알림 타입

| 타입 | 제목 예시 | 발송 시점 |
|------|----------|----------|
| `heart_expiry_7d` | "⏰ 하트 만료 예정" | 7일 전 |
| `heart_expiry_3d` | "🚨 하트 만료 임박!" | 3일 전 |
| `heart_expiry_today` | "🔥 오늘 자정에 하트 만료!" | 당일 |
| `attendance_remind` | "📅 출석 체크를 잊지 마세요" | 오후 6시 |
| `purchase_complete` | "💎 다이아 충전 완료!" | 구매 직후 |

### 만료 알림 Cron

```typescript
// 하트 만료 7일 전 알림 (매일 09:00)
export const heartExpiry7Days = functions
  .region('asia-northeast3')
  .pubsub.schedule('0 9 * * *')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const targetDate = addDays(new Date(), 7);

    // 7일 후 만료되는 하트 배치 조회
    const batchesSnapshot = await db.collectionGroup('heartBatches')
      .where('expiresAt', '>=', startOfDay(targetDate))
      .where('expiresAt', '<=', endOfDay(targetDate))
      .where('remainingAmount', '>', 0)
      .get();

    // 사용자별로 그룹화
    const userHearts = new Map<string, number>();
    batchesSnapshot.forEach((doc) => {
      const userId = doc.ref.path.split('/')[1];
      const remaining = doc.data().remainingAmount;
      userHearts.set(userId, (userHearts.get(userId) || 0) + remaining);
    });

    // 푸시 알림 발송
    for (const [userId, heartCount] of userHearts) {
      const userDoc = await db.doc(`users/${userId}`).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: '⏰ 하트 만료 예정',
            body: `💖 하트 ${heartCount}개가 7일 후 만료됩니다. 지금 공고에 지원하세요!`,
          },
          data: {
            type: 'heart_expiry_7d',
            action: 'open_job_board',
          },
        });
      }
    }
  });
```

---

## 🚀 배포 가이드

### 1. 환경 변수 설정

#### Mobile App (.env)

```bash
# RevenueCat API Keys
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxx
```

#### Firebase Functions Config

```bash
# RevenueCat Webhook Secret
firebase functions:config:set revenuecat.webhook_secret="your_webhook_secret"

# 확인
firebase functions:config:get
```

### 2. RevenueCat 설정

```yaml
1. RevenueCat 계정 생성
   - https://app.revenuecat.com/

2. App Store Connect 연동
   - API Key 생성
   - Shared Secret 입력
   - In-App Purchase 상품 등록 (4개)

3. Google Play Console 연동
   - Service Account JSON 업로드
   - In-App Product 등록 (4개)

4. Webhook 설정
   - URL: https://asia-northeast3-{project}.cloudfunctions.net/revenueCatWebhook
   - Events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, REFUND

5. Offerings 설정
   - default offering 생성
   - 4개 패키지 추가
```

### 3. Cloud Scheduler 배포

```bash
# 하트 만료 정리 (매일 00:00)
gcloud scheduler jobs create pubsub cleanupExpiredHearts \
  --schedule="0 0 * * *" \
  --time-zone="Asia/Seoul" \
  --topic="cleanup-expired-hearts" \
  --message-body="{}"

# 하트 만료 7일 전 알림 (매일 09:00)
gcloud scheduler jobs create pubsub heartExpiry7Days \
  --schedule="0 9 * * *" \
  --time-zone="Asia/Seoul" \
  --topic="heart-expiry-7days" \
  --message-body="{}"

# 하트 만료 3일 전 알림 (매일 09:00)
gcloud scheduler jobs create pubsub heartExpiry3Days \
  --schedule="0 9 * * *" \
  --time-zone="Asia/Seoul" \
  --topic="heart-expiry-3days" \
  --message-body="{}"

# 하트 만료 당일 알림 (매일 09:00)
gcloud scheduler jobs create pubsub heartExpiryToday \
  --schedule="0 9 * * *" \
  --time-zone="Asia/Seoul" \
  --topic="heart-expiry-today" \
  --message-body="{}"

# 확인
gcloud scheduler jobs list
```

### 4. Functions 배포

```bash
cd functions

# 타입 체크
npm run type-check

# 린트
npm run lint

# 배포
npm run deploy

# 특정 함수만 배포
firebase deploy --only functions:deductPoints
firebase deploy --only functions:grantDiamonds
firebase deploy --only functions:checkDailyAttendance
firebase deploy --only functions:revenueCatWebhook
```

### 5. Firestore Security Rules 배포

```bash
firebase deploy --only firestore:rules
```

### 6. Mobile App 배포

```bash
cd uniqn-mobile

# iOS 빌드
eas build --platform ios

# Android 빌드
eas build --platform android

# TestFlight / 내부 테스트 배포
eas submit --platform ios
eas submit --platform android
```

---

## 🛠️ 문제 해결

### 1. 다이아 지급 안 됨

**증상**: RevenueCat 결제 완료 후 다이아 미지급

**원인**:
- Webhook URL 미설정
- Webhook Secret 불일치
- Functions 에러

**해결**:
```bash
# 1. Webhook 설정 확인 (RevenueCat 대시보드)

# 2. Functions 로그 확인
firebase functions:log --only revenueCatWebhook

# 3. 수동 다이아 지급 (관리자)
# Admin Dashboard에서 수동 지급
```

### 2. 하트 만료 처리 안 됨

**증상**: 만료된 하트가 여전히 표시됨

**원인**:
- Cloud Scheduler Job 미작동
- cleanupExpiredHearts 에러

**해결**:
```bash
# 1. Job 확인
gcloud scheduler jobs list

# 2. 수동 실행
gcloud scheduler jobs run cleanupExpiredHearts

# 3. 로그 확인
firebase functions:log --only cleanupExpiredHearts
```

### 3. 출석 체크 실패

**증상**: 출석 버튼 클릭해도 반응 없음

**원인**:
- 네트워크 에러
- 이미 오늘 출석함
- Functions 에러

**해결**:
```typescript
// 에러 처리 개선
try {
  const result = await checkDailyAttendance();
  if (result.data.success) {
    toast.success(result.data.message);
  } else {
    toast.info(result.data.message); // 이미 출석한 경우
  }
} catch (error) {
  if (error.code === 'already-exists') {
    toast.info('이미 오늘 출석했습니다.');
  } else {
    toast.error('출석 체크 중 오류가 발생했습니다.');
  }
}
```

### 4. 포인트 차감 실패

**증상**: 공고 등록 시 "포인트 부족" 에러

**원인**:
- 실제 포인트 부족
- 하트 배치 조회 실패
- 트랜잭션 충돌

**해결**:
```typescript
// 포인트 부족 사전 확인
const { canAfford } = usePointStore();

if (!canAfford(postingCost)) {
  toast.error('포인트가 부족합니다. 다이아를 충전해주세요.');
  router.push('/points/purchase');
  return;
}
```

### 5. RevenueCat 초기화 실패

**증상**: "RevenueCat 초기화 실패" 에러

**원인**:
- API Key 미설정
- 잘못된 API Key

**해결**:
```typescript
// 1. .env 파일 확인
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxx

// 2. 초기화 코드 확인
const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
  android: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
});

if (!API_KEY) {
  logger.error('RevenueCat API Key가 설정되지 않았습니다');
}
```

---

## 📝 무료 기간 정책

```yaml
무료 기간: 2026년 7월 1일까지 (6개월)
정책:
  - 모든 공고 비용 0다이아
  - 하트 획득 시스템 정상 운영
  - 다이아 충전 UI 표시 (선결제 가능)
  - 7/1 이후 자동으로 과금 시작

구현:
  const FREE_PERIOD_END = new Date('2026-07-01T00:00:00+09:00');
  const isFreePeriod = () => new Date() < FREE_PERIOD_END;

  const getPostingCost = (type: PostingType) => {
    if (isFreePeriod()) return 0;
    return JOB_POSTING_COSTS[type];
  };
```

---

## 📚 추가 문서

- [MODEL_B_CHIP_SYSTEM_FINAL.md](./MODEL_B_CHIP_SYSTEM_FINAL.md) - 포인트 시스템 마스터 문서
- [CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md](./CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md) - 구현 가이드
- [REVENUE_MODEL_ANALYSIS.md](./REVENUE_MODEL_ANALYSIS.md) - 수익 분석

---

**마지막 업데이트**: 2025-02-01
**버전**: v1.0.0 (Heart/Diamond Point System)
