# 라이브 대회 운영 — 슬라이스 1b (TABLES/좌석) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라이브 대회에 테이블/좌석 레이어를 추가한다 — 테이블 개설(lock/priority)·좌석 단일점유·move/free·대기채움 redraw(미리보기→TOCTOU 재검증 확정)·등록 시 자동좌석 활성화·TABLES 탭.

**Architecture:** 1a와 동일 레이어(`Presentation → Hooks(src/hooks/ops) → Service → Repository(interface/impl) → Supabase`). 모든 좌석/테이블 쓰기는 SECDEF RPC 전용(테이블 DML REVOKE + SELECT-only RLS), 호출당 `ops_events` 1건 append. 좌석 점유는 `ops_seats` 정규화 단일원(이중 SoT 금지). redraw는 클라이언트 미리보기(순수 도메인) → 확정 RPC가 좌석별 expected-value 낙관적 검증으로 TOCTOU 차단.

**Tech Stack:** Expo 55 / RN 0.83.4 / React 19.2 / TS strict / NativeWind 4.2 / Supabase(Postgres + RLS + Realtime) / TanStack Query / Zod / pgTAP / Jest.

## Global Constraints

- 작업 디렉토리: `uniqn-mobile/`. 배포 전 `npm run quality`(check-css-vars + type-check + lint + format:check).
- 언어: 모든 주석·커밋·문서 한글(고유 기술용어만 원문). 로깅 `logger.*`(앱 런타임 `console.*` 금지). 알림 `toast.*`/`Alert.alert`. 경로 `@/` 절대. 필드명 앱=camelCase·DB=snake_case(Repository 매핑). 다크모드 `dark:` 항상. 리스트=FlashList(대형)/FlatList(소형). 이미지=expo-image.
- 불변성(스프레드, 변이 금지) · 파일 200~400줄(800 max) · 함수 <50줄 · 중첩 ≤4 · 하드코딩/시크릿 금지.
- DB 접근은 Service→Repository→Supabase 경유. Presentation/Hooks에서 Supabase 직접호출 금지(TanStack 읽기전용 조회만 Repository 직접 허용).
- 모든 사용자 입력 Zod + `xssValidation` refine. 다중행 변이는 RPC(원자) 필수.
- **Supabase 마이그**: MCP `apply_migration` 전용(`db push`/`db query` 금지). 마이그 파일은 `uniqn-mobile/supabase/migrations/`에 시간순 타임스탬프(`20260625HHMMSS_*`). prod 적용은 별도 승인 게이트.
- **신규 SECDEF RPC**: `SET search_path = public, extensions, pg_temp` + actor 가드(`auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor AND NOT is_admin())`) + 자식 RPC는 `is_ops_member(t_id, actor) OR is_admin()` 강제 + 호출당 `ops_events` 1행 append(설정성 변경 제외) + 비즈니스 RAISE는 `ERRCODE='P0001'`. 권한은 grants 마이그서 `REVOKE PUBLIC,anon` + `GRANT authenticated,service_role`. 신규 트리거 헬퍼 함수도 `REVOKE EXECUTE FROM PUBLIC,anon,authenticated`(get_advisors anon 노출 0).
- **신규 테이블**: `ENABLE` + `FORCE ROW LEVEL SECURITY` + SELECT-only RLS(`TO authenticated`, `is_ops_member(...) OR is_admin()`) + `REVOKE INSERT,UPDATE,DELETE FROM anon,authenticated`(방어심층) + Realtime publication 멱등 ADD.
- **pgTAP**: 헬퍼는 `supabase/fixtures/`(tests/에 두면 plan 없는 파일로 fail). 테스트/시퀀스만 GRANT(함수 GRANT 금지 — 마이그 REVOKE 회귀 방지). 로컬 실행은 `npx supabase test db`(이 머신 PATH에 bare `supabase` 없음). 헬퍼 신규 파일은 `test:db:helpers` 스크립트와 `.github/workflows/db-tests.yml`에 등록.
- 로컬 타입 재생성은 `npx supabase gen types typescript --local`(MCP gen은 prod 대상). 워크트리 node_modules는 메인레포 junction.

---

## 1a 재사용 계약 (이 계획이 미러링하는 기존 코드)

다음은 1b가 **그대로 따라야 할** 1a 산출물의 정확한 형태다. (파일을 열어 패턴을 복사하되, 새 도메인 객체로 치환.)

- **enum SSOT**: `src/types/ops.ts` — `(typeof Constants.public.Enums.<enum>)[number]`. `ops_event_type`에 **`table_added`/`table_closed`/`table_redraw`/`player_moved`/`seat_freed` 이미 존재**(1b는 새 event enum 불필요, 단 `ops_table_status`/`ops_table_lock_type`는 신규).
- **에러 매핑**: `src/repositories/supabase/opsRpcError.ts` — `PREFIX_MAP: [prefix, code]` 배열에 추가. `PERMISSION_DENIED`→`BUSINESS_INVALID_STATE`. 미지=`handleSupabaseError`.
- **에러코드**: `src/errors/AppError.ts` L176~ `OPS_*: 'E61xx'` + `ERROR_MESSAGES[code]` 한글.
- **Repository impl**: `src/repositories/supabase/OpsParticipantRepository.ts` — `TABLE`/`COLUMNS` 상수, `toCamelCase`, `supabase.from().select().eq().order()` 읽기 + `supabase.rpc()` 쓰기 + `mapOpsRpcError`/`handleSupabaseError` try/catch + `isAppError` rethrow.
- **배럴**: `src/repositories/ops.ts` — interface type re-export + impl export + 싱글톤 `new ...Repository()`.
- **서비스**: `src/services/ops/opsParticipantService.ts` — `logger.info` → `schema.safeParse`(실패시 `ValidationError(VALIDATION_SCHEMA)`) → repo 위임 → `handleServiceError` catch.
- **서비스 배럴**: `src/services/ops/index.ts`(현재 `opsTournamentService`/`opsParticipantService` namespace export — 동일 패턴으로 `opsTableService`/`opsSeatService` 추가).
- **훅(읽기+realtime)**: `src/hooks/ops/useOpsParticipants.ts` — `useQuery(queryKeys.ops.X)` + `useEffect`로 `createRealtimeSubscription('table', 'tournament_id=eq.X', invalidate)`.
- **훅(변이)**: `src/hooks/ops/useOpsMutations.ts` — `useMutation(mutationFn: service, actor: useAuthStore(s=>s.user?.uid))` + `onSuccess` invalidate + `toast` + `onError` logger+`extractUserMessage`. `requireActor` 가드.
- **훅 배럴**: `src/hooks/ops/index.ts`.
- **queryKeys**: `src/lib/queryClient.ts` L563 `ops:{ all, tournaments(), tournamentDetail(id), participants(tid), forPosting(id) }` — `tables(tid)`/`seats(tid)` 추가.
- **도메인 배럴**: `src/domains/ops/index.ts` — `export * from './seatAssignment'` 추가.
- **UI 세그먼트**: `app/(ops)/tournaments/[id].tsx` — `useState<'players'|'status'>('players')` 세그먼트 → `'players'|'status'|'tables'`로 확장.
- **pgTAP 헬퍼**: `supabase/fixtures/ops_helpers.sql` — `ops_test_seed()`(owner/member/outsider + ws + job_posting + tournament + 참가자1 + event1), `ops_test_set_user(uuid)`(JWT sub + role authenticated 전환).
- **pgTAP 패턴**: `supabase/tests/ops_*.test.sql` — `BEGIN; SELECT plan(N); ... SELECT * FROM finish(); ROLLBACK;`. `has_function_privilege`, `throws_ok($$...$$, 'P0001', NULL, '...')`, `ops_test_set_user` 후 role-bound 쿼리.

---

## 파일 구조 (생성/수정)

**DB (마이그레이션 — 시간순)**
- Create: `supabase/migrations/20260625130000_ops_1b_tables_seats.sql` — enum 2종 + `ops_tables`/`ops_seats` + 인덱스 + RLS + DML REVOKE + updated_at 트리거 + 트리거함수 REVOKE
- Create: `supabase/migrations/20260625130100_ops_1b_seat_rpcs.sql` — 좌석/테이블 변이 SECDEF RPC 8종 + `ops_register_participant` v2(auto-seat)
- Create: `supabase/migrations/20260625130200_ops_1b_grants_and_realtime.sql` — 신규 RPC anon REVOKE/authenticated GRANT + publication ADD `ops_tables`/`ops_seats`

**도메인 (순수)**
- Create: `src/domains/ops/seatAssignment/waitlistFill.ts` — `computeWaitlistFill(...)` + 타입
- Create: `src/domains/ops/seatAssignment/index.ts` — 배럴
- Create: `src/domains/ops/seatAssignment/__tests__/waitlistFill.test.ts`
- Modify: `src/domains/ops/index.ts` — `export * from './seatAssignment'`

**타입 / 에러 / 스키마**
- Modify: `src/types/ops.ts` — `OpsTableStatus`/`OpsTableLockType` + `OpsTable`/`OpsSeat` 인터페이스
- Modify: `src/errors/AppError.ts` — `OPS_*` 코드 E6106~E6112 + 메시지
- Create: `src/schemas/opsSeat.schema.ts` — `addTableSchema`/`moveSeatSchema`/`redrawWaitlistFillSchema`
- Create: `src/schemas/__tests__/opsSeat.schema.test.ts`

**Repository**
- Create: `src/repositories/interfaces/IOpsTableRepository.ts`
- Create: `src/repositories/interfaces/IOpsSeatRepository.ts`
- Create: `src/repositories/supabase/OpsTableRepository.ts`
- Create: `src/repositories/supabase/OpsSeatRepository.ts`
- Modify: `src/repositories/supabase/opsRpcError.ts` — PREFIX_MAP 추가
- Modify: `src/repositories/ops.ts` — 배럴/싱글톤 추가

**Service / Hooks**
- Create: `src/services/ops/opsTableService.ts`
- Create: `src/services/ops/opsSeatService.ts`
- Create: `src/services/ops/__tests__/opsSeatService.test.ts`
- Modify: `src/services/ops/index.ts` — namespace export 추가
- Create: `src/hooks/ops/useOpsTables.ts`
- Create: `src/hooks/ops/useOpsSeats.ts`
- Modify: `src/hooks/ops/useOpsMutations.ts` — 좌석/테이블 변이 훅 추가
- Modify: `src/hooks/ops/index.ts` — 재노출
- Modify: `src/lib/queryClient.ts` — `queryKeys.ops.tables`/`seats`

**UI**
- Modify: `app/(ops)/tournaments/[id].tsx` — TABLES 세그먼트
- Create: `app/(ops)/tournaments/components/TablesTab.tsx` — 테이블 목록 + 좌석 그리드 + 추가폼
- Create: `app/(ops)/tournaments/components/RedrawModal.tsx` — 대기채움 미리보기/확정

**pgTAP / fixture / CI**
- Modify: `supabase/fixtures/ops_helpers.sql` — `ops_test_seed()`에 테이블1 + 좌석 N + (확장 반환) 추가
- Create: `supabase/tests/ops_seats_single_occupancy.test.sql`
- Create: `supabase/tests/ops_seat_move_free.test.sql`
- Create: `supabase/tests/ops_redraw_toctou.test.sql`
- Create: `supabase/tests/ops_tables_seats_rls.test.sql`
- (헬퍼는 기존 등록됨 — `test:db:helpers`/`db-tests.yml` 변경 불필요. 신규 *.test.sql 은 `supabase test db`가 자동 수집)

---

## 핀 결정 (실행 전 사용자 승인 대상)

1. **좌석 단일점유 = `ops_seats` partial UNIQUE(tournament_id, participant_id) WHERE participant_id IS NOT NULL**. 참가자 행에 seat 컬럼 없음(이중 SoT 금지, [[pitfall_posting_role_filled_dead_counter]] 클래스 회피).
2. **move_seat = 두 좌석 `FOR UPDATE`(id 정렬, 데드락 회피) 후, from 먼저 NULL → to 세팅**(partial UNIQUE가 순간 2점유를 막으므로 순서 필수, 비-deferrable 제약).
3. **redraw TOCTOU = 좌석별 expected-value 낙관적 검증**(전역 md5 해시 아님 — JS↔PG md5 매칭 취약). confirm RPC가 각 대상 좌석을 `FOR UPDATE` 후 `current.participant_id IS NOT DISTINCT FROM expected`(미리보기 시점 값, 빈좌석이면 NULL) 확인, 불일치 시 `SEAT_VERSION_CONFLICT`. 참가자가 이미 다른 좌석에 있으면 거부.
4. **auto-seat 활성화 = `ops_register_participant` v2**(CREATE OR REPLACE): 등록 후 `auto_seat_on_register=true` ∧ 빈좌석(open·unlocked 테이블) 존재 → 랜덤 빈좌석 배정 + status `active`; 아니면 status `checked_in`(대기 풀). **⚠️ 1a "워크인→항상 active" 행동변경** → 1a pgTAP(`ops_rpc_security`)·service 테스트 재실행 필수(둘 다 entry_number만 검증하므로 GREEN 유지 예상, 실측 확인). STATUS playing 통계(=active 수)는 좌석 없는 대기자를 제외 — 의도된 정합.
5. **redraw 범위 = 대기채움(waitlist-fill)만**. 랜덤 리밸런스·칩 스네이크 드래프트는 1d(설계 §10/§D). 대기채움 = unseated(좌석 없는 checked_in/active) 참가자를 빈좌석에 균형 배분, **lock(locked/feature)·standby·closed 테이블 제외**.
6. **lock/priority 변경 = 무이벤트**(설정성, `ops_update_tournament` 선례). `table_added`/`table_closed`/`table_redraw`/`player_moved`/`seat_freed`만 event(1a enum에 이미 존재).
7. **close_table = `closed` 전이는 빈좌석일 때만 허용**(`TABLE_HAS_OCCUPANTS` 거부). `standby`/`open`은 무가드(redraw 제외만). 닫힌/대기 테이블 좌석은 배정/이동 대상 제외.
8. **테이블 개설 = `ops_add_table`이 `table_no = COALESCE(max,0)+1` 부여(FOR UPDATE 직렬화 불필요 — UNIQUE 위반시 재시도 없음, 동시개설 희박·실패 수용) + `p_seat_count`개 빈좌석 행 생성**. seat_count는 1~11 CHECK.

---

## Task 1: DB 기반 — enum + ops_tables/ops_seats + RLS

**Files:**
- Create: `supabase/migrations/20260625130000_ops_1b_tables_seats.sql`

**Interfaces:**
- Produces: 테이블 `public.ops_tables`(id, tournament_id, table_no, name, status `ops_table_status`, assigned_staff_id, lock_type `ops_table_lock_type`, priority, position, created_at, updated_at), `public.ops_seats`(id, tournament_id, table_id, table_no, seat_no, participant_id, created_at, updated_at). enum `ops_table_status`(open/closed/standby), `ops_table_lock_type`(none/locked/feature). 함수 `fn_ops_set_updated_at`(1a 기존 재사용).

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 라이브 운영(ops) 1b — ops_table_status/lock_type enum + ops_tables/ops_seats + RLS.
-- D1(real enum) · D3(SELECT-only RLS, 쓰기는 1b RPC 전용) · 좌석 단일점유(partial UNIQUE).
-- Idiom 출처: 20260625120000_ops_1a_enums_and_tables.sql (CREATE IF NOT EXISTS, ENABLE/FORCE RLS,
--            fn_ops_set_updated_at 트리거), 20260625120100_ops_1a_rls_and_membership.sql (RLS/REVOKE).
-- additive — 기존 데이터 영향 없음.

-- 1. ENUMS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_table_status') THEN
    CREATE TYPE public.ops_table_status AS ENUM ('open', 'closed', 'standby');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ops_table_lock_type') THEN
    CREATE TYPE public.ops_table_lock_type AS ENUM ('none', 'locked', 'feature');
  END IF;
END $$;

-- 2. ops_tables
CREATE TABLE IF NOT EXISTS public.ops_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  table_no int NOT NULL,
  name text,
  status public.ops_table_status NOT NULL DEFAULT 'open',
  assigned_staff_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  lock_type public.ops_table_lock_type NOT NULL DEFAULT 'none',
  priority int,
  position jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_tables_table_no_unique UNIQUE (tournament_id, table_no),
  CONSTRAINT ops_tables_table_no_positive CHECK (table_no >= 1),
  CONSTRAINT ops_tables_name_length CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 50)
);
COMMENT ON TABLE public.ops_tables IS '라이브 운영 테이블. 쓰기는 1b SECDEF RPC 전용. closed/standby/lock 은 redraw 제외.';

ALTER TABLE public.ops_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_tables FORCE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ops_tables_tournament ON public.ops_tables (tournament_id);

DROP TRIGGER IF EXISTS trg_ops_tables_set_updated_at ON public.ops_tables;
CREATE TRIGGER trg_ops_tables_set_updated_at
  BEFORE UPDATE ON public.ops_tables
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- 3. ops_seats (정규화 단일 점유원)
CREATE TABLE IF NOT EXISTS public.ops_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.ops_tables(id) ON DELETE CASCADE,
  table_no int NOT NULL,
  seat_no int NOT NULL,
  participant_id uuid REFERENCES public.ops_participants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_seats_seat_unique UNIQUE (table_id, seat_no),
  CONSTRAINT ops_seats_seat_no_positive CHECK (seat_no >= 1)
);
COMMENT ON TABLE public.ops_seats IS '좌석 단일 점유원. participant 점유는 partial UNIQUE 로 대회내 1좌석 강제.';

-- 단일점유: 한 참가자는 대회내 최대 1좌석.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ops_seats_participant
  ON public.ops_seats (tournament_id, participant_id)
  WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_seats_tournament ON public.ops_seats (tournament_id);
CREATE INDEX IF NOT EXISTS idx_ops_seats_table ON public.ops_seats (table_id);

ALTER TABLE public.ops_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_seats FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_ops_seats_set_updated_at ON public.ops_seats;
CREATE TRIGGER trg_ops_seats_set_updated_at
  BEFORE UPDATE ON public.ops_seats
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_set_updated_at();

-- 4. SELECT-only RLS (is_ops_member 재사용)
DROP POLICY IF EXISTS ops_tables_select_member ON public.ops_tables;
CREATE POLICY ops_tables_select_member ON public.ops_tables FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS ops_seats_select_member ON public.ops_seats;
CREATE POLICY ops_seats_select_member ON public.ops_seats FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));

-- 5. DML REVOKE (방어심층)
REVOKE INSERT, UPDATE, DELETE ON public.ops_tables FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ops_seats  FROM anon, authenticated;
```

- [ ] **Step 2: prod 적용은 게이트** — 로컬 검증만. `npm run db:reset`(또는 로컬 스택)로 마이그 적용 후 Step 3.

- [ ] **Step 3: 로컬 적용 확인**

Run: `cd uniqn-mobile && npx supabase db reset`
Expected: 에러 없이 모든 마이그 적용(`ops_1b_tables_seats` 포함). `\d public.ops_seats`에 `uniq_ops_seats_participant` partial unique 확인.

- [ ] **Step 4: 로컬 타입 재생성 + tsc**

Run: `cd uniqn-mobile && npx supabase gen types typescript --local > src/types/supabase.ts && npm run type-check`
Expected: 0 errors. `Constants.public.Enums.ops_table_status`/`ops_table_lock_type` 존재.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260625130000_ops_1b_tables_seats.sql uniqn-mobile/src/types/supabase.ts
git commit -m "feat(ops): 1b DB 기반 — ops_table_status/lock_type enum + ops_tables/ops_seats(단일점유)·SELECT-only RLS·DML REVOKE"
```

---

## Task 2: DB — 좌석/테이블 변이 SECDEF RPC + auto-seat

**Files:**
- Create: `supabase/migrations/20260625130100_ops_1b_seat_rpcs.sql`
- Create: `supabase/migrations/20260625130200_ops_1b_grants_and_realtime.sql`

**Interfaces:**
- Consumes: `ops_tables`/`ops_seats`(Task 1), `is_ops_member`/`is_admin`(1a), `ops_tournaments.auto_seat_on_register`/`seats_per_table`(1a).
- Produces: RPC `ops_add_table(p_tournament_id uuid, p_actor_id uuid, p_seat_count int, p_name text, p_lock_type ops_table_lock_type, p_priority int) → jsonb{table_id, table_no}`, `ops_set_table_lock(p_table_id, p_actor_id, p_lock_type) → jsonb`, `ops_set_table_priority(p_table_id, p_actor_id, p_priority int) → jsonb`, `ops_close_table(p_table_id, p_actor_id, p_status ops_table_status) → jsonb`, `ops_assign_seat(p_seat_id, p_participant_id, p_actor_id) → jsonb`, `ops_move_seat(p_from_seat_id, p_to_seat_id, p_actor_id) → jsonb`, `ops_free_seat(p_seat_id, p_actor_id) → jsonb`, `ops_redraw_waitlist_fill(p_tournament_id, p_actor_id, p_assignments jsonb) → jsonb{moved}`. `ops_register_participant` v2(auto-seat).

- [ ] **Step 1: RPC 마이그레이션 작성** (`20260625130100_ops_1b_seat_rpcs.sql`)

핵심 RPC(전체 코드). 모든 RPC는 actor 가드 + `is_ops_member` 가드 공통(1a `ops_rpcs` 패턴 — 각 함수 본문에 복제).

```sql
-- OPS 1b — 좌석/테이블 변이 SECDEF RPC + auto-seat 활성화.
-- 패턴: 20260625120200_ops_1a_rpcs.sql (actor 가드·is_ops_member·ops_events append·P0001).
-- 권한은 후속 grants 마이그에서.

-- 공통 헬퍼: actor + 멤버십 가드를 RAISE 하는 인라인은 각 함수에 복제(SECDEF 경계).

-- 1) ops_add_table — 테이블 + 빈좌석 N 개설
CREATE OR REPLACE FUNCTION public.ops_add_table(
  p_tournament_id uuid, p_actor_id uuid, p_seat_count int,
  p_name text, p_lock_type public.ops_table_lock_type, p_priority int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_table_no int; v_table_id uuid; v_seats int; i int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  v_seats := COALESCE(NULLIF(p_seat_count, 0), 9);
  IF v_seats < 1 OR v_seats > 11 THEN
    RAISE EXCEPTION 'INVALID_SEAT_COUNT: 좌석수는 1~11 (got %)', v_seats USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(max(table_no), 0) + 1 INTO v_table_no
    FROM public.ops_tables WHERE tournament_id = p_tournament_id;

  INSERT INTO public.ops_tables (tournament_id, table_no, name, lock_type, priority)
  VALUES (p_tournament_id, v_table_no, NULLIF(p_name, ''), COALESCE(p_lock_type, 'none'), p_priority)
  RETURNING id INTO v_table_id;

  FOR i IN 1..v_seats LOOP
    INSERT INTO public.ops_seats (tournament_id, table_id, table_no, seat_no)
    VALUES (p_tournament_id, v_table_id, v_table_no, i);
  END LOOP;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_added', p_actor_id,
          jsonb_build_object('table_id', v_table_id, 'table_no', v_table_no, 'seats', v_seats));

  RETURN jsonb_build_object('table_id', v_table_id, 'table_no', v_table_no);
END;
$function$;

-- 2) ops_set_table_lock — lock_type 변경 (무이벤트)
CREATE OR REPLACE FUNCTION public.ops_set_table_lock(
  p_table_id uuid, p_actor_id uuid, p_lock_type public.ops_table_lock_type)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_tid uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_tables SET lock_type = p_lock_type WHERE id = p_table_id;
  RETURN jsonb_build_object('table_id', p_table_id, 'lock_type', p_lock_type);
END;
$function$;

-- 3) ops_set_table_priority — priority 변경 (무이벤트). 본문은 (2)와 동형, lock_type→priority.
CREATE OR REPLACE FUNCTION public.ops_set_table_priority(
  p_table_id uuid, p_actor_id uuid, p_priority int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_tid uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_tables SET priority = p_priority WHERE id = p_table_id;
  RETURN jsonb_build_object('table_id', p_table_id, 'priority', p_priority);
END;
$function$;

-- 4) ops_close_table — status 전이. closed 는 빈좌석일 때만.
CREATE OR REPLACE FUNCTION public.ops_close_table(
  p_table_id uuid, p_actor_id uuid, p_status public.ops_table_status)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_tid uuid; v_occupied int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT tournament_id INTO v_tid FROM public.ops_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다 (%)', p_table_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_tid, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF p_status = 'closed' THEN
    SELECT count(*) INTO v_occupied FROM public.ops_seats
      WHERE table_id = p_table_id AND participant_id IS NOT NULL;
    IF v_occupied > 0 THEN
      RAISE EXCEPTION 'TABLE_HAS_OCCUPANTS: 점유 좌석 % 개 — 먼저 비우세요', v_occupied USING ERRCODE = 'P0001';
    END IF;
  END IF;
  UPDATE public.ops_tables SET status = p_status WHERE id = p_table_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tid, 'table_closed', p_actor_id, jsonb_build_object('table_id', p_table_id, 'status', p_status));
  RETURN jsonb_build_object('table_id', p_table_id, 'status', p_status);
END;
$function$;

-- 5) ops_assign_seat — 빈좌석에 unseated 참가자 수동 배정 → active
CREATE OR REPLACE FUNCTION public.ops_assign_seat(
  p_seat_id uuid, p_participant_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_seat record; v_p record; v_table_status public.ops_table_status;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT s.id, s.tournament_id, s.table_id, s.participant_id, s.table_no, s.seat_no
    INTO v_seat FROM public.ops_seats s WHERE s.id = p_seat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다 (%)', p_seat_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_seat.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_seat.participant_id IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_TAKEN: 이미 점유된 좌석' USING ERRCODE = 'P0001';
  END IF;
  SELECT status INTO v_table_status FROM public.ops_tables WHERE id = v_seat.table_id;
  IF v_table_status <> 'open' THEN
    RAISE EXCEPTION 'TABLE_NOT_OPEN: open 테이블만 배정 가능 (status=%)', v_table_status USING ERRCODE = 'P0001';
  END IF;
  SELECT id, tournament_id, status INTO v_p FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND OR v_p.tournament_id <> v_seat.tournament_id THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id USING ERRCODE = 'P0001';
  END IF;
  IF v_p.status = 'busted' OR v_p.status = 'no_show' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 탈락/미출석 참가자는 좌석배정 불가' USING ERRCODE = 'P0001';
  END IF;
  -- 단일점유: 이미 다른 좌석이면 partial UNIQUE 가 막지만 명시 검증.
  IF EXISTS (SELECT 1 FROM public.ops_seats WHERE tournament_id = v_seat.tournament_id
               AND participant_id = p_participant_id) THEN
    RAISE EXCEPTION 'PARTICIPANT_ALREADY_SEATED: 이미 좌석 배정됨' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = p_seat_id;
  UPDATE public.ops_participants SET status = 'active'
    WHERE id = p_participant_id AND status <> 'active';
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_seat.tournament_id, 'player_moved', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id, 'to_table', v_seat.table_no,
                             'to_seat', v_seat.seat_no, 'from', NULL));
  RETURN jsonb_build_object('seat_id', p_seat_id, 'participant_id', p_participant_id);
END;
$function$;

-- 6) ops_move_seat — 두 좌석 FOR UPDATE(id 정렬), from NULL → to 세팅
CREATE OR REPLACE FUNCTION public.ops_move_seat(
  p_from_seat_id uuid, p_to_seat_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_first uuid; v_second uuid; v_from record; v_to record; v_table_status public.ops_table_status;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF p_from_seat_id = p_to_seat_id THEN
    RAISE EXCEPTION 'INVALID_MOVE: 동일 좌석' USING ERRCODE = 'P0001';
  END IF;
  -- 데드락 회피: id 오름차순 잠금.
  v_first := LEAST(p_from_seat_id, p_to_seat_id);
  v_second := GREATEST(p_from_seat_id, p_to_seat_id);
  PERFORM 1 FROM public.ops_seats WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.ops_seats WHERE id = v_second FOR UPDATE;

  SELECT id, tournament_id, participant_id, table_no, seat_no INTO v_from
    FROM public.ops_seats WHERE id = p_from_seat_id;
  SELECT id, tournament_id, table_id, participant_id, table_no, seat_no INTO v_to
    FROM public.ops_seats WHERE id = p_to_seat_id;
  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF v_from.tournament_id <> v_to.tournament_id THEN
    RAISE EXCEPTION 'INVALID_MOVE: 다른 대회 좌석' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_from.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_from.participant_id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_OCCUPIED: 출발 좌석이 비어있음' USING ERRCODE = 'P0001';
  END IF;
  IF v_to.participant_id IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_TAKEN: 도착 좌석이 점유됨' USING ERRCODE = 'P0001';
  END IF;
  SELECT status INTO v_table_status FROM public.ops_tables WHERE id = v_to.table_id;
  IF v_table_status <> 'open' THEN
    RAISE EXCEPTION 'TABLE_NOT_OPEN: open 테이블로만 이동 가능 (status=%)', v_table_status USING ERRCODE = 'P0001';
  END IF;
  -- partial UNIQUE 회피: from 먼저 비움.
  UPDATE public.ops_seats SET participant_id = NULL WHERE id = p_from_seat_id;
  UPDATE public.ops_seats SET participant_id = v_from.participant_id WHERE id = p_to_seat_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_from.tournament_id, 'player_moved', p_actor_id,
          jsonb_build_object('participant_id', v_from.participant_id,
                             'from_table', v_from.table_no, 'from_seat', v_from.seat_no,
                             'to_table', v_to.table_no, 'to_seat', v_to.seat_no));
  RETURN jsonb_build_object('participant_id', v_from.participant_id,
                            'from_seat_id', p_from_seat_id, 'to_seat_id', p_to_seat_id);
END;
$function$;

-- 7) ops_free_seat — 좌석 비우기 (참가자 status 유지)
CREATE OR REPLACE FUNCTION public.ops_free_seat(p_seat_id uuid, p_actor_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_seat record;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, tournament_id, participant_id, table_no, seat_no INTO v_seat
    FROM public.ops_seats WHERE id = p_seat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석을 찾을 수 없습니다 (%)', p_seat_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(v_seat.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_seat.participant_id IS NULL THEN
    RAISE EXCEPTION 'SEAT_NOT_OCCUPIED: 빈 좌석' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.ops_seats SET participant_id = NULL WHERE id = p_seat_id;
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_seat.tournament_id, 'seat_freed', p_actor_id,
          jsonb_build_object('participant_id', v_seat.participant_id,
                             'table', v_seat.table_no, 'seat', v_seat.seat_no));
  RETURN jsonb_build_object('seat_id', p_seat_id);
END;
$function$;

-- 8) ops_redraw_waitlist_fill — 미리보기 확정. 좌석별 expected-value TOCTOU 검증.
-- p_assignments = [{"seat_id":uuid, "participant_id":uuid, "expected":uuid|null}, ...]
--   expected = 미리보기 시점 좌석 participant_id(빈좌석이면 null). 현재값과 다르면 SEAT_VERSION_CONFLICT.
CREATE OR REPLACE FUNCTION public.ops_redraw_waitlist_fill(
  p_tournament_id uuid, p_actor_id uuid, p_assignments jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE a jsonb; v_seat record; v_expected uuid; v_pid uuid; v_moved int := 0;
        v_seat_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments) = 0 THEN
    RAISE EXCEPTION 'INVALID_ASSIGNMENTS: 배정 목록이 비었습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 결정적 락 순서: 관련 좌석 id 오름차순 FOR UPDATE.
  SELECT array_agg(value->>'seat_id' ORDER BY value->>'seat_id')
    INTO v_seat_ids FROM jsonb_array_elements(p_assignments);
  PERFORM 1 FROM public.ops_seats WHERE id = ANY(v_seat_ids::uuid[]) FOR UPDATE;

  FOR a IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
    v_pid := (a->>'participant_id')::uuid;
    v_expected := NULLIF(a->>'expected', '')::uuid;
    SELECT id, tournament_id, table_id, participant_id, table_no, seat_no INTO v_seat
      FROM public.ops_seats WHERE id = (a->>'seat_id')::uuid;
    IF v_seat.id IS NULL OR v_seat.tournament_id <> p_tournament_id THEN
      RAISE EXCEPTION 'SEAT_NOT_FOUND: 좌석 % 없음', a->>'seat_id' USING ERRCODE = 'P0001';
    END IF;
    -- TOCTOU: 미리보기 시점 값과 현재값 불일치면 거부.
    IF v_seat.participant_id IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'SEAT_VERSION_CONFLICT: 좌석 상태가 변경됨 — 다시 시도' USING ERRCODE = 'P0001';
    END IF;
    -- 대상 좌석이 비어야(대기채움), 참가자가 미착석이어야.
    IF v_seat.participant_id IS NOT NULL THEN
      RAISE EXCEPTION 'SEAT_TAKEN: 좌석 점유됨' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.ops_seats WHERE tournament_id = p_tournament_id
                 AND participant_id = v_pid) THEN
      RAISE EXCEPTION 'PARTICIPANT_ALREADY_SEATED: 참가자 % 이미 착석', v_pid USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.ops_seats SET participant_id = v_pid WHERE id = v_seat.id;
    UPDATE public.ops_participants SET status = 'active' WHERE id = v_pid AND status <> 'active';
    v_moved := v_moved + 1;
  END LOOP;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_redraw', p_actor_id,
          jsonb_build_object('mode', 'waitlist_fill', 'moved', v_moved));
  RETURN jsonb_build_object('moved', v_moved);
END;
$function$;

-- 9) ops_register_participant v2 — auto-seat 활성화 (1a 본문 + 좌석 배정)
CREATE OR REPLACE FUNCTION public.ops_register_participant(
  p_tournament_id uuid, p_actor_id uuid, p_name text,
  p_nationality text, p_phone text, p_buy_in_amount int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_t record; v_entry int; v_participant_id uuid; v_seat_id uuid;
        v_status public.ops_participant_status; v_table_no int; v_seat_no int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, registration_open, starting_chips, next_entry_seq, auto_seat_on_register
    INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;
  IF v_t.registration_open = false THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED: 등록이 마감되었습니다' USING ERRCODE = 'P0001';
  END IF;

  v_entry := v_t.next_entry_seq + 1;
  UPDATE public.ops_tournaments SET next_entry_seq = v_entry WHERE id = p_tournament_id;

  -- auto-seat: open·unlocked 테이블의 빈좌석 1개(table_no,seat_no asc) 잠금 시도.
  v_seat_id := NULL;
  IF v_t.auto_seat_on_register THEN
    SELECT s.id, s.table_no, s.seat_no INTO v_seat_id, v_table_no, v_seat_no
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = p_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  END IF;

  v_status := CASE WHEN v_seat_id IS NOT NULL THEN 'active'::public.ops_participant_status
                   ELSE 'checked_in'::public.ops_participant_status END;

  INSERT INTO public.ops_participants (tournament_id, entry_number, name, nationality, phone,
                                       status, chips, buy_in_amount)
  VALUES (p_tournament_id, v_entry, p_name, p_nationality, p_phone,
          v_status, v_t.starting_chips, p_buy_in_amount)
  RETURNING id INTO v_participant_id;

  IF v_seat_id IS NOT NULL THEN
    UPDATE public.ops_seats SET participant_id = v_participant_id WHERE id = v_seat_id;
  END IF;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'player_registered', p_actor_id,
          jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry,
                             'seated', v_seat_id IS NOT NULL,
                             'table', v_table_no, 'seat', v_seat_no));

  RETURN jsonb_build_object('participant_id', v_participant_id, 'entry_number', v_entry,
                            'status', v_status, 'seated', v_seat_id IS NOT NULL);
END;
$function$;
```

- [ ] **Step 2: grants + realtime 마이그 작성** (`20260625130200_ops_1b_grants_and_realtime.sql`)

```sql
-- OPS 1b — 신규 RPC 권한 + Realtime publication.
-- 패턴: 20260625120300_ops_1a_grants_and_realtime.sql.
DO $$
DECLARE rec record;
  names text[] := ARRAY['ops_add_table','ops_set_table_lock','ops_set_table_priority',
    'ops_close_table','ops_assign_seat','ops_move_seat','ops_free_seat','ops_redraw_waitlist_fill'];
BEGIN
  FOR rec IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
                   AND schemaname='public' AND tablename='ops_tables') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_tables;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
                   AND schemaname='public' AND tablename='ops_seats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_seats;
  END IF;
END $$;
```

- [ ] **Step 3: 로컬 적용 + advisor**

Run: `cd uniqn-mobile && npx supabase db reset`
Expected: 마이그 전부 적용. 이후 로컬 advisor(또는 prod 게이트 후 MCP get_advisors)로 anon 노출 0 확인 — 신규 RPC 8종 anon EXECUTE=false. `ops_register_participant`(시그니처 동일, CREATE OR REPLACE)는 1a grants의 anon REVOKE 유지(재REVOKE 불필요하나 무해).

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260625130100_ops_1b_seat_rpcs.sql uniqn-mobile/supabase/migrations/20260625130200_ops_1b_grants_and_realtime.sql
git commit -m "feat(ops): 1b 좌석/테이블 변이 SECDEF RPC 8종 + auto-seat 활성화(register v2) + anon REVOKE/realtime"
```

---

## Task 3: 도메인 — 대기채움 좌석 배정 (순수함수)

**Files:**
- Create: `src/domains/ops/seatAssignment/waitlistFill.ts`
- Create: `src/domains/ops/seatAssignment/index.ts`
- Create: `src/domains/ops/seatAssignment/__tests__/waitlistFill.test.ts`
- Modify: `src/domains/ops/index.ts`

**Interfaces:**
- Produces: `computeWaitlistFill(input: WaitlistFillInput): WaitlistAssignment[]` — `WaitlistAssignment = { seatId: string; participantId: string; expected: string | null }`. 빈좌석(open·unlocked 테이블)에 unseated 참가자를 테이블 균형(현재 인원 적은 테이블 우선) 배분. `expected`는 항상 `null`(대기채움은 빈좌석만).

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { computeWaitlistFill } from '../waitlistFill';

const seat = (id: string, tableId: string, tableNo: number, seatNo: number, participantId: string | null) =>
  ({ id, tableId, tableNo, seatNo, participantId });
const table = (id: string, status: 'open' | 'closed' | 'standby', lockType: 'none' | 'locked' | 'feature') =>
  ({ id, status, lockType });

describe('computeWaitlistFill', () => {
  it('빈좌석에 미착석 참가자를 배분하고 expected=null', () => {
    const result = computeWaitlistFill({
      tables: [table('t1', 'open', 'none')],
      seats: [seat('s1', 't1', 1, 1, null), seat('s2', 't1', 1, 2, 'p-existing')],
      unseatedParticipantIds: ['p-new'],
    });
    expect(result).toEqual([{ seatId: 's1', participantId: 'p-new', expected: null }]);
  });

  it('locked/standby/closed 테이블 좌석은 제외', () => {
    const result = computeWaitlistFill({
      tables: [table('t1', 'open', 'locked'), table('t2', 'standby', 'none'), table('t3', 'open', 'none')],
      seats: [seat('s1', 't1', 1, 1, null), seat('s2', 't2', 2, 1, null), seat('s3', 't3', 3, 1, null)],
      unseatedParticipantIds: ['p-new'],
    });
    expect(result).toEqual([{ seatId: 's3', participantId: 'p-new', expected: null }]);
  });

  it('빈좌석보다 참가자가 많으면 좌석 수만큼만 배정', () => {
    const result = computeWaitlistFill({
      tables: [table('t1', 'open', 'none')],
      seats: [seat('s1', 't1', 1, 1, null)],
      unseatedParticipantIds: ['p1', 'p2'],
    });
    expect(result).toHaveLength(1);
  });

  it('테이블 균형 — 인원 적은 테이블 우선', () => {
    const result = computeWaitlistFill({
      tables: [table('t1', 'open', 'none'), table('t2', 'open', 'none')],
      seats: [
        seat('a1', 't1', 1, 1, 'x'), seat('a2', 't1', 1, 2, null),
        seat('b1', 't2', 2, 1, null), seat('b2', 't2', 2, 2, null),
      ],
      unseatedParticipantIds: ['p1'],
    });
    // t2(0명) 가 t1(1명)보다 비어있으므로 t2 먼저.
    expect(result[0].seatId).toBe('b1');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/domains/ops/seatAssignment -v`
Expected: FAIL ("Cannot find module '../waitlistFill'").

- [ ] **Step 3: 구현**

```typescript
/** 대기채움(waitlist-fill) 좌석 배정 — 순수함수. 빈좌석(open·unlocked)에 미착석 참가자 균형 배분. */
export interface WaitlistFillSeat {
  id: string;
  tableId: string;
  tableNo: number;
  seatNo: number;
  participantId: string | null;
}
export interface WaitlistFillTable {
  id: string;
  status: 'open' | 'closed' | 'standby';
  lockType: 'none' | 'locked' | 'feature';
}
export interface WaitlistFillInput {
  tables: readonly WaitlistFillTable[];
  seats: readonly WaitlistFillSeat[];
  unseatedParticipantIds: readonly string[];
}
export interface WaitlistAssignment {
  seatId: string;
  participantId: string;
  expected: string | null;
}

export function computeWaitlistFill(input: WaitlistFillInput): WaitlistAssignment[] {
  const eligibleTableIds = new Set(
    input.tables.filter((t) => t.status === 'open' && t.lockType === 'none').map((t) => t.id)
  );
  // 테이블별 현재 점유 수.
  const occupancy = new Map<string, number>();
  for (const s of input.seats) {
    if (s.participantId) occupancy.set(s.tableId, (occupancy.get(s.tableId) ?? 0) + 1);
  }
  // 빈좌석(적격 테이블).
  const emptySeats = input.seats
    .filter((s) => !s.participantId && eligibleTableIds.has(s.tableId))
    .map((s) => ({ ...s }));

  const assignments: WaitlistAssignment[] = [];
  const working = occupancy; // 배정하며 점유 카운트 증가.
  for (const participantId of input.unseatedParticipantIds) {
    // 점유 적은 테이블의 빈좌석 우선 → (table_no, seat_no) 안정 정렬.
    const next = emptySeats
      .filter((s) => !assignments.some((a) => a.seatId === s.id))
      .sort((a, b) => {
        const oa = working.get(a.tableId) ?? 0;
        const ob = working.get(b.tableId) ?? 0;
        if (oa !== ob) return oa - ob;
        if (a.tableNo !== b.tableNo) return a.tableNo - b.tableNo;
        return a.seatNo - b.seatNo;
      })[0];
    if (!next) break; // 빈좌석 소진.
    assignments.push({ seatId: next.id, participantId, expected: null });
    working.set(next.tableId, (working.get(next.tableId) ?? 0) + 1);
  }
  return assignments;
}
```

```typescript
// src/domains/ops/seatAssignment/index.ts
export * from './waitlistFill';
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/domains/ops/seatAssignment -v`
Expected: PASS (4 tests).

- [ ] **Step 5: 도메인 배럴 + tsc**

`src/domains/ops/index.ts`에 `export * from './seatAssignment';` 추가.
Run: `cd uniqn-mobile && npm run type-check`
Expected: 0 errors.

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/domains/ops/seatAssignment uniqn-mobile/src/domains/ops/index.ts
git commit -m "feat(ops): 1b 도메인 — 대기채움 좌석배정 순수함수(테이블 균형·lock/standby 제외)"
```

---

## Task 4: 타입 + 에러코드 + Zod 스키마

**Files:**
- Modify: `src/types/ops.ts`
- Modify: `src/errors/AppError.ts`
- Create: `src/schemas/opsSeat.schema.ts`
- Create: `src/schemas/__tests__/opsSeat.schema.test.ts`

**Interfaces:**
- Produces: 타입 `OpsTableStatus`/`OpsTableLockType`/`OpsTable`/`OpsSeat`. 에러코드 `OPS_SEAT_TAKEN`(E6106)·`OPS_SEAT_NOT_OCCUPIED`(E6107)·`OPS_TABLE_NOT_FOUND`(E6108)·`OPS_SEAT_VERSION_CONFLICT`(E6109)·`OPS_NO_EMPTY_SEAT`(E6110)·`OPS_TABLE_HAS_OCCUPANTS`(E6111)·`OPS_PARTICIPANT_ALREADY_SEATED`(E6112). 스키마 `addTableSchema`/`moveSeatSchema`.

- [ ] **Step 1: 타입 추가** (`src/types/ops.ts`)

```typescript
export type OpsTableStatus = (typeof Constants.public.Enums.ops_table_status)[number];
export type OpsTableLockType = (typeof Constants.public.Enums.ops_table_lock_type)[number];

/** 라이브 운영 테이블 */
export interface OpsTable {
  id: string;
  tournamentId: string;
  tableNo: number;
  name?: string | null;
  status: OpsTableStatus;
  assignedStaffId?: string | null;
  lockType: OpsTableLockType;
  priority?: number | null;
  position?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** 좌석(단일 점유원) */
export interface OpsSeat {
  id: string;
  tournamentId: string;
  tableId: string;
  tableNo: number;
  seatNo: number;
  participantId?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: 에러코드 추가** (`src/errors/AppError.ts` L180 이후 + 메시지)

```typescript
  OPS_SEAT_TAKEN: 'E6106', // 점유 좌석 배정/이동
  OPS_SEAT_NOT_OCCUPIED: 'E6107', // 빈 좌석 이동/비우기
  OPS_TABLE_NOT_FOUND: 'E6108', // 테이블 없음
  OPS_SEAT_VERSION_CONFLICT: 'E6109', // redraw TOCTOU 충돌
  OPS_NO_EMPTY_SEAT: 'E6110', // 빈좌석 없음
  OPS_TABLE_HAS_OCCUPANTS: 'E6111', // 점유 좌석 있는 테이블 close
  OPS_PARTICIPANT_ALREADY_SEATED: 'E6112', // 이미 착석
```

```typescript
  [ERROR_CODES.OPS_SEAT_TAKEN]: '이미 사용 중인 좌석입니다',
  [ERROR_CODES.OPS_SEAT_NOT_OCCUPIED]: '비어 있는 좌석입니다',
  [ERROR_CODES.OPS_TABLE_NOT_FOUND]: '테이블을 찾을 수 없습니다',
  [ERROR_CODES.OPS_SEAT_VERSION_CONFLICT]: '좌석 상태가 변경되었습니다. 다시 시도해 주세요',
  [ERROR_CODES.OPS_NO_EMPTY_SEAT]: '빈 좌석이 없습니다',
  [ERROR_CODES.OPS_TABLE_HAS_OCCUPANTS]: '점유된 좌석이 있어 닫을 수 없습니다',
  [ERROR_CODES.OPS_PARTICIPANT_ALREADY_SEATED]: '이미 좌석이 배정된 참가자입니다',
```

- [ ] **Step 3: 스키마 실패 테스트** (`src/schemas/__tests__/opsSeat.schema.test.ts`)

```typescript
import { addTableSchema, moveSeatSchema } from '@/schemas/opsSeat.schema';

describe('addTableSchema', () => {
  it('유효 입력 통과', () => {
    expect(addTableSchema.safeParse({ tournamentId: 'a', seatCount: 9, lockType: 'none' }).success).toBe(true);
  });
  it('seatCount 범위 밖 거부', () => {
    expect(addTableSchema.safeParse({ tournamentId: 'a', seatCount: 99, lockType: 'none' }).success).toBe(false);
  });
  it('name XSS 거부', () => {
    expect(addTableSchema.safeParse({ tournamentId: 'a', seatCount: 9, lockType: 'none', name: '<script>x' }).success).toBe(false);
  });
});

describe('moveSeatSchema', () => {
  it('동일 좌석 거부', () => {
    expect(moveSeatSchema.safeParse({ fromSeatId: 's1', toSeatId: 's1' }).success).toBe(false);
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/schemas/__tests__/opsSeat.schema.test.ts -v`
Expected: FAIL (모듈 없음).

- [ ] **Step 5: 스키마 구현** (`src/schemas/opsSeat.schema.ts` — `opsTournament.schema.ts`의 xss refine 패턴 미러)

```typescript
import { z } from 'zod';
import { xssValidation } from '@/utils/security';

const safeText = (max: number) =>
  z.string().max(max).refine(xssValidation, { message: '허용되지 않는 문자가 포함되어 있습니다' });

export const addTableSchema = z.object({
  tournamentId: z.string().min(1),
  seatCount: z.number().int().min(1).max(11),
  name: safeText(50).optional(),
  lockType: z.enum(['none', 'locked', 'feature']),
  priority: z.number().int().optional(),
});
export type AddTableForm = z.infer<typeof addTableSchema>;

export const moveSeatSchema = z
  .object({ fromSeatId: z.string().min(1), toSeatId: z.string().min(1) })
  .refine((v) => v.fromSeatId !== v.toSeatId, { message: '같은 좌석으로 이동할 수 없습니다' });

export const redrawWaitlistFillSchema = z.object({
  tournamentId: z.string().min(1),
  assignments: z
    .array(
      z.object({
        seatId: z.string().min(1),
        participantId: z.string().min(1),
        expected: z.string().nullable(),
      })
    )
    .min(1),
});
```

> 참고: `xssValidation` 의 정확한 import 경로는 `opsTournament.schema.ts`에서 확인 후 일치시킬 것(현재 프로젝트 보안 유틸 위치).

- [ ] **Step 6: 통과 + tsc + 커밋**

Run: `cd uniqn-mobile && npx jest src/schemas/__tests__/opsSeat.schema.test.ts && npm run type-check`
Expected: PASS · 0 errors.
```bash
git add uniqn-mobile/src/types/ops.ts uniqn-mobile/src/errors/AppError.ts uniqn-mobile/src/schemas/opsSeat.schema.ts uniqn-mobile/src/schemas/__tests__/opsSeat.schema.test.ts
git commit -m "feat(ops): 1b 타입(OpsTable/OpsSeat)+에러코드 E6106~6112+좌석 Zod 스키마(xss)"
```

---

## Task 5: Repository (interface + Supabase impl)

**Files:**
- Create: `src/repositories/interfaces/IOpsTableRepository.ts`
- Create: `src/repositories/interfaces/IOpsSeatRepository.ts`
- Create: `src/repositories/supabase/OpsTableRepository.ts`
- Create: `src/repositories/supabase/OpsSeatRepository.ts`
- Modify: `src/repositories/supabase/opsRpcError.ts`
- Modify: `src/repositories/ops.ts`

**Interfaces:**
- Consumes: 타입(Task 4), RPC(Task 2), `mapOpsRpcError`/`handleSupabaseError`/`toCamelCase`.
- Produces: `IOpsTableRepository{ listByTournament(tid), addTable(input, actorId), setLock(tableId, actorId, lockType), setPriority(tableId, actorId, priority), closeTable(tableId, actorId, status) }`, `IOpsSeatRepository{ listByTournament(tid), assignSeat(seatId, participantId, actorId), moveSeat(fromSeatId, toSeatId, actorId), freeSeat(seatId, actorId), redrawWaitlistFill(tid, actorId, assignments) }`. 싱글톤 `opsTableRepository`/`opsSeatRepository`.

- [ ] **Step 1: opsRpcError PREFIX_MAP 확장** (`opsRpcError.ts`)

```typescript
// PREFIX_MAP 배열에 추가:
  ['SEAT_VERSION_CONFLICT', ERROR_CODES.OPS_SEAT_VERSION_CONFLICT, ERROR_CODES.OPS_SEAT_VERSION_CONFLICT],
  ['SEAT_TAKEN', ERROR_CODES.OPS_SEAT_TAKEN, ERROR_CODES.OPS_SEAT_TAKEN],
  ['SEAT_NOT_OCCUPIED', ERROR_CODES.OPS_SEAT_NOT_OCCUPIED, ERROR_CODES.OPS_SEAT_NOT_OCCUPIED],
  ['TABLE_HAS_OCCUPANTS', ERROR_CODES.OPS_TABLE_HAS_OCCUPANTS, ERROR_CODES.OPS_TABLE_HAS_OCCUPANTS],
  ['TABLE_NOT_FOUND', ERROR_CODES.OPS_TABLE_NOT_FOUND, ERROR_CODES.OPS_TABLE_NOT_FOUND],
  ['PARTICIPANT_ALREADY_SEATED', ERROR_CODES.OPS_PARTICIPANT_ALREADY_SEATED, ERROR_CODES.OPS_PARTICIPANT_ALREADY_SEATED],
  ['SEAT_NOT_FOUND', ERROR_CODES.OPS_SEAT_NOT_OCCUPIED, ERROR_CODES.OPS_SEAT_NOT_OCCUPIED],
  ['TABLE_NOT_OPEN', ERROR_CODES.OPS_SEAT_TAKEN, ERROR_CODES.OPS_SEAT_TAKEN],
  ['INVALID_MOVE', ERROR_CODES.BUSINESS_INVALID_STATE, ERROR_CODES.BUSINESS_INVALID_STATE],
```
> ⚠️ `PARTICIPANT_NOT_ACTIVE`/`PARTICIPANT_NOT_FOUND`/`TOURNAMENT_NOT_FOUND`/`REGISTRATION_CLOSED`는 1a에 이미 존재 — 중복 추가 금지. 순서: 더 구체적인 접두사(`SEAT_VERSION_CONFLICT`)를 `SEAT_TAKEN`보다 먼저(부분일치 우선순위).

- [ ] **Step 2: interface 작성** (두 파일)

```typescript
// IOpsTableRepository.ts
import type { OpsTable, OpsTableStatus, OpsTableLockType } from '@/types/ops';

export interface AddTableInput {
  tournamentId: string;
  seatCount: number;
  name?: string;
  lockType: OpsTableLockType;
  priority?: number;
}

export interface IOpsTableRepository {
  listByTournament(tournamentId: string): Promise<OpsTable[]>;
  addTable(input: AddTableInput, actorId: string): Promise<{ tableId: string; tableNo: number }>;
  setLock(tableId: string, actorId: string, lockType: OpsTableLockType): Promise<void>;
  setPriority(tableId: string, actorId: string, priority: number | null): Promise<void>;
  closeTable(tableId: string, actorId: string, status: OpsTableStatus): Promise<void>;
}
```

```typescript
// IOpsSeatRepository.ts
import type { OpsSeat } from '@/types/ops';
import type { WaitlistAssignment } from '@/domains/ops';

export interface IOpsSeatRepository {
  listByTournament(tournamentId: string): Promise<OpsSeat[]>;
  assignSeat(seatId: string, participantId: string, actorId: string): Promise<void>;
  moveSeat(fromSeatId: string, toSeatId: string, actorId: string): Promise<void>;
  freeSeat(seatId: string, actorId: string): Promise<void>;
  redrawWaitlistFill(
    tournamentId: string,
    actorId: string,
    assignments: readonly WaitlistAssignment[]
  ): Promise<{ moved: number }>;
}
```

- [ ] **Step 3: Supabase impl 작성** (`OpsParticipantRepository.ts` try/catch·rpc 패턴 미러)

```typescript
// OpsTableRepository.ts
import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { AddTableInput, IOpsTableRepository } from '../interfaces/IOpsTableRepository';
import type { OpsTable, OpsTableStatus, OpsTableLockType } from '@/types/ops';

const TABLE = 'ops_tables' as const;
const COLUMNS =
  'id, tournament_id, table_no, name, status, assigned_staff_id, lock_type, priority, position, created_at, updated_at';

export class SupabaseOpsTableRepository implements IOpsTableRepository {
  async listByTournament(tournamentId: string): Promise<OpsTable[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE).select(COLUMNS).eq('tournament_id', tournamentId)
        .order('table_no', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 테이블 목록', table: TABLE });
      return (data ?? []).map((r) => toCamelCase<OpsTable>(r as Record<string, unknown>));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 테이블 목록', table: TABLE });
    }
  }

  async addTable(input: AddTableInput, actorId: string): Promise<{ tableId: string; tableNo: number }> {
    try {
      const { data, error } = await supabase.rpc('ops_add_table', {
        p_tournament_id: input.tournamentId, p_actor_id: actorId,
        p_seat_count: input.seatCount, p_name: input.name ?? null,
        p_lock_type: input.lockType, p_priority: input.priority ?? null,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 추가' });
      const r = data as { table_id: string; table_no: number };
      return { tableId: r.table_id, tableNo: r.table_no };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 테이블 추가' });
    }
  }

  async setLock(tableId: string, actorId: string, lockType: OpsTableLockType): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_set_table_lock',
        { p_table_id: tableId, p_actor_id: actorId, p_lock_type: lockType });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 잠금' });
    } catch (error) { if (isAppError(error)) throw error; mapOpsRpcError(error, { operation: 'ops 테이블 잠금' }); }
  }

  async setPriority(tableId: string, actorId: string, priority: number | null): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_set_table_priority',
        { p_table_id: tableId, p_actor_id: actorId, p_priority: priority });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 우선순위' });
    } catch (error) { if (isAppError(error)) throw error; mapOpsRpcError(error, { operation: 'ops 테이블 우선순위' }); }
  }

  async closeTable(tableId: string, actorId: string, status: OpsTableStatus): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_close_table',
        { p_table_id: tableId, p_actor_id: actorId, p_status: status });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 닫기' });
    } catch (error) { if (isAppError(error)) throw error; mapOpsRpcError(error, { operation: 'ops 테이블 닫기' }); }
  }
}
```

```typescript
// OpsSeatRepository.ts
import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsSeatRepository } from '../interfaces/IOpsSeatRepository';
import type { OpsSeat } from '@/types/ops';
import type { WaitlistAssignment } from '@/domains/ops';

const TABLE = 'ops_seats' as const;
const COLUMNS = 'id, tournament_id, table_id, table_no, seat_no, participant_id, created_at, updated_at';

export class SupabaseOpsSeatRepository implements IOpsSeatRepository {
  async listByTournament(tournamentId: string): Promise<OpsSeat[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE).select(COLUMNS).eq('tournament_id', tournamentId)
        .order('table_no', { ascending: true }).order('seat_no', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 좌석 목록', table: TABLE });
      return (data ?? []).map((r) => toCamelCase<OpsSeat>(r as Record<string, unknown>));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 좌석 목록', table: TABLE });
    }
  }

  async assignSeat(seatId: string, participantId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_assign_seat',
        { p_seat_id: seatId, p_participant_id: participantId, p_actor_id: actorId });
      if (error) mapOpsRpcError(error, { operation: 'ops 좌석 배정' });
    } catch (error) { if (isAppError(error)) throw error; mapOpsRpcError(error, { operation: 'ops 좌석 배정' }); }
  }

  async moveSeat(fromSeatId: string, toSeatId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_move_seat',
        { p_from_seat_id: fromSeatId, p_to_seat_id: toSeatId, p_actor_id: actorId });
      if (error) mapOpsRpcError(error, { operation: 'ops 좌석 이동' });
    } catch (error) { if (isAppError(error)) throw error; mapOpsRpcError(error, { operation: 'ops 좌석 이동' }); }
  }

  async freeSeat(seatId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_free_seat', { p_seat_id: seatId, p_actor_id: actorId });
      if (error) mapOpsRpcError(error, { operation: 'ops 좌석 비우기' });
    } catch (error) { if (isAppError(error)) throw error; mapOpsRpcError(error, { operation: 'ops 좌석 비우기' }); }
  }

  async redrawWaitlistFill(
    tournamentId: string, actorId: string, assignments: readonly WaitlistAssignment[]
  ): Promise<{ moved: number }> {
    try {
      const { data, error } = await supabase.rpc('ops_redraw_waitlist_fill', {
        p_tournament_id: tournamentId, p_actor_id: actorId,
        p_assignments: assignments.map((a) => ({
          seat_id: a.seatId, participant_id: a.participantId, expected: a.expected,
        })),
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 대기채움 redraw' });
      return { moved: (data as { moved: number }).moved };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 대기채움 redraw' });
    }
  }
}
```

- [ ] **Step 4: 배럴 확장** (`src/repositories/ops.ts`)

```typescript
import { SupabaseOpsTableRepository } from './supabase/OpsTableRepository';
import { SupabaseOpsSeatRepository } from './supabase/OpsSeatRepository';
export type { IOpsTableRepository, AddTableInput } from './interfaces/IOpsTableRepository';
export type { IOpsSeatRepository } from './interfaces/IOpsSeatRepository';
export { SupabaseOpsTableRepository } from './supabase/OpsTableRepository';
export { SupabaseOpsSeatRepository } from './supabase/OpsSeatRepository';
export const opsTableRepository = new SupabaseOpsTableRepository();
export const opsSeatRepository = new SupabaseOpsSeatRepository();
```

- [ ] **Step 5: tsc + 커밋**

Run: `cd uniqn-mobile && npm run type-check`
Expected: 0 errors.
```bash
git add uniqn-mobile/src/repositories
git commit -m "feat(ops): 1b 리포지토리 — 테이블/좌석 interface+impl + RPC 에러매퍼 확장 + 배럴"
```

---

## Task 6: Service

**Files:**
- Create: `src/services/ops/opsTableService.ts`
- Create: `src/services/ops/opsSeatService.ts`
- Create: `src/services/ops/__tests__/opsSeatService.test.ts`
- Modify: `src/services/ops/index.ts`

**Interfaces:**
- Consumes: repo 싱글톤(Task 5), 스키마(Task 4).
- Produces: `opsTableService.{ addTable, setLock, setPriority, closeTable }`, `opsSeatService.{ assignSeat, moveSeat, freeSeat, redrawWaitlistFill }`(namespace export via index).

- [ ] **Step 1: 실패 테스트** (`opsParticipantService.test.ts` 미러 — 유효입력 위임 + 검증실패)

```typescript
import * as repo from '@/repositories/ops';
import { addTable } from '@/services/ops/opsTableService';

jest.mock('@/repositories/ops', () => ({
  opsTableRepository: { addTable: jest.fn().mockResolvedValue({ tableId: 't', tableNo: 1 }) },
  opsSeatRepository: {},
}));

describe('opsTableService.addTable', () => {
  it('유효 입력 → Repository 위임', async () => {
    const r = await addTable({ tournamentId: 't1', seatCount: 9, lockType: 'none' }, 'actor');
    expect(r.tableNo).toBe(1);
    expect((repo.opsTableRepository.addTable as jest.Mock)).toHaveBeenCalled();
  });
  it('seatCount 범위 밖 → ValidationError, Repository 미호출', async () => {
    (repo.opsTableRepository.addTable as jest.Mock).mockClear();
    await expect(addTable({ tournamentId: 't1', seatCount: 99, lockType: 'none' }, 'actor')).rejects.toBeTruthy();
    expect((repo.opsTableRepository.addTable as jest.Mock)).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/services/ops/__tests__/opsSeatService.test.ts -v`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: 서비스 구현** (`opsParticipantService.ts` 패턴 미러 — safeParse → 위임 → handleServiceError)

```typescript
// opsTableService.ts
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { opsTableRepository, type AddTableInput } from '@/repositories/ops';
import { addTableSchema } from '@/schemas/opsSeat.schema';
import type { OpsTableStatus, OpsTableLockType } from '@/types/ops';

const COMPONENT = 'opsTableService';

export async function addTable(input: AddTableInput, actorId: string) {
  try {
    logger.info('ops 테이블 추가', { component: COMPONENT, tournamentId: input.tournamentId });
    const parsed = addTableSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsTableRepository.addTable(input, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '테이블 추가', component: COMPONENT });
  }
}

export async function setLock(tableId: string, actorId: string, lockType: OpsTableLockType) {
  try { await opsTableRepository.setLock(tableId, actorId, lockType); }
  catch (error) { if (isAppError(error)) throw error; throw handleServiceError(error, { operation: '테이블 잠금', component: COMPONENT }); }
}
export async function setPriority(tableId: string, actorId: string, priority: number | null) {
  try { await opsTableRepository.setPriority(tableId, actorId, priority); }
  catch (error) { if (isAppError(error)) throw error; throw handleServiceError(error, { operation: '테이블 우선순위', component: COMPONENT }); }
}
export async function closeTable(tableId: string, actorId: string, status: OpsTableStatus) {
  try { await opsTableRepository.closeTable(tableId, actorId, status); }
  catch (error) { if (isAppError(error)) throw error; throw handleServiceError(error, { operation: '테이블 닫기', component: COMPONENT }); }
}
```

```typescript
// opsSeatService.ts
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsSeatRepository } from '@/repositories/ops';
import type { WaitlistAssignment } from '@/domains/ops';

const COMPONENT = 'opsSeatService';

export async function assignSeat(seatId: string, participantId: string, actorId: string) {
  try { await opsSeatRepository.assignSeat(seatId, participantId, actorId); }
  catch (error) { if (isAppError(error)) throw error; throw handleServiceError(error, { operation: '좌석 배정', component: COMPONENT }); }
}
export async function moveSeat(fromSeatId: string, toSeatId: string, actorId: string) {
  try { await opsSeatRepository.moveSeat(fromSeatId, toSeatId, actorId); }
  catch (error) { if (isAppError(error)) throw error; throw handleServiceError(error, { operation: '좌석 이동', component: COMPONENT }); }
}
export async function freeSeat(seatId: string, actorId: string) {
  try { await opsSeatRepository.freeSeat(seatId, actorId); }
  catch (error) { if (isAppError(error)) throw error; throw handleServiceError(error, { operation: '좌석 비우기', component: COMPONENT }); }
}
export async function redrawWaitlistFill(
  tournamentId: string, actorId: string, assignments: readonly WaitlistAssignment[]
) {
  try {
    logger.info('ops 대기채움 redraw', { component: COMPONENT, tournamentId, count: assignments.length });
    return await opsSeatRepository.redrawWaitlistFill(tournamentId, actorId, assignments);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '대기채움 redraw', component: COMPONENT });
  }
}
```

- [ ] **Step 4: index namespace export** (`src/services/ops/index.ts` — 기존 패턴 따라 `import * as` namespace)

```typescript
import * as opsTableService from './opsTableService';
import * as opsSeatService from './opsSeatService';
export { opsTableService, opsSeatService };
// (기존 opsTournamentService/opsParticipantService export 유지)
```

- [ ] **Step 5: 통과 + tsc + 커밋**

Run: `cd uniqn-mobile && npx jest src/services/ops && npm run type-check`
Expected: PASS · 0 errors.
```bash
git add uniqn-mobile/src/services/ops
git commit -m "feat(ops): 1b 서비스 — 테이블/좌석(검증·위임) + 서비스테스트"
```

---

## Task 7: Hooks + queryKeys

**Files:**
- Modify: `src/lib/queryClient.ts`
- Create: `src/hooks/ops/useOpsTables.ts`
- Create: `src/hooks/ops/useOpsSeats.ts`
- Modify: `src/hooks/ops/useOpsMutations.ts`
- Modify: `src/hooks/ops/index.ts`

**Interfaces:**
- Consumes: service(Task 6), 도메인 `computeWaitlistFill`(Task 3), repo 싱글톤.
- Produces: `useOpsTables(tid)`, `useOpsSeats(tid)`, 변이훅 `useAddTable`/`useSetTableLock`/`useSetTablePriority`/`useCloseTable`/`useAssignSeat`/`useMoveSeat`/`useFreeSeat`/`useRedrawWaitlistFill`. `queryKeys.ops.tables(tid)`/`seats(tid)`.

- [ ] **Step 1: queryKeys 추가** (`src/lib/queryClient.ts` L569 부근, `forPosting` 옆)

```typescript
    tables: (tournamentId: string) => [...queryKeys.ops.all, 'tables', tournamentId] as const,
    seats: (tournamentId: string) => [...queryKeys.ops.all, 'seats', tournamentId] as const,
```

- [ ] **Step 2: 읽기 훅** (`useOpsParticipants.ts` realtime 패턴 미러)

```typescript
// useOpsTables.ts
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsTableRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';

export function useOpsTables(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tournamentId ? queryKeys.ops.tables(tournamentId) : [...queryKeys.ops.all, 'tables', 'none'],
    queryFn: () => opsTableRepository.listByTournament(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });
  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription('ops_tables', `tournament_id=eq.${tournamentId}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
    });
  }, [tournamentId, queryClient]);
  return { tables: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}
```

```typescript
// useOpsSeats.ts (동형, ops_seats / queryKeys.ops.seats)
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsSeatRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';

export function useOpsSeats(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tournamentId ? queryKeys.ops.seats(tournamentId) : [...queryKeys.ops.all, 'seats', 'none'],
    queryFn: () => opsSeatRepository.listByTournament(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });
  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription('ops_seats', `tournament_id=eq.${tournamentId}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
    });
  }, [tournamentId, queryClient]);
  return { seats: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}
```

- [ ] **Step 3: 변이 훅** (`useOpsMutations.ts` 추가 — 기존 `requireActor`/`toast`/`toError` 재사용. seats+tables 무효화)

```typescript
// useOpsMutations.ts 에 추가 (import: opsTableService, opsSeatService from '@/services/ops';
//   computeWaitlistFill from '@/domains/ops'; OpsTableStatus, OpsTableLockType from '@/types/ops')

export function useAddTable(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (input: { seatCount: number; name?: string; lockType: OpsTableLockType; priority?: number }) =>
      opsTableService.addTable({ ...input, tournamentId }, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      toast.success('테이블을 추가했습니다');
    },
    onError: (e) => { logger.error('ops 테이블 추가 실패', toError(e)); toast.error(extractUserMessage(e) || '테이블 추가에 실패했습니다'); },
  });
}

export function useMoveSeat(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: { fromSeatId: string; toSeatId: string }) =>
      opsSeatService.moveSeat(v.fromSeatId, v.toSeatId, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      toast.success('좌석을 이동했습니다');
    },
    onError: (e) => { logger.error('ops 좌석 이동 실패', toError(e)); toast.error(extractUserMessage(e) || '좌석 이동에 실패했습니다'); },
  });
}

export function useFreeSeat(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (seatId: string) => opsSeatService.freeSeat(seatId, requireActor(actorId)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) }); toast.success('좌석을 비웠습니다'); },
    onError: (e) => { logger.error('ops 좌석 비우기 실패', toError(e)); toast.error(extractUserMessage(e) || '좌석 비우기에 실패했습니다'); },
  });
}

export function useRedrawWaitlistFill(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (assignments: ReturnType<typeof computeWaitlistFill>) =>
      opsSeatService.redrawWaitlistFill(tournamentId, requireActor(actorId), assignments),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      toast.success(`${r.moved}명 좌석 배정 완료`);
    },
    onError: (e) => { logger.error('ops redraw 실패', toError(e)); toast.error(extractUserMessage(e) || '좌석 배정에 실패했습니다'); },
  });
}
// useSetTableLock / useSetTablePriority / useCloseTable / useAssignSeat 도 동형으로 추가
// (각각 opsTableService.setLock/setPriority/closeTable, opsSeatService.assignSeat 위임 + tables/seats 무효화).
```

- [ ] **Step 4: 훅 배럴 재노출** (`src/hooks/ops/index.ts`)

```typescript
export * from './useOpsTables';
export * from './useOpsSeats';
// (기존 export + useOpsMutations 신규 함수는 이미 export * 로 노출)
```

- [ ] **Step 5: tsc + 커밋**

Run: `cd uniqn-mobile && npm run type-check`
Expected: 0 errors.
```bash
git add uniqn-mobile/src/lib/queryClient.ts uniqn-mobile/src/hooks/ops
git commit -m "feat(ops): 1b 훅 — 테이블/좌석 읽기(realtime)+변이 + queryKeys"
```

---

## Task 8: UI — TABLES 세그먼트 + 좌석 그리드 + Redraw

**Files:**
- Modify: `app/(ops)/tournaments/[id].tsx`
- Create: `app/(ops)/tournaments/components/TablesTab.tsx`
- Create: `app/(ops)/tournaments/components/RedrawModal.tsx`

**Interfaces:**
- Consumes: `useOpsTables`/`useOpsSeats`/`useOpsParticipants`/변이훅(Task 7), `computeWaitlistFill`(Task 3).

- [ ] **Step 1: 세그먼트 확장** — `[id].tsx`의 `useState<'players'|'status'>` → `'players'|'status'|'tables'`, 세그먼트 버튼 라벨 `TABLES (${tables.length})` 추가, `tab === 'tables'` 시 `<TablesTab tournamentId={id} />` 렌더.

- [ ] **Step 2: TablesTab 작성** — `useOpsTables`+`useOpsSeats`+`useOpsParticipants` 구독. 테이블별 행(Idx/Seats/Empty/Filled, lock/priority 아이콘). 테이블 탭 → 좌석 그리드(seat_no 격자, 점유=참가자명/빈=+). 좌석 액션(이동/비우기/배정), 테이블 액션(lock/priority/close). `+ 테이블 추가` 폼(seatCount/name/lockType/priority → `useAddTable`). `Redraw` 버튼 → `RedrawModal`. NativeWind `dark:` + FlashList(좌석 多시) 규약 준수.

- [ ] **Step 3: RedrawModal 작성** — `computeWaitlistFill({ tables, seats, unseatedParticipantIds })`로 미리보기 계산(unseated = 좌석에 없는 active/checked_in 참가자 id). before→after 목록 표시("Komaki 대기 → 99-4"). `[확인]` → `useRedrawWaitlistFill(assignments)`. 충돌(`SEAT_VERSION_CONFLICT`) 시 toast + 재계산 안내.

- [ ] **Step 4: 수동 검증** — `npm start` 웹, ops 대회 상세 → TABLES 탭: 테이블 추가 → 좌석 그리드 → 등록(auto-seat) → 좌석 채워짐 확인 → move/free → redraw 미리보기/확정. 다크모드 토글.

- [ ] **Step 5: tsc + 커밋**

Run: `cd uniqn-mobile && npm run type-check`
Expected: 0 errors.
```bash
git add "uniqn-mobile/app/(ops)/tournaments"
git commit -m "feat(ops): 1b UI — TABLES 탭(테이블/좌석 그리드·추가·lock/priority·move/free·Redraw 미리보기)"
```

---

## Task 9: pgTAP — 단일점유·move/free·redraw TOCTOU·RLS

**Files:**
- Modify: `supabase/fixtures/ops_helpers.sql`
- Create: `supabase/tests/ops_seats_single_occupancy.test.sql`
- Create: `supabase/tests/ops_seat_move_free.test.sql`
- Create: `supabase/tests/ops_redraw_toctou.test.sql`
- Create: `supabase/tests/ops_tables_seats_rls.test.sql`

**Interfaces:**
- Consumes: `ops_test_seed()`/`ops_test_set_user()`(1a fixture), 1b 마이그(Task 1·2).

- [ ] **Step 1: fixture 확장** — `ops_test_seed()`에 테이블1(`v_tbl`, table_no 1, open/none) + 좌석 2개(seat_no 1·2, 빈) 시드. RETURN TABLE에 `table_id uuid, seat1_id uuid, seat2_id uuid` 추가(기존 컬럼 유지, 호출부 `SELECT * INTO s` 는 record라 추가 무해).

```sql
-- ops_test_seed() 본문 끝, RETURN QUERY 직전에:
DECLARE v_tbl uuid := gen_random_uuid(); v_s1 uuid := gen_random_uuid(); v_s2 uuid := gen_random_uuid();
-- (DECLARE 는 함수 상단 블록에 병합)
INSERT INTO public.ops_tables (id, tournament_id, table_no, status, lock_type)
  VALUES (v_tbl, v_t, 1, 'open', 'none');
INSERT INTO public.ops_seats (id, tournament_id, table_id, table_no, seat_no, participant_id)
  VALUES (v_s1, v_t, v_tbl, 1, 1, NULL), (v_s2, v_t, v_tbl, 1, 2, NULL);
-- RETURN QUERY SELECT ... , v_tbl, v_s1, v_s2;  (시그니처 RETURNS TABLE 확장)
```

- [ ] **Step 2: 단일점유 테스트** (`ops_seats_single_occupancy.test.sql`)

```sql
-- 한 참가자는 대회내 최대 1좌석 (partial UNIQUE). assign 후 다른 좌석 assign 거부.
BEGIN;
SELECT plan(3);
DO $$ DECLARE s RECORD; BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.p', s.participant_id::text, true);
  PERFORM set_config('ops.s1', s.seat1_id::text, true);
  PERFORM set_config('ops.s2', s.seat2_id::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
-- 첫 배정 성공
SELECT lives_ok($$ SELECT public.ops_assign_seat(
  (current_setting('ops.s1'))::uuid, (current_setting('ops.p'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'assign seat 1 succeeds');
-- 같은 참가자 두번째 좌석 → PARTICIPANT_ALREADY_SEATED
SELECT throws_ok($$ SELECT public.ops_assign_seat(
  (current_setting('ops.s2'))::uuid, (current_setting('ops.p'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'same participant cannot take a second seat');
-- 점유 좌석에 다른 참가자(시드 참가자 1명뿐이라 self 재시도 대체) → SEAT_TAKEN
SELECT throws_ok($$ SELECT public.ops_assign_seat(
  (current_setting('ops.s1'))::uuid, (current_setting('ops.p'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'occupied seat rejects assign');
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: move/free 테스트** (`ops_seat_move_free.test.sql`) — assign s1 → move s1→s2(성공, s1 빈·s2 점유) → free s2(성공) → free s2 재시도(SEAT_NOT_OCCUPIED). plan(4~5). `is((SELECT participant_id FROM ops_seats WHERE id=s2), p)` 등으로 상태 검증.

- [ ] **Step 4: redraw TOCTOU 테스트** (`ops_redraw_toctou.test.sql`)

```sql
-- expected 불일치 시 SEAT_VERSION_CONFLICT. 일치 시 성공.
BEGIN;
SELECT plan(2);
DO $$ DECLARE s RECORD; BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.t', s.tournament_id::text, true);
  PERFORM set_config('ops.p', s.participant_id::text, true);
  PERFORM set_config('ops.s1', s.seat1_id::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
-- expected=비-NULL(실제는 빈좌석)이라 불일치 → 충돌
SELECT throws_ok(format($$ SELECT public.ops_redraw_waitlist_fill(%L::uuid, %L::uuid,
  jsonb_build_array(jsonb_build_object('seat_id', %L, 'participant_id', %L, 'expected', %L))) $$,
  current_setting('ops.t'), current_setting('ops.owner_id'),
  current_setting('ops.s1'), current_setting('ops.p'), gen_random_uuid()::text),
  'P0001', NULL, 'stale expected -> SEAT_VERSION_CONFLICT');
-- expected=null(현재 빈좌석과 일치) → 성공, moved=1
SELECT is((public.ops_redraw_waitlist_fill(
  (current_setting('ops.t'))::uuid, (current_setting('ops.owner_id'))::uuid,
  jsonb_build_array(jsonb_build_object('seat_id', current_setting('ops.s1'),
    'participant_id', current_setting('ops.p'), 'expected', NULL))) ->> 'moved')::int,
  1, 'matching expected (null) fills 1 seat');
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 5: RLS + anon REVOKE 테스트** (`ops_tables_seats_rls.test.sql`) — owner/member sees tables/seats, outsider 0. anon EXECUTE on `ops_add_table`/`ops_move_seat`/`ops_redraw_waitlist_fill` = false, authenticated = true. `ops_tables_rls.test.sql`/`ops_rpc_security.test.sql` 패턴 미러. plan(~7).

- [ ] **Step 6: 전체 pgTAP 실행 + 1a 회귀 확인**

Run: `cd uniqn-mobile && npx supabase db reset && npm run test:db`
Expected: 1a 4파일 + 1b 4파일 전부 ok. **특히 `ops_rpc_security`(auto-seat 행동변경에도 entry_number=2 유지) GREEN 확인**.

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/supabase/fixtures/ops_helpers.sql uniqn-mobile/supabase/tests/ops_seats_single_occupancy.test.sql uniqn-mobile/supabase/tests/ops_seat_move_free.test.sql uniqn-mobile/supabase/tests/ops_redraw_toctou.test.sql uniqn-mobile/supabase/tests/ops_tables_seats_rls.test.sql
git commit -m "test(ops): 1b pgTAP — 좌석 단일점유·move/free·redraw TOCTOU·테이블/좌석 RLS+anon REVOKE + fixture 좌석 시드"
```

---

## Task 10: 통합 검증 + 1a 회귀 + quality

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: 전체 type-check**

Run: `cd uniqn-mobile && npm run type-check`
Expected: 0 errors.

- [ ] **Step 2: 전체 Jest (1a+1b 도메인/스키마/서비스)**

Run: `cd uniqn-mobile && npx jest src/domains/ops src/schemas src/services/ops`
Expected: 모든 ops 테스트 PASS(1a 18 + 1b 신규). 실패 0.

- [ ] **Step 3: 전체 pgTAP (1a 회귀 포함)**

Run: `cd uniqn-mobile && npx supabase db reset && npm run test:db`
Expected: 1a 4 + 1b 4 = 8파일 전부 ok.

- [ ] **Step 4: quality 게이트**

Run: `cd uniqn-mobile && npm run quality`
Expected: check-css-vars + type-check + lint + format:check 전부 통과.

- [ ] **Step 5: 최종 커밋(있으면) — 없으면 skip.** 이후 prod 마이그 적용·push·OTA는 별도 승인 게이트(1a와 동일 흐름).

---

## Self-Review

**1. Spec 커버리지** (설계 §4.4/§4.5/§7/§10·UX §A2/§B vs 태스크):
- §4.4 ops_tables(lock/priority/status) → Task 1·2(add/set_lock/set_priority/close). ✅
- §4.5 ops_seats(정규화·단일점유·move FOR UPDATE 2행) → Task 1(partial UNIQUE)·Task 2(move_seat). ✅
- §7 move_seat·free_seat·대기채움 배정 → Task 2·3·6·7. ✅ (랜덤/칩스네이크·bust·reenter는 1d — 범위 외, 핀 5)
- §B Redraw 미리보기→TOCTOU 재검증 → Task 3(preview)·Task 2(confirm expected-value)·Task 8(modal). ✅
- UX §A2 TABLES(Idx/Seats/Empty/Filled·추가·lock/priority·좌석그리드) → Task 8. ✅
- auto-seat 동작 활성화 → Task 2(register v2, 핀 4). ✅
- Realtime publication ADD ops_tables/ops_seats → Task 2. ✅
- 좌석 쓰기도 SECDEF RPC + 이벤트 append → Task 2(8 RPC, table_added/closed/redraw/player_moved/seat_freed). ✅

**2. Placeholder 스캔**: TABLES UI(Task 8)는 단계별 스펙은 상세하나 전체 JSX 코드블록은 미포함(기존 [id].tsx PLAYERS 세그먼트 패턴을 따르는 큰 화면 — 구현자는 1a 화면을 참조). DB/도메인/RPC/pgTAP/repo/service/hook은 완전 코드 제공. set_table_priority/lock/assign 변이훅은 "동형" 명시(move/free 완전 코드 제공으로 패턴 확립).

**3. 타입 정합**: `WaitlistAssignment{seatId,participantId,expected}` (도메인) ↔ repo `redrawWaitlistFill(assignments)` ↔ RPC `p_assignments[{seat_id,participant_id,expected}]` 매핑 일치. `OpsTable`/`OpsSeat` 필드 ↔ COLUMNS ↔ 마이그 컬럼 일치. 에러코드 E6106~6112 ↔ opsRpcError PREFIX_MAP ↔ RPC RAISE 접두사 일치.

**오픈 이슈(실행 시 결정)**: ① `xssValidation` import 경로 — `opsTournament.schema.ts` 확인 후 통일. ② TablesTab/RedrawModal 컴포넌트 디렉토리(`components/`) — 1a UI가 단일파일이면 위치 조정. ③ close_table 후 standby↔open 재개 UX(현재 RPC는 지원, UI는 최소).
