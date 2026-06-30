# T-HOLDEM ops 배정 2종 — 랜덤 배정 / 칩 드래프트(전원 재배치) 설계 스펙

> 작성: 2026-06-30 · 슬라이스 = 설계 §10 "1d 배정 2종"(1d에서 bust/재진입/ITM만 구현, 배정 2종은 미구현 → 본 슬라이스)
> 토대: 1a~1d(+STEP A) 전부 prod 출하 · 1b 좌석/redraw 표면 위에 얹음
> 권위 명세: `docs/planning/2026-06-23-tournament-ops-revival-slice1-design.md` §10(슬라이스 표)·§4.3(좌석)
> 핸드오프: `docs/planning/2026-06-30-ops-remaining-slices-design-handoff-prompt.md`

## 0. 결론 (한 줄)

활성/대기(active+checked_in) 참가자를 **현재 열린 좌석 풀에 전원 재배치**하는 두 알고리즘(랜덤·칩 드래프트)을 추가한다. 둘 다 **클라이언트 순수함수가 배정을 계산→미리보기→서버 확정 RPC가 TOCTOU로 적용**하는 1b redraw 패턴을 재사용하며, 동시성 하드로직은 신규 RPC `ops_reseat_participants` 1곳에 집중한다. 신규 테이블 0·신규 트리거 0(live_stats 자동)·신규 RPC 1종·신규 순수함수 3개.

## 1. 범위 경계 (사용자 결정 반영)

| 구분        | 본 슬라이스 포함                                                                  | 후속(YAGNI)                                    |
| ----------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| 재배치 대상 | **전원 재배치(true redraw)** — 좌석 이동 포함                                     | 단일 테이블 내 좌석만 섞기(특정 테이블 스코프) |
| 대상 풀     | **active + checked_in**(busted/no_show 제외), 재배치 후 전원 active 승급          | active만 좁히기 모드                           |
| 테이블 구성 | **현재 open·unlocked 좌석 풀에만 배정** — 테이블 추가/마감은 운영자가 1b로 선조정 | 알고리즘이 테이블 개수/빈테이블 자동 마감      |
| 랜덤 배정   | 전 빈좌석 균일 랜덤(테이블+좌석)                                                  | —                                              |
| 칩 드래프트 | **테이블 배정=칩 스네이크, 좌석=랜덤**(2단계)                                     | 분산 최소화 최적화                             |

확정 결정 이력: ①전원 재배치(좌석 이동 포함) ②테이블 구성=현재 열린 좌석만(1b 경계 유지) ③칩 드래프트=스네이크 버킷+랜덤 좌석 ④접근법 A(통합 확정 RPC + 클라 순수 알고리즘).

## 2. 데이터 (스키마) — ALTER 0

신규 테이블/컬럼/enum **없음**. 1b의 `ops_tables`(status open/closed/standby, lock_type none/locked/feature)·`ops_seats`(partial UNIQUE `uniq_ops_seats_participant ON (tournament_id, participant_id) WHERE participant_id IS NOT NULL`)·`ops_participants`(status, chips)를 그대로 사용.

- 적격 테이블 = `status='open' AND lock_type='none'`(closed/standby/locked 전부 제외 — 1b redraw/move와 동일 규약).
- 이벤트 타입 `table_redraw`는 1a enum에 이미 존재(payload만 `mode` 확장) — **enum ALTER 불필요**.

## 3. 순수 알고리즘 3종 (`src/domains/ops/seatAssignment/`)

기존 `waitlistFill.ts`(`computeWaitlistFill`) 옆에 형제로 추가, `index.ts` 배럴 합류. **모두 순수함수**(부수효과 0, `Math.random` 직접호출 금지 — RNG 주입).

### 3.1 공통 입력/출력 타입

```ts
interface ReseatInput {
  tables: { id: string; status: OpsTableStatus; lockType: OpsTableLockType }[];
  seats: { id: string; tableId: string; seatNo: number; participantId: string | null }[];
  players: { id: string; chips: number }[]; // 대상 풀(active+checked_in)
  rng: () => number; // 주입형 [0,1) — 호출부가 생성·주입
}
interface SeatAssignment {
  participantId: string;
  seatId: string;
} // 각 플레이어 → 목표 좌석
type ReseatResult =
  | { ok: true; assignments: SeatAssignment[] }
  | { ok: false; reason: 'INSUFFICIENT_SEATS'; available: number; required: number };
```

- **적격 좌석** = `tables.status='open' && lockType='none'` 테이블에 속한 좌석 전체(점유/빈 무관 — 전원 재배치라 기존 점유자도 풀에 포함되어 다시 배정됨). 단 **목표로 쓸 수 있는 좌석**은 그 적격 좌석 전부(재배치 후 풀 플레이어가 채움).
- `players.length > 적격좌석수` → `{ok:false, INSUFFICIENT_SEATS}`(클라 사전 차단; 서버도 재검증).

### 3.2 `seatWithinTable(buckets, rng)` — 공유 2단계

각 테이블 버킷(테이블별 배정된 플레이어 목록)을, 그 테이블의 적격 좌석(seatNo asc 안정정렬)에 **Fisher-Yates로 좌석 배열 셔플 후 1:1 매칭**. 결정적이려면 동일 rng 시퀀스 → 동일 결과. 반환 = `SeatAssignment[]`.

### 3.3 `randomDraw(input)` — 균일 랜덤

1. 적격 좌석 전체를 모아 Fisher-Yates 셔플(rng).
2. `players`(입력 순서)와 셔플된 좌석을 앞에서부터 1:1 매칭. (= 테이블·좌석 모두 균일 랜덤, capacity 자동 준수.)
3. 좌석 수 ≥ players → 남는 좌석 빈 채로. players > 좌석 → INSUFFICIENT_SEATS.

### 3.4 `chipDraft(input)` — 칩 스네이크 + 랜덤 좌석

1. `players`를 `chips` **내림차순** 정렬(동점 tie-break = `id` 오름차순, 결정적).
2. 적격 테이블 목록 T(테이블별 빈 적격좌석 수 = capacity). **스네이크 순서**(t0,t1,…,tN,tN,…,t1,t0,…)로 플레이어를 테이블 버킷에 배정하되 **capacity 찬 테이블은 스킵**. 모든 플레이어 배정될 때까지 순회.
3. 각 테이블 버킷 → `seatWithinTable`(랜덤 좌석).
4. 총 capacity < players → INSUFFICIENT_SEATS.

> 칩 균형 성질: 스네이크는 가장 큰 스택을 각 테이블에 1개씩 라운드로빈으로 깔아 테이블 칩합 분산을 자연 최소화(표준 토너먼트 칩 드래프트). 좌석 번호는 랜덤이라 물리적 위치 예측 불가.

### 3.5 RNG 주입

순수성·테스트·미리보기 일관을 위해 `rng`는 인자. 호출부(hook/UI)에서 `Math.random` 기반 생성기를 만들어 주입(순수함수 내부엔 비결정 호출 0). **미리보기=한 번 생성된 배정을 그대로 confirm**(재생성 시 "다시 계산" 버튼) → 미리보기↔확정 재현 문제 없음(배정 자체가 페이로드).

## 4. 확정 RPC `ops_reseat_participants`

공통 규약(1a/1b/1d 골격): `LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions','pg_temp'`.

### 4.1 시그니처

```
ops_reseat_participants(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_assignments jsonb,   -- [{"participant_id":uuid,"seat_id":uuid}, ...] 전 풀 플레이어 목표좌석
  p_mode text            -- 'random_draw' | 'chip_draft'
) RETURNS jsonb          -- {moved:int, seated:int, mode:text}
```

### 4.2 잠금 순서 불변식 (1d와 통일 — 데드락 회피)

`advisory(대회) → 대회 FOR UPDATE → 참가자 FOR UPDATE(id asc) → 좌석 FOR UPDATE(id asc)`. bust/reenter와 **동일 advisory 키** `hashtext('ops_tournament_'||p_tournament_id::text)::bigint`로 reseat·bust·reenter 상호 직렬화 → 동시 재배치/탈락 레이스 제거.

### 4.3 절차

1. **actor 가드**: `auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT is_admin())` → `PERMISSION_DENIED`.
2. **mode 검증**: `p_mode NOT IN ('random_draw','chip_draft')` → `INVALID_REDRAW_MODE`.
3. **assignments 파싱·구조 검증**(`jsonb_array_elements`): 비어있음/참가자 중복/좌석 중복/`participant_id`·`seat_id` NULL·비-uuid → `SEAT_ASSIGNMENT_INVALID`. 참가자 수 == 좌석 수.
4. **advisory xact 락** → **대회 `SELECT status FROM ops_tournaments WHERE id=p_tournament_id FOR UPDATE`**(NOT FOUND → `TOURNAMENT_NOT_FOUND`). `status='completed'` → `INVALID_STATUS`(종료 대회 재배치 금지). is_ops_member(p_tournament_id, p_actor_id) OR is_admin() → 아니면 `PERMISSION_DENIED`.
5. **참가자 잠금·가드**(id asc): 배정된 모든 participant를 `SELECT ... FROM ops_participants WHERE tournament_id=p_tournament_id AND id = ANY(v_pids) ORDER BY id FOR UPDATE`. (a)존재·동일대회 수 일치(아니면 `PARTICIPANT_NOT_FOUND`) (b)전원 `status IN ('active','checked_in')`(busted/no_show 섞이면 `PARTICIPANT_NOT_ACTIVE` — TOCTOU: 동시 bust 적발).
6. **좌석 잠금**(id asc): 관여 좌석 = 목표 좌석 ∪ 풀 플레이어 현재 점유 좌석 = `SELECT id, participant_id FROM ops_seats WHERE tournament_id=p_tournament_id AND (id = ANY(v_seat_ids) OR participant_id = ANY(v_pids)) ORDER BY id FOR UPDATE`.
7. **좌석 가드**(목표 좌석별): (a)존재·동일대회(아니면 `SEAT_ASSIGNMENT_INVALID`) (b)소속 테이블 `status='open' AND lock_type='none'`(아니면 `TABLE_NOT_OPEN`) (c)**현재 점유자가 NULL이거나 풀 참가자**(외부인이 동시 착석 → `SEAT_VERSION_CONFLICT`. 미리보기 이후 보드 변경 적발).
8. **좌석 수 일관**: 참가자 수 == 목표 좌석 수는 §4.3-3 구조 검증으로 보장. **`INSUFFICIENT_SEATS`(풀 인원 > 적격 빈좌석)는 클라 순수함수(§3)·미리보기 단계 오류**이며 RPC는 완성된 배정만 받으므로 raise하지 않는다. **부분 배정도 허용**(배정에 없는 참가자는 좌석 유지 — 미래 "특정 테이블" 스코프 토대). RPC는 '주어진 배정의 원자적 적용'에 집중.
9. **전원 비우기**: `UPDATE ops_seats SET participant_id=NULL WHERE tournament_id=p_tournament_id AND participant_id = ANY(v_pids)`. (풀 플레이어 현재 좌석 전부 vacate → partial UNIQUE 충돌 회피.)
10. **목표 앉히기**: 각 `{seat_id, participant_id}` → `UPDATE ops_seats SET participant_id=v_pid WHERE id=v_seat_id`. (9 이후라 어떤 풀 플레이어도 좌석 미보유 → 단일점유 충돌 불가.)
11. **승급**: `UPDATE ops_participants SET status='active' WHERE tournament_id=p_tournament_id AND id = ANY(v_pids) AND status='checked_in'`. (active는 불변.)
12. **이벤트**: `ops_events` 1행 `table_redraw {mode:p_mode, moved, seated}`. moved=좌석 점유 변경 수, seated=checked_in→active 승급 수.
13. **반환**: `jsonb_build_object('moved', v_moved, 'seated', v_seated, 'mode', p_mode)`.
14. **live_stats**: 9~11의 `ops_seats`/`ops_participants` 변경 → 기존 AFTER 트리거 `trg_ops_{seats,participants}_recompute_stats` 자동 재계산(playing/total_chips/seats_free 정합). **신규 트리거 0**.

### 4.4 권한 (grants) — 마이그 M3

1a DO 루프: `REVOKE EXECUTE ON FUNCTION ops_reseat_participants(...) FROM PUBLIC, anon; GRANT ... TO authenticated, service_role`. anon 노출 금지(monitor/player 2개만 anon-executable 유지). prod apply 후 `get_advisors`로 function_search_path_mutable·anon grant 회귀 0 확인.

## 5. 에러 매핑

### 5.1 신규 prefix → AppError (E6128 다음 = E6129~)

| prefix                    | code                                  | 한글 메시지                             |
| ------------------------- | ------------------------------------- | --------------------------------------- |
| `SEAT_ASSIGNMENT_INVALID` | `OPS_SEAT_ASSIGNMENT_INVALID='E6129'` | 좌석 배정 정보가 올바르지 않아요.       |
| `INSUFFICIENT_SEATS`      | `OPS_INSUFFICIENT_SEATS='E6130'`      | 빈 좌석이 부족해 전원을 앉힐 수 없어요. |
| `INVALID_REDRAW_MODE`     | `OPS_INVALID_REDRAW_MODE='E6131'`     | 지원하지 않는 배정 방식이에요.          |

- 기존 재사용: `SEAT_VERSION_CONFLICT`(E6109, 동시 변경)·`TABLE_NOT_OPEN`(E6113)·`PARTICIPANT_NOT_ACTIVE`(동시 bust)·`PARTICIPANT_NOT_FOUND`·`TOURNAMENT_NOT_FOUND`·`INVALID_STATUS`·`PERMISSION_DENIED`.
- ⚠️**`INSUFFICIENT_SEATS`(E6130)는 클라 순수함수(§3) 신호** — UI가 미리보기 단계에서 직접 AppError 생성. **RPC RAISE prefix 아님**(PREFIX_MAP 등록 불요). RPC가 raise하는 신규 prefix는 `SEAT_ASSIGNMENT_INVALID`·`INVALID_REDRAW_MODE` 2개뿐.
- ⚠️PREFIX*MAP substring 순서: `SEAT_ASSIGNMENT_INVALID`를 `SEAT*\*`(SEAT_TAKEN/SEAT_VERSION_CONFLICT 등)와 무충돌 확인(접두사 includes 매칭). 구체 토큰 우선 배치 규약 준수.

## 6. 데이터레이어·UI (Presentation→Hooks→Service→Repository→Supabase)

### 6.1 Repository / Service / Hook

- `OpsSeatRepository.reseatParticipants(tournamentId, actorId, assignments, mode): Promise<{moved, seated, mode}>` — `supabase.rpc('ops_reseat_participants', {...})` → error면 `mapOpsRpcError`, snake→camel 수동 매핑(RPC 반환은 SELECT 행 아님 — 1d data-1 교훈).
- `opsSeatService.reseatParticipants` 얇은 위임 + `handleServiceError`.
- `useReseatParticipants`(useOpsMutations): onSuccess 무효화 = `queryKeys.ops.seats`+`participants`+`liveStats`. 공개 monitor/player뷰는 자체 폴링이라 무효화 무관(1d data-3).

### 6.2 순수함수 ↔ Zod

- `opsSeat.schema.ts`에 `reseatAssignmentsSchema`(`z.array(z.object({participantId: uuid, seatId: uuid})).min(1)` + 참가자/좌석 중복 refine) + `reseatModeSchema`(`z.enum(['random_draw','chip_draft'])`). 클라가 RPC 호출 전 검증.

### 6.3 UI — TABLES 탭 (`src/components/ops/TablesTab.tsx` + `RedrawModal.tsx` 패턴)

- 기존 **Redraw 버튼**(목록 헤더)을 **모드 선택**으로 확장: `빈자리 채움`(기존 waitlist_fill) / `랜덤 배정` / `칩 드래프트`. (SelectBottomSheet 또는 세그먼트.)
- 선택 시 해당 순수함수로 배정 계산 → **`RedrawModal` 미리보기**(before→after, "다시 계산"=rng 재생성, "확인"=`reseatMut.mutate`). INSUFFICIENT_SEATS면 모달에 안내(확인 비활성).
- 빈 상태/로딩=기존 스켈레톤·dark: 토큰 재사용. 파괴적 동작(전원 재배치)이므로 **확인 다이얼로그**(impeccable 룰11/12) + 결과 토스트(`{moved}명 재배치`).

## 7. 마이그레이션 순서 (additive, 신규 파일 2종)

1. `2026xxxx_ops_seat_assignment_reseat_rpc.sql` — `ops_reseat_participants` RPC.
2. `2026xxxx_ops_seat_assignment_grants.sql` — 신규 RPC grants(DO 루프, anon REVOKE).

- 테이블/enum ALTER 0(신규 파일에 DDL 없음, RPC+grants만).
- ⚠️로컬: `npm run db:reset`(마이그 재구성→ops_helpers 소거) 후 `npm run test:db:helpers` 재적재. MCP `apply_migration`은 **prod 전용**(SDD 서브에이전트 금지).
- ⚠️**환경 드리프트**: prod에 staff_management(+weekly_grid는 #219로 master 머지됨) 마이그가 로컬보다 앞설 수 있음 — 착수 시 `list_migrations`로 재확인, supabase.ts는 수술적 추가.

## 8. 테스트

### 8.1 pgTAP (`supabase/tests/*.test.sql`, 단일 txn)

`ops_reseat_participants.test.sql`:

1. 랜덤: active+checked_in 전원 1좌석 배정·중복좌석 0·busted/no_show 제외.
2. 칩 스네이크: 테이블 칩합 균형(최대 편차 ≤ 최대 스택)·전원 배정.
3. **전 순열 재배치 → 23505 미발생**(전원 비우기→앉히기로 partial UNIQUE 무위반).
4. checked_in→active 승급·active 불변.
5. TOCTOU: 동시 bust된 풀 참가자 → `PARTICIPANT_NOT_ACTIVE`.
6. TOCTOU: 외부인 점유 목표좌석 → `SEAT_VERSION_CONFLICT`.
7. 좌석 부족 → `INSUFFICIENT_SEATS`(직접 INSERT로 인원>좌석 시드).
8. 적격성: closed/standby/locked 테이블 목표 → `TABLE_NOT_OPEN`.
9. actor 가드 3종(위조/비멤버) → `PERMISSION_DENIED`.
10. 종료 대회 → `INVALID_STATUS`.
11. 구조 무효(중복 참가자/좌석·빈 배정) → `SEAT_ASSIGNMENT_INVALID`.
12. live_stats playing/total_chips 재배치 후 정합(트리거 자동).
13. 이벤트 `table_redraw {mode}` 1행 append.

- ⚠️다중 시드: 1d에서 추가한 `ops_test_seed_players(t_id, n)` 재사용(없으면 postgres role 직접 INSERT). 단일 txn이라 실동시성 미검증 → 순차 거부·23505만, 동시성은 코드리뷰+적대검증.

### 8.2 jest (순수 알고리즘)

- `seatAssignment/__tests__`: randomDraw(전원 배정·capacity 준수·적격좌석 한정·seeded 결정성)·chipDraft(스네이크 칩균형·tie-break 결정성·seatWithinTable 랜덤)·INSUFFICIENT_SEATS 신호·엣지(0명·1테이블·정확히 인원==좌석).
- 에러매핑 단위(opsRpcError 신규 prefix→code)·스키마(reseatAssignments 중복 refine reject).

## 9. 회귀 주의 (적대검증·pgTAP 필수 커버)

1. **partial UNIQUE 단일점유**: 전원 비우기→앉히기 순서 필수(중간상태 충돌 금지). ❌ seat-by-seat set 우선 금지.
2. **잠금 순서**: `advisory→대회→참가자(id asc)→좌석(id asc)` — 1b move/redraw·1d bust와 동일 → 데드락 회피.
3. **TOCTOU**: 미리보기↔확정 사이 bust(참가자 status)·외부 착석(좌석 점유) 적발(`PARTICIPANT_NOT_ACTIVE`/`SEAT_VERSION_CONFLICT`).
4. **적격성 서버 강제**: closed/standby/locked 목표 거부(클라 필터 신뢰 금지).
5. **denormalized counter/live_stats**: seats/participants 변경→트리거 자동(소스 추가 불요), playing/total_chips 정합.
6. **반환 매핑**: snake→camel 수동(toCamelCase 미경유).
7. **이벤트 append-only**: `table_redraw` payload mode 추가, BEFORE UPD/DEL raise 무위반.

## 10. 적대검증 차원 (find→3렌즈 verify WF)

전원 비우기→앉히기 원자성(partial UNIQUE) · 잠금순서/데드락(advisory·FOR UPDATE id asc·bust/redraw 교차) · TOCTOU(동시 bust/외부착석/테이블 잠금변경) · 칩 스네이크 정확성(균형·tie-break) · 좌석부족 경계 · 적격성 서버강제 · checked_in 승급 정합(active-without-seat 불변식) · grants(anon 노출) · 에러매핑 substring 충돌 · **LS-매개 데드락 인접**(reseat가 seats 대량 변경→live_stats AFTER 트리거; reseat는 advisory 보유라 bust류와 동일 카테고리 — 후속 DEFERRED CONSTRAINT TRIGGER PR과 함께 고려, TODOS 추적).

## 11. 검증·게이트

pgTAP 전 시나리오·jest 신규·`tsc --noEmit`·`npm run quality` 전부 GREEN 증거. RED-GREEN(전순열 23505·TOCTOU·좌석부족). 컨트롤러 직접 재검증. **prod 게이트("go") 후에만** MCP apply→`get_advisors`(ERROR 0·anon SECDEF=monitor/player 2개 유지)→`supabase.ts` 수술적 정합→push+PR+CI+머지. OTA 보류(prod ops 0행).

## 12. SDD 가드레일

- ⚠️SDD implementer에 **"브랜치 생성/전환 금지, 지정 브랜치에 커밋"** 가드 필수(STEP A 이탈 교훈).
- MCP `mcp__supabase__*` **SDD 서브에이전트 절대 금지**(로컬 docker/npm만). 기존 마이그 수정 금지(신규 파일만). `@/` 절대경로. 한글.

## 13. 비차단 fast-follow

- 단일 테이블 스코프(특정 테이블 내 좌석만 섞기) · active만 좁히기 모드 · 칩 분산 최소화 최적화.
- LS-매개 데드락 DEFERRED CONSTRAINT TRIGGER 전환(TODOS 추적 — reseat가 live_stats 트리거 표면 확대).
