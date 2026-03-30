> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 설계, 기록, 레거시 참고 또는 시점 한정 로그입니다.
> 현재 기준 문서는 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`, `docs/guides/DEPLOYMENT.md`를 우선 확인하세요.
# UNIQN 모바일앱 과금 시스템 v4

## 개요

### 설계 원칙
```
1. 이중 재화: 💖 하트(활동) + 💎 다이아(충전) → 벌어서 쓰거나 사서 쓰거나
2. 기본 무료: 매일 접속/공유/리뷰하면 기본 사용량 무료 커버
3. 스팸 방지: 재화 없이는 공고 등록 불가 → 활동 없는 계정 차단
4. 리텐션: 매일 접속/공유/리뷰 → 하트 보상 → 재방문 유도
5. 수익화: 헤비 유저 or 비활성 유저 → 다이아 구매
6. 양면 참여: 구인자 + 스태프 모두 벌고 쓴다
```

### 재화 구조

| | 💖 하트 | 💎 다이아 |
|--|---------|----------|
| **획득** | 접속, 공유, 리뷰, 연속보너스 | 스토어 충전 |
| **만료** | 90일 | 무기한 |
| **환불** | 불가 | 7일 이내 가능 |
| **사용처** | 모든 곳 (공고, 프리미엄 등) | 모든 곳 (하트와 동일) |
| **우선 사용** | **1순위** (만료 임박 순) | 2순위 |

- **가치**: 1💖 = 1💎 = ₩300 (동일 가치)
- **구독 없음** — 단건 소모 구조

---

## 1. 💖 하트 획득 (무료)

### 1.1 일일 활동 보상

| 활동 | 보상 | 일일 상한 | 대상 | 설명 |
|------|:----:|:---------:|:----:|------|
| 일일 접속 | +1 💖 | 1회 | 전체 | 하루 첫 앱 실행 시 자동 지급 |
| 공고 공유 (SNS) | +1 💖 | 1회 | 전체 | 카카오톡/인스타 등 공유 링크 생성 시 |
| 스태프 리뷰 작성 | +1 💖 | 2회 | 구인자 | 근무 완료 후 스태프 평가 |
| 구인자 리뷰 작성 | +1 💖 | 2회 | 스태프 | 근무 완료 후 구인자/업장 평가 |

### 1.2 연속 접속 보너스

| 연속 일수 | 보너스 | 비고 |
|:---------:|:------:|------|
| 7일 | +3 💖 | 주간 보너스 |
| 30일 | +10 💖 | 월간 보너스 |

### 1.3 일회성 보너스 (프로모션 하트)

| 이벤트 | 보상 | 유효기간 | 대상 |
|--------|:----:|:--------:|:----:|
| 프로필 완성 (사진+경력+소개) | +5 💖 | 90일 | 전체 |
| 본인인증 완료 | +5 💖 | 90일 | 전체 |
| 첫 공고 등록 | +3 💖 | 90일 | 구인자 |
| 첫 지원 | +3 💖 | 90일 | 스태프 |
| 친구 초대 (가입 완료) | +3 💖 | 60일 | 전체 |
| 관리자 수동 지급 | 가변 | 가변 | 전체 |

### 1.4 월간 수입 시뮬레이션

**적극적 사용자** (매일 접속 + 공유 + 리뷰):
```
접속 30일:         30 💖
공유 15회:         15 💖
리뷰 10회:         10 💖
주간 보너스 ×4:    12 💖
월간 보너스 ×1:    10 💖
─────────────────────
합계:             ~77 💖/월
```

**보통 사용자** (주 5일 접속, 가끔 공유):
```
접속 20일:         20 💖
공유 5회:           5 💖
리뷰 3회:           3 💖
주간 보너스 ×2:     6 💖
─────────────────────
합계:             ~34 💖/월
```

**최소 사용자** (가끔 접속):
```
접속 10일:         10 💖
─────────────────────
합계:             ~10 💖/월
```

---

## 2. 재화 소비

### 2.1 공고 가격표

| 타입 | 비용 | 원화 환산 | 기간 |
|------|:----:|:---------:|------|
| regular (일반) | 1 | ₩300 | 7일 |
| urgent (긴급) | 8 | ₩2,400 | 7일 + 긴급탭 상단 노출 |
| fixed (고정) | 4 | ₩1,200 | 7일 |
| tournament (대회) | 관리자 책정 | - | 공고 마감까지 |
| 긴급 전환 | 8 | ₩2,400 | 즉시 |

**기간 연장** (+7일):

| 공고 타입 | 연장 비용 | 비고 |
|----------|:--------:|------|
| regular | 1 | 등록과 동일 |
| urgent | 8 | 등록과 동일 |
| fixed | 4 | 등록과 동일 |

> 💖 하트 또는 💎 다이아로 결제 가능 (하트 우선 차감)

### 2.2 스태프 프리미엄 기능

| 기능 | 비용 | 기간 | 설명 |
|------|:----:|------|------|
| 프로필 하이라이트 | 5 | 30일 | 지원 시 구인자에게 상단 표시 + 강조 테두리 |

**향후 검토** (Phase 2 이후):
- 지원 우선 알림: 3/30일 — 새 공고 30분 먼저 알림
- 경력 인증 뱃지: 10/영구 — 관리자 검증 후 인증 마크

### 2.3 밸런스 시뮬레이션

**구인자 — 보통 사용자 (월 10건 일반)**:
```
수입: ~34 💖 (주 5일 접속 + 공유 + 리뷰)
지출: 10건 × 1 = 10
─────────────────────
잔여: +24 → 긴급 3건(24) 또는 고정 6건(24) 가능
✅ 충전 없이 기본+알파 사용 가능
```

**구인자 — 최소 사용자 (월 10건 일반)**:
```
수입: ~10 💖 (가끔 접속)
지출: 10건 × 1 = 10
─────────────────────
잔여: 0 → 긴급/고정 쓰려면 충전 or 더 활동
```

**구인자 — 헤비 사용자 (월 20건 + 긴급 5건)**:
```
수입: ~77 💖 (적극 활동)
지출: 20건 × 1 + 5건 × 8 = 60
─────────────────────
잔여: +17 → 적극 활동하면 무료 유지 가능
```

**구인자 — 대량 사용자 (월 30건 + 긴급 10건)**:
```
수입: ~77 💖 (적극 활동 한계)
지출: 30건 × 1 + 10건 × 8 = 110
─────────────────────
부족: -33 → 다이아 충전 필요 (₩10,000 패키지)
💰 여기서 수익 발생
```

**스태프 — 프로필 하이라이트**:
```
수입: ~34 💖 (보통 활동)
지출: 5 (하이라이트 1회)
─────────────────────
잔여: +29 → 여유로움
```

---

## 3. 💎 다이아 충전 (유료)

### 충전 패키지 (최소 ₩3,000)

| 금액 | 기본 | 보너스 | 총 다이아 | 스토어 상품 ID |
|------|:----:|:------:|:---------:|----------------|
| ₩3,000 | 10 | - | 10 | `com.uniqn.diamond.10` |
| ₩5,000 | 17 | +1 | 18 (+6%) | `com.uniqn.diamond.18` |
| ₩10,000 | 33 | +2 | 35 (+6%) | `com.uniqn.diamond.35` |
| ₩30,000 | 100 | +10 | 110 (+10%) | `com.uniqn.diamond.110` |
| ₩50,000 | 167 | +23 | 190 (+14%) | `com.uniqn.diamond.190` |
| ₩100,000 | 333 | +67 | 400 (+20%) | `com.uniqn.diamond.400` |

**수수료 반영 실수령**:
| 금액 | Apple/Google 30% 공제 | 다이아당 실수입 |
|------|:--------------------:|:--------------:|
| ₩3,000 | ₩2,100 | ₩210 |
| ₩5,000 | ₩3,500 | ₩194 |
| ₩10,000 | ₩7,000 | ₩200 |
| ₩30,000 | ₩21,000 | ₩191 |
| ₩50,000 | ₩35,000 | ₩184 |
| ₩100,000 | ₩70,000 | ₩175 |

**첫 충전 보너스**: 최초 결제 시 +5💎 추가 지급

---

## 4. 무분별 공고 방지

| 장치 | 내용 |
|------|------|
| 재화 필수 | 💖 or 💎 없이 공고 등록 불가 → 활동 없는 계정 차단 |
| 일일 하트 상한 | 하루 최대 ~5💖 → 무한 벌기 불가 |
| 일일 등록 제한 | 하루 최대 10건 |
| 중복 공고 감지 | 동일 장소+날짜 공고 경고 |
| 신고 패널티 | 허위 공고 3회 경고, 5회 → 7일 등록 정지 |
| 본인인증 필수 | 공고 등록 시 본인인증 완료 필요 |

**스팸 시나리오 분석**:
```
스패머가 대량 공고를 올리려면:
- 매일 접속해도 월 ~30💖 = 일반 30건이 한계
- 긴급/고정은 하트 소모 크므로 제한적
- 그 이상은 돈을 써야 함 (₩3,000 = 10건 추가)
- 본인인증 + 신고 패널티로 이중 차단
→ 경제적 + 행동적 억제 효과
```

---

## 5. 재화 규칙

### 유형별 정책

| 유형 | 만료 | 환불 | 우선 사용 |
|------|------|------|----------|
| 💖 활동 하트 | 무기한 | 불가 | **1순위** |
| 💖 프로모션 하트 (일회성 보너스) | 60~90일 | 불가 | **1순위** (만료 임박 순) |
| 💎 다이아 | 무기한 | 7일 이내 가능 | 2순위 |

### 사용 우선순위
```
1. 프로모션 하트 (만료 임박 순)
2. 활동 하트
3. 💎 다이아
```

### 신규 사용자 시나리오

**새 구인자**:
```
가입
├─ 프로필 완성: +5💖 (프로모션, 90일)
├─ 본인인증: +5💖 (프로모션, 90일)
├─ 첫 공고 등록: +3💖 (프로모션, 90일)
└─ 매일 접속 3일: +3💖 (활동)
─────────────────────
첫 주 합계: 16💖 → 일반 공고 16건 등록 가능
충전 없이 충분한 체험 → 지속 사용 유도
```

**새 스태프**:
```
가입
├─ 프로필 완성: +5💖 (프로모션, 90일)
├─ 본인인증: +5💖 (프로모션, 90일)
├─ 첫 지원: +3💖 (프로모션, 90일)
└─ 매일 접속 3일: +3💖 (활동)
─────────────────────
첫 주 합계: 16💖 → 프로필 하이라이트(5) + 여유 11💖
```

---

## 6. Firestore 컬렉션

### heartBalances/{userId}
```typescript
{
  userId: string;
  hearts: number;                      // 활동 하트 (무기한)
  promoHearts: PromoHeartSlot[];       // 프로모션 하트 (만료 있음)
  totalHearts: number;                 // hearts + 유효 promo 합계 (캐시)
  totalEarned: number;                 // 누적 활동 획득량
  totalSpent: number;                  // 누적 하트 사용량
  // 일일 보상 추적
  lastLoginRewardAt: Timestamp | null;
  lastShareRewardAt: Timestamp | null;
  dailyReviewCount: number;
  dailyReviewResetAt: Timestamp;
  // 연속 접속
  loginStreak: number;
  lastLoginDate: string;              // YYYY-MM-DD
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface PromoHeartSlot {
  amount: number;
  reason: 'signup_profile' | 'signup_verify' | 'first_posting' | 'first_apply'
        | 'referral' | 'event';
  expiresAt: Timestamp;
  createdAt: Timestamp;
}
```

### diamondBalances/{userId}
```typescript
{
  userId: string;
  diamonds: number;                    // 유료 다이아 (무기한)
  totalPurchased: number;              // 누적 충전량
  totalSpent: number;                  // 누적 다이아 사용량
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### currencyTransactions/{txId}
```typescript
{
  id: string;
  userId: string;
  currency: 'heart' | 'diamond';
  type: 'earn' | 'spend' | 'promo_grant' | 'promo_expire' | 'purchase' | 'refund';
  amount: number;                      // 양수=획득, 음수=소모
  source?: 'login' | 'share' | 'review' | 'streak_7' | 'streak_30'
         | 'profile_complete' | 'identity_verify' | 'first_posting'
         | 'first_apply' | 'first_purchase' | 'referral';
  description: string;
  relatedEntityId?: string;
  relatedEntityType?: 'jobPosting' | 'purchase' | 'promo' | 'staffPremium' | 'review';
  balanceAfter: {
    hearts: number;
    promoHearts: number;
    diamonds: number;
    total: number;                     // hearts + promoHearts + diamonds
  };
  createdAt: Timestamp;
}
```

### purchases/{purchaseId}
```typescript
{
  id: string;
  userId: string;
  productId: string;                   // com.uniqn.diamond.35
  transactionId: string;               // RevenueCat 거래 ID (중복 방지)
  price: number;                       // ₩10,000
  diamondsGranted: number;             // 35 (보너스 포함)
  bonusDiamonds: number;               // 2
  isFirstPurchase: boolean;            // 첫 결제 여부 (보너스 +5💎)
  platform: 'ios' | 'android';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

---

## 7. Firestore Security Rules

```javascript
match /heartBalances/{userId} {
  allow read: if isSignedIn() && isOwner(userId);
  allow write: if false;
}

match /diamondBalances/{userId} {
  allow read: if isSignedIn() && isOwner(userId);
  allow write: if false;
}

match /currencyTransactions/{txId} {
  allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
  allow write: if false;
}

match /purchases/{purchaseId} {
  allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
  allow write: if false;
}
```

---

## 8. 데이터 흐름

### 8.1 일일 접속 보상 플로우
```
1. 앱 실행 (foreground)
2. heartRewardService.claimLoginReward(userId)
   ├─ lastLoginRewardAt이 오늘인지 확인
   ├─ 이미 받았으면 → skip
   ├─ 안 받았으면 → hearts + 1
   ├─ 연속 접속 판정 (lastLoginDate == 어제?)
   │   ├─ 연속이면 → loginStreak++
   │   │   ├─ loginStreak == 7 → +3💖 보너스
   │   │   └─ loginStreak == 30 → +10💖 보너스, streak 리셋
   │   └─ 끊겼으면 → loginStreak = 1
   └─ 트랜잭션 기록
3. UI: 접속 보상 토스트 + 잔액 갱신
```

### 8.2 공유 보상 플로우
```
1. 공고 공유 버튼 클릭
2. Share API 호출 (카카오톡/인스타 등)
3. 공유 완료 확인 → heartRewardService.claimShareReward(userId)
   ├─ lastShareRewardAt이 오늘인지 확인
   ├─ 이미 받았으면 → skip (일 1회)
   └─ 안 받았으면 → hearts + 1
4. 보상 토스트
```

### 8.3 리뷰 보상 플로우
```
1. 근무 완료 후 리뷰/평가 작성
2. 리뷰 저장 성공 → heartRewardService.claimReviewReward(userId)
   ├─ dailyReviewCount < 2 확인
   ├─ 상한 초과 → skip (일 2회)
   └─ 여유 있으면 → hearts + 1, dailyReviewCount++
3. 보상 토스트
```

### 8.4 공고 등록 플로우
```
1. 공고 등록 버튼 클릭
2. billingGateService.validateAndDeduct(userId, postingType)
   ├─ Feature Flag 확인 (enable_billing=false → 무료 통과)
   ├─ 필요 재화 계산 (postingType → cost)
   ├─ 사용 우선순위: 프로모션 하트 → 활동 하트 → 다이아
   ├─ 잔액(하트+다이아) 부족 → InsufficientCurrencyError
   │   └─ UI: "잔액이 부족합니다" + 활동/충전 안내
   └─ 차감 성공 (하트/다이아 혼합 가능)
3. jobManagementService.createJobPosting()
4. 성공: 토스트 + 잔액 UI 갱신
```

### 8.5 다이아 충전 플로우
```
1. 충전 패키지 선택
2. RevenueCat SDK 결제 시작
3. 스토어 결제 완료 → RevenueCat Webhook
4. Cloud Functions: 영수증 검증 + 다이아 지급 (트랜잭션)
   ├─ isFirstPurchase → 추가 +5💎 지급
   └─ balanceAfter 기록
5. 클라이언트: queryClient.invalidateQueries → 잔액 갱신
6. 성공 토스트
```

### 8.6 혼합 결제 예시
```
긴급 공고 등록 (비용: 8)
사용자 잔액: 💖 5 (하트) + 💎 10 (다이아)

차감 순서:
  1. 프로모션 하트: 0 (없음)
  2. 활동 하트: 5💖 차감 → 남은 비용 3
  3. 다이아: 3💎 차감

결과: 💖 0 + 💎 7
```

### 8.7 낙관적 업데이트 vs 서버 응답
- **하트 보상**: 낙관적 업데이트 (토스트 즉시) + 서버 확인
- **충전**: 서버 응답 대기 (결제 실패 시 롤백 방지)
- **사용**: 서버 응답 대기 (트랜잭션 정합성)
- **잔액 조회**: 캐시 사용 (staleTime: 30초)

---

## 9. 에러 처리

### 에러 코드 (E8xxx)
```typescript
BILLING_INSUFFICIENT_CURRENCY = 'E8001'   // 잔액 부족 (하트+다이아)
BILLING_PURCHASE_FAILED = 'E8002'         // 결제 실패
BILLING_PURCHASE_DUPLICATE = 'E8003'      // 중복 결제
BILLING_DEDUCTION_FAILED = 'E8004'        // 차감 실패
BILLING_REFUND_NOT_ALLOWED = 'E8005'      // 환불 불가
BILLING_DAILY_LIMIT_EXCEEDED = 'E8006'    // 일일 등록 제한 초과
BILLING_POSTING_SUSPENDED = 'E8007'       // 신고 누적으로 정지
BILLING_REWARD_ALREADY_CLAIMED = 'E8008'  // 이미 보상 수령 (일일 상한)
```

### 사용자 메시지
```typescript
E8001: '잔액이 부족합니다. 활동하거나 다이아를 충전해주세요.'
E8002: '결제에 실패했습니다. 다시 시도해주세요.'
E8003: '이미 처리된 결제입니다.'
E8006: '하루 등록 가능한 공고 수(10건)를 초과했습니다.'
E8007: '신고 누적으로 공고 등록이 일시 정지되었습니다.'
E8008: '오늘 보상을 이미 받았습니다.'
```

---

## 10. Feature Flag

```typescript
enable_billing: boolean;              // 마스터 스위치 (false → 전체 무료)
enable_heart_rewards: boolean;        // 하트 보상 시스템
enable_staff_premium: boolean;        // 스태프 프리미엄 기능
```

**출시 시 설정**:
```typescript
enable_billing: true          // 처음부터 재화 경제 활성화
enable_heart_rewards: true    // 하트 보상 활성화
enable_staff_premium: false   // MVP에서는 비활성
```

---

## 11. 수익 시뮬레이션

### 전제
```
- 활동 하트로 기본 사용 무료, 유료 전환은 헤비/비활성 유저
- 일반 공고 1💖이라 기본 사용자는 충전 불필요
- 수익 발생 지점: 대량 공고 + 긴급/고정 다수 사용
- 구인자 유료 전환율: 15~25%
- 스태프 유료 전환율: 5~10%
```

### 보수적 (구인자 100명, 스태프 300명)
```
구인자:
  유료 전환 15명 × 월 ₩5,000 = ₩75,000
스태프:
  유료 전환 15명 × 월 ₩3,000 = ₩45,000
스토어 수수료 30%: -₩36,000
─────────────────────
월 순수입: ~₩84,000
연 순수입: ~₩1,000,000
```

### 표준 (구인자 300명, 스태프 1,000명)
```
구인자:
  유료 전환 60명 × 월 ₩10,000 = ₩600,000
스태프:
  유료 전환 50명 × 월 ₩3,000 = ₩150,000
스토어 수수료 30%: -₩225,000
─────────────────────
월 순수입: ~₩525,000
연 순수입: ~₩6,300,000
```

### 낙관적 (구인자 500명, 스태프 2,000명)
```
구인자:
  유료 전환 125명 × 월 ₩15,000 = ₩1,875,000
스태프:
  유료 전환 200명 × 월 ₩3,000 = ₩600,000
스토어 수수료 30%: -₩742,500
─────────────────────
월 순수입: ~₩1,732,500
연 순수입: ~₩20,790,000
```

---

## 12. 구현 파일 목록

### 신규 생성
```
src/types/billing.ts                    # 타입 정의 (Heart, Diamond, Currency)
src/schemas/billingSchema.ts            # Zod 스키마
src/constants/billing.ts                # 가격, 보상, 상품 ID 상수
src/errors/BillingErrors.ts             # 에러 클래스

src/repositories/interfaces/ICurrencyRepository.ts
src/repositories/firebase/HeartRepository.ts
src/repositories/firebase/DiamondRepository.ts

src/services/billingGateService.ts      # 과금 게이트 (핵심) — 하트→다이아 순 차감
src/services/heartRewardService.ts      # 하트 보상 (접속/공유/리뷰/연속)
src/services/diamondService.ts          # 다이아 충전/조회
src/services/purchaseService.ts         # RevenueCat 연동

src/stores/billingStore.ts              # Zustand 스토어 (하트+다이아 통합)
src/hooks/useHearts.ts                  # 하트 잔액/보상 상태
src/hooks/useDiamonds.ts                # 다이아 잔액/이력
src/hooks/useBillingGate.ts             # 공고 등록 시 과금 확인
src/hooks/useDailyRewards.ts            # 일일 보상 수령

src/components/billing/
├── CurrencyBalance.tsx                 # 💖+💎 잔액 표시 (헤더용)
├── DailyRewardBanner.tsx               # 접속 보상 배너 + 연속 접속 표시
├── LoginStreakCard.tsx                  # 연속 접속 현황 카드
├── DiamondPackSelector.tsx             # 충전 패키지 선택
├── InsufficientCurrencyModal.tsx       # 잔액 부족 → 활동/충전 안내
├── CurrencyHistoryList.tsx             # 사용/획득 이력 (하트+다이아 통합)
└── PurchaseOverlay.tsx                 # 결제 진행 오버레이

app/(app)/settings/wallet.tsx           # 지갑 관리 화면 (하트+다이아)

functions/src/billing/revenueCatWebhook.ts    # 결제 웹훅
functions/src/billing/grantPromoHearts.ts     # 프로모션 하트 지급
functions/src/scheduled/expirePromoHearts.ts  # 프로모션 하트 만료
functions/src/scheduled/resetDailyRewards.ts  # 일일 보상 카운터 리셋
```

### 수정 필요
```
src/services/jobManagementService.ts    # billingGate 호출 삽입
src/services/featureFlagService.ts      # Feature Flag 3개 추가
src/constants/index.ts                  # COLLECTIONS 4개 추가
src/lib/queryClient.ts                  # queryKeys에 hearts, diamonds, rewards 추가
src/errors/BusinessErrors.ts            # 에러 클래스 추가
firestore.rules                         # 4개 컬렉션 보안 규칙
```

---

## 13. 구현 순서

### Phase 1: 재화 경제 기반 — 1주
```
1. 타입/스키마/상수/에러 정의
2. Feature Flag 추가
3. Firestore 컬렉션 + Security Rules
4. HeartRepository, DiamondRepository 구현
5. heartRewardService (접속/공유/리뷰/연속 보상)
6. billingGateService (하트→다이아 순 차감)
7. jobManagementService에 billingGate 연동
```

### Phase 2: 프론트엔드 — 1주
```
8. billingStore (Zustand — 하트+다이아 통합)
9. useHearts, useDiamonds, useBillingGate, useDailyRewards 훅
10. UI: 잔액(💖+💎), 접속 보상 배너, 연속 접속, 부족 모달, 이력
11. 지갑 관리 화면
```

### Phase 3: 결제 연동 — 1주
```
12. RevenueCat SDK 설치 + 초기화
13. purchaseService, diamondService 구현
14. Cloud Functions (웹훅, 프로모션 하트 지급/만료, 보상 리셋)
15. Sandbox 테스트
```

### Phase 4: 부가 기능 — 1주
```
16. 스태프 프로필 하이라이트 (enable_staff_premium)
17. 관리자 재화 수동 지급
18. 환불 처리
19. Analytics 이벤트 (충전/보상/사용 추적)
```

---

## 14. 환불 정책

- 💎 다이아만 환불 가능
- 💖 하트 (활동/프로모션): 환불/현금 전환 불가
- 미사용 다이아: 충전 후 7일 이내 전액 환불
- 사용 후: 환불 불가
- Apple/Google 직접 환불 시: Cloud Functions에서 다이아 회수 (clawback)
  - 잔액 < 회수량: 잔액 0으로 설정 + 마이너스 기록

---

## 15. 검증 방법

```bash
cd uniqn-mobile
npm run type-check   # TypeScript 검증
npm run lint         # ESLint
npm run test         # 단위 테스트
npm run build:web    # 빌드 확인
```

- `enable_billing=false` → 기존 기능 영향 없는지 확인
- 하트 보상: 접속 → +1💖, 재접속 → 중복 지급 없음
- 연속 접속: 7일/30일 보너스 정상 지급
- 혼합 결제: 하트 5 + 다이아 3 = 비용 8 정상 차감
- 공고 등록: 잔액 부족 시 차단 + 안내 모달
- Sandbox 결제 → 다이아 지급 → 공고 등록 전체 플로우 테스트

---

## 참조 파일
- `src/repositories/firebase/ApplicationRepository.ts` - 트랜잭션 패턴
- `src/stores/authStore.ts` - Zustand + MMKV persist
- `src/services/jobManagementService.ts` - 공고 생성 로직
- `src/services/featureFlagService.ts` - Feature Flag 인터페이스
- `src/constants/index.ts` - COLLECTIONS 상수
- `src/lib/queryClient.ts` - Query Keys 관리
- `src/errors/BusinessErrors.ts` - 에러 클래스 패턴
- `firestore.rules` - Security Rules 패턴

---

*마지막 업데이트: 2026-02-11*
*버전: v4.0 (💖 하트 + 💎 다이아 이중 재화 시스템)*

