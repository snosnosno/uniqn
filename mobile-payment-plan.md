# UNIQN 모바일앱 포인트 시스템 (하트/다이아) 구현 계획 v2

## 개요

### 포인트 구조
- **💖 하트 (Heart)**: 무료 획득 (이벤트, 출석, 리뷰 등)
- **💎 다이아 (Diamond)**: 유료 충전
- **가치**: 1 포인트 = 300원 (하트/다이아 동일)
- **사용 우선순위**: 하트(만료 임박 순) → 다이아
- **하트 만료**: 획득 후 90일

### 공고 가격표
| 타입 | 포인트 | 원화 | 기간 |
|------|--------|------|------|
| regular (일반) | 1 💎 | ₩300 | 7일 |
| urgent (긴급) | 10 💎 | ₩3,000 | 7일 + 긴급탭 |
| fixed (고정) | 5 💎 | ₩1,500 | 30일 |
| tournament (대회) | 승인 시 책정 | - | 대회기간 |
| 기간 연장 | 1 💎 | ₩300 | +7일 |
| 긴급 전환 | 10 💎 | ₩3,000 | 즉시 |

### 다이아 충전 패키지
| 금액 | 기본 | 보너스 | 총 다이아 |
|------|------|--------|----------|
| ₩1,000 | 3 | - | 3 |
| ₩3,000 | 10 | - | 10 |
| ₩10,000 | 33 | +2 | 35 (+6%) |
| ₩30,000 | 100 | +10 | 110 (+10%) |
| ₩50,000 | 167 | +23 | 190 (+14%) |
| ₩100,000 | 333 | +67 | 400 (+20%) |

### 하트 획득
| 이벤트 | 보상 | 주기 |
|--------|------|------|
| 첫 가입 | +10 💖 | 1회 |
| 출석 체크 | +1 💖 | 매일 |
| 7일 연속 출석 | +3 💖 | 주간 |
| 근무 완료 리뷰 | +1 💖 | 건당 |
| 친구 초대 | +5 💖 | 건당 |

---

## 1. 성능 최적화

### 1.1 하트 배치 구조 (만료 추적 최적화)
```typescript
// 버킷 방식으로 하트 관리
interface HeartBatch {
  id: string;
  userId: string;
  amount: number;           // 남은 수량
  originalAmount: number;   // 초기 발급량
  expiresAt: Timestamp;
  source: HeartSource;
  createdAt: Timestamp;
}
```

### 1.2 요약 문서 (캐시 역할)
```typescript
// wallets/{userId} - 실시간 조회용 캐시
interface Wallet {
  userId: string;
  heartBalance: number;
  diamondBalance: number;
  nextExpiry: Timestamp;      // 가장 빠른 만료일
  expiringHeartsSoon: number; // 7일 내 만료 예정
  lastUpdatedAt: Timestamp;
}
```

### 1.3 Firestore 인덱스
```
heartBatches: (userId ASC, expiresAt ASC) - 만료 임박 순 조회
heartBatches: (expiresAt ASC, amount > 0) - 배치 만료 처리
pointTransactions: (userId ASC, createdAt DESC) - 내역 조회
```

### 1.4 캐싱 전략
```typescript
// 포인트 관련 캐싱 정책
points: {
  staleTime: 30 * 1000,  // 30초 (결제 후 즉시 반영 필요)
  gcTime: 5 * 60 * 1000, // 5분
}
```

---

## 2. 보안

### 2.1 Firestore Security Rules
```javascript
// 포인트 관련 컬렉션 - 클라이언트 직접 수정 차단
match /wallets/{userId} {
  allow read: if isSignedIn() && isOwner(userId);
  allow write: if false; // Cloud Functions만 가능
}

match /heartBatches/{batchId} {
  allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
  allow write: if false;
}

match /pointTransactions/{txId} {
  allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
  allow write: if false;
}

match /purchases/{purchaseId} {
  allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
  allow write: if false;
}
```

### 2.2 서버 사이드 결제 검증
```typescript
// Cloud Functions에서 처리
// 1. RevenueCat API로 영수증 검증
// 2. 중복 처리 방지 (Idempotency Key)
// 3. 트랜잭션으로 원자적 포인트 지급
```

### 2.3 중복 결제 방지
- RevenueCat transactionId로 중복 체크
- purchases 컬렉션에 transactionId 유니크 저장

---

## 3. UI/UX

### 3.1 잔액 부족 처리 플로우
```
공고 등록 클릭
  ↓
잔액 확인 (로컬 캐시)
  ↓
부족 시 → InsufficientPointsModal 표시
  ├── "충전하기" → 충전 화면 이동
  └── "취소" → 모달 닫기
```

### 3.2 결제 플로우
```
패키지 선택 → 결제 진행 (로딩 오버레이)
  ↓
RevenueCat 결제
  ↓
성공: 토스트 + 잔액 업데이트
실패: 에러 토스트 + 재시도 안내
```

### 3.3 오프라인 처리
- 캐시된 잔액 표시 + "오프라인" 배지
- 결제 버튼 비활성화
- 온라인 복구 시 자동 새로고침

### 3.4 UI 컴포넌트
```
src/components/wallet/
├── WalletBalance.tsx        # 잔액 표시 (헤더용)
├── WalletDetail.tsx         # 상세 잔액 화면
├── PointHistory.tsx         # 거래 내역 리스트
├── DiamondPurchaseModal.tsx # 충전 모달
├── AttendanceButton.tsx     # 출석 체크 버튼
├── InsufficientModal.tsx    # 잔액 부족 안내
├── HeartExpiryWarning.tsx   # 만료 임박 경고
└── PaymentOverlay.tsx       # 결제 진행 오버레이
```

---

## 4. 확장성

### 4.1 포인트 타입 확장 가능 설계
```typescript
type PointType = 'heart' | 'diamond' | string; // 향후 확장

interface PointTypeConfig {
  type: PointType;
  displayName: string;
  icon: string;
  hasExpiry: boolean;
  expiryDays?: number;
  isPremium: boolean;
  priority: number; // 소비 우선순위
}
```

### 4.2 가격 정책 Remote Config
```typescript
// config/postingPricing 문서에서 관리
// 코드 배포 없이 가격 변경 가능
interface PricingConfig {
  postingPrices: Record<PostingType, number>;
  packages: DiamondPackage[];
  heartRewards: HeartRewards;
  promotions: Promotion[];
}
```

### 4.3 Feature Flag 통합
```typescript
// featureFlagService에 추가
enable_point_system: boolean;
enable_diamond_purchase: boolean;
point_free_period_until: string; // 무료 기간 종료일
```

---

## 5. 데이터 흐름

### 5.1 결제 플로우 (서버 응답 대기)
```
1. 클라이언트: RevenueCat SDK 결제 시작
2. RevenueCat: 결제 완료 → Webhook
3. Cloud Functions: 트랜잭션으로 포인트 지급
4. 클라이언트: queryClient.invalidateQueries
5. 클라이언트: 성공 토스트
```

### 5.2 포인트 사용 플로우 (트랜잭션)
```
1. 클라이언트: Cloud Functions 호출
2. Cloud Functions 트랜잭션:
   - 잔액 재확인
   - 하트 우선 차감 (만료 임박 순)
   - 부족분 다이아 차감
   - 공고 생성
   - 트랜잭션 로그 기록
3. 성공: 공고 ID 반환
4. 클라이언트: 캐시 무효화
```

### 5.3 낙관적 업데이트 vs 서버 응답
- **결제**: 서버 응답 대기 (실패 시 복잡한 롤백 방지)
- **사용**: 서버 응답 대기 (트랜잭션 정합성)
- **조회**: 낙관적 캐시 사용

---

## 6. 에러 처리

### 6.1 에러 코드 (E8xxx)
```typescript
POINT_INSUFFICIENT_BALANCE: 'E8001',  // 잔액 부족
POINT_HEART_EXPIRED: 'E8002',         // 하트 만료
POINT_PURCHASE_FAILED: 'E8003',       // 결제 실패
POINT_PURCHASE_DUPLICATE: 'E8004',    // 중복 결제
POINT_DEDUCTION_FAILED: 'E8005',      // 차감 실패
POINT_REFUND_NOT_ALLOWED: 'E8006',    // 환불 불가
POINT_INVALID_AMOUNT: 'E8007',        // 유효하지 않은 금액
```

### 6.2 비즈니스 에러 클래스
```typescript
// BusinessErrors.ts에 추가
export class InsufficientBalanceError extends AppError {
  constructor(options?: {
    required?: number;
    available?: number;
  }) { ... }
}
```

### 6.3 사용자 친화적 메시지
```typescript
const ERROR_MESSAGES = {
  E8001: '포인트가 부족합니다. 충전 후 다시 시도해주세요.',
  E8002: '사용하려는 하트가 만료되었습니다.',
  E8003: '결제에 실패했습니다. 다시 시도해주세요.',
  // ...
};
```

---

## 7. 의존성 관리

### 7.1 결제 Provider 추상화
```typescript
// 장애 대비 + 테스트 용이성
interface IPaymentProvider {
  initialize(): Promise<void>;
  getProducts(): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<Purchase[]>;
}

// 구현체
class RevenueCatProvider implements IPaymentProvider { }
class MockPaymentProvider implements IPaymentProvider { } // 테스트용
```

### 7.2 장애 대응
- RevenueCat 장애 시: 에러 메시지 + 관리자 문의 안내
- 수동 처리 옵션 제공 (관리자 대시보드)

---

## 8. 레거시 호환

### 8.1 무료 기간 처리 (6개월)
```typescript
const FREE_PERIOD_END = '2026-07-01'; // 출시 + 6개월

function isFreePeriod(): boolean {
  const endDate = featureFlagService.getFlag('point_free_period_until')
    || FREE_PERIOD_END;
  return new Date() < new Date(endDate);
}

// 공고 생성 시 분기
if (isFreePeriod()) {
  return createJobPostingFree(input);
} else {
  return createJobPostingWithPoints(input);
}
```

### 8.2 기존 공고와의 호환
- 기존 공고: 포인트 차감 기록 없음
- 신규 공고: pointTransactionId 필드 추가
- 마이그레이션 불필요 (신규 공고부터 적용)

---

## 9. 누락된 기능

### 9.1 환불 처리
```typescript
// 환불 정책
- 다이아만 환불 가능 (하트 환불 불가)
- 미사용 다이아만 환불
- 공고 미게시 + 7일 이내

// Cloud Functions에서 처리
processRefund(purchaseId, reason)
```

### 9.2 알림 시스템
```typescript
// 포인트 관련 알림
- 하트 만료 7일 전 알림
- 하트 만료 당일 알림
- 결제 완료 알림
- 프로모션 알림
```

### 9.3 관리자 기능
```
- 포인트 수동 지급/차감
- 프로모션 생성
- 매출 통계 대시보드
- 환불 처리
```

---

## 10. 모순 해결

### 10.1 하트 만료 vs 트랜잭션
- **문제**: 공고 등록 중 하트 만료
- **해결**: 트랜잭션 시작 시점의 유효한 하트만 사용

### 10.2 가격 변경 vs 진행 중 결제
- **문제**: 결제 중 가격 변경
- **해결**: 결제 시작 시점 가격 기록, 변경과 무관하게 처리

### 10.3 하트 우선 소비 vs 환불
- **문제**: 하트 먼저 쓰면 다이아 환불 복잡
- **해결**: 다이아만 환불 가능 정책

---

## 구현 파일 목록

### 신규 생성
```
src/types/wallet.ts
src/schemas/wallet.schema.ts
src/errors/WalletErrors.ts
src/repositories/interfaces/IWalletRepository.ts
src/repositories/firebase/WalletRepository.ts
src/services/walletService.ts
src/services/pointService.ts
src/services/payment/IPaymentProvider.ts
src/services/payment/RevenueCatProvider.ts
src/stores/walletStore.ts
src/hooks/useWallet.ts
src/hooks/useDiamondPurchase.ts
src/hooks/useAttendance.ts
src/components/wallet/*.tsx (8개)
functions/src/points/*.ts (4개)
```

### 수정 필요
```
src/services/jobManagementService.ts  # 포인트 연동
src/services/featureFlagService.ts    # 무료 기간 플래그
src/lib/queryClient.ts                # Query Keys 추가
src/errors/AppError.ts                # 에러 코드 추가
firestore.rules                       # Security Rules
firestore.indexes.json                # 인덱스
```

---

## Firestore 컬렉션

### wallets/{userId}
```typescript
{
  userId: string;
  heartBalance: number;
  diamondBalance: number;
  totalHeartEarned: number;
  totalDiamondPurchased: number;
  totalPointsSpent: number;
  lastAttendanceDate: string | null;
  consecutiveAttendanceDays: number;
  nextExpiry: Timestamp | null;
  expiringHeartsSoon: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### heartBatches/{batchId}
```typescript
{
  id: string;
  userId: string;
  amount: number;
  originalAmount: number;
  source: HeartSource;
  sourceRef?: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}
```

### pointTransactions/{txId}
```typescript
{
  id: string;
  userId: string;
  type: TransactionType;
  heartAmount: number;
  diamondAmount: number;
  usedHeartBatches?: { batchId: string; amount: number }[];
  relatedRef?: string;
  description: string;
  balanceAfter: { heart: number; diamond: number };
  createdAt: Timestamp;
}
```

### purchases/{purchaseId}
```typescript
{
  id: string;
  userId: string;
  packageId: string;
  price: number;
  diamondAmount: number;
  bonusAmount: number;
  revenueCatTransactionId: string;
  revenueCatProductId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  platform: 'ios' | 'android' | 'web';
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

### config/postingPricing
```typescript
{
  prices: {
    regular: { diamonds: 1, durationDays: 7 },
    urgent: { diamonds: 10, durationDays: 7 },
    fixed: { diamonds: 5, durationDays: 30 },
  },
  options: {
    extend: { diamonds: 1, additionalDays: 7 },
    upgradeToUrgent: { diamonds: 10 },
  },
  packages: DiamondPackage[],
  heartRewards: HeartRewards,
  heartExpirationDays: 90,
  updatedAt: Timestamp,
}
```

---

## 구현 순서

### Phase 1: 기반 구축 (1주)
1. 타입/스키마 정의
2. Firestore 컬렉션 + Security Rules + 인덱스
3. Repository 구현 (트랜잭션 핵심)
4. Service 구현 (walletService, pointService)
5. Store/Hook 구현
6. 에러 클래스 추가

### Phase 2: 핵심 기능 (1주)
7. 출석 체크 기능 + UI
8. 잔액 표시 UI (헤더, 상세)
9. 거래 내역 화면
10. 공고 생성 포인트 연동
11. Cloud Functions (회원가입 보너스, 만료 처리)

### Phase 3: 결제 시스템 (1주)
12. RevenueCat 연동 (Provider 추상화)
13. 다이아 충전 UI
14. 결제 완료 Webhook (Cloud Functions)
15. Sandbox 테스트

### Phase 4: 부가 기능 (1주)
16. 친구 초대 보상
17. 근무 리뷰 보상
18. 하트 만료 알림
19. 관리자 기능 (포인트 지급)
20. 환불 처리

---

## 테스트 전략

### 단위 테스트
```typescript
// pointService.test.ts
- 하트 만료 임박 순 차감 테스트
- 하트+다이아 혼합 차감 테스트
- 잔액 부족 에러 테스트
- 만료된 하트 건너뛰기 테스트
```

### 통합 테스트
```typescript
// pointFlow.test.ts
- 결제 → 포인트 지급 → 공고 등록 전체 플로우
- Race Condition 테스트
- 트랜잭션 롤백 테스트
```

### E2E 테스트 (Sandbox)
- RevenueCat Sandbox 환경
- 테스트 상품 결제 → 포인트 지급 확인

---

## 배포 전략

### 점진적 롤아웃
```
1. 내부 테스트 (admin만)
2. Beta 10%
3. 전체 50%
4. 전체 100%
```

### 롤백
```typescript
// Feature Flag로 즉시 비활성화
featureFlagService.setFlag('enable_point_system', false);
// → 자동으로 무료 모드 전환
```

### 모니터링
```typescript
// Analytics 이벤트
trackEvent('point_purchase_started');
trackEvent('point_purchase_completed');
trackEvent('point_purchase_failed');
trackEvent('point_deducted');
trackEvent('heart_expired');
```

---

## 검증 방법

```bash
# 타입 체크
cd uniqn-mobile && npm run type-check

# 린트
npm run lint

# 테스트
npm run test

# 빌드
npm run build:web
```

---

## 참조 파일
- `src/repositories/firebase/ApplicationRepository.ts` - 트랜잭션 패턴
- `src/stores/authStore.ts` - Zustand + MMKV persist
- `src/services/jobManagementService.ts` - 공고 생성 로직
- `src/lib/queryClient.ts` - Query Keys 관리
- `src/errors/AppError.ts` - 에러 클래스 계층
- `firestore.rules` - Security Rules 패턴
