# ops 결함 ⑦ 통합 공백 — 다음 세션 착수 프롬프트 (2026-08-08)

> 상단 "프롬프트" 블록만 복사해 새 세션에 붙여넣으면 된다.
> 선행: 결함 ①②③④⑤⑥ **전부 닫힘**. ⑦이 ops 트랙의 마지막 항목이다.
> 선행 세션 기록 = `docs/planning/2026-08-08-ops-defects-2-7-handoff.md` §"⚡ 2026-08-08 진행 상황".

---

## 프롬프트 (복사해서 새 세션에 붙여넣기)

```
대회운영(ops) 엔진의 마지막 잔여인 결함 ⑦(통합 공백)의 범위를 정하고 착수한다.

배경: 결함 ①~⑥ 은 전부 닫혔다(칩 카운트·노쇼·정정/삭제/보관·날짜·unclaim 배선·라우트
게이트 결정). 엔진 자체는 라이브 운영 루프가 돌아가는 상태다. ⑦ 은 "버그"가 아니라
**엔진이 앱의 나머지와 연결되지 않은 자리** 4개다 — 알림·정산 write-back·오프라인 내성·E2E.
그래서 첫 작업은 구현이 아니라 **범위 결정**이다.

먼저 두 문서를 읽어라.
- docs/planning/2026-08-08-ops-defect7-integration-handoff.md  ← 이 문서(4항목 실측·판단 축)
- docs/planning/2026-08-08-ops-defects-2-7-handoff.md          ← ①~⑥ 착지 기록·재조사 금지 사실

착수 규칙:
- 전용 워크트리에서 작업한다. 메인 체크아웃은 읽기·계획 전용.
- 4항목은 **독립 PR** 이다. 한 PR 에 묶지 마라 — 전달 경로(OTA/웹/새 빌드)와 위험도가 다르다.
- 어느 항목을 먼저 할지는 §2 의 판단 축으로 정하고, **범위 결정을 먼저 제시**한 뒤 구현하라.
- 새 RPC 는 기존 ops SECDEF 규약을 따른다(actor 바인딩 → 값 검증 → 행 FOR UPDATE →
  is_ops_member → 상태 게이트 → P0001 → ops_events append → anon 명시 REVOKE).
  규약 전문 = wiki/architecture/ops-engine.md, 최신 실례 =
  supabase/migrations/20260808230000_ops_participant_edit_delete_archive_rpcs.sql
- 트리거를 추가·변경하면 `node scripts/graph-db-deps.mjs triggers` 로 중복을 먼저 검사하라
  (레포 루트에서). 알림 트리거 중복은 이 레포에서 **실제로 2번** 터졌다.
- 마이그 접두사는 짓기 전에 `git fetch` 후 origin/master 의 같은 날짜 접두사를 확인하라.
- 상수·enum·사용자 문구를 바꾸면 `e2e/` 를 별도 grep 하라(eslint ignores 라 quality 범위 밖).
- 완료 주장 전에 이 세션에서 실행한 검증 출력을 제시한다.

먼저 ⑦ 4항목 중 무엇을 이번 세션 범위로 할지 근거와 함께 제시하고 승인을 받아라.
```

---

## §0. 선행 상태 (중복 착수 금지 · 2026-08-08 실측)

| 항목 | 값 |
|---|---|
| 결함 ①~⑥ | ✅ 전부 닫힘 |
| prod 플래그 | `ops_hub_enabled = false` (여전히 OFF) |
| prod 함수/정책 | 마이그 4건 적용 전 **202/111** → 적용 후 **206/111** |
| `ops_event_type` | 적용 후 **38값** |
| repo·CI 기대값 | `PARITY_EXPECT_FUNCS=206` · `POLICIES=111` |
| anon 실행가능 ops SECDEF | **2** (`ops_get_monitor_snapshot`·`ops_get_player_view`) — 불변 계약 |
| ops 관련 pgTAP | 36파일(신규 `ops_set_participant_no_show`·`ops_participant_edit_delete_archive` 포함) |
| ops E2E | **0건** ← ⑦-4 의 대상 |

🔴 **prod 미적용 마이그 4건이 있으면 먼저 확인하라.** `list_migrations` 로 실측하고, 없으면
#437 워크플로우로 **enum → RPC 순서**로 싣는다(`ALTER TYPE … ADD VALUE` 는 같은 트랜잭션에서
쓸 수 없다):
`20260808200000` → `20260808210000` → `20260808220000` → `20260808230000`.

---

## §1. ⑦ 4항목 — 실측 근거

### ⑦-1. 알림 연동 0건
- `src/services/ops`·`src/hooks/ops` 에 notification 참조 **0건**.
- 즉 대회 운영 중 어떤 일이 나도 **참가자·스태프에게 앱 알림이 가지 않는다.**
- 후보 트리거 지점: 스태프 배정/해제(`ops_staff`) · 대회 시작(`status → active`) ·
  좌석 배정(claim 된 참가자) · bust/ITM. 어느 것이 실제로 필요한지는 **타깃 기준으로 판단**하라
  (홀덤펍 사장 = 스태프 알림이 값 · 대회사 운영팀 = 대회 일정 알림이 값).
- ⚠️ 이 레포의 알림 트리거는 **중복이 2번 터졌다**(`20260620151331` 체크인 ·
  `20260726000000` 리뷰·문의·대회 3쌍). 새 트리거 전 `graph-db-deps.mjs triggers` 필수.
- ⚠️ 알림 문구·수신자 타입은 기존 `notifications` 규약을 따라야 한다 — ops 전용 타입을
  새로 만들 것인지가 첫 결정이다.

### ⑦-2. 근무기록/정산 write-back 0건
- 스태프는 공고 `work_logs` 에서 **단방향 스냅샷 import** 만 된다(`opsStaffService.ts:33`).
- 즉 대회 현장에서 딜러가 실제로 몇 시간 일했는지가 **`work_logs` 로 돌아가지 않는다** →
  정산은 여전히 공고 쪽에서 수동이다. ops 를 켜도 인건비 루프가 닫히지 않는다.
- 🔴 **돈-흐름 경계 주의**: `wiki/decisions/ops-no-money-flow.md` 는 바이인 결제·상금 지급
  레일을 금지한다. 스태프 **근무시간 write-back 은 그 금지 대상이 아니다**(인건비는 기존
  정산 파이프라인 소관) — 다만 정산 RPC 는 최근 대량 하드닝을 거쳤으므로
  `update_work_log_custom_settlement`·`settle_work_log`·`set_work_log_payroll_status` 의
  계약을 먼저 읽어라. 특히 `work_logs.payroll_status='completed'` 는 **동결**이다.
- ⚠️ `work_logs` 읽기·쓰기는 소프트 취소 필터가 필수다 —
  `AND wl.status NOT IN ('cancelled','no_show')` (프로젝트 규칙 supabase-patterns §11).

### ⑦-3. 오프라인 내성 0
- ops 쪽 offline/queue 참조 **0건**. 현장 와이파이가 불안정하면 변이가 그대로 실패한다.
- 앱에는 이미 오프라인 UI 전역 승격분이 있다(`project_offline_ui_decision`) — **재구현 금지**,
  그 자산 위에 얹어라.
- 🔑 판단 축: ops 변이는 대부분 **서버 원자 RPC**다(entry_number 할당·좌석 단일점유·
  bust 순위·상금). 낙관적 큐잉은 **순서가 결과를 바꾸는** 연산에서 위험하다.
  → 전량 큐잉이 아니라 **어느 액션이 재생 가능한가**를 먼저 분류하라
  (칩 카운트=절대값 마지막쓰기승리 → 큐잉 가능 / bust=순위 부여 → 큐잉 위험).

### ⑦-4. E2E 0건
- `e2e/` 에 ops 스펙 **0건**. ①~⑥ 은 모두 jest + pgTAP 으로만 덮여 있다.
- 🚨 **`accessibilityState` 는 웹에서 무효다**(react-native-web 0.21.2 실측). E2E 상태 판별은
  `aria-*` 가 아니라 **판정 대상의 가시성**으로 해라.
- ⚠️ `e2e/` 는 eslint ignores 라 `npm run quality` 가 못 잡는다 — 상수·문구를 참조하면
  변경 시 조용히 깨진다. E2E 에 하드코딩할 문구를 최소화하라.
- 🔴 **플래그가 OFF 라 발견 표면이 없다.** ops E2E 는 `(ops)` 라우트로 **직접 진입**해야 한다
  (라우트는 의도적으로 열려 있다 — 결함⑥ 결정, `app/(ops)/_layout.tsx` 헤더 주석).

---

## §2. 범위 결정 판단 축

| 축 | 질문 |
|---|---|
| **플래그 ON 의 전제조건인가** | ON 하기 전에 반드시 있어야 하는 것 vs 나중에 얹어도 되는 것 |
| 전달 경로 | OTA 로 가는가 · 웹 배포가 필요한가 · 새 스토어 빌드가 필요한가 |
| prod 마이그 필요 | 필요하면 #437 워크플로우 순서에 편입 |
| 되돌릴 수 있는가 | 트리거·REVOKE 는 롤아웃 확인이 선행 조건(#407 이 막혀 있는 이유와 동일) |
| 실사용 0 상태에서 검증 가능한가 | prod 실사용이 사실상 0이라 계기판이 없다 |

권고(강제 아님): **⑦-4(E2E) → ⑦-1(알림) → ⑦-2(정산 write-back) → ⑦-3(오프라인)**.
E2E 는 프로덕션 위험이 0이고 나머지 3개의 회귀망이 된다. 오프라인은 설계 판단이 가장 무겁고
"어느 액션이 재생 가능한가" 분류가 선행이라 마지막이 자연스럽다.

---

## §3. 금지사항

- `mcp__supabase__*` 로 **기존 마이그레이션을 수정하지 마라**. 신규 마이그만 추가한다.
- prod 에 이미 적용된 마이그를 재적용하지 마라 — 착수 전 `list_migrations` 실측.
  ⚠️ 레포 파일명과 prod 기록명이 다른 건이 여럿이다. 파일명만 보고 판단 금지.
- ops 의 **anon 실행가능 SECDEF 는 정확히 2개**라는 불변 계약을 깨지 마라.
  신규 함수는 PUBLIC/anon EXECUTE 를 상속하므로 **매번 명시 REVOKE**.
- 돈-흐름(바이인 결제·상금 지급 레일)에는 관여하지 마라 — `wiki/decisions/ops-no-money-flow.md`.
- `ops_events` 는 append-only 다. UPDATE/DELETE 를 시도하지 마라(트리거가 P0001 로 접는다).
- 상수·enum·사용자 문구를 바꾸면 `e2e/` 를 **별도 grep** 하라.

---

## §4. 검증 요건

- 신규 RPC 는 pgTAP 로 증명하라. ⚠️ RLS 테이블의 "0건"은 "행이 없다"가 아니라 "안 보인다"일
  수 있다 — 단언은 행이 보이는 역할에서.
- 회귀 테스트는 **Red-Green** 을 확인하라(수정을 되돌리면 실패하는지). ①~⑥ 에서 6회 실측했다.
- 함수/정책을 늘리면 `parity_baseline_guard` 의 **리터럴 + `PARITY_EXPECT` 마커 + 헤더 서술**을
  동시 갱신하라. 🔑 숫자가 우연히 같으면 머지 충돌이 안 난다 — 충돌 없음이 안전 신호가 아니다.
- enum 값을 늘리면 `ops_staff_schema.test.sql` 의 집합 단언도 갱신된다(가드가 실제로 잡는다).
- 완료 주장 전 `npm run quality` + jest + pgTAP 출력을 제시하라.
- ⚠️ 로컬 Docker 스택은 **병렬 세션과 공유**다. pgTAP 실패가 내 변경 때문인지 먼저 가려라.

---

## §5. 참고 문서

- ①~⑥ 착지 기록·재조사 금지 사실: `docs/planning/2026-08-08-ops-defects-2-7-handoff.md`
- 엔진 구조·쓰기 경계·불변 계약·⑥ 결정: `wiki/architecture/ops-engine.md`
- 돈-흐름 경계: `wiki/decisions/ops-no-money-flow.md`
- 5레이어 쓰기 경계: `wiki/architecture/layers.md`
- ops 후속 이력: `wiki/sources/ops-followups-2026-08.md`
