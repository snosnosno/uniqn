> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 결제/포인트 운영 초안과 대응 기록입니다.
> 현재 기준 문서는 `docs/README.md`와 배포 중인 실제 코드/Functions export를 우선 확인하세요.

# 💼 포인트 시스템 운영 가이드

**최종 업데이트**: 2026-04-18 (Supabase 이전 반영)
**버전**: v2.1.0 (하트/다이아 포인트 시스템, Supabase 기반)
**상태**: 📋 **운영 초안 / 미구현**
**프로젝트**: UNIQN 포인트 시스템

> ⚠️ 현재 저장소의 런타임 코드에는 이 문서가 전제하는 결제/포인트 흐름이 완전히 구현되어 있지 않습니다.
> 이 문서는 운영 초안입니다.
>
> ⚠️ 2026년 3월 26일 기준 `cleanupExpiredHearts`, `heartExpiry7Days`, `heartExpiry3Days`, `heartExpiryToday`, `dailyAttendanceReset`, `archiveOldData`는 과거 Firebase Functions 설계에 정의되어 있었으나 현재 Supabase Edge Functions 배포 목록에는 존재하지 않습니다.
> 아래 pg_cron 예시는 운영 중인 실제 배포 상태가 아니라 결제 시스템 초안에 남아 있는 레거시 설계 예시로 취급하세요.
> 현재 감사 로그 영향 판단과 후속 계획은 [2026-03-26-cloud-scheduler-audit-log-response.md](./2026-03-26-cloud-scheduler-audit-log-response.md)를 기준으로 확인합니다 (Firebase Cloud Scheduler 기준 당시 기록).
>
> **📋 관련 문서**:
> - 📊 **포인트 정의 & 가격표 (마스터)**: [MODEL_B_CHIP_SYSTEM_FINAL.md](../features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md)
> - 🔧 **기술 아키텍처/API**: [PAYMENT_SYSTEM_DEVELOPMENT.md](../features/payment/PAYMENT_SYSTEM_DEVELOPMENT.md)
> - 💻 **구현 가이드**: [CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md](../features/payment/CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md)
>
> 포인트 정의, 패키지, 획득표 등 기획 정보는 마스터 문서를 참조하세요.

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

- **Supabase Dashboard**: PostgreSQL 데이터 관리, Edge Functions 모니터링, Logs, pg_cron 작업 관리
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

### PostgreSQL 스키마

```sql
-- users 테이블 (points 필드는 별도 컬럼)
-- hearts_balance / diamonds_balance: 총 잔액 (heart_batches 합계)
-- points_updated_at: 포인트 갱신 시각

-- heart_batches 테이블
CREATE TABLE heart_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,                   -- 획득 수량
  remaining_amount integer NOT NULL,         -- 남은 수량
  source text NOT NULL,                      -- HeartSource (signup/daily/review/invite 등)
  acquired_at timestamptz NOT NULL DEFAULT now(),  -- 획득일
  expires_at timestamptz NOT NULL            -- 만료일 (acquired_at + 90 days)
);

-- purchases 테이블
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  package_id text CHECK (package_id IN ('starter','basic','popular','premium')),
  diamonds integer NOT NULL,
  bonus_diamonds integer DEFAULT 0,
  total_diamonds integer NOT NULL,
  price integer NOT NULL,
  revenuecat_transaction_id text UNIQUE,
  store text CHECK (store IN ('app_store','play_store')),
  product_id text NOT NULL,
  environment text CHECK (environment IN ('sandbox','production')),
  status text CHECK (status IN ('pending','completed','failed','refunded')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- point_transactions 테이블
CREATE TABLE point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text CHECK (type IN ('earn','spend','refund','expire')),
  point_type text CHECK (point_type IN ('heart','diamond')),
  amount integer NOT NULL,
  source text,
  purchase_id uuid REFERENCES purchases(id),
  job_posting_id uuid REFERENCES job_postings(id),
  posting_type text CHECK (posting_type IN ('regular','urgent','fixed')),
  balance_hearts_after integer NOT NULL,
  balance_diamonds_after integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  description text
);
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
  URL: https://<supabase-project-ref>.supabase.co/functions/v1/handleRevenueCatWebhook
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
// Supabase Edge Function: handleRevenueCatWebhook
// 경로: uniqn-mobile/supabase/functions/handleRevenueCatWebhook/index.ts

지원 이벤트:
- INITIAL_PURCHASE: 첫 구매 → 다이아 지급
- NON_RENEWING_PURCHASE: 일회성 구매 → 다이아 지급
- REFUND: 환불 → 다이아 차감

처리 순서:
1. 서명 검증 (x-revenuecat-signature)
2. 이벤트 타입별 분기
3. PostgreSQL 트랜잭션으로 포인트 업데이트 (RPC 함수 또는 Service Role 사용)
4. 구매/거래 기록 저장 (purchases, point_transactions 테이블)
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
3. PostgreSQL 트랜잭션 (RPC 함수 내부):
   - users.diamonds_balance 차감
   - purchases.status = 'refunded'
   - point_transactions 기록 추가
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
  1. purchases 테이블에서 해당 거래 확인
  2. 다이아 잔액 확인 (마이너스 가능)
  3. 수동 차감 + 거래 기록 (point_transactions INSERT)
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

**PostgreSQL 쿼리** (Supabase Dashboard → SQL Editor 또는 `supabase.from()`):

```typescript
// 사용자 결제 이력
const { data: purchases } = await supabase
  .from('purchases')
  .select('*')
  .eq('user_id', suspiciousUserId)
  .order('created_at', { ascending: false });

// 하트 획득 이력
const { data: heartBatches } = await supabase
  .from('heart_batches')
  .select('*')
  .eq('user_id', suspiciousUserId)
  .order('acquired_at', { ascending: false });

// 포인트 거래 내역
const { data: transactions } = await supabase
  .from('point_transactions')
  .select('*')
  .eq('user_id', suspiciousUserId)
  .order('created_at', { ascending: false });
```

### 3. 대응 조치

**경고 → 정지 → 영구 차단**:

```sql
-- users 테이블 스키마 (부정 계정 관리 컬럼)
-- account_status: 'active' | 'warned' | 'suspended' | 'banned'
-- warning_count: integer
-- warning_reasons: text[]
-- suspended_at: timestamptz
-- suspended_reason: text
-- banned_at: timestamptz
-- banned_reason: text
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

### 2. Supabase 모니터링

**Edge Functions**:

```bash
# 함수별 로그 확인
npx supabase functions logs handleRevenueCatWebhook
npx supabase functions logs grantHearts
npx supabase functions logs deductPoints
```

또는 Supabase Dashboard → Edge Functions → Logs에서 실시간 스트림 확인.

**알림 설정**:

| 조건 | 알림 |
|------|------|
| Edge Function 에러율 > 1% | Slack + 이메일 |
| 일일 매출 50% 감소 | 이메일 |
| 대량 환불 (10건+/시간) | Slack + SMS |

### 3. Scheduled (pg_cron) 모니터링

> 참고: 아래 작업명은 현재 Supabase 배포 기준 활성 pg_cron 작업 목록이 아닙니다.
> 현재 활성 scheduled 작업은 Cloud Scheduler 감사 로그 대응 기록 문서(당시 Firebase 기반)를 기준으로 확인하고, Supabase 이전 이후 재등록된 pg_cron 작업만 신뢰합니다.

```yaml
일일 실행 (pg_cron):
  - cleanupExpiredHearts (00:00 KST): 만료 하트 정리
  - heartExpiry7Days (09:00 KST): 7일 전 만료 알림
  - heartExpiry3Days (09:00 KST): 3일 전 만료 알림
  - heartExpiryToday (09:00 KST): 당일 만료 알림
  - dailyAttendanceReset (00:00 KST): 출석 체크 리셋

확인 방법:
  Supabase Dashboard → Database → Cron Jobs → 각 작업 실행 이력
  또는 SQL: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;
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
npx supabase functions logs handleRevenueCatWebhook

# Step 2: RevenueCat 대시보드에서 이벤트 재전송
RevenueCat Dashboard → Events → 실패 이벤트 → Retry

# Step 3: 수동 다이아 지급 (필요 시)
Admin 페이지 → 사용자 관리 → 다이아 수동 지급
```

### 2. 하트 만료 처리 장애

> 참고: 아래 `cleanupExpiredHearts` 대응 절차는 결제 시스템 초안 기준 레거시 예시입니다.
> 현재 배포 함수 기준 장애 대응 문서로 사용하지 않습니다.

**증상**:
- 만료된 하트가 사용 가능 상태
- cleanupExpiredHearts pg_cron 작업 실패

**대응**:

```sql
-- Step 1: pg_cron 작업 상태 확인
SELECT * FROM cron.job WHERE jobname = 'cleanupExpiredHearts';
SELECT * FROM cron.job_run_details
  WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanupExpiredHearts')
  ORDER BY start_time DESC LIMIT 10;

-- Step 2: 수동 실행 (해당 함수를 직접 호출)
SELECT cleanup_expired_hearts();
```

```bash
# Step 3: Edge Function 로그 확인 (Edge Function에서 호출하는 경우)
npx supabase functions logs cleanupExpiredHearts
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
- [ ] Supabase Edge Functions 에러율 확인
- [ ] pg_cron 작업 실행 확인 (`cron.job_run_details`)
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

- [ ] pg_cron 작업 점검
- [ ] Supabase 사용량 확인 (DB 크기, Edge Function 호출 수, Auth MAU)
- [ ] RevenueCat API 키 로테이션 (필요 시)

---

## 💾 데이터 관리

### 백업 정책

```yaml
자동 백업 (Supabase PITR / Daily Backup):
  - 매일 02:00 KST (Pro 플랜 이상 자동)
  - 보관: 플랜별 (Free 7일 / Pro 7일 / Team 14일 / Enterprise 30일)
  - PITR (Point-in-Time Recovery): Pro 플랜 이상 지원

백업 대상 (PostgreSQL 전체 DB):
  - purchases 테이블
  - users 테이블 (hearts_balance, diamonds_balance 컬럼 포함)
  - heart_batches 테이블
  - point_transactions 테이블
```

### 데이터 정리

> 참고: `archiveOldData`는 현재 저장소/배포 기준 활성 pg_cron 작업이 아닙니다.
> 아래 절차는 운영 중인 실제 pg_cron 작업 목록이 아니라 결제 시스템 초안 메모입니다.

```yaml
정리 대상:
  - 만료된 heart_batches (90일 후)
  - 오래된 point_transactions (1년 후)

정리 방법:
  - pg_cron → archive_old_data() PostgreSQL 함수 실행
  - Supabase Storage로 아카이브 후 PostgreSQL에서 삭제
```

### 복구 절차

```bash
# Supabase Dashboard → Database → Backups
# - 일일 백업: 특정 날짜 선택 후 Restore
# - PITR: 특정 시점(초 단위)으로 복구

# CLI로 수동 덤프 / 복구
npx supabase db dump --file backup-YYYYMMDD.sql
npx supabase db reset --file backup-YYYYMMDD.sql  # 주의: 전체 DB 초기화
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
- [ ] Supabase Edge Functions 에러율 확인 (< 1%)
- [ ] pg_cron 작업 실행 확인
- [ ] 고객 문의 응대

#### 주간 체크리스트

- [ ] 주간 매출 리포트 작성
- [ ] 어뷰징 의심 계정 조사
- [ ] 환불 건 분석

#### 월간 체크리스트

- [ ] 월간 정산 보고서 작성
- [ ] 데이터 아카이브 실행
- [ ] pg_cron 작업 점검
- [ ] API 키 로테이션 검토

### B. 긴급 연락처

| 역할 | 연락처 |
|------|--------|
| 시스템 관리자 | admin@uniqn.com |
| RevenueCat 지원 | support@revenuecat.com |
| Supabase 지원 | https://supabase.com/dashboard/support |
| Apple 개발자 지원 | https://developer.apple.com/contact/ |
| Google Play 지원 | https://support.google.com/googleplay/android-developer/ |

### C. 관련 문서

- [포인트 시스템 설계](../features/payment/CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md)
- [결제 시스템 개발](../features/payment/PAYMENT_SYSTEM_DEVELOPMENT.md)
- [데이터 스키마](../reference/DATA_SCHEMA.md)
- [보안 가이드](./SECURITY.md)

---

**문서 버전**: v2.1.0 (Supabase 이전 반영)
**최종 업데이트**: 2026-04-18
**작성자**: UNIQN 개발팀
