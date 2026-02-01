# 💼 포인트 시스템 운영 가이드

**최종 업데이트**: 2026년 2월 1일
**버전**: v2.0.0 (하트/다이아 포인트 시스템)
**상태**: 🔧 **개발 중**
**프로젝트**: UNIQN 포인트 시스템

---

## 📋 목차

1. [운영 개요](#-운영-개요)
2. [하트/다이아 시스템](#-하트다이아-시스템)
3. [RevenueCat 운영](#-revenuecat-운영)
4. [환불 처리 절차](#-환불-처리-절차)
5. [사기/어뷰징 대응](#-사기어뷰징-대응)
6. [모니터링 및 알림](#-모니터링-및-알림)
7. [긴급 대응 절차](#-긴급-대응-절차)
8. [일상 운영 작업](#-일상-운영-작업)
9. [데이터 관리](#-데이터-관리)
10. [고객 지원](#-고객-지원)

---

## 🎯 운영 개요

### 운영 목표

- **가용성**: 99.9% 이상 서비스 가용성 유지
- **응답 시간**: 환불 요청 처리 24시간 이내 (스토어 정책에 따름)
- **보안**: 사기 거래 0% 달성
- **고객 만족**: 불만 사항 48시간 이내 해결

### 운영 조직

| 역할 | 책임 | 근무 시간 |
|------|------|-----------|
| **시스템 관리자** | 시스템 모니터링, 긴급 대응 | 24/7 |
| **포인트 담당자** | 하트 지급, 다이아 충전 이슈 처리 | 평일 09:00-18:00 |
| **보안 담당자** | 사기/어뷰징 탐지 및 대응 | 평일 09:00-18:00 |
| **고객 지원** | 고객 문의 응대 | 평일 09:00-18:00 |

### 주요 도구

- **Firebase Console**: Firestore 데이터 관리, Functions 모니터링
- **Google Cloud Console**: Cloud Scheduler, Logging, Monitoring
- **RevenueCat Dashboard**: 결제 내역 조회, 구독 관리
- **App Store Connect**: iOS 환불 처리
- **Google Play Console**: Android 환불 처리

---

## 💎 하트/다이아 시스템

### 포인트 개요

```yaml
💖 하트 (Heart):
  가치: ₩300/개
  획득: 무료 (출석, 이벤트, 리뷰, 초대)
  만료: 획득 후 90일
  용도: 공고 등록 비용

💎 다이아 (Diamond):
  가치: ₩300/개
  획득: 유료 충전 (RevenueCat IAP)
  만료: 없음 (영구)
  용도: 공고 등록 비용

사용 우선순위:
  1. 하트 먼저 차감 (만료 임박 순)
  2. 하트 부족 시 다이아 차감
```

### 공고별 비용

| 공고 타입 | 비용 (포인트) | 원화 환산 | 기간 |
|----------|-------------|----------|------|
| 일반 (Regular) | 1 💎 | ₩300 | 7일 |
| 긴급 (Urgent) | 10 💎 | ₩3,000 | 7일 |
| 고정 (Fixed) | 5 💎/주 | ₩1,500/주 | 7일 |
| 대회 (Tournament) | 협의 | - | 대회기간 |

### 하트 획득 방법

| 이벤트 | 보상 | 주기 |
|--------|------|------|
| 첫 가입 | +10 💖 | 1회 |
| 일일 출석 | +1 💖 | 매일 |
| 7일 연속 출석 | +3 💖 | 주간 |
| 근무 리뷰 작성 | +1 💖 | 건당 |
| 친구 초대 | +5 💖 | 건당 |

### 다이아 충전 패키지

| 가격 | 기본 | 보너스 | 총 다이아 | 보너스율 |
|------|------|--------|----------|---------|
| ₩1,000 | 3 💎 | - | **3 💎** | - |
| ₩3,000 | 10 💎 | - | **10 💎** | - |
| ₩10,000 | 33 💎 | +2 💎 | **35 💎** | +6% |
| ₩30,000 | 100 💎 | +10 💎 | **110 💎** | +10% |
| ₩50,000 | 167 💎 | +23 💎 | **190 💎** | +14% |
| ₩100,000 | 333 💎 | +67 💎 | **400 💎** | +20% |

### Firestore 구조

```typescript
// users/{userId}
{
  points: {
    hearts: number,          // 총 하트 잔액 (heartBatches 합계)
    diamonds: number,        // 총 다이아 잔액
    updatedAt: Timestamp
  }
}

// users/{userId}/heartBatches/{batchId}
{
  amount: number,            // 획득 수량
  remainingAmount: number,   // 남은 수량
  source: HeartSource,       // 획득 경로
  acquiredAt: Timestamp,     // 획득일
  expiresAt: Timestamp       // 만료일 (획득일 + 90일)
}

// purchases/{purchaseId}
{
  userId: string,
  packageId: 'starter' | 'basic' | 'popular' | 'premium',
  diamonds: number,
  bonusDiamonds: number,
  totalDiamonds: number,
  price: number,
  revenueCatTransactionId: string,
  store: 'app_store' | 'play_store',
  productId: string,
  environment: 'sandbox' | 'production',
  status: 'pending' | 'completed' | 'failed' | 'refunded',
  createdAt: Timestamp,
  completedAt?: Timestamp
}

// users/{userId}/pointTransactions/{transactionId}
{
  type: 'earn' | 'spend' | 'refund' | 'expire',
  pointType: 'heart' | 'diamond',
  amount: number,
  source?: HeartSource,
  purchaseId?: string,
  jobPostingId?: string,
  postingType?: 'regular' | 'urgent' | 'fixed',
  balanceAfter: { hearts: number, diamonds: number },
  createdAt: Timestamp,
  description?: string
}
```

---

## 🔄 RevenueCat 운영

### RevenueCat 설정

```yaml
앱 등록:
  iOS: com.uniqn.app (App Store Connect 연동)
  Android: com.uniqn.app (Google Play Console 연동)

상품 ID:
  - com.uniqn.diamond.1000 (₩1,000 - 3💎)
  - com.uniqn.diamond.3000 (₩3,000 - 10💎)
  - com.uniqn.diamond.10000 (₩10,000 - 35💎)
  - com.uniqn.diamond.30000 (₩30,000 - 110💎)
  - com.uniqn.diamond.50000 (₩50,000 - 190💎)
  - com.uniqn.diamond.100000 (₩100,000 - 400💎)

Webhook:
  URL: https://us-central1-tholdem-ebc18.cloudfunctions.net/handleRevenueCatWebhook
  Events: INITIAL_PURCHASE, NON_RENEWING_PURCHASE, REFUND
```

### RevenueCat Dashboard 확인

**일일 점검 항목**:
1. **Overview** → 매출 추이, 활성 구독자 (해당 시 확인)
2. **Transactions** → 최근 거래 내역 확인
3. **Events** → Webhook 이벤트 상태 확인
4. **Errors** → API 에러, Webhook 실패 확인

### Webhook 처리

```typescript
// Cloud Functions: handleRevenueCatWebhook

지원 이벤트:
- INITIAL_PURCHASE: 첫 구매 → 다이아 지급
- NON_RENEWING_PURCHASE: 일회성 구매 → 다이아 지급
- REFUND: 환불 → 다이아 차감

처리 순서:
1. 서명 검증 (x-revenuecat-signature)
2. 이벤트 타입별 분기
3. Firestore 트랜잭션으로 포인트 업데이트
4. 구매/거래 기록 저장
5. 응답 200 OK
```

### 결제 오류 대응

| 오류 | 원인 | 대응 |
|------|------|------|
| `PRODUCT_NOT_AVAILABLE` | 상품 미등록 | 스토어 콘솔에서 상품 확인 |
| `PURCHASE_CANCELLED` | 사용자 취소 | 정상 처리, 별도 조치 불필요 |
| `PURCHASE_PENDING` | 결제 대기 | 자동 처리 대기 |
| `PAYMENT_PENDING` | 결제 승인 대기 | 사용자에게 안내 |
| `STORE_PROBLEM` | 스토어 오류 | 재시도 안내 |

---

## 💸 환불 처리 절차

### 환불 정책

```yaml
스토어 환불:
  - iOS: Apple 정책에 따름 (14일 이내 환불 요청)
  - Android: Google 정책에 따름 (48시간 이내 즉시 환불, 이후 검토)

앱 내 환불:
  - 기술적 문제로 다이아 미지급 시 수동 지급
  - 중복 결제 시 환불 처리

다이아 차감:
  - 스토어 환불 시 자동 차감 (RevenueCat Webhook)
  - 이미 사용한 다이아는 차감 후 마이너스 가능
```

### 1. 스토어 환불 (자동 처리)

**RevenueCat Webhook → REFUND 이벤트**:

```typescript
// 자동 처리 흐름
1. RevenueCat에서 REFUND 이벤트 수신
2. 해당 구매 건의 다이아 수량 확인
3. Firestore 트랜잭션:
   - users/{userId}.points.diamonds 차감
   - purchases/{purchaseId}.status = 'refunded'
   - pointTransactions 기록 추가
4. 사용자에게 알림 (선택)
```

### 2. 수동 환불 (관리자 처리)

**Admin 페이지** → **결제 관리** → **환불 처리**

```yaml
수동 환불 필요 케이스:
  - Webhook 처리 실패
  - 중복 결제 감지
  - 고객 민원 접수 후 스토어 환불 미반영

처리 절차:
  1. purchases 컬렉션에서 해당 거래 확인
  2. 다이아 잔액 확인 (마이너스 가능)
  3. 수동 차감 + 거래 기록
  4. 고객에게 결과 안내
```

### 3. 하트 환불/취소

```yaml
하트는 환불 불가:
  - 무료 획득이므로 현금 환급 대상 아님
  - 만료된 하트는 복구 불가

예외 케이스:
  - 시스템 오류로 하트 미지급 시 수동 지급
  - 잘못된 차감 시 수동 복구
```

---

## 🚨 사기/어뷰징 대응

### 1. 사기 패턴 탐지

**자동 탐지 규칙**:

| 패턴 | 탐지 조건 | 조치 |
|------|----------|------|
| 결제 후 즉시 환불 | 구매 후 24시간 내 환불 3회 | 경고 |
| 다중 계정 출석 체크 | 동일 IP에서 3개+ 계정 출석 | 조사 |
| 초대 보상 어뷰징 | 같은 기기에서 초대 5건+ | 차단 |
| 비정상 하트 획득 | 일일 하트 20개+ | 조사 |

**수동 검토 필요 케이스**:
- 환불 요청 월 3회 이상
- 동일 결제 수단으로 여러 계정 결제
- 급격한 하트 잔액 증가

### 2. 조사 절차

**Firestore 쿼리**:

```typescript
// 사용자 결제 이력
const purchases = await db.collection('purchases')
  .where('userId', '==', suspiciousUserId)
  .orderBy('createdAt', 'desc')
  .get();

// 하트 획득 이력
const heartBatches = await db.collection('users')
  .doc(suspiciousUserId)
  .collection('heartBatches')
  .orderBy('acquiredAt', 'desc')
  .get();

// 포인트 거래 내역
const transactions = await db.collection('users')
  .doc(suspiciousUserId)
  .collection('pointTransactions')
  .orderBy('createdAt', 'desc')
  .get();
```

### 3. 대응 조치

**경고 → 정지 → 영구 차단**:

```typescript
// users/{userId}
{
  accountStatus: 'active' | 'warned' | 'suspended' | 'banned',
  warningCount: number,
  warningReasons: string[],
  suspendedAt?: Timestamp,
  suspendedReason?: string,
  bannedAt?: Timestamp,
  bannedReason?: string
}
```

| 단계 | 조건 | 조치 |
|------|------|------|
| 경고 | 첫 번째 의심 활동 | 알림 발송 |
| 일시 정지 | 경고 3회 또는 심각한 어뷰징 | 7일 정지 |
| 영구 차단 | 반복 어뷰징 또는 사기 확정 | 계정 영구 차단 |

---

## 📊 모니터링 및 알림

### 1. RevenueCat 모니터링

**RevenueCat Dashboard** → **Charts**:

- **Revenue**: 일일/주간/월간 매출
- **Transactions**: 거래 건수 추이
- **Active Subscribers**: (구독 모델 사용 시)
- **Churn Rate**: (구독 모델 사용 시)

### 2. Firebase 모니터링

**Cloud Functions**:

```bash
# 함수별 로그 확인
gcloud functions logs read handleRevenueCatWebhook --limit 50
gcloud functions logs read grantHearts --limit 50
gcloud functions logs read deductPoints --limit 50
```

**알림 설정**:

| 조건 | 알림 |
|------|------|
| Webhook 함수 에러율 > 1% | Slack + 이메일 |
| 일일 매출 50% 감소 | 이메일 |
| 대량 환불 (10건+/시간) | Slack + SMS |

### 3. Scheduled Functions 모니터링

```yaml
일일 실행:
  - cleanupExpiredHearts (00:00 KST): 만료 하트 정리
  - heartExpiry7Days (09:00 KST): 7일 전 만료 알림
  - heartExpiry3Days (09:00 KST): 3일 전 만료 알림
  - heartExpiryToday (09:00 KST): 당일 만료 알림
  - dailyAttendanceReset (00:00 KST): 출석 체크 리셋

확인 방법:
  Google Cloud Console → Cloud Scheduler → 각 작업 실행 이력
```

---

## 🚑 긴급 대응 절차

### 1. RevenueCat Webhook 장애

**증상**:
- 결제 완료 후 다이아 미지급
- RevenueCat 이벤트 실패 로그

**대응**:

```bash
# Step 1: Webhook 로그 확인
gcloud functions logs read handleRevenueCatWebhook --limit 100

# Step 2: RevenueCat 대시보드에서 이벤트 재전송
RevenueCat Dashboard → Events → 실패 이벤트 → Retry

# Step 3: 수동 다이아 지급 (필요 시)
Admin 페이지 → 사용자 관리 → 다이아 수동 지급
```

### 2. 하트 만료 처리 장애

**증상**:
- 만료된 하트가 사용 가능 상태
- cleanupExpiredHearts 함수 실패

**대응**:

```bash
# Step 1: Scheduler 상태 확인
gcloud scheduler jobs describe cleanupExpiredHearts

# Step 2: 수동 실행
gcloud scheduler jobs run cleanupExpiredHearts

# Step 3: 함수 로그 확인
gcloud functions logs read cleanupExpiredHearts --limit 50
```

### 3. 대량 어뷰징 공격

**증상**:
- 짧은 시간 내 대량 하트 획득
- 동일 IP/기기에서 다수 계정 활동

**대응**:

```yaml
즉시 조치:
  1. 의심 계정 일괄 정지
  2. IP/기기 블랙리스트 추가
  3. 하트 획득 기능 일시 중단 (Feature Flag)

조사:
  1. 영향 받은 계정 목록 추출
  2. 부정 획득 하트 일괄 차감
  3. 재발 방지 규칙 강화
```

---

## 🔧 일상 운영 작업

### 매일 작업

#### 09:00 - 대시보드 확인

- [ ] RevenueCat 전일 매출 확인
- [ ] Firebase Functions 에러율 확인
- [ ] Scheduled Functions 실행 확인
- [ ] 고객 문의 확인

#### 10:00, 15:00 - 결제 이슈 처리

- [ ] 다이아 미지급 건 확인 및 처리
- [ ] 환불 요청 검토
- [ ] 어뷰징 의심 계정 조사

### 매주 작업

#### 월요일 - 주간 리포트

```markdown
# 주간 포인트 시스템 리포트 (YYYY-MM-DD ~ YYYY-MM-DD)

## 매출 통계
- 총 결제 건수: XXX건
- 총 매출: ₩XXX,XXX
- 패키지별 판매:
  - 스타터: XX건 (₩XX,XXX)
  - 베이직: XX건 (₩XX,XXX)
  - 인기: XX건 (₩XX,XXX)
  - 프리미엄: XX건 (₩XX,XXX)

## 하트 통계
- 총 하트 지급: XXX개
- 출석 보상: XXX개
- 초대 보상: XXX개
- 만료된 하트: XXX개

## 공고 등록 통계
- 총 공고 등록: XXX건
- 포인트 소비: XXX 포인트

## 환불/이슈
- 스토어 환불: XX건 (₩XX,XXX)
- 어뷰징 의심: XX건
```

#### 금요일 - 보안 점검

- [ ] 어뷰징 의심 계정 목록 검토
- [ ] 블랙리스트 업데이트
- [ ] 하트 획득 패턴 분석

### 매월 작업

#### 1일 - 월간 정산

- [ ] 월간 매출 보고서 작성
- [ ] RevenueCat → 스토어 정산 확인
- [ ] 앱스토어 수수료 (15-30%) 차감 확인

#### 15일 - 시스템 점검

- [ ] Scheduled Functions 점검
- [ ] Firebase 사용량 확인
- [ ] RevenueCat API 키 로테이션 (필요 시)

---

## 💾 데이터 관리

### 백업 정책

```yaml
자동 백업 (Firestore Export):
  - 매일 02:00 KST
  - 보관: 30일

백업 대상:
  - purchases
  - users (points 필드 포함)
  - users/*/heartBatches
  - users/*/pointTransactions
```

### 데이터 정리

```yaml
정리 대상:
  - 만료된 heartBatches (90일 후)
  - 오래된 pointTransactions (1년 후)

정리 방법:
  - Cloud Scheduler → archiveOldData 함수 실행
  - Cloud Storage로 아카이브 후 Firestore에서 삭제
```

### 복구 절차

```bash
# 특정 시점으로 복구
gcloud firestore import gs://tholdem-ebc18-backups/YYYYMMDD

# 특정 컬렉션만 복구
gcloud firestore import gs://tholdem-ebc18-backups/YYYYMMDD \
  --collection-ids=purchases
```

---

## 👥 고객 지원

### FAQ

#### Q1: 결제했는데 다이아가 안 들어왔어요!

**A**:
1. 앱을 새로고침해주세요 (pull to refresh)
2. 결제 내역에서 '구매 복원' 버튼 탭
3. 여전히 안 들어온 경우 → 고객 지원 문의

**운영 조치**:
- RevenueCat 대시보드에서 거래 확인
- Webhook 이벤트 상태 확인
- 필요 시 수동 지급

#### Q2: 하트가 사라졌어요!

**A**:
- 하트는 획득 후 90일이 지나면 자동 만료됩니다
- 마이페이지 → 포인트 내역에서 만료 일정 확인 가능

#### Q3: 환불은 어떻게 하나요?

**A**:
- iOS: 설정 → Apple ID → 구독 → UNIQN → 환불 요청
- Android: Google Play → 결제 내역 → 환불 요청
- 처리 기간: 스토어 정책에 따름 (3-7일)

#### Q4: 공고 등록했는데 포인트가 안 빠졌어요

**A**:
- 무료 기간 중에는 포인트가 차감되지 않습니다 (2026-07-01까지)
- 무료 기간 종료 후 정상 차감됩니다

### 응답 템플릿

**결제 이슈**:
```
안녕하세요, UNIQN 고객지원입니다.

결제 내역 확인 결과, [거래 ID]로 [금액]원 결제가 정상 처리되었으나
다이아 지급에 오류가 발생한 것으로 확인됩니다.

현재 [X개] 다이아를 수동 지급 완료하였으며,
앱을 새로고침하시면 확인하실 수 있습니다.

불편을 드려 죄송합니다.
```

**환불 안내**:
```
안녕하세요, UNIQN 고객지원입니다.

다이아 환불은 각 스토어(Apple/Google) 정책에 따라 처리됩니다.

[iOS]
설정 → Apple ID → 구독 → UNIQN → 문제 신고

[Android]
Google Play → 계정 → 결제 및 구독 → 예산 및 내역 → 환불 요청

처리 기간은 스토어 정책에 따라 3-7일 소요될 수 있습니다.

감사합니다.
```

---

## 📝 부록

### A. 운영 체크리스트

#### 일일 체크리스트

- [ ] RevenueCat 대시보드 - 매출/에러 확인
- [ ] Cloud Functions 에러율 확인 (< 1%)
- [ ] Scheduled Functions 실행 확인
- [ ] 고객 문의 응대

#### 주간 체크리스트

- [ ] 주간 매출 리포트 작성
- [ ] 어뷰징 의심 계정 조사
- [ ] 환불 건 분석

#### 월간 체크리스트

- [ ] 월간 정산 보고서 작성
- [ ] 데이터 아카이브 실행
- [ ] Scheduled Functions 점검
- [ ] API 키 로테이션 검토

### B. 긴급 연락처

| 역할 | 연락처 |
|------|--------|
| 시스템 관리자 | admin@uniqn.com |
| RevenueCat 지원 | support@revenuecat.com |
| Firebase 지원 | firebase-support@google.com |
| Apple 개발자 지원 | https://developer.apple.com/contact/ |
| Google Play 지원 | https://support.google.com/googleplay/android-developer/ |

### C. 관련 문서

- [포인트 시스템 설계](../features/payment/CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md)
- [결제 시스템 개발](../features/payment/PAYMENT_SYSTEM_DEVELOPMENT.md)
- [데이터 스키마](../reference/DATA_SCHEMA.md)
- [보안 가이드](./SECURITY.md)

---

**문서 버전**: v2.0.0
**최종 업데이트**: 2026-02-01
**작성자**: UNIQN 개발팀
