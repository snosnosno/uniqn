# T-HOLDEM 라이브 대회 운영 엔진 부활 — 설계 v3.1

- **작성일**: 2026-06-23 (화) · **개정**: v3.1 (모니터·플레이어뷰 UX + 플레이어 계정 하이브리드)
- **상태**: DESIGN v3.1 — 사용자 리뷰 대기
- **브랜치**: `feat/tournament-ops-revival` (master 기반, `T-HOLDEM-ops` 워크트리)
- **선행**: 원본 T-HOLDEM 인벤토리 + 적대 리뷰 3건(8/8.5/8.5) + **K-Holdem 실제 플로어앱·모니터 화면 분석**

> **v3.1 변경**: 모니터·플레이어뷰 UX 구체화(§5) + **플레이어 계정 하이브리드**(QR 익명 라이브뷰 + uniqn 계정 클레임 훅 `player_user_id`). 칩=전체공개(브로드캐스트). 모니터+플레이어뷰 둘 다 **1c**. 가입·클레임·이력 포털은 **후속 슬라이스**(데이터 훅만 1c).
> **v3 변경 요약**: K-Holdem 실측 분석으로 "유기적 동기화" 구조 확정. ①**이벤트 로그 척추 `ops_events`**(=HISTORY 탭 + 동기화 백본) ②**파생 라이브 통계 `ops_live_stats`**(단일 소스→플로어앱·모니터·플레이어 동시) ③**6탭 IA**(STATUS/TABLES/PLAYERS/LEVELS/PAYOUTS/HISTORY) ④**모니터 디스플레이**를 1급 동기화 서피스로 ⑤**재진입(re-entry)·등록 설정 1급화** ⑥테이블 lock/priority(redraw 제어) ⑦참가자 entry_number·체크인 상태 ⑧bust→ITM 즉시 표시.
> (v2 유지: 좌석 정규화·work_logs 스태프연동·상금 순위컬럼·번들 런타임분기·RPC actor바인딩·ops_* 네임·"참조 재구축" 프레이밍)

---

## 1. 배경 & 목표

원본 **T-HOLDEM**(Firestore)은 라이브 토너먼트 운영툴이었으나 **uniqn**(Supabase)으로 피벗하며 운영 기능이 삭제됐다(git 히스토리 잔존). 현 uniqn의 "대회"는 운영툴이 아니라 **대회공고(스태핑 채용)** 뿐.

**목표** — 와홀덤/**K-Holdem 같은 홀덤 대회 운영 플랫폼**을 지향, 첫 조각으로 **라이브 운영 엔진을 Supabase 위에 재구축** + **uniqn 계정·공고 확정 스태프를 대회 딜러로 연동**.

### ⚠️ "부활"이 아니라 "참조 재구축"
재사용은 좌석 배정 알고리즘(순수 로직)·엔티티 형태·블라인드 구조뿐. 데이터/실시간/상태/UI 100% 신규. T-HOLDEM git·K-Holdem 화면은 **도메인 참조 자료**.

---

## 2. K-Holdem 분석 (실측 22화면) ↔ 비교

### 2.1 K-Holdem 플로어앱 = 6탭 IA (운영자 멘탈모델)
| 탭 | 내용 (실측) |
|---|---|
| **STATUS** | 블라인드 클럭(레벨·남은시간·±1분·일시정지/되감기/넘기기) + **라이브 통계 대시보드**(아래) + 액션 메뉴 |
| **TABLES** | 테이블별 Index/Seats/Empty/Filled/Chips · 테이블 추가(인원/Lock/Priority/Note) · QR스캔 |
| **PLAYERS** | 전 참가자 목록(entry# `#33`·이름·국가·`테이블-좌석`·칩, 탈락=`Out` + `Position:11`) · 검색 |
| **LEVELS** | 블라인드 구조표(Index/Minutes/SB/BB/Ante + Break행) · 편집 |
| **PAYOUTS** | 순위별 Amount/%/**Assigned to**(수상자) |
| **HISTORY** | **모든 액션 감사로그**(Level Play/Pause·Player Changed Chips=216000 …) + 사용자/기기/시각 |

### 2.2 STATUS 라이브 통계 (= "유기적 동기화"의 심장, 전부 파생값)
`PLAYING 9 · PLAYERS(entries) 57 · RE-ENTRIES 14 · TABLES 1 · SEATS 9 · FREE · AVERAGE 190,000 · CHIPS(total) 1,710,000 · KNOCKOUT · BUYIN 4,167 · FEE 833 · PRIZE POOL 228,018 · AVG STACK (BB)`.
→ 한 번의 액션(bust·칩수정·레벨변경)이 **이 모든 값 + 모니터 + 플레이어뷰에 동시 반영**. 원천은 participants·chips·blind level뿐.

### 2.3 멀티 서피스 동기화 (핵심 통찰)
- **플로어 컨트롤 앱**(조작) — STATUS 액션 `Show on monitor`로 모니터 제어.
- **모니터 디스플레이**(읽기전용 대형) — 실측: 레벨·대형클럭·현재/다음 블라인드(`10K/25K BBA`)·다음 브레이크 카운트다운·PRIZE POOL·REG CLOSED·PLAYERS 0/57·TOTAL CHIPS·AVG STACK(30BB)·스폰서·QR.
- **(후속) 플레이어뷰** — 자기 좌석·칩·블라인드.
- 셋 다 **동일 원천 + Realtime**으로 자동 일치.

### 2.4 등록·재진입·플레이어 워크플로우 (K-Holdem 1급 기능)
- **SUBSCRIPTIONS(등록) Open/Closed**(레이트레지) · **ASSIGN RANDOM SEAT ON REGISTRATION**(등록 시 자동 랜덤좌석) · **RE-ENTRIES**(재진입 카운트, 14건 실측).
- 플레이어 액션: **Move player · Free seat · Check-in player · Bust out player · Ticket Assignment · Warnings · Player info · Scan Membership Card(QR) · Go to player table**.
- bust 시 **`ITM 종료` 팝업 즉시**: `Position: 10 · Prize: 13,000`.
- 테이블 액션: **Redraw tables(리밸런스)·Close·Set Lock·Set Priority·Chips count**.
- 멀티 토너먼트: venue·날짜 필터 목록에서 대회 선택(플라이트 `1/C`·재진입 Day).

### 2.5 T-HOLDEM ↔ K-Holdem ↔ 우리 v2 갭
| 능력 | 원본 T-HOLDEM | K-Holdem | 우리 v2 | v3 조치 |
|---|---|---|---|---|
| 6탭 IA | 분산 | ✅ 성숙 | 암묵 | **명시 채택(§3.1)** |
| 라이브 통계 대시보드 | 부분 | ✅ 핵심 | 산발 | **파생 뷰 `ops_live_stats`(§4.10)** |
| 이벤트/감사 로그 | 있음 | ✅ HISTORY | **없음** | **`ops_events` 척추(§4.9)** |
| 모니터 푸시 | 있음 | ✅ Show on monitor | **없음** | **모니터 서피스 1급(§3.2/§5)** |
| 재진입/등록설정 | 부분 | ✅ 1급 | 보류였음 | **1급화(§4.3/§4.1)** |
| 테이블 lock/priority | — | ✅ | 없음 | **추가(§4.4)** |
| 체크인/티켓/경고 | 부분 | ✅ | 없음 | check-in 1급, 티켓/경고 후속 |
| bust→ITM 즉시 | 부분 | ✅ | 분리 | **bust RPC가 ITM 반환(§7)** |

---

## 3. 아키텍처 — 유기적 동기화

### 3.1 정보구조(IA) = 6탭 + 모니터
플로어 컨트롤 앱 `app/(ops)/tournaments/[id]/` 하위 6탭: **STATUS·TABLES·PLAYERS·LEVELS·PAYOUTS·HISTORY**. 운영자가 이미 아는 멘탈모델 그대로.

### 3.2 단일 라이브 상태 + 이벤트 척추 (동기화 모델)
```
              ┌──────────── 쓰기(RPC, 원자) ────────────┐
   조작 ──▶ ops_* 원천테이블 ──(트리거)──▶ ops_events(append-only 로그)
              │                                  │
              ├─▶ ops_live_stats (파생 뷰)        │
              └────────── Supabase Realtime ──────┴────────────┐
                    ▼                ▼                 ▼
            플로어앱 6탭        모니터(읽기전용)     플레이어뷰(후속)
```
- **모든 변이는 RPC**(원자·actor=auth.uid 바인딩). RPC가 원천테이블 갱신 + `ops_events`에 1건 append.
- **`ops_live_stats`** = 파생 통계(평균/총칩/엔트리/재진입/빈좌석/AVG BB/프라이즈풀). 화면은 계산 안 하고 구독만.
- **Realtime** 한 소스 → 플로어앱·모니터·(후속)플레이어 자동 일치 = "유기적 동기화".
- `ops_events`는 HISTORY 탭 + 디버깅 + (후속) 되돌리기 + 동기화 트리거를 **한 번에** 해결.

### 3.3 코드 구조·배포 (v2 유지)
uniqn-mobile 모노레포 `app/(ops)/`, 웹 우선, 같은 Supabase·Auth(클라이언트 재사용). **도메인 = `ops.uniqn.app` 서브도메인**(같은 브랜드, uniqn과 계정·디자인 일관). **배포는 런타임 variant 분기**(빌드 산출물 분리 아님 — Expo Router 단일번들, ops가 메인앱에 실림 수용). `deploy-cloudflare.js`/`wrangler` `uniqn-app` 하드코딩 파라미터화 + 2번째 CF Pages 프로젝트(ops). 진짜 격리(`EXPO_ROUTER_APP_ROOT`×2)는 후속. **모니터는 `app/(ops)/monitor/[id]`**(공개 읽기전용, 토큰 URL).

### 3.4 라우트 게이팅·레이어·네이밍 (v2 유지)
`(ops)`는 authenticated 진입, 권한은 RLS(owner/workspace). 모니터는 별도 토큰 접근. 레이어 `Presentation→Hooks(src/hooks/ops)→Service→Repository(interface/impl)→Supabase`. 순수 도메인 `src/domains/ops/`. 네임스페이스 **`ops_*`**(기존 tournament=대회공고와 분리).

### 3.5 진입점 (Entry points) — 한 계정, 여러 문
| 사용자 | 진입 | 로그인 |
|---|---|---|
| 운영자(펍사장·대회진행) | `ops.uniqn.app` 웹(북마크) OR uniqn앱 "라이브 운영 →" 딥링크 | uniqn 계정 |
| 플로어 직원 | `ops.uniqn.app` → 배정 대회 | uniqn 계정 |
| 딜러 | uniqn 앱(공고·스케줄) — 현장은 운영자가 테이블 배정(딜러뷰 후속) | uniqn 계정 |
| 참가자(선수) | **QR 슬립** → `ops.uniqn.app/live/[claim_token]`(익명) → 선택적 로그인 클레임 | 없음→선택 |
| 관전 TV | 운영자 "Show on monitor" → `ops.uniqn.app/monitor/[id]?token` | 없음(공개) |
| 기존 uniqn(구인·스태프) | `uniqn.app` 그대로 | uniqn 계정 |

- **브릿지**: uniqn 앱에서 대회공고 보유 employer에게 "이 대회 라이브 운영 →" 버튼(ops 딥링크). 참가자는 도메인 인지 불필요(QR만).
- **라이프사이클**: uniqn 공고+딜러모집 → ops서 대회 생성(공고 연결, 딜러 자동 import) → 현장 등록+QR 슬립 → 참가자 스캔 → TV 송출.

### 3.6 uniqn → ops 브릿지 (MVP — 실코드 기반)
- **단일 진입점**: 공고 상세 `app/(employer)/my-postings/[id]/index.tsx` "관리" 섹션에 **"라이브 운영" ActionCard 1개**(홈·리스트 미노출 — MVP 최소).
- **노출 조건(AND 전부)**: `postingType==='tournament'`(`postingConfig.ts`) AND `tournamentConfig.approvalStatus==='approved'`(미승인/거절=숨김) AND `status ∉ {draft,rejected,cancelled,expired}`. **관리권한은 화면 진입이 이미 게이트**(`my-postings/[id]/_layout.tsx`의 `isEmployerManageablePosting`+RLS) → 별도 role 체크 없음(workspace 협업자 자동 포함).
- **상태인식 라벨**: employer 앱이 `ops_tournaments WHERE job_posting_id={id}` 가볍게 조회 → 없음=**"라이브 운영 시작"**, 있음=**"라이브 운영 열기"** + `진행 중` 배지.
- **딥링크**: `deepLinkService.openExternalUrl('https://ops.uniqn.app/t/from-posting?postingId={id}')`(미생성) 또는 `…/t/{opsTournamentId}`(생성됨). 웹=새 탭, 모바일=브라우저.
- **세션(수용한 마찰)**: 다른 origin이라 Supabase localStorage 세션 미공유 → **ops 첫 진입 1회 재로그인 수용**(이후 기억). SSO(단기 토큰 핸드오프 / `.uniqn.app` 쿠키)는 후속.
- **역방향**: ops 대회 화면 → "공고 보기" 링크백 `uniqn.app/.../my-postings/{id}`.
- **슬라이스**: 버튼+딥링크+상태인식 = **1a 동반**(ops_tournaments 생성 시점). "이 공고로 대회 생성 + 확정 딜러 자동 import" = **1e**.

---

## 4. 데이터 모델 (Postgres) — v3

> `owner_id`/`*_staff_id` FK→`public.users(id)`. Realtime publication = 실시간 대상만(participants·tables·seats·clock·live_stats·events). RLS: `owner_id=auth.uid() OR is_workspace_member(job_posting.workspace_id)`. 모든 RPC `REVOKE anon` + SECDEF actor 바인딩.

### 4.1 `ops_tournaments`
`id, owner_id FK, job_posting_id FK?, name(XSS), venue, event_date date, game_type text(NLH/PLO/…), status CHECK(upcoming/active/completed), seats_per_table int DEFAULT 9, starting_chips, color`
**칩·정산 config**: `buy_in_chips, rebuy_chips, addon_chips, buy_in_cost, fee_cost, rebuy_cost, addon_cost, bounty_cost?(knockout)`
**등록 config(K-Holdem)**: `registration_open bool DEFAULT true, auto_seat_on_register bool DEFAULT true, reentry_allowed bool DEFAULT true, max_reentries int?`
`created_at/updated_at`.

### 4.2 `ops_blind_levels`
`id, tournament_id FK, level int, sb, bb, ante DEFAULT 0, duration_sec, is_break bool DEFAULT false, sort` · UNIQUE(tournament_id, sort).

### 4.3 `ops_participants` (재진입·체크인·계정훅 1급)
`id, tournament_id FK, entry_number int(=K-Holdem #33, 대회내 유니크), name(XSS), nationality text?, phone?, `
`player_user_id uuid FK→public.users(id)?  ← 계정 클레임 시 링크(walk-in은 NULL, 운영자 마찰 0), `
`claim_token text?  ← QR 슬립용 1회성 토큰(스캔→익명 라이브뷰, 로그인 시 player_user_id로 클레임), `
`status text CHECK(registered/checked_in/active/busted/no_show) DEFAULT registered, `
`chips int DEFAULT 0, buy_in_amount?, rebuys int DEFAULT 0, add_ons int DEFAULT 0, reentries int DEFAULT 0, `
`finish_position int?, busted_at timestamptz?, prize_amount int?(ITM 확정), note?`
- **좌석 컬럼 없음**(점유=`ops_seats` 단일원).
- **재진입**: bust 후 `reenter_participant` RPC가 status→active, chips=starting, finish_position=NULL 리셋, reentries++ (대회 reentry_allowed·max 가드). entries(총) vs 유니크 플레이어 구분은 `ops_live_stats`서 집계.
- 부분 UNIQUE(tournament_id, finish_position) WHERE finish_position IS NOT NULL · UNIQUE(tournament_id, entry_number).
- 인덱스 (tournament_id, status), (tournament_id, finish_position).

### 4.4 `ops_tables` (lock/priority)
`id, tournament_id FK, table_no int, name?, status CHECK(open/closed/standby) DEFAULT open, assigned_staff_id FK?, lock_type text?(none/locked/feature), priority int?(브레이크 순서), position jsonb?` · UNIQUE(tournament_id, table_no).

### 4.5 `ops_seats` (정규화 — 단일 점유원)
`id, tournament_id FK, table_id uuid FK→ops_tables, table_no int, seat_no int, participant_id FK→ops_participants?`
- UNIQUE(table_id, seat_no) · 부분 UNIQUE(tournament_id, participant_id) WHERE participant_id NOT NULL.
- 테이블 개설 시 seats_per_table만큼 빈 좌석 행 생성(participant_id NULL). `move_seat`=대상 좌석 `FOR UPDATE` 후 2행 갱신.

### 4.6 `ops_staff` (uniqn 연동)
`id, tournament_id FK, staff_id FK→public.users, role staff_role(6값), source CHECK(snapshot_import/manual), source_work_log_id?, assigned_at` · UNIQUE(tournament_id, staff_id).

### 4.7 `ops_clock` (서버 동기 타이머)
`tournament_id PK FK, current_level int DEFAULT 0, level_started_at timestamptz, is_running bool DEFAULT false, paused_remaining_sec int?`. 남은시간=서버 기준. 일시정지 시 paused 저장, 재개 `level_started_at = now() - (duration - paused_remaining)`. 레벨 종료=운영자 수동(`set_level`).

### 4.8 `ops_prizes`
`id, tournament_id FK, rank int, amount int?, pct numeric?, participant_id FK?` · UNIQUE(tournament_id, rank).

### 4.9 `ops_events` (이벤트 척추 = HISTORY + 동기화) — v3 신규
`id, tournament_id FK, type text(level_play/level_pause/level_set/chips_changed/player_registered/player_checked_in/player_busted/player_reentered/player_moved/seat_freed/table_added/table_closed/table_redraw/prize_assigned/registration_toggled), `
`actor_id FK→public.users?, actor_device text?, payload jsonb(변경 상세, 예: {participant_id, chips_before, chips_after}), created_at timestamptz DEFAULT now()`
- **append-only**(UPDATE/DELETE 금지). 모든 변이 RPC가 1건 기록 → HISTORY 탭 = `ORDER BY created_at DESC`.
- 인덱스 (tournament_id, created_at DESC).

### 4.10 `ops_live_stats` (파생 뷰/머티리얼라이즈) — v3 신규
`tournament_id` 기준 집계 VIEW (또는 갱신 트리거 테이블):
`playing(active 수), entries(총=참가+재진입+리바이 정의 명시), unique_players, reentries_total, tables_open, seats_total, seats_free, total_chips, average_stack, avg_stack_bb(=average_stack/현재 bb), prize_pool(=Σ 수익), knockout_pool?`.
→ 화면·모니터는 이 한 행만 구독. **단일 진실원, 산발 계산 제거.**

---

## 5. 멀티 서피스 (동기화 산출물)

세 서피스 모두 **같은 `ops_clock`+`ops_live_stats`의 다른 렌더링** — 별도 기능 아님. 칩 정책 = **전체공개(브로드캐스트)**, 프라이버시 게이팅 없음.

### 5.1 플로어 컨트롤 앱
6탭(STATUS/TABLES/PLAYERS/LEVELS/PAYOUTS/HISTORY), 모든 조작. STATUS 액션 `Show on monitor`로 각 TV가 볼 대회 지정.

### 5.2 모니터 디스플레이 `app/(ops)/monitor/[id]?token=…`
읽기전용 대형(16:9), 공개 토큰 URL(로그인 0). `ops_clock`(서버 시각, 클라 카운트다운만)+`ops_live_stats` 구독 → 새로고침·멀티 TV 100% 동일.
- **레이아웃**: 헤더(매장로고·대회명·게임타입·REG 상태) / 히어로(LEVEL·대형클럭·±1분·현재 BLINDS+ante) / 통계 스트립(PLAYERS 잔여/총·AVG(BB)·TOTAL CHIPS·POOL) / 푸터(다음 블라인드·다음 브레이크 카운트다운·QR=플레이어뷰 링크·powered by uniqn).
- **상태별**: 시작전(REGISTRATION OPEN+시작 카운트다운) / 진행 / **일시정지**(클럭 빨강·점멸·PAUSED) / **브레이크**(ON BREAK 카운트다운+다음 레벨) / 레벨전환(0.5s 플래시) / 종료(우승자+파이널 순위·상금 스크롤).
- **멀티 모니터**: 한 대회 다중 TV 동시 송출, TV별 다른 대회 가능.

### 5.3 플레이어뷰 `app/(ops)/live/[claim_token]` (1c, 계정 하이브리드)
참가자 폰. 자리 배정 시 **QR 슬립**(claim_token) 지급 → 스캔 → **로그인 없이 즉시** 본인 라이브뷰.
- **레이아웃**: 미니 클럭(모니터 동기) / **내 자리(TABLE·SEAT, 가장 크게)+미니 배치도** / 내 스택(칩+BB) / 대회 라이브(블라인드·인상 카운트다운·생존수·평균BB·풀·다음 브레이크) / 알림 안내.
- **상태/이벤트**: 자리이동(자동 갱신+토스트 "TABLE 4·SEAT 5") / 블라인드 인상 임박(강조) / 브레이크 / **탈락 ITM**("10위 종료·상금 13,000") / 탈락 노미니("11위") / 재진입 가능 배너.
- **구독**: `ops_clock`+`ops_live_stats`(공개 집계)+본인 `ops_participants` 행+본인 `ops_seats`. 원본 ParticipantLivePage 계승.
- **계정 하이브리드(§4.3 훅)**: 익명뷰 하단 **"로그인해 내 기록 저장"** → uniqn 계정 로그인 시 claim_token→`player_user_id` 클레임. 운영자는 그대로 walk-in 입력(마찰 0).
- **후속(플레이어 포털 슬라이스)**: 가입·클레임 UI·내 대회 이력·프로필 → 이후 랭킹/포인트(와홀덤 선수 포털). **1c는 데이터 훅(`player_user_id`/`claim_token`)+로그인 진입점까지만.**

---

## 6. 실시간 + 타이머
기존 `createRealtimeSubscription` 재사용. 단 다테이블·고빈도라 선례 초과 → 칩/클럭 throttle, `REPLICA IDENTITY FULL`(old-row 필요시), 공유 prod publication WAL 고려. **좌석 정규화 + `ops_live_stats` 단일행 구독**으로 payload 최소화. Realtime은 CRUD 안정 후 레이어링.

---

## 7. 도메인 로직 (순수함수 + RPC 트랜잭션)
- 좌석 배정 3종(랜덤/대기채움/칩 스네이크) `domains/ops/seatAssignment/`. **Redraw**=리밸런스(lock된 테이블 제외, priority 순 브레이크).
- `move_seat`·`free_seat`(좌석 비우기).
- **`bust_participant`**: active로 카운트해 `finish_position` 부여(off-by-one 주의)+busted_at, **ITM면 prize_amount 계산해 반환(`{position, prize}`)**. 행/advisory 락(동시 bust)+부분 UNIQUE로 순위중복 차단. 우승자(rank1) finalize 별도.
- **`reenter_participant`**: 재진입 리셋(§4.3).
- `add_rebuy`/`add_addon`: count++ AND chips+= 원자. (재진입과 구분: 리바이=생존 중 칩보충, 재진입=탈락 후 재참가.)
- 클럭 `set_level/start/pause/resume`. 등록 `toggle_registration`. 모든 RPC → `ops_events` 기록.
- 다중행 갱신 `runTransaction`/RPC 필수.

---

## 8. 상금
`ops_prizes` 순위별 구조. 풀=Σ(엔트리·buyin + 리바이·rebuy_cost + 애드온·addon_cost) (`ops_live_stats.prize_pool`). bust가 finish_position+ITM prize 매핑(§7). PAYOUTS 탭 `Assigned to`=수상자.

---

## 9. 품질/규약
불변성·Zod+xss·AppError·logger·dark:·camelCase/snake_case 경계·파일 200~400줄. (CLAUDE.md)

---

## 10. 슬라이스 분해 (v3 — 동기화 우선 재편)

| # | sub-slice | 내용 | 동기화 |
|---|---|---|---|
| **1a** | **CRUD 스파인 + 이벤트로그** | `ops_tournaments`(+등록/칩 config)·`ops_participants`(entry#·체크인·재진입·리바이)·**`ops_events`** + PLAYERS/STATUS(목록·등록) | 척추 확립 |
| 1b | 테이블/좌석 | `ops_tables`(lock/priority)·`ops_seats`·1종 배정·`move_seat`·`free_seat`·redraw | TABLES 탭 |
| 1c | 블라인드+클럭+**모니터+플레이어뷰** | `ops_blind_levels`·`ops_clock`·서버동기 타이머 + `ops_live_stats` + **모니터 디스플레이** + **플레이어뷰(QR 익명+계정훅 `player_user_id`/`claim_token`)** | LEVELS+모니터+플레이어뷰 |
| ↳ | **Realtime** | 1c 시점 다서피스 구독 레이어링 | 유기적 동기화 가동 |
| 1d | 배정 2종 + 재진입/bust | 랜덤·칩드래프트·`bust_participant`(ITM)·`reenter_participant` | PLAYERS |
| 1e | 스태프 연동 | `ops_staff`·수동+스냅샷 import·딜러 배정 | — |
| 1f | 상금 | `ops_prizes`·풀 산정·PAYOUTS·ITM 확정 | PAYOUTS |

**1a 첫 출시 단위** = 디지털 등록데스크 + 감사로그 척추(이후 모든 탭이 얹힘). `bust`는 1d(상금 ITM은 1f)로 분리 — 1a는 registered/checked_in/active만.

---

## 11. 테스트
| 레이어 | 도구 | 대상 |
|---|---|---|
| 도메인 | Jest | 배정·move/free·bust순위·재진입·상금·블라인드·live_stats 집계 |
| DB | pgTAP | owner/workspace RLS, anon REVOKE+actor 바인딩, 좌석 단일점유, **ops_events append-only**, live_stats 정합, import |
| E2E | Playwright | 대회→등록→체크인→좌석→블라인드→bust→상금 + **모니터 동기화** |

신규 RPC는 마이그서 직접 GRANT(fixture 함수 제외). 신규 enum/status는 read Zod·RLS·reader 전수.

---

## 12. 리스크/오픈
1. prod DB 공유 — `ops_*` RLS·anon REVOKE·actor 바인딩·멱등 마이그.
2. 번들 미분리 수용(§3.3). 진짜 격리 후속.
3. Realtime 고빈도 — 좌석정규화+live_stats 단일행으로 완화, throttle/REPLICA IDENTITY 1c 결정.
4. `ops_live_stats` VIEW vs 머티리얼라이즈드 — 고빈도면 트리거 갱신 테이블 검토(1c 벤치).
5. 모니터 보안 — 공개 토큰 URL(읽기전용, 민감정보 최소).
6. 스냅샷 import staleness(취소 미반영, 라벨). 동기화 후속.
7. 후속 보류: **플레이어 포털(가입·클레임 UI·내 이력·프로필)**·전국 포털/예약·랭킹/포인트·티켓/경고·딜러 로테이션·멀티데이/플라이트·바운티 정산. (라이브 플레이어뷰·계정훅은 1c에 포함)
8. **claim_token 보안** — 1회성·추측불가(난수)·읽기전용 스코프. 전체공개 칩이라 유출 피해 낮으나 토큰=본인 클레임 권한이므로 클레임 시 재검증.

---

## 13. 다음 단계
v3.1 승인 후 **1a(CRUD+이벤트로그)** `writing-plans` 계획화. 1b~1f 각자 plan→구현, Realtime·모니터·플레이어뷰는 1c. 후속 슬라이스(플레이어 포털=가입·클레임·이력·프로필 → 랭킹/포인트 → 전국 포털)는 별도 spec.
