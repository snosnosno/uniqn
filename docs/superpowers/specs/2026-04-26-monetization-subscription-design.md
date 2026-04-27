# Monetization System (Track B) — Subscription Design Spec

- 작성일: 2026-04-26 (v2: 가격 1/10 + 알바몬/잡코리아 모델 차용)
- 브랜치: `design/monetization-subscription`
- 상태: **Auto-mode draft v2** (사용자 검토 대기)
- 자매 spec: `2026-04-26-monetization-design.md` (Track A — Consumable, Locked)
- 비교 문서: `2026-04-26-monetization-comparison.md`
- 후속: 사용자 승인 시 `writing-plans` 스킬로 implementation plan 생성 진행

---

## 0. Executive Summary

UNIQN 매출 엔진의 **두 번째 가설** — 다이아 충전 대신 **저가 월정액 구독**으로 구인자에게 차등 기능을 판매한다. 모델은 **알바몬/잡코리아/사람인 패턴**을 차용한다: **공고 등록은 모든 tier 무제한**, 차등은 **노출 위치 / 지원자 검색 / 인재 DB / 매칭 알고리즘**에서 발생.

핵심 의사결정 (v2):
1. **RevenueCat Offerings + Packages** — `purchasePackage()` + `customerInfo.entitlements.active` 패턴.
2. **DB는 entitlement 캐시** — `subscriptions` 테이블이 최신 상태(현재 plan/만료일)만 보유, 변경 이력은 `subscription_events`.
3. **공고 quota 없음** — 모든 tier 공고 등록 무제한. 카운터는 일부 기능(면접 제안, 인재 DB 검색)에만 적용.
4. **4-tier 저가 (Free / Basic / Pro / Enterprise)** — Basic ₩3,900 / Pro ₩9,900 / Enterprise ₩29,900.
5. **연간 할인 16.7%** (월 × 10).
6. **Free trial 14일** — 신용카드 등록 X, 만료 후 Free 회귀.

성공 지표 (M+1 ~ M+6):
- M+1: 유료 전환 사용자 ≥ 30명, MRR ≥ 30만원
- M+3: Free→Paid 전환율 ≥ 8%, churn ≤ 10%/월
- M+6: MRR ≥ 100만원, 활성 구독자 ≥ 150명

---

## 1. 한국 구인구직 플랫폼 모델 분석 (Reference)

| 플랫폼 | 핵심 수익원 | 가격대 | 차용 요소 |
|---|---|---|---|
| **알바몬** | 공고 노출 등급 (스피드업/하이라이트) + 카테고리 상단 | 7~10일 ₩5천~5만 | **노출 등급제** |
| **알바천국** | 공고 등록 무료 + 메인/카테고리 상단 노출 패키지 | 일/주/월 단위 | **노출 위치 차등** |
| **잡코리아** | B2B 인재DB 정액 + 공고 패키지 (스타트/베이직/프리미엄) | 월 ₩30만~ | **tier별 패키지** |
| **사람인** | 인재DB 열람권 + 광고 상품 + 채용 솔루션 | 월 ₩30~50만 | **이력서 검색권** |
| **원티드** | 채용성공 보수 (성공 시 연봉 7%) + 매칭 알고리즘 | 채용당 | **AI 매칭 우선순위** |
| **인디드** | 무료 노출 + Sponsored CPC 입찰 | 입찰가 | **Pay-for-performance (Phase 3 검토)** |

**UNIQN 차별화 핵심**: 한국 포커펍/홀덤클럽 영세 사업자가 주 고객. 잡코리아 ₩30만/월은 부담 → **1/10 가격 (₩3.9k~29.9k) 진입장벽 제거**, 차등은 **기능/노출**에서.

### 1.1 UNIQN 적용 차등 요소 (10개 dimension)

| # | 차등 요소 | 출처 | UNIQN 적용 |
|---|---|---|---|
| 1 | **공고 노출 위치** | 알바몬 스피드업 / 알바천국 메인 | 일반 / 강조 / 긴급(푸시) / 고정(상단) / 우선검색 |
| 2 | **지원자 프로필 열람** | 잡코리아 베이직 | Free=내 공고만, Paid=무제한 |
| 3 | **인재 DB 검색** (구직자 풀에서 직접) | 사람인 인재DB | Pro+ |
| 4 | **면접/근무 제안** (미지원자 메시지) | 사람인 면접제안 | Pro 30건/월, Enterprise 무제한 |
| 5 | **AI 매칭 푸시 알림** | 원티드 매칭 | Free X, Basic 5건, Pro 50건, Enterprise 무제한 |
| 6 | **분석 대시보드** | 잡코리아 채용리포트 | Free 기본, Pro CSV export, Enterprise 인사이트 |
| 7 | **브랜드 페이지** | 사람인 기업페이지 | Pro 미니, Enterprise 풀 (배너+사진갤러리) |
| 8 | **다중 매장 관리** | (UNIQN 특화) | 1 / 1 / 5 / 무제한 |
| 9 | **우선 검색 노출** | 알바몬 황금공고 | Enterprise만 |
| 10 | **전담 매니저 / SLA** | 잡코리아 채용 컨설팅 | Enterprise만 |

---

## 2. 현재 상태 진단

| 영역 | 현재 상태 | 근거 |
|---|---|---|
| 결제 코드 | **0%** | Track A spec과 동일 — 그린필드 |
| 결제 DB 테이블 | **wallet 4종 존재** (Track A 구현 중) | `git log` → 5개 wallet 커밋 |
| 결제 패키지 | **미설치** | `react-native-purchases` 없음 |
| PortOne SDK | **본인인증 전용** | 충돌 없음 |

**진단**: Track A wallet은 Track B에서 미사용. 별도 브랜치 작업 → Track A 영향 없음.

---

## 3. 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client (Expo RN)                          │
│  RC SDK → purchasePackage / restorePurchases / getOfferings      │
│  EntitlementStore (Zustand) + useEntitlement Query               │
└────────────┬─────────────────────────────────────────────────────┘
             │ purchase / restore
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RevenueCat (SaaS)                            │
│  - Customer (appUserID = Supabase user.id)                      │
│  - Entitlements: basic / pro / enterprise                        │
│  - Webhook → Supabase Edge Function                              │
└────────────┬─────────────────────────────────────────────────────┘
             │ signed POST
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function (Deno)                       │
│  /functions/revenuecat-subscription-webhook/index.ts             │
│  → sync_subscription_atomically RPC                              │
└────────────┬─────────────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                Supabase Postgres (RLS-enabled)                   │
│                                                                   │
│   subscription_plans     subscriptions       subscription_events │
│                          (entitlement)        (immutable history) │
│                                                                   │
│   feature_usage          (rate-limited 기능: 면접제안/인재검색)   │
│                                                                   │
│   RPCs:                                                           │
│   - sync_subscription_atomically (webhook)                        │
│   - check_feature_access(user, feature) → boolean                 │
│   - check_and_increment_feature_usage(user, feature) → JSONB     │
│   - get_active_entitlement(user_id) → JSONB                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. DB 스키마

### 4.1 `subscription_plans` — 플랜 카탈로그 (10개 차등 요소 컬럼)

```sql
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');
CREATE TYPE subscription_period AS ENUM ('monthly', 'annual');

CREATE TABLE public.subscription_plans (
  plan_id                       TEXT PRIMARY KEY,
  tier                          subscription_tier NOT NULL,
  period                        subscription_period NOT NULL,

  -- 공고 노출 (boolean flags)
  can_emphasize_post            BOOLEAN NOT NULL DEFAULT false,    -- 강조 표시
  can_urgent_post               BOOLEAN NOT NULL DEFAULT false,    -- 긴급(푸시) 노출
  can_pinned_post               BOOLEAN NOT NULL DEFAULT false,    -- 상단 고정
  has_priority_search_rank      BOOLEAN NOT NULL DEFAULT false,    -- 검색 결과 우선

  -- 지원자/인재
  can_view_all_applicants       BOOLEAN NOT NULL DEFAULT false,    -- 내 공고 외 응시자 프로필
  can_search_talent_db          BOOLEAN NOT NULL DEFAULT false,    -- 인재 DB 검색
  monthly_outreach_quota        INT NOT NULL DEFAULT 0,            -- 면접/근무 제안 (-1=무제한)
  monthly_ai_match_push         INT NOT NULL DEFAULT 0,            -- AI 매칭 푸시 (-1=무제한)

  -- 분석/브랜드
  has_advanced_analytics        BOOLEAN NOT NULL DEFAULT false,    -- 상세 대시보드 + CSV
  has_brand_page                TEXT NOT NULL DEFAULT 'none',      -- 'none' | 'mini' | 'full'

  -- 매장
  max_stores                    INT NOT NULL DEFAULT 1,            -- -1=무제한

  -- 지원
  has_dedicated_support         BOOLEAN NOT NULL DEFAULT false,

  -- 메타
  price_krw                     INT NOT NULL,
  display_order                 INT NOT NULL DEFAULT 0,
  active                        BOOLEAN NOT NULL DEFAULT true,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_quota_nonneg CHECK (
    (monthly_outreach_quota = -1 OR monthly_outreach_quota >= 0)
    AND (monthly_ai_match_push = -1 OR monthly_ai_match_push >= 0)
    AND (max_stores = -1 OR max_stores >= 1)
  ),
  CONSTRAINT chk_brand_page CHECK (has_brand_page IN ('none','mini','full'))
);
```

### 4.2 시드 데이터

| plan_id | tier | period | emp | urg | pin | psr | view | tdb | out | ai | adv | brand | stores | sup | price |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `free` | free | monthly | F | F | F | F | F | F | 0 | 0 | F | none | 1 | F | 0 |
| `basic_monthly` | basic | monthly | T | F | F | F | F | F | 0 | 5 | F | none | 1 | F | 3,900 |
| `basic_annual` | basic | annual | T | F | F | F | F | F | 0 | 5 | F | none | 1 | F | 39,000 |
| `pro_monthly` | pro | monthly | T | T | T | F | T | T | 30 | 50 | T | mini | 5 | F | 9,900 |
| `pro_annual` | pro | annual | T | T | T | F | T | T | 30 | 50 | T | mini | 5 | F | 99,000 |
| `enterprise_monthly` | enterprise | monthly | T | T | T | T | T | T | -1 | -1 | T | full | -1 | T | 29,900 |
| `enterprise_annual` | enterprise | annual | T | T | T | T | T | T | -1 | -1 | T | full | -1 | T | 299,000 |

**약어**: emp=can_emphasize_post, urg=can_urgent_post, pin=can_pinned_post, psr=has_priority_search_rank, view=can_view_all_applicants, tdb=can_search_talent_db, out=monthly_outreach_quota, ai=monthly_ai_match_push, adv=has_advanced_analytics, brand=has_brand_page, sup=has_dedicated_support.

**할인율**: annual = monthly × 10 → 월환산 16.7% 절감.
**핵심 변경**: 공고 등록 자체는 모든 tier에서 quota 없음. Free도 무제한 등록 가능. 차이는 노출/검색/제안에서만.

### 4.3 `subscriptions` — 사용자 현재 구독 (entitlement 캐시)

```sql
CREATE TYPE subscription_status AS ENUM (
  'active','in_trial','in_grace_period','cancelled','expired','billing_issue'
);

CREATE TABLE public.subscriptions (
  user_id                  UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id                  TEXT NOT NULL REFERENCES public.subscription_plans(plan_id),
  status                   subscription_status NOT NULL DEFAULT 'active',
  period_start             TIMESTAMPTZ NOT NULL,
  period_end               TIMESTAMPTZ NOT NULL,
  cancel_at                TIMESTAMPTZ,
  trial_end                TIMESTAMPTZ,
  revenuecat_customer_id   TEXT NOT NULL,
  store_country            TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_period CHECK (period_end > period_start)
);

CREATE INDEX idx_subscriptions_status ON public.subscriptions(status)
  WHERE status IN ('active','in_trial','in_grace_period');
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(period_end);
```

**Free 사용자**: row 없음 = Free로 간주.

### 4.4 `subscription_events` — 변경 이력 (immutable 감사용)

```sql
CREATE TYPE subscription_event_type AS ENUM (
  'created','renewed','plan_changed','cancelled','reactivated','expired',
  'refunded','billing_issue','grace_started','grace_resolved',
  'trial_started','trial_converted','trial_expired_to_free'
);

CREATE TABLE public.subscription_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type               subscription_event_type NOT NULL,
  from_plan_id             TEXT REFERENCES public.subscription_plans(plan_id),
  to_plan_id               TEXT REFERENCES public.subscription_plans(plan_id),
  revenuecat_event_id      TEXT UNIQUE,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_user ON public.subscription_events(user_id, occurred_at DESC);
```

### 4.5 `feature_usage` — 차감 가능한 기능 카운터 (면접 제안 / 인재 DB 검색 등)

```sql
CREATE TYPE rate_limited_feature AS ENUM ('outreach', 'ai_match_push', 'talent_search');

CREATE TABLE public.feature_usage (
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature          rate_limited_feature NOT NULL,
  period_start     DATE NOT NULL,
  used             INT NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, period_start)
);

CREATE INDEX idx_feature_usage_period ON public.feature_usage(period_start);
```

**핵심 변경 vs v1**: `usage_counters`가 `feature_usage`로 바뀌고 공고/조회 카운터는 제거됨. 카운터 적용 대상은:
- `outreach` (면접/근무 제안 — 사람인 면접제안 차용)
- `ai_match_push` (구직자에게 자동 매칭 푸시 — 원티드 차용)
- `talent_search` (인재 DB 검색 — 사람인/잡코리아 차용, Phase 2부터 도입 가능)

### 4.6 RLS 정책

```sql
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans     ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_self_select ON subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY subscription_events_self_select ON subscription_events
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY feature_usage_self_select ON feature_usage
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 모든 쓰기는 SECURITY DEFINER RPC만
CREATE POLICY subscriptions_no_direct_write ON subscriptions
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY subscription_events_no_direct_write ON subscription_events
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY feature_usage_no_direct_write ON feature_usage
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY plans_public_read ON subscription_plans
  FOR SELECT USING (active = true);

CREATE POLICY subscription_admin_all ON subscriptions
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

---

## 5. RPC 함수

### 5.1 `sync_subscription_atomically` — webhook entry point

(v1과 동일, 변경 없음)

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
  SELECT id INTO v_existing_event FROM subscription_events
   WHERE revenuecat_event_id = p_rc_event_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  SELECT plan_id INTO v_prev_plan_id FROM subscriptions WHERE user_id = p_user_id;

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

### 5.2 `check_feature_access` — boolean 권한 체크 (UI/RLS용)

```sql
CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_user_id UUID,
  p_feature TEXT      -- 'emphasize_post' | 'urgent_post' | 'pinned_post' | 'priority_search'
                      -- | 'view_all_applicants' | 'talent_search' | 'advanced_analytics'
                      -- | 'brand_page_mini' | 'brand_page_full' | 'dedicated_support'
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_sub  subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE user_id = p_user_id;
  IF NOT FOUND
     OR v_sub.status NOT IN ('active','in_trial','in_grace_period','cancelled')
     OR (v_sub.status = 'cancelled' AND v_sub.period_end <= now())
  THEN
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = 'free';
  ELSE
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = v_sub.plan_id;
  END IF;

  RETURN CASE p_feature
    WHEN 'emphasize_post'      THEN v_plan.can_emphasize_post
    WHEN 'urgent_post'         THEN v_plan.can_urgent_post
    WHEN 'pinned_post'         THEN v_plan.can_pinned_post
    WHEN 'priority_search'     THEN v_plan.has_priority_search_rank
    WHEN 'view_all_applicants' THEN v_plan.can_view_all_applicants
    WHEN 'talent_search'       THEN v_plan.can_search_talent_db
    WHEN 'advanced_analytics'  THEN v_plan.has_advanced_analytics
    WHEN 'brand_page_mini'     THEN v_plan.has_brand_page IN ('mini','full')
    WHEN 'brand_page_full'     THEN v_plan.has_brand_page = 'full'
    WHEN 'dedicated_support'   THEN v_plan.has_dedicated_support
    ELSE false
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION check_feature_access TO authenticated;
```

### 5.3 `check_and_increment_feature_usage` — rate-limited 기능 (면접 제안/AI 매칭/인재 검색)

```sql
CREATE OR REPLACE FUNCTION public.check_and_increment_feature_usage(
  p_user_id UUID,
  p_feature rate_limited_feature
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_plan         subscription_plans%ROWTYPE;
  v_sub          subscriptions%ROWTYPE;
  v_period       DATE := date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date;
  v_quota        INT;
  v_new_used     INT;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE user_id = p_user_id;
  IF NOT FOUND
     OR v_sub.status NOT IN ('active','in_trial','in_grace_period','cancelled')
     OR (v_sub.status = 'cancelled' AND v_sub.period_end <= now())
  THEN
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = 'free';
  ELSE
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = v_sub.plan_id;
  END IF;

  v_quota := CASE p_feature
    WHEN 'outreach'       THEN v_plan.monthly_outreach_quota
    WHEN 'ai_match_push'  THEN v_plan.monthly_ai_match_push
    WHEN 'talent_search'  THEN CASE WHEN v_plan.can_search_talent_db THEN -1 ELSE 0 END
  END;

  -- quota = 0 이면 plan 자체가 미지원
  IF v_quota = 0 THEN
    RAISE EXCEPTION 'FEATURE_NOT_IN_PLAN: % requires upgrade', p_feature;
  END IF;

  -- 무제한이면 카운터만 통계용으로 증가
  IF v_quota = -1 THEN
    INSERT INTO feature_usage(user_id, feature, period_start, used)
    VALUES (p_user_id, p_feature, v_period, 1)
    ON CONFLICT (user_id, feature, period_start)
    DO UPDATE SET used = feature_usage.used + 1, updated_at = now();
    RETURN jsonb_build_object('success', true, 'unlimited', true);
  END IF;

  -- 유한 quota: row UPSERT 후 quota 검증 + 증가
  INSERT INTO feature_usage(user_id, feature, period_start, used)
  VALUES (p_user_id, p_feature, v_period, 0)
  ON CONFLICT (user_id, feature, period_start) DO NOTHING;

  UPDATE feature_usage
     SET used = used + 1, updated_at = now()
   WHERE user_id = p_user_id
     AND feature = p_feature
     AND period_start = v_period
     AND used < v_quota
  RETURNING used INTO v_new_used;

  IF v_new_used IS NULL THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED: % used % of % for %',
      v_plan.tier, v_quota, v_quota, p_feature;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_plan.tier,
    'feature', p_feature,
    'quota', v_quota,
    'used', v_new_used,
    'remaining', v_quota - v_new_used
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_increment_feature_usage TO authenticated;
```

### 5.4 `get_active_entitlement` — UI 조회 (전체 권한 + 사용량 한 번에)

```sql
CREATE OR REPLACE FUNCTION public.get_active_entitlement(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_sub      subscriptions%ROWTYPE;
  v_plan     subscription_plans%ROWTYPE;
  v_period   DATE := date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date;
  v_usage    JSONB;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE user_id = p_user_id;
  IF NOT FOUND
     OR v_sub.status NOT IN ('active','in_trial','in_grace_period','cancelled')
     OR (v_sub.status = 'cancelled' AND v_sub.period_end <= now())
  THEN
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = 'free';
  ELSE
    SELECT * INTO v_plan FROM subscription_plans WHERE plan_id = v_sub.plan_id;
  END IF;

  SELECT jsonb_object_agg(feature, used)
    INTO v_usage
    FROM feature_usage
   WHERE user_id = p_user_id AND period_start = v_period;

  RETURN jsonb_build_object(
    'tier', v_plan.tier,
    'plan_id', v_plan.plan_id,
    'period', v_plan.period,
    'status', COALESCE(v_sub.status, 'active'),
    'period_end', v_sub.period_end,
    'trial_end', v_sub.trial_end,
    'cancel_at', v_sub.cancel_at,
    'features', jsonb_build_object(
      'emphasize_post', v_plan.can_emphasize_post,
      'urgent_post', v_plan.can_urgent_post,
      'pinned_post', v_plan.can_pinned_post,
      'priority_search', v_plan.has_priority_search_rank,
      'view_all_applicants', v_plan.can_view_all_applicants,
      'talent_search', v_plan.can_search_talent_db,
      'advanced_analytics', v_plan.has_advanced_analytics,
      'brand_page', v_plan.has_brand_page,
      'dedicated_support', v_plan.has_dedicated_support
    ),
    'quotas', jsonb_build_object(
      'outreach', v_plan.monthly_outreach_quota,
      'ai_match_push', v_plan.monthly_ai_match_push,
      'max_stores', v_plan.max_stores
    ),
    'used', COALESCE(v_usage, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_entitlement TO authenticated;
```

### 5.5 `archive_old_feature_usage` — pg_cron (3개월 이상 row archive)

```sql
SELECT cron.schedule(
  'archive_feature_usage',
  '0 18 1 * *',    -- UTC 18:00 = KST 03:00 다음 날
  $$ SELECT archive_old_feature_usage() $$
);

CREATE OR REPLACE FUNCTION archive_old_feature_usage()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_cutoff DATE := (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') - interval '3 months')::date;
  v_count  INT;
BEGIN
  DELETE FROM feature_usage WHERE period_start < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

---

## 6. RevenueCat 통합

### 6.1 SDK 차이점 (Track A vs B 동일, v1과 동일)

| 작업 | Track A (Consumable) | Track B (Subscription) |
|---|---|---|
| 상품 조회 | `getProducts(NON_SUBSCRIPTION)` | `getOfferings()` |
| 구매 | `purchaseStoreProduct` | `purchasePackage` |
| 권한 확인 | DB 잔액 | `customerInfo.entitlements.active['pro']` |
| 복원 | optional | 필수 (디바이스 변경) |
| 변경 | N/A | `purchasePackage` proration 자동 |

### 6.2 Webhook 이벤트 매핑

| RC Event | event_type | 액션 |
|---|---|---|
| `INITIAL_PURCHASE` | `created` | sync (active, period_end, trial_end) |
| `RENEWAL` | `renewed` | sync |
| `PRODUCT_CHANGE` | `plan_changed` | sync (proration RC 처리) |
| `CANCELLATION` | `cancelled` | sync (cancel_at 설정) |
| `UNCANCELLATION` | `reactivated` | sync (cancel_at=NULL) |
| `EXPIRATION` | `expired` | sync (status=expired) |
| `BILLING_ISSUE` | `billing_issue` | sync |
| `REFUND` | `refunded` | sync (status=expired) |
| `TRANSFER` | — | rc_customer_id 갱신만 |

---

## 7. 클라이언트 구조

```
uniqn-mobile/src/
├── services/subscription/
│   ├── purchasesService.ts            # RC SDK wrapper
│   ├── subscriptionService.ts
│   └── __tests__/
├── repositories/supabase/
│   └── SubscriptionRepository.ts
├── hooks/
│   ├── useEntitlement.ts              # plan + features + quotas + usage
│   ├── useFeatureAccess.ts            # 'urgent_post' 등 boolean
│   ├── usePurchaseSubscription.ts
│   ├── useChangePlan.ts
│   └── useCancelSubscription.ts
├── components/subscription/
│   ├── PlanCard.tsx                   # 4-tier 카드
│   ├── PlanComparisonTable.tsx        # 10-feature 비교 그리드
│   ├── PaywallSheet.tsx               # 기능 락 시 표시
│   ├── ManageSubscriptionScreen.tsx
│   └── BrandPageEditor.tsx            # Pro+ 매장 페이지
└── stores/
    └── subscriptionStore.ts
```

### 7.1 공고 작성 통합

```typescript
async function createJobPosting(input: CreateJobPostingInput) {
  // Free 사용자도 무제한 등록 가능
  // 노출 옵션만 권한 체크
  if (input.options?.urgent) {
    const ok = await supa.rpc('check_feature_access', {
      p_user_id: currentUser.id,
      p_feature: 'urgent_post',
    });
    if (!ok.data) throw new FeatureLockedError('urgent_post', 'pro');
  }
  if (input.options?.pinned) {
    const ok = await supa.rpc('check_feature_access', {
      p_user_id: currentUser.id,
      p_feature: 'pinned_post',
    });
    if (!ok.data) throw new FeatureLockedError('pinned_post', 'pro');
  }

  return supa.from('job_postings').insert({...input}).select().single();
}
```

### 7.2 면접 제안 통합 (rate-limited 예시)

```typescript
async function sendOutreach(staffUserId: string, message: string) {
  const { data, error } = await supa.rpc('check_and_increment_feature_usage', {
    p_user_id: currentUser.id,
    p_feature: 'outreach',
  });
  if (error) {
    if (error.message.includes('FEATURE_NOT_IN_PLAN')) {
      throw new FeatureLockedError('outreach', 'pro');
    }
    if (error.message.includes('QUOTA_EXCEEDED')) {
      throw new QuotaExceededError('outreach', data?.quota);
    }
    throw error;
  }
  // 실제 메시지 INSERT
  return supa.from('outreach_messages').insert({...});
}
```

---

## 8. Feature Flag 롤아웃

```sql
INSERT INTO app_config(key, value) VALUES
  ('subscription.enabled', '{"enabled": false}'::jsonb),
  ('subscription.enforced_features', '{"urgent_post": false, "pinned_post": false, "outreach": false}'::jsonb),
  ('subscription.rollout_percentage', '{"value": 0}'::jsonb);
```

| Phase | 기간 | 전략 |
|---|---|---|
| Beta | M+0~1 | 모든 기능 Free 노출, 데이터 수집 |
| Soft enforce | M+2 | 면접 제안만 quota 적용, 노출 옵션은 Free |
| Paywall on (노출) | M+3 | urgent/pinned/emphasize Paid, rollout 10% |
| Confidence ramp | M+4 | rollout 50% |
| Full | M+6 | 전체 차등 100% 적용 |

User bucket hash는 Track A spec과 동일 패턴 (`user_bucket(uuid) % 100`).

---

## 9. 보안 위협 모델 (STRIDE)

| 위협 | 시나리오 | 완화 |
|---|---|---|
| Spoofing | 가짜 webhook | RC_WEBHOOK_SECRET |
| Tampering (client) | 클라이언트가 entitlement 위조 | 서버 RPC + RLS |
| Tampering (jailbreak) | SDK 조작 | RC 영수증 + DB source of truth |
| Repudiation | "결제 안 됐다" | subscription_events immutable |
| Info Disclosure | 다른 사용자 plan | RLS auth.uid() = user_id |
| DoS | check_feature 무한 호출 | RC + Edge Function rate limit |
| Elevation | 일반 user sync RPC 호출 | service_role only |
| Idempotency | 같은 event 2회 | revenuecat_event_id UNIQUE |
| Outreach abuse | 무한 면접 제안 | feature_usage UPDATE quota check |
| Trial abuse | 같은 카드 trial 반복 | RC subscriptionGroup 단위 자동 차단 |
| Free 어뷰징 | Free로 무제한 공고 + 인재 가로채기 | 공고는 무제한 OK, 면접 제안은 Free 차단 |

---

## 10. 테스트 전략 (TDD)

- `sync_subscription_atomically` 멱등성
- `check_feature_access` 모든 10개 feature × 4 tier matrix
- `check_and_increment_feature_usage` race (10개 병렬, quota 정확성)
- 무제한 (-1) 처리 분기
- cancelled status에서 period_end까지 통과
- RC webhook 시나리오 (INITIAL/RENEWAL/CANCEL/EXPIRE/REFUND)
- E2E: Free → Pro 구매 → 면접 제안 30건 → 31번째 paywall

---

## 11. 모니터링 / KPI

- **MRR**: SUM(price_krw) WHERE status IN ('active','in_grace') GROUP BY month
- **Plan mix**: Free/Basic/Pro/Enterprise 비율
- **Feature adoption**: 각 feature_usage 분포
- **Trial conversion**: trial_converted / trial_started
- **Upsell signal**: 같은 사용자가 paywall hit한 feature 분포 → 어떤 기능이 결제 트리거인가

---

## 12. Open Questions

| # | 결정 | Auto-mode 가정 (v2) |
|---|---|---|
| Q1 | Free row 명시 | row 없음 (가정 유지) |
| Q2 | feature_usage 이월 | 안 됨 (RC 표준) |
| Q3 | Trial 만료 시 | Free 회귀 |
| Q4 | Outreach 후 거절/no-reply 시 카운트 환원 | 환원 X (남발 방지) |
| Q5 | 환불 정책 | RC 표준 |
| Q6 | Plan 변경 proration | RC 자동 |
| Q7 | Downgrade 시점 | 다음 period |
| Q8 | Annual cancel 시 | period_end까지 사용 |
| Q9 | Enterprise 영업 | 일반 IAP + B2B 인보이스 병행 |
| Q10 | Tournament 공고 | 모든 tier 무제한 (공고 등록 quota 자체 X) |
| Q11 | 첫 결제 보너스 | annual 결제 시 14일 추가 trial |
| Q12 (v2 신규) | Pro부터 인재 DB 전면 공개 vs Phase 2 | **Phase 2 도입** (v2 시드는 컬럼만 두고 Pro도 talent_search=true이지만 UI에서 "준비 중" 표시) |
| Q13 (v2 신규) | 알바몬식 공고 노출 부스팅 (단발 ₩1,000 등) | **Phase 2 검토** (Hybrid로 Track A 미니 잔존 가능) |

---

## 13. 마이그레이션 순서

1. `20260427100000_create_subscription_tables.sql` — 5개 테이블 + 3개 ENUM
2. `20260427100100_create_subscription_rls.sql`
3. `20260427100200_create_subscription_rpcs.sql` — 4개 RPC
4. `20260427100300_seed_subscription_plans.sql` — 7개 plan
5. `20260427100400_create_subscription_app_config.sql`
6. `20260427100500_create_feature_usage_archive_cron.sql`

총 6개 마이그레이션.

---

## 14. 외부 작업

1. **RC 계정** + 앱 등록
2. **App Store Connect**: Auto-Renewable Subscription
   - 3 group (basic/pro/enterprise) × 2 (monthly/annual) = **6 product**
   - 가격: ₩3,900 / ₩39,000 / ₩9,900 / ₩99,000 / ₩29,900 / ₩299,000
3. **Google Play Console**: 동일 6 product
4. **RC Entitlements**: `basic`, `pro`, `enterprise`
5. **RC Offering**: default offering에 6 package
6. **Webhook URL**: `https://<project>.supabase.co/functions/v1/revenuecat-subscription-webhook`
7. **법무 검토**: 자동 갱신 약관 + 14일 trial 명시 (한국 자동결제 고지 의무 — 전자상거래법)
8. **B2B 영업**: Enterprise tax invoice 발행 인프라 (사업자등록번호 입력)
9. **약관 업데이트**: 14일 trial + 자동 결제 + cancel 정책

---

## 15. 다음 단계

1. **사용자 검토** — Q1~Q13 + v2 가정 lock
2. **`writing-plans` 스킬 호출** — 6개 마이그레이션을 implementation plan으로

---

## 부록 A — 비즈니스 가정 (v2)

- 가격은 v1 (39k/99k/299k) 대비 **1/10**: 한국 포커펍 영세 사업자 진입장벽 제거
- 공고 등록은 **모든 tier 무제한**: 알바몬/알바천국 패턴 차용
- 차등은 **노출/검색/제안/분석/매장**에서: 잡코리아/사람인 패턴 차용
- BEP: M+6 MRR 100만원 ≈ Pro 100명 또는 Basic 250명 mix
- 앱스토어 수수료: small biz 1억 이하 둘 다 15%

## 부록 B — Track A vs Track B (v2) 핵심 차이

| | Track A (Consumable) | Track B v2 (Subscription) |
|---|---|---|
| 가격대 | ₩1,000~100,000 충전 | ₩3,900~29,900 월정액 |
| DB 테이블 | 4 (wallets/ledger/lots/products) | 4 (subs/events/usage/plans) |
| 마이그레이션 | 9 | 6 |
| 핵심 RPC | consume_diamonds_atomically | check_feature_access + check_and_increment_feature_usage |
| 차등 단위 | 공고 1건당 (1~10💎) | 노출 위치 + 부가 기능 (월 정액) |
| KPI 핵심 | ARPPU, 충전 funnel | MRR, churn, plan mix, feature adoption |
| 영세 사업자 fit | ★★★★★ (₩1k 진입) | ★★★★ (₩3.9k 첫 결제 부담 낮음) |

상세 비교 → `2026-04-26-monetization-comparison.md`.

## 부록 C — 참고 자료

- 알바몬 광고 상품: 스피드업 / 하이라이트 / 강조
- 알바천국 메인 노출 패키지
- 잡코리아 인재DB 정액제
- 사람인 면접제안 / 기업페이지
- 원티드 매칭 알고리즘
- `react-native-purchases` — context7 ID: `/revenuecat/react-native-purchases`

---

*Spec v2 종료 — 사용자 검토 대기.*
