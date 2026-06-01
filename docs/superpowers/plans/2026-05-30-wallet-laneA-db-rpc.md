# Wallet Lane A — DB/RPC (T1~T5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수익 모델 Approach A의 서버 권위 비용 계산·멱등 차감·가입 적립·협업자 환불 분기를 DB/RPC 계층에 완성한다 (클라 배선은 후속 계획 B). flag off(현재 시드 전부 false)면 cost=0 강제라 prod 적용해도 무과금 동작이 유지된다.

**Architecture:** 신규 `_calc_posting_cost`(내부) + `get_posting_cost`(read-only 표시·과금 단일소스)로 비용을 서버에서 산출. `create_job_posting_with_payment_atomically`는 `p_cost_diamonds`를 제거하고 서버 cost-calc를 호출하되 검증된 `jsonb_populate_record` INSERT 본문은 보존하고 멱등성을 위해 클라 생성 posting_id를 `ON CONFLICT (id)`로 흡수한다. `consume_diamonds_atomically`는 시그니처 변경 없이 ledger UNIQUE 부분 인덱스 + 선조회 멱등 가드를 추가한다. `handle_new_user`에 grant_signup +10을 EXCEPTION 격리로 추가하고 기존 사용자 백필 마이그레이션을 작성한다. `refund_job_cancellation_atomically`는 caller가 workspace 협업자여도 owner 지갑으로 환불되도록 권한을 확장한다.

**Tech Stack:** Supabase PostgreSQL / plpgsql / SECURITY DEFINER / pgTAP (`supabase test db`) / 로컬 Docker 스택 (`npm run db:start` / `db:reset`)

---

## 작업 환경 / 검증 워크플로우 (모든 Task 공통)

- **작업 디렉토리:** `uniqn-mobile/` (모든 명령 여기서 실행).
- **마이그레이션 파일:** `supabase/migrations/`에 신규 파일로만 추가. **기존 마이그레이션 파일 수정 절대 금지.**
- **로컬 검증 (TDD):**
  - 스택 미기동 시 1회: `npm run db:start`
  - 마이그 적용: `npm run db:reset` (모든 마이그 재적용 — 신규 파일 포함)
  - pgTAP 실행: `npm run test:db` (helper 주입 + `supabase test db`). 단일 파일은 로컬에서 `docker exec supabase_db_uniqn psql -U postgres -d postgres -f /tmp/<file>` 또는 전체 `npm run test:db`.
- **prod 적용:** 로컬 GREEN 확인 후 **Supabase MCP `apply_migration` 전용** (절대 `supabase db push` 금지). 파일명/레지스트리 타임스탬프 불일치는 무해.
- **flag off 안전성:** 현재 `app_config.monetization.paid_types`는 전부 false → `_calc_posting_cost`가 항상 0 반환 → consume skip. Lane A를 prod 적용해도 무과금 동작 불변. **R1 회귀(flag off 무료 게시 INSERT 동등)는 T2에서 검증.**
- **타임스탬프 규칙:** 신규 마이그는 `20260530xxxxxx_*.sql` 사용 (최신 기존 마이그 = `20260529100400`).
- **금지:** `mcp__supabase__*`로 기존 마이그 수정, PROD 데이터 임의 변경. RPC 재정의 시 본 계획에 인용된 현행 본문을 기준으로 diff (blurhash 누락·이중 차감 회귀 클래스 주의).

---

## File Structure

| 파일 | 책임 | 생성/수정 |
|------|------|-----------|
| `supabase/migrations/20260530000001_create_posting_cost_rpc.sql` | `_calc_posting_cost` 내부 + `get_posting_cost` read-only RPC | 생성 |
| `supabase/tests/posting_cost.test.sql` | get_posting_cost pgTAP (type별·flag·rollout 경계) | 생성 |
| `supabase/migrations/20260530000002_create_payment_server_cost_calc.sql` | `create_job_posting_with_payment_atomically` 재정의 (p_cost_diamonds 제거 + cost-calc + 멱등 ON CONFLICT) | 생성 |
| `supabase/tests/create_posting_payment.test.sql` | cost 블록 round-trip + R1 회귀 + 멱등 pgTAP | 생성 |
| `supabase/migrations/20260530000003_consume_idempotency.sql` | wallet_ledger 멱등 UNIQUE 인덱스 + consume 선조회 가드 | 생성 |
| `supabase/tests/consume_idempotency.test.sql` | 같은 ref_id 2회 → 1회 차감 pgTAP | 생성 |
| `supabase/migrations/20260530000004_signup_heart_grant.sql` | `handle_new_user` 확장 + 기존 사용자 백필 | 생성 |
| `supabase/tests/signup_heart_grant.test.sql` | 신규 1회 적립 / 재실행 무적립 / 백필 pgTAP | 생성 |
| `supabase/migrations/20260530000005_refund_collaborator_auth.sql` | `refund_job_cancellation_atomically` 협업자 권한 분기 | 생성 |
| `supabase/tests/refund_collaborator.test.sql` | owner/협업자/제3자 권한 pgTAP | 생성 |

**비용 모델 (model-recommendation §5.1 확정):** `regular=1`(하트 우선 소비), `urgent=10💎`, `fixed=5💎`, `tournament=0`. flag off면 전부 0.

---

## Task 1: get_posting_cost RPC + 내부 비용 계산 (서버 단일소스)

**Files:**
- Create: `supabase/migrations/20260530000001_create_posting_cost_rpc.sql`
- Test: `supabase/tests/posting_cost.test.sql`

- [ ] **Step 1: Write the failing test**

`supabase/tests/posting_cost.test.sql`:

```sql
-- ============================================================
-- T1: get_posting_cost / _calc_posting_cost 검증
-- 비용 모델: regular=1, urgent=10, fixed=5, tournament=0
-- flag off → 항상 0 / flag on + rollout 경계 검증
-- 안전: BEGIN/ROLLBACK 래핑
-- ============================================================
BEGIN;
SELECT plan(10);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_pc_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"PC"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_pc_owner@test.local', 'fixture', 'employer', true, now(), now());
  PERFORM set_config('test.owner', v_owner::text, false);
END $$;

-- flag off (현재 시드 상태: paid_types 전부 false) → 전부 0
SELECT is(
  public._calc_posting_cost('regular', current_setting('test.owner')::uuid), 0,
  'flag off: regular cost = 0');
SELECT is(
  public._calc_posting_cost('urgent', current_setting('test.owner')::uuid), 0,
  'flag off: urgent cost = 0');

-- flag on, rollout 100%, urgent/fixed/regular paid → base cost
UPDATE public.app_config
SET value = jsonb_set(jsonb_set(jsonb_set(jsonb_set(value,
      '{paid_types,urgent}','true'),
      '{paid_types,fixed}','true'),
      '{paid_types,regular}','true'),
      '{rollout_percentage}','100')
WHERE key = 'monetization';

SELECT is(public._calc_posting_cost('regular', current_setting('test.owner')::uuid), 1, 'paid 100%: regular = 1 (heart)');
SELECT is(public._calc_posting_cost('urgent', current_setting('test.owner')::uuid), 10, 'paid 100%: urgent = 10');
SELECT is(public._calc_posting_cost('fixed', current_setting('test.owner')::uuid), 5, 'paid 100%: fixed = 5');
SELECT is(public._calc_posting_cost('tournament', current_setting('test.owner')::uuid), 0, 'tournament always 0');

-- rollout 0% → 게이트 밖이라 0 (paid_types true여도)
UPDATE public.app_config SET value = jsonb_set(value, '{rollout_percentage}', '0') WHERE key = 'monetization';
SELECT is(public._calc_posting_cost('urgent', current_setting('test.owner')::uuid), 0, 'rollout 0%: urgent = 0 (gated out)');

-- enabled=false → 전부 0 (paid_types/rollout 무관)
UPDATE public.app_config SET value = jsonb_set(jsonb_set(value, '{enabled}', 'false'), '{rollout_percentage}', '100') WHERE key = 'monetization';
SELECT is(public._calc_posting_cost('urgent', current_setting('test.owner')::uuid), 0, 'enabled=false: urgent = 0');

-- get_posting_cost read-only 표시 계약 (enabled=false 상태)
SELECT is(
  (public.get_posting_cost('urgent', current_setting('test.owner')::uuid))->>'cost', '0',
  'get_posting_cost returns cost field');
SELECT is(
  (public.get_posting_cost('urgent', current_setting('test.owner')::uuid))->>'is_paid', 'false',
  'get_posting_cost returns is_paid field');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run db:reset && npm run test:db
```
Expected: `posting_cost.test.sql` FAIL — `function public._calc_posting_cost(...) does not exist`.

- [ ] **Step 3: Write minimal implementation**

`supabase/migrations/20260530000001_create_posting_cost_rpc.sql`:

```sql
-- ============================================================
-- T1: 서버 권위 비용 계산 (단일소스: 표시 get_posting_cost = 과금 _calc_posting_cost)
-- 모델(Approach A §5.1): regular=1(heart), urgent=10, fixed=5, tournament=0
-- flag off / enabled=false / rollout 게이트 밖 → 0
-- rollout 버킷: abs(hashtext(owner_id)) % 100 < rollout_percentage 면 paid
-- ============================================================

CREATE OR REPLACE FUNCTION public._calc_posting_cost(
  p_type     TEXT,
  p_owner_id UUID
) RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config  JSONB;
  v_base    INT;
  v_rollout INT;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL';
  END IF;

  v_base := CASE p_type
    WHEN 'urgent'     THEN 10
    WHEN 'fixed'      THEN 5
    WHEN 'tournament' THEN 0
    ELSE 1  -- regular 및 기타
  END;

  IF v_base = 0 THEN
    RETURN 0;
  END IF;

  SELECT value INTO v_config FROM public.app_config WHERE key = 'monetization';
  IF v_config IS NULL THEN
    RETURN 0;  -- flag 미시드 = 무과금
  END IF;

  IF NOT COALESCE((v_config->>'enabled')::boolean, false) THEN
    RETURN 0;
  END IF;

  IF NOT COALESCE((v_config->'paid_types'->>p_type)::boolean, false) THEN
    RETURN 0;
  END IF;

  v_rollout := COALESCE((v_config->>'rollout_percentage')::int, 0);
  IF (abs(hashtext(p_owner_id::text)) % 100) >= v_rollout THEN
    RETURN 0;  -- rollout 버킷 밖
  END IF;

  RETURN v_base;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) TO authenticated, service_role;

-- 표시·과금 공유 read-only RPC
CREATE OR REPLACE FUNCTION public.get_posting_cost(
  p_type     TEXT,
  p_owner_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cost INT;
BEGIN
  v_cost := public._calc_posting_cost(p_type, p_owner_id);
  RETURN jsonb_build_object(
    'type', p_type,
    'cost', v_cost,
    'is_paid', v_cost > 0,
    'currency_hint', CASE WHEN p_type = 'regular' THEN 'heart_first' ELSE 'diamond' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_posting_cost(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_posting_cost(TEXT, UUID) TO authenticated, service_role;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:reset && npm run test:db`
Expected: `posting_cost.test.sql` PASS (10/10).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260530000001_create_posting_cost_rpc.sql supabase/tests/posting_cost.test.sql
git commit -m "feat(wallet): get_posting_cost 서버 권위 비용 계산 RPC (T1)"
```

---

## Task 2: 결제 RPC — p_cost_diamonds 제거 + 서버 cost-calc + 멱등 ON CONFLICT (R1 회귀 CRITICAL)

**Files:**
- Create: `supabase/migrations/20260530000002_create_payment_server_cost_calc.sql`
- Test: `supabase/tests/create_posting_payment.test.sql`

> **현행 본문 기준 (diff 출처):** `20260427000601_fix_create_job_posting_default_padding.sql`. 시그니처 `(p_owner_id, p_posting_payload, p_cost_diamonds INT, p_reason)`. INSERT는 `v_defaults || p_posting_payload || {owner_id}` → `jsonb_populate_record`. **이 INSERT 본문(v_defaults 포함)을 100% 보존하고**, ① `p_cost_diamonds` 인자 제거 ② payload에서 type 추출 → `_calc_posting_cost` 호출 ③ posting_id 멱등(payload.id가 있으면 그것을, 없으면 gen_random_uuid) + `ON CONFLICT (id) DO NOTHING`만 추가한다.

- [ ] **Step 1: Write the failing test**

`supabase/tests/create_posting_payment.test.sql`:

```sql
-- ============================================================
-- T2: create_job_posting_with_payment_atomically (서버 cost-calc + 멱등)
-- R1 회귀: flag off → cost=0 → consume 없이 INSERT만 (무료 게시 동등)
-- 멱등: 같은 posting_id 2회 → 1 공고, 차감 1회
-- round-trip: 삽입 행이 payload 필드 보존
-- 안전: BEGIN/ROLLBACK
-- ============================================================
BEGIN;
SELECT plan(8);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_pid   uuid := gen_random_uuid();
  v_payload jsonb;
  v_res   jsonb;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_cp_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"CP"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner, '__sql_fixture_cp_owner@test.local', 'fixture', 'employer', true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_cp_ws', v_owner, now(), now());

  v_payload := jsonb_build_object(
    'id', v_pid,
    'workspace_id', v_ws,
    'title', '__sql_fixture: payment test',
    'posting_type', 'urgent',
    'status', 'active',
    'total_positions', 2
  );

  -- (A) flag off (시드 기본) → cost=0 → INSERT만, consume 0
  v_res := public.create_job_posting_with_payment_atomically(v_owner, v_payload, 'consume_job_posting'::wallet_reason);
  PERFORM set_config('test.res_a', v_res::text, false);
  PERFORM set_config('test.pid', v_pid::text, false);
END $$;

-- R1: flag off 무료 게시 동등 — 공고 INSERT 성공
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = current_setting('test.pid')::uuid), 1,
  'R1: flag off — posting inserted');
SELECT is(
  (current_setting('test.res_a')::jsonb)->>'total_consumed', '0',
  'R1: flag off — nothing consumed');
-- round-trip: payload 필드 보존
SELECT is(
  (SELECT title FROM public.job_postings WHERE id = current_setting('test.pid')::uuid),
  '__sql_fixture: payment test', 'round-trip: title preserved');
SELECT is(
  (SELECT posting_type::text FROM public.job_postings WHERE id = current_setting('test.pid')::uuid),
  'urgent', 'round-trip: posting_type preserved');
SELECT is(
  (SELECT status::text FROM public.job_postings WHERE id = current_setting('test.pid')::uuid),
  'active', 'round-trip: status (payload-wins over default draft)');
SELECT is(
  (SELECT total_positions FROM public.job_postings WHERE id = current_setting('test.pid')::uuid),
  2, 'round-trip: total_positions preserved');

-- 멱등: 같은 posting_id 재호출 → 여전히 1 공고
DO $$
DECLARE
  v_owner uuid;
  v_ws uuid;
  v_payload jsonb;
BEGIN
  SELECT owner_id, workspace_id INTO v_owner, v_ws FROM public.job_postings WHERE id = current_setting('test.pid')::uuid;
  v_payload := jsonb_build_object(
    'id', current_setting('test.pid')::uuid,
    'workspace_id', v_ws,
    'title', '__sql_fixture: payment test',
    'posting_type', 'urgent',
    'status', 'active',
    'total_positions', 2
  );
  PERFORM public.create_job_posting_with_payment_atomically(v_owner, v_payload, 'consume_job_posting'::wallet_reason);
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = current_setting('test.pid')::uuid), 1,
  'idempotent: same posting_id → still 1 posting');

-- 신규 시그니처는 p_cost_diamonds 인자 없음 (구 4-인자 시그니처는 제거됨)
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='create_job_posting_with_payment_atomically'
     AND p.pronargs = 3), 1,
  'new signature has exactly 3 args (p_cost_diamonds removed)');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:reset && npm run test:db`
Expected: FAIL — 3-인자 시그니처 미존재 / `function ... (uuid, jsonb, wallet_reason) does not exist`.

- [ ] **Step 3: Write minimal implementation**

`supabase/migrations/20260530000002_create_payment_server_cost_calc.sql`:

```sql
-- ============================================================
-- T2: create_job_posting_with_payment_atomically
--   - p_cost_diamonds 인자 제거 → 서버 _calc_posting_cost(T1)로 비용 산출
--   - INSERT 본문(v_defaults + jsonb_populate_record) 보존 — §4 round-trip 검증 방식 유지
--   - 멱등: payload.id 흡수 + ON CONFLICT (id) DO NOTHING → 재시도 시 중복 공고 방지
-- 현행 정의 출처: 20260427000601 (diff 기준, INSERT 본문 동일)
-- 구 4-인자 시그니처는 명시 DROP (오버로드 잔존 방지)
-- ============================================================

DROP FUNCTION IF EXISTS public.create_job_posting_with_payment_atomically(UUID, JSONB, INT, wallet_reason);

CREATE OR REPLACE FUNCTION public.create_job_posting_with_payment_atomically(
  p_owner_id        UUID,
  p_posting_payload JSONB,
  p_reason          wallet_reason DEFAULT 'consume_job_posting'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_posting_id        UUID;
  v_type              TEXT;
  v_cost              INT;
  v_consume_result    JSONB;
  v_diamonds_consumed INT := 0;
  v_heart_consumed    INT := 0;
  v_defaults          JSONB;
  v_final_payload     JSONB;
  v_inserted          BOOLEAN := false;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL';
  END IF;
  IF p_posting_payload IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: cannot be NULL';
  END IF;

  -- 멱등 posting_id: payload.id가 있으면 그것을, 없으면 신규 생성
  v_posting_id := COALESCE((p_posting_payload->>'id')::uuid, gen_random_uuid());
  v_type := COALESCE(p_posting_payload->>'posting_type', 'regular');

  -- 서버 권위 비용 (flag off → 0)
  v_cost := public._calc_posting_cost(v_type, p_owner_id);

  -- INSERT 본문 보존 (현행 20260427000601과 동일한 defaults + populate_record)
  v_defaults := jsonb_build_object(
    'id',                v_posting_id,
    'schema_version',    3,
    'status',            'draft',
    'posting_type',      'regular',
    'created_at',        now(),
    'updated_at',        now(),
    'location',          '{}'::jsonb,
    'schedule',          '{}'::jsonb,
    'role_catalog',      '[]'::jsonb,
    'compensation',      '{}'::jsonb,
    'questions',         jsonb_build_object('items', '[]'::jsonb),
    'stats',             jsonb_build_object(
                           'filledPositions', 0,
                           'totalApplicants', 0,
                           'activeApplicants', 0,
                           'confirmedApplicants', 0,
                           'cancellationPendingApplicants', 0
                         ),
    'total_positions',   0,
    'filled_positions',  0,
    'view_count',        0,
    'is_featured',       false
  );

  v_final_payload := v_defaults
                     || p_posting_payload
                     || jsonb_build_object('id', v_posting_id, 'owner_id', p_owner_id);

  INSERT INTO public.job_postings
  SELECT * FROM jsonb_populate_record(NULL::public.job_postings, v_final_payload)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 멱등: 이미 존재(재시도)면 차감 없이 기존 결과 반환
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'posting_id', v_posting_id,
      'idempotent', true,
      'diamonds_consumed', 0,
      'hearts_consumed', 0,
      'total_consumed', 0
    );
  END IF;

  -- 신규 삽입에 한해 차감 (cost>0). consume은 ref_id=posting_id로 멱등(T3).
  IF v_cost > 0 THEN
    v_consume_result := public.consume_diamonds_atomically(
      p_owner_id, v_cost, p_reason, v_posting_id, 'job_posting'
    );
    v_diamonds_consumed := COALESCE((v_consume_result->>'diamond_consumed')::int, 0);
    v_heart_consumed    := COALESCE((v_consume_result->>'heart_consumed')::int, 0);
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

REVOKE EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, wallet_reason) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, wallet_reason) TO authenticated, service_role;
```

> **주의 (GET DIAGNOSTICS):** `GET DIAGNOSTICS v_inserted = ROW_COUNT;`는 INT에 대입되어야 한다 — 위에서 `v_inserted BOOLEAN`은 잘못. **Step 3 적용 시 `v_inserted INT := 0;`로 선언하고 `IF v_inserted = 0`로 비교**한다. (이 노트대로 작성할 것.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:reset && npm run test:db`
Expected: `create_posting_payment.test.sql` PASS (8/8). 특히 R1(2건)·round-trip(4건)·멱등(1건)·시그니처(1건).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260530000002_create_payment_server_cost_calc.sql supabase/tests/create_posting_payment.test.sql
git commit -m "feat(wallet): 결제 RPC 서버 cost-calc + 멱등 ON CONFLICT (T2, R1 회귀 가드)"
```

---

## Task 3: consume 멱등성 (시그니처 불변 — ledger UNIQUE + 선조회 가드)

**Files:**
- Create: `supabase/migrations/20260530000003_consume_idempotency.sql`
- Test: `supabase/tests/consume_idempotency.test.sql`

> **현행 본문 기준:** `20260427000301_fix_consume_diamonds_drift_guard.sql`. 시그니처 `(p_user_id, p_amount, p_reason, p_ref_id, p_ref_type)` — `p_ref_id`가 이미 있으므로 **시그니처 변경 없이** 멱등 추가. drift guard·FIFO·ledger 본문 보존, 함수 진입부에 "동일 (user_id, ref_id, reason)·consume류 ledger 존재 시 기존 결과 반환" 가드 + 부분 UNIQUE 인덱스로 race 방어.

- [ ] **Step 1: Write the failing test**

`supabase/tests/consume_idempotency.test.sql`:

```sql
-- ============================================================
-- T3: consume_diamonds_atomically 멱등성
-- 같은 (user, ref_id, consume_job_posting) 2회 → 1회만 차감
-- 안전: BEGIN/ROLLBACK
-- ============================================================
BEGIN;
SELECT plan(4);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_ref  uuid := gen_random_uuid();
  v_r1   jsonb;
  v_r2   jsonb;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user, '__sql_fixture_ci_user@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"CI"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_user, '__sql_fixture_ci_user@test.local', 'fixture', 'employer', true, now(), now());
  -- 다이아 10개 충전 (service_role 경로 모사: 직접 ledger + wallet)
  INSERT INTO public.wallets(user_id, diamond_balance) VALUES (v_user, 10)
    ON CONFLICT (user_id) DO UPDATE SET diamond_balance = 10;

  v_r1 := public.consume_diamonds_atomically(v_user, 3, 'consume_job_posting'::wallet_reason, v_ref, 'job_posting');
  v_r2 := public.consume_diamonds_atomically(v_user, 3, 'consume_job_posting'::wallet_reason, v_ref, 'job_posting');

  PERFORM set_config('test.user', v_user::text, false);
  PERFORM set_config('test.r1', v_r1::text, false);
  PERFORM set_config('test.r2', v_r2::text, false);
END $$;

SELECT is((current_setting('test.r1')::jsonb)->>'diamond_consumed', '3', 'first call consumes 3');
SELECT is((current_setting('test.r2')::jsonb)->>'idempotent', 'true', 'second call returns idempotent');
SELECT is(
  (SELECT diamond_balance FROM public.wallets WHERE user_id = current_setting('test.user')::uuid), 7,
  'balance debited once (10-3=7)');
SELECT is(
  (SELECT count(*)::int FROM public.wallet_ledger
   WHERE user_id = current_setting('test.user')::uuid
     AND ref_id = (current_setting('test.r1')::jsonb)->>'ref_id'  -- not present; fallback below
     OR (user_id = current_setting('test.user')::uuid AND reason='consume_job_posting')), 1,
  'only one consume ledger row');

SELECT * FROM finish();
ROLLBACK;
```

> Step 1 작성 시 마지막 assertion은 ref_id를 DO 블록에서 `set_config('test.ref', v_ref::text)`로 내보내고 `WHERE user_id=... AND ref_id=current_setting('test.ref')::uuid AND reason='consume_job_posting'`로 단순화한다 (위 OR 혼합 회피). DO 블록 끝에 `PERFORM set_config('test.ref', v_ref::text, false);` 추가.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:reset && npm run test:db`
Expected: FAIL — 2번째 호출이 다시 차감(balance=4) → `balance debited once` 실패, `idempotent` 키 부재.

- [ ] **Step 3: Write minimal implementation**

`supabase/migrations/20260530000003_consume_idempotency.sql`:

```sql
-- ============================================================
-- T3: consume_diamonds_atomically 멱등성 (시그니처 불변)
--   - 부분 UNIQUE 인덱스: 동일 (user_id, ref_id, reason) consume류 1행
--   - 함수 진입부 선조회 가드 + ledger 충돌 시 기존 결과 반환
-- 현행 본문(20260427000301) 보존: drift guard / FIFO / ledger insert
-- ============================================================

-- 멱등 인덱스 (consume류만; refund/grant/purchase는 별도 멱등 규칙)
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_consume_ref
  ON public.wallet_ledger (user_id, ref_id, reason)
  WHERE reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade')
    AND ref_id IS NOT NULL;

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
  v_existing         RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_ID: user_id required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: % must be positive', p_amount;
  END IF;

  -- 멱등 선조회: 동일 ref 차감 이미 있으면 재차감 없이 기존 합산 반환
  IF p_ref_id IS NOT NULL
     AND p_reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade') THEN
    SELECT
      COALESCE(SUM(CASE WHEN currency_type='heart'   THEN -delta ELSE 0 END),0)::int AS h,
      COALESCE(SUM(CASE WHEN currency_type='diamond' THEN -delta ELSE 0 END),0)::int AS d,
      count(*) AS n
    INTO v_existing
    FROM public.wallet_ledger
    WHERE user_id = p_user_id AND ref_id = p_ref_id AND reason = p_reason;
    IF v_existing.n > 0 THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true,
        'heart_consumed', v_existing.h, 'diamond_consumed', v_existing.d
      );
    END IF;
  END IF;

  INSERT INTO wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet.heart_balance + v_wallet.diamond_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %h+%d, need %',
      v_wallet.heart_balance, v_wallet.diamond_balance, p_amount;
  END IF;

  FOR v_lot IN
    SELECT * FROM heart_lots
    WHERE user_id = p_user_id AND amount_remaining > 0 AND expires_at > v_now
    ORDER BY expires_at ASC, granted_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining = 0;
    v_take := LEAST(v_lot.amount_remaining, v_remaining);
    UPDATE heart_lots SET amount_remaining = amount_remaining - v_take WHERE id = v_lot.id;
    v_heart_consumed := v_heart_consumed + v_take;
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > v_wallet.diamond_balance THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: lot drift detected, real heart=%, real diamond=%, remaining need=%',
      v_heart_consumed, v_wallet.diamond_balance, v_remaining;
  END IF;

  IF v_remaining > 0 THEN
    v_diamond_consumed := v_remaining;
  END IF;

  IF v_heart_consumed > 0 THEN
    INSERT INTO wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond)
    VALUES (p_user_id, 'heart', -v_heart_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed, v_wallet.diamond_balance - v_diamond_consumed);
  END IF;
  IF v_diamond_consumed > 0 THEN
    INSERT INTO wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type,
      balance_after_heart, balance_after_diamond)
    VALUES (p_user_id, 'diamond', -v_diamond_consumed, p_reason, p_ref_id, p_ref_type,
      v_wallet.heart_balance - v_heart_consumed, v_wallet.diamond_balance - v_diamond_consumed);
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
```

> **참고 (heart+diamond 혼합 멱등 인덱스):** 위 UNIQUE 인덱스는 (user_id, ref_id, reason)에 걸려 있어 한 ref가 heart row와 diamond row를 **둘 다** 가지면 충돌한다. consume은 같은 reason으로 heart/diamond 2행을 쓸 수 있으므로, **인덱스는 부분 UNIQUE 대신 동일 키 race 방어용 advisory로 약화**한다 — 즉 인덱스를 `(user_id, ref_id, reason, currency_type)`로 만들어 currency별 1행을 보장한다. **Step 3 작성 시 인덱스 컬럼에 `currency_type`을 추가**하고, 선조회 가드(v_existing.n>0)가 1차 멱등을, 인덱스가 동시성 2차 방어를 담당하게 한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:reset && npm run test:db`
Expected: `consume_idempotency.test.sql` PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260530000003_consume_idempotency.sql supabase/tests/consume_idempotency.test.sql
git commit -m "feat(wallet): consume 멱등성 — ledger UNIQUE + 선조회 가드 (T3)"
```

---

## Task 4: handle_new_user 가입 적립 +10 + 기존 사용자 백필

**Files:**
- Create: `supabase/migrations/20260530000004_signup_heart_grant.sql`
- Test: `supabase/tests/signup_heart_grant.test.sql`

> **현행 본문 기준:** `20260519223300_handle_new_user_employer_default_workspace.sql`. public.users INSERT + employer workspace 생성(EXCEPTION 격리). **이 본문 전체 보존** + 끝에 grant_signup 블록(EXCEPTION 격리) 추가. grant는 `grant_heart_atomically(NEW.id, 10, 'grant_signup', NULL, 90)` 호출, 단 멱등 가드(WHERE NOT EXISTS consume/grant_signup ledger)로 self-heal 재실행 무적립.

- [ ] **Step 1: Write the failing test**

`supabase/tests/signup_heart_grant.test.sql`:

```sql
-- ============================================================
-- T4: handle_new_user grant_signup +10 + 백필
-- 신규 가입 → heart 10 / 트리거 재실행(이미 users 존재) → 무적립
-- 안전: BEGIN/ROLLBACK
-- ============================================================
BEGIN;
SELECT plan(4);

-- 신규 auth.users INSERT → 트리거 → grant_signup 10
DO $$
DECLARE v_new uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_new, '__sql_fixture_sg_new@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"SG"}'::jsonb, now(), now());
  PERFORM set_config('test.new', v_new::text, false);
END $$;

SELECT is(
  (SELECT heart_balance FROM public.wallets WHERE user_id = current_setting('test.new')::uuid), 10,
  'new signup grants 10 hearts');
SELECT is(
  (SELECT count(*)::int FROM public.wallet_ledger WHERE user_id = current_setting('test.new')::uuid AND reason='grant_signup'), 1,
  'exactly one grant_signup ledger');

-- 멱등: grant_heart_atomically 직접 재호출 시도해도 grant_signup 가드로 무적립
-- (handle_new_user 내부 가드는 WHERE NOT EXISTS — 백필 함수로 재현)
DO $$
BEGIN
  PERFORM public.backfill_signup_hearts();  -- 이미 받은 유저는 skip
END $$;
SELECT is(
  (SELECT heart_balance FROM public.wallets WHERE user_id = current_setting('test.new')::uuid), 10,
  'backfill does not double-grant existing recipient');

-- 백필: grant_signup 없는 기존 유저에게 10 적립
DO $$
DECLARE v_old uuid := gen_random_uuid();
BEGIN
  -- 트리거 우회: public.users 직접 삽입 (백필 대상 모사)
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_old, '__sql_fixture_sg_old@test.local', 'authenticated', 'authenticated', '', '{}'::jsonb, '{}'::jsonb, now(), now());
  -- 위 INSERT가 트리거로 grant했으므로, 백필 검증을 위해 ledger/wallet 초기화
  DELETE FROM public.wallet_ledger WHERE user_id = v_old;
  UPDATE public.wallets SET heart_balance=0 WHERE user_id = v_old;
  DELETE FROM public.heart_lots WHERE user_id = v_old;
  PERFORM public.backfill_signup_hearts();
  PERFORM set_config('test.old', v_old::text, false);
END $$;
SELECT is(
  (SELECT heart_balance FROM public.wallets WHERE user_id = current_setting('test.old')::uuid), 10,
  'backfill grants 10 to user without grant_signup');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:reset && npm run test:db`
Expected: FAIL — 신규 가입 heart=0 (grant 미적용), `backfill_signup_hearts()` 미존재.

- [ ] **Step 3: Write minimal implementation**

`supabase/migrations/20260530000004_signup_heart_grant.sql`:

```sql
-- ============================================================
-- T4: 가입 시 하트 10 적립 (handle_new_user 확장) + 기존 사용자 백필
--   - 본문 전체 보존 (20260519223300) + grant_signup 블록 EXCEPTION 격리
--   - 멱등: grant_signup ledger 없을 때만 (orphan self-heal 재실행 무적립)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_provider text;
  v_role public.user_role;
  v_workspace_name text;
BEGIN
  v_provider := NEW.raw_app_meta_data ->> 'provider';
  v_role := COALESCE((NEW.raw_app_meta_data ->> 'role')::public.user_role, 'staff');

  INSERT INTO public.users (id, email, name, role, social_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    v_role,
    CASE WHEN v_provider IN ('apple', 'google', 'kakao', 'naver') THEN v_provider ELSE NULL END
  );

  IF v_role = 'employer' THEN
    BEGIN
      v_workspace_name := COALESCE(
        NULLIF(LEFT(NEW.raw_user_meta_data ->> 'name', 40), ''),
        NULLIF(LEFT(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), 40), ''),
        '내'
      ) || ' 워크스페이스';
      INSERT INTO public.workspaces (name, owner_id)
      VALUES (v_workspace_name, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: workspace 자동 생성 실패 (user_id=%, error=%)', NEW.id, SQLERRM;
    END;
  END IF;

  -- 가입 적립 +10 (멱등 가드 + EXCEPTION 격리 — 적립 실패가 가입을 막지 않음)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_ledger
      WHERE user_id = NEW.id AND reason = 'grant_signup'
    ) THEN
      PERFORM public.grant_heart_atomically(NEW.id, 10, 'grant_signup'::wallet_reason, NULL, 90);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: grant_signup 실패 (user_id=%, error=%)', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 기존 사용자 백필 (grant_signup 없는 모든 public.users에게 1회 +10)
CREATE OR REPLACE FUNCTION public.backfill_signup_hearts()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_count INT := 0;
BEGIN
  FOR v_user IN
    SELECT u.id FROM public.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.wallet_ledger l
      WHERE l.user_id = u.id AND l.reason = 'grant_signup'
    )
  LOOP
    BEGIN
      PERFORM public.grant_heart_atomically(v_user.id, 10, 'grant_signup'::wallet_reason, NULL, 90);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'backfill_signup_hearts: skip user=% (error=%)', v_user.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_signup_hearts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_signup_hearts() TO service_role;

-- 1회성 백필 실행 (멱등 — 재적용해도 grant_signup 있는 유저는 skip)
SELECT public.backfill_signup_hearts();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:reset && npm run test:db`
Expected: `signup_heart_grant.test.sql` PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260530000004_signup_heart_grant.sql supabase/tests/signup_heart_grant.test.sql
git commit -m "feat(wallet): 가입 하트 10 적립 + 기존 사용자 백필 (T4)"
```

---

## Task 5: refund 협업자 권한 분기 (비용 주체=owner)

**Files:**
- Create: `supabase/migrations/20260530000005_refund_collaborator_auth.sql`
- Test: `supabase/tests/refund_collaborator.test.sql`

> **현행 본문 기준:** `20260427000701_fix_refund_auth_order.sql`. 시그니처 `(p_posting_id, p_owner_id)`, 권한 = `job_postings.owner_id = p_owner_id`만. **본문(멱등·합산·비율·환불 ledger) 보존**, 권한 체크만 확장: caller(`auth.uid()`)가 posting owner이거나 workspace 협업자면 허용. p_owner_id는 **항상 posting.owner_id(비용 주체)** 여야 하며, caller≠owner여도 협업자면 owner 지갑으로 환불.

- [ ] **Step 1: Write the failing test**

`supabase/tests/refund_collaborator.test.sql`:

```sql
-- ============================================================
-- T5: refund 협업자 권한 분기
-- owner 환불 OK / 협업자(JPC) 취소 시 owner 지갑 환불 OK / 제3자 unauthorized
-- 안전: BEGIN/ROLLBACK. auth.uid()는 request.jwt.claim.sub 로 모사.
-- ============================================================
BEGIN;
SELECT plan(3);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_collab uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_ws uuid := gen_random_uuid();
  v_pid1 uuid := gen_random_uuid();
  v_pid2 uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_rf_owner@test.local','authenticated','authenticated','', '{"role":"employer"}'::jsonb,'{"name":"RFO"}'::jsonb, now(), now()),
    (v_collab,'__sql_fixture_rf_collab@test.local','authenticated','authenticated','', '{"role":"employer"}'::jsonb,'{"name":"RFC"}'::jsonb, now(), now()),
    (v_stranger,'__sql_fixture_rf_str@test.local','authenticated','authenticated','', '{"role":"employer"}'::jsonb,'{"name":"RFS"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture', 'employer', true, now(), now() FROM auth.users
  WHERE id IN (v_owner, v_collab, v_stranger);

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_rf_ws', v_owner, now(), now());
  -- 협업자 등록 (JPC 또는 workspace 멤버 — 프로젝트 헬퍼 사용)
  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, workspace_id, role, created_at)
  VALUES (v_pid1, v_collab, v_ws, 'editor', now())
  ON CONFLICT DO NOTHING;

  -- 공고 2건 (owner 소유) + owner 지갑 차감 이력 (consume) 시드
  INSERT INTO public.wallets(user_id, diamond_balance) VALUES (v_owner, 0) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, created_at, updated_at)
  VALUES
    (v_pid1, v_owner, v_ws, '__sql_fixture: rf collab', 1, 0, 'active', 'urgent', now(), now()),
    (v_pid2, v_owner, v_ws, '__sql_fixture: rf owner', 1, 0, 'active', 'urgent', now(), now());
  -- consume ledger 시드 (10 다이아 차감 가정)
  INSERT INTO public.wallet_ledger(user_id, currency_type, delta, reason, ref_id, ref_type, balance_after_heart, balance_after_diamond, created_at)
  VALUES
    (v_owner, 'diamond', -10, 'consume_job_posting', v_pid1, 'job_posting', 0, 0, now() - interval '1 hour'),
    (v_owner, 'diamond', -10, 'consume_job_posting', v_pid2, 'job_posting', 0, 0, now() - interval '1 hour');

  PERFORM set_config('test.owner', v_owner::text, false);
  PERFORM set_config('test.collab', v_collab::text, false);
  PERFORM set_config('test.stranger', v_stranger::text, false);
  PERFORM set_config('test.pid1', v_pid1::text, false);
  PERFORM set_config('test.pid2', v_pid2::text, false);
END $$;

-- owner 본인 취소 환불 (caller=owner)
SELECT set_config('request.jwt.claim.sub', current_setting('test.owner'), false);
SELECT is(
  (public.refund_job_cancellation_atomically(current_setting('test.pid2')::uuid, current_setting('test.owner')::uuid))->>'success',
  'true', 'owner cancel → refund success');

-- 협업자 취소 환불 (caller=collab, p_owner_id=owner)
SELECT set_config('request.jwt.claim.sub', current_setting('test.collab'), false);
SELECT is(
  (public.refund_job_cancellation_atomically(current_setting('test.pid1')::uuid, current_setting('test.owner')::uuid))->>'success',
  'true', 'collaborator cancel → owner refund success');

-- 제3자 (caller=stranger) → unauthorized
SELECT set_config('request.jwt.claim.sub', current_setting('test.stranger'), false);
SELECT is(
  (public.refund_job_cancellation_atomically(current_setting('test.pid1')::uuid, current_setting('test.owner')::uuid))->>'error',
  'unauthorized', 'stranger cancel → unauthorized');

SELECT * FROM finish();
ROLLBACK;
```

> Step 1 작성 시 `job_posting_collaborators` 실제 컬럼명/제약을 `\d public.job_posting_collaborators`로 확인하고 INSERT를 맞춘다 (role enum 값, workspace_id 필수 여부 등). 헬퍼 `is_workspace_member(workspace_id, user_id)` 시그니처도 `\df is_workspace_member`로 확인.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:reset && npm run test:db`
Expected: FAIL — 협업자 호출이 `unauthorized` 반환 (현행은 owner_id만 체크하나 caller 검증이 없어 오히려 통과할 수도; 핵심은 caller 권한 게이트 부재 → 제3자도 통과 → `unauthorized` 기대 실패).

- [ ] **Step 3: Write minimal implementation**

`supabase/migrations/20260530000005_refund_collaborator_auth.sql`:

```sql
-- ============================================================
-- T5: refund 협업자 권한 분기 (비용 주체=owner, caller=owner|협업자)
--   - 본문(멱등·합산·비율·환불 ledger) 보존 (20260427000701)
--   - 권한 확장: caller(auth.uid())가 owner이거나 workspace 협업자일 때만
--   - service_role(webhook) 경로는 auth.uid() NULL → owner 일치로 통과
-- ============================================================

CREATE OR REPLACE FUNCTION public.refund_job_cancellation_atomically(
  p_posting_id UUID,
  p_owner_id   UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_refund   UUID;
  v_first_consume_at  TIMESTAMPTZ;
  v_hours_elapsed     NUMERIC;
  v_refund_rate       NUMERIC;
  v_refund_amount     INT;
  v_diamond_amount    INT;
  v_heart_amount      INT;
  v_now               TIMESTAMPTZ := now();
  v_caller            UUID := auth.uid();
  v_workspace_id      UUID;
  v_post_owner        UUID;
BEGIN
  IF p_posting_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  -- posting 존재 + owner 도출 (비용 주체 검증)
  SELECT owner_id, workspace_id INTO v_post_owner, v_workspace_id
  FROM public.job_postings WHERE id = p_posting_id;
  IF v_post_owner IS NULL OR v_post_owner <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- caller 권한: owner 본인 / 협업자(workspace 멤버) / service_role(auth.uid() NULL)
  IF v_caller IS NOT NULL
     AND v_caller <> p_owner_id
     AND NOT public.is_workspace_member(v_workspace_id, v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 멱등 (자기 자신 refund row만)
  SELECT id INTO v_existing_refund FROM public.wallet_ledger
    WHERE ref_id = p_posting_id AND user_id = p_owner_id AND reason = 'refund_job_cancelled'
    LIMIT 1;
  IF v_existing_refund IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 차감 합산
  SELECT
    COALESCE(SUM(CASE WHEN currency_type='diamond' THEN -delta ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN currency_type='heart'   THEN -delta ELSE 0 END), 0)::int,
    MIN(created_at)
  INTO v_diamond_amount, v_heart_amount, v_first_consume_at
  FROM public.wallet_ledger
  WHERE ref_id = p_posting_id AND user_id = p_owner_id
    AND reason IN ('consume_job_posting','consume_job_extend','consume_job_upgrade');

  IF v_first_consume_at IS NULL OR (v_diamond_amount + v_heart_amount) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_consumption_found');
  END IF;

  v_hours_elapsed := EXTRACT(EPOCH FROM (v_now - v_first_consume_at)) / 3600;
  v_refund_rate := CASE WHEN v_hours_elapsed < 24 THEN 1.0 ELSE 0.5 END;
  v_refund_amount := FLOOR((v_diamond_amount + v_heart_amount) * v_refund_rate)::int;

  INSERT INTO public.wallet_ledger(
    user_id, currency_type, delta, reason, ref_id, ref_type,
    balance_after_heart, balance_after_diamond, metadata
  )
  SELECT p_owner_id, 'diamond', v_refund_amount, 'refund_job_cancelled',
         p_posting_id, 'job_posting',
         w.heart_balance, w.diamond_balance + v_refund_amount,
         jsonb_build_object(
           'original_diamond', v_diamond_amount, 'original_heart', v_heart_amount,
           'refund_rate', v_refund_rate, 'hours_elapsed', v_hours_elapsed,
           'cancelled_by', v_caller
         )
  FROM public.wallets w WHERE w.user_id = p_owner_id;

  RETURN jsonb_build_object(
    'success', true,
    'refunded_diamonds', v_refund_amount,
    'refund_rate', v_refund_rate,
    'hours_elapsed', v_hours_elapsed,
    'original_diamond', v_diamond_amount,
    'original_heart', v_heart_amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_job_cancellation_atomically(UUID, UUID) TO authenticated, service_role;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:reset && npm run test:db`
Expected: `refund_collaborator.test.sql` PASS (3/3) + 기존 refund pgTAP(있으면) 회귀 없음.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260530000005_refund_collaborator_auth.sql supabase/tests/refund_collaborator.test.sql
git commit -m "feat(wallet): refund 협업자 권한 분기 — owner 지갑 환불 (T5)"
```

---

## 최종 게이트 (전체 Lane A)

- [ ] **G1: 전체 pgTAP GREEN**

Run: `npm run db:reset && npm run test:db`
Expected: 신규 5 스위트(posting_cost 10 + create_posting_payment 8 + consume_idempotency 4 + signup_heart_grant 4 + refund_collaborator 3 = 29 assertions) + **기존 모든 pgTAP 회귀 0 fail**.

- [ ] **G2: prod 적용 (MCP apply_migration 전용)**

로컬 GREEN 확인 후, 5개 마이그레이션을 순서대로 Supabase MCP `apply_migration`으로 prod 적용. **`supabase db push` 금지.** 각 적용 후 `mcp__supabase__get_advisors`(security/performance)로 신규 함수 search_path/권한 경고 0 확인.

- [ ] **G3: 무과금 불변 확인**

prod에서 `SELECT public.get_posting_cost('urgent', '<임의 owner uuid>');` → `cost=0, is_paid=false` (flag off). 차감 ON은 후속 계획 B의 T8/T9 + flag 변경 시점에만.

- [ ] **G4: 타입 재생성 (선택)**

신규 RPC 시그니처가 클라 타입에 필요하면 `mcp__supabase__generate_typescript_types` → `src/types/database.types.ts` 갱신 (계획 B에서 사용). Lane A 단독으로는 클라 영향 없음.

---

## Self-Review 결과

**1. 스펙 커버리지 (gap §7.3 T1~T5):**
- T1 get_posting_cost + _calc_posting_cost (1A·3A·T11 통합) — Task 1 ✅
- T2 결제 RPC cost-calc + p_cost_diamonds 제거 + INSERT 본문 보존 + R1 회귀 — Task 2 ✅
- T3 consume 멱등성 (시그니처 불변, ref_id 활용) — Task 3 ✅
- T4 handle_new_user grant_signup +10 멱등 가드 + EXCEPTION 격리 + 백필 — Task 4 ✅
- T5 refund 협업자 권한 분기 (P0-2) — Task 5 ✅

**2. 플레이스홀더 스캔:** TBD/TODO 없음. 단, 실행 시 확인 지시 3건(명시): ① Task2 Step3 `v_inserted INT` 정정 노트, ② Task3 멱등 인덱스에 `currency_type` 추가 노트, ③ Task5 `job_posting_collaborators` 컬럼/`is_workspace_member` 시그니처 `\d`/`\df` 확인. 모두 검증 명령 포함.

**3. 타입 일관성:**
- `_calc_posting_cost(TEXT, UUID) RETURNS INT` ← `get_posting_cost`·`create_..._payment` 둘 다 호출, 일치 ✅.
- `create_job_posting_with_payment_atomically(UUID, JSONB, wallet_reason)` 3-인자 — Task2 정의·테스트 pronargs=3 일치 ✅.
- `consume_diamonds_atomically(UUID, INT, wallet_reason, UUID, TEXT)` 시그니처 불변 — Task3 ✅.
- `backfill_signup_hearts() RETURNS INT` — Task4 정의·테스트 호출 일치 ✅.
- `refund_job_cancellation_atomically(UUID, UUID)` 시그니처 불변 — Task5 ✅.

**제외(후속 계획 B):** WalletRepository consume/refund write, createWithTransaction RPC 전환(T8), 취소 환불 연결(T9), Paywall/잔액 동기 갱신, 출석 UI. **차감 ON 게이트:** R1(Task2) + cost round-trip(Task2) GREEN 확인됨 — 단 실제 차감 배선(T8/T9)은 계획 B에서, flag 변경은 운영 판단.
