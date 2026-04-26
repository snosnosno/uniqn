# Monetization System (Track A) — Design Spec

- 작성일: 2026-04-26
- 브랜치: `design/monetization-system`
- 상태: Draft (사용자 검토 대기)
- 후속: `writing-plans` 스킬로 implementation plan 생성 예정

---

## 0. Executive Summary

UNIQN의 매출 엔진(하트/다이아 + RevenueCat)을 **그린필드로 처음부터** 구현한다.
사업계획서(`BUSINESS_PLAN_2025.md`)에 상세 설계가 있고, 코드/DB/패키지는 모두 비어 있는 상태다.
배포는 **부분 유료화 → 완전 유료화** Feature Flag로 점진 롤아웃 (10% → 50% → 100%).

핵심 의사결정:
1. **RevenueCat 사용** (직접 IAP 처리 X) — 영수증 검증/플랫폼 추상화/대시보드 제공.
2. **DB는 ledger 모델** (잔액 컬럼 X) — 모든 변동은 append-only `wallet_ledger`에 기록, 잔액은 trigger로 캐싱.
3. **다이아 차감은 RPC 단일 트랜잭션** (`consume_diamonds_atomically`) — `cancel_application_atomically` 패턴 그대로 차용.
4. **하트는 무료, 다이아는 유료** — 둘 다 1포인트=300원. 사용 우선순위: 하트(만료 임박순) → 다이아.
5. **부분 유료화 우선** — 일반공고 무료 유지, 긴급/고정만 유료로 6개월 PMF 측정 후 완전 유료화.

성공 지표 (M+1 ~ M+6):
- M+1: 유료 충전 사용자 수 ≥ 30명, ARPPU ≥ 5,000원
- M+3: 긴급공고 전환율(무료→유료) ≥ 15%
- M+6: MRR ≥ 50만원, BEP 가시거리

---

## 1. 현재 상태 진단 (Evidence-Based)

| 영역 | 현재 상태 | 근거 |
|---|---|---|
| 결제 코드 | **0%** | `Grep "RevenueCat\|react-native-purchases"` → 0 hits |
| 결제 DB 테이블 | **없음** | `mcp__supabase__list_tables` → wallets/ledger/products 없음 |
| 결제 패키지 | **미설치** | `package.json` 검증 — `react-native-purchases` 없음 |
| PortOne SDK | **설치됨** (본인인증 전용) | `@portone/react-native-sdk` (`portOneIdentityService.ts`) — RevenueCat과 충돌 없음 |
| 가격 설계 | **두 버전 존재** | `BUSINESS_PLAN_2025.md` v1.2 (긴급 10💎) vs 레거시 v4.0 mobile-payment-plan (긴급 8💎) — 본 spec은 v1.2 채택 |
| 사용 컨텍스트 | **명확** | `jobManagementService.ts`에서 공고 INSERT 직전 차감 hook 필요 |

**진단**: 그린필드 — 레거시 부채 없음. 현재 코드의 trigger/RPC 패턴(`job_postings.stats trigger`, `cancel_application_atomically`)을 그대로 차용 가능.

**레거시 설계 흡수 항목** (mobile-payment-plan v4.0에서):
- 첫 충전 보너스 +5💎 (Open Question으로 추가)
- 로그인 streak 추적 (이미 `grant_streak_7d` enum에 반영)
- HMAC webhook 검증 누락 → 본 spec §5.3에서 강제
- 음수 잔액 차단 → 본 spec §3.3 `CHECK >= 0` 제약
- timezone 기준 모호 → 본 spec은 **KST 기준 자정** 명시 (§3.4 cron)

---

## 2. 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client (Expo RN)                          │
│  ┌──────────────────┐     ┌────────────────────────────────────┐ │
│  │ react-native-    │     │  WalletStore (Zustand)             │ │
│  │ purchases SDK    │     │  + useWalletBalance Query          │ │
│  └─────────┬────────┘     └────────────────┬───────────────────┘ │
│            │                                │                     │
│            │ 1. purchasePackage             │ 4. balance refetch  │
│            ▼                                ▲                     │
└──────────────────────────────────────────────────────────────────┘
             │                                │
             │ 2. RevenueCat SDK → App Store/Play Store
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RevenueCat (SaaS)                         │
│  - 영수증 검증 (Apple/Google)                                    │
│  - Customer 관리 (appUserID = Supabase user.id)                 │
│  - 3. Webhook → Supabase Edge Function                          │
└─────────────────────────────────────────────────────────────────┘
             │
             │ HTTP POST (signed)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function (Deno)                       │
│  /functions/revenuecat-webhook/index.ts                          │
│  - 서명 검증 (RC_WEBHOOK_SECRET)                                 │
│  - app_user_id → user.id 매핑                                    │
│  - product_id → diamond amount lookup                            │
│  - RPC credit_diamonds_atomically 호출                           │
└─────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                Supabase Postgres (RLS-enabled)                   │
│                                                                   │
│   diamond_products       wallet_ledger     wallets (cached)      │
│   ─────────────────      ─────────────     ─────────────────     │
│   product_id (PK)        id (PK)           user_id (PK)          │
│   diamonds               user_id (FK)      heart_balance         │
│   bonus_diamonds         currency_type     diamond_balance       │
│   price_krw              delta             updated_at            │
│   active                 reason                                  │
│                          ref_id            heart_lots            │
│                          ref_type          ─────────────         │
│                          balance_after     id (PK)               │
│                          revenuecat_       user_id (FK)          │
│                            transaction_id  amount_remaining      │
│                          created_at        granted_at            │
│                                            expires_at            │
│                                            source                │
│                                                                   │
│   Triggers:                                                       │
│   - tr_wallet_ledger_update_balance (ledger → wallets cache)     │
│   - tr_heart_lot_consume (lot 우선 소비)                         │
│                                                                   │
│   RPCs:                                                           │
│   - consume_diamonds_atomically(user_id, amount, reason, ref_id) │
│   - credit_diamonds_atomically(user_id, amount, reason, ref_id)  │
│   - grant_heart_atomically(user_id, amount, reason, expires_at)  │
│   - get_wallet_summary(user_id) → balances + expiring lots       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. DB 스키마

### 3.1 `diamond_products` — 충전 패키지 카탈로그

```sql
CREATE TABLE public.diamond_products (
  product_id          TEXT PRIMARY KEY,           -- App Store / Play Store SKU
  diamonds            INT  NOT NULL CHECK (diamonds > 0),
  bonus_diamonds      INT  NOT NULL DEFAULT 0,
  price_krw           INT  NOT NULL,              -- 표시용 (실제 결제는 store 가격)
  display_order       INT  NOT NULL DEFAULT 0,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

초기 시드 (BUSINESS_PLAN §3.2):

| product_id | diamonds | bonus | price_krw |
|---|---|---|---|
| `uniqn_diamonds_1000` | 3 | 0 | 1000 |
| `uniqn_diamonds_3000` | 10 | 0 | 3000 |
| `uniqn_diamonds_10000` | 33 | 2 | 10000 |
| `uniqn_diamonds_30000` | 100 | 10 | 30000 |
| `uniqn_diamonds_50000` | 167 | 23 | 50000 |
| `uniqn_diamonds_100000` | 333 | 67 | 100000 |

### 3.2 `wallet_ledger` — Append-only 거래 원장

```sql
CREATE TYPE wallet_currency AS ENUM ('heart', 'diamond');
CREATE TYPE wallet_reason AS ENUM (
  'purchase',                -- 다이아 충전 (RevenueCat)
  'consume_job_posting',     -- 공고 게시 차감
  'consume_job_extend',      -- 공고 연장 차감
  'consume_job_upgrade',     -- 일반→긴급 전환 차감
  'refund_purchase',         -- RevenueCat 환불
  'refund_job_cancelled',    -- 공고 취소 환불 (정책 결정 필요)
  'grant_signup',            -- 신규 가입 +10 하트
  'grant_daily_attendance',  -- 출석 체크 +1
  'grant_streak_7d',         -- 7일 연속 +3
  'grant_review',            -- 리뷰 작성 +1
  'grant_referral',          -- 친구 초대 +5
  'grant_admin',             -- 관리자 수동 지급
  'expire_heart'             -- 하트 만료
);

CREATE TABLE public.wallet_ledger (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  currency_type            wallet_currency NOT NULL,
  delta                    INT NOT NULL,              -- 양수=적립, 음수=차감
  reason                   wallet_reason NOT NULL,
  ref_id                   UUID,                       -- job_posting_id 등
  ref_type                 TEXT,                       -- 'job_posting' / 'application' 등
  balance_after_heart      INT NOT NULL,               -- 변동 후 잔액 (감사용)
  balance_after_diamond    INT NOT NULL,
  revenuecat_transaction_id TEXT UNIQUE,               -- idempotency key (구매/환불)
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_ledger_user_created
  ON public.wallet_ledger(user_id, created_at DESC);
CREATE INDEX idx_wallet_ledger_ref
  ON public.wallet_ledger(ref_type, ref_id);
```

**핵심 원칙**:
- 절대 UPDATE/DELETE 금지 (immutable). 환불도 새 row로.
- `revenuecat_transaction_id` UNIQUE 제약 → webhook 재전송 멱등성 보장.

### 3.3 `wallets` — 잔액 캐시 (trigger 동기화)

```sql
CREATE TABLE public.wallets (
  user_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  heart_balance    INT NOT NULL DEFAULT 0 CHECK (heart_balance >= 0),
  diamond_balance  INT NOT NULL DEFAULT 0 CHECK (diamond_balance >= 0),
  lifetime_purchased_diamonds INT NOT NULL DEFAULT 0,  -- VIP 등급 산정용
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**왜 캐시인가**: 잔액 표시는 매 화면에서 일어나므로 ledger SUM은 부담. `job_postings.stats trigger` 패턴 그대로 채택.

### 3.4 `heart_lots` — 만료 단위 (FIFO 소비)

```sql
CREATE TABLE public.heart_lots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_initial    INT NOT NULL CHECK (amount_initial > 0),
  amount_remaining  INT NOT NULL CHECK (amount_remaining >= 0),
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  source            wallet_reason NOT NULL,
  source_ref_id     UUID,
  CONSTRAINT chk_amount_remaining_lte_initial
    CHECK (amount_remaining <= amount_initial)
);

CREATE INDEX idx_heart_lots_user_expiring
  ON public.heart_lots(user_id, expires_at)
  WHERE amount_remaining > 0;
```

**소비 알고리즘**: `expires_at ASC` (만료 임박 순) → `granted_at ASC` (오래된 것 먼저).
**만료 처리**: pg_cron으로 **매일 00:00 KST** (UTC 15:00 전일)에 `expires_at < now()` 항목 lot 잔량을 0으로, ledger에 `expire_heart` 기록.
**timezone 기준**: 모든 만료/streak/일일 출석은 **Asia/Seoul** (UTC+9) 기준. RPC에서 `now() AT TIME ZONE 'Asia/Seoul'` 사용 강제.

### 3.5 RLS 정책

```sql
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE heart_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE diamond_products ENABLE ROW LEVEL SECURITY;

-- 본인 잔액만 읽기
CREATE POLICY wallet_self_select ON wallets
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ledger 본인 읽기
CREATE POLICY ledger_self_select ON wallet_ledger
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 모든 쓰기는 SECURITY DEFINER RPC를 통해서만
-- (직접 INSERT/UPDATE 차단)
CREATE POLICY ledger_no_direct_write ON wallet_ledger
  FOR ALL USING (false) WITH CHECK (false);

-- 다이아 상품은 모두 읽기 가능
CREATE POLICY products_public_read ON diamond_products
  FOR SELECT USING (active = true);

-- admin은 전체 접근 (app_metadata.role = 'admin')
CREATE POLICY wallet_admin_all ON wallets
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

---

## 4. RPC 함수

### 4.1 `consume_diamonds_atomically`

```sql
CREATE OR REPLACE FUNCTION public.consume_diamonds_atomically(
  p_user_id UUID,
  p_amount  INT,                  -- 양수
  p_reason  wallet_reason,
  p_ref_id  UUID,
  p_ref_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_heart_consumed INT := 0;
  v_diamond_consumed INT := 0;
  v_remaining INT := p_amount;
  v_lot RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: % must be positive', p_amount;
  END IF;

  -- 1. 지갑 행 잠금 (없으면 생성)
  INSERT INTO wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  -- 2. 총 잔액 검증 (하트+다이아)
  IF v_wallet.heart_balance + v_wallet.diamond_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %h+%d, need %',
      v_wallet.heart_balance, v_wallet.diamond_balance, p_amount;
  END IF;

  -- 3. 하트 우선 소비 (FIFO by expires_at)
  FOR v_lot IN
    SELECT * FROM heart_lots
    WHERE user_id = p_user_id
      AND amount_remaining > 0
      AND expires_at > v_now
    ORDER BY expires_at ASC, granted_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining = 0;
    DECLARE v_take INT := LEAST(v_lot.amount_remaining, v_remaining);
    BEGIN
      UPDATE heart_lots SET amount_remaining = amount_remaining - v_take
        WHERE id = v_lot.id;
      v_heart_consumed := v_heart_consumed + v_take;
      v_remaining := v_remaining - v_take;
    END;
  END LOOP;

  -- 4. 부족분은 다이아로
  IF v_remaining > 0 THEN
    v_diamond_consumed := v_remaining;
  END IF;

  -- 5. ledger 기록 (하트/다이아 분리 row)
  IF v_heart_consumed > 0 THEN
    INSERT INTO wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
                              balance_after_heart, balance_after_diamond)
    VALUES (p_user_id, 'heart', -v_heart_consumed, p_reason, p_ref_id, p_ref_type,
            v_wallet.heart_balance - v_heart_consumed,
            v_wallet.diamond_balance - v_diamond_consumed);
  END IF;
  IF v_diamond_consumed > 0 THEN
    INSERT INTO wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
                              balance_after_heart, balance_after_diamond)
    VALUES (p_user_id, 'diamond', -v_diamond_consumed, p_reason, p_ref_id, p_ref_type,
            v_wallet.heart_balance - v_heart_consumed,
            v_wallet.diamond_balance - v_diamond_consumed);
  END IF;

  -- 6. wallets 캐시 갱신은 trigger 가 담당

  RETURN jsonb_build_object(
    'success', true,
    'heart_consumed', v_heart_consumed,
    'diamond_consumed', v_diamond_consumed,
    'new_heart_balance', v_wallet.heart_balance - v_heart_consumed,
    'new_diamond_balance', v_wallet.diamond_balance - v_diamond_consumed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION consume_diamonds_atomically TO authenticated;
```

### 4.2 `credit_diamonds_atomically` (구매/환불 webhook용)

```sql
CREATE OR REPLACE FUNCTION public.credit_diamonds_atomically(
  p_user_id UUID,
  p_diamonds INT,                 -- 양수=구매, 음수=환불
  p_revenuecat_transaction_id TEXT,  -- UNIQUE으로 멱등성
  p_product_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_existing UUID;
BEGIN
  -- 1. 멱등성 체크
  SELECT id INTO v_existing FROM wallet_ledger
    WHERE revenuecat_transaction_id = p_revenuecat_transaction_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2. 지갑 잠금
  INSERT INTO wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  -- 3. 환불 시 잔액 부족 체크 (음수가 되는 것 허용 정책 결정 필요 — 일단 0 floor)
  IF p_diamonds < 0 AND v_wallet.diamond_balance < ABS(p_diamonds) THEN
    -- 음수 잔액 허용 안 함, 가능한 만큼만 차감
    p_diamonds := -v_wallet.diamond_balance;
  END IF;

  -- 4. ledger 기록
  INSERT INTO wallet_ledger(user_id, currency_type, delta,
                            reason, ref_type,
                            balance_after_heart, balance_after_diamond,
                            revenuecat_transaction_id,
                            metadata)
  VALUES (p_user_id, 'diamond', p_diamonds,
          CASE WHEN p_diamonds > 0 THEN 'purchase'::wallet_reason
               ELSE 'refund_purchase'::wallet_reason END,
          'revenuecat',
          v_wallet.heart_balance,
          v_wallet.diamond_balance + p_diamonds,
          p_revenuecat_transaction_id,
          jsonb_build_object('product_id', p_product_id));

  -- 5. lifetime 누계
  IF p_diamonds > 0 THEN
    UPDATE wallets SET lifetime_purchased_diamonds = lifetime_purchased_diamonds + p_diamonds
      WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'diamonds_credited', p_diamonds);
END;
$$;

-- service_role만 실행 가능 (webhook 전용)
REVOKE EXECUTE ON FUNCTION credit_diamonds_atomically FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION credit_diamonds_atomically TO service_role;
```

### 4.3 `grant_heart_atomically` (하트 지급)

```sql
CREATE OR REPLACE FUNCTION public.grant_heart_atomically(
  p_user_id UUID,
  p_amount  INT,
  p_reason  wallet_reason,
  p_source_ref_id UUID DEFAULT NULL,
  p_expires_in_days INT DEFAULT 90
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_lot_id UUID;
  v_expires TIMESTAMPTZ := now() + (p_expires_in_days || ' days')::interval;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  -- daily_attendance 일일 1회 제한
  IF p_reason = 'grant_daily_attendance' THEN
    IF EXISTS (
      SELECT 1 FROM wallet_ledger
      WHERE user_id = p_user_id
        AND reason = 'grant_daily_attendance'
        AND created_at::date = current_date
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_attended_today');
    END IF;
  END IF;

  INSERT INTO wallets(user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING;

  INSERT INTO heart_lots(user_id, amount_initial, amount_remaining,
                          expires_at, source, source_ref_id)
  VALUES (p_user_id, p_amount, p_amount, v_expires, p_reason, p_source_ref_id)
  RETURNING id INTO v_lot_id;

  INSERT INTO wallet_ledger(user_id, currency_type, delta, reason,
                            ref_id, ref_type,
                            balance_after_heart, balance_after_diamond)
  SELECT p_user_id, 'heart', p_amount, p_reason,
         v_lot_id, 'heart_lot',
         w.heart_balance + p_amount, w.diamond_balance
  FROM wallets w WHERE w.user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'lot_id', v_lot_id, 'expires_at', v_expires);
END;
$$;

GRANT EXECUTE ON FUNCTION grant_heart_atomically TO service_role;
-- daily_attendance만 클라이언트 호출 가능 (별도 wrapper RPC로 노출)
```

### 4.4 `tr_wallet_ledger_update_balance` (캐시 trigger)

```sql
CREATE OR REPLACE FUNCTION public.fn_wallet_ledger_update_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NEW.currency_type = 'heart' THEN
    UPDATE wallets SET
      heart_balance = NEW.balance_after_heart,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.currency_type = 'diamond' THEN
    UPDATE wallets SET
      diamond_balance = NEW.balance_after_diamond,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tr_wallet_ledger_update_balance
AFTER INSERT ON public.wallet_ledger
FOR EACH ROW EXECUTE FUNCTION fn_wallet_ledger_update_balance();
```

---

## 5. RevenueCat Webhook Edge Function

### 5.1 파일 구조

`uniqn-mobile/supabase/functions/revenuecat-webhook/index.ts`

### 5.2 처리 이벤트

| RC Event | 액션 |
|---|---|
| `INITIAL_PURCHASE` | `credit_diamonds_atomically(+diamonds)` |
| `RENEWAL` | (구독 사용 안 함) — 무시 |
| `NON_RENEWING_PURCHASE` | `credit_diamonds_atomically(+diamonds)` (consumable) |
| `CANCELLATION` | (구독 아니어서) — 무시 |
| `EXPIRATION` | (구독 아니어서) — 무시 |
| `REFUND` / `BILLING_ISSUE` | `credit_diamonds_atomically(-diamonds)` |
| `PRODUCT_CHANGE` | 무시 |
| `TRANSFER` | (한 user_id로 transfer) — 로그만 |

### 5.3 보안 가드

```typescript
// 1. Authorization header 검증
const authHeader = req.headers.get('Authorization');
const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
if (authHeader !== `Bearer ${expectedSecret}`) {
  return new Response('Unauthorized', { status: 401 });
}

// 2. event.id 멱등성 (RC가 retry할 때 중복 처리 방지)
//    → wallet_ledger.revenuecat_transaction_id UNIQUE로 강제

// 3. app_user_id 검증 (Supabase user.id 형식인지)
if (!UUID_REGEX.test(event.app_user_id)) {
  return new Response('Invalid app_user_id', { status: 400 });
}

// 4. product_id → diamond amount는 DB에서 조회 (클라이언트 신뢰 X)
const { data: product } = await supa.from('diamond_products')
  .select('diamonds, bonus_diamonds').eq('product_id', event.product_id).single();
```

### 5.4 환경변수

- `REVENUECAT_WEBHOOK_SECRET` — RC 대시보드에서 생성, Supabase secrets에 저장
- `SUPABASE_SERVICE_ROLE_KEY` — webhook이 SECURITY DEFINER RPC 호출용

---

## 6. 클라이언트 구조

### 6.1 디렉토리

```
uniqn-mobile/src/
├── services/wallet/
│   ├── purchasesService.ts        # RevenueCat SDK wrapper
│   ├── walletService.ts           # 잔액 조회, 차감 hook
│   └── __tests__/
├── repositories/supabase/
│   └── WalletRepository.ts        # wallet_ledger / wallets 조회
├── hooks/
│   ├── useWalletBalance.ts        # TanStack Query
│   ├── usePurchaseDiamonds.ts     # 구매 mutation
│   └── useDailyAttendance.ts      # 출석 RPC mutation
├── components/wallet/
│   ├── BalanceBadge.tsx           # 헤더용 잔액 표시
│   ├── PurchaseSheet.tsx          # 다이아 충전 시트
│   ├── PaywallModal.tsx           # 잔액 부족 시 표시
│   └── HeartExpiringBanner.tsx    # 7일 이내 만료 경고
└── stores/
    └── walletStore.ts             # 잔액 캐시 (optimistic update)
```

### 6.2 RevenueCat 초기화

`src/services/wallet/purchasesService.ts`:

```typescript
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { logger } from '@/shared/logger';

export async function initializePurchases(supabaseUserId: string) {
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);

  Purchases.configure({
    apiKey: Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY!,
    })!,
    appUserID: supabaseUserId,  // 핵심: Supabase user.id와 동기화
  });
}

export async function getDiamondPackages() {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchaseDiamondPackage(pkg: PurchasesPackage) {
  try {
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);
    // webhook이 잔액 갱신 처리. 클라이언트는 refetch만.
    return { success: true, productIdentifier };
  } catch (error) {
    if (error.userCancelled) return { success: false, cancelled: true };
    logger.error('purchase_failed', error);
    throw error;
  }
}
```

### 6.3 차감 호출 (jobManagementService 통합)

```typescript
// uniqn-mobile/src/services/jobs/jobManagementService.ts (수정)

async function createJobPosting(input: CreateJobPostingInput) {
  // 1. 가격 계산
  const priceMap = { regular: 1, urgent: 10, fixed: 5, tournament: 0 };
  const cost = priceMap[input.type];

  // 2. Feature flag 체크 (부분 유료화)
  if (cost > 0 && !await isMonetizationEnabledFor(input.type, currentUser.id)) {
    cost = 0;
  }

  // 3. 차감 (cost > 0인 경우만)
  if (cost > 0) {
    const { data, error } = await supa.rpc('consume_diamonds_atomically', {
      p_user_id: currentUser.id,
      p_amount: cost,
      p_reason: 'consume_job_posting',
      p_ref_id: null,           // INSERT 후 update
      p_ref_type: 'job_posting',
    });
    if (error || !data.success) throw new InsufficientBalanceError(data?.error);
  }

  // 4. 공고 INSERT
  const { data: posting } = await supa.from('job_postings').insert({...}).select().single();

  // 5. ledger의 ref_id 업데이트 (선택사항 — 감사용)
  if (cost > 0) {
    await supa.from('wallet_ledger')
      .update({ ref_id: posting.id })
      .eq('user_id', currentUser.id)
      .is('ref_id', null)
      .order('created_at', { ascending: false })
      .limit(1);
  }

  return posting;
}
```

**Race window 결정 (Open Question 해결)**: 4와 5 사이는 다른 트랜잭션이 끼어들 수 있음. **결정: 단일 RPC `create_job_posting_with_payment_atomically`로 묶기**. 이 RPC가 `consume_diamonds_atomically` 로직 + `INSERT job_postings` + ledger ref_id 즉시 set을 한 트랜잭션 내에서 수행. 구현은 implementation plan 단계에서 wrapper RPC로 추가.

---

## 7. Feature Flag 롤아웃

### 7.1 `app_config` 테이블 활용 (이미 존재)

```sql
INSERT INTO app_config(key, value) VALUES
  ('monetization.enabled', '{"enabled": false}'::jsonb),
  ('monetization.paid_types', '{"regular": false, "urgent": false, "fixed": false}'::jsonb),
  ('monetization.rollout_percentage', '{"value": 0}'::jsonb);
```

### 7.2 단계별 전환

| Phase | 기간 | 설정 |
|---|---|---|
| Beta | M+0~1 | `enabled=true`, 모두 무료, 다이아 충전만 활성화 |
| 부분 유료화 (긴급) | M+2 | `paid_types.urgent=true`, `rollout=10%` |
| 부분 유료화 확대 | M+3 | `urgent=100%, fixed=10%` |
| 부분 유료화 (고정 포함) | M+4 | `urgent=100%, fixed=100%` |
| 완전 유료화 | M+6 | `regular=100%` |

### 7.3 Rollout 결정 함수

**결정**: `userId` 기반 deterministic hash로 same user → same bucket 보장 (사용자가 갑자기 무료↔유료 사이 흔들리지 않게).

```typescript
import { createHash } from 'crypto';
// 또는 RN 환경: 'react-native-quick-crypto' 또는 expo-crypto

function userBucket(userId: string): number {
  // userId(UUID)의 SHA-256 첫 4바이트 → uint32 → % 100
  const hash = createHash('sha256').update(userId).digest();
  const uint32 = hash.readUInt32BE(0);
  return uint32 % 100;
}

function isMonetizationEnabledFor(jobType: string, userId: string): boolean {
  const config = useAppConfig('monetization');
  if (!config.enabled) return false;
  if (!config.paid_types[jobType]) return false;
  return userBucket(userId) < config.rollout_percentage;
}
```

서버 측 동일 hash가 필요하면 SQL 함수로 대응:
```sql
CREATE OR REPLACE FUNCTION user_bucket(p_user_id UUID) RETURNS INT
LANGUAGE SQL IMMUTABLE AS $$
  SELECT ('x' || substr(encode(digest(p_user_id::text, 'sha256'), 'hex'), 1, 8))::bit(32)::int % 100;
$$;
```

---

## 8. 보안 위협 모델 (STRIDE)

| 위협 | 시나리오 | 완화 |
|---|---|---|
| **Spoofing** | 가짜 webhook | RC_WEBHOOK_SECRET 검증 + Edge Function의 IP allowlist (옵션) |
| **Tampering** | 클라이언트가 가격 변조 | 가격은 DB(`diamond_products`)에서만 조회, 클라이언트 입력 무시 |
| **Repudiation** | "안 받았다" 클레임 | `wallet_ledger` immutable + `revenuecat_transaction_id` 유일 |
| **Info Disclosure** | 다른 사용자 잔액 조회 | RLS `auth.uid() = user_id` |
| **DoS** | 충전 무한 호출 | RC가 1차 방어 + Edge Function rate limit (Supabase 플랜) |
| **Elevation** | 일반 사용자가 credit RPC 호출 | `REVOKE FROM authenticated`, service_role만 |
| **Double-spend** | 같은 영수증 2회 처리 | `revenuecat_transaction_id UNIQUE` 제약 |
| **Negative balance** | race condition으로 잔액 < 0 | `SELECT FOR UPDATE` + `CHECK >= 0` 제약 |
| **Price drift** | RC 대시보드와 DB 가격 불일치 | `diamond_products` seed migration + RC sync 절차 문서화 |

---

## 9. 테스트 전략 (TDD)

### 9.1 RPC 단위 테스트 (PL/pgSQL)

`uniqn-mobile/supabase/tests/wallet_rpcs.spec.sql`:

- `consume_diamonds_atomically` 정상 차감 (하트만, 다이아만, 혼합)
- 잔액 부족 → INSUFFICIENT_BALANCE
- 음수 amount → INVALID_AMOUNT
- 동시 호출 race (FOR UPDATE 검증) — pg_isolation 또는 통합 테스트
- `credit_diamonds_atomically` 멱등성 (같은 transaction_id 2회)
- `grant_heart_atomically` daily_attendance 중복 방지
- `tr_wallet_ledger_update_balance` 캐시 동기화

### 9.2 Service 통합 테스트 (Jest)

- `walletService.purchase` → mock RC SDK + Supabase
- 차감 실패 시 공고 INSERT 롤백
- Feature flag off → 차감 skip
- Feature flag rollout 10% → 동일 user는 항상 같은 결과

### 9.3 Webhook 테스트

- RC 시뮬레이터로 INITIAL_PURCHASE 이벤트 → ledger row 생성 확인
- 같은 event 2회 → idempotent 응답
- Authorization header 누락 → 401
- 잘못된 product_id → 422

### 9.4 E2E (Playwright + sandbox 결제)

- 첫 충전 → 잔액 표시 → 공고 작성 → 차감 → 잔액 갱신
- Restore purchases → 잔액 회복 (devices 변경 시)

---

## 10. 모니터링 / KPI

### 10.1 대시보드 (Supabase + 자체)

- **MRR**: `SUM(price_krw)` for `purchase` reason in current month
- **ARPPU**: MRR / 결제자 수
- **전환율**: `users with purchase` / `users with attempted_purchase`
- **하트→다이아 전환**: 잔액 부족 paywall 노출 → 충전 완료 funnel
- **만료 손실**: `expire_heart` 합계 (UX 개선 신호)

### 10.2 알람

- webhook 실패율 > 1% → Slack
- ledger 음수 잔액 발생 (불가능해야 함) → 즉시 page
- diamond_products 가격 vs RC 대시보드 drift → 매일 체크 cron

---

## 11. 미해결 결정 (Open Questions)

| 결정 | 옵션 | 권장 |
|---|---|---|
| **공고 취소 시 환불 정책** | (a) 전액 환불 (b) 부분 환불 (c) 환불 없음 | (b) 24시간 이내 100%, 이후 50% |
| **wallets.diamond_balance 음수 허용** | (a) 절대 금지 (b) admin 보정 가능 | (a) — `CHECK >= 0` 강제. 환불이 잔액보다 크면 가능한 만큼만 차감 (§4.2 step 3). 단, ledger row delta는 음수 허용 (감사 추적용) |
| **하트 만료 알림** | (a) 만료 7일 전 push (b) 앱 내 배너만 (c) 둘 다 | (c) — push 1회 + 영구 배너 |
| **VIP 등급 시스템** | (a) 이번에 포함 (b) Phase 2 | (b) — 데이터 모이고 결정 |
| **환불 시 ledger 처리** | (a) 새 row (b) 기존 row update | (a) — immutable 원칙 |
| **Feature Flag 키** | (a) JSONB single config (b) 개별 row | (a) — 이미 `app_config` 있음 |
| **첫 충전 보너스** | (a) +5💎 (레거시 v4.0) (b) 없음 | (a) — 전환율 부스터 |
| **다이아 환불 시 ledger 음수** | (a) 음수 row 허용 (b) 부채 차감 후 0 floor | (a) — 감사 명확성 우선 (사용 가능 잔액은 GREATEST(0, balance) 표시) |
| **RC webhook 재시도 정책** | (a) 5회 + 지수백오프 (RC 기본) (b) 자체 재처리 큐 | (a) — UNIQUE 제약으로 멱등성 보장되므로 RC 기본 신뢰 |
| **Apple/Google 직접 환불 vs RC** | RC만 신뢰 vs 양쪽 webhook | RC만 — 단일 소스 |

→ 사용자 검토 단계에서 결정.

---

## 12. 마이그레이션 순서

1. `20260427000000_create_wallet_tables.sql` — 4개 테이블 + ENUM + 인덱스
2. `20260427000100_create_wallet_rls.sql` — RLS 정책
3. `20260427000200_create_wallet_rpcs.sql` — 4개 RPC
4. `20260427000300_create_wallet_triggers.sql` — 캐시 sync trigger
5. `20260427000400_seed_diamond_products.sql` — 6개 패키지 시드
6. `20260427000500_create_app_config_monetization.sql` — Feature flag 시드
7. `20260427000600_create_heart_expiry_cron.sql` — pg_cron 매일 만료 처리

---

## 13. 외부 작업 (코드 외)

1. **RevenueCat 계정 생성** + 앱 등록 (iOS/Android)
2. **App Store Connect** consumable IAP 6개 등록 (`uniqn_diamonds_*`)
3. **Google Play Console** managed product 6개 등록
4. **RevenueCat Offering** 생성 + 6개 product 연결
5. **RC Webhook URL** 등록 → `https://<project>.supabase.co/functions/v1/revenuecat-webhook`
6. **법무 검토**: 환불 정책 약관 추가 (`src/constants/legal/terms-employer.ts` 업데이트)
7. **앱스토어 약관 업데이트**: 환불 정책 + 인앱결제 가이드라인

---

## 14. 다음 단계 (이 spec 승인 후)

1. **Spec self-review** — placeholder, contradiction, ambiguity 체크
2. **사용자 검토** — 11장 Open Questions 결정
3. **`writing-plans` 스킬 호출** — 13장의 14개 마이그레이션 단계를 implementation plan으로 변환
4. **Plan 승인 후 구현** — TDD로 RPC부터 → service → UI 순서

---

## 부록 A — 비즈니스 가정

- 사업계획서(`BUSINESS_PLAN_2025.md` v1.2) 가격/수량 그대로 채택
- BEP: 470건/월, M9 도달 가정
- 앱스토어 수수료 15% (소규모 사업자 프로그램)
- 무료 기간 6개월 후 부분 유료화 시작

## 부록 B — 패턴 차용

| 본 spec 요소 | 차용 출처 |
|---|---|
| ledger trigger → cache | `20260421040000_add_job_posting_stats_trigger.sql` |
| 원자성 RPC + FOR UPDATE | `20260414120100_add_cancel_application_atomically.sql` |
| Edge Function 보안 + idempotency | `supabase/functions/send-push-notification/index.ts` |
| Feature Flag 구조 | `app_config` table (이미 존재) |
| RLS app_metadata.role | `.claude/rules/supabase-patterns.md` |

## 부록 C — 참고 라이브러리 / 문서

- `react-native-purchases` (RevenueCat SDK) — context7 ID: `/revenuecat/react-native-purchases`
- RevenueCat Webhooks: <https://www.revenuecat.com/docs/integrations/webhooks>
- App Store IAP types: Consumable
- Google Play managed products

---

*Spec 종료. 사용자 검토 대기.*
