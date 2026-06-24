# T-HOLDEM ops — 화면·흐름 UX (6탭 / Redraw / 등록·체크인)

- **작성일**: 2026-06-23 · 메인 설계의 동반 문서 (`2026-06-23-tournament-ops-revival-slice1-design.md`)
- **근거**: K-Holdem 플로어앱 실측 22화면 + v3.1 데이터 모델(`ops_*`)
- **원칙**: 모든 화면은 `ops_live_stats`/`ops_clock`/원천테이블을 **구독만**(계산X). 모든 변이는 RPC→`ops_events` 1건 기록(HISTORY 자동).

---

## A. 플로어 컨트롤 앱 — 6탭

상단 공통: `← 뒤로  |  #17 Women's Event · NLH  |  ☰ 메뉴`. 하단 FAB: 🟧 액션 메뉴 · 🟢 검색/추가.

### A1. STATUS (운영자 홈)
```
┌────────────────────────────────────────┐
│  ◀◀    ⏸    ▶▶      [━━━━━━━●────] 진행바 │  클럭 제어(레벨)
│            LEVEL 19                      │
│   -1분   ┃  08:13  ┃   +1분              │  대형 타이머(서버동기)
│        BLINDS 5,000 / 10,000 · ante 10K │
│   다음 레벨  5K/10K (10K)                 │
├────────────────────────────────────────┤
│ PLAYING 9   ENTRIES 57   RE-ENTRY 14    │  ← ops_live_stats (구독)
│ TABLES 1    SEATS 9      FREE -          │
│ AVG 190,000(19BB)  CHIPS 1.71M  KO -     │
│ BUYIN 4,167  FEE 833   POOL 228,018      │
├────────────────────────────────────────┤
│ 등록(SUBSCRIPTIONS)        ● 마감  [전환]│  ← tap=toggle_registration
│ 등록시 자동좌석            랜덤   [전환] │  ← auto_seat_on_register
│ 체크인/딜러 페이아웃       사용   [전환] │
└────────────────────────────────────────┘
   🟧 액션 ▸ Show on monitor·Redraw·Search·Bust
```
- **클럭 제어**: ⏸/▶ start·pause, ◀◀/▶▶ set_level, ±1분 시간보정 → `ops_clock` RPC.
- **통계**: 전부 `ops_live_stats` 단일행. bust/칩수정 시 즉시 갱신.
- **등록 토글**: `registration_open`·`auto_seat_on_register` 즉시 반영(모니터 REG 상태도).

### A2. TABLES
```
┌────────────────────────────────────────┐
│ Idx  Seats  Empty  Filled   Chips       │
│ 98     9      -      9     1,710,000  🔒?│  🔒=lock_type
│ 99     9      3      6       980,000  ⚑3 │  ⚑=priority
├────────────────────────────────────────┤    탭→테이블 상세(좌석 그리드)
│            🟧 QR스캔        🟢 + 테이블추가│
└────────────────────────────────────────┘
테이블 상세(탭):  TABLE 98  [1..9 좌석]
  좌석 탭 → 플레이어/좌석 액션(A3 메뉴)
  테이블 메뉴 → Chips count · Close · Set Lock · Set Priority
테이블 추가:  개수 · 좌석수 · Lock Type · Priority · Note
```
- 좌석 점유=`ops_seats`(단일원). Close=standby/closed(redraw 제외). Lock=밸런싱 제외(피처/방송 테이블). Priority=브레이크 순서.

### A3. PLAYERS
```
┌────────────────────────────────────────┐
│ 🔍 검색                                  │
│ #8  Shimizu Chie    JP   98-5   480,000 │  ← entry#·이름·국적·테이블-좌석·칩
│ #4  Komaki Minami   JP   98-1   270,000 │
│ #11 Hsieh H.C.      TW   Out  · 11위    │  ← busted: finish_position
├────────────────────────────────────────┤
│                          🟢 + 참가자 등록 │
└────────────────────────────────────────┘
플레이어 탭 → 액션:
  Player info · Move player · Free seat · Check-in ·
  Ticket(후속) · Warnings(후속) · Bust out(red) · Go to table
```
- 정렬: 칩 DESC 또는 테이블순. busted는 하단/회색 + 순위.

### A4. LEVELS (블라인드 구조)
```
┌────────────────────────────────────────┐
│ Idx  분    SB     BB     Ante           │
│  1   25   100    100    100             │
│  5   25   200    400    400             │
│ Break 15  --     --     --              │  ← is_break
│  6   25   200    500    500             │
├────────────────────────────────────────┤   행 탭→편집, 🟢 +레벨/브레이크
└────────────────────────────────────────┘
```
- `ops_blind_levels` CRUD. 진행 중 편집 시 현재 레벨 이후만 영향(클럭 재계산 주의).

### A5. PAYOUTS (상금)
```
┌────────────────────────────────────────┐
│ 순위  금액        %       수상자         │
│  1   68,418    30.0%    (대회 종료시)    │
│  2   49,500    21.7%                     │
├────────────────────────────────────────┤   🟢 자동계산(풀×구조) / 수동편집
└────────────────────────────────────────┘
```
- 풀=`ops_live_stats.prize_pool`. 구조(%/고정) 편집. bust ITM 시 `participant_id` 매핑(수상자 자동 표시).

### A6. HISTORY (감사로그 = 이벤트 척추)
```
┌────────────────────────────────────────┐
│ Level Play   Lv19 시작   01:36  SNO/iOS │
│ Level Pause  Lv19 정지   01:36  SNO/iOS │
│ Player Changed  Chang 칩=216,000 01:10  │
│ Player Busted   Hsieh 11위        00:58 │
└────────────────────────────────────────┘
```
- `ops_events` ORDER BY created_at DESC. 필터(타입/플레이어). 디버깅·분쟁·(후속)되돌리기 근거.

---

## B. Redraw (테이블 밸런싱) 흐름 — 안전 우선(K-Holdem 대비 최적화)

K-Holdem은 즉시 실행. 우리는 **미리보기→확인**으로 오조작 방지(실제 사람 이동).

```
STATUS 🟧 Redraw  (또는 TABLES 메뉴)
  ▼
① 모드 선택
   ○ 대기 채움 (신규 참가자만 빈자리)
   ○ 랜덤 리밸런스 (전체 재배치)
   ○ 칩 스네이크 드래프트 (칩 균등)
   ☑ 잠긴 테이블 제외(lock)   ☑ Priority 순 브레이크
  ▼
② 미리보기  (before → after)
   "Komaki  98-1 → 99-4"
   "Yun     98-2 → (유지)"
   테이블별 인원·평균칩 균형 표시
  ▼
③ [확인] → RPC 원자 실행
   → ops_seats 갱신 · ops_events "table_redraw" 1건
   → 이동된 플레이어 라이브뷰 "자리 이동" 토스트/알림
```
- **테이블 브레이크**: 인원 임계 이하 테이블 → 자동 후보(Priority 순) → 잔여 플레이어 빈자리로 재분배. 같은 흐름.
- **동시성**: redraw 중 좌석 RPC 락(`FOR UPDATE`), 진행 중 다른 move는 큐/거절.
- **충돌**: lock 테이블·standby는 대상 제외. 빈자리 부족 시 "테이블 추가 필요" 안내.

---

## C. 등록 · 체크인 흐름 + 상태 라이프사이클

### C1. 상태 머신 (`ops_participants.status`)
```
        ┌──────────── reenter(재진입) ──────────┐
        ▼                                        │
   [registered] ──check-in──▶ [checked_in] ──seat/active──▶ [active]
        │(walk-in: 한 번에 active)                              │ bust
        └──────────────────────────────────────────────▶ [busted]→finish_position
   no_show: 등록했으나 미출석
```

### C2. 워크인 등록 (현장, 슬라이스1 주력)
```
PLAYERS 🟢 + 등록
  이름 [필수] · 국적? · 연락처? · 바이인
  ▼ [등록]
  - entry_number 자동부여(대회내 ++)
  - chips = starting_chips
  - auto_seat_on_register=ON → 즉시 빈자리 배정(랜덤) → status=active
    OFF → status=checked_in(대기 풀, 좌석은 redraw/수동)
  - claim_token 생성 → QR 슬립 출력/표시
  ▼
  QR 슬립: [QR] #33 · TABLE 98 · SEAT 5
```

### C3. 사전등록 + 체크인 (온라인/명단, 일부)
```
사전: CSV 벌크 등록 → status=registered (좌석X)
현장 도착: PLAYERS에서 검색 → Check-in
  → status=checked_in → (auto_seat or redraw로) 좌석배정→active
```
- 슬라이스1은 워크인 주력. CSV 벌크 + check-in은 가볍게(K-Holdem 패리티).

### C4. 재진입 / 리바이 (구분)
- **리바이/애드온**(생존 중 칩보충): `add_rebuy`/`add_addon` → count++ AND chips+= 원자.
- **재진입**(탈락 후 재참가): `reenter_participant` → status=active, chips=starting, finish_position=NULL, reentries++ (대회 `reentry_allowed`·`max_reentries` 가드). 새 좌석 배정.
- 등록 마감(`registration_open=false`) 시 신규/재진입 차단.

### C5. 탈락(Bust) → ITM
```
PLAYERS/좌석 → Bust out
  → status=busted, busted_at, finish_position=(현재 active 수)
  → ITM이면 prize_amount 계산
  → 좌석 free, ops_live_stats 갱신, ops_events 기록
  → 본인 라이브뷰: "10위로 종료 · 상금 13,000"
  → 우승자(rank1)는 별도 finalize
```

---

## D. 슬라이스 매핑
- **1a**: 등록(워크인)·PLAYERS·STATUS 통계·HISTORY(이벤트척추)·등록 토글.
- **1b**: TABLES·좌석·Redraw(1종)·move/free·lock/priority.
- **1c**: LEVELS·클럭·모니터·플레이어뷰·Realtime·live_stats.
- **1d**: Redraw 2종·bust(ITM)·재진입.
- **1e**: 스태프/딜러 배정.
- **1f**: PAYOUTS·상금.
