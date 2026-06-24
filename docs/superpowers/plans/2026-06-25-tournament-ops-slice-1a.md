# T-HOLDEM Ops — Slice 1a Implementation Plan (Digital Registration Desk + Event Spine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the leanest live-tournament ops engine slice — `ops_tournaments` (config columns inert) + `ops_participants` (entry# allocation, status guard, rebuy/add-on) + `ops_events` (append-only audit spine), a tournament list/picker, a PLAYERS tab, a STATUS partial-stats tab, `toggle_registration`, and the uniqn→ops bridge button — inside the existing `uniqn-mobile` monorepo under a new `(ops)` route group.

**Architecture:** Presentation → Hooks → Service → Repository → Supabase, mirroring uniqn conventions. All ops mutations are SECURITY DEFINER Postgres RPCs (actor-bound to `auth.uid()`, anon-revoked) that also append exactly one `ops_events` row; ops tables expose SELECT-only RLS (`owner_id = auth.uid() OR is_workspace_member(...)` via `is_ops_member`), with direct INSERT/UPDATE/DELETE revoked so there is no raw-write path. STATUS partial stats are computed **client-side** by a pure domain function over the participants list (no `ops_live_stats` table — that is slice 1c-2).

**Tech Stack:** Expo 55 / RN 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / Supabase (Postgres + RLS + RPC) / TanStack Query / Zod. Tests: Jest (pure domain), pgTAP (RLS/RPC/append-only/constraints), Playwright (e2e, out of 1a scope).

## Global Constraints

- Work dir `uniqn-mobile/`. `@/` alias imports only (never relative-deep or OS-absolute paths).
- Layering is a hard rule: Presentation/Hooks NEVER import `supabase`. Reads MAY call a Repository directly (TanStack read-only exception); writes go Service → Repository → RPC. Only Repositories touch the client.
- Supabase client = `import { supabase } from '@/lib/supabase'`; helpers = `import { handleSupabaseError, toCamelCase, runRpc } from '@/utils/supabase'` (different path). Logger = `import { logger } from '@/utils/logger'` (NO `console.log` in app runtime; `functions/**` exempt). Toast = `@/stores/toastStore`. Errors = `@/errors`.
- camelCase in app, snake_case in DB; mapping in the Repository via `toCamelCase`. RPC params are snake_case `p_*`.
- Every user-supplied string field: `z.string().trim().min().max().refine(xssValidation, {...})` from `@/utils/security`.
- Dark mode: every surface/text className carries a static `dark:` variant (no interpolated `dark:` classes).
- Atomic multi-write = ONE Supabase SECDEF RPC. There is NO JS `runTransaction` helper.
- Migrations applied to PROD via MCP `mcp__supabase__apply_migration` ONLY (never `supabase db push`). Local dev/test: `npm run db:reset` + `npm run test:db`. TS types regenerated via MCP `mcp__supabase__generate_typescript_types` → overwrite `src/types/supabase.ts`.
- **PROD Supabase is SHARED.** Applying any migration to prod, `git push`, opening a PR, and EAS/OTA are explicit approval gates — NOT performed autonomously. All TDD runs against the LOCAL Docker Supabase stack.
- Files 200–400 lines typical (800 max). Immutability (spread, never mutate). Commit convention `feat(ops): <한글>`.
- Namespace `ops_*` (kept separate from uniqn `tournament` = job-posting domain). FK `owner_id`/`*_user_id` → `public.users(id)`.

## Pinned Scope Decisions (resolved during design review — DO NOT re-litigate)

- **D1 — Real Postgres ENUMS** (`ops_tournament_status`, `ops_participant_status`, `ops_event_type`), not TEXT CHECK, so the enum-SSOT convention (`z.enum(Constants.public.Enums.*)`) holds. Mirrors `posting_status`/`payroll_status`.
- **D2 — Walk-in registration only → status `active`.** `no_show` + CSV pre-registration + check-in desk flow (`registered`/`checked_in`) are DEFERRED together to a later slice. The `registered`/`checked_in`/`no_show`/`busted` enum values still exist (inert/reserved).
- **D3 — All ops mutations are SECDEF RPCs**; ops tables are SELECT-only via RLS, direct DML REVOKEd. This is the "raw status UPDATE 거부" mechanism.
- **D4 — entry# allocation** via `FOR UPDATE` on `ops_tournaments.next_entry_seq`. pgTAP proves uniqueness (23505 on dup) + sequential monotonic allocation; true concurrency is a code-review concern, not pgTAP.
- **D5 — No Mock repositories** (only `interfaces/` + `supabase/`).
- **D6 — STATUS partial stats computed client-side** by a pure domain function: exactly `playing, entries, totalChips, averageStack, prizePool`. No `ops_live_stats` table in 1a.
- **D7 — chips on registration = `ops_tournaments.starting_chips`**; `buy_in_amount` records cash; cost config columns drive `prizePool` (NOT inert in 1a).
- **D8 — `claim_token`/`player_user_id` never read to client in 1a**; `monitor_token` left NULL. Repository read column lists omit `claim_token`.

## Task Index & Dependency Order

`T1 → T2 → (T3, T4 in parallel) → T5 → T6 → T7 → T8 → T9`; `T10` after `T2`. Each task ends with the relevant gate (`npm run quality` / `npm test` / `npm run test:db`) and a `feat(ops): …` commit.

| Task | Deliverable | Gate |
|---|---|---|
| **T1** | DB foundation — 3 enums, 3 tables, indexes, updated_at + append-only triggers, `is_ops_member`, SELECT-only RLS + table-DML REVOKE | `db:reset` + psql smoke |
| **T2** | DB RPCs (7) + grants DO-loop + Realtime publication ADD + TS type regen | `db:reset` + psql smoke |
| **T3** | Pure domain — `OpsParticipantStatusMachine` + `opsStats` | `npm test` |
| **T4** | Types + Zod schemas + Errors (E61xx) | `npm test` / `quality` |
| **T5** | Repositories (interfaces + impls + barrels + `mapOpsRpcError`) | `quality` |
| **T6** | Services (tournament + participant) | `npm test` |
| **T7** | Hooks + queryKeys `ops` namespace | `quality` |
| **T8** | UI — `(ops)` route group, list/picker, create, detail tabs (PLAYERS/STATUS), components, root registration | `quality` |
| **T9** | Bridge — `EXPO_PUBLIC_OPS_URL` + `OPS_BASE_URL` + Live Ops ActionCard | `quality` |
| **T10** | pgTAP — `ops_helpers` fixture + RLS / RPC-security / append-only / entry# tests | `npm run test:db` |

> Tasks below were authored against a locked contract (`ops-1a-contracts.md`) and real codebase exemplars. Type names, RPC signatures, file paths, and error codes are consistent across tasks by construction.

---
### Task T1: DB Foundation — ops enums, tables, indexes, updated_at + append-only triggers, is_ops_member, SELECT-only RLS + table-DML REVOKE

> Run ALL commands from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`.
> Migrations are applied to **local only** here via `npm run db:reset`. **PROD apply is a later approval gate** — done via MCP `mcp__supabase__apply_migration` ONLY, never `supabase db push`, and NOT in this task.
> Full pgTAP coverage (RLS visibility, append-only throws_ok, entry-number allocation) lands in **T10** — this task ships the migration SQL plus a minimal psql smoke assertion. Do NOT duplicate pgTAP here.
> Idioms are copied verbatim from the workspace migrations (`20260430010000_workspace_create_tables.sql`, `20260430010300_workspace_membership_function.sql`, `20260430010400_workspace_rls_policies.sql`) and the wallet DML-revoke defense (`20260605000010_wallet_dml_revoke_defense.sql`). `public.is_admin()` and `public.is_workspace_member(uuid,uuid)` already exist in this DB (base schema + workspace migrations) — reference them, do not redefine.

**Files:**
- Create: `supabase/migrations/20260625120000_ops_1a_enums_and_tables.sql` (enums + 3 tables + indexes + updated_at triggers + ops_events append-only trigger + ENABLE/FORCE RLS)
- Create: `supabase/migrations/20260625120100_ops_1a_rls_and_membership.sql` (`is_ops_member` helper + SELECT-only RLS policies + table-DML REVOKE)
- Test: `supabase/tests/ops_tables_rls.test.sql`, `supabase/tests/ops_events_append_only.test.sql` (authored in **T10**, not here — listed for traceability only)

**Interfaces:**
- Consumes (already in DB, do NOT create):
  - `public.is_admin() RETURNS boolean` (base schema `20260409000000_base_schema.sql`)
  - `public.is_workspace_member(_workspace_id uuid, _user_id uuid) RETURNS boolean` (`20260430010300_workspace_membership_function.sql`)
  - `public.users(id)`, `public.job_postings(id, workspace_id)`, `gen_random_uuid()`, `supabase_realtime` publication
- Produces (later tasks rely on these EXACT names):
  - Enums: `public.ops_tournament_status`, `public.ops_participant_status`, `public.ops_event_type` (T2 RPCs, T4 `Constants.public.Enums.*` SSOT)
  - Tables: `public.ops_tournaments`, `public.ops_participants`, `public.ops_events` (T2 RPCs INSERT/UPDATE these; T5 repos SELECT these)
  - Function: `public.is_ops_member(_tournament_id uuid, _user_id uuid) RETURNS boolean` (T2 RPC authz guards + T1 RLS policies)
  - Trigger functions: `public.fn_ops_set_updated_at()`, `public.fn_ops_events_append_only()`
  - Column `ops_tournaments.next_entry_seq int` (T2 `ops_register_participant` allocator) and `ops_participants` UNIQUE(tournament_id, entry_number) (T10 D4 race test)

---

- [ ] **Step 1 (RED): Confirm the ops tables do NOT exist on a clean local stack.**
  Ensures the local Supabase Docker stack is up, then proves the relations are absent (so Step 5's smoke is a real green, not a pre-existing artifact).
  ```bash
  npm run db:status   # if "supabase local development setup is running" → ok; else: npm run db:start
  docker exec supabase_db_uniqn psql -U postgres -d postgres -c "\d public.ops_tournaments"
  ```
  Expected: FAIL — psql prints `Did not find any relation named "public.ops_tournaments".`

- [ ] **Step 2 (impl): Write the enums + tables + triggers migration.**
  Create `supabase/migrations/20260625120000_ops_1a_enums_and_tables.sql` with the COMPLETE content below. Enum guards use the `DO $$ IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname=...) $$` idiom; tables use `CREATE TABLE IF NOT EXISTS`; trigger functions are `CREATE OR REPLACE` SECDEF with `SET search_path = public, pg_temp` (mirrors `fn_workspaces_set_updated_at`). ENABLE + FORCE RLS live here next to each table (mirrors the workspace tables migration).
  ```sql
  -- 라이브 운영(ops) 1a — enum 3종 + ops_tournaments/ops_participants/ops_events 테이블
  -- Decisions: D1 (real pg ENUM, not TEXT CHECK), D3 (SELECT-only RLS — DML은 T2 SECDEF RPC 전용),
  --            ops_events append-only (REVOKE + BEFORE UPDATE/DELETE 트리거 둘 다).
  -- Idiom 출처: 20260430010000_workspace_create_tables.sql (CREATE TABLE IF NOT EXISTS, ENABLE/FORCE RLS,
  --            fn_workspaces_set_updated_at SECDEF updated_at 트리거).
  -- additive — 기존 데이터 영향 없음.

  -- ========================================
  -- 1. ENUMS (§3 — full forward set; 후속 슬라이스에서 ALTER TYPE 불필요)
  -- ========================================
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_tournament_status') THEN
      CREATE TYPE public.ops_tournament_status AS ENUM ('upcoming', 'active', 'completed');
    END IF;
  END$$;

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_participant_status') THEN
      CREATE TYPE public.ops_participant_status AS ENUM ('registered', 'checked_in', 'active', 'busted', 'no_show');
    END IF;
  END$$;

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_event_type') THEN
      CREATE TYPE public.ops_event_type AS ENUM (
        'tournament_created', 'tournament_status_changed', 'registration_toggled',
        'player_registered', 'player_checked_in', 'player_rebuy', 'player_addon',
        'player_busted', 'player_reentered', 'player_moved', 'seat_freed',
        'table_added', 'table_closed', 'table_redraw', 'prize_assigned',
        'level_play', 'level_pause', 'level_set'
      );
    END IF;
  END$$;

  -- ========================================
  -- 2. updated_at 트리거 함수 (ops_tournaments / ops_participants 공용)
  -- ========================================
  CREATE OR REPLACE FUNCTION public.fn_ops_set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  BEGIN
    NEW.updated_at := now();
    RETURN NEW;
  END;
  $$;

  -- ========================================
  -- 3. ops_tournaments (§4)
  -- ========================================
  CREATE TABLE IF NOT EXISTS public.ops_tournaments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
    name text NOT NULL,
    venue text,
    event_date date,
    game_type text NOT NULL DEFAULT 'NLH',
    status public.ops_tournament_status NOT NULL DEFAULT 'upcoming',
    seats_per_table int NOT NULL DEFAULT 9,
    starting_chips int NOT NULL DEFAULT 0,
    color text,
    buy_in_chips int NOT NULL DEFAULT 0,
    rebuy_chips int NOT NULL DEFAULT 0,
    addon_chips int NOT NULL DEFAULT 0,
    buy_in_cost int NOT NULL DEFAULT 0,
    fee_cost int NOT NULL DEFAULT 0,
    rebuy_cost int NOT NULL DEFAULT 0,
    addon_cost int NOT NULL DEFAULT 0,
    bounty_cost int,
    registration_open boolean NOT NULL DEFAULT true,
    auto_seat_on_register boolean NOT NULL DEFAULT true,
    reentry_allowed boolean NOT NULL DEFAULT true,
    max_reentries int,
    monitor_token text UNIQUE,
    next_entry_seq int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ops_tournaments_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
    CONSTRAINT ops_tournaments_seats_range CHECK (seats_per_table BETWEEN 2 AND 11),
    CONSTRAINT ops_tournaments_starting_chips_nonneg CHECK (starting_chips >= 0)
  );

  COMMENT ON TABLE public.ops_tournaments IS '라이브 운영 대회. owner OR 연결 공고 워크스페이스 멤버만 SELECT. 쓰기는 T2 SECDEF RPC 전용.';
  COMMENT ON COLUMN public.ops_tournaments.next_entry_seq IS '엔트리 번호 할당자. ops_register_participant 가 +1 후 UPDATE (FOR UPDATE 직렬화).';

  ALTER TABLE public.ops_tournaments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ops_tournaments FORCE ROW LEVEL SECURITY;

  CREATE INDEX IF NOT EXISTS idx_ops_tournaments_owner_id
    ON public.ops_tournaments (owner_id);
  CREATE INDEX IF NOT EXISTS idx_ops_tournaments_job_posting_id
    ON public.ops_tournaments (job_posting_id)
    WHERE job_posting_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_ops_tournaments_status
    ON public.ops_tournaments (status);

  DROP TRIGGER IF EXISTS trg_ops_tournaments_set_updated_at ON public.ops_tournaments;
  CREATE TRIGGER trg_ops_tournaments_set_updated_at
    BEFORE UPDATE ON public.ops_tournaments
    FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

  -- ========================================
  -- 4. ops_participants (§4 — seat 컬럼 없음, 좌석은 1b)
  -- ========================================
  CREATE TABLE IF NOT EXISTS public.ops_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
    entry_number int NOT NULL,
    name text NOT NULL,
    nationality text,
    phone text,
    player_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    claim_token text UNIQUE,
    status public.ops_participant_status NOT NULL DEFAULT 'registered',
    chips int NOT NULL DEFAULT 0,
    buy_in_amount int,
    rebuys int NOT NULL DEFAULT 0,
    add_ons int NOT NULL DEFAULT 0,
    reentries int NOT NULL DEFAULT 0,
    finish_position int,
    busted_at timestamptz,
    prize_amount int,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ops_participants_entry_unique UNIQUE (tournament_id, entry_number),
    CONSTRAINT ops_participants_name_length CHECK (char_length(name) BETWEEN 1 AND 50),
    CONSTRAINT ops_participants_chips_nonneg CHECK (chips >= 0),
    CONSTRAINT ops_participants_rebuys_nonneg CHECK (rebuys >= 0),
    CONSTRAINT ops_participants_addons_nonneg CHECK (add_ons >= 0),
    CONSTRAINT ops_participants_reentries_nonneg CHECK (reentries >= 0)
  );

  COMMENT ON TABLE public.ops_participants IS '대회 참가자(엔트리). entry_number 는 tournament 내 1부터 gap-free. 쓰기는 T2 SECDEF RPC 전용.';

  ALTER TABLE public.ops_participants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ops_participants FORCE ROW LEVEL SECURITY;

  -- 등수 중복 방지 — 배정된 경우에만 (partial unique, workspace_invitations pending 유니크 idiom)
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_ops_participants_finish_position
    ON public.ops_participants (tournament_id, finish_position)
    WHERE finish_position IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_ops_participants_tournament_status
    ON public.ops_participants (tournament_id, status);
  CREATE INDEX IF NOT EXISTS idx_ops_participants_tournament_finish
    ON public.ops_participants (tournament_id, finish_position);

  DROP TRIGGER IF EXISTS trg_ops_participants_set_updated_at ON public.ops_participants;
  CREATE TRIGGER trg_ops_participants_set_updated_at
    BEFORE UPDATE ON public.ops_participants
    FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

  -- ========================================
  -- 5. ops_events (§4 — append-only)
  -- ========================================
  CREATE TABLE IF NOT EXISTS public.ops_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
    type public.ops_event_type NOT NULL,
    actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    actor_device text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  COMMENT ON TABLE public.ops_events IS 'Append-only 이벤트 로그. UPDATE/DELETE 금지(트리거 RAISE + REVOKE). Realtime publication 미등록.';

  ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ops_events FORCE ROW LEVEL SECURITY;

  CREATE INDEX IF NOT EXISTS idx_ops_events_tournament_created
    ON public.ops_events (tournament_id, created_at DESC);

  -- Append-only 강제 (a) — BEFORE UPDATE OR DELETE 트리거 RAISE
  CREATE OR REPLACE FUNCTION public.fn_ops_events_append_only()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  BEGIN
    RAISE EXCEPTION 'OPS_EVENTS_APPEND_ONLY: ops_events 는 append-only — % 불가', TG_OP
      USING ERRCODE = 'P0001';
  END;
  $$;

  DROP TRIGGER IF EXISTS trg_ops_events_append_only ON public.ops_events;
  CREATE TRIGGER trg_ops_events_append_only
    BEFORE UPDATE OR DELETE ON public.ops_events
    FOR EACH ROW EXECUTE FUNCTION public.fn_ops_events_append_only();
  ```

- [ ] **Step 3 (impl): Write the is_ops_member helper + SELECT-only RLS + table-DML REVOKE migration.**
  Create `supabase/migrations/20260625120100_ops_1a_rls_and_membership.sql` with the COMPLETE content below. `is_ops_member` mirrors `is_workspace_member` (SQL SECDEF STABLE, `search_path = public, pg_temp`). RLS policies use `DROP POLICY IF EXISTS` before `CREATE POLICY` and the `(SELECT auth.uid())` / `(SELECT public.is_admin())` subquery-wrapped idiom (initplan-cached) from `20260430010400_workspace_rls_policies.sql`. The REVOKE mirrors `20260605000010_wallet_dml_revoke_defense.sql`. There are NO INSERT/UPDATE/DELETE policies — D3.
  ```sql
  -- 라이브 운영(ops) 1a — is_ops_member 멤버십 함수 + SELECT-only RLS + 테이블 DML REVOKE
  -- D3: ops 테이블은 SELECT-only RLS. INSERT/UPDATE/DELETE 는 REVOKE → T2 SECDEF RPC 만 쓰기.
  -- Idiom 출처: 20260430010300 (is_workspace_member SECDEF), 20260430010400 (DROP/CREATE POLICY + (SELECT auth.uid())),
  --            20260605000010 (테이블 DML REVOKE 방어심층).

  -- ========================================
  -- 1. is_ops_member — 멤버십 단일 진실 (owner OR 연결 공고 워크스페이스 멤버)
  -- ========================================
  CREATE OR REPLACE FUNCTION public.is_ops_member(_tournament_id uuid, _user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  STABLE
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.ops_tournaments t
      WHERE t.id = _tournament_id
        AND (
          t.owner_id = _user_id
          OR (
            t.job_posting_id IS NOT NULL
            AND public.is_workspace_member(
              (SELECT jp.workspace_id FROM public.job_postings jp WHERE jp.id = t.job_posting_id),
              _user_id
            )
          )
        )
    );
  $$;

  COMMENT ON FUNCTION public.is_ops_member IS
    'ops 멤버십 단일 진실 — owner OR 연결 공고 워크스페이스 멤버. RLS 정책 + RPC authz 핫패스.';

  REVOKE EXECUTE ON FUNCTION public.is_ops_member(uuid, uuid) FROM anon, public;
  GRANT EXECUTE ON FUNCTION public.is_ops_member(uuid, uuid) TO authenticated;

  -- ========================================
  -- 2. SELECT-only RLS 정책 (3 테이블)
  -- ========================================
  DROP POLICY IF EXISTS ops_tournaments_select_member ON public.ops_tournaments;
  CREATE POLICY ops_tournaments_select_member
    ON public.ops_tournaments FOR SELECT TO authenticated
    USING (
      public.is_ops_member(id, (SELECT auth.uid()))
      OR (SELECT public.is_admin())
    );

  DROP POLICY IF EXISTS ops_participants_select_member ON public.ops_participants;
  CREATE POLICY ops_participants_select_member
    ON public.ops_participants FOR SELECT TO authenticated
    USING (
      public.is_ops_member(tournament_id, (SELECT auth.uid()))
      OR (SELECT public.is_admin())
    );

  DROP POLICY IF EXISTS ops_events_select_member ON public.ops_events;
  CREATE POLICY ops_events_select_member
    ON public.ops_events FOR SELECT TO authenticated
    USING (
      public.is_ops_member(tournament_id, (SELECT auth.uid()))
      OR (SELECT public.is_admin())
    );

  -- ========================================
  -- 3. 테이블 DML REVOKE (방어심층 — 쓰기 정책 회귀 시에도 직접 write 불가)
  -- ========================================
  REVOKE INSERT, UPDATE, DELETE ON public.ops_tournaments FROM anon, authenticated;
  REVOKE INSERT, UPDATE, DELETE ON public.ops_participants FROM anon, authenticated;
  REVOKE INSERT, UPDATE, DELETE ON public.ops_events       FROM anon, authenticated;
  ```

- [ ] **Step 4 (apply locally): Reset the local DB so both new migrations run.**
  ```bash
  npm run db:reset
  ```
  Expected: PASS — output ends with `Applying migration 20260625120000_ops_1a_enums_and_tables.sql...`, `Applying migration 20260625120100_ops_1a_rls_and_membership.sql...`, then `Finished supabase db reset.` with NO `ERROR:` lines. (If an `ERROR:` appears, read it, fix the offending migration file, re-run — do not proceed.)

- [ ] **Step 5 (smoke — structure + RLS + grants exist): psql assertions prove tables/enums/RLS/REVOKE landed.**
  ```bash
  docker exec supabase_db_uniqn psql -U postgres -d postgres -c "\d+ public.ops_tournaments"
  docker exec supabase_db_uniqn psql -U postgres -d postgres -c \
    "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ops_participant_status' ORDER BY e.enumsortorder;"
  docker exec supabase_db_uniqn psql -U postgres -d postgres -c \
    "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('ops_tournaments','ops_participants','ops_events') ORDER BY relname;"
  docker exec supabase_db_uniqn psql -U postgres -d postgres -c \
    "SELECT has_table_privilege('authenticated','public.ops_events','INSERT') AS auth_insert, has_table_privilege('authenticated','public.ops_tournaments','SELECT') AS auth_select;"
  ```
  Expected: PASS —
  - `\d+ public.ops_tournaments` lists all §4 columns (incl. `next_entry_seq`, `status` of type `ops_tournament_status`) and shows `Triggers: trg_ops_tournaments_set_updated_at BEFORE UPDATE` plus the 3 indexes; footer shows RLS enabled.
  - enum query returns 5 rows in order: `registered, checked_in, active, busted, no_show`.
  - rowsecurity query: all three rows show `t | t` (RLS enabled AND forced).
  - privilege query: `auth_insert = f` (REVOKE worked), `auth_select = t` (SELECT preserved).

- [ ] **Step 6 (smoke — append-only trigger fires): direct UPDATE/DELETE on ops_events RAISEs.**
  Insert one tournament + one event as the `postgres` superuser (bypasses RLS/REVOKE), then attempt a direct UPDATE — the BEFORE trigger must reject it.
  ```bash
  docker exec supabase_db_uniqn psql -U postgres -d postgres <<'SQL'
  DO $$
  DECLARE v_owner uuid; v_tid uuid;
  BEGIN
    SELECT id INTO v_owner FROM public.users LIMIT 1;
    INSERT INTO public.ops_tournaments (owner_id, name) VALUES (v_owner, 'SMOKE T1') RETURNING id INTO v_tid;
    INSERT INTO public.ops_events (tournament_id, type, payload)
      VALUES (v_tid, 'tournament_created', '{"smoke":true}'::jsonb);
  END$$;
  -- 아래 UPDATE 는 반드시 OPS_EVENTS_APPEND_ONLY 로 실패해야 함
  UPDATE public.ops_events SET actor_device = 'hack' WHERE type = 'tournament_created';
  SQL
  ```
  Expected: PASS (failure is the success signal) — the DO block succeeds (`DO`), then the UPDATE prints:
  `ERROR:  OPS_EVENTS_APPEND_ONLY: ops_events 는 append-only — UPDATE 불가`
  (Optional cleanup, not required since this is throwaway local data: `DELETE` is also blocked by the same trigger, so leave the smoke row in place; the next `npm run db:reset` wipes it.)

- [ ] **Step 7 (commit): Stage both migrations and commit.**
  ```bash
  git add supabase/migrations/20260625120000_ops_1a_enums_and_tables.sql supabase/migrations/20260625120100_ops_1a_rls_and_membership.sql
  git commit -m "feat(ops): 1a DB 기반 — ops enum 3종·테이블 3개·is_ops_member·SELECT-only RLS·append-only 트리거"
  ```
  Expected: PASS — commit created on branch `feat/tournament-ops-revival`. **Do NOT push and do NOT apply to PROD** — PROD apply via MCP `mcp__supabase__apply_migration` is a separate later approval gate.

---

**Hand-off notes for downstream tasks:**
- T2 (RPCs) consumes `public.is_ops_member`, the 3 enums, `ops_tournaments.next_entry_seq`, and the `ops_participants` UNIQUE(tournament_id, entry_number); its grants migration is responsible for `ALTER PUBLICATION supabase_realtime ADD TABLE` (tournaments + participants only — NOT ops_events) and for regenerating `src/types/supabase.ts` so T4's `Constants.public.Enums.*` SSOT resolves.
- T10 (pgTAP) owns the exhaustive proofs already smoke-checked here: outsider/anon see 0 rows, member sees rows (`ops_tables_rls.test.sql`), `throws_ok` on direct ops_events UPDATE/DELETE + `ops_events NOT IN pg_publication_tables` (`ops_events_append_only.test.sql`), and entry-number allocation/23505 (`ops_entry_number_allocation.test.sql`). Do not duplicate those here.
### Task T2: DB RPCs + grants + realtime + TS type regen

> Run all commands from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`. Branch `feat/tournament-ops-revival`.
> Migrations apply to LOCAL only via `npm run db:reset`. **PROD apply is a later approval gate via MCP `mcp__supabase__apply_migration` — do NOT apply to prod in this task.** Full security pgTAP is T10; T2 ships a single-transaction psql smoke only.

**Files:**
- Create: `supabase/migrations/20260625000300_ops_1a_rpcs.sql` (the 7 SECDEF RPCs)
- Create: `supabase/migrations/20260625000400_ops_1a_grants_and_realtime.sql` (name-based REVOKE/GRANT DO-loop + guarded `ALTER PUBLICATION`)
- Modify: `src/types/supabase.ts` (REGENERATED via MCP — overwrite, do not hand-edit)
- Test: smoke = `docker exec ... psql` single-transaction call asserting `ops_create_tournament(...) ->> 'tournament_id' IS NOT NULL`. Full pgTAP security suite is `supabase/tests/ops_rpc_security.test.sql` etc. in **T10**.

**Interfaces:**

Consumes (from **T1**, must already exist after `20260625000100_ops_1a_enums_and_tables.sql` + `20260625000200_ops_1a_rls_and_membership.sql` applied):
- Tables: `public.ops_tournaments`, `public.ops_participants`, `public.ops_events` (columns per contracts §4). Table-level `INSERT/UPDATE/DELETE` already REVOKEd from `anon, authenticated` (writes only via these RPCs).
- Enums: `ops_tournament_status('upcoming','active','completed')`, `ops_participant_status('registered','checked_in','active','busted','no_show')`, `ops_event_type(...)`.
- Functions: `public.is_ops_member(_tournament_id uuid, _user_id uuid) RETURNS boolean` (SECDEF). Pre-existing platform helpers: `public.is_admin() RETURNS boolean`, `public.is_workspace_member(_workspace_id uuid, _user_id uuid) RETURNS boolean`, `auth.uid() RETURNS uuid`.
- Pre-existing seeded user (from `supabase/seed.sql`, present after `db:reset`): `4365e1ad-c9fb-416f-addb-d1b18b2a5ec8` exists in both `auth.users` and `public.users` — used by the smoke.

Produces (later tasks rely on these EXACT signatures; T5 Repository calls them via `runRpc`):
- `public.ops_create_tournament(p_owner_id uuid, p_name text, p_venue text, p_event_date date, p_game_type text, p_job_posting_id uuid, p_starting_chips int, p_seats_per_table int, p_config jsonb) RETURNS jsonb` → `{tournament_id}`
- `public.ops_update_tournament(p_tournament_id uuid, p_actor_id uuid, p_patch jsonb) RETURNS jsonb` → `{tournament_id}`
- `public.ops_set_tournament_status(p_tournament_id uuid, p_actor_id uuid, p_status ops_tournament_status) RETURNS jsonb` → `{tournament_id, status}`
- `public.ops_register_participant(p_tournament_id uuid, p_actor_id uuid, p_name text, p_nationality text, p_phone text, p_buy_in_amount int) RETURNS jsonb` → `{participant_id, entry_number}`
- `public.ops_add_rebuy(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb` → `{participant_id, chips, rebuys}`
- `public.ops_add_addon(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb` → `{participant_id, chips, add_ons}`
- `public.ops_toggle_registration(p_tournament_id uuid, p_actor_id uuid, p_open boolean) RETURNS jsonb` → `{tournament_id, registration_open}`
- RPC RAISE prefixes (T5 `mapOpsRpcError` maps these, all `ERRCODE='P0001'`): `PERMISSION_DENIED`, `REGISTRATION_CLOSED`, `INVALID_STATUS`, `PARTICIPANT_NOT_ACTIVE`, `TOURNAMENT_NOT_FOUND`, `PARTICIPANT_NOT_FOUND`.
- Regenerated `Constants.public.Enums.ops_tournament_status` / `ops_participant_status` / `ops_event_type` in `src/types/supabase.ts` (T3/T4 enum-SSOT depend on these existing).

---

- [ ] **Step 1: Write the smoke harness and run it RED (function absent)**

Create the smoke script (this is a throwaway harness file, kept under the worktree so reviewers can re-run it; it is NOT a migration). Save it to `supabase/tests/_smoke_ops_rpcs.sh`:

```bash
#!/usr/bin/env bash
# T2 smoke — single-transaction (ROLLBACK) sanity for ops_create_tournament.
# Full security/race pgTAP lives in T10. Run AFTER `npm run db:reset`.
set -euo pipefail
docker exec -i supabase_db_uniqn psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
-- Simulate an authenticated seeded employer (auth.uid() reads request.jwt.claims->>'sub').
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8',
    'role', 'authenticated'
  )::text,
  true
);
-- Positive: self-actor create returns a tournament_id.
SELECT (public.ops_create_tournament(
  '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8'::uuid,
  'Smoke Cup', '강남', current_date, 'NLH', NULL, 30000, 9,
  '{"buy_in_chips":30000,"rebuy_chips":30000,"addon_chips":20000,"buy_in_cost":50000,"fee_cost":5000,"rebuy_cost":50000,"addon_cost":30000}'::jsonb
) ->> 'tournament_id') IS NOT NULL AS has_tournament_id;
ROLLBACK;
SQL
```

Run it now (T1 migrations applied, but T2 RPCs not yet):

```bash
chmod +x supabase/tests/_smoke_ops_rpcs.sh && npm run db:reset >/dev/null 2>&1 && bash supabase/tests/_smoke_ops_rpcs.sh
```

Expected: **FAIL** — `ERROR:  function public.ops_create_tournament(...) does not exist` (exit non-zero). This proves the smoke exercises the not-yet-created RPC.

- [ ] **Step 2: Create the 7 SECDEF RPCs migration**

Create `supabase/migrations/20260625000300_ops_1a_rpcs.sql` with the COMPLETE content below. Every RPC: `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public, extensions, pg_temp`, `RETURNS jsonb`, actor guard first, business `RAISE ... USING ERRCODE='P0001'`, one `ops_events` append per call (except `ops_update_tournament` which emits no event per contracts §6).

```sql
-- OPS 1a — 변이 SECDEF RPC 7종 (raw write 금지: 모든 ops 쓰기는 이 RPC만 경유).
-- 패턴 출처:
--   · actor 바인딩 가드: 20260621090100_bind_mutation_rpcs_to_auth_uid.sql
--   · FOR UPDATE 할당:  20260427000300_create_consume_diamonds_rpc.sql
--   · 상태 전이 가드:   20260421001906_relax_review_report_state_transitions.sql
-- 공통 규약(계약 §6):
--   · search_path = public, extensions, pg_temp
--   · actor 가드: auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor AND NOT is_admin())
--   · 자식 RPC: 토너먼트 로드 후 is_ops_member(t_id, actor) OR is_admin() 강제
--   · 호출당 ops_events 1행 append (update 제외)
--   · 모든 비즈니스 RAISE 는 ERRCODE='P0001' (Repository.mapOpsRpcError 매핑)
-- 권한(REVOKE anon / GRANT authenticated,service_role) 은 후속 grants 마이그레이션에서 처리.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) ops_create_tournament — 대회 생성 (status 'upcoming')
CREATE OR REPLACE FUNCTION public.ops_create_tournament(
  p_owner_id uuid,
  p_name text,
  p_venue text,
  p_event_date date,
  p_game_type text,
  p_job_posting_id uuid,
  p_starting_chips int,
  p_seats_per_table int,
  p_config jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_jp record;
BEGIN
  -- [보안] 호출자 바인딩: p_owner_id 는 호출자 본인(또는 admin).
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_owner_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 공고 연동 시: 호출자가 해당 공고를 관리할 수 있어야 함.
  IF p_job_posting_id IS NOT NULL THEN
    SELECT id, owner_id, workspace_id INTO v_jp
      FROM public.job_postings WHERE id = p_job_posting_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 공고를 찾을 수 없습니다 (%)', p_job_posting_id
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT (
      v_jp.owner_id = p_owner_id
      OR public.is_workspace_member(v_jp.workspace_id, p_owner_id)
      OR public.is_admin()
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.ops_tournaments (
    owner_id, job_posting_id, name, venue, event_date, game_type,
    status, seats_per_table, starting_chips,
    buy_in_chips, rebuy_chips, addon_chips,
    buy_in_cost, fee_cost, rebuy_cost, addon_cost
  ) VALUES (
    p_owner_id, p_job_posting_id, p_name, p_venue, p_event_date,
    COALESCE(NULLIF(p_game_type, ''), 'NLH'),
    'upcoming', COALESCE(p_seats_per_table, 9), COALESCE(p_starting_chips, 0),
    COALESCE((p_config->>'buy_in_chips')::int, 0),
    COALESCE((p_config->>'rebuy_chips')::int, 0),
    COALESCE((p_config->>'addon_chips')::int, 0),
    COALESCE((p_config->>'buy_in_cost')::int, 0),
    COALESCE((p_config->>'fee_cost')::int, 0),
    COALESCE((p_config->>'rebuy_cost')::int, 0),
    COALESCE((p_config->>'addon_cost')::int, 0)
  ) RETURNING id INTO v_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'tournament_created', p_owner_id,
          jsonb_build_object('name', p_name));

  RETURN jsonb_build_object('tournament_id', v_tournament_id);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) ops_update_tournament — 화이트리스트 필드만 패치 (이벤트 없음)
CREATE OR REPLACE FUNCTION public.ops_update_tournament(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_patch jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET
    name            = COALESCE(p_patch->>'name', name),
    venue           = COALESCE(p_patch->>'venue', venue),
    event_date      = COALESCE((p_patch->>'event_date')::date, event_date),
    game_type       = COALESCE(p_patch->>'game_type', game_type),
    starting_chips  = COALESCE((p_patch->>'starting_chips')::int, starting_chips),
    seats_per_table = COALESCE((p_patch->>'seats_per_table')::int, seats_per_table),
    buy_in_chips    = COALESCE((p_patch->>'buy_in_chips')::int, buy_in_chips),
    rebuy_chips     = COALESCE((p_patch->>'rebuy_chips')::int, rebuy_chips),
    addon_chips     = COALESCE((p_patch->>'addon_chips')::int, addon_chips),
    buy_in_cost     = COALESCE((p_patch->>'buy_in_cost')::int, buy_in_cost),
    fee_cost        = COALESCE((p_patch->>'fee_cost')::int, fee_cost),
    rebuy_cost      = COALESCE((p_patch->>'rebuy_cost')::int, rebuy_cost),
    addon_cost      = COALESCE((p_patch->>'addon_cost')::int, addon_cost),
    color           = COALESCE(p_patch->>'color', color)
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object('tournament_id', p_tournament_id);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) ops_set_tournament_status — 상태 전이 가드 + FOR UPDATE
CREATE OR REPLACE FUNCTION public.ops_set_tournament_status(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_status ops_tournament_status
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_current ops_tournament_status;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_current FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 합법 전이: upcoming→active, active→completed, active→upcoming(되돌리기), upcoming→completed(취소).
  IF NOT (
    (v_current = 'upcoming' AND p_status IN ('active', 'completed'))
    OR (v_current = 'active' AND p_status IN ('completed', 'upcoming'))
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS: % → % 전이 불가', v_current, p_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET status = p_status WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'tournament_status_changed', p_actor_id,
          jsonb_build_object('from', v_current, 'to', p_status));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'status', p_status);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4) ops_register_participant — 워크인 등록(→active). entry# 는 next_entry_seq+1 (FOR UPDATE 직렬화)
CREATE OR REPLACE FUNCTION public.ops_register_participant(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_name text,
  p_nationality text,
  p_phone text,
  p_buy_in_amount int
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_t record;
  v_entry int;
  v_participant_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 행 잠금: entry# 할당 직렬화.
  SELECT id, registration_open, starting_chips, next_entry_seq
    INTO v_t
    FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_t.registration_open = false THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED: 등록이 마감되었습니다' USING ERRCODE = 'P0001';
  END IF;

  v_entry := v_t.next_entry_seq + 1;
  UPDATE public.ops_tournaments SET next_entry_seq = v_entry WHERE id = p_tournament_id;

  INSERT INTO public.ops_participants (
    tournament_id, entry_number, name, nationality, phone,
    status, chips, buy_in_amount
  ) VALUES (
    p_tournament_id, v_entry, p_name, p_nationality, p_phone,
    'active', v_t.starting_chips, p_buy_in_amount
  ) RETURNING id INTO v_participant_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'player_registered', p_actor_id,
          jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry));

  RETURN jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5) ops_add_rebuy — 리바이 (active 참가자만), 칩 += t.rebuy_chips
CREATE OR REPLACE FUNCTION public.ops_add_rebuy(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record;
  v_rebuy_chips int;
  v_chips_before int;
  v_chips_after int;
  v_rebuys int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, status, chips
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 리바이 가능 (status=%)', v_p.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT rebuy_chips INTO v_rebuy_chips FROM public.ops_tournaments
    WHERE id = v_p.tournament_id;

  v_chips_before := v_p.chips;
  UPDATE public.ops_participants
    SET rebuys = rebuys + 1, chips = chips + COALESCE(v_rebuy_chips, 0)
    WHERE id = p_participant_id
    RETURNING chips, rebuys INTO v_chips_after, v_rebuys;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_rebuy', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'chips_before', v_chips_before,
                             'chips_after', v_chips_after));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'chips', v_chips_after, 'rebuys', v_rebuys);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6) ops_add_addon — 애드온 (active 참가자만), 칩 += t.addon_chips
CREATE OR REPLACE FUNCTION public.ops_add_addon(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record;
  v_addon_chips int;
  v_chips_before int;
  v_chips_after int;
  v_add_ons int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, status, chips
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 애드온 가능 (status=%)', v_p.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT addon_chips INTO v_addon_chips FROM public.ops_tournaments
    WHERE id = v_p.tournament_id;

  v_chips_before := v_p.chips;
  UPDATE public.ops_participants
    SET add_ons = add_ons + 1, chips = chips + COALESCE(v_addon_chips, 0)
    WHERE id = p_participant_id
    RETURNING chips, add_ons INTO v_chips_after, v_add_ons;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_addon', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'chips_before', v_chips_before,
                             'chips_after', v_chips_after));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'chips', v_chips_after, 'add_ons', v_add_ons);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7) ops_toggle_registration — 등록 개폐
CREATE OR REPLACE FUNCTION public.ops_toggle_registration(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_open boolean
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET registration_open = p_open WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'registration_toggled', p_actor_id,
          jsonb_build_object('open', p_open));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'registration_open', p_open);
END;
$function$;
```

- [ ] **Step 3: Apply migration locally and run the smoke (GREEN)**

```bash
npm run db:reset >/dev/null 2>&1 && bash supabase/tests/_smoke_ops_rpcs.sh
```

Expected: **PASS** — psql prints:
```
 has_tournament_id
-------------------
 t
(1 row)
ROLLBACK
```
Exit code 0. (The `ROLLBACK` discards the inserted rows, so `db:reset` state is unchanged.)

- [ ] **Step 4: Commit the RPCs**

```bash
git add supabase/migrations/20260625000300_ops_1a_rpcs.sql supabase/tests/_smoke_ops_rpcs.sh && git commit -m "feat(ops): 1a 변이 SECDEF RPC 7종 추가 (actor 바인딩+entry# 직렬화+ops_events append)"
```

Expected: `1 file changed` style summary, no error. (Do NOT apply to prod — that is a later approval gate.)

- [ ] **Step 5: Create the grants + realtime migration**

Create `supabase/migrations/20260625000400_ops_1a_grants_and_realtime.sql`. Name-based DO-loop over `pg_proc` (mirror `20260621090000_harden_anon_rpc_revoke_and_delete_guard.sql`) handles every overload via `oid::regprocedure`. Realtime ADD is guarded by `pg_publication_tables` existence (idempotent / re-run safe). `ops_events` is deliberately EXCLUDED from realtime (append-only, never published).

```sql
-- OPS 1a — RPC 권한(REVOKE anon / GRANT authenticated,service_role) + Realtime publication.
-- 패턴: 20260621090000_harden_anon_rpc_revoke_and_delete_guard.sql (이름기반 DO 루프),
--       20260509020000_workspace_members_realtime_publication.sql (ALTER PUBLICATION).
-- pitfall_supabase_new_function_anon_default_grant: public 신규 함수는 anon/authenticated
--   EXECUTE 자동부여 → 변이 RPC 는 anon 명시 REVOKE 필수.

-- 이름 기반 REVOKE/GRANT: 정확한 시그니처(oid::regprocedure)로 모든 오버로드 처리.
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'ops_create_tournament',
    'ops_update_tournament',
    'ops_set_tournament_status',
    'ops_register_participant',
    'ops_add_rebuy',
    'ops_add_addon',
    'ops_toggle_registration'
  ];
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
    RAISE NOTICE 'ops rpc hardened: %', rec.sig;
  END LOOP;
END $$;

-- Realtime: ops_tournaments + ops_participants 만 publication 에 추가 (ops_events 는 제외).
-- 멱등: 이미 등록돼 있으면 skip (재적용/CLI 드리프트 안전).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'ops_tournaments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_tournaments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'ops_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_participants;
  END IF;
END $$;
```

- [ ] **Step 6: Apply and verify grants + publication**

```bash
npm run db:reset >/dev/null 2>&1 && docker exec -i supabase_db_uniqn psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
-- anon must NOT have EXECUTE; authenticated MUST.
SELECT
  has_function_privilege('anon',
    'public.ops_register_participant(uuid,uuid,text,text,text,int)', 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated',
    'public.ops_register_participant(uuid,uuid,text,text,text,int)', 'EXECUTE') AS authed_exec;
-- realtime: ops_tournaments + ops_participants present, ops_events absent.
SELECT tablename FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
    AND tablename LIKE 'ops_%' ORDER BY tablename;
SQL
```

Expected:
```
 anon_exec | authed_exec
-----------+-------------
 f         | t
(1 row)

    tablename
------------------
 ops_participants
 ops_tournaments
(2 rows)
```
(`ops_events` is correctly absent.)

- [ ] **Step 7: Commit the grants + realtime migration**

```bash
git add supabase/migrations/20260625000400_ops_1a_grants_and_realtime.sql && git commit -m "feat(ops): 1a RPC anon REVOKE + authenticated GRANT + realtime publication(ops_tournaments/ops_participants)"
```

Expected: clean commit, no error.

- [ ] **Step 8: Regenerate TS types (MCP) — requires enums to exist in the DB first**

Prereq: T1 enums + T2 RPCs are applied to the target project (the LOCAL stack already has them after Step 6; for prod the enums must exist before regen, which is gated by the prod-apply approval). Regenerate the typed schema and OVERWRITE `src/types/supabase.ts`:

Use MCP tool `mcp__supabase__generate_typescript_types` against the project, then write its `types` output verbatim to `src/types/supabase.ts` (full-file overwrite — never hand-edit). After this, `Constants.public.Enums.ops_tournament_status`, `ops_participant_status`, and `ops_event_type` exist, plus `Tables<'ops_tournaments'>` / `'ops_participants'` / `'ops_events'` row types. T3/T4 enum-SSOT (`z.enum(Constants.public.Enums.<name>)`) and T5 row typing depend on this.

> Note: `generate_typescript_types` reflects the schema of the connected project. If run against local before the migrations are merged/applied to the remote schema source, regenerate again post-prod-apply so the committed `supabase.ts` matches prod. Do not invent enum members by hand.

- [ ] **Step 9: Type-check the regenerated types and commit**

```bash
npm run quality
```

Expected: `tsc --noEmit` exits 0 (the new `ops_*` enums/tables resolve; no consumer references them yet in T2, so this is purely a schema-integrity check), lint clean, format clean. Then:

```bash
git add src/types/supabase.ts && git commit -m "feat(ops): supabase TS 타입 재생성 (ops_* enums/tables 반영)"
```

Expected: clean commit.

**Done-when (evidence required before claiming T2 complete):**
- Step 3 smoke prints `has_tournament_id | t` (exit 0).
- Step 6 prints `anon_exec=f, authed_exec=t` and exactly `ops_participants` + `ops_tournaments` in the realtime publication (no `ops_events`).
- Step 9 `npm run quality` exits 0.
- Four commits exist (`20260625000300`, `20260625000400`, smoke harness folded into the first, regenerated `supabase.ts`).
- Full RPC security (anon-EXECUTE-false for all 7, forged-actor PERMISSION_DENIED, REGISTRATION_CLOSED, append-only, entry# allocation) is verified in **T10** pgTAP — not here. Prod migration apply is a later approval gate.
### Task T3: Pure ops domain — participant status machine + partial-stats calculator (Jest, RED→GREEN)

Two pure, I/O-free modules under `src/domains/ops/` plus a barrel and co-located Jest tests. `OpsParticipantStatusMachine.ts` owns the §8 transition table + `canTransition` + `isFinalStatus`; `opsStats.ts` owns the §6/D6 client-side `computeOpsPartialStats`. No Supabase, no repository, no service imports. Type-only imports from `@/types/ops` (immutable spread, no mutation). Mirrors `src/domains/application/ApplicationStatusMachine.ts` (transition-table + `canTransition` shape) and `src/domains/job-posting/__tests__/core.regionLabel.test.ts` (factory + Korean `it()`, no mocking).

**Files:**
- Create: `src/domains/ops/OpsParticipantStatusMachine.ts`
- Create: `src/domains/ops/opsStats.ts`
- Create: `src/domains/ops/index.ts` (barrel)
- Test: `src/domains/ops/__tests__/OpsParticipantStatusMachine.test.ts`
- Test: `src/domains/ops/__tests__/opsStats.test.ts`
- Modify: (none — T3 only adds new files)

**Interfaces:**

Consumes (from **T4** `src/types/ops.ts`, which derives the enum from **T2**'s regenerated `src/types/supabase.ts` — `Constants.public.Enums.ops_participant_status`). Exact shapes T3 relies on (copied from contract §7 — do NOT redefine, import them):
```ts
export type OpsParticipantStatus = (typeof Constants.public.Enums.ops_participant_status)[number];
// runtime values: 'registered' | 'checked_in' | 'active' | 'busted' | 'no_show'
export interface OpsParticipant {
  id: string; tournamentId: string; entryNumber: number; name: string; nationality?: string | null;
  phone?: string | null; playerUserId?: string | null; status: OpsParticipantStatus; chips: number;
  buyInAmount?: number | null; rebuys: number; addOns: number; reentries: number;
  finishPosition?: number | null; bustedAt?: string | null; prizeAmount?: number | null; note?: string | null;
  createdAt: string; updatedAt: string;
}
export interface OpsTournament { /* … */ buyInCost: number; rebuyCost: number; addonCost: number; /* … */ }
export interface OpsPartialStats { playing: number; entries: number; totalChips: number; averageStack: number; prizePool: number; }
```
> Dependency note: T3 and T4 are parallel (both gate T5). The two Jest cycles below run **independently of T4** because `babel-preset-expo` (`@babel/preset-typescript`) elides type-only imports at runtime — `import type { OpsParticipantStatus } from '@/types/ops'` produces no `require`, so missing T4 cannot break Jest. The full `npm run quality` (tsc) gate, however, requires `src/types/ops.ts` to be present; run it only after T4 lands (T4 has no T3 dependency, so sequence T4's type file first if you want the tsc gate inside T3).

Produces (later tasks rely on these EXACT names):
```ts
// src/domains/ops/OpsParticipantStatusMachine.ts
export type OpsParticipantAction = 'register' | 'checkIn' | 'activate' | 'bust' | 'reenter' | 'markNoShow';
export interface OpsTransitionResult { allowed: boolean; nextStatus?: OpsParticipantStatus; reason?: string; }
export function canTransition(from: OpsParticipantStatus, action: OpsParticipantAction): OpsTransitionResult;
export function isFinalStatus(status: OpsParticipantStatus): boolean;
// src/domains/ops/opsStats.ts
export function computeOpsPartialStats(
  participants: Pick<OpsParticipant, 'status' | 'chips' | 'rebuys' | 'addOns'>[],
  tournament: Pick<OpsTournament, 'buyInCost' | 'rebuyCost' | 'addonCost'>,
): OpsPartialStats;
// src/domains/ops/index.ts re-exports both — T7 useOpsPartialStats imports { computeOpsPartialStats } from '@/domains/ops'.
```

All shell commands run from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`.

---

- [ ] **Step 1: Confirm T4 type module is reachable (prereq guard)**

  T3 imports types from `@/types/ops`. Confirm the file exists (provided by T4). If it is not present yet, the Jest cycles still pass (babel elides type-only imports), but skip the optional tsc check in Step 11 until T4 lands.
  ```bash
  ls -1 src/types/ops.ts && grep -n "OpsParticipantStatus\|OpsPartialStats\|addOns" src/types/ops.ts | head -5
  ```
  Expected (when T4 present):
  ```
  src/types/ops.ts
  <line>:export type OpsParticipantStatus = ...
  <line>:export interface OpsPartialStats { playing: number; ...
  <line>:  buyInAmount?: number | null; rebuys: number; addOns: number; ...
  ```
  If `ls` reports "No such file" → T4 not landed yet: proceed (Jest-only) and defer Step 11's tsc check.

- [ ] **Step 2: Write the FAILING status-machine test**

  Create `src/domains/ops/__tests__/OpsParticipantStatusMachine.test.ts` (legal + illegal transitions, create-only `register`, `isFinalStatus` all-false). No mocking; type-only import for the status union.
  ```ts
  import { canTransition, isFinalStatus } from '@/domains/ops/OpsParticipantStatusMachine';
  import type { OpsParticipantStatus } from '@/types/ops';

  const ALL_STATUSES: OpsParticipantStatus[] = [
    'registered',
    'checked_in',
    'active',
    'busted',
    'no_show',
  ];

  describe('OpsParticipantStatusMachine — canTransition (합법 전이)', () => {
    it('registered → checkIn → checked_in', () => {
      const result = canTransition('registered', 'checkIn');
      expect(result.allowed).toBe(true);
      expect(result.nextStatus).toBe('checked_in');
    });

    it('registered → activate → active (워크인 등록 경로)', () => {
      expect(canTransition('registered', 'activate')).toEqual({
        allowed: true,
        nextStatus: 'active',
      });
    });

    it('registered → markNoShow → no_show', () => {
      expect(canTransition('registered', 'markNoShow')).toEqual({
        allowed: true,
        nextStatus: 'no_show',
      });
    });

    it('checked_in → activate → active', () => {
      expect(canTransition('checked_in', 'activate')).toEqual({
        allowed: true,
        nextStatus: 'active',
      });
    });

    it('checked_in → markNoShow → no_show', () => {
      expect(canTransition('checked_in', 'markNoShow')).toEqual({
        allowed: true,
        nextStatus: 'no_show',
      });
    });

    it('active → bust → busted', () => {
      expect(canTransition('active', 'bust')).toEqual({
        allowed: true,
        nextStatus: 'busted',
      });
    });

    it('busted → reenter → active (재입장)', () => {
      expect(canTransition('busted', 'reenter')).toEqual({
        allowed: true,
        nextStatus: 'active',
      });
    });

    it('no_show → activate → active', () => {
      expect(canTransition('no_show', 'activate')).toEqual({
        allowed: true,
        nextStatus: 'active',
      });
    });
  });

  describe('OpsParticipantStatusMachine — canTransition (불법 전이)', () => {
    it('active → checkIn 은 불허하고 reason 을 반환한다', () => {
      const result = canTransition('active', 'checkIn');
      expect(result.allowed).toBe(false);
      expect(result.nextStatus).toBeUndefined();
      expect(result.reason).toBeDefined();
    });

    it('busted → bust 는 불허한다', () => {
      expect(canTransition('busted', 'bust').allowed).toBe(false);
    });

    it('registered → bust 는 불허한다', () => {
      expect(canTransition('registered', 'bust').allowed).toBe(false);
    });

    it("'register' 액션은 어떤 상태에서도 전이를 만들지 않는다 (생성 전용)", () => {
      ALL_STATUSES.forEach((status) => {
        expect(canTransition(status, 'register').allowed).toBe(false);
      });
    });
  });

  describe('OpsParticipantStatusMachine — isFinalStatus', () => {
    it('모든 1a 상태는 outgoing 전이가 있어 최종이 아니다 (전부 false)', () => {
      ALL_STATUSES.forEach((status) => {
        expect(isFinalStatus(status)).toBe(false);
      });
    });
  });
  ```

- [ ] **Step 3: Run the status-machine test — expect RED (module missing)**
  ```bash
  npm test -- OpsParticipantStatusMachine
  ```
  Expected: **FAIL** — suite fails to run because the implementation file does not exist yet:
  ```
  FAIL src/domains/ops/__tests__/OpsParticipantStatusMachine.test.ts
    ● Test suite failed to run
      Cannot find module '@/domains/ops/OpsParticipantStatusMachine' from 'src/domains/ops/__tests__/OpsParticipantStatusMachine.test.ts'
  ```

- [ ] **Step 4: Implement `OpsParticipantStatusMachine.ts` (minimal to pass)**

  Create `src/domains/ops/OpsParticipantStatusMachine.ts`. `TRANSITION_TABLE` is module-private (mirrors the exemplar). `isFinalStatus` = "no outgoing actions" (every 1a status has ≥1, so all return `false`). `register` is intentionally absent from every from-state (it creates a participant from nothing).
  ```ts
  import type { OpsParticipantStatus } from '@/types/ops';

  export type OpsParticipantAction =
    | 'register'
    | 'checkIn'
    | 'activate'
    | 'bust'
    | 'reenter'
    | 'markNoShow';

  export interface OpsTransitionResult {
    allowed: boolean;
    nextStatus?: OpsParticipantStatus;
    reason?: string;
  }

  // §8 transition table. 1a wires ONLY 'register' (→active create, handled by the
  // ops_register_participant RPC, not by this table) and rebuy/addon (no status change).
  // checkIn/activate/bust/reenter/markNoShow are present for later slices (no_show + check-in
  // desk flow ship post-1a). 'register' has no from-state entry — it is a create-only action.
  const TRANSITION_TABLE: Record<
    OpsParticipantStatus,
    Partial<Record<OpsParticipantAction, OpsParticipantStatus>>
  > = {
    registered: { checkIn: 'checked_in', activate: 'active', markNoShow: 'no_show' },
    checked_in: { activate: 'active', markNoShow: 'no_show' },
    active: { bust: 'busted' },
    busted: { reenter: 'active' },
    no_show: { activate: 'active' },
  };

  export function canTransition(
    from: OpsParticipantStatus,
    action: OpsParticipantAction,
  ): OpsTransitionResult {
    const nextStatus = TRANSITION_TABLE[from][action];

    if (!nextStatus) {
      return {
        allowed: false,
        reason: `${from} 상태에서는 '${action}' 작업을 수행할 수 없습니다.`,
      };
    }

    return { allowed: true, nextStatus };
  }

  export function isFinalStatus(status: OpsParticipantStatus): boolean {
    return Object.keys(TRANSITION_TABLE[status]).length === 0;
  }
  ```

- [ ] **Step 5: Re-run the status-machine test — expect GREEN**
  ```bash
  npm test -- OpsParticipantStatusMachine
  ```
  Expected: **PASS** — all 13 tests green:
  ```
  PASS src/domains/ops/__tests__/OpsParticipantStatusMachine.test.ts
  Tests:       13 passed, 13 total
  ```

- [ ] **Step 6: Commit the status machine**
  ```bash
  git add src/domains/ops/OpsParticipantStatusMachine.ts src/domains/ops/__tests__/OpsParticipantStatusMachine.test.ts
  git commit -m "feat(ops): 참가자 상태 머신(canTransition/isFinalStatus) 추가"
  ```
  Expected: `2 files changed`.

- [ ] **Step 7: Write the FAILING partial-stats test**

  Create `src/domains/ops/__tests__/opsStats.test.ts`. Factory `createParticipant(overrides)` (immutable spread, no mocking) returns exactly the `Pick` shape the function consumes. Cases: active count, totalChips, average rounding, /0 guard, prizePool formula, empty list.
  ```ts
  import { computeOpsPartialStats } from '@/domains/ops/opsStats';
  import type { OpsParticipant, OpsTournament } from '@/types/ops';

  type StatsParticipant = Pick<OpsParticipant, 'status' | 'chips' | 'rebuys' | 'addOns'>;
  type StatsTournament = Pick<OpsTournament, 'buyInCost' | 'rebuyCost' | 'addonCost'>;

  function createParticipant(overrides: Partial<StatsParticipant> = {}): StatsParticipant {
    return {
      status: 'active',
      chips: 0,
      rebuys: 0,
      addOns: 0,
      ...overrides,
    };
  }

  const TOURNAMENT: StatsTournament = {
    buyInCost: 100,
    rebuyCost: 100,
    addonCost: 50,
  };

  describe('computeOpsPartialStats', () => {
    it('playing 은 status === "active" 인 참가자만 세고, entries 는 전체 수다', () => {
      const participants = [
        createParticipant({ status: 'active' }),
        createParticipant({ status: 'active' }),
        createParticipant({ status: 'busted' }),
        createParticipant({ status: 'registered' }),
      ];
      const stats = computeOpsPartialStats(participants, TOURNAMENT);
      expect(stats.playing).toBe(2);
      expect(stats.entries).toBe(4);
    });

    it('totalChips 는 모든 참가자 칩의 합이다 (탈락자 포함)', () => {
      const participants = [
        createParticipant({ chips: 10000 }),
        createParticipant({ chips: 5000 }),
        createParticipant({ status: 'busted', chips: 0 }),
      ];
      expect(computeOpsPartialStats(participants, TOURNAMENT).totalChips).toBe(15000);
    });

    it('averageStack 은 playing 으로 나눈 값을 반올림한다 (10000/3 → 3333)', () => {
      const participants = [
        createParticipant({ chips: 4000 }),
        createParticipant({ chips: 3000 }),
        createParticipant({ chips: 3000 }),
      ];
      const stats = computeOpsPartialStats(participants, TOURNAMENT);
      expect(stats.totalChips).toBe(10000);
      expect(stats.playing).toBe(3);
      expect(stats.averageStack).toBe(3333);
    });

    it('playing 이 0 이면 averageStack 은 0 (0 나눗셈 가드)', () => {
      const participants = [
        createParticipant({ status: 'busted', chips: 0 }),
        createParticipant({ status: 'registered', chips: 0 }),
      ];
      const stats = computeOpsPartialStats(participants, TOURNAMENT);
      expect(stats.playing).toBe(0);
      expect(stats.averageStack).toBe(0);
    });

    it('prizePool = entries*buyInCost + Σrebuys*rebuyCost + ΣaddOns*addonCost', () => {
      const participants = [
        createParticipant({ rebuys: 1, addOns: 1 }),
        createParticipant({ rebuys: 2, addOns: 0 }),
        createParticipant({ rebuys: 0, addOns: 1 }),
      ];
      // entries=3 → 3*100=300; Σrebuys=3 → 3*100=300; ΣaddOns=2 → 2*50=100; 합=700
      expect(computeOpsPartialStats(participants, TOURNAMENT).prizePool).toBe(700);
    });

    it('빈 참가자 목록은 모든 값이 0 이다', () => {
      expect(computeOpsPartialStats([], TOURNAMENT)).toEqual({
        playing: 0,
        entries: 0,
        totalChips: 0,
        averageStack: 0,
        prizePool: 0,
      });
    });
  });
  ```

- [ ] **Step 8: Run the stats test — expect RED (module missing)**
  ```bash
  npm test -- opsStats
  ```
  Expected: **FAIL**:
  ```
  FAIL src/domains/ops/__tests__/opsStats.test.ts
    ● Test suite failed to run
      Cannot find module '@/domains/ops/opsStats' from 'src/domains/ops/__tests__/opsStats.test.ts'
  ```

- [ ] **Step 9: Implement `opsStats.ts` (pure, immutable)**

  Create `src/domains/ops/opsStats.ts`. `filter`/`reduce` create new values (no mutation). Exactly the D6 1a partial set: `playing, entries, totalChips, averageStack, prizePool`.
  ```ts
  import type { OpsParticipant, OpsPartialStats, OpsTournament } from '@/types/ops';

  /**
   * D6: STATUS partial stats computed client-side over the participants list + cost config.
   * NO ops_live_stats table in 1a. The 1a partial set is exactly
   * { playing, entries, totalChips, averageStack, prizePool }.
   */
  export function computeOpsPartialStats(
    participants: Pick<OpsParticipant, 'status' | 'chips' | 'rebuys' | 'addOns'>[],
    tournament: Pick<OpsTournament, 'buyInCost' | 'rebuyCost' | 'addonCost'>,
  ): OpsPartialStats {
    const playing = participants.filter((p) => p.status === 'active').length;
    const entries = participants.length;
    const totalChips = participants.reduce((sum, p) => sum + p.chips, 0);
    const averageStack = playing > 0 ? Math.round(totalChips / playing) : 0;
    const totalRebuys = participants.reduce((sum, p) => sum + p.rebuys, 0);
    const totalAddOns = participants.reduce((sum, p) => sum + p.addOns, 0);
    const prizePool =
      entries * tournament.buyInCost +
      totalRebuys * tournament.rebuyCost +
      totalAddOns * tournament.addonCost;

    return { playing, entries, totalChips, averageStack, prizePool };
  }
  ```

- [ ] **Step 10: Re-run the stats test — expect GREEN**
  ```bash
  npm test -- opsStats
  ```
  Expected: **PASS**:
  ```
  PASS src/domains/ops/__tests__/opsStats.test.ts
  Tests:       6 passed, 6 total
  ```

- [ ] **Step 11: Create the barrel, run the full ops domain suite, commit**

  Create `src/domains/ops/index.ts`:
  ```ts
  export * from './OpsParticipantStatusMachine';
  export * from './opsStats';
  ```
  Run both ops domain test files together:
  ```bash
  npm test -- src/domains/ops
  ```
  Expected: **PASS** — both suites green:
  ```
  PASS src/domains/ops/__tests__/OpsParticipantStatusMachine.test.ts
  PASS src/domains/ops/__tests__/opsStats.test.ts
  Test Suites: 2 passed, 2 total
  Tests:       19 passed, 19 total
  ```
  Optional tsc gate — run ONLY if T4 (`src/types/ops.ts`) has landed (see Step 1 note). If T4 is not present yet, skip this and let the combined T3+T4 `npm run quality` gate cover it:
  ```bash
  npx tsc --noEmit
  ```
  Expected (when T4 present): exit 0, no errors referencing `src/domains/ops/`.

  Commit:
  ```bash
  git add src/domains/ops/opsStats.ts src/domains/ops/__tests__/opsStats.test.ts src/domains/ops/index.ts
  git commit -m "feat(ops): 파셜 통계 계산기(computeOpsPartialStats) + ops 도메인 배럴 추가"
  ```
  Expected: `3 files changed`.

---

**Definition of done (T3):** `npm test -- src/domains/ops` → 2 suites / 19 tests passed (fresh run); `OpsParticipantStatusMachine.ts`, `opsStats.ts`, `index.ts` created; both modules pure (no `@/lib/supabase`, no repository/service imports; only `import type … from '@/types/ops'`); two `feat(ops):` commits landed. Full `npm run quality` (tsc) passes after T4's `src/types/ops.ts` is present.
### Task T4: Types + Zod Schemas + Errors

> Stack: Expo 55 / RN 0.83.4 / React 19.2 / TS strict / NativeWind 4.2 / Supabase. Work dir `uniqn-mobile/`.
> Pure TS layer only (no DB, no UI). Produces the camelCase domain types, the validated-input + read-tolerant Zod schemas, and the ops business-error vocabulary that T5 (repositories) and T6 (services) consume.
> Run every command from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`. Imports use `@/` alias only. `logger` not `console.log`. Korean user messages.

**Files:**

- Create:
  - `src/types/ops.ts` — §7 camelCase interfaces + enum types derived from `Constants`
  - `src/schemas/opsTournament.schema.ts` — create/update input schemas + read-tolerant document schema + parsers
  - `src/schemas/opsParticipant.schema.ts` — register input schema + read-tolerant document schema + parsers
  - `src/schemas/__tests__/opsTournament.schema.test.ts`
  - `src/schemas/__tests__/opsParticipant.schema.test.ts`
  - `src/errors/__tests__/opsErrors.test.ts`
- Modify:
  - `src/errors/AppError.ts` — add `ERROR_CODES` E61xx block + Korean `ERROR_MESSAGES`
  - `src/errors/BusinessErrors.ts` — add 3 ops `AppError` subclasses + 3 type guards
  - `src/errors/index.ts` — export the new classes + guards
- Test:
  - `src/schemas/__tests__/opsTournament.schema.test.ts`
  - `src/schemas/__tests__/opsParticipant.schema.test.ts`
  - `src/errors/__tests__/opsErrors.test.ts`

**Interfaces:**

- Consumes (from T2 — DB RPCs + type regen):
  - `src/types/supabase.ts` regenerated so `Constants.public.Enums` contains `ops_tournament_status: readonly ['upcoming','active','completed']`, `ops_participant_status: readonly ['registered','checked_in','active','busted','no_show']`, `ops_event_type: readonly [...18 values...]`. **HARD PRECONDITION: this T4 will not type-check until T2's `mcp__supabase__generate_typescript_types` step has run and overwritten `src/types/supabase.ts`.** Existing shape (verbatim, current file): `export const Constants = { public: { Enums: { ... } } } as const;`.
  - `xssValidation(text: string): boolean` from `@/utils/security` (returns true when NO XSS pattern present — pass directly to `.refine`).
  - `logger` from `@/utils/logger` (`logger.warn(message, meta)`).
  - `AppError`, `ERROR_CODES`, `ERROR_MESSAGES`, `isAppError` from `./AppError`; module-scope helper `hasErrorName(error, name)` already defined in `BusinessErrors.ts` (reused by new guards).
- Produces (relied on by T5/T6/T8):
  - Types (`@/types/ops`): `OpsTournamentStatus`, `OpsParticipantStatus`, `OpsEventType`, `OpsTournament`, `OpsParticipant`, `OpsEvent`, `OpsPartialStats`.
  - Schemas (`@/schemas/opsTournament.schema`): `opsTournamentStatusSchema`, `opsTournamentCostConfigSchema`, `createOpsTournamentSchema`, `updateOpsTournamentSchema`, `opsTournamentDocumentSchema`, `parseOpsTournamentDocument(data): OpsTournament | null`, `parseOpsTournamentDocuments(data[]): OpsTournament[]`, plus `z.infer` exports `CreateOpsTournamentData`, `UpdateOpsTournamentData`, `OpsTournamentCostConfigData`, `OpsTournamentDocumentData`.
  - Schemas (`@/schemas/opsParticipant.schema`): `opsParticipantStatusSchema`, `registerOpsParticipantSchema`, `opsParticipantDocumentSchema`, `parseOpsParticipantDocument(data): OpsParticipant | null`, `parseOpsParticipantDocuments(data[]): OpsParticipant[]`, plus `z.infer` exports `RegisterOpsParticipantData`, `OpsParticipantDocumentData`.
  - Errors (`@/errors`): `ERROR_CODES.OPS_REGISTRATION_CLOSED|OPS_INVALID_TOURNAMENT_TRANSITION|OPS_PARTICIPANT_NOT_ACTIVE|OPS_TOURNAMENT_NOT_FOUND|OPS_PARTICIPANT_NOT_FOUND`; classes `OpsRegistrationClosedError`, `OpsInvalidTournamentTransitionError`, `OpsParticipantNotActiveError`; guards `isOpsRegistrationClosedError`, `isOpsInvalidTournamentTransitionError`, `isOpsParticipantNotActiveError`. (The `mapOpsRpcError` repository helper that consumes these is T5, NOT here.)

---

- [ ] **Step 1: Create `src/types/ops.ts` (camelCase domain types, enum SSOT from Constants)**

  Copy §7 verbatim. Enum unions are derived from the regenerated `Constants` (single source of truth, mirrors `posting_status`/`application_status` convention).

  ```ts
  /**
   * UNIQN Mobile - 라이브 운영(ops) 도메인 타입
   *
   * @description 토너먼트 운영 슬라이스 1a. camelCase(app) ↔ snake_case(DB) 매핑은 Repository(toCamelCase) 담당.
   * enum 타입은 DB enum(ops_*)을 Constants 단일출처로 파생 — drift 가드.
   * @version 1.0.0
   */

  import { Constants } from '@/types/supabase';

  // ============================================================================
  // Enum unions (DB enum SSOT)
  // ============================================================================

  export type OpsTournamentStatus = (typeof Constants.public.Enums.ops_tournament_status)[number];
  export type OpsParticipantStatus = (typeof Constants.public.Enums.ops_participant_status)[number];
  export type OpsEventType = (typeof Constants.public.Enums.ops_event_type)[number];

  // ============================================================================
  // Domain entities (camelCase)
  // ============================================================================

  export interface OpsTournament {
    id: string;
    ownerId: string;
    jobPostingId?: string | null;
    name: string;
    venue?: string | null;
    eventDate?: string | null;
    gameType: string;
    status: OpsTournamentStatus;
    seatsPerTable: number;
    startingChips: number;
    color?: string | null;
    buyInChips: number;
    rebuyChips: number;
    addonChips: number;
    buyInCost: number;
    feeCost: number;
    rebuyCost: number;
    addonCost: number;
    bountyCost?: number | null;
    registrationOpen: boolean;
    autoSeatOnRegister: boolean;
    reentryAllowed: boolean;
    maxReentries?: number | null;
    monitorToken?: string | null;
    nextEntrySeq: number;
    createdAt: string;
    updatedAt: string;
  }

  // 주의(D8): claim_token / claimToken 필드 없음 — 1a 읽기 경로에서 클라이언트로 절대 노출 금지.
  export interface OpsParticipant {
    id: string;
    tournamentId: string;
    entryNumber: number;
    name: string;
    nationality?: string | null;
    phone?: string | null;
    playerUserId?: string | null;
    status: OpsParticipantStatus;
    chips: number;
    buyInAmount?: number | null;
    rebuys: number;
    addOns: number;
    reentries: number;
    finishPosition?: number | null;
    bustedAt?: string | null;
    prizeAmount?: number | null;
    note?: string | null;
    createdAt: string;
    updatedAt: string;
  }

  export interface OpsEvent {
    id: string;
    tournamentId: string;
    type: OpsEventType;
    actorId?: string | null;
    actorDevice?: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
  }

  // 1a 클라이언트 부분 통계 (D6 — 순수 도메인 함수가 계산). ops_live_stats 테이블 없음.
  export interface OpsPartialStats {
    playing: number;
    entries: number;
    totalChips: number;
    averageStack: number;
    prizePool: number;
  }
  ```

  Verify the type file compiles against the regenerated Constants:

  ```bash
  npx tsc --noEmit
  ```

  Expected: PASS — exit 0, 0 errors. (If it errors with `Property 'ops_tournament_status' does not exist on type ... Enums`, T2's type regeneration has not been applied yet — STOP and complete T2 first.)

- [ ] **Step 2: Write FAILING test for `opsTournament.schema.ts` (valid parse, length, XSS, enum, read-tolerance)**

  Create `src/schemas/__tests__/opsTournament.schema.test.ts`:

  ```ts
  /**
   * T4 — opsTournament zod 스키마 검증
   * - 입력 검증: 길이/XSS/숫자 범위 (DB CHECK 미러)
   * - enum SSOT: ops_tournament_status
   * - read-tolerant 문서 파싱: enum 발산 흡수 + passthrough
   */

  import {
    createOpsTournamentSchema,
    updateOpsTournamentSchema,
    opsTournamentStatusSchema,
    parseOpsTournamentDocument,
  } from '@/schemas/opsTournament.schema';

  const validCreate = {
    name: '강남 데일리 토너먼트',
    venue: '강남 홀덤펍',
    eventDate: '2026-07-01',
    gameType: 'NLH',
    startingChips: 30000,
    seatsPerTable: 9,
    config: {
      buyInChips: 30000,
      rebuyChips: 30000,
      addonChips: 20000,
      buyInCost: 50000,
      feeCost: 5000,
      rebuyCost: 50000,
      addonCost: 30000,
    },
  };

  describe('opsTournament schema (T4)', () => {
    describe('createOpsTournamentSchema', () => {
      it('정상 입력 통과', () => {
        expect(createOpsTournamentSchema.safeParse(validCreate).success).toBe(true);
      });

      it('이름 빈 문자열 거부', () => {
        expect(createOpsTournamentSchema.safeParse({ ...validCreate, name: '' }).success).toBe(
          false
        );
      });

      it('이름 101자 거부 (DB CHECK 1~100)', () => {
        expect(
          createOpsTournamentSchema.safeParse({ ...validCreate, name: 'a'.repeat(101) }).success
        ).toBe(false);
      });

      it('XSS 이름 거부 — script 태그', () => {
        expect(
          createOpsTournamentSchema.safeParse({ ...validCreate, name: '<script>alert(1)</script>' })
            .success
        ).toBe(false);
      });

      it('seatsPerTable 12 거부 (DB CHECK 2~11)', () => {
        expect(
          createOpsTournamentSchema.safeParse({ ...validCreate, seatsPerTable: 12 }).success
        ).toBe(false);
      });

      it('startingChips 음수 거부', () => {
        expect(
          createOpsTournamentSchema.safeParse({ ...validCreate, startingChips: -1 }).success
        ).toBe(false);
      });

      it('이모지 포함 이름 통과 (Unicode 안전)', () => {
        expect(
          createOpsTournamentSchema.safeParse({ ...validCreate, name: '🎰 강남 토너' }).success
        ).toBe(true);
      });
    });

    describe('updateOpsTournamentSchema', () => {
      it('부분 patch 통과', () => {
        expect(updateOpsTournamentSchema.safeParse({ name: '새 이름' }).success).toBe(true);
      });
      it('빈 객체 통과 (전부 optional)', () => {
        expect(updateOpsTournamentSchema.safeParse({}).success).toBe(true);
      });
      it('XSS color 거부', () => {
        expect(updateOpsTournamentSchema.safeParse({ color: 'javascript:void(0)' }).success).toBe(
          false
        );
      });
    });

    describe('opsTournamentStatusSchema (enum SSOT)', () => {
      it("'upcoming'/'active'/'completed' 허용", () => {
        expect(opsTournamentStatusSchema.safeParse('upcoming').success).toBe(true);
        expect(opsTournamentStatusSchema.safeParse('active').success).toBe(true);
        expect(opsTournamentStatusSchema.safeParse('completed').success).toBe(true);
      });
      it('미정의 값 거부', () => {
        expect(opsTournamentStatusSchema.safeParse('archived').success).toBe(false);
      });
    });

    describe('parseOpsTournamentDocument (read-tolerant)', () => {
      const doc = {
        id: 't1',
        ownerId: 'u1',
        name: '대회',
        gameType: 'NLH',
        status: 'active',
        seatsPerTable: 9,
        startingChips: 30000,
        buyInChips: 30000,
        rebuyChips: 30000,
        addonChips: 20000,
        buyInCost: 50000,
        feeCost: 5000,
        rebuyCost: 50000,
        addonCost: 30000,
        registrationOpen: true,
        autoSeatOnRegister: true,
        reentryAllowed: true,
        nextEntrySeq: 3,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      };

      it('정상 문서 → OpsTournament', () => {
        const r = parseOpsTournamentDocument(doc);
        expect(r).not.toBeNull();
        expect(r?.status).toBe('active');
        expect(r?.jobPostingId).toBeNull();
      });

      it('미지 status enum 값에도 레코드 보존 (enum tolerance)', () => {
        const r = parseOpsTournamentDocument({ ...doc, status: 'future_status' });
        expect(r).not.toBeNull();
        expect(r?.status).toBe('upcoming'); // .catch 폴백
      });

      it('알 수 없는 추가 필드 허용 (passthrough)', () => {
        const r = parseOpsTournamentDocument({ ...doc, futureColumn: 123 });
        expect(r).not.toBeNull();
      });

      it('필수 필드(id) 누락 → null', () => {
        const { id: _omit, ...rest } = doc;
        expect(parseOpsTournamentDocument(rest)).toBeNull();
      });
    });
  });
  ```

  Run it (module does not exist yet):

  ```bash
  npx jest src/schemas/__tests__/opsTournament.schema.test.ts
  ```

  Expected: FAIL — `Cannot find module '@/schemas/opsTournament.schema'`.

- [ ] **Step 3: Implement `src/schemas/opsTournament.schema.ts` (GREEN)**

  Mirrors `workspace.schema.ts` (xss field schema), `application.schema.ts` (`z.enum(Constants...)` SSOT), and `workLog.schema.ts` (`.catch()` + `.passthrough()` document parser). Create `src/schemas/opsTournament.schema.ts`:

  ```ts
  /**
   * UNIQN Mobile - 라이브 운영(ops) 토너먼트 Zod 스키마
   *
   * @version 1.0.0  (Zod 4.x 호환)
   * @description
   * - 입력 스키마: 모든 사용자 문자열에 xssValidation refine + DB CHECK 미러 길이/범위
   * - enum SSOT: z.enum(Constants.public.Enums.ops_tournament_status) — 인라인 하드코딩 금지(drift 가드)
   * - read-tolerant 문서 스키마: enum 발산을 .catch()로 흡수 + .passthrough()로 미래 컬럼 허용
   */

  import { z } from 'zod';
  import { logger } from '@/utils/logger';
  import { xssValidation } from '@/utils/security';
  import { Constants } from '@/types/supabase';
  import type { OpsTournament } from '@/types/ops';

  // ============================================================================
  // Enums (DB enum SSOT)
  // ============================================================================

  export const opsTournamentStatusSchema = z.enum(Constants.public.Enums.ops_tournament_status, {
    error: '올바른 대회 상태가 아닙니다',
  });
  export type OpsTournamentStatusSchema = z.infer<typeof opsTournamentStatusSchema>;

  // ============================================================================
  // Field schemas (DB CHECK 미러 + XSS)
  // ============================================================================

  export const opsTournamentNameSchema = z
    .string({ error: '대회 이름을 입력해주세요' })
    .trim()
    .min(1, { message: '대회 이름을 입력해주세요' })
    .max(100, { message: '대회 이름은 100자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

  export const opsVenueSchema = z
    .string()
    .trim()
    .max(100, { message: '장소는 100자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

  export const opsGameTypeSchema = z
    .string()
    .trim()
    .min(1, { message: '게임 종류를 입력해주세요' })
    .max(20, { message: '게임 종류는 20자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

  export const opsColorSchema = z
    .string()
    .trim()
    .max(20, { message: '색상 값은 20자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

  export const opsEventDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' });

  // ============================================================================
  // 비용/칩 설정 (CreateOpsTournamentInput.config 미러)
  // ============================================================================

  export const opsTournamentCostConfigSchema = z.object({
    buyInChips: z.number().int().min(0, { message: '바이인 칩은 0 이상이어야 합니다' }),
    rebuyChips: z.number().int().min(0, { message: '리바이 칩은 0 이상이어야 합니다' }),
    addonChips: z.number().int().min(0, { message: '애드온 칩은 0 이상이어야 합니다' }),
    buyInCost: z.number().int().min(0, { message: '바이인 비용은 0 이상이어야 합니다' }),
    feeCost: z.number().int().min(0, { message: '수수료는 0 이상이어야 합니다' }),
    rebuyCost: z.number().int().min(0, { message: '리바이 비용은 0 이상이어야 합니다' }),
    addonCost: z.number().int().min(0, { message: '애드온 비용은 0 이상이어야 합니다' }),
  });
  export type OpsTournamentCostConfigData = z.infer<typeof opsTournamentCostConfigSchema>;

  // ============================================================================
  // 생성 / 수정 입력 (Service 진입점에서 safeParse)
  // ============================================================================

  // owner_id / actor_id 는 인증 컨텍스트에서 주입 — 입력 받지 않음.
  export const createOpsTournamentSchema = z.object({
    name: opsTournamentNameSchema,
    venue: opsVenueSchema.optional(),
    eventDate: opsEventDateSchema.optional(),
    gameType: opsGameTypeSchema,
    jobPostingId: z.string().uuid({ message: '올바른 공고 ID가 아닙니다' }).optional(),
    startingChips: z.number().int().min(0, { message: '시작 칩은 0 이상이어야 합니다' }),
    seatsPerTable: z
      .number()
      .int()
      .min(2, { message: '테이블 좌석 수는 2 이상이어야 합니다' })
      .max(11, { message: '테이블 좌석 수는 11을 초과할 수 없습니다' }),
    config: opsTournamentCostConfigSchema,
  });
  export type CreateOpsTournamentData = z.infer<typeof createOpsTournamentSchema>;

  export const updateOpsTournamentSchema = z.object({
    name: opsTournamentNameSchema.optional(),
    venue: opsVenueSchema.optional(),
    eventDate: opsEventDateSchema.optional(),
    gameType: opsGameTypeSchema.optional(),
    startingChips: z.number().int().min(0).optional(),
    seatsPerTable: z.number().int().min(2).max(11).optional(),
    color: opsColorSchema.optional(),
    buyInChips: z.number().int().min(0).optional(),
    rebuyChips: z.number().int().min(0).optional(),
    addonChips: z.number().int().min(0).optional(),
    buyInCost: z.number().int().min(0).optional(),
    feeCost: z.number().int().min(0).optional(),
    rebuyCost: z.number().int().min(0).optional(),
    addonCost: z.number().int().min(0).optional(),
  });
  export type UpdateOpsTournamentData = z.infer<typeof updateOpsTournamentSchema>;

  // ============================================================================
  // 읽기 문서 스키마 (런타임 타입 검증, camelCase — Repository toCamelCase 이후 파싱)
  // ============================================================================

  /**
   * .catch(): 미지 enum 값(DB enum 발산)에도 레코드가 drop되지 않도록 폴백으로 흡수.
   * .passthrough(): 후속 슬라이스가 추가하는 컬럼에도 read가 깨지지 않도록 허용.
   * (메모리 교훈: enum 발산 → 읽기 증발 회귀 방지)
   */
  export const opsTournamentDocumentSchema = z
    .object({
      id: z.string(),
      ownerId: z.string(),
      jobPostingId: z.string().nullable().optional(),
      name: z.string(),
      venue: z.string().nullable().optional(),
      eventDate: z.string().nullable().optional(),
      gameType: z.string().catch('NLH'),
      status: opsTournamentStatusSchema.catch('upcoming'),
      seatsPerTable: z.number().catch(9),
      startingChips: z.number().catch(0),
      color: z.string().nullable().optional(),
      buyInChips: z.number().catch(0),
      rebuyChips: z.number().catch(0),
      addonChips: z.number().catch(0),
      buyInCost: z.number().catch(0),
      feeCost: z.number().catch(0),
      rebuyCost: z.number().catch(0),
      addonCost: z.number().catch(0),
      bountyCost: z.number().nullable().optional(),
      registrationOpen: z.boolean().catch(true),
      autoSeatOnRegister: z.boolean().catch(true),
      reentryAllowed: z.boolean().catch(true),
      maxReentries: z.number().nullable().optional(),
      monitorToken: z.string().nullable().optional(),
      nextEntrySeq: z.number().catch(0),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
    .passthrough();
  export type OpsTournamentDocumentData = z.infer<typeof opsTournamentDocumentSchema>;

  export function parseOpsTournamentDocument(data: unknown): OpsTournament | null {
    const result = opsTournamentDocumentSchema.safeParse(data);
    if (!result.success) {
      logger.warn('OpsTournament 문서 검증 실패', {
        errors: result.error.flatten(),
        component: 'opsTournament.schema',
      });
      return null;
    }
    const d = result.data;
    return {
      id: d.id,
      ownerId: d.ownerId,
      jobPostingId: d.jobPostingId ?? null,
      name: d.name,
      venue: d.venue ?? null,
      eventDate: d.eventDate ?? null,
      gameType: d.gameType,
      status: d.status,
      seatsPerTable: d.seatsPerTable,
      startingChips: d.startingChips,
      color: d.color ?? null,
      buyInChips: d.buyInChips,
      rebuyChips: d.rebuyChips,
      addonChips: d.addonChips,
      buyInCost: d.buyInCost,
      feeCost: d.feeCost,
      rebuyCost: d.rebuyCost,
      addonCost: d.addonCost,
      bountyCost: d.bountyCost ?? null,
      registrationOpen: d.registrationOpen,
      autoSeatOnRegister: d.autoSeatOnRegister,
      reentryAllowed: d.reentryAllowed,
      maxReentries: d.maxReentries ?? null,
      monitorToken: d.monitorToken ?? null,
      nextEntrySeq: d.nextEntrySeq,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  export function parseOpsTournamentDocuments(data: unknown[]): OpsTournament[] {
    return data
      .map((item) => parseOpsTournamentDocument(item))
      .filter((item): item is OpsTournament => item !== null);
  }
  ```

  Run the test:

  ```bash
  npx jest src/schemas/__tests__/opsTournament.schema.test.ts
  ```

  Expected: PASS — all suites green (e.g. `Tests: 18 passed`).

- [ ] **Step 4: Write FAILING test for `opsParticipant.schema.ts`**

  Create `src/schemas/__tests__/opsParticipant.schema.test.ts`:

  ```ts
  /**
   * T4 — opsParticipant zod 스키마 검증
   * - 등록 입력: UUID/길이(DB CHECK 1~50)/XSS/숫자 범위
   * - enum SSOT: ops_participant_status (5개 값)
   * - read-tolerant 문서 파싱: enum 발산 흡수 + claim_token 절대 미노출(D8)
   */

  import {
    registerOpsParticipantSchema,
    opsParticipantStatusSchema,
    parseOpsParticipantDocument,
  } from '@/schemas/opsParticipant.schema';

  const validRegister = {
    tournamentId: '123e4567-e89b-42d3-a456-426614174000',
    name: '홍길동',
    nationality: 'KR',
    phone: '010-1234-5678',
    buyInAmount: 50000,
  };

  describe('opsParticipant schema (T4)', () => {
    describe('registerOpsParticipantSchema', () => {
      it('정상 입력 통과', () => {
        expect(registerOpsParticipantSchema.safeParse(validRegister).success).toBe(true);
      });

      it('이름만 있어도 통과 (optional 필드 생략)', () => {
        expect(
          registerOpsParticipantSchema.safeParse({
            tournamentId: validRegister.tournamentId,
            name: '익명',
          }).success
        ).toBe(true);
      });

      it('tournamentId 비-UUID 거부', () => {
        expect(
          registerOpsParticipantSchema.safeParse({ ...validRegister, tournamentId: 'nope' }).success
        ).toBe(false);
      });

      it('이름 빈 문자열 거부', () => {
        expect(registerOpsParticipantSchema.safeParse({ ...validRegister, name: '' }).success).toBe(
          false
        );
      });

      it('이름 51자 거부 (DB CHECK 1~50)', () => {
        expect(
          registerOpsParticipantSchema.safeParse({ ...validRegister, name: 'a'.repeat(51) }).success
        ).toBe(false);
      });

      it('XSS 이름 거부 — svg onload', () => {
        expect(
          registerOpsParticipantSchema.safeParse({
            ...validRegister,
            name: '<svg onload=alert(1)>',
          }).success
        ).toBe(false);
      });

      it('buyInAmount 음수 거부', () => {
        expect(
          registerOpsParticipantSchema.safeParse({ ...validRegister, buyInAmount: -1 }).success
        ).toBe(false);
      });
    });

    describe('opsParticipantStatusSchema (enum SSOT)', () => {
      it('5개 값 허용', () => {
        for (const s of ['registered', 'checked_in', 'active', 'busted', 'no_show']) {
          expect(opsParticipantStatusSchema.safeParse(s).success).toBe(true);
        }
      });
      it('미정의 값 거부', () => {
        expect(opsParticipantStatusSchema.safeParse('eliminated').success).toBe(false);
      });
    });

    describe('parseOpsParticipantDocument (read-tolerant)', () => {
      const doc = {
        id: 'p1',
        tournamentId: 't1',
        entryNumber: 1,
        name: '홍길동',
        status: 'active',
        chips: 30000,
        rebuys: 0,
        addOns: 0,
        reentries: 0,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      };

      it('정상 문서 → OpsParticipant (claimToken 없음)', () => {
        const r = parseOpsParticipantDocument(doc);
        expect(r).not.toBeNull();
        expect(r?.entryNumber).toBe(1);
        expect(r).not.toHaveProperty('claimToken');
      });

      it('미지 status enum 값에도 레코드 보존 (enum tolerance)', () => {
        const r = parseOpsParticipantDocument({ ...doc, status: 'eliminated' });
        expect(r).not.toBeNull();
        expect(r?.status).toBe('active'); // .catch 폴백
      });

      it('claim_token 누설 방어 — passthrough 허용하되 결과엔 미포함(D8)', () => {
        const r = parseOpsParticipantDocument({ ...doc, claim_token: 'secret' });
        expect(r).not.toBeNull();
        expect(r).not.toHaveProperty('claim_token');
        expect(r).not.toHaveProperty('claimToken');
      });

      it('필수 필드(name) 누락 → null', () => {
        const { name: _omit, ...rest } = doc;
        expect(parseOpsParticipantDocument(rest)).toBeNull();
      });
    });
  });
  ```

  Run it:

  ```bash
  npx jest src/schemas/__tests__/opsParticipant.schema.test.ts
  ```

  Expected: FAIL — `Cannot find module '@/schemas/opsParticipant.schema'`.

- [ ] **Step 5: Implement `src/schemas/opsParticipant.schema.ts` (GREEN)**

  Create `src/schemas/opsParticipant.schema.ts`. The document parser builds the return object field-by-field so `claim_token` (D8) never reaches the client even though `.passthrough()` keeps it in `result.data`:

  ```ts
  /**
   * UNIQN Mobile - 라이브 운영(ops) 참가자 Zod 스키마
   *
   * @version 1.0.0  (Zod 4.x 호환)
   * @description
   * - 등록 입력: 모든 사용자 문자열에 xssValidation refine + DB CHECK 미러
   * - enum SSOT: z.enum(Constants.public.Enums.ops_participant_status)
   * - read-tolerant 문서 스키마: .catch()로 enum 발산 흡수 + .passthrough()
   * - D8: claim_token 은 읽기 결과에 절대 포함하지 않음(파서가 화이트리스트 매핑)
   */

  import { z } from 'zod';
  import { logger } from '@/utils/logger';
  import { xssValidation } from '@/utils/security';
  import { Constants } from '@/types/supabase';
  import type { OpsParticipant } from '@/types/ops';

  // ============================================================================
  // Enums (DB enum SSOT)
  // ============================================================================

  export const opsParticipantStatusSchema = z.enum(
    Constants.public.Enums.ops_participant_status,
    { error: '올바른 참가자 상태가 아닙니다' }
  );
  export type OpsParticipantStatusSchema = z.infer<typeof opsParticipantStatusSchema>;

  // ============================================================================
  // Field schemas (DB CHECK 미러 + XSS)
  // ============================================================================

  export const opsParticipantNameSchema = z
    .string({ error: '참가자 이름을 입력해주세요' })
    .trim()
    .min(1, { message: '참가자 이름을 입력해주세요' })
    .max(50, { message: '참가자 이름은 50자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

  export const opsNationalitySchema = z
    .string()
    .trim()
    .max(50, { message: '국적은 50자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

  export const opsPhoneSchema = z
    .string()
    .trim()
    .max(25, { message: '연락처는 25자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

  // ============================================================================
  // 등록 입력 (Service 진입점에서 safeParse) — 1a 워크인 등록(D2)
  // ============================================================================

  export const registerOpsParticipantSchema = z.object({
    tournamentId: z.string().uuid({ message: '올바른 대회 ID가 아닙니다' }),
    name: opsParticipantNameSchema,
    nationality: opsNationalitySchema.optional(),
    phone: opsPhoneSchema.optional(),
    buyInAmount: z
      .number()
      .int()
      .min(0, { message: '바이인 금액은 0 이상이어야 합니다' })
      .optional(),
  });
  export type RegisterOpsParticipantData = z.infer<typeof registerOpsParticipantSchema>;

  // ============================================================================
  // 읽기 문서 스키마 (런타임 타입 검증, camelCase — Repository toCamelCase 이후 파싱)
  // ============================================================================

  // 주의(D8): claim_token / playerUserId write 경로는 1c-4까지 inert. 읽기 결과엔 claim_token 미포함.
  export const opsParticipantDocumentSchema = z
    .object({
      id: z.string(),
      tournamentId: z.string(),
      entryNumber: z.number(),
      name: z.string(),
      nationality: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      playerUserId: z.string().nullable().optional(),
      status: opsParticipantStatusSchema.catch('active'),
      chips: z.number().catch(0),
      buyInAmount: z.number().nullable().optional(),
      rebuys: z.number().catch(0),
      addOns: z.number().catch(0),
      reentries: z.number().catch(0),
      finishPosition: z.number().nullable().optional(),
      bustedAt: z.string().nullable().optional(),
      prizeAmount: z.number().nullable().optional(),
      note: z.string().nullable().optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
    .passthrough();
  export type OpsParticipantDocumentData = z.infer<typeof opsParticipantDocumentSchema>;

  export function parseOpsParticipantDocument(data: unknown): OpsParticipant | null {
    const result = opsParticipantDocumentSchema.safeParse(data);
    if (!result.success) {
      logger.warn('OpsParticipant 문서 검증 실패', {
        errors: result.error.flatten(),
        component: 'opsParticipant.schema',
      });
      return null;
    }
    const d = result.data;
    // 화이트리스트 매핑 — passthrough 로 흘러든 claim_token 등은 의도적으로 버린다(D8).
    return {
      id: d.id,
      tournamentId: d.tournamentId,
      entryNumber: d.entryNumber,
      name: d.name,
      nationality: d.nationality ?? null,
      phone: d.phone ?? null,
      playerUserId: d.playerUserId ?? null,
      status: d.status,
      chips: d.chips,
      buyInAmount: d.buyInAmount ?? null,
      rebuys: d.rebuys,
      addOns: d.addOns,
      reentries: d.reentries,
      finishPosition: d.finishPosition ?? null,
      bustedAt: d.bustedAt ?? null,
      prizeAmount: d.prizeAmount ?? null,
      note: d.note ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  export function parseOpsParticipantDocuments(data: unknown[]): OpsParticipant[] {
    return data
      .map((item) => parseOpsParticipantDocument(item))
      .filter((item): item is OpsParticipant => item !== null);
  }
  ```

  Run the test:

  ```bash
  npx jest src/schemas/__tests__/opsParticipant.schema.test.ts
  ```

  Expected: PASS — all suites green (e.g. `Tests: 14 passed`).

- [ ] **Step 6: Commit types + schemas**

  ```bash
  npx tsc --noEmit && git add src/types/ops.ts src/schemas/opsTournament.schema.ts src/schemas/opsParticipant.schema.ts src/schemas/__tests__/opsTournament.schema.test.ts src/schemas/__tests__/opsParticipant.schema.test.ts && git commit -m "feat(ops): 운영 도메인 타입 + 토너먼트/참가자 zod 스키마 추가"
  ```

  Expected: `tsc` exit 0, commit created (5 files changed).

- [ ] **Step 7: Write FAILING test for ops business errors**

  Mirrors `src/errors/__tests__/BusinessErrors.test.ts` idiom. Create `src/errors/__tests__/opsErrors.test.ts`:

  ```ts
  /**
   * T4 — 라이브 운영(ops) 비즈니스 에러 단위 테스트
   * - E61xx 코드 + 한글 메시지 매핑
   * - 3개 AppError 서브클래스(code/category/userMessage/name) + type guard
   */

  import { ERROR_CODES, ERROR_MESSAGES } from '../AppError';
  import {
    OpsRegistrationClosedError,
    OpsInvalidTournamentTransitionError,
    OpsParticipantNotActiveError,
    isOpsRegistrationClosedError,
    isOpsInvalidTournamentTransitionError,
    isOpsParticipantNotActiveError,
  } from '../BusinessErrors';

  describe('라이브 운영(ops) 비즈니스 에러', () => {
    it('OPS 에러 코드가 E61xx 범위로 정의되어 있다', () => {
      expect(ERROR_CODES.OPS_REGISTRATION_CLOSED).toBe('E6101');
      expect(ERROR_CODES.OPS_INVALID_TOURNAMENT_TRANSITION).toBe('E6102');
      expect(ERROR_CODES.OPS_PARTICIPANT_NOT_ACTIVE).toBe('E6103');
      expect(ERROR_CODES.OPS_TOURNAMENT_NOT_FOUND).toBe('E6104');
      expect(ERROR_CODES.OPS_PARTICIPANT_NOT_FOUND).toBe('E6105');
    });

    it('각 OPS 코드에 한글 메시지가 매핑되어 있다', () => {
      expect(ERROR_MESSAGES[ERROR_CODES.OPS_REGISTRATION_CLOSED]).toBe('등록이 마감되었습니다');
      expect(ERROR_MESSAGES[ERROR_CODES.OPS_PARTICIPANT_NOT_ACTIVE]).toBe(
        '진행 중인 참가자만 처리할 수 있습니다'
      );
      expect(ERROR_MESSAGES[ERROR_CODES.OPS_TOURNAMENT_NOT_FOUND]).toBe('대회를 찾을 수 없습니다');
    });

    describe('OpsRegistrationClosedError', () => {
      it('코드 E6101, category business, 한글 userMessage, name', () => {
        const e = new OpsRegistrationClosedError();
        expect(e.code).toBe(ERROR_CODES.OPS_REGISTRATION_CLOSED);
        expect(e.category).toBe('business');
        expect(e.userMessage).toBe('등록이 마감되었습니다');
        expect(e.name).toBe('OpsRegistrationClosedError');
      });
      it('type guard 가 true / 일반 Error 는 false', () => {
        expect(isOpsRegistrationClosedError(new OpsRegistrationClosedError())).toBe(true);
        expect(isOpsRegistrationClosedError(new Error('x'))).toBe(false);
      });
    });

    describe('OpsInvalidTournamentTransitionError', () => {
      it('코드 E6102 + metadata from/to + type guard', () => {
        const e = new OpsInvalidTournamentTransitionError({ from: 'completed', to: 'active' });
        expect(e.code).toBe(ERROR_CODES.OPS_INVALID_TOURNAMENT_TRANSITION);
        expect(e.metadata).toEqual({ from: 'completed', to: 'active' });
        expect(isOpsInvalidTournamentTransitionError(e)).toBe(true);
      });
    });

    describe('OpsParticipantNotActiveError', () => {
      it('코드 E6103 + metadata participantId + type guard', () => {
        const e = new OpsParticipantNotActiveError({ participantId: 'p1' });
        expect(e.code).toBe(ERROR_CODES.OPS_PARTICIPANT_NOT_ACTIVE);
        expect(e.metadata).toEqual({ participantId: 'p1' });
        expect(isOpsParticipantNotActiveError(e)).toBe(true);
      });
    });
  });
  ```

  Run it:

  ```bash
  npx jest src/errors/__tests__/opsErrors.test.ts
  ```

  Expected: FAIL — TS/runtime error: `Property 'OPS_REGISTRATION_CLOSED' does not exist` and `OpsRegistrationClosedError is not exported`.

- [ ] **Step 8: Add ops `ERROR_CODES` + Korean `ERROR_MESSAGES` to `AppError.ts`**

  Edit `src/errors/AppError.ts`. Insert the E61xx code block right before the unknown-error code. Find:

  ```ts
    BUSINESS_EMPLOYER_APP_NOT_FOUND: 'E6073', // 신청 내역 없음

    // 알 수 없는 에러 (E7xxx)
    UNKNOWN: 'E7000',
  ```

  Replace with:

  ```ts
    BUSINESS_EMPLOYER_APP_NOT_FOUND: 'E6073', // 신청 내역 없음

    // 라이브 운영(ops) 관련 (E61xx)
    OPS_REGISTRATION_CLOSED: 'E6101',
    OPS_INVALID_TOURNAMENT_TRANSITION: 'E6102',
    OPS_PARTICIPANT_NOT_ACTIVE: 'E6103',
    OPS_TOURNAMENT_NOT_FOUND: 'E6104',
    OPS_PARTICIPANT_NOT_FOUND: 'E6105',

    // 알 수 없는 에러 (E7xxx)
    UNKNOWN: 'E7000',
  ```

  Then insert the Korean messages. Find:

  ```ts
    [ERROR_CODES.BUSINESS_EMPLOYER_APP_NOT_FOUND]: '구인자 신청 내역을 찾을 수 없습니다',
    // 알 수 없는 에러
    [ERROR_CODES.UNKNOWN]: '알 수 없는 오류가 발생했습니다',
  ```

  Replace with:

  ```ts
    [ERROR_CODES.BUSINESS_EMPLOYER_APP_NOT_FOUND]: '구인자 신청 내역을 찾을 수 없습니다',

    // 라이브 운영(ops) 관련
    [ERROR_CODES.OPS_REGISTRATION_CLOSED]: '등록이 마감되었습니다',
    [ERROR_CODES.OPS_INVALID_TOURNAMENT_TRANSITION]: '현재 상태에서는 변경할 수 없습니다',
    [ERROR_CODES.OPS_PARTICIPANT_NOT_ACTIVE]: '진행 중인 참가자만 처리할 수 있습니다',
    [ERROR_CODES.OPS_TOURNAMENT_NOT_FOUND]: '대회를 찾을 수 없습니다',
    [ERROR_CODES.OPS_PARTICIPANT_NOT_FOUND]: '참가자를 찾을 수 없습니다',
    // 알 수 없는 에러
    [ERROR_CODES.UNKNOWN]: '알 수 없는 오류가 발생했습니다',
  ```

  (No command yet — Step 10 runs the errors test after the classes land.)

- [ ] **Step 9: Add 3 ops business-error subclasses + type guards to `BusinessErrors.ts`**

  Append to the END of `src/errors/BusinessErrors.ts` (after `UnauthorizedReviewError`, line ~767). Reuses the module-scope `hasErrorName` helper already defined above (line ~445) and the existing `AppError` + `ERROR_CODES` import at the top:

  ```ts
  // ============================================================================
  // 라이브 운영(ops) 관련 에러
  // ============================================================================

  /**
   * 등록 마감 에러 (RPC: REGISTRATION_CLOSED)
   */
  export class OpsRegistrationClosedError extends AppError {
    constructor(options?: Partial<{ message: string; userMessage: string; tournamentId: string }>) {
      super({
        code: ERROR_CODES.OPS_REGISTRATION_CLOSED,
        category: 'business',
        severity: 'low',
        isRetryable: false,
        message: options?.message,
        userMessage: options?.userMessage,
        metadata: { tournamentId: options?.tournamentId },
      });
      this.name = 'OpsRegistrationClosedError';
      Object.setPrototypeOf(this, OpsRegistrationClosedError.prototype);
    }
  }

  /**
   * 대회 상태 전이 불가 에러 (RPC: INVALID_STATUS)
   */
  export class OpsInvalidTournamentTransitionError extends AppError {
    constructor(
      options?: Partial<{ message: string; userMessage: string; from: string; to: string }>
    ) {
      super({
        code: ERROR_CODES.OPS_INVALID_TOURNAMENT_TRANSITION,
        category: 'business',
        severity: 'low',
        isRetryable: false,
        message: options?.message,
        userMessage: options?.userMessage,
        metadata: { from: options?.from, to: options?.to },
      });
      this.name = 'OpsInvalidTournamentTransitionError';
      Object.setPrototypeOf(this, OpsInvalidTournamentTransitionError.prototype);
    }
  }

  /**
   * 참가자 비활성 상태 에러 (RPC: PARTICIPANT_NOT_ACTIVE)
   */
  export class OpsParticipantNotActiveError extends AppError {
    constructor(
      options?: Partial<{ message: string; userMessage: string; participantId: string }>
    ) {
      super({
        code: ERROR_CODES.OPS_PARTICIPANT_NOT_ACTIVE,
        category: 'business',
        severity: 'low',
        isRetryable: false,
        message: options?.message,
        userMessage: options?.userMessage,
        metadata: { participantId: options?.participantId },
      });
      this.name = 'OpsParticipantNotActiveError';
      Object.setPrototypeOf(this, OpsParticipantNotActiveError.prototype);
    }
  }

  // Type Guards - 라이브 운영(ops) 관련
  export const isOpsRegistrationClosedError = (
    error: unknown
  ): error is OpsRegistrationClosedError => {
    return (
      error instanceof OpsRegistrationClosedError ||
      hasErrorName(error, 'OpsRegistrationClosedError')
    );
  };

  export const isOpsInvalidTournamentTransitionError = (
    error: unknown
  ): error is OpsInvalidTournamentTransitionError => {
    return (
      error instanceof OpsInvalidTournamentTransitionError ||
      hasErrorName(error, 'OpsInvalidTournamentTransitionError')
    );
  };

  export const isOpsParticipantNotActiveError = (
    error: unknown
  ): error is OpsParticipantNotActiveError => {
    return (
      error instanceof OpsParticipantNotActiveError ||
      hasErrorName(error, 'OpsParticipantNotActiveError')
    );
  };
  ```

- [ ] **Step 10: Export ops errors from `errors/index.ts`, then run errors test (GREEN)**

  Edit `src/errors/index.ts`. In the `from './BusinessErrors'` export block, find:

  ```ts
    isReportAlreadyReviewedError,
    isCannotReportSelfError,
  } from './BusinessErrors';
  ```

  Replace with:

  ```ts
    isReportAlreadyReviewedError,
    isCannotReportSelfError,
    // 라이브 운영(ops) 관련
    OpsRegistrationClosedError,
    OpsInvalidTournamentTransitionError,
    OpsParticipantNotActiveError,
    isOpsRegistrationClosedError,
    isOpsInvalidTournamentTransitionError,
    isOpsParticipantNotActiveError,
  } from './BusinessErrors';
  ```

  Run the errors test:

  ```bash
  npx jest src/errors/__tests__/opsErrors.test.ts
  ```

  Expected: PASS — all suites green (e.g. `Tests: 6 passed`).

- [ ] **Step 11: Full quality gate + commit errors**

  Run the TS gate over the whole package plus the three new test files together:

  ```bash
  npx tsc --noEmit && npx jest src/schemas/__tests__/opsTournament.schema.test.ts src/schemas/__tests__/opsParticipant.schema.test.ts src/errors/__tests__/opsErrors.test.ts
  ```

  Expected: `tsc` exit 0 (0 errors); jest `Test Suites: 3 passed, 3 total`.

  Then commit:

  ```bash
  git add src/errors/AppError.ts src/errors/BusinessErrors.ts src/errors/index.ts src/errors/__tests__/opsErrors.test.ts && git commit -m "feat(ops): 운영 비즈니스 에러 코드(E61xx) + 에러 클래스/타입가드 추가"
  ```

  Expected: commit created (4 files changed). Task T4 done — T5 (repositories) can now import `@/types/ops`, the schema parsers, and the ops error classes (and will add `mapOpsRpcError` consuming these codes).

---

**Notes / gates carried forward:**

- This task is pure TS — no migrations, no `npm run db:reset`, no `npm run test:db`. Those belong to T1/T2/T10.
- `src/types/ops.ts` will NOT compile until T2 has regenerated `src/types/supabase.ts` with the `ops_*` enums (Consumes T2). The T4 worktree must be rebased on / sequenced after T2.
- `mapOpsRpcError` is intentionally OUT of scope here (it is a Repository helper → T5), but every error code/class it needs is produced by this task.
- Final whole-repo `npm run quality` (css-vars + type-check + lint + format:check) is run at the integration gate; the per-file `npx tsc --noEmit` + targeted `npx jest` above are the T4-local evidence.
### Task T5: Repositories (Ops Tournament + Participant)

This task adds the Repository layer for the Live Ops slice: two interfaces with their input DTOs, two Supabase implementations (explicit snake_case column allowlists that OMIT `claim_token`, `toCamelCase` row mappers, SECDEF-RPC writes through `supabase.rpc` with `mapOpsRpcError`, and a NULL-SAFE `findByJobPostingId`), plus barrel registration of the two singletons. Repositories are thin wrappers integration-tested by pgTAP (T10); the T5 gate is the TypeScript compiler (`npm run type-check`) followed by `npm run quality`. Per D5 there are **no Mock repositories**.

Work dir for every command: `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`.

**Files:**
- Create: `src/repositories/interfaces/IOpsTournamentRepository.ts`
- Create: `src/repositories/interfaces/IOpsParticipantRepository.ts`
- Create: `src/repositories/supabase/OpsTournamentRepository.ts`
- Create: `src/repositories/supabase/OpsParticipantRepository.ts`
- Modify: `src/repositories/interfaces/index.ts` (register interface + DTO type exports)
- Modify: `src/repositories/supabase/index.ts` (register impl classes + singletons)
- Modify: `src/repositories/index.ts` (re-export DTO types + singletons `opsTournamentRepository` / `opsParticipantRepository`)
- Test: pgTAP (T10) — `supabase/tests/ops_rpc_security.test.sql`, `ops_entry_number_allocation.test.sql`; the in-task gate is `npm run type-check` + `npm run quality` (no Jest unit test — thin wrappers).

**Interfaces:**

Consumes (must already exist from earlier tasks):
- T4 `@/types/ops`: `OpsTournament`, `OpsParticipant`, `OpsTournamentStatus` (string-literal union types; field shapes per contracts §7 — `OpsParticipant` has NO `claimToken` field).
- T4 `@/errors/BusinessErrors`: `OpsRegistrationClosedError`, `OpsInvalidTournamentTransitionError`, `OpsParticipantNotActiveError` (each `extends AppError`, ctor `(options?: Partial<{ message: string; userMessage: string }>)`).
- T4 `@/errors` `ERROR_CODES`: `OPS_TOURNAMENT_NOT_FOUND` (`'E6104'`), `OPS_PARTICIPANT_NOT_FOUND` (`'E6105'`), and the pre-existing `INFRA_PERMISSION_DENIED`.
- T2 SECDEF RPCs (exact param names): `ops_create_tournament(p_owner_id, p_name, p_venue, p_event_date, p_game_type, p_job_posting_id, p_starting_chips, p_seats_per_table, p_config jsonb) → {tournament_id}`; `ops_update_tournament(p_tournament_id, p_actor_id, p_patch jsonb)`; `ops_set_tournament_status(p_tournament_id, p_actor_id, p_status)`; `ops_register_participant(p_tournament_id, p_actor_id, p_name, p_nationality, p_phone, p_buy_in_amount) → {participant_id, entry_number}`; `ops_add_rebuy(p_participant_id, p_actor_id)`; `ops_add_addon(p_participant_id, p_actor_id)`; `ops_toggle_registration(p_tournament_id, p_actor_id, p_open)`. RPC RAISE prefixes (all `ERRCODE='P0001'`): `PERMISSION_DENIED`, `REGISTRATION_CLOSED`, `INVALID_STATUS`, `PARTICIPANT_NOT_ACTIVE`, `TOURNAMENT_NOT_FOUND`, `PARTICIPANT_NOT_FOUND`. Regenerated `src/types/supabase.ts` (so `supabase.rpc('ops_*')` typechecks).
- `@/utils/supabase`: `handleSupabaseError`, `toCamelCase`, `toSnakeCase`. `@/lib/supabase`: `supabase`. `@/utils/logger`: `logger`. `@/errors`: `isAppError`, `toError`, `BusinessError`, `PermissionError`, `ERROR_CODES`.

Produces (later tasks rely on these exact names):
- `interface IOpsTournamentRepository` + DTOs `OpsTournamentCostConfig`, `CreateOpsTournamentInput`, `UpdateOpsTournamentPatch`.
- `interface IOpsParticipantRepository` + DTO `RegisterParticipantInput`.
- Classes `SupabaseOpsTournamentRepository`, `SupabaseOpsParticipantRepository`.
- Singletons `opsTournamentRepository`, `opsParticipantRepository` exported from `@/repositories` (T6 services + T7 read-hooks consume).
- `mapOpsRpcError(error: unknown): never` exported from `OpsTournamentRepository.ts` (reused by the participant repo).

---

- [ ] **Step 1: Write the tournament interface + DTOs (`IOpsTournamentRepository.ts`)**

  Create `src/repositories/interfaces/IOpsTournamentRepository.ts` verbatim:

  ```ts
  /**
   * UNIQN Mobile - Ops Tournament Repository Interface
   *
   * @description 라이브 대회 운영 — ops_tournaments 데이터 접근 추상화 (Slice 1a)
   * @version 1.0.0
   *
   * 구현체: SupabaseOpsTournamentRepository (프로덕션 전용 — D5: Mock 없음)
   * - 읽기: SELECT-only RLS 경유 (TanStack 읽기 전용 예외로 Repository 직접 호출 허용)
   * - 쓰기: 모든 변경은 SECDEF RPC (D3) — 직접 INSERT/UPDATE/DELETE 경로 없음
   */

  import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';

  // ============================================================================
  // Input DTOs
  // ============================================================================

  /** 대회 생성 시 비용/칩 설정 (RPC p_config jsonb 로 직렬화) */
  export interface OpsTournamentCostConfig {
    buyInChips: number;
    rebuyChips: number;
    addonChips: number;
    buyInCost: number;
    feeCost: number;
    rebuyCost: number;
    addonCost: number;
  }

  /** 대회 생성 입력 (서비스 → Repository) */
  export interface CreateOpsTournamentInput {
    name: string;
    venue?: string;
    eventDate?: string;
    gameType: string;
    jobPostingId?: string;
    startingChips: number;
    seatsPerTable: number;
    config: OpsTournamentCostConfig;
  }

  /** 대회 정보 수정 패치 (whitelisted 필드만; RPC p_patch jsonb) */
  export interface UpdateOpsTournamentPatch {
    name?: string;
    venue?: string;
    eventDate?: string;
    gameType?: string;
    startingChips?: number;
    seatsPerTable?: number;
    color?: string;
    buyInChips?: number;
    rebuyChips?: number;
    addonChips?: number;
    buyInCost?: number;
    feeCost?: number;
    rebuyCost?: number;
    addonCost?: number;
  }

  // ============================================================================
  // Interface
  // ============================================================================

  export interface IOpsTournamentRepository {
    // 조회 (Read) — RLS-filtered
    /** 내가 운영 가능한(소유 또는 워크스페이스 멤버) 대회 목록. event_date desc nulls last, created_at desc */
    listForUser(): Promise<OpsTournament[]>;
    /** 단건 조회. 없으면 null */
    getById(id: string): Promise<OpsTournament | null>;
    /** 공고에 연결된 대회 조회. NULL-SAFE — 관계/스키마 미존재(PGRST) 시 throw 없이 null */
    findByJobPostingId(jobPostingId: string): Promise<OpsTournament | null>;

    // 쓰기 (Write) — SECDEF RPC
    /** 대회 생성 + tournament_created 이벤트 (rpc ops_create_tournament) */
    createWithEvent(
      input: CreateOpsTournamentInput,
      actorId: string
    ): Promise<{ tournamentId: string }>;
    /** 대회 정보 수정 (rpc ops_update_tournament) */
    updateTournament(id: string, actorId: string, patch: UpdateOpsTournamentPatch): Promise<void>;
    /** 대회 상태 전이 (rpc ops_set_tournament_status) */
    setStatus(id: string, actorId: string, status: OpsTournamentStatus): Promise<void>;
    /** 등록 오픈/마감 토글 (rpc ops_toggle_registration) */
    toggleRegistration(id: string, actorId: string, open: boolean): Promise<void>;
  }
  ```

- [ ] **Step 2: Write the participant interface + DTO (`IOpsParticipantRepository.ts`)**

  Create `src/repositories/interfaces/IOpsParticipantRepository.ts` verbatim:

  ```ts
  /**
   * UNIQN Mobile - Ops Participant Repository Interface
   *
   * @description 라이브 대회 운영 — ops_participants 데이터 접근 추상화 (Slice 1a)
   * @version 1.0.0
   *
   * 구현체: SupabaseOpsParticipantRepository (프로덕션 전용 — D5: Mock 없음)
   * - 1a 등록 = 워크인 전용 → status 'active' (D2/D7). check-in/CSV 는 후속 슬라이스.
   * - 읽기 컬럼 allowlist 는 claim_token 을 OMIT 한다 (D8).
   */

  import type { OpsParticipant } from '@/types/ops';

  // ============================================================================
  // Input DTOs
  // ============================================================================

  /** 워크인 참가자 등록 입력 (서비스 → Repository) */
  export interface RegisterParticipantInput {
    tournamentId: string;
    name: string;
    nationality?: string;
    phone?: string;
    buyInAmount?: number;
  }

  // ============================================================================
  // Interface
  // ============================================================================

  export interface IOpsParticipantRepository {
    // 조회 (Read) — RLS-filtered
    /** 대회별 참가자 목록. entry_number asc */
    listByTournament(tournamentId: string): Promise<OpsParticipant[]>;

    // 쓰기 (Write) — SECDEF RPC
    /** 워크인 등록 + player_registered 이벤트 (rpc ops_register_participant) */
    registerWithEvent(
      input: RegisterParticipantInput,
      actorId: string
    ): Promise<{ participantId: string; entryNumber: number }>;
    /** 리바이 (rpc ops_add_rebuy) */
    addRebuy(participantId: string, actorId: string): Promise<void>;
    /** 애드온 (rpc ops_add_addon) */
    addAddon(participantId: string, actorId: string): Promise<void>;
  }
  ```

- [ ] **Step 3: Register the interface barrel + typecheck the interfaces (GREEN baseline)**

  Edit `src/repositories/interfaces/index.ts` — append after the existing `IEmployerApplicationRepository` export (the last block in the file):

  ```ts
  // 대회 운영 (Ops Slice 1a — feat/tournament-ops-revival)
  export type {
    IOpsTournamentRepository,
    OpsTournamentCostConfig,
    CreateOpsTournamentInput,
    UpdateOpsTournamentPatch,
  } from './IOpsTournamentRepository';
  export type {
    IOpsParticipantRepository,
    RegisterParticipantInput,
  } from './IOpsParticipantRepository';
  ```

  Run the compiler (interfaces only depend on `@/types/ops` from T4):

  ```bash
  npm run type-check
  ```

  Expected: PASS — exit 0, no `error TS` lines (the two interface files + DTOs compile against `@/types/ops`).

- [ ] **Step 4: Register the impl barrels BEFORE the impls exist (RED)**

  Edit `src/repositories/supabase/index.ts` — append after the workspace invitation export block (end of file):

  ```ts
  // 대회 운영 (Ops Slice 1a)
  export {
    SupabaseOpsTournamentRepository,
    opsTournamentRepository,
    mapOpsRpcError,
  } from './OpsTournamentRepository';
  export {
    SupabaseOpsParticipantRepository,
    opsParticipantRepository,
  } from './OpsParticipantRepository';
  ```

  Edit `src/repositories/index.ts` — append after the `JobPostingCollaborator` block (end of file):

  ```ts
  // ============================================================================
  // 대회 운영 (Ops Slice 1a — feat/tournament-ops-revival)
  // ============================================================================

  export type {
    IOpsTournamentRepository,
    OpsTournamentCostConfig,
    CreateOpsTournamentInput,
    UpdateOpsTournamentPatch,
    IOpsParticipantRepository,
    RegisterParticipantInput,
  } from './interfaces';

  export {
    SupabaseOpsTournamentRepository,
    opsTournamentRepository,
    SupabaseOpsParticipantRepository,
    opsParticipantRepository,
  } from './supabase';
  ```

  Run the compiler — the barrels now reference modules that do not exist yet:

  ```bash
  npm run type-check
  ```

  Expected: FAIL — exit non-zero with
  `src/repositories/supabase/index.ts ... error TS2307: Cannot find module './OpsTournamentRepository' or its corresponding type declarations.`
  (and the same for `./OpsParticipantRepository`). This RED confirms the barrels actually wire the new modules.

- [ ] **Step 5: Implement `OpsTournamentRepository.ts` + `mapOpsRpcError` (partial GREEN)**

  Create `src/repositories/supabase/OpsTournamentRepository.ts` verbatim. Reads use explicit snake_case allowlists + `toCamelCase`; writes go through `supabase.rpc` (NOT `runRpc` — `runRpc` funnels through `handleSupabaseError`, which would NOT translate the ops P0001 prefixes; `mapOpsRpcError` must see the raw error). `findByJobPostingId` is NULL-SAFE.

  ```ts
  /**
   * UNIQN Mobile - Supabase Ops Tournament Repository
   *
   * @description 라이브 대회 운영 — ops_tournaments CRUD + SECDEF RPC (Slice 1a)
   * @version 1.0.0
   *
   * 책임:
   * 1. ops_tournaments 조회 (SELECT-only RLS; 컬럼 allowlist)
   * 2. RPC 호출 (생성/수정/상태전이/등록토글) — 모든 쓰기는 SECDEF RPC (D3)
   * 3. RPC RAISE(P0001) 메시지 → AppError 변환 (mapOpsRpcError)
   */

  import { supabase } from '@/lib/supabase';
  import { logger } from '@/utils/logger';
  import { isAppError, toError, BusinessError, PermissionError, ERROR_CODES } from '@/errors';
  import {
    OpsRegistrationClosedError,
    OpsInvalidTournamentTransitionError,
    OpsParticipantNotActiveError,
  } from '@/errors/BusinessErrors';
  import { handleSupabaseError, toCamelCase, toSnakeCase } from '@/utils/supabase';
  import type {
    IOpsTournamentRepository,
    CreateOpsTournamentInput,
    UpdateOpsTournamentPatch,
  } from '../interfaces/IOpsTournamentRepository';
  import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';

  // ============================================================================
  // Constants
  // ============================================================================

  const TABLE = 'ops_tournaments' as const;

  /** 읽기 컬럼 allowlist (snake_case). monitor_token 은 1a 에서 NULL. claim_token 은 ops_participants 컬럼이라 해당 없음. */
  const TOURNAMENT_COLUMNS =
    'id,owner_id,job_posting_id,name,venue,event_date,game_type,status,seats_per_table,starting_chips,color,buy_in_chips,rebuy_chips,addon_chips,buy_in_cost,fee_cost,rebuy_cost,addon_cost,bounty_cost,registration_open,auto_seat_on_register,reentry_allowed,max_reentries,monitor_token,next_entry_seq,created_at,updated_at' as const;

  /** ops 백엔드 미배포 시 PostgREST 가 던지는 "관계/스키마 캐시 없음" 에러 코드 */
  const MISSING_RELATION_CODES = new Set(['42P01', 'PGRST205', 'PGRST204']);

  function isMissingRelation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      MISSING_RELATION_CODES.has((error as { code: string }).code)
    );
  }

  // ============================================================================
  // RPC RAISE(P0001) → AppError 변환
  // (EmployerApplicationRepository.mapRpcError 미러)
  // ============================================================================

  export function mapOpsRpcError(error: unknown): never {
    const msg = toError(error).message ?? '';

    if (msg.includes('REGISTRATION_CLOSED')) {
      throw new OpsRegistrationClosedError({ message: msg });
    }
    if (msg.includes('INVALID_STATUS')) {
      throw new OpsInvalidTournamentTransitionError({ message: msg });
    }
    if (msg.includes('PARTICIPANT_NOT_ACTIVE')) {
      throw new OpsParticipantNotActiveError({ message: msg });
    }
    if (msg.includes('TOURNAMENT_NOT_FOUND')) {
      throw new BusinessError(ERROR_CODES.OPS_TOURNAMENT_NOT_FOUND, {
        message: msg,
        userMessage: '대회를 찾을 수 없습니다',
      });
    }
    if (msg.includes('PARTICIPANT_NOT_FOUND')) {
      throw new BusinessError(ERROR_CODES.OPS_PARTICIPANT_NOT_FOUND, {
        message: msg,
        userMessage: '참가자를 찾을 수 없습니다',
      });
    }
    if (msg.includes('PERMISSION_DENIED')) {
      throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
        message: msg,
        userMessage: '이 대회를 운영할 권한이 없습니다',
      });
    }

    // 기타 RPC 에러 → handleSupabaseError 위임 (never 반환)
    handleSupabaseError(error, { operation: 'ops tournament RPC' });
  }

  // ============================================================================
  // Row → Domain 변환
  // ============================================================================

  function rowToTournament(row: Record<string, unknown>): OpsTournament {
    return toCamelCase<OpsTournament>(row);
  }

  // ============================================================================
  // Repository
  // ============================================================================

  export class SupabaseOpsTournamentRepository implements IOpsTournamentRepository {
    // ==========================================================================
    // 조회 (Read)
    // ==========================================================================

    async listForUser(): Promise<OpsTournament[]> {
      try {
        logger.info('대회 목록 조회');

        const { data, error } = await supabase
          .from(TABLE)
          .select(TOURNAMENT_COLUMNS)
          .order('event_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (error) handleSupabaseError(error, { operation: '대회 목록 조회', table: TABLE });

        return ((data ?? []) as Record<string, unknown>[]).map(rowToTournament);
      } catch (error) {
        if (isAppError(error)) throw error;
        handleSupabaseError(error, { operation: '대회 목록 조회', table: TABLE });
      }
    }

    async getById(id: string): Promise<OpsTournament | null> {
      try {
        logger.info('대회 단건 조회', { id });

        const { data, error } = await supabase
          .from(TABLE)
          .select(TOURNAMENT_COLUMNS)
          .eq('id', id)
          .maybeSingle();

        if (error) handleSupabaseError(error, { operation: '대회 단건 조회', table: TABLE });

        return data ? rowToTournament(data as Record<string, unknown>) : null;
      } catch (error) {
        if (isAppError(error)) throw error;
        handleSupabaseError(error, { operation: '대회 단건 조회', table: TABLE });
      }
    }

    async findByJobPostingId(jobPostingId: string): Promise<OpsTournament | null> {
      try {
        logger.info('공고 연결 대회 조회', { jobPostingId });

        const { data, error } = await supabase
          .from(TABLE)
          .select(TOURNAMENT_COLUMNS)
          .eq('job_posting_id', jobPostingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // NULL-SAFE: ops 백엔드 미배포(관계/스키마 캐시 없음) → 브릿지가 throw 없이 "운영 시작" CTA 를 보이도록 null
        if (error) {
          if (isMissingRelation(error)) {
            logger.warn('ops_tournaments 관계 없음 — null 반환 (백엔드 미배포 가능)', { jobPostingId });
            return null;
          }
          handleSupabaseError(error, { operation: '공고 연결 대회 조회', table: TABLE });
        }

        return data ? rowToTournament(data as Record<string, unknown>) : null;
      } catch (error) {
        if (isAppError(error)) throw error;
        handleSupabaseError(error, { operation: '공고 연결 대회 조회', table: TABLE });
      }
    }

    // ==========================================================================
    // 쓰기 (Write) - SECDEF RPC
    // ==========================================================================

    async createWithEvent(
      input: CreateOpsTournamentInput,
      actorId: string
    ): Promise<{ tournamentId: string }> {
      try {
        logger.info('대회 생성 RPC', { name: input.name, actorId });

        const { data, error } = await supabase.rpc('ops_create_tournament', {
          p_owner_id: actorId,
          p_name: input.name,
          p_venue: input.venue ?? null,
          p_event_date: input.eventDate ?? null,
          p_game_type: input.gameType,
          p_job_posting_id: input.jobPostingId ?? null,
          p_starting_chips: input.startingChips,
          p_seats_per_table: input.seatsPerTable,
          p_config: {
            buy_in_chips: input.config.buyInChips,
            rebuy_chips: input.config.rebuyChips,
            addon_chips: input.config.addonChips,
            buy_in_cost: input.config.buyInCost,
            fee_cost: input.config.feeCost,
            rebuy_cost: input.config.rebuyCost,
            addon_cost: input.config.addonCost,
          },
        });

        if (error) mapOpsRpcError(error);

        const result = data as { tournament_id: string };
        logger.info('대회 생성 완료', { tournamentId: result.tournament_id });
        return { tournamentId: result.tournament_id };
      } catch (error) {
        if (isAppError(error)) throw error;
        mapOpsRpcError(error);
      }
    }

    async updateTournament(
      id: string,
      actorId: string,
      patch: UpdateOpsTournamentPatch
    ): Promise<void> {
      try {
        logger.info('대회 정보 수정 RPC', { id, actorId });

        const { error } = await supabase.rpc('ops_update_tournament', {
          p_tournament_id: id,
          p_actor_id: actorId,
          // top-level camelCase → snake_case (RPC 가 whitelisted 키만 읽음)
          p_patch: toSnakeCase(patch as Record<string, unknown>),
        });

        if (error) mapOpsRpcError(error);
      } catch (error) {
        if (isAppError(error)) throw error;
        mapOpsRpcError(error);
      }
    }

    async setStatus(id: string, actorId: string, status: OpsTournamentStatus): Promise<void> {
      try {
        logger.info('대회 상태 변경 RPC', { id, status, actorId });

        const { error } = await supabase.rpc('ops_set_tournament_status', {
          p_tournament_id: id,
          p_actor_id: actorId,
          p_status: status,
        });

        if (error) mapOpsRpcError(error);
      } catch (error) {
        if (isAppError(error)) throw error;
        mapOpsRpcError(error);
      }
    }

    async toggleRegistration(id: string, actorId: string, open: boolean): Promise<void> {
      try {
        logger.info('등록 토글 RPC', { id, open, actorId });

        const { error } = await supabase.rpc('ops_toggle_registration', {
          p_tournament_id: id,
          p_actor_id: actorId,
          p_open: open,
        });

        if (error) mapOpsRpcError(error);
      } catch (error) {
        if (isAppError(error)) throw error;
        mapOpsRpcError(error);
      }
    }
  }

  export const opsTournamentRepository = new SupabaseOpsTournamentRepository();
  ```

  (Do not run the compiler yet — `supabase/index.ts` still references the not-yet-created `./OpsParticipantRepository`, so typecheck stays RED until Step 6.)

- [ ] **Step 6: Implement `OpsParticipantRepository.ts` + typecheck (GREEN)**

  Create `src/repositories/supabase/OpsParticipantRepository.ts` verbatim. It reuses `mapOpsRpcError` from the tournament repo and reads with a `claim_token`-OMITting allowlist (D8).

  ```ts
  /**
   * UNIQN Mobile - Supabase Ops Participant Repository
   *
   * @description 라이브 대회 운영 — ops_participants 조회 + SECDEF RPC (Slice 1a)
   * @version 1.0.0
   *
   * 책임:
   * 1. ops_participants 조회 (SELECT-only RLS; 컬럼 allowlist — claim_token OMIT, D8)
   * 2. RPC 호출 (등록/리바이/애드온) — 모든 쓰기는 SECDEF RPC (D3)
   */

  import { supabase } from '@/lib/supabase';
  import { logger } from '@/utils/logger';
  import { isAppError } from '@/errors';
  import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
  import { mapOpsRpcError } from './OpsTournamentRepository';
  import type {
    IOpsParticipantRepository,
    RegisterParticipantInput,
  } from '../interfaces/IOpsParticipantRepository';
  import type { OpsParticipant } from '@/types/ops';

  // ============================================================================
  // Constants
  // ============================================================================

  const TABLE = 'ops_participants' as const;

  /** 읽기 컬럼 allowlist (snake_case). claim_token 은 의도적으로 OMIT (D8) — OpsParticipant 에도 claimToken 필드 없음. */
  const PARTICIPANT_COLUMNS =
    'id,tournament_id,entry_number,name,nationality,phone,player_user_id,status,chips,buy_in_amount,rebuys,add_ons,reentries,finish_position,busted_at,prize_amount,note,created_at,updated_at' as const;

  // ============================================================================
  // Row → Domain 변환
  // ============================================================================

  function rowToParticipant(row: Record<string, unknown>): OpsParticipant {
    return toCamelCase<OpsParticipant>(row);
  }

  // ============================================================================
  // Repository
  // ============================================================================

  export class SupabaseOpsParticipantRepository implements IOpsParticipantRepository {
    // ==========================================================================
    // 조회 (Read)
    // ==========================================================================

    async listByTournament(tournamentId: string): Promise<OpsParticipant[]> {
      try {
        logger.info('참가자 목록 조회', { tournamentId });

        const { data, error } = await supabase
          .from(TABLE)
          .select(PARTICIPANT_COLUMNS)
          .eq('tournament_id', tournamentId)
          .order('entry_number', { ascending: true });

        if (error) handleSupabaseError(error, { operation: '참가자 목록 조회', table: TABLE });

        return ((data ?? []) as Record<string, unknown>[]).map(rowToParticipant);
      } catch (error) {
        if (isAppError(error)) throw error;
        handleSupabaseError(error, { operation: '참가자 목록 조회', table: TABLE });
      }
    }

    // ==========================================================================
    // 쓰기 (Write) - SECDEF RPC
    // ==========================================================================

    async registerWithEvent(
      input: RegisterParticipantInput,
      actorId: string
    ): Promise<{ participantId: string; entryNumber: number }> {
      try {
        logger.info('워크인 참가자 등록 RPC', { tournamentId: input.tournamentId, actorId });

        const { data, error } = await supabase.rpc('ops_register_participant', {
          p_tournament_id: input.tournamentId,
          p_actor_id: actorId,
          p_name: input.name,
          p_nationality: input.nationality ?? null,
          p_phone: input.phone ?? null,
          p_buy_in_amount: input.buyInAmount ?? null,
        });

        if (error) mapOpsRpcError(error);

        const result = data as { participant_id: string; entry_number: number };
        logger.info('참가자 등록 완료', {
          participantId: result.participant_id,
          entryNumber: result.entry_number,
        });
        return { participantId: result.participant_id, entryNumber: result.entry_number };
      } catch (error) {
        if (isAppError(error)) throw error;
        mapOpsRpcError(error);
      }
    }

    async addRebuy(participantId: string, actorId: string): Promise<void> {
      try {
        logger.info('리바이 RPC', { participantId, actorId });

        const { error } = await supabase.rpc('ops_add_rebuy', {
          p_participant_id: participantId,
          p_actor_id: actorId,
        });

        if (error) mapOpsRpcError(error);
      } catch (error) {
        if (isAppError(error)) throw error;
        mapOpsRpcError(error);
      }
    }

    async addAddon(participantId: string, actorId: string): Promise<void> {
      try {
        logger.info('애드온 RPC', { participantId, actorId });

        const { error } = await supabase.rpc('ops_add_addon', {
          p_participant_id: participantId,
          p_actor_id: actorId,
        });

        if (error) mapOpsRpcError(error);
      } catch (error) {
        if (isAppError(error)) throw error;
        mapOpsRpcError(error);
      }
    }
  }

  export const opsParticipantRepository = new SupabaseOpsParticipantRepository();
  ```

  Run the compiler — all barrels now resolve and both impls satisfy their interfaces:

  ```bash
  npm run type-check
  ```

  Expected: PASS — exit 0, no `error TS` lines. (`implements IOps*Repository` forces every method signature, RPC param name, and return shape to match the contracts; `toCamelCase<OpsTournament>` / `<OpsParticipant>` confirm the allowlists map cleanly onto the T4 types.)

- [ ] **Step 7: Full quality gate + commit**

  Run the complete gate (css-vars sync + type-check + eslint + prettier):

  ```bash
  npm run quality
  ```

  Expected: PASS — exit 0. No `error TS`, no ESLint errors (note: no `console.log`, `@/` imports only, immutable mappers), prettier reports the 4 new files + 3 edited barrels as formatted.

  If prettier flags formatting, auto-fix and re-run:

  ```bash
  npx prettier --write "src/repositories/**/*.ts" && npm run quality
  ```

  Then commit:

  ```bash
  git add src/repositories/interfaces/IOpsTournamentRepository.ts \
          src/repositories/interfaces/IOpsParticipantRepository.ts \
          src/repositories/supabase/OpsTournamentRepository.ts \
          src/repositories/supabase/OpsParticipantRepository.ts \
          src/repositories/interfaces/index.ts \
          src/repositories/supabase/index.ts \
          src/repositories/index.ts
  git commit -m "feat(ops): 대회/참가자 Repository (인터페이스+Supabase 구현+배럴+mapOpsRpcError)"
  ```

  Expected: 1 commit created on `feat/tournament-ops-revival`, 7 files changed.

  > Integration coverage (RPC security, entry# allocation, RLS) lands in **T10 pgTAP** (`npm run test:db`); migrations are applied to PROD only at the later approval gate via `mcp__supabase__apply_migration` — do NOT apply here.

**Notes / rationale (for the reviewer):**
- **`supabase.rpc` not `runRpc` for writes:** `runRpc` internally calls `handleSupabaseError`, which only special-cases `MAX_CAPACITY`; it would surface the ops P0001 prefixes as raw `UNKNOWN` AppErrors. Using `supabase.rpc` directly lets `mapOpsRpcError` translate `REGISTRATION_CLOSED` / `INVALID_STATUS` / `PARTICIPANT_NOT_ACTIVE` / `*_NOT_FOUND` / `PERMISSION_DENIED` into typed errors (mirrors `EmployerApplicationRepository` + `WorkspaceRepository`).
- **`mapOpsRpcError` is exported once** from `OpsTournamentRepository.ts` and imported by the participant repo (single source; no duplication). It is also re-exported via `supabase/index.ts` for completeness.
- **`findByJobPostingId` NULL-SAFE** because the T9 bridge calls it from the employer posting screen, which may render before the ops backend is deployed; a missing relation must degrade to "start ops" CTA, not a thrown error.
- **No Mock repo (D5):** interfaces document only the Supabase implementation; thin wrappers are integration-tested by pgTAP, so the in-task gate is `npm run type-check` + `npm run quality`.
### Task T6: Services (ops) — `opsTournamentService` + `opsParticipantService`

Service layer for OPS slice 1a (§11 of LOCKED CONTRACTS). Each service is a **module of async functions** (NOT a class), validates user payloads at the boundary with a zod `safeParse` → `ValidationError`, logs `logger.info` start/done, delegates to the repository singletons (`opsTournamentRepository` / `opsParticipantRepository`), and on `catch` re-throws existing `AppError`s as-is or wraps via `handleServiceError(...)` with a fixed `component` string. `actorId` is supplied by the caller (T7 hook reads `useAuthStore().user.uid`) — the service NEVER resolves the actor itself and NEVER validates it.

Copy idioms VERBATIM from the named exemplars (do not invent):
- `src/services/reviewService.ts` — `safeParse` guard + `if (isAppError(error)) throw error;` + `handleServiceError` wrap, passes the original typed `input` to the repo after validating (validate-as-guard).
- `src/services/jobs/applicationService.ts` — module-of-functions shape, `toValidationError(message, fieldErrors)` helper, `logger.info` start/done.
- `src/errors/serviceErrorHandler.ts` — `handleServiceError(error, { operation, component, context })` signature.
- Test mock shape: `src/services/jobs/__tests__/applicationService.test.ts` + `src/services/__tests__/reviewService.test.ts` (mock `@/repositories`, `@/utils/logger`, `@/errors/serviceErrorHandler`; keep `@/errors` + the real schemas un-mocked).

**Files:**
- Create: `src/services/ops/opsTournamentService.ts`
- Create: `src/services/ops/opsParticipantService.ts`
- Create: `src/services/ops/index.ts`
- Test: `src/services/ops/__tests__/opsTournamentService.test.ts`
- Test: `src/services/ops/__tests__/opsParticipantService.test.ts`

**Interfaces:**

Consumes (provided by earlier tasks — exact signatures relied upon):
- From `@/repositories` (T5 — singletons + re-exported DTO types):
  - `opsTournamentRepository.createWithEvent(input: CreateOpsTournamentInput, actorId: string): Promise<{ tournamentId: string }>`
  - `opsTournamentRepository.updateTournament(id: string, actorId: string, patch: UpdateOpsTournamentPatch): Promise<void>`
  - `opsTournamentRepository.setStatus(id: string, actorId: string, status: OpsTournamentStatus): Promise<void>`
  - `opsTournamentRepository.toggleRegistration(id: string, actorId: string, open: boolean): Promise<void>`
  - `opsParticipantRepository.registerWithEvent(input: RegisterParticipantInput, actorId: string): Promise<{ participantId: string; entryNumber: number }>`
  - `opsParticipantRepository.addRebuy(participantId: string, actorId: string): Promise<void>`
  - `opsParticipantRepository.addAddon(participantId: string, actorId: string): Promise<void>`
  - `type CreateOpsTournamentInput`, `type UpdateOpsTournamentPatch`, `type RegisterParticipantInput` (re-exported from the repository interface barrels per §10).
- From `@/types/ops` (T4): `type OpsTournamentStatus`.
- From `@/errors` (T4 edits already merged): `ValidationError`, `ERROR_CODES` (`ERROR_CODES.VALIDATION_SCHEMA`), `isAppError`.
- From `@/errors/serviceErrorHandler`: `handleServiceError(error, { operation, component, context })`.
- From `@/utils/logger`: `logger.info/warn/error`.
- From T4 zod schemas — **exact export names are the binding T4↔T6 interface** (mirror the `workspace.schema.ts` naming convention):
  - `@/schemas/opsTournament.schema`: `createOpsTournamentSchema` (object → `CreateOpsTournamentInput`), `updateOpsTournamentPatchSchema` (object → `UpdateOpsTournamentPatch`), `opsTournamentStatusSchema` (`z.enum(Constants.public.Enums.ops_tournament_status)`).
  - `@/schemas/opsParticipant.schema`: `registerParticipantSchema` (object → `RegisterParticipantInput`). Both `name` fields carry `.refine(xssValidation, …)` (§1 + §4 length CHECKs), which is what the "rejects XSS" tests exercise.

Produces (consumed by T7 hooks via `@/services/ops`):
- `createTournament(input: CreateOpsTournamentInput, actorId: string): Promise<{ tournamentId: string }>`
- `updateTournament(id: string, actorId: string, patch: UpdateOpsTournamentPatch): Promise<void>`
- `setTournamentStatus(id: string, actorId: string, status: OpsTournamentStatus): Promise<void>`
- `toggleRegistration(id: string, actorId: string, open: boolean): Promise<void>`
- `registerParticipant(input: RegisterParticipantInput, actorId: string): Promise<{ participantId: string; entryNumber: number }>`
- `addRebuy(participantId: string, actorId: string): Promise<void>`
- `addAddon(participantId: string, actorId: string): Promise<void>`

> All shell commands run from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`.

---

- [ ] **Step 1: Write the failing test for `opsTournamentService` (RED)**

  Create `src/services/ops/__tests__/opsTournamentService.test.ts`. Mocks `@/repositories`, `@/utils/logger`, `@/errors/serviceErrorHandler`; leaves `@/errors` and the real T4 schemas un-mocked so `ValidationError`/`isAppError` and the real zod validation run (proven-safe partial-barrel-mock pattern from `reviewService.test.ts`).

  ```ts
  import {
    createTournament,
    setTournamentStatus,
    toggleRegistration,
    updateTournament,
  } from '../opsTournamentService';
  import type { CreateOpsTournamentInput } from '@/repositories';

  const mockCreateWithEvent = jest.fn();
  const mockUpdateTournament = jest.fn();
  const mockSetStatus = jest.fn();
  const mockToggleRegistration = jest.fn();

  jest.mock('@/repositories', () => ({
    opsTournamentRepository: {
      createWithEvent: (...args: unknown[]) => mockCreateWithEvent(...args),
      updateTournament: (...args: unknown[]) => mockUpdateTournament(...args),
      setStatus: (...args: unknown[]) => mockSetStatus(...args),
      toggleRegistration: (...args: unknown[]) => mockToggleRegistration(...args),
    },
  }));

  jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  }));

  jest.mock('@/errors/serviceErrorHandler', () => ({
    handleServiceError: jest.fn((error: unknown) =>
      error instanceof Error ? error : new Error(String(error))
    ),
  }));

  const validInput: CreateOpsTournamentInput = {
    name: '6/25 데일리 토너먼트',
    venue: '강남 홀덤펍',
    eventDate: '2026-06-25',
    gameType: 'NLH',
    startingChips: 30000,
    seatsPerTable: 9,
    config: {
      buyInChips: 30000,
      rebuyChips: 30000,
      addonChips: 20000,
      buyInCost: 50000,
      feeCost: 10000,
      rebuyCost: 50000,
      addonCost: 30000,
    },
  };

  describe('opsTournamentService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('createTournament', () => {
      it('validates input and delegates to the repository', async () => {
        mockCreateWithEvent.mockResolvedValue({ tournamentId: 'tour-1' });

        await expect(createTournament(validInput, 'owner-1')).resolves.toEqual({
          tournamentId: 'tour-1',
        });

        expect(mockCreateWithEvent).toHaveBeenCalledWith(validInput, 'owner-1');
      });

      it('rejects an XSS name before the repository call', async () => {
        await expect(
          createTournament({ ...validInput, name: '<script>alert(1)</script>' }, 'owner-1')
        ).rejects.toThrow();

        expect(mockCreateWithEvent).not.toHaveBeenCalled();
      });
    });

    describe('updateTournament', () => {
      it('delegates a valid patch to the repository', async () => {
        mockUpdateTournament.mockResolvedValue(undefined);

        await expect(
          updateTournament('tour-1', 'owner-1', { name: '이름 변경' })
        ).resolves.toBeUndefined();

        expect(mockUpdateTournament).toHaveBeenCalledWith('tour-1', 'owner-1', {
          name: '이름 변경',
        });
      });
    });

    describe('setTournamentStatus', () => {
      it('delegates a legal status to the repository', async () => {
        mockSetStatus.mockResolvedValue(undefined);

        await expect(
          setTournamentStatus('tour-1', 'owner-1', 'active')
        ).resolves.toBeUndefined();

        expect(mockSetStatus).toHaveBeenCalledWith('tour-1', 'owner-1', 'active');
      });
    });

    describe('toggleRegistration', () => {
      it('delegates the registration toggle to the repository', async () => {
        mockToggleRegistration.mockResolvedValue(undefined);

        await expect(
          toggleRegistration('tour-1', 'owner-1', false)
        ).resolves.toBeUndefined();

        expect(mockToggleRegistration).toHaveBeenCalledWith('tour-1', 'owner-1', false);
      });
    });
  });
  ```

- [ ] **Step 2: Run the tournament test — confirm RED**

  ```bash
  npx jest src/services/ops/__tests__/opsTournamentService.test.ts
  ```
  Expected: FAIL — `Cannot find module '../opsTournamentService' from 'src/services/ops/__tests__/opsTournamentService.test.ts'` (the implementation does not exist yet). Test suites: 1 failed.

- [ ] **Step 3: Implement `opsTournamentService.ts` (GREEN)**

  Create `src/services/ops/opsTournamentService.ts`. `toValidationError` mirrors `applicationService.ts` exactly (3 call sites here). Validate-as-guard then delegate the original typed payload, mirroring `reviewService.ts`.

  ```ts
  /**
   * UNIQN Mobile - OPS tournament service
   *
   * Service layer responsibilities (§11):
   * - validate user input at the boundary (zod safeParse -> ValidationError)
   * - delegate writes to the repository singleton (Service -> Repository -> SECDEF RPC)
   * - keep observability hooks (logger) close to user actions
   * - actorId is supplied by the caller (hook -> useAuthStore().user.uid)
   */

  import { logger } from '@/utils/logger';
  import { handleServiceError } from '@/errors/serviceErrorHandler';
  import { ERROR_CODES, isAppError, ValidationError } from '@/errors';
  import { opsTournamentRepository } from '@/repositories';
  import {
    createOpsTournamentSchema,
    opsTournamentStatusSchema,
    updateOpsTournamentPatchSchema,
  } from '@/schemas/opsTournament.schema';
  import type { CreateOpsTournamentInput, UpdateOpsTournamentPatch } from '@/repositories';
  import type { OpsTournamentStatus } from '@/types/ops';

  function toValidationError(
    message: string,
    fieldErrors?: Record<string, string[] | undefined>
  ): ValidationError {
    const normalizedFieldErrors = fieldErrors
      ? Object.fromEntries(
          Object.entries(fieldErrors).filter((entry): entry is [string, string[]] =>
            Array.isArray(entry[1])
          )
        )
      : undefined;

    return new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: message,
      errors: normalizedFieldErrors,
    });
  }

  export async function createTournament(
    input: CreateOpsTournamentInput,
    actorId: string
  ): Promise<{ tournamentId: string }> {
    try {
      logger.info('대회 생성 시작', {
        component: 'opsTournamentService',
        name: input.name,
        jobPostingId: input.jobPostingId ?? null,
      });

      const parseResult = createOpsTournamentSchema.safeParse(input);
      if (!parseResult.success) {
        const fieldErrors = parseResult.error.flatten().fieldErrors;
        const firstMessage = Object.values(fieldErrors).flat()[0];
        throw toValidationError(
          typeof firstMessage === 'string' ? firstMessage : '입력값을 확인해 주세요.',
          fieldErrors
        );
      }

      const result = await opsTournamentRepository.createWithEvent(input, actorId);

      logger.info('대회 생성 완료', {
        component: 'opsTournamentService',
        tournamentId: result.tournamentId,
      });

      return result;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '대회 생성',
        component: 'opsTournamentService',
        context: { actorId },
      });
    }
  }

  export async function updateTournament(
    id: string,
    actorId: string,
    patch: UpdateOpsTournamentPatch
  ): Promise<void> {
    try {
      logger.info('대회 정보 수정 시작', {
        component: 'opsTournamentService',
        tournamentId: id,
      });

      const parseResult = updateOpsTournamentPatchSchema.safeParse(patch);
      if (!parseResult.success) {
        const fieldErrors = parseResult.error.flatten().fieldErrors;
        const firstMessage = Object.values(fieldErrors).flat()[0];
        throw toValidationError(
          typeof firstMessage === 'string' ? firstMessage : '입력값을 확인해 주세요.',
          fieldErrors
        );
      }

      await opsTournamentRepository.updateTournament(id, actorId, patch);

      logger.info('대회 정보 수정 완료', {
        component: 'opsTournamentService',
        tournamentId: id,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '대회 정보 수정',
        component: 'opsTournamentService',
        context: { tournamentId: id, actorId },
      });
    }
  }

  export async function setTournamentStatus(
    id: string,
    actorId: string,
    status: OpsTournamentStatus
  ): Promise<void> {
    try {
      logger.info('대회 상태 변경 시작', {
        component: 'opsTournamentService',
        tournamentId: id,
        status,
      });

      const parseResult = opsTournamentStatusSchema.safeParse(status);
      if (!parseResult.success) {
        throw toValidationError('올바르지 않은 대회 상태입니다.');
      }

      await opsTournamentRepository.setStatus(id, actorId, status);

      logger.info('대회 상태 변경 완료', {
        component: 'opsTournamentService',
        tournamentId: id,
        status,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '대회 상태 변경',
        component: 'opsTournamentService',
        context: { tournamentId: id, actorId, status },
      });
    }
  }

  export async function toggleRegistration(
    id: string,
    actorId: string,
    open: boolean
  ): Promise<void> {
    try {
      logger.info('대회 등록 토글 시작', {
        component: 'opsTournamentService',
        tournamentId: id,
        open,
      });

      await opsTournamentRepository.toggleRegistration(id, actorId, open);

      logger.info('대회 등록 토글 완료', {
        component: 'opsTournamentService',
        tournamentId: id,
        open,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '대회 등록 토글',
        component: 'opsTournamentService',
        context: { tournamentId: id, actorId, open },
      });
    }
  }
  ```

- [ ] **Step 4: Run the tournament test — confirm GREEN**

  ```bash
  npx jest src/services/ops/__tests__/opsTournamentService.test.ts
  ```
  Expected: PASS — `Tests: 5 passed, 5 total`. Test suites: 1 passed. (`createTournament` ×2, `updateTournament` ×1, `setTournamentStatus` ×1, `toggleRegistration` ×1.)

- [ ] **Step 5: Write the failing test for `opsParticipantService` (RED)**

  Create `src/services/ops/__tests__/opsParticipantService.test.ts`. Happy-path input is kept to the DTO-required fields (`tournamentId`, `name`) plus `buyInAmount`, omitting the optional `nationality`/`phone` so the test does not couple to T4's phone/nationality format rules.

  ```ts
  import { addAddon, addRebuy, registerParticipant } from '../opsParticipantService';
  import type { RegisterParticipantInput } from '@/repositories';

  const mockRegisterWithEvent = jest.fn();
  const mockAddRebuy = jest.fn();
  const mockAddAddon = jest.fn();

  jest.mock('@/repositories', () => ({
    opsParticipantRepository: {
      registerWithEvent: (...args: unknown[]) => mockRegisterWithEvent(...args),
      addRebuy: (...args: unknown[]) => mockAddRebuy(...args),
      addAddon: (...args: unknown[]) => mockAddAddon(...args),
    },
  }));

  jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  }));

  jest.mock('@/errors/serviceErrorHandler', () => ({
    handleServiceError: jest.fn((error: unknown) =>
      error instanceof Error ? error : new Error(String(error))
    ),
  }));

  const validInput: RegisterParticipantInput = {
    tournamentId: '00000000-0000-0000-0000-000000000001',
    name: '홍길동',
    buyInAmount: 60000,
  };

  describe('opsParticipantService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('registerParticipant', () => {
      it('validates input and delegates to the repository', async () => {
        mockRegisterWithEvent.mockResolvedValue({ participantId: 'p-1', entryNumber: 1 });

        await expect(registerParticipant(validInput, 'owner-1')).resolves.toEqual({
          participantId: 'p-1',
          entryNumber: 1,
        });

        expect(mockRegisterWithEvent).toHaveBeenCalledWith(validInput, 'owner-1');
      });

      it('rejects an XSS participant name before the repository call', async () => {
        await expect(
          registerParticipant(
            { ...validInput, name: '<img src=x onerror=alert(1)>' },
            'owner-1'
          )
        ).rejects.toThrow();

        expect(mockRegisterWithEvent).not.toHaveBeenCalled();
      });
    });

    describe('addRebuy', () => {
      it('delegates a rebuy to the repository', async () => {
        mockAddRebuy.mockResolvedValue(undefined);

        await expect(addRebuy('p-1', 'owner-1')).resolves.toBeUndefined();

        expect(mockAddRebuy).toHaveBeenCalledWith('p-1', 'owner-1');
      });
    });

    describe('addAddon', () => {
      it('delegates an add-on to the repository', async () => {
        mockAddAddon.mockResolvedValue(undefined);

        await expect(addAddon('p-1', 'owner-1')).resolves.toBeUndefined();

        expect(mockAddAddon).toHaveBeenCalledWith('p-1', 'owner-1');
      });
    });
  });
  ```

- [ ] **Step 6: Run the participant test — confirm RED**

  ```bash
  npx jest src/services/ops/__tests__/opsParticipantService.test.ts
  ```
  Expected: FAIL — `Cannot find module '../opsParticipantService' from 'src/services/ops/__tests__/opsParticipantService.test.ts'`. Test suites: 1 failed.

- [ ] **Step 7: Implement `opsParticipantService.ts` (GREEN)**

  Create `src/services/ops/opsParticipantService.ts`. `registerParticipant` validates with `registerParticipantSchema`; the `ValidationError` is inlined (single call site, mirroring `reviewService.ts`). `addRebuy`/`addAddon` carry no user payload, so they delegate directly (mirroring `applicationService.cancelApplication`).

  ```ts
  /**
   * UNIQN Mobile - OPS participant service
   *
   * Service layer responsibilities (§11):
   * - validate walk-in registration input at the boundary (zod safeParse -> ValidationError)
   * - delegate writes to the repository singleton (Service -> Repository -> SECDEF RPC)
   * - actorId is supplied by the caller (hook -> useAuthStore().user.uid)
   */

  import { logger } from '@/utils/logger';
  import { handleServiceError } from '@/errors/serviceErrorHandler';
  import { ERROR_CODES, isAppError, ValidationError } from '@/errors';
  import { opsParticipantRepository } from '@/repositories';
  import { registerParticipantSchema } from '@/schemas/opsParticipant.schema';
  import type { RegisterParticipantInput } from '@/repositories';

  export async function registerParticipant(
    input: RegisterParticipantInput,
    actorId: string
  ): Promise<{ participantId: string; entryNumber: number }> {
    try {
      logger.info('참가자 등록 시작', {
        component: 'opsParticipantService',
        tournamentId: input.tournamentId,
      });

      const parseResult = registerParticipantSchema.safeParse(input);
      if (!parseResult.success) {
        const fieldErrors = parseResult.error.flatten().fieldErrors;
        const firstMessage = Object.values(fieldErrors).flat()[0];
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: typeof firstMessage === 'string' ? firstMessage : '입력값을 확인해 주세요.',
        });
      }

      const result = await opsParticipantRepository.registerWithEvent(input, actorId);

      logger.info('참가자 등록 완료', {
        component: 'opsParticipantService',
        participantId: result.participantId,
        entryNumber: result.entryNumber,
      });

      return result;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '참가자 등록',
        component: 'opsParticipantService',
        context: { tournamentId: input.tournamentId, actorId },
      });
    }
  }

  export async function addRebuy(participantId: string, actorId: string): Promise<void> {
    try {
      logger.info('리바이 처리 시작', {
        component: 'opsParticipantService',
        participantId,
      });

      await opsParticipantRepository.addRebuy(participantId, actorId);

      logger.info('리바이 처리 완료', {
        component: 'opsParticipantService',
        participantId,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '리바이 처리',
        component: 'opsParticipantService',
        context: { participantId, actorId },
      });
    }
  }

  export async function addAddon(participantId: string, actorId: string): Promise<void> {
    try {
      logger.info('애드온 처리 시작', {
        component: 'opsParticipantService',
        participantId,
      });

      await opsParticipantRepository.addAddon(participantId, actorId);

      logger.info('애드온 처리 완료', {
        component: 'opsParticipantService',
        participantId,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '애드온 처리',
        component: 'opsParticipantService',
        context: { participantId, actorId },
      });
    }
  }
  ```

- [ ] **Step 8: Run the participant test — confirm GREEN**

  ```bash
  npx jest src/services/ops/__tests__/opsParticipantService.test.ts
  ```
  Expected: PASS — `Tests: 4 passed, 4 total`. Test suites: 1 passed. (`registerParticipant` ×2, `addRebuy` ×1, `addAddon` ×1.)

- [ ] **Step 9: Create the `src/services/ops/index.ts` barrel**

  Named re-exports only (no DTO type re-exports — those live in `@/repositories`/`@/types/ops`), mirroring `src/services/jobs/index.ts`.

  ```ts
  /**
   * UNIQN Mobile - ops domain barrel
   *
   * @description Live tournament operations services (slice 1a).
   * Hooks (T7) import these via `@/services/ops`.
   */

  export {
    createTournament,
    updateTournament,
    setTournamentStatus,
    toggleRegistration,
  } from './opsTournamentService';

  export { registerParticipant, addRebuy, addAddon } from './opsParticipantService';
  ```

- [ ] **Step 10: Full type-check + run both ops suites (TS gate)**

  ```bash
  npx jest src/services/ops/__tests__/ && npm run type-check
  ```
  Expected: jest — `Tests: 9 passed, 9 total`, `Test Suites: 2 passed, 2 total`; then `tsc --noEmit` exits 0 with no output (0 errors). Run `npm run quality` (css-vars check + type-check + lint + format:check) before the task-end gate; expected 0 errors.

- [ ] **Step 11: Commit**

  ```bash
  git add src/services/ops/opsTournamentService.ts src/services/ops/opsParticipantService.ts src/services/ops/index.ts src/services/ops/__tests__/opsTournamentService.test.ts src/services/ops/__tests__/opsParticipantService.test.ts
  git commit -m "feat(ops): 대회/참가자 서비스 레이어 추가 (검증+리포지토리 위임)"
  ```
  Expected: one commit created on branch `feat/tournament-ops-revival` with 5 files changed.

---

**Notes for the executor**
- The two service unit tests load the **real** T4 zod schemas (un-mocked) so `safeParse` actually runs — therefore T4 (`src/schemas/opsTournament.schema.ts`, `opsParticipant.schema.ts`, the `@/errors` ops edits) and T5 (`@/repositories` singletons + DTO re-exports) MUST be merged before this task (dependency order `T4 → T5 → T6` per §16). The partial-mock of `@/errors/serviceErrorHandler` while keeping `@/errors` real is proven safe by the existing `reviewService.test.ts`.
- The service passes the **original typed payload** to the repository after validating (validate-as-guard, mirroring `reviewService.ts`) — this is why `expect(...).toHaveBeenCalledWith(validInput, ...)` matches exactly. Do NOT swap to `parseResult.data` (trim/coercion would diverge from `validInput` and break the assertion).
- `addRebuy`/`addAddon` intentionally have no `safeParse` (no user-supplied payload — only ids), matching `applicationService.cancelApplication`. The §11 `schema.safeParse` shape applies only to methods that accept a user payload.
### Task T7: Hooks + queryKeys namespace

> Layering (hard): Presentation → Hooks → Service → Repository → Supabase. Hooks NEVER import `supabase`.
> READS call the Repository directly (TanStack read-only exception). WRITES go through the Service (T6).
> Run all commands from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`. No DB migration in this task — the verification gate is `npm test` (Jest) + `npm run quality` (tsc + lint).
> `@/` imports only. `logger` not `console.log`. No JSX UI here (hooks only) so no `dark:` surfaces in this task.

**Files:**
- Create: `src/hooks/ops/useOpsTournaments.ts`
- Create: `src/hooks/ops/useOpsTournament.ts`
- Create: `src/hooks/ops/useOpsParticipants.ts`
- Create: `src/hooks/ops/useOpsPartialStats.ts`
- Create: `src/hooks/ops/useOpsTournamentMutations.ts`
- Create: `src/hooks/ops/useOpsParticipantMutations.ts`
- Create: `src/hooks/ops/useOpsTournamentForPosting.ts`
- Create: `src/hooks/ops/index.ts`
- Modify: `src/lib/queryClient.ts` (add `ops` queryKey namespace)
- Test: `src/lib/__tests__/queryKeysOps.test.ts`
- Test: `src/hooks/ops/__tests__/useOpsHooks.test.tsx`

**Interfaces:**

Consumes (must already exist from earlier tasks — use these exact signatures):
- From T4 `@/types/ops`:
  - `interface OpsTournament { id: string; ownerId: string; jobPostingId?: string | null; name: string; venue?: string | null; eventDate?: string | null; gameType: string; status: OpsTournamentStatus; seatsPerTable: number; startingChips: number; color?: string | null; buyInChips: number; rebuyChips: number; addonChips: number; buyInCost: number; feeCost: number; rebuyCost: number; addonCost: number; bountyCost?: number | null; registrationOpen: boolean; autoSeatOnRegister: boolean; reentryAllowed: boolean; maxReentries?: number | null; monitorToken?: string | null; nextEntrySeq: number; createdAt: string; updatedAt: string; }`
  - `interface OpsParticipant { id: string; tournamentId: string; entryNumber: number; name: string; nationality?: string | null; phone?: string | null; playerUserId?: string | null; status: OpsParticipantStatus; chips: number; buyInAmount?: number | null; rebuys: number; addOns: number; reentries: number; finishPosition?: number | null; bustedAt?: string | null; prizeAmount?: number | null; note?: string | null; createdAt: string; updatedAt: string; }`
  - `interface OpsPartialStats { playing: number; entries: number; totalChips: number; averageStack: number; prizePool: number; }`
  - `type OpsTournamentStatus = 'upcoming' | 'active' | 'completed'`
- From T3 `@/domains/ops`:
  - `function computeOpsPartialStats(participants: Pick<OpsParticipant,'status'|'chips'|'rebuys'|'addOns'>[], tournament: Pick<OpsTournament,'buyInCost'|'rebuyCost'|'addonCost'>): OpsPartialStats`
- From T5 `@/repositories` (singletons + DTOs re-exported from the barrel):
  - `opsTournamentRepository.listForUser(): Promise<OpsTournament[]>`
  - `opsTournamentRepository.getById(id: string): Promise<OpsTournament | null>`
  - `opsTournamentRepository.findByJobPostingId(jobPostingId: string): Promise<OpsTournament | null>`
  - `opsParticipantRepository.listByTournament(tournamentId: string): Promise<OpsParticipant[]>`
  - `interface CreateOpsTournamentInput { name: string; venue?: string; eventDate?: string; gameType: string; jobPostingId?: string; startingChips: number; seatsPerTable: number; config: OpsTournamentCostConfig; }`
  - `interface UpdateOpsTournamentPatch { name?: string; venue?: string; eventDate?: string; gameType?: string; startingChips?: number; seatsPerTable?: number; color?: string; buyInChips?: number; rebuyChips?: number; addonChips?: number; buyInCost?: number; feeCost?: number; rebuyCost?: number; addonCost?: number; }`
  - `interface RegisterParticipantInput { tournamentId: string; name: string; nationality?: string; phone?: string; buyInAmount?: number; }`
- From T6 `@/services/ops`:
  - `opsTournamentService.createTournament(input: CreateOpsTournamentInput, actorId: string): Promise<{ tournamentId: string }>`
  - `opsTournamentService.setTournamentStatus(id: string, actorId: string, status: OpsTournamentStatus): Promise<void>`
  - `opsTournamentService.toggleRegistration(id: string, actorId: string, open: boolean): Promise<void>`
  - `opsParticipantService.registerParticipant(input: RegisterParticipantInput, actorId: string): Promise<{ participantId: string; entryNumber: number }>`
  - `opsParticipantService.addRebuy(participantId: string, actorId: string): Promise<void>`
  - `opsParticipantService.addAddon(participantId: string, actorId: string): Promise<void>`
- From existing infra: `queryKeys`, `cachingPolicies` (`@/lib/queryClient`); `createRealtimeSubscription` (`@/utils/supabase`); `useAuthStore` (`@/stores/authStore`, `user?.uid`); `useToastStore` (`@/stores/toastStore`); `extractUserMessage` (`@/errors`); `logger` (`@/utils/logger`).

Produces (later tasks T8/T9 rely on these exact names):
- `queryKeys.ops` namespace: `all`, `tournaments()`, `tournamentDetail(id)`, `participants(tournamentId)`, `forPosting(jobPostingId)`.
- `useOpsTournaments(): { tournaments: OpsTournament[]; isLoading: boolean; error: unknown; refetch: () => void }`
- `useOpsTournament(id: string | undefined): { tournament: OpsTournament | null; isLoading: boolean; error: unknown; refetch: () => void }`
- `useOpsParticipants(tournamentId: string | undefined): { participants: OpsParticipant[]; isLoading: boolean; error: unknown; refetch: () => void }`
- `useOpsPartialStats(tournamentId: string | undefined): { stats: OpsPartialStats; isLoading: boolean; error: unknown }`
- `useCreateOpsTournament()`, `useSetTournamentStatus(tournamentId: string | undefined)`, `useToggleRegistration(tournamentId: string | undefined)` (UseMutationResult)
- `useRegisterParticipant(tournamentId: string | undefined)`, `useAddRebuy(tournamentId: string | undefined)`, `useAddAddon(tournamentId: string | undefined)` (UseMutationResult)
- `useOpsTournamentForPosting(jobPostingId: string | undefined): { tournament: OpsTournament | null; isLoading: boolean; error: unknown }`
- Barrel `@/hooks/ops` re-exporting all of the above.

---

- [ ] **Step 1: Write failing unit test for the `queryKeys.ops` namespace**

Create `src/lib/__tests__/queryKeysOps.test.ts`:

```ts
/**
 * queryKeys.ops 네임스페이스 단위 테스트
 * 캐시 무효화 일관성을 위해 키 형태를 고정한다.
 */
import { queryKeys } from '@/lib/queryClient';

describe('queryKeys.ops', () => {
  it('all 은 루트 키 ["ops"] 이다', () => {
    expect(queryKeys.ops.all).toEqual(['ops']);
  });

  it('tournaments() 는 목록 키를 만든다', () => {
    expect(queryKeys.ops.tournaments()).toEqual(['ops', 'tournaments']);
  });

  it('tournamentDetail(id) 는 상세 키를 만든다', () => {
    expect(queryKeys.ops.tournamentDetail('t-1')).toEqual(['ops', 'tournament', 't-1']);
  });

  it('participants(tournamentId) 는 참가자 키를 만든다', () => {
    expect(queryKeys.ops.participants('t-1')).toEqual(['ops', 'participants', 't-1']);
  });

  it('forPosting(jobPostingId) 는 공고 브리지 키를 만든다', () => {
    expect(queryKeys.ops.forPosting('jp-1')).toEqual(['ops', 'forPosting', 'jp-1']);
  });
});
```

- [ ] **Step 2: Run the test — Expected: FAIL (ops namespace missing)**

```bash
npm test -- src/lib/__tests__/queryKeysOps.test.ts
```
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'all')` (queryKeys.ops does not exist yet).

- [ ] **Step 3: Add the `ops` namespace to `queryClient.ts` — run test, Expected: PASS, then commit**

In `src/lib/queryClient.ts`, inside the `export const queryKeys = { ... } as const;` object, insert the `ops` block immediately after the `employerApplications` block (the last entry, just before the closing `} as const;`). Add a trailing comma to `employerApplications` if needed:

```ts
  // 라이브 운영 (ops — 대회 운영툴 부활)
  ops: {
    all: ['ops'] as const,
    tournaments: () => [...queryKeys.ops.all, 'tournaments'] as const,
    tournamentDetail: (id: string) => [...queryKeys.ops.all, 'tournament', id] as const,
    participants: (tournamentId: string) =>
      [...queryKeys.ops.all, 'participants', tournamentId] as const,
    forPosting: (jobPostingId: string) => [...queryKeys.ops.all, 'forPosting', jobPostingId] as const,
  },
```

Run:
```bash
npm test -- src/lib/__tests__/queryKeysOps.test.ts
```
Expected: PASS — `Tests: 5 passed, 5 total`.

```bash
git add src/lib/queryClient.ts src/lib/__tests__/queryKeysOps.test.ts
git commit -m "feat(ops): queryKeys.ops 네임스페이스 추가"
```

- [ ] **Step 4: Write the failing hook integration test (drives creation of all hook files + barrel)**

Create `src/hooks/ops/__tests__/useOpsHooks.test.tsx`. It imports from the not-yet-existing barrel, so it fails to resolve until Step 12. Mirrors the `useJobPostingCollaborators.test.tsx` / `useSharedJobPostings.test.tsx` mocking idioms exactly:

```tsx
/**
 * ops hooks 통합 단위 테스트 (light)
 * - 읽기 훅: Repository 직접 호출 + Realtime 구독 등록 검증
 * - 뮤테이션 훅: actor(uid) 해석 + Service 위임 검증
 * RLS/RPC 보안 자체는 pgTAP(T10) 에서 다룬다.
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useOpsTournaments,
  useOpsTournament,
  useCreateOpsTournament,
} from '../index';
import { opsTournamentRepository } from '@/repositories';
import { opsTournamentService } from '@/services/ops';
import { useAuthStore } from '@/stores/authStore';

// jest.setup.js 의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories', () => ({
  opsTournamentRepository: {
    listForUser: jest.fn(),
    getById: jest.fn(),
    findByJobPostingId: jest.fn(),
  },
  opsParticipantRepository: {
    listByTournament: jest.fn(),
  },
}));

jest.mock('@/services/ops', () => ({
  opsTournamentService: {
    createTournament: jest.fn(),
    setTournamentStatus: jest.fn(),
    toggleRegistration: jest.fn(),
  },
  opsParticipantService: {
    registerParticipant: jest.fn(),
    addRebuy: jest.fn(),
    addAddon: jest.fn(),
  },
}));

const mockCreateRealtimeSubscription = jest.fn();
const mockUnsubscribe = jest.fn();
jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: (...args: unknown[]) => mockCreateRealtimeSubscription(...args),
}));

jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: { getState: () => ({ success: jest.fn(), error: jest.fn() }) },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe('ops hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRealtimeSubscription.mockReturnValue(mockUnsubscribe);
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: { uid: 'actor-1' } });
  });

  it('useOpsTournaments 는 Repository.listForUser 로 목록을 읽는다', async () => {
    (opsTournamentRepository.listForUser as jest.Mock).mockResolvedValue([
      { id: 't-1', ownerId: 'actor-1', name: '심야 토너', status: 'upcoming' },
    ]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useOpsTournaments(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(opsTournamentRepository.listForUser).toHaveBeenCalledTimes(1);
    expect(result.current.tournaments).toHaveLength(1);
    expect(result.current.tournaments[0]?.id).toBe('t-1');
  });

  it('useOpsTournament 는 id 가 있으면 Realtime 구독을 등록한다 (filter=id=eq.t-1)', async () => {
    (opsTournamentRepository.getById as jest.Mock).mockResolvedValue({ id: 't-1', name: 'x' });
    const { Wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useOpsTournament('t-1'), { wrapper: Wrapper });

    await waitFor(() => expect(mockCreateRealtimeSubscription).toHaveBeenCalledTimes(1));
    expect(mockCreateRealtimeSubscription).toHaveBeenCalledWith(
      'ops_tournaments',
      'id=eq.t-1',
      expect.any(Function)
    );
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('useOpsTournament 는 id 가 undefined 면 구독하지 않는다', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useOpsTournament(undefined), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(opsTournamentRepository.getById).not.toHaveBeenCalled();
    expect(mockCreateRealtimeSubscription).not.toHaveBeenCalled();
    expect(result.current.tournament).toBeNull();
  });

  it('useCreateOpsTournament 는 actor uid 와 함께 Service.createTournament 를 호출한다', async () => {
    (opsTournamentService.createTournament as jest.Mock).mockResolvedValue({ tournamentId: 't-9' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateOpsTournament(), { wrapper: Wrapper });

    const input = {
      name: '신규 대회',
      gameType: 'NLH',
      startingChips: 20000,
      seatsPerTable: 9,
      config: {
        buyInChips: 20000,
        rebuyChips: 20000,
        addonChips: 10000,
        buyInCost: 50000,
        feeCost: 5000,
        rebuyCost: 50000,
        addonCost: 30000,
      },
    };
    let created: { tournamentId: string } | undefined;
    await act(async () => {
      created = await result.current.mutateAsync(input);
    });

    expect(created?.tournamentId).toBe('t-9');
    expect(opsTournamentService.createTournament).toHaveBeenCalledWith(input, 'actor-1');
  });
});
```

- [ ] **Step 5: Run the hook test — Expected: FAIL (modules not created)**

```bash
npm test -- src/hooks/ops/__tests__/useOpsHooks.test.tsx
```
Expected: FAIL — `Cannot find module '../index' from 'src/hooks/ops/__tests__/useOpsHooks.test.tsx'`.

- [ ] **Step 6: Create `useOpsTournaments.ts` (read — Repository direct)**

Create `src/hooks/ops/useOpsTournaments.ts`:

```ts
/**
 * UNIQN Mobile - useOpsTournaments
 *
 * @description 사용자가 접근 가능한 라이브 운영 대회 목록.
 *              읽기 전용 → Repository 직접 호출 (TanStack 예외). RLS 가 진짜 게이트.
 * @version 1.0.0
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsTournamentRepository } from '@/repositories';
import type { OpsTournament } from '@/types/ops';

export interface UseOpsTournamentsResult {
  tournaments: OpsTournament[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useOpsTournaments(): UseOpsTournamentsResult {
  const query = useQuery({
    queryKey: queryKeys.ops.tournaments(),
    queryFn: () => opsTournamentRepository.listForUser(),
    staleTime: cachingPolicies.frequent,
  });

  return {
    tournaments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

- [ ] **Step 7: Create `useOpsTournament.ts` (read + Realtime on `ops_tournaments`)**

Create `src/hooks/ops/useOpsTournament.ts`:

```ts
/**
 * UNIQN Mobile - useOpsTournament
 *
 * @description 단일 대회 상세 + ops_tournaments Realtime 구독.
 *              읽기 전용 → Repository 직접 호출. null-safe (id 없으면 비활성).
 * @version 1.0.0
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsTournamentRepository } from '@/repositories';
import { createRealtimeSubscription } from '@/utils/supabase';
import type { OpsTournament } from '@/types/ops';

export interface UseOpsTournamentResult {
  tournament: OpsTournament | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useOpsTournament(id: string | undefined): UseOpsTournamentResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: id
      ? queryKeys.ops.tournamentDetail(id)
      : [...queryKeys.ops.all, 'tournament', 'none'],
    queryFn: () => opsTournamentRepository.getById(id!),
    enabled: !!id,
    staleTime: cachingPolicies.frequent,
  });

  // Realtime — 대회 status / registration_open 등 변경 시 자동 갱신
  // (ops_tournaments 는 T2 에서 supabase_realtime publication 에 등록됨)
  useEffect(() => {
    if (!id) return undefined;
    return createRealtimeSubscription('ops_tournaments', `id=eq.${id}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(id) });
    });
  }, [id, queryClient]);

  return {
    tournament: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

- [ ] **Step 8: Create `useOpsParticipants.ts` (read + Realtime on `ops_participants`)**

Create `src/hooks/ops/useOpsParticipants.ts`:

```ts
/**
 * UNIQN Mobile - useOpsParticipants
 *
 * @description 대회 참가자 목록 + ops_participants Realtime 구독.
 *              읽기 전용 → Repository 직접 호출. entry_number 오름차순(Repository 정렬).
 * @version 1.0.0
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsParticipantRepository } from '@/repositories';
import { createRealtimeSubscription } from '@/utils/supabase';
import type { OpsParticipant } from '@/types/ops';

export interface UseOpsParticipantsResult {
  participants: OpsParticipant[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useOpsParticipants(tournamentId: string | undefined): UseOpsParticipantsResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.participants(tournamentId)
      : [...queryKeys.ops.all, 'participants', 'none'],
    queryFn: () => opsParticipantRepository.listByTournament(tournamentId!),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.frequent,
  });

  // Realtime — 등록/리바이/애드온 등으로 참가자 row 변경 시 자동 갱신
  // (ops_participants 는 T2 에서 supabase_realtime publication 에 등록됨)
  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription(
      'ops_participants',
      `tournament_id=eq.${tournamentId}`,
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      }
    );
  }, [tournamentId, queryClient]);

  return {
    participants: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

- [ ] **Step 9: Create `useOpsPartialStats.ts` (composes the two reads + `computeOpsPartialStats`)**

Create `src/hooks/ops/useOpsPartialStats.ts`:

```ts
/**
 * UNIQN Mobile - useOpsPartialStats
 *
 * @description STATUS 탭 부분 통계. useOpsTournament + useOpsParticipants 를 합성하여
 *              순수 도메인 함수 computeOpsPartialStats 로 클라이언트에서 계산 (D6).
 *              1a 통계 집합 = playing / entries / totalChips / averageStack / prizePool.
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { computeOpsPartialStats } from '@/domains/ops';
import { useOpsTournament } from './useOpsTournament';
import { useOpsParticipants } from './useOpsParticipants';
import type { OpsPartialStats } from '@/types/ops';

const EMPTY_STATS: OpsPartialStats = {
  playing: 0,
  entries: 0,
  totalChips: 0,
  averageStack: 0,
  prizePool: 0,
};

export interface UseOpsPartialStatsResult {
  stats: OpsPartialStats;
  isLoading: boolean;
  error: unknown;
}

export function useOpsPartialStats(tournamentId: string | undefined): UseOpsPartialStatsResult {
  const {
    tournament,
    isLoading: tournamentLoading,
    error: tournamentError,
  } = useOpsTournament(tournamentId);
  const {
    participants,
    isLoading: participantsLoading,
    error: participantsError,
  } = useOpsParticipants(tournamentId);

  const stats = useMemo<OpsPartialStats>(() => {
    if (!tournament) return EMPTY_STATS;
    return computeOpsPartialStats(participants, tournament);
  }, [participants, tournament]);

  return {
    stats,
    isLoading: tournamentLoading || participantsLoading,
    error: tournamentError ?? participantsError,
  };
}
```

- [ ] **Step 10: Create `useOpsTournamentMutations.ts` (create / setStatus / toggleRegistration — via Service)**

Create `src/hooks/ops/useOpsTournamentMutations.ts`. Actor id resolves from `useAuthStore().user?.uid`; writes delegate to `opsTournamentService`; `onSuccess` invalidates keys + `toast.success`; `onError` `logger.error` + `toast.error(extractUserMessage(error) || fallback)`:

```ts
/**
 * UNIQN Mobile - 라이브 운영 대회 뮤테이션
 *
 * @description 생성 / 상태전이 / 등록 토글. 쓰기는 Service(T6) 경유.
 *              actor 는 useAuthStore().user.uid 에서 해석. RLS/RPC 가 진짜 게이트.
 * @version 1.0.0
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { opsTournamentService } from '@/services/ops';
import { useToastStore } from '@/stores/toastStore';
import { extractUserMessage } from '@/errors';
import { logger } from '@/utils/logger';
import type { CreateOpsTournamentInput } from '@/repositories';
import type { OpsTournamentStatus } from '@/types/ops';

const toast = {
  success: (msg: string) => useToastStore.getState().success(msg),
  error: (msg: string) => useToastStore.getState().error(msg),
};

function requireActorId(uid: string | undefined): string {
  if (!uid) throw new Error('로그인이 필요합니다');
  return uid;
}

// ============================================================================
// useCreateOpsTournament — 대회 생성
// ============================================================================

export function useCreateOpsTournament() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: CreateOpsTournamentInput) =>
      opsTournamentService.createTournament(input, requireActorId(user?.uid)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournaments() });
      toast.success('대회를 만들었습니다');
    },
    onError: (error) => {
      logger.error('대회 생성 실패', error);
      toast.error(extractUserMessage(error) || '대회 생성에 실패했습니다');
    },
  });
}

// ============================================================================
// useSetTournamentStatus — 상태 전이 (upcoming↔active→completed)
// ============================================================================

export function useSetTournamentStatus(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (status: OpsTournamentStatus) =>
      opsTournamentService.setTournamentStatus(tournamentId!, requireActorId(user?.uid), status),
    onSuccess: () => {
      if (tournamentId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.ops.tournamentDetail(tournamentId),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournaments() });
      toast.success('대회 상태를 변경했습니다');
    },
    onError: (error) => {
      logger.error('대회 상태 변경 실패', error);
      toast.error(extractUserMessage(error) || '대회 상태 변경에 실패했습니다');
    },
  });
}

// ============================================================================
// useToggleRegistration — 등록 열기/닫기
// ============================================================================

export function useToggleRegistration(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (open: boolean) =>
      opsTournamentService.toggleRegistration(tournamentId!, requireActorId(user?.uid), open),
    onSuccess: () => {
      if (tournamentId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.ops.tournamentDetail(tournamentId),
        });
      }
      toast.success('등록 설정을 변경했습니다');
    },
    onError: (error) => {
      logger.error('등록 토글 실패', error);
      toast.error(extractUserMessage(error) || '등록 설정 변경에 실패했습니다');
    },
  });
}
```

- [ ] **Step 11: Create `useOpsParticipantMutations.ts` (register / rebuy / addon — via Service)**

Create `src/hooks/ops/useOpsParticipantMutations.ts`. Each invalidates `participants(tournamentId)` + `tournamentDetail(tournamentId)` (registration bumps `next_entry_seq`; chip changes affect composed stats):

```ts
/**
 * UNIQN Mobile - 라이브 운영 참가자 뮤테이션
 *
 * @description 워크인 등록 / 리바이 / 애드온. 쓰기는 Service(T6) 경유.
 *              actor 는 useAuthStore().user.uid 에서 해석.
 *              참가자 + 대회 상세 둘 다 무효화 (등록 시 next_entry_seq, 칩 변경이 통계에 영향).
 * @version 1.0.0
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { opsParticipantService } from '@/services/ops';
import { useToastStore } from '@/stores/toastStore';
import { extractUserMessage } from '@/errors';
import { logger } from '@/utils/logger';
import type { RegisterParticipantInput } from '@/repositories';

const toast = {
  success: (msg: string) => useToastStore.getState().success(msg),
  error: (msg: string) => useToastStore.getState().error(msg),
};

function requireActorId(uid: string | undefined): string {
  if (!uid) throw new Error('로그인이 필요합니다');
  return uid;
}

function useInvalidateParticipants(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!tournamentId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(tournamentId) });
  };
}

// ============================================================================
// useRegisterParticipant — 워크인 등록 (→ status active, D2/D7)
// ============================================================================

export function useRegisterParticipant(tournamentId: string | undefined) {
  const { user } = useAuthStore();
  const invalidate = useInvalidateParticipants(tournamentId);

  return useMutation({
    mutationFn: (input: RegisterParticipantInput) =>
      opsParticipantService.registerParticipant(input, requireActorId(user?.uid)),
    onSuccess: (result) => {
      invalidate();
      toast.success(`등록 완료 (#${result.entryNumber})`);
    },
    onError: (error) => {
      logger.error('참가자 등록 실패', error);
      toast.error(extractUserMessage(error) || '참가자 등록에 실패했습니다');
    },
  });
}

// ============================================================================
// useAddRebuy — 리바이
// ============================================================================

export function useAddRebuy(tournamentId: string | undefined) {
  const { user } = useAuthStore();
  const invalidate = useInvalidateParticipants(tournamentId);

  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.addRebuy(participantId, requireActorId(user?.uid)),
    onSuccess: () => {
      invalidate();
      toast.success('리바이를 적용했습니다');
    },
    onError: (error) => {
      logger.error('리바이 실패', error);
      toast.error(extractUserMessage(error) || '리바이에 실패했습니다');
    },
  });
}

// ============================================================================
// useAddAddon — 애드온
// ============================================================================

export function useAddAddon(tournamentId: string | undefined) {
  const { user } = useAuthStore();
  const invalidate = useInvalidateParticipants(tournamentId);

  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.addAddon(participantId, requireActorId(user?.uid)),
    onSuccess: () => {
      invalidate();
      toast.success('애드온을 적용했습니다');
    },
    onError: (error) => {
      logger.error('애드온 실패', error);
      toast.error(extractUserMessage(error) || '애드온에 실패했습니다');
    },
  });
}
```

- [ ] **Step 12: Create `useOpsTournamentForPosting.ts` (null-safe bridge read) + `index.ts` barrel — run hook test, Expected: PASS**

Create `src/hooks/ops/useOpsTournamentForPosting.ts`:

```ts
/**
 * UNIQN Mobile - useOpsTournamentForPosting
 *
 * @description 공고 → 라이브 운영 브리지 (T9 ActionCard). 공고에 연결된 대회를 null-safe 조회.
 *              Repository.findByJobPostingId 는 미존재/PGRST 시 null 반환 → ActionCard "시작" 분기.
 * @version 1.0.0
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsTournamentRepository } from '@/repositories';
import type { OpsTournament } from '@/types/ops';

export interface UseOpsTournamentForPostingResult {
  tournament: OpsTournament | null;
  isLoading: boolean;
  error: unknown;
}

export function useOpsTournamentForPosting(
  jobPostingId: string | undefined
): UseOpsTournamentForPostingResult {
  const query = useQuery({
    queryKey: jobPostingId
      ? queryKeys.ops.forPosting(jobPostingId)
      : [...queryKeys.ops.all, 'forPosting', 'none'],
    queryFn: () => opsTournamentRepository.findByJobPostingId(jobPostingId!),
    enabled: !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });

  return {
    tournament: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
```

Create `src/hooks/ops/index.ts`:

```ts
/**
 * UNIQN Mobile - 라이브 운영 훅 배럴
 * @version 1.0.0
 */

export * from './useOpsTournaments';
export * from './useOpsTournament';
export * from './useOpsParticipants';
export * from './useOpsPartialStats';
export * from './useOpsTournamentMutations';
export * from './useOpsParticipantMutations';
export * from './useOpsTournamentForPosting';
```

Run the hook test:
```bash
npm test -- src/hooks/ops/__tests__/useOpsHooks.test.tsx
```
Expected: PASS — `Tests: 4 passed, 4 total`.

- [ ] **Step 13: Full quality gate (tsc + lint + format) — Expected: PASS, then commit**

```bash
npm run quality
```
Expected: exit 0 — `tsc --noEmit` reports 0 errors, ESLint 0 errors, Prettier `All matched files use Prettier code style!`. (No `console.log`, all `@/` imports, no `supabase` import in any hook.)

```bash
git add src/hooks/ops src/lib/queryClient.ts src/lib/__tests__/queryKeysOps.test.ts
git commit -m "feat(ops): 라이브 운영 훅 + queryKeys 네임스페이스 추가"
```

---

**Notes for reviewer / downstream tasks:**
- No DB migration in T7; the gates are Jest (`npm test`) + `npm run quality`. T2 must already have added `ops_tournaments` and `ops_participants` to the `supabase_realtime` publication, otherwise the `createRealtimeSubscription` calls in `useOpsTournament` / `useOpsParticipants` silently receive no events (queries still work via staleTime refetch).
- All mutation hooks throw `Error('로그인이 필요합니다')` when `user?.uid` is missing; this surfaces through the standard `onError` → `toast.error` path (`extractUserMessage` returns the generic unknown-error message for non-AppError, but the fallback string is always shown).
- `useOpsPartialStats` returns `EMPTY_STATS` until the tournament loads, so STATUS screen (T8) never reads from a partially-loaded tournament. Prize pool / stacks are computed purely client-side per D6 — there is no `ops_live_stats` table in 1a.
- `useSetTournamentStatus` / `useToggleRegistration` / participant mutations bind `tournamentId` via the hook arg and take the changing value via `mutate`/`mutateAsync` (mirrors the workspace `useUpdateWorkspaceName(workspaceId)` exemplar). `useUpdateOpsTournament` is intentionally NOT created — §12 enumerates only create/setStatus/toggleRegistration for 1a tournament mutations.
### Task T8: UI route group + screens + components

> Worktree root `C:\Users\user\Desktop\T-HOLDEM-ops` · all paths under `uniqn-mobile/` · branch `feat/tournament-ops-revival`. Run every command from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`.
>
> **Constraints (copy from contracts §1):** Expo 55 / RN 0.83.4 / React 19.2 / TS strict / NativeWind 4.2. Presentation NEVER imports `supabase`; reads go through hooks (T7). `@/` alias only. `logger` not `console.log`. Every color className carries a static `dark:` variant (no interpolated `dark:`). FlashList via `AppFlashList`. `router.push`/`router.replace` imperative — NO `Link asChild` + bare `Pressable`. Components < 400 lines. Commit convention `feat(ops): <한글>`.
>
> **UI TDD note:** screens have no Jest unit; the gate is `npm run quality` (tsc `--noEmit` + eslint + prettier check) = **0 errors**, plus a manual render check in light + dark. This task depends on T7 (hooks) + T4 (types/DTOs) already merged (dependency order T1→T2→(T3,T4)→T5→T6→T7→T8). If a referenced hook is missing, `npm run quality` fails with `TS2307` — that is the dependency gate.

**Files:**
- Create: `app/(ops)/_layout.tsx`
- Create: `app/(ops)/tournaments/index.tsx`
- Create: `app/(ops)/tournaments/new.tsx`
- Create: `app/(ops)/tournaments/[id]/_layout.tsx`
- Create: `app/(ops)/tournaments/[id]/index.tsx`
- Create: `app/(ops)/tournaments/[id]/players.tsx`
- Create: `app/(ops)/tournaments/[id]/status.tsx`
- Create: `src/components/ops/OpsTournamentCard.tsx`
- Create: `src/components/ops/OpsRegistrationForm.tsx`
- Create: `src/components/ops/OpsParticipantRow.tsx`
- Create: `src/components/ops/OpsStatusStats.tsx`
- Modify: `app/_layout.tsx` (root — add `<Stack.Screen name="(ops)" />`)
- Test: none (Jest) — gate is `npm run quality`; manual render verification per step.

**Interfaces:**

Consumes (provided by earlier tasks — exact signatures this task relies on; T7/T4/T5 MUST expose exactly these):
```ts
// T4 — @/types/ops
type OpsTournamentStatus = 'upcoming' | 'active' | 'completed';
interface OpsTournament { id: string; name: string; venue?: string | null; eventDate?: string | null;
  status: OpsTournamentStatus; registrationOpen: boolean; /* …rest per contracts §7 */ }
interface OpsParticipant { id: string; tournamentId: string; entryNumber: number; name: string;
  nationality?: string | null; status: 'registered'|'checked_in'|'active'|'busted'|'no_show'; chips: number; /* …rest */ }
interface OpsPartialStats { playing: number; entries: number; totalChips: number; averageStack: number; prizePool: number; }

// T5 — @/repositories (DTOs re-exported via barrel, type-only import)
interface OpsTournamentCostConfig { buyInChips: number; rebuyChips: number; addonChips: number;
  buyInCost: number; feeCost: number; rebuyCost: number; addonCost: number; }
interface CreateOpsTournamentInput { name: string; venue?: string; eventDate?: string; gameType: string;
  jobPostingId?: string; startingChips: number; seatsPerTable: number; config: OpsTournamentCostConfig; }
interface RegisterParticipantInput { tournamentId: string; name: string; nationality?: string; phone?: string; buyInAmount?: number; }

// T7 — @/hooks/ops (TanStack). Queries return UseQueryResult; mutations return UseMutationResult.
function useOpsTournaments(): UseQueryResult<OpsTournament[], Error>;                 // read-only repo direct
function useOpsTournament(id: string): UseQueryResult<OpsTournament | null, Error>;    // realtime built-in
function useOpsParticipants(tournamentId: string): UseQueryResult<OpsParticipant[], Error>; // realtime built-in
function useOpsPartialStats(tournamentId: string): OpsPartialStats;                    // composed pure value (D6)
function useCreateOpsTournament(): UseMutationResult<{ tournamentId: string }, Error, CreateOpsTournamentInput>;
function useSetTournamentStatus(): UseMutationResult<void, Error, { id: string; status: OpsTournamentStatus }>;
function useToggleRegistration(): UseMutationResult<void, Error, { id: string; open: boolean }>;
function useRegisterParticipant(tournamentId: string): UseMutationResult<{ participantId: string; entryNumber: number }, Error, RegisterParticipantInput>;
function useAddRebuy(tournamentId: string): UseMutationResult<void, Error, { participantId: string }>;
function useAddAddon(tournamentId: string): UseMutationResult<void, Error, { participantId: string }>;
// All mutation hooks resolve actor id internally via useAuthStore.user.uid and own onSuccess(invalidate)+onError(logger+toast).
```

Produces (component prop types — co-located, no later task imports these; T9 is independent of T8 UI):
```ts
// src/components/ops/*
interface OpsTournamentCardProps { tournament: OpsTournament; onPress: (id: string) => void; }
interface OpsParticipantRowProps { participant: OpsParticipant; onRebuy: (participantId: string) => void;
  onAddon: (participantId: string) => void; isRebuying?: boolean; isAddoning?: boolean; }
interface OpsStatusStatsProps { stats: OpsPartialStats; }
interface OpsRegistrationFormValues { name: string; nationality?: string; phone?: string; buyInAmount?: number; }
interface OpsRegistrationFormProps { visible: boolean; onClose: () => void;
  onSubmit: (values: OpsRegistrationFormValues) => void; isSubmitting?: boolean; }
// Route group `app/(ops)/…` registered in the root Stack so `/(ops)/tournaments` resolves.
```

---

- [ ] **Step 1: Register the `(ops)` route group in the root Stack**

  Baseline check first — confirm `npm run quality` is green on the worktree before editing:
  ```bash
  npm run quality
  ```
  Expected: exit 0 (tsc 0 errors, eslint 0 errors, prettier clean).

  Then edit `app/_layout.tsx`. The root Stack screen list currently reads (around lines 188–194):
  ```tsx
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(employer)" />
        <Stack.Screen name="+not-found" />
  ```
  Insert one line after `(employer)` and before `+not-found`:
  ```tsx
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(employer)" />
        <Stack.Screen name="(ops)" />
        <Stack.Screen name="+not-found" />
  ```
  No other change to `app/_layout.tsx`.

  ```bash
  npm run quality
  ```
  Expected: exit 0 — still 0 errors (the `(ops)` group folder is created next step; expo-router tolerates a declared screen whose group is added in the same change set).

  Manual render: deferred until Step 2 creates the layout. Commit:
  ```bash
  git add app/_layout.tsx && git commit -m "feat(ops): 루트 Stack에 (ops) 라우트 그룹 등록"
  ```

- [ ] **Step 2: `(ops)/_layout.tsx` — authenticated-only gate**

  Mirrors `app/(employer)/_layout.tsx` exactly, minus the role redirect (contracts §13: authenticated only — RLS governs data). Create `app/(ops)/_layout.tsx`:
  ```tsx
  /**
   * UNIQN Mobile - Ops Layout
   * 라이브 운영 전용 레이아웃 (인증 필요, 역할 무관 — 데이터 접근은 RLS가 통제)
   */

  import { Stack, Redirect } from 'expo-router';
  import { useAuthStore, selectProfile } from '@/stores/authStore';
  import { useThemeStore } from '@/stores/themeStore';
  import { Loading } from '@/components/ui';
  import { getLayoutColor } from '@/constants/colors';

  function OpsStack() {
    const isDark = useThemeStore((s) => s.isDarkMode);

    return (
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          statusBarStyle: 'auto',
          statusBarBackgroundColor: 'transparent',
          contentStyle: {
            backgroundColor: getLayoutColor(isDark, 'content'),
          },
        }}
      />
    );
  }

  export default function OpsLayout() {
    const { isLoading, isAuthenticated } = useAuthStore();
    const profile = useAuthStore(selectProfile);

    // 로딩 중 또는 인증됐지만 프로필 hydration 미완 (타이밍 방어)
    if (isLoading || (isAuthenticated && !profile)) {
      return <Loading variant="layout" />;
    }

    // 인증되지 않음 - 로그인으로 리다이렉트 (역할 체크 없음)
    if (!isAuthenticated) {
      return <Redirect href="/(auth)/login" />;
    }

    return <OpsStack />;
  }
  ```

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: `npm start`, sign in as any role, deep-link `/(ops)/tournaments` (screen lands in Step 4). Logged-out access redirects to `/(auth)/login`. Commit:
  ```bash
  git add app/\(ops\)/_layout.tsx && git commit -m "feat(ops): (ops) 인증 전용 레이아웃 게이트 추가"
  ```

- [ ] **Step 3: `OpsTournamentCard` component (§13 list item)**

  Create `src/components/ops/OpsTournamentCard.tsx`:
  ```tsx
  import React from 'react';
  import { View, Text, Pressable } from 'react-native';
  import { Card, Badge } from '@/components/ui';
  import { ChevronRightIcon } from '@/components/icons';
  import { SECONDARY_PALETTE } from '@/constants/colors';
  import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';

  const STATUS_META: Record<
    OpsTournamentStatus,
    { label: string; variant: 'primary' | 'success' | 'default' }
  > = {
    upcoming: { label: '예정', variant: 'primary' },
    active: { label: '진행 중', variant: 'success' },
    completed: { label: '종료', variant: 'default' },
  };

  export interface OpsTournamentCardProps {
    tournament: OpsTournament;
    onPress: (id: string) => void;
  }

  export function OpsTournamentCard({ tournament, onPress }: OpsTournamentCardProps) {
    const meta = STATUS_META[tournament.status];
    const subtitle =
      [tournament.venue, tournament.eventDate].filter(Boolean).join(' · ') || '장소·일정 미정';

    return (
      <Pressable
        onPress={() => onPress(tournament.id)}
        className="mx-4 mb-3 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={`${tournament.name} 대회 운영 열기`}
      >
        <Card variant="elevated" padding="md" className="flex-row items-center">
          <View className="flex-1 min-w-0">
            <View className="mb-1 flex-row items-center">
              <Text
                className="mr-2 flex-shrink text-base font-sans-semibold text-content-primary dark:text-off-white"
                numberOfLines={1}
              >
                {tournament.name}
              </Text>
              <Badge variant={meta.variant} size="sm">
                {meta.label}
              </Badge>
            </View>
            <Text
              className="text-sm text-content-secondary dark:text-secondary-400 font-sans"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
          <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} />
        </Card>
      </Pressable>
    );
  }

  export default OpsTournamentCard;
  ```

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: rendered by Step 4; verify status badge color + truncation in light/dark there. Commit:
  ```bash
  git add src/components/ops/OpsTournamentCard.tsx && git commit -m "feat(ops): 대회 카드 컴포넌트 추가"
  ```

- [ ] **Step 4: `tournaments/index.tsx` — list / picker**

  Create `app/(ops)/tournaments/index.tsx`:
  ```tsx
  import React, { useCallback } from 'react';
  import { View } from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import { router } from 'expo-router';
  import { AppFlashList } from '@/components/ui/AppFlashList';
  import { Button, EmptyState, ErrorState, Loading } from '@/components/ui';
  import { StackHeader } from '@/components/headers';
  import { OpsTournamentCard } from '@/components/ops/OpsTournamentCard';
  import { PlusIcon } from '@/components/icons';
  import { TEXT_COLORS } from '@/constants/colors';
  import { useOpsTournaments } from '@/hooks/ops';
  import type { OpsTournament } from '@/types/ops';

  export default function OpsTournamentsListScreen() {
    const { data: tournaments, isLoading, error, refetch } = useOpsTournaments();

    const handlePress = useCallback((id: string) => {
      router.push(`/(ops)/tournaments/${id}`);
    }, []);

    const handleCreate = useCallback(() => {
      router.push('/(ops)/tournaments/new');
    }, []);

    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="라이브 운영" fallbackHref="/(app)/(tabs)/employer" />

        <View className="px-4 py-3">
          <Button
            variant="primary"
            onPress={handleCreate}
            icon={<PlusIcon size={20} color={TEXT_COLORS.onGold} />}
          >
            대회 만들기
          </Button>
        </View>

        {isLoading ? (
          <Loading variant="layout" message="대회 목록을 불러오는 중..." />
        ) : error ? (
          <ErrorState error={error} title="대회 목록을 불러올 수 없습니다" onRetry={refetch} />
        ) : !tournaments || tournaments.length === 0 ? (
          <EmptyState
            title="등록된 대회가 없습니다"
            description="새 대회를 만들어 라이브 운영을 시작하세요."
            actionLabel="대회 만들기"
            onAction={handleCreate}
          />
        ) : (
          <AppFlashList
            data={tournaments}
            renderItem={({ item }: { item: OpsTournament }) => (
              <OpsTournamentCard tournament={item} onPress={handlePress} />
            )}
            keyExtractor={(item: OpsTournament) => item.id}
            estimatedItemSize={96}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </SafeAreaView>
    );
  }
  ```

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: navigate `/(ops)/tournaments` — empty state shows when no rows; after seeding (T10 fixtures or manual RPC), cards render; tapping a card pushes `/(ops)/tournaments/<id>`. Verify dark mode. Commit:
  ```bash
  git add app/\(ops\)/tournaments/index.tsx && git commit -m "feat(ops): 대회 목록 화면 추가"
  ```

- [ ] **Step 5: `tournaments/new.tsx` — create form**

  Create `app/(ops)/tournaments/new.tsx`. Uses `useCreateOpsTournament` (actor resolved inside the hook); on success `router.replace` to the detail root (contracts §13). Numeric fields are string state parsed with a local `toInt`:
  ```tsx
  import React, { useCallback, useState } from 'react';
  import { ScrollView, Text, View } from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import { router } from 'expo-router';
  import { Button, Input } from '@/components/ui';
  import { StackHeader } from '@/components/headers';
  import { useToastStore } from '@/stores/toastStore';
  import { useCreateOpsTournament } from '@/hooks/ops';
  import type { CreateOpsTournamentInput } from '@/repositories';

  function toInt(value: string): number {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  export default function OpsCreateTournamentScreen() {
    const { addToast } = useToastStore();
    const createMutation = useCreateOpsTournament();

    const [name, setName] = useState('');
    const [venue, setVenue] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [gameType, setGameType] = useState('NLH');
    const [startingChips, setStartingChips] = useState('30000');
    const [seatsPerTable, setSeatsPerTable] = useState('9');
    const [buyInChips, setBuyInChips] = useState('30000');
    const [rebuyChips, setRebuyChips] = useState('30000');
    const [addonChips, setAddonChips] = useState('40000');
    const [buyInCost, setBuyInCost] = useState('0');
    const [feeCost, setFeeCost] = useState('0');
    const [rebuyCost, setRebuyCost] = useState('0');
    const [addonCost, setAddonCost] = useState('0');

    const handleSubmit = useCallback(() => {
      const trimmedName = name.trim();
      if (trimmedName.length < 1 || trimmedName.length > 100) {
        addToast({ type: 'warning', message: '대회 이름을 1~100자로 입력해주세요.' });
        return;
      }

      const seats = toInt(seatsPerTable);
      if (seats < 2 || seats > 11) {
        addToast({ type: 'warning', message: '테이블 좌석 수는 2~11 사이여야 합니다.' });
        return;
      }

      const input: CreateOpsTournamentInput = {
        name: trimmedName,
        venue: venue.trim() || undefined,
        eventDate: eventDate.trim() || undefined,
        gameType: gameType.trim() || 'NLH',
        startingChips: toInt(startingChips),
        seatsPerTable: seats,
        config: {
          buyInChips: toInt(buyInChips),
          rebuyChips: toInt(rebuyChips),
          addonChips: toInt(addonChips),
          buyInCost: toInt(buyInCost),
          feeCost: toInt(feeCost),
          rebuyCost: toInt(rebuyCost),
          addonCost: toInt(addonCost),
        },
      };

      createMutation.mutate(input, {
        onSuccess: ({ tournamentId }) => {
          router.replace(`/(ops)/tournaments/${tournamentId}`);
        },
      });
    }, [
      name,
      venue,
      eventDate,
      gameType,
      startingChips,
      seatsPerTable,
      buyInChips,
      rebuyChips,
      addonChips,
      buyInCost,
      feeCost,
      rebuyCost,
      addonCost,
      addToast,
      createMutation,
    ]);

    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="대회 만들기" fallbackHref="/(ops)/tournaments" />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4">
            <Input label="대회 이름" value={name} onChangeText={setName} placeholder="예: 수요일 딥스택" maxLength={100} />
            <Input label="장소" value={venue} onChangeText={setVenue} placeholder="예: 강남 홀덤펍" />
            <Input
              label="개최일 (YYYY-MM-DD)"
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="2026-07-01"
              autoCapitalize="none"
            />
            <Input
              label="게임 종류"
              value={gameType}
              onChangeText={setGameType}
              placeholder="NLH"
              autoCapitalize="characters"
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="스타팅 칩" type="number" value={startingChips} onChangeText={setStartingChips} />
              </View>
              <View className="flex-1">
                <Input label="테이블 좌석" type="number" value={seatsPerTable} onChangeText={setSeatsPerTable} />
              </View>
            </View>

            <Text className="mt-2 text-sm font-sans-semibold uppercase text-content-secondary dark:text-secondary-400">
              칩 / 비용 설정
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="바이인 칩" type="number" value={buyInChips} onChangeText={setBuyInChips} />
              </View>
              <View className="flex-1">
                <Input label="리바이 칩" type="number" value={rebuyChips} onChangeText={setRebuyChips} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="애드온 칩" type="number" value={addonChips} onChangeText={setAddonChips} />
              </View>
              <View className="flex-1">
                <Input label="바이인 비용" type="number" value={buyInCost} onChangeText={setBuyInCost} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="참가비(피)" type="number" value={feeCost} onChangeText={setFeeCost} />
              </View>
              <View className="flex-1">
                <Input label="리바이 비용" type="number" value={rebuyCost} onChangeText={setRebuyCost} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="애드온 비용" type="number" value={addonCost} onChangeText={setAddonCost} />
              </View>
              <View className="flex-1" />
            </View>

            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={createMutation.isPending}
              className="mt-4"
            >
              대회 생성
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  ```
  Note: heavy XSS/length validation lives in the T4 schema invoked by the T6 service behind `useCreateOpsTournament`; this form does only UX-level required/range checks. `CreateOpsTournamentInput` is a **type-only** import (erased at runtime — no `supabase` pull into Presentation).

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: open `/(ops)/tournaments/new`, submit with blank name → warning toast, no navigation; submit valid → `router.replace` to detail (lands once Step 8 exists). Verify dark mode + numeric keyboards. Commit:
  ```bash
  git add app/\(ops\)/tournaments/new.tsx && git commit -m "feat(ops): 대회 생성 폼 화면 추가"
  ```

- [ ] **Step 6: `OpsStatusStats` component (§13 STATUS partial stats, D6)**

  Create `src/components/ops/OpsStatusStats.tsx`:
  ```tsx
  import React from 'react';
  import { View, Text } from 'react-native';
  import { Card } from '@/components/ui';
  import type { OpsPartialStats } from '@/types/ops';

  interface StatCell {
    label: string;
    value: string;
  }

  export interface OpsStatusStatsProps {
    stats: OpsPartialStats;
  }

  export function OpsStatusStats({ stats }: OpsStatusStatsProps) {
    const cells: StatCell[] = [
      { label: '진행 중', value: stats.playing.toLocaleString() },
      { label: '엔트리', value: stats.entries.toLocaleString() },
      { label: '총 칩', value: stats.totalChips.toLocaleString() },
      { label: '평균 스택', value: stats.averageStack.toLocaleString() },
      { label: '프라이즈풀', value: stats.prizePool.toLocaleString() },
    ];

    return (
      <View className="flex-row flex-wrap">
        {cells.map((cell) => (
          <View key={cell.label} className="w-1/2 p-1.5">
            <Card variant="elevated" padding="md">
              <Text className="text-xs font-sans uppercase text-content-secondary dark:text-secondary-400">
                {cell.label}
              </Text>
              <Text className="mt-1 text-2xl font-display-semibold text-content-primary dark:text-off-white">
                {cell.value}
              </Text>
            </Card>
          </View>
        ))}
      </View>
    );
  }

  export default OpsStatusStats;
  ```

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: rendered by Step 11; verify the 5 stat cells wrap 2-per-row in light/dark there. Commit:
  ```bash
  git add src/components/ops/OpsStatusStats.tsx && git commit -m "feat(ops): 현황 통계 컴포넌트 추가"
  ```

- [ ] **Step 7: `OpsParticipantRow` component (§13 player row)**

  Create `src/components/ops/OpsParticipantRow.tsx`. Rebuy/Add-on actions show only while `status === 'active'`:
  ```tsx
  import React from 'react';
  import { View, Text } from 'react-native';
  import { Button, Card } from '@/components/ui';
  import type { OpsParticipant } from '@/types/ops';

  export interface OpsParticipantRowProps {
    participant: OpsParticipant;
    onRebuy: (participantId: string) => void;
    onAddon: (participantId: string) => void;
    isRebuying?: boolean;
    isAddoning?: boolean;
  }

  export function OpsParticipantRow({
    participant,
    onRebuy,
    onAddon,
    isRebuying = false,
    isAddoning = false,
  }: OpsParticipantRowProps) {
    const isActive = participant.status === 'active';
    const meta = [participant.nationality, `${participant.chips.toLocaleString()} 칩`]
      .filter(Boolean)
      .join(' · ');

    return (
      <Card variant="elevated" padding="md" className="mx-4 mb-2 flex-row items-center">
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-sm bg-primary-50 dark:bg-primary-900/30">
          <Text className="text-sm font-sans-bold text-primary-700 dark:text-primary-300">
            #{participant.entryNumber}
          </Text>
        </View>
        <View className="flex-1 min-w-0">
          <Text
            className="text-base font-sans-semibold text-content-primary dark:text-off-white"
            numberOfLines={1}
          >
            {participant.name}
          </Text>
          <Text
            className="mt-0.5 text-xs text-content-secondary dark:text-secondary-400 font-sans"
            numberOfLines={1}
          >
            {meta}
          </Text>
        </View>
        {isActive ? (
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={() => onRebuy(participant.id)} loading={isRebuying}>
              리바이
            </Button>
            <Button variant="outline" size="sm" onPress={() => onAddon(participant.id)} loading={isAddoning}>
              애드온
            </Button>
          </View>
        ) : null}
      </Card>
    );
  }

  export default OpsParticipantRow;
  ```

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: rendered by Step 10; verify entry# chip + actions in light/dark there. Commit:
  ```bash
  git add src/components/ops/OpsParticipantRow.tsx && git commit -m "feat(ops): 참가자 행 컴포넌트 추가"
  ```

- [ ] **Step 8: `OpsRegistrationForm` component (§13 walk-in registration sheet)**

  Create `src/components/ops/OpsRegistrationForm.tsx`. Self-contained `SheetModal` (the established non-nested-Modal sheet from `@/components/ui`); emits `OpsRegistrationFormValues` minus `tournamentId` (the screen adds it):
  ```tsx
  import React, { useCallback, useState } from 'react';
  import { View } from 'react-native';
  import { SheetModal, Input, Button } from '@/components/ui';

  export interface OpsRegistrationFormValues {
    name: string;
    nationality?: string;
    phone?: string;
    buyInAmount?: number;
  }

  export interface OpsRegistrationFormProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (values: OpsRegistrationFormValues) => void;
    isSubmitting?: boolean;
  }

  export function OpsRegistrationForm({
    visible,
    onClose,
    onSubmit,
    isSubmitting = false,
  }: OpsRegistrationFormProps) {
    const [name, setName] = useState('');
    const [nationality, setNationality] = useState('');
    const [phone, setPhone] = useState('');
    const [buyInAmount, setBuyInAmount] = useState('');
    const [error, setError] = useState<string | undefined>(undefined);

    const reset = useCallback(() => {
      setName('');
      setNationality('');
      setPhone('');
      setBuyInAmount('');
      setError(undefined);
    }, []);

    const handleClose = useCallback(() => {
      reset();
      onClose();
    }, [reset, onClose]);

    const handleSubmit = useCallback(() => {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 50) {
        setError('참가자 이름을 1~50자로 입력해주세요.');
        return;
      }

      const parsed = buyInAmount.trim() ? Number.parseInt(buyInAmount, 10) : undefined;
      const amount = typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;

      onSubmit({
        name: trimmed,
        nationality: nationality.trim() || undefined,
        phone: phone.trim() || undefined,
        buyInAmount: amount,
      });
      reset();
    }, [name, nationality, phone, buyInAmount, onSubmit, reset]);

    return (
      <SheetModal
        visible={visible}
        onClose={handleClose}
        title="워크인 등록"
        isLoading={isSubmitting}
        footer={
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button variant="outline" onPress={handleClose} disabled={isSubmitting}>
                취소
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" onPress={handleSubmit} loading={isSubmitting}>
                등록
              </Button>
            </View>
          </View>
        }
      >
        <View className="gap-4 px-4 py-4">
          <Input
            label="이름"
            value={name}
            onChangeText={setName}
            error={error}
            maxLength={50}
            placeholder="참가자 이름"
          />
          <Input
            label="국적 (선택)"
            value={nationality}
            onChangeText={setNationality}
            placeholder="예: KR"
            autoCapitalize="characters"
          />
          <Input label="전화번호 (선택)" type="phone" value={phone} onChangeText={setPhone} placeholder="010-0000-0000" />
          <Input label="바이인 금액 (선택)" type="number" value={buyInAmount} onChangeText={setBuyInAmount} placeholder="0" />
        </View>
      </SheetModal>
    );
  }

  export default OpsRegistrationForm;
  ```

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: rendered by Step 10; verify the sheet opens, blank name shows inline error, valid submit closes it. Commit:
  ```bash
  git add src/components/ops/OpsRegistrationForm.tsx && git commit -m "feat(ops): 워크인 등록 폼 컴포넌트 추가"
  ```

- [ ] **Step 9: `[id]/_layout.tsx` (detail + nested PLAYERS/STATUS tabs) + `[id]/index.tsx` (redirect)**

  Create `app/(ops)/tournaments/[id]/_layout.tsx`. Loads the tournament via `useOpsTournament` (realtime built-in); RLS-only null guard → empty state (mirrors the my-postings `[id]/_layout` "RLS is single truth → null → empty" pattern). Shares one `StackHeader` (tournament name) above a nested `Tabs` whose `index` route is hidden (`href: null`):
  ```tsx
  /**
   * UNIQN Mobile - Ops Tournament Detail Layout
   * 대회 상세 레이아웃: 공유 헤더(StackHeader) + 중첩 Tabs(참가자/현황).
   * 권한 게이트는 RLS 단일 진실 — useOpsTournament 가 null 반환 시 빈 화면 처리.
   */

  import React from 'react';
  import { View } from 'react-native';
  import { Tabs, useLocalSearchParams } from 'expo-router';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { StackHeader } from '@/components/headers';
  import { EmptyState, Loading } from '@/components/ui';
  import { LAYOUT } from '@/constants';
  import { getLayoutColor, SURFACE_COLORS } from '@/constants/colors';
  import { useThemeStore } from '@/stores/themeStore';
  import { useOpsTournament } from '@/hooks/ops';

  export default function OpsTournamentDetailLayout() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const isDark = useThemeStore((s) => s.isDarkMode);
    const insets = useSafeAreaInsets();
    const { data: tournament, isLoading } = useOpsTournament(id || '');

    if (isLoading) {
      return <Loading variant="layout" />;
    }

    if (!tournament) {
      return (
        <View className="flex-1 bg-surface-page dark:bg-surface">
          <StackHeader title="라이브 운영" fallbackHref="/(ops)/tournaments" />
          <EmptyState
            title="대회를 찾을 수 없습니다"
            description="접근 권한이 없거나 삭제된 대회입니다."
            variant="error"
          />
        </View>
      );
    }

    return (
      <View className="flex-1 bg-surface-page dark:bg-surface">
        <StackHeader title={tournament.name} fallbackHref="/(ops)/tournaments" />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: getLayoutColor(isDark, 'tabBarActive'),
            tabBarInactiveTintColor: getLayoutColor(isDark, 'tabBarInactive'),
            tabBarStyle: {
              backgroundColor: getLayoutColor(isDark, 'tabBarBg'),
              borderTopColor: SURFACE_COLORS.overlay,
              height: LAYOUT.TAB_BAR_HEIGHT + insets.bottom,
              paddingBottom: insets.bottom,
            },
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          }}
        >
          <Tabs.Screen name="index" options={{ href: null }} />
          <Tabs.Screen name="players" options={{ title: '참가자' }} />
          <Tabs.Screen name="status" options={{ title: '현황' }} />
        </Tabs>
      </View>
    );
  }
  ```

  Create `app/(ops)/tournaments/[id]/index.tsx` — the bare-detail URL redirects to the PLAYERS tab:
  ```tsx
  import React from 'react';
  import { Redirect, useLocalSearchParams } from 'expo-router';

  export default function OpsTournamentIndexRedirect() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <Redirect href={`/(ops)/tournaments/${id}/players`} />;
  }
  ```

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: open `/(ops)/tournaments/<id>` → redirects to `/players`; header shows the tournament name; bottom tabs `참가자`/`현황` switch; an unauthorized/missing id shows the error empty state (no tabs). Verify dark mode. Commit:
  ```bash
  git add app/\(ops\)/tournaments/\[id\]/_layout.tsx app/\(ops\)/tournaments/\[id\]/index.tsx && git commit -m "feat(ops): 대회 상세 레이아웃(참가자/현황 탭) + index 리다이렉트 추가"
  ```

- [ ] **Step 10: `[id]/players.tsx` — PLAYERS tab**

  Create `app/(ops)/tournaments/[id]/players.tsx`. Uses `useOpsParticipants` + search, the registration sheet, and per-row rebuy/add-on. Mutations resolve actor internally; per-call `onSuccess` closes the sheet (the hook owns invalidate + toast):
  ```tsx
  import React, { useCallback, useMemo, useState } from 'react';
  import { View } from 'react-native';
  import { useLocalSearchParams } from 'expo-router';
  import { AppFlashList } from '@/components/ui/AppFlashList';
  import { Button, EmptyState, ErrorState, Input, Loading } from '@/components/ui';
  import { PlusIcon } from '@/components/icons';
  import { TEXT_COLORS } from '@/constants/colors';
  import { OpsParticipantRow } from '@/components/ops/OpsParticipantRow';
  import {
    OpsRegistrationForm,
    type OpsRegistrationFormValues,
  } from '@/components/ops/OpsRegistrationForm';
  import { useOpsParticipants, useRegisterParticipant, useAddRebuy, useAddAddon } from '@/hooks/ops';
  import type { OpsParticipant } from '@/types/ops';

  export default function OpsTournamentPlayersScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const tournamentId = id || '';
    const { data: participants, isLoading, error, refetch } = useOpsParticipants(tournamentId);
    const registerMutation = useRegisterParticipant(tournamentId);
    const rebuyMutation = useAddRebuy(tournamentId);
    const addonMutation = useAddAddon(tournamentId);

    const [search, setSearch] = useState('');
    const [formVisible, setFormVisible] = useState(false);

    const filtered = useMemo(() => {
      if (!participants) {
        return [];
      }
      const q = search.trim().toLowerCase();
      if (!q) {
        return participants;
      }
      return participants.filter(
        (p) => p.name.toLowerCase().includes(q) || String(p.entryNumber).includes(q)
      );
    }, [participants, search]);

    const handleRegister = useCallback(
      (values: OpsRegistrationFormValues) => {
        registerMutation.mutate(
          { tournamentId, ...values },
          { onSuccess: () => setFormVisible(false) }
        );
      },
      [registerMutation, tournamentId]
    );

    const handleRebuy = useCallback(
      (participantId: string) => {
        rebuyMutation.mutate({ participantId });
      },
      [rebuyMutation]
    );

    const handleAddon = useCallback(
      (participantId: string) => {
        addonMutation.mutate({ participantId });
      },
      [addonMutation]
    );

    return (
      <View className="flex-1 bg-surface-page dark:bg-surface">
        <View className="gap-3 px-4 py-3">
          <Button
            variant="primary"
            onPress={() => setFormVisible(true)}
            icon={<PlusIcon size={20} color={TEXT_COLORS.onGold} />}
          >
            워크인 등록
          </Button>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="이름 또는 엔트리 번호 검색"
            autoCapitalize="none"
          />
        </View>

        {isLoading ? (
          <Loading variant="layout" message="참가자를 불러오는 중..." />
        ) : error ? (
          <ErrorState error={error} title="참가자를 불러올 수 없습니다" onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? '검색 결과가 없습니다' : '등록된 참가자가 없습니다'}
            description={search ? undefined : '워크인 등록으로 첫 참가자를 추가하세요.'}
          />
        ) : (
          <AppFlashList
            data={filtered}
            renderItem={({ item }: { item: OpsParticipant }) => (
              <OpsParticipantRow
                participant={item}
                onRebuy={handleRebuy}
                onAddon={handleAddon}
                isRebuying={rebuyMutation.isPending}
                isAddoning={addonMutation.isPending}
              />
            )}
            keyExtractor={(item: OpsParticipant) => item.id}
            estimatedItemSize={72}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}

        <OpsRegistrationForm
          visible={formVisible}
          onClose={() => setFormVisible(false)}
          onSubmit={handleRegister}
          isSubmitting={registerMutation.isPending}
        />
      </View>
    );
  }
  ```

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: PLAYERS tab — register a walk-in (entry# increments, status `active`, chips = starting_chips); search filters; rebuy/add-on bump chips live via realtime. Verify dark mode. Commit:
  ```bash
  git add app/\(ops\)/tournaments/\[id\]/players.tsx && git commit -m "feat(ops): 참가자 탭(워크인 등록/리바이/애드온) 화면 추가"
  ```

- [ ] **Step 11: `[id]/status.tsx` — STATUS tab**

  Create `app/(ops)/tournaments/[id]/status.tsx`. Composes `useOpsPartialStats` (pure D6 stats) + `useOpsTournament` (current registration/status), registration toggle (`useToggleRegistration`), and legal status transitions (`useSetTournamentStatus`):
  ```tsx
  import React, { useCallback } from 'react';
  import { ScrollView, View, Text } from 'react-native';
  import { useLocalSearchParams } from 'expo-router';
  import { Button, Card, Loading } from '@/components/ui';
  import { OpsStatusStats } from '@/components/ops/OpsStatusStats';
  import {
    useOpsTournament,
    useOpsPartialStats,
    useToggleRegistration,
    useSetTournamentStatus,
  } from '@/hooks/ops';

  export default function OpsTournamentStatusScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const tournamentId = id || '';
    const { data: tournament, isLoading } = useOpsTournament(tournamentId);
    const stats = useOpsPartialStats(tournamentId);
    const toggleMutation = useToggleRegistration();
    const statusMutation = useSetTournamentStatus();

    const handleToggle = useCallback(() => {
      if (!tournament) {
        return;
      }
      toggleMutation.mutate({ id: tournamentId, open: !tournament.registrationOpen });
    }, [tournament, tournamentId, toggleMutation]);

    const handleStatus = useCallback(
      (status: 'active' | 'completed' | 'upcoming') => {
        statusMutation.mutate({ id: tournamentId, status });
      },
      [statusMutation, tournamentId]
    );

    if (isLoading) {
      return <Loading variant="layout" />;
    }

    if (!tournament) {
      return null;
    }

    return (
      <ScrollView
        className="flex-1 bg-surface-page dark:bg-surface"
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <OpsStatusStats stats={stats} />

        <Card variant="elevated" padding="md" className="mx-1.5 mt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                참가 등록
              </Text>
              <Text className="mt-0.5 text-sm text-content-secondary dark:text-secondary-400 font-sans">
                {tournament.registrationOpen ? '현재 등록을 받고 있습니다.' : '등록이 마감되었습니다.'}
              </Text>
            </View>
            <Button
              variant={tournament.registrationOpen ? 'outline' : 'primary'}
              size="sm"
              onPress={handleToggle}
              loading={toggleMutation.isPending}
            >
              {tournament.registrationOpen ? '등록 마감' : '등록 열기'}
            </Button>
          </View>
        </Card>

        <Card variant="elevated" padding="md" className="mx-1.5 mt-3">
          <Text className="mb-3 text-base font-sans-semibold text-content-primary dark:text-off-white">
            대회 상태
          </Text>
          {tournament.status === 'upcoming' ? (
            <Button variant="primary" onPress={() => handleStatus('active')} loading={statusMutation.isPending}>
              대회 시작
            </Button>
          ) : tournament.status === 'active' ? (
            <View className="gap-2">
              <Button variant="primary" onPress={() => handleStatus('completed')} loading={statusMutation.isPending}>
                대회 종료
              </Button>
              <Button variant="outline" onPress={() => handleStatus('upcoming')} loading={statusMutation.isPending}>
                예정 상태로 되돌리기
              </Button>
            </View>
          ) : (
            <Text className="text-sm text-content-secondary dark:text-secondary-400 font-sans">
              종료된 대회입니다.
            </Text>
          )}
        </Card>
      </ScrollView>
    );
  }
  ```
  Note: the status buttons offer only the legal transitions enforced by `ops_set_tournament_status` (contracts §6: upcoming→active, active→completed, active→upcoming). An illegal transition (e.g. completed→active) is unreachable from the UI and additionally rejected server-side with `INVALID_STATUS`.

  ```bash
  npm run quality
  ```
  Expected: exit 0, 0 errors.

  Manual render: STATUS tab — 5 stat cells reflect live participants; toggle flips `registration_open` (PLAYERS register button then blocked server-side with `REGISTRATION_CLOSED`); `대회 시작`/`대회 종료` move status and update the badge on the list card. Verify dark mode. Commit:
  ```bash
  git add app/\(ops\)/tournaments/\[id\]/status.tsx && git commit -m "feat(ops): 현황 탭(통계/등록 토글/상태 전이) 화면 추가"
  ```

---

**Final gate (whole task):**
```bash
npm run quality
```
Expected: exit 0 — tsc 0 errors, eslint 0 errors, prettier clean across all 12 new/edited files.

**Open issues / dependencies to confirm before merge:**
- T7 must export the 10 hooks with the exact signatures in the Consumes block (queries + 6 mutation hooks; mutation hooks resolve actor via `useAuthStore.user.uid` and own invalidate/toast). Any drift → `TS2307`/`TS2554` in this task's `npm run quality`.
- T5 must re-export `CreateOpsTournamentInput` (and `OpsTournamentCostConfig`, `RegisterParticipantInput`) from the `@/repositories` barrel for the type-only import in `new.tsx`.
- T4 must export `OpsTournament`, `OpsParticipant`, `OpsTournamentStatus`, `OpsPartialStats` from `@/types/ops`.
- Nested `Tabs` inside `[id]/_layout.tsx` renders a second bottom tab bar beneath the `(ops)` Stack — confirm on a physical device that it does not collide with the OS gesture bar (insets handled via `useSafeAreaInsets`). If undesirable, the contracts permit a segmented-control fallback (§13) — would replace Step 9/10/11 routing only, not the components.
- `useOpsPartialStats` is consumed as returning `OpsPartialStats` directly (per contracts §12 "returns computeOpsPartialStats(...)"). If T7 instead wraps it in `{ data }`, update `status.tsx` to `const stats = useOpsPartialStats(id).data` — single-line change flagged here.
- No PROD migration in this task (UI only). Manual render verification is advisory, not a CI gate; CI gate is `npm run quality`.
### Task T9: uniqn → ops Bridge (env + constant + Live Ops ActionCard)

Wire the existing employer posting-detail screen to the new Live Ops (ops) web app. Adds one env var, one constant module, and one gated `<ActionCard>` that deep-links out to the ops web app. No new screens, no DB, no client owner/role guard — visibility is governed by posting fields only, and access by RLS + the `(ops)` `_layout` gate (T8).

> Run all commands from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`.
> Constraints (from contracts §1): `@/` imports only; `logger` not `console.log`; every className carries a static `dark:` variant; camelCase in app code; immutable (spread, no mutation). This task touches no DB, so `npm run db:reset`/`npm run test:db` are N/A. The verification gate is `npm run quality` (tsc strict + eslint + prettier) plus a manual visibility smoke check.
> Dependency: T7 must be complete (provides `useOpsTournamentForPosting` from `@/hooks/ops`). T9 is the last app-layer task (order T1→T2→…→T8→T9).

**Files:**
- Modify: `src/lib/env.ts` (add `EXPO_PUBLIC_OPS_URL` to the Zod schema + `rawEnv` collection)
- Create: `src/constants/ops.ts` (`OPS_BASE_URL`)
- Modify: `app.config.ts` (NO edit needed — see Step 3; documented no-op)
- Modify: `app/(employer)/my-postings/[id]/index.tsx` (imports + hook + handler + gated Live Ops `ActionCard`)
- Test: none new (no Jest harness for env/constants/screen wiring). Gate = `npm run quality`; behavior verified by the Step 7 manual checklist.

**Interfaces:**

Consumes (must already exist before T9):
- From T7 — `src/hooks/ops/index.ts`: `useOpsTournamentForPosting(jobPostingId: string)` → TanStack `useQuery` result whose `data` is `OpsTournament | null | undefined` (queryFn `opsTournamentRepository.findByJobPostingId`, `enabled: !!jobPostingId`, null-safe). Import: `import { useOpsTournamentForPosting } from '@/hooks/ops'`.
- From T4 — `src/types/ops.ts`: `interface OpsTournament { id: string; status: OpsTournamentStatus; … }`, `type OpsTournamentStatus = 'upcoming' | 'active' | 'completed'`. (Referenced only through the hook's `data` type; no direct import needed here.)
- Existing — `src/services/observability/index.ts`: `deepLinkService.openExternalUrl(url: string): Promise<boolean>`. Import: `import { deepLinkService } from '@/services/observability'`.
- Existing — `src/constants/index.ts`: `STATUS.TOURNAMENT.APPROVED === 'approved'`. Already imported in the target file (`import { STATUS } from '@/constants'`).
- Existing — `src/components/icons/index.tsx`: `TrophyOutlineIcon`. Existing — `src/constants/colors`: `PRIMARY_COLORS` (already imported in target file).
- Existing — `src/lib/env.ts`: `getEnv(): Env`.

Produces (relied on by nothing later in 1a; bridge is a leaf):
- `src/constants/ops.ts`: `export const OPS_BASE_URL: string`.
- `src/lib/env.ts`: `Env` type gains optional `EXPO_PUBLIC_OPS_URL?: string`.

---

- [ ] **Step 1: (RED) Create `src/constants/ops.ts` referencing the not-yet-added env field**

  Create `src/constants/ops.ts` with the EXACT contract §14 body:

  ```ts
  /**
   * UNIQN Mobile - 라이브 운영(ops) 브리지 상수
   *
   * EXPO_PUBLIC_OPS_URL 가 설정되면 그 값을, 아니면 프로덕션 기본값을 사용한다.
   * EXPO_PUBLIC_* 는 Expo 빌드 시 자동 인라인되므로 app.config 패스스루가 불필요하다.
   */
  import { getEnv } from '@/lib/env';

  export const OPS_BASE_URL = getEnv().EXPO_PUBLIC_OPS_URL ?? 'https://ops.uniqn.app';
  ```

  Run the type gate:

  ```bash
  npm run quality
  ```

  Expected: FAIL — tsc error in `src/constants/ops.ts`:
  `Property 'EXPO_PUBLIC_OPS_URL' does not exist on type 'Env'.`
  (`Env = z.infer<typeof envSchema>` and the field is not yet in the schema.) This proves the constant genuinely depends on the env field added in Step 2.

- [ ] **Step 2: (GREEN) Add `EXPO_PUBLIC_OPS_URL` to the env Zod schema and `rawEnv`**

  Edit `src/lib/env.ts`. First, add the optional field to the schema (after `EXPO_PUBLIC_RELEASE_CHANNEL`):

  Replace:
  ```ts
    // 선택적 설정
    EXPO_PUBLIC_RELEASE_CHANNEL: z
      .enum(['development', 'staging', 'production'])
      .optional()
      .default('development'),
  });
  ```
  With:
  ```ts
    // 선택적 설정
    EXPO_PUBLIC_RELEASE_CHANNEL: z
      .enum(['development', 'staging', 'production'])
      .optional()
      .default('development'),

    // 라이브 운영(ops) 웹앱 베이스 URL — 미설정 시 constants/ops.ts 의 fallback 사용
    EXPO_PUBLIC_OPS_URL: z.string().url().optional(),
  });
  ```

  Then add it to the `rawEnv` collection so the value is actually read from `process.env`:

  Replace:
  ```ts
      EXPO_PUBLIC_RELEASE_CHANNEL: process.env.EXPO_PUBLIC_RELEASE_CHANNEL,
    };
  ```
  With:
  ```ts
      EXPO_PUBLIC_RELEASE_CHANNEL: process.env.EXPO_PUBLIC_RELEASE_CHANNEL,
      EXPO_PUBLIC_OPS_URL: process.env.EXPO_PUBLIC_OPS_URL,
    };
  ```

  Run the gate again:

  ```bash
  npm run quality
  ```

  Expected: PASS (exit 0, 0 errors). `getEnv().EXPO_PUBLIC_OPS_URL` is now `string | undefined`, and `?? 'https://ops.uniqn.app'` yields `string`, so `OPS_BASE_URL: string` compiles.

- [ ] **Step 3: Confirm `app.config.ts` needs NO passthrough (documented no-op + evidence)**

  Contract §14 says "pass `EXPO_PUBLIC_OPS_URL` through extra/env **if needed**". It is NOT needed: Expo auto-inlines every `EXPO_PUBLIC_*` variable into the bundle at build time (Metro/babel replaces `process.env.EXPO_PUBLIC_OPS_URL` with its literal value), exactly like the existing `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` which work in production without any `extra` entry.

  Evidence command:

  ```bash
  grep -n "EXPO_PUBLIC_SUPABASE_URL\|EXPO_PUBLIC_OPS_URL" app.config.ts
  ```

  Expected: no matches (grep exits 1). Confirms `EXPO_PUBLIC_*` vars are not surfaced via `app.config.ts` `extra`, so `EXPO_PUBLIC_OPS_URL` requires no `app.config.ts` change. Do NOT edit `app.config.ts`.

  (Operational note, not a code change: for OTA/EAS builds set `EXPO_PUBLIC_OPS_URL` as an EAS secret / `.env.local` entry. The field is optional and the `OPS_BASE_URL` fallback `https://ops.uniqn.app` covers any environment where it is unset, so the app builds and runs without it.)

- [ ] **Step 4: Commit the bridge foundation**

  ```bash
  git add src/lib/env.ts src/constants/ops.ts
  git commit -m "feat(ops): EXPO_PUBLIC_OPS_URL env + OPS_BASE_URL 상수 추가"
  ```

  Expected: one commit created on `feat/tournament-ops-revival`.

- [ ] **Step 5: Add imports, the ops hook, and the deep-link handler to the posting-detail screen**

  Edit `app/(employer)/my-postings/[id]/index.tsx`.

  (a) Add `TrophyOutlineIcon` to the existing icon import block. Replace:
  ```ts
    ShareIcon,
    TrashIcon,
    UserPlusIcon,
  ```
  With:
  ```ts
    ShareIcon,
    TrashIcon,
    TrophyOutlineIcon,
    UserPlusIcon,
  ```

  (b) Add the three new module imports immediately after the existing `@/types` type import. Replace:
  ```ts
  import type { PostingManagementViewModel, PostingType, TournamentApprovalStatus } from '@/types';
  ```
  With:
  ```ts
  import type { PostingManagementViewModel, PostingType, TournamentApprovalStatus } from '@/types';
  import { OPS_BASE_URL } from '@/constants/ops';
  import { useOpsTournamentForPosting } from '@/hooks/ops';
  import { deepLinkService } from '@/services/observability';
  ```

  (c) Add the ops-tournament query alongside the other top-level hooks (must run BEFORE the early returns, so key off the route param `id`, never `posting`). Replace:
  ```ts
    const { mutate: deleteJobPosting, isPending: isDeleting } = useDeleteJobPosting();
    const { shareJob, isSharing } = useShare();
  ```
  With:
  ```ts
    const { mutate: deleteJobPosting, isPending: isDeleting } = useDeleteJobPosting();
    const { shareJob, isSharing } = useShare();
    // 라이브 운영: 공고에 연결된 ops 대회 조회. enabled:!!id 로 null-safe, 권한은 RLS 가 통제.
    const { data: opsTournament } = useOpsTournamentForPosting(id || '');
  ```

  (d) Add the deep-link handler next to the other `useCallback` handlers. Replace:
  ```ts
    const handleCollaborators = useCallback(() => {
      router.push(`/(employer)/my-postings/${id}/collaborators`);
    }, [id, router]);
  ```
  With:
  ```ts
    const handleCollaborators = useCallback(() => {
      router.push(`/(employer)/my-postings/${id}/collaborators`);
    }, [id, router]);

    // id 는 라우트 파라미터로 posting.id 와 동일하다. ops 대회가 있으면 해당 대회를,
    // 없으면 from-posting 부트스트랩 경로를 외부 ops 웹앱으로 연다. (void: 기존 shareJob 패턴과 동일)
    const handleLiveOps = useCallback(() => {
      const url = opsTournament
        ? `${OPS_BASE_URL}/t/${opsTournament.id}`
        : `${OPS_BASE_URL}/t/from-posting?postingId=${id}`;
      void deepLinkService.openExternalUrl(url);
    }, [opsTournament, id]);
  ```

  Do not run the gate yet — the JSX consumer is added in Step 6 (otherwise eslint flags `handleLiveOps`/`TrophyOutlineIcon`/`opsTournament` as unused). Steps 5 and 6 are one logical edit, split only for readability.

- [ ] **Step 6: Insert the gated Live Ops `<ActionCard>` (after settlements card, before collaborators card)**

  Still in `app/(employer)/my-postings/[id]/index.tsx`, inside the `관리` section `<View className="gap-3">`. Insert the Live Ops card as the immediate previous sibling of the collaborators (`공유 관리`) card — this places it after the settlements card and before the collaborators card per contract §14. Reuse the file's own `ActionCard` component and the existing tournament-gate idiom (mirrors the rejected-banner condition at the bottom of the same file).

  Replace:
  ```tsx
              <ActionCard
                icon={<UserPlusIcon size={24} color="#3B82F6" />}
                title="공유 관리"
                description="이 공고를 함께 관리할 협업자를 추가하거나 제거합니다."
                onPress={handleCollaborators}
                testID="job-posting-manage-collaborators"
              />
  ```
  With:
  ```tsx
              {posting.postingType === 'tournament' &&
              posting.tournamentConfig?.approvalStatus === STATUS.TOURNAMENT.APPROVED &&
              !['draft', 'pending', 'rejected', 'cancelled', 'expired'].includes(posting.status) ? (
                <ActionCard
                  icon={<TrophyOutlineIcon size={24} color={PRIMARY_COLORS[600]} />}
                  title={opsTournament ? '라이브 운영 열기' : '라이브 운영 시작'}
                  description="대회 현장 등록과 칩 관리를 실시간으로 진행합니다."
                  badge={
                    opsTournament
                      ? {
                          label: '진행 중',
                          variant: opsTournament.status === 'active' ? 'success' : 'primary',
                        }
                      : undefined
                  }
                  onPress={handleLiveOps}
                  testID="job-posting-live-ops"
                />
              ) : null}

              <ActionCard
                icon={<UserPlusIcon size={24} color="#3B82F6" />}
                title="공유 관리"
                description="이 공고를 함께 관리할 협업자를 추가하거나 제거합니다."
                onPress={handleCollaborators}
                testID="job-posting-manage-collaborators"
              />
  ```

  Notes (why this is correct, not improvised):
  - `ActionCard` requires `title` + `description`; `title` is set dynamically (없음→`라이브 운영 시작`, 있음→`라이브 운영 열기`) exactly like the other cards pass `title` directly. The badge `variant` union (`'primary' | 'success' | 'warning' | 'error'`) accepts `'success'`/`'primary'`.
  - NO client owner/role guard — only posting-field gating; RLS + the `(ops)` `_layout` gate (T8) enforce authorization.
  - Dark mode: handled inside `ActionCard` (its surfaces already carry `dark:` variants); the icon color uses the shared `PRIMARY_COLORS[600]` token. No new className introduced here.
  - `void deepLinkService.openExternalUrl(...)` mirrors the existing `void shareJob(posting)` pattern (avoids a floating-promise lint error while keeping `onPress: () => void`).

  Run the gate:

  ```bash
  npm run quality
  ```

  Expected: PASS (exit 0, 0 errors — tsc strict + eslint + prettier all clean).

- [ ] **Step 7: Manual visibility smoke check (verify gating, label, deep-link)**

  No automated screen test exists for this surface, so verify behavior by inspection against the gate condition. Confirm each row:

  | Posting condition | Live Ops card | Expected |
  |---|---|---|
  | `postingType==='tournament'`, `approvalStatus==='approved'`, `status==='active'`, no ops tournament yet | shown | title `라이브 운영 시작`, no badge, opens `{OPS_BASE_URL}/t/from-posting?postingId={id}` |
  | same, ops tournament exists with `status!=='active'` (e.g. `upcoming`) | shown | title `라이브 운영 열기`, badge `진행 중` variant `primary`, opens `{OPS_BASE_URL}/t/{tournamentId}` |
  | same, ops tournament exists with `status==='active'` | shown | title `라이브 운영 열기`, badge `진행 중` variant `success`, opens `{OPS_BASE_URL}/t/{tournamentId}` |
  | `postingType==='regular'` (or `urgent`/`fixed`) | hidden | gate's `postingType==='tournament'` is false |
  | tournament with `approvalStatus==='pending'` or `'rejected'` | hidden | gate's APPROVED check false |
  | tournament approved but `status` ∈ {`draft`,`pending`,`rejected`,`cancelled`,`expired`} | hidden | excluded-status array includes it |

  Optional runtime confirmation (only if a dev build is already running — do not start one solely for this):
  ```bash
  npm test -- --testPathPattern="my-postings" 2>/dev/null || echo "no screen test (expected) — rely on quality gate + table above"
  ```
  Expected: no matching test file (this screen has no Jest spec); the `npm run quality` PASS from Step 6 plus the table above are the completion evidence.

- [ ] **Step 8: Commit the bridge UI**

  ```bash
  git add "app/(employer)/my-postings/[id]/index.tsx"
  git commit -m "feat(ops): 공고 상세에 라이브 운영 ActionCard 브리지 추가"
  ```

  Expected: one commit created. T9 complete — verify with:
  ```bash
  git --no-pager log --oneline -2
  ```
  Expected: top two commits are the two `feat(ops):` commits from Steps 4 and 8.
### Task T10: pgTAP fixture + 4 RLS/RPC/append-only/allocation test files (§15, §D4)

> Reader context: This is the database test suite for the OPS slice 1a (live tournament ops). It depends ONLY on the DB objects shipped by T1 (enums + `ops_tournaments`/`ops_participants`/`ops_events` tables + `is_ops_member` + SELECT-only RLS + table-DML REVOKE + `ops_events` append-only trigger) and T2 (7 SECDEF RPCs + grants DO-loop + realtime publication ADD). It writes NO app/TS code. pgTAP runs inside the local Supabase Postgres container (`supabase_db_uniqn`); helper SQL is registered by `docker cp` + `psql` (mirrors the existing `jpc_helpers.sql` flow); tests run via `supabase test db`.
>
> Key locked decisions you MUST honor (from contracts §0):
> - **D3** — ops tables are SELECT-only RLS; every write is a SECDEF RPC; INSERT/UPDATE/DELETE are REVOKEd from anon+authenticated. The test DB GRANTs tables back (CLI-drift defense) but RLS (no INSERT/UPDATE/DELETE policy + FORCE) is still the boundary, so authenticated still cannot write directly.
> - **D4** — a single pgTAP transaction cannot spawn concurrent sessions. We assert (a) sequential `ops_register_participant` calls yield gap-free monotonic `entry_number` (1, 2) and (b) `UNIQUE(tournament_id, entry_number)` rejects a duplicate (SQLSTATE 23505). True concurrency serialization (`FOR UPDATE`) is covered by code review, NOT pgTAP. Document this in the test file header.
> - The fixture grants **tables/sequences ONLY, NO function EXECUTE** — otherwise `ops_rpc_security`'s `has_function_privilege('anon', …)=false` assertions would be undone (mirrors `jpc_helpers.sql` warning at lines 44-46).

**Files:**

- Create:
  - `supabase/fixtures/ops_helpers.sql` — table/sequence GRANTs (CLI-drift defense) + `ops_test_seed()` (SECDEF) + `ops_test_set_user(uuid)`
  - `supabase/tests/ops_tables_rls.test.sql`
  - `supabase/tests/ops_rpc_security.test.sql`
  - `supabase/tests/ops_events_append_only.test.sql`
  - `supabase/tests/ops_entry_number_allocation.test.sql`
- Modify:
  - `package.json` — extend the `test:db:helpers` script to also `docker cp` + `psql` register `ops_helpers.sql`
- Test: the 4 `.test.sql` files ARE the tests; run via `npm run test:db`.

**Interfaces:**

- Consumes (from T1 + T2, must already exist in the local DB after `npm run db:reset`):
  - Tables: `public.ops_tournaments(id, owner_id, job_posting_id, name, status, starting_chips, seats_per_table, registration_open, next_entry_seq, …)`, `public.ops_participants(id, tournament_id, entry_number, name, status, chips, …)` with `UNIQUE(tournament_id, entry_number)`, `public.ops_events(id, tournament_id, type, actor_id, payload, created_at)` (append-only).
  - Enums: `ops_tournament_status`, `ops_participant_status`, `ops_event_type`.
  - Function: `public.is_ops_member(_tournament_id uuid, _user_id uuid) RETURNS boolean` (SECDEF), `public.is_workspace_member(uuid, uuid)`, `public.is_admin()`.
  - SECDEF RPCs (exact signatures — used by `has_function_privilege` and behavioral calls):
    - `public.ops_create_tournament(uuid, text, text, date, text, uuid, integer, integer, jsonb) RETURNS jsonb` → `{tournament_id}` (actor = p_owner_id; guard raises `PERMISSION_DENIED%`)
    - `public.ops_update_tournament(uuid, uuid, jsonb) RETURNS jsonb`
    - `public.ops_set_tournament_status(uuid, uuid, ops_tournament_status) RETURNS jsonb`
    - `public.ops_register_participant(uuid, uuid, text, text, text, integer) RETURNS jsonb` → `{participant_id, entry_number}` (raises `REGISTRATION_CLOSED%` when `registration_open=false`)
    - `public.ops_add_rebuy(uuid, uuid) RETURNS jsonb`
    - `public.ops_add_addon(uuid, uuid) RETURNS jsonb`
    - `public.ops_toggle_registration(uuid, uuid, boolean) RETURNS jsonb` → `{tournament_id, registration_open}` (appends `registration_toggled` event)
  - RPC actor guard string prefix (first statement of every RPC): `PERMISSION_DENIED:` with `ERRCODE='P0001'`. Append-only trigger message prefix: `OPS_EVENTS_APPEND_ONLY:` with `ERRCODE='P0001'`.
  - Realtime: `ops_tournaments` + `ops_participants` ARE in `supabase_realtime`; `ops_events` is NOT.
- Produces (the fixture API later test files in THIS task rely on):
  - `ops_test_seed() RETURNS TABLE(owner_id uuid, member_id uuid, outsider_id uuid, workspace_id uuid, job_posting_id uuid, tournament_id uuid, participant_id uuid)` — seeds 3 users (owner+member = employer, outsider = staff), a workspace with `member` as a `workspace_members` row, a `job_posting` in that workspace owned by `owner`, an `ops_tournaments` row (`owner_id=owner`, `job_posting_id=job_posting`, `registration_open=true`, `next_entry_seq=1`), one `ops_participants` row (`entry_number=1`), and one `ops_events` row (`tournament_created`).
  - `ops_test_set_user(p_user_id uuid) RETURNS void` — sets `request.jwt.claims` (sub + `role=authenticated` + non-admin `app_metadata.role=employer`) and switches `role` to `authenticated`.

---

- [ ] **Step 1: Write the first failing test `ops_tables_rls.test.sql`**

  Create `supabase/tests/ops_tables_rls.test.sql`:

  ```sql
  -- uniqn-mobile/supabase/tests/ops_tables_rls.test.sql
  -- OPS 슬라이스 1a — ops_* 테이블 SELECT-only RLS 매트릭스 (§5, §15)
  -- owner/workspace-member 는 가시, outsider/anon 은 0 행.
  -- is_ops_member = (owner_id=uid) OR (job_posting 연결 + is_workspace_member(ws, uid)).
  -- 안전: BEGIN/ROLLBACK. JWT claims 로 auth.uid()/role 시뮬레이션 (ops_test_set_user).
  BEGIN;
  SELECT plan(8);

  DO $$
  DECLARE s RECORD;
  BEGIN
    SELECT * INTO s FROM ops_test_seed();
    PERFORM set_config('ops.owner_id',    s.owner_id::text,      true);
    PERFORM set_config('ops.member_id',   s.member_id::text,     true);
    PERFORM set_config('ops.outsider_id', s.outsider_id::text,   true);
    PERFORM set_config('ops.tour_id',     s.tournament_id::text, true);
  END $$;

  -- ── owner: 자기 대회/참가자/이벤트 모두 가시 ──
  SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
  SELECT is(
    (SELECT count(*)::int FROM public.ops_tournaments WHERE id = (current_setting('ops.tour_id'))::uuid),
    1, 'ops_tournaments SELECT: owner sees 1');
  SELECT is(
    (SELECT count(*)::int FROM public.ops_participants WHERE tournament_id = (current_setting('ops.tour_id'))::uuid),
    1, 'ops_participants SELECT: owner sees 1');
  SELECT is(
    (SELECT count(*)::int FROM public.ops_events WHERE tournament_id = (current_setting('ops.tour_id'))::uuid),
    1, 'ops_events SELECT: owner sees 1');

  -- ── workspace member: is_ops_member 의 is_workspace_member 분기로 가시 ──
  SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
  SELECT is(
    (SELECT count(*)::int FROM public.ops_tournaments WHERE id = (current_setting('ops.tour_id'))::uuid),
    1, 'ops_tournaments SELECT: workspace member sees 1');
  SELECT is(
    (SELECT count(*)::int FROM public.ops_participants WHERE tournament_id = (current_setting('ops.tour_id'))::uuid),
    1, 'ops_participants SELECT: workspace member sees 1');

  -- ── outsider(staff, 비멤버): 0 ──
  SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
  SELECT is(
    (SELECT count(*)::int FROM public.ops_tournaments WHERE id = (current_setting('ops.tour_id'))::uuid),
    0, 'ops_tournaments SELECT: outsider sees 0');
  SELECT is(
    (SELECT count(*)::int FROM public.ops_participants WHERE tournament_id = (current_setting('ops.tour_id'))::uuid),
    0, 'ops_participants SELECT: outsider sees 0');

  -- ── anon(빈 claims): SELECT 정책이 TO authenticated 라 anon 0 ──
  SELECT set_config('role', 'anon', true);
  SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
  SELECT is(
    (SELECT count(*)::int FROM public.ops_tournaments WHERE id = (current_setting('ops.tour_id'))::uuid),
    0, 'ops_tournaments SELECT: anon sees 0');

  RESET ROLE;
  SELECT * FROM finish();
  ROLLBACK;
  ```

- [ ] **Step 2: Run it — expect FAIL (fixture not registered yet)**

  Run from `C:\Users\user\Desktop\T-HOLDEM-ops\uniqn-mobile`:

  ```bash
  npm run db:reset && npm run test:db
  ```

  Expected: **FAIL**. `test:db:helpers` only registers `jpc_helpers.sql`, so `ops_test_seed()` is undefined:
  ```
  ops_tables_rls .. ERROR:  function ops_test_seed() does not exist
  ...
  Result: FAIL
  ```

- [ ] **Step 3: Create the fixture `supabase/fixtures/ops_helpers.sql`**

  ```sql
  -- uniqn-mobile/supabase/fixtures/ops_helpers.sql
  -- pgTAP OPS 슬라이스 1a 테스트 헬퍼 (RLS/RPC/append-only/entry# 테스트 공용)
  -- ============================================================================
  -- ⚠️ fixtures 전용 — PROD/migrations 등록 금지. 로컬/CI 테스트 DB 에만 적용.
  --    ops_test_seed 는 SECURITY DEFINER 로 RLS/REVOKE 를 우회하여 시드한다.
  --    migrations 폴더로 옮기거나 prod 에 등록하면 임의 사용자가 시드 가능 — 사고.
  -- 등록: npm run test:db (test:db:helpers 가 docker cp + psql 로 자동 등록)
  -- 메모리: pitfall_supabase_cli_latest_drift_implicit_table_grant (테이블 GRANT 명시)
  --         pitfall_supabase_auth_users_seed (NULL 토큰 컬럼 회피, 빈 문자열)
  --         pitfall_test_seed_zod_schema_first (raw INSERT 시 enum/NOT NULL 충족)
  -- ============================================================================

  -- ── 테이블/시퀀스 GRANT 정합 (Supabase CLI 버전 드리프트 방어) ──────────────
  -- 배경(jpc_helpers.sql 와 동일): RLS 테스트는 role 을 authenticated/anon 으로
  --   전환 후 public 테이블에 직접 접근한다. CLI latest 이미지가 마이그레이션
  --   생성 테이블에 implicit GRANT 를 자동부여하지 않아 RLS 평가 전 42501 로 die.
  --   prod 동치로 테이블/시퀀스 GRANT 를 확대 — RLS 가 실제 행 보안 경계라 안전.
  -- ⚠️ 함수는 GRANT 금지: ops RPC 하드닝(REVOKE EXECUTE FROM anon)을 되살리면
  --   ops_rpc_security.test.sql 의 has_function_privilege(anon,…)=false 가 회귀.
  --   ops 테이블에 ALL 을 줘도 INSERT/UPDATE/DELETE 정책 부재 + FORCE RLS 라
  --   authenticated 직접 쓰기는 여전히 차단(D3 보존). SELECT 만 정책 ALLOW.
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

  -- ── 시드: owner / workspace-member / outsider + tournament + participant ─────
  CREATE OR REPLACE FUNCTION ops_test_seed()
  RETURNS TABLE (
    owner_id       uuid,
    member_id      uuid,
    outsider_id    uuid,
    workspace_id   uuid,
    job_posting_id uuid,
    tournament_id  uuid,
    participant_id uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, extensions, pg_temp
  AS $$
  DECLARE
    v_owner     uuid := gen_random_uuid();
    v_member    uuid := gen_random_uuid();
    v_outsider  uuid := gen_random_uuid();
    v_ws        uuid := gen_random_uuid();
    v_jp        uuid := gen_random_uuid();
    v_tour      uuid := gen_random_uuid();
    v_part      uuid := gen_random_uuid();
    v_work_date date := current_date + 14;
  BEGIN
    -- auth.users (NULL 토큰 컬럼 빈 문자열로 — pitfall_supabase_auth_users_seed)
    INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES
      (v_owner,    'ops_owner_'    || v_owner    || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
      (v_member,   'ops_member_'   || v_member   || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
      (v_outsider, 'ops_outsider_' || v_outsider || '@test.local', '{"role":"staff"}'::jsonb,    '{}'::jsonb, now(), now(), '', '', '', '');

    -- public.users (handle_new_user 트리거 디폴트 보정 — ON CONFLICT)
    INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
    SELECT id, email, 'ops test',
      CASE WHEN id = v_outsider THEN 'staff'::user_role ELSE 'employer'::user_role END,
      true, now(), now()
    FROM auth.users
    WHERE id IN (v_owner, v_member, v_outsider)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

    -- workspace + 멤버(member 를 workspace_members 로 → is_ops_member 의 is_workspace_member 분기)
    INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
    VALUES (v_ws, 'ops test ws', v_owner, now(), now());
    INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
    VALUES (v_ws, v_member, 'editor', now());

    -- job_posting (tournament 연결 → 멤버 가시성 경로)
    INSERT INTO public.job_postings (
      id, owner_id, owner_name, workspace_id, title, status, posting_type,
      work_date, work_dates, total_positions, filled_positions, view_count,
      schema_version, contact_phone, created_at, updated_at
    )
    VALUES (
      v_jp, v_owner, 'ops owner', v_ws, 'ops test posting', 'active', 'regular',
      v_work_date::text, ARRAY[v_work_date::text], 3, 0, 0, 3, '+82101111111', now(), now()
    );

    -- ops_tournament (owner 소유 + posting 연결, registration_open=true)
    -- next_entry_seq=1 로 둬서 아래 seed participant(entry_number=1)와 정합.
    INSERT INTO public.ops_tournaments (
      id, owner_id, job_posting_id, name, status, starting_chips, seats_per_table, registration_open, next_entry_seq
    )
    VALUES (v_tour, v_owner, v_jp, 'ops test tournament', 'upcoming', 30000, 9, true, 1);

    -- ops_participant (직접 INSERT — SECDEF 가 REVOKE/RLS 우회), 워크인=active(D2/D7)
    INSERT INTO public.ops_participants (
      id, tournament_id, entry_number, name, status, chips
    )
    VALUES (v_part, v_tour, 1, 'seed player', 'active', 30000);

    -- ops_events 1 건 (RLS 가시성 테스트용)
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tour, 'tournament_created', v_owner, jsonb_build_object('tournament_id', v_tour));

    RETURN QUERY SELECT v_owner, v_member, v_outsider, v_ws, v_jp, v_tour, v_part;
  END;
  $$;

  -- ── JWT claims 스위치 — RLS 의 (SELECT auth.uid()) 가 읽는 컨텍스트 ──────────
  -- app_metadata.role 을 employer(비admin)로 박아 is_admin()=false 보장.
  CREATE OR REPLACE FUNCTION ops_test_set_user(p_user_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  AS $$
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', p_user_id,
        'role', 'authenticated',
        'app_metadata', jsonb_build_object('role', 'employer')
      )::text,
      true);
    PERFORM set_config('role', 'authenticated', true);
  END;
  $$;
  ```

- [ ] **Step 4: Wire the fixture into `package.json` `test:db:helpers`**

  Edit `package.json` line 18 — append the `ops_helpers.sql` registration to the existing `jpc_helpers.sql` chain (mirror the exact `docker cp` + `psql` idiom):

  ```json
  "test:db:helpers": "docker cp supabase/fixtures/jpc_helpers.sql supabase_db_uniqn:/tmp/jpc_helpers.sql && docker exec supabase_db_uniqn psql -U postgres -d postgres -f /tmp/jpc_helpers.sql && docker cp supabase/fixtures/ops_helpers.sql supabase_db_uniqn:/tmp/ops_helpers.sql && docker exec supabase_db_uniqn psql -U postgres -d postgres -f /tmp/ops_helpers.sql",
  ```

  (`test:db` is unchanged: `"test:db": "npm run test:db:helpers && supabase test db"`.)

- [ ] **Step 5: Re-run — expect PASS for `ops_tables_rls`**

  ```bash
  npm run test:db
  ```

  Expected: **PASS**. The helpers register cleanly (`CREATE FUNCTION`, `GRANT`) and:
  ```
  ops_tables_rls .. ok
  ...
  Result: PASS
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/fixtures/ops_helpers.sql supabase/tests/ops_tables_rls.test.sql package.json
  git commit -m "feat(ops): pgTAP 픽스처(ops_test_seed/set_user) + ops_* 테이블 RLS 테스트"
  ```

- [ ] **Step 7: Write `ops_rpc_security.test.sql`**

  Create `supabase/tests/ops_rpc_security.test.sql`. Asserts: (1) anon has NO EXECUTE / authenticated HAS EXECUTE on all 7 RPCs; (2) self actor passes the guard; (3) forged actor (`sub<>p_actor_id`, non-admin) → `PERMISSION_DENIED`; (4) `registration_open=false` → `REGISTRATION_CLOSED`. Behavioral calls only set `request.jwt.claims` (role stays `postgres`; RPCs are SECDEF so the actor is read from `auth.uid()`).

  ```sql
  -- uniqn-mobile/supabase/tests/ops_rpc_security.test.sql
  -- OPS 슬라이스 1a — RPC 보안 (§6, §15)
  --   1) 7 RPC: anon EXECUTE 회수 / authenticated 유지 (함수 GRANT 누설 가드)
  --   2) actor 바인딩: self 통과 / 위조(sub<>p_actor_id) PERMISSION_DENIED
  --   3) registration_open=false → REGISTRATION_CLOSED
  -- 메시지 prefix(PERMISSION_DENIED:/REGISTRATION_CLOSED:)는 contract §6 lock.
  -- 안전: BEGIN/ROLLBACK. auth.uid() 는 request.jwt.claims.sub 로 시뮬레이션.
  BEGIN;
  SELECT plan(17);

  DO $$
  DECLARE s RECORD;
  BEGIN
    SELECT * INTO s FROM ops_test_seed();
    PERFORM set_config('ops.owner_id',  s.owner_id::text,      true);
    PERFORM set_config('ops.member_id', s.member_id::text,     true);
    PERFORM set_config('ops.tour_id',   s.tournament_id::text, true);
  END $$;

  -- ── 1) EXECUTE 권한: anon 회수 / authenticated 유지 (7 RPC) ──────────────────
  SELECT ok(NOT has_function_privilege('anon', 'public.ops_create_tournament(uuid, text, text, date, text, uuid, integer, integer, jsonb)', 'EXECUTE'),
    'anon cannot EXECUTE ops_create_tournament');
  SELECT ok(has_function_privilege('authenticated', 'public.ops_create_tournament(uuid, text, text, date, text, uuid, integer, integer, jsonb)', 'EXECUTE'),
    'authenticated can EXECUTE ops_create_tournament');

  SELECT ok(NOT has_function_privilege('anon', 'public.ops_update_tournament(uuid, uuid, jsonb)', 'EXECUTE'),
    'anon cannot EXECUTE ops_update_tournament');
  SELECT ok(has_function_privilege('authenticated', 'public.ops_update_tournament(uuid, uuid, jsonb)', 'EXECUTE'),
    'authenticated can EXECUTE ops_update_tournament');

  SELECT ok(NOT has_function_privilege('anon', 'public.ops_set_tournament_status(uuid, uuid, ops_tournament_status)', 'EXECUTE'),
    'anon cannot EXECUTE ops_set_tournament_status');
  SELECT ok(has_function_privilege('authenticated', 'public.ops_set_tournament_status(uuid, uuid, ops_tournament_status)', 'EXECUTE'),
    'authenticated can EXECUTE ops_set_tournament_status');

  SELECT ok(NOT has_function_privilege('anon', 'public.ops_register_participant(uuid, uuid, text, text, text, integer)', 'EXECUTE'),
    'anon cannot EXECUTE ops_register_participant');
  SELECT ok(has_function_privilege('authenticated', 'public.ops_register_participant(uuid, uuid, text, text, text, integer)', 'EXECUTE'),
    'authenticated can EXECUTE ops_register_participant');

  SELECT ok(NOT has_function_privilege('anon', 'public.ops_add_rebuy(uuid, uuid)', 'EXECUTE'),
    'anon cannot EXECUTE ops_add_rebuy');
  SELECT ok(has_function_privilege('authenticated', 'public.ops_add_rebuy(uuid, uuid)', 'EXECUTE'),
    'authenticated can EXECUTE ops_add_rebuy');

  SELECT ok(NOT has_function_privilege('anon', 'public.ops_add_addon(uuid, uuid)', 'EXECUTE'),
    'anon cannot EXECUTE ops_add_addon');
  SELECT ok(has_function_privilege('authenticated', 'public.ops_add_addon(uuid, uuid)', 'EXECUTE'),
    'authenticated can EXECUTE ops_add_addon');

  SELECT ok(NOT has_function_privilege('anon', 'public.ops_toggle_registration(uuid, uuid, boolean)', 'EXECUTE'),
    'anon cannot EXECUTE ops_toggle_registration');
  SELECT ok(has_function_privilege('authenticated', 'public.ops_toggle_registration(uuid, uuid, boolean)', 'EXECUTE'),
    'authenticated can EXECUTE ops_toggle_registration');

  -- ── 2) self actor (sub == p_actor_id) → 가드 통과 ───────────────────────────
  SELECT set_config('request.jwt.claims',
    jsonb_build_object('sub', current_setting('ops.owner_id'),
                       'app_metadata', jsonb_build_object('role','employer'))::text, true);
  SELECT lives_ok(
    format($$SELECT public.ops_toggle_registration(%L, %L, true)$$,
           current_setting('ops.tour_id'), current_setting('ops.owner_id')),
    'ops_toggle_registration: self actor passes guard (is_ops_member owner)');

  -- ── 3) forged actor (sub <> p_actor_id, 비admin) → PERMISSION_DENIED ─────────
  SELECT set_config('request.jwt.claims',
    jsonb_build_object('sub', current_setting('ops.member_id'),
                       'app_metadata', jsonb_build_object('role','employer'))::text, true);
  SELECT throws_like(
    format($$SELECT public.ops_toggle_registration(%L, %L, false)$$,
           current_setting('ops.tour_id'), current_setting('ops.owner_id')),
    'PERMISSION_DENIED%',
    'ops_toggle_registration: forged actor (sub<>p_actor_id) → PERMISSION_DENIED');

  -- ── 4) registration_open=false → REGISTRATION_CLOSED ────────────────────────
  SELECT set_config('request.jwt.claims',
    jsonb_build_object('sub', current_setting('ops.owner_id'),
                       'app_metadata', jsonb_build_object('role','employer'))::text, true);
  SELECT public.ops_toggle_registration(
    (current_setting('ops.tour_id'))::uuid, (current_setting('ops.owner_id'))::uuid, false);
  SELECT throws_like(
    format($$SELECT public.ops_register_participant(%L, %L, 'walkin', NULL, NULL, NULL)$$,
           current_setting('ops.tour_id'), current_setting('ops.owner_id')),
    'REGISTRATION_CLOSED%',
    'ops_register_participant: registration_open=false → REGISTRATION_CLOSED');

  SELECT * FROM finish();
  ROLLBACK;
  ```

- [ ] **Step 8: Run + commit `ops_rpc_security`**

  ```bash
  npm run test:db
  ```

  Expected: **PASS** (`ops_rpc_security .. ok`, 17/17 subtests). Then:

  ```bash
  git add supabase/tests/ops_rpc_security.test.sql
  git commit -m "feat(ops): RPC 보안 pgTAP — anon EXECUTE 회수 + actor 바인딩 + 등록마감 가드"
  ```

- [ ] **Step 9: Write `ops_events_append_only.test.sql`**

  Create `supabase/tests/ops_events_append_only.test.sql`. Runs the direct UPDATE/DELETE as the default `postgres` role (superuser bypasses RLS + REVOKE, so the BEFORE UPDATE/DELETE **trigger** is what fires).

  ```sql
  -- uniqn-mobile/supabase/tests/ops_events_append_only.test.sql
  -- OPS 슬라이스 1a — ops_events append-only + realtime publication (§4, §15)
  --   1) RPC 로 이벤트 1건 추가(registration_toggled) 성공
  --   2) 직접 UPDATE/DELETE → append-only 트리거 RAISE (postgres 슈퍼유저라
  --      RLS/REVOKE 우회 → 트리거가 실제 차단 메커니즘임을 검증)
  --   3) realtime publication: ops_events 부재, ops_tournaments/ops_participants 존재
  -- 안전: BEGIN/ROLLBACK.
  BEGIN;
  SELECT plan(7);

  DO $$
  DECLARE s RECORD;
  BEGIN
    SELECT * INTO s FROM ops_test_seed();
    PERFORM set_config('ops.owner_id', s.owner_id::text,      true);
    PERFORM set_config('ops.tour_id',  s.tournament_id::text, true);
  END $$;

  -- ── 1) RPC append (registration_toggled) ────────────────────────────────────
  SELECT set_config('request.jwt.claims',
    jsonb_build_object('sub', current_setting('ops.owner_id'),
                       'app_metadata', jsonb_build_object('role','employer'))::text, true);
  SELECT lives_ok(
    format($$SELECT public.ops_toggle_registration(%L, %L, false)$$,
           current_setting('ops.tour_id'), current_setting('ops.owner_id')),
    'ops_events: RPC append (registration_toggled) succeeds');
  SELECT is(
    (SELECT count(*)::int FROM public.ops_events
      WHERE tournament_id = (current_setting('ops.tour_id'))::uuid AND type = 'registration_toggled'),
    1, 'ops_events: registration_toggled row appended via RPC');

  -- ── 2) 직접 UPDATE / DELETE → 트리거 RAISE ──────────────────────────────────
  SELECT throws_like(
    format($$UPDATE public.ops_events SET payload = '{}'::jsonb WHERE tournament_id = %L$$,
           current_setting('ops.tour_id')),
    '%APPEND_ONLY%',
    'ops_events: direct UPDATE blocked by append-only trigger');
  SELECT throws_like(
    format($$DELETE FROM public.ops_events WHERE tournament_id = %L$$,
           current_setting('ops.tour_id')),
    '%APPEND_ONLY%',
    'ops_events: direct DELETE blocked by append-only trigger');

  -- ── 3) realtime publication 멤버십 ──────────────────────────────────────────
  SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ops_events'),
    'ops_events NOT in supabase_realtime publication');
  SELECT ok(
    EXISTS (SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ops_tournaments'),
    'ops_tournaments IS in supabase_realtime publication');
  SELECT ok(
    EXISTS (SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ops_participants'),
    'ops_participants IS in supabase_realtime publication');

  SELECT * FROM finish();
  ROLLBACK;
  ```

- [ ] **Step 10: Run + commit `ops_events_append_only`**

  ```bash
  npm run test:db
  ```

  Expected: **PASS** (`ops_events_append_only .. ok`, 7/7 subtests). Then:

  ```bash
  git add supabase/tests/ops_events_append_only.test.sql
  git commit -m "feat(ops): ops_events append-only 트리거 + realtime publication pgTAP"
  ```

- [ ] **Step 11: Write `ops_entry_number_allocation.test.sql` (D4)**

  Create `supabase/tests/ops_entry_number_allocation.test.sql`. Uses a FRESH tournament created via `ops_create_tournament` (so `next_entry_seq=0`, no seed participant collision). The duplicate INSERT runs as the default `postgres` role (superuser bypasses RLS/REVOKE) so it reaches the `UNIQUE(tournament_id, entry_number)` constraint → 23505.

  ```sql
  -- uniqn-mobile/supabase/tests/ops_entry_number_allocation.test.sql
  -- OPS 슬라이스 1a — entry_number 할당 (§D4, §15)
  --   1) 순차 ops_register_participant → entry_number 1, 2 (gap-free monotonic)
  --   2) 동일 (tournament_id, entry_number) 중복 직접 INSERT → 23505 unique_violation
  -- ⚠️ D4: 단일 pgTAP 트랜잭션은 동시 세션을 만들 수 없다. 진짜 동시성 직렬화
  --        (ops_register_participant 의 SELECT ... FOR UPDATE) 검증은 코드 리뷰
  --        책임이며 pgTAP 범위 밖. 여기서는 순차 단조성 + UNIQUE 제약만 단언한다.
  -- 안전: BEGIN/ROLLBACK. RPC actor=owner (request.jwt.claims.sub).
  --       중복 INSERT 는 role 전환 없이 postgres(슈퍼유저)로 실행 → RLS/REVOKE
  --       우회하여 UNIQUE 제약에 도달(authenticated 면 42501 로 먼저 막힘).
  BEGIN;
  SELECT plan(3);

  DO $$
  DECLARE s RECORD;
  BEGIN
    SELECT * INTO s FROM ops_test_seed();
    PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  END $$;

  -- actor = owner (ops_create_tournament 가드는 p_owner_id 기준)
  SELECT set_config('request.jwt.claims',
    jsonb_build_object('sub', current_setting('ops.owner_id'),
                       'app_metadata', jsonb_build_object('role','employer'))::text, true);

  -- 빈 대회 신규 생성 (seed 대회와 분리 → next_entry_seq=0 보장)
  SELECT set_config('ops.tour2_id',
    (public.ops_create_tournament(
       (current_setting('ops.owner_id'))::uuid, 'alloc test', NULL, NULL, 'NLH', NULL, 30000, 9, '{}'::jsonb
     ) ->> 'tournament_id'), true);

  -- 순차 등록 → entry 1, 2
  SELECT is(
    (public.ops_register_participant((current_setting('ops.tour2_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 'p1', NULL, NULL, NULL) ->> 'entry_number')::int,
    1, 'ops_register_participant: first entry_number = 1');
  SELECT is(
    (public.ops_register_participant((current_setting('ops.tour2_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 'p2', NULL, NULL, NULL) ->> 'entry_number')::int,
    2, 'ops_register_participant: second entry_number = 2 (monotonic, gap-free)');

  -- 동일 (tournament_id, entry_number) 중복 직접 INSERT → 23505
  SELECT throws_ok(
    format($$INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
             VALUES (%L, 1, 'dup', 'active', 0)$$, current_setting('ops.tour2_id')),
    '23505', NULL,
    'ops_participants: duplicate (tournament_id, entry_number) → 23505 unique_violation');

  SELECT * FROM finish();
  ROLLBACK;
  ```

- [ ] **Step 12: Run + commit `ops_entry_number_allocation`**

  ```bash
  npm run test:db
  ```

  Expected: **PASS** (`ops_entry_number_allocation .. ok`, 3/3 subtests). Then:

  ```bash
  git add supabase/tests/ops_entry_number_allocation.test.sql
  git commit -m "feat(ops): entry_number 단조 할당 + UNIQUE 23505 pgTAP (D4 동시성 코드리뷰 책임 명시)"
  ```

- [ ] **Step 13: Final full-suite verification**

  Run the entire db-test suite (jpc + ops) to confirm no regression and all 4 ops files pass:

  ```bash
  npm run db:reset && npm run test:db
  ```

  Expected: **PASS** — all files `ok`, including:
  ```
  ops_tables_rls ................. ok
  ops_rpc_security ............... ok
  ops_events_append_only ......... ok
  ops_entry_number_allocation .... ok
  ...
  Result: PASS
  ```

  (`npm run quality` is NOT applicable here — T10 changes only `.sql` + `package.json`, no TypeScript.)

---

#### Notes / gotchas for the implementer

- **Why the fixture grants tables but not functions:** `GRANT ALL ON ALL TABLES` re-grants table-level DML to `authenticated` in the test DB, but ops tables have NO INSERT/UPDATE/DELETE policy + FORCE RLS, so direct writes by `authenticated` are still denied by RLS — D3 is preserved. Granting function EXECUTE, by contrast, would silently undo the `REVOKE EXECUTE … FROM anon` that `ops_rpc_security` asserts, turning those subtests into false greens. Tables/sequences ONLY (mirrors `jpc_helpers.sql` lines 44-49).
- **Role discipline per test file:**
  - `ops_tables_rls` — switches role via `ops_test_set_user` (authenticated) and inline anon; `RESET ROLE` before `finish()`.
  - `ops_rpc_security`, `ops_events_append_only`, `ops_entry_number_allocation` — never switch `role`; they only set `request.jwt.claims` so SECDEF RPCs read `auth.uid()`, while raw `UPDATE`/`DELETE`/`INSERT` run as the default `postgres` superuser (bypasses RLS + REVOKE) so the **trigger** / **UNIQUE constraint** is the mechanism under test.
- **Message matching:** behavioral exceptions use `throws_like('PERMISSION_DENIED%' | 'REGISTRATION_CLOSED%' | '%APPEND_ONLY%')` (prefix patterns are locked in contract §6/§4), and `throws_ok(…, '23505', NULL, …)` matches SQLSTATE for the unique violation. This avoids coupling to the exact Korean suffix text that T1/T2 author.
- **Seed/next_entry_seq invariant:** `ops_test_seed` sets `next_entry_seq=1` to match its one seeded participant (`entry_number=1`). The allocation test deliberately creates a SEPARATE fresh tournament to get a clean `next_entry_seq=0 → 1, 2` sequence — do not register against the seed tournament in that test or you will hit a spurious 23505.
- **D4 limitation is documented in the test header** (`ops_entry_number_allocation.test.sql`): true concurrent-session serialization (`FOR UPDATE` in `ops_register_participant`) is out of pgTAP scope and is a code-review gate.
- **Dependency gate:** T10 requires T1 + T2 already applied locally (`npm run db:reset`). If `has_function_privilege` errors with "function … does not exist", T2's RPC migration or `src/types` regeneration step has not run — fix T2 before T10.
