# Monetization System (Track B) — Subscription Design Spec

- 작성일: 2026-04-26
- 브랜치: `design/monetization-subscription`
- 상태: **Auto-mode draft** (사용자 검토 대기 — 6개 가정 lock 가능)
- 자매 spec: `2026-04-26-monetization-design.md` (Track A — Consumable, Locked)
- 비교 문서: `2026-04-26-monetization-comparison.md`
- 후속: 사용자 승인 시 `writing-plans` 스킬로 implementation plan 생성 진행

---

## 0. Executive Summary

UNIQN 매출 엔진의 **두 번째 가설** — 다이아 충전 대신 **월정액 구독(Subscription)** 으로 구인자에게 무제한/대용량 권한을 판매한다.
Track A(Consumable)와 동일한 RevenueCat 인프라를 사용하지만, **DB는 ledger 모델 대신 entitlement 모델**, **차감 RPC 대신 권한 체크**로 단순화된다.

핵심 의사결정:
1. **RevenueCat Offerings + Packages** — `purchasePackage()` + `customerInfo.entitlements.active` 패턴.
2. **DB는 entitlement 캐시** — `subscriptions` 테이블이 최신 상태(현재 plan/만료일)만 보유, 변경 이력은 `subscription_events`.
3. **차감 없음 — 권한 체크만** — 공고 작성 시 `check_quota_and_increment()` RPC가 월별 사용량을 enforced.
4. **4-tier (Free / Basic / Pro / Enterprise)** — Basic ₩39k / Pro ₩99k / Enterprise ₩299k.
5. **연간 할인 16.7%** (월 × 10).
6. **Free trial 14일** — 신용카드 등록 X, 자동 Basic 다운그레이드 X (만료 후 Free로 회귀).

성공 지표 (M+1 ~ M+6):
- M+1: 유료 전환 사용자 ≥ 10명, MRR ≥ 50만원
- M+3: Free→Paid 전환율 ≥ 5%, churn ≤ 8%/월
- M+6: MRR ≥ 200만원, ARR 가시거리 2,400만원

---

## 1. 현재 상태 진단 (Evidence-Based)

| 영역 | 현재 상태 | 근거 |
|---|---|---|
| 결제 코드 | **0%** | Track A spec과 동일 — 그린필드 |
| 결제 DB 테이블 | **wallet 4종 존재** (Track A 구현 중) | `git log --oneline` → 5개 wallet 커밋 (`feat(wallet): ...`) |
| 결제 패키지 | **미설치** | `react-native-purchases` 없음 |
| PortOne SDK | **본인인증 전용** | 충돌 없음 |
| 가격 가정 | **BUSINESS_PLAN 변경 필요** | 기존 가격표는 다이아 단가, subscription엔 부적합 |
| 사용 컨텍스트 | **명확** | `jobManagementService.ts`에서 INSERT 직전 quota 체크 hook |

**진단**: Track A wallet 테이블은 **Track B에서 미사용**. 동일 브랜치에서 채택될 경우 wallet 마이그레이션 6개를 revert 또는 archive 처리 필요.
이 spec은 별도 브랜치(`design/monetization-subscription`)에서 작성되므로 Track A 코드 영향 없음.

---

## 2. 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client (Expo RN)                          │
│  ┌──────────────────┐     ┌────────────────────────────────────┐ │
│  │ react-native-    │     │  EntitlementStore (Zustand)        │ │
│  │ purchases SDK    │     │  + useEntitlements Query           │ │
│  └─────────┬────────┘     └────────────────┬───────────────────┘ │
│            │                                │                     │
│            │ 1. purchasePackage             │ 4. entitlement      │
│            ▼                                │    refetch          │
└────────────┼────────────────────────────────┼────────────────────┘
             │                                │
             │ 2. RC SDK → App Store/Play
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RevenueCat (SaaS)                            │
│  - 구독 상태 관리 (active/expired/in_grace_period/billing_issue) │
│  - Customer 관리 (appUserID = Supabase user.id)                 │
│  - Entitlement 매핑 (basic/pro/enterprise)                       │
│  - 3. Webhook → Supabase Edge Function                          │
└─────────────────────────────────────────────────────────────────┘
             │
             │ HTTP POST (signed)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function (Deno)                       │
│  /functions/revenuecat-subscription-webhook/index.ts             │
│  - 서명 검증 (RC_WEBHOOK_SECRET)                                 │
│  - app_user_id → user.id 매핑                                    │
│  - entitlement_id → plan lookup                                  │
│  - RPC sync_subscription_atomically 호출                         │
└─────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                Supabase Postgres (RLS-enabled)                   │
│                                                                   │
│   subscription_plans     subscriptions       subscription_events │
│   ─────────────────      ───────────────     ─────────────────── │
│   plan_id (PK)           user_id (PK)        id (PK)             │
│   tier                   plan_id (FK)        user_id (FK)        │
│   period                 status              event_type          │
│   monthly_post_quota     period_start        plan_id             │
│   monthly_view_quota     period_end          revenuecat_event_id │
│   max_stores             cancel_at           occurred_at         │
│   price_krw              trial_end                               │
│   active                 revenuecat_                             │
│                            customer_id      usage_counters       │
│                          updated_at         ─────────────────    │
│                                              user_id, period_start│
│                                              posts_used           │
│                                              views_used           │
│                                              (UNIQUE per period)  │
│                                                                   │
│   RPCs:                                                           │
│   - sync_subscription_atomically (webhook entry)                  │
│   - check_quota_and_increment(user, action)                       │
│   - get_active_entitlement(user_id)                               │
│   - reset_monthly_usage_counters() (pg_cron, KST 1일 00:00)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. DB 스키마

### 3.1 `subscription_plans` — 플랜 카탈로그

```sql
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');
CREATE TYPE subscription_period AS ENUM ('monthly', 'annual');

CREATE TABLE public.subscription_plans (
  plan_id              TEXT PRIMARY KEY,            -- App/Play SKU + RC entitlement
  tier                 subscription_tier NOT NULL,
  period               subscription_period NOT NULL,
  monthly_post_quota   INT NOT NULL,                -- -1 = 무제한
  monthly_view_quota   INT NOT NULL,                -- -1 = 무제한
  max_stores           INT NOT NULL,                -- 1, 5, 20, -1
  price_krw            INT NOT NULL,                -- 표시용
  display_order        INT NOT NULL DEFAULT 0,
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_quota_nonneg CHECK (
    (monthly_post_quota = -1 OR monthly_post_quota >= 0)
    AND (monthly_view_quota = -1 OR monthly_view_quota >= 0)
    AND (max_stores = -1 OR max_stores >= 1)
  )
);
```

초기 시드:

| plan_id | tier | period | post_quota | view_quota | max_stores | price_krw |
|---|---|---|---|---|---|---|
| `free` | free | monthly | 3 | 30 | 1 | 0 |
| `basic_monthly` | basic | monthly | 20 | 300 | 1 | 39,000 |
| `basic_annual` | basic | annual | 20 | 300 | 1 | 390,000 |
| `pro_monthly` | pro | monthly | 100 | 2,000 | 5 | 99,000 |
| `pro_annual` | pro | annual | 100 | 2,000 | 5 | 990,000 |
| `enterprise_monthly` | enterprise | monthly | -1 | -1 | -1 | 299,000 |
| `enterprise_annual` | enterprise | annual | -1 | -1 | -1 | 2,990,000 |

**할인율**: annual = monthly × 10 → 월 환산 16.7% 절감.
**긴급공고 처리**: 모든 유료 tier에서 추가 비용 없음 (quota 내). Free는 긴급공고 차단.

### 3.2 `subscriptions` — 사용자 현재 구독 상태 (entitlement 캐시)

```sql
CREATE TYPE subscription_status AS ENUM (
  'active',           -- 정상 활성
  'in_trial',         -- Free trial 중
  'in_grace_period',  -- 결제 실패, 유예 (RC 16일)
  'cancelled',        -- 사용자 취소, 기간 만료까지 active
  'expired',          -- 만료 (Free로 회귀)
  'billing_issue'     -- 결제 issue, 유예 종료
);

CREATE TABLE public.subscriptions (
  user_id                  UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id                  TEXT NOT NULL REFERENCES public.subscription_plans(plan_id),
  status                   subscription_status NOT NULL DEFAULT 'active',
  period_start             TIMESTAMPTZ NOT NULL,
  period_end               TIMESTAMPTZ NOT NULL,
  cancel_at                TIMESTAMPTZ,                 -- 사용자 cancel 예약 시점
  trial_end                TIMESTAMPTZ,                 -- 14일 trial 종료
  revenuecat_customer_id   TEXT NOT NULL,               -- RC Customer.original_app_user_id
  store_country            TEXT,                        -- 환불/세금 처리용
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_period CHECK (period_end > period_start)
);

CREATE INDEX idx_subscriptions_status ON public.subscriptions(status)
  WHERE status IN ('active', 'in_trial', 'in_grace_period');
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(period_end);
```

**왜 PK가 user_id인가**: 사용자당 동시 1개 구독만 허용 (한국 시장 단순화). 기존 구독 변경은 UPDATE.
**Free 사용자 처리**: row 없음 = Free로 간주 (또는 `plan_id='free'` row 명시 — Open Question Q1).

### 3.3 `subscription_events` — 변경 이력 (감사용)

```sql
CREATE TYPE subscription_event_type AS ENUM (
  'created',                -- 첫 구독
  'renewed',                -- 자동 갱신
  'plan_changed',           -- upgrade/downgrade
  'cancelled',              -- 사용자 cancel (period_end까지 유효)
  'reactivated',            -- cancel 철회
  'expired',                -- 자연 만료
  'refunded',               -- RC refund
  'billing_issue',          -- 결제 실패
  'grace_started',          -- 유예 진입
  'grace_resolved',         -- 결제 복구
  'trial_started',
  'trial_converted',        -- trial → 유료 전환
  'trial_expired_to_free'   -- trial → Free 회귀
);

CREATE TABLE public.subscription_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type               subscription_event_type NOT NULL,
  from_plan_id             TEXT REFERENCES public.subscription_plans(plan_id),
  to_plan_id               TEXT REFERENCES public.subscription_plans(plan_id),
  revenuecat_event_id      TEXT UNIQUE,                 -- 멱등성 키
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_user_occurred
  ON public.subscription_events(user_id, occurred_at DESC);
```

**immutable**: UPDATE/DELETE 없음. 환불도 새 row.

### 3.4 `usage_counters` — 월별 사용량 카운터 (rate-limit)

```sql
CREATE TABLE public.usage_counters (
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL,                         -- 매월 1일 KST
  posts_used       INT NOT NULL DEFAULT 0 CHECK (posts_used >= 0),
  views_used       INT NOT NULL DEFAULT 0 CHECK (views_used >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_start)
);

CREATE INDEX idx_usage_counters_period ON public.usage_counters(period_start);
```

**Rollover 정책**: 매월 1일 00:00 KST에 새 row 생성 (pg_cron). 미사용 quota는 **이월 안 됨** (Open Question Q2).
**Annual 사용자**: 월별 카운터로 동일 처리. 연간 결제는 단지 가격 단가만 차이.

### 3.5 RLS 정책

```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- 본인 구독 상태만 읽기
CREATE POLICY subscription_self_select ON subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 본인 이력 읽기
CREATE POLICY subscription_events_self_select ON subscription_events
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 본인 사용량 읽기 (UI 표시용)
CREATE POLICY usage_counters_self_select ON usage_counters
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 모든 쓰기는 SECURITY DEFINER RPC만 (직접 INSERT/UPDATE 차단)
CREATE POLICY subscriptions_no_direct_write ON subscriptions
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY subscription_events_no_direct_write ON subscription_events
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY usage_counters_no_direct_write ON usage_counters
  FOR ALL USING (false) WITH CHECK (false);

-- 플랜 카탈로그는 모두 읽기
CREATE POLICY plans_public_read ON subscription_plans
  FOR SELECT USING (active = true);

-- admin은 전체 접근
CREATE POLICY subscription_admin_all ON subscriptions
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

---

## 4. RPC 함수

### 4.1 `sync_subscription_atomically` — webhook entry point

```sql
CREATE OR REPLACE FUNCTION public.sync_subscription_atomically(
  p_user_id            UUID,
  p_plan_id            TEXT,
  p_status             subscription_status,
  p_period_start       TIMESTAMPTZ,
  p_period_end         TIMESTAMPTZ,
  p_cancel_at          TIMESTAMPTZ,
  p_trial_end          TIMESTAMPTZ,
  p_rc_customer_id     TEXT,
  p_rc_event_id        TEXT,
  p_event_type         subscription_event_type,
  p_metadata           JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_existing_event   UUID;
  v_prev_plan_id     TEXT;
BEGIN
  -- 1. 멱등성 체크 (RC retry 방지)
  SELECT id INTO v_existing_event FROM subscription_events
   WHERE revenuecat_event_id = p_rc_event_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2. 이전 plan 보관 (event 기록용)
  SELECT plan_id INTO v_prev_plan_id FROM subscriptions WHERE user_id = p_user_id;

  -- 3. subscriptions UPSERT
  INSERT INTO subscriptions(
    user_id, plan_id, status, period_start, period_end,
    cancel_at, trial_end, revenuecat_customer_id, updated_at
  ) VALUES (
    p_user_id, p_plan_id, p_status, p_period_start, p_period_end,
    p_cancel_at, p_trial_end, p_rc_customer_id, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    cancel_at = EXCLUDED.cancel_at,
    trial_end = EXCLUDED.trial_end,
    revenuecat_customer_id = EXCLUDED.revenuecat_customer_id,
    updated_at = now();

  -- 4. event 기록 (immutable)
  INSERT INTO subscription_events(
    user_id, event_type, from_plan_id, to_plan_id,
    revenuecat_event_id, metadata, occurred_at
  ) VALUES (
    p_user_id, p_event_type, v_prev_plan_id, p_plan_id,
    p_rc_event_id, p_metadata, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'plan_id', p_plan_id,
    'status', p_status,
    'period_end', p_period_end
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_subscription_atomically FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION sync_subscription_atomically TO service_role;
```

### 4.2 `check_quota_and_increment` — 공고 작성 게이트

```sql
CREATE OR REPLACE FUNCTION public.check_quota_and_increment(
  p_user_id UUID,
  p_action  TEXT  -- 'post' | 'view'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_plan         subscription_plans%ROWTYPE;
  v_sub          subscriptions%ROWTYPE;
  v_period_start DATE := date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date;
  v_quota        INT;
  v_used         INT;
BEGIN
  IF p_action NOT IN ('post', 'view') THEN
    RAISE EXCEPTION 'INVALID_ACTION: %', p_action;
  END IF;

  -- 1. 활성 구독 조회 (없으면 free)
  --    cancelled 상태도 period_end 이전이면 유효 (사용자가 cancel했지만 남은 기간 사용 권리)
  SELECT * INTO v_sub FROM subscriptions WHERE user_id = p_user_id;
  IF NOT FOUND
     OR v_sub.status NOT IN ('active', 'in_trial', 'in_grace_period', 'cancelled')
     OR (v_sub.status = 'cancelled' AND v_sub.period_end <= now())
  THEN
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = 'free';
  ELSE
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = v_sub.plan_id;
  END IF;

  -- 2. 무제한 즉시 통과
  v_quota := CASE p_action WHEN 'post' THEN v_plan.monthly_post_quota
                            WHEN 'view' THEN v_plan.monthly_view_quota END;
  IF v_quota = -1 THEN
    -- counter는 통계용으로 증가
    INSERT INTO usage_counters(user_id, period_start, posts_used, views_used)
    VALUES (p_user_id, v_period_start,
            CASE WHEN p_action = 'post' THEN 1 ELSE 0 END,
            CASE WHEN p_action = 'view' THEN 1 ELSE 0 END)
    ON CONFLICT (user_id, period_start) DO UPDATE SET
      posts_used = usage_counters.posts_used + (CASE WHEN p_action = 'post' THEN 1 ELSE 0 END),
      views_used = usage_counters.views_used + (CASE WHEN p_action = 'view' THEN 1 ELSE 0 END),
      updated_at = now();
    RETURN jsonb_build_object('success', true, 'unlimited', true, 'plan', v_plan.tier);
  END IF;

  -- 3. counter row 잠금
  INSERT INTO usage_counters(user_id, period_start) VALUES (p_user_id, v_period_start)
    ON CONFLICT DO NOTHING;
  SELECT * INTO v_used FROM usage_counters
   WHERE user_id = p_user_id AND period_start = v_period_start FOR UPDATE;
  -- 위 쿼리는 row 자체를 SELECT해야 함 (수정)

  -- (재작성: row를 잡아오는 변수명 충돌 회피)
  PERFORM 1 FROM usage_counters
   WHERE user_id = p_user_id AND period_start = v_period_start FOR UPDATE;

  SELECT CASE p_action WHEN 'post' THEN posts_used ELSE views_used END
    INTO v_used
    FROM usage_counters
   WHERE user_id = p_user_id AND period_start = v_period_start;

  -- 4. quota 검증
  IF v_used >= v_quota THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED: % used % of % for %', v_plan.tier, v_used, v_quota, p_action;
  END IF;

  -- 5. 증가
  IF p_action = 'post' THEN
    UPDATE usage_counters SET posts_used = posts_used + 1, updated_at = now()
     WHERE user_id = p_user_id AND period_start = v_period_start;
  ELSE
    UPDATE usage_counters SET views_used = views_used + 1, updated_at = now()
     WHERE user_id = p_user_id AND period_start = v_period_start;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_plan.tier,
    'quota', v_quota,
    'used', v_used + 1,
    'remaining', v_quota - (v_used + 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_quota_and_increment TO authenticated;
```

**구현 시 주의**: 위 함수는 `v_used` 변수 재사용으로 두 번 SELECT하는 어색한 형태. 실제 구현에선 단일 `UPDATE ... RETURNING` 패턴으로 정리:

```sql
UPDATE usage_counters
   SET posts_used = posts_used + 1
 WHERE user_id = p_user_id AND period_start = v_period_start
   AND posts_used < v_quota
RETURNING posts_used INTO v_new_used;
IF v_new_used IS NULL THEN RAISE EXCEPTION 'QUOTA_EXCEEDED'; END IF;
```

→ implementation plan에서 정리.

### 4.3 `get_active_entitlement` — UI 조회용

```sql
CREATE OR REPLACE FUNCTION public.get_active_entitlement(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_sub       subscriptions%ROWTYPE;
  v_plan      subscription_plans%ROWTYPE;
  v_counter   usage_counters%ROWTYPE;
  v_period    DATE := date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE user_id = p_user_id;
  IF NOT FOUND
     OR v_sub.status NOT IN ('active', 'in_trial', 'in_grace_period', 'cancelled')
     OR (v_sub.status = 'cancelled' AND v_sub.period_end <= now())
  THEN
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = 'free';
  ELSE
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = v_sub.plan_id;
  END IF;

  SELECT * INTO v_counter FROM usage_counters
   WHERE user_id = p_user_id AND period_start = v_period;

  RETURN jsonb_build_object(
    'tier', v_plan.tier,
    'plan_id', v_plan.plan_id,
    'period', v_plan.period,
    'status', COALESCE(v_sub.status, 'active'),
    'period_end', v_sub.period_end,
    'trial_end', v_sub.trial_end,
    'cancel_at', v_sub.cancel_at,
    'quota', jsonb_build_object(
      'posts', v_plan.monthly_post_quota,
      'views', v_plan.monthly_view_quota,
      'stores', v_plan.max_stores
    ),
    'used', jsonb_build_object(
      'posts', COALESCE(v_counter.posts_used, 0),
      'views', COALESCE(v_counter.views_used, 0)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_entitlement TO authenticated;
```

### 4.4 `archive_old_usage_counters` — pg_cron (archive 전용)

카운터 reset은 **자동**이다. 매월 1일이 되면 `check_quota_and_increment`의 `period_start = date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date` 식이 새 키를 사용하므로 `ON CONFLICT DO NOTHING`으로 새 row가 생성된다. 따라서 cron은 **오래된 row archive 용도로만** 운영한다.

```sql
-- pg_cron: 매월 1일 03:00 KST에 3개월 이전 row archive
SELECT cron.schedule(
  'archive_usage_counters',
  '0 18 1 * *',                       -- UTC 18:00 = KST 03:00 다음날
  $$ SELECT archive_old_usage_counters() $$
);

CREATE OR REPLACE FUNCTION archive_old_usage_counters()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_cutoff DATE := (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') - interval '3 months')::date;
  v_count  INT;
BEGIN
  -- 3개월 이전 row를 archive 테이블로 이동 (선택 — 통계 보존 시)
  -- 또는 단순 DELETE (사용량 통계는 subscription_events에서 derive 가능)
  DELETE FROM usage_counters WHERE period_start < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

**구현 결정**: archive 테이블 생성 vs DELETE는 implementation plan 단계에서 BI 요구사항에 따라 결정. spec 단계에선 DELETE로 단순화.

---

## 5. RevenueCat Subscription API 차이점

### 5.1 SDK 호출 차이

| 작업 | Track A (Consumable) | Track B (Subscription) |
|---|---|---|
| 상품 조회 | `getProducts(['sku1','sku2'], NON_SUBSCRIPTION)` | `getOfferings()` → `current.availablePackages` |
| 구매 | `purchaseStoreProduct(product)` | `purchasePackage(pkg)` |
| 권한 확인 | `wallet.diamond_balance` (DB 쿼리) | `customerInfo.entitlements.active['pro']` (SDK 캐시) |
| 복원 | `restorePurchases()` (consumable은 의미 약함) | `restorePurchases()` (필수 — 디바이스 변경) |
| 변경 | N/A (각 구매 독립) | `purchasePackage(newPkg)` → proration 자동 |

### 5.2 Webhook 이벤트 매핑

| RC Event | event_type | 액션 |
|---|---|---|
| `INITIAL_PURCHASE` | `created` | sync (active, period_end, trial_end if applicable) |
| `RENEWAL` | `renewed` | sync (period_start/end 갱신) |
| `PRODUCT_CHANGE` | `plan_changed` | sync (새 plan_id, proration은 store가 처리) |
| `CANCELLATION` (사용자 cancel) | `cancelled` | sync (cancel_at 설정, status=active 유지 — period_end까지) |
| `UNCANCELLATION` | `reactivated` | sync (cancel_at=NULL) |
| `EXPIRATION` | `expired` | sync (status=expired, plan_id 그대로 두거나 'free'로) |
| `BILLING_ISSUE` | `billing_issue` | sync (status=billing_issue) |
| `SUBSCRIPTION_PAUSED` | (Android만) | metadata만 기록 |
| `SUBSCRIBER_ALIAS` | — | user_id 머지 (드물게 발생) |
| `TRANSFER` | — | revenuecat_customer_id 변경만 |
| `REFUND` | `refunded` | status=expired + 환불 정책 적용 |
| `NON_RENEWING_PURCHASE` | — | (Track A 영역, 무시) |

### 5.3 `customerInfo.entitlements.active` 구조

```typescript
type RCActiveEntitlement = {
  identifier: 'basic' | 'pro' | 'enterprise';
  isActive: true;
  willRenew: boolean;
  periodType: 'normal' | 'trial' | 'intro';
  latestPurchaseDate: string;
  originalPurchaseDate: string;
  expirationDate: string | null;     // null = lifetime
  store: 'app_store' | 'play_store' | 'promotional';
  productIdentifier: string;
  isSandbox: boolean;
};
```

**클라이언트 권한 판정 우선순위**:
1. RC SDK `customerInfo.entitlements.active[id]` (offline 가능, 캐시)
2. Supabase `subscriptions` row (서버 신뢰)
3. 두 값 mismatch → `restorePurchases()` 트리거 후 재조회

### 5.4 환경변수

- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `REVENUECAT_WEBHOOK_SECRET` (Supabase secret)
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 6. 클라이언트 구조

### 6.1 디렉토리

```
uniqn-mobile/src/
├── services/subscription/
│   ├── purchasesService.ts            # RC SDK wrapper (subscription 전용)
│   ├── subscriptionService.ts         # 구독 상태 조회/구매/취소
│   └── __tests__/
├── repositories/supabase/
│   └── SubscriptionRepository.ts      # subscriptions / events / counters
├── hooks/
│   ├── useEntitlement.ts              # 현재 plan + quota
│   ├── usePurchaseSubscription.ts
│   ├── useChangePlan.ts               # upgrade/downgrade
│   └── useCancelSubscription.ts
├── components/subscription/
│   ├── PlanCard.tsx                   # tier 카드 (Free/Basic/Pro/Enterprise)
│   ├── PlanComparisonTable.tsx        # 4열 비교
│   ├── PaywallSheet.tsx               # quota 초과 시 표시
│   ├── ManageSubscriptionScreen.tsx   # plan/period_end/cancel 관리
│   └── QuotaUsageMeter.tsx            # 헤더용 (used/quota)
└── stores/
    └── subscriptionStore.ts           # 권한 캐시 (optimistic UI)
```

### 6.2 RevenueCat 초기화

```typescript
// src/services/subscription/purchasesService.ts
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { logger } from '@/shared/logger';

export async function initializePurchases(supabaseUserId: string) {
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({
    apiKey: Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY!,
    })!,
    appUserID: supabaseUserId,
  });
}

export async function getOfferings() {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchaseSubscription(pkg: PurchasesPackage) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    // webhook이 DB sync 처리. 클라이언트는 entitlement refetch만.
    return { success: true, customerInfo };
  } catch (e: any) {
    if (e.userCancelled) return { success: false, cancelled: true };
    logger.error('subscription_purchase_failed', e);
    throw e;
  }
}

export async function restoreSubscriptions() {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo;
}
```

### 6.3 공고 작성 게이트 통합

```typescript
// src/services/jobs/jobManagementService.ts

async function createJobPosting(input: CreateJobPostingInput) {
  // 1. quota 체크 + 증가 (단일 RPC)
  if (input.type !== 'tournament') {  // tournament는 admin 영업, quota 면제
    const { data, error } = await supa.rpc('check_quota_and_increment', {
      p_user_id: currentUser.id,
      p_action: 'post',
    });
    if (error) {
      if (error.message.includes('QUOTA_EXCEEDED')) {
        throw new QuotaExceededError(data?.plan, data?.quota);
      }
      throw error;
    }
  }

  // 2. 공고 INSERT
  const { data: posting } = await supa.from('job_postings')
    .insert({...input}).select().single();

  return posting;
}
```

**Track A와 차이**: ledger ref_id 역참조 패턴 불필요. quota는 단순 카운터로 충분.

### 6.4 Paywall UX

```typescript
// QuotaExceededError 발생 시 PaywallSheet 표시
// - 현재 tier + 사용량 + 남은 일수 표시
// - "월 X건 초과! Pro로 업그레이드 시 100건/월" 제안
// - upgrade CTA → purchasePackage(proPkg) → 즉시 사용 가능 (proration)
```

---

## 7. Feature Flag 롤아웃

### 7.1 `app_config` 활용 (기존)

```sql
INSERT INTO app_config(key, value) VALUES
  ('subscription.enabled', '{"enabled": false}'::jsonb),
  ('subscription.enforced_tiers', '{"free": true, "basic": false, "pro": false}'::jsonb),
  ('subscription.rollout_percentage', '{"value": 0}'::jsonb);
```

### 7.2 단계별 전환

| Phase | 기간 | 전략 |
|---|---|---|
| Beta | M+0~1 | 모두 Free quota 무제한 (소프트 launch, 사용 패턴 수집) |
| Soft enforce | M+2 | Free quota 적용, Paid는 옵션 (paywall만 보이고 강제 X) |
| Paywall on | M+3 | quota 초과 시 paywall 강제, rollout 10% |
| Confidence ramp | M+4 | rollout 50% |
| Full | M+6 | rollout 100%, free trial 유료 전환 본격화 |

### 7.3 Rollout deterministic hash

Track A spec과 동일 패턴 (`userBucket(userId)` SHA-256 mod 100). 한 사용자가 비결정적으로 paid↔free 사이를 흔들리지 않게.

---

## 8. 보안 위협 모델 (STRIDE)

| 위협 | 시나리오 | 완화 |
|---|---|---|
| **Spoofing** | 가짜 webhook | RC_WEBHOOK_SECRET 검증 |
| **Tampering (client)** | 클라이언트가 entitlement 위조 | quota는 SECURITY DEFINER RPC + RLS, 클라 입력 무시 |
| **Tampering (jailbreak)** | 탈옥 기기에서 SDK 조작 | RC가 영수증 검증 1차 + 서버 webhook이 source of truth |
| **Repudiation** | "결제 안 됐다" 클레임 | `subscription_events` immutable + RC 영수증 |
| **Info Disclosure** | 다른 사용자 plan 조회 | RLS `auth.uid() = user_id` |
| **DoS** | check_quota 무한 호출 | RC가 1차 + Edge Function rate limit + RPC가 단일 row UPDATE만 (저렴) |
| **Elevation** | 일반 user가 sync RPC 호출 | `REVOKE FROM authenticated`, service_role만 |
| **Idempotency violation** | 같은 RC event 2회 | `revenuecat_event_id UNIQUE` |
| **Quota race** | 동시 공고 작성으로 quota 초과 | `UPDATE ... WHERE used < quota` 단일 row 락 |
| **Trial abuse** | 같은 카드/디바이스로 trial 반복 | RC가 Apple/Google subscriptionGroup 단위로 1회 제한 (자동) |
| **Cancellation race** | cancel 중 작성 | period_end > now() && status='active' 인 동안만 quota 통과 |
| **Refund manipulation** | 결제 후 환불, 사용량 유지 | refund 시 status=expired + 남은 quota 차감 (선택적) |
| **Plan downgrade timing** | proration 회피 | RC store proration에 의존, 자체 계산 안 함 |

---

## 9. 테스트 전략 (TDD)

### 9.1 RPC 단위 테스트 (PL/pgSQL)

- `sync_subscription_atomically` 멱등성 (같은 event_id 2회)
- plan_changed 시 from/to 기록 정확성
- cancelled status에서 period_end까지 quota 통과 확인
- expired status에서 quota 차단 확인
- in_grace_period에서 quota 통과 (RC 정책 — 결제 복구 유예)

### 9.2 `check_quota_and_increment` 테스트

- Free user 4번째 공고 → QUOTA_EXCEEDED
- Basic user 21번째 → QUOTA_EXCEEDED (Pro 제안 paywall)
- Enterprise -1 quota → 항상 통과
- 동시 호출 race (10개 병렬 시 정확히 quota만큼만 통과)
- 월 reset 후 재사용 가능

### 9.3 Service 통합 테스트 (Jest)

- `purchaseSubscription` → mock RC + Supabase webhook
- proration: Basic→Pro 즉시 변경 시 사용량 carry-over
- restorePurchases → entitlement 복구
- Feature flag off → quota 무제한

### 9.4 Webhook 테스트

- INITIAL_PURCHASE → subscriptions row 생성 + event row
- RENEWAL → period_end 갱신
- PRODUCT_CHANGE → plan_id 변경 + plan_changed event
- CANCELLATION → cancel_at 설정 (status=active 유지)
- REFUND → status=expired
- 같은 event 2회 → idempotent 응답

### 9.5 E2E (sandbox)

- Free → Basic 구매 → 21번째 공고 시 Pro paywall → 업그레이드 → 사용 가능
- Trial 14일 시작 → 만료 → Free 회귀 → 경고 표시

---

## 10. 모니터링 / KPI

### 10.1 대시보드

- **MRR**: `SUM(price_krw)` (active + in_trial → 0, in_grace → 50% 가중) by month
- **ARR**: MRR × 12
- **ARPU**: MRR / active 사용자 수
- **Churn rate**: 월말 cancelled+expired / 월초 active
- **Trial conversion**: trial_converted / trial_started
- **LTV**: ARPU × (1 / churn_rate)
- **Free→Paid funnel**: signup → first quota hit → paywall → purchase
- **Plan mix**: Free/Basic/Pro/Enterprise 비율

### 10.2 알람

- webhook 실패율 > 1% → Slack
- billing_issue 사용자 수 급증 (>5%) → 결제 시스템 점검
- subscription drift (RC active vs DB inactive) > 0.5% → reconcile 작업

### 10.3 정기 reconcile (선택)

- 매일 새벽: RC API로 활성 customer 목록 조회 → DB와 diff → 불일치 정정

---

## 11. Open Questions (사용자 검토 필요)

| # | 결정 | 옵션 | Auto-mode 가정 | 비고 |
|---|---|---|---|---|
| Q1 | Free 사용자 row | (a) row 없음, (b) plan_id='free' 명시 | **(a) row 없음** | 신규 가입 시 INSERT 부담 회피 |
| Q2 | 미사용 quota 이월 | (a) 안 됨, (b) 50% 이월, (c) 전부 이월 | **(a) 안 됨** | 단순성, RC 표준 |
| Q3 | Free trial 이탈 시 | (a) Free 회귀, (b) 자동 Basic 결제, (c) cancel 강제 | **(a) Free 회귀** | 신용카드 등록 X (가정 6) |
| Q4 | 공고 취소 시 quota 환원 | (a) 환원, (b) 환원 X, (c) 24h 내만 환원 | **(c) 24h 내** | 어뷰징 방지 + UX |
| Q5 | 환불 정책 | (a) RC 표준 (스토어), (b) 자체 일할, (c) 환불 불가 | **(a) RC 표준** | RC가 모든 처리 |
| Q6 | Plan 변경 proration | (a) RC 자동, (b) 자체 계산 | **(a) RC 자동** | iOS는 자동, Android는 패키지 변경 시 자동 |
| Q7 | downgrade 시점 | (a) 즉시, (b) 다음 period | **(b) 다음 period** | 사용자 친화 |
| Q8 | Annual cancel 시 | (a) 즉시 환불, (b) period_end까지 사용 | **(b) period_end까지** | 연간 결제 표준 |
| Q9 | Enterprise 영업 | (a) 일반 IAP, (b) 자체 영업 + B2B 인보이스, (c) 둘 다 | **(c) 둘 다** | 일반 IAP는 매장 1~5, B2B는 그 이상 |
| Q10 | tournament 공고 quota | (a) 면제 (admin 전용), (b) Free에선 차단, (c) 모든 tier 별도 quota | **(a) 면제** | Track A와 동일 |
| Q11 | 첫 결제 보너스 | (a) 없음, (b) 첫 달 50%, (c) 14일 추가 trial | **(c) 14일 추가** | annual 첫 결제 시 14일 더 |

---

## 12. 마이그레이션 순서

1. `20260427100000_create_subscription_tables.sql` — 4개 테이블 + ENUM
2. `20260427100100_create_subscription_rls.sql` — RLS 정책
3. `20260427100200_create_subscription_rpcs.sql` — sync / check_quota / get_active
4. `20260427100300_seed_subscription_plans.sql` — 7개 plan 시드
5. `20260427100400_create_subscription_app_config.sql` — Feature flag
6. `20260427100500_create_usage_archive_cron.sql` — pg_cron (3개월 이상 archive)

총 6개 마이그레이션 (Track A는 9개) — 단순함이 강점.

---

## 13. 외부 작업 (코드 외)

1. **RevenueCat 계정** + 앱 등록 (Track A와 공유 가능)
2. **App Store Connect**: Auto-Renewable Subscription 등록 (3개 group: basic, pro, enterprise)
   - 각 group에 monthly + annual 2개 상품 → **6개 product**
3. **Google Play Console**: Subscription 등록 (3개 product, 각 base + annual offer)
4. **RevenueCat Entitlements**: `basic`, `pro`, `enterprise` 3개 정의
5. **RevenueCat Offering**: `default` offering에 6~7개 package 연결
6. **RC Webhook URL**: `https://<project>.supabase.co/functions/v1/revenuecat-subscription-webhook`
7. **법무 검토**: 자동 갱신 약관 + 환불 정책 (특히 annual)
8. **사업자 등록**: B2B Enterprise 인보이스 발행 가능 형태
9. **약관 업데이트**: 14일 trial + 자동 결제 명시 (한국법 자동결제 고지 의무)

---

## 14. 다음 단계

1. **Spec self-review** — placeholder/contradiction/ambiguity 점검
2. **사용자 검토** — Q1~Q11 결정 + 6개 auto-mode 가정 lock
3. **`writing-plans` 스킬 호출** — 6개 마이그레이션 단계를 implementation plan으로 변환

---

## 부록 A — 비즈니스 가정 (auto-mode)

- 기존 BUSINESS_PLAN 다이아 가격은 폐기, 월정액 4-tier 채택
- BEP 가정: M+6 MRR 200만원 = 약 50명 Pro 또는 7명 Enterprise
- 앱스토어 수수료: 첫 1년 30%, 이후 15% (구독은 1년 후 자동 인하)
- Free trial 어뷰징은 RC가 1차 차단 (subscriptionGroup 단위)

## 부록 B — Track A vs Track B 핵심 차이 요약

| | Track A (Consumable) | Track B (Subscription) |
|---|---|---|
| DB 테이블 | 4개 (wallets/ledger/lots/products) | 4개 (subs/events/counters/plans) |
| 마이그레이션 수 | 9개 | 6개 |
| 핵심 RPC | `consume_diamonds_atomically` | `check_quota_and_increment` |
| 잔액 vs 권한 | 잔액 체크 + 차감 | quota 체크 + 카운터 증가 |
| 환불 처리 | 음수 ledger row | status=expired + RC 자동 |
| 이력 추적 | wallet_ledger (모든 변동) | subscription_events (상태 변경만) |
| 만료 처리 | heart_lots FIFO + cron | period_end + RC webhook |
| KPI 핵심 | ARPPU, 충전 funnel | MRR, churn, LTV |

상세 비교는 별도 문서 `2026-04-26-monetization-comparison.md` 참조.

## 부록 C — 참고 라이브러리 / 문서

- `react-native-purchases` — context7 ID: `/revenuecat/react-native-purchases`
- RC Subscriber Attributes: <https://www.revenuecat.com/docs/customer-center>
- RC Webhooks (Subscription events): <https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields>
- App Store Auto-Renewable Subscription
- Google Play Subscription

---

*Spec 종료 — 사용자 검토 대기.*
