# 남은 작업 전량 착수 원장 — 2026-08-08

> **새 세션은 이 파일부터 읽는다.** 트랙 하나 = 세션 하나. 각 트랙은 **자립적**이라 골라 착수해도 된다.
>
> 기준: `origin/master` = **`1d230fdb2`** (#443 머지) · **2026-08-08 23시 실측** (§0 참조)
>
> 🤖 **다음 세션은 T6 · T7 · T9 · T3⑦ 를 ultracode 로 진행한다** — **§0-1 지침을 먼저 읽어라.**
>
> 🚨 **이 레포는 병렬 세션이 상시 활성이다.** 이 문서를 쓰는 동안에도 워크트리 3개가 돌고 있었고,
> 세션 하나 안에서 사실이 **네 번 뒤집혔다**(마이그 충돌이 이미 닫혀 있었고 · prod 미적용 1건이 0건이 됐고 ·
> T1 이 착지했고 · ⑦-4 E2E 가 문서를 쓰는 도중에 미커밋→완료로 바뀌었다).
> **§1 중복 착수 금지 표를 먼저 확인하고, 착수 직전에 `git fetch` + `git worktree list` 로 재실측하라.**

---

## §0. 현황 스냅샷 (2026-08-08 **23시 재실측** — 이번이 최신)

> ⚠️ 이 절은 세 번째 갱신이다. 앞선 두 스냅샷(`e53722b5c` 기준 · `20cb6bad9` 기준)은 폐기했다.
> 이 레포는 **한 세션 안에서 사실이 여러 번 뒤집힌다** — 착수 직전 재실측이 규칙이지 권고가 아니다.

| 축 | 값 |
|---|---|
| `origin/master` | **`1d230fdb2`** (#443) · 워킹트리 clean |
| **prod 미적용 마이그** | ✅ **0건** — `20260808230000` 까지 전부 기록됨(`list_migrations` 실측) |
| **DB 파리티** | ✅ **funcs 206 / policies 111** = 레포 기대값 일치(`parity_baseline_guard.test.sql:155-156`) |
| **branch protection** | ✅ 활성 — required = `Quality Gate` · `E2E Gate` |
| 롤아웃 | ✅ **정렬됨** — 웹 CF `f67a06d4`(source `20cb6ba`) · OTA `4103ed69-5804-4aa1-a8ab-06cb1e18cdb3`(runtime **1.0.5**, commit `1d230fdb2`) |
| 열린 PR | Dependabot 4건 — **#414·#415·#416 = CI 전량 pass·CLEAN** / **#380 = Quality-lint fail·BLOCKED** |
| `ops_hub_enabled` | `false` (OFF) — 단 **사용자가 "켤 예정"으로 확정**(2026-08-08). ⑦ 투자 근거가 성립한다 |

> ✅ **T1(롤아웃 비대칭)은 닫혔다.** #432~#442 가 웹·OTA 로 사용자에게 도달했다.
> 🚨 그 과정에서 실사고가 있었다 — **클라이언트가 서버보다 먼저 나갔다.** #441 머지분을 배포했는데
> 그 ops 마이그가 prod 에 없어 `ops_tournaments.archived_at` **42703** 으로 ops 조회가 전부 깨져 있었다.
> `ops_hub_enabled=false` 는 **안 막아준다**(결함⑥이 "(ops) 라우트는 의도적으로 열어 둔다"로 확정했기 때문).
> 🔑 **머지 ≠ 서버 반영. 배포 직전 `list_migrations` 로 클라이언트가 요구하는 스키마가 prod 에 있는지 먼저 볼 것.**

---

## §0-1. 🤖 다음 세션 = ultracode 실행 지침

사용자가 **T6 · T7 · T9 · T3⑦ 4트랙을 다음 세션에서 ultracode 로** 진행하기로 확정했다(2026-08-08).

- 착수 순서 권고: **T7(머지만) → T6(저위험 소형) → T9(조사 선행) → T3⑦(가장 무거움)**.
  T7·T6 은 서로 독립이라 팬아웃 가능. T3⑦ 은 범위 결정이 선행돼야 하므로 마지막.
- 🚨 **워크플로우 팬아웃은 5개 단위 배치**로. 버스트 한도로 전원 실패한 이력이 있다.
- 🚨 **에이전트가 한도로 죽으면 `verdict=null` 이 되고 이게 "기각"으로 오분류된다** —
  사유가 빈 기각은 **미검증**이지 통과가 아니다.
- 구현 트랙은 **트랙마다 전용 워크트리**. 메인 체크아웃은 읽기·계획 전용.
- 착수 직전 `git fetch` + `git worktree list` 재실측(§1).

---

## §1. 중복 착수 금지 — 다른 세션이 이미 하고 있는 것

착수 전 `git worktree list` 로 **살아 있는지 재확인**하라. 아래는 2026-08-08 시점 실측이다.

**`git worktree list` 실측 (2026-08-08 23시)** — 살아있는 워크트리는 **3개**다:

| 워크트리 | 브랜치 | 하고 있는 일 | 상태 |
|---|---|---|---|
| `T-HOLDEM` (메인) | `master` | 읽기·계획 전용 | clean |
| `T-HOLDEM-e2eops` | `test/ops-e2e-20260808` | ops E2E (⑦-4) | ✅ **완료 — 커밋 `b5b18f394` 미푸시**(위 참조) |
| `T-HOLDEM-opsurl` | `fix/ops-native-deeplink-20260807` | Android App Links 축소 + 1.0.6 bump | ⏸ **대기**(§T8) |

**정리된 것**(워크트리 소멸 — 재확인 불필요): `T-HOLDEM-ops4`(→#441 `f02d64b48`) ·
`T-HOLDEM-medium4`(→#442 `20cb6bad9`) · `T-HOLDEM-sf`(→ 브랜치 폐기, 아래 참조).

→ **MEDIUM 9건은 전량 착지했다**(5건 #439 + 4건 #442). LOW 12+ 만 남는다.
→ ops 는 **결함 ⑦ 의 3항목**(알림·정산 write-back·오프라인)만 남는다.

⚠️ `docs/next-session-prompts-20260808` **브랜치는 머지하지 말 것.** 이 통합 원장과 내용이 겹치고,
그 문서가 세운 전제 두 개가 #442 조사에서 **틀린 것으로 판명**됐다:

| 그 문서의 전제 | 실측 |
|---|---|
| MEDIUM 7 "0개 확정 허용 = 상태 기계 변경" | `applyDateSelection`(`scheduleCardEdits.ts:40-82`)이 **이미 정의해 뒀다** — UI만 막고 있었다 |
| MEDIUM 3 "저장 1회 = 알림 1통 위반" | 겹치는 통들은 **서로 다른 사실**이다 — 동작이 아니라 선언이 틀렸다 |

교훈은 `memory/project_merge_review_followups_20260807.md` 교훈 6·7·8 에 보존했다.

### ✅ prod 반영 대기 — 전량 해소됨 (2026-08-08 23시)

`20260808130000`(#442) + `20260808200000`·`210000`·`220000`·`230000`(#441) **5건 모두 적용 완료**.
`prod-migrate`(#437) 경로로 들어가 **레포 파일명 = prod 기록명**이다(재적용 금지 목록 관리가 쉬워졌다).

**파리티 실측**: prod **funcs 206 / policies 111** = 레포 기대값 일치. 주간 `parity-smoke` 는 green 이다.

🔑 **개수 일치는 정합이 아니다.** 한때 201=201 로 green 이던 적이 있는데 그건 **반대 방향 드리프트 2개의
상쇄**였다. 파리티가 red 면 총계보다 **어느 함수인지**부터 봐라.

### ✅ ⑦-4(E2E) 완료 — 단 **로컬 커밋이 미푸시**다 (착수 전 최우선 확인)

`test/ops-e2e-20260808` (워크트리 `T-HOLDEM-e2eops`) 에 커밋 **`b5b18f394`** 가 있다 —
`e2e/tests/p2-standard/ops-route-access.spec.ts`(71줄) · `ops-tournament-lifecycle.spec.ts`(186줄),
합계 257줄 신설. 결함 ②③④⑥ 의 브라우저 회귀망이다.

🚨 **upstream 이 없다(미푸시).** 이 머신을 잃거나 워크트리를 지우면 **소실된다.**
ultracode 세션의 **첫 작업은 이 브랜치를 push 하고 PR 을 여는 것**이다 — 새 작업보다 먼저.

→ **⑦-4 는 중복 착수 금지.** ⑦ 잔여는 **⑦-1 알림 · ⑦-2 정산 write-back · ⑦-3 오프라인** 셋이다.

### 🔴 신규 결함 — `/tournaments` 라우트 충돌 (⑦-4 작업 중 발견, **미수정**)

`(admin)` 과 `(ops)` 가 **같은 URL `/tournaments`** 를 쓴다. 맨 URL 은 admin 이 이겨
`app/(admin)/_layout.tsx:23` 이 **비-admin 을 홈으로 튕긴다** — 즉 ops 대회 목록에서
**새로고침(F5)하면 쫓겨난다.** 앱 내 네비게이션은 `/(ops)/...` 그룹을 명시하므로 정상이고,
깨지는 것은 **주소창 직접 입력·딥링크·새로고침**이다.

🔑 이건 결함⑥ 결정의 전제를 흔든다 — "(ops) 라우트는 딥링크 진입을 막지 않는다"는 판단이
**웹에서는 이미 깨져 있었다.** ⑦ 범위 결정 시 이 항목을 함께 저울질하라(수정 비용은 작고,
"켤 예정"인 플래그를 켠 직후 가장 먼저 밟게 될 자리다).

---

## T1. ✅ **완료** (2026-08-08) — prod 마이그 5건 → 웹배포 → OTA

착지 실적: 웹 CF `f67a06d4`(source `20cb6ba`) · OTA `4103ed69-5804-4aa1-a8ab-06cb1e18cdb3`
(runtime **1.0.5**, commit `1d230fdb2`) · prod 마이그 5건 적용 · 파리티 206/111.

⚠️ **아래 절차와 함정 목록은 지우지 않는다 — 다음 롤아웃에서 그대로 재사용한다.**
⚠️ 원장 초판의 `eas update --branch master` 는 **틀렸다**. 실제 EAS 채널·브랜치는 **`production`**
(`eas channel:view production` 실측).

```
#432~#442 를 웹과 OTA 로 내보낸다. 그 전에 prod 마이그 5건을 적용한다.

순서를 지켜라 — 마이그 → 웹 → OTA 다. 웹에는 AASA 가 실려 있고(#435 의 /jobs 패턴),
그건 네이티브 빌드가 아니라 public/ 의 배포물이라 웹으로만 전달된다.

1. prod 마이그 5건을 prod-migrate 워크플로우(.github/workflows/prod-migrate.yml)로 적용한다.
   파일 바이트 그대로 실어라 — 손으로 옮기면 주석 축약으로 정본이 갈리는데 동작이 같아
   테스트로도 안 잡힌다.
     20260808130000_notify_merge_comment_correction.sql          (#442, COMMENT 만)
     20260808200000_ops_no_show_event_types.sql                   (#441)
     20260808210000_ops_set_participant_no_show.sql               (#441)
     20260808220000_ops_defect3_event_types_and_archived_at.sql   (#441)
     20260808230000_ops_participant_edit_delete_archive_rpcs.sql  (#441)
2. 파리티 재실측 — funcs 가 202 → 206 이 되어야 한다(레포 기대값과 일치).
   안 맞으면 총계 전에 **어느 함수가 빠졌는지**부터 본다.
3. 로컬을 origin/master 로 맞춘다 (git fetch origin master:master)
4. 웹 배포: node scripts/deploy-cloudflare.js --force
5. OTA: eas update --branch master (커밋 필드가 origin/master HEAD 인지 확인)
6. 배포 후 번들 마커 검증

금지: 워크트리에서 웹 배포하지 말 것. 메인 체크아웃에서만.
```

**함정 (전부 실측 이력)**
- 🚨 **워크트리에서 웹 배포하면 빈 번들이 나온다** — 정션 때문에 expo-router 앱 루트가 잡히지 않아
  1.04MB/749모듈/**라우트 1개**짜리가 나온다. `verify-web-build.js` 게이트가 실제로 이걸 차단한 적이 있다.
  불가피하면 `EXPO_ROUTER_APP_ROOT` 절대경로 + `--clear` + 메인에서 `.env.local` 복사.
- 🚨 **detached HEAD 에서 배포하면 Preview 로 간다** — `--branch=master` 명시 필수.
- 🚨 **번들 마커 grep 은 거짓 음성이 두 가지** — 한글은 `\uXXXX` 로 이스케이프되고, CDN 엣지 캐시가 구 번들을 준다.
  `grep -F` 를 쓰고 **대조군(반드시 있어야 할 마커)을 같이 검사**하라.
- 🚨 **OTA 직전 재fetch + ff-merge 필수** — `eas update` 의 Commit 필드가 `origin/master` HEAD 와 같아야 한다.
- ⚠️ runtimeVersion 정책은 **appVersion**(현재 1.0.5)이다. `T-HOLDEM-opsurl` 을 먼저 머지하면
  1.0.6 으로 올라가 **설치된 1.0.5 기기가 전부 끊긴다** — T1 보다 먼저 머지하지 말 것.

**완료 판정**: 웹 라이브 번들에서 #434 또는 #436 유래 마커가 관찰되고, `eas update` 결과의
Commit 이 `origin/master` HEAD 와 일치.

---

## T2. 🔴 실기기 QA (사용자 게이트 — 사람이 해야 한다)

✅ **T1 이 끝났으므로 지금 착수 가능하다.** #432~#442 가 OTA `4103ed69`(runtime 1.0.5, commit
`1d230fdb2`)로 실기기에 도달해 있다. 지금 체크리스트는 이전 롤아웃(#420~#429) 기준이라 **범위가 모자란다.**

- 체크리스트: `docs/qa/2026-08-07-device-qa-checklist.md` (61항목)
- 🚨 앱을 **완전 종료 후 재실행**해야 OTA 가 적용된다. 체크리스트 **0번을 먼저** 하고, 실패하면 나머지는 무의미.
- 🔴 **#432~#442 범위 항목을 체크리스트에 추가해야 한다** — 특히 기존 체크리스트에 없는 것:
  실패/빈 상태 분리(#434) · 정산 수정 이력(#436) · 퇴근≥출근 검증(#433) · ops 링크 복구(#435) ·
  ops 노쇼/정정/삭제/보관(#441).
- ⚠️ ops 항목은 `ops_hub_enabled` 가 **OFF 라 허브 진입점이 없다** — `(ops)` 라우트로 직접 진입해야 한다
  (라우트는 결함⑥ 결정으로 의도적으로 열려 있다). 웹에서는 `/tournaments` 충돌로 새로고침 시 튕긴다(§1 참조).

누적 미검증 QA: Android 키보드 17화면 · 1.0.5 웨이브 전량 · 지도 앱 선택(#422) 등.

---

## T3. 🔴 ops 결함 ⑦ — 통합 공백 (①~⑥ 전부 닫힘, ⑦-4 도 닫힘)

정본 문서: **`docs/planning/2026-08-08-ops-defect7-integration-handoff.md`**
(선행 기록·재조사 금지 사실 = `2026-08-08-ops-defects-2-7-handoff.md` §⚡)

✅ **플래그 전제 확정**: 사용자가 `ops_hub_enabled` 를 **켤 예정**이라고 답했다(2026-08-08).
이전 판의 "플래그 ON 여부는 사용자 결정" 단서는 해소됐다 — ⑦ 투자는 정당화된다.
다만 **켜기 전에 있어야 하는 것 vs 나중에 얹어도 되는 것**의 구분은 여전히 범위 결정의 1축이다.

```
ops 결함 ⑦(통합 공백)을 닫는다. ⑦ 은 "버그"가 아니라 엔진이 앱의 나머지와 연결되지 않은
자리다. 첫 작업은 구현이 아니라 범위 결정이다.

선행 상태(2026-08-08 실측):
- 결함 ①~⑥ 전부 닫힘(#438, #441). ⑦-4(E2E)도 닫힘 — 단 로컬 커밋 b5b18f394 가 미푸시다.
  ★ 첫 작업 = test/ops-e2e-20260808 push + PR. 새 작업보다 먼저.
- ⑦ 잔여 3개: ⑦-1 알림 0건 · ⑦-2 정산 write-back 0건 · ⑦-3 오프라인 0건
- 별건 신규: /tournaments 가 (admin)·(ops) 충돌 → 웹 새로고침 시 ops 에서 쫓겨남(미수정)
- ops_hub_enabled 는 아직 OFF 지만 사용자가 "켤 예정"으로 확정했다

먼저 두 문서를 읽어라.
- docs/planning/2026-08-08-ops-defect7-integration-handoff.md  ← 4항목 실측·판단 축
- docs/planning/2026-08-08-ops-defects-2-7-handoff.md          ← 재조사 금지 사실

착수 규칙:
- 3항목은 독립 PR 이다. 한 PR 에 묶지 마라 — 전달 경로와 위험도가 다르다.
- 새 RPC 는 기존 ops SECDEF 규약을 따른다(actor 바인딩 → 값 검증 → FOR UPDATE →
  is_ops_member → 상태 게이트 → P0001 → ops_events append → anon 명시 REVOKE).
  규약 전문 = wiki/architecture/ops-engine.md
- 트리거를 추가·변경하면 `node scripts/graph-db-deps.mjs triggers` 로 중복부터 검사하라.
  이 레포에서 알림 트리거 중복은 실제로 2번 터졌다.
- ops 의 anon 실행가능 SECDEF 는 정확히 2개라는 불변 계약을 깨지 마라.
- 돈-흐름(바이인 결제·상금 지급)에는 관여하지 마라 — wiki/decisions/ops-no-money-flow.md.
  단 스태프 근무시간 write-back 은 금지 대상이 아니다(인건비는 기존 정산 파이프라인 소관).
- 마이그 접두사는 짓기 전에 git fetch 후 origin/master 의 같은 날짜 접두사를 재확인하라.

먼저 ⑦ 잔여 3개 중 무엇을 이번 범위로 할지 근거와 함께 제시하고 승인을 받아라.
```

**범위 결정 참고 (2026-08-08 실측 근거)**
- **⑦-1 알림**: ops→notification 참조 **0건**. 대회 중 무슨 일이 나도 스태프·참가자에게 앱 알림이
  안 간다. 플래그를 켜면 **스태프가 배정 사실을 앱에서 알 수 없다** → ON 전제조건 성격이 가장 강하다.
  ⚠️ 트리거 신설은 되돌리기 어렵고 중복 사고 2회 이력. `graph-db-deps.mjs triggers` 선행 필수.
- **⑦-2 정산 write-back**: `opsStaffService.ts:33` 단방향 스냅샷 import 만. 현장 근무시간이
  `work_logs` 로 안 돌아가 인건비 루프가 안 닫힌다(이중 입력). ⚠️ 정산 RPC 는 최근 대량 하드닝을
  거쳤다 — `payroll_status='completed'` 는 **동결**이고 `status NOT IN ('cancelled','no_show')`
  소프트 취소 필터가 필수다. 위험도 가장 높음.
- **⑦-3 오프라인**: ops 쪽 offline/queue 참조 0건. 앱에 이미 오프라인 자산이 있으니 **재구현 금지**.
  🔑 전량 큐잉이 아니라 **어느 액션이 재생 가능한가**의 분류가 선행(칩 카운트=절대값이라 큐잉 가능 /
  bust=순위 부여라 큐잉 위험). 설계 판단이 가장 무거워 마지막이 자연스럽다.

---

## T4. 🔴 보안 잔여 (외부 콘솔 작업 — 사람이 해야 한다)

```
공개 레포 시드 크리덴셜 사고(#427·#428)와 GitHub 하드닝(#375)의 미완 항목을 닫는다.
교훈 배경: wiki decisions/local-only-seed-reached-prod

1. 앱 심사노트 갱신 — 평문 비밀번호를 지운 뒤 심사용 계정 안내가 낡았다
2. 시드 계정 5번째 회전 — 문서는 4개라 했지만 prod 실측은 5개다. 1건이 미회전으로 남아 있다
   🔑 계정 수는 레포가 아니라 prod 에서 센다
3. Firebase Auth 비활성화 — 단 Firebase 프로젝트 tholdem-ebc18 자체는 FCM 때문에 삭제 금지
4. GCP 웹 API 키 3개 제한
5. GitHub ruleset 정비
```

---

## T5. 🔴 롤아웃 계기판 → #407 REVOKE 해제

가장 오래 막혀 있는 항목이다. 배경과 대안 3종: **wiki `decisions/rollout-instrumentation-gap`**

```
#407 의 구 경로 REVOKE 가 "롤아웃 확인 다음"이라는 조건에 막혀 무기한 대기 중이다.
문제는 그 조건을 판정할 수단이 없다는 것 — expo-insights 미설치, Sentry release/dist 미태깅,
앱 버전 서버 기록 0건. prod 트래픽이 users 27 이라 "기다려서 로그가 쌓이는" 방식은 성립하지 않는다.

셋 중 하나를 골라 실행한다:
(a) 측정을 만든다 — 앱 버전을 서버에 기록하거나 Sentry 에 release/dist 태깅
(b) 시간 기반으로 바꾼다 — "OTA 발행 후 N일" 처럼 관측 없이 판정 가능한 기준
(c) UNMEASURED 를 1급 결과로 두는 R3 게이트 설계를 채택
    (docs/analysis/2026-08-07-r3-gate-measurement-design.md)

🚨 순서를 뒤집으면 안 된다. 미전환 구 빌드가 남은 채 REVOKE 하면 그 빌드가 즉사한다.
```

---

## T6. 🔴 감사 M11 — 정산 `'failed'` 축 통일 (**정의 복원됨 · 잔여 4곳**)

✅ **"정의가 소실됐다"는 이 원장 초판의 서술은 틀렸다.** 정의는 온전히 남아 있다 —
**`docs/analysis/2026-08-01-work-schedule-wave-audit.md:55`** (표 행 전체). 초판이 `docs/analysis/` 를
확인하지 않았을 뿐이다. 재조사 금지.

> **M11 정의**: `payroll_status` 는 **3값**(`pending`·`completed`·`failed`)인데 UI 가
> `=== PENDING` / `=== COMPLETED` **2값 비교**로만 분기한다. `'failed'` 행에서는 상호배타 쌍의
> **두 분기가 모두 거짓**이 되어 버튼이 하나도 없는 빈 화면이 되는데, 배지는 '정산 대기'로 접혀 보인다.
> **올바른 형태는 `!== COMPLETED`** (`GroupedSettlementCard.tsx:131·138` 이 기준).

**잔여 실측 (2026-08-08)** — 감사가 지목한 6곳 중 **2곳은 이미 닫혔고 4곳이 남았다**:

| 위치 | 현재 | 판정 |
|---|---|---|
| `SettlementDetailModal/SettlementDetailModal.tsx:119`·`:228` | `isSettled = === COMPLETED` 단일 축 | ✅ **닫힘** (`:116` 주석이 "특별한 것은 completed 하나뿐"으로 축을 명시) |
| `SettlementCard.tsx:182` | `payrollStatus === STATUS.PAYROLL.PENDING` | 🔴 잔존 |
| `SettlementCard.tsx:208` | `payrollStatus === STATUS.PAYROLL.PENDING` | 🔴 잔존 |
| `SettlementList.tsx:152` | `(log.payrollStatus \|\| PENDING) === PENDING` | 🔴 잔존 |
| `SettlementList.tsx:135` | 필터 `(...) === selectedFilter`, `FilterStatus = 'all' \| PayrollStatus`(:81) | 🔴 잔존 — 필터 탭에 `failed` 진입로가 있는지 확인 필요 |

**휴면 여부 — 반쪽만 참이다 (실측)**
- prod `work_logs`: `pending` **6건**뿐, `failed` **0건**. 앱 writer 도 0곳. → 지금은 **도달 불가**.
- 🔴 **그러나 서버는 이미 받는다.** `set_work_log_payroll_status`
  (`20260802130000_set_work_log_payroll_status_rpc.sql:70`)가 `p_status IN ('pending','completed','failed')`
  로 `'failed'` 를 **유효값으로 허용**한다. `updateSettlementStatus(id, 'failed', …)` 경로도 서비스에 존재한다
  (`settlementService.test.ts:733` 이 통과를 단언). **writer 가 하나 생기는 순간 즉시 실활성 버그**가 된다.

```
감사 M11(정산 'failed' 축 통일)을 닫는다. 정의·잔여 위치·휴면 근거는 원장 T6 절에 전부 실측돼 있다 —
재조사하지 말고 바로 수정하라.

1. 잔여 4곳을 `!== COMPLETED` 축으로 통일한다:
   SettlementCard.tsx:182 · :208 · SettlementList.tsx:152 · :135(필터 축)
   기준 구현 = GroupedSettlementCard.tsx:131·138
2. 'failed' 행의 UI 어휘 계약을 깨지 마라 — 스태프 입장에서 'failed' 는 "아직 못 받았다"이므로
   pending 과 같은 칸에 든다(shared/status/types.ts:43). 단 금액 집계에서는 접지 않는다
   (scheduleService.ts:358). 이 둘은 서로 다른 축이고 둘 다 의도된 것이다.
3. 회귀 테스트는 payrollStatus='failed' 픽스처로 Red-Green 을 실측하라 — 수정을 되돌리면
   실패하는지 확인. 기존 픽스처가 이미 있다: SettlementDetailModal.actions.test.tsx:119 ·
   ConfirmedStaffCard.actions.test.tsx:91 · useSettlement.test.ts:981
4. 문구·상수를 건드리면 e2e/ 를 별도 grep 하라(eslint ignores 라 npm run quality 범위 밖).

배경: PR#393 이 판정 복제 2건 제거 + 렌더 가드 신설까지 했고 "축 통일"만 미완으로 남았다.
관련 wiki: sources/settlement-rpc-wave-2026-08
```

**규모**: 비교식 4곳 + 회귀 테스트. **저위험·소형**이고 DB 변경 없음 → 파리티 영향 0.

---

## T7. 🟡 Dependabot 4건 — **3건은 그린, 1건만 실작업**

**CI 실측 (2026-08-08, `gh pr checks` + `gh pr view`)** — 초판의 "#414 를 가장 조심하라"는 전제는
CI 상 재현되지 않았다. 오히려 #414 가 가장 깨끗하다.

| PR | 내용 | CI | 머지 상태 |
|---|---|---|---|
| **#414** | `supabase/setup-cli` 1.7.1→**3.0.0** | **DB Tests(pg_prove) pass · E2E pass · Quality pass** | ✅ MERGEABLE / CLEAN |
| **#415** | `actions/github-script` 7→9 | 전량 pass | ✅ MERGEABLE / CLEAN |
| **#416** | `postcss` 8.5.22→8.5.25 | 전량 pass | ✅ MERGEABLE / CLEAN |
| **#380** | `eslint-plugin-react-hooks` 5.2.0→**7.1.1** | 🔴 **Quality-lint fail** (E2E·format·rpc-migrations 는 pass) | 🔴 BLOCKED |

```
Dependabot PR 을 처리한다.

1. #414 · #415 · #416 은 CI 전량 green·CLEAN 이다. 머지한다.
   ⚠️ 단 CI 실행 시점이 2026-08-04 라 현재 master(1d230fdb2)보다 뒤처져 있다.
      머지 전 `gh pr checks` 로 재확인하고, 필요하면 `gh pr update-branch` 후 재실행한다.
   ⚠️ #414 는 setup-cli 메이저 2단계 점프다. 과거 이 드리프트가 db-tests/e2e 를 광범위하게
      red 로 만든 이력이 있다(wiki sources/db-tests-cli-grant-drift · e2e-cli-grant-drift).
      이번 CI 는 통과했지만 머지 직후 master 의 DB Tests / E2E 를 한 번 더 확인하라.
   → 한 번에 셋 다 머지하지 말고 #416 → #415 → #414 순으로 하나씩. 깨지면 범인이 명확해진다.

2. #380 만 실작업이다. lint 실패 로그부터 읽어라:
   gh run view <runId> --log-failed   (Quality - lint 잡)
   react-hooks 5→7 은 메이저 2단계라 규칙이 대거 바뀐다(신규 규칙 기본 활성화 가능).
   규칙별로 "코드를 고칠 것인가 / 규칙을 끌 것인가"를 판단해 근거와 함께 남겨라.
   무조건 off 로 덮지 마라 — react-hooks 규칙은 실제 버그를 잡는다.
```

⚠️ **`protection` 이 켜져 있어 base 가 뒤처진 PR 은 BLOCKED 로 표시된다** — `gh pr update-branch` 로 푼다.

---

## T8. ⏸ 대기 — 스토어 빌드 시점에만

**`fix/ops-native-deeplink-20260807`** (워크트리 `T-HOLDEM-opsurl`, HEAD `1eb6a601e`)

- 내용: Android App Links 축소(uniqn.app 전 경로를 삼키던 것을 iOS 와 같은 목록으로) + **version 1.0.6 bump**
- 🚨 **머지 즉시 이후 모든 OTA 가 runtime 1.0.6 으로 가서, 설치된 1.0.5 기기가 전부 끊긴다.**
  새 스토어 빌드를 낼 때 함께 처리해야 한다. **T1 성격의 롤아웃보다 먼저 머지하지 말 것.**
- ✅ **소실 위험 해소** — 초판의 "로컬 전용·미푸시" 경고는 **stale 이다.** 실측(`git branch -a`) 결과
  `origin/fix/ops-native-deeplink-20260807` 과 분리 전 안전판 `origin/archive/ops-original-20260807`
  **둘 다 origin 에 있다.** 워크트리를 지워도 사라지지 않는다.
- 짝인 AASA `/jobs` 는 웹 배포물이라 #435 로 이미 나갔다.

---

## T9. ⏸ 소소한 잔여 묶음 (한 세션에 몰아서)

```
오래 열려 있던 소소한 잔여를 한 번에 정리한다. 각각 독립적이라 순서는 무관하다.

- 정원 0 원인 B(축 미매칭) — #417 이 A·C 만 닫고 B 는 의도적으로 열어 뒀다. 닫을지 판단부터.
  배경: wiki sources/time-model-wave-2026-08
- iOS 스킴 판단(#411 지오코딩 후속)
- Rate Limits(#408 죽은 회로 정리 잔여)
- W2 10항목 · P0-3 / P0-4 (1.0.5 웨이브 잔여)
- 구 빌드 QR 거부 고지 — 사용자 공지 문안 필요
```

---

## §2. 금지사항 (모든 트랙 공통)

- 🚨 **다른 세션의 워크트리·브랜치를 건드리지 말 것.** 정리는 머지 확인 후에만.
- 🚨 **정션(`node_modules`) 해제는 `rm <path>` — 재귀 금지.** 재귀로 지우면 공유 원본이 날아가
  전 워크트리가 동반 사망한다. 복구는 `npm install` 이 아니라 **`npm ci`**.
- 🚨 **기존 마이그레이션 파일 수정 금지.** prod 반영 여부는 `list_migrations` 로 실측.
  새 마이그 파일명은 **머지 직전에** 같은 날짜 접두사를 재확인하라(08-07 에만 2회 충돌).
- 🚨 **마이그를 MCP 로 옮기지 말고 `prod-migrate` 워크플로우를 쓴다** — 주석이 축약되면 정본이 갈린다.
  이 경로로 넣으면 **레포 파일명 = prod 기록명**이라 재적용 금지 목록 관리도 쉬워진다.
- 🚨 **상수·enum·사용자 문구를 바꾸면 `e2e/` 를 별도 Grep** — eslint ignores 라 `npm run quality` 범위 밖이다.
- 🚨 master 직접 push 금지(E2E 우회). hotfix 도 PR 경유.
- 구현 세션은 **전용 워크트리**에서. 메인 체크아웃은 읽기·계획 전용.

## §3. 완료 요건

- `npm run quality` 통과 + 관련 테스트 실행 출력 제시(“통과할 것” 금지)
- 마이그를 건드렸으면 **파리티 기대값 재산정** — `기존값 ± 내 변화량` 이 아니라
  **`머지 시점의 master 값 ± 내 변화량`**. 마커(`PARITY_EXPECT_*`)와 단언 리터럴을 **동시** 갱신.
- PR 본문에 원인·검증 증거·prod 마이그 적용 여부·잔여를 명시

## §4. 참고

- 선행 원장: `2026-08-07-remaining-work-session-prompts.md`(S-A~S-G 전량 착지) ·
  `2026-08-07-full-audit-followup-prompt.md`(A1~A4 착지)
- ops 정본: **`2026-08-08-ops-defect7-integration-handoff.md`**(⑦ 착수) ·
  `2026-08-08-ops-defects-2-7-handoff.md`(①~⑥ 기록·재조사 금지 사실) ·
  선행 `2026-08-07-ops-completeness-defects-handoff.md`
- 🗑️ `2026-08-08-next-session-prompts.md`(브랜치 `docs/next-session-prompts-20260808`)는 **폐기됐다** —
  이 원장과 중복인 데다 전제 2개가 #442 조사에서 틀린 것으로 판명됐다(§1 참조). 되살리지 말 것.
- **M11 원 감사**: `docs/analysis/2026-08-01-work-schedule-wave-audit.md:55` ← T6 의 정의 출처
- 지식: `wiki/index.md` → `/query` 로 인용 답변. 08월 웨이브 교훈 16편이 wiki 에 있다.
- 세션 메모리: `MEMORY.md`(잔여·prod기록명·라이브함정만. 교훈 본문은 wiki)
