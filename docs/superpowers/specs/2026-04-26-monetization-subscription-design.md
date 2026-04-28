# Monetization System (Track B) — Subscription Design Spec

- 작성일: 2026-04-26 (v3: **직업정보제공사업 범위로 재정렬**)
- Lock 일자: 2026-04-29
- 브랜치: `design/monetization-subscription`
- 상태: **Locked v3** (Open Questions §14의 auto-mode 가정 모두 채택)
- 자매 spec: `2026-04-26-monetization-design.md` (Track A — Consumable, Locked)
- 비교 문서: `2026-04-26-monetization-comparison.md`
- 후속: 사용자 승인 시 `writing-plans` 스킬로 implementation plan 생성 진행

---

## 0. Executive Summary

UNIQN 매출 엔진의 **두 번째 가설** — **직업정보제공사업 범위 내**의 저가 월정액 구독.
한국 직업안정법 §23 (직업정보제공사업, **신고제**)은 정보 매개만 허용하므로, **AI 매칭/인재 DB 검색/면접 제안 등 알선 행위는 차등 요소에서 모두 제외**. 차등은 **공고 노출 등급 + 광고 + 분석 + 브랜드 + 다중 매장 + CS**의 6개 영역에 국한.

핵심 의사결정 (v3):
1. **법적 범위**: 직업정보제공사업 (직업안정법 §23, 신고제) — 알선 행위 일체 금지. 직업소개사업(§19, 등록제) 진입 시 별도 spec 필요.
2. **RevenueCat Offerings** + 4-tier 저가 구독.
3. **공고 등록 무제한** — 모든 tier (Free 포함). 차등은 노출/광고/부가기능에서.
4. **차등 dimension 8개** — 강조 / 긴급(broadcast) / 고정 / 우선검색 / 브랜드페이지 / 다중매장 / 분석 / 전담CS.
5. **가격**: Basic ₩3,900 / Pro ₩9,900 / Enterprise ₩29,900 (v2 가격 유지).
6. **연간 16.7% 할인** + **14일 trial** (신용카드 등록 X, 만료 시 Free 회귀).

성공 지표 (M+1 ~ M+6):
- M+1: 유료 전환 사용자 ≥ 30명, MRR ≥ 25만원 (30 × 평균 ARPU 8,300원)
- M+3: Free→Paid 전환율 ≥ 8%, churn ≤ 10%/월
- M+6: MRR ≥ 80만원, 활성 구독자 ≥ 100명 (100 × 평균 ARPU 8,300원 ≈ 83만원)

**v3 핵심 변화 vs v2**: AI 매칭 / 인재 DB 검색 / 면접 제안 등 알선 행위 dimension 4개 제거. feature_usage 테이블 제거 (rate-limited 기능 없음). RPC 1개로 단순화.

---

## 1. 법적 범위 (Compliance — Critical)

### 1.1 직업정보제공사업 vs 직업소개사업

| | 직업정보제공사업 (§23) | 직업소개사업 (§19) |
|---|---|---|
| 등록 형태 | **신고제** (지방고용노동관서) | **등록제** (노동부 또는 시군구청) |
| 허용 범위 | 정보 게시 + 매개 | 알선 + 매칭 + 추천 |
| 수수료 | 광고/노출 수수료 | 알선 수수료 (상한 규제) |
| UNIQN 적용 | **본 spec 채택** | 향후 별도 spec |

### 1.2 알선 vs 정보 제공 판별 기준

| 행위 | 분류 | UNIQN 처리 |
|---|---|---|
| 공고 게시 | 정보 제공 | ✓ 모든 tier 무제한 |
| 공고 노출 등급 (강조/긴급/고정) | 정보 제공 (광고) | ✓ 차등 가능 |
| 검색 결과 우선 노출 | 정보 제공 (광고) | ✓ 차등 가능 |
| 자기 공고 지원자 정보 열람 | 정보 제공 (지원 접수 확인) | ✓ 모든 tier |
| 매장 브랜드 페이지 | 정보 제공 (광고) | ✓ 차등 가능 |
| 분석 대시보드 (자기 공고) | 정보 제공 (게시자 통계) | ✓ 차등 가능 |
| 긴급 공고 broadcast 푸시 | 정보 제공 (전체 알림) | ✓ 차등 가능 |
| **AI 매칭 푸시** (개인 추천) | **알선** | ✗ **제거** |
| **인재 DB 검색** (구직자 풀) | **알선** | ✗ **제거** |
| **면접/근무 제안** (직접 메시지) | **알선** | ✗ **제거** |
| **매칭 알고리즘 우선순위** | **알선** | ✗ **제거** |

### 1.3 직업정보제공사업 신고 의무사항

신고 시 그리고 운영 중 준수해야 할 사항 (직업안정법 시행령 §28 등):

1. **신고증 비치/표시** — 사업장 또는 웹사이트에 게시
2. **정보 진위 확인 노력** — 사업자등록번호 진위 확인 절차
3. **청소년 유해 직종 차단** — 18세 미만 청소년에게 유해 직종 게시 금지
4. **금지 직종 게시 금지** — 도박/성매매/마약/사행행위
5. **거짓 정보 게재 금지** — 신고 채널 운영
6. **개인정보 처리방침** — 구인자/구직자 분리 명시
7. **수수료 한정** — 광고/노출 수수료만 가능 (알선 수수료 X)
8. **사업자등록번호 표시** — 모든 페이지 (앱 푸터 등)

### 1.4 UI/UX 컴플라이언스 가드

- **추천**, **매칭**, **AI**, **자동 알선** 단어 사용 금지 (마케팅 카피 포함)
- "강조 표시", "노출 강화", "광고", "프리미엄 게시" 등 광고 용어 사용
- Push 알림 카피: "긴급 공고가 등록되었습니다" (broadcast) ✓ / "당신에게 맞는 공고" ✗

---

## 2. 한국 구인구직 플랫폼 모델 (참조, v2와 동일)

알선 영역(원티드 매칭, 사람인 인재DB)을 **제외한** 항목만 차용:

| 플랫폼 | 차용 요소 (정보 제공 영역만) |
|---|---|
| 알바몬 | **노출 등급제** (스피드업/하이라이트/카테고리 상단) |
| 알바천국 | **메인/카테고리 노출 패키지** |
| 잡코리아 | **공고 게시 패키지** (스타트/베이직/프리미엄) — 단, 인재DB 부분 제외 |
| ~~사람인~~ | 인재DB/면접제안은 알선이라 차용 불가 |
| ~~원티드~~ | 매칭/성공보수는 알선이라 차용 불가 |
| 인디드 | **무료 노출 + 광고 입찰** (Phase 3 검토) |

### 2.1 UNIQN 적용 차등 요소 (8개 dimension, v2의 10 → v3의 8)

| # | 차등 요소 | 출처 | UNIQN 적용 |
|---|---|---|---|
| 1 | **공고 강조 표시** | 알바몬 하이라이트 | Basic+ 별/색상 강조 |
| 2 | **긴급 공고 (broadcast 푸시)** | 알바몬 스피드업 | Pro+ 모든 사용자에게 푸시 |
| 3 | **고정 공고 (상단)** | 알바천국 카테고리 상단 | Pro+ 7일간 상단 고정 |
| 4 | **검색 결과 우선 노출** | 알바몬 황금공고 | Enterprise만 |
| 5 | **브랜드 페이지** | 사람인 기업페이지 (광고 영역) | Pro 미니, Enterprise 풀 |
| 6 | **다중 매장 관리** | UNIQN 특화 | 1 / 1 / 5 / 무제한 |
| 7 | **분석 대시보드** | 잡코리아 채용리포트 | Free 기본, Pro CSV, Enterprise 인사이트+API |
| 8 | **전담 매니저 (CS SLA)** | 잡코리아 컨설팅 | Enterprise만 |

**제거된 dimension** (v2 → v3): AI 매칭 푸시, 인재 DB 검색, 면접 제안 quota, 지원자 프로필 무제한 열람 (자기 공고 지원자만 → 모든 tier 가능).

---

## 3. 현재 상태 진단

| 영역 | 현재 상태 | 근거 |
|---|---|---|
| 결제 코드 | **0%** | Track A spec과 동일 — 그린필드 |
| 결제 DB 테이블 | wallet 4종 존재 (Track A 진행) | `git log` → 5개 wallet 커밋 |
| 결제 패키지 | 미설치 | `react-native-purchases` 없음 |
| 직업정보제공사업 신고 | **미신고** | 출시 전 신고 필요 — §15 |
| 사업자등록번호 노출 | 부분 (`uniqn-mobile/public/privacy.html`) | 앱 푸터 추가 필요 |

---

## 4. 아키텍처 개요

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
│   RPCs (3개로 단순화):                                            │
│   - sync_subscription_atomically (webhook)                        │
│   - check_feature_access(user, feature) → boolean                 │
│   - get_active_entitlement(user_id) → JSONB                       │
└─────────────────────────────────────────────────────────────────┘
```

**v2 → v3 단순화**: `feature_usage` 테이블 제거, `check_and_increment_feature_usage` RPC 제거. 알선 기능이 없으므로 rate-limited counter 불필요. 모든 차등이 boolean/integer 컬럼만으로 표현됨.

---

## 5. DB 스키마

### 5.1 `subscription_plans` — 8 dimension 차등 컬럼

```sql
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');
CREATE TYPE subscription_period AS ENUM ('monthly', 'annual');

CREATE TABLE public.subscription_plans (
  plan_id                       TEXT PRIMARY KEY,
  tier                          subscription_tier NOT NULL,
  period                        subscription_period NOT NULL,

  -- 공고 노출 (boolean flags)
  can_emphasize_post            BOOLEAN NOT NULL DEFAULT false,    -- 1. 강조
  can_urgent_post               BOOLEAN NOT NULL DEFAULT false,    -- 2. 긴급(broadcast 푸시)
  can_pinned_post               BOOLEAN NOT NULL DEFAULT false,    -- 3. 상단 고정
  has_priority_search_rank      BOOLEAN NOT NULL DEFAULT false,    -- 4. 검색 우선

  -- 광고/브랜드
  has_brand_page                TEXT NOT NULL DEFAULT 'none',      -- 5. 'none' | 'mini' | 'full'

  -- 매장
  max_stores                    INT NOT NULL DEFAULT 1,            -- 6. -1=무제한

  -- 분석
  has_advanced_analytics        BOOLEAN NOT NULL DEFAULT false,    -- 7. CSV/API
  has_insights_api              BOOLEAN NOT NULL DEFAULT false,    -- 7-2. Enterprise 전용 인사이트 API

  -- CS
  has_dedicated_support         BOOLEAN NOT NULL DEFAULT false,    -- 8. 전담 매니저

  -- 메타
  price_krw                     INT NOT NULL,
  display_order                 INT NOT NULL DEFAULT 0,
  active                        BOOLEAN NOT NULL DEFAULT true,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_max_stores CHECK (max_stores = -1 OR max_stores >= 1),
  CONSTRAINT chk_brand_page CHECK (has_brand_page IN ('none','mini','full'))
);
```

### 5.2 시드 데이터

| plan_id | tier | period | emp | urg | pin | psr | brand | stores | adv | api | sup | price |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `free` | free | monthly | F | F | F | F | none | 1 | F | F | F | 0 |
| `basic_monthly` | basic | monthly | T | F | F | F | none | 1 | F | F | F | 3,900 |
| `basic_annual` | basic | annual | T | F | F | F | none | 1 | F | F | F | 39,000 |
| `pro_monthly` | pro | monthly | T | T | T | F | mini | 5 | T | F | F | 9,900 |
| `pro_annual` | pro | annual | T | T | T | F | mini | 5 | T | F | F | 99,000 |
| `enterprise_monthly` | enterprise | monthly | T | T | T | T | full | -1 | T | T | T | 29,900 |
| `enterprise_annual` | enterprise | annual | T | T | T | T | full | -1 | T | T | T | 299,000 |

**약어**: emp=강조, urg=긴급(broadcast), pin=고정, psr=우선검색, brand=브랜드페이지, stores=매장수, adv=분석CSV, api=인사이트API, sup=전담CS.

**연간 할인**: monthly × 10 → 16.7% 절감.

### 5.3 `subscriptions` — 사용자 현재 구독

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

### 5.4 `subscription_events` — 변경 이력 (immutable)

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

### 5.5 RLS 정책

```sql
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans  ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_self_select ON subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY subscription_events_self_select ON subscription_events
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 모든 쓰기는 SECURITY DEFINER RPC만
CREATE POLICY subscriptions_no_direct_write ON subscriptions
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY subscription_events_no_direct_write ON subscription_events
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY plans_public_read ON subscription_plans
  FOR SELECT USING (active = true);

CREATE POLICY subscription_admin_all ON subscriptions
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

---

## 6. RPC 함수 (3개로 단순화)

### 6.1 `sync_subscription_atomically` — webhook entry point

(v2와 동일)

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

### 6.2 `check_feature_access` — boolean 권한 체크

```sql
CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_user_id UUID,
  p_feature TEXT
                 -- 'emphasize_post' | 'urgent_post' | 'pinned_post' | 'priority_search'
                 -- | 'brand_page_mini' | 'brand_page_full'
                 -- | 'advanced_analytics' | 'insights_api'
                 -- | 'dedicated_support' | 'multi_store'
) RETURNS JSONB    -- { allowed: bool, current_tier, required_tier? }
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_sub  subscriptions%ROWTYPE;
  v_allowed BOOLEAN;
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

  v_allowed := CASE p_feature
    WHEN 'emphasize_post'      THEN v_plan.can_emphasize_post
    WHEN 'urgent_post'         THEN v_plan.can_urgent_post
    WHEN 'pinned_post'         THEN v_plan.can_pinned_post
    WHEN 'priority_search'     THEN v_plan.has_priority_search_rank
    WHEN 'brand_page_mini'     THEN v_plan.has_brand_page IN ('mini','full')
    WHEN 'brand_page_full'     THEN v_plan.has_brand_page = 'full'
    WHEN 'advanced_analytics'  THEN v_plan.has_advanced_analytics
    WHEN 'insights_api'        THEN v_plan.has_insights_api
    WHEN 'dedicated_support'   THEN v_plan.has_dedicated_support
    WHEN 'multi_store'         THEN (v_plan.max_stores = -1 OR v_plan.max_stores > 1)
    ELSE false
  END;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_tier', v_plan.tier,
    'feature', p_feature
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_feature_access TO authenticated;
```

### 6.3 `get_active_entitlement` — UI 조회 (전체 권한 한 번에)

```sql
CREATE OR REPLACE FUNCTION public.get_active_entitlement(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_sub      subscriptions%ROWTYPE;
  v_plan     subscription_plans%ROWTYPE;
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

  RETURN jsonb_build_object(
    'tier', v_plan.tier,
    'plan_id', v_plan.plan_id,
    'period', v_plan.period,
    'status', COALESCE(v_sub.status, 'active'),
    'period_end', v_sub.period_end,
    'trial_end', v_sub.trial_end,
    'cancel_at', v_sub.cancel_at,
    'features', jsonb_build_object(
      'emphasize_post',     v_plan.can_emphasize_post,
      'urgent_post',        v_plan.can_urgent_post,
      'pinned_post',        v_plan.can_pinned_post,
      'priority_search',    v_plan.has_priority_search_rank,
      'brand_page',         v_plan.has_brand_page,
      'max_stores',         v_plan.max_stores,
      'advanced_analytics', v_plan.has_advanced_analytics,
      'insights_api',       v_plan.has_insights_api,
      'dedicated_support',  v_plan.has_dedicated_support
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_entitlement TO authenticated;
```

**v3 단순화**: feature_usage 관련 RPC 제거. archive cron도 불필요 (테이블 자체 없음).

---

## 7. RevenueCat 통합 (v2와 동일)

### 7.1 SDK 차이점

| 작업 | Track A | Track B v3 |
|---|---|---|
| 상품 조회 | `getProducts(NON_SUBSCRIPTION)` | `getOfferings()` |
| 구매 | `purchaseStoreProduct` | `purchasePackage` |
| 권한 확인 | DB 잔액 | `customerInfo.entitlements.active['pro']` |
| 복원 | optional | 필수 |

### 7.2 Webhook 이벤트 매핑

(v2와 동일 — INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / CANCELLATION / EXPIRATION / BILLING_ISSUE / REFUND / TRANSFER)

---

## 8. 클라이언트 구조

```
uniqn-mobile/src/
├── services/subscription/
│   ├── purchasesService.ts            # RC SDK wrapper
│   ├── subscriptionService.ts
│   └── __tests__/
├── repositories/supabase/
│   └── SubscriptionRepository.ts
├── hooks/
│   ├── useEntitlement.ts              # plan + features
│   ├── useFeatureAccess.ts            # 'urgent_post' 등 boolean
│   ├── usePurchaseSubscription.ts
│   ├── useChangePlan.ts
│   └── useCancelSubscription.ts
├── components/subscription/
│   ├── PlanCard.tsx                   # 4-tier 카드
│   ├── PlanComparisonTable.tsx        # 8 dimension 비교 그리드
│   ├── PaywallSheet.tsx               # 기능 락 시 표시
│   ├── ManageSubscriptionScreen.tsx
│   ├── BrandPageEditor.tsx            # Pro+ 매장 페이지
│   └── AnalyticsDashboard.tsx         # Pro CSV / Enterprise 인사이트
└── stores/
    └── subscriptionStore.ts
```

### 8.1 공고 작성 통합 (v3)

```typescript
async function createJobPosting(input: CreateJobPostingInput) {
  // 모든 사용자 무제한 등록 가능 (직업정보제공사업 범위 — 정보 매개)
  // 옵션 권한만 체크
  if (input.options?.emphasize) {
    const { data } = await supa.rpc('check_feature_access', {
      p_user_id: currentUser.id,
      p_feature: 'emphasize_post',
    });
    if (!data?.allowed) throw new FeatureLockedError('emphasize_post', 'basic');
  }
  if (input.options?.urgent) {
    const { data } = await supa.rpc('check_feature_access', {
      p_user_id: currentUser.id,
      p_feature: 'urgent_post',
    });
    if (!data?.allowed) throw new FeatureLockedError('urgent_post', 'pro');
  }
  if (input.options?.pinned) {
    const { data } = await supa.rpc('check_feature_access', {
      p_user_id: currentUser.id,
      p_feature: 'pinned_post',
    });
    if (!data?.allowed) throw new FeatureLockedError('pinned_post', 'pro');
  }

  return supa.from('job_postings').insert({...input}).select().single();
}
```

### 8.2 긴급 공고 broadcast 푸시 (직업정보제공사업 범위)

```typescript
// 긴급 공고 게시 시 모든 구독 알림 사용자에게 broadcast
// 개인 추천이 아닌 카테고리 broadcast이므로 알선 X
async function broadcastUrgentPost(postingId: string) {
  // 푸시 본문: "긴급 공고가 등록되었습니다 — [매장이름] [공고제목]"
  // ✗ 금지 카피: "당신에게 맞는 공고를 추천합니다"
  // ✓ 허용 카피: "긴급 공고 등록 알림"
  await sendPushNotification({
    topic: 'urgent_postings',  // 사용자가 opt-in한 topic
    title: '긴급 공고 등록',
    body: `[${store.name}] ${posting.title}`,
    deeplink: `uniqn://posting/${postingId}`,
  });
}
```

---

## 9. Feature Flag 롤아웃

```sql
INSERT INTO app_config(key, value) VALUES
  ('subscription.enabled', '{"enabled": false}'::jsonb),
  ('subscription.enforced_features', '{"urgent_post": false, "pinned_post": false, "priority_search": false}'::jsonb),
  ('subscription.rollout_percentage', '{"value": 0}'::jsonb);
```

| Phase | 기간 | 전략 |
|---|---|---|
| Beta | M+0~1 | 모든 기능 Free 노출, 데이터 수집 |
| Soft enforce | M+2 | 노출 옵션 paywall (Basic 강조 / Pro 긴급+고정) |
| Paywall on | M+3 | rollout 10% |
| Confidence ramp | M+4 | rollout 50% |
| Full | M+6 | 전체 차등 100% 적용 |

---

## 10. 보안 위협 모델 (STRIDE)

| 위협 | 시나리오 | 완화 |
|---|---|---|
| Spoofing | 가짜 webhook | RC_WEBHOOK_SECRET |
| Tampering (client) | entitlement 위조 | 서버 RPC + RLS |
| Tampering (jailbreak) | SDK 조작 | RC 영수증 + DB source of truth |
| Repudiation | "결제 안 됐다" | subscription_events immutable |
| Info Disclosure | 다른 사용자 plan | RLS auth.uid() = user_id |
| DoS | check_feature 무한 호출 | RC + Edge Function rate limit |
| Elevation | 일반 user sync RPC | service_role only |
| Idempotency | 같은 event 2회 | revenuecat_event_id UNIQUE |
| Trial abuse | 같은 카드 trial 반복 | RC subscriptionGroup 자동 차단 |
| **컴플라이언스 위반** | **알선 행위가 코드에 들어감** | **§15 PR 체크리스트로 차단** |

---

## 11. 컴플라이언스 위협 모델 (직업안정법 위반 방지)

| 위협 | 시나리오 | 완화 |
|---|---|---|
| 알선 기능 추가 | 누군가 PR로 매칭/추천 추가 | PR 체크리스트 + ESLint 룰 (§15) |
| 마케팅 카피 위반 | "AI 매칭" 등 알선 단어 사용 | 카피 가이드 + 리뷰 |
| 청소년 유해 직종 | 18세 미만 노출 | 가입 시 연령 확인 + 직종 필터링 |
| 금지 직종 게시 | 도박/성매매 등 게시 | 신고 채널 + 자동 키워드 차단 |
| 거짓 정보 | 사업자번호 도용 | 가입 시 사업자등록번호 진위 확인 (국세청 API) |
| 신고 의무 위반 | 사업장 변경 미신고 | 운영 변경 시 신고 갱신 절차 (§15) |
| 사업자번호 미표시 | 앱 푸터/웹 누락 | 의무 표시 (§15) |
| 알선 수수료 수취 | 매칭 성공 시 수수료 | **비즈니스 로직 검토** (수수료는 광고/노출만) |

---

## 12. 테스트 전략 (TDD)

- `sync_subscription_atomically` 멱등성
- `check_feature_access` 4 tier × 10 feature 매트릭스
- 무제한 max_stores (-1) 처리
- cancelled status에서 period_end까지 통과
- RC webhook 시나리오 (INITIAL/RENEWAL/CANCEL/EXPIRE/REFUND)
- E2E: Free → Pro 구매 → 긴급 공고 게시 → 노출 확인
- **컴플라이언스 테스트** (§15): 알선 단어 grep, 푸시 카피 화이트리스트 검증

---

## 13. 모니터링 / KPI

- **MRR**: SUM(price_krw) WHERE status IN ('active','in_grace') GROUP BY month
- **Plan mix**: Free/Basic/Pro/Enterprise 비율
- **Trial conversion**: trial_converted / trial_started
- **Upsell signal**: paywall hit 분포 → 어떤 기능이 결제 트리거인가
- **컴플라이언스 KPI** (§15): 신고 직종 위반 건수, 거짓 정보 신고 건수

---

## 14. Locked Decisions (2026-04-29)

| # | 결정 | 채택 |
|---|---|---|
| Q1 | Free row 명시 | row 없음 (가입 시 INSERT 부담 회피) |
| Q2 | Trial 만료 시 | Free 회귀 (자동 결제 X) |
| Q3 | 환불 정책 | RC 표준 (스토어 정책 위임) |
| Q4 | Plan 변경 proration | RC 자동 |
| Q5 | Downgrade 시점 | 다음 period |
| Q6 | Annual cancel | period_end까지 사용 |
| Q7 | Enterprise 영업 | 일반 IAP + B2B 인보이스 병행 |
| Q8 | 첫 결제 보너스 | annual 결제 시 14일 추가 trial |
| Q9 | 직업소개사업(§19) 등록 시점 | **현재는 안 함** — Year 2+ MAU 5,000 도달 시 별도 spec |
| Q10 | 단발 광고 ₩1,000 추가 노출 강조 | Phase 3 검토 (Track A consumable과 연결) |

---

## 15. 컴플라이언스 — 직업정보제공사업 신고 체크리스트

### 15.1 출시 전 신고 준비

- [ ] **사업자등록증 보유** (개인사업자 또는 법인)
- [ ] **사업장 위치 결정** (서울/경기 관할 지방고용노동관서)
- [ ] **신고서 작성** (직업안정법 시행규칙 별지 양식)
- [ ] **수수료 납부** (신고 수수료)
- [ ] **신고증 수령** 후 앱/웹에 게시
- [ ] **개인정보처리방침 업데이트** — 구인자/구직자 분리 명시
- [ ] **이용약관 업데이트** — 알선 행위 제외 명시, 분쟁 책임 한계

### 15.2 운영 의무사항

- [ ] **신고증 표시** — 앱 설정 > 회사정보 페이지 + 웹 푸터
- [ ] **사업자등록번호 표시** — 모든 페이지 푸터
- [ ] **사업자등록번호 진위 확인** — 가입 시 국세청 API 또는 수동 확인
- [ ] **청소년 유해 직종 차단** — 18세 미만 가입자에게 비표시
- [ ] **금지 직종 키워드 차단** — 자동 키워드 + 수동 모더레이션
- [ ] **거짓 정보 신고 채널** — `app/(app)/support/report-job.tsx` 등 운영
- [ ] **개인정보 처리방침** — `src/constants/legal/privacy.ts` 업데이트

### 15.3 PR 체크리스트 (개발 가드)

신규 PR 머지 전 체크:

- [ ] **알선 기능 추가 안 함** — 매칭/추천/제안/검색 기반 알선 X
- [ ] **마케팅 카피 검토** — "AI 매칭", "추천", "당신을 위한" 단어 미사용
- [ ] **푸시 알림 카피** — broadcast 형태만, 개인 맞춤 X
- [ ] **이력서 검색 미구현** — 구인자가 미지원자 정보를 검색하는 UI 없음
- [ ] **직접 메시지 미구현** — 구인자→구직자 직접 메시지 (지원 후 외) 없음

### 15.4 ESLint 룰 (자동 가드)

```js
// .eslintrc.js — 알선 단어 사용 금지
{
  "rules": {
    "no-restricted-syntax": ["error", {
      "selector": "Literal[value=/AI 매칭|매칭 추천|당신에게 맞는|맞춤 추천/]",
      "message": "직업정보제공사업 범위 외 알선 카피입니다. /docs/superpowers/specs/2026-04-26-monetization-subscription-design.md §15 참조"
    }]
  }
}
```

### 15.5 향후 직업소개사업(§19) 진입 시 (Phase 3+)

직업소개사업 등록 시 고려사항:
- 등록 형태 결정: 유료직업소개 vs 무료직업소개
- 시설 요건: 사업장 면적 / 종사자 자격증 (직업상담사)
- 수수료 상한 규제: 고용노동부 고시 (구인자 부담 / 구직자 부담 비율)
- 별도 spec 작성 + 본 v3 spec과 통합 또는 분리

---

## 16. 마이그레이션 순서 (v3 — 5개로 단축)

1. `20260427100000_create_subscription_tables.sql` — 3개 테이블 + 3개 ENUM (v2 5개 → v3 3개)
2. `20260427100100_create_subscription_rls.sql`
3. `20260427100200_create_subscription_rpcs.sql` — 3개 RPC (v2 4개 → v3 3개)
4. `20260427100300_seed_subscription_plans.sql` — 7개 plan
5. `20260427100400_create_subscription_app_config.sql`

총 5개 마이그레이션. v2 (6개)에서 archive cron 마이그레이션 제거.

---

## 17. 외부 작업

### 17.1 RevenueCat / 스토어

1. RC 계정 + 앱 등록
2. App Store Auto-Renewable Subscription — 6 product (3 group × 2 period)
3. Google Play Subscription — 6 product
4. RC Entitlements: `basic`, `pro`, `enterprise`
5. RC Offering + 6 package
6. Webhook URL: `https://<project>.supabase.co/functions/v1/revenuecat-subscription-webhook`

### 17.2 컴플라이언스 (v3 신규)

1. **직업정보제공사업 신고** (§15.1) — 사업장 결정 후 즉시
2. **사업자등록번호 진위 확인 API** 연동 (국세청 사업자등록 상태 조회 OpenAPI)
3. **청소년 유해 직종 키워드 사전** 작성
4. **금지 직종 차단 키워드 사전** 작성
5. **신고 채널 페이지** — 거짓 정보 신고

### 17.3 약관/법무

1. 자동 갱신 약관 + 14일 trial 명시 (전자상거래법)
2. 직업정보제공사업 약관 추가 (`src/constants/legal/`) — 알선 행위 제외, 분쟁 책임
3. 개인정보처리방침 업데이트 — 구인자/구직자 분리, 사업자번호 처리

---

## 18. 다음 단계

1. **사용자 검토** — Q1~Q10 + v3 가정 lock + §15 컴플라이언스 체크리스트 승인
2. **`writing-plans` 스킬 호출** — 5개 마이그레이션을 implementation plan으로
3. **법무 자문** — §15 운영 의무사항 검토 (특히 사업자번호 진위 확인 의무 범위)

---

## 부록 A — 비즈니스 가정 (v3)

- 가격: Basic ₩3,900 / Pro ₩9,900 / Enterprise ₩29,900 (v2 유지)
- 차등 dimension: 8개 (v2 10개에서 알선 4개 제거 — AI 매칭 / 인재DB / 면접제안 / 지원자무제한열람)
- 공고 등록: 모든 tier 무제한
- 직업정보제공사업 범위 (§23 신고제) — 직업소개사업(§19 등록제) 진입 안 함
- BEP: M+6 MRR 80만원 ≈ Pro 80명 또는 Basic 200명 mix

## 부록 B — Track A vs Track B (v3) 핵심 차이

| | Track A (Consumable) | Track B v3 (Subscription) |
|---|---|---|
| 가격대 | ₩1,000~100,000 충전 | ₩3,900~29,900 월정액 |
| DB 테이블 | 4 (wallets/ledger/lots/products) | 3 (plans/subs/events) |
| 마이그레이션 | 9 | 5 (v3에서 1개 더 줄음) |
| 핵심 RPC | consume_diamonds_atomically | check_feature_access |
| 차등 단위 | 공고 1건당 (1~10💎) | 노출/광고/매장/CS (월 정액) |
| 직업정보제공사업 부합 | ✓ (정보 매개 + 광고) | ✓ (정보 매개 + 광고) |
| 알선 위험 | 낮음 (단발 광고 성격) | 낮음 (boolean flag로만 차등) |

상세 비교 → `2026-04-26-monetization-comparison.md`.

## 부록 C — v2 → v3 변경 요약

| 영역 | v2 | v3 |
|---|---|---|
| 차등 dimension 수 | 10 | **8** |
| 제거된 dimension | — | AI 매칭, 인재DB, 면접제안, 지원자 무제한 열람 |
| DB 테이블 | 4 (plans/subs/events/feature_usage) | **3 (feature_usage 제거)** |
| RPC | 4 | **3 (check_and_increment 제거)** |
| 마이그레이션 | 6 | **5** |
| 컴플라이언스 §추가 | 없음 | **§15 직업정보제공사업** |
| 가격 | 동일 | 동일 |
| 매출 ceiling | 79k MRR (1k명) | ~66k MRR (1k명, plan mix Basic-heavy) |

## 부록 D — 참고 자료

- 직업안정법 §19 (직업소개사업), §23 (직업정보제공사업)
- 직업안정법 시행령 §28 (정보 매개의 범위)
- 직업안정법 시행규칙 별지 양식 (신고서)
- 알바몬 / 알바천국 / 잡코리아 광고 상품 (정보 제공 영역만)
- 국세청 사업자등록 상태 조회 OpenAPI
- `react-native-purchases` — context7 ID: `/revenuecat/react-native-purchases`

---

*Spec v3 종료 — 사용자 검토 대기.*
