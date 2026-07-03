# T-HOLDEM ops 1f — 잔여 상금 설계 (% 환산·풀곡선 템플릿·flat KO 바운티·정정/회수·bust 취소·LS DEFERRED)

- **작성일**: 2026-07-03 · **상태**: DESIGN v1 (브레인스토밍 승인 완료 — 사용자 결정 8개 반영)
- **브랜치**: `feat/ops-1f-prizes` (master `97a7bcaf6` 기반, 워크트리 `T-HOLDEM-ops-1f`)
- **선행**: 1a~1d(+STEP A)+배정 2종(#220) 전부 prod 출하. 권위 참조 = 1d 스펙 `2026-06-29-ops-1d-bust-reentry-itm-design.md`, 배정 스펙 `2026-06-30-ops-seat-assignment-design.md`, 원 설계 `docs/planning/2026-06-23-tournament-ops-revival-slice1-design.md` §8/§10(1f 행)
- **정찰 근거**: 2026-07-03 정찰 WF 6차원(5 성공) + prod 실측. **prod ops 전 테이블 0행** → 스키마·payload 변경 하위호환 부담 없음. advisor ERROR 0 · anon-executable SECDEF ops = monitor/player 2개(불변 계약)

---

## §0 확정 결정 (사용자, 2026-07-03)

| #   | 결정                                       | 내용                                                                                                                                                                                                     |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | % prize = **클라 환산(A안)**               | 서버 스키마 무변경(`ops_prizes`는 rank·amount 유지, pct 컬럼 없음). %·곡선은 클라 도메인 순수함수 + UI 도구. 저장은 기존 `ops_set_prize_structure(amount)` 그대로. "현재 풀 기준 재계산" 버튼으로 재적용 |
| D2  | bust 취소(undo) = **active 중에만**        | 우승 자동확정(→completed) 이후 undo 불가. completed→active 전이 신설하지 않음(상태머신 재개방 없음). 헤즈업 오탭은 미구제 — 의식적 수용                                                                  |
| D3  | 상금 정정/회수 = **completed 후에도 허용** | 개인 `prize_amount`만 조정(순위·상태 불변). 구조(`ops_prizes`) 변경은 기존대로 completed 차단 유지                                                                                                       |
| D4  | 바운티 = **flat KO만**                     | PKO(프로그레시브) 제외. 적립 = `knockouts × bounty_cost` 파생(적립 컬럼 없음)                                                                                                                            |
| D5  | 바운티 노출 = **최대 범위**                | 운영 화면(PLAYERS·PAYOUTS·STATUS) + 플레이어뷰 본인 KO/적립 + 전광판 KO POOL. anon 화이트리스트 각 1건 확장(비-PII·본인 한정)                                                                            |
| D6  | LS-데드락 = **DEFERRED 전환 동반**         | recompute를 어차피 수정(재진입 가산·knockout_pool)하므로 TODOS [MED] 항목을 이 슬라이스에서 해소                                                                                                         |
| D7  | UI = **풀 재설계**                         | PAYOUTS 2부(구조 편집기+페이아웃 대장) + 종료 결과 뷰(STATUS 탭 전환). **전광판 페이아웃 표는 제외**                                                                                                     |
| D8  | **단일 PR**                                | #220 패턴. SDD 3배치(DB토대→RPC→클라/UI). prod 게이트 1회                                                                                                                                                |

## §1 범위

**In**: ①% 입력·풀곡선 템플릿(클라 전용) ②`ops_undo_bust`(active 한정) ③`ops_correct_participant_prize`(completed 허용) ④flat KO(bust v2 eliminator·`knockouts` 컬럼·KO POOL 산출) ⑤recompute 확장+AFTER ROW→DEFERRED CONSTRAINT TRIGGER 전환+`ops_tournaments` 비용 트리거 신설 ⑥PAYOUTS 2부+종료 결과 뷰+bust 다이얼로그 v2 ⑦동반 수선: `ops_prizes` DML REVOKE·PayoutsTab rank 갭·`bounty_cost` 세팅 경로(create/update RPC)

**Out (YAGNI)**: PKO·전광판 페이아웃 표·칩 수동 수정 RPC·completed→active 일반 전이·`ops_prizes` 스키마 변경·부분딜(chop)·바운티 스냅샷 컬럼(중도 `bounty_cost` 변경 시 적립 표시가 소급 변동함을 수용·§12-E7)·ITM 인원 10 초과 곡선 템플릿(수동 편집 안내)

## §2 현재 상태 (실측 요약 — 1f가 딛는 계약)

- **스냅샷 모델**: `ops_prizes`는 구조(rank→amount)만. 지급 권위 = bust 시 복사되는 `ops_participants.prize_amount` + `prize_assigned` 이벤트. 구조 재저장은 기부여분에 소급하지 않음 (1d 스펙 §3.3)
- **우승 자동확정**: 마지막 1인 남으면 bust RPC가 fp=1·rank1 상금·대회 `completed` 자동 전이 (`20260630120100:126-148`)
- **completed = 종착**: `ops_set_tournament_status` 합법 전이에 completed→* 없음 (`20260625120200:168-175`)
- **재진입 리셋**: reenter가 fp/busted_at/prize_amount 일괄 NULL (`20260630120100:248-251`) — 정정 이력의 영속 원장은 `ops_events`뿐
- **prize_pool 현행식**: `entries×buy_in_cost + Σrebuys×rebuy_cost + Σadd_ons×addon_cost` — **재진입 buy-in 미가산**(1d 스펙이 1f로 명시 이관), fee/bounty 미포함 (`20260627100100:90-93`)
- **inert 기반**: `ops_tournaments.bounty_cost int NULL`(1a — 단 create/update RPC 패치 목록에 없어 **세팅 경로 부재**) · `ops_live_stats.knockout_pool int NULL`(1c — 기록 로직 0)
- **LS-데드락 [MED]**: live_stats AFTER ROW 트리거 5종이 `(P,S)→LS` vs bust `LS<{S,P_winner}` ABBA 순환(40P01) 표면. 자기치유·prod 0행 (1d 스펙 §14, TODOS)
- **락 불변식**: `advisory(hashtext('ops_tournament_'||id)::bigint) → 대회 FOR UPDATE → 참가자 FOR UPDATE → 좌석(id asc)` (1d) / reseat=좌석-우선 변형(동일 advisory 공유로 무해)
- **에러코드**: E6131까지 사용. **1f = E6132~**
- **이벤트 enum 18종**. ADD VALUE는 값을 쓰는 RPC와 **별도 txn(별도 마이그)** (1d 관례)
- **anon 계약**: anon-executable SECDEF = `ops_get_monitor_snapshot`·`ops_get_player_view` 2개만. 모니터=비-PII 집계, 플레이어뷰=본인 안전필드만

## §3 데이터 모델 변경 (additive)

### 3.1 컬럼

- `ops_participants.knockouts int NOT NULL DEFAULT 0 CHECK (knockouts >= 0)` — **이번 슬라이스 유일한 신규 컬럼**. 인덱스 불요(대회 내 소수 행·기존 (tournament_id,status) 인덱스로 충분)
- 신규 테이블 0. `ops_prizes` 무변경(D1)

### 3.2 이벤트 enum (별도 txn 마이그)

- `ALTER TYPE ops_event_type ADD VALUE IF NOT EXISTS 'player_bust_undone';`
- `ALTER TYPE ops_event_type ADD VALUE IF NOT EXISTS 'prize_corrected';`
- 클라 `EVENT_LABEL: Record<OpsEventType,string>`(HistoryTab)이 exhaustive → 타입 에러로 라벨 갱신 강제: `player_bust_undone: '탈락 취소'`, `prize_corrected: '상금 정정'`

### 3.3 `player_busted` payload 확장 (bust v2가 기록)

```jsonc
{
  "participant_id": "...",
  "finish_position": 7,
  "prize_amount": null,
  "chips_before": 41200, // 신규 — undo 복원 소스
  "eliminator_id": "... | null", // 신규 — flat KO
  "freed_seat_id": "... | null", // 신규 — undo 원좌석 복원 소스(bust 당시 점유 좌석, 무좌석 bust면 null)
}
```

prod 0행이라 구 payload 혼재 없음. 로컬은 db:reset으로 정합.

### 3.4 동반 수선

- `REVOKE INSERT, UPDATE, DELETE ON public.ops_prizes FROM anon, authenticated;` — 다른 ops 테이블과 동일한 방어심층(1d 누락분)

### 3.5 마이그 구성(4종, 기존 마이그 수정 금지)

1. `ops_1f_enum_and_knockouts` — enum 2값 + knockouts 컬럼 + ops_prizes REVOKE
2. `ops_1f_live_stats_deferred` — recompute 함수 교체(CREATE OR REPLACE) + 트리거 5종 DROP→CONSTRAINT TRIGGER 재생성 + ops_tournaments 트리거 신설 (§5)
3. `ops_1f_prize_rpcs` — bust v2(구 2인자 DROP→3인자 CREATE)·`ops_undo_bust`·`ops_correct_participant_prize`·create/update 확장 (§4) + **공개 스냅샷 RPC 확장 2종**(`ops_get_monitor_snapshot`에 knockoutPool·`ops_get_player_view`에 knockouts/bountyAccrued — CREATE OR REPLACE, 시그니처 불변이라 기존 anon GRANT 보존, §7.4)
4. `ops_1f_grants` — 신규/재정의 RPC `REVOKE PUBLIC,anon` + `GRANT authenticated,service_role`(1d 패턴. bust는 DROP→CREATE라 재GRANT 필수)

## §4 RPC 계약

공통: plpgsql SECURITY DEFINER · `SET search_path='public','extensions','pg_temp'` · actor 가드 `auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT is_admin())` → `PERMISSION_DENIED` · 멤버십 `is_ops_member OR is_admin` · 모든 P0001 메시지는 `접두사: 한글` 형식 · 이벤트 컬럼명은 **`type`**(#220 교훈).

### 4.1 `ops_bust_participant(p_participant_id uuid, p_actor_id uuid, p_eliminator_id uuid DEFAULT NULL)` — v2 교체

- **구 2인자 시그니처 명시 DROP**(STEP A D6 오버로딩 우회 차단 관례) 후 3인자 CREATE
- 기존 로직 전체 보존(가드 순서·finish_position 산정·ITM 매핑·좌석 해제·우승 자동확정·반환 형태). 변경분만:
  - **eliminator 가드**(참가자 락 이후): `p_eliminator_id IS NOT NULL`이면 ①자기 자신 금지 ②존재 + 같은 tournament_id(미존재·타대회 동일 처리) ③`status='active'` — 위반 시 `ELIMINATOR_INVALID`. NULL이면 KO 없이 진행(비-바운티 대회에서도 지정 가능 — 기록만 되고 적립 표시는 bounty_cost 유무로 게이트)
  - **참가자 행 잠금 복수 확장**: 대상·eliminator 2행을 **id 오름차순 FOR UPDATE**(락 불변식의 '참가자' 항을 단수→복수 일반화. 대상 status 검사는 잠금 후 기존 순서 유지 — 에러 메시지/순서 무회귀)
  - eliminator `knockouts = knockouts + 1`
  - `player_busted` payload에 `chips_before`(UPDATE 전 chips)·`eliminator_id`·`freed_seat_id`(해제한 좌석 id, 복수면 첫 좌석 — 단일점유 불변식상 실제 최대 1) 기록
- 락 순서: `advisory → 대회 → 참가자(id asc, 1~2행) → 좌석(id asc)` — LS 트리거는 §5로 DEFERRED화되어 커밋 시점 발화 → eliminator 행 추가 잠금이 LS-ABBA 표면을 넓히지 않음(설계 시너지)

### 4.2 `ops_undo_bust(p_participant_id uuid, p_actor_id uuid)` — 신규

- **목적**: 오조작 bust의 원상 복구. 재진입과 구분: reentries 불변·칩은 bust 직전 값 복원·registration_open 무관·KO 롤백
- **가드 순서**: actor → 비잠금 tournament_id 선취 → advisory → 대회 FOR UPDATE + `status='active'`(아니면 `INVALID_STATUS: 진행 중 대회에서만 탈락 취소가 가능합니다` — D2: 우승확정 후 completed면 여기서 차단) → 멤버십 → 참가자 FOR UPDATE + `status='busted'`(아니면 `UNDO_INVALID_STATE`)
- **복원 소스**: 해당 참가자의 **최신 `player_busted` 이벤트**(`WHERE tournament_id=.. AND type='player_busted' AND (payload->>'participant_id')::uuid = p_participant_id ORDER BY created_at DESC, id DESC LIMIT 1`). payload에서 `chips_before`(부재 시 0 — 이론상 불가, fail-safe)·`eliminator_id`·`freed_seat_id` 추출
- **변이**:
  1. 참가자: `finish_position=NULL, busted_at=NULL, prize_amount=NULL, chips=chips_before`
  2. eliminator_id 존재 시: 해당 행 FOR UPDATE(있으면) 후 `knockouts = GREATEST(knockouts-1, 0)` — CHECK 위반 방어. eliminator가 그 사이 busted여도 카운트만 감소(정합)
  3. **좌석 3분기**: ①`freed_seat_id` 좌석이 존재·비점유·테이블 open·lock_type='none' → 원좌석 복원 ②아니면 auto-seat(open·unlocked 테이블 첫 빈좌석 `SKIP LOCKED` — reenter와 동일 패턴, 단 `auto_seat_on_register` 설정과 무관하게 항상 시도: undo는 "물리적으로 앉아 있는 사람"의 복구) ③빈좌석 없으면 무좌석
  4. status: 좌석 확보=`active` / 무좌석=`checked_in`(register v2 관례 준수)
- **참가자·eliminator 잠금도 id 오름차순**(4.1과 동일 규약)
- 이벤트: `player_bust_undone` payload `{participant_id, restored_chips, eliminator_id, seat_restored: 'original'|'auto'|'none'}`
- 반환: `{participant_id, restored_chips, status, seated boolean, table_no int|null, seat_no int|null}`
- **비제약**: 최신 bust만이 아니라 **busted 상태인 누구든** undo 가능(active 중). undo 후 다음 bust의 fp는 기존 "생존수 이상 최소 미사용 순위" 산정이 자연 처리(부분 UNIQUE 무충돌) — 단 이력상 fp 순서가 시간순과 어긋날 수 있음을 수용(운영자 소유 데이터, §12-E4)

### 4.3 `ops_correct_participant_prize(p_participant_id uuid, p_actor_id uuid, p_amount int DEFAULT NULL, p_reason text DEFAULT NULL)` — 신규

- **목적**: 개인 지급액 정정(소급)·회수(D3). 순위·상태·구조 불변
- **가드 순서**: actor → 비잠금 tournament_id 선취 → advisory → 대회 FOR UPDATE + **`status IN ('active','completed')`**(upcoming이면 `INVALID_STATUS: 시작 전 대회에는 정정할 상금이 없습니다`) → 멤버십 → 참가자 FOR UPDATE + **`finish_position IS NOT NULL`**(정산 대상만: busted 또는 확정 우승자. 아니면 `PRIZE_CORRECTION_INVALID`) → 값 검증: `p_amount IS NOT NULL AND p_amount < 0` → `PRIZE_CORRECTION_INVALID` / `p_reason` 길이 >200 → `PRIZE_CORRECTION_INVALID`
- **시맨틱**: `p_amount NULL = 회수`(prize_amount→NULL, "수상 아님"으로 복귀), `0 이상 = 해당 값으로 설정`(기존 NULL이어도 부여 가능 — 비ITM자에게 수동 지급 포함)
- 변이: `prize_amount = p_amount` (no-op이어도 이벤트는 기록 — 감사 명료성)
- 이벤트: `prize_corrected` payload `{participant_id, amount_before, amount_after, reason}` (reason NULL 허용)
- 반환: `{participant_id, amount_before, amount_after}`
- **재진입 상호작용(의도 명시)**: 정정 후 해당 참가자가 reenter하면 prize_amount NULL 리셋(1d 계약 유지) — 정정 이력은 이벤트 원장에만 잔존

### 4.4 `ops_create_tournament` / `ops_update_tournament` — bounty_cost 패치 추가

- 두 RPC의 컬럼 목록에 `bounty_cost`(nullable) 추가. `NULL = 비-바운티 대회`(0과 구분: 0은 "바운티 개념은 있으나 단가 0" — UI는 NULL만 비-바운티로 취급, §7). 음수 거부(기존 비용 검증 패턴 준수)
- update는 CREATE OR REPLACE(시그니처 변화 없으면 재GRANT 불요 — 구현 시 시그니처 확인, 변하면 grants 마이그에 포함)

## §5 recompute 확장 + DEFERRED 전환 (D6)

### 5.1 `fn_ops_recompute_live_stats` 산식 변경 (CREATE OR REPLACE)

```
v_total_buyins   := entries + Σreentries                    -- 재진입=바이인 재지불
prize_pool       := v_total_buyins × COALESCE(buy_in_cost,0)
                  + Σrebuys  × COALESCE(rebuy_cost,0)
                  + Σadd_ons × COALESCE(addon_cost,0)
knockout_pool    := CASE WHEN bounty_cost IS NULL THEN NULL
                         ELSE v_total_buyins × bounty_cost END
```

- fee_cost는 계속 미포함(하우스 몫 — 기존 의도 유지). upsert INSERT 컬럼·ON CONFLICT UPDATE 목록에 `knockout_pool` 추가
- `knockout_pool NULL = 비-바운티 대회` → 클라 KO POOL 카드 숨김 신호(§7)

### 5.2 트리거 전환: AFTER ROW → CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED

- 기존 5종(`trg_ops_{participants,seats,tables,blind_levels,clock}_recompute_stats`) **DROP 후** 동일 이벤트·WHEN 조건으로 재생성:
  `CREATE CONSTRAINT TRIGGER ... AFTER INSERT OR UPDATE OR DELETE ON <tbl> DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_ops_live_stats_recompute_trigger();`
  (clock 트리거는 기존 `WHEN (OLD.current_level_sort IS DISTINCT FROM NEW.current_level_sort)` 유지 — CONSTRAINT TRIGGER도 WHEN 지원)
- **신설**: `trg_ops_tournaments_recompute_stats` — `AFTER UPDATE ON ops_tournaments` + `WHEN (산식 사용 4컬럼(buy_in_cost,rebuy_cost,addon_cost,bounty_cost) IS DISTINCT FROM 각각)` DEFERRED — 비용 config 변경 시 prize_pool/knockout_pool stale 창 해소(실측 갭). fee_cost는 recompute 미사용이라 WHEN 제외(불필요 발화 방지)
- **데드락 해소 논증**: DEFERRED로 LS 행 락 획득이 **항상 커밋 직전 최후** → 모든 트랜잭션에서 `{advisory, 대회, P, S} < LS` 전역 순서 성립 → `LS<{S,P}` 역전(bust) 및 `(P,S)→LS`(rebuy/addon/좌석/claim/redraw) ABBA 순환 근원 제거. TODOS [MED] 항목 해소로 기록
- **의미 변화와 무영향 확인**: ①커밋 시점 발화 = Realtime 구독자 가시성 동일(커밋 전 불가시) ②동일 txn 내 복수 행 변경 시 트리거가 행 수만큼 커밋 시 발화 — recompute는 멱등 풀 재계산이라 결과 동일(성능은 대회당 행 수 소규모로 수용, 중복 억제 최적화는 YAGNI) ③**ops RPC 중 자기 txn 안에서 live_stats를 읽는 곳 없음**(구현 시 `grep ops_live_stats supabase/migrations`로 전수 재확인 — 적대검증 항목)
- **pgTAP 이행 규약**: 단일 txn 테스트에서 live_stats를 단언하려면 단언 전 `SET CONSTRAINTS ALL IMMEDIATE;` 필요(이후 문장부터 즉시 발화). **기존 테스트 중 live_stats 단언 파일 전수 갱신**(최소: `ops_live_stats_recompute` · `ops_bust_participant`(playing 감소) · `ops_reseat_participants`(정합 단언) — 구현 시 grep 전수). 신규 테스트는 "DEFERRED 상태에선 stale·IMMEDIATE 전환 후 반영"을 RED-GREEN으로 실증(§10)

## §6 클라 도메인 — % 환산·풀곡선 (D1, 서버 무변경)

`src/domains/ops/prizeCurve/` 신설(순수함수·RNG 없음·부작용 없음):

### 6.1 `computeAmountsFromPercents(pool: number, percents: number[]): PrizeCurveResult`

- 불변식: **반환 amounts 합계 = pool 정확 일치**
- 알고리즘: 각 `floor(pool × pct/100 / unit) × unit`(unit=1,000) → 잔여(pool−합)를 **1위에 전액 가산**
- 강등 규칙: 1,000원 단위 결과에 0원 행이 생기면 unit=100으로 재시도 → 그래도 0원 행이면 `{ok:false, reason:'POOL_TOO_SMALL'}`(UI가 안내, RPC 미도달 — Zod amount≥1과 정합)
- percents 검증: 각 >0·합계 100±0.01 허용(부동소수 방어) — 위반 시 `{ok:false, reason:'INVALID_PERCENTS'}`

### 6.2 `recommendPayoutCurve(entries: number, itmRatio: 0.10|0.15|0.20): number[]`

- ITM 인원 = `max(1, min(10, ceil(entries × itmRatio)))` — **cap 10**(초과 구간은 수동 편집 안내, Out)
- 표준 곡선표(합계 100 고정, jest로 전 행 합계 단언):

| ITM | 곡선(%)                                                |
| --- | ------------------------------------------------------ |
| 1   | 100                                                    |
| 2   | 65 / 35                                                |
| 3   | 50 / 30 / 20                                           |
| 4   | 44 / 27 / 17 / 12                                      |
| 5   | 40 / 25 / 16 / 11 / 8                                  |
| 6   | 37 / 23 / 15 / 10 / 8 / 7                              |
| 7   | 35 / 22 / 14 / 10 / 8 / 6 / 5                          |
| 8   | 33.5 / 21 / 13.5 / 9.5 / 7.5 / 6 / 5 / 4               |
| 9   | 32 / 20 / 13 / 9.5 / 7.5 / 6 / 5 / 4 / 3               |
| 10  | 31 / 19.5 / 12.5 / 9 / 7 / 5.5 / 4.75 / 4 / 3.5 / 3.25 |

- 저장 경로는 **기존 그대로**: 환산된 amounts → `prizeStructureSchema` → `ops_set_prize_structure`. 서버는 %를 모름

## §7 UI/UX (D5·D7)

### 7.1 PAYOUTS 탭 재설계 — 2부 구성 (파일 분리: 컨테이너 `PayoutsTab` + `PayoutStructureEditor` + `PayoutLedger`, 200~400줄 규칙)

- **(A) 구조 편집기** `PayoutStructureEditor.tsx`:
  - 모드 토글: `금액 | %` 세그먼트. % 모드는 percents 로컬 상태 + 현재 풀(`liveStats.prizePool`) 기준 환산 미리보기(행별 원화 병기)
  - **템플릿**: "템플릿 추천" 버튼 → `SelectBottomSheet`(ITM 10/15/20% × 현재 entries) → `recommendPayoutCurve` 적용
  - **"현재 풀 기준 재계산"** 버튼(% 모드): liveStats.prizePool 재환산(D1의 C안 가치 흡수)
  - **행 삭제 버튼**(각 행 우측) + 삭제/추가 시 **rank 1..N 연속 재부여**(기존 rank 갭 결함 해소 — 저장 payload는 항상 연속)
  - 풀 대비 바: `합계 / 현재 풀 / 잔여` 3값 + 합계>풀 경고색(저장은 차단하지 않음 — 풀은 참고치라는 1d 의도 유지, 경고만)
  - 저장: 기존 `useSetPrizeStructure` 그대로. 진행 중(active) 저장 시 `ConfirmModal` "이미 탈락한 참가자에게는 소급되지 않아요" 안내(LEVELS의 진행 중 편집 가드와 동형)
- **(B) 페이아웃 대장** `PayoutLedger.tsx`:
  - 데이터: `useOpsPrizes`(구조) + `useOpsParticipants`(fp·prize_amount·knockouts) 클라 조인 — rank별 `수상자 이름(fp=rank인 참가자)·구조 금액·실지급(prize_amount)·정정 여부(구조≠실지급 하이라이트)`
  - **바운티 섹션**(bounty_cost NOT NULL인 대회만): KO 보유자 목록 `이름 · KO n · 적립 n×bounty_cost` + 합계
  - 행 탭 → **정정 시트** `PrizeCorrectSheet`(BottomSheet): 현재 금액 표시·새 금액 입력(number-pad)·[회수](destructive, amount NULL)·사유 입력(선택, 200자·Zod xss) → `ops_correct_participant_prize`. completed 후에도 동작(D3)
- 빈 상태·다크 토큰·min-h-[44px]·토스트 관례는 기존 준수(정찰 §9 관례 목록)

### 7.2 PLAYERS 탭

- **bust 다이얼로그 v2**: 비-바운티 대회 = 기존 `Alert.alert` 유지. **바운티 대회**(bounty_cost NOT NULL) = `SelectBottomSheet` "누가 눌렀나요?"(active 참가자 목록 + '지정 안 함') → 확인 → `bustParticipant(participantId, eliminatorId?)`
- busted 행: **"탈락 취소"** 액션(대회 active일 때만 노출) → `Alert.alert` destructive 확인 → `ops_undo_bust` → 성공 토스트 "탈락 취소됨 · 칩 {n} 복원"
- active 행: KO 배지 `KO {n}`(바운티 대회 && n>0)

### 7.3 종료 결과 뷰 (Alert 증발 해소)

- 신규 라우트 없음. `[id].tsx` STATUS 탭이 `tournament.status==='completed'`일 때 클럭 카드 대신 **`TournamentResultCard`** 렌더: 🏆 우승자(이름·상금) · 최종 순위표(fp asc, 상금 병기) · 정산 요약(총 풀·지급 합계·KO 풀·엔트리/재진입 수)
- PAYOUTS 대장은 completed 후에도 정정 진입점으로 상시 동작

### 7.4 STATUS·공개 표면

- `LiveStatsPanel`: **KO POOL 카드**(knockoutPool != null일 때만 — 카드 9→조건부 10)
- **전광판**: `ops_get_monitor_snapshot` 반환 stats에 `knockoutPool` 추가(집계치·비-PII — 화이트리스트 심사: 개인 식별 불가, 승인) → 통계 스트립 조건부 카드
- **플레이어뷰**: `ops_get_player_view` 반환 `me`에 `knockouts`·`bountyAccrued`(서버 계산 `knockouts × bounty_cost`, 비-바운티면 null) 추가(본인 행 한정 — 화이트리스트 심사: 본인 데이터, 승인) → 내 카드에 "KO n · 바운티 적립 n원"
- **생성/수정 폼**(`new.tsx` 등): 칩/정산 섹션에 "바운티(선택)" 입력 — 빈 값=NULL(비-바운티)

### 7.5 데이터 레이어 배선

- Repo: `OpsParticipantRepository.bustParticipant`에 `eliminatorId?` 파라미터 / `undoBust`·`correctPrize` 신규 메서드(+인터페이스) — snake→camel 수동 매핑(1d data-1 관례)
- Service: `opsParticipantService`에 undo/correct 위임 + correct는 Zod 경계검증(`prizeCorrectionSchema`: amount int ≥0 nullable·reason ≤200·xssValidation)
- Hooks: `useUndoBust`(invalidate: participants·seats·liveStats) / `useCorrectPrize`(invalidate: participants) / bust 훅 시그니처 확장. 공개 뷰 2종은 자체 폴링이라 invalidate 무관(1d data-3)
- supabase.ts **수술적 추가**(전체 재생성 금지): knockouts 컬럼·RPC 3종 시그니처·enum 2값(**Enums 3186대 + Constants 미러 3381대 두 곳**)

## §8 에러코드·이벤트

| 코드  | 상수명                       | 한글 메시지                              | RPC 접두사                 |
| ----- | ---------------------------- | ---------------------------------------- | -------------------------- |
| E6132 | OPS_ELIMINATOR_INVALID       | 넉아웃 상대가 올바르지 않아요.           | `ELIMINATOR_INVALID`       |
| E6133 | OPS_UNDO_INVALID_STATE       | 탈락 취소를 할 수 없는 상태예요.         | `UNDO_INVALID_STATE`       |
| E6134 | OPS_PRIZE_CORRECTION_INVALID | 상금 정정 대상이나 값이 올바르지 않아요. | `PRIZE_CORRECTION_INVALID` |

- 대회 상태 위반은 기존 `INVALID_STATUS` prefix(E6102) 재사용(undo의 completed 차단·correct의 upcoming 차단)
- `opsRpcError.ts` PREFIX_MAP 3엔트리 + `AppError.ts` 코드·메시지 + `opsRpcError.test.ts` 케이스 추가
- 이벤트 신규 2종(§3.2). 기존 `prize_assigned`·`prize_structure_set` 시맨틱 불변

## §9 보안·권한 계약 (불변 + 확장 2건)

- 신규 RPC 전부 `REVOKE PUBLIC, anon` + `GRANT authenticated, service_role`(1d grants 패턴). **anon-executable SECDEF ops = monitor/player 2개 유지**(prod 게이트에서 advisor·`has_function_privilege` 재실측)
- anon 반환 확장 2건의 화이트리스트 심사: ①monitor `knockoutPool` = 대회 집계치(비-PII, prize_pool과 동급) ②player `knockouts`/`bountyAccrued` = 본인 행 파생(타 참가자 정보 없음). **타인 KO 순위표·개인별 상금표는 anon 표면에 추가하지 않음**(D7의 전광판 페이아웃 표 제외와 일관)
- `p_reason`은 이벤트 payload에만 저장(공개 표면 미노출)·클라 xssValidation + 서버 길이 가드

## §10 테스트 계획 (RED-GREEN 필수·무위 시드 금지 — #220 교훈)

### pgTAP (신규 4파일 + 기존 갱신)

1. `ops_bust_eliminator.test.sql` — eliminator 가드 4종(자기·미존재·타대회·비active)·knockouts 증가·payload 3필드(chips_before/eliminator_id/freed_seat_id)·NULL eliminator 무영향·구 2인자 시그니처 소멸 단언(E10)·actor 가드
2. `ops_undo_bust.test.sql` — 복원 4필드(chips=bust 직전 값·fp/busted_at/prize NULL)·좌석 3분기(원좌석/auto-seat/무좌석→checked_in)·KO 감소·GREATEST 0 방어·completed 거부(우승 자동확정 시나리오로 실증)·비busted 거부·undo 후 재bust의 fp 미사용 최소값 정상·이벤트 append·actor 가드
3. `ops_prize_correction.test.sql` — active/completed 양쪽 허용·upcoming 거부·fp NULL 거부·NULL 회수·비ITM자 부여·음수 거부·reason 201자 거부·no-op도 이벤트 기록·amount_before/after payload·reenter가 정정값 리셋(계약 실증)·actor 가드
4. `ops_live_stats_deferred.test.sql` — **DEFERRED RED-GREEN**: 참가자 변이 후 같은 txn에서 live_stats stale 단언 → `SET CONSTRAINTS ALL IMMEDIATE` 후 반영 단언 · 재진입 가산(reenter 후 prize_pool = (entries+reentries)×buy_in 검증) · knockout_pool 계산·비-바운티 NULL · tournaments 비용 변경 트리거 발화
5. 기존 파일 갱신: live_stats 단언하는 전 파일에 `SET CONSTRAINTS ALL IMMEDIATE` 삽입(구현 시 grep 전수 — 최소 ops_live_stats_recompute·ops_bust_participant·ops_reseat_participants)
6. grants: 신규 RPC anon EXECUTE 거부 3종(기존 ops_rpc_security 패턴)

### jest

- `prizeCurve` — 합계=풀 불변식(property 스타일: 다양한 pool×곡선 전수)·1,000→100 강등 경계·POOL_TOO_SMALL·INVALID_PERCENTS·곡선표 10행 합계 100·ITM cap·entries 경계(1명·0명)
- `opsRpcError` 신규 3 prefix 매핑
- 스키마: `prizeCorrectionSchema`(음수·201자·xss)
- UI 로직 테스트 가능 범위(rank 연속 재부여·% 환산 표시)

### 검증 명령(불변)

`npm run db:reset && npm run test:db:helpers && npx supabase test db` · `npx tsc --noEmit` · `npx jest` · `npm run quality`

## §11 파이프라인·출하 게이트 (D8 단일 PR)

1. 본 스펙 → `superpowers:writing-plans` 계획(태스크 분해)
2. **적대검증 WF**(7차원 — 락/동시성·보안(anon 표면)·데이터 정합(스냅샷·리셋)·에러 매핑·pgTAP 무위·UI 배선·스펙-계획 diff, verify 신선 세션 완주)
3. SDD 3배치(implementer + 배치별 리뷰 + 최종 whole-branch opus): **B1** DB 토대(마이그 1·2 + pgTAP 4·5) → **B2** RPC(마이그 3·4 + pgTAP 1~3·6 + supabase.ts 수술) → **B3** 클라(도메인·스키마·repo/service/hook·UI 6종)
4. 전 검증 GREEN 증거 → **prod 게이트(사용자 "go")**: MCP apply_migration 4종 → get_advisors(ERROR 0·anon SECDEF 2개 유지) → supabase.ts MCP gen 정합 확인(수술본과 diff) → push + PR → CI 9종 → squash
5. SDD 가드: implementer 브랜치 생성/전환 금지 · `mcp__supabase__*` 서브에이전트 금지(로컬 docker/npm만) · 기존 마이그 수정 금지

## §12 리스크·엣지케이스 (적대검증 우선 타깃)

- **E1 DEFERRED 가시성**: ops RPC가 자기 txn에서 live_stats를 읽지 않음을 전수 실측(grep). 위반 발견 시 해당 RPC는 `fn_ops_recompute_live_stats` 직접 호출로 전환
- **E2 undo 이벤트 소스 의존**: chips_before가 이벤트 payload에만 존재 — bust v2 이전 데이터엔 없음(prod 0행·로컬 reset으로 무해). payload 파싱 실패는 COALESCE 0 fail-safe
- **E3 undo↔bust 동시성**: 동일 advisory 키로 전 쓰기 직렬화 — 우승 자동확정 직전 undo 경합도 advisory가 순서 강제(자동확정 먼저면 대회 completed→undo 거부, undo 먼저면 active 3인 복귀)
- **E4 fp 시간순 어긋남**: 과거 bust undo 후 재bust 시 fp가 시간순과 불일치 가능 — 수용(부분 UNIQUE 무충돌·운영자 소유). 스펙 명시로 적대검증 오탐 방지
- **E5 correction↔reenter**: 정정값이 reenter로 소실 — 1d 리셋 계약 유지(이벤트 원장 잔존). UI 대장에서 reenter 후 행은 정정 하이라이트 해제됨
- **E6 라운딩**: 합계=풀 불변식이 잔여 1위 가산으로 보장 — 1위 금액이 곡선 %보다 커지는 왜곡은 최대 (N−1)×unit(수용·표시로 명시)
- **E7 bounty_cost 중도 변경**: 적립=파생이라 표시 소급 변동 — 수용(Out에 스냅샷 컬럼 YAGNI 기록). update RPC는 음수만 차단
- **E8 enum ADD VALUE**: 별도 txn 마이그 필수(같은 txn 사용 시 55P04) — 마이그 1에서 값만, 마이그 3에서 사용
- **E9 CONSTRAINT TRIGGER 제약**: plain table·AFTER ROW만 지원 — 대상 5+1 테이블 전부 plain·기존 트리거도 AFTER ROW라 무충돌. `UPDATE OF` 컬럼 목록 대신 WHEN 절 사용(기존 clock 트리거 방식 통일)
- **E10 bust v2 시그니처 교체**: 구 2인자 DROP 누락 시 오버로딩 모호성(PostgREST 400) — DROP 명시 + pgTAP에서 2인자 호출 실패 단언

## §13 메모/후속

- 배정 2종 fast-follow 3건(TODOS: reseat Zod 런타임 배선·pgTAP 주석·비-uuid 선검증)은 **이 슬라이스에 미포함**(별도 소규모 PR 유지) — 단 LS-데드락 항목은 D6로 해소되므로 TODOS에서 완료 처리
- (ops) 앱 내 진입 동선 부재(탭/메뉴 링크 0)는 1f 범위 밖 — 1e 또는 별도 UX 슬라이스 후보로 기록
- 칩 수동 수정 RPC 부재(K-Holdem 'Player Changed Chips' 패리티 갭)는 별도 후속 — undo의 칩 복원과 무관함을 명시
