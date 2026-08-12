# Monetization Implementation Plan — Phase 1: DB Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UNIQN 결제 시스템(하트/다이아 wallet)의 Postgres 기반(테이블 + RLS + RPC + trigger + seed)을 구축한다. Phase 1 종료 시점에 SQL/psql로 purchase/consume/refund 시뮬레이션이 모두 작동해야 한다.

**Architecture:** Append-only `wallet_ledger` + cached `wallets` (trigger 동기화) + FIFO `heart_lots` + 카탈로그 `diamond_products`. 모든 잔액 변동은 `SECURITY DEFINER` RPC를 거치며 RLS는 본인 SELECT만 허용. Idempotency는 `wallet_ledger.revenuecat_transaction_id UNIQUE`로 강제.

**Tech Stack:** Supabase Postgres 15, plpgsql, pg_cron, MCP `apply_migration`, Jest (RPC integration tests via supabase-js).

**Spec:** `docs/superpowers/specs/2026-04-26-monetization-design.md` (Locked, 2026-04-26)

**Out of Scope (별도 후속 plan):**
- Phase 2: RevenueCat Webhook Edge Function (`docs/superpowers/plans/2026-04-XX-monetization-webhook.md` 예정)
- Phase 3: Client SDK + Wallet UI
- Phase 4: jobManagement 차감 통합
- Phase 5: 하트 적립 흐름 (signup/attendance/referral/review)
- Phase 6: Feature Flag rollout 전환
- Phase 7: 환불 정책 RPC 통합 + 모니터링

---

## File Structure (Phase 1)

| 파일 | 책임 |
|---|---|
| `uniqn-mobile/supabase/migrations/20260427000000_create_wallet_enums_and_tables.sql` | ENUM 2개 + 테이블 4개 + 인덱스 |
| `uniqn-mobile/supabase/migrations/20260427000100_create_wallet_rls.sql` | RLS 정책 7개 |
| `uniqn-mobile/supabase/migrations/20260427000200_create_wallet_balance_trigger.sql` | `tr_wallet_ledger_update_balance` (캐시 sync) |
| `uniqn-mobile/supabase/migrations/20260427000300_create_consume_diamonds_rpc.sql` | `consume_diamonds_atomically` |
| `uniqn-mobile/supabase/migrations/20260427000400_create_credit_diamonds_rpc.sql` | `credit_diamonds_atomically` (+첫충전 보너스) |
| `uniqn-mobile/supabase/migrations/20260427000500_create_grant_heart_rpc.sql` | `grant_heart_atomically` + `get_wallet_summary` |
| `uniqn-mobile/supabase/migrations/20260427000600_create_create_job_posting_with_payment_rpc.sql` | wrapper RPC (consume + INSERT job_postings 단일 트랜잭션) |
| `uniqn-mobile/supabase/migrations/20260427000700_create_refund_job_cancellation_rpc.sql` | `refund_job_cancellation_atomically` (24h 100% / 이후 50%) |
| `uniqn-mobile/supabase/migrations/20260427000800_seed_diamond_products.sql` | 6개 SKU 시드 |
| `uniqn-mobile/supabase/migrations/20260427000900_seed_app_config_monetization.sql` | Feature flag JSONB 시드 |
| `uniqn-mobile/supabase/migrations/20260427001000_create_heart_expiry_cron.sql` | pg_cron 매일 KST 자정 만료 처리 |
| `uniqn-mobile/src/repositories/supabase/WalletRepository.ts` | TypeScript 클라이언트 인터페이스 (Phase 1은 read-only 메서드만) |
| `uniqn-mobile/src/types/wallet.ts` | TypeScript types + Zod schemas |
| `uniqn-mobile/src/__tests__/wallet/walletRpcs.integration.test.ts` | RPC 통합 테스트 (Supabase test instance) |

---

## Pre-Flight (Phase 1 시작 전 1회)

- [ ] **Step 0.1: 브랜치 확인**
  ```bash
  cd /c/Users/user/Desktop/T-HOLDEM
  git branch --show-current
  ```
  Expected: `design/monetization-system`

- [ ] **Step 0.2: spec 읽기**
  ```bash
  ls -la docs/superpowers/specs/2026-04-26-monetization-design.md
  ```
  Expected: 파일 존재. 의심나면 §3 (DB 스키마) 다시 읽기.

- [ ] **Step 0.3: Supabase MCP 연결 확인**
  Tool call: `mcp__supabase__list_tables({ schemas: ["public"], verbose: false })`
  Expected: 26개 public 테이블, wallets/wallet_ledger/heart_lots/diamond_products **없음** (그린필드 확인).

---

## Task 1: ENUM + 테이블 4개 마이그레이션

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000000_create_wallet_enums_and_tables.sql`

- [ ] **Step 1.1: 마이그레이션 파일 작성**

```sql
-- Wallet 시스템 기반: ENUM 2개 + 테이블 4개
-- Spec: docs/superpowers/specs/2026-04-26-monetization-design.md §3

CREATE TYPE wallet_currency AS ENUM ('heart', 'diamond');

CREATE TYPE wallet_reason AS ENUM (
  'purchase',
  'consume_job_posting',
  'consume_job_extend',
  'consume_job_upgrade',
  'refund_purchase',
  'refund_job_cancelled',
  'grant_signup',
  'grant_daily_attendance',
  'grant_streak_7d',
  'grant_review',
  'grant_referral',
  'grant_admin',
  'grant_first_purchase_bonus',
  'expire_heart'
);

CREATE TABLE public.diamond_products (
  product_id      TEXT PRIMARY KEY,
  diamonds        INT  NOT NULL CHECK (diamonds > 0),
  bonus_diamonds  INT  NOT NULL DEFAULT 0,
  price_krw       INT  NOT NULL,
  display_order   INT  NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wallets (
  user_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  heart_balance    INT NOT NULL DEFAULT 0 CHECK (heart_balance >= 0),
  diamond_balance  INT NOT NULL DEFAULT 0 CHECK (diamond_balance >= 0),
  lifetime_purchased_diamonds INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wallet_ledger (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  currency_type             wallet_currency NOT NULL,
  delta                     INT NOT NULL,
  reason                    wallet_reason NOT NULL,
  ref_id                    UUID,
  ref_type                  TEXT,
  balance_after_heart       INT NOT NULL,
  balance_after_diamond     INT NOT NULL,
  revenuecat_transaction_id TEXT UNIQUE,
  metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_ledger_user_created
  ON public.wallet_ledger(user_id, created_at DESC);

CREATE INDEX idx_wallet_ledger_ref
  ON public.wallet_ledger(ref_type, ref_id)
  WHERE ref_id IS NOT NULL;

CREATE TABLE public.heart_lots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_initial   INT NOT NULL CHECK (amount_initial > 0),
  amount_remaining INT NOT NULL CHECK (amount_remaining >= 0),
  granted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  source           wallet_reason NOT NULL,
  source_ref_id   UUID,
  CONSTRAINT chk_amount_remaining_lte_initial
    CHECK (amount_remaining <= amount_initial)
);

CREATE INDEX idx_heart_lots_user_expiring
  ON public.heart_lots(user_id, expires_at)
  WHERE amount_remaining > 0;

COMMENT ON TABLE public.wallets IS 'Cached balance per user. Updated by tr_wallet_ledger_update_balance trigger from wallet_ledger inserts. Source of truth is wallet_ledger.';
COMMENT ON TABLE public.wallet_ledger IS 'Append-only ledger. Never UPDATE/DELETE. Refunds are new negative-delta rows. revenuecat_transaction_id UNIQUE provides webhook idempotency.';
COMMENT ON TABLE public.heart_lots IS 'FIFO consumption units for free hearts (90-day expiry). Soonest-expiring lot consumed first.';
```

- [ ] **Step 1.2: MCP 적용**

Tool call:
```
mcp__supabase__apply_migration({
  name: "create_wallet_enums_and_tables",
  query: <위 SQL 전문>
})
```
Expected: success, no error.

- [ ] **Step 1.3: 적용 검증**

Tool call: `mcp__supabase__list_tables({ schemas: ["public"], verbose: false })`
Expected: `public.wallets`, `public.wallet_ledger`, `public.heart_lots`, `public.diamond_products` 4개 새 테이블 확인.

- [ ] **Step 1.4: ENUM 검증**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE typname IN ('wallet_currency','wallet_reason') GROUP BY typname"
})
```
Expected: `wallet_currency` = `[heart, diamond]`, `wallet_reason` = 14개 enum.

- [ ] **Step 1.5: 마이그레이션 파일도 디스크에 저장 (registry 일치)**

```bash
cp <MCP가 적용한 내용> uniqn-mobile/supabase/migrations/20260427000000_create_wallet_enums_and_tables.sql
```
실제로는 동일 SQL을 Write tool로 직접 디스크에 저장.

- [ ] **Step 1.6: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260427000000_create_wallet_enums_and_tables.sql
git commit -m "feat(wallet): ENUM + 4개 테이블 (wallet_ledger ledger 모델)"
```

---

## Task 2: RLS 정책

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000100_create_wallet_rls.sql`

- [ ] **Step 2.1: 마이그레이션 파일 작성**

```sql
-- Wallet RLS: 본인 SELECT만, 모든 쓰기는 SECURITY DEFINER RPC 경유
-- Spec §3.5

ALTER TABLE public.wallets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heart_lots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamond_products ENABLE ROW LEVEL SECURITY;

-- 본인 잔액 조회
CREATE POLICY wallet_self_select ON public.wallets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- admin 모든 잔액 접근
CREATE POLICY wallet_admin_all ON public.wallets
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 본인 ledger 조회
CREATE POLICY ledger_self_select ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- admin 전체 ledger
CREATE POLICY ledger_admin_select ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 본인 heart_lots 조회
CREATE POLICY heart_lots_self_select ON public.heart_lots
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 다이아 상품 카탈로그 공개 읽기
CREATE POLICY products_public_read ON public.diamond_products
  FOR SELECT TO authenticated
  USING (active = true);

COMMENT ON POLICY wallet_self_select ON public.wallets IS 'Phase 1 RLS — write는 SECURITY DEFINER RPC만 허용 (직접 INSERT/UPDATE 정책 없음)';
```

- [ ] **Step 2.2: MCP 적용**

Tool call: `mcp__supabase__apply_migration({ name: "create_wallet_rls", query: <SQL> })`

- [ ] **Step 2.3: RLS advisor 검증**

Tool call: `mcp__supabase__get_advisors({ type: "security" })`
Expected: 신규 wallet/ledger/heart_lots/diamond_products 관련 RLS 경고 없음.

- [ ] **Step 2.4: 직접 INSERT 차단 검증**

Tool call:
```
mcp__supabase__execute_sql({
  query: "SET LOCAL ROLE authenticated; INSERT INTO wallets(user_id) VALUES ('00000000-0000-0000-0000-000000000001');"
})
```
Expected: ERROR — RLS violation (write 정책 없음).

- [ ] **Step 2.5: 디스크 저장 + 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260427000100_create_wallet_rls.sql
git commit -m "feat(wallet): RLS 정책 (본인 SELECT + admin 전체)"
```

---

## Task 3: 캐시 동기화 trigger

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000200_create_wallet_balance_trigger.sql`

- [ ] **Step 3.1: 마이그레이션 파일 작성**

```sql
-- wallet_ledger INSERT 시 wallets 캐시 자동 갱신
-- Pattern: job_postings.stats trigger (20260421040000)
-- Spec §4.4

CREATE OR REPLACE FUNCTION public.fn_wallet_ledger_update_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- balance_after_*는 RPC가 이미 계산해서 ledger row에 기록한 값
  -- trigger는 그것을 wallets 캐시로 복사만 한다
  IF NEW.currency_type = 'heart' THEN
    UPDATE public.wallets SET
      heart_balance = GREATEST(0, NEW.balance_after_heart),
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.currency_type = 'diamond' THEN
    UPDATE public.wallets SET
      diamond_balance = GREATEST(0, NEW.balance_after_diamond),
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_wallet_ledger_update_balance ON public.wallet_ledger;
CREATE TRIGGER tr_wallet_ledger_update_balance
AFTER INSERT ON public.wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.fn_wallet_ledger_update_balance();

COMMENT ON FUNCTION public.fn_wallet_ledger_update_balance() IS
  'wallet_ledger INSERT → wallets 캐시 동기화. balance_after_*는 RPC가 미리 계산해서 ledger에 기록한 값을 그대로 복사. GREATEST(0, ...)는 환불 over-cancel 시 음수 ledger row가 들어와도 캐시는 0 floor 유지 (Decision #2).';
```

- [ ] **Step 3.2: MCP 적용 + 검증**

Apply migration. Then:

```
mcp__supabase__execute_sql({
  query: "SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname = 'tr_wallet_ledger_update_balance'"
})
```
Expected: 1 row, table = `public.wallet_ledger`.

- [ ] **Step 3.3: 디스크 저장 + 커밋**

```bash
git commit -m "feat(wallet): wallet_ledger → wallets 캐시 sync trigger"
```

---

## Task 4: `consume_diamonds_atomically` RPC + 단위 테스트 (TDD)

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000300_create_consume_diamonds_rpc.sql`
- Create: `uniqn-mobile/src/__tests__/wallet/consumeDiamonds.integration.test.ts`

- [ ] **Step 4.1: 실패하는 테스트 먼저 작성**

`uniqn-mobile/src/__tests__/wallet/consumeDiamonds.integration.test.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeEach } from '@jest/globals';

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_USER = '11111111-1111-1111-1111-000000000001';

async function resetUser() {
  await supa.from('wallet_ledger').delete().eq('user_id', TEST_USER);
  await supa.from('heart_lots').delete().eq('user_id', TEST_USER);
  await supa.from('wallets').delete().eq('user_id', TEST_USER);
  await supa.from('users').upsert({ id: TEST_USER, email: 'test@test.com', is_active: true });
}

describe('consume_diamonds_atomically', () => {
  beforeEach(resetUser);

  it('정상 차감 — 다이아 100 보유, 10 차감 → 90 잔여', async () => {
    // Setup: credit 100 diamonds via direct ledger insert (test helper)
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 100 });

    const { data, error } = await supa.rpc('consume_diamonds_atomically', {
      p_user_id: TEST_USER,
      p_amount: 10,
      p_reason: 'consume_job_posting',
      p_ref_id: null,
      p_ref_type: 'job_posting',
    });

    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(data.diamond_consumed).toBe(10);
    expect(data.heart_consumed).toBe(0);
    expect(data.new_diamond_balance).toBe(90);
  });

  it('잔액 부족 → INSUFFICIENT_BALANCE 예외', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 5 });

    const { data, error } = await supa.rpc('consume_diamonds_atomically', {
      p_user_id: TEST_USER,
      p_amount: 10,
      p_reason: 'consume_job_posting',
      p_ref_id: null,
      p_ref_type: 'job_posting',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('INSUFFICIENT_BALANCE');
  });

  it('하트 우선 소비 — 하트 7 + 다이아 10 보유, 10 차감 → 하트 0 + 다이아 7', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, heart_balance: 7, diamond_balance: 10 });
    // heart_lot 1개로 7 보유
    await supa.from('heart_lots').insert({
      user_id: TEST_USER, amount_initial: 7, amount_remaining: 7,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      source: 'grant_signup',
    });

    const { data } = await supa.rpc('consume_diamonds_atomically', {
      p_user_id: TEST_USER, p_amount: 10,
      p_reason: 'consume_job_posting', p_ref_id: null, p_ref_type: 'job_posting',
    });

    expect(data.heart_consumed).toBe(7);
    expect(data.diamond_consumed).toBe(3);
    expect(data.new_heart_balance).toBe(0);
    expect(data.new_diamond_balance).toBe(7);
  });

  it('음수 amount → INVALID_AMOUNT', async () => {
    const { error } = await supa.rpc('consume_diamonds_atomically', {
      p_user_id: TEST_USER, p_amount: -5,
      p_reason: 'consume_job_posting', p_ref_id: null, p_ref_type: 'job_posting',
    });
    expect(error!.message).toContain('INVALID_AMOUNT');
  });

  it('만료된 hart_lot은 소비 안 함', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, heart_balance: 5, diamond_balance: 5 });
    await supa.from('heart_lots').insert({
      user_id: TEST_USER, amount_initial: 5, amount_remaining: 5,
      expires_at: new Date(Date.now() - 86400000).toISOString(), // 어제 만료
      source: 'grant_signup',
    });

    const { data } = await supa.rpc('consume_diamonds_atomically', {
      p_user_id: TEST_USER, p_amount: 5,
      p_reason: 'consume_job_posting', p_ref_id: null, p_ref_type: 'job_posting',
    });

    expect(data.heart_consumed).toBe(0);
    expect(data.diamond_consumed).toBe(5);
  });
});
```

- [ ] **Step 4.2: 테스트 실패 확인**

```bash
cd uniqn-mobile
npm test -- src/__tests__/wallet/consumeDiamonds.integration.test.ts
```
Expected: FAIL — RPC `consume_diamonds_atomically` not found.

- [ ] **Step 4.3: RPC 마이그레이션 작성**

`uniqn-mobile/supabase/migrations/20260427000300_create_consume_diamonds_rpc.sql`:

```sql
-- consume_diamonds_atomically: 하트 FIFO 우선 소비, 부족분 다이아
-- Pattern: cancel_application_atomically (FOR UPDATE 잠금)
-- Spec §4.1

CREATE OR REPLACE FUNCTION public.consume_diamonds_atomically(
  p_user_id  UUID,
  p_amount   INT,
  p_reason   wallet_reason,
  p_ref_id   UUID,
  p_ref_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet           wallets%ROWTYPE;
  v_heart_consumed   INT := 0;
  v_diamond_consumed INT := 0;
  v_remaining        INT := p_amount;
  v_lot              RECORD;
  v_take             INT;
  v_now              TIMESTAMPTZ := now();
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: % must be positive', p_amount;
  END IF;

  -- 지갑 행 잠금 (없으면 생성)
  INSERT INTO wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  -- 총 잔액 검증
  IF v_wallet.heart_balance + v_wallet.diamond_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %h+%d, need %',
      v_wallet.heart_balance, v_wallet.diamond_balance, p_amount;
  END IF;

  -- 하트 우선 소비 (만료 임박순)
  FOR v_lot IN
    SELECT * FROM heart_lots
    WHERE user_id = p_user_id
      AND amount_remaining > 0
      AND expires_at > v_now
    ORDER BY expires_at ASC, granted_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining = 0;
    v_take := LEAST(v_lot.amount_remaining, v_remaining);
    UPDATE heart_lots SET amount_remaining = amount_remaining - v_take
      WHERE id = v_lot.id;
    v_heart_consumed := v_heart_consumed + v_take;
    v_remaining := v_remaining - v_take;
  END LOOP;

  -- 부족분은 다이아
  IF v_remaining > 0 THEN
    v_diamond_consumed := v_remaining;
  END IF;

  -- ledger 기록 (하트/다이아 분리 row)
  IF v_heart_consumed > 0 THEN
    INSERT INTO wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond
    ) VALUES (
      p_user_id, 'heart', -v_heart_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed,
      v_wallet.diamond_balance - v_diamond_consumed
    );
  END IF;
  IF v_diamond_consumed > 0 THEN
    INSERT INTO wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond
    ) VALUES (
      p_user_id, 'diamond', -v_diamond_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed,
      v_wallet.diamond_balance - v_diamond_consumed
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'heart_consumed', v_heart_consumed,
    'diamond_consumed', v_diamond_consumed,
    'new_heart_balance', v_wallet.heart_balance - v_heart_consumed,
    'new_diamond_balance', v_wallet.diamond_balance - v_diamond_consumed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_diamonds_atomically(UUID, INT, wallet_reason, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.consume_diamonds_atomically IS
  '하트→다이아 우선순위로 차감. SECURITY DEFINER + FOR UPDATE로 race-free. 잔액 부족 시 INSUFFICIENT_BALANCE 예외. Spec §4.1';
```

- [ ] **Step 4.4: MCP 적용 + 테스트 재실행**

Apply migration. Then:
```bash
npm test -- src/__tests__/wallet/consumeDiamonds.integration.test.ts
```
Expected: 5/5 PASS.

- [ ] **Step 4.5: 디스크 저장 + 커밋**

```bash
git commit -m "feat(wallet): consume_diamonds_atomically RPC + 5 integration tests"
```

---

## Task 5: `credit_diamonds_atomically` RPC + 첫충전 보너스 + TDD

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000400_create_credit_diamonds_rpc.sql`
- Create: `uniqn-mobile/src/__tests__/wallet/creditDiamonds.integration.test.ts`

- [ ] **Step 5.1: 실패 테스트 작성**

`creditDiamonds.integration.test.ts` (요지):

```typescript
describe('credit_diamonds_atomically', () => {
  beforeEach(resetUser);

  it('정상 충전 — 10💎 + first_purchase 보너스 5💎', async () => {
    const { data } = await supa.rpc('credit_diamonds_atomically', {
      p_user_id: TEST_USER,
      p_diamonds: 10,
      p_revenuecat_transaction_id: 'rc_tx_001',
      p_product_id: 'uniqn_diamonds_3000',
    });
    expect(data.diamonds_credited).toBe(10);
    expect(data.first_purchase_bonus).toBe(5);
    expect(data.new_diamond_balance).toBe(15);
  });

  it('두 번째 충전 — 보너스 없음', async () => {
    await supa.rpc('credit_diamonds_atomically', { p_user_id: TEST_USER, p_diamonds: 10, p_revenuecat_transaction_id: 'rc_tx_001', p_product_id: 'uniqn_diamonds_3000' });
    const { data } = await supa.rpc('credit_diamonds_atomically', {
      p_user_id: TEST_USER, p_diamonds: 33, p_revenuecat_transaction_id: 'rc_tx_002', p_product_id: 'uniqn_diamonds_10000',
    });
    expect(data.first_purchase_bonus).toBe(0);
    expect(data.new_diamond_balance).toBe(48);
  });

  it('멱등성 — 같은 transaction_id 두 번 호출', async () => {
    const r1 = await supa.rpc('credit_diamonds_atomically', { p_user_id: TEST_USER, p_diamonds: 10, p_revenuecat_transaction_id: 'rc_dup', p_product_id: 'uniqn_diamonds_3000' });
    const r2 = await supa.rpc('credit_diamonds_atomically', { p_user_id: TEST_USER, p_diamonds: 10, p_revenuecat_transaction_id: 'rc_dup', p_product_id: 'uniqn_diamonds_3000' });
    expect(r2.data.idempotent).toBe(true);
    // 잔액 불변
    const { data: wallet } = await supa.from('wallets').select('diamond_balance').eq('user_id', TEST_USER).single();
    expect(wallet!.diamond_balance).toBe(15); // 10 + 5 보너스
  });

  it('환불 — 음수 다이아', async () => {
    await supa.rpc('credit_diamonds_atomically', { p_user_id: TEST_USER, p_diamonds: 10, p_revenuecat_transaction_id: 'rc_buy', p_product_id: 'uniqn_diamonds_3000' });
    const { data } = await supa.rpc('credit_diamonds_atomically', {
      p_user_id: TEST_USER, p_diamonds: -10,
      p_revenuecat_transaction_id: 'rc_refund', p_product_id: 'uniqn_diamonds_3000',
    });
    expect(data.diamonds_credited).toBe(-10);
    expect(data.new_diamond_balance).toBe(5); // 15 - 10
  });

  it('환불이 잔액보다 클 때 — 캐시는 0 floor, ledger는 음수 row 그대로', async () => {
    await supa.rpc('credit_diamonds_atomically', { p_user_id: TEST_USER, p_diamonds: 10, p_revenuecat_transaction_id: 'rc_buy2', p_product_id: 'uniqn_diamonds_3000' });
    // 5💎 소비
    await supa.rpc('consume_diamonds_atomically', { p_user_id: TEST_USER, p_amount: 5, p_reason: 'consume_job_posting', p_ref_id: null, p_ref_type: 'job_posting' });
    // 잔액 10 (15-5). 15 환불 시도.
    const { data } = await supa.rpc('credit_diamonds_atomically', {
      p_user_id: TEST_USER, p_diamonds: -15,
      p_revenuecat_transaction_id: 'rc_refund_big', p_product_id: 'uniqn_diamonds_3000',
    });
    expect(data.diamonds_credited).toBe(-15); // ledger는 그대로
    const { data: wallet } = await supa.from('wallets').select('diamond_balance').eq('user_id', TEST_USER).single();
    expect(wallet!.diamond_balance).toBe(0); // GREATEST(0, -5) = 0
  });
});
```

- [ ] **Step 5.2: 테스트 실패 확인**

```bash
npm test -- src/__tests__/wallet/creditDiamonds.integration.test.ts
```
Expected: 5/5 FAIL — RPC 미존재.

- [ ] **Step 5.3: RPC 마이그레이션 작성**

```sql
-- credit_diamonds_atomically: 충전 + 환불 통합 RPC
-- 첫 충전 시 +5💎 보너스 자동 추가 (Decision #7)
-- Spec §4.2

CREATE OR REPLACE FUNCTION public.credit_diamonds_atomically(
  p_user_id                   UUID,
  p_diamonds                  INT,
  p_revenuecat_transaction_id TEXT,
  p_product_id                TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet              wallets%ROWTYPE;
  v_existing            UUID;
  v_first_purchase      BOOLEAN := false;
  v_bonus               INT := 0;
  v_new_diamond_balance INT;
BEGIN
  -- 멱등성 체크
  SELECT id INTO v_existing FROM wallet_ledger
    WHERE revenuecat_transaction_id = p_revenuecat_transaction_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  INSERT INTO wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  -- 첫 구매 판정 (lifetime_purchased_diamonds == 0 AND p_diamonds > 0)
  IF p_diamonds > 0 AND v_wallet.lifetime_purchased_diamonds = 0 THEN
    v_first_purchase := true;
    v_bonus := 5;
  END IF;

  v_new_diamond_balance := v_wallet.diamond_balance + p_diamonds + v_bonus;

  -- 메인 ledger row
  INSERT INTO wallet_ledger(
    user_id, currency_type, delta, reason, ref_type,
    balance_after_heart, balance_after_diamond,
    revenuecat_transaction_id, metadata
  ) VALUES (
    p_user_id, 'diamond', p_diamonds,
    CASE WHEN p_diamonds > 0 THEN 'purchase'::wallet_reason
         ELSE 'refund_purchase'::wallet_reason END,
    'revenuecat',
    v_wallet.heart_balance,
    v_wallet.diamond_balance + p_diamonds,
    p_revenuecat_transaction_id,
    jsonb_build_object('product_id', p_product_id, 'is_first_purchase', v_first_purchase)
  );

  -- 첫 구매 보너스 row (별도 ledger entry, NULL transaction_id로 구별 가능)
  IF v_bonus > 0 THEN
    INSERT INTO wallet_ledger(
      user_id, currency_type, delta, reason, ref_type,
      balance_after_heart, balance_after_diamond, metadata
    ) VALUES (
      p_user_id, 'diamond', v_bonus, 'grant_first_purchase_bonus', 'revenuecat',
      v_wallet.heart_balance,
      v_wallet.diamond_balance + p_diamonds + v_bonus,
      jsonb_build_object('source_transaction_id', p_revenuecat_transaction_id)
    );
  END IF;

  -- lifetime 누계
  IF p_diamonds > 0 THEN
    UPDATE wallets SET lifetime_purchased_diamonds = lifetime_purchased_diamonds + p_diamonds
      WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'diamonds_credited', p_diamonds,
    'first_purchase_bonus', v_bonus,
    'new_diamond_balance', GREATEST(0, v_new_diamond_balance)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_diamonds_atomically(UUID, INT, TEXT, TEXT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_diamonds_atomically(UUID, INT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.credit_diamonds_atomically IS
  'RevenueCat webhook 전용 (service_role only). p_diamonds 양수=구매, 음수=환불. revenuecat_transaction_id UNIQUE 멱등성. 첫 구매 시 +5💎 보너스 자동. Spec §4.2 + Decision #7';
```

- [ ] **Step 5.4: MCP 적용 + 테스트 재실행**

Expected: 5/5 PASS.

- [ ] **Step 5.5: 커밋**

```bash
git commit -m "feat(wallet): credit_diamonds_atomically RPC + 첫충전 +5💎 보너스 + 멱등성"
```

---

## Task 6: `grant_heart_atomically` + `get_wallet_summary` RPC

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000500_create_grant_heart_rpc.sql`
- Create: `uniqn-mobile/src/__tests__/wallet/grantHeart.integration.test.ts`

- [ ] **Step 6.1: 실패 테스트 작성**

```typescript
describe('grant_heart_atomically + get_wallet_summary', () => {
  beforeEach(resetUser);

  it('signup 보너스 — 10💖 + 90일 만료', async () => {
    const { data } = await supa.rpc('grant_heart_atomically', {
      p_user_id: TEST_USER, p_amount: 10, p_reason: 'grant_signup',
      p_source_ref_id: null, p_expires_in_days: 90,
    });
    expect(data.success).toBe(true);
    const expires = new Date(data.expires_at);
    const daysFromNow = (expires.getTime() - Date.now()) / 86400000;
    expect(daysFromNow).toBeGreaterThan(89);
    expect(daysFromNow).toBeLessThan(91);
  });

  it('일일 출석 — 같은 날 두 번 → 두 번째는 already_attended_today', async () => {
    const r1 = await supa.rpc('grant_heart_atomically', {
      p_user_id: TEST_USER, p_amount: 1, p_reason: 'grant_daily_attendance',
      p_source_ref_id: null, p_expires_in_days: 90,
    });
    expect(r1.data.success).toBe(true);
    const r2 = await supa.rpc('grant_heart_atomically', {
      p_user_id: TEST_USER, p_amount: 1, p_reason: 'grant_daily_attendance',
      p_source_ref_id: null, p_expires_in_days: 90,
    });
    expect(r2.data.success).toBe(false);
    expect(r2.data.error).toBe('already_attended_today');
  });

  it('get_wallet_summary — balance + 만료 임박 lots', async () => {
    await supa.rpc('grant_heart_atomically', {
      p_user_id: TEST_USER, p_amount: 5, p_reason: 'grant_signup',
      p_source_ref_id: null, p_expires_in_days: 5,
    });
    await supa.rpc('grant_heart_atomically', {
      p_user_id: TEST_USER, p_amount: 3, p_reason: 'grant_referral',
      p_source_ref_id: null, p_expires_in_days: 60,
    });

    const { data } = await supa.rpc('get_wallet_summary', { p_user_id: TEST_USER });
    expect(data.heart_balance).toBe(8);
    expect(data.diamond_balance).toBe(0);
    expect(data.expiring_lots).toHaveLength(1); // 7일 이내 만료 1개
    expect(data.expiring_lots[0].amount_remaining).toBe(5);
  });
});
```

- [ ] **Step 6.2: 테스트 실패 확인**

```bash
npm test -- src/__tests__/wallet/grantHeart.integration.test.ts
```
Expected: FAIL.

- [ ] **Step 6.3: RPC 마이그레이션 작성**

```sql
-- grant_heart_atomically: 하트 적립 (lot 생성 + ledger 기록)
-- daily_attendance는 KST 기준 일일 1회 제한
-- get_wallet_summary: 잔액 + 만료 임박 lot 조회 (Decision #3 — UI inline 표시용)
-- Spec §4.3

CREATE OR REPLACE FUNCTION public.grant_heart_atomically(
  p_user_id          UUID,
  p_amount           INT,
  p_reason           wallet_reason,
  p_source_ref_id    UUID DEFAULT NULL,
  p_expires_in_days  INT  DEFAULT 90
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lot_id    UUID;
  v_expires   TIMESTAMPTZ := now() + (p_expires_in_days || ' days')::interval;
  v_today_kst DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: % must be positive', p_amount;
  END IF;

  -- daily_attendance KST 일일 1회
  IF p_reason = 'grant_daily_attendance' THEN
    IF EXISTS (
      SELECT 1 FROM wallet_ledger
      WHERE user_id = p_user_id
        AND reason = 'grant_daily_attendance'
        AND (created_at AT TIME ZONE 'Asia/Seoul')::date = v_today_kst
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_attended_today');
    END IF;
  END IF;

  INSERT INTO wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO heart_lots(user_id, amount_initial, amount_remaining, expires_at, source, source_ref_id)
  VALUES (p_user_id, p_amount, p_amount, v_expires, p_reason, p_source_ref_id)
  RETURNING id INTO v_lot_id;

  INSERT INTO wallet_ledger(
    user_id, currency_type, delta, reason, ref_id, ref_type,
    balance_after_heart, balance_after_diamond
  )
  SELECT p_user_id, 'heart', p_amount, p_reason,
         v_lot_id, 'heart_lot',
         w.heart_balance + p_amount, w.diamond_balance
  FROM wallets w WHERE w.user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'lot_id', v_lot_id,
    'expires_at', v_expires,
    'amount', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_heart_atomically(UUID, INT, wallet_reason, UUID, INT) TO service_role;

-- 클라이언트 호출 가능한 wrapper (daily_attendance 전용, 본인만)
CREATE OR REPLACE FUNCTION public.claim_daily_attendance() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid UUID := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  RETURN public.grant_heart_atomically(v_uid, 1, 'grant_daily_attendance', NULL, 90);
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_daily_attendance() TO authenticated;

-- get_wallet_summary: 본인 잔액 + 만료 임박 lots (7일 이내) 조회
CREATE OR REPLACE FUNCTION public.get_wallet_summary(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid    UUID := COALESCE(p_user_id, (SELECT auth.uid()));
  v_wallet wallets%ROWTYPE;
  v_lots   JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  -- admin이 아니면 본인만 조회 가능
  IF v_uid != (SELECT auth.uid())
     AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') != 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_uid;
  IF NOT FOUND THEN
    -- 빈 지갑
    RETURN jsonb_build_object(
      'heart_balance', 0, 'diamond_balance', 0,
      'lifetime_purchased_diamonds', 0, 'expiring_lots', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lot_id', id, 'amount_remaining', amount_remaining,
    'expires_at', expires_at, 'source', source
  ) ORDER BY expires_at ASC), '[]'::jsonb) INTO v_lots
  FROM heart_lots
  WHERE user_id = v_uid
    AND amount_remaining > 0
    AND expires_at BETWEEN now() AND now() + interval '7 days';

  RETURN jsonb_build_object(
    'heart_balance', v_wallet.heart_balance,
    'diamond_balance', v_wallet.diamond_balance,
    'lifetime_purchased_diamonds', v_wallet.lifetime_purchased_diamonds,
    'expiring_lots', v_lots
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary(UUID) TO authenticated;
```

- [ ] **Step 6.4: MCP 적용 + 테스트 재실행**

Expected: 3/3 PASS.

- [ ] **Step 6.5: 커밋**

```bash
git commit -m "feat(wallet): grant_heart_atomically + claim_daily_attendance + get_wallet_summary"
```

---

## Task 7: `create_job_posting_with_payment_atomically` (race-free wrapper)

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000600_create_create_job_posting_with_payment_rpc.sql`
- Create: `uniqn-mobile/src/__tests__/wallet/createJobPostingWithPayment.integration.test.ts`

- [ ] **Step 7.1: 실패 테스트 작성**

```typescript
describe('create_job_posting_with_payment_atomically', () => {
  beforeEach(resetUser);

  it('regular 공고 + 1💎 차감 — 단일 트랜잭션', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 5 });
    const postingPayload = {
      title: 'Test Posting',
      type: 'regular',
      total_positions: 1,
      // ... (실제 job_postings 필수 필드는 Phase 4에서 통합 시 spec 검증)
    };
    const { data } = await supa.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: TEST_USER,
      p_posting_payload: postingPayload,
      p_cost_diamonds: 1,
      p_reason: 'consume_job_posting',
    });

    expect(data.success).toBe(true);
    expect(data.posting_id).toBeDefined();
    expect(data.diamonds_consumed).toBe(1);
    // ledger ref_id가 즉시 set
    const { data: ledger } = await supa.from('wallet_ledger').select('ref_id, ref_type')
      .eq('user_id', TEST_USER).eq('reason', 'consume_job_posting').single();
    expect(ledger!.ref_id).toBe(data.posting_id);
  });

  it('잔액 부족 시 공고 INSERT도 롤백', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 0 });
    const before = await supa.from('job_postings').select('id', { count: 'exact', head: true }).eq('owner_id', TEST_USER);
    const { error } = await supa.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: TEST_USER,
      p_posting_payload: { title: 'Will Fail', type: 'urgent' },
      p_cost_diamonds: 10,
      p_reason: 'consume_job_posting',
    });
    expect(error!.message).toContain('INSUFFICIENT_BALANCE');
    const after = await supa.from('job_postings').select('id', { count: 'exact', head: true }).eq('owner_id', TEST_USER);
    expect(after.count).toBe(before.count); // 공고 INSERT 안 됨
  });

  it('cost=0 (tournament) — 차감 skip, 공고만 INSERT', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 0 });
    const { data } = await supa.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: TEST_USER,
      p_posting_payload: { title: 'Tournament', type: 'tournament' },
      p_cost_diamonds: 0,
      p_reason: 'consume_job_posting',
    });
    expect(data.success).toBe(true);
    expect(data.diamonds_consumed).toBe(0);
    expect(data.posting_id).toBeDefined();
  });
});
```

- [ ] **Step 7.2: 테스트 실패 확인**

```bash
npm test -- src/__tests__/wallet/createJobPostingWithPayment.integration.test.ts
```
Expected: FAIL.

- [ ] **Step 7.3: RPC 마이그레이션 작성**

```sql
-- create_job_posting_with_payment_atomically:
-- 다이아 차감 + job_postings INSERT를 단일 트랜잭션으로 수행
-- Spec §6.3 race window 해결
-- p_posting_payload 는 jobs Service가 만든 jsonb (모든 컬럼)
-- 검증: cost_diamonds == 0이면 차감 skip (Tournament 케이스 #11)

CREATE OR REPLACE FUNCTION public.create_job_posting_with_payment_atomically(
  p_owner_id        UUID,
  p_posting_payload JSONB,
  p_cost_diamonds   INT,
  p_reason          wallet_reason
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_posting_id        UUID;
  v_consume_result    JSONB;
  v_diamonds_consumed INT := 0;
  v_heart_consumed    INT := 0;
BEGIN
  IF p_cost_diamonds < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: cost_diamonds % must be >= 0', p_cost_diamonds;
  END IF;

  -- 1. 공고 INSERT (jsonb_populate_record로 컬럼 매핑)
  INSERT INTO job_postings
  SELECT * FROM jsonb_populate_record(
    NULL::job_postings,
    p_posting_payload || jsonb_build_object('owner_id', p_owner_id)
  )
  RETURNING id INTO v_posting_id;

  -- 2. cost > 0이면 차감 (실패 시 전체 트랜잭션 롤백)
  IF p_cost_diamonds > 0 THEN
    v_consume_result := public.consume_diamonds_atomically(
      p_owner_id, p_cost_diamonds, p_reason, v_posting_id, 'job_posting'
    );
    v_diamonds_consumed := (v_consume_result->>'diamond_consumed')::int;
    v_heart_consumed := (v_consume_result->>'heart_consumed')::int;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'posting_id', v_posting_id,
    'diamonds_consumed', v_diamonds_consumed,
    'hearts_consumed', v_heart_consumed,
    'total_consumed', v_diamonds_consumed + v_heart_consumed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, INT, wallet_reason) TO authenticated;

COMMENT ON FUNCTION public.create_job_posting_with_payment_atomically IS
  'jobs 작성 + 차감을 단일 트랜잭션으로. consume RPC가 INSUFFICIENT_BALANCE 던지면 공고 INSERT까지 롤백. tournament(cost=0)는 차감 skip. Spec §6.3 race window 해결 + Decision #11';
```

- [ ] **Step 7.4: MCP 적용 + 테스트 재실행**

Expected: 3/3 PASS.

- [ ] **Step 7.5: 커밋**

```bash
git commit -m "feat(wallet): create_job_posting_with_payment_atomically (race-free wrapper)"
```

---

## Task 8: `refund_job_cancellation_atomically` (24h/50% 비율)

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000700_create_refund_job_cancellation_rpc.sql`
- Create: `uniqn-mobile/src/__tests__/wallet/refundJobCancellation.integration.test.ts`

- [ ] **Step 8.1: 실패 테스트 작성**

```typescript
describe('refund_job_cancellation_atomically', () => {
  beforeEach(resetUser);

  it('24시간 이내 취소 → 100% 환불', async () => {
    // Setup: 공고 생성 + 차감
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 10 });
    const { data: created } = await supa.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: TEST_USER,
      p_posting_payload: { title: 'Recent', type: 'urgent' },
      p_cost_diamonds: 10,
      p_reason: 'consume_job_posting',
    });
    // 잔액 0 확인
    let { data: w } = await supa.from('wallets').select('diamond_balance').eq('user_id', TEST_USER).single();
    expect(w!.diamond_balance).toBe(0);

    // 취소 환불
    const { data: refund } = await supa.rpc('refund_job_cancellation_atomically', {
      p_posting_id: created.posting_id,
      p_owner_id: TEST_USER,
    });
    expect(refund.refunded_diamonds).toBe(10);
    expect(refund.refund_rate).toBe(1.0);

    ({ data: w } = await supa.from('wallets').select('diamond_balance').eq('user_id', TEST_USER).single());
    expect(w!.diamond_balance).toBe(10);
  });

  it('25시간 후 취소 → 50% 환불', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 10 });
    const { data: created } = await supa.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: TEST_USER,
      p_posting_payload: { title: 'Old', type: 'urgent' },
      p_cost_diamonds: 10,
      p_reason: 'consume_job_posting',
    });
    // ledger created_at 백데이트 (테스트용)
    await supa.from('wallet_ledger').update({ created_at: new Date(Date.now() - 25 * 3600000).toISOString() })
      .eq('ref_id', created.posting_id)
      .eq('reason', 'consume_job_posting');

    const { data: refund } = await supa.rpc('refund_job_cancellation_atomically', {
      p_posting_id: created.posting_id,
      p_owner_id: TEST_USER,
    });
    expect(refund.refunded_diamonds).toBe(5); // 10 * 0.5, FLOOR
    expect(refund.refund_rate).toBe(0.5);
  });

  it('이미 환불된 공고 → idempotent', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 10 });
    const { data: created } = await supa.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: TEST_USER,
      p_posting_payload: { title: 'X', type: 'urgent' },
      p_cost_diamonds: 10,
      p_reason: 'consume_job_posting',
    });
    await supa.rpc('refund_job_cancellation_atomically', { p_posting_id: created.posting_id, p_owner_id: TEST_USER });
    const { data: r2 } = await supa.rpc('refund_job_cancellation_atomically', { p_posting_id: created.posting_id, p_owner_id: TEST_USER });
    expect(r2.idempotent).toBe(true);
  });

  it('타인 공고 환불 시도 → unauthorized', async () => {
    await supa.from('wallets').upsert({ user_id: TEST_USER, diamond_balance: 10 });
    const { data: created } = await supa.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: TEST_USER, p_posting_payload: { title: 'Mine', type: 'urgent' },
      p_cost_diamonds: 10, p_reason: 'consume_job_posting',
    });
    const { data: r } = await supa.rpc('refund_job_cancellation_atomically', {
      p_posting_id: created.posting_id,
      p_owner_id: '99999999-9999-9999-9999-999999999999',
    });
    expect(r.success).toBe(false);
    expect(r.error).toBe('unauthorized');
  });
});
```

- [ ] **Step 8.2: 테스트 실패 확인**

```bash
npm test -- src/__tests__/wallet/refundJobCancellation.integration.test.ts
```
Expected: FAIL.

- [ ] **Step 8.3: RPC 마이그레이션 작성**

```sql
-- refund_job_cancellation_atomically: 24h 이내 100% / 이후 50% (FLOOR)
-- Decision #1
-- Spec §11

CREATE OR REPLACE FUNCTION public.refund_job_cancellation_atomically(
  p_posting_id UUID,
  p_owner_id   UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_consume_row     wallet_ledger%ROWTYPE;
  v_existing_refund UUID;
  v_hours_elapsed   NUMERIC;
  v_refund_rate     NUMERIC;
  v_refund_amount   INT;
  v_diamond_amount  INT;
  v_heart_amount    INT;
  v_now             TIMESTAMPTZ := now();
BEGIN
  -- 1. 멱등성: 이미 같은 공고에 refund_job_cancelled row가 있는지
  SELECT id INTO v_existing_refund FROM wallet_ledger
    WHERE ref_id = p_posting_id AND reason = 'refund_job_cancelled'
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 2. 차감 row 조회 (consume_job_posting / extend / upgrade 모두 합산)
  SELECT
    SUM(CASE WHEN currency_type='diamond' THEN -delta ELSE 0 END)::int AS d,
    SUM(CASE WHEN currency_type='heart' THEN -delta ELSE 0 END)::int AS h,
    MIN(created_at) AS first_consume_at
  INTO v_diamond_amount, v_heart_amount, v_consume_row.created_at
  FROM wallet_ledger
  WHERE ref_id = p_posting_id
    AND reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade');

  IF v_diamond_amount IS NULL OR (v_diamond_amount + v_heart_amount) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_consumption_found');
  END IF;

  -- 3. 권한 검증
  IF NOT EXISTS (
    SELECT 1 FROM job_postings WHERE id = p_posting_id AND owner_id = p_owner_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 4. 비율 계산 (Decision #1)
  v_hours_elapsed := EXTRACT(EPOCH FROM (v_now - v_consume_row.created_at)) / 3600;
  v_refund_rate := CASE WHEN v_hours_elapsed < 24 THEN 1.0 ELSE 0.5 END;
  -- 다이아만 환불 (하트는 만료 정책상 환불 어려움 → 다이아 비례 환불)
  v_refund_amount := FLOOR((v_diamond_amount + v_heart_amount) * v_refund_rate)::int;

  -- 5. 환불 ledger row (다이아로 환불, balance는 캐시 후 update)
  INSERT INTO wallet_ledger(
    user_id, currency_type, delta, reason, ref_id, ref_type,
    balance_after_heart, balance_after_diamond,
    metadata
  )
  SELECT p_owner_id, 'diamond', v_refund_amount, 'refund_job_cancelled',
         p_posting_id, 'job_posting',
         w.heart_balance,
         w.diamond_balance + v_refund_amount,
         jsonb_build_object(
           'original_diamond', v_diamond_amount,
           'original_heart', v_heart_amount,
           'refund_rate', v_refund_rate,
           'hours_elapsed', v_hours_elapsed
         )
  FROM wallets w WHERE w.user_id = p_owner_id;

  RETURN jsonb_build_object(
    'success', true,
    'refunded_diamonds', v_refund_amount,
    'refund_rate', v_refund_rate,
    'hours_elapsed', v_hours_elapsed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.refund_job_cancellation_atomically IS
  '공고 취소 환불. 24h 이내 100%, 이후 50% (FLOOR). 하트+다이아 합산을 다이아로 환불. ref_id에 같은 refund row 있으면 idempotent. Decision #1';
```

- [ ] **Step 8.4: MCP 적용 + 테스트 재실행**

Expected: 4/4 PASS.

- [ ] **Step 8.5: 커밋**

```bash
git commit -m "feat(wallet): refund_job_cancellation_atomically (24h 100% / 이후 50%)"
```

---

## Task 9: `diamond_products` 시드

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000800_seed_diamond_products.sql`

- [ ] **Step 9.1: 시드 마이그레이션 작성**

```sql
-- 다이아 충전 패키지 6종
-- BUSINESS_PLAN_2025.md §3.2

INSERT INTO public.diamond_products (product_id, diamonds, bonus_diamonds, price_krw, display_order, active)
VALUES
  ('uniqn_diamonds_1000',   3,   0,   1000, 1, true),
  ('uniqn_diamonds_3000',  10,   0,   3000, 2, true),
  ('uniqn_diamonds_10000', 33,   2,  10000, 3, true),
  ('uniqn_diamonds_30000',100,  10,  30000, 4, true),
  ('uniqn_diamonds_50000',167,  23,  50000, 5, true),
  ('uniqn_diamonds_100000',333, 67, 100000, 6, true)
ON CONFLICT (product_id) DO UPDATE SET
  diamonds       = EXCLUDED.diamonds,
  bonus_diamonds = EXCLUDED.bonus_diamonds,
  price_krw      = EXCLUDED.price_krw,
  display_order  = EXCLUDED.display_order,
  active         = EXCLUDED.active,
  updated_at     = now();
```

- [ ] **Step 9.2: MCP 적용 + 검증**

Apply, then:
```
mcp__supabase__execute_sql({
  query: "SELECT product_id, diamonds, bonus_diamonds, price_krw FROM diamond_products WHERE active = true ORDER BY display_order"
})
```
Expected: 6 rows.

- [ ] **Step 9.3: 커밋**

```bash
git commit -m "feat(wallet): diamond_products 6종 시드"
```

---

## Task 10: `app_config` monetization 시드

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427000900_seed_app_config_monetization.sql`

- [ ] **Step 10.1: 시드 마이그레이션 작성**

```sql
-- Feature Flag: 초기엔 모두 무료, 다이아 충전 UI는 활성화
-- Decision #6 + Spec §7.1

INSERT INTO public.app_config (key, value, updated_at) VALUES
  ('monetization', jsonb_build_object(
    'enabled', true,
    'paid_types', jsonb_build_object(
      'regular', false,
      'urgent', false,
      'fixed', false,
      'tournament', false
    ),
    'rollout_percentage', 0,
    'show_purchase_ui', true,
    'first_purchase_bonus_diamonds', 5
  ), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
```

- [ ] **Step 10.2: 적용 + 검증**

```
mcp__supabase__execute_sql({
  query: "SELECT value FROM app_config WHERE key = 'monetization'"
})
```
Expected: JSONB with enabled=true, all paid_types=false.

- [ ] **Step 10.3: 커밋**

```bash
git commit -m "feat(wallet): app_config monetization 시드 (모두 false 초기값)"
```

---

## Task 11: `heart_lots` 만료 cron

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260427001000_create_heart_expiry_cron.sql`

- [ ] **Step 11.1: 마이그레이션 작성**

```sql
-- 매일 KST 자정에 만료된 hart_lots 처리
-- Decision #3: 알림 없음, 잔량 0 + ledger expire_heart row만
-- Spec §3.4

CREATE OR REPLACE FUNCTION public.fn_expire_heart_lots()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lot         RECORD;
  v_total       INT := 0;
  v_users_count INT := 0;
  v_now         TIMESTAMPTZ := now();
BEGIN
  FOR v_lot IN
    SELECT id, user_id, amount_remaining
    FROM heart_lots
    WHERE amount_remaining > 0 AND expires_at <= v_now
    FOR UPDATE
  LOOP
    -- ledger row 먼저 (캐시 trigger가 wallets 갱신)
    INSERT INTO wallet_ledger(
      user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond, metadata
    )
    SELECT v_lot.user_id, 'heart', -v_lot.amount_remaining, 'expire_heart',
           v_lot.id, 'heart_lot',
           GREATEST(0, w.heart_balance - v_lot.amount_remaining),
           w.diamond_balance,
           jsonb_build_object('expired_at', v_now)
    FROM wallets w WHERE w.user_id = v_lot.user_id;

    UPDATE heart_lots SET amount_remaining = 0 WHERE id = v_lot.id;
    v_total := v_total + v_lot.amount_remaining;
    v_users_count := v_users_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_hearts', v_total,
    'affected_users', v_users_count,
    'run_at', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_expire_heart_lots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_expire_heart_lots() TO service_role;

-- pg_cron: 매일 KST 자정 (UTC 15:00 전일)
-- pg_cron extension은 이미 활성화돼 있을 가능성 높음 (account_maintenance_cron 참고)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire_heart_lots_daily',
      '0 15 * * *',  -- UTC 15:00 = KST 00:00
      $cmd$SELECT public.fn_expire_heart_lots();$cmd$
    );
  END IF;
END $$;
```

- [ ] **Step 11.2: 적용 + 검증**

```
mcp__supabase__execute_sql({
  query: "SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'expire_heart_lots_daily'"
})
```
Expected: 1 row with schedule `0 15 * * *`.

- [ ] **Step 11.3: 함수 동작 직접 검증 (cron 안 기다리고)**

```typescript
// uniqn-mobile/src/__tests__/wallet/heartExpiry.integration.test.ts
it('만료된 lot 처리 → 잔량 0 + ledger row', async () => {
  await resetUser();
  await supa.from('wallets').upsert({ user_id: TEST_USER, heart_balance: 5 });
  await supa.from('heart_lots').insert({
    user_id: TEST_USER, amount_initial: 5, amount_remaining: 5,
    expires_at: new Date(Date.now() - 86400000).toISOString(),
    source: 'grant_signup',
  });

  const { data } = await supa.rpc('fn_expire_heart_lots');
  expect(data.expired_hearts).toBeGreaterThanOrEqual(5);

  const { data: w } = await supa.from('wallets').select('heart_balance').eq('user_id', TEST_USER).single();
  expect(w!.heart_balance).toBe(0);

  const { data: ledger } = await supa.from('wallet_ledger').select('reason')
    .eq('user_id', TEST_USER).eq('reason', 'expire_heart').single();
  expect(ledger!.reason).toBe('expire_heart');
});
```

```bash
npm test -- src/__tests__/wallet/heartExpiry.integration.test.ts
```
Expected: PASS.

- [ ] **Step 11.4: 커밋**

```bash
git commit -m "feat(wallet): hart_lots 만료 cron (KST 자정, 알림 없음)"
```

---

## Task 12: WalletRepository (TypeScript read-only)

**Files:**
- Create: `uniqn-mobile/src/types/wallet.ts`
- Create: `uniqn-mobile/src/repositories/supabase/WalletRepository.ts`
- Create: `uniqn-mobile/src/repositories/supabase/__tests__/WalletRepository.test.ts`

- [ ] **Step 12.1: 타입 정의**

`uniqn-mobile/src/types/wallet.ts`:

```typescript
import { z } from 'zod';

export type WalletCurrency = 'heart' | 'diamond';

export type WalletReason =
  | 'purchase' | 'consume_job_posting' | 'consume_job_extend' | 'consume_job_upgrade'
  | 'refund_purchase' | 'refund_job_cancelled'
  | 'grant_signup' | 'grant_daily_attendance' | 'grant_streak_7d'
  | 'grant_review' | 'grant_referral' | 'grant_admin'
  | 'grant_first_purchase_bonus' | 'expire_heart';

export const WalletSummarySchema = z.object({
  heart_balance: z.number().int().min(0),
  diamond_balance: z.number().int().min(0),
  lifetime_purchased_diamonds: z.number().int().min(0),
  expiring_lots: z.array(z.object({
    lot_id: z.string().uuid(),
    amount_remaining: z.number().int().min(0),
    expires_at: z.string(),
    source: z.string(),
  })),
});
export type WalletSummary = z.infer<typeof WalletSummarySchema>;

export const DiamondProductSchema = z.object({
  product_id: z.string(),
  diamonds: z.number().int().positive(),
  bonus_diamonds: z.number().int().min(0),
  price_krw: z.number().int().positive(),
  display_order: z.number().int(),
  active: z.boolean(),
});
export type DiamondProduct = z.infer<typeof DiamondProductSchema>;
```

- [ ] **Step 12.2: 실패 테스트 작성**

`uniqn-mobile/src/repositories/supabase/__tests__/WalletRepository.test.ts`:

```typescript
import { WalletRepository } from '../WalletRepository';
import { supa } from '@/lib/supabase';

describe('WalletRepository', () => {
  it('getSummary — 빈 지갑 → 0', async () => {
    const summary = await WalletRepository.getSummary('00000000-0000-0000-0000-000000000099');
    expect(summary.heart_balance).toBe(0);
    expect(summary.diamond_balance).toBe(0);
    expect(summary.expiring_lots).toEqual([]);
  });

  it('listProducts — 6개 활성 상품', async () => {
    const products = await WalletRepository.listProducts();
    expect(products).toHaveLength(6);
    expect(products[0].display_order).toBeLessThan(products[5].display_order);
  });
});
```

- [ ] **Step 12.3: 테스트 실패 확인**

```bash
npm test -- src/repositories/supabase/__tests__/WalletRepository.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 12.4: WalletRepository 구현**

`uniqn-mobile/src/repositories/supabase/WalletRepository.ts`:

```typescript
import { supa } from '@/lib/supabase';
import {
  WalletSummary, WalletSummarySchema,
  DiamondProduct, DiamondProductSchema,
} from '@/types/wallet';
import { logger } from '@/shared/logger';

export const WalletRepository = {
  async getSummary(userId?: string): Promise<WalletSummary> {
    const { data, error } = await supa.rpc('get_wallet_summary', { p_user_id: userId ?? null });
    if (error) {
      logger.error('wallet.getSummary.failed', error);
      throw error;
    }
    return WalletSummarySchema.parse(data);
  },

  async listProducts(): Promise<DiamondProduct[]> {
    const { data, error } = await supa
      .from('diamond_products')
      .select('product_id, diamonds, bonus_diamonds, price_krw, display_order, active')
      .eq('active', true)
      .order('display_order', { ascending: true });
    if (error) {
      logger.error('wallet.listProducts.failed', error);
      throw error;
    }
    return (data ?? []).map((row) => DiamondProductSchema.parse(row));
  },
};
```

- [ ] **Step 12.5: 테스트 통과 확인**

```bash
npm test -- src/repositories/supabase/__tests__/WalletRepository.test.ts
```
Expected: 2/2 PASS.

- [ ] **Step 12.6: TypeScript 타입 재생성 + 빌드 검증**

```bash
cd uniqn-mobile
npm run quality
```
Expected: type-check + lint + format 모두 통과.

- [ ] **Step 12.7: 커밋**

```bash
git add uniqn-mobile/src/types/wallet.ts uniqn-mobile/src/repositories/supabase/WalletRepository.ts uniqn-mobile/src/repositories/supabase/__tests__/
git commit -m "feat(wallet): WalletRepository + types + Zod schemas (read-only)"
```

---

## Task 13: 종합 통합 시나리오 + Phase 1 종료 체크

**Files:**
- Create: `uniqn-mobile/src/__tests__/wallet/walletEndToEnd.integration.test.ts`

- [ ] **Step 13.1: E2E 시나리오 테스트**

```typescript
describe('Wallet E2E — signup → purchase → consume → refund', () => {
  beforeEach(resetUser);

  it('전체 흐름', async () => {
    // 1. Signup +10💖
    await supa.rpc('grant_heart_atomically', {
      p_user_id: TEST_USER, p_amount: 10, p_reason: 'grant_signup',
      p_source_ref_id: null, p_expires_in_days: 90,
    });
    let s = await supa.rpc('get_wallet_summary', { p_user_id: TEST_USER });
    expect(s.data.heart_balance).toBe(10);

    // 2. 첫 충전 33💎 → +5💎 보너스
    await supa.rpc('credit_diamonds_atomically', {
      p_user_id: TEST_USER, p_diamonds: 33,
      p_revenuecat_transaction_id: 'rc_e2e_001',
      p_product_id: 'uniqn_diamonds_10000',
    });
    s = await supa.rpc('get_wallet_summary', { p_user_id: TEST_USER });
    expect(s.data.diamond_balance).toBe(38); // 33 + 5

    // 3. urgent 공고 작성 (10💎 차감, 하트 우선 → 하트 10 + 다이아 0)
    const { data: created } = await supa.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: TEST_USER,
      p_posting_payload: { title: 'E2E Test', type: 'urgent' },
      p_cost_diamonds: 10,
      p_reason: 'consume_job_posting',
    });
    s = await supa.rpc('get_wallet_summary', { p_user_id: TEST_USER });
    expect(s.data.heart_balance).toBe(0);
    expect(s.data.diamond_balance).toBe(38); // 다이아 손대지 않음

    // 4. 24h 내 취소 환불
    const { data: refund } = await supa.rpc('refund_job_cancellation_atomically', {
      p_posting_id: created.posting_id, p_owner_id: TEST_USER,
    });
    expect(refund.refunded_diamonds).toBe(10); // 100%
    s = await supa.rpc('get_wallet_summary', { p_user_id: TEST_USER });
    expect(s.data.diamond_balance).toBe(48); // 38 + 10 (다이아로 환불)
    expect(s.data.heart_balance).toBe(0);    // 하트는 환불 안 됨 (정책)
  });
});
```

- [ ] **Step 13.2: 실행**

```bash
npm test -- src/__tests__/wallet/
```
Expected: 모든 wallet 테스트 PASS.

- [ ] **Step 13.3: Supabase advisor 종합 검증**

```
mcp__supabase__get_advisors({ type: "security" })
mcp__supabase__get_advisors({ type: "performance" })
```
Expected: wallet 관련 신규 critical/high 이슈 없음.

- [ ] **Step 13.4: 마이그레이션 파일 동기화 확인**

```bash
ls -la uniqn-mobile/supabase/migrations/2026042700*.sql
```
Expected: 11개 파일 (000000 ~ 001000).

- [ ] **Step 13.5: 종료 커밋**

```bash
git commit --allow-empty -m "feat(wallet): Phase 1 DB Foundation 완료 — 11 migrations + 5 RPC + 4 테스트 파일"
```

- [ ] **Step 13.6: Phase 1 종료 체크리스트 (수동 검증)**

| 검증 항목 | 명령 | 기대 |
|---|---|---|
| 4 테이블 존재 | `mcp__supabase__list_tables` | wallets/wallet_ledger/heart_lots/diamond_products |
| 14 enum 값 | `pg_enum` 쿼리 | wallet_reason 14개 |
| 5 RPC 작동 | `pg_proc` 쿼리 | consume/credit/grant/get_summary/create_with_payment/refund |
| trigger 1개 | `pg_trigger` | tr_wallet_ledger_update_balance |
| cron 1개 | `cron.job` | expire_heart_lots_daily |
| 6 product 시드 | SELECT | uniqn_diamonds_* 6개 |
| app_config | SELECT | monetization key 1개 |
| RLS 활성 | `pg_tables.rowsecurity` | 4 테이블 모두 true |
| Phase 1 테스트 | `npm test -- wallet` | 모든 테스트 PASS |

---

## Phase 1 Self-Review

### Spec Coverage
- §3.1 diamond_products → Task 1, 9 ✅
- §3.2 wallet_ledger → Task 1 ✅
- §3.3 wallets → Task 1 ✅
- §3.4 heart_lots + KST cron → Task 1, 11 ✅
- §3.5 RLS → Task 2 ✅
- §4.1 consume_diamonds → Task 4 ✅
- §4.2 credit_diamonds + 첫충전 보너스 → Task 5 ✅
- §4.3 grant_heart + get_wallet_summary → Task 6 ✅
- §4.4 cache trigger → Task 3 ✅
- §6.3 race-free wrapper → Task 7 ✅
- §11 Decision #1 환불 → Task 8 ✅
- §11 Decision #11 tournament=0 → Task 7 (cost_diamonds=0 케이스) ✅
- 클라이언트 Repository (read-only 부분) → Task 12 ✅
- E2E 검증 → Task 13 ✅

### Out of Scope (후속 plan으로)
- §5 RevenueCat Webhook Edge Function → Phase 2
- §6.1, 6.2 클라이언트 SDK + UI 컴포넌트 → Phase 3
- §6.3 jobManagementService 통합 → Phase 4 (단, RPC는 Task 7에서 준비 완료)
- §7 Feature Flag rollout 활성화 → Phase 6 (시드는 Task 10에서 false로 준비)
- §8 STRIDE 위협 대응 (보안 검증) → Phase 7
- §10 모니터링/대시보드 → Phase 7

### 발견된 문제 + 수정
- 없음. Type 일관성 OK (currency_type: WalletCurrency, reason: WalletReason).

---

## Execution Handoff

Plan 작성 완료, 저장: `docs/superpowers/plans/2026-04-26-monetization.md`

**Phase 1 (DB Foundation)만 13개 task로 분해됨.** 추정 작업 시간: 8~12시간 (TDD + 디버깅 포함).

**두 가지 실행 옵션:**

1. **Subagent-Driven (권장)**
   - 각 task를 fresh subagent에게 위임 → 본 에이전트는 task 사이 review만
   - 빠른 iteration, 본 컨텍스트 보존
   - REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`

2. **Inline Execution**
   - 본 세션에서 task 1부터 순차 실행, checkpoint마다 일시정지
   - 단일 컨텍스트, 더 디버깅 친화적
   - REQUIRED SUB-SKILL: `superpowers:executing-plans`

**선택해주세요.**

---

## Future Plans (Phase 2~7)

Phase 1 완료 후 다음 plan들을 별도로 작성:

| Phase | 범위 | 예상 task 수 | 의존성 |
|---|---|---|---|
| 2 | RevenueCat Webhook Edge Function + RC 계정 설정 | ~8 | Phase 1 완료 |
| 3 | 클라이언트 SDK 통합 + Wallet UI (BalanceBadge, PurchaseSheet, PaywallModal) | ~15 | Phase 1, 2 |
| 4 | jobManagementService 통합 (다이아 차감 hook + Tournament 처리) | ~6 | Phase 1, 3 |
| 5 | 하트 적립 흐름 (signup/daily/streak/review/referral 모두) | ~10 | Phase 1, 3 |
| 6 | Feature Flag rollout 단계적 활성화 (10→50→100%) | ~4 | Phase 1~5 |
| 7 | 환불 통합 (cancel_application + refund 연결) + 모니터링 대시보드 | ~8 | Phase 1, 4 |

총 추정: ~64 task, 6주 작업.
