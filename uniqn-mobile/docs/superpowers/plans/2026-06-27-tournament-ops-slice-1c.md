# T-HOLDEM 라이브 운영 슬라이스 1c — 클럭/통계/모니터/플레이어뷰 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1a(참가자)·1b(좌석) 위에 **블라인드 서버동기 클럭 + 라이브 통계판(STATUS) + 공개 모니터(전광판) + 공개 플레이어뷰**를 얹어, 한 번의 운영 동작이 모든 화면에 자동 반영되는 "유기적 동기화"를 완성한다.

**Architecture:** Presentation→Hooks→Service→Repository→Supabase 5계층 유지. 신규 테이블 3종(`ops_blind_levels`·`ops_clock`·`ops_live_stats`)은 SELECT-only RLS + SECDEF RPC 쓰기. **타이머 정확도 = 서버 앵커(`level_started_at`) + 클라 똑딱 + 접속 시 시각 보정**(폴링 주기와 무관). **공개 anon 서피스(모니터/플레이어뷰)는 테이블 직접 SELECT 0 — token→스코프 SECDEF RPC 폴링만**(#195 PII 유출 클래스 원천차단). **`ops_live_stats`는 트리거 기반 단일행 재계산**(16개 기존 RPC 무수정).

**Tech Stack:** Expo Router(웹우선)·React 19·TS strict·NativeWind·Supabase(Postgres RLS+RPC+Realtime)·TanStack Query·pgTAP·Jest.

## Global Constraints

- 언어: 모든 주석·커밋·문서·UI 카피 **한글**. 코드 식별자/SQL/라이브러리명만 원문.
- 작업 디렉토리: `uniqn-mobile/`. 경로 `@/` 절대경로. 배포 전 `npm run quality`.
- 아키텍처: Presentation/Hooks에서 Supabase 직접호출 금지. 읽기 전용 TanStack Query만 Repository 직접 호출 허용. 쓰기는 Service 경유.
- 필드명: 앱 camelCase ↔ DB snake_case (`toCamelCase`/`toSnakeCase` 경계 변환).
- 모든 변이는 **SECDEF RPC**: `SET search_path = 'public','extensions','pg_temp'` · actor 가드 `auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin())` · 자식 RPC는 `is_ops_member(t_id, actor) OR is_admin()` 강제 · 비즈니스 RAISE는 `ERRCODE='P0001'` · 호출당 `ops_events` 1행 append.
- **신규 함수(RPC·트리거)는 `REVOKE EXECUTE FROM PUBLIC, anon` 필수**(SECDEF는 advisor `anon_security_definer_function_executable` 적발). **예외: anon 전용 공개 RPC 2종**(`ops_get_monitor_snapshot`·`ops_get_player_view`)만 `GRANT EXECUTE TO anon`.
- 테이블: `ENABLE/FORCE ROW LEVEL SECURITY` + `REVOKE INSERT,UPDATE,DELETE FROM anon, authenticated` + SELECT-only RLS(`is_ops_member` 또는 admin). **공개 anon 서피스는 테이블 SELECT 정책을 추가하지 않는다**(RPC만).
- 마이그레이션: MCP `apply_migration` 전용(`db push` 금지). 멱등(`IF NOT EXISTS`/`ON CONFLICT`). enum 신규 ALTER TYPE 불필요(아래 §enum 확인).
- Zod: 모든 사용자 텍스트 입력 `.refine(xssValidation)`. enum은 `Constants.public.Enums.*` SSOT 파생(하드코딩 금지).
- 불변성·AppError(`src/errors/`)·logger(앱 런타임 `console.log` 금지)·`dark:` 항상·파일 200~400줄.
- 다중행 갱신 = `runTransaction`/단일 RPC.

---

## 0. 그라운드 트루스 (1a/1b 실측 — 구현자 필독)

**이미 존재(1c가 만들지 않음):**

- `ops_tournaments` 컬럼: `monitor_token text UNIQUE`(난수 미생성 상태)·`next_entry_seq`·등록 config 전부(`registration_open`/`auto_seat_on_register`/`reentry_allowed`/`max_reentries`)·`seats_per_table`·`starting_chips`·칩/코스트 config·`color`.
- `ops_participants` 컬럼: `claim_token text UNIQUE`(NULL 상태)·`player_user_id`·`finish_position`(partial UNIQUE)·`busted_at`·`prize_amount`·`status`(registered/checked_in/active/busted/no_show)·`chips`·`rebuys`/`add_ons`/`reentries`.
- `ops_tables`(open/closed/standby·lock_type)·`ops_seats`(단일점유 partial UNIQUE).
- enum `ops_event_type`에 **`level_play`·`level_pause`·`level_set` 이미 포함**(1a forward-declared) → 클럭 이벤트는 ALTER TYPE 불필요.
- `is_ops_member(_tournament_id, _user_id)` SECDEF STABLE(REVOKE anon) — **anon RLS에서 호출 절대 금지**(§5 보안).
- `fn_ops_set_updated_at()`·`fn_ops_events_append_only()` 트리거 헬퍼(REVOKE PUBLIC,anon,authenticated).
- RPC 하드닝 패턴: `grants_and_realtime.sql`의 이름기반 DO 루프(`REVOKE EXECUTE FROM PUBLIC,anon; GRANT TO authenticated,service_role`).
- Realtime publication 등록: `ops_tournaments`·`ops_participants`·`ops_tables`·`ops_seats`(`ops_events` 제외).
- 에러코드 사용중 E6101~E6115, **다음 가용 = E6116**.
- 도메인 순수함수: `src/domains/ops/`(OpsParticipantStatusMachine·opsStats·seatAssignment). 읽기훅=Repository 직접, 변이훅=`useOpsMutations.ts`(Service→RPC, onSuccess invalidate+toast). `createRealtimeSubscription(table, filter, cb, onError)` at `src/utils/supabase.ts`.
- pgTAP: `supabase/fixtures/ops_helpers.sql`의 `ops_test_seed()`(owner/member/outsider+tournament+participant+table+2seats)·`ops_test_set_user(uid)`. `BEGIN; plan(N); … finish(); ROLLBACK;`. fixture는 테이블 GRANT ALL(함수 GRANT 금지 — REVOKE 회귀방지).
- 대회상세 `app/(ops)/tournaments/[id].tsx`: useState 세그먼트 탭(`players|status|tables`). `(ops)/_layout.tsx`=authenticated 게이트.
- 배포: `scripts/deploy-cloudflare.js:132` `--project-name=uniqn-app`(유일 하드코딩), `wrangler.toml:4` `name="uniqn-app"`. 단일 번들(런타임 분기 없음).

---

## 0.5 적대 리뷰 반영 — 필수 수정 (구현자 우선 적용, 본 절이 이하 본문보다 우선)

> 5렌즈 적대 리뷰(2026-06-27) = GO_WITH_FIXES(NO_GO 0). 아래 수정이 본문 §1~Phase보다 **우선**한다. 충돌 시 본 절을 따른다.

### B1 [CRITICAL] avg_stack_bb NOT NULL + big_blind=0 → 23502 등록 롤백 방지

- 재계산식: `avg_stack_bb = COALESCE(average_stack::numeric / NULLIF(v_big_blind, 0), 0)`. big_blind=0(브레이크·블라인드 미설정)에서 NULL→0 강제. **이게 빠지면 블라인드 설정 전 모든 워크인 등록·리바이가 23502로 롤백(1a 등록데스크 회귀)**.
- pgTAP RED 선추가: ①블라인드 미설정 대회 워크인 등록 성공 + avg_stack_bb=0, ②브레이크(bb=0) 리바이 성공 + avg_stack_bb=0.

### B2 [CRITICAL] set_blind_levels 전체교체 시 클럭 앵커 보호

- `ops_set_blind_levels`는 `SELECT … FROM ops_tournaments WHERE id=p_tournament_id FOR UPDATE`로 클럭 RPC와 직렬화.
- 교체 후 `ops_clock.current_level_sort := LEAST(GREATEST(current_level_sort,1), v_new_count)` clamp. clamp로 값이 바뀌면 `level_started_at=now()`, `is_running=false`, `paused_remaining_sec=NULL`(안전 재앵커: 틀린 블라인드/NaN 카운트다운 차단), ops_events payload `{reanchored:true}`.
- **결정: clamp+재앵커 채택**(running 중 거부보다 유연). UI는 진행 중 편집 시 확인 다이얼로그(impeccable §12).
- `computeClockRemaining`: 현재 sort의 blind level 행이 없으면 `{remainingSec:0, isExpired:false, levelMissing:true}` 안전폴백(blank/NaN 아님).
- pgTAP: 스케줄 축소(N<sort) 후 current_level_sort clamp·재앵커 단언.

### B3 [HIGH] live_stats 트리거 래퍼 함수 (인자 전달 불가 해소 + 마이그 순서)

- 본체 `fn_ops_recompute_live_stats(p_tournament_id uuid) RETURNS void` + **별도 트리거 래퍼** `fn_ops_live_stats_recompute_trigger() RETURNS trigger`(SECDEF, `SET search_path=public,pg_temp`): NEW/OLD에서 tournament_id 추출 → 본체 호출 → `RETURN COALESCE(NEW, OLD)`. (트리거는 인자 없는 RETURNS trigger여야 하므로 본체를 직접 부착 불가.)
- 트리거 부착: `ops_participants`·`ops_seats`·`ops_tables`·`ops_blind_levels`(AFTER INSERT/UPDATE/DELETE FOR EACH ROW) + `ops_clock`(AFTER UPDATE `WHEN (OLD.current_level_sort IS DISTINCT FROM NEW.current_level_sort)`).
- **마이그 순서**: 이 트리거들은 함수 정의 이후 마이그(Task 3)에 배치. **Task 1 테이블 마이그엔 init 트리거(`fn_ops_init_derived_rows`)만**(재계산 트리거 넣으면 함수 미존재로 CREATE TRIGGER 실패).
- **이중 재계산 제거**: 클럭/블라인드 RPC는 recompute를 **명시 호출하지 않음**(트리거 담당). 본문 §1.3/Task 3의 "클럭 변이 말미 recompute 호출" 문구 폐기.

### B4 [HIGH] 토큰 생성 = hex (base64url 폐기)

- 모든 토큰: `encode(gen_random_bytes(24), 'hex')`(48자, 192bit, URL-safe). base64url은 Postgres 미지원(`unrecognized encoding`). `gen_random_bytes`=pgcrypto(extensions)→해당 RPC `SET search_path=public,extensions,pg_temp`.

### B5 [HIGH] 생성타입 파일 정정

- 도메인 camelCase 타입은 **`src/types/ops.ts`에만** 추가(실사용처). 생성 DB 타입(`src/types/supabase.ts`)은 **prod 적용 후 MCP generate_typescript_types로 정합**(문서/IDE용; 클라가 `createClient<Database>` 미사용이라 런타임 타입강제 없음). `src/utils/supabase.ts`(헬퍼파일)는 **편집 대상 아님**. 본문 §4/Task 5의 utils/supabase.ts 항목 폐기.

### B6 [HIGH] pgTAP 검증 명령 정정 (전 Task·게이트 공통)

- **`npm run db:reset && npm run test:db:helpers && npx supabase test db`**. db reset이 `ops_helpers.sql`(ops_test_seed/set_user)을 지우므로 **매 reset 후 helpers 재적재 필수**. 신규 ops 헬퍼 추가 시 `test:db:helpers` 스크립트에 등록 확인.

### B7 [HIGH] ±1분 adjust 상태분기 + 부호 규약

- `ops_clock_adjust(p_tournament_id, p_actor_id, p_delta_sec int)`: **부호 규약 `p_delta_sec>0 = 잔여시간 증가`**. `is_running`이면 `level_started_at += make_interval(secs => p_delta_sec)`(앵커 **미래로**→경과 감소→잔여 증가. ⚠️ 초안의 `-=`는 부호 오기, 구현은 `+=`), `paused`(is_running=false)면 `paused_remaining_sec := GREATEST(COALESCE(paused_remaining_sec,0) + p_delta_sec, 0)`. event `level_set` payload `{adjust_sec}`.
- pgTAP: running+adjust(+60→잔여 +60)·paused+adjust(+60→paused_remaining +60)·부호 단언. computeClockRemaining 단위테스트에도 동일.

### B8 [MED] 공개 RPC advisor WARN 화이트리스트

- `ops_get_monitor_snapshot`·`ops_get_player_view`는 SECDEF+anon GRANT라 advisor `anon_security_definer_function_executable` WARN을 **불가피하게** 발생(반환 화이트리스트 투영으로 유출 아님). Phase 2/3 prod 게이트는 "신규 ERROR 0 + SECDEF anon-executable = 이 2함수만(화이트리스트)"로 재정의. 마이그 주석에 수용 근거 명기.

### B9 [MED] 모니터/플레이어뷰 상태범위 = 1c 가용으로 한정

- 1c-3 모니터: 시작전/진행/일시정지/브레이크/레벨전환만. **종료(우승자/상금) 제외**(1f 의존).
- 1c-4 플레이어뷰: 내 자리·내 스택·라이브 클럭·블라인드 카운트다운만. **탈락 ITM·재진입 배너 제외**(bust=1d, 상금=1f). Self-Review 미해결에 의존성 명기.

### 핵심 비블로킹 반영

- **bigint**: `total_chips`·`prize_pool`·`average_stack` 전부 bigint(오버플로 방지). `avg_stack_bb`만 numeric.
- **search_path**: 트리거 함수(recompute 본체·래퍼)·init 트리거 모두 `SECURITY DEFINER SET search_path=public,pg_temp`(토큰 생성 RPC만 extensions 포함). Phase 1 게이트에 `function_search_path_mutable 0` 확인.
- **CASCADE 가드**: `fn_ops_recompute_live_stats` 진입부 `IF NOT EXISTS(SELECT 1 FROM ops_tournaments WHERE id=p_tournament_id) THEN RETURN; END IF`(대회 삭제 중 자식 DELETE 트리거 FK 위반 방지). 대회 삭제 회귀 pgTAP 1건.
- **backfill 재계산**: 재계산 함수+트리거 생성 직후(Task 3 말미) `SELECT public.fn_ops_recompute_live_stats(id) FROM public.ops_tournaments;`(기존 대회 0표시 방지, 멱등).
- **REPLICA IDENTITY**: clock·live_stats는 PK=tournament_id라 DEFAULT 충분. `ops_blind_levels`는 Realtime DELETE 비의존(mutation onSuccess invalidate) 또는 `REPLICA IDENTITY FULL`. Task 4에 1줄 기록.
- **공개 라우트**: `app/(public)/monitor/[token].tsx`·`app/(public)/live/[claim_token].tsx`((public) 그룹=requiredAuth:false). 모니터도 **token path 파라미터**(대회 UUID·?token 쿼리 제거→referrer/로그 유출 축소). anon 렌더 검증(useAuthGuard routeGroup=null 통과) 구현 직전 실측.
- **HISTORY 탭**: Phase 1에 최소 HISTORY 탭(ops_events `ORDER BY created_at DESC` 페이지네이션, 신규 RPC 불요) → 5탭(PLAYERS/STATUS/TABLES/LEVELS/HISTORY). 클럭 이벤트 가시화(설계 §3.1 IA 1급).
- **NULL/짧은 토큰 가드**: 공개 RPC 진입부 `IF p_token IS NULL OR char_length(p_token)<32 THEN RAISE 'OPS_*_TOKEN_INVALID' P0001; END IF`. 클라 폴링 하한 ≥3s.
- **이중 진실원 제거**: STATUS/통계는 서버 live_stats 단일소스. 클라 computeOpsPartialStats는 모니터/플레이어 폴백 격리 또는 제거. average_stack 서버=정수나눗셈(round), 클라 표시 동일.
- **authed offset 일관**: 운영자 클럭 읽기도 server_now 동봉(`ops_get_clock` RPC 또는 PostgREST Date 헤더)로 offset 적용(모니터와 동일 불변식). 비용 1필드.

### 결정 (사용자 위임 → 기본값 확정)

- **토큰 회전**: 발급=멱등 재반환(인쇄 QR 보존). 유출 대응=별도 `ops_rotate_*_token`(force, 구토큰 즉시 무효). 회전 시 ops_events 감사.
- **폴링 vs Broadcast**: Phase 1(운영자 STATUS)은 authed postgres_changes=즉시(무관). 모니터/플레이어 4s 폴링의 일시정지/레벨변경 지연(최대 4s 시간역행 점프)은 **Phase 2 웹QA서 재평가** — 허용 불가 판정 시 클럭 상태전이만 anon 토큰 Realtime Broadcast(public topic) 보강.
- **QR/도메인**: QR 슬립·모니터 링크 = **배포 origin 동적 생성**(`window.location.origin`). B2(ops.uniqn.app) 경성의존 제거.
- **ENTRIES 라벨**: `entries`=총 엔트리(참가자 행 수=바이인 수). `reentries_total` 별도 표기(K-Holdem 패리티).

---

## 1. 데이터 모델 (1c 신규)

### 1.1 `ops_blind_levels` (블라인드 구조)

```
id uuid PK, tournament_id uuid FK→ops_tournaments ON DELETE CASCADE,
level int NOT NULL,                 -- 표시용 레벨번호(브레이크는 의미없음, 0 허용)
small_blind int NOT NULL DEFAULT 0,
big_blind int NOT NULL DEFAULT 0,
ante int NOT NULL DEFAULT 0,
duration_sec int NOT NULL,          -- CHECK > 0
is_break boolean NOT NULL DEFAULT false,
sort int NOT NULL,                  -- 진행 순서 1..N (연속, set_blind_levels가 보장)
created_at, updated_at,
UNIQUE(tournament_id, sort),
CHECK(small_blind>=0 AND big_blind>=0 AND ante>=0 AND duration_sec>0)
```

인덱스: `(tournament_id, sort)`. 트리거 `trg_*_set_updated_at`.

### 1.2 `ops_clock` (서버 동기 타이머 — 대회당 1행)

```
tournament_id uuid PRIMARY KEY FK→ops_tournaments ON DELETE CASCADE,
current_level_sort int NOT NULL DEFAULT 1,   -- 현재 진행 중 블라인드 레벨의 sort
level_started_at timestamptz,                -- 현재 레벨 시작 서버 시각(=앵커). 일시정지/미시작이면 NULL
is_running boolean NOT NULL DEFAULT false,
paused_remaining_sec int,                    -- 일시정지 시 남은 초 스냅샷
created_at, updated_at
```

- 남은시간 = 서버 기준 파생. **시작/재개**: `is_running=true`, `level_started_at = now() - make_interval(secs => (duration - COALESCE(paused_remaining_sec, duration)))` (재개는 남은시간 보존), `paused_remaining_sec=NULL`. **일시정지**: `is_running=false`, `paused_remaining_sec = remaining`, `level_started_at` 유지(표시용). **레벨 종료=운영자 수동**(`set_level`). 자동진행 없음(타이머 0에서 00:00 표시 대기).
- 트리거 `trg_*_set_updated_at`.

### 1.3 `ops_live_stats` (파생 통계 — 대회당 1행, 트리거 재계산)

```
tournament_id uuid PRIMARY KEY FK→ops_tournaments ON DELETE CASCADE,
playing int NOT NULL DEFAULT 0,            -- status='active'
entries int NOT NULL DEFAULT 0,           -- 총 엔트리(참가자 행 수)
unique_players int NOT NULL DEFAULT 0,    -- 1c=entries와 동일(계정 dedup 후속). 컬럼 적재
reentries_total int NOT NULL DEFAULT 0,   -- Σ reentries
tables_open int NOT NULL DEFAULT 0,       -- ops_tables status='open'
seats_total int NOT NULL DEFAULT 0,       -- open 테이블의 좌석 수
seats_free int NOT NULL DEFAULT 0,        -- 빈 좌석(participant_id IS NULL, open 테이블)
total_chips bigint NOT NULL DEFAULT 0,    -- Σ chips (active)
average_stack int NOT NULL DEFAULT 0,     -- total_chips / NULLIF(playing,0)
avg_stack_bb numeric NOT NULL DEFAULT 0,  -- average_stack / NULLIF(현재 big_blind,0)
prize_pool int NOT NULL DEFAULT 0,        -- Σ(엔트리·buy_in_cost + rebuys·rebuy_cost + add_ons·addon_cost)
knockout_pool int,                        -- bounty (1c는 NULL/0, 1f)
updated_at timestamptz NOT NULL DEFAULT now()
```

- **재계산 함수** `fn_ops_recompute_live_stats(p_tournament_id uuid)` SECDEF: 원천(participants·seats·tables·clock→blind_levels) 집계 후 `INSERT … ON CONFLICT(tournament_id) DO UPDATE`(upsert). `avg_stack_bb`는 clock의 `current_level_sort`→`ops_blind_levels.big_blind` 조인(없으면 0).
- **트리거**(AFTER INSERT/UPDATE/DELETE FOR EACH ROW): `ops_participants`·`ops_seats`·`ops_tables` → `fn_ops_recompute_live_stats(coalesce(NEW.tournament_id, OLD.tournament_id))`. `ops_clock` UPDATE(레벨변경) → 같은 함수(avg_stack_bb 갱신).
- **rationale(설계 §4.10 "델타" 대비 변경)**: 16개 기존 1a/1b RPC를 수정해 델타를 흘리는 방식은 회귀 위험이 큼. 단일 대회 수백 행 재계산은 인간속도 변이에서 sub-ms → 트리거 전체재계산이 **더 단순·안전**하며 항상 정합. 핫행 경합은 펍 규모(동시 대회 1개)에서 비현실. _대규모 동시성 필요 시 statement-level 트리거/디바운스로 최적화_(후속).

### 1.4 enum (신규 — ALTER TYPE 불필요 확인)

- 클럭 상태는 **컬럼(`is_running`)으로 표현** → 신규 enum 없음.
- 이벤트는 기존 `level_play`/`level_pause`/`level_set` 재사용. ±1분 보정도 `level_set` payload `{adjust_sec}`로 표현.

---

## 2. 슬라이스/페이즈 분할 (구현 PR)

| 페이즈      | 범위                                                                                                       | 인증                  | Realtime                        | PR  |
| ----------- | ---------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------- | --- |
| **Phase 1** | **1c-1 클럭**(blind_levels·clock·LEVELS탭) + **1c-2 live_stats+STATUS**(트리거·풀대시보드·authed Realtime) | authenticated         | postgres_changes(is_ops_member) | PR1 |
| **Phase 2** | **B2 인프라**(deploy 파라미터화·ops.uniqn.app) + **1c-3 모니터**(공개라우트·monitor_token RPC·anon 폴링)   | anon(토큰)            | RPC 폴링                        | PR2 |
| **Phase 3** | **1c-4 플레이어뷰**(claim_token 스코프 RPC·claim 바인딩·QR슬립)                                            | anon(토큰)→선택로그인 | RPC 폴링                        | PR3 |

각 PR은 독립적으로 동작·테스트·머지 가능. 계획은 전체를 다루되 Phase 2/3 세부 TDD 스텝은 Phase 1 머지 후 구현 직전 정밀화(just-in-time, 실제 구현 반영).

---

## 3. 보안 모델 (anon 공개 서피스 — #195 P0 재발 방지)

**철칙**: anon은 ops 테이블을 **직접 SELECT하지 않는다**. 공개 데이터는 **token→스코프 SECDEF RPC**만 통과.

- **모니터**(`ops_get_monitor_snapshot(p_monitor_token)`): `monitor_token` 일치 1행 검증 → **비-PII 스냅샷만** 반환(대회명/venue/게임타입/등록상태 + clock 상태 + live_stats 집계 + `server_now`). 참가자 PII·claim_token 절대 미포함. `GRANT EXECUTE TO anon`. `is_ops_member` **호출 안 함**(anon poison 회피).
- **플레이어뷰**(`ops_get_player_view(p_claim_token)`): `claim_token` 일치 1행 검증 → **본인 안전필드만**(entry_number·name·status·chips·table_no·seat_no·finish_position·prize_amount) + 공개 clock/stats 부분집합 + `server_now`. 타 참가자·claim_token·phone 미포함. `GRANT EXECUTE TO anon`. rate-limit(토큰당 호출, 후속 강화 여지).
- 두 RPC는 SECDEF지만 **민감 정보를 반환값 단계에서 화이트리스트 투영**하므로 RLS 우회가 유출로 이어지지 않음. 진입부 NULL/짧은 토큰 가드(§0.5).
- 토큰 형식: `encode(gen_random_bytes(24), 'hex')`(48자 hex, 192bit, URL-safe — **base64url은 Postgres 미지원**, §0.5 B4). capability-URL 모델(토큰 아는 자만 접근). 발급=멱등, 유출대응=별도 force-rotate(§0.5).

---

## 4. 파일 구조 (생성/수정)

**DB 마이그레이션(Phase 1):**

- Create `supabase/migrations/20260627<HHMMSS>_ops_1c_blind_clock_stats_tables.sql` — 3테이블·enum없음·RLS·트리거·init 트리거·backfill.
- Create `…_ops_1c_clock_rpcs.sql` — 클럭/블라인드 RPC + 재계산 함수.
- Create `…_ops_1c_grants_and_realtime.sql` — RPC REVOKE/GRANT·트리거fn REVOKE·publication(blind_levels·clock·live_stats).
- Create `supabase/tests/ops_clock_state.test.sql`·`ops_blind_levels.test.sql`·`ops_live_stats_recompute.test.sql`·`ops_clock_rpc_security.test.sql`.
- Modify `supabase/fixtures/ops_helpers.sql` — `ops_test_seed()`에 blind_level/clock/live_stats 행 추가(반환 확장) 또는 별도 seeder.

**도메인/타입/스키마(Phase 1):**

- Create `src/domains/ops/clock/computeClockRemaining.ts` — 순수 카운트다운.
- Create `src/domains/ops/clock/__tests__/computeClockRemaining.test.ts`.
- Create `src/domains/ops/opsLiveStats.ts`(또는 opsStats 확장) — 클라 파생 헬퍼(서버값 우선, 표시 포맷).
- Modify `src/types/ops.ts` — `OpsBlindLevel`·`OpsClock`·`OpsLiveStats` 타입(**실사용 도메인 타입은 여기에만**, §0.5 B5).
- 생성 DB 타입 `src/types/supabase.ts`는 **prod 적용 후 MCP generate_typescript_types로 정합**(문서/IDE용). `src/utils/supabase.ts`(헬퍼파일)는 편집 대상 아님.
- Create `src/schemas/opsBlindLevel.schema.ts` — Zod(sb/bb/ante/duration·xss).
- Modify `src/errors/AppError.ts` — E6116~ 신규 코드+한글 메시지.
- Modify `src/repositories/supabase/opsRpcError.ts` — PREFIX_MAP 신규 접두사.

**Repository/Service/Hooks(Phase 1):**

- Create `src/repositories/supabase/OpsClockRepository.ts`(+interface)·`OpsBlindLevelRepository.ts`·`OpsLiveStatsRepository.ts`.
- Modify `src/repositories/ops.ts` 배럴.
- Create `src/services/ops/opsClockService.ts`·`opsBlindLevelService.ts`.
- Create `src/hooks/ops/useOpsClock.ts`(읽기+Realtime+카운트다운)·`useOpsBlindLevels.ts`·`useOpsLiveStats.ts`·클럭/블라인드 변이훅(useOpsMutations.ts 확장 또는 useOpsClockMutations.ts).
- Modify `src/lib/queryClient.ts` — `queryKeys.ops.clock/blindLevels/liveStats`.

**UI(Phase 1):**

- Create `src/components/ops/BlindLevelsTab.tsx`(TablesTab master/detail 패턴)·`BlindLevelForm.tsx`·`ClockControl.tsx`(STATUS 상단 클럭+제어)·`LiveStatsPanel.tsx`(STATUS 풀대시보드).
- Modify `app/(ops)/tournaments/[id].tsx` — 세그먼트에 `levels` 추가(4탭) + STATUS를 `ClockControl`+`LiveStatsPanel`로 교체.

**Phase 2/3(요약 — 세부 just-in-time, §0.5 B9 상태범위 한정):**

- Create `app/(public)/monitor/[token].tsx`·`app/(public)/live/[claim_token].tsx`((public) 그룹=requiredAuth:false, 모니터도 token path). anon 렌더 실측.
- Migrations: `…_ops_1c3_monitor_rpcs.sql`·`…_ops_1c4_player_view_rpcs.sql`(공개 RPC 2종만 anon GRANT, advisor WARN 화이트리스트 §0.5 B8).
- Modify `scripts/deploy-cloudflare.js`(`--project-name=${process.env.CF_PROJECT_NAME ?? 'uniqn-app'}`)·`wrangler.toml`·`package.json`(deploy:ops). ops.uniqn.app 생성=사용자 게이트(비차단; QR/링크는 배포 origin 동적생성).
- Hooks: `useMonitorSnapshot.ts`·`usePlayerView.ts`(≥3s 폴링+클럭 틱+offset).

---

## 5. 타이머 정확도 계약 (핵심)

순수함수 `computeClockRemaining` 단일 진실. 폴링 주기와 무관하게 정확:

```ts
// 입력: 서버 앵커 + 접속시 1회 계산한 offset
type ClockInput = {
  levelStartedAt: string | null; // ISO, 서버 시각 앵커
  durationSec: number; // 현재 레벨 길이
  isRunning: boolean;
  pausedRemainingSec: number | null;
  serverOffsetMs: number; // (RPC가 준 server_now) - (수신시점 Date.now())
  nowMs: number; // Date.now() (틱마다)
};
// remainingSec = isRunning
//   ? clamp(durationSec - ((nowMs + serverOffsetMs) - epochMs(levelStartedAt))/1000, 0, durationSec)
//   : (pausedRemainingSec ?? durationSec)
```

- `serverOffsetMs`로 **기기 시계 오차 보정**(서버 시각 추종). 모든 화면 동일값.
- UI는 `setInterval(…,250~1000ms)`로 `nowMs` 갱신→재계산(useMemo 아님, 명시 틱). 네트워크 안 기다림.
- 레벨 0 도달 시 00:00 고정(운영자 set_level 대기).

---

## Phase 1 — Task 분해 (1c-1 + 1c-2)

> 각 Task = 독립 테스트·커밋 단위. TDD(RED→GREEN→commit). DB Task는 pgTAP, 도메인은 Jest. 구현 서브에이전트는 각 스텝의 세부 TDD 사이클을 본 계약(시그니처·테스트 케이스)대로 작성한다.

### Task 1: 1c 테이블 마이그레이션 (blind_levels·clock·live_stats + init/backfill)

**Files:** Create `supabase/migrations/20260627<ts>_ops_1c_blind_clock_stats_tables.sql`; Test `supabase/tests/ops_1c_tables_rls.test.sql`.

**Interfaces:**

- Produces: 테이블 3종(§1.1~1.3), `fn_ops_init_derived_rows()` 트리거(AFTER INSERT ON ops_tournaments → clock+live_stats 행 생성), 기존 대회 backfill, SELECT-only RLS(`is_ops_member` or admin), DML REVOKE.

- [ ] **Step 1: pgTAP 실패 테스트 작성** — `ops_1c_tables_rls.test.sql`: (a) 세 테이블 존재·RLS forced (`has_table`/`is_rls_enabled`), (b) member는 SELECT 가능·outsider는 0행, (c) authenticated 직접 INSERT/UPDATE/DELETE 거부(`throws_ok`), (d) 신규 대회 INSERT 시 clock+live_stats 행 자동 생성(1행). `plan(N)`.
- [ ] **Step 2: 실패 확인** — `npx supabase db reset && npx supabase test db` → FAIL(테이블 없음).
- [ ] **Step 3: 마이그 작성** — §1.1~1.3 DDL(멱등 `CREATE TABLE IF NOT EXISTS`·`ENABLE/FORCE RLS`·인덱스·`trg_*_set_updated_at`). `is_ops_member` 기반 SELECT-only 정책 3종(1a `ops_*_select_member` 미러). `REVOKE INSERT,UPDATE,DELETE … FROM anon,authenticated`. `fn_ops_init_derived_rows()` SECDEF(AFTER INSERT ON ops_tournaments). 기존 대회 backfill: `INSERT … SELECT id … ON CONFLICT DO NOTHING`. (재계산 함수는 Task 3에서.)
- [ ] **Step 4: 통과 확인** — `npx supabase db reset && npx supabase test db` → PASS. 기존 8 pgTAP 파일 회귀 0.
- [ ] **Step 5: 커밋** — `feat(ops): 1c 클럭/통계 테이블 + RLS + init 트리거`.

### Task 2: 클럭 카운트다운 순수함수 (Jest)

**Files:** Create `src/domains/ops/clock/computeClockRemaining.ts`, Test `…/__tests__/computeClockRemaining.test.ts`.

**Interfaces:** Produces `computeClockRemaining(input: ClockInput): { remainingSec: number; isExpired: boolean }` (§5).

- [ ] **Step 1: 실패 테스트** — 케이스: ① running·10분 레벨·앵커 2분전·offset 0 → 480초. ② paused·pausedRemaining=120 → 120. ③ running·만료(앵커 11분전, 10분레벨) → 0·isExpired. ④ offset=+180000(기기 3분빠름) 보정 검증. ⑤ levelStartedAt=null·!running → durationSec. 결정적(now 주입).
- [ ] **Step 2: 실패 확인** — `npx jest src/domains/ops/clock -t computeClockRemaining` → FAIL.
- [ ] **Step 3: 구현** — 순수·불변. clamp(0, durationSec).
- [ ] **Step 4: 통과** — jest PASS.
- [ ] **Step 5: 커밋** — `feat(ops): 서버앵커 클럭 카운트다운 순수함수`.

### Task 3: 재계산 함수 + 클럭/블라인드 RPC (pgTAP)

**Files:** Create `…_ops_1c_clock_rpcs.sql`; Tests `ops_clock_state.test.sql`·`ops_blind_levels.test.sql`·`ops_live_stats_recompute.test.sql`.

**Interfaces — Produces (정확한 시그니처):**

- `fn_ops_recompute_live_stats(p_tournament_id uuid) RETURNS void` SECDEF — §1.3 집계 upsert.
- `ops_set_blind_levels(p_tournament_id uuid, p_actor_id uuid, p_levels jsonb) RETURNS jsonb` — 전체 스케줄 교체(delete+insert, sort 1..N 연속). `p_levels`=`[{level,small_blind,big_blind,ante,duration_sec,is_break}]`. 빈배열/잘못된 duration → `RAISE 'OPS_BLIND_LEVELS_INVALID' P0001`. event `level_set`.
- `ops_clock_start(p_tournament_id uuid, p_actor_id uuid) RETURNS jsonb` — 블라인드 없으면 `OPS_NO_BLIND_LEVELS`. 이미 running이면 무시(idempotent) 또는 `OPS_CLOCK_ALREADY_RUNNING`. 재개시 남은시간 보존(§1.2). event `level_play`.
- `ops_clock_pause(p_tournament_id uuid, p_actor_id uuid) RETURNS jsonb` — running 아니면 무시. `paused_remaining_sec` 스냅샷. event `level_pause`.
- `ops_clock_set_level(p_tournament_id uuid, p_actor_id uuid, p_sort int) RETURNS jsonb` — 존재하는 sort만(`OPS_INVALID_LEVEL`). `level_started_at=now()`·running 유지. event `level_set`.
- `ops_clock_adjust(p_tournament_id uuid, p_actor_id uuid, p_delta_sec int) RETURNS jsonb` — `level_started_at -= delta`(±60 등). event `level_set` payload `{adjust_sec}`.
- 모든 RPC: actor 가드 + `is_ops_member` + `FOR UPDATE` + event append (§Global Constraints). 클럭 변이 말미 `fn_ops_recompute_live_stats` 호출(avg_stack_bb).

- [ ] **Step 1: 실패 테스트** — ① `ops_set_blind_levels` 3레벨 → 행 3개·sort 1,2,3. 빈배열 throws. ② `ops_clock_start`→is_running·level_started_at NOT NULL. 블라인드 없는 대회 throws `OPS_NO_BLIND_LEVELS`. ③ start→pause→paused_remaining_sec NOT NULL·is_running false. ④ `ops_clock_set_level` 잘못된 sort throws `OPS_INVALID_LEVEL`. ⑤ 재계산: participant 2명 active(chips 100/200)+blind bb=400 → live_stats playing=2·total_chips=300·average_stack=150·avg_stack_bb=0.375·prize_pool=Σcost. ⑥ outsider actor → `PERMISSION_DENIED`. ⑦ anon(set_user 안 함) RPC → 거부(grants Task 4 전이라 여기선 RLS/actor로).
- [ ] **Step 2: 실패 확인** — `db reset && test db` → FAIL.
- [ ] **Step 3: 구현** — 재계산 함수 + 6 RPC(1a `ops_rpcs.sql` 골격 미러). `ops_set_blind_levels`는 단일 트랜잭션 delete+insert.
- [ ] **Step 4: 통과** — PASS. 기존 회귀 0.
- [ ] **Step 5: 커밋** — `feat(ops): 1c 클럭/블라인드 RPC + live_stats 재계산`.

### Task 4: grants + Realtime publication (pgTAP)

**Files:** Create `…_ops_1c_grants_and_realtime.sql`; Test `ops_clock_rpc_security.test.sql`.

**Interfaces:** 신규 RPC 6종 `REVOKE EXECUTE FROM PUBLIC,anon; GRANT TO authenticated,service_role`(이름기반 DO 루프). 트리거fn `fn_ops_recompute_live_stats`·`fn_ops_init_derived_rows` `REVOKE FROM PUBLIC,anon,authenticated`. publication ADD `ops_blind_levels`·`ops_clock`·`ops_live_stats`(멱등).

- [ ] **Step 1: 실패 테스트** — `ops_clock_rpc_security.test.sql`: 각 RPC `has_function_privilege('anon', …, 'EXECUTE')=false`·`authenticated=true`. 트리거fn anon=false. publication에 3테이블 존재(`pg_publication_tables`). `plan(N)`.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — grants 마이그(1a/1b 패턴). publication DO 멱등 블록.
- [ ] **Step 4: 통과** — PASS.
- [ ] **Step 5: 커밋** — `feat(ops): 1c RPC 권한 하드닝 + Realtime publication`.

### Task 5: 타입·에러·Zod·supabase.ts 수술적 갱신

**Files:** Modify `src/types/ops.ts`·`src/errors/AppError.ts`·`src/repositories/supabase/opsRpcError.ts`·`src/utils/supabase.ts`(생성타입); Create `src/schemas/opsBlindLevel.schema.ts`.

**Interfaces — Produces:** `OpsBlindLevel`·`OpsClock`·`OpsLiveStats`(camelCase). E6116=`OPS_BLIND_LEVELS_INVALID`, E6117=`OPS_NO_BLIND_LEVELS`, E6118=`OPS_INVALID_LEVEL`, E6119=`OPS_CLOCK_ALREADY_RUNNING`(여유). PREFIX_MAP 대응. `opsBlindLevelSchema`(z, xss는 해당없음·숫자검증).

- [ ] **Step 1: 실패 테스트** — `opsRpcError.test.ts` 확장: `OPS_BLIND_LEVELS_INVALID`/`OPS_NO_BLIND_LEVELS`/`OPS_INVALID_LEVEL` 메시지→코드 매핑. 블라인드 Zod 거부(음수 bb·duration 0).
- [ ] **Step 2: 실패 확인** — jest FAIL.
- [ ] **Step 3: 구현** — 타입 additive, AppError 코드3+한글, PREFIX_MAP 추가, `supabase.ts`에 3테이블 Row/Insert/Update 수술적 추가(prod 후 MCP gen 정합 주석). Zod.
- [ ] **Step 4: 통과** — jest + `tsc --noEmit` 0.
- [ ] **Step 5: 커밋** — `feat(ops): 1c 타입/에러코드/Zod 스키마`.

### Task 6: Repository + Service (클럭·블라인드·통계)

**Files:** Create `OpsClockRepository.ts`(+I)·`OpsBlindLevelRepository.ts`(+I)·`OpsLiveStatsRepository.ts`(+I)·`opsClockService.ts`·`opsBlindLevelService.ts`; Modify `src/repositories/ops.ts`.

**Interfaces — Produces:**

- `opsClockRepository.get(tournamentId): Promise<OpsClock|null>`·`opsBlindLevelRepository.listByTournament(id): Promise<OpsBlindLevel[]>`·`opsLiveStatsRepository.get(id): Promise<OpsLiveStats|null>`(toCamelCase·null-safe).
- `opsClockService.start/pause/setLevel/adjust(tournamentId, actorId, …)`·`opsBlindLevelService.setLevels(tournamentId, actorId, levels)` → Zod→RPC(mapOpsRpcError).

- [ ] **Step 1~4**: 읽기 Repository는 E2E/웹QA로 검증(mock 유지비 회피, 1a/1b 관례). Service는 Zod 경계 단위테스트(잘못된 입력→ValidationError). 구현 후 `tsc 0`·관련 jest PASS.
- [ ] **Step 5: 커밋** — `feat(ops): 1c repository/service 레이어`.

### Task 7: Hooks (읽기+Realtime+카운트다운, 변이)

**Files:** Create `useOpsClock.ts`·`useOpsBlindLevels.ts`·`useOpsLiveStats.ts`·`useOpsClockMutations.ts`(or extend `useOpsMutations.ts`); Modify `src/lib/queryClient.ts`.

**Interfaces — Produces:**

- `useOpsClock(tournamentId)` → `{ clock, remainingSec, isExpired }`(Repository 직접 + `createRealtimeSubscription('ops_clock', 'tournament_id=eq.X', invalidate)` + `setInterval` 틱 + `computeClockRemaining`). offset = 최초 fetch시 server now 헤더/RPC… **authed 경로는 클럭 행의 `level_started_at`+클라 시계로 충분**(offset 0 가정, 운영자 기기는 신뢰). 모니터/플레이어뷰만 offset 적용(Phase 2/3).
- `useOpsBlindLevels(tournamentId)`·`useOpsLiveStats(tournamentId)` → Repository 직접 + Realtime invalidate.
- 변이훅: `useSetBlindLevels`·`useStartClock`·`usePauseClock`·`useSetLevel`·`useAdjustClock`(Service→onSuccess invalidate clock/liveStats/blindLevels+toast).
- `queryKeys.ops.clock(id)`·`blindLevels(id)`·`liveStats(id)`.

- [ ] **Step 1~5**: 훅 구현(1a `useOpsParticipants`/`useOpsMutations` 패턴 미러). 검증=tsc 0 + 웹QA. 커밋 `feat(ops): 1c 클럭/통계 훅`.

### Task 8: UI — LEVELS 탭 + STATUS 풀대시보드

**Files:** Create `BlindLevelsTab.tsx`·`BlindLevelForm.tsx`·`ClockControl.tsx`·`LiveStatsPanel.tsx`; Modify `app/(ops)/tournaments/[id].tsx`.

**Interfaces — Consumes:** Task 7 훅. **Produces:** 4번째 탭 `levels`·STATUS 교체.

- [ ] **Step 1: LEVELS 탭** — `BlindLevelsTab`(TablesTab master/detail 패턴): 레벨 FlashList(Idx/분/SB/BB/Ante/Break) + `BlindLevelForm`(추가/편집, 숫자 입력·is_break 토글). 저장=`useSetBlindLevels`(전체 교체). 다크모드·44px·빈상태 가이드(impeccable §9).
- [ ] **Step 2: STATUS 클럭** — `ClockControl`: 대형 타이머(`remainingSec` mm:ss)·LEVEL·현재 BLINDS+ante·다음레벨·제어버튼(◀◀/⏸▶/▶▶/±1분→변이훅). `useOpsClock` 1초 틱.
- [ ] **Step 3: STATUS 통계** — `LiveStatsPanel`: `useOpsLiveStats` 카드(PLAYING/ENTRIES/RE-ENTRY/TABLES/SEATS/FREE/AVG(BB)/CHIPS/POOL). 기존 등록토글·상태버튼 유지.
- [ ] **Step 4: 탭 배선** — `[id].tsx` 세그먼트 `['players','status','tables','levels']`, STATUS를 `<ClockControl/>+<LiveStatsPanel/>`로 교체. `tsc 0`.
- [ ] **Step 5: 커밋** — `feat(ops): LEVELS 탭 + STATUS 클럭/통계 대시보드`.

### Phase 1 검증 게이트 (Task 9)

- [ ] `tsc --noEmit` 0 · `npx jest src/domains/ops src/schemas src/services/ops` PASS · `npx supabase db reset && npx supabase test db`(신규 4 pgTAP + 기존 8 회귀 0) · `npm run quality` 0err.
- [ ] 웹QA(playwright·로컬stack·expo web): `.env.development.local` 복사 → `/(ops)/tournaments/{id}` 직접URL(review-employer@uniqn.app/Review2026!) → LEVELS 입력·클럭 start/pause/±1분·STATUS 실시간(다른탭서 리바이→통계 갱신) 확인. 스크린샷 scratchpad.
- [ ] **prod/push 게이트(사용자 'go' 1회)**: 3 마이그 MCP apply → `get_advisors`(신규 트리거fn anon REVOKE·신규 ERROR/WARN 0 확인) → MCP gen types 정합 → push + PR.

---

## Phase 2 — B2 인프라 + 1c-3 모니터 (구현 직전 정밀화)

**B2:** `deploy-cloudflare.js` `--project-name`을 `process.env.CF_PROJECT_NAME ?? 'uniqn-app'`로·로그 도메인 동적화. `wrangler.toml` name 주석/문서화(멀티프로젝트는 deploy 인자 우선). `package.json` `deploy:ops`(`CF_PROJECT_NAME=ops-uniqn npm run deploy:cloudflare`). **ops.uniqn.app CF Pages 프로젝트 생성 + 커스텀도메인 = 사용자 대시보드/wrangler 작업**(에이전트 불가, 게이트에서 안내). 공개 라우트는 기존 도메인서도 동작하므로 B2는 브랜딩용(비차단).

**1c-3 모니터:**

- Migration `…_ops_1c3_monitor.sql`: `ops_rotate_monitor_token(p_tournament_id, p_actor_id)`(authed, 고엔트로피 토큰 set, event 없음/`registration_toggled` 류 재사용 안 함→event 생략 가능) + `ops_get_monitor_snapshot(p_monitor_token)` SECDEF **anon GRANT**(§3 비-PII 투영). grants: monitor_snapshot만 anon, rotate는 authed.
- pgTAP `ops_monitor_token.test.sql`: 잘못된 토큰→0/예외, 올바른 토큰→비-PII만(참가자 PII 컬럼 부재 단언), anon EXECUTE monitor_snapshot=true·rotate=false.
- Route `app/monitor/[id].tsx`(공개, 최상위): `useMonitorSnapshot(id, token)` 폴링(4s)+`computeClockRemaining`(offset 적용)+`setInterval`. 16:9 레이아웃(헤더/히어로 클럭/통계 스트립/푸터 QR). 상태별(시작전/진행/일시정지/브레이크/종료).
- `useMonitorSnapshot`: `supabase.rpc('ops_get_monitor_snapshot',{p_monitor_token})` 4s 폴링 + serverOffset 계산.

## Phase 3 — 1c-4 플레이어뷰 + claim (구현 직전 정밀화)

- Migration `…_ops_1c4_player_view.sql`: `ops_get_player_view(p_claim_token)` SECDEF **anon GRANT**(§3 본인 안전필드만) + `ops_issue_claim_token(p_participant_id, p_actor_id)`(authed, claim_token 고엔트로피 생성·멱등) + `ops_claim_participant(p_claim_token, p_user_id)`(authed, `player_user_id=auth.uid()` 1회 바인딩, `OPS_CLAIM_ALREADY_CLAIMED`). grants: player_view anon, 나머지 authed.
- pgTAP `ops_player_view_security.test.sql`: 타 토큰 격리(A토큰으로 B참가자 0)·claim 1회소비·anon EXECUTE player_view=true. **claim_token/phone 미반환 단언**.
- Route `app/live/[claim_token].tsx`(공개): `usePlayerView(token)` 폴링+클럭 틱. 내 자리(크게)·내 스택·대회 라이브·탈락 ITM·"로그인해 기록저장"(claim).
- QR 슬립: PLAYERS 탭서 `ops_issue_claim_token`→QR(`https://ops.uniqn.app/live/{token}`) 표시/출력.
- **가장 위험(anon 보안)** → 구현 후 find→adversarially-verify 적대검증(타 토큰 유출·PII 노출 시도).

---

## Self-Review (spec 대비)

- §10 슬라이스 1c-1~1c-4 전부 Task/Phase 매핑됨. B2(§3.3) Phase 2.
- §4.7 클럭(앵커/일시정지/수동레벨)·§4.10 live_stats(트리거 실테이블·부분→풀)·§5.2 모니터(비-PII)·§5.3 플레이어뷰(token SECDEF·비-Realtime) 반영. **§5.2 "anon postgres_changes 구독"은 폴링으로 정정**(Supabase 동작상 불가, §3/§5 보안 강화).
- 보안: anon 테이블 SELECT 0·신규 SECDEF anon REVOKE·공개 RPC만 anon GRANT·트리거fn REVOKE·actor 바인딩·이벤트 append — 1a/1b 계약 유지.
- 타입 일관: `computeClockRemaining`/`OpsClock`/`ops_clock` 필드명 정합. 에러코드 E6116~ 단조증가.
- 미해결(리뷰 확인 대상): ① live_stats 트리거 재계산 vs 설계 델타(성능 트레이드오프) ② 클럭 일시정지 모니터 반영 폴링 4s 지연 허용 여부(필요시 Broadcast) ③ `unique_players` 1c=entries 동치(계정 dedup 후속) ④ B2 ops.uniqn.app 생성 사용자 게이트.
