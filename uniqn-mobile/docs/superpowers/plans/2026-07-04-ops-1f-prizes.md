# ops 1f 잔여 상금 구현 계획 (% 환산·풀곡선·flat KO·정정/회수·bust 취소·LS DEFERRED)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙 `docs/superpowers/specs/2026-07-03-ops-1f-prizes-design.md`(DESIGN v1, D1~D8 승인)를 SDD 3배치(B1 DB토대 → B2 RPC → B3 클라/UI) 12태스크로 구현한다.

**Architecture:** 서버 = 마이그 4종(enum/knockouts → live_stats DEFERRED → prize RPC 3종+확장 4종 → grants), 전 쓰기 SECDEF RPC actor 바인딩. 클라 = % 환산·풀곡선은 순수함수 도메인(`domains/ops/prizeCurve/`, 서버는 %를 모름), Repository 수동 camel 매핑 → Service Zod 경계 → TanStack 훅 → UI(PAYOUTS 2부·PLAYERS bust v2·종료 결과 뷰·공개 표면 확장).

**Tech Stack:** PostgreSQL(plpgsql SECDEF, CONSTRAINT TRIGGER DEFERRED) · pgTAP · Expo RN + NativeWind · TanStack Query · Zod · Jest

## Global Constraints (모든 태스크에 암묵 적용)

- **작업 디렉토리**: `uniqn-mobile/` (워크트리 `C:\Users\user\Desktop\T-HOLDEM-ops-1f`, 브랜치 `feat/ops-1f-prizes`)
- **한글**: 응답·커밋 메시지·코드 주석·에러 메시지 전부 한글
- **커밋 형식**: `<type>(ops): <한글>` — feat/fix/test/refactor/docs
- **기존 마이그 수정 금지**: prod 적용된 `supabase/migrations/2026*.sql` 기존 파일 불변. **단, 이번 PR에서 새로 만드는 1f 마이그 4종 파일은 태스크에 걸쳐 이어서 작성(append)해도 됨**(아직 prod 미적용). 기존 pgTAP 테스트 파일 수정은 T2가 명시하는 `SET CONSTRAINTS` 삽입·스냅샷 단언 추가만 허용
- **SDD implementer**: 브랜치 생성/전환 금지 · `mcp__supabase__*` 도구 금지(로컬 docker/npm/npx만)
- **RPC 공통 규약**: plpgsql `SECURITY DEFINER` · `SET search_path = 'public', 'extensions', 'pg_temp'` · actor 가드 `auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin())` → `PERMISSION_DENIED` · 멤버십 `is_ops_member OR is_admin` · 비즈니스 RAISE는 `ERRCODE = 'P0001'`, 메시지는 `접두사: 한글` 형식 · 이벤트 컬럼명은 **`type`**(`event_type` 아님 — #220 교훈)
- **락 불변식**: `pg_advisory_xact_lock(hashtext('ops_tournament_'||id)::bigint) → 대회 FOR UPDATE → 참가자 FOR UPDATE(복수면 id 오름차순) → 좌석`
- **에러코드**: 1f = E6132(OPS_ELIMINATOR_INVALID) · E6133(OPS_UNDO_INVALID_STATE) · E6134(OPS_PRIZE_CORRECTION_INVALID). 대회 상태 위반은 기존 `INVALID_STATUS`(E6102) 재사용
- **enum ADD VALUE는 별도 txn 마이그**(마이그 1에서 값만, 마이그 3에서 사용 — 같은 txn이면 55P04)
- **pgTAP**: RED-GREEN 필수·무위 시드 금지(#220 교훈 — 단언이 실제로 실패할 수 있는 시드 구성). `plan(N)` = 실제 단언 수 정확 일치. 파일 위치 `supabase/tests/*.test.sql`, 헬퍼는 `supabase/fixtures/ops_helpers.sql`(`ops_test_seed()`/`ops_test_set_user()`/`ops_test_seed_players()`)
- **DB 검증 명령**(매 DB 태스크): `npm run db:reset && npm run test:db:helpers && npx supabase test db` (reset이 헬퍼를 지우므로 반드시 이 순서)
- **클라 검증 명령**: `npx tsc --noEmit` · `npx jest <대상>` · 최종 `npm run quality`
- **다크모드**: 모든 UI `dark:` 토큰 병기 · 터치 타깃 `min-h-[44px]` · `logger`만(console.log 금지) · `@/` 절대 경로
- **파일 크기**: 200~400줄 권장, 800줄 상한
- **불변성**: 배열/객체 변이 금지(스프레드/신규 생성). 순수함수 도메인에는 RNG/부작용 금지

## 마이그 파일 4종 (신규 — 타임스탬프 고정)

| 파일                                                                | 내용                                                                             | 작성 태스크         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| `supabase/migrations/20260704100000_ops_1f_enum_and_knockouts.sql`  | enum 2값 + knockouts 컬럼/CHECK + bounty_cost CHECK + ops_prizes REVOKE          | T1                  |
| `supabase/migrations/20260704100100_ops_1f_live_stats_deferred.sql` | recompute 확장 + 트리거 5종 DEFERRED 재생성 + tournaments 트리거 신설 + backfill | T2                  |
| `supabase/migrations/20260704100200_ops_1f_prize_rpcs.sql`          | bust v2·undo·correct·create/update 확장·스냅샷 2종 확장                          | T3~T5 (이어서 작성) |
| `supabase/migrations/20260704100300_ops_1f_grants.sql`              | 신규/재생성 RPC REVOKE+GRANT                                                     | T6                  |

## 신규/수정 파일 구조 맵

```
supabase/
  migrations/20260704100000~100300 (신규 4종 — 위 표)
  tests/
    ops_live_stats_deferred.test.sql        (신규 — T2)
    ops_bust_eliminator.test.sql            (신규 — T3)
    ops_undo_bust.test.sql                  (신규 — T4)
    ops_prize_correction.test.sql           (신규 — T5)
    ops_1c_tables_rls.test.sql              (수정 — T2: SET CONSTRAINTS 삽입)
    ops_bust_participant.test.sql           (수정 — T2: 동일)
    ops_clock_rpc_security.test.sql         (수정 — T2: 동일)
    ops_live_stats_recompute.test.sql       (수정 — T2: 동일)
    ops_reseat_participants.test.sql        (수정 — T2: 동일)
    ops_monitor_snapshot.test.sql           (수정 — T5: knockoutPool 단언)
    ops_player_view_security.test.sql       (수정 — T5: knockouts/bountyAccrued 단언)
    ops_rpc_security.test.sql               (수정 — T6: 신규 RPC anon 거부)
src/
  domains/ops/prizeCurve/
    prizeCurve.types.ts / computeAmountsFromPercents.ts / payoutCurves.ts / index.ts   (신규 — T7)
    __tests__/computeAmountsFromPercents.test.ts / payoutCurves.test.ts               (신규 — T7)
  domains/ops/index.ts                      (수정 — T7: 배럴 등록)
  errors/AppError.ts                        (수정 — T8: E6132~E6134 2블록)
  repositories/supabase/opsRpcError.ts      (수정 — T8: PREFIX_MAP 3엔트리)
  repositories/supabase/__tests__/opsRpcError.test.ts (수정 — T8)
  schemas/opsPrize.schema.ts                (수정 — T8: prizeCorrectionSchema 추가)
  types/ops.ts                              (수정 — T9: knockouts·신규 반환 타입·공개 뷰 필드)
  types/supabase.ts                         (수정 — T6: 수술적 추가만 — 전체 재생성 금지)
  repositories/interfaces/IOpsParticipantRepository.ts (수정 — T9)
  repositories/supabase/OpsParticipantRepository.ts    (수정 — T9)
  services/ops/opsParticipantService.ts     (수정 — T9)
  hooks/ops/useOpsMutations.ts              (수정 — T9: bust 확장 + useUndoBust + useCorrectPrize)
  components/ops/PlayersTab.tsx             (신규 — T10: [id].tsx에서 추출 + bust v2 UI)
  components/ops/PayoutsTab.tsx             (재작성 — T11: 컨테이너化)
  components/ops/PayoutStructureEditor.tsx  (신규 — T11)
  components/ops/PayoutLedger.tsx           (신규 — T11)
  components/ops/PrizeCorrectSheet.tsx      (신규 — T11)
  components/ops/TournamentResultCard.tsx   (신규 — T12)
  components/ops/LiveStatsPanel.tsx         (수정 — T12: KO POOL 조건부 카드)
  components/ops/HistoryTab.tsx             (수정 — T6: EVENT_LABEL 2종 — supabase.ts enum 확장과 같은 커밋에서 tsc 게이트 유지. 🔨H21 T8 아님)
  components/ui/BottomSheet.tsx             (수정 — T10: SelectBottomSheet snapPoints/scrollable prop 관통 🔨H3)
  repositories/interfaces/IOpsTournamentRepository.ts (수정 — T12: OpsTournamentCostConfig.bountyCost 🔨H6)
  repositories/supabase/OpsTournamentRepository.ts    (수정 — T12: p_config bounty_cost 매핑 🔨H6)
  schemas/opsTournament.schema.ts           (수정 — T12: opsCostConfigSchema.bountyCost 🔨H6)
app/
  (ops)/tournaments/[id].tsx                (수정 — T10/T12: PLAYERS 추출·STATUS completed 분기)
  (ops)/tournaments/new.tsx                 (수정 — T12: 바운티 입력)
  (public)/monitor/[token].tsx              (수정 — T12: KO POOL 카드)
  (public)/live/[view_token].tsx            (수정 — T12: 내 KO/적립)
```

## 정찰 확정 사실 (implementer 필독 — 스펙과 다르거나 스펙에 없는 실측)

1. **PLAYERS 탭은 `app/(ops)/tournaments/[id].tsx`에 인라인**(별도 PlayersTab.tsx 없음, 파일 397줄로 상한 근접) → T10에서 컴포넌트 추출이 선행된다.
2. **플레이어뷰 라우트는 `app/(public)/live/[view_token].tsx`**(claim_token 아님).
3. **`fn_ops_live_stats_recompute_trigger()` 래퍼는 `NEW.tournament_id`를 참조** → `ops_tournaments`(PK가 `id`)에 그대로 부착하면 런타임 에러("record has no field tournament_id"). T2에서 **tournaments 전용 래퍼 함수 신설**(+REVOKE — 1a 교훈: 트리거 함수도 anon/authenticated REVOKE).
4. **`ops_update_tournament`은 COALESCE 패치** → `bounty_cost`를 NULL로 되돌리기(비-바운티 전환)가 불가. T5에서 **key-presence 분기**(`p_patch ? 'bounty_cost'`) 사용 — 이 필드만 다른 패턴이므로 주석 필수.
5. **bounty_cost 음수 거부는 DB CHECK로 충족**(T1): 기존 create/update RPC에는 비용 음수 검증이 원래 없음(실측). 신규 P0001 prefix를 만들면 에러코드가 필요해 스펙 §8(3종 고정)을 벗어남 → `ops_tournaments_bounty_cost_nonneg CHECK (bounty_cost IS NULL OR bounty_cost >= 0)`가 모든 경로 차단. 클라는 폼 자체가 음수 입력 불가(`toInt`가 숫자만 추출).
6. **live_stats 단언 pgTAP는 정확히 5파일**(전수 grep + monitor/player 간접 단언 부재 확인): `ops_1c_tables_rls` · `ops_bust_participant` · `ops_clock_rpc_security` · `ops_live_stats_recompute` · `ops_reseat_participants`.
7. **ops_event_type은 실측 19값**(스펙의 "18종"은 소폭 오차 — 1d `prize_structure_set` 포함). 1f 후 21값.
8. **supabase.ts 수술 지점**: Enums 유니온 `:3186-3205` + Constants 미러 `:3381-3401`(두 곳 모두), `ops_participants` Row/Insert/Update(`:1420대`), Functions(`ops_bust_participant` `:2940대` Args 확장 + 신규 2종 알파벳순).
9. **types/ops.ts는 수동 camelCase 인터페이스**: `OpsTournament.bountyCost`·`OpsLiveStats.knockoutPool`은 **이미 존재**(1a/1c inert). `OpsParticipant.knockouts`만 신규.
10. **uuid Zod는 그룹형 정규식**(`opsSeat.schema.ts:41-46` — `.uuid()`는 RFC4122 strict라 테스트 픽스처 거부. `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`).
11. 🔨H18 **확인 다이얼로그**: 범용 `ConfirmModal`이 `@/components/ui/Modal`(:500-524)에 **실존**하고 LEVELS 진행 중 편집 가드(BlindLevelsTab.tsx:10 import·:176 사용)가 이것을 씀 — PAYOUTS 진행 중 저장 확인은 **ConfirmModal**(스펙 §7.1 "동형" 준수). 단순 destructive 확인(bust·탈락취소)은 `Alert.alert` 관례. 텍스트 입력 동반 = `SheetModal`(overlay prop이 중첩 RN Modal 함정 회피 정본). 선택 목록 = `SelectBottomSheet`(`src/components/ui/BottomSheet.tsx:340-405`) — ⚠️🔨H3 **snapPoints ['40%'] 고정 + plain View 렌더(비스크롤·scrollable 미전달)**: 옵션 ~6개 이상이면 하단·'지정 안 함' 도달 불가 → T10이 snapPoints?/scrollable? prop 관통을 추가하고 eliminator 피커에 적용한다.
12. **LiveStatsPanel은 3열 그리드 9카드** — KO POOL 추가 시 10번째는 마지막 행에 1개만 남으므로 자리 채움 처리 필요(T12에 명시).
13. **PayoutsTab 현행 rank 갭 메커니즘**: 저장 시 `.filter(amount>0)`이 중간 행 제거 + 스키마는 중복만 검증(연속성 없음) + rank 편집/행삭제 UI 없음 → T11 재설계가 rank 1..N 연속 재부여로 해소.
14. **ops_prizes에 DML REVOKE 없음**(1d 누락 실측 확인) → T1 동반 수선.
15. **`ops_create_tournament`/`ops_update_tournament`/스냅샷 2종은 CREATE OR REPLACE로 시그니처 불변** → 기존 GRANT 보존, grants 마이그(T6)는 bust v2(DROP→CREATE)·undo·correct 3종만.

---

# Batch B1 — DB 토대

### Task 1: 마이그 1 — enum 2값 + knockouts + CHECK + ops_prizes REVOKE

**Files:**

- Create: `supabase/migrations/20260704100000_ops_1f_enum_and_knockouts.sql`

**Interfaces:**

- Produces: `ops_event_type`에 `'player_bust_undone'`·`'prize_corrected'`(T3~T5 RPC가 사용), `ops_participants.knockouts int NOT NULL DEFAULT 0`(T2 recompute·T3 bust v2가 사용), `ops_tournaments.bounty_cost` CHECK(T5 create/update가 의존)

- [ ] **Step 1: 마이그 파일 작성**

```sql
-- OPS 1f M1 — 이벤트 enum 2값 + knockouts 컬럼 + 동반 수선(ops_prizes DML REVOKE·bounty_cost CHECK).
-- ⚠️ enum ADD VALUE 는 본 마이그(별도 txn)에서 값만 추가 — 값을 쓰는 RPC 는 M3(별도 txn, 55P04 회피).
-- 패턴: 20260630120000_ops_1d_prizes_table.sql (enum ADD VALUE), 1a CHECK 네이밍(ops_participants_*_nonneg).

-- 1) 이벤트 enum 2값 (멱등)
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'player_bust_undone';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'prize_corrected';

-- 2) flat KO 카운터. 적립(원화)은 파생: knockouts × bounty_cost (컬럼 없음, D4).
--    인덱스 불요(대회 내 소수 행·기존 (tournament_id,status) 인덱스로 충분).
ALTER TABLE public.ops_participants
  ADD COLUMN IF NOT EXISTS knockouts int NOT NULL DEFAULT 0;

-- 2-b) [🔨H11] ops_events 전순서 키 — created_at 은 DEFAULT now() = 트랜잭션 시작 시각 고정이라
--     같은 txn 의 이벤트가 전부 동률(id 는 uuid 라 무순서). undo 의 "최신 player_busted" 선별이
--     ORDER BY created_at 만으로는 비결정 → seq 가 유일한 전순서. append-only·prod 0행이라 additive 무해.
ALTER TABLE public.ops_events
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;

-- 3) CHECK 제약 2종 (멱등 — ADD CONSTRAINT 는 IF NOT EXISTS 미지원이라 카탈로그 확인)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ops_participants_knockouts_nonneg'
                   AND conrelid = 'public.ops_participants'::regclass) THEN
    ALTER TABLE public.ops_participants
      ADD CONSTRAINT ops_participants_knockouts_nonneg CHECK (knockouts >= 0);
  END IF;
  -- bounty_cost 음수 거부(스펙 §4.4) — RPC P0001 가드 대신 테이블 제약(모든 경로 차단·신규 에러코드 불요).
  -- NULL = 비-바운티 대회(0 과 구분 — 0 은 "바운티 개념은 있으나 단가 0").
  -- [🔨H15] 상한 1억: 오입력(예 20억)이면 knockout_pool int 곱이 22003 오버플로 — DEFERRED 트리거라
  --   원인 조작의 커밋 시점에 원인불명 실패로 터지고 이후 전 참가자 변이가 막히므로 입구에서 차단.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'ops_tournaments_bounty_cost_nonneg'
                   AND conrelid = 'public.ops_tournaments'::regclass) THEN
    ALTER TABLE public.ops_tournaments
      ADD CONSTRAINT ops_tournaments_bounty_cost_nonneg
      CHECK (bounty_cost IS NULL OR (bounty_cost >= 0 AND bounty_cost <= 100000000));
  END IF;
END $$;

-- 4) 동반 수선: ops_prizes 테이블 DML REVOKE (1d 누락 — 다른 ops 테이블과 동일한 방어심층.
--    쓰기는 ops_set_prize_structure SECDEF 전용, RLS 는 SELECT-only 라 REVOKE 가 2중 방어)
REVOKE INSERT, UPDATE, DELETE ON public.ops_prizes FROM anon, authenticated;
```

- [ ] **Step 2: 로컬 적용 + 카탈로그 검증**

Run: `npm run db:reset` (uniqn-mobile/ 에서)
Expected: 에러 없이 완료(신규 마이그 포함 전체 적용)

Run (Git Bash에서 `MSYS_NO_PATHCONV=1` 필수):

```bash
MSYS_NO_PATHCONV=1 docker exec supabase_db_uniqn psql -U postgres -d postgres -c \
  "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.ops_event_type'::regtype ORDER BY enumsortorder;" -c \
  "SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name='ops_participants' AND column_name='knockouts';" -c \
  "SELECT conname FROM pg_constraint WHERE conname IN ('ops_participants_knockouts_nonneg','ops_tournaments_bounty_cost_nonneg');" -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='ops_events' AND column_name='seq';" -c \
  "SELECT has_table_privilege('authenticated','public.ops_prizes','INSERT') AS auth_insert, has_table_privilege('anon','public.ops_prizes','UPDATE') AS anon_update;"
```

Expected: enum 21값(`player_bust_undone`·`prize_corrected` 포함) · knockouts 컬럼(default 0, NO) · CHECK 2건 · ops_events.seq 존재 · auth_insert=f, anon_update=f

- [ ] **Step 3: 기존 pgTAP 무회귀 확인**

Run: `npm run test:db:helpers && npx supabase test db`
Expected: 기존 전 파일 PASS (이 마이그는 additive — 기존 43파일 무영향)

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260704100000_ops_1f_enum_and_knockouts.sql
git commit -m "feat(ops): 1f M1 — 이벤트 enum 2값·knockouts 컬럼·ops_prizes REVOKE·bounty CHECK"
```

---

### Task 2: 마이그 2 — live_stats DEFERRED 전환 (recompute 확장 + 트리거 6종 + pgTAP 풀 사이클)

**Files:**

- Create: `supabase/migrations/20260704100100_ops_1f_live_stats_deferred.sql`
- Create: `supabase/tests/ops_live_stats_deferred.test.sql`
- Modify: `supabase/tests/ops_1c_tables_rls.test.sql` (BEGIN 직후 1줄)
- Modify: `supabase/tests/ops_bust_participant.test.sql` (동일)
- Modify: `supabase/tests/ops_clock_rpc_security.test.sql` (동일)
- Modify: `supabase/tests/ops_live_stats_recompute.test.sql` (동일)
- Modify: `supabase/tests/ops_reseat_participants.test.sql` (동일)

**Interfaces:**

- Consumes: T1의 `knockouts`·`bounty_cost` CHECK
- Produces: `fn_ops_recompute_live_stats` 신산식(재진입 가산 + `knockout_pool`), 트리거 6종 전부 `CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED`, 신규 래퍼 `fn_ops_live_stats_recompute_trigger_tournaments()`. **이후 모든 트랜잭션에서 live_stats 반영은 커밋 시점**(pgTAP 단일 txn에서 단언하려면 `SET CONSTRAINTS ALL IMMEDIATE` 선행 필수 — T3~T5 테스트 작성 시 주의)

- [ ] **Step 1: 신규 pgTAP 테스트 먼저 작성 (RED 확인용)**

`supabase/tests/ops_live_stats_deferred.test.sql`:

```sql
-- ops 1f — live_stats DEFERRED 전환 + recompute 신산식(재진입 가산·knockout_pool) 검증.
-- RED-GREEN: 이 파일은 마이그 20260704100100 적용 전엔 [1](tgdeferrable)·[2](stale) 단언이 FAIL(구 AFTER ROW 는 즉시 반영).
-- ⚠️ 무위 시드 금지: 참가자 추가가 실제 entries 를 바꾸는 시드로 stale/반영 차이를 실증.
-- 🔨H9: 시드 active 3명 유지 — bust 후에도 active≥2 라 우승 자동확정(→completed→reenter 폭발) 미발동.
-- 🔨H13: WHEN절 미발화 단언은 센티널 오염 기법(updated_at 은 now()=txn 상수라 무위).
BEGIN;
SELECT plan(13);

-- ── 시드: active 3명(시드 1 + players 1 + 아래 [2]의 900). 초기 recompute 는 명시 호출(결정성) ──
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.t_id',     s.tournament_id::text, true);
  UPDATE public.ops_tournaments SET status = 'active' WHERE id = s.tournament_id;
  PERFORM public.ops_test_seed_players(s.tournament_id, 1);  -- H9: bust 후에도 active≥2 유지용
  PERFORM public.fn_ops_recompute_live_stats(s.tournament_id);  -- entries=2 기록
END $$;

-- ── [1] 트리거 6종 전부 DEFERRABLE INITIALLY DEFERRED (카탈로그 단언) ──
SELECT is(
  (SELECT count(*)::int FROM pg_trigger
   WHERE tgname IN ('trg_ops_participants_recompute_stats','trg_ops_seats_recompute_stats',
                    'trg_ops_tables_recompute_stats','trg_ops_blind_levels_recompute_stats',
                    'trg_ops_clock_recompute_stats','trg_ops_tournaments_recompute_stats')
     AND tgdeferrable AND tginitdeferred),
  6, 'live_stats 트리거 6종 전부 CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED');

-- ── [2][3] DEFERRED 거동: 같은 txn 에서 참가자 INSERT 후 stale → SET CONSTRAINTS 후 반영 ──
DO $$
BEGIN
  INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
  VALUES ((current_setting('ops.t_id'))::uuid, 900, 'Deferred P', 'active', 30000);
END $$;
SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  2, 'DEFERRED: INSERT 직후 같은 txn 에서 live_stats 는 stale(entries=2 유지)');

SET CONSTRAINTS ALL IMMEDIATE;  -- pending 트리거 즉시 발화 + 이후 문장부터 즉시 모드

SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  3, 'SET CONSTRAINTS ALL IMMEDIATE 후 pending 발화로 entries=3 반영');

-- ── [4] knockouts 컬럼 존재(T1 회귀 앵커) ──
SELECT has_column('public', 'ops_participants', 'knockouts', 'ops_participants.knockouts 존재');

-- ── [5][6] 재진입 가산: reenter 후 prize_pool = (entries + Σreentries) × buy_in ──
-- 시드 buy_in_cost=50000. active 3명 → bust(900) 후 active 2(자동확정 미발동 — H9) → reenter →
-- entries=3, reentries=1 → pool=(3+1)*50000=200000.
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE v_p uuid;
BEGIN
  SELECT id INTO v_p FROM public.ops_participants
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND entry_number = 900;
  PERFORM public.ops_bust_participant(v_p, (current_setting('ops.owner_id'))::uuid);
  PERFORM public.ops_reenter_participant(v_p, (current_setting('ops.owner_id'))::uuid);
END $$;
SELECT is(
  (SELECT reentries_total FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  1, '재진입 후 reentries_total=1');
SELECT is(
  (SELECT prize_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  200000::bigint, '재진입 가산: prize_pool=(3 entries + 1 reentry) × 50000 = 200000');

-- ── [7][8] knockout_pool: 비-바운티 NULL → bounty_cost 세팅 시 (entries+reentries)×bounty ──
SELECT is(
  (SELECT knockout_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  NULL, '비-바운티 대회: knockout_pool IS NULL');
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_tournaments SET bounty_cost = 10000
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT is(
  (SELECT knockout_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  40000, 'tournaments 트리거 발화: knockout_pool=(3+1)×10000=40000');

-- ── [9] tournaments 비용 변경 트리거: buy_in_cost 변경 → prize_pool 재계산 ──
UPDATE public.ops_tournaments SET buy_in_cost = 60000
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT is(
  (SELECT prize_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  240000::bigint, '비용 변경 트리거: prize_pool=(3+1)×60000=240000');

-- ── [10] WHEN 절 미발화 — 센티널 오염 기법(🔨H13: updated_at 은 now()=txn 상수라 판별력 없음).
--    postgres 로 entries=999 오염 → name 변경(산식 무관 컬럼) → 999 유지 = 트리거 미발화 실증.
UPDATE public.ops_live_stats SET entries = 999
  WHERE tournament_id = (current_setting('ops.t_id'))::uuid;
UPDATE public.ops_tournaments SET name = 'renamed cup'
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  999, 'WHEN 절: 비용 외 컬럼(name) 변경은 recompute 미발화(센티널 999 유지)');

-- ── [11][12] bounty_cost NULL 복귀(비용 컬럼 변경 = 발화) → knockout_pool NULL + 센티널 실값 복귀 ──
UPDATE public.ops_tournaments SET bounty_cost = NULL
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT is(
  (SELECT knockout_pool FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  NULL, 'bounty_cost NULL 복귀: knockout_pool NULL');
SELECT is(
  (SELECT entries FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  3, '비용 변경 발화 실증: recompute 가 센티널(999)을 실값(3)으로 복원');

-- ── [13] 신규 tournaments 래퍼 함수 EXECUTE 권한 회수(1a 교훈: 트리거 함수도 REVOKE) ──
SELECT ok(
  NOT has_function_privilege('anon', 'public.fn_ops_live_stats_recompute_trigger_tournaments()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.fn_ops_live_stats_recompute_trigger_tournaments()', 'EXECUTE'),
  'fn_ops_live_stats_recompute_trigger_tournaments: anon/authenticated EXECUTE 회수');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: RED 확인**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db supabase/tests/ops_live_stats_deferred.test.sql`
(개별 파일 지정이 하니스에서 안 되면 `npx supabase test db`로 전체 실행 후 해당 파일 결과 확인)
Expected: **FAIL** — [1] 트리거 카운트 0(아직 AFTER ROW), [2] stale 단언 실패(구 트리거는 즉시 반영이라 entries=3), [8][9][11][12] tournaments 트리거 부재로 실패, [13] 함수 미존재 에러. RED 증거를 기록.

- [ ] **Step 3: 마이그 2 작성**

`supabase/migrations/20260704100100_ops_1f_live_stats_deferred.sql`:

```sql
-- OPS 1f M2 — live_stats 재계산 산식 확장(재진입 가산·knockout_pool) + AFTER ROW → CONSTRAINT TRIGGER
--   DEFERRABLE INITIALLY DEFERRED 전환(D6 — TODOS [MED] LS-매개 데드락 해소) + ops_tournaments 비용 트리거 신설.
-- 데드락 해소 논증: DEFERRED 로 LS 행 락 획득이 항상 커밋 직전 최후 → 모든 txn 에서
--   {advisory, 대회, 참가자, 좌석} < LS 전역 순서 성립 → bust 의 LS<{S,P_winner} 역전 및
--   (P,S)→LS(rebuy/addon/좌석/claim/redraw) ABBA 순환 근원 제거 (1d 스펙 §14).
-- ⚠️ CREATE OR REPLACE TRIGGER 는 constraint trigger 미지원 → DROP 후 CREATE 필수.
-- ⚠️ 기존 래퍼 fn_ops_live_stats_recompute_trigger() 는 NEW.tournament_id 참조 →
--   ops_tournaments(PK=id) 에는 전용 래퍼 신설(fn_..._tournaments, NEW.id 사용).

-- ═══ A. 재계산 본체 교체 (CREATE OR REPLACE — 시그니처 불변, 기존 REVOKE 보존) ═══
CREATE OR REPLACE FUNCTION public.fn_ops_recompute_live_stats(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_buy_in_cost int;
  v_rebuy_cost  int;
  v_addon_cost  int;
  v_bounty_cost int;
  v_playing      int;
  v_entries      int;
  v_reentries    int;
  v_total_rebuys bigint;
  v_total_addons bigint;
  v_total_chips  bigint;
  v_tables_open  int;
  v_seats_total  int;
  v_seats_free   int;
  v_average_stack bigint;
  v_big_blind    int;
  v_avg_stack_bb numeric;
  v_total_buyins bigint;
  v_prize_pool   bigint;
  v_knockout_pool int;
BEGIN
  -- [CASCADE 가드] 대회 삭제 중 자식 DELETE 트리거가 부르면 조용히 종료(1c 보존)
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE id = p_tournament_id) THEN
    RETURN;
  END IF;

  SELECT buy_in_cost, rebuy_cost, addon_cost, bounty_cost
    INTO v_buy_in_cost, v_rebuy_cost, v_addon_cost, v_bounty_cost
    FROM public.ops_tournaments WHERE id = p_tournament_id;

  SELECT
    count(*) FILTER (WHERE status = 'active'),
    count(*),
    COALESCE(sum(reentries), 0),
    COALESCE(sum(rebuys), 0),
    COALESCE(sum(add_ons), 0),
    COALESCE(sum(chips) FILTER (WHERE status = 'active'), 0)
  INTO v_playing, v_entries, v_reentries, v_total_rebuys, v_total_addons, v_total_chips
  FROM public.ops_participants
  WHERE tournament_id = p_tournament_id;

  SELECT count(*)
    INTO v_tables_open
    FROM public.ops_tables
    WHERE tournament_id = p_tournament_id AND status = 'open';

  SELECT count(s.id), count(s.id) FILTER (WHERE s.participant_id IS NULL)
    INTO v_seats_total, v_seats_free
    FROM public.ops_seats s
    JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.tournament_id = p_tournament_id AND t.status = 'open';

  v_average_stack := COALESCE(round(v_total_chips::numeric / NULLIF(v_playing, 0))::bigint, 0);

  SELECT bl.big_blind
    INTO v_big_blind
    FROM public.ops_blind_levels bl
    JOIN public.ops_clock c
      ON c.tournament_id = bl.tournament_id AND c.current_level_sort = bl.sort
    WHERE bl.tournament_id = p_tournament_id;

  v_avg_stack_bb := COALESCE(v_average_stack::numeric / NULLIF(v_big_blind, 0), 0);

  -- [1f] 총 바이인 수 = entries + Σreentries (재진입 = 바이인 재지불, 1d 스펙이 1f 로 명시 이관)
  v_total_buyins := v_entries::bigint + v_reentries;
  v_prize_pool := v_total_buyins * COALESCE(v_buy_in_cost, 0)
                + v_total_rebuys * COALESCE(v_rebuy_cost, 0)
                + v_total_addons * COALESCE(v_addon_cost, 0);
  -- [1f] KO 풀: NULL = 비-바운티 대회(클라 카드 숨김 신호). fee_cost 는 계속 미포함(하우스 몫).
  v_knockout_pool := CASE WHEN v_bounty_cost IS NULL THEN NULL
                          ELSE (v_total_buyins * v_bounty_cost)::int END;

  INSERT INTO public.ops_live_stats AS ls (
    tournament_id, playing, entries, unique_players, reentries_total,
    tables_open, seats_total, seats_free,
    total_chips, average_stack, avg_stack_bb, prize_pool, knockout_pool, updated_at
  ) VALUES (
    p_tournament_id, v_playing, v_entries, v_entries, v_reentries,
    v_tables_open, v_seats_total, v_seats_free,
    v_total_chips, v_average_stack, v_avg_stack_bb, v_prize_pool, v_knockout_pool, now()
  )
  ON CONFLICT (tournament_id) DO UPDATE SET
    playing         = EXCLUDED.playing,
    entries         = EXCLUDED.entries,
    unique_players  = EXCLUDED.unique_players,
    reentries_total = EXCLUDED.reentries_total,
    tables_open     = EXCLUDED.tables_open,
    seats_total     = EXCLUDED.seats_total,
    seats_free      = EXCLUDED.seats_free,
    total_chips     = EXCLUDED.total_chips,
    average_stack   = EXCLUDED.average_stack,
    avg_stack_bb    = EXCLUDED.avg_stack_bb,
    prize_pool      = EXCLUDED.prize_pool,
    knockout_pool   = EXCLUDED.knockout_pool,
    updated_at      = now();
END;
$function$;

-- ═══ B. ops_tournaments 전용 트리거 래퍼 (기존 래퍼는 NEW.tournament_id 참조 → PK=id 인 이 테이블 불가) ═══
CREATE OR REPLACE FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  PERFORM public.fn_ops_recompute_live_stats(NEW.id);
  RETURN NEW;
END;
$function$;

-- 신규 트리거 함수 즉시 REVOKE (1a 교훈: SECDEF trigger fn 미회수 시 advisor WARN)
REVOKE EXECUTE ON FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments() FROM PUBLIC, anon, authenticated;

-- ═══ C. 기존 5종 AFTER ROW → CONSTRAINT TRIGGER DEFERRED 재생성 (동일 이벤트·WHEN 보존) ═══
DROP TRIGGER IF EXISTS trg_ops_participants_recompute_stats ON public.ops_participants;
CREATE CONSTRAINT TRIGGER trg_ops_participants_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_participants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_seats_recompute_stats ON public.ops_seats;
CREATE CONSTRAINT TRIGGER trg_ops_seats_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_seats
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_tables_recompute_stats ON public.ops_tables;
CREATE CONSTRAINT TRIGGER trg_ops_tables_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_tables
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_blind_levels_recompute_stats ON public.ops_blind_levels;
CREATE CONSTRAINT TRIGGER trg_ops_blind_levels_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_blind_levels
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_clock_recompute_stats ON public.ops_clock;
CREATE CONSTRAINT TRIGGER trg_ops_clock_recompute_stats
  AFTER UPDATE ON public.ops_clock
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.current_level_sort IS DISTINCT FROM NEW.current_level_sort)
  EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

-- ═══ D. ops_tournaments 비용 트리거 신설 — 비용 config 변경 시 prize_pool/knockout_pool stale 창 해소.
--       WHEN 은 산식 사용 4컬럼만(fee_cost 는 recompute 미사용이라 제외 — 불필요 발화 방지). ═══
DROP TRIGGER IF EXISTS trg_ops_tournaments_recompute_stats ON public.ops_tournaments;
CREATE CONSTRAINT TRIGGER trg_ops_tournaments_recompute_stats
  AFTER UPDATE ON public.ops_tournaments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.buy_in_cost IS DISTINCT FROM NEW.buy_in_cost
     OR OLD.rebuy_cost  IS DISTINCT FROM NEW.rebuy_cost
     OR OLD.addon_cost  IS DISTINCT FROM NEW.addon_cost
     OR OLD.bounty_cost IS DISTINCT FROM NEW.bounty_cost)
  EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments();

-- ═══ E. backfill — 신산식 반영(멱등. prod 0행이지만 로컬 기존 데이터 정합) ═══
SELECT public.fn_ops_recompute_live_stats(id) FROM public.ops_tournaments;
```

- [ ] **Step 4: 기존 pgTAP 5파일에 SET CONSTRAINTS 삽입**

5파일(`ops_1c_tables_rls` · `ops_bust_participant` · `ops_clock_rpc_security` · `ops_live_stats_recompute` · `ops_reseat_participants`) 각각의 `BEGIN;` 바로 다음 줄에 아래 2줄 삽입 (기존 즉시 발화 동작을 복원해 단언 무회귀):

```sql
-- 1f: live_stats 트리거가 DEFERRED 로 전환됨 — 이 파일은 같은 txn 에서 live_stats 를 단언하므로 즉시 발화 강제.
SET CONSTRAINTS ALL IMMEDIATE;
```

- [ ] **Step 5: GREEN 확인 (전체 pgTAP)**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: **전 파일 PASS** — 신규 `ops_live_stats_deferred` 12단언 GREEN + 기존 5파일 무회귀 + 나머지 무영향

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/20260704100100_ops_1f_live_stats_deferred.sql supabase/tests/
git commit -m "feat(ops): 1f M2 — live_stats DEFERRED 전환·재진입 가산·knockout_pool + pgTAP 이행 (LS-데드락 해소)"
```

---

# Batch B2 — RPC

> 마이그 3(`20260704100200_ops_1f_prize_rpcs.sql`)은 T3→T4→T5가 **이어서 작성**(같은 신규 파일에 append — prod 미적용이라 "기존 마이그 수정 금지" 대상 아님). 각 태스크는 자기 RPC pgTAP를 RED→GREEN으로 완주.

### Task 3: bust v2 — eliminator(flat KO) + payload 확장 (구 2인자 DROP)

**Files:**

- Create: `supabase/migrations/20260704100200_ops_1f_prize_rpcs.sql` (파일 시작 — bust v2 섹션)
- Create: `supabase/tests/ops_bust_eliminator.test.sql`

**Interfaces:**

- Consumes: T1 `knockouts` 컬럼·enum(payload는 기존 `player_busted` 이벤트 재사용)
- Produces: `ops_bust_participant(p_participant_id uuid, p_actor_id uuid, p_eliminator_id uuid DEFAULT NULL) RETURNS jsonb` — 반환 형태 v1과 동일(`{participant_id, finish_position, prize_amount, winner_finalized, winner}`). `player_busted` payload에 `chips_before`(int)·`eliminator_id`(uuid|null)·`freed_seat_id`(uuid|null) 추가(T4 undo가 복원 소스로 소비)

- [ ] **Step 1: pgTAP 먼저 작성 (RED)**

`supabase/tests/ops_bust_eliminator.test.sql`:

```sql
-- ops 1f — bust v2: eliminator 가드 4종·knockouts 적립·payload 3필드·구 2인자 시그니처 소멸(E10)·
--   actor 가드·자동확정 보류 가드(🔨H12).
-- 시드: active 3명(seed + 2명) + 좌석 배정 1명(payload freed_seat_id 실증 — 무위 시드 금지).
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;  -- live_stats 단언은 없지만 트리거 발화 시점 고정(결정성)
SELECT plan(15);

DO $$
DECLARE s RECORD; player_ids uuid[];
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text, true);
  PERFORM set_config('ops.member_id',   s.member_id::text, true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text, true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text, true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);
  PERFORM set_config('ops.seat1',       s.seat1_id::text, true);
  UPDATE public.ops_tournaments SET status = 'active' WHERE id = s.tournament_id;
  player_ids := public.ops_test_seed_players(s.tournament_id, 2);
  PERFORM set_config('ops.p1', player_ids[1]::text, true);
  PERFORM set_config('ops.p2', player_ids[2]::text, true);
  -- p1 을 seat1 에 착석(freed_seat_id 실증용)
  UPDATE public.ops_seats SET participant_id = player_ids[1] WHERE id = s.seat1_id;
END $$;

-- ── [1] E10: 구 2인자 시그니처 소멸 (오버로딩 우회 차단) ──
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ops_bust_participant'
     AND p.pronargs = 2),
  0, '구 2인자 ops_bust_participant 시그니처 소멸(DROP 확인)');

-- ── actor 가드 ──
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [2]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, NULL) $$,
  'P0001', NULL, 'actor 가드: 명의 위조 거부');

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── eliminator 가드 4종 (전부 ELIMINATOR_INVALID) ──
SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, (current_setting('ops.p1'))::uuid) $$,
  'ELIMINATOR_INVALID%', 'eliminator 가드: 자기 자신 거부');
SELECT throws_like(                                                          -- [4]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, gen_random_uuid()) $$,
  'ELIMINATOR_INVALID%', 'eliminator 가드: 미존재 거부');
-- 타대회: 두 번째 대회 시드(간이 — postgres 직접)
DO $$
DECLARE v_t2 uuid := gen_random_uuid(); v_p2 uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_tournaments (id, owner_id, name, game_type, starting_chips, status)
  VALUES (v_t2, (current_setting('ops.owner_id'))::uuid, 'other cup', 'NLH', 30000, 'active');
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES (v_p2, v_t2, 1, 'Other P', 'active', 30000);
  PERFORM set_config('ops.other_pid', v_p2::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, (current_setting('ops.other_pid'))::uuid) $$,
  'ELIMINATOR_INVALID%', 'eliminator 가드: 타대회 참가자 거부(미존재와 동일 처리)');
-- 비-active eliminator: p2 를 postgres 로 busted 세팅 후 시도
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'busted'
    WHERE id = (current_setting('ops.p2'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [6]
  $$ SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, (current_setting('ops.p2'))::uuid) $$,
  'ELIMINATOR_INVALID%', 'eliminator 가드: 비-active 거부');
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'active'
    WHERE id = (current_setting('ops.p2'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── 정상 KO bust: p1(착석·칩 30000) 을 seed 가 눌렀다 ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, (current_setting('ops.seed_pid'))::uuid) INTO r;
  PERFORM set_config('ops.r_fp', (r->>'finish_position'), true);
END $$;
SELECT is(current_setting('ops.r_fp')::int, 3,                              -- [7]
  'KO bust: 3명 active → finish_position=3 (v1 로직 보존)');
SELECT is(                                                                   -- [8]
  (SELECT knockouts FROM public.ops_participants WHERE id = (current_setting('ops.seed_pid'))::uuid),
  1, 'eliminator(seed) knockouts=1 적립');

-- ── payload 3필드 (undo 복원 소스 계약) ──
SELECT is(                                                                   -- [9]
  (SELECT (payload->>'chips_before')::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_busted'
     AND (payload->>'participant_id')::uuid = (current_setting('ops.p1'))::uuid
   ORDER BY created_at DESC LIMIT 1),
  30000, 'payload.chips_before=30000 (UPDATE 전 칩)');
SELECT is(                                                                   -- [10]
  (SELECT payload->>'eliminator_id' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_busted'
     AND (payload->>'participant_id')::uuid = (current_setting('ops.p1'))::uuid
   ORDER BY created_at DESC LIMIT 1),
  current_setting('ops.seed_pid'), 'payload.eliminator_id 기록');
SELECT is(                                                                   -- [11]
  (SELECT payload->>'freed_seat_id' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_busted'
     AND (payload->>'participant_id')::uuid = (current_setting('ops.p1'))::uuid
   ORDER BY created_at DESC LIMIT 1),
  current_setting('ops.seat1'), 'payload.freed_seat_id = bust 당시 점유 좌석');

-- ── NULL eliminator + 🔨H12 자동확정 보류: bust(p2) 전에 checked_in 생존자를 만들어
--    "active=1 이어도 checked_in>0 이면 확정 보류" 를 실증(무위 시드 방지 — checked_in 없으면
--    이 bust 가 자동확정·completed 를 유발해 보류 가드가 검증 불가).
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
  VALUES ((current_setting('ops.t_id'))::uuid, 950, 'CheckedIn P', 'checked_in', 30000);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL) INTO r;
  PERFORM set_config('ops.r2_winner', (r->>'winner_finalized'), true);
END $$;
SELECT is(                                                                   -- [12]
  (SELECT sum(knockouts)::int FROM public.ops_participants
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  1, 'NULL eliminator: knockouts 총합 불변(1 유지)');
SELECT is(                                                                   -- [13]
  (SELECT payload->>'freed_seat_id' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_busted'
     AND (payload->>'participant_id')::uuid = (current_setting('ops.p2'))::uuid
   ORDER BY created_at DESC LIMIT 1),
  NULL, '무좌석 bust: payload.freed_seat_id IS NULL');
SELECT is(current_setting('ops.r2_winner'), 'false',                         -- [14]
  'H12: active 1 + checked_in 1 → 우승 자동확정 보류(winner_finalized=false)');
SELECT is(                                                                   -- [15]
  (SELECT status::text FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  'active', 'H12: 확정 보류로 대회 status=active 유지(completed 아님)');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: RED 확인**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: `ops_bust_eliminator` FAIL — [1] 구 시그니처 잔존(count=1), [3]~[6] 3인자 함수 미존재(42883), [8] knockouts 미적립, [14][15] 보류 가드 부재(구 로직은 checked_in 무시하고 확정). 기존 파일은 전부 PASS 유지.

- [ ] **Step 3: 마이그 3 파일 시작 — bust v2 작성**

`supabase/migrations/20260704100200_ops_1f_prize_rpcs.sql` (파일 헤더 + bust v2):

```sql
-- OPS 1f M3 — 상금 RPC: bust v2(eliminator/flat KO)·ops_undo_bust·ops_correct_participant_prize·
--   create/update bounty_cost 확장·공개 스냅샷 2종 확장(knockoutPool·knockouts/bountyAccrued).
-- 골격: 20260630120100_ops_1d_bust_reenter_prize_rpcs.sql. enum 값(player_bust_undone/prize_corrected)은
--   M1(별도 txn)에서 추가됨. 권한은 M4(20260704100300)에서 처리.
-- 락 불변식: advisory → 대회 FOR UPDATE → 참가자 FOR UPDATE(복수면 id 오름차순) → 좌석.
--   LS 트리거는 M2 로 DEFERRED — eliminator 행 추가 잠금이 LS-ABBA 표면을 넓히지 않음(설계 시너지).

-- ───────────────────────────────────────────────────────────────────────────
-- 1) ops_bust_participant v2 — 구 2인자 명시 DROP(오버로딩 우회 차단, STEP A D6 관례) 후 3인자 CREATE.
--    기존 로직 전체 보존(가드 순서·finish_position 산정·ITM 매핑·좌석 해제·우승 자동확정·반환 형태).
--    변경분: eliminator 가드 4종·참가자 2행 id asc 잠금·knockouts 적립·payload 3필드.
DROP FUNCTION IF EXISTS public.ops_bust_participant(uuid, uuid);

CREATE FUNCTION public.ops_bust_participant(
  p_participant_id uuid,
  p_actor_id uuid,
  p_eliminator_id uuid DEFAULT NULL
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
  v_chips_before int;
  v_elim_status public.ops_participant_status;
  v_elim_tid uuid;
  v_active int;
  v_used_count int;
  v_finish int;
  v_prize int;
  v_active2 int;
  v_winner uuid;
  v_winner_prize int;
  v_seat_id uuid;
  v_freed_seat_id uuid;
  v_winner_json jsonb;
BEGIN
  -- 1) actor 가드 (v1 보존)
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금) — advisory 락을 행 잠금보다 먼저 취득(v1 보존)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 (v1 보존)
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active 검사 (v1 보존)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중(active) 대회만 탈락 처리 가능 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) [1f] eliminator 자기자신 가드 — 순수 인자 비교라 행 잠금 전 판정(표면은 락 이후와 동일)
  IF p_eliminator_id IS NOT NULL AND p_eliminator_id = p_participant_id THEN
    RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다(자기 자신)' USING ERRCODE = 'P0001';
  END IF;

  -- 6) 참가자 행 잠금 — 대상(+eliminator) id 오름차순 FOR UPDATE(락 불변식 '참가자' 항 복수 일반화)
  IF p_eliminator_id IS NOT NULL THEN
    PERFORM 1 FROM public.ops_participants
      WHERE id IN (p_participant_id, p_eliminator_id)
      ORDER BY id FOR UPDATE;
  END IF;

  -- 대상 status/chips 확인 — v1 검사 순서 보존(에러 메시지/순서 무회귀). 6)에서 잠금 보유 시 재잠금 무해.
  SELECT status, chips INTO v_status, v_chips_before
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;
  IF v_status = 'busted' THEN
    RAISE EXCEPTION 'PARTICIPANT_ALREADY_BUSTED: 이미 탈락 처리된 참가자입니다' USING ERRCODE = 'P0001';
  ELSIF v_status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 탈락 처리 가능 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 7) [1f] eliminator 가드: 존재+같은 대회(미존재·타대회 동일 처리)·active.
  --    비-바운티 대회에서도 지정 가능(기록만 — 적립 표시는 클라가 bounty_cost 유무로 게이트).
  IF p_eliminator_id IS NOT NULL THEN
    SELECT status, tournament_id INTO v_elim_status, v_elim_tid
      FROM public.ops_participants WHERE id = p_eliminator_id;
    IF v_elim_tid IS NULL OR v_elim_tid <> v_tournament_id THEN
      RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다' USING ERRCODE = 'P0001';
    END IF;
    IF v_elim_status <> 'active' THEN
      RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다(비활성)' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 8) 생존수 + 마지막 생존자 가드 (v1 보존)
  SELECT count(*) INTO v_active FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  IF v_active <= 1 THEN
    RAISE EXCEPTION 'PARTICIPANT_LAST_SURVIVOR: 마지막 생존자는 탈락 처리할 수 없습니다(우승 처리 대상)'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9) finish_position = 생존수 이상 최소 미사용 순위 (v1 보존)
  SELECT count(*) INTO v_used_count FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND finish_position IS NOT NULL;
  SELECT g INTO v_finish
    FROM generate_series(v_active, v_active + v_used_count) AS g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND finish_position = g)
    ORDER BY g LIMIT 1;

  -- 10) prize 매핑 (v1 보존)
  SELECT amount INTO v_prize FROM public.ops_prizes
    WHERE tournament_id = v_tournament_id AND rank = v_finish;

  -- 11) 변이 (v1 보존)
  UPDATE public.ops_participants
    SET status = 'busted', busted_at = now(), finish_position = v_finish,
        prize_amount = v_prize, chips = 0
    WHERE id = p_participant_id;

  -- 11-b) [1f] eliminator KO 적립
  IF p_eliminator_id IS NOT NULL THEN
    UPDATE public.ops_participants SET knockouts = knockouts + 1 WHERE id = p_eliminator_id;
  END IF;

  -- 12) 좌석 해제 (v1 보존) + [1f] freed_seat_id 기록(복수면 첫 좌석 — 단일점유 불변식상 실제 최대 1)
  v_freed_seat_id := NULL;
  FOR v_seat_id IN
    SELECT id FROM public.ops_seats
    WHERE participant_id = p_participant_id ORDER BY id FOR UPDATE
  LOOP
    UPDATE public.ops_seats SET participant_id = NULL WHERE id = v_seat_id;
    IF v_freed_seat_id IS NULL THEN
      v_freed_seat_id := v_seat_id;
    END IF;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'seat_freed', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'seat_id', v_seat_id));
  END LOOP;

  -- 13) 이벤트 — [1f] payload 3필드 확장(chips_before/eliminator_id/freed_seat_id = undo 복원 소스)
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_busted', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'finish_position', v_finish, 'prize_amount', v_prize,
                             'chips_before', v_chips_before,
                             'eliminator_id', p_eliminator_id,
                             'freed_seat_id', v_freed_seat_id));
  IF v_prize IS NOT NULL THEN
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'rank', v_finish, 'amount', v_prize));
  END IF;

  -- 14) 우승 자동확정 (v1 보존 + [🔨H12] 보류 가드: checked_in 생존자가 있으면 확정 보류.
  --     undo/register/reenter 의 무좌석 폴백이 만든 checked_in 을 무시하고 completed 확정하면
  --     그 참가자는 fp NULL 고아(재bust 불가·D2 로 undo 불가·correct 는 fp NULL 거부) — 구제 불가.
  --     보류 시 운영자는 checked_in 을 착석(active 승급)시킨 뒤 진행하면 다음 bust 에서 재평가.)
  SELECT count(*) INTO v_active2 FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  SELECT count(*) INTO v_checked_in FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'checked_in';
  v_winner_json := NULL;
  IF v_active2 = 1 AND v_checked_in = 0 THEN
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

  -- 15) 반환 (v1 보존 — winner_finalized 는 H12 보류 반영)
  RETURN jsonb_build_object(
    'participant_id', p_participant_id,
    'finish_position', v_finish,
    'prize_amount', v_prize,
    'winner_finalized', (v_active2 = 1 AND v_checked_in = 0),
    'winner', v_winner_json);
END;
$function$;
```

(implementer: DECLARE 블록에 `v_checked_in int;` 추가를 잊지 마라.)

- [ ] **Step 4: GREEN 확인**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: `ops_bust_eliminator` 15단언 PASS. **주의**: 이 시점에 bust는 DROP→CREATE라 EXECUTE 권한이 회수된 상태(GRANT는 T6 마이그 4) — 기존 `ops_bust_participant.test.sql`·`ops_rpc_security.test.sql`은 postgres/authenticated role 전환 하에 SECDEF 함수를 직접 호출하므로 **fixture가 함수 GRANT를 안 해도 owner(postgres) 권한으로 실행됨**... 아니다: pgTAP는 `set_config('role','authenticated')` 상태에서 RPC를 호출하므로 EXECUTE 권한이 필요하다. **DROP 후 재생성된 함수는 PUBLIC 기본 EXECUTE가 부여**되므로(Postgres 기본), grants 마이그 전에도 호출은 성공한다(회수는 T6에서 명시 REVOKE+GRANT). 기존 테스트 무회귀 확인.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20260704100200_ops_1f_prize_rpcs.sql supabase/tests/ops_bust_eliminator.test.sql
git commit -m "feat(ops): 1f M3-1 — bust v2 (eliminator flat KO·payload 확장·구 2인자 DROP)"
```

---

### Task 4: ops_undo_bust — 탈락 취소 (active 한정·이벤트 복원·좌석 3분기)

**Files:**

- Modify: `supabase/migrations/20260704100200_ops_1f_prize_rpcs.sql` (undo 섹션 append)
- Create: `supabase/tests/ops_undo_bust.test.sql`

**Interfaces:**

- Consumes: T3 bust v2의 `player_busted` payload(`chips_before`/`eliminator_id`/`freed_seat_id`)
- Produces: `ops_undo_bust(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb` — `{participant_id, restored_chips, status, seated, table_no, seat_no}`. 이벤트 `player_bust_undone` payload `{participant_id, restored_chips, eliminator_id, seat_restored: 'original'|'auto'|'none'}`

- [ ] **Step 1: pgTAP 먼저 작성 (RED)**

`supabase/tests/ops_undo_bust.test.sql`:

```sql
-- ops 1f — ops_undo_bust: 복원 4필드·좌석 3분기·KO 감소·GREATEST 0·completed 거부(D2)·
--   비busted 거부·undo 후 재bust fp 값 단언(🔨H10)·최신 이벤트 판별(🔨H11 칩 변동)·이벤트 append·
--   actor 가드·비멤버 에러 균일(🔨H1).
-- 시드: active 4명 + 좌석 2개(원좌석/auto 분기 실증). 재진입과의 구분(reentries 불변) 단언 포함.
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT plan(19);

DO $$
DECLARE s RECORD; player_ids uuid[];
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text, true);
  PERFORM set_config('ops.member_id',   s.member_id::text, true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text, true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text, true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);
  PERFORM set_config('ops.seat1',       s.seat1_id::text, true);
  PERFORM set_config('ops.seat2',       s.seat2_id::text, true);
  UPDATE public.ops_tournaments SET status = 'active' WHERE id = s.tournament_id;
  player_ids := public.ops_test_seed_players(s.tournament_id, 3);
  PERFORM set_config('ops.p1', player_ids[1]::text, true);
  PERFORM set_config('ops.p2', player_ids[2]::text, true);
  PERFORM set_config('ops.p3', player_ids[3]::text, true);
  -- p1 착석(원좌석 복원 실증)
  UPDATE public.ops_seats SET participant_id = player_ids[1] WHERE id = s.seat1_id;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── KO bust: p1(칩 30000, seat1) 을 seed 가 KO ──
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, (current_setting('ops.seed_pid'))::uuid);
END $$;

-- ── actor 가드 ──
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [1]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'actor 가드: 명의 위조 거부');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(                                                            -- [2]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
       (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'actor 가드: 비멤버 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── 비-busted 거부 (active 참가자) ──
SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p2'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'UNDO_INVALID_STATE%', '비-busted 참가자 undo 거부');

-- ── undo: 원좌석 복원 + 복원 4필드 + KO 감소 + reentries 불변 ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r_chips',  (r->>'restored_chips'), true);
  PERFORM set_config('ops.r_status', (r->>'status'), true);
  PERFORM set_config('ops.r_seated', (r->>'seated'), true);
END $$;
SELECT is(current_setting('ops.r_chips')::int, 30000, 'undo: 칩 = bust 직전 값 복원');   -- [4]
SELECT is(current_setting('ops.r_status'), 'active', 'undo: 원좌석 확보 → active');       -- [5]
SELECT is(                                                                   -- [6]
  (SELECT participant_id FROM public.ops_seats WHERE id = (current_setting('ops.seat1'))::uuid),
  (current_setting('ops.p1'))::uuid, 'undo: 원좌석(seat1) 복원');
SELECT is(                                                                   -- [7]
  (SELECT finish_position IS NULL AND busted_at IS NULL AND prize_amount IS NULL
   FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  true, 'undo: fp/busted_at/prize_amount 전부 NULL');
SELECT is(                                                                   -- [8]
  (SELECT knockouts FROM public.ops_participants WHERE id = (current_setting('ops.seed_pid'))::uuid),
  0, 'undo: eliminator(seed) knockouts 1→0 롤백');
SELECT is(                                                                   -- [9]
  (SELECT reentries FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  0, 'undo: reentries 불변(재진입과 구분)');
SELECT is(                                                                   -- [10]
  (SELECT count(*)::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_bust_undone'
     AND payload->>'seat_restored' = 'original'),
  1, 'undo: player_bust_undone 이벤트 append(seat_restored=original)');

-- ── 🔨H11 최신 이벤트 판별: 리바이로 칩 변동(30000→60000) 후 재bust·undo — 복원값이 60000 이면
--    seq DESC 가 최신 이벤트를 집은 것(과거 이벤트 30000 과 판별. created_at 은 txn 내 동률이라 무력) ──
DO $$ BEGIN
  PERFORM public.ops_add_rebuy((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid);  -- rebuy_chips=30000 → chips 60000
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
END $$;
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r_h11_chips', (r->>'restored_chips'), true);
END $$;
SELECT is(current_setting('ops.r_h11_chips')::int, 60000,                    -- [11]
  'H11: 최신 bust 이벤트(chips_before=60000) 복원 — seq 전순서 판별(과거 30000 아님)');

-- ── GREATEST 0 방어: knockouts=0 인 seed 를 eliminator 로 재-undo 시나리오 —
--    p1 재bust(eliminator=seed) 후 postgres 로 seed.knockouts 를 0 으로 강제 → undo → 0 유지(음수 금지)
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, (current_setting('ops.seed_pid'))::uuid);
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET knockouts = 0
    WHERE id = (current_setting('ops.seed_pid'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$ BEGIN
  PERFORM public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid);
END $$;
SELECT is(                                                                   -- [12]
  (SELECT knockouts FROM public.ops_participants WHERE id = (current_setting('ops.seed_pid'))::uuid),
  0, 'undo: GREATEST(knockouts-1, 0) — 0 미만 방지(CHECK 위반 방어)');

-- ── auto-seat 분기: p1 의 원좌석을 다른 참가자가 점유 → auto 로 seat2 배정 ──
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_seats SET participant_id = (current_setting('ops.p2'))::uuid
    WHERE id = (current_setting('ops.seat1'))::uuid;  -- 원좌석 선점
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r2_seated', (r->>'seated'), true);
END $$;
SELECT is(current_setting('ops.r2_seated'), 'true', 'undo: 원좌석 점유 시 auto-seat 폴백');  -- [13]
SELECT is(                                                                   -- [14]
  (SELECT participant_id FROM public.ops_seats WHERE id = (current_setting('ops.seat2'))::uuid),
  (current_setting('ops.p1'))::uuid, 'undo: auto 분기 — seat2 배정');

-- ── 🔨H10 재bust fp 값 단언(무좌석 분기 셋업 겸용): p1 은 지금 seat2 에 active ──
-- active 4명(seed·p1·p2·p3)·사용 fp 없음(전부 undo 로 소거) → fp=4 가 미사용 최소값.
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL) INTO r;
  PERFORM set_config('ops.r_refp', (r->>'finish_position'), true);
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_seats SET participant_id = (current_setting('ops.p3'))::uuid
    WHERE id = (current_setting('ops.seat2'))::uuid;  -- 좌석 전부 점유(seat1=p2, seat2=p3)
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(current_setting('ops.r_refp')::int, 4,                             -- [15]
  'H10: undo 후 재bust — fp=4(미사용 최소값 값 단언, 부분 UNIQUE 무충돌)');

-- ── 무좌석 분기: 빈좌석 0 → checked_in ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_undo_bust((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.r3_status', (r->>'status'), true);
END $$;
SELECT is(current_setting('ops.r3_status'), 'checked_in',                    -- [16]
  'undo: 빈좌석 없음 → checked_in(register v2 관례)');

-- ── completed 거부(D2) — 🔨H12 보류 가드 대응: p1(checked_in) 잔존 시 자동확정이 보류되므로
--    postgres 로 p1 을 busted(fp 미부여)로 정리한 뒤 p2·p3 bust 로 우승 자동확정 도달 ──
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'busted'
    WHERE id = (current_setting('ops.p1'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
  PERFORM public.ops_bust_participant((current_setting('ops.p3'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
END $$;
SELECT is(                                                                   -- [17]
  (SELECT status::text FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  'completed', '전제: 우승 자동확정으로 completed(checked_in 0 이라 보류 미발동)');
SELECT throws_like(                                                          -- [18]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p3'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'INVALID_STATUS%', 'D2: completed 대회 undo 거부(우승 자동확정 시나리오 실증)');

-- ── 🔨H1 비멤버 × completed 대회: status 무관하게 PERMISSION_DENIED(에러 차등 오라클 차단) ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [19]
  $$ SELECT public.ops_undo_bust((current_setting('ops.p3'))::uuid,
       (current_setting('ops.outsider_id'))::uuid) $$,
  'PERMISSION_DENIED%', 'H1: 비멤버는 completed 여도 PERMISSION_DENIED(INVALID_STATUS 아님)');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: RED 확인**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: `ops_undo_bust` FAIL(함수 미존재 42883). 기존 파일 PASS 유지.

- [ ] **Step 3: 마이그 3에 undo 작성 (append)**

`20260704100200_ops_1f_prize_rpcs.sql`에 이어서:

```sql
-- ───────────────────────────────────────────────────────────────────────────
-- 2) ops_undo_bust — 오조작 bust 원상 복구(D2: active 중에만·completed 재개방 없음).
--    재진입과 구분: reentries 불변·칩=bust 직전 값 복원·registration_open 무관·KO 롤백.
--    복원 소스 = 최신 player_busted 이벤트(append-only 불변 → 행 잠금 전 조회 안전.
--    eliminator id 를 먼저 알아야 두 참가자 행을 id 오름차순으로 잠글 수 있음 — 4.1 규약 유지).
CREATE FUNCTION public.ops_undo_bust(
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
  v_t_status public.ops_tournament_status;
  v_status public.ops_participant_status;
  v_payload jsonb;
  v_chips_before int;
  v_elim_id uuid;
  v_bust_seat_id uuid;
  v_seat_id uuid;
  v_seat_restored text;
  v_new_status public.ops_participant_status;
  v_seated boolean;
  v_table_no int;
  v_seat_no int;
BEGIN
  -- 1) actor 가드
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 [🔨H1: status 검사·advisory 보다 먼저 — 1d 3종·bust v2 와 동일 순서.
  --    비멤버가 INVALID_STATUS/PERMISSION_DENIED 차등으로 대회 status 를 판별하는 오라클 차단 +
  --    비멤버는 advisory·행 잠금을 점유하지 않음]
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active 한정(D2 — 우승확정 후 completed 면 여기서 차단)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중 대회에서만 탈락 취소가 가능합니다 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) 복원 소스 = 최신 player_busted 이벤트(무잠금 조회 — append-only 불변).
  --    bust→reenter→재bust 이력에서도 "현재 busted = 최신 bust 이벤트" 대응 성립.
  --    [🔨H11] 정렬은 seq(IDENTITY 전순서) — created_at 은 now()=txn 시작 고정이라 동률 비결정.
  SELECT payload INTO v_payload FROM public.ops_events
    WHERE tournament_id = v_tournament_id AND type = 'player_busted'
      AND (payload->>'participant_id')::uuid = p_participant_id
    ORDER BY seq DESC LIMIT 1;
  v_chips_before := COALESCE((v_payload->>'chips_before')::int, 0);  -- E2 fail-safe(구 payload/이론상 부재)
  v_elim_id      := (v_payload->>'eliminator_id')::uuid;
  v_bust_seat_id := (v_payload->>'freed_seat_id')::uuid;

  -- 6) 참가자(+eliminator) id 오름차순 FOR UPDATE(4.1 규약) → busted 검사
  IF v_elim_id IS NOT NULL AND v_elim_id <> p_participant_id THEN
    PERFORM 1 FROM public.ops_participants
      WHERE id IN (p_participant_id, v_elim_id)
      ORDER BY id FOR UPDATE;
  END IF;
  SELECT status INTO v_status
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF v_status <> 'busted' THEN
    RAISE EXCEPTION 'UNDO_INVALID_STATE: 탈락 상태의 참가자만 취소할 수 있습니다 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 7) KO 롤백 — GREATEST 0(CHECK 위반 방어). eliminator 가 그 사이 busted 여도 카운트만 감소(정합).
  IF v_elim_id IS NOT NULL THEN
    UPDATE public.ops_participants
      SET knockouts = GREATEST(knockouts - 1, 0) WHERE id = v_elim_id;
  END IF;

  -- 8) 좌석 3분기: ①원좌석(존재·비점유·open·unlocked) ②auto-seat(빈좌석 첫 자리 —
  --    auto_seat_on_register 설정과 무관하게 항상 시도: undo 는 "물리적으로 앉아 있던 사람"의 복구)
  --    ③빈좌석 없으면 무좌석. SKIP LOCKED = reenter 와 동일 패턴(경합 시 다음 분기 폴백).
  v_seat_id := NULL;
  v_seat_restored := 'none';
  IF v_bust_seat_id IS NOT NULL THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = v_bust_seat_id AND s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      FOR UPDATE OF s SKIP LOCKED;
    IF v_seat_id IS NOT NULL THEN
      v_seat_restored := 'original';
    END IF;
  END IF;
  IF v_seat_id IS NULL THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
    IF v_seat_id IS NOT NULL THEN
      v_seat_restored := 'auto';
    END IF;
  END IF;
  v_seated := v_seat_id IS NOT NULL;
  v_new_status := CASE WHEN v_seated THEN 'active'::public.ops_participant_status
                       ELSE 'checked_in'::public.ops_participant_status END;

  -- 9) 참가자 복원
  UPDATE public.ops_participants
    SET status = v_new_status, chips = v_chips_before,
        finish_position = NULL, busted_at = NULL, prize_amount = NULL
    WHERE id = p_participant_id;

  IF v_seated THEN
    UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = v_seat_id;
    SELECT table_no, seat_no INTO v_table_no, v_seat_no
      FROM public.ops_seats WHERE id = v_seat_id;
  END IF;

  -- 10) 이벤트 + 반환
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_bust_undone', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'restored_chips', v_chips_before,
                             'eliminator_id', v_elim_id,
                             'seat_restored', v_seat_restored));

  RETURN jsonb_build_object(
    'participant_id', p_participant_id,
    'restored_chips', v_chips_before,
    'status', v_new_status,
    'seated', v_seated,
    'table_no', v_table_no,
    'seat_no', v_seat_no);
END;
$function$;
```

- [ ] **Step 4: GREEN 확인**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: `ops_undo_bust` 19단언 PASS + 전 파일 무회귀

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20260704100200_ops_1f_prize_rpcs.sql supabase/tests/ops_undo_bust.test.sql
git commit -m "feat(ops): 1f M3-2 — ops_undo_bust (이벤트 복원·좌석 3분기·KO 롤백·active 한정)"
```

---

### Task 5: ops_correct_participant_prize + create/update bounty_cost + 공개 스냅샷 2종 확장

**Files:**

- Modify: `supabase/migrations/20260704100200_ops_1f_prize_rpcs.sql` (correct·create/update·스냅샷 섹션 append)
- Create: `supabase/tests/ops_prize_correction.test.sql`
- Modify: `supabase/tests/ops_monitor_snapshot.test.sql` (knockoutPool 단언 추가)
- Modify: `supabase/tests/ops_player_view_security.test.sql` (knockouts/bountyAccrued 단언 추가)

**Interfaces:**

- Produces: `ops_correct_participant_prize(p_participant_id uuid, p_actor_id uuid, p_amount int DEFAULT NULL, p_reason text DEFAULT NULL) RETURNS jsonb` — `{participant_id, amount_before, amount_after}`. `ops_create_tournament`/`ops_update_tournament`에 `bounty_cost` 패치(update는 **key-presence 분기** — NULL 되돌리기 지원). `ops_get_monitor_snapshot` stats에 `knockoutPool`, `ops_get_player_view` me에 `knockouts`·`bountyAccrued`

- [ ] **Step 1: pgTAP 먼저 작성 (RED)**

`supabase/tests/ops_prize_correction.test.sql`:

```sql
-- ops 1f — ops_correct_participant_prize: active/completed 허용·upcoming 거부·fp NULL 거부·
--   NULL 회수·비ITM 부여·음수 거부·reason 201자 거부·no-op 이벤트·payload(amount_before 포함 🔨H21)·
--   reenter 리셋 계약·actor 가드·비멤버 에러 균일(🔨H1).
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT plan(17);

DO $$
DECLARE s RECORD; player_ids uuid[];
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text, true);
  PERFORM set_config('ops.member_id',   s.member_id::text, true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text, true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text, true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);
  player_ids := public.ops_test_seed_players(s.tournament_id, 2);
  PERFORM set_config('ops.p1', player_ids[1]::text, true);
  PERFORM set_config('ops.p2', player_ids[2]::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── upcoming 거부 (시드 기본 status=upcoming) ──
SELECT throws_like(                                                          -- [1]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 100000, NULL) $$,
  'INVALID_STATUS%', 'upcoming 대회 정정 거부');

-- ── 🔨H1 비멤버 × upcoming 대회: status 무관하게 PERMISSION_DENIED(에러 차등 오라클 차단) ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [1b]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.outsider_id'))::uuid, 100000, NULL) $$,
  'PERMISSION_DENIED%', 'H1: 비멤버는 upcoming 이어도 PERMISSION_DENIED(INVALID_STATUS 아님)');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- active 전환 + p1 bust(fp=3·상금 없음), 상금 구조 rank1=500000 설정
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_tournaments SET status = 'active'
    WHERE id = (current_setting('ops.t_id'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$ BEGIN
  PERFORM public.ops_set_prize_structure((current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid, '[{"rank":1,"amount":500000}]'::jsonb);
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
END $$;

-- ── actor 가드 ──
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [2]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 50000, NULL) $$,
  'P0001', NULL, 'actor 가드: 명의 위조 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── fp NULL 거부 (active 인 p2) ──
SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.p2'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 50000, NULL) $$,
  'PRIZE_CORRECTION_INVALID%', 'fp NULL(비정산 대상) 거부');

-- ── 값 검증: 음수·201자 reason ──
SELECT throws_like(                                                          -- [4]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, -1, NULL) $$,
  'PRIZE_CORRECTION_INVALID%', '음수 금액 거부');
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 50000, repeat('가', 201)) $$,
  'PRIZE_CORRECTION_INVALID%', 'reason 201자 거부');

-- ── active 중 부여(비ITM자 수동 지급: NULL→50000) + payload ──
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 50000, '딜러 실수 보상') INTO r;
  PERFORM set_config('ops.r_before', COALESCE(r->>'amount_before', 'null'), true);
  PERFORM set_config('ops.r_after',  (r->>'amount_after'), true);
END $$;
SELECT is(current_setting('ops.r_before'), 'null', '부여: amount_before=null(비ITM)');    -- [6]
SELECT is(current_setting('ops.r_after')::int, 50000, '부여: amount_after=50000');        -- [7]
SELECT is(                                                                   -- [8]
  (SELECT prize_amount FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  50000, '부여: DB prize_amount 반영');
SELECT is(                                                                   -- [9]
  (SELECT payload->>'reason' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected'
   ORDER BY created_at DESC LIMIT 1),
  '딜러 실수 보상', 'prize_corrected payload.reason 기록');

-- ── no-op 도 이벤트 기록(감사 명료성) ──
DO $$
DECLARE v_cnt_before int;
BEGIN
  SELECT count(*) INTO v_cnt_before FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected';
  PERFORM set_config('ops.evt_before', v_cnt_before::text, true);
  PERFORM public.ops_correct_participant_prize((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 50000, NULL);  -- 같은 값 = no-op
END $$;
SELECT is(                                                                   -- [10]
  (SELECT count(*)::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected'),
  (current_setting('ops.evt_before'))::int + 1, 'no-op 정정도 이벤트 기록');

-- ── reenter 가 정정값 리셋(1d 계약 실증 — E5) ──
DO $$ BEGIN
  PERFORM public.ops_reenter_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid);
END $$;
SELECT is(                                                                   -- [11]
  (SELECT prize_amount FROM public.ops_participants WHERE id = (current_setting('ops.p1'))::uuid),
  NULL, 'reenter: 정정값 리셋(이력은 이벤트 원장에만 잔존)');

-- ── completed 후에도 허용(D3): p1·p2 bust → 우승 자동확정 → 우승자 정정 + 회수 ──
DO $$ BEGIN
  PERFORM public.ops_bust_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);
  PERFORM public.ops_bust_participant((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL);  -- seed 만 active → 우승확정·completed
END $$;
SELECT is(                                                                   -- [12]
  (SELECT status::text FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  'completed', '전제: 우승 자동확정으로 completed');
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_correct_participant_prize((current_setting('ops.seed_pid'))::uuid,
    (current_setting('ops.owner_id'))::uuid, 450000, '동점 조정') INTO r;
  PERFORM set_config('ops.r2_before', (r->>'amount_before'), true);
END $$;
SELECT is(current_setting('ops.r2_before')::int, 500000,                     -- [13]
  'D3: completed 후 정정 허용(우승 상금 500000→450000)');
-- 🔨H21: 이벤트 payload 의 amount_before 가 실제 이전값으로 기록됨(감사 원장 레벨 고정 —
--   반환값만 검증하면 payload 키 뒤바뀜/누락이 무증상 통과)
SELECT is(                                                                   -- [13b]
  (SELECT (payload->>'amount_before')::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected'
   ORDER BY seq DESC LIMIT 1),
  500000, 'H21: prize_corrected payload.amount_before=500000(원장 레벨)');
-- 회수(p_amount NULL): "수상 아님" 복귀
DO $$ BEGIN
  PERFORM public.ops_correct_participant_prize((current_setting('ops.p2'))::uuid,
    (current_setting('ops.owner_id'))::uuid, NULL, '실격');
END $$;
SELECT is(                                                                   -- [14]
  (SELECT prize_amount FROM public.ops_participants WHERE id = (current_setting('ops.p2'))::uuid),
  NULL, '회수: p_amount NULL → prize_amount NULL');
SELECT is(                                                                   -- [15]
  (SELECT payload->>'amount_after' FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'prize_corrected'
   ORDER BY created_at DESC LIMIT 1),
  NULL, '회수: payload.amount_after=null');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: RED 확인**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: `ops_prize_correction` FAIL(함수 미존재). 기존 무회귀.

- [ ] **Step 3: 마이그 3에 correct + create/update + 스냅샷 확장 작성 (append)**

correct RPC 전문:

```sql
-- ───────────────────────────────────────────────────────────────────────────
-- 3) ops_correct_participant_prize — 개인 지급액 정정(소급)·회수(D3: completed 후에도 허용).
--    순위·상태·구조(ops_prizes) 불변. p_amount NULL = 회수("수상 아님" 복귀), 0 이상 = 설정
--    (기존 NULL 이어도 부여 가능 — 비ITM자 수동 지급 포함). no-op 도 이벤트 기록(감사 명료성).
--    재진입 상호작용(의도): 정정 후 reenter 하면 prize_amount NULL 리셋(1d 계약 유지) — 이력은 이벤트 원장에만.
CREATE FUNCTION public.ops_correct_participant_prize(
  p_participant_id uuid,
  p_actor_id uuid,
  p_amount int DEFAULT NULL,
  p_reason text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_t_status public.ops_tournament_status;
  v_fp int;
  v_before int;
BEGIN
  -- 1) actor 가드
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 [🔨H1: status 검사·advisory 보다 먼저 — 에러 차등 오라클 차단·1d 일관, §4.2 와 동일 근거]
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active/completed 허용(upcoming 거부)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: 시작 전 대회에는 정정할 상금이 없습니다 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) 참가자 FOR UPDATE + 정산 대상(fp NOT NULL = busted 또는 확정 우승자)만
  SELECT finish_position, prize_amount INTO v_fp, v_before
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF v_fp IS NULL THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 순위가 확정된 참가자만 정정할 수 있습니다'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6) 값 검증
  IF p_amount IS NOT NULL AND p_amount < 0 THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 금액은 0 이상이어야 합니다' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NOT NULL AND char_length(p_reason) > 200 THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 사유는 200자 이내여야 합니다' USING ERRCODE = 'P0001';
  END IF;

  -- 7) 변이(no-op 도 이벤트는 기록)
  UPDATE public.ops_participants SET prize_amount = p_amount WHERE id = p_participant_id;

  -- 8) 이벤트(p_reason 은 payload 에만 저장 — 공개 표면 미노출)
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'prize_corrected', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'amount_before', v_before, 'amount_after', p_amount,
                             'reason', p_reason));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'amount_before', v_before, 'amount_after', p_amount);
END;
$function$;
```

create/update 확장 — **기존 함수 본문을 `20260625120200_ops_1a_rpcs.sql`에서 복사해 CREATE OR REPLACE로 재정의**(시그니처 불변 → GRANT 보존). 변경 지점만:

```sql
-- ───────────────────────────────────────────────────────────────────────────
-- 4) ops_create_tournament — bounty_cost 세팅 경로 추가(CREATE OR REPLACE, 시그니처 불변).
--    [변경 3곳] ① INSERT 컬럼 목록 addon_cost 뒤에 `bounty_cost` 추가
--               ② VALUES 의 대응 위치에 `(p_config->>'bounty_cost')::int` 추가
--                  (⚠️ COALESCE 없음 — NULL = 비-바운티 유지. 음수는 T1 CHECK 가 차단)
--               ③ 헤더 주석에 1f 변경 표기
--    나머지 본문(actor 가드·공고 연동 가드·이벤트·반환)은 1a 원문 그대로 복사.

-- 5) ops_update_tournament — bounty_cost 패치 추가(CREATE OR REPLACE, 시그니처 불변).
--    [변경 1곳] UPDATE SET 목록의 addon_cost 줄 다음에:
--      -- bounty_cost 만 key-presence 분기: COALESCE 패치로는 NULL 되돌리기(비-바운티 전환)가 불가.
--      -- 키 없음 = 유지, {"bounty_cost": null} = NULL 로 설정, {"bounty_cost": 5000} = 값 설정.
--      bounty_cost = CASE WHEN p_patch ? 'bounty_cost'
--                         THEN (p_patch->>'bounty_cost')::int
--                         ELSE bounty_cost END,
--    나머지 본문은 1a 원문 그대로 복사.
```

(implementer: 위 주석 블록은 지침이다 — 실제 마이그에는 1a 원문 복사 + 변경 반영된 **완전한 CREATE OR REPLACE 함수 2개**를 넣어라. 원문 위치: `supabase/migrations/20260625120200_ops_1a_rpcs.sql:16-135`)

스냅샷 2종 확장 — **기존 본문 복사 + 필드 추가**(CREATE OR REPLACE, 시그니처 불변 → 기존 anon GRANT 보존):

```sql
-- ───────────────────────────────────────────────────────────────────────────
-- 6) ops_get_monitor_snapshot — stats 에 knockoutPool 추가(비-PII 집계치 — 화이트리스트 심사 승인 D5).
--    원문: 20260628100000_ops_1c3_monitor_rpcs.sql:49-110. [변경 2곳]
--    ① v_stats SELECT 목록 끝에 `, knockout_pool` 추가
--    ② 반환 'stats' jsonb_build_object 끝에 `, 'knockoutPool', v_stats.knockout_pool` 추가
--      (COALESCE 없음 — NULL = 비-바운티 신호 그대로 전달, 클라 카드 숨김)

-- 7) ops_get_player_view — me 에 knockouts·bountyAccrued 추가(본인 행 한정 — 화이트리스트 심사 승인 D5).
--    원문: 20260628120100_ops_claim_split_rpcs.sql:11-71. [변경 3곳]
--    ① v_p SELECT 목록에 `, knockouts` 추가
--    ② v_t SELECT 에 `, bounty_cost` 추가 (bounty_cost 자체는 반환 안 함 — 적립 계산에만 사용)
--    ③ 'me' jsonb_build_object 에:
--       'knockouts', v_p.knockouts,
--       'bountyAccrued', CASE WHEN v_t.bounty_cost IS NULL THEN NULL
--                             ELSE v_p.knockouts * v_t.bounty_cost END
--    ⚠️ ops_get_player_view 는 STEP A 에서 DROP 후 CREATE 된 함수 — 여기선 시그니처 불변이므로
--       CREATE OR REPLACE 사용(GRANT 보존). 파라미터명 변경 아님.
```

(implementer: 마찬가지로 완전한 함수 2개 전문을 마이그에 작성.)

- [ ] **Step 4: 기존 스냅샷 pgTAP 2파일에 신필드 단언 추가**

`ops_monitor_snapshot.test.sql` — 기존 시드에서 스냅샷을 받는 단언 뒤에 추가(plan(N) 카운트 +2 갱신):

```sql
-- 1f: 비-바운티 대회 → stats.knockoutPool = null
SELECT ok(
  (public.ops_get_monitor_snapshot(current_setting('ops.monitor_token'))->'stats'->'knockoutPool') = 'null'::jsonb,
  '1f: 비-바운티 knockoutPool null');
-- 1f: bounty_cost 세팅 후 → 집계 반영 (postgres 로 UPDATE 후 스냅샷 재조회. 트리거는 DEFERRED 이므로
--     SET CONSTRAINTS ALL IMMEDIATE 가 파일 상단에 필요 — 이 파일에 이미 없다면 BEGIN 직후 삽입)
```

(implementer: 이 파일의 기존 시드 변수명·plan 수를 열어 정확히 맞춰라. 대회에 참가자 1명(entries=1)이면 `bounty_cost=10000` 세팅 후 `knockoutPool=10000` 단언.)

`ops_player_view_security.test.sql` — me 반환 단언 블록에 추가(plan +2):

```sql
-- 1f: me.knockouts 노출(기본 0) + 비-바운티 bountyAccrued null
SELECT is((v->'me'->>'knockouts')::int, 0, '1f: me.knockouts=0');
SELECT ok((v->'me'->'bountyAccrued') = 'null'::jsonb, '1f: 비-바운티 bountyAccrued null');
```

(implementer: 이 파일은 뷰 반환을 변수/서브쿼리로 어떻게 받는지 기존 패턴을 그대로 따라라. **금지 필드 부재 단언(phone/nationality/note/player_user_id/claim_pin_hash)이 이미 있다면 신필드가 그 단언을 깨지 않는지 확인** — 화이트리스트 방식이면 필드 추가로 깨질 수 있는 단언은 없어야 정상.)

- [ ] **Step 5: GREEN 확인**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: `ops_prize_correction` 17단언 PASS + 스냅샷 2파일 확장 단언 PASS + 전 파일 무회귀

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/20260704100200_ops_1f_prize_rpcs.sql supabase/tests/
git commit -m "feat(ops): 1f M3-3 — 상금 정정/회수 RPC·bounty_cost 세팅 경로·공개 스냅샷 KO 확장"
```

---

### Task 6: 마이그 4 grants + ops_rpc_security 확장 + supabase.ts 수술

**Files:**

- Create: `supabase/migrations/20260704100300_ops_1f_grants.sql`
- Modify: `supabase/tests/ops_rpc_security.test.sql` (신규 RPC anon 거부 단언)
- Modify: `src/types/supabase.ts` (수술적 추가만 — **전체 재생성 금지**)

**Interfaces:**

- Produces: 신규/재생성 RPC 3종 `REVOKE PUBLIC,anon` + `GRANT authenticated,service_role`. supabase.ts에 knockouts·RPC 시그니처·enum 2값(클라 T7~T12가 소비)

- [ ] **Step 1: grants 마이그 작성**

```sql
-- OPS 1f M4 — 신규/재생성 RPC 권한. 패턴: 20260630120200_ops_1d_grants.sql.
-- bust v2 는 DROP→CREATE 라 재GRANT 필수. create/update/스냅샷 2종은 CREATE OR REPLACE(시그니처
-- 불변)라 기존 GRANT 보존 — 목록 불포함. anon-executable SECDEF ops = monitor/player 2개 불변 계약.
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'ops_bust_participant',
    'ops_undo_bust',
    'ops_correct_participant_prize'
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
    RAISE NOTICE 'ops 1f rpc hardened: %', rec.sig;
  END LOOP;
END $$;
```

- [ ] **Step 2: ops_rpc_security.test.sql 확장** — 기존 plan(5)→plan(11), 파일 상단 EXECUTE 단언 블록에 추가:

```sql
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_bust_participant(uuid,uuid,uuid)', 'EXECUTE'),
  '1f: anon cannot EXECUTE ops_bust_participant(v2 3인자)');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_bust_participant(uuid,uuid,uuid)', 'EXECUTE'),
  '1f: authenticated retains EXECUTE on ops_bust_participant');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_undo_bust(uuid,uuid)', 'EXECUTE'),
  '1f: anon cannot EXECUTE ops_undo_bust');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_undo_bust(uuid,uuid)', 'EXECUTE'),
  '1f: authenticated retains EXECUTE on ops_undo_bust');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_correct_participant_prize(uuid,uuid,integer,text)', 'EXECUTE'),
  '1f: anon cannot EXECUTE ops_correct_participant_prize');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_correct_participant_prize(uuid,uuid,integer,text)', 'EXECUTE'),
  '1f: authenticated retains EXECUTE on ops_correct_participant_prize');
```

- [ ] **Step 3: supabase.ts 수술적 추가** (canonical = PROD 생성본 — 전체 재생성 시 무관 드리프트 유입 금지, prod 적용 후 MCP gen으로 정합 예정)

4곳:

1. `ops_participants`의 Row/Insert/Update 3블록에 `knockouts: number`(Insert/Update는 `knockouts?: number`) — 알파벳순(id 앞·finish_position 뒤).
2. Functions `ops_bust_participant` Args에 `p_eliminator_id?: string | null` 추가.
3. Functions에 알파벳순으로 신규 2종:

```ts
      ops_undo_bust: {
        Args: { p_actor_id: string; p_participant_id: string }
        Returns: Json
      }
      ops_correct_participant_prize: {
        Args: {
          p_actor_id: string
          p_amount?: number | null
          p_participant_id: string
          p_reason?: string | null
        }
        Returns: Json
      }
```

4. `ops_event_type` **두 곳**: Enums 유니온(`:3186대`)에 `| "player_bust_undone" | "prize_corrected"`, Constants 미러 배열(`:3381대`)에 동일 2값 — MCP gen 순서(선언 순서 = enum 순서: 기존 끝에 추가).

- [ ] **Step 4: 검증**

Run: `npm run db:reset && npm run test:db:helpers && npx supabase test db`
Expected: `ops_rpc_security` 11단언 PASS + 전 파일 PASS
Run: `npx tsc --noEmit`
Expected: 0 errors — **주의**: `HistoryTab.tsx`의 `EVENT_LABEL: Record<OpsEventType, string>`이 exhaustive라 enum 2값 추가로 **컴파일 에러가 나는 게 정상**. 이 태스크에서 즉시 라벨 2종 추가:

```ts
  player_bust_undone: '탈락 취소',
  prize_corrected: '상금 정정',
```

(T8이 아니라 여기서 — tsc 게이트를 깨진 채로 커밋하지 않는다)

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20260704100300_ops_1f_grants.sql supabase/tests/ops_rpc_security.test.sql src/types/supabase.ts src/components/ops/HistoryTab.tsx
git commit -m "feat(ops): 1f M4 — grants + rpc_security pgTAP + supabase.ts 수술(knockouts·RPC 2종·enum 2값)"
```

---

# Batch B3 — 클라 (도메인 → 에러/스키마 → 데이터 레이어 → UI)

### Task 7: prizeCurve 도메인 순수함수 (% 환산 + 풀곡선 템플릿)

**Files:**

- Create: `src/domains/ops/prizeCurve/prizeCurve.types.ts`
- Create: `src/domains/ops/prizeCurve/computeAmountsFromPercents.ts`
- Create: `src/domains/ops/prizeCurve/payoutCurves.ts`
- Create: `src/domains/ops/prizeCurve/index.ts`
- Create: `src/domains/ops/prizeCurve/__tests__/computeAmountsFromPercents.test.ts`
- Create: `src/domains/ops/prizeCurve/__tests__/payoutCurves.test.ts`
- Modify: `src/domains/ops/index.ts` (배럴 등록: `export * from './prizeCurve';`)

**Interfaces:**

- Produces: `computeAmountsFromPercents(pool: number, percents: number[]): PrizeCurveResult` · `recommendPayoutCurve(entries: number, itmRatio: ItmRatio): number[]` · `PAYOUT_CURVES` · 타입 `PrizeCurveResult`/`ItmRatio` — T11 PayoutStructureEditor가 소비

- [ ] **Step 1: 실패 테스트 작성**

`prizeCurve.types.ts`:

```ts
/** % → 원화 환산 결과. ok=false 면 UI 가 안내(RPC 미도달 — Zod amount≥1 과 정합). */
export type PrizeCurveResult =
  | { ok: true; amounts: number[] }
  | { ok: false; reason: 'POOL_TOO_SMALL' | 'INVALID_PERCENTS' };

/** ITM 비율 프리셋(10/15/20%). */
export type ItmRatio = 0.1 | 0.15 | 0.2;
```

`__tests__/computeAmountsFromPercents.test.ts` 핵심 케이스(전부 작성):

```ts
import { computeAmountsFromPercents } from '../computeAmountsFromPercents';

describe('computeAmountsFromPercents', () => {
  it('불변식: 반환 amounts 합계 = pool 정확 일치 (property — 다양한 pool×곡선 전수)', () => {
    const pools = [10_000, 123_000, 999_000, 1_234_567, 50_000_000];
    const curves = [[100], [65, 35], [50, 30, 20], [40, 25, 16, 11, 8]];
    for (const pool of pools) {
      for (const percents of curves) {
        const r = computeAmountsFromPercents(pool, percents);
        if (r.ok) {
          expect(r.amounts.reduce((a, b) => a + b, 0)).toBe(pool);
          expect(r.amounts).toHaveLength(percents.length);
        }
      }
    }
  });
  it('1,000원 내림 + 잔여 1위 가산', () => {
    const r = computeAmountsFromPercents(100_500, [65, 35]);
    // floor(65325/1000)*1000=65000, floor(35175/1000)*1000=35000, 잔여 500 → 1위 가산
    expect(r).toEqual({ ok: true, amounts: [65_500, 35_000] });
  });
  it('1,000원 단위에서 0원 행 발생 → 100원 강등 재시도', () => {
    // pool 3000, [50,30,20] → 1000단위: [1000, 0, 0] → 100단위: [1500, 900, 600] 합=3000
    expect(computeAmountsFromPercents(3_000, [50, 30, 20])).toEqual({
      ok: true,
      amounts: [1_500, 900, 600],
    });
  });
  it('100원 강등에도 0원 행 → POOL_TOO_SMALL', () => {
    expect(computeAmountsFromPercents(300, [50, 30, 20])).toEqual({
      ok: false,
      reason: 'POOL_TOO_SMALL',
    });
  });
  it('pool 0/음수/비정수 → POOL_TOO_SMALL', () => {
    expect(computeAmountsFromPercents(0, [100])).toEqual({ ok: false, reason: 'POOL_TOO_SMALL' });
    expect(computeAmountsFromPercents(-1000, [100])).toEqual({
      ok: false,
      reason: 'POOL_TOO_SMALL',
    });
    expect(computeAmountsFromPercents(10000.5, [100])).toEqual({
      ok: false,
      reason: 'POOL_TOO_SMALL',
    });
  });
  it('INVALID_PERCENTS: 빈 배열·0 이하·합계≠100(±0.01 초과)', () => {
    expect(computeAmountsFromPercents(100_000, [])).toEqual({
      ok: false,
      reason: 'INVALID_PERCENTS',
    });
    expect(computeAmountsFromPercents(100_000, [100, 0])).toEqual({
      ok: false,
      reason: 'INVALID_PERCENTS',
    });
    expect(computeAmountsFromPercents(100_000, [60, 30])).toEqual({
      ok: false,
      reason: 'INVALID_PERCENTS',
    });
  });
  it('부동소수 합계 허용(±0.01): 33.5+21+13.5+9.5+7.5+6+5+4 = 100', () => {
    const r = computeAmountsFromPercents(1_000_000, [33.5, 21, 13.5, 9.5, 7.5, 6, 5, 4]);
    expect(r.ok).toBe(true);
  });
});
```

`__tests__/payoutCurves.test.ts`:

```ts
import { PAYOUT_CURVES, recommendPayoutCurve } from '../payoutCurves';

describe('PAYOUT_CURVES', () => {
  it('곡선표 10행 전부 합계 100 고정', () => {
    for (let itm = 1; itm <= 10; itm++) {
      const curve = PAYOUT_CURVES[itm];
      expect(curve).toHaveLength(itm);
      expect(curve.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    }
  });
});

describe('recommendPayoutCurve', () => {
  it('ITM = ceil(entries × ratio), cap 1~10', () => {
    expect(recommendPayoutCurve(30, 0.1)).toEqual(PAYOUT_CURVES[3]);
    expect(recommendPayoutCurve(101, 0.1)).toEqual(PAYOUT_CURVES[10]); // ceil(10.1)=11 → cap 10
    expect(recommendPayoutCurve(5, 0.2)).toEqual(PAYOUT_CURVES[1]);
  });
  it('entries 0/1 경계 → 최소 1', () => {
    expect(recommendPayoutCurve(0, 0.15)).toEqual(PAYOUT_CURVES[1]);
    expect(recommendPayoutCurve(1, 0.15)).toEqual(PAYOUT_CURVES[1]);
  });
  it('부동소수 함정: 20×0.15 는 JS 에서 3.0000000000000004 — ceil 이 4 가 되면 안 됨', () => {
    expect(recommendPayoutCurve(20, 0.15)).toEqual(PAYOUT_CURVES[3]);
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npx jest src/domains/ops/prizeCurve`
Expected: FAIL (모듈 미존재)

- [ ] **Step 3: 구현**

`computeAmountsFromPercents.ts`:

```ts
import type { PrizeCurveResult } from './prizeCurve.types';

const UNITS = [1_000, 100] as const;
const PERCENT_SUM_TOLERANCE = 0.01;

/**
 * % 곡선 → 원화 환산(D1: 서버는 % 를 모름 — 클라 전용 순수함수).
 * 불변식: ok=true 면 amounts 합계 = pool 정확 일치.
 * 알고리즘: 각 floor(pool×pct/100/unit)×unit → 잔여(pool−합)를 1위에 전액 가산.
 * 강등: 1,000원 단위에서 0원 행이 생기면 100원 재시도 → 그래도 0원 행이면 POOL_TOO_SMALL.
 */
export function computeAmountsFromPercents(pool: number, percents: number[]): PrizeCurveResult {
  const sum = percents.reduce((acc, p) => acc + p, 0);
  if (
    percents.length === 0 ||
    percents.some((p) => p <= 0) ||
    Math.abs(sum - 100) > PERCENT_SUM_TOLERANCE
  ) {
    return { ok: false, reason: 'INVALID_PERCENTS' };
  }
  if (!Number.isInteger(pool) || pool <= 0) {
    return { ok: false, reason: 'POOL_TOO_SMALL' };
  }
  for (const unit of UNITS) {
    const floors = percents.map((p) => Math.floor((pool * p) / 100 / unit) * unit);
    if (floors.every((a) => a > 0)) {
      const remainder = pool - floors.reduce((acc, a) => acc + a, 0);
      const amounts = floors.map((a, i) => (i === 0 ? a + remainder : a));
      return { ok: true, amounts };
    }
  }
  return { ok: false, reason: 'POOL_TOO_SMALL' };
}
```

`payoutCurves.ts`:

```ts
import type { ItmRatio } from './prizeCurve.types';

/** 표준 페이아웃 곡선표(스펙 §6.2 — ITM 1~10, 각 행 합계 100 고정. jest 가 전 행 단언). */
export const PAYOUT_CURVES: Readonly<Record<number, readonly number[]>> = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
  4: [44, 27, 17, 12],
  5: [40, 25, 16, 11, 8],
  6: [37, 23, 15, 10, 8, 7],
  7: [35, 22, 14, 10, 8, 6, 5],
  8: [33.5, 21, 13.5, 9.5, 7.5, 6, 5, 4],
  9: [32, 20, 13, 9.5, 7.5, 6, 5, 4, 3],
  10: [31, 19.5, 12.5, 9, 7, 5.5, 4.75, 4, 3.5, 3.25],
};

const ITM_CAP = 10;

/**
 * 엔트리 수 × ITM 비율 → 추천 곡선. cap 10(초과 구간은 수동 편집 안내 — Out).
 * ⚠️ 부동소수 함정: 20×0.15=3.0000000000000004 → ceil 오탈. 정수 % 로 환산 후 나눗셈
 *   (정수/100 의 몫이 정수면 IEEE754 정확) 으로 회피.
 */
export function recommendPayoutCurve(entries: number, itmRatio: ItmRatio): number[] {
  const pct = Math.round(itmRatio * 100);
  const itm = Math.max(1, Math.min(ITM_CAP, Math.ceil((entries * pct) / 100)));
  return [...PAYOUT_CURVES[itm]];
}
```

`index.ts`:

```ts
export * from './prizeCurve.types';
export * from './computeAmountsFromPercents';
export * from './payoutCurves';
```

`src/domains/ops/index.ts` 끝에 `export * from './prizeCurve';` 추가.

- [ ] **Step 4: GREEN 확인**

Run: `npx jest src/domains/ops/prizeCurve`
Expected: 전 케이스 PASS
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: 커밋**

```bash
git add src/domains/ops/prizeCurve src/domains/ops/index.ts
git commit -m "feat(ops): 1f 도메인 — % 환산(합계=풀 불변식)·풀곡선 템플릿 순수함수"
```

---

### Task 8: 에러코드 E6132~E6134 + PREFIX_MAP + prizeCorrectionSchema

**Files:**

- Modify: `src/errors/AppError.ts` (ERROR_CODES + ERROR_MESSAGES 2블록)
- Modify: `src/repositories/supabase/opsRpcError.ts` (PREFIX_MAP 3엔트리)
- Modify: `src/repositories/supabase/__tests__/opsRpcError.test.ts`
- Modify: `src/schemas/opsPrize.schema.ts` (prizeCorrectionSchema 추가)
- Create: `src/schemas/__tests__/opsPrize.schema.test.ts` (없으면 신규 — 기존 스키마 테스트 위치 관례 확인 후 인접 배치)

**Interfaces:**

- Produces: `ERROR_CODES.OPS_ELIMINATOR_INVALID('E6132')`/`OPS_UNDO_INVALID_STATE('E6133')`/`OPS_PRIZE_CORRECTION_INVALID('E6134')` · `prizeCorrectionSchema`(T9 service가 소비)

- [ ] **Step 1: 실패 테스트 — opsRpcError.test.ts에 신규 3 prefix 케이스 추가**

기존 `it.each` 패턴(파일 `:120-131`)에 추가:

```ts
  ['ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다', ERROR_CODES.OPS_ELIMINATOR_INVALID],
  ['UNDO_INVALID_STATE: 탈락 상태의 참가자만 취소할 수 있습니다', ERROR_CODES.OPS_UNDO_INVALID_STATE],
  ['PRIZE_CORRECTION_INVALID: 금액은 0 이상이어야 합니다', ERROR_CODES.OPS_PRIZE_CORRECTION_INVALID],
```

- 기존 파일의 "한글 userMessage 존재(폴백 적발)" describe(`:153-171` 패턴)에 3코드 추가.

* [ ] **Step 2: RED 확인** — `npx jest opsRpcError` → FAIL(코드 미정의)

* [ ] **Step 3: 구현**

`AppError.ts` ERROR_CODES 블록(`:208` 뒤):

```ts
  OPS_ELIMINATOR_INVALID: 'E6132', // 1f: 넉아웃 상대 무효(자기자신/미존재/타대회/비활성)
  OPS_UNDO_INVALID_STATE: 'E6133', // 1f: 탈락 취소 불가 상태
  OPS_PRIZE_CORRECTION_INVALID: 'E6134', // 1f: 상금 정정 대상/값 무효
```

ERROR_MESSAGES 블록(`:251` 뒤):

```ts
  [ERROR_CODES.OPS_ELIMINATOR_INVALID]: '넉아웃 상대가 올바르지 않아요.',
  [ERROR_CODES.OPS_UNDO_INVALID_STATE]: '탈락 취소를 할 수 없는 상태예요.',
  [ERROR_CODES.OPS_PRIZE_CORRECTION_INVALID]: '상금 정정 대상이나 값이 올바르지 않아요.',
```

`opsRpcError.ts` PREFIX_MAP — **순서 주의**: `PRIZE_CORRECTION_INVALID`는 기존 `PRIZE_STRUCTURE_INVALID`(`:83`)와 접두사가 다르므로 충돌 없지만, `includes()` 매칭이라 **더 구체적인(긴) 접두사를 짧은 것보다 앞에** 두는 파일 관례를 따라 3엔트리를 기존 참가자/상금 블록에 배치:

```ts
  ['ELIMINATOR_INVALID', ERROR_CODES.OPS_ELIMINATOR_INVALID, ERROR_CODES.OPS_ELIMINATOR_INVALID],
  ['UNDO_INVALID_STATE', ERROR_CODES.OPS_UNDO_INVALID_STATE, ERROR_CODES.OPS_UNDO_INVALID_STATE],
  ['PRIZE_CORRECTION_INVALID', ERROR_CODES.OPS_PRIZE_CORRECTION_INVALID, ERROR_CODES.OPS_PRIZE_CORRECTION_INVALID],
```

`opsPrize.schema.ts`에 추가(기존 prizeRowSchema/prizeStructureSchema 유지):

```ts
import { xssValidation } from '@/utils/security';

/** 1f 상금 정정 입력. amount null = 회수. uuid 는 그룹형 정규식(#220 — .uuid() RFC4122 strict 함정). */
const uuidLike = z
  .string()
  .refine(
    (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    'UUID 형식이 아니에요.'
  );

export const prizeCorrectionSchema = z.object({
  participantId: uuidLike,
  amount: z.number().int().min(0).nullable(),
  reason: z
    .string()
    .trim()
    .max(200, '사유는 200자 이내로 입력해 주세요.')
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' })
    .nullable()
    .optional(),
});
export type PrizeCorrectionInput = z.infer<typeof prizeCorrectionSchema>;
```

스키마 테스트(음수·200자 초과·xss·null 회수·정상):

```ts
import { prizeCorrectionSchema } from '../opsPrize.schema';

const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('prizeCorrectionSchema', () => {
  it('정상: 금액 설정/회수(null)/사유 생략', () => {
    expect(
      prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: 50000 }).success
    ).toBe(true);
    expect(
      prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: null, reason: '실격' })
        .success
    ).toBe(true);
  });
  it('거부: 음수·소수·201자·xss·비-uuid', () => {
    expect(prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: -1 }).success).toBe(
      false
    );
    expect(prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: 1.5 }).success).toBe(
      false
    );
    expect(
      prizeCorrectionSchema.safeParse({
        participantId: VALID_ID,
        amount: 0,
        reason: '가'.repeat(201),
      }).success
    ).toBe(false);
    expect(
      prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: 0, reason: '<script>x' })
        .success
    ).toBe(false);
    expect(prizeCorrectionSchema.safeParse({ participantId: 'not-uuid', amount: 0 }).success).toBe(
      false
    );
  });
});
```

- [ ] **Step 4: GREEN** — `npx jest opsRpcError opsPrize` 전 PASS · `npx tsc --noEmit` 0

- [ ] **Step 5: 커밋**

```bash
git add src/errors/AppError.ts src/repositories/supabase/opsRpcError.ts src/repositories/supabase/__tests__/opsRpcError.test.ts src/schemas/
git commit -m "feat(ops): 1f 에러 E6132~E6134 매핑 + prizeCorrectionSchema"
```

---

### Task 9: 데이터 레이어 — repo/service/hooks + types/ops.ts

**Files:**

- Modify: `src/types/ops.ts`
- Modify: `src/repositories/interfaces/IOpsParticipantRepository.ts`
- Modify: `src/repositories/supabase/OpsParticipantRepository.ts`
- Modify: `src/services/ops/opsParticipantService.ts`
- Modify: `src/hooks/ops/useOpsMutations.ts`
- Test: 기존 서비스/훅 테스트 위치 관례에 따라 인접 확장(`src/services/ops/__tests__/` 존재 시)

**Interfaces:**

- Consumes: T6 supabase.ts RPC 타입 · T8 `prizeCorrectionSchema`
- Produces (T10~T12 UI가 소비):
  - `OpsParticipant.knockouts: number`
  - `OpsUndoBustResult { participantId; restoredChips; status; seated; tableNo: number | null; seatNo: number | null }`
  - `OpsPrizeCorrectionResult { participantId; amountBefore: number | null; amountAfter: number | null }`
  - repo/service: `bustParticipant(participantId, actorId, eliminatorId?)` · `undoBust(participantId, actorId)` · `correctPrize(input: PrizeCorrectionInput, actorId)`
  - hooks: `useBustParticipant()`(mutationFn 인자 `{ participantId, eliminatorId? }` — **기존 호출부 `[id].tsx` 시그니처 변경 수반**) · `useUndoBust()`(invalidate participants/seats/liveStats) · `useCorrectPrize()`(invalidate participants)
  - `OpsMonitorSnapshot['stats'].knockoutPool: number | null` · `OpsPlayerView['me']`에 `knockouts: number`·`bountyAccrued: number | null`

- [ ] **Step 1: types/ops.ts 확장**

`OpsParticipant`에 `knockouts: number;`(reentries 다음 줄). `OpsBustResult` 아래에:

```ts
/** 1f: 탈락 취소 결과(bust 직전 상태 복원 — reentries 불변·칩 복원). */
export interface OpsUndoBustResult {
  participantId: string;
  restoredChips: number;
  status: OpsParticipant['status'];
  seated: boolean;
  tableNo: number | null;
  seatNo: number | null;
}

/** 1f: 상금 정정/회수 결과. */
export interface OpsPrizeCorrectionResult {
  participantId: string;
  amountBefore: number | null;
  amountAfter: number | null;
}
```

`OpsMonitorSnapshot`의 stats에 `knockoutPool: number | null;` · `OpsPlayerView`의 me에 `knockouts: number;`·`bountyAccrued: number | null;` 추가.

- [ ] **Step 2: Repository (인터페이스 → 구현)**

인터페이스:

```ts
bustParticipant(participantId: string, actorId: string, eliminatorId?: string | null): Promise<OpsBustResult>;
undoBust(participantId: string, actorId: string): Promise<OpsUndoBustResult>;
correctPrize(participantId: string, actorId: string, amount: number | null, reason?: string | null): Promise<OpsPrizeCorrectionResult>;
```

구현 — 기존 `bustParticipant`(`:92-125`)의 rpc 인자에 `p_eliminator_id: eliminatorId ?? null` 추가(수동 camel 매핑 그대로). 신규 2메서드는 기존 패턴 복제:

```ts
async undoBust(participantId: string, actorId: string): Promise<OpsUndoBustResult> {
  const { data, error } = await supabase.rpc('ops_undo_bust', {
    p_participant_id: participantId,
    p_actor_id: actorId,
  });
  if (error) mapOpsRpcError(error, { operation: 'ops 탈락 취소' });
  const row = data as unknown as {
    participant_id: string; restored_chips: number; status: string;
    seated: boolean; table_no: number | null; seat_no: number | null;
  };
  return {
    participantId: row.participant_id,
    restoredChips: row.restored_chips,
    status: row.status as OpsParticipant['status'],
    seated: row.seated,
    tableNo: row.table_no ?? null,
    seatNo: row.seat_no ?? null,
  };
}

async correctPrize(
  participantId: string, actorId: string, amount: number | null, reason?: string | null
): Promise<OpsPrizeCorrectionResult> {
  const { data, error } = await supabase.rpc('ops_correct_participant_prize', {
    p_participant_id: participantId,
    p_actor_id: actorId,
    p_amount: amount,
    p_reason: reason ?? null,
  });
  if (error) mapOpsRpcError(error, { operation: 'ops 상금 정정' });
  const row = data as unknown as {
    participant_id: string; amount_before: number | null; amount_after: number | null;
  };
  return {
    participantId: row.participant_id,
    amountBefore: row.amount_before ?? null,
    amountAfter: row.amount_after ?? null,
  };
}
```

- [ ] **Step 3: Service** — `opsParticipantService`에 위임 2종 + correct는 Zod 경계(registerParticipant `:12-34` 패턴 복제). 🔨H2 **bustParticipant 확장에는 eliminatorId 그룹형 uuid 가드**(스펙 §7.5 지시 — 무검증 통과 시 비-uuid 가 22P02→INFRA_NOT_FOUND 오도 표면):

```ts
// bustParticipant(participantId, actorId, eliminatorId?) — 확장부에 경계 가드 추가:
if (eliminatorId != null && !UUID_LIKE_RE.test(eliminatorId)) {
  throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
    userMessage: '넉아웃 상대 식별자가 올바르지 않아요.',
  });
}
// UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i (그룹형 — T8 uuidLike 와 동일 소스 재사용 권장)

async undoBust(participantId: string, actorId: string): Promise<OpsUndoBustResult> {
  // participantId 만 받으므로 스키마 없음(bust/reenter 와 동일) — repository 위임 + 에러 래핑
},
async correctPrize(input: PrizeCorrectionInput, actorId: string): Promise<OpsPrizeCorrectionResult> {
  const parsed = prizeCorrectionSchema.safeParse(input);
  if (!parsed.success) { /* registerParticipant 와 동일: ValidationError(ERROR_CODES.VALIDATION_SCHEMA, 첫 필드에러) */ }
  return opsParticipantRepository.correctPrize(
    parsed.data.participantId, actorId, parsed.data.amount, parsed.data.reason ?? null);
},
```

(implementer: logger.info + isAppError 재던짐 + handleServiceError 래핑을 파일 기존 패턴 그대로.)

- [ ] **Step 4: Hooks (useOpsMutations.ts)**

`useBustParticipant` mutationFn을 `(vars: { participantId: string; eliminatorId?: string | null })`로 확장(서비스에 eliminatorId 전달). onSuccess invalidate 기존 유지(participants/seats/liveStats + winnerFinalized → tournamentDetail).

신규 2훅(파일 기존 패턴 — requireActor/toast/logger):

```ts
export function useUndoBust(tournamentId: string) {
  // mutationFn: opsParticipantService.undoBust(participantId, actor)
  // onSuccess: invalidate participants·seats·liveStats + toast.success(`탈락 취소됨 · 칩 ${result.restoredChips.toLocaleString()} 복원`)
  // onError: logger.error + toast.error(extractUserMessage(e) || '탈락 취소에 실패했습니다')
}
export function useCorrectPrize(tournamentId: string) {
  // mutationFn: opsParticipantService.correctPrize(input, actor)
  // onSuccess: invalidate participants + toast.success('상금 정정됨')
  // onError: toast.error(extractUserMessage(e) || '상금 정정에 실패했습니다')
}
```

- [ ] **Step 5: 기존 호출부 컴파일 정합** — `[id].tsx`의 `bustMut.mutate(item.id, ...)` → `bustMut.mutate({ participantId: item.id }, ...)` (T10에서 UI 확장 전이라도 tsc 게이트 유지).

- [ ] **Step 6: 검증** — `npx tsc --noEmit` 0 · `npx jest src/services/ops src/hooks` PASS(기존 스위트 회귀 0)

- [ ] **Step 7: 커밋**

```bash
git add src/types/ops.ts src/repositories/ src/services/ops/ src/hooks/ops/ app/
git commit -m "feat(ops): 1f 데이터 레이어 — bust v2 eliminatorId·undoBust·correctPrize 3계층 배선"
```

---

### Task 10: PLAYERS 탭 — 컴포넌트 추출 + bust 다이얼로그 v2 + 탈락 취소 + KO 배지

**Files:**

- Create: `src/components/ops/PlayersTab.tsx` (`app/(ops)/tournaments/[id].tsx:146-335`의 PLAYERS 인라인 섹션 추출)
- Modify: `app/(ops)/tournaments/[id].tsx` (PLAYERS 분기를 `<PlayersTab>` 호출로 교체 — 397줄 → 감량)
- Modify: `src/components/ui/BottomSheet.tsx` (SelectBottomSheet snapPoints/scrollable prop 관통 — 🔨H3. 웹 미러 파일 존재 시 동일)

**Interfaces:**

- Consumes: T9 `useBustParticipant({participantId, eliminatorId?})`/`useUndoBust` · `OpsTournament.bountyCost` · `OpsParticipant.knockouts` · `SelectBottomSheet`(`@/components/ui/BottomSheet`)
- Produces: `PlayersTab({ tournament, participants, isLoading }: { tournament: OpsTournament; participants: OpsParticipant[]; isLoading: boolean })` — [id].tsx가 렌더

- [ ] **Step 1: PlayersTab.tsx로 기존 인라인 추출(동작 불변 리팩토링 먼저)**

기존 `[id].tsx:146-335`의 PLAYERS 렌더(등록 폼·참가자 리스트·리바이/애드온/탈락/재진입 버튼·PlayerClaimButton)를 그대로 이동. 훅(useRegisterParticipant/useAddRebuy/useAddAddon/useBustParticipant/useReenterParticipant)도 컴포넌트 내부로 이동. `[id].tsx`는 `activeTab === 'players' ? <PlayersTab tournament={tournament} participants={participants} isLoading={participantsLoading} /> : …`.

Run: `npx tsc --noEmit` → 0 (리팩토링 완료 게이트)

- [ ] **Step 2: SelectBottomSheet prop 관통 (🔨H3 — 선행 소규모 수정)**

`src/components/ui/BottomSheet.tsx`의 `SelectBottomSheetProps`에 `snapPoints?: string[]`·`scrollable?: boolean`을 추가하고 내부 `<BottomSheet>`에 전달(기본값은 기존과 동일 `['40%']`/`false` — 기존 호출부 무영향). `BottomSheet.web.tsx`(웹 미러)가 있으면 동일 수정. 현행은 40% 고정 + plain View 렌더라 옵션 ~6개 이상이면 하단·'지정 안 함' 도달 불가 — eliminator 피커는 active 전원이 대상이라 실전(9-max 1테이블)에서 즉시 막힌다.

Run: `npx tsc --noEmit` → 0 (기존 SelectBottomSheet 호출부 무회귀)

- [ ] **Step 3: bust 다이얼로그 v2**

기존 bust `Alert.alert` 확인을 분기:

```tsx
const isBountyTournament = tournament.bountyCost !== null && tournament.bountyCost !== undefined;
const [eliminatorPickerFor, setEliminatorPickerFor] = useState<OpsParticipant | null>(null);

const handleBustPress = (target: OpsParticipant) => {
  if (!isBountyTournament) {
    // 기존 그대로: Alert.alert('탈락 처리', `${target.name} 님을 탈락 처리할까요?`, [취소, 탈락 처리(destructive) → bustMut.mutate({ participantId: target.id }, { onSuccess: 기존 분기 })])
    return;
  }
  setEliminatorPickerFor(target); // 바운티 대회 → SelectBottomSheet
};
```

```tsx
<SelectBottomSheet
  visible={eliminatorPickerFor !== null}
  onClose={() => setEliminatorPickerFor(null)}
  title={`${eliminatorPickerFor?.name ?? ''} 님을 누가 눌렀나요?`}
  snapPoints={['60%', '90%']} // 🔨H3
  scrollable // 🔨H3
  options={[
    { label: '지정 안 함', value: '' }, // 🔨H3: 기본 이탈 경로를 최상단(항상 가시)
    ...participants
      .filter((p) => p.status === 'active' && p.id !== eliminatorPickerFor?.id)
      .map((p) => ({ label: `#${p.entryNumber} ${p.name}`, value: p.id })),
  ]}
  onSelect={(value) => {
    const target = eliminatorPickerFor;
    if (!target) return;
    setEliminatorPickerFor(null);
    const eliminatorId = value === '' ? null : value;
    const eliminatorName =
      eliminatorId === null
        ? '지정 안 함'
        : (participants.find((p) => p.id === eliminatorId)?.name ?? '');
    // 🔨H4: 스펙 §7.2 "선택 → 확인 → bust" 확인 단계 복원 — 즉시 mutate 금지.
    // 헤즈업 오탭이 즉시 우승 자동확정(completed)으로 이어지면 D2 로 undo 불가(비가역).
    Alert.alert('탈락 처리', `${target.name} 님 탈락 · KO: ${eliminatorName}`, [
      { text: '취소', style: 'cancel' },
      {
        text: '탈락 처리',
        style: 'destructive',
        onPress: () =>
          bustMut.mutate(
            { participantId: target.id, eliminatorId },
            { onSuccess: /* 기존 우승/ITM Alert 분기 그대로 */ }
          ),
      },
    ]);
  }}
/>
```

- [ ] **Step 4: 탈락 취소 + KO 배지**

busted 행 버튼 나열(기존 재진입 옆)에 대회 active일 때만:

```tsx
{
  tournament.status === 'active' && item.status === 'busted' && (
    <Pressable
      className="min-h-[44px] justify-center rounded-lg border border-amber-500 px-3 dark:border-amber-400"
      onPress={() =>
        Alert.alert('탈락 취소', `${item.name} 님의 탈락을 취소할까요?\n칩과 좌석이 복원됩니다.`, [
          { text: '취소', style: 'cancel' },
          { text: '탈락 취소', style: 'destructive', onPress: () => undoMut.mutate(item.id) },
        ])
      }
    >
      <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">탈락 취소</Text>
    </Pressable>
  );
}
```

(성공 토스트는 T9 훅 onSuccess가 담당 — "탈락 취소됨 · 칩 n 복원")

active 행 이름 옆 KO 배지:

```tsx
{
  isBountyTournament && item.knockouts > 0 && (
    <View className="rounded-full bg-red-100 px-2 py-0.5 dark:bg-red-900/40">
      <Text className="text-[10px] font-bold text-red-600 dark:text-red-300">
        KO {item.knockouts}
      </Text>
    </View>
  );
}
```

- [ ] **Step 5: 검증** — `npx tsc --noEmit` 0 · `npx jest src/components/ops --passWithNoTests` · 파일 줄수 확인(PlayersTab ≤ 400 권장)

- [ ] **Step 6: 커밋**

```bash
git add src/components/ops/PlayersTab.tsx src/components/ui/BottomSheet.tsx app/
git commit -m "feat(ops): 1f PLAYERS — 탭 추출 + KO bust 확인 다이얼로그·탈락 취소·KO 배지 + 피커 스크롤"
```

---

### Task 11: PAYOUTS 재설계 — 구조 편집기 + 페이아웃 대장 + 정정 시트

**Files:**

- Rewrite: `src/components/ops/PayoutsTab.tsx` (컨테이너 — 2부 전환)
- Create: `src/components/ops/PayoutStructureEditor.tsx`
- Create: `src/components/ops/PayoutLedger.tsx`
- Create: `src/components/ops/PrizeCorrectSheet.tsx`
- Test: `src/components/ops/__tests__/payoutRows.test.ts` (rank 재부여·% 환산 표시 등 순수 로직 — 로직을 컴포넌트 밖 함수로 추출해 테스트)

**Interfaces:**

- Consumes: T7 `computeAmountsFromPercents`/`recommendPayoutCurve` · T9 `useCorrectPrize` · 기존 `useOpsPrizes`/`useSetPrizeStructure`/`useOpsParticipants`/`useOpsLiveStats` · `SheetModal`/`SelectBottomSheet`
- Produces: `PayoutsTab({ tournament }: { tournament: OpsTournament })` — 편집기/대장 세그먼트 전환 컨테이너

- [ ] **Step 1: 순수 로직 추출 + 테스트 먼저**

`PayoutStructureEditor.tsx` 안에 두지 말고 파일 상단 export(또는 `payoutRows.ts` 분리 — 200~400줄 관례 판단)로:

```ts
/** 행 삭제/추가 후 rank 1..N 연속 재부여(기존 rank 갭 결함 해소 — 저장 payload 는 항상 연속). */
export function reindexRows<T>(rows: T[]): (T & { rank: number })[] {
  return rows.map((row, i) => ({ ...(row as object as T), rank: i + 1 }));
}
```

테스트: 3행에서 2번째 삭제 → rank [1,2] · 추가 → 끝 rank N+1 · 빈 배열 → [].

- [ ] **Step 2: PayoutStructureEditor**

구조(스펙 §7.1 A):

- 모드 세그먼트 `금액 | %` (`useState<'amount' | 'percent'>`)
- **금액 모드**: 기존 PayoutsTab draft 패턴 승계(`rows: { amount: string }[]` — rank는 인덱스 파생) + **행 삭제 버튼**(각 행 우측 ✕, `rows.filter((_, i) => i !== idx)`) + 행 추가. 저장 payload는 `reindexRows`로 항상 연속 — **기존 `.filter(amount>0)` 제거**(0/빈 행은 저장 전 검증 에러로 안내: "금액이 비어 있는 행이 있어요")
- **% 모드**: `percents: string[]` 로컬 상태. 행별 `현재 풀 기준 환산` 원화 병기(`computeAmountsFromPercents(stats.prizePool, parsedPercents)` — ok=false면 사유 안내 배너: POOL_TOO_SMALL "풀이 작아 1,000원/100원 단위 분배가 불가해요", INVALID_PERCENTS "비율 합계가 100이 되어야 해요(현재 {sum}%)")
- **템플릿 추천 버튼** → `SelectBottomSheet` options = ITM 10/15/20% × 현재 entries(`recommendPayoutCurve(stats.entries, ratio)` 즉시 적용 → % 모드 전환 + percents 세팅)
- **"현재 풀 기준 재계산"** 버튼(% 모드 전용): 현재 percents로 재환산 → 미리보기 갱신(환산은 저장 시에도 재실행)
- **풀 대비 바**: `합계 {sum} / 현재 풀 {stats.prizePool} / 잔여 {stats.prizePool - sum}` 3값 + 합계>풀이면 경고색(`text-amber-600 dark:text-amber-400`) — **저장은 차단하지 않음**(풀은 참고치, 1d 의도)
- **저장**: % 모드면 환산 amounts → `{ rank: i+1, amount }`, 금액 모드면 reindex → 기존 `useSetPrizeStructure`. `tournament.status === 'active'`면 저장 전 확인 — 🔨H18 **`ConfirmModal`(`@/components/ui/Modal` — 범용, 실존)** 사용: LEVELS 진행 중 편집 가드(BlindLevelsTab.tsx:176)와 **동형**(스펙 §7.1 원문). 메시지 "이미 탈락한 참가자에게는 소급되지 않아요. 저장할까요?" (Alert.alert 아님 — 같은 화면의 두 탭이 동일 시맨틱 가드에 다른 다이얼로그를 쓰면 안 됨)

- [ ] **Step 3: PayoutLedger + PrizeCorrectSheet**

`PayoutLedger` — 데이터: `useOpsPrizes`(구조) + `useOpsParticipants`(fp·prize_amount·knockouts) 클라 조인:

```ts
const ledgerRows = prizes.map((prize) => {
  const winner = participants.find((p) => p.finishPosition === prize.rank) ?? null;
  return {
    rank: prize.rank,
    structureAmount: prize.amount,
    winnerName: winner?.name ?? null,
    participantId: winner?.id ?? null,
    paidAmount: winner?.prizeAmount ?? null,
    corrected: winner !== null && winner.prizeAmount !== prize.amount, // 구조≠실지급 하이라이트
  };
});
// 🔨H20: 구조 밖 행은 "fp NOT NULL 전원"(prize NULL 미지급 포함 — 실지급 '—' 표기).
// prizeAmount !== null 로 좁히면 §4.3 의 "비ITM자 최초 부여(NULL→금액)"가 UI 에서 도달 불가(유령 기능).
const extraRows = participants
  .filter((p) => p.finishPosition != null && !prizes.some((z) => z.rank === p.finishPosition))
  .map((p) => ({
    rank: p.finishPosition as number,
    structureAmount: null,
    winnerName: p.name,
    participantId: p.id,
    paidAmount: p.prizeAmount ?? null,
    corrected: p.prizeAmount !== null, // 구조 없는데 지급 있음 = 수동 부여 하이라이트
  }));
```

- 행 렌더: `{rank}위 · {winnerName ?? '미확정'} · 구조 {structureAmount ?? '—'} · 실지급 {paidAmount ?? '—'}` + corrected면 amber 하이라이트
- **바운티 섹션**(bountyCost != null인 대회만): `participants.filter(p => p.knockouts > 0)` → `이름 · KO {n} · 적립 {n × bountyCost}` + 합계
- 행 탭(**participantId 있는 행 전부** — prize NULL 미지급 행 포함 🔨H20) → `PrizeCorrectSheet` 오픈(최초 부여 진입점)

`PrizeCorrectSheet` — `SheetModal` 기반(텍스트 입력 동반 확인은 SheetModal 관례):

```tsx
interface Props {
  visible: boolean;
  onClose: () => void;
  participant: { id: string; name: string; prizeAmount: number | null } | null;
  tournamentId: string;
}
// 내용: 현재 금액 표시 → 새 금액 TextInput(keyboardType="number-pad") → 사유 TextInput(선택, maxLength 200)
// footer: [회수](destructive — Alert.alert 재확인 후 correctMut.mutate({ participantId, amount: null, reason }))
//         [저장](correctMut.mutate({ participantId, amount: parsedAmount, reason }))
// completed 후에도 동작(D3) — 상태 게이트 없음
```

- [ ] **Step 4: PayoutsTab 컨테이너 재작성**

```tsx
export function PayoutsTab({ tournament }: { tournament: OpsTournament }) {
  const [section, setSection] = useState<'editor' | 'ledger'>('editor');
  // 세그먼트(구조 편집 | 페이아웃 대장 — [id].tsx 탭 세그먼트와 동일 스타일) + 분기 렌더
}
```

`[id].tsx`의 `<PayoutsTab />` 호출부에 `tournament` prop 전달.

- [ ] **Step 5: 검증** — `npx jest src/components/ops src/domains/ops` PASS · `npx tsc --noEmit` 0 · 각 파일 ≤400줄 확인

- [ ] **Step 6: 커밋**

```bash
git add src/components/ops/ app/
git commit -m "feat(ops): 1f PAYOUTS 2부 — %·템플릿 구조 편집기 + 페이아웃 대장·정정 시트 (rank 갭 해소)"
```

---

### Task 12: 종료 결과 뷰 + KO POOL 카드 + 생성 폼 바운티 + 공개 표면 2종

**Files:**

- Create: `src/components/ops/TournamentResultCard.tsx`
- Modify: `app/(ops)/tournaments/[id].tsx` (STATUS 탭 completed 분기)
- Modify: `src/components/ops/LiveStatsPanel.tsx` (KO POOL 조건부 카드)
- Modify: `app/(ops)/tournaments/new.tsx` (바운티 입력)
- Modify: `app/(public)/monitor/[token].tsx` (KO POOL 스트립 카드)
- Modify: `app/(public)/live/[view_token].tsx` (내 KO/적립)
- Modify: `src/repositories/interfaces/IOpsTournamentRepository.ts` (🔨H6 — `OpsTournamentCostConfig`에 `bountyCost: number | null` 추가)
- Modify: `src/schemas/opsTournament.schema.ts` (🔨H6 — `opsCostConfigSchema`에 `bountyCost: z.number().int().min(0).nullable()` 추가 + jest에 null/음수 케이스 1건)
- Modify: `src/repositories/supabase/OpsTournamentRepository.ts` (🔨H6 — create `p_config` 수동 7키 매핑(`:90-98`)에 `bounty_cost: input.config.bountyCost` 1줄 추가)

**Interfaces:**

- Consumes: T9 공개 뷰 타입 확장(`knockoutPool`/`knockouts`/`bountyAccrued`) · `useOpsParticipants`/`useOpsLiveStats`/`useOpsPrizes`

- [ ] **Step 1: TournamentResultCard** (스펙 §7.3 — Alert 증발 해소)

```tsx
export function TournamentResultCard({ tournament }: { tournament: OpsTournament }) {
  const { participants } = useOpsParticipants(tournament.id);
  const { stats } = useOpsLiveStats(tournament.id);
  const ranked = [...participants]
    .filter((p) => p.finishPosition !== null && p.finishPosition !== undefined)
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
  // 🔨H14: 우승자는 fp===1 만 — ranked[0] 은 수동 active→completed(딜/chop 종료, 합법 전이)에서
  // fp=1 이 없을 때 최저 fp "탈락자"를 우승자로 오표기한다.
  const winner = ranked.find((p) => p.finishPosition === 1) ?? null;
  const totalPaid = ranked.reduce((acc, p) => acc + (p.prizeAmount ?? 0), 0);
  // 렌더: 🏆 우승 카드 — winner 있으면 name·prizeAmount, 없으면 "우승자 미확정(수동 종료)" 빈 상태(H14)
  //  + 최종 순위표(fp asc — {fp}위 {name} {prizeAmount ?? '—'})
  //  + 정산 요약(총 풀 stats.prizePool·지급 합계 totalPaid·KO 풀 stats.knockoutPool(!=null 시)·엔트리 stats.entries·재진입 stats.reentriesTotal)
}
```

`[id].tsx` STATUS 분기(🔨H7 — 카드별 처지 명세): `tournament.status === 'completed'`면 ①클럭 카드(`ClockControl`) 대신 `<TournamentResultCard tournament={tournament} />` ②`LiveStatsPanel`·`MonitorLinkButton` **유지** ③등록(SUBSCRIPTIONS) 토글 카드 **숨김**(completed 대회의 등록 재개방 조작은 무의미·혼란 표면) ④상태 카드 **유지**(nextStatusActions가 completed에서 빈 배열 — 표시 전용).

- [ ] **Step 2: LiveStatsPanel KO POOL 조건부 카드**

카드 배열이 3열 그리드 하드코딩(9개)이므로: `stats.knockoutPool != null`이면 배열에 `{ label: 'KO POOL', value: formatNumber(stats.knockoutPool) }` push — **10번째 카드가 마지막 행에 홀로 남으므로**, 렌더 그리드가 `flex-row flex-wrap` + 카드 `w-1/3`(또는 `basis-1/3`) 방식인지 확인하고 동일 폭 유지(마지막 행 1개여도 1/3 폭 — 시각 규칙 유지). 조건부 카드는 배열 스프레드로:

```ts
const cards = [
  ,
  /* 기존 9개 */ ...(stats.knockoutPool != null
    ? [{ label: 'KO POOL', value: formatNumber(stats.knockoutPool) }]
    : []),
];
```

- [ ] **Step 3: new.tsx 바운티 입력**

"칩 / 정산" 섹션의 비용 그리드에 `NumField label="바운티 (선택)"` 추가. **빈 값 = null**(기존 `toInt`는 빈칸→0이므로 바운티 전용 파서):

```ts
const toIntOrNull = (v: string): number | null => {
  const digits = v.replace(/[^0-9]/g, '');
  return digits === '' ? null : parseInt(digits, 10);
};
// config: { ...기존, bountyCost: toIntOrNull(bountyCost) }
```

🔨H6 **create 배선 3계층(실측 확정)**: ①`IOpsTournamentRepository.ts`의 `OpsTournamentCostConfig`(:4-12)에 `bountyCost: number | null` ②`opsTournament.schema.ts`의 `opsCostConfigSchema`(:30-38)에 `bountyCost: z.number().int().min(0).nullable()` ③`OpsTournamentRepository.ts` create의 `p_config` **수동 7키 객체**(:90-98 — jsonb 통짜 아님)에 `bounty_cost: input.config.bountyCost` 1줄. 인터페이스 확장은 new.tsx의 config 객체 리터럴에서 tsc가 강제하지만 **스키마는 비-strict z.object라 누락해도 아무 게이트가 안 깨진다** — 반드시 ②를 함께 넣고 jest에 `bountyCost: null 통과·-1 거부` 케이스 1건 추가. (🔨H5: update 경로(UpdateOpsTournamentPatch/updateOpsTournamentSchema/레포 set 목록)는 **건드리지 않는다** — 수정 화면 부재로 죽은 배선이 되므로 서버 RPC 계약만 선행, Self-Review 편차 3 참조.)

- [ ] **Step 4: 공개 표면 2종**

`monitor/[token].tsx` 통계 스트립(StatCard 5개)에 조건부 6번째:

```tsx
{
  snapshot.stats.knockoutPool != null && (
    <StatCard label="KO POOL" value={formatNumber(snapshot.stats.knockoutPool)} />
  );
}
```

`live/[view_token].tsx` 내 카드(리바이/애드온/재입장 카운트 행)에:

```tsx
{
  view.me.bountyAccrued != null && (
    <Text className="...">
      KO {view.me.knockouts} · 바운티 적립 {formatNumber(view.me.bountyAccrued)}원
    </Text>
  );
}
```

(파일 헤더의 stale 주석 "1d/1f 제외"도 이번에 갱신.)

- [ ] **Step 5: 검증** — `npx tsc --noEmit` 0 · `npx jest` 전체 PASS · `npm run quality` EXIT 0

- [ ] **Step 6: 커밋**

```bash
git add src/components/ops/ app/
git commit -m "feat(ops): 1f 표면 — 종료 결과 뷰·KO POOL 카드·바운티 생성 입력·공개 뷰 KO 노출"
```

---

# 최종 게이트 (배치 밖 — 컨트롤러 직접)

- [ ] `npm run db:reset && npm run test:db:helpers && npx supabase test db` — 전 파일 PASS(기존 43 + 신규 4)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx jest` — 전 스위트 PASS
- [ ] `npm run quality` — EXIT 0
- [ ] TODOS.md의 [MED] LS-매개 데드락 항목 완료 처리(D6 해소 — T2)
- [ ] 스펙 §12 E1 재확인: `grep -n "ops_live_stats" supabase/migrations/*.sql`로 ops RPC가 자기 txn에서 live_stats를 읽는 곳 없음 전수 실측(모니터/플레이어 스냅샷 RPC는 읽지만 자기 txn 변이가 없어 무해 — 논증 기록)
- [ ] 🔨H8 ops_prizes 테이블 권한 실측(로컬 — **db:reset 직후·test:db:helpers 이전**, fixture GRANT ALL이 덮기 전): `MSYS_NO_PATHCONV=1 docker exec supabase_db_uniqn psql -U postgres -d postgres -c "SELECT has_table_privilege('anon','public.ops_prizes','INSERT') OR has_table_privilege('authenticated','public.ops_prizes','UPDATE');"` → **f**. prod 게이트에서도 동일 쿼리(MCP execute_sql) 재실측(스펙 §11-4).

## Self-Review 결과 (계획 작성자 체크 + 2026-07-04 적대검증 하드닝 반영)

1. **스펙 커버리지**: §3(T1·T6) §4.1(T3) §4.2(T4) §4.3(T5) §4.4(T5) §5(T2) §6(T7) §7.1(T11) §7.2(T10) §7.3(T12) §7.4(T5·T12) §7.5(T9) §8(T8) §9(T6) §10(T2~T6 pgTAP + T7~T11 jest) — 전 섹션 태스크 대응 확인.
2. **스펙과 다른 결정 — 의도된 편차 3건(근거 명시)**: ① bounty 음수 거부 = RPC 가드 대신 **DB CHECK**(정찰 확정 사실 5 — 기존 RPC에 비용 음수 검증이 원래 없고 신규 P0001 prefix는 에러코드 추가를 강제. +🔨H15 상한 1억 포함) ② update의 bounty_cost는 COALESCE 대신 **key-presence 분기**(NULL 되돌리기 필요 — 정찰 확정 사실 4) ③ 🔨H5 **§7.4의 "수정 폼"은 이 슬라이스 Out** — (ops) 라우트에 수정 화면 자체가 부재(updateTournament UI 호출부 0건 실측), update RPC의 bounty 패치는 서버 선행 계약으로만 출하하고 클라 update 배선(Patch 타입/스키마/레포 set)은 **넣지 않는다**(죽은 코드 방지). 바운티 중도 변경 UI는 후속 수정 화면 슬라이스.
3. **타입 일관성**: `OpsUndoBustResult`(T9 정의 = T4 RPC 반환 snake의 camel 미러), `PrizeCorrectionInput`(T8 정의 → T9 service·T11 시트 소비), `ItmRatio`(T7 → T11) 교차 확인 완료.
4. **플레이스홀더 검사**: UI 태스크(T10~T12)의 "기존 패턴 그대로" 지시는 정확한 파일:줄 참조로 한정(계획 자족성 유지). SQL/도메인/스키마/repo는 전문 인라인.
5. **적대검증 하드닝(2026-07-04, 스펙 §12.5 이력 참조)**: 발굴 25건(중복 제거 18건) 전건 반영 — 🔨H1(가드 순서·T4/T5) H2(eliminatorId 가드·T9) H3(피커 스크롤·T10) H4(bust 확인 복원·T10) H5(수정 폼 편차 선언) H6(create 배선 3계층·T12) H7(completed 카드 명세·T12) H8(ops_prizes 권한 게이트) H9(T2 시드 보강) H10(T4 fp 값 단언) H11(ops_events.seq·T1/T4) H12(자동확정 보류 가드·T3) H13(T2 센티널) H14(winner fp===1·T12) H15(bounty CHECK 상한·T1) H18(ConfirmModal·T11) H20(대장 fp 전원 행·T11) H21(파일맵 T6 교정·amount_before 단언·T5).
