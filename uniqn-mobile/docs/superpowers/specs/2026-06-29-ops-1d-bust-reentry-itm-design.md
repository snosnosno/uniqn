# T-HOLDEM ops 1d — bust / 재진입 / ITM(ops_prizes·PAYOUTS·우승확정) 설계 스펙

> 작성: 2026-06-29 · 브랜치 `feat/ops-1d-bust-reentry-itm` · 토대=STEP A(claim 토큰 분리, #216 머지)
> 권위 명세: `docs/planning/2026-06-23-tournament-ops-revival-slice1-design.md` §4.3·§7·§8·§10 + 본 스펙(범위 확장 반영)
> 핸드오프: `docs/planning/2026-06-29-ops-1d-handoff-prompt.md`

## 0. 결론 (한 줄)

1d는 bust(탈락→순위/시각·상금 자동매핑·좌석해제·우승 자동확정)와 재진입(카운터/가드)을 운영자 SECDEF RPC로 구현하고, 설계상 1f였던 **상금 서피스(ops_prizes 고정금액 구조 + 전용 PAYOUTS 탭 + 우승 자동확정)를 1d로 끌어와 ITM을 완결**한다. 스키마는 1a forward-set이라 `ops_participants` ALTER가 없고, 신규 테이블 `ops_prizes` 1종과 RPC 3종만 추가한다.

## 1. 범위 경계 (사용자 결정 반영)

선택 이력: **ITM=ⓒ ops_prizes 선반영(고정금액/순위)** · **우승자=1d 자동확정** · **상금입력 UI=전용 PAYOUTS 탭**.

| 구분   | 1d 포함                                                         | 후속 슬라이스(YAGNI)                                            |
| ------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| bust   | finish_position·busted_at·prize 자동매핑·좌석해제·우승 자동확정 | —                                                               |
| 재진입 | reentries++·reentry_allowed/max 가드·동일행 재활성화·auto-seat  | 재진입 시간창(late-reg) 제약                                    |
| 상금   | `ops_prizes`(고정금액/순위)·PAYOUTS 탭·bust 자동매핑            | 백분율 prize·풀곡선 템플릿·바운티(knockout_pool)·상금 정정/회수 |

## 2. 데이터 (스키마)

### 2.1 신규 테이블 `ops_prizes`

```
id           uuid PK DEFAULT gen_random_uuid()
tournament_id uuid NOT NULL REFERENCES ops_tournaments(id) ON DELETE CASCADE
rank         int  NOT NULL CHECK (rank > 0)
amount       int  NOT NULL CHECK (amount >= 0)
created_at   timestamptz NOT NULL DEFAULT now()
updated_at   timestamptz NOT NULL DEFAULT now()  -- BEFORE UPDATE 트리거 fn_ops_set_updated_at 재사용
UNIQUE (tournament_id, rank)
INDEX (tournament_id, rank)
```

- RLS: ENABLE + FORCE. SELECT-only 정책 `TO authenticated USING (is_ops_member(tournament_id, auth.uid()) OR is_admin())`. INSERT/UPDATE/DELETE는 anon/authenticated REVOKE → SECDEF RPC 전용(1a D3 패턴).
- Realtime: publication 등록(선택). 상금 구조는 드물게 바뀌므로 미등록 + mutation onSuccess 무효화로 충분. **기본=미등록**.

### 2.2 `ops_participants` — ALTER 불필요

`finish_position int`(nullable)·`busted_at timestamptz`(nullable)·`prize_amount int`(nullable)·`reentries int NOT NULL DEFAULT 0`(CHECK ≥0)·`status enum(...,'busted',...)`·부분 UNIQUE `uniq_ops_participants_finish_position (tournament_id, finish_position) WHERE finish_position IS NOT NULL` 모두 1a 선반영.

### 2.3 `ops_event_type` enum — `prize_structure_set` 추가

- `ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'prize_structure_set';` (player_busted·player_reentered·prize_assigned은 1a 존재).
- **caveat**: ADD VALUE를 같은 txn에서 사용 금지 → enum ALTER는 마이그 M1, 값을 쓰는 RPC는 별도 마이그 M2(다른 txn). 함수 본문 내 문자열 리터럴은 호출 시점 평가라 생성은 무해하나, 안전하게 분리.

## 3. 신규 RPC 3종

공통 규약(1a/1b 골격): `LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions','pg_temp'`. 순서 = actor 가드 → 대상행 `FOR UPDATE` → `is_ops_member(t_id, actor) OR is_admin()` → 비즈니스 상태 가드 → 변이 → `ops_events` append → jsonb 반환. 모든 비즈니스 거부 `RAISE ... USING ERRCODE='P0001'`, 메시지 `PREFIX: 한글`.

> ⚠️ **적대검증 반영(§14)**: 아래 §3.1·§3.2는 적대검증이 적발한 CRITICAL(재진입 순위충돌 23505)·HIGH(비-active 우승오확정)·스펙버그(존재않는 `p_tournament_id` 참조)를 모두 해소한 **확정판**이다. 핵심 변경: ①"in-play=`status='active'`" 단일 정의 ②finish_position="최소 미사용 순위 ≥ 생존수"(충돌 불가) ③마지막 active bust 거부 가드 ④로컬 `v_tournament_id` 사용 ⑤winner 행 FOR UPDATE.

### 3.1 `ops_bust_participant(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb`

**용어**: `v_tournament_id`·`v_status`·`v_seat_ids`(점유 좌석 id 배열)는 step2 참가자 행에서 추출한 **로컬 변수**(함수 파라미터엔 tournament_id 없음 — 직전 스펙의 `p_tournament_id` 참조는 버그였음, 전부 `v_tournament_id`로 교체). "in-play(생존)" = `status='active'` **단일 정의**(checked_in/registered/no_show/busted는 비-인플레이) — bust 적격·순위 카운트·우승 후보가 모두 이 집합으로 일치(적대검증 trans-1 비대칭 제거).

1. actor 가드: `auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT is_admin())` → `PERMISSION_DENIED`.
2. 참가자 `SELECT id, tournament_id, status INTO v_pid, v_tournament_id, v_status ... FOR UPDATE`. NOT FOUND → `PARTICIPANT_NOT_FOUND`.
3. `is_ops_member(v_tournament_id, p_actor_id) OR is_admin()` → 아니면 `PERMISSION_DENIED`.
4. **advisory xact 락 먼저**: `PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint)`. 그 다음 대회 `SELECT status INTO v_t_status FROM ops_tournaments WHERE id=v_tournament_id FOR UPDATE`. `active` 아니면 거부 — 메시지 `INVALID_STATUS: 진행 중(active) 대회만 탈락 처리 가능`. (락→상태읽기 순서로 우승확정 레이스·TOCTOU 차단. 대회 행 락+advisory 이중 직렬화.)
5. 참가자 status 가드: `'active'`만 bust 가능. `v_status='busted'`면 `PARTICIPANT_ALREADY_BUSTED`, 그 외(registered/checked_in/no_show)면 `PARTICIPANT_NOT_ACTIVE`.
6. **생존수 산정**: `v_active := (SELECT count(*) FROM ops_participants WHERE tournament_id=v_tournament_id AND status='active')` — **이 시점 자기 자신 포함**(아직 active). ⚠️**마지막 생존자 가드**: `IF v_active <= 1 THEN RAISE 'PARTICIPANT_LAST_SURVIVOR: 마지막 생존자는 탈락 처리할 수 없습니다(우승 처리 대상)'`. (혼자 남은 active를 bust하면 우승 미확정·고착 — 적대검증 oboe-4.)
7. **finish_position 산정**(⚠️재진입 충돌 불가·off-by-one): "**생존수 이상의 가장 작은 미사용 순위**".
   ```sql
   SELECT g INTO v_finish FROM generate_series(
     v_active,
     v_active + (SELECT count(*) FROM ops_participants WHERE tournament_id=v_tournament_id AND finish_position IS NOT NULL)
   ) AS g
   WHERE NOT EXISTS (SELECT 1 FROM ops_participants WHERE tournament_id=v_tournament_id AND finish_position=g)
   ORDER BY g LIMIT 1;
   ```

   - 무재진입: v_active=N→fp=N(9,8,…,2 단조), 우승=1. **재진입/좌석전이로 생존수가 비단조여도 이미 부여된 순위를 건너뛰어 부분UNIQUE 충돌 구조적 불가**(적대검증 reentry-1 해소). 상한 `v_active+사용된순위수`는 비둘기집으로 빈칸 보장.
   - ❌**금지**: `finish_position=v_active` 직접대입(재진입 시 23505) / finder 제안 `count(assigned)+1`(순위 방향 역전).
8. **prize 매핑**: `SELECT amount INTO v_prize FROM ops_prizes WHERE tournament_id=v_tournament_id AND rank=v_finish` → 행 있으면 `v_prize=amount`(ITM, amount=0도 ITM로 간주하나 Zod가 amount≥1 강제해 0행 미발생), 없으면 `v_prize=NULL`(out of money).
9. 변이: `UPDATE ops_participants SET status='busted', busted_at=now(), finish_position=v_finish, prize_amount=v_prize, chips=0 WHERE id=p_participant_id`.
10. **좌석 해제(결정적 락 순서)**: 점유 좌석을 **id 오름차순 FOR UPDATE 후** 비움 — `FOR v_sid IN SELECT id FROM ops_seats WHERE participant_id=p_participant_id ORDER BY id FOR UPDATE LOOP ... END LOOP; UPDATE ops_seats SET participant_id=NULL WHERE participant_id=p_participant_id`. 비워진 좌석마다 `seat_freed` 이벤트. ⚠️1b 좌석 RPC(`ops_redraw_waitlist_fill`/`ops_move_seat`)가 좌석 id 오름차순 락이므로 **동일 순서로 데드락 회피**(적대검증 conc-1).
11. 이벤트: `player_busted`(payload `{finish_position, prize_amount}`). ITM이면 `prize_assigned`(payload `{participant_id, rank, amount}`) 추가.
12. **우승 자동확정**: `v_active2 := (SELECT count(*) FROM ops_participants WHERE tournament_id=v_tournament_id AND status='active')`(방금 bust 제외). `v_active2 = 1`이면:
    - `SELECT id INTO v_winner FROM ops_participants WHERE tournament_id=v_tournament_id AND status='active' FOR UPDATE`(winner 행 잠금 — 적대검증 conc-5).
    - `SELECT amount INTO v_winner_prize FROM ops_prizes WHERE tournament_id=v_tournament_id AND rank=1`.
    - `UPDATE ops_participants SET finish_position=1, prize_amount=v_winner_prize WHERE id=v_winner`.
    - `UPDATE ops_tournaments SET status='completed' WHERE id=v_tournament_id`(active→completed 합법) + `tournament_status_changed`(from active,to completed) 이벤트.
    - `v_winner_prize IS NOT NULL`이면 `prize_assigned`(rank=1) 이벤트.
    - ⚠️winner는 status 유지(active). status enum에 winner 값 없음 — 권위 신호는 `tournament.status='completed'` + `finish_position=1`. **비-active(checked_in 등)가 마지막이면 v_active2≠1이라 미확정 → 운영자가 좌석배정/수동완료**(적대검증 trans-1: 미플레이어 오확정 차단).
13. 반환(snake_case jsonb, Repository가 camelCase 매핑 — §6.1): `jsonb_build_object('participant_id', p_participant_id, 'finish_position', v_finish, 'prize_amount', v_prize, 'winner_finalized', (v_active2=1), 'winner', CASE WHEN v_active2=1 THEN jsonb_build_object('participant_id', v_winner, 'finish_position', 1, 'prize_amount', v_winner_prize) ELSE NULL END)`.
14. live*stats: participant·seat UPDATE → AFTER 트리거 `trg_ops*\*\_recompute_stats`자동 재계산(playing/total_chips/average_stack 정합). **신규 트리거 불필요**(busted는`FILTER(status='active')`서 자동 제외).

### 3.2 `ops_reenter_participant(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb`

1. actor 가드(3.1과 동일).
2. 참가자 `SELECT id, tournament_id, status, reentries INTO v_pid, v_tournament_id, v_status, v_reentries ... FOR UPDATE`. NOT FOUND → `PARTICIPANT_NOT_FOUND`.
3. `is_ops_member(v_tournament_id, p_actor_id) OR is_admin()` → 아니면 `PERMISSION_DENIED`.
4. **advisory xact 락 먼저**(3.1과 **동일 키** `hashtext('ops_tournament_'||v_tournament_id::text)::bigint`) → 그 다음 대회 `SELECT status, reentry_allowed, max_reentries, starting_chips, auto_seat_on_register INTO ... FROM ops_tournaments WHERE id=v_tournament_id FOR UPDATE`. `status<>'active'`면 거부 `INVALID_STATUS: 진행 중(active) 대회만 재진입 가능`. ⚠️락→대회 FOR UPDATE 순서로 TOCTOU 차단(적대검증 conc-2: completed 대회 부활 방지).
5. 참가자 status 가드: `v_status='busted'`만 재진입. 아니면 `PARTICIPANT_NOT_BUSTED`.
6. 재진입 정책 가드: `reentry_allowed=false` → `REENTRY_NOT_ALLOWED`. `max_reentries IS NOT NULL AND v_reentries >= max_reentries` → `MAX_REENTRIES_EXCEEDED`. (`max_reentries IS NULL` = 무제한.)
7. **auto-seat 결정 먼저**: `auto_seat_on_register=true`면 빈좌석 `SELECT id INTO v_seat_id FROM ops_seats WHERE tournament_id=v_tournament_id AND <open·unlocked·participant_id IS NULL> ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`. `v_seat_id` 있으면 `v_seated:=true, v_new_status:='active'`, 없으면(또는 auto_seat=false) `v_seated:=false, v_new_status:='checked_in'`. (register v2 미러 — active-without-seat 불변식 준수: 좌석 확보 후에만 active.)
8. **동일 행 재활성화**: `UPDATE ops_participants SET chips=v_starting_chips, finish_position=NULL, busted_at=NULL, prize_amount=NULL, reentries=v_reentries+1, status=v_new_status WHERE id=p_participant_id`. 좌석 확보 시 `UPDATE ops_seats SET participant_id=p_participant_id WHERE id=v_seat_id`. ⚠️checked_in은 "in-play(active)" 아님 → 좌석 못 받은 재진입자는 생존수에 미포함(§3.1 단일 정의 정합).
9. 이벤트: `player_reentered`(payload `{reentries, seated:bool}`).
10. 반환(snake_case): `{participant_id, reentries, status, seated}`.

- ⚠️**경제 정합 한계**(적대검증 livestats-1/reentry-4, 비차단): 재진입은 동일 행 재활성화라 `ops_live_stats.entries(=count(*))`·`prize_pool`에 **재진입 buy-in이 미반영**(reentries는 `reentries_total`로만 집계). **고정금액 상금(ops_prizes)이라 prize_pool은 PAYOUTS의 참고 표시일 뿐 실제 상금 산정에 미사용** → 1d 무영향. 풀 기반 산정은 1f에서 recompute에 `reentries` 가산.

### 3.3 `ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb) RETURNS jsonb`

- `p_prizes` = `[{"rank":1,"amount":100000},{"rank":2,"amount":60000},...]`.

1. actor 가드 → 대회 `SELECT status INTO v_t_status FROM ops_tournaments WHERE id=p_tournament_id FOR UPDATE`(NOT FOUND → `TOURNAMENT_NOT_FOUND`) → is_ops_member.
   - **status 가드**(적대검증 consist-1): `v_t_status='completed'`면 거부 `INVALID_STATUS: 종료된 대회의 상금 구조는 변경할 수 없습니다`. (upcoming/active만 편집 — 종료 후 부여된 prize_amount와의 영구 불일치 차단.)
2. 검증: 각 원소 `rank>0`·`amount>=1`·rank 중복 없음. 위반 시 `PRIZE_STRUCTURE_INVALID`. (jsonb 파싱은 `jsonb_array_elements` + 집계로 중복 rank 탐지. amount≥1로 0-상금 ITM 오표시 차단 — 적대검증 prize-2.)
3. **replace-all**: `DELETE FROM ops_prizes WHERE tournament_id=p_tournament_id` → `INSERT INTO ops_prizes(tournament_id, rank, amount) SELECT p_tournament_id, (e->>'rank')::int, (e->>'amount')::int FROM jsonb_array_elements(p_prizes) e`.
4. 이벤트: `prize_structure_set`(payload `{count, ranks}`).
5. 반환: `{tournament_id, count}`.

- ⚠️ replace-all은 이미 부여된 participant.prize_amount를 **소급 변경하지 않음**(스냅샷 모델). 구조 편집은 미래 bust에만 영향. **UX(§6.4): PAYOUTS 탭은 대회 시작(active 전)에 상금 구조 설정을 권장 안내** — bust 후 설정 시 기존 탈락자 상금은 NULL 유지(적대검증 prize-3, 운영자 기대 보호).

## 4. 권한 (grants) — 마이그 M3

신규 RPC 3종에 1a DO 루프 패턴: `REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role`. ⚠️anon 노출 금지(monitor/player view 2개만 anon-executable 유지). prod apply 후 `get_advisors`로 function_search_path_mutable·anon grant 회귀 0 확인.

## 5. 에러 매핑

### 5.1 신규 prefix → AppError 코드 (E6122 다음 = E6123~)

| prefix                       | code                                     | 한글 메시지                                  |
| ---------------------------- | ---------------------------------------- | -------------------------------------------- |
| `PARTICIPANT_ALREADY_BUSTED` | `OPS_PARTICIPANT_ALREADY_BUSTED='E6123'` | 이미 탈락 처리된 참가자예요.                 |
| `PARTICIPANT_NOT_BUSTED`     | `OPS_PARTICIPANT_NOT_BUSTED='E6124'`     | 탈락 상태가 아니어서 재진입할 수 없어요.     |
| `REENTRY_NOT_ALLOWED`        | `OPS_REENTRY_NOT_ALLOWED='E6125'`        | 이 대회는 재진입이 허용되지 않아요.          |
| `MAX_REENTRIES_EXCEEDED`     | `OPS_MAX_REENTRIES_EXCEEDED='E6126'`     | 최대 재진입 횟수를 초과했어요.               |
| `PRIZE_STRUCTURE_INVALID`    | `OPS_PRIZE_STRUCTURE_INVALID='E6127'`    | 상금 구조가 올바르지 않아요(순위·금액 확인). |

- 기존 재사용: `PARTICIPANT_NOT_ACTIVE`·`PARTICIPANT_NOT_FOUND`·`TOURNAMENT_NOT_FOUND`·`INVALID_STATUS`·`PERMISSION_DENIED`.
- ⚠️PREFIX_MAP 부분문자열 충돌: `PARTICIPANT_ALREADY_BUSTED`/`PARTICIPANT_NOT_BUSTED`를 `PARTICIPANT_NOT_ACTIVE`/`PARTICIPANT_NOT_FOUND`보다 **앞**에 배치(includes 순차 매칭).

## 6. 데이터레이어·UI (Presentation→Hooks→Service→Repository→Supabase)

### 6.1 bust/재진입

- ⚠️**반환 매핑 계약(적대검증 data-1/data-2)**: RPC는 snake_case jsonb 반환. 기존 `addRebuy`처럼 void 무시하지 말고 **명시 매핑**한다(컬럼 기반 `toCamelCase` 미경유 — RPC 반환은 SELECT 행이 아님). 신규 타입:
  ```ts
  interface OpsBustResult {
    finishPosition: number;
    prizeAmount: number | null;
    winnerFinalized: boolean;
    winner: { participantId: string; finishPosition: number; prizeAmount: number | null } | null;
  }
  interface OpsReenterResult {
    participantId: string;
    reentries: number;
    status: OpsParticipantStatus;
    seated: boolean;
  }
  ```
- `OpsParticipantRepository.bustParticipant(participantId, actorId): Promise<OpsBustResult>` — `supabase.rpc('ops_bust_participant', { p_participant_id, p_actor_id })` → error면 `mapOpsRpcError` → `data` 의 snake_case 키를 `OpsBustResult`로 손수 매핑(`finish_position→finishPosition` 등). `reenterParticipant` 동일(`OpsReenterResult`).
- `opsParticipantService`: try/catch + `handleServiceError`, 매핑된 타입 그대로 상위 전달.
- `useOpsMutations`: `useBustParticipant`·`useReenterParticipant`. onSuccess 무효화 = **운영자 앱 자신의** `participants`+`tournamentDetail`+`seats`+(상금 영향 시)`prizes`. ⚠️공개 monitor/player뷰는 **별도 기기에서 자체 폴링(4s)**이라 운영자 앱의 `invalidateQueries`로 못 미침 — "monitor 무효화"는 운영자 화면용일 뿐(적대검증 data-3). bust 반환(`OpsBustResult`)으로 ITM/우승 팝업 트리거.

### 6.2 prizes

- 신규 타입 `OpsPrize {id, tournamentId, rank, amount}`. `OpsPrizeRepository.list(tournamentId)`(읽기 SELECT는 `toCamelCase`)·`setStructure(tournamentId, actorId, prizes[])`. `opsPrizeService`. 스키마 `opsPrize.schema.ts`(쓰기 입력 Zod: `z.array(z.object({rank: z.number().int().positive(), amount: z.number().int().positive()}))` + 중복 rank refine — **amount는 positive(≥1)**, 0-상금 ITM 오표시 차단). 훅 `useOpsPrizes`(조회)·`useSetPrizeStructure`(변이).

### 6.3 PLAYERS 탭 (`app/(ops)/tournaments/[id].tsx` renderItem)

- `status==='active'`: 기존 리바이/애드온 + **[탈락]**(빨강 아웃라인, 파괴적 라벨 "탈락 처리", 확인 다이얼로그 — impeccable 룰11/12). bust 성공 시 ITM/우승 팝업.
- `status==='busted'`: **▪탈락▪ 배지(회색 pill)** + `{finishPosition}위`(골드) + ITM이면 `상금 {prizeAmount}`(골드) / 비-ITM이면 `(상금 없음)`(dim) + **[재진입]**(골드 CTA). 가드 거부는 토스트.
- 신규 훅 import·초기화는 기존 위치(17-26·38-42줄).

### 6.4 PAYOUTS 탭 (6번째 세그먼트 + 신규 `@/components/ops/PayoutsTab`)

- 빈 상태: 온보딩(인지/가치/행동 — impeccable 룰9) "상금 구조 만들기" 골드 CTA + **"대회 시작 전 설정 권장"** 안내(prize-3 소급 미반영).
- 입력 상태: `상금 풀 {prizePool}`(live_stats 파생, **참고용·재진입 buy-in 미반영 가능**) + rank→amount 입력행 + [+순위 추가] + `합계/풀` 검증 보조 + [상금 구조 저장](replace-all). 금액=골드, 44px 터치, 스켈레톤 로딩.
- ⚠️**6탭 추가는 4개 사이트 동시수정**(적대검증 data-4): `setTab` 유니온 타입(`'players'|...|'payouts'`)·세그먼트 배열(106줄)·라벨 삼항(117줄~)·렌더 캐스케이드 모두 갱신. **6탭 가로폭** → 영문→**한글 축약 라벨**(참가/현황/테이블/블라인드/상금/이력)로 교체(폭 절약, 별도 디자인 정제 불요).

### 6.5 플레이어뷰 (`app/(public)/live/[view_token].tsx`)

- 순위 표시를 `prizeAmount!==null` 밖으로 분리 → **비-ITM 탈락도 'N위' 노출**(코드 1곳). ITM은 기존대로 순위+상금.
- ⚠️탈락 배너는 **`status==='busted'` 기준**(좌석 유무 무관). bust가 좌석을 해제해도 배너가 status로 표시되므로 "좌석 미배정" 오표시 없음(적대검증 data-5). me 투영에 좌석 의존 없음 확인.

## 7. 마이그레이션 순서 (additive, 신규 파일 3종)

1. `20260629xxxxxx_ops_1d_prizes_table.sql` — `ops_prizes` 테이블+RLS+인덱스 / `ALTER TYPE ops_event_type ADD VALUE IF NOT EXISTS 'prize_structure_set'`.
2. `20260629xxxxxx_ops_1d_bust_reenter_prize_rpcs.sql` — RPC 3종.
3. `20260629xxxxxx_ops_1d_grants_and_realtime.sql` — 신규 RPC grants(DO 루프) (+ops_prizes realtime 미등록 결정).

- ⚠️로컬: `npm run db:reset`(마이그만 재구성→ops_helpers 소거) 후 `npm run test:db:helpers` 재적재 필수. MCP `apply_migration`은 **prod 전용**(SDD 서브에이전트 금지).

## 8. 테스트

### 8.1 pgTAP (`supabase/tests/*.test.sql`, 단일 txn BEGIN/plan/finish/ROLLBACK)

- `ops_bust_participant.test.sql`: ①finish_position(active N 시드→bust→Nth, 9→8→…→2 단조) ②이중 bust 거부(P0001 `PARTICIPANT_ALREADY_BUSTED`) ③부분UNIQUE 중복(postgres role 직접 INSERT 23505) ④prize 매핑(set_structure 후 ITM rank bust→prize_amount 일치) ⑤비-ITM bust→prize_amount NULL ⑥우승 자동확정(active 2→1 bust→나머지 finish_position=1+rank1 prize+tournament completed) ⑦좌석 해제(seat participant_id NULL) ⑧live_stats playing 감소·average_stack 정합 ⑨actor 가드 3종(위조/비멤버) ⑩대회 비-active bust 거부 **⑪[적대검증 reentry-1 회귀] 재진입 후 재탈락 순위충돌 없음**: p1bust(4)→p2bust(3)→p1재진입→p3bust 시 fp=4(미사용 최소≥3)·**23505 미발생** **⑫[oboe-4] 마지막 active 1인 bust 거부(`PARTICIPANT_LAST_SURVIVOR`)** **⑬[trans-1] active1+checked_in1 → active bust 시 checked_in이 우승확정되면 FAIL**(우승 미확정+대회 active 유지가 정답) **⑭[winner] 우승자 finish_position=1·status 유지(active)·tournament completed**.
- `ops_reenter_participant.test.sql`: ①busted→active/checked_in 리셋(chips=starting·finish_position/prize/busted_at NULL) ②reentries 정확히 +1 ③reentry_allowed=false→`REENTRY_NOT_ALLOWED` ④max 초과→`MAX_REENTRIES_EXCEEDED` ⑤not-busted→`PARTICIPANT_NOT_BUSTED` ⑥auto-seat 분기(빈좌석→active/seated, 없음→checked_in/!seated) ⑦live_stats playing 정합(active 복귀 시 +1, checked_in 복귀 시 불변) ⑧actor 가드 3종 **⑨[conc-2] completed 대회 재진입 거부(`INVALID_STATUS`)**.
- `ops_prizes_structure.test.sql`: ①replace-all(기존 행 삭제+신규) ②중복 rank→`PRIZE_STRUCTURE_INVALID` ③음수 amount 거부 ④RLS SELECT(멤버 가능/outsider 0행) ⑤anon EXECUTE 거부 ⑥actor 가드.
- ⚠️다중 참가자 시드: `ops_test_seed` 확장(`DROP FUNCTION` 후 재정의로 N명 시드 RETURNS) 또는 테스트 내 postgres role 직접 INSERT. **결정: 헬퍼에 `ops_test_seed_players(t_id, n)` 보조 함수 추가**(기존 seed 시그니처 불변 유지).
- ⚠️pgTAP 단일 txn 한계: 실제 동시성(advisory 락) 미검증 → (a)순차 단조 (b)23505/P0001 거부만. 동시성은 코드리뷰+적대검증으로 커버.

### 8.2 jest

- prize 매핑·bust 순위·재진입 도메인(`opsStats`/service mock) + 에러매핑 단위(opsRpcError 신규 prefix→code) + 스키마(opsPrize Zod 중복 rank reject).

## 9. 회귀 주의 (적대검증·pgTAP 필수 커버)

1. **이중 busted 게이트**: busted 재-bust 거부(상태전이 가드, 1a 핀).
2. **finish_position(재진입 충돌 불가)**: "생존수 이상 최소 미사용 순위" — 무재진입 N→Nth 단조, 재진입/좌석전이로 비단조여도 부분UNIQUE 충돌 불가(§3.1-7). ❌`fp=v_active` 직접대입 금지.
3. **재진입 카운터**: reentries++ 정확히 1회·max 초과 거부·동시요청 레이스(FOR UPDATE+advisory).
4. **live_stats 정합**: bust→playing 감소·average_stack, 재진입→복귀(active만). 트리거 자동(소스 추가 불요).
5. **우승 자동확정**: active만 후보(비-active 미확정). active 2→1 bust 시 단 1회 확정(advisory+대회 FOR UPDATE). 이중 completed 차단. **마지막 active 1인 bust 거부**.
6. **prize 경계**: replace-all 소급 미반영·비-ITM NULL·amount≥1·completed 편집 차단.
7. **denormalized counter drift**(`pitfall_denormalized_counter_drift`): INSERT/UPDATE/DELETE 3경로+status 전이 enumerate.
8. **데드락 회피**: bust 좌석해제 = 좌석 id 오름차순 FOR UPDATE(1b RPC와 동일 순서).
9. **반환 매핑**: RPC snake_case→Repository camelCase 수동 매핑(toCamelCase 미경유).

## 10. 적대검증 차원 (find→adversarially-verify WF)

트랜잭션/동시성(advisory 락 키·FOR UPDATE 순서) · off-by-one(생존 카운트 경계) · 이중 busted · 재진입 카운터/가드 · live_stats 정합 · 우승확정 레이스·이중 completed · prize 경계(소급/스냅샷/비-ITM) · grants(anon 노출) · 에러매핑 충돌. STEP A처럼 **확정된 결함만** 반영.

## 11. 검증·게이트

pgTAP(전 시나리오)·jest 4524+신규·`tsc --noEmit`·`npm run quality` 전부 GREEN 증거. RED-GREEN(이중 busted·off-by-one·재진입 가드). 컨트롤러 직접 재검증. **prod 게이트("go") 후에만** MCP apply→`get_advisors`(ERROR 0·anon SECDEF=monitor/player 2개 유지)→`supabase.ts` gen(additive)→push+PR+CI+머지. OTA는 보류(prod ops 0행).

## 12. 비차단 fast-follow

- STEP A 잔여: opsRpcError 미테스트 엔트리 보강 · `ops_unclaim_participant` 운영자 UI · STEP A wiki `/ingest` 졸업.
- 다음 게이트: 1e(스태프 연동) · 1f 잔여(백분율 prize·풀곡선·바운티·정정).

## 13. SDD 가드레일

- ⚠️SDD implementer에 **"브랜치 생성/전환 금지, `feat/ops-1d-bust-reentry-itm`에 커밋"** 가드 필수(STEP A 이탈 교훈).
- MCP `mcp__supabase__*` **SDD 서브에이전트 절대 금지**(로컬 docker/npm만). 기존 마이그 수정 금지(신규 파일만). `@/` 절대경로. 한글.

## 14. 적대검증 반영 이력 (10차원 find→3렌즈 verify WF, 2026-06-29~30)

> WF 44 findings 탐지. 세션 한도로 verify 절반 실패(0/0 미검증) → **확정 2건 + 직접 코드대조 판정**으로 종합. 반영분:

| ID                       | 심각도             | 결함                                                                     | 해소(스펙 위치)                                                                       |
| ------------------------ | ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| reentry-1/integ-1/oboe-1 | **CRITICAL**       | 카운트 기반 finish_position이 재진입 시 부분UNIQUE 23505로 bust 하드실패 | "생존수 이상 최소 미사용 순위" 알고리즘 §3.1-7 (finder의 count+1은 방향역전이라 폐기) |
| trans-1/oboe-2/logic-1   | **HIGH**           | 비-active(checked_in) 생존자가 우승 오확정·rank1 상금 오지급             | "in-play=active" 단일화 — bust적격·순위·우승후보 일치 §3.1-6·12                       |
| conc-3/oboe-5            | **HIGH(스펙버그)** | advisory 락이 함수에 없는 `p_tournament_id` 참조(컴파일깨짐)             | 로컬 `v_tournament_id` 전면 교체 §3.1                                                 |
| oboe-4                   | MEDIUM             | 마지막 active 1인 bust→우승미확정 고착                                   | `v_active<=1 → PARTICIPANT_LAST_SURVIVOR` §3.1-6                                      |
| conc-1                   | MEDIUM             | 좌석해제 락순서 역전→1b 좌석RPC와 데드락                                 | 좌석 id 오름차순 FOR UPDATE §3.1-10                                                   |
| conc-2                   | MEDIUM(HIGH후보)   | reenter 대회 FOR UPDATE 누락→completed 부활 TOCTOU                       | advisory먼저+대회 FOR UPDATE §3.2-4                                                   |
| conc-5                   | MEDIUM             | winner 행 FOR UPDATE 없이 갱신                                           | winner SELECT FOR UPDATE §3.1-12                                                      |
| data-1/data-2            | HIGH               | RPC snake_case 반환 vs 데이터레이어 camelCase 가정                       | Repository 명시 매핑+`OpsBustResult` 계약 §6.1                                        |
| consist-1                | MEDIUM             | set_prize_structure status 가드 부재                                     | completed 차단 §3.3-1                                                                 |
| prize-2                  | LOW                | amount=0 ITM 오표시                                                      | Zod `positive()`(≥1) §3.3-2·§6.2                                                      |
| prize-3                  | LOW                | replace-all 소급 미반영 운영자 혼동                                      | PAYOUTS "시작 전 설정" 안내 §3.3·§6.4                                                 |
| data-3                   | LOW                | "monitor 무효화" 공개뷰엔 no-op                                          | 공개뷰=자체 폴링 명시 §6.1                                                            |
| data-4                   | LOW                | 6탭 추가=4사이트 동시수정                                                | 구현 노트 §6.4                                                                        |
| data-5                   | LOW                | 좌석해제로 탈락자 "좌석 미배정" 오표시                                   | 배너=status 기준(좌석무관) §6.5                                                       |

**비차단(검증 후 기각/한계 수용)**: livestats-1/reentry-4(재진입 buy-in이 prize*pool 미반영 — 고정금액이라 무영향, 1f서 recompute 가산) · errmap-2(신규 prefix는 NOT*\*와 substring 무관 — 배치순서 무의미하나 순서 유지) · reentry-2(heads-up 중 재진입기간이면 자동완료가 재진입 차단 — 재진입기간은 초기라 비현실, 수용) · oboe-3(no_show 전이 RPC 부재 — no_show 미설정이라 카운트 무영향, 1e/별도) · conc-5 후속(completed 대회 winner rebuy/addon 가능 — 1a RPC에 tournament-active 가드 추가는 별도 PR).
