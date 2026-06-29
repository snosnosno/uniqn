# ops claim 토큰 읽기/쓰기 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이어뷰 `claim_token`(읽기+쓰기 겸용)을 `view_token`(읽기 anon)과 8자 PIN(쓰기 비밀, bcrypt)으로 분리해, 읽기 URL 유출→계정 하이재킹을 차단한다.

**Architecture:** Presentation→Hooks→Service→Repository→Supabase. DB는 SECDEF RPC + SELECT-only RLS. claim 비밀은 bcrypt 해시로만 저장, 평문 PIN은 발급 시 1회만 반환. 잠금 없음(강한 PIN으로 무차별대입 비현실).

**Tech Stack:** Supabase/Postgres(pgcrypto), pgTAP, Expo Router, React Query, TypeScript strict, NativeWind.

**근거 스펙:** `docs/superpowers/specs/2026-06-28-ops-claim-token-separation-design.md` (적대검증 6렌즈 반영 v2). 충돌 시 스펙 우선.

## Global Constraints

- 언어: 모든 주석·커밋·문서 **한글**. 코드 식별자/라이브러리명만 원문.
- 로깅 `logger.*`(앱), `console.*`는 functions/\*\* 만. 경로 `@/` 절대.
- 마이그레이션 = MCP `apply_migration`은 prod 게이트("go") 후. 로컬은 파일 작성 + `npm run db:reset`.
- 로컬 DB 검증 = `npm run db:reset && npm run test:db:helpers && npx supabase test db` (reset이 ops_helpers를 지우므로 매번 helpers 재적재).
- TS 검증 = `npx tsc --noEmit` · `npx jest <path>` · `npm run quality`(type+lint+format).
- 신규 anon-executable SECDEF 화이트리스트 = `ops_get_monitor_snapshot`·`ops_get_player_view` **2개만**(claim/issue/unclaim은 authed).
- PIN 알파벳(Crockford base32, I/L/O/U 제외): `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (32자). 검증 정규식: `^[0-9A-HJKMNP-TV-Z]{8}$`.
- 커밋: `<type>(<scope>): <한글>`. 각 태스크 끝 커밋.

---

## File Structure

| 파일                                                                                      | 책임                                  | 태스크 |
| ----------------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| `supabase/migrations/20260628120000_ops_claim_split_schema.sql`                           | 컬럼 rename + claim_pin_hash          | T1     |
| `supabase/migrations/20260628120100_ops_claim_split_rpcs.sql`                             | DROP 구 3종 + CREATE 신 RPC           | T2     |
| `supabase/migrations/20260628120200_ops_claim_split_grants.sql`                           | REVOKE/GRANT                          | T3     |
| `supabase/tests/ops_player_view_security.test.sql`                                        | pgTAP 보안 회귀(하이재킹·NULL·오라클) | T4     |
| `supabase/tests/ops_monitor_snapshot.test.sql`                                            | 컬럼명 단언 갱신                      | T4     |
| `src/errors/AppError.ts`                                                                  | 에러코드 rename+신규                  | T5     |
| `src/repositories/supabase/opsRpcError.ts` (+`__tests__/opsRpcError.test.ts`)             | PREFIX_MAP                            | T5     |
| `src/types/ops.ts`                                                                        | OpsParticipant.viewToken + claim 타입 | T6     |
| `src/repositories/interfaces/IOpsPlayerRepository.ts` · `supabase/OpsPlayerRepository.ts` | RPC 시그니처                          | T6     |
| `src/services/ops/opsPlayerService.ts` (+`index.ts`)                                      | 서비스 위임                           | T6     |
| `src/repositories/supabase/OpsParticipantRepository.ts`                                   | COLUMNS +view_token(D8)               | T6     |
| `src/hooks/ops/useOpsClaimToken.ts` · `usePlayerView.ts` (+`index.ts`)                    | 훅                                    | T7     |
| `src/lib/queryClient.ts`                                                                  | player 쿼리키 코멘트                  | T7     |
| `app/(public)/live/[claim_token].tsx` → `[view_token].tsx`                                | 플레이어뷰 + PIN 입력                 | T8     |
| `src/components/ops/PlayerClaimButton.tsx` · `app/(ops)/tournaments/[id].tsx`             | 운영자 발급/재공유                    | T9     |
| `src/types/supabase.ts`                                                                   | MCP gen 정합(prod 후)                 | T10    |

---

## Task 1: DB 스키마 마이그레이션 (rename + claim_pin_hash)

**Files:**

- Create: `supabase/migrations/20260628120000_ops_claim_split_schema.sql`

**Interfaces:**

- Produces: `ops_participants.view_token`(구 claim_token, UNIQUE 유지), `ops_participants.claim_pin_hash text`(null 허용).

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 라이브 운영(ops) claim 토큰 분리 — 스키마: claim_token→view_token rename + claim_pin_hash.
-- 읽기 능력(view_token, anon)과 쓰기 비밀(claim_pin_hash, bcrypt) 분리. prod 0행 → 데이터 마이그 불요.
ALTER TABLE public.ops_participants RENAME COLUMN claim_token TO view_token;
-- UNIQUE 제약/인덱스(ops_participants_claim_token_key)는 rename 자동 추종.

ALTER TABLE public.ops_participants
  ADD COLUMN IF NOT EXISTS claim_pin_hash text;

COMMENT ON COLUMN public.ops_participants.view_token IS '읽기 능력(anon player_view 키). 공유·유출 허용(읽기만). 운영자 read 가능(D8).';
COMMENT ON COLUMN public.ops_participants.claim_pin_hash IS 'claim 비밀의 bcrypt 해시. null=미발급. anon/공개 경로 절대 미반환.';
```

- [ ] **Step 2: 로컬 적용 + 컬럼 확인**

Run: `npm run db:reset 2>&1 | tail -5`
Expected: 마이그레이션 에러 없이 reset 완료(이후 컬럼 존재 확인은 T4 pgTAP에서).

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260628120000_ops_claim_split_schema.sql
git commit -m "feat(ops): claim 토큰 분리 스키마 — view_token rename + claim_pin_hash"
```

---

## Task 2: RPC 마이그레이션 (구 3종 DROP + 신 RPC CREATE)

**Files:**

- Create: `supabase/migrations/20260628120100_ops_claim_split_rpcs.sql`

**Interfaces:**

- Consumes: T1의 `view_token`/`claim_pin_hash`. 기존 헬퍼 `public.is_ops_member(uuid,uuid)`·`public.is_admin()`.
- Produces:
  - `ops_get_player_view(p_view_token text) RETURNS jsonb` (anon, 키 view_token)
  - `ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb` → `{participantId, viewToken, claimPin}`
  - `ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid) RETURNS jsonb` → `{participantId, claimed, noop?}`
- 구 `ops_get_player_view(text)`·`ops_issue_claim_token(uuid,uuid)`·`ops_claim_participant(text,uuid)` 제거.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 라이브 운영(ops) claim 토큰 분리 — RPC.
-- 보안 핵심: 읽기(view_token)와 claim(8자 PIN) 분리. 구 2-인자 claim·issue_claim_token DROP(오버로딩 우회 차단).
-- player_view 는 파라미터명 변경(claim_token→view_token) 위해 DROP 후 CREATE(42P13 회피).

-- ── 1) 구 함수 명시 DROP (오버로딩 잔존 = 우회구멍) ──
DROP FUNCTION IF EXISTS public.ops_get_player_view(text);
DROP FUNCTION IF EXISTS public.ops_issue_claim_token(uuid, uuid);
DROP FUNCTION IF EXISTS public.ops_claim_participant(text, uuid);

-- ── 2) ops_get_player_view(p_view_token) — anon 공개 읽기(본인 안전필드만) ──
CREATE FUNCTION public.ops_get_player_view(p_view_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record; v_seat record; v_t record; v_clock record; v_cur record; v_stats record;
BEGIN
  IF p_view_token IS NULL OR char_length(p_view_token) < 32 THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 본인 1행. 안전필드만 — view_token/claim_pin_hash/phone/nationality/note/player_user_id 미선택.
  SELECT id, tournament_id, entry_number, name, status, chips,
         finish_position, prize_amount, rebuys, add_ons, reentries
    INTO v_p
    FROM public.ops_participants
    WHERE view_token = p_view_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.table_no, s.seat_no
    INTO v_seat
    FROM public.ops_seats s
    JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.participant_id = v_p.id;

  SELECT name, venue, game_type, status
    INTO v_t FROM public.ops_tournaments WHERE id = v_p.tournament_id;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_p.tournament_id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_p.tournament_id AND sort = v_clock.current_level_sort;

  SELECT playing, entries, average_stack, avg_stack_bb
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_p.tournament_id;

  RETURN jsonb_build_object(
    'me', jsonb_build_object(
      'entryNumber', v_p.entry_number, 'name', v_p.name, 'status', v_p.status::text,
      'chips', v_p.chips, 'finishPosition', v_p.finish_position, 'prizeAmount', v_p.prize_amount,
      'rebuys', v_p.rebuys, 'addOns', v_p.add_ons, 'reentries', v_p.reentries,
      'tableNo', v_seat.table_no, 'seatNo', v_seat.seat_no),
    'tournament', jsonb_build_object(
      'name', v_t.name, 'venue', v_t.venue, 'gameType', v_t.game_type, 'status', v_t.status::text),
    'clock', jsonb_build_object(
      'currentLevelSort', v_clock.current_level_sort, 'levelStartedAt', v_clock.level_started_at,
      'isRunning', COALESCE(v_clock.is_running, false), 'pausedRemainingSec', v_clock.paused_remaining_sec),
    'currentLevel', CASE WHEN v_cur IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_cur.level, 'smallBlind', v_cur.small_blind, 'bigBlind', v_cur.big_blind,
      'ante', v_cur.ante, 'durationSec', v_cur.duration_sec, 'isBreak', v_cur.is_break) END,
    'stats', jsonb_build_object(
      'playing', COALESCE(v_stats.playing, 0), 'entries', COALESCE(v_stats.entries, 0),
      'averageStack', COALESCE(v_stats.average_stack, 0), 'avgStackBb', COALESCE(v_stats.avg_stack_bb, 0)),
    'serverNow', now()
  );
END;
$function$;

-- ── 3) ops_issue_player_credentials — 운영자 발급(view_token 멱등 + PIN 로테이트) ──
CREATE FUNCTION public.ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tid uuid; v_token text; v_rand bytea; v_pin text;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id, view_token INTO v_tid, v_token
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- view_token 멱등(안정 URL/QR). 미발급 시에만 생성.
  IF v_token IS NULL THEN
    v_token := encode(gen_random_bytes(24), 'hex');
  END IF;

  -- 새 PIN 로테이트(균일 8자 base32 — 256=8*32 모듈로 편향 0).
  v_rand := gen_random_bytes(8);
  v_pin := (SELECT string_agg(
              substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + (get_byte(v_rand, g) % 32), 1),
              '' ORDER BY g)
            FROM generate_series(0, 7) AS g);

  UPDATE public.ops_participants
    SET view_token = v_token,
        claim_pin_hash = crypt(v_pin, gen_salt('bf'))
    WHERE id = p_participant_id;

  RETURN jsonb_build_object('participantId', p_participant_id, 'viewToken', v_token, 'claimPin', v_pin);
END;
$function$;

-- ── 4) ops_claim_participant(view_token, pin, user_id) — 플레이어 본인 바인딩(PIN 게이트) ──
CREATE FUNCTION public.ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 등록할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;
  -- fail-closed: NULL 명시 가드(NULL ~ regex = NULL 우회 차단).
  IF p_view_token IS NULL OR char_length(p_view_token) < 32 THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;
  IF p_claim_pin IS NULL OR upper(p_claim_pin) !~ '^[0-9A-HJKMNP-TV-Z]{8}$' THEN
    RAISE EXCEPTION 'OPS_CLAIM_PIN_INVALID: 연결 PIN 형식이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, player_user_id, claim_pin_hash INTO v_p
    FROM public.ops_participants WHERE view_token = p_view_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- NULL-안전 PIN 검증 + 오라클 회피(미발급=오답과 동일 코드).
  IF v_p.claim_pin_hash IS NULL
     OR crypt(upper(p_claim_pin), v_p.claim_pin_hash) IS DISTINCT FROM v_p.claim_pin_hash THEN
    RAISE EXCEPTION 'OPS_CLAIM_PIN_INVALID: 연결 PIN이 올바르지 않습니다' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.player_user_id IS NOT NULL THEN
    IF v_p.player_user_id = p_user_id THEN
      RETURN jsonb_build_object('participantId', v_p.id, 'claimed', true, 'noop', true);
    END IF;
    RAISE EXCEPTION 'OPS_CLAIM_ALREADY_CLAIMED: 이미 다른 계정에 연결된 참가자입니다' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_participants SET player_user_id = p_user_id WHERE id = v_p.id;
  RETURN jsonb_build_object('participantId', v_p.id, 'claimed', true);
END;
$function$;
```

> 참고: `ops_unclaim_participant(uuid,uuid)`는 토큰/PIN을 참조하지 않으므로 **변경 없음**(별도 마이그 불필요, grants 유지).

- [ ] **Step 2: 로컬 적용**

Run: `npm run db:reset 2>&1 | tail -5`
Expected: 에러 없이 완료(DROP+CREATE 성공 = 42P13 회피 확인).

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260628120100_ops_claim_split_rpcs.sql
git commit -m "feat(ops): claim 토큰 분리 RPC — view_token 읽기 + 8자 PIN claim 게이트"
```

---

## Task 3: Grants 마이그레이션

**Files:**

- Create: `supabase/migrations/20260628120200_ops_claim_split_grants.sql`

- [ ] **Step 1: 파일 작성**

```sql
-- 라이브 운영(ops) claim 토큰 분리 — 권한.
-- player_view = anon(공개 읽기, §B8 화이트리스트). issue/claim = authed(auth.uid 바인딩).
-- 구 함수는 T2에서 DROP되어 권한 자동 소멸.

REVOKE EXECUTE ON FUNCTION public.ops_get_player_view(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ops_get_player_view(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ops_issue_player_credentials(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ops_issue_player_credentials(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ops_claim_participant(text, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ops_claim_participant(text, text, uuid) TO authenticated, service_role;
```

- [ ] **Step 2: 로컬 적용**

Run: `npm run db:reset 2>&1 | tail -5`
Expected: 에러 없이 완료.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260628120200_ops_claim_split_grants.sql
git commit -m "feat(ops): claim 토큰 분리 권한 — player_view anon, issue/claim authed"
```

---

## Task 4: pgTAP 보안 테스트 (하이재킹 차단·NULL fail-closed·오라클)

**Files:**

- Modify(전면 개정): `supabase/tests/ops_player_view_security.test.sql`
- Modify: `supabase/tests/ops_monitor_snapshot.test.sql` (claim_token→view_token 단언)

**Interfaces:**

- Consumes: T2 RPC, fixture `ops_test_seed()`·`ops_test_set_user(uuid)`.

- [ ] **Step 1: ops_player_view_security.test.sql 전면 작성**

```sql
-- ops claim 토큰 분리: 하이재킹 차단(view_token 단독 claim 불가) + NULL fail-closed + 오라클 회피 + PII 차단.
BEGIN;
SELECT plan(31);

-- ── 설정: 참가자 A(PII 부여) + 참가자 B(cross-token) ──
DO $$
DECLARE s RECORD; v_b uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',       s.owner_id::text,       true);
  PERFORM set_config('ops.member_id',      s.member_id::text,      true);
  PERFORM set_config('ops.outsider_id',    s.outsider_id::text,    true);
  PERFORM set_config('ops.tournament_id',  s.tournament_id::text,  true);
  PERFORM set_config('ops.participant_id', s.participant_id::text, true);
  UPDATE public.ops_participants SET phone='010-1111-1111', nationality='KR', note='PII_NOTE_SECRET'
    WHERE id = s.participant_id;
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips, phone, nationality)
    VALUES (v_b, s.tournament_id, 2, 'Player B', 'active', 50000, '010-2222-2222', 'US');
  PERFORM set_config('ops.pb_id', v_b::text, true);
END $$;

-- ── (1~7) 권한 격리 ──
SELECT ok(has_function_privilege('anon','public.ops_get_player_view(text)','EXECUTE'),
  'anon CAN player_view (공개)');
SELECT ok(NOT has_function_privilege('anon','public.ops_issue_player_credentials(uuid,uuid)','EXECUTE'),
  'anon CANNOT issue_player_credentials');
SELECT ok(NOT has_function_privilege('anon','public.ops_claim_participant(text,text,uuid)','EXECUTE'),
  'anon CANNOT claim_participant');
SELECT ok(has_function_privilege('authenticated','public.ops_get_player_view(text)','EXECUTE'),
  'authenticated CAN player_view');
SELECT ok(has_function_privilege('authenticated','public.ops_issue_player_credentials(uuid,uuid)','EXECUTE'),
  'authenticated CAN issue');
SELECT ok(has_function_privilege('authenticated','public.ops_claim_participant(text,text,uuid)','EXECUTE'),
  'authenticated CAN claim');
-- 구 시그니처 제거 확인(오버로딩 우회 차단)
SELECT ok(to_regprocedure('public.ops_claim_participant(text,uuid)') IS NULL,
  '구 2-인자 claim 시그니처 제거됨');

-- ── (8~10) issue (운영자) — view_token + PIN 발급/로테이트 ──
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.ops_issue_player_credentials((current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
  PERFORM set_config('ops.viewA', r->>'viewToken', true);
  PERFORM set_config('ops.pinA',  r->>'claimPin',  true);
  r := public.ops_issue_player_credentials((current_setting('ops.pb_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
  PERFORM set_config('ops.viewB', r->>'viewToken', true);
  PERFORM set_config('ops.pinB',  r->>'claimPin',  true);
END $$;
SELECT is(char_length(current_setting('ops.viewA')), 48, 'viewToken = 48자 hex');
SELECT matches(current_setting('ops.pinA'), '^[0-9A-HJKMNP-TV-Z]{8}$', 'claimPin = 8자 base32');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_issue_player_credentials((current_setting('ops.participant_id'))::uuid, (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'issue: 비멤버 거부');

-- ── (11~19) player_view (anon) — 본인 + cross-token + PII/token 차단 ──
SELECT set_config('role','anon', true);
SELECT is((public.ops_get_player_view(current_setting('ops.viewA')) -> 'me' ->> 'name'), 'Seed Player',
  'player_view(viewA): 본인 이름');
SELECT is((public.ops_get_player_view(current_setting('ops.viewB')) -> 'me' ->> 'name'), 'Player B',
  'player_view(viewB): 본인 이름');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%Player B%',
  'cross-token: viewA에 타참가자 이름 없음');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%010-1111-1111%',
  'PII 차단: 본인 phone 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%nationality%',
  'PII 차단: nationality 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%' || current_setting('ops.viewA') || '%',
  'token 차단: view_token 에코 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%claim_pin%'
       AND public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%' || current_setting('ops.pinA') || '%',
  'token 차단: claim_pin/PIN 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%playerUserId%'
       AND public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%PII_NOTE_SECRET%',
  'PII 차단: player_user_id/note 미반환');
SELECT throws_ok($$ SELECT public.ops_get_player_view(NULL) $$, 'P0001', NULL, 'player_view: NULL 거부');

-- ── (20~24) claim 하이재킹 차단 + NULL fail-closed (핵심 회귀) ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
-- view_token만 보유 + 오답 PIN → 거부, 바인딩 안됨
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewA'), '00000000', (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'claim: 오답 PIN 거부(하이재킹 차단)');
-- NULL PIN fail-closed
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewA'), NULL, (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'claim: NULL PIN 거부(fail-closed)');
-- 빈문자/공백/7자
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewA'), '       ', (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'claim: 공백 PIN 거부');
-- 위 시도들 후에도 player_user_id NULL 유지(바인딩 안됨)
SELECT set_config('role','postgres', true);
SELECT is((SELECT player_user_id FROM public.ops_participants WHERE id=(current_setting('ops.participant_id'))::uuid),
  NULL, '오답/NULL claim 후 바인딩 안됨(player_user_id NULL)');
-- 오라클 회피: 미발급(pin_hash NULL) 참가자 B는 issue됨 → 미발급 케이스 별도 생성
DO $$
DECLARE v_c uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips, view_token)
    VALUES (v_c, (current_setting('ops.tournament_id'))::uuid, 3, 'Player C', 'active', 1000,
            encode(gen_random_bytes(24),'hex'));  -- view_token 있으나 claim_pin_hash NULL
  PERFORM set_config('ops.viewC', (SELECT view_token FROM public.ops_participants WHERE id=v_c), true);
END $$;
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewC'), '00000000', (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'claim: 미발급(pin_hash NULL)도 PIN_INVALID(오라클 회피)');

-- ── (25~29) 정상 claim + 멱등 + already_claimed + auth.uid ──
SELECT is(
  (public.ops_claim_participant(current_setting('ops.viewA'), current_setting('ops.pinA'), (current_setting('ops.outsider_id'))::uuid) ->> 'claimed'),
  'true', 'claim: 올바른 PIN으로 바인딩 성공');
SELECT set_config('role','postgres', true);
SELECT is((SELECT player_user_id FROM public.ops_participants WHERE id=(current_setting('ops.participant_id'))::uuid),
  (current_setting('ops.outsider_id'))::uuid, 'claim: player_user_id 바인딩 영속');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT is(
  (public.ops_claim_participant(current_setting('ops.viewA'), current_setting('ops.pinA'), (current_setting('ops.outsider_id'))::uuid) ->> 'noop'),
  'true', 'claim: 본인 재호출 멱등(noop)');
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewA'), current_setting('ops.pinA'), (current_setting('ops.member_id'))::uuid) $$,
  '%OPS_CLAIM_ALREADY_CLAIMED%', 'claim: 타계정 바인딩된 참가자 재클레임 거부');
SELECT throws_ok(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewB'), current_setting('ops.pinB'), (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'claim: auth.uid≠user_id 거부');

-- ── (30~31) 재발급(rotate) — 구 PIN 무효 + unclaim 후 재클레임 ──
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.ops_issue_player_credentials((current_setting('ops.pb_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
  PERFORM set_config('ops.pinB2', r->>'claimPin', true);
END $$;
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewB'), current_setting('ops.pinB'), (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'rotate: 재발급 후 구 PIN 무효');
SELECT is(
  (public.ops_claim_participant(current_setting('ops.viewB'), current_setting('ops.pinB2'), (current_setting('ops.outsider_id'))::uuid) ->> 'claimed'),
  'true', 'rotate: 새 PIN으로 claim 성공');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: monitor 테스트 컬럼명 단언 갱신**

`supabase/tests/ops_monitor_snapshot.test.sql`에서 `claim_token` 문자열 참조를 찾아 `view_token`으로 갱신(있으면). 또한 claim_pin 부재 단언이 있으면 유지.

Run: `grep -n "claim_token\|claim_pin" supabase/tests/ops_monitor_snapshot.test.sql`
대상 라인을 `view_token`/`claim_pin_hash`로 교체(단언 의미 보존).

- [ ] **Step 3: 전체 DB 하니스 실행 (GREEN)**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db 2>&1 | tail -20`
Expected: 전 파일 PASS(ops_player_view_security 31 PASS 포함), 회귀 0.

- [ ] **Step 4: RED-GREEN 검증 (NULL 가드)**

T2의 claim RPC step3에서 `p_claim_pin IS NULL OR ` 부분을 임시 제거 → `npx supabase test db`로 'NULL PIN 거부' 단언 **FAIL 확인** → 되돌리고 재실행 **PASS 확인**(가드가 실제로 동작 검증).

- [ ] **Step 5: 커밋**

```bash
git add supabase/tests/ops_player_view_security.test.sql supabase/tests/ops_monitor_snapshot.test.sql
git commit -m "test(ops): claim 토큰 분리 pgTAP — 하이재킹 차단·NULL fail-closed·오라클 회피"
```

---

## Task 5: 에러코드 (AppError + opsRpcError)

**Files:**

- Modify: `src/errors/AppError.ts` (E6120 rename, E6122 추가)
- Modify: `src/repositories/supabase/opsRpcError.ts`
- Test: `src/repositories/supabase/__tests__/opsRpcError.test.ts`

**Interfaces:**

- Produces: `ERROR_CODES.OPS_VIEW_TOKEN_INVALID`('E6120'), `ERROR_CODES.OPS_CLAIM_PIN_INVALID`('E6122'). `OPS_CLAIM_ALREADY_CLAIMED` 유지.

- [ ] **Step 1: AppError.ts — 코드 rename + 신규**

`src/errors/AppError.ts` 라인 196 교체:

```typescript
  OPS_VIEW_TOKEN_INVALID: 'E6120', // 플레이어뷰 읽기 토큰 무효(구 OPS_CLAIM_TOKEN_INVALID rename)
  OPS_CLAIM_ALREADY_CLAIMED: 'E6121', // 이미 다른 계정에 연결된 참가자 재클레임
  OPS_CLAIM_PIN_INVALID: 'E6122', // claim PIN 불일치/형식오류/미발급(오라클 회피 통합)
```

라인 228 교체(ERROR_MESSAGES):

```typescript
  [ERROR_CODES.OPS_VIEW_TOKEN_INVALID]: '유효하지 않은 플레이어 링크입니다',
  [ERROR_CODES.OPS_CLAIM_ALREADY_CLAIMED]: '이미 다른 계정에 연결된 참가자입니다',
  [ERROR_CODES.OPS_CLAIM_PIN_INVALID]: '연결 PIN이 올바르지 않습니다',
```

- [ ] **Step 2: opsRpcError.ts — PREFIX_MAP 교체**

라인 49~59(플레이어뷰 블록) 교체:

```typescript
  // 플레이어뷰(claim 분리) — ALREADY_CLAIMED·PIN_INVALID·VIEW_TOKEN_INVALID (상호 부분문자열 아님)
  [
    'OPS_CLAIM_ALREADY_CLAIMED',
    ERROR_CODES.OPS_CLAIM_ALREADY_CLAIMED,
    ERROR_CODES.OPS_CLAIM_ALREADY_CLAIMED,
  ],
  ['OPS_CLAIM_PIN_INVALID', ERROR_CODES.OPS_CLAIM_PIN_INVALID, ERROR_CODES.OPS_CLAIM_PIN_INVALID],
  ['OPS_VIEW_TOKEN_INVALID', ERROR_CODES.OPS_VIEW_TOKEN_INVALID, ERROR_CODES.OPS_VIEW_TOKEN_INVALID],
```

- [ ] **Step 3: opsRpcError.test.ts — 케이스 (실패 테스트 먼저)**

`src/repositories/supabase/__tests__/opsRpcError.test.ts`에 추가(파일 없으면 생성, 기존 패턴 따름):

```typescript
import { mapOpsRpcError } from '../opsRpcError';
import { ERROR_CODES, isAppError } from '@/errors';

const expectCode = (msg: string, code: string) => {
  try {
    mapOpsRpcError({ message: msg }, { operation: 'test' });
  } catch (e) {
    expect(isAppError(e)).toBe(true);
    expect((e as { code: string }).code).toBe(code);
    return;
  }
  throw new Error('mapOpsRpcError가 throw하지 않음');
};

describe('mapOpsRpcError — claim 토큰 분리', () => {
  it('OPS_VIEW_TOKEN_INVALID → E6120', () =>
    expectCode('OPS_VIEW_TOKEN_INVALID: 유효하지 않은', ERROR_CODES.OPS_VIEW_TOKEN_INVALID));
  it('OPS_CLAIM_PIN_INVALID → E6122', () =>
    expectCode('OPS_CLAIM_PIN_INVALID: 연결 PIN', ERROR_CODES.OPS_CLAIM_PIN_INVALID));
  it('OPS_CLAIM_ALREADY_CLAIMED → E6121', () =>
    expectCode('OPS_CLAIM_ALREADY_CLAIMED: 이미', ERROR_CODES.OPS_CLAIM_ALREADY_CLAIMED));
});
```

- [ ] **Step 4: jest 실행**

Run: `npx jest src/repositories/supabase/__tests__/opsRpcError.test.ts 2>&1 | tail -15`
Expected: 신규 3 케이스 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/errors/AppError.ts src/repositories/supabase/opsRpcError.ts src/repositories/supabase/__tests__/opsRpcError.test.ts
git commit -m "feat(ops): claim 분리 에러코드 — VIEW_TOKEN_INVALID rename + CLAIM_PIN_INVALID(E6122)"
```

---

## Task 6: 타입 + Repository + Service

**Files:**

- Modify: `src/types/ops.ts` (OpsParticipant.viewToken + 발급결과 타입)
- Modify: `src/repositories/interfaces/IOpsPlayerRepository.ts`
- Modify: `src/repositories/supabase/OpsPlayerRepository.ts`
- Modify: `src/services/ops/opsPlayerService.ts` (+ `src/services/ops/index.ts` 재노출 확인)
- Modify: `src/repositories/supabase/OpsParticipantRepository.ts` (COLUMNS +view_token, D8)

**Interfaces:**

- Produces:
  - `OpsPlayerCredentials = { participantId: string; viewToken: string; claimPin: string }`
  - `IOpsPlayerRepository.getPlayerView(viewToken)`, `.issuePlayerCredentials(participantId, actorId): Promise<OpsPlayerCredentials>`, `.claimParticipant(viewToken, claimPin, userId): Promise<void>`
  - `OpsParticipant.viewToken: string | null`

- [ ] **Step 1: types/ops.ts**

`OpsParticipant` 인터페이스에 필드 추가(기존 인터페이스 내, claimToken 필드가 있으면 viewToken으로 교체; 없으면 추가):

```typescript
/** 읽기 능력 토큰(운영자 read·D8). 미발급 시 null. */
viewToken: string | null;
```

파일 하단(타입 export 영역)에 추가:

```typescript
/** 운영자 발급 결과(평문 PIN은 1회만 노출 — 슬립용). */
export interface OpsPlayerCredentials {
  participantId: string;
  viewToken: string;
  claimPin: string;
}
```

- [ ] **Step 2: IOpsPlayerRepository.ts 교체**

```typescript
import type { OpsPlayerView, OpsPlayerCredentials } from '@/types/ops';

/**
 * ops 공개 플레이어뷰 Repository (claim 토큰 분리).
 * getPlayerView 는 anon SECDEF RPC(본인 안전필드 투영) — view_token capability.
 * issuePlayerCredentials 는 운영자(view_token+PIN 발급/로테이트), claimParticipant 는 플레이어 본인 1회 바인딩(PIN 게이트).
 */
export interface IOpsPlayerRepository {
  /** 공개 플레이어뷰. 토큰 무효 시 AppError(OPS_VIEW_TOKEN_INVALID). */
  getPlayerView(viewToken: string): Promise<OpsPlayerView>;
  /** view_token(멱등) + 새 PIN(로테이트) 발급(운영자). 평문 PIN 1회 반환. */
  issuePlayerCredentials(participantId: string, actorId: string): Promise<OpsPlayerCredentials>;
  /** 본인 계정 1회 바인딩(플레이어, PIN 게이트). 오답 시 OPS_CLAIM_PIN_INVALID. */
  claimParticipant(viewToken: string, claimPin: string, userId: string): Promise<void>;
}
```

- [ ] **Step 3: OpsPlayerRepository.ts 교체**

```typescript
import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsPlayerRepository } from '../interfaces/IOpsPlayerRepository';
import type { OpsPlayerView, OpsPlayerCredentials } from '@/types/ops';

/**
 * ops 공개 플레이어뷰 Repository (claim 토큰 분리).
 * getPlayerView 만 anon GRANT(본인 안전필드 화이트리스트). issue/claim 은 authed.
 */
export class SupabaseOpsPlayerRepository implements IOpsPlayerRepository {
  async getPlayerView(viewToken: string): Promise<OpsPlayerView> {
    try {
      const { data, error } = await supabase.rpc('ops_get_player_view', {
        p_view_token: viewToken,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 플레이어뷰' });
      return data as unknown as OpsPlayerView;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 플레이어뷰' });
    }
  }

  async issuePlayerCredentials(
    participantId: string,
    actorId: string
  ): Promise<OpsPlayerCredentials> {
    try {
      const { data, error } = await supabase.rpc('ops_issue_player_credentials', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 플레이어 자격 발급' });
      const r = data as unknown as OpsPlayerCredentials | null;
      return {
        participantId: r?.participantId ?? participantId,
        viewToken: r?.viewToken ?? '',
        claimPin: r?.claimPin ?? '',
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 플레이어 자격 발급' });
    }
  }

  async claimParticipant(viewToken: string, claimPin: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_claim_participant', {
        p_view_token: viewToken,
        p_claim_pin: claimPin,
        p_user_id: userId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 참가자 클레임' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 참가자 클레임' });
    }
  }
}
```

- [ ] **Step 4: opsPlayerService.ts 교체**

```typescript
/**
 * ops 플레이어 서비스 (claim 토큰 분리) — 자격 발급(운영자) + 본인 바인딩(플레이어) 위임.
 * 검증할 자유텍스트 없음(식별자/토큰/PIN). PIN 형식은 DB RPC가 강제.
 */
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsPlayerRepository } from '@/repositories/ops';
import type { OpsPlayerCredentials } from '@/types/ops';

const COMPONENT = 'opsPlayerService';

/** view_token(멱등) + PIN(로테이트) 발급(운영자). 평문 PIN 1회 반환. */
export async function issuePlayerCredentials(
  participantId: string,
  actorId: string
): Promise<OpsPlayerCredentials> {
  try {
    return await opsPlayerRepository.issuePlayerCredentials(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '플레이어 자격 발급', component: COMPONENT });
  }
}

/** 본인 계정 1회 바인딩(플레이어, PIN 게이트). */
export async function claimParticipant(
  viewToken: string,
  claimPin: string,
  userId: string
): Promise<void> {
  try {
    await opsPlayerRepository.claimParticipant(viewToken, claimPin, userId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '참가자 클레임', component: COMPONENT });
  }
}
```

- [ ] **Step 5: OpsParticipantRepository.ts — COLUMNS에 view_token 추가 (D8)**

라인 13~17 교체:

```typescript
// view_token 포함 (D8 — 운영자가 라이브 링크 재공유, PIN 재발급 없이). claim_pin_hash 는 절대 미포함.
const COLUMNS =
  'id, tournament_id, entry_number, name, nationality, phone, player_user_id, view_token, status, chips, ' +
  'buy_in_amount, rebuys, add_ons, reentries, finish_position, busted_at, prize_amount, note, ' +
  'created_at, updated_at';
```

- [ ] **Step 6: tsc + 관련 jest**

Run: `npx tsc --noEmit 2>&1 | tail -15`
Expected: 0 에러(서비스 index 재노출 이름 변경 반영 — `src/services/ops/index.ts`에서 `issueClaimToken`→`issuePlayerCredentials` export 갱신 필요 시 함께 수정).
Run: `npx jest src/services/ops src/repositories 2>&1 | tail -15`
Expected: 관련 스위트 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/types/ops.ts src/repositories src/services/ops
git commit -m "feat(ops): claim 분리 데이터레이어 — issuePlayerCredentials/PIN claim + view_token COLUMNS(D8)"
```

---

## Task 7: Hooks

**Files:**

- Modify: `src/hooks/ops/useOpsClaimToken.ts` (+ `src/hooks/ops/index.ts` export)
- Modify: `src/hooks/ops/usePlayerView.ts` (파라미터 의미만 — 토큰 변수명)
- Modify: `src/lib/queryClient.ts` (player 키 코멘트)

**Interfaces:**

- Produces: `useIssuePlayerCredentials(tournamentId)` → mutation<OpsPlayerCredentials, Error, string>(participantId), `useClaimParticipant(viewToken)` → mutation<void, Error, string>(claimPin).

- [ ] **Step 1: useOpsClaimToken.ts 교체**

```typescript
/**
 * ops claim 토큰 분리 훅 — Service 경유.
 * useIssuePlayerCredentials(운영자): view_token + PIN 발급/로테이트 → {viewToken, claimPin}.
 * useClaimParticipant(플레이어): view_token + PIN 으로 본인 계정 1회 바인딩 + 플레이어뷰 무효화.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsPlayerService } from '@/services/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import type { OpsPlayerCredentials } from '@/types/ops';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function requireActor(actorId: string | undefined | null): string {
  if (!actorId) throw new Error('로그인이 필요합니다');
  return actorId;
}

/** 운영자: view_token + PIN 발급/로테이트. mutate(participantId) → {viewToken, claimPin}. 성공 피드백은 호출 컴포넌트. */
export function useIssuePlayerCredentials(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation<OpsPlayerCredentials, Error, string>({
    mutationFn: (participantId: string) =>
      opsPlayerService.issuePlayerCredentials(participantId, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
    },
    onError: (e) => {
      logger.error('ops 플레이어 자격 발급 실패', toError(e));
      useToastStore.getState().error(extractUserMessage(e) || 'PIN 발급에 실패했습니다');
    },
  });
}

/** 플레이어: view_token + PIN 으로 본인 계정 바인딩. mutate(claimPin). */
export function useClaimParticipant(viewToken: string) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.uid);
  return useMutation<void, Error, string>({
    mutationFn: (claimPin: string) =>
      opsPlayerService.claimParticipant(viewToken, claimPin, requireActor(userId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.player(viewToken) });
      useToastStore.getState().success('내 계정에 연결했습니다');
    },
    onError: (e) => {
      logger.error('ops 참가자 클레임 실패', toError(e));
      useToastStore.getState().error(extractUserMessage(e) || '계정 연결에 실패했습니다');
    },
  });
}
```

- [ ] **Step 2: hooks/ops/index.ts — export 이름 갱신**

`useIssueClaimToken` export를 `useIssuePlayerCredentials`로 교체(`useClaimParticipant`는 이름 유지).

Run: `grep -n "useIssueClaimToken\|useClaimParticipant" src/hooks/ops/index.ts`
해당 export 라인을 `useIssuePlayerCredentials`로 수정.

- [ ] **Step 3: usePlayerView.ts — 토큰 변수명/주석**

`usePlayerView(token)`의 내부 의미는 동일(token = view_token). 주석만 "claim_token capability" → "view_token capability(읽기 전용)"로 갱신(라우트가 view_token 전달). 기능 변경 없음.

`src/lib/queryClient.ts` 라인 581~582 코멘트를 `view_token`으로 갱신:

```typescript
    // claim 분리 — 공개 플레이어뷰. view_token 스코프(anon 폴링).
    player: (token: string) => [...queryKeys.ops.all, 'player', token] as const,
```

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit 2>&1 | tail -15`
Expected: 0 에러(T8/T9가 신규 훅 이름을 소비하므로, 이 시점 미사용 export 경고는 무해).

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/ops src/lib/queryClient.ts
git commit -m "feat(ops): claim 분리 훅 — useIssuePlayerCredentials + PIN claim(useClaimParticipant)"
```

---

## Task 8: 플레이어뷰 화면 (라우트 rename + PIN 입력)

**Files:**

- Rename + Modify: `app/(public)/live/[claim_token].tsx` → `app/(public)/live/[view_token].tsx`

**Interfaces:**

- Consumes: `usePlayerView(view_token)`, `useClaimParticipant(view_token).mutate(pin)`.

- [ ] **Step 1: 파일 rename (git mv)**

```bash
git mv "app/(public)/live/[claim_token].tsx" "app/(public)/live/[view_token].tsx"
```

- [ ] **Step 2: 파라미터 + PIN 입력 모달 적용**

`app/(public)/live/[view_token].tsx`에서:

1. 상단 import에 `TextInput` 추가(react-native) + `useState`는 기존 존재.
2. 파라미터 교체:

```typescript
const params = useLocalSearchParams<{ view_token: string }>();
const token = params.view_token;
```

3. claim 훅/상태 교체:

```typescript
const claimMut = useClaimParticipant(token ?? '');
const [claimOpen, setClaimOpen] = useState(false);
const [pin, setPin] = useState('');
```

4. claim 섹션(authed 분기)의 Pressable onPress를 PIN 모달 오픈으로:

```typescript
            onPress={() => !claimMut.isPending && setClaimOpen(true)}
```

5. 하단 ConfirmModal을 PIN 입력 모달로 교체:

```tsx
{
  /* PIN 게이트 — 슬립의 8자 연결 PIN 입력(비가역 바인딩). */
}
{
  claimOpen && (
    <View className="absolute inset-0 items-center justify-center bg-black/50 px-8">
      <View className="w-full gap-3 rounded-xl bg-white p-5 dark:bg-gray-900">
        <Text className="text-lg font-sans-bold text-content-primary dark:text-off-white">
          내 계정에 연결
        </Text>
        <Text className="text-sm text-secondary-500 dark:text-secondary-400">
          슬립에 적힌 8자리 연결 PIN을 입력해주세요. 연결 후에는 직접 해제할 수 없어요(잘못 연결 시
          운영자에게 문의).
        </Text>
        <TextInput
          value={pin}
          onChangeText={(t) =>
            setPin(
              t
                .toUpperCase()
                .replace(/[^0-9A-Z]/g, '')
                .slice(0, 8)
            )
          }
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="예: 7F3K9A2C"
          placeholderTextColor="#9ca3af"
          maxLength={8}
          className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-center text-lg tracking-widest text-content-primary dark:border-gray-600 dark:text-off-white"
        />
        <View className="flex-row justify-end gap-2 pt-1">
          <Pressable
            onPress={() => {
              setClaimOpen(false);
              setPin('');
            }}
            accessibilityRole="button"
            className="min-h-[44px] items-center justify-center rounded-lg px-4"
          >
            <Text className="text-secondary-500 dark:text-secondary-400">취소</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (pin.length !== 8 || claimMut.isPending) return;
              setClaimOpen(false);
              claimMut.mutate(pin, { onSettled: () => setPin('') });
            }}
            disabled={pin.length !== 8 || claimMut.isPending}
            accessibilityRole="button"
            className={`min-h-[44px] items-center justify-center rounded-lg px-4 ${
              pin.length === 8 && !claimMut.isPending
                ? 'bg-primary-600 active:opacity-70'
                : 'bg-primary-600 opacity-40'
            }`}
          >
            <Text className="font-sans-semibold text-white">연결하기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
```

6. 기존 `ConfirmModal` import 제거(미사용 시). `View`는 이미 import됨.

- [ ] **Step 3: tsc + 웹 스모크(선택)**

Run: `npx tsc --noEmit 2>&1 | tail -15`
Expected: 0 에러.

- [ ] **Step 4: 커밋**

```bash
git add "app/(public)/live"
git commit -m "feat(ops): 플레이어뷰 라우트 view_token + claim PIN 입력 모달"
```

---

## Task 9: 운영자 발급/재공유 UI (recovery-3)

**Files:**

- Modify: `src/components/ops/PlayerClaimButton.tsx`
- Modify: `app/(ops)/tournaments/[id].tsx` (PlayerClaimButton에 viewToken prop 전달)

**Interfaces:**

- Consumes: `useIssuePlayerCredentials(tournamentId)`, `getOpsPlayerUrl(viewToken)`, `OpsParticipant.viewToken`.

- [ ] **Step 1: PlayerClaimButton.tsx 교체**

```tsx
/**
 * ops 운영자용 참가자 자격 발급/링크 재공유 (claim 토큰 분리·D8).
 * - viewToken 있으면 "링크 공유"(비파괴, 발급 미호출) + "PIN 재발급"(로테이트, 확인).
 * - viewToken 없으면 "발급"(view_token+PIN 생성). 발급 결과 PIN은 Alert로 1회 표시(슬립용).
 */
import { Pressable, Text, Platform, Share, Alert } from 'react-native';
import { useIssuePlayerCredentials } from '@/hooks/ops';
import { getOpsPlayerUrl } from '@/constants/ops';
import { useToastStore } from '@/stores/toastStore';
import type { OpsPlayerCredentials } from '@/types/ops';

interface PlayerClaimButtonProps {
  tournamentId: string;
  participantId: string;
  viewToken: string | null;
}

async function shareUrl(url: string) {
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        useToastStore.getState().success('플레이어 링크를 복사했습니다');
      } else {
        useToastStore.getState().success(url);
      }
    } catch {
      useToastStore.getState().error('링크 복사에 실패했습니다');
    }
  } else {
    try {
      await Share.share({ message: url });
    } catch {
      /* 사용자 취소 무시 */
    }
  }
}

export function PlayerClaimButton({
  tournamentId,
  participantId,
  viewToken,
}: PlayerClaimButtonProps) {
  const issueMut = useIssuePlayerCredentials(tournamentId);

  const onIssued = (cred: OpsPlayerCredentials) => {
    const url = getOpsPlayerUrl(cred.viewToken);
    // 평문 PIN은 1회만 노출 — 슬립에 인쇄/전달.
    Alert.alert(
      '연결 PIN 발급됨',
      `연결 PIN: ${cred.claimPin}\n\n슬립/QR에 PIN을 함께 적어주세요. 재발급하면 이 PIN은 무효가 됩니다.`,
      [
        { text: '링크 공유', onPress: () => void shareUrl(url) },
        { text: '닫기', style: 'cancel' },
      ]
    );
  };

  const issue = () => {
    if (issueMut.isPending) return;
    issueMut.mutate(participantId, { onSuccess: onIssued });
  };

  const onPressIssue = () => {
    if (!viewToken) return issue(); // 최초 발급
    Alert.alert('PIN 재발급', '재발급하면 이전 PIN은 사용할 수 없어요. 진행할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '재발급', style: 'destructive', onPress: issue },
    ]);
  };

  return (
    <>
      {viewToken ? (
        <Pressable
          onPress={() => void shareUrl(getOpsPlayerUrl(viewToken))}
          accessibilityRole="button"
          accessibilityLabel="플레이어 링크 공유"
          className="min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-2 active:opacity-70 dark:bg-gray-800"
        >
          <Text className="text-xs text-content-primary dark:text-off-white">링크</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPressIssue}
        disabled={issueMut.isPending}
        accessibilityRole="button"
        accessibilityLabel={viewToken ? 'PIN 재발급' : 'PIN 발급'}
        className="min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-2 active:opacity-70 dark:bg-gray-800"
      >
        <Text className="text-xs text-content-primary dark:text-off-white">
          {viewToken ? 'PIN 재발급' : 'PIN 발급'}
        </Text>
      </Pressable>
    </>
  );
}

export default PlayerClaimButton;
```

- [ ] **Step 2: [id].tsx — viewToken prop 전달**

Run: `grep -n "PlayerClaimButton" "app/(ops)/tournaments/[id].tsx"`
해당 렌더를 참가자의 viewToken을 넘기도록 수정:

```tsx
<PlayerClaimButton tournamentId={...} participantId={p.id} viewToken={p.viewToken} />
```

(참가자 객체 변수명이 `p`가 아니면 실제 변수명 사용. `p.viewToken`은 T6의 COLUMNS+타입으로 제공됨.)

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit 2>&1 | tail -15`
Expected: 0 에러.

- [ ] **Step 4: 커밋**

```bash
git add src/components/ops/PlayerClaimButton.tsx "app/(ops)/tournaments/[id].tsx"
git commit -m "feat(ops): 운영자 PIN 발급/링크 재공유 분리 — 재발급 확인게이트(D8)"
```

---

## Task 10: 통합 검증 + 마무리

**Files:** (검증 전용, 신규 변경은 발견 시)

- [ ] **Step 1: 전체 품질 + 테스트**

Run:

```bash
npx tsc --noEmit && echo "TSC OK"
npm run quality 2>&1 | tail -15
npx jest 2>&1 | tail -20
npm run db:reset && npm run test:db:helpers && npx supabase test db 2>&1 | tail -20
```

Expected: tsc 0 · quality 통과(기존 경고 외 신규 0) · jest 전체 PASS(신규 포함) · pgTAP 전 파일 PASS(회귀 0).

- [ ] **Step 2: 잔존 claim_token 참조 점검**

Run: `grep -rn "claim_token\|claimToken\|issueClaimToken\|p_claim_token" src/ app/ --include=*.ts --include=*.tsx`
Expected: 결과 0(전부 view_token/issuePlayerCredentials/p_view_token으로 전환). 남으면 수정.

- [ ] **Step 3: 화이트리스트 자가점검(설계)**

신규 함수 중 anon GRANT는 `ops_get_player_view`만(T3 확인). `ops_issue_player_credentials`/`ops_claim_participant(text,text,uuid)`는 anon REVOKE. (prod 적용 후 `get_advisors`로 재확인 — prod 게이트.)

- [ ] **Step 4: 최종 커밋(있으면)**

```bash
git add -A
git commit -m "chore(ops): claim 토큰 분리 통합 검증 — 잔존 참조 정리"
```

> **prod 게이트(사용자 "go" 후)**: MCP `apply_migration` 3종 → `get_advisors`(anon-executable SECDEF=monitor/player 2개·search_path 0·ERROR 0) → MCP `generate_typescript_types`로 `src/types/supabase.ts` 정합(prettier --write 후 additive 확인) → push + PR → CI → 머지.

---

## Self-Review (작성자 점검)

**Spec coverage:** §3 D1~D8 전부 태스크 매핑(D1·D6 T1~T3, D2·D3 T2, D4 잠금부재=T2 설계, D5 T3, D7 T2/T6, D8 T6/T9). §5 RPC 4종 T2. §6 에러 T5. §7 클라 T6~T9. §8 테스트 T4. §9 마이그 T1~T3. §12 적대검증 4실이슈: ①NULL T2/T4 ②잠금제거 T2 ③DROP T2 ④오라클 T2+운영자read T6/T9. ✅
**Placeholder scan:** 모든 step에 실제 코드/명령. `[id].tsx` 참가자 변수명은 grep으로 실제 확인 지시(미지정 회피). ✅
**Type consistency:** `OpsPlayerCredentials{participantId,viewToken,claimPin}` 일관(T6 정의→T7/T9 소비). `issuePlayerCredentials`/`useClaimParticipant(viewToken).mutate(pin)` 일관. ✅
