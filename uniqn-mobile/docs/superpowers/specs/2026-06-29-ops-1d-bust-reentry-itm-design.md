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

### 3.1 `ops_bust_participant(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb`

1. actor 가드: `auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT is_admin())` → `PERMISSION_DENIED`.
2. 참가자 `SELECT id, tournament_id, status, seat 점유 INTO ... FOR UPDATE`. NOT FOUND → `PARTICIPANT_NOT_FOUND`.
3. `is_ops_member(tournament_id, p_actor_id) OR is_admin()` → 아니면 `PERMISSION_DENIED`.
4. 대회 상태 `SELECT status FROM ops_tournaments WHERE id=t FOR UPDATE` 가 `active` 아니면 거부 — 메시지 `INVALID_STATUS: 진행 중(active) 대회만 탈락 처리 가능` (기존 opsRpcError 매핑 재사용, 신규 prefix 회피).
5. 참가자 status 가드: `'active'`만 bust 가능. `'busted'`면 `PARTICIPANT_ALREADY_BUSTED`, 그 외(registered/checked_in/no_show)면 `PARTICIPANT_NOT_ACTIVE`.
6. **per-tournament advisory xact 락**: `PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint)`. bust·재진입·우승확정이 **동일 대회 키**로 직렬화(동시 bust 순위 충돌·우승확정 레이스 차단). 키 충돌(다른 대회 우연 동일 해시)은 무해(일시 직렬화).
7. **finish_position 산정**(⚠️off-by-one 핵심): `v_alive := count(*) FROM ops_participants WHERE tournament_id=t AND status NOT IN ('busted','no_show')` — **이 시점 자기 자신은 아직 active라 포함됨** → `finish_position = v_alive`. (생존 N명일 때 bust되는 사람 = Nth.) ⚠️설계 §7의 "active 카운트"를 **'생존(미탈락)'으로 보정**: late-reg 미착석(checked_in/registered)도 필드로 셈.
8. **prize 매핑**: `SELECT amount FROM ops_prizes WHERE tournament_id=t AND rank=finish_position` → 있으면 `v_prize := amount`(ITM), 없으면 NULL.
9. 변이: `UPDATE ops_participants SET status='busted', busted_at=now(), finish_position=v_finish, prize_amount=v_prize, chips=0 WHERE id=p_participant_id`. (chips=0 — 탈락자 칩 잔량 표시 0.)
10. **좌석 해제**: `UPDATE ops_seats SET participant_id=NULL WHERE participant_id=p_participant_id RETURNING id` — 비워진 좌석이 있으면 `seat_freed` 이벤트 append.
11. 이벤트: `player_busted`(payload `{finish_position, prize_amount}`) append. ITM이면 `prize_assigned`(payload `{participant_id, rank, amount}`) 추가 append.
12. **우승 자동확정**: 다시 `v_alive2 := count(*) ... status NOT IN ('busted','no_show')`. `v_alive2 = 1`이면 그 1인(`SELECT id FROM ... WHERE status NOT IN ('busted','no_show')`)을:
    - `UPDATE ops_participants SET finish_position=1, prize_amount=(ops_prizes rank=1 amount) WHERE id=winner`.
    - `UPDATE ops_tournaments SET status='completed' WHERE id=t`(전이 active→completed 합법) + `tournament_status_changed`(from active,to completed) 이벤트.
    - winner prize 있으면 `prize_assigned` 이벤트.
    - ⚠️winner는 status를 바꾸지 않음(busted 아님). status enum에 winner 값 없음 — 권위 신호는 `tournament.status='completed'` + `finish_position=1`.
13. 반환: `jsonb_build_object('participant_id', p_participant_id, 'finish_position', v_finish, 'prize_amount', v_prize, 'winner_finalized', (v_alive2=1), 'winner', <winner jsonb or null>)`.
14. live*stats: participant·seat UPDATE → AFTER 트리거 `trg_ops*\*\_recompute_stats` 자동 재계산(playing/total_chips/average_stack 정합). **신규 트리거 불필요**.

### 3.2 `ops_reenter_participant(p_participant_id uuid, p_actor_id uuid) RETURNS jsonb`

1~3. actor 가드 → 참가자 `FOR UPDATE` → is*ops_member (3.1과 동일). 4. 대회 `active` 아니면 거부(completed 후 재진입 금지 — `INVALID_STATUS:` 재사용). advisory xact 락(3.1과 **동일 키** `hashtext('ops_tournament*'||t)`— 재진입은 생존 카운트 변경).
5. 참가자 status 가드:`'busted'`만 재진입. 아니면 `PARTICIPANT_NOT_BUSTED`.
6. 재진입 정책 가드: `SELECT reentry_allowed, max_reentries, starting_chips, auto_seat_on_register FROM ops_tournaments`. `reentry_allowed=false`→`REENTRY_NOT_ALLOWED`. `max_reentries IS NOT NULL AND reentries >= max_reentries`→`MAX_REENTRIES_EXCEEDED`. (`max_reentries IS NULL`= 무제한.)
7. **동일 행 재활성화**:`UPDATE ops_participants SET chips=v_starting_chips, finish_position=NULL, busted_at=NULL, prize_amount=NULL, reentries=reentries+1, status=<재착석 결과>`.
8. **auto-seat(register 정확히 미러)**: `auto_seat_on_register=true` **그리고** 빈좌석(`open·unlocked LIMIT 1 FOR UPDATE OF s SKIP LOCKED`) 선점 성공 → 좌석 배정 + status `'active'`. 그 외(auto_seat=false **또는** 빈좌석 없음) → status `'checked_in'`(좌석 미배정, 운영자/1e가 배치). ⚠️register v2의 "seated면 active, 아니면 checked_in"과 **완전 동일** — 재진입자가 active로 바로 안 가는 경우 존재(checked_in도 '생존'으로 카운트됨).
9. 이벤트: `player_reentered`(payload `{reentries, seated:bool}`).
10. 반환: `{participant_id, reentries, status, seated}`.

### 3.3 `ops_set_prize_structure(p_tournament_id uuid, p_actor_id uuid, p_prizes jsonb) RETURNS jsonb`

- `p_prizes` = `[{"rank":1,"amount":100000},{"rank":2,"amount":60000},...]`.

1. actor 가드 → 대회 `FOR UPDATE`(NOT FOUND → `TOURNAMENT_NOT_FOUND`) → is_ops_member.
2. 검증: 각 원소 `rank>0`·`amount>=0`·rank 중복 없음. 위반 시 `PRIZE_STRUCTURE_INVALID`. (jsonb 파싱은 `jsonb_array_elements` + 집계로 중복 rank 탐지.)
3. **replace-all**: `DELETE FROM ops_prizes WHERE tournament_id=p_tournament_id` → `INSERT INTO ops_prizes(tournament_id, rank, amount) SELECT p_tournament_id, (e->>'rank')::int, (e->>'amount')::int FROM jsonb_array_elements(p_prizes) e`.
4. 이벤트: `prize_structure_set`(payload `{count, ranks}`).
5. 반환: `{tournament_id, count}`.

- ⚠️ replace-all은 이미 부여된 participant.prize_amount를 **소급 변경하지 않음**(스냅샷 모델). 구조 편집은 미래 bust에만 영향. 문서·UI에 명시.

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

- `OpsParticipantRepository`: `bustParticipant(participantId, actorId)`·`reenterParticipant(participantId, actorId)` — `supabase.rpc(...)` + `mapOpsRpcError`. add_rebuy 패턴 동일.
- `opsParticipantService`: try/catch + `handleServiceError`. bust는 반환 jsonb(finishPosition/prizeAmount/winner) 파싱해 상위 전달.
- `useOpsMutations`: `useBustParticipant`·`useReenterParticipant`. onSuccess 무효화 = `participants`+`tournamentDetail`+`seats`(+우승 시 `monitor`). bust 반환으로 ITM/우승 팝업 트리거.

### 6.2 prizes

- 신규 타입 `OpsPrize {id, tournamentId, rank, amount}`. `OpsPrizeRepository.list(tournamentId)`·`setStructure(tournamentId, actorId, prizes[])`. `opsPrizeService`. 스키마 `opsPrize.schema.ts`(쓰기 입력 Zod: `z.array(z.object({rank:int>0, amount:int>=0}))` + 중복 rank refine). 훅 `useOpsPrizes`(조회)·`useSetPrizeStructure`(변이).

### 6.3 PLAYERS 탭 (`app/(ops)/tournaments/[id].tsx` renderItem)

- `status==='active'`: 기존 리바이/애드온 + **[탈락]**(빨강 아웃라인, 파괴적 라벨 "탈락 처리", 확인 다이얼로그 — impeccable 룰11/12). bust 성공 시 ITM/우승 팝업.
- `status==='busted'`: **▪탈락▪ 배지(회색 pill)** + `{finishPosition}위`(골드) + ITM이면 `상금 {prizeAmount}`(골드) / 비-ITM이면 `(상금 없음)`(dim) + **[재진입]**(골드 CTA). 가드 거부는 토스트.
- 신규 훅 import·초기화는 기존 위치(17-26·38-42줄).

### 6.4 PAYOUTS 탭 (6번째 세그먼트 + 신규 `@/components/ops/PayoutsTab`)

- 빈 상태: 온보딩(인지/가치/행동 — impeccable 룰9) "상금 구조 만들기" 골드 CTA.
- 입력 상태: `상금 풀 {prizePool}`(live_stats 파생, 참고용) + rank→amount 입력행 + [+순위 추가] + `합계/풀` 검증 보조 + [상금 구조 저장](replace-all). 금액=골드, 44px 터치, 스켈레톤 로딩.
- ⚠️**6탭 가로폭**: 한글 축약(참가/현황/테이블/블라인드/상금/이력) 또는 가로 스크롤 세그먼트. **결정: 한글 축약 라벨**(현 영문 → 한글, 폭 절약). 별도 디자인 정제 불요.

### 6.5 플레이어뷰 (`app/(public)/live/[view_token].tsx`)

- 순위 표시를 `prizeAmount!==null` 밖으로 분리 → **비-ITM 탈락도 'N위' 노출**(코드 1곳). ITM은 기존대로 순위+상금.

## 7. 마이그레이션 순서 (additive, 신규 파일 3종)

1. `20260629xxxxxx_ops_1d_prizes_table.sql` — `ops_prizes` 테이블+RLS+인덱스 / `ALTER TYPE ops_event_type ADD VALUE IF NOT EXISTS 'prize_structure_set'`.
2. `20260629xxxxxx_ops_1d_bust_reenter_prize_rpcs.sql` — RPC 3종.
3. `20260629xxxxxx_ops_1d_grants_and_realtime.sql` — 신규 RPC grants(DO 루프) (+ops_prizes realtime 미등록 결정).

- ⚠️로컬: `npm run db:reset`(마이그만 재구성→ops_helpers 소거) 후 `npm run test:db:helpers` 재적재 필수. MCP `apply_migration`은 **prod 전용**(SDD 서브에이전트 금지).

## 8. 테스트

### 8.1 pgTAP (`supabase/tests/*.test.sql`, 단일 txn BEGIN/plan/finish/ROLLBACK)

- `ops_bust_participant.test.sql`: ①finish_position off-by-one(생존 N 시드→bust→Nth) ②이중 bust 거부(P0001 `PARTICIPANT_ALREADY_BUSTED`) ③부분UNIQUE 중복(postgres role 직접 INSERT 23505) ④prize 매핑(set_structure 후 ITM rank bust→prize_amount 일치) ⑤비-ITM bust→prize_amount NULL ⑥우승 자동확정(생존 2→1 bust→나머지 finish_position=1+rank1 prize+tournament completed) ⑦좌석 해제(seat participant_id NULL) ⑧live_stats playing 감소·average_stack 정합 ⑨actor 가드 3종(위조/비멤버) ⑩대회 비-active bust 거부.
- `ops_reenter_participant.test.sql`: ①busted→active 리셋(chips=starting·finish_position/prize/busted_at NULL) ②reentries 정확히 +1 ③reentry_allowed=false→`REENTRY_NOT_ALLOWED` ④max 초과→`MAX_REENTRIES_EXCEEDED` ⑤not-busted→`PARTICIPANT_NOT_BUSTED` ⑥auto-seat 분기 ⑦live_stats entries 정합 ⑧actor 가드 3종.
- `ops_prizes_structure.test.sql`: ①replace-all(기존 행 삭제+신규) ②중복 rank→`PRIZE_STRUCTURE_INVALID` ③음수 amount 거부 ④RLS SELECT(멤버 가능/outsider 0행) ⑤anon EXECUTE 거부 ⑥actor 가드.
- ⚠️다중 참가자 시드: `ops_test_seed` 확장(`DROP FUNCTION` 후 재정의로 N명 시드 RETURNS) 또는 테스트 내 postgres role 직접 INSERT. **결정: 헬퍼에 `ops_test_seed_players(t_id, n)` 보조 함수 추가**(기존 seed 시그니처 불변 유지).
- ⚠️pgTAP 단일 txn 한계: 실제 동시성(advisory 락) 미검증 → (a)순차 단조 (b)23505/P0001 거부만. 동시성은 코드리뷰+적대검증으로 커버.

### 8.2 jest

- prize 매핑·bust 순위·재진입 도메인(`opsStats`/service mock) + 에러매핑 단위(opsRpcError 신규 prefix→code) + 스키마(opsPrize Zod 중복 rank reject).

## 9. 회귀 주의 (적대검증·pgTAP 필수 커버)

1. **이중 busted 게이트**: busted 재-bust 거부(상태전이 가드, 1a 핀).
2. **off-by-one**: 생존(미탈락) 카운트=자기 포함 N → Nth. 동시 bust advisory 락+부분UNIQUE 이중 방어.
3. **재진입 카운터**: reentries++ 정확히 1회·max 초과 거부·동시요청 레이스(FOR UPDATE+advisory).
4. **live_stats 정합**: bust→playing 감소·average_stack, 재진입→복귀. 트리거 자동(소스 추가 불요) 검증.
5. **우승 자동확정 레이스**: 동시 bust로 생존 1 도달 시 단 1회만 확정(advisory 락). 이중 completed 전이 차단.
6. **prize 경계**: replace-all 소급 미반영·비-ITM NULL·ITM 스냅샷 시점.
7. **denormalized counter drift**(`pitfall_denormalized_counter_drift`): INSERT/UPDATE/DELETE 3경로+status 전이 enumerate.
8. **PREFIX_MAP 부분문자열 충돌**: 신규 prefix 배치 순서.

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
