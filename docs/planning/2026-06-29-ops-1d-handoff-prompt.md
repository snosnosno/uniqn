# T-HOLDEM ops 로드맵 — STEP B = 1d(bust/재진입/ITM) 다음 세션 핸드오프 프롬프트

> 아래 블록을 다음 세션 첫 프롬프트로 그대로 사용. **신선 세션 권장**(컨텍스트 예산).
> 작성: 2026-06-29 (STEP A claim 토큰 분리 출하 직후).

---

T-HOLDEM ops 로드맵 PHASE C — **1d(bust/재진입/ITM)** 진행. 1d 착수 전 BLOCKING 선결과제(claim 토큰 분리)는 **이미 완료·prod 적용됨** — 곧바로 1d 본작업. 스킬·울트라코드 워크플로·팀에이전트를 페이즈별 최적 사용.

## 현황 (직전 세션 2026-06-29 완료 — STEP A)
- **STEP A(claim 토큰 읽기/쓰기 분리) 전체 출하**: `claim_token`(읽기+쓰기 겸용)→`view_token`(읽기 anon)+`claim_pin_hash`(8자 base32 PIN·bcrypt) 분리. **PR #216**(브랜치 `fix/ops-claim-token-separation`) — prod 3마이그 적용완료(`ygfxukhktpqymahfrvbz`)·advisor 173WARN/ERROR0(anon-executable SECDEF=monitor/player 2개만)·supabase.ts 정합. **머지 상태는 `gh pr view 216`로 확인**(직전 세션이 CI후 squash 머지 진행).
- **이로써 `player_user_id`가 권한키로 승급돼도 하이재킹 안전**. 단 1d의 bust/reenter는 **운영자 RPC**라 player_user_id 인가 미사용 — 승급은 1f/포털에서 신중히.
- 직전 검증: tsc0·quality0err·jest 4524·pgTAP 35파일/319.

## 오리엔테이션 (작업 전 필수)
1. **메모리** `project_tholdem_ops_revival_20260623` 전체(특히 2026-06-29 STEP A 섹션) + MEMORY.md. STEP A 스펙=`uniqn-mobile/docs/superpowers/specs/2026-06-28-ops-claim-token-separation-design.md`.
2. **설계 doc** `docs/planning/2026-06-23-tournament-ops-revival-slice1-design.md` **§7(bust_participant/reenter_participant)·§4.3(재진입·finish_position·busted_at)·§1d 슬라이스 표**. 이게 1d 권위 명세.
3. **1a 스키마 실측**(`supabase/migrations/20260625120000_ops_1a_enums_and_tables.sql`): `ops_participants`에 `finish_position int`·`busted_at timestamptz`·`prize_amount int`·`reentries int DEFAULT 0`·`status enum(...busted...)`·부분UNIQUE `uniq_ops_participants_finish_position(tournament_id,finish_position) WHERE NOT NULL` **이미 존재(inert)**. `ops_tournaments`에 `reentry_allowed bool`·`max_reentries int` 존재. `ops_event_type` enum에 `player_busted`·`player_reentered`·`prize_assigned` 존재 → **enum ALTER 불필요**.
4. **플레이어뷰 투영**: `ops_get_player_view`가 `finishPosition`/`prizeAmount`/`reentries` **이미 반환**(`app/(public)/live/[view_token].tsx`에 탈락배너·상금 표시 코드 존재) → 1d가 값만 채우면 활성화.
5. **기존 ops RPC 패턴 숙지**: `ops_add_rebuy`/`ops_add_addon`(count++ AND chips+= 원자, FOR UPDATE) · `ops_register_participant` v2(auto-seat) · live_stats 트리거 재계산(`fn_ops_recompute_live_stats`, 5소스 트리거 — bust/reenter도 소스 추가 필요할 수 있음) · `opsRpcError` PREFIX_MAP + AppError E61xx.

## 불변 가드레일
- 한글. 작업디렉토리 `uniqn-mobile/`. 아키텍처 Presentation→Hooks→Service→Repository→Supabase.
- **prod 변이·push·PR·배포는 명시 "go" 후에만.** 로컬검증=`npm run db:reset && npm run test:db:helpers && npx supabase test db`(reset이 ops_helpers 지움—매번 재적재). TS=`npx tsc --noEmit`·`npx jest`·`npm run quality`. (`.bin` 정상, bare/npx 둘 다 동작.)
- **병렬세션 격리**: 작업 전 `git status`. 타 워크트리(T-HOLDEM-review/ux-fix/weekly-grid) 금지. **master 기반 새 브랜치**(`feat/ops-1d-bust-reentry`). ⚠️SDD implementer에 **"브랜치 생성/전환 금지, 작업 브랜치에 커밋"** 가드 필수(STEP A서 한 번 이탈함).
- prod 적용 후 `get_advisors`: 신규 트리거fn 있으면 anon+authenticated REVOKE(1a 교훈), function_search_path_mutable에 신규 ops 부재, ERROR 0. supabase.ts=MCP gen→prettier 후 additive 확인.
- HARD-GATE: DB스키마/3+파일은 계획·적대검증 후 진행. 증거 없는 "완료" 금지(컨트롤러 직접 재검증).
- **MCP `mcp__supabase__*`는 prod 전용** — SDD 서브에이전트엔 절대 금지(로컬 docker/npm만).

## STEP B 범위 — 1d (bust / 재진입 / ITM)
설계 §7 기준. **계획화(`writing-plans`, 판단형=opus) 후 SDD**. 범위:
- **`ops_bust_participant(p_participant_id, p_actor_id)`**: active→busted + `busted_at=now()` + **`finish_position` 부여**(현재 생존자 수 기반, **off-by-one 주의**). 동시 bust 직렬화(행/advisory 락) + 부분UNIQUE로 순위중복 차단. **ITM이면 `prize_amount` 반환**`{position, prize}`. ⚠️**우승자(rank1) finalize는 별도**(마지막 1인 처리).
- **재진입 `ops_reenter_participant(p_participant_id, p_actor_id)`**: busted→active, chips=starting_chips, finish_position=NULL 리셋, `reentries++`. **`reentry_allowed`·`max_reentries` 가드**(소진 시 거부). bust 후에만 허용(상태전이 가드).
- **ITM 범위 결정 필요**(브레인스토밍 1순위): 전체 상금구조 `ops_prizes`+풀산정+PAYOUTS는 **1f**. 1d는 ⓐfinish_position+busted_at만(prize_amount는 1f) vs ⓑ간이 ITM(수동 prize_amount 입력 or 단순 페이아웃) 중 택. 설계 §7은 "bust가 prize 반환"이라 ⓑ경향이나, ops_prizes 부재라 풀산정 불가 → **사용자 확인**.
- PLAYERS 탭 UI: bust 버튼·재진입 버튼·탈락 배지·finish_position 표시. 플레이어뷰 탈락배너는 투영 이미 됨.

## 회귀 주의 (적대검증·pgTAP 필수 커버)
- **이중 busted 게이트**: 이미 busted인 참가자 재-bust 거부(상태전이 가드). 1a 핀 "busted 이중경로 금지".
- **재진입 카운터**: `reentries++`가 정확히 1회·max 초과 거부·동시요청 레이스(FOR UPDATE).
- **finish_position 부분UNIQUE**: off-by-one(생존자 N명일 때 bust되는 사람=Nth) + 동시 bust 시 같은 position 충돌 차단.
- **live_stats 정합**: bust/reenter가 `playing`/`entries`/`average_stack` 재계산 트리거에 반영되는지(트리거 소스 추가 필요 가능).
- **denormalized counter drift**(`pitfall_denormalized_counter_drift`): INSERT/UPDATE/DELETE 3경로+status전이 enumerate.

## 방법론 (페이즈별 최적 — 울트라코드/팀/스킬)
1. **정찰**: `Explore` 에이전트 또는 정찰 WF로 §7 + 1a/1c 기존 bust-인접 코드(live_stats 트리거·register v2·add_rebuy 원자패턴) 매핑.
2. **브레인스토밍**(`superpowers:brainstorming`): ITM 범위(ⓐ/ⓑ)·우승자 finalize·재진입 UX 결정. 설계doc 작성→커밋.
3. **계획**(`superpowers:writing-plans`, opus): 마이그(RPC+트리거)/pgTAP/데이터레이어/UI 태스크화.
4. **적대검증 WF**(울트라코드 `Workflow`, find→adversarially-verify): 다차원(트랜잭션/동시성·off-by-one·재진입 카운터·이중busted·live_stats 정합·ITM 경계). STEP A처럼 확정만 반영.
5. **SDD**(`superpowers:subagent-driven-development`): 태스크당 implementer(전사형=haiku/통합=sonnet)+태스크별 리뷰(sonnet)+최종 whole-branch 리뷰(opus). RED-GREEN(이중busted·off-by-one 가드). 컨트롤러 직접 재검증.
6. **검증**: pgTAP(bust순위·재진입·이중게이트·live_stats)·jest·tsc·quality 전부 GREEN 증거.
7. **prod 게이트("go")**: MCP apply→advisor→supabase.ts gen→push+PR+CI+머지.

## 비차단 fast-follow (여유 시)
- STEP A 잔여 Minor: opsRpcError PREFIX_MAP 미테스트 엔트리 보강 · `ops_unclaim_participant` 운영자 UI affordance(RPC만 존재) · STEP A wiki `/ingest` 졸업(anon SECDEF capability-URL + claim PIN 분리 패턴).
- 정리: SDD 산출 `.superpowers/sdd/*`(git-ignored), `tool-results/` 대용량 advisor/types 덤프.
- 사용자 게이트: ops.uniqn.app 2nd CF Pages(`npm run deploy:ops`) · OTA(1a~1d 보류 중).

## 세션 종료: 메모리+ledger 갱신 + `/session-wrap`. 다음 게이트(1e 스태프연동/1f 상금) 명시.

핵심 한 줄: claim 토큰 분리(STEP A)가 prod까지 출하돼 1d의 BLOCKING이 사라졌고, 다음 세션은 곧바로 1d(bust→finish_position/busted_at, 재진입 카운터 소비, ITM 범위는 1f 상금구조와의 경계를 브레인스토밍에서 확정)를 계획→적대검증→SDD로 진행합니다.
