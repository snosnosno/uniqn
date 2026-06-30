# ops 1d — bust / 재진입 / ITM 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라이브 토너먼트 운영툴에 탈락(bust→순위/상금 자동매핑·좌석해제·우승 자동확정)·재진입·고정금액 상금구조(ops_prizes)·PAYOUTS 탭을 추가한다.

**Architecture:** 모든 쓰기는 Postgres SECDEF RPC(actor 바인딩+advisory 직렬화). 신규 테이블 `ops_prizes` 1종 + RPC 3종. 데이터레이어는 Presentation→Hooks→Service→Repository→Supabase. UI는 기존 `app/(ops)/tournaments/[id].tsx` 단일 화면에 PLAYERS 탭 액션 + PAYOUTS 6번째 탭 추가.

**Tech Stack:** Expo/RN, TypeScript strict, Supabase(Postgres plpgsql), TanStack Query, Zod, NativeWind, pgTAP, Jest.

## Global Constraints

- 언어: 코드 주석·커밋·UI 카피 **한글**(기술 식별자만 원문).
- 경로: `@/` 절대 경로. 로깅: `logger.info()`(앱). 다크모드 `dark:` 필수. 금액 골드 토큰, 44px 터치.
- DB 쓰기는 SECDEF RPC 전용(테이블 DML anon/authenticated REVOKE). 모든 비즈니스 거부 `RAISE ... USING ERRCODE='P0001'`, 메시지 `PREFIX: 한글`.
- SECDEF 공통 헤더: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'extensions', 'pg_temp'`.
- **SDD 가드(필수)**: 작업 브랜치 `feat/ops-1d-bust-reentry-itm`에만 커밋. **브랜치 생성/전환 금지**. **MCP `mcp__supabase__*` 절대 금지**(로컬 docker/npm만). **기존 마이그 수정 금지**(신규 파일만). 기존 RPC(ops_add_rebuy 등) 본문 변경 금지.
- 마이그 타임스탬프 prefix `20260630`. 로컬 검증: `npm run db:reset` 후 **반드시** `npm run test:db:helpers`(ops_helpers 재적재) → `npx supabase test db`. TS=`npx tsc --noEmit`·`npx jest`·`npm run quality`.
- "in-play(생존)" = `status='active'` **단일 정의**(checked_in/registered/no_show/busted는 비-인플레이) — bust 적격·순위 카운트·우승 후보 모두 이 집합.
- 권위 명세: `docs/superpowers/specs/2026-06-29-ops-1d-bust-reentry-itm-design.md`(적대검증 반영 §14 포함).

---

## File Structure

| 파일                                                                           | 책임                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `supabase/migrations/20260630120000_ops_1d_prizes_table.sql` (생성)            | ops_prizes 테이블·RLS·인덱스·updated_at 트리거 + enum 값 추가 |
| `supabase/migrations/20260630120100_ops_1d_bust_reenter_prize_rpcs.sql` (생성) | RPC 3종(bust/reenter/set_prize_structure)                     |
| `supabase/migrations/20260630120200_ops_1d_grants.sql` (생성)                  | 신규 RPC 3종 grants(DO 루프)                                  |
| `supabase/fixtures/ops_helpers.sql` (수정)                                     | `ops_test_seed_players(t,n)` 보조 헬퍼 추가                   |
| `supabase/tests/ops_bust_participant.test.sql` (생성)                          | bust pgTAP                                                    |
| `supabase/tests/ops_reenter_participant.test.sql` (생성)                       | reenter pgTAP                                                 |
| `supabase/tests/ops_prizes_structure.test.sql` (생성)                          | prize 구조 pgTAP                                              |
| `src/errors/AppError.ts` (수정)                                                | OPS 에러코드 E6123~E6128 + 한글 메시지                        |
| `src/repositories/supabase/opsRpcError.ts` (수정)                              | 신규 prefix→code 매핑                                         |
| `src/types/ops.ts` (수정)                                                      | `OpsPrize`·`OpsBustResult`·`OpsReenterResult` 타입            |
| `src/schemas/opsPrize.schema.ts` (생성)                                        | 상금 구조 입력 Zod                                            |
| `src/lib/queryClient.ts` (수정)                                                | `queryKeys.ops.prizes(tournamentId)`                          |
| `src/repositories/interfaces/IOpsParticipantRepository.ts` (수정)              | bust/reenter 메서드                                           |
| `src/repositories/supabase/OpsParticipantRepository.ts` (수정)                 | bust/reenter 구현(명시 매핑)                                  |
| `src/repositories/interfaces/IOpsPrizeRepository.ts` (생성)                    | prize Repository 인터페이스                                   |
| `src/repositories/supabase/OpsPrizeRepository.ts` (생성)                       | prize Repository 구현                                         |
| `src/repositories/ops.ts` (수정)                                               | OpsPrizeRepository 싱글톤·타입 재노출                         |
| `src/services/ops/opsParticipantService.ts` (수정)                             | bust/reenter 위임                                             |
| `src/services/ops/opsPrizeService.ts` (생성)                                   | prize 구조 위임(Zod 검증)                                     |
| `src/hooks/ops/useOpsMutations.ts` (수정)                                      | `useBustParticipant`·`useReenterParticipant`                  |
| `src/hooks/ops/useOpsPrizes.ts` (생성)                                         | `useOpsPrizes`·`useSetPrizeStructure`                         |
| `src/hooks/ops/index.ts` (수정)                                                | 신규 훅 export                                                |
| `src/components/ops/PayoutsTab.tsx` (생성)                                     | PAYOUTS 탭 UI                                                 |
| `src/components/ops/index.ts` (수정)                                           | PayoutsTab export                                             |
| `app/(ops)/tournaments/[id].tsx` (수정)                                        | PLAYERS 탭 bust/재진입 액션 + PAYOUTS 6번째 탭 + 한글 라벨    |
| `app/(public)/live/[view_token].tsx` (수정)                                    | 비-ITM 탈락 순위 노출                                         |
| `src/__tests__`/도메인 jest (생성/수정)                                        | 에러매핑·Zod·매핑 단위                                        |

---

## Task 1: ops_prizes 테이블 + enum 값 (마이그 M1)

**Files:**

- Create: `supabase/migrations/20260630120000_ops_1d_prizes_table.sql`

**Interfaces:**

- Produces: 테이블 `public.ops_prizes(id, tournament_id, rank, amount, created_at, updated_at)` UNIQUE(tournament_id, rank); enum `public.ops_event_type` 값 `'prize_structure_set'` 추가. 기존 트리거 함수 `public.fn_ops_set_updated_at()`·헬퍼 `public.is_ops_member(uuid,uuid)`·`public.is_admin()` 재사용.

- [ ] **Step 1: 마이그 파일 작성**

```sql
-- OPS 1d M1 — ops_prizes 순위별 고정 상금 테이블 + RLS + enum 값.
-- 패턴: 20260625120000_ops_1a_enums_and_tables.sql (테이블/RLS/트리거), is_ops_member SELECT-only RLS.
-- ⚠️ enum ADD VALUE 는 본 마이그(별도 txn)에서 추가 — 값을 쓰는 RPC 는 M2(별도 txn).

CREATE TABLE IF NOT EXISTS public.ops_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  rank int NOT NULL,
  amount int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_prizes_rank_positive CHECK (rank > 0),
  CONSTRAINT ops_prizes_amount_nonneg CHECK (amount >= 0),
  CONSTRAINT ops_prizes_unique_rank UNIQUE (tournament_id, rank)
);

COMMENT ON TABLE public.ops_prizes IS '순위별 고정 상금 구조(1d). 쓰기는 SECDEF RPC 전용. bust 가 rank=finish_position 으로 prize_amount 매핑.';

ALTER TABLE public.ops_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_prizes FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ops_prizes_tournament_rank
  ON public.ops_prizes (tournament_id, rank);

DROP TRIGGER IF EXISTS trg_ops_prizes_set_updated_at ON public.ops_prizes;
CREATE TRIGGER trg_ops_prizes_set_updated_at
  BEFORE UPDATE ON public.ops_prizes
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

DROP POLICY IF EXISTS ops_prizes_select ON public.ops_prizes;
CREATE POLICY ops_prizes_select ON public.ops_prizes
  FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, auth.uid()) OR public.is_admin());

-- 감사 이벤트 enum 값 (player_busted/player_reentered/prize_assigned 는 1a 존재).
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'prize_structure_set';
```

- [ ] **Step 2: 로컬 적용 + 검증**

Run:

```bash
cd uniqn-mobile && npm run db:reset && npm run test:db:helpers
docker exec supabase_db_uniqn psql -U postgres -d postgres -c "\d public.ops_prizes"
docker exec supabase_db_uniqn psql -U postgres -d postgres -c "SELECT unnest(enum_range(NULL::public.ops_event_type)) @> 'prize_structure_set'::text IS NOT NULL;"
```

Expected: `ops_prizes` 테이블 출력(컬럼·UNIQUE·RLS enabled), enum에 `prize_structure_set` 포함.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260630120000_ops_1d_prizes_table.sql
git commit -m "feat(ops): 1d M1 — ops_prizes 테이블 + RLS + prize_structure_set enum"
```

---

## Task 2: ops_test_seed_players 헬퍼 추가

**Files:**

- Modify: `supabase/fixtures/ops_helpers.sql` (끝에 추가)

**Interfaces:**

- Produces: `public.ops_test_seed_players(p_tournament_id uuid, p_count int) RETURNS uuid[]` — active 참가자 p_count명을 entry_number 연속 발급으로 INSERT, id 배열 반환. **postgres role(역할 전환 전)에서만 호출**(SECDEF지만 EXECUTE grant 없음 — 기존 ops_test_seed 패턴 동일).

- [ ] **Step 1: 헬퍼 함수 추가 (파일 끝)**

```sql
-- 다중 active 참가자 시드(bust 순위/우승확정/재진입 테스트). 좌석 미배정 active.
-- ⚠️ RETURNS 변경 불가 → CREATE 직전 DROP. postgres role(set_user 전)에서 호출.
DROP FUNCTION IF EXISTS public.ops_test_seed_players(uuid, int);
CREATE OR REPLACE FUNCTION public.ops_test_seed_players(p_tournament_id uuid, p_count int)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_ids uuid[] := '{}';
  v_id uuid;
  v_entry int;
  v_chips int;
  i int;
BEGIN
  SELECT starting_chips INTO v_chips FROM public.ops_tournaments WHERE id = p_tournament_id;
  FOR i IN 1..p_count LOOP
    SELECT next_entry_seq + 1 INTO v_entry FROM public.ops_tournaments
      WHERE id = p_tournament_id FOR UPDATE;
    UPDATE public.ops_tournaments SET next_entry_seq = v_entry WHERE id = p_tournament_id;
    INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
    VALUES (p_tournament_id, v_entry, 'P' || v_entry, 'active', COALESCE(v_chips, 30000))
    RETURNING id INTO v_id;
    v_ids := array_append(v_ids, v_id);
  END LOOP;
  RETURN v_ids;
END;
$$;
```

- [ ] **Step 2: 재적재 검증**

Run:

```bash
cd uniqn-mobile && npm run test:db:helpers
docker exec supabase_db_uniqn psql -U postgres -d postgres -c "SELECT proname FROM pg_proc WHERE proname='ops_test_seed_players';"
```

Expected: `ops_test_seed_players` 1행.

- [ ] **Step 3: Commit**

```bash
git add supabase/fixtures/ops_helpers.sql
git commit -m "test(ops): 1d pgTAP 다중 참가자 시드 헬퍼 ops_test_seed_players"
```

---

## Task 3: RPC 3종 작성 (마이그 M2)

**Files:**

- Create: `supabase/migrations/20260630120100_ops_1d_bust_reenter_prize_rpcs.sql`

**Interfaces:**

- Consumes: Task1 `ops_prizes`·enum값. 기존 `public.is_ops_member`·`public.is_admin`·`public.is_admin`·`ops_tournaments`·`ops_seats`·`ops_events`.
- Produces:
  - `public.ops_bust_participant(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb` — 반환 `{participant_id, finish_position, prize_amount, winner_finalized, winner:{participant_id,finish_position,prize_amount}|null}`.
  - `public.ops_reenter_participant(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb` — 반환 `{participant_id, reentries, status, seated}`.
  - `public.ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb) RETURNS jsonb` — 반환 `{tournament_id, count}`.

- [ ] **Step 1: 마이그 파일 작성 — 3 RPC 전체 본문**

```sql
-- OPS 1d M2 — bust / reenter / set_prize_structure RPC.
-- 골격: 20260625120200_ops_1a_rpcs.sql (ops_add_rebuy). "in-play=active" 단일 정의.
-- 적대검증 반영(spec §14): finish_position="생존수 이상 최소 미사용 순위"(재진입 충돌 불가),
--   advisory 락 v_tournament_id, 마지막 생존자 가드, winner active 한정·FOR UPDATE, 좌석 id 오름차순.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) ops_bust_participant — 탈락 처리(순위/상금 자동매핑·좌석해제·우승 자동확정)
CREATE OR REPLACE FUNCTION public.ops_bust_participant(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_status public.ops_participant_status;
  v_t_status public.ops_tournament_status;
  v_active int;
  v_used_count int;
  v_finish int;
  v_prize int;
  v_active2 int;
  v_winner uuid;
  v_winner_prize int;
  v_seat_id uuid;
  v_winner_json jsonb;
BEGIN
  -- 1) actor 가드
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) 참가자 잠금
  SELECT tournament_id, status INTO v_tournament_id, v_status
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory 락 먼저 → 대회 상태 잠금/검증
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중(active) 대회만 탈락 처리 가능 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) 참가자 status 가드
  IF v_status = 'busted' THEN
    RAISE EXCEPTION 'PARTICIPANT_ALREADY_BUSTED: 이미 탈락 처리된 참가자입니다' USING ERRCODE = 'P0001';
  ELSIF v_status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 탈락 처리 가능 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 6) 생존수(자기 포함) + 마지막 생존자 가드
  SELECT count(*) INTO v_active FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  IF v_active <= 1 THEN
    RAISE EXCEPTION 'PARTICIPANT_LAST_SURVIVOR: 마지막 생존자는 탈락 처리할 수 없습니다(우승 처리 대상)'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7) finish_position = 생존수 이상 최소 미사용 순위(재진입 충돌 불가)
  SELECT count(*) INTO v_used_count FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND finish_position IS NOT NULL;
  SELECT g INTO v_finish
    FROM generate_series(v_active, v_active + v_used_count) AS g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND finish_position = g)
    ORDER BY g LIMIT 1;

  -- 8) prize 매핑(없으면 NULL=out of money)
  SELECT amount INTO v_prize FROM public.ops_prizes
    WHERE tournament_id = v_tournament_id AND rank = v_finish;

  -- 9) 변이
  UPDATE public.ops_participants
    SET status = 'busted', busted_at = now(), finish_position = v_finish,
        prize_amount = v_prize, chips = 0
    WHERE id = p_participant_id;

  -- 10) 좌석 해제(id 오름차순 잠금 — 1b 좌석 RPC와 동일 순서, 데드락 회피)
  FOR v_seat_id IN
    SELECT id FROM public.ops_seats
    WHERE participant_id = p_participant_id ORDER BY id FOR UPDATE
  LOOP
    UPDATE public.ops_seats SET participant_id = NULL WHERE id = v_seat_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'seat_freed', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'seat_id', v_seat_id));
  END LOOP;

  -- 11) 이벤트
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_busted', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'finish_position', v_finish, 'prize_amount', v_prize));
  IF v_prize IS NOT NULL THEN
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'rank', v_finish, 'amount', v_prize));
  END IF;

  -- 12) 우승 자동확정(active 만 후보)
  SELECT count(*) INTO v_active2 FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  v_winner_json := NULL;
  IF v_active2 = 1 THEN
    SELECT id INTO v_winner FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND status = 'active' FOR UPDATE;
    SELECT amount INTO v_winner_prize FROM public.ops_prizes
      WHERE tournament_id = v_tournament_id AND rank = 1;
    UPDATE public.ops_participants
      SET finish_position = 1, prize_amount = v_winner_prize WHERE id = v_winner;
    UPDATE public.ops_tournaments SET status = 'completed' WHERE id = v_tournament_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'tournament_status_changed', p_actor_id,
            jsonb_build_object('from', 'active', 'to', 'completed', 'reason', 'winner_finalized'));
    IF v_winner_prize IS NOT NULL THEN
      INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
      VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
              jsonb_build_object('participant_id', v_winner, 'rank', 1, 'amount', v_winner_prize));
    END IF;
    v_winner_json := jsonb_build_object('participant_id', v_winner,
                                        'finish_position', 1, 'prize_amount', v_winner_prize);
  END IF;

  -- 13) 반환
  RETURN jsonb_build_object(
    'participant_id', p_participant_id,
    'finish_position', v_finish,
    'prize_amount', v_prize,
    'winner_finalized', (v_active2 = 1),
    'winner', v_winner_json);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) ops_reenter_participant — 재진입(동일 행 재활성화·카운터·auto-seat)
CREATE OR REPLACE FUNCTION public.ops_reenter_participant(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_status public.ops_participant_status;
  v_reentries int;
  v_t_status public.ops_tournament_status;
  v_reentry_allowed boolean;
  v_max_reentries int;
  v_starting_chips int;
  v_auto_seat boolean;
  v_seat_id uuid;
  v_new_status public.ops_participant_status;
  v_seated boolean;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT tournament_id, status, reentries INTO v_tournament_id, v_status, v_reentries
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- advisory 락 먼저 → 대회 잠금
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status, reentry_allowed, max_reentries, starting_chips, auto_seat_on_register
    INTO v_t_status, v_reentry_allowed, v_max_reentries, v_starting_chips, v_auto_seat
    FROM public.ops_tournaments WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중(active) 대회만 재진입 가능 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status <> 'busted' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_BUSTED: 탈락 상태가 아니어서 재진입할 수 없습니다 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;
  IF v_reentry_allowed = false THEN
    RAISE EXCEPTION 'REENTRY_NOT_ALLOWED: 이 대회는 재진입이 허용되지 않습니다' USING ERRCODE = 'P0001';
  END IF;
  IF v_max_reentries IS NOT NULL AND v_reentries >= v_max_reentries THEN
    RAISE EXCEPTION 'MAX_REENTRIES_EXCEEDED: 최대 재진입 횟수를 초과했습니다 (max=%)', v_max_reentries
      USING ERRCODE = 'P0001';
  END IF;

  -- auto-seat 결정(register 미러: 좌석 확보 시에만 active)
  v_seat_id := NULL;
  IF v_auto_seat THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  END IF;
  v_seated := v_seat_id IS NOT NULL;
  v_new_status := CASE WHEN v_seated THEN 'active'::public.ops_participant_status
                       ELSE 'checked_in'::public.ops_participant_status END;

  UPDATE public.ops_participants
    SET chips = v_starting_chips, finish_position = NULL, busted_at = NULL,
        prize_amount = NULL, reentries = v_reentries + 1, status = v_new_status
    WHERE id = p_participant_id;

  IF v_seated THEN
    UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = v_seat_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_reentered', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'reentries', v_reentries + 1, 'seated', v_seated));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'reentries', v_reentries + 1, 'status', v_new_status, 'seated', v_seated);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) ops_set_prize_structure — 순위별 고정 상금 구조 replace-all
CREATE OR REPLACE FUNCTION public.ops_set_prize_structure(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_prizes jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_t_status public.ops_tournament_status;
  v_count int;
  v_distinct int;
  v_bad int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_t_status = 'completed' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 종료된 대회의 상금 구조는 변경할 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_prizes) <> 'array' THEN
    RAISE EXCEPTION 'PRIZE_STRUCTURE_INVALID: 상금 구조 형식이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*),
         count(DISTINCT (e->>'rank')::int),
         count(*) FILTER (WHERE (e->>'rank')::int <= 0 OR (e->>'amount')::int < 1)
    INTO v_count, v_distinct, v_bad
    FROM jsonb_array_elements(p_prizes) e;
  IF v_bad > 0 OR v_count <> v_distinct THEN
    RAISE EXCEPTION 'PRIZE_STRUCTURE_INVALID: 순위·금액이 올바르지 않습니다(중복/0이하)' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.ops_prizes WHERE tournament_id = p_tournament_id;
  IF v_count > 0 THEN
    INSERT INTO public.ops_prizes (tournament_id, rank, amount)
    SELECT p_tournament_id, (e->>'rank')::int, (e->>'amount')::int
      FROM jsonb_array_elements(p_prizes) e;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'prize_structure_set', p_actor_id,
          jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count);
END;
$function$;
```

- [ ] **Step 2: 로컬 적용 + 함수 생성 확인**

Run:

```bash
cd uniqn-mobile && npm run db:reset && npm run test:db:helpers
docker exec supabase_db_uniqn psql -U postgres -d postgres -c "SELECT proname FROM pg_proc WHERE proname IN ('ops_bust_participant','ops_reenter_participant','ops_set_prize_structure') ORDER BY proname;"
```

Expected: 3행(ops_bust_participant, ops_reenter_participant, ops_set_prize_structure).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260630120100_ops_1d_bust_reenter_prize_rpcs.sql
git commit -m "feat(ops): 1d M2 — bust/reenter/set_prize_structure RPC 3종"
```

---

## Task 4: grants 마이그 (M3)

**Files:**

- Create: `supabase/migrations/20260630120200_ops_1d_grants.sql`

**Interfaces:**

- Consumes: Task3 RPC 3종. Produces: 3종에 `REVOKE anon` + `GRANT authenticated, service_role`.

- [ ] **Step 1: 마이그 파일 작성**

```sql
-- OPS 1d M3 — 신규 RPC 권한. 패턴: 20260625120300_ops_1a_grants_and_realtime.sql.
-- pitfall_supabase_new_function_anon_default_grant: 변이 RPC 는 anon 명시 REVOKE 필수.
-- ops_prizes Realtime 미등록(상금 구조는 mutation onSuccess 무효화로 충분). participants 는 1a 등록됨.
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'ops_bust_participant',
    'ops_reenter_participant',
    'ops_set_prize_structure'
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
    RAISE NOTICE 'ops 1d rpc hardened: %', rec.sig;
  END LOOP;
END $$;
```

- [ ] **Step 2: 적용 + anon REVOKE 확인**

Run:

```bash
cd uniqn-mobile && npm run db:reset && npm run test:db:helpers
docker exec supabase_db_uniqn psql -U postgres -d postgres -c "SELECT has_function_privilege('anon','public.ops_bust_participant(uuid,uuid)','EXECUTE') AS anon_bust, has_function_privilege('authenticated','public.ops_bust_participant(uuid,uuid)','EXECUTE') AS auth_bust;"
```

Expected: `anon_bust=f`, `auth_bust=t`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260630120200_ops_1d_grants.sql
git commit -m "feat(ops): 1d M3 — 신규 RPC grants(anon REVOKE)"
```

---

## Task 5: bust pgTAP

**Files:**

- Create: `supabase/tests/ops_bust_participant.test.sql`

**Interfaces:** Consumes Task1~4 + `ops_test_seed`·`ops_test_seed_players`·`ops_test_set_user`.

- [ ] **Step 1: 테스트 작성 (RED 먼저 — 일부 단언이 미세조정 필요)**

핵심 시나리오 전체 코드(나머지 actor 가드 3종은 ops_clock_state.test.sql 패턴 복제):

```sql
BEGIN;
SELECT plan(14);

-- 시드: 대회 + 시드참가자(active 1) + 추가 active 3 = active 4. (postgres role, set_user 전)
DO $$
DECLARE s record; v_ids uuid[];
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.member_id', s.member_id::text, true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text, true);
  PERFORM set_config('ops.t_id', s.tournament_id::text, true);
  -- 대회 active 전이(bust 는 active 대회만)
  UPDATE public.ops_tournaments SET status='active' WHERE id = s.tournament_id;
  -- 추가 active 3명 (총 active 4)
  v_ids := ops_test_seed_players(s.tournament_id, 3);
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ① 첫 bust: active 4 → finish_position=4
SELECT is(
  (ops_bust_participant(
     (SELECT id FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t_id'))::uuid AND status='active' ORDER BY entry_number LIMIT 1),
     (current_setting('ops.owner_id'))::uuid) ->> 'finish_position')::int,
  4, 'first bust → finish_position = 생존수 4');

-- ② 둘째 bust: active 3 → fp=3
SELECT is(
  (ops_bust_participant(
     (SELECT id FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t_id'))::uuid AND status='active' ORDER BY entry_number LIMIT 1),
     (current_setting('ops.owner_id'))::uuid) ->> 'finish_position')::int,
  3, 'second bust → fp=3 (단조)');

-- ③ 이중 bust 거부: 방금 busted 참가자 재-bust → PARTICIPANT_ALREADY_BUSTED
SELECT throws_ok(
  format($$ SELECT ops_bust_participant(%L, %L) $$,
    (SELECT id FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t_id'))::uuid AND status='busted' ORDER BY finish_position LIMIT 1),
    current_setting('ops.owner_id')),
  'P0001', NULL, '이중 bust 거부');

-- ④ 부분UNIQUE 직접 위반(postgres role) → 23505
DO $$ BEGIN PERFORM set_config('role','postgres',true); END $$;
SELECT throws_ok(
  format($$ UPDATE public.ops_participants SET finish_position=4
            WHERE id=(SELECT id FROM public.ops_participants WHERE tournament_id=%L AND status='active' LIMIT 1) $$,
    current_setting('ops.t_id')),
  '23505', NULL, '부분UNIQUE 등수 중복 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ⑤ 우승 자동확정: 남은 active 2 중 1 bust → 나머지 fp=1·tournament completed
SELECT lives_ok(
  format($$ SELECT ops_bust_participant(%L, %L) $$,
    (SELECT id FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t_id'))::uuid AND status='active' ORDER BY entry_number LIMIT 1),
    current_setting('ops.owner_id')),
  'heads-up bust 정상');
SELECT is(
  (SELECT count(*) FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t_id'))::uuid AND finish_position=1)::int,
  1, '우승자 finish_position=1 정확히 1명');
SELECT is(
  (SELECT status::text FROM public.ops_tournaments WHERE id=(current_setting('ops.t_id'))::uuid),
  'completed', 'tournament completed');
SELECT is(
  (SELECT status::text FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t_id'))::uuid AND finish_position=1),
  'active', '우승자 status 유지(active)');

-- ⑥ live_stats: playing=0 (전원 탈락/우승확정 후 active 1명 winner)
SELECT is(
  (SELECT playing FROM public.ops_live_stats WHERE tournament_id=(current_setting('ops.t_id'))::uuid)::int,
  1, 'live_stats playing=1 (winner 만 active)');

-- ⑦ 마지막 생존자 가드: completed 대회라 INVALID_STATUS, 별도 대회로 LAST_SURVIVOR 검증
DO $$
DECLARE s2 record;
BEGIN
  SELECT * INTO s2 FROM ops_test_seed();
  PERFORM set_config('ops.t2', s2.tournament_id::text, true);
  PERFORM set_config('ops.owner2', s2.owner_id::text, true);
  UPDATE public.ops_tournaments SET status='active' WHERE id=s2.tournament_id;
  -- 시드 참가자 1명만 active(추가 없음)
END $$;
SELECT ops_test_set_user((current_setting('ops.owner2'))::uuid);
SELECT throws_ok(
  format($$ SELECT ops_bust_participant(%L, %L) $$,
    (SELECT id FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t2'))::uuid AND status='active' LIMIT 1),
    current_setting('ops.owner2')),
  'P0001', NULL, '마지막 생존자 bust 거부(LAST_SURVIVOR)');

-- ⑧ ITM prize 매핑: 새 대회 active 2 + 상금구조(1위 100000,2위 60000) → 2위 bust prize=60000
DO $$
DECLARE s3 record;
BEGIN
  SELECT * INTO s3 FROM ops_test_seed();
  PERFORM set_config('ops.t3', s3.tournament_id::text, true);
  PERFORM set_config('ops.owner3', s3.owner_id::text, true);
  UPDATE public.ops_tournaments SET status='active' WHERE id=s3.tournament_id;
  PERFORM ops_test_seed_players(s3.tournament_id, 1); -- 총 active 2
END $$;
SELECT ops_test_set_user((current_setting('ops.owner3'))::uuid);
SELECT lives_ok(
  format($$ SELECT ops_set_prize_structure(%L, %L, %L::jsonb) $$,
    current_setting('ops.t3'), current_setting('ops.owner3'),
    '[{"rank":1,"amount":100000},{"rank":2,"amount":60000}]'),
  '상금구조 설정');
SELECT is(
  (ops_bust_participant(
    (SELECT id FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t3'))::uuid AND status='active' ORDER BY entry_number LIMIT 1),
    (current_setting('ops.owner3'))::uuid) ->> 'prize_amount')::int,
  60000, '2위 bust → ITM prize 60000');
SELECT is(
  (SELECT prize_amount FROM public.ops_participants WHERE tournament_id=(current_setting('ops.t3'))::uuid AND finish_position=1)::int,
  100000, '우승자 rank1 prize 100000');

-- ⑨ 재진입 후 재탈락 순위충돌 없음(적대검증 reentry-1 회귀)
DO $$
DECLARE s4 record;
BEGIN
  SELECT * INTO s4 FROM ops_test_seed();
  PERFORM set_config('ops.t4', s4.tournament_id::text, true);
  PERFORM set_config('ops.owner4', s4.owner_id::text, true);
  UPDATE public.ops_tournaments SET status='active', reentry_allowed=true, max_reentries=NULL WHERE id=s4.tournament_id;
  PERFORM ops_test_seed_players(s4.tournament_id, 3); -- 총 active 4 (p_seed + 3)
END $$;
SELECT ops_test_set_user((current_setting('ops.owner4'))::uuid);
-- p1 bust(fp=4), p2 bust(fp=3), p1 reenter, p3 bust → fp=4 (미사용 최소≥3), 23505 없음
SELECT lives_ok($$
  DO $reentry$
  DECLARE t uuid := (current_setting('ops.t4'))::uuid; o uuid := (current_setting('ops.owner4'))::uuid; pa uuid; pb uuid;
  BEGIN
    SELECT id INTO pa FROM public.ops_participants WHERE tournament_id=t AND status='active' ORDER BY entry_number LIMIT 1;
    PERFORM ops_bust_participant(pa, o);                 -- fp=4
    SELECT id INTO pb FROM public.ops_participants WHERE tournament_id=t AND status='active' ORDER BY entry_number LIMIT 1;
    PERFORM ops_bust_participant(pb, o);                 -- fp=3
    PERFORM ops_reenter_participant(pa, o);              -- pa 부활(fp NULL)
    -- 다음 active 1명 bust → 충돌 없이 fp 부여
    PERFORM ops_bust_participant(
      (SELECT id FROM public.ops_participants WHERE tournament_id=t AND status='active' AND id<>pa ORDER BY entry_number LIMIT 1), o);
  END $reentry$;
  $$, '재진입 후 재탈락 — 부분UNIQUE 충돌(23505) 없음');

SELECT * FROM finish();
ROLLBACK;
```

추가 단언(plan 수 조정): ⑩ actor 위조(member가 owner명의)·비멤버(outsider) → P0001 2건, ⑪ 비-active 대회 bust 거부 1건은 ops_clock_state.test.sql:86-110 패턴을 복제해 추가하고 `plan(N)`을 실제 SELECT 호출 수에 맞춘다.

- [ ] **Step 2: 실행 (GREEN 목표)**

Run: `cd uniqn-mobile && npm run db:reset && npm run test:db:helpers && npx supabase test db 2>&1 | grep -A2 ops_bust`
Expected: `ops_bust_participant.test.sql .. ok`, 전 단언 pass. (실패 시 plan 수·단언 조정.)

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/ops_bust_participant.test.sql
git commit -m "test(ops): 1d bust pgTAP — 순위/우승확정/ITM/재진입충돌 회귀"
```

---

## Task 6: reenter pgTAP

**Files:** Create: `supabase/tests/ops_reenter_participant.test.sql`

- [ ] **Step 1: 테스트 작성**

시나리오(완전 단언): 시드 대회 active 전이 + active 2명(시드+1), 1명 bust 후 재진입 대상 확보. 좌석 시드는 ops_test_seed가 빈좌석 2개 제공(auto_seat_on_register 기본값 확인 필요 — `ops_tournaments` 기본 `auto_seat_on_register` 컬럼값. 시드는 명시 안 함 → 테이블 DEFAULT). 검증:

- ① bust→재진입: status active 또는 checked_in 복귀, `chips=starting_chips(30000)`, `finish_position/busted_at/prize_amount NULL`.
- ② `reentries=1`(정확히 +1).
- ③ `reentry_allowed=false` 대회 → `throws_ok P0001`(REENTRY_NOT_ALLOWED).
- ④ `max_reentries=0` 대회 → 첫 재진입부터 `throws_ok P0001`(MAX_REENTRIES_EXCEEDED).
- ⑤ active 참가자 재진입 시도(not busted) → `throws_ok P0001`(PARTICIPANT_NOT_BUSTED).
- ⑥ completed 대회 재진입 → `throws_ok P0001`(INVALID_STATUS): 별도 대회 우승확정시켜 completed 만든 뒤 그 busted 참가자 재진입 시도.
- ⑦ actor 가드 2종(위조/비멤버) → P0001.

대표 코드(①②):

```sql
BEGIN;
SELECT plan(9);
DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.t_id', s.tournament_id::text, true);
  UPDATE public.ops_tournaments SET status='active', reentry_allowed=true, max_reentries=NULL WHERE id=s.tournament_id;
  PERFORM ops_test_seed_players(s.tournament_id, 1); -- active 2
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
-- 한 명 bust(active 2→fp=2), 남은 1명이 우승확정되지 않도록? 2명 중 1 bust 시 우승확정됨.
-- 재진입 대상 확보: bust 된 참가자를 재진입. (대회는 completed 됨 → INVALID_STATUS)
-- 따라서 재진입 정상 케이스는 active≥3 으로 시드해 bust 후에도 진행 중 유지.
```

⚠️**중요**: 2명만 두고 1명 bust 하면 우승확정→completed 되어 재진입이 INVALID_STATUS로 막힌다. 정상 재진입 검증은 **active 3명 이상** 시드 후 1명 bust(미완결 유지) → 재진입. `ops_test_seed_players(t, 2)`로 총 active 3 사용.

- [ ] **Step 2: 실행** — `npx supabase test db 2>&1 | grep ops_reenter` → ok.
- [ ] **Step 3: Commit** — `test(ops): 1d reenter pgTAP — 카운터/가드/auto-seat/completed차단`

---

## Task 7: prize 구조 pgTAP

**Files:** Create: `supabase/tests/ops_prizes_structure.test.sql`

- [ ] **Step 1: 테스트 작성** — 단언:
- ① replace-all: 설정 후 재설정 시 기존 행 삭제+신규(count 일치, 옛 rank 부재).
- ② 중복 rank → `throws_ok P0001`(PRIZE_STRUCTURE_INVALID): `[{"rank":1,"amount":100},{"rank":1,"amount":50}]`.
- ③ amount 0/음수 → `throws_ok P0001`: `[{"rank":1,"amount":0}]`.
- ④ completed 대회 → `throws_ok P0001`(INVALID_STATUS).
- ⑤ RLS SELECT: owner는 `SELECT count(*) FROM ops_prizes` 보임, outsider는 0행(`ops_test_set_user(outsider)` 후).
- ⑥ anon EXECUTE 거부: `has_function_privilege('anon','public.ops_set_prize_structure(uuid,uuid,jsonb)','EXECUTE')` = false (`SELECT ok(NOT has_function_privilege(...), ...)`).
- ⑦ actor 위조/비멤버 → P0001.

- [ ] **Step 2: 실행** → ok.
- [ ] **Step 3: Commit** — `test(ops): 1d prize 구조 pgTAP — replace/검증/RLS/anon거부`

---

## Task 8: 에러 코드 + 매핑

**Files:**

- Modify: `src/errors/AppError.ts` (ERROR_CODES OPS 블록 끝 = E6122 다음, ERROR_MESSAGES OPS 블록)
- Modify: `src/repositories/supabase/opsRpcError.ts` (PREFIX_MAP 참가자 그룹)

**Interfaces:** Produces: `ERROR_CODES.OPS_PARTICIPANT_ALREADY_BUSTED='E6123'` 외 5종.

- [ ] **Step 1: 에러 단위 테스트 작성 (RED)** — `src/repositories/supabase/__tests__/opsRpcError.test.ts`에 추가:

```ts
it.each([
  ['PARTICIPANT_ALREADY_BUSTED: x', ERROR_CODES.OPS_PARTICIPANT_ALREADY_BUSTED],
  ['PARTICIPANT_NOT_BUSTED: x', ERROR_CODES.OPS_PARTICIPANT_NOT_BUSTED],
  ['PARTICIPANT_LAST_SURVIVOR: x', ERROR_CODES.OPS_PARTICIPANT_LAST_SURVIVOR],
  ['REENTRY_NOT_ALLOWED: x', ERROR_CODES.OPS_REENTRY_NOT_ALLOWED],
  ['MAX_REENTRIES_EXCEEDED: x', ERROR_CODES.OPS_MAX_REENTRIES_EXCEEDED],
  ['PRIZE_STRUCTURE_INVALID: x', ERROR_CODES.OPS_PRIZE_STRUCTURE_INVALID],
])('maps %s → %s', (msg, code) => {
  expect(() => mapOpsRpcError({ message: msg }, { operation: 't' })).toThrow(
    expect.objectContaining({ code })
  );
});
```

Run: `npx jest opsRpcError -t "maps"` → FAIL(코드 미정의).

- [ ] **Step 2: ERROR_CODES 추가** (`AppError.ts:198` `OPS_CLAIM_PIN_INVALID: 'E6122',` 다음 줄):

```ts
  OPS_PARTICIPANT_ALREADY_BUSTED: 'E6123', // 이미 탈락 처리된 참가자 재-bust
  OPS_PARTICIPANT_NOT_BUSTED: 'E6124', // 비-탈락 참가자 재진입 시도
  OPS_REENTRY_NOT_ALLOWED: 'E6125', // 재진입 비허용 대회
  OPS_MAX_REENTRIES_EXCEEDED: 'E6126', // 최대 재진입 초과
  OPS_PRIZE_STRUCTURE_INVALID: 'E6127', // 상금 구조 형식/중복/음수
  OPS_PARTICIPANT_LAST_SURVIVOR: 'E6128', // 마지막 생존자 bust 시도
```

- [ ] **Step 3: ERROR_MESSAGES 추가** (`AppError.ts:231` `OPS_CLAIM_PIN_INVALID` 메시지 다음):

```ts
  [ERROR_CODES.OPS_PARTICIPANT_ALREADY_BUSTED]: '이미 탈락 처리된 참가자예요.',
  [ERROR_CODES.OPS_PARTICIPANT_NOT_BUSTED]: '탈락 상태가 아니어서 재진입할 수 없어요.',
  [ERROR_CODES.OPS_REENTRY_NOT_ALLOWED]: '이 대회는 재진입이 허용되지 않아요.',
  [ERROR_CODES.OPS_MAX_REENTRIES_EXCEEDED]: '최대 재진입 횟수를 초과했어요.',
  [ERROR_CODES.OPS_PRIZE_STRUCTURE_INVALID]: '상금 구조가 올바르지 않아요(순위·금액 확인).',
  [ERROR_CODES.OPS_PARTICIPANT_LAST_SURVIVOR]: '마지막 생존자는 탈락 처리할 수 없어요(우승 처리 대상).',
```

- [ ] **Step 4: PREFIX_MAP 추가** (`opsRpcError.ts` 참가자 그룹 `PARTICIPANT_ALREADY_SEATED` 항목 앞에 삽입 — 신규 prefix는 기존과 substring 무관하나 참가자군에 모음):

```ts
  [
    'PARTICIPANT_ALREADY_BUSTED',
    ERROR_CODES.OPS_PARTICIPANT_ALREADY_BUSTED,
    ERROR_CODES.OPS_PARTICIPANT_ALREADY_BUSTED,
  ],
  ['PARTICIPANT_NOT_BUSTED', ERROR_CODES.OPS_PARTICIPANT_NOT_BUSTED, ERROR_CODES.OPS_PARTICIPANT_NOT_BUSTED],
  [
    'PARTICIPANT_LAST_SURVIVOR',
    ERROR_CODES.OPS_PARTICIPANT_LAST_SURVIVOR,
    ERROR_CODES.OPS_PARTICIPANT_LAST_SURVIVOR,
  ],
  ['REENTRY_NOT_ALLOWED', ERROR_CODES.OPS_REENTRY_NOT_ALLOWED, ERROR_CODES.OPS_REENTRY_NOT_ALLOWED],
  ['MAX_REENTRIES_EXCEEDED', ERROR_CODES.OPS_MAX_REENTRIES_EXCEEDED, ERROR_CODES.OPS_MAX_REENTRIES_EXCEEDED],
  ['PRIZE_STRUCTURE_INVALID', ERROR_CODES.OPS_PRIZE_STRUCTURE_INVALID, ERROR_CODES.OPS_PRIZE_STRUCTURE_INVALID],
```

- [ ] **Step 5: GREEN + commit**

Run: `npx jest opsRpcError` → PASS.

```bash
git add src/errors/AppError.ts src/repositories/supabase/opsRpcError.ts src/repositories/supabase/__tests__/opsRpcError.test.ts
git commit -m "feat(ops): 1d 에러코드 E6123~E6128 + opsRpcError 매핑"
```

---

## Task 9: 타입 + queryKeys + prize 스키마

**Files:**

- Modify: `src/types/ops.ts` (OpsParticipant 인터페이스 뒤)
- Modify: `src/lib/queryClient.ts` (`queryKeys.ops` 객체 `player:` 다음)
- Create: `src/schemas/opsPrize.schema.ts`

**Interfaces:** Produces: `OpsPrize`·`OpsBustResult`·`OpsReenterResult` 타입, `queryKeys.ops.prizes(tournamentId)`, `prizeStructureSchema`.

- [ ] **Step 1: 타입 추가** (`src/types/ops.ts`, OpsEvent 인터페이스 위/적절 위치):

```ts
/** 순위별 고정 상금(1d). */
export interface OpsPrize {
  id: string;
  tournamentId: string;
  rank: number;
  amount: number;
}

/** bust RPC 반환(camelCase 매핑됨). */
export interface OpsBustResult {
  finishPosition: number;
  prizeAmount: number | null;
  winnerFinalized: boolean;
  winner: { participantId: string; finishPosition: number; prizeAmount: number | null } | null;
}

/** reenter RPC 반환. */
export interface OpsReenterResult {
  participantId: string;
  reentries: number;
  status: OpsParticipantStatus;
  seated: boolean;
}
```

- [ ] **Step 2: queryKeys 추가** (`src/lib/queryClient.ts`, `player:` 줄 다음):

```ts
    // 1d — 순위별 상금 구조
    prizes: (tournamentId: string) => [...queryKeys.ops.all, 'prizes', tournamentId] as const,
```

- [ ] **Step 3: Zod 스키마 작성** (`src/schemas/opsPrize.schema.ts`):

```ts
import { z } from 'zod';

/** 상금 구조 입력 — rank>0, amount>=1, rank 중복 금지. */
export const prizeRowSchema = z.object({
  rank: z.number().int().positive(),
  amount: z.number().int().positive(),
});

export const prizeStructureSchema = z
  .array(prizeRowSchema)
  .refine((rows) => new Set(rows.map((r) => r.rank)).size === rows.length, {
    message: '중복된 순위가 있어요.',
  });

export type PrizeStructureInput = z.infer<typeof prizeStructureSchema>;
```

- [ ] **Step 4: 스키마 테스트 + commit**

`src/schemas/__tests__/opsPrize.schema.test.ts`:

```ts
import { prizeStructureSchema } from '@/schemas/opsPrize.schema';
describe('prizeStructureSchema', () => {
  it('정상 통과', () => {
    expect(prizeStructureSchema.safeParse([{ rank: 1, amount: 100 }]).success).toBe(true);
  });
  it('중복 rank 거부', () => {
    expect(
      prizeStructureSchema.safeParse([
        { rank: 1, amount: 100 },
        { rank: 1, amount: 50 },
      ]).success
    ).toBe(false);
  });
  it('amount 0 거부', () => {
    expect(prizeStructureSchema.safeParse([{ rank: 1, amount: 0 }]).success).toBe(false);
  });
});
```

Run: `npx jest opsPrize.schema` → PASS. `npx tsc --noEmit` → 0 errors.

```bash
git add src/types/ops.ts src/lib/queryClient.ts src/schemas/opsPrize.schema.ts src/schemas/__tests__/opsPrize.schema.test.ts
git commit -m "feat(ops): 1d 타입(OpsPrize/Bust/Reenter)+queryKeys.prizes+Zod 스키마"
```

---

## Task 10: Repository (participant bust/reenter + prize)

**Files:**

- Modify: `src/repositories/interfaces/IOpsParticipantRepository.ts`
- Modify: `src/repositories/supabase/OpsParticipantRepository.ts`
- Create: `src/repositories/interfaces/IOpsPrizeRepository.ts`
- Create: `src/repositories/supabase/OpsPrizeRepository.ts`
- Modify: `src/repositories/ops.ts`

**Interfaces:**

- Consumes: `OpsBustResult`·`OpsReenterResult`·`OpsPrize`·`mapOpsRpcError`·`toCamelCase`.
- Produces: `opsParticipantRepository.bustParticipant/reenterParticipant`, `opsPrizeRepository.list/setStructure`.

- [ ] **Step 1: 인터페이스 확장** (`IOpsParticipantRepository.ts` — import에 `OpsBustResult, OpsReenterResult` 추가, 인터페이스에):

```ts
  bustParticipant(participantId: string, actorId: string): Promise<OpsBustResult>;
  reenterParticipant(participantId: string, actorId: string): Promise<OpsReenterResult>;
```

(상단 import: `import type { OpsParticipant, OpsBustResult, OpsReenterResult } from '@/types/ops';`)

- [ ] **Step 2: 구현** (`OpsParticipantRepository.ts` — import에 타입 추가, `addAddon` 메서드 다음):

```ts
  async bustParticipant(participantId: string, actorId: string): Promise<OpsBustResult> {
    try {
      const { data, error } = await supabase.rpc('ops_bust_participant', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 탈락 처리' });
      const r = data as {
        finish_position: number;
        prize_amount: number | null;
        winner_finalized: boolean;
        winner: { participant_id: string; finish_position: number; prize_amount: number | null } | null;
      };
      return {
        finishPosition: r.finish_position,
        prizeAmount: r.prize_amount,
        winnerFinalized: r.winner_finalized,
        winner: r.winner
          ? {
              participantId: r.winner.participant_id,
              finishPosition: r.winner.finish_position,
              prizeAmount: r.winner.prize_amount,
            }
          : null,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 탈락 처리' });
    }
  }

  async reenterParticipant(participantId: string, actorId: string): Promise<OpsReenterResult> {
    try {
      const { data, error } = await supabase.rpc('ops_reenter_participant', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 재진입' });
      const r = data as { participant_id: string; reentries: number; status: string; seated: boolean };
      return {
        participantId: r.participant_id,
        reentries: r.reentries,
        status: r.status as OpsParticipant['status'],
        seated: r.seated,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 재진입' });
    }
  }
```

(상단 import: `import type { OpsParticipant, OpsBustResult, OpsReenterResult } from '@/types/ops';`)

- [ ] **Step 3: prize 인터페이스** (`IOpsPrizeRepository.ts`):

```ts
import type { OpsPrize } from '@/types/ops';
import type { PrizeStructureInput } from '@/schemas/opsPrize.schema';

export interface IOpsPrizeRepository {
  list(tournamentId: string): Promise<OpsPrize[]>;
  setStructure(
    tournamentId: string,
    actorId: string,
    prizes: PrizeStructureInput
  ): Promise<{ count: number }>;
}
```

- [ ] **Step 4: prize 구현** (`OpsPrizeRepository.ts`):

```ts
import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsPrizeRepository } from '../interfaces/IOpsPrizeRepository';
import type { OpsPrize } from '@/types/ops';
import type { PrizeStructureInput } from '@/schemas/opsPrize.schema';

const TABLE = 'ops_prizes' as const;
const COLUMNS = 'id, tournament_id, rank, amount';

export class SupabaseOpsPrizeRepository implements IOpsPrizeRepository {
  async list(tournamentId: string): Promise<OpsPrize[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 상금 목록', table: TABLE });
      return (data ?? []).map((r) =>
        toCamelCase<OpsPrize>(r as unknown as Record<string, unknown>)
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 상금 목록', table: TABLE });
    }
  }

  async setStructure(
    tournamentId: string,
    actorId: string,
    prizes: PrizeStructureInput
  ): Promise<{ count: number }> {
    try {
      const { data, error } = await supabase.rpc('ops_set_prize_structure', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
        p_prizes: prizes,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 상금 구조 저장' });
      const r = data as { count: number };
      return { count: r.count };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 상금 구조 저장' });
    }
  }
}
```

- [ ] **Step 5: factory 등록** (`src/repositories/ops.ts`): import·export type·export class·싱글톤 4곳에 `OpsPrizeRepository` 추가(기존 패턴 동일):

```ts
import { SupabaseOpsPrizeRepository } from './supabase/OpsPrizeRepository';
export type { IOpsPrizeRepository } from './interfaces/IOpsPrizeRepository';
export { SupabaseOpsPrizeRepository } from './supabase/OpsPrizeRepository';
export const opsPrizeRepository = new SupabaseOpsPrizeRepository();
```

- [ ] **Step 6: 타입체크 + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/repositories/
git commit -m "feat(ops): 1d Repository — bust/reenter 명시매핑 + OpsPrizeRepository"
```

---

## Task 11: Service + Hooks

**Files:**

- Modify: `src/services/ops/opsParticipantService.ts`
- Create: `src/services/ops/opsPrizeService.ts`
- Modify: `src/hooks/ops/useOpsMutations.ts`
- Create: `src/hooks/ops/useOpsPrizes.ts`
- Modify: `src/hooks/ops/index.ts`

**Interfaces:** Produces: `bust/reenter` 서비스, `setPrizeStructure` 서비스(Zod), `useBustParticipant`·`useReenterParticipant`·`useOpsPrizes`·`useSetPrizeStructure`.

- [ ] **Step 1: participant service** (`opsParticipantService.ts`, addAddon 다음):

```ts
export async function bustParticipant(participantId: string, actorId: string) {
  try {
    logger.info('ops 탈락 처리', { component: COMPONENT, participantId });
    return await opsParticipantRepository.bustParticipant(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '탈락 처리',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function reenterParticipant(participantId: string, actorId: string) {
  try {
    logger.info('ops 재진입', { component: COMPONENT, participantId });
    return await opsParticipantRepository.reenterParticipant(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '재진입',
      component: COMPONENT,
      context: { participantId },
    });
  }
}
```

- [ ] **Step 2: prize service** (`opsPrizeService.ts`):

```ts
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { opsPrizeRepository } from '@/repositories/ops';
import { prizeStructureSchema, type PrizeStructureInput } from '@/schemas/opsPrize.schema';
import type { OpsPrize } from '@/types/ops';

const COMPONENT = 'opsPrizeService';

export async function listPrizes(tournamentId: string): Promise<OpsPrize[]> {
  try {
    return await opsPrizeRepository.list(tournamentId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '상금 목록',
      component: COMPONENT,
      context: { tournamentId },
    });
  }
}

export async function setPrizeStructure(
  tournamentId: string,
  actorId: string,
  prizes: PrizeStructureInput
): Promise<{ count: number }> {
  try {
    const parsed = prizeStructureSchema.safeParse(prizes);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message;
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: first ?? '상금 구조를 확인해 주세요.',
      });
    }
    logger.info('ops 상금 구조 저장', {
      component: COMPONENT,
      tournamentId,
      count: parsed.data.length,
    });
    return await opsPrizeRepository.setStructure(tournamentId, actorId, parsed.data);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '상금 구조 저장',
      component: COMPONENT,
      context: { tournamentId },
    });
  }
}
```

- [ ] **Step 3: participant 훅** (`useOpsMutations.ts`, useAddAddon 다음 — import에 `opsParticipantService` 기존 사용 확인, `toast`·`queryKeys`·`requireActor`·`useAuthStore` 기존):

```ts
export function useBustParticipant(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.bustParticipant(participantId, requireActor(actorId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
      if (result.winnerFinalized) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(tournamentId) });
      }
    },
    onError: (error) => {
      logger.error('ops 탈락 처리 실패', toError(error));
      toast.error(extractUserMessage(error) || '탈락 처리에 실패했습니다');
    },
  });
}

export function useReenterParticipant(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.reenterParticipant(participantId, requireActor(actorId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
      toast.success('재진입 처리됨');
    },
    onError: (error) => {
      logger.error('ops 재진입 실패', toError(error));
      toast.error(extractUserMessage(error) || '재진입에 실패했습니다');
    },
  });
}
```

- [ ] **Step 4: prize 훅** (`useOpsPrizes.ts`):

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { queryKeys } from '@/lib/queryClient';
import { listPrizes, setPrizeStructure } from '@/services/ops/opsPrizeService';
import { logger, toError } from '@/utils/logger';
import { toast } from '@/utils/toast';
import { extractUserMessage } from '@/errors';
import type { PrizeStructureInput } from '@/schemas/opsPrize.schema';

function requireActor(actorId: string | undefined): string {
  if (!actorId) throw new Error('actor 미인증');
  return actorId;
}

export function useOpsPrizes(tournamentId: string) {
  const query = useQuery({
    queryKey: queryKeys.ops.prizes(tournamentId),
    queryFn: () => listPrizes(tournamentId),
    enabled: !!tournamentId,
  });
  return { prizes: query.data ?? [], isLoading: query.isLoading };
}

export function useSetPrizeStructure(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (prizes: PrizeStructureInput) =>
      setPrizeStructure(tournamentId, requireActor(actorId), prizes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.prizes(tournamentId) });
      toast.success('상금 구조 저장됨');
    },
    onError: (error) => {
      logger.error('ops 상금 구조 저장 실패', toError(error));
      toast.error(extractUserMessage(error) || '상금 구조 저장에 실패했습니다');
    },
  });
}
```

⚠️ `requireActor`·`toError`·`toast`·`extractUserMessage`·`useAuthStore` import 경로는 `useOpsMutations.ts` 상단과 **동일 경로**를 복제(파일 상단 기존 import 확인 후 일치시킬 것).

- [ ] **Step 5: 배럴 export** (`src/hooks/ops/index.ts`): `useOpsMutations` export 블록에 `useBustParticipant, useReenterParticipant` 추가 + 새 줄 `export { useOpsPrizes, useSetPrizeStructure } from './useOpsPrizes';`.

- [ ] **Step 6: 타입체크 + commit**

Run: `npx tsc --noEmit` → 0 errors. `npx jest opsParticipant` (기존 서비스 테스트 깨지지 않음).

```bash
git add src/services/ops/ src/hooks/ops/
git commit -m "feat(ops): 1d Service+Hooks — bust/reenter/prize 구조"
```

---

## Task 12: PLAYERS 탭 bust/재진입 UI + PAYOUTS 6번째 탭

**Files:**

- Modify: `app/(ops)/tournaments/[id].tsx`
- Create: `src/components/ops/PayoutsTab.tsx`
- Modify: `src/components/ops/index.ts`

**Interfaces:** Consumes 훅. 기존 segments(105-120줄), renderItem(201-251줄), tab union(44줄).

- [ ] **Step 1: PayoutsTab 컴포넌트 작성** (`src/components/ops/PayoutsTab.tsx`):

```tsx
import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useOpsPrizes, useSetPrizeStructure } from '@/hooks/ops';

const fmt = (n: number) => n.toLocaleString('ko-KR');

interface PrizeRow {
  rank: number;
  amount: string; // 입력 raw
}

export function PayoutsTab({ tournamentId }: { tournamentId: string }) {
  const { prizes, isLoading } = useOpsPrizes(tournamentId);
  const setMut = useSetPrizeStructure(tournamentId);
  const [rows, setRows] = useState<PrizeRow[]>([]);

  useEffect(() => {
    if (prizes.length > 0) {
      setRows(prizes.map((p) => ({ rank: p.rank, amount: String(p.amount) })));
    }
  }, [prizes]);

  const total = rows.reduce((s, r) => s + (parseInt(r.amount.replace(/[^0-9]/g, ''), 10) || 0), 0);

  const addRow = () => setRows((rs) => [...rs, { rank: rs.length + 1, amount: '' }]);
  const updateAmount = (idx: number, v: string) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, amount: v } : r)));

  const save = () => {
    const payload = rows
      .map((r) => ({ rank: r.rank, amount: parseInt(r.amount.replace(/[^0-9]/g, ''), 10) || 0 }))
      .filter((r) => r.amount > 0);
    setMut.mutate(payload);
  };

  if (isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View className="items-center gap-3 py-12">
        <Text className="font-sans-semibold text-base text-content-primary dark:text-off-white">
          아직 상금 구조가 없어요
        </Text>
        <Text className="px-8 text-center text-sm text-secondary-500 dark:text-secondary-400">
          순위별 수령액을 설정하면 탈락 시 자동으로 배정돼요. 대회 시작 전에 설정하는 걸 권장해요.
        </Text>
        <Pressable
          onPress={() => setRows([{ rank: 1, amount: '' }])}
          accessibilityRole="button"
          className="mt-2 min-h-[44px] justify-center rounded-md bg-gold px-6 dark:bg-gold"
        >
          <Text className="font-sans-semibold text-on-gold">상금 구조 만들기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-3 px-4 py-4">
      {rows.map((r, idx) => (
        <View key={r.rank} className="flex-row items-center gap-3">
          <Text className="w-12 text-sm text-content-primary dark:text-off-white">{r.rank}위</Text>
          <TextInput
            value={r.amount}
            onChangeText={(v) => updateAmount(idx, v)}
            keyboardType="number-pad"
            placeholder="0"
            className="min-h-[44px] flex-1 rounded-md border border-border px-3 text-right text-gold dark:border-border"
          />
        </View>
      ))}
      <Pressable
        onPress={addRow}
        accessibilityRole="button"
        className="min-h-[44px] justify-center"
      >
        <Text className="text-sm text-secondary-500 dark:text-secondary-400">+ 순위 추가</Text>
      </Pressable>
      <View className="h-px bg-border-subtle" />
      <Text className="text-sm text-secondary-500 dark:text-secondary-400">
        합계 <Text className="text-gold">{fmt(total)}</Text>
      </Text>
      <Pressable
        onPress={save}
        disabled={setMut.isPending}
        accessibilityRole="button"
        className="mt-1 min-h-[44px] items-center justify-center rounded-md bg-gold dark:bg-gold"
      >
        {setMut.isPending ? (
          <ActivityIndicator color="#1A1A1A" />
        ) : (
          <Text className="font-sans-semibold text-on-gold">상금 구조 저장</Text>
        )}
      </Pressable>
    </View>
  );
}
```

⚠️ 색 토큰(`bg-gold`/`text-on-gold`/`text-gold`/`border-border`/`bg-border-subtle`)은 DESIGN.md/tailwind.config 실재 토큰명 확인 후 일치(없으면 인접 ops 컴포넌트의 토큰 복제).

- [ ] **Step 2: components 배럴** (`src/components/ops/index.ts`): `export { PayoutsTab } from './PayoutsTab';` 추가.

- [ ] **Step 3: [id].tsx — 훅 import·초기화·tab union·세그먼트·라벨·renderItem·PAYOUTS 렌더**

(a) import 블록(17-26줄)에 `useBustParticipant, useReenterParticipant` 추가, `@/components/ops` import에 `PayoutsTab` 추가.
(b) 초기화(38-42줄 인근): `const bustMut = useBustParticipant(tournamentId); const reenterMut = useReenterParticipant(tournamentId);`
(c) tab union(44줄): `'players' | 'status' | 'tables' | 'levels' | 'history' | 'payouts'`.
(d) 세그먼트 배열(106줄): `(['players', 'status', 'tables', 'levels', 'history', 'payouts'] as const)`.
(e) 라벨 삼항(117-120줄~): 한글 축약으로 교체 —

```tsx
{
  t === 'players'
    ? `참가 ${participants.length}`
    : t === 'status'
      ? '현황'
      : t === 'tables'
        ? '테이블'
        : t === 'levels'
          ? '블라인드'
          : t === 'history'
            ? '이력'
            : '상금';
}
```

(f) renderItem(220-249줄 액션 영역) — `item.status === 'active'` 블록의 리바이/애드온 뒤에 **[탈락]** 추가, 그리고 `item.status === 'busted'` 분기에 **배지+순위+[재진입]** 추가:

```tsx
{
  item.status === 'active' && (
    <>
      {/* 기존 리바이/애드온 Pressable 2개 유지 */}
      <Pressable
        onPress={() =>
          Alert.alert('탈락 처리', `${item.name} 님을 탈락 처리할까요?`, [
            { text: '취소', style: 'cancel' },
            {
              text: '탈락 처리',
              style: 'destructive',
              onPress: () =>
                bustMut.mutate(item.id, {
                  onSuccess: (r) => {
                    if (r.winnerFinalized && r.winner) {
                      Alert.alert(
                        '우승 확정',
                        `1위 · 상금 ${r.winner.prizeAmount != null ? fmt(r.winner.prizeAmount) : '미설정'}`
                      );
                    } else {
                      Alert.alert(
                        r.prizeAmount != null ? 'ITM 종료' : '탈락 처리 완료',
                        `${r.finishPosition}위${r.prizeAmount != null ? ` · 상금 ${fmt(r.prizeAmount)}` : ''}`
                      );
                    }
                  },
                }),
            },
          ])
        }
        accessibilityRole="button"
        className="rounded-md border border-error px-2 py-1.5 active:opacity-70"
      >
        <Text className="text-xs text-error">탈락</Text>
      </Pressable>
    </>
  );
}
{
  item.status === 'busted' && (
    <Pressable
      onPress={() => reenterMut.mutate(item.id)}
      accessibilityRole="button"
      className="rounded-md bg-gold px-2 py-1.5 active:opacity-70 dark:bg-gold"
    >
      <Text className="text-xs text-on-gold">재진입</Text>
    </Pressable>
  );
}
```

그리고 칩 라인(214-218줄) 아래에 탈락 배지/순위 표시(`item.status === 'busted'`일 때):

```tsx
{
  item.status === 'busted' && (
    <Text className="text-xs text-secondary-500 dark:text-secondary-400">
      탈락 · {item.finishPosition ?? '-'}위
      {item.prizeAmount != null ? ` · 상금 ${fmt(item.prizeAmount)}` : ''}
    </Text>
  );
}
```

(g) 탭 렌더 캐스케이드 끝(`history` 탭 분기 다음)에 PAYOUTS 분기 추가:

```tsx
) : tab === 'payouts' ? (
  <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
    <PayoutsTab tournamentId={tournamentId} />
  </ScrollView>
) : (
```

(h) 상단 import에 `Alert` 추가(`react-native`).

⚠️ `text-error`/`border-error`/`text-on-gold` 토큰 실재 확인. `Alert`는 RN. `fmt`는 파일 상단 기존 정의(29줄).

- [ ] **Step 4: 타입체크 + commit**

Run: `npx tsc --noEmit` → 0 errors. `npx jest` (기존 깨짐 없음).

```bash
git add app/\(ops\)/tournaments/\[id\].tsx src/components/ops/
git commit -m "feat(ops): 1d PLAYERS 탭 bust/재진입 + PAYOUTS 탭 + 한글 라벨"
```

---

## Task 13: 플레이어뷰 비-ITM 순위 노출

**Files:** Modify: `app/(public)/live/[view_token].tsx` (117-120줄 인근)

- [ ] **Step 1: 순위 표시를 prize 밖으로 분리**

현재(117-120줄): 순위가 `me.prizeAmount !== null` 안에 중첩. 이를 분리 — `me.status === 'busted'`이면 순위 항상 표시, ITM이면 상금 추가:

```tsx
{
  me.status === 'busted' && me.finishPosition !== null && (
    <View /* 기존 탈락 배너 컨테이너 클래스 유지 */>
      <Text /* 기존 클래스 */>
        탈락 · {me.finishPosition}위
        {me.prizeAmount !== null ? ` · 상금 ${fmt(me.prizeAmount)}` : ''}
      </Text>
    </View>
  );
}
```

⚠️ 실제 117-122줄의 기존 JSX 구조(컨테이너 className·`fmt` 정의)를 보존하며 조건만 `prizeAmount!==null` → `status==='busted' && finishPosition!==null`로 바꾸고 상금은 인라인 삼항으로. 기존 재입장 배지(110-114줄)는 유지.

- [ ] **Step 2: 타입체크 + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add app/\(public\)/live/\[view_token\].tsx
git commit -m "feat(ops): 1d 플레이어뷰 비-ITM 탈락도 순위 노출"
```

---

## Task 14: 전체 검증 게이트

**Files:** 없음(검증만).

- [ ] **Step 1: pgTAP 전체**

Run: `cd uniqn-mobile && npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: 신규 3 테스트 포함 전부 ok, 0 fail.

- [ ] **Step 2: jest 전체**

Run: `npx jest 2>&1 | tail -20`
Expected: 기존 4524 + 신규(opsRpcError/opsPrize.schema) 전부 pass, 0 fail.

- [ ] **Step 3: 타입 + 품질**

Run: `npx tsc --noEmit && npm run quality`
Expected: 0 errors, lint/format 0.

- [ ] **Step 4: 회귀 RED-GREEN 확인(이중 busted·재진입 충돌)**

bust 테스트의 ⑨(재진입 후 재탈락 23505 없음)에서 RPC의 finish_position 산정을 일시적으로 `v_finish := v_active`로 바꿔 재실행 → **FAIL(23505)** 확인 후 원복 → PASS. (재진입 충돌 회귀가 실제로 잡히는지 Red-Green 증명.)

- [ ] **Step 5: 최종 커밋(있으면)** — 검증만이면 생략.

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지**: §2 테이블→T1, §2.3 enum→T1, §3.1 bust→T3/T5, §3.2 reenter→T3/T6, §3.3 prize→T3/T7, §4 grants→T4, §5 에러→T8, §6.1 데이터레이어→T10/T11, §6.2 prize레이어→T9~T11, §6.3 PLAYERS→T12, §6.4 PAYOUTS→T12, §6.5 플레이어뷰→T13, §8 테스트→T5~T7+T9, §11 검증→T14. 갭 없음.
- **타입 일관성**: `OpsBustResult.finishPosition`(T9 정의)→Repository 매핑(T10)→훅 onSuccess `result.winnerFinalized`(T11)→UI(T12) 일치. `queryKeys.ops.prizes`(T9)→훅(T11) 일치. 시그니처 `bustParticipant(participantId, actorId)` 전 레이어 동일.
- **미해결 토큰 주의(SDD 구현자 확인 필수)**: NativeWind 색 토큰(`bg-gold`/`text-on-gold`/`text-error`/`border-error`/`bg-border-subtle`/`text-gold`)·`auto_seat_on_register` 컬럼 DEFAULT·`useOpsMutations.ts` 상단 import 경로(`toast`/`extractUserMessage`/`requireActor`/`useAuthStore`/`toError`)·플레이어뷰 기존 JSX 구조 — 각 Task에 ⚠️로 명시, 구현 시 실파일 확인.
