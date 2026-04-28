# Subscription Implementation Plan — Phase 1: DB Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UNIQN Subscription 시스템(Track B v3, 직업정보제공사업 범위)의 Postgres 기반(테이블 3개 + RLS + RPC 3개 + plan/app_config 시드)을 구축한다. Phase 1 종료 시점에 SQL/psql로 sync/check_feature_access/get_active_entitlement 시뮬레이션이 모두 작동해야 한다.

**Architecture:** `subscription_plans`(카탈로그) + `subscriptions`(entitlement 캐시, user당 1행) + `subscription_events`(immutable 이력). 3개 RPC는 `SECURITY DEFINER`. webhook용 sync는 `service_role`만, 권한 조회는 `authenticated`. 멱등성은 `subscription_events.revenuecat_event_id UNIQUE`로 강제. `feature_usage` 테이블/cron 모두 v3에서 제거됨 (알선 기능 부재).

**Tech Stack:** Supabase Postgres 15, plpgsql, MCP `apply_migration` (전용 — supabase db push 금지), Jest (RPC integration tests via supabase-js), Zod (TypeScript schema).

**Spec:** `docs/superpowers/specs/2026-04-26-monetization-subscription-design.md` (Locked v3, 2026-04-29)

**Out of Scope (별도 후속 plan):**
- Phase 2: RevenueCat Webhook Edge Function
- Phase 3: Client SDK (`react-native-purchases`) + Subscription UI (PlanCard / PaywallSheet / ManageScreen)
- Phase 4: jobManagement 통합 (createJobPosting의 강조/긴급/고정 paywall)
- Phase 5: Feature Flag rollout 전환 (Beta → Soft enforce → Full)
- Phase 6: 컴플라이언스 (사업자번호 진위 확인 API, ESLint 알선 단어 가드, 청소년/금지 직종 필터)
- Phase 7: 모니터링 / KPI 대시보드

---

## File Structure (Phase 1)

| 파일 | 책임 |
|---|---|
| `uniqn-mobile/supabase/migrations/20260429000000_create_subscription_enums_and_tables.sql` | ENUM 3개 + 테이블 3개 + 인덱스 |
| `uniqn-mobile/supabase/migrations/20260429000100_create_subscription_rls.sql` | RLS 정책 (본인 SELECT + admin 전체 + plans public read) |
| `uniqn-mobile/supabase/migrations/20260429000200_create_sync_subscription_rpc.sql` | `sync_subscription_atomically` (webhook entry, service_role only) |
| `uniqn-mobile/supabase/migrations/20260429000300_create_check_feature_access_rpc.sql` | `check_feature_access(user, feature) → JSONB` (authenticated) |
| `uniqn-mobile/supabase/migrations/20260429000400_create_get_active_entitlement_rpc.sql` | `get_active_entitlement(user_id) → JSONB` (authenticated) |
| `uniqn-mobile/supabase/migrations/20260429000500_seed_subscription_plans.sql` | 7개 plan 시드 (free/basic_monthly/basic_annual/pro_*/enterprise_*) |
| `uniqn-mobile/supabase/migrations/20260429000600_seed_subscription_app_config.sql` | Feature flag JSONB 3개 시드 |
| `uniqn-mobile/src/types/subscription.ts` | TypeScript types + Zod schemas (Plan/Subscription/Entitlement) |
| `uniqn-mobile/src/repositories/supabase/SubscriptionRepository.ts` | Phase 1은 read-only 메서드만 (getActiveEntitlement, listPlans) |
| `uniqn-mobile/src/__tests__/subscription/subscriptionRpcs.integration.test.ts` | RPC 통합 테스트 (Supabase test instance) |

---

## Pre-Flight (Phase 1 시작 전 1회)

- [ ] **Step 0.1: 브랜치 확인**
  ```bash
  cd /c/Users/user/Desktop/T-HOLDEM
  git branch --show-current
  ```
  Expected: `design/monetization-subscription`

- [ ] **Step 0.2: spec 읽기**
  ```bash
  ls -la docs/superpowers/specs/2026-04-26-monetization-subscription-design.md
  ```
  Expected: 파일 존재. §5 (DB 스키마) + §6 (RPC) 다시 읽기.

- [ ] **Step 0.3: Supabase MCP 연결 확인 — 그린필드 검증**
  Tool call: `mcp__supabase__list_tables({ schemas: ["public"], verbose: false })`
  Expected: subscriptions / subscription_events / subscription_plans **없음**.
  (Track A의 wallets/wallet_ledger 등은 별도 브랜치 — 본 브랜치에선 무시.)

- [ ] **Step 0.4: 마이그레이션 디렉토리 위치 확인**
  ```bash
  ls -la uniqn-mobile/supabase/migrations/ | tail -5
  ```
  Expected: 가장 최근 파일 `20260427000301_fix_consume_diamonds_drift_guard.sql`. 본 plan은 `20260429______` 으로 시작.

---

## Task 1: ENUM 3개 + 테이블 3개 마이그레이션

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260429000000_create_subscription_enums_and_tables.sql`

- [ ] **Step 1.1: 마이그레이션 파일 작성**

```sql
-- Subscription 시스템 기반: ENUM 3개 + 테이블 3개 + 인덱스
-- Spec: docs/superpowers/specs/2026-04-26-monetization-subscription-design.md §5
-- 법적 범위: 직업안정법 §23 직업정보제공사업 (신고제) — 알선 기능 없음

CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');

CREATE TYPE subscription_period AS ENUM ('monthly', 'annual');

CREATE TYPE subscription_status AS ENUM (
  'active',
  'in_trial',
  'in_grace_period',
  'cancelled',
  'expired',
  'billing_issue'
);

CREATE TYPE subscription_event_type AS ENUM (
  'created',
  'renewed',
  'plan_changed',
  'cancelled',
  'reactivated',
  'expired',
  'refunded',
  'billing_issue',
  'grace_started',
  'grace_resolved',
  'trial_started',
  'trial_converted',
  'trial_expired_to_free'
);

-- 1) subscription_plans — 8 dimension 차등 카탈로그
CREATE TABLE public.subscription_plans (
  plan_id                       TEXT PRIMARY KEY,
  tier                          subscription_tier NOT NULL,
  period                        subscription_period NOT NULL,

  can_emphasize_post            BOOLEAN NOT NULL DEFAULT false,
  can_urgent_post               BOOLEAN NOT NULL DEFAULT false,
  can_pinned_post               BOOLEAN NOT NULL DEFAULT false,
  has_priority_search_rank      BOOLEAN NOT NULL DEFAULT false,

  has_brand_page                TEXT NOT NULL DEFAULT 'none',
  max_stores                    INT NOT NULL DEFAULT 1,
  has_advanced_analytics        BOOLEAN NOT NULL DEFAULT false,
  has_insights_api              BOOLEAN NOT NULL DEFAULT false,
  has_dedicated_support         BOOLEAN NOT NULL DEFAULT false,

  price_krw                     INT NOT NULL,
  display_order                 INT NOT NULL DEFAULT 0,
  active                        BOOLEAN NOT NULL DEFAULT true,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_max_stores CHECK (max_stores = -1 OR max_stores >= 1),
  CONSTRAINT chk_brand_page CHECK (has_brand_page IN ('none', 'mini', 'full'))
);

-- 2) subscriptions — 사용자당 1행 (entitlement 캐시)
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

CREATE INDEX idx_subscriptions_status
  ON public.subscriptions(status)
  WHERE status IN ('active', 'in_trial', 'in_grace_period');

CREATE INDEX idx_subscriptions_period_end
  ON public.subscriptions(period_end);

-- 3) subscription_events — immutable 변경 이력
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

CREATE INDEX idx_subscription_events_user
  ON public.subscription_events(user_id, occurred_at DESC);

COMMENT ON TABLE public.subscription_plans IS '구독 plan 카탈로그 — 8 dimension 차등 (강조/긴급/고정/우선검색/브랜드/매장/분석/CS)';
COMMENT ON TABLE public.subscriptions IS '사용자 현재 구독 상태 (entitlement 캐시) — user당 1행';
COMMENT ON TABLE public.subscription_events IS 'immutable 구독 변경 이력 — RC webhook event_id로 멱등성 보장';
```

- [ ] **Step 1.2: 마이그레이션 적용 (MCP)**

Tool call:
```
mcp__supabase__apply_migration({
  name: "20260429000000_create_subscription_enums_and_tables",
  query: "<위 SQL 전체>"
})
```
Expected: success, no errors.

- [ ] **Step 1.3: 테이블 생성 확인**

Tool call:
```
mcp__supabase__list_tables({
  schemas: ["public"],
  verbose: false
})
```
Expected: 결과에 `subscription_plans`, `subscriptions`, `subscription_events` 3개 모두 포함.

- [ ] **Step 1.4: ENUM 확인**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT typname FROM pg_type WHERE typname LIKE 'subscription_%' ORDER BY typname"
})
```
Expected: `subscription_event_type`, `subscription_period`, `subscription_status`, `subscription_tier` 4개.

- [ ] **Step 1.5: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/supabase/migrations/20260429000000_create_subscription_enums_and_tables.sql
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): ENUM 4개 + 테이블 3개 (Track B v3 Phase 1.1)"
```

---

## Task 2: RLS 정책 마이그레이션

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260429000100_create_subscription_rls.sql`

- [ ] **Step 2.1: 마이그레이션 파일 작성**

```sql
-- Subscription RLS 정책
-- Spec: docs/superpowers/specs/2026-04-26-monetization-subscription-design.md §5.5

ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans  ENABLE ROW LEVEL SECURITY;

-- 본인 구독만 SELECT
CREATE POLICY subscription_self_select ON public.subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 본인 이력만 SELECT
CREATE POLICY subscription_events_self_select ON public.subscription_events
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- 직접 INSERT/UPDATE/DELETE 차단 (모든 쓰기는 SECURITY DEFINER RPC만)
CREATE POLICY subscriptions_no_direct_write ON public.subscriptions
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY subscription_events_no_direct_write ON public.subscription_events
  FOR ALL USING (false) WITH CHECK (false);

-- 활성 plan은 모두 조회 가능 (paywall UI용)
CREATE POLICY plans_public_read ON public.subscription_plans
  FOR SELECT USING (active = true);

-- admin은 전체 접근 (app_metadata.role = 'admin')
CREATE POLICY subscription_admin_all ON public.subscriptions
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY subscription_events_admin_all ON public.subscription_events
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY plans_admin_all ON public.subscription_plans
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

- [ ] **Step 2.2: 마이그레이션 적용**

Tool call: `mcp__supabase__apply_migration({ name: "20260429000100_create_subscription_rls", query: "<위 SQL>" })`
Expected: success.

- [ ] **Step 2.3: RLS 활성화 확인**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('subscriptions','subscription_events','subscription_plans') ORDER BY relname"
})
```
Expected: 3행 모두 `relrowsecurity = true`.

- [ ] **Step 2.4: 정책 개수 확인**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT tablename, COUNT(*) AS policies FROM pg_policies WHERE tablename IN ('subscriptions','subscription_events','subscription_plans') GROUP BY tablename ORDER BY tablename"
})
```
Expected: subscriptions=3, subscription_events=3, subscription_plans=2.

- [ ] **Step 2.5: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/supabase/migrations/20260429000100_create_subscription_rls.sql
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): RLS 정책 8개 (본인 SELECT + admin 전체 + plans public)"
```

---

## Task 3: `sync_subscription_atomically` RPC + 멱등성 테스트

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260429000200_create_sync_subscription_rpc.sql`

- [ ] **Step 3.1: 마이그레이션 파일 작성**

```sql
-- Webhook entry RPC: subscriptions UPSERT + subscription_events INSERT (단일 트랜잭션)
-- 멱등성: revenuecat_event_id UNIQUE 제약으로 retry 안전
-- service_role만 실행 (REVOKE FROM authenticated)
-- Spec §6.1

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
  v_existing_event UUID;
  v_prev_plan_id   TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_ID: cannot be NULL';
  END IF;

  -- 1) 멱등성 체크
  SELECT id INTO v_existing_event
    FROM public.subscription_events
   WHERE revenuecat_event_id = p_rc_event_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2) 이전 plan 보관 (event 기록용)
  SELECT plan_id INTO v_prev_plan_id
    FROM public.subscriptions
   WHERE user_id = p_user_id;

  -- 3) subscriptions UPSERT
  INSERT INTO public.subscriptions(
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

  -- 4) event 기록 (immutable)
  INSERT INTO public.subscription_events(
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

REVOKE EXECUTE ON FUNCTION public.sync_subscription_atomically FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_atomically TO service_role;

COMMENT ON FUNCTION public.sync_subscription_atomically IS 'RC webhook entry — subscriptions UPSERT + events INSERT (멱등성: rc_event_id UNIQUE)';
```

- [ ] **Step 3.2: 마이그레이션 적용**

Tool call: `mcp__supabase__apply_migration({ name: "20260429000200_create_sync_subscription_rpc", query: "<위 SQL>" })`
Expected: success.

- [ ] **Step 3.3: 함수 등록 확인**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT proname, prosecdef FROM pg_proc WHERE proname = 'sync_subscription_atomically'"
})
```
Expected: 1행, `prosecdef = true` (SECURITY DEFINER).

- [ ] **Step 3.4: 권한 확인 — authenticated에서 실행 차단**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT has_function_privilege('authenticated', 'public.sync_subscription_atomically(uuid,text,subscription_status,timestamptz,timestamptz,timestamptz,timestamptz,text,text,subscription_event_type,jsonb)', 'EXECUTE') AS authenticated_can_execute, has_function_privilege('service_role', 'public.sync_subscription_atomically(uuid,text,subscription_status,timestamptz,timestamptz,timestamptz,timestamptz,text,text,subscription_event_type,jsonb)', 'EXECUTE') AS service_role_can_execute"
})
```
Expected: authenticated=false, service_role=true.

- [ ] **Step 3.5: 시뮬레이션 — 첫 INSERT (테스트용 plan/user 필요. Task 6 시드 적용 후 재실행)**

본 step은 Task 6 (plans 시드) 적용 후 다시 실행. 일단 SQL만 메모:

```sql
-- (이 시뮬레이션은 Task 6 완료 후 실행)
-- WITH test_user AS (SELECT id FROM public.users LIMIT 1)
-- SELECT public.sync_subscription_atomically(
--   (SELECT id FROM test_user),
--   'pro_monthly',
--   'active'::subscription_status,
--   now(), now() + interval '30 days', NULL, NULL,
--   'rc_customer_test', 'rc_event_phase1_smoke',
--   'created'::subscription_event_type,
--   '{}'::jsonb
-- );
```

- [ ] **Step 3.6: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/supabase/migrations/20260429000200_create_sync_subscription_rpc.sql
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): sync_subscription_atomically RPC (webhook entry, 멱등성)"
```

---

## Task 4: `check_feature_access` RPC

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260429000300_create_check_feature_access_rpc.sql`

- [ ] **Step 4.1: 마이그레이션 파일 작성**

```sql
-- 권한 boolean 체크 RPC (UI/RLS 가드용)
-- Free 사용자(row 없음) 또는 expired/billing_issue → free plan으로 fallback
-- cancelled 상태도 period_end > now() 동안은 plan 권한 유지
-- Spec §6.2

CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_user_id UUID,
  p_feature TEXT
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_plan    public.subscription_plans%ROWTYPE;
  v_sub     public.subscriptions%ROWTYPE;
  v_allowed BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_ID: cannot be NULL';
  END IF;

  SELECT * INTO v_sub
    FROM public.subscriptions
   WHERE user_id = p_user_id;

  IF NOT FOUND
     OR v_sub.status NOT IN ('active','in_trial','in_grace_period','cancelled')
     OR (v_sub.status = 'cancelled' AND v_sub.period_end <= now())
  THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE plan_id = 'free';
  ELSE
    SELECT * INTO v_plan FROM public.subscription_plans WHERE plan_id = v_sub.plan_id;
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

GRANT EXECUTE ON FUNCTION public.check_feature_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_feature_access TO service_role;

COMMENT ON FUNCTION public.check_feature_access IS '권한 boolean 체크 — UI/RLS 가드. Free fallback + cancelled-but-period_end 처리.';
```

- [ ] **Step 4.2: 마이그레이션 적용**

Tool call: `mcp__supabase__apply_migration({ name: "20260429000300_create_check_feature_access_rpc", query: "<위 SQL>" })`
Expected: success.

- [ ] **Step 4.3: 함수 등록 확인**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT proname, provolatile FROM pg_proc WHERE proname = 'check_feature_access'"
})
```
Expected: 1행, `provolatile = 's'` (STABLE).

- [ ] **Step 4.4: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/supabase/migrations/20260429000300_create_check_feature_access_rpc.sql
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): check_feature_access RPC (10개 feature × 4 tier matrix)"
```

---

## Task 5: `get_active_entitlement` RPC

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260429000400_create_get_active_entitlement_rpc.sql`

- [ ] **Step 5.1: 마이그레이션 파일 작성**

```sql
-- UI 조회 RPC: 현재 plan + features + 메타데이터를 단일 JSONB로 반환
-- check_feature_access와 동일한 fallback 로직
-- Spec §6.3

CREATE OR REPLACE FUNCTION public.get_active_entitlement(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_sub  public.subscriptions%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_ID: cannot be NULL';
  END IF;

  SELECT * INTO v_sub
    FROM public.subscriptions
   WHERE user_id = p_user_id;

  IF NOT FOUND
     OR v_sub.status NOT IN ('active','in_trial','in_grace_period','cancelled')
     OR (v_sub.status = 'cancelled' AND v_sub.period_end <= now())
  THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE plan_id = 'free';
  ELSE
    SELECT * INTO v_plan FROM public.subscription_plans WHERE plan_id = v_sub.plan_id;
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

GRANT EXECUTE ON FUNCTION public.get_active_entitlement TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_entitlement TO service_role;

COMMENT ON FUNCTION public.get_active_entitlement IS 'UI 조회 — 현재 plan + features + 메타를 단일 JSONB로';
```

- [ ] **Step 5.2: 마이그레이션 적용**

Tool call: `mcp__supabase__apply_migration({ name: "20260429000400_create_get_active_entitlement_rpc", query: "<위 SQL>" })`
Expected: success.

- [ ] **Step 5.3: 함수 등록 확인**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT proname FROM pg_proc WHERE proname = 'get_active_entitlement'"
})
```
Expected: 1행.

- [ ] **Step 5.4: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/supabase/migrations/20260429000400_create_get_active_entitlement_rpc.sql
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): get_active_entitlement RPC (UI용 단일 JSONB 조회)"
```

---

## Task 6: 7개 plan 시드

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260429000500_seed_subscription_plans.sql`

- [ ] **Step 6.1: 마이그레이션 파일 작성**

```sql
-- Subscription plan 시드 (7개: free + basic_monthly/annual + pro_monthly/annual + enterprise_monthly/annual)
-- Spec §5.2 시드 표
-- 가격: Basic ₩3,900 / Pro ₩9,900 / Enterprise ₩29,900 (annual = monthly × 10)

INSERT INTO public.subscription_plans (
  plan_id, tier, period,
  can_emphasize_post, can_urgent_post, can_pinned_post, has_priority_search_rank,
  has_brand_page, max_stores,
  has_advanced_analytics, has_insights_api, has_dedicated_support,
  price_krw, display_order, active
) VALUES
  ('free',                'free',       'monthly',
   false, false, false, false,
   'none', 1,
   false, false, false,
   0,      0, true),

  ('basic_monthly',       'basic',      'monthly',
   true,  false, false, false,
   'none', 1,
   false, false, false,
   3900,   10, true),

  ('basic_annual',        'basic',      'annual',
   true,  false, false, false,
   'none', 1,
   false, false, false,
   39000,  11, true),

  ('pro_monthly',         'pro',        'monthly',
   true,  true,  true,  false,
   'mini', 5,
   true,  false, false,
   9900,   20, true),

  ('pro_annual',          'pro',        'annual',
   true,  true,  true,  false,
   'mini', 5,
   true,  false, false,
   99000,  21, true),

  ('enterprise_monthly',  'enterprise', 'monthly',
   true,  true,  true,  true,
   'full', -1,
   true,  true,  true,
   29900,  30, true),

  ('enterprise_annual',   'enterprise', 'annual',
   true,  true,  true,  true,
   'full', -1,
   true,  true,  true,
   299000, 31, true)
ON CONFLICT (plan_id) DO UPDATE SET
  tier                       = EXCLUDED.tier,
  period                     = EXCLUDED.period,
  can_emphasize_post         = EXCLUDED.can_emphasize_post,
  can_urgent_post            = EXCLUDED.can_urgent_post,
  can_pinned_post            = EXCLUDED.can_pinned_post,
  has_priority_search_rank   = EXCLUDED.has_priority_search_rank,
  has_brand_page             = EXCLUDED.has_brand_page,
  max_stores                 = EXCLUDED.max_stores,
  has_advanced_analytics     = EXCLUDED.has_advanced_analytics,
  has_insights_api           = EXCLUDED.has_insights_api,
  has_dedicated_support      = EXCLUDED.has_dedicated_support,
  price_krw                  = EXCLUDED.price_krw,
  display_order              = EXCLUDED.display_order,
  active                     = EXCLUDED.active;
```

- [ ] **Step 6.2: 마이그레이션 적용**

Tool call: `mcp__supabase__apply_migration({ name: "20260429000500_seed_subscription_plans", query: "<위 SQL>" })`
Expected: success.

- [ ] **Step 6.3: 시드 확인**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT plan_id, tier, period, price_krw, max_stores FROM public.subscription_plans ORDER BY display_order"
})
```
Expected: 7행. `free=0`, `basic_monthly=3900`, `pro_monthly=9900`, `enterprise_annual=299000` 등 가격 일치.

- [ ] **Step 6.4: 4-tier × 2-period matrix 검증**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT tier, COUNT(*) AS plan_count FROM public.subscription_plans GROUP BY tier ORDER BY tier"
})
```
Expected: free=1, basic=2, pro=2, enterprise=2.

- [ ] **Step 6.5: Task 3 시뮬레이션 재실행 (sync RPC smoke)**

Tool call:
```
mcp__supabase__execute_sql({
  query: "WITH t AS (SELECT id FROM public.users LIMIT 1) SELECT public.sync_subscription_atomically((SELECT id FROM t), 'pro_monthly', 'active'::subscription_status, now(), now() + interval '30 days', NULL, NULL, 'rc_customer_phase1_smoke', 'rc_event_phase1_smoke_001', 'created'::subscription_event_type, '{}'::jsonb)"
})
```
Expected: `{"success": true, "plan_id": "pro_monthly", "status": "active", "period_end": "..."}`.

- [ ] **Step 6.6: 멱등성 검증 — 같은 event_id 2번째 호출**

Tool call:
```
mcp__supabase__execute_sql({
  query: "WITH t AS (SELECT id FROM public.users LIMIT 1) SELECT public.sync_subscription_atomically((SELECT id FROM t), 'pro_monthly', 'active'::subscription_status, now(), now() + interval '30 days', NULL, NULL, 'rc_customer_phase1_smoke', 'rc_event_phase1_smoke_001', 'created'::subscription_event_type, '{}'::jsonb)"
})
```
Expected: `{"success": true, "idempotent": true}`. subscription_events에 추가 row 생성 안 됨.

- [ ] **Step 6.7: get_active_entitlement smoke**

Tool call:
```
mcp__supabase__execute_sql({
  query: "WITH t AS (SELECT id FROM public.users LIMIT 1) SELECT public.get_active_entitlement((SELECT id FROM t))"
})
```
Expected: `tier = 'pro'`, `features.urgent_post = true`, `features.priority_search = false`, `features.max_stores = 5`.

- [ ] **Step 6.8: check_feature_access smoke (4 케이스)**

Tool call:
```
mcp__supabase__execute_sql({
  query: "WITH t AS (SELECT id FROM public.users LIMIT 1) SELECT public.check_feature_access((SELECT id FROM t), 'urgent_post') AS pro_urgent, public.check_feature_access((SELECT id FROM t), 'priority_search') AS pro_priority, public.check_feature_access(gen_random_uuid(), 'urgent_post') AS free_urgent, public.check_feature_access(gen_random_uuid(), 'emphasize_post') AS free_emphasize"
})
```
Expected:
- `pro_urgent.allowed = true`
- `pro_priority.allowed = false` (Enterprise 전용)
- `free_urgent.allowed = false`
- `free_emphasize.allowed = false`

- [ ] **Step 6.9: 정리 — smoke test row 삭제**

Tool call:
```
mcp__supabase__execute_sql({
  query: "DELETE FROM public.subscription_events WHERE revenuecat_event_id = 'rc_event_phase1_smoke_001'; DELETE FROM public.subscriptions WHERE revenuecat_customer_id = 'rc_customer_phase1_smoke'"
})
```
Expected: 각 1행 삭제.

- [ ] **Step 6.10: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/supabase/migrations/20260429000500_seed_subscription_plans.sql
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): 7개 plan 시드 + 3개 RPC smoke 검증"
```

---

## Task 7: Feature Flag app_config 시드

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260429000600_seed_subscription_app_config.sql`

- [ ] **Step 7.1: 마이그레이션 파일 작성**

```sql
-- Subscription Feature Flag 시드 (Spec §9 Feature Flag 롤아웃)
-- Beta 단계: 모두 비활성. M+2 Soft enforce 시점에 enforced_features 토글.

INSERT INTO public.app_config (key, value, description) VALUES
  ('subscription.enabled',
   '{"enabled": false}'::jsonb,
   'Subscription 시스템 마스터 스위치. true 시 paywall UI 노출.'),

  ('subscription.enforced_features',
   '{"emphasize_post": false, "urgent_post": false, "pinned_post": false, "priority_search": false, "brand_page": false, "advanced_analytics": false, "insights_api": false, "dedicated_support": false}'::jsonb,
   '각 feature별 paywall 강제 여부. false면 Free에서도 사용 가능 (Beta 단계).'),

  ('subscription.rollout_percentage',
   '{"value": 0}'::jsonb,
   'paywall 적용 사용자 비율 (0~100). user_bucket(user_id) < value 인 사용자만 적용.')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
```

- [ ] **Step 7.2: 마이그레이션 적용**

Tool call: `mcp__supabase__apply_migration({ name: "20260429000600_seed_subscription_app_config", query: "<위 SQL>" })`
Expected: success.

- [ ] **Step 7.3: 시드 확인**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT key, value FROM public.app_config WHERE key LIKE 'subscription.%' ORDER BY key"
})
```
Expected: 3행 모두 존재. `subscription.enabled.enabled = false`.

- [ ] **Step 7.4: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/supabase/migrations/20260429000600_seed_subscription_app_config.sql
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): Feature flag app_config 3개 시드 (Beta 단계)"
```

---

## Task 8: TypeScript types + Zod schemas

**Files:**
- Create: `uniqn-mobile/src/types/subscription.ts`

- [ ] **Step 8.1: types 파일 작성**

```typescript
import { z } from 'zod';

// ── ENUM ───────────────────────────────────────────────────────────
export const subscriptionTierSchema = z.enum(['free', 'basic', 'pro', 'enterprise']);
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const subscriptionPeriodSchema = z.enum(['monthly', 'annual']);
export type SubscriptionPeriod = z.infer<typeof subscriptionPeriodSchema>;

export const subscriptionStatusSchema = z.enum([
  'active',
  'in_trial',
  'in_grace_period',
  'cancelled',
  'expired',
  'billing_issue',
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionEventTypeSchema = z.enum([
  'created',
  'renewed',
  'plan_changed',
  'cancelled',
  'reactivated',
  'expired',
  'refunded',
  'billing_issue',
  'grace_started',
  'grace_resolved',
  'trial_started',
  'trial_converted',
  'trial_expired_to_free',
]);
export type SubscriptionEventType = z.infer<typeof subscriptionEventTypeSchema>;

export const brandPageLevelSchema = z.enum(['none', 'mini', 'full']);
export type BrandPageLevel = z.infer<typeof brandPageLevelSchema>;

// ── 차등 feature 키 (check_feature_access 인자) ──────────────────────
export const featureAccessKeySchema = z.enum([
  'emphasize_post',
  'urgent_post',
  'pinned_post',
  'priority_search',
  'brand_page_mini',
  'brand_page_full',
  'advanced_analytics',
  'insights_api',
  'dedicated_support',
  'multi_store',
]);
export type FeatureAccessKey = z.infer<typeof featureAccessKeySchema>;

// ── 테이블 row ─────────────────────────────────────────────────────
export const subscriptionPlanSchema = z.object({
  plan_id: z.string(),
  tier: subscriptionTierSchema,
  period: subscriptionPeriodSchema,
  can_emphasize_post: z.boolean(),
  can_urgent_post: z.boolean(),
  can_pinned_post: z.boolean(),
  has_priority_search_rank: z.boolean(),
  has_brand_page: brandPageLevelSchema,
  max_stores: z.number().int(),
  has_advanced_analytics: z.boolean(),
  has_insights_api: z.boolean(),
  has_dedicated_support: z.boolean(),
  price_krw: z.number().int().nonnegative(),
  display_order: z.number().int(),
  active: z.boolean(),
  created_at: z.string(),
});
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const subscriptionRowSchema = z.object({
  user_id: z.string().uuid(),
  plan_id: z.string(),
  status: subscriptionStatusSchema,
  period_start: z.string(),
  period_end: z.string(),
  cancel_at: z.string().nullable(),
  trial_end: z.string().nullable(),
  revenuecat_customer_id: z.string(),
  store_country: z.string().nullable(),
  updated_at: z.string(),
});
export type SubscriptionRow = z.infer<typeof subscriptionRowSchema>;

// ── RPC 응답 ──────────────────────────────────────────────────────
export const checkFeatureAccessResponseSchema = z.object({
  allowed: z.boolean(),
  current_tier: subscriptionTierSchema,
  feature: z.string(),
});
export type CheckFeatureAccessResponse = z.infer<typeof checkFeatureAccessResponseSchema>;

export const activeEntitlementSchema = z.object({
  tier: subscriptionTierSchema,
  plan_id: z.string(),
  period: subscriptionPeriodSchema,
  status: subscriptionStatusSchema,
  period_end: z.string().nullable(),
  trial_end: z.string().nullable(),
  cancel_at: z.string().nullable(),
  features: z.object({
    emphasize_post: z.boolean(),
    urgent_post: z.boolean(),
    pinned_post: z.boolean(),
    priority_search: z.boolean(),
    brand_page: brandPageLevelSchema,
    max_stores: z.number().int(),
    advanced_analytics: z.boolean(),
    insights_api: z.boolean(),
    dedicated_support: z.boolean(),
  }),
});
export type ActiveEntitlement = z.infer<typeof activeEntitlementSchema>;
```

- [ ] **Step 8.2: 타입 체크**

```bash
cd /c/Users/user/Desktop/T-HOLDEM/uniqn-mobile && npx tsc --noEmit src/types/subscription.ts
```
Expected: 0 errors.

- [ ] **Step 8.3: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/src/types/subscription.ts
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): TypeScript types + Zod schemas"
```

---

## Task 9: SubscriptionRepository (Phase 1은 read-only)

**Files:**
- Create: `uniqn-mobile/src/repositories/supabase/SubscriptionRepository.ts`

- [ ] **Step 9.1: Repository 파일 작성**

```typescript
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/shared/logger';
import {
  activeEntitlementSchema,
  checkFeatureAccessResponseSchema,
  subscriptionPlanSchema,
  type ActiveEntitlement,
  type CheckFeatureAccessResponse,
  type FeatureAccessKey,
  type SubscriptionPlan,
} from '@/types/subscription';

/**
 * Subscription Repository (Phase 1 — read-only)
 *
 * Phase 2부터 sync_subscription_atomically 호출은 Edge Function 전용.
 * 클라이언트는 read-only RPC만 사용한다.
 *
 * Spec: docs/superpowers/specs/2026-04-26-monetization-subscription-design.md §6
 */
export const SubscriptionRepository = {
  /**
   * 현재 사용자의 entitlement (plan + features) 단일 조회.
   * NULL/expired 사용자는 'free' plan으로 fallback (서버에서 처리).
   */
  async getActiveEntitlement(userId: string): Promise<ActiveEntitlement> {
    const { data, error } = await supabase.rpc('get_active_entitlement', { p_user_id: userId });
    if (error) {
      logger.error('subscription.get_active_entitlement_failed', { userId, error: error.message });
      throw error;
    }
    return activeEntitlementSchema.parse(data);
  },

  /**
   * 단일 feature 권한 체크.
   * 권한 없을 때 UI에서 paywall 표시할 데이터 (current_tier 포함) 반환.
   */
  async checkFeatureAccess(
    userId: string,
    feature: FeatureAccessKey,
  ): Promise<CheckFeatureAccessResponse> {
    const { data, error } = await supabase.rpc('check_feature_access', {
      p_user_id: userId,
      p_feature: feature,
    });
    if (error) {
      logger.error('subscription.check_feature_access_failed', {
        userId,
        feature,
        error: error.message,
      });
      throw error;
    }
    return checkFeatureAccessResponseSchema.parse(data);
  },

  /**
   * 활성 plan 카탈로그 조회 (paywall 화면용).
   * RLS `plans_public_read` (active = true)만 노출됨.
   */
  async listActivePlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });
    if (error) {
      logger.error('subscription.list_plans_failed', { error: error.message });
      throw error;
    }
    return (data ?? []).map((row) => subscriptionPlanSchema.parse(row));
  },
};
```

- [ ] **Step 9.2: import 경로 확인**

```bash
cd /c/Users/user/Desktop/T-HOLDEM/uniqn-mobile && grep -r "from '@/lib/supabase/client'" src/repositories/supabase | head -3
```
Expected: 같은 경로 import 다수 발견. 없으면 `@/shared/supabase` 또는 다른 위치인지 확인 후 수정.

- [ ] **Step 9.3: 타입 체크**

```bash
cd /c/Users/user/Desktop/T-HOLDEM/uniqn-mobile && npx tsc --noEmit src/repositories/supabase/SubscriptionRepository.ts
```
Expected: 0 errors. 만약 supabase client 경로가 다르면 import 수정 후 재실행.

- [ ] **Step 9.4: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/src/repositories/supabase/SubscriptionRepository.ts
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "feat(subscription): SubscriptionRepository (read-only — Phase 1)"
```

---

## Task 10: RPC 통합 테스트 (Jest)

**Files:**
- Create: `uniqn-mobile/src/__tests__/subscription/subscriptionRpcs.integration.test.ts`

본 테스트는 Supabase test instance(또는 supabase MCP)를 사용. CI에서 자동 실행 가능 환경이 없다면 로컬 검증용으로만.

- [ ] **Step 10.1: 테스트 파일 작성**

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Subscription RPC 통합 테스트 (Phase 1)
 *
 * 사전 조건:
 * - Phase 1 마이그레이션 6개 모두 적용 완료
 * - 환경변수 SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY / SUPABASE_TEST_USER_ID
 *
 * 검증 범위:
 * - sync_subscription_atomically 첫 호출 / 멱등성 / plan_changed 변경
 * - check_feature_access 4 tier × 핵심 feature 매트릭스
 * - get_active_entitlement free fallback / pro 응답 / cancelled-but-active 처리
 */

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
const TEST_USER = process.env.SUPABASE_TEST_USER_ID;

const describeIfConfigured =
  TEST_URL && TEST_KEY && TEST_USER ? describe : describe.skip;

describeIfConfigured('subscription RPCs (integration)', () => {
  let supa: SupabaseClient;
  const userId = TEST_USER!;
  const eventBaseId = `test_${Date.now()}`;

  beforeAll(() => {
    supa = createClient(TEST_URL!, TEST_KEY!, {
      auth: { persistSession: false },
    });
  });

  afterAll(async () => {
    await supa
      .from('subscription_events')
      .delete()
      .like('revenuecat_event_id', `${eventBaseId}_%`);
    await supa
      .from('subscriptions')
      .delete()
      .eq('revenuecat_customer_id', `cust_${eventBaseId}`);
  });

  test('sync_subscription_atomically 첫 호출은 plan_id를 반환한다', async () => {
    const { data, error } = await supa.rpc('sync_subscription_atomically', {
      p_user_id: userId,
      p_plan_id: 'pro_monthly',
      p_status: 'active',
      p_period_start: new Date().toISOString(),
      p_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      p_cancel_at: null,
      p_trial_end: null,
      p_rc_customer_id: `cust_${eventBaseId}`,
      p_rc_event_id: `${eventBaseId}_001`,
      p_event_type: 'created',
      p_metadata: {},
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ success: true, plan_id: 'pro_monthly', status: 'active' });
  });

  test('sync_subscription_atomically 같은 event_id 재호출은 idempotent 응답', async () => {
    const { data, error } = await supa.rpc('sync_subscription_atomically', {
      p_user_id: userId,
      p_plan_id: 'pro_monthly',
      p_status: 'active',
      p_period_start: new Date().toISOString(),
      p_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      p_cancel_at: null,
      p_trial_end: null,
      p_rc_customer_id: `cust_${eventBaseId}`,
      p_rc_event_id: `${eventBaseId}_001`,
      p_event_type: 'created',
      p_metadata: {},
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ success: true, idempotent: true });
  });

  test('get_active_entitlement은 pro plan + features를 반환한다', async () => {
    const { data, error } = await supa.rpc('get_active_entitlement', {
      p_user_id: userId,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      tier: 'pro',
      plan_id: 'pro_monthly',
      status: 'active',
      features: {
        urgent_post: true,
        pinned_post: true,
        priority_search: false,
        max_stores: 5,
      },
    });
  });

  test('check_feature_access — pro user는 urgent_post 가능, priority_search 차단', async () => {
    const { data: urgent } = await supa.rpc('check_feature_access', {
      p_user_id: userId,
      p_feature: 'urgent_post',
    });
    const { data: priority } = await supa.rpc('check_feature_access', {
      p_user_id: userId,
      p_feature: 'priority_search',
    });
    expect(urgent).toMatchObject({ allowed: true, current_tier: 'pro', feature: 'urgent_post' });
    expect(priority).toMatchObject({
      allowed: false,
      current_tier: 'pro',
      feature: 'priority_search',
    });
  });

  test('check_feature_access — 미등록 user(=Free fallback)는 emphasize_post 차단', async () => {
    const fakeUser = '00000000-0000-0000-0000-000000000000';
    const { data } = await supa.rpc('check_feature_access', {
      p_user_id: fakeUser,
      p_feature: 'emphasize_post',
    });
    expect(data).toMatchObject({ allowed: false, current_tier: 'free' });
  });

  test('plan_changed: pro_monthly → enterprise_monthly 동기화 후 features 갱신', async () => {
    await supa.rpc('sync_subscription_atomically', {
      p_user_id: userId,
      p_plan_id: 'enterprise_monthly',
      p_status: 'active',
      p_period_start: new Date().toISOString(),
      p_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      p_cancel_at: null,
      p_trial_end: null,
      p_rc_customer_id: `cust_${eventBaseId}`,
      p_rc_event_id: `${eventBaseId}_002`,
      p_event_type: 'plan_changed',
      p_metadata: {},
    });

    const { data } = await supa.rpc('get_active_entitlement', { p_user_id: userId });
    expect(data).toMatchObject({
      tier: 'enterprise',
      features: {
        priority_search: true,
        max_stores: -1,
        insights_api: true,
        dedicated_support: true,
      },
    });
  });

  test('cancelled-but-period_end-future: features 유지', async () => {
    const futureEnd = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await supa.rpc('sync_subscription_atomically', {
      p_user_id: userId,
      p_plan_id: 'enterprise_monthly',
      p_status: 'cancelled',
      p_period_start: new Date(Date.now() - 86_400_000).toISOString(),
      p_period_end: futureEnd,
      p_cancel_at: new Date().toISOString(),
      p_trial_end: null,
      p_rc_customer_id: `cust_${eventBaseId}`,
      p_rc_event_id: `${eventBaseId}_003`,
      p_event_type: 'cancelled',
      p_metadata: {},
    });

    const { data } = await supa.rpc('get_active_entitlement', { p_user_id: userId });
    expect(data).toMatchObject({
      tier: 'enterprise',
      status: 'cancelled',
      features: { priority_search: true },
    });
  });
});
```

- [ ] **Step 10.2: 테스트 실행 (환경변수 미설정 시 skip)**

```bash
cd /c/Users/user/Desktop/T-HOLDEM/uniqn-mobile && npx jest src/__tests__/subscription/subscriptionRpcs.integration.test.ts --no-coverage
```
Expected:
- 환경변수 미설정 → 모든 test skipped (PASS)
- 환경변수 설정 → 7 tests pass

- [ ] **Step 10.3: 타입 체크**

```bash
cd /c/Users/user/Desktop/T-HOLDEM/uniqn-mobile && npx tsc --noEmit src/__tests__/subscription/subscriptionRpcs.integration.test.ts
```
Expected: 0 errors.

- [ ] **Step 10.4: Commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add uniqn-mobile/src/__tests__/subscription/subscriptionRpcs.integration.test.ts
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "test(subscription): RPC 통합 테스트 7개 (sync 멱등성 + entitlement + cancelled fallback)"
```

---

## Task 11: Phase 1 종료 체크 + 종합 검증

- [ ] **Step 11.1: 마이그레이션 적용 목록 확인**

Tool call: `mcp__supabase__list_migrations({})`
Expected: 가장 최근 7개에 다음 모두 포함:
- `20260429000000_create_subscription_enums_and_tables`
- `20260429000100_create_subscription_rls`
- `20260429000200_create_sync_subscription_rpc`
- `20260429000300_create_check_feature_access_rpc`
- `20260429000400_create_get_active_entitlement_rpc`
- `20260429000500_seed_subscription_plans`
- `20260429000600_seed_subscription_app_config`

- [ ] **Step 11.2: Supabase advisor 보안 점검**

Tool call: `mcp__supabase__get_advisors({ type: "security" })`
Expected: subscription_* 테이블/RPC 관련 경고 0건. (RLS는 이미 활성화, function search_path 명시됨.)

- [ ] **Step 11.3: Supabase advisor 성능 점검**

Tool call: `mcp__supabase__get_advisors({ type: "performance" })`
Expected: subscription_* 관련 미사용 인덱스 또는 누락 인덱스 경고 없음. 있으면 별도 마이그레이션으로 정리.

- [ ] **Step 11.4: npm run quality**

```bash
cd /c/Users/user/Desktop/T-HOLDEM/uniqn-mobile && npm run quality
```
Expected: type-check + lint + format:check 모두 PASS.

- [ ] **Step 11.5: spec lock 표시 갱신 (Phase 1 완료 표시)**

`docs/superpowers/specs/2026-04-26-monetization-subscription-design.md` 의 §16 마이그레이션 순서에 ✅ 마크 추가:

```markdown
1. ✅ `20260429000000_create_subscription_enums_and_tables.sql`
2. ✅ `20260429000100_create_subscription_rls.sql`
3. ✅ `20260429000200_create_sync_subscription_rpc.sql`
4. ✅ `20260429000300_create_check_feature_access_rpc.sql`
5. ✅ `20260429000400_create_get_active_entitlement_rpc.sql`
6. ✅ `20260429000500_seed_subscription_plans.sql`
7. ✅ `20260429000600_seed_subscription_app_config.sql`

**Phase 1 완료: 2026-04-29**
```

(spec §16에는 5개 마이그만 명시되어 있지만 실제 적용은 7개로 분리. 본 step에서 정확한 7개 목록으로 갱신.)

- [ ] **Step 11.6: Phase 1 종료 commit**

```bash
git -C /c/Users/user/Desktop/T-HOLDEM add docs/superpowers/specs/2026-04-26-monetization-subscription-design.md
git -C /c/Users/user/Desktop/T-HOLDEM commit -m "docs(subscription): Phase 1 DB Foundation 완료 (마이그 7개 적용)"
```

- [ ] **Step 11.7: 다음 Phase 안내**

Phase 1 완료 시점:
- DB 기반 완성 (3 테이블 + RLS + 3 RPC + 7 plan + 3 feature flag)
- RPC 통합 테스트 7개 (환경변수 설정 시 자동 실행)
- 타입/레포지토리 read-only 구현

**Next Phase 2: RevenueCat Webhook Edge Function**
- 별도 plan: `docs/superpowers/plans/2026-04-XX-monetization-subscription-phase2-webhook.md`
- 주요 작업: `supabase/functions/revenuecat-subscription-webhook/index.ts` + 시그니처 검증 + 9개 RC event 매핑 + sync_subscription_atomically 호출

본 plan은 Phase 1에서 종료. Phase 2 plan 작성은 별도 세션에서 진행.

---

## Self-Review (작성자 셀프 체크)

- [x] Spec §5 (DB 스키마) — Task 1, 2 커버 ✓
- [x] Spec §6.1 (sync RPC) — Task 3 ✓
- [x] Spec §6.2 (check_feature_access) — Task 4 ✓
- [x] Spec §6.3 (get_active_entitlement) — Task 5 ✓
- [x] Spec §5.2 (시드 7개) — Task 6 ✓
- [x] Spec §9 (Feature Flag) — Task 7 ✓
- [x] Spec §8 (클라이언트 구조 — types/repository) — Task 8, 9 ✓
- [x] Spec §12 (테스트 전략 — RPC 통합) — Task 10 ✓
- [x] Spec §1.4 (UI/UX 컴플라이언스 가드) — Phase 6 별도 plan으로 분리 (out of scope)
- [x] Spec §15 (컴플라이언스 체크리스트) — Phase 6 별도 plan으로 분리
- [x] Phase 2~7 모두 별도 plan 명시 (out of scope에 나열)
- [x] 모든 SQL/TypeScript 코드 placeholder 없음
- [x] 모든 step에 expected 결과 명시
- [x] 마이그레이션 순서: enums → rls → rpc(3) → seed(plans, config) → 검증
