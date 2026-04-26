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
