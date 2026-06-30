# T-HOLDEM ops 라이브 운영 — 전체 슬라이스 점검 + 남은 슬라이스 설계 핸드오프

> 아래 블록을 다음 세션 첫 프롬프트로 그대로 사용. **신선 세션 권장.**
> 작성: 2026-06-30 · 갱신: 2026-06-30(1d 출하 후). 목적 = ①지금까지 출하/구현된 모든 슬라이스(1a~1d) 신선 컨텍스트 **재점검·정합 확인** → ②**남은 슬라이스(배정 2종·1e·1f 잔여) 재매핑 후 설계**. 코딩 전 브레인스토밍·계획 게이트.
>
> ✅ **1d는 출하 완료**(prod 3마이그 적용·advisor ERROR0·PR #218, 락순서 데드락 견고화·적대검증 4종 차단0). 따라서 이 세션은 **출하 여부 결정 불요 — 남은 슬라이스 설계로 바로 진행**한다.

---

T-HOLDEM ops(홀덤 대회 라이브 운영 엔진) 슬라이스 작업이 **1a~1d까지 prod 출하** 완료됐다. 다음은 **출하된 전 슬라이스를 점검**하고 **남은 슬라이스를 재매핑·설계**한다. 권위 명세는 `docs/planning/2026-06-23-tournament-ops-revival-slice1-design.md`(§10 슬라이스 표). 코딩 금지 — 점검→브레인스토밍→설계까지.

## 슬라이스 현황 (점검 시 실측 확인)
| 슬라이스 | 설계 §10 범위 | 출하 상태 |
|---|---|---|
| **1a** CRUD 스파인+이벤트로그 | ops_tournaments/participants/events·PLAYERS·STATUS 부분통계·toggle_registration·브릿지 | ✅ **머지 #207** (prod) |
| **1b** 테이블/좌석 | ops_tables/seats·대기채움·move/free·redraw(TOCTOU)·auto-seat 동작 | ✅ **머지 #210** (prod) |
| **1c-1** 블라인드+클럭 | ops_blind_levels/clock·서버동기 타이머 | ✅ **머지 #212** |
| **1c-2** live_stats+STATUS | ops_live_stats 트리거 실테이블·풀 대시보드·Realtime | ✅ **머지 #212** |
| **1c-3** 모니터 | 전광판(비-PII anon, monitor_token) | ✅ **머지 #213** |
| **1c-4** 플레이어뷰+계정 | 플레이어뷰(SECDEF RPC)·claim_token·player_user_id | ✅ **머지 #214** |
| **STEP A** claim 토큰 분리 | view_token(읽기 anon)+8자 PIN(쓰기 bcrypt) 분리 (1d 선결과제) | ✅ **머지 #216** (prod·advisor ERROR0) |
| **1d** (우리가 한 범위) | **bust + 재진입 + ITM(ops_prizes 고정금액·PAYOUTS·우승 자동확정)** | ✅ **출하 #218** (prod 3마이그 적용·advisor ERROR0·anon ops=monitor/player 2개만). 락순서 데드락 견고화·set_prize 경계검증·적대검증 4종 차단0·pgTAP 371/jest 4533/tsc0 |

## ⚠️ 스코프 드리프트 (다음 세션이 반드시 재정렬할 핵심)
설계 §10의 **1d 행 = "배정 2종 + 재진입/bust"**(랜덤·칩드래프트·bust·reenter), **1f 행 = "상금"**(ops_prizes·풀 산정·PAYOUTS·ITM 확정·우승자 finalize).
**우리가 실제 구현한 1d ≠ 설계 1d 행**:
- ✅ 했음: `bust_participant`·`reenter_participant` + **1f의 상금 핵심을 1d로 당겨옴**(ops_prizes 고정금액·PAYOUTS 탭·ITM 확정·우승 자동확정 — 사용자 결정).
- ❌ **안 했음: "배정 2종"(랜덤 redraw 배정·칩 드래프트 배정)** — 설계 1d 행의 좌석 배정 2종. 우리 1d는 좌석을 bust 시 해제만 할 뿐, 랜덤/칩드래프트 redraw 배정 모드는 미구현(1b의 기본 redraw 위에 얹는 배정 알고리즘 2종).

→ 따라서 **남은 작업 = (가)배정 2종 + (나)1e 스태프 연동 + (다)1f 잔여 상금**. 슬라이스 번호를 설계 표 그대로 쓸지(1d에 배정 2종 보강 / 1f를 잔여만으로 축소) 재라벨링할지 다음 세션이 정한다.

## 남은 슬라이스 (재매핑 대상)
- **(가) 배정 2종**(설계 1d 잔여): **랜덤 배정**(전원/특정테이블 무작위 좌석 재배치)·**칩 드래프트**(칩 스택 균형 배정). 1b의 `ops_redraw_waitlist_fill`(미리보기·TOCTOU 재검증) 위에 배정 알고리즘 2종. PLAYERS/TABLES 서피스.
- **(나) 1e 스태프 연동**: `ops_staff`·수동+스냅샷 import·**딜러 배정**. 핵심 = **uniqn 계정·공고 확정 스태프(StaffRole dealer/floor/serving)를 대회 딜러로 연동**(§1 목표·§116 "공고로 대회 생성+확정 딜러 자동 import=1e"). work_logs 스태프연동(v2 유지 항목)·`player_user_id` 권한키 승급 신중(STEP A 메모).
- **(다) 1f 잔여 상금**: ITM 핵심은 1d서 완료 → **잔여 = 백분율(%) prize·풀 곡선 템플릿 추천·바운티(knockout_pool)·상금 정정/회수**. 1d가 `ops_prizes(rank·amount 고정금액)`·우승 finalize 이미 적재.
- **후속(슬라이스2+)**: 플레이어 포털(가입·클레임 UI·내 대회 이력·프로필)→랭킹/포인트→전국 포털(§200·§273). 별도 spec.

## 점검 절차 (신선 컨텍스트)
1. **메모리** `project_tholdem_ops_revival_20260623`(전체, STEP A·1d 섹션) + MEMORY.md ops 항목. 설계 doc §10 + UX flows `docs/planning/2026-06-23-tournament-ops-ux-flows.md`.
2. **출하된 1d 재확인**(출하 완료 — 결정 불요): 스펙 `uniqn-mobile/docs/superpowers/specs/2026-06-29-ops-1d-bust-reentry-itm-design.md`(§14 적대검증 + 후속 LS-데드락 추적) · PR #218 · `git log --oneline de8706d15..master`(머지 후). **⚠️1d 후속 추적 = [MEDIUM] LS-매개 데드락**(1c `ops_live_stats` AFTER ROW 트리거 기인, bust `LS<{좌석,winner}` 역전 → advisory 비보유 변이와 ABBA. 자기치유·prod 0행. 정공법=트리거를 DEFERRED CONSTRAINT TRIGGER로. 별도 PR) — 남은 슬라이스가 live_stats 트리거를 건드리면 함께 처리 고려.
3. **전 슬라이스 정합 정찰(WF 권장)**: 출하된 1a~1c + 로컬 1d의 RPC/스키마/RLS/탭 서피스를 매핑해 **남은 슬라이스가 얹힐 표면**(redraw 진입점·ops_staff 부재·work_logs 연동점·ops_prizes 확장 여지) 실측. 적대검증이 직전 1d서 세션한도로 verify 절반 실패했던 이력 참고.
4. **남은 슬라이스 우선순위·번호 재라벨링 결정**(사용자): 배정 2종 / 1e / 1f잔여 중 무엇을 먼저, 슬라이스 경계 어떻게.
5. **첫 슬라이스 브레인스토밍→스펙→계획**(`superpowers:brainstorming`→`writing-plans`). 운영 가치·위험도로 순서: 배정 2종(운영 필수·1b 위 저위험) vs 1e 스태프(목표 직결·work_logs/권한 복잡) vs 1f잔여(이미 1d로 대부분 충족).

## 불변 가드레일
- 한글. 작업디렉토리 `uniqn-mobile/`. 아키텍처 Presentation→Hooks→Service→Repository→Supabase. 쓰기=SECDEF RPC·actor 바인딩·P0001·anon REVOKE(monitor/player 2개만 anon-executable).
- **prod 변이·push·PR·배포는 명시 "go" 후에만.** 로컬검증=`npm run db:reset && npm run test:db:helpers && npx supabase test db`(reset이 ops_helpers 지움—매번 재적재)·`npx tsc --noEmit`·`npx jest`·`npm run quality`.
- 병렬세션 격리(작업 전 git status). SDD시 implementer "브랜치 생성/전환 금지" 가드·MCP `mcp__supabase__*` 서브에이전트 금지(로컬 docker/npm만).
- HARD-GATE: DB스키마/3+파일은 브레인스토밍·계획·적대검증 후. 증거 없는 "완료" 금지.

## 방법론 (페이즈별 — 울트라코드/팀/스킬, 1d 패턴 재사용)
정찰 WF → 브레인스토밍(슬라이스 경계·범위 결정) → 계획(writing-plans, opus) → 적대검증 WF(find→3렌즈 verify, **신선 세션서 verify 완주**) → SDD(태스크당 implementer haiku/sonnet + 태스크리뷰 + 최종 whole-branch opus) → 전 검증 GREEN 증거 → prod 게이트("go").

## 세션 종료: 메모리+ledger 갱신 + `/session-wrap`. 완료 슬라이스 `/ingest`로 wiki 졸업.

핵심 한 줄: 1a~1d(+STEP A)는 **전부 prod 출하 완료**(1d=#218, 락순서 데드락 견고화 포함)이며 설계 1d의 "배정 2종"은 미구현·1f 상금은 대부분 1d로 흡수됐으니, 다음 세션은 출하된 전 슬라이스를 재점검해 남은 작업(배정 2종·1e 스태프·1f 잔여)을 재매핑하고 우선순위를 정해 첫 슬라이스를 브레인스토밍→설계한다. (1d 후속 추적 = LS-매개 데드락 별도 PR.)
