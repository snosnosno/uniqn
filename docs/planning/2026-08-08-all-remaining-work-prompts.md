# 남은 작업 전량 착수 원장 — 2026-08-08

> **새 세션은 이 파일부터 읽는다.** 트랙 하나 = 세션 하나. 각 트랙은 **자립적**이라 골라 착수해도 된다.
>
> 기준: `origin/master` = **`a10d63281`** (#416 머지) · **2026-08-08 ultracode 세션 착수 시점 실측** (§0 참조)
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
| `origin/master` | **`09b36efe4`** (#453) · 워킹트리 clean · **워크트리 1개**(전량 정리됨) |
| **prod 미적용 마이그** | 🔴 **2건** — `20260809100000`(⑦-1) · `20260809110000`(⑦-2). prod 최신은 `20260808230000`(`list_migrations` 실측) |
| **DB 파리티** | 레포 기대값 **funcs 208 / policies 111** — **prod 는 아직 206**. 위 2건 적용 후 일치한다 |
| **branch protection** | ✅ 활성 — required = `Quality Gate` · `E2E Gate` |
| 롤아웃 | 🔴 **끊겼다** — 웹 CF `f67a06d4`(source `20cb6ba`) · OTA `4103ed69…`(runtime **1.0.5**) 인데 **master 의 앱 버전은 이제 1.0.6**(#444). 아래 🚨 참조 |
| 열린 PR | **#380 하나뿐** — react-hooks 7.1.1, **Expo SDK 57 전까지 머지 불가**(T7 절 참조). 나머지 Dependabot 3건은 머지 완료 |
| `ops_hub_enabled` | `false` (OFF) — 단 **사용자가 "켤 예정"으로 확정**(2026-08-08). ⑦ 투자 근거가 성립한다 |

> ✅ **T1(롤아웃 비대칭)은 닫혔다.** #432~#442 가 웹·OTA 로 사용자에게 도달했다.
> 🚨 그 과정에서 실사고가 있었다 — **클라이언트가 서버보다 먼저 나갔다.** #441 머지분을 배포했는데
> 그 ops 마이그가 prod 에 없어 `ops_tournaments.archived_at` **42703** 으로 ops 조회가 전부 깨져 있었다.
> `ops_hub_enabled=false` 는 **안 막아준다**(결함⑥이 "(ops) 라우트는 의도적으로 열어 둔다"로 확정했기 때문).
> 🔑 **머지 ≠ 서버 반영. 배포 직전 `list_migrations` 로 클라이언트가 요구하는 스키마가 prod 에 있는지 먼저 볼 것.**

### 🏁 ultracode 세션 결과 (2026-08-08) — **T6·T7·T9·T3⑦ 전량 착지**

| 트랙 | 결과 |
|---|---|
| **T6** M11 정산 축 통일 | ✅ #448 `e9ec81aad` — 원장이 지목한 4곳 + **5번째(`SettlementList:171` 필터 카운트)** |
| **T7** Dependabot | ✅ #416·#415·#414 머지 · 🔴**#380 은 SDK 57 전까지 불가**(버전 천장, T7 절) |
| **T9** 소소한 잔여 | ✅ 6항목 재실측 — **코드 작업 잔여 0개**(T9 절) |
| **T3⑦** ops 통합 공백 | ✅ ⑦-4 #446 · ⑦-3 #451 · ⑦-1 #452 · ⑦-2 #453 |
| 별건 `/tournaments` 충돌 | ✅ #449 `fa8c614c9` |

🔴 **다음 세션이 가장 먼저 할 일 = prod 마이그 2건 적용.** 머지는 끝났지만 **서버에 없다** —
T1 실사고(클라이언트가 서버보다 먼저 나감)와 같은 형태다. `prod-migrate` 로 파일 바이트 그대로:
`20260809100000_ops_staff_assignment_notification.sql` · `20260809110000_ops_resolve_staff_work_logs.sql`
적용 후 파리티가 **208/111** 이 되어야 한다.

🔴 **⑦-2 는 UI 한 겹이 미구현**이다(데이터 계층만 착지). 후속 구현 규칙 =
`docs/planning/2026-08-08-ops-attendance-writeback-design.md` §7.

🔴 **새로 드러난 사람 게이트 2건**: ① **Supabase Rate Limits 콘솔 확인** — #406 이 클라 로그인
잠금을 지운 뒤 서버 한도를 아무도 안 봤다. 브루트포스 방어선이 0일 수 있고 레포로는 증명 불가(T9 절).
② **인앱 업데이트 안내 경로가 0개** — OTA 가 잠긴 지금 도달 경로가 스토어뿐인데 알릴 수단이 없고,
이건 OTA 로 못 고친다(고치는 코드가 새 빌드에만 실린다).

---

### 🚨 최우선 신규 사실 — **T8 이 머지됐고 OTA 채널이 잠겼다** (ultracode 세션 착수 시 발견)

> 🤖 **사용자 확정(2026-08-08): 아래 세 갈래 중 「3. 그대로 두고 감수」.** 버전 원복 없음.
> 코드는 master 에 쌓고 새 스토어 빌드 때 한꺼번에 나간다. **그때까지 `eas update` 발행 금지.**

이 원장 앞 판이 "⏸ 새 스토어 빌드 시점에만 머지"로 못박아 둔 `fix/ops-native-deeplink-20260807` 이
**이미 `#444`(`0c580cf05`)로 master 에 들어갔다.** 그 커밋은 `package.json` 의 **version 1.0.5 → 1.0.6** 을 포함한다.

| 축 | 값 |
|---|---|
| master 앱 버전 | **1.0.6** (`uniqn-mobile/package.json`, `git show 0c580cf05 -- uniqn-mobile/package.json` 실측) |
| runtimeVersion 정책 | `appVersion` — 즉 **runtime = 1.0.6** |
| 사용자 기기에 설치된 빌드 | **1.0.5** (마지막 스토어 빌드) |
| 마지막 OTA | `4103ed69…` runtime **1.0.5** |

**귀결: 지금 master 에서 `eas update` 를 발행하면 runtime 1.0.6 으로 나가고, 설치된 1.0.5 기기는 그것을 받지 않는다.**
#444 커밋 본문 스스로 이 위험을 경고하고 있다 — *"머지 = 새 빌드 시점. 그전에 머지하면 OTA 채널이 잠긴다."*

**이번 세션 이후의 모든 클라이언트 수정(T6·T3⑦ 포함)은 OTA 로 전달되지 않는다.**
전달 경로는 **새 스토어 빌드뿐**이다. 세 갈래 중 하나를 골라야 한다:

1. **새 스토어 빌드를 낸다** — #444 의 원래 전제. 이후 작업이 정상적으로 흐른다. (사람 게이트)
2. **1.0.5 로 되돌린다**(revert 아님 — 버전만 원복) — 1.0.5 기기에 OTA 를 계속 보낼 수 있으나,
   #444 의 Android intentFilter 축소는 네이티브 구성이라 어차피 OTA 로 전달되지 않는다.
   즉 되돌려도 **#444 의 실효는 새 빌드까지 유예될 뿐**이고, 대신 그때까지의 JS 수정은 계속 전달된다.
3. **그대로 둔다** — 새 빌드까지 사용자에게 아무 수정도 도달하지 않음을 감수한다.

🔴 **이 결정은 사용자 게이트다.** 결정 전까지 `eas update` 를 발행하지 말 것 —
발행하면 1.0.5 기기가 조용히 누락된 채 "배포했다"로 기록된다.

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
| `T-HOLDEM-e2eops` | `test/ops-e2e-20260808` | ops E2E (⑦-4) | ✅ **push 완료 · PR #446 열림** — 소실 위험 해소됨 |
| `T-HOLDEM-opsurl` | ~~`fix/ops-native-deeplink-20260807`~~ | Android App Links 축소 + 1.0.6 bump | ✅ **머지됨(#444)** — 워크트리는 `master` 로 남아 있음. 정리 대상 |

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

> ## ✅ **T7 종결 (2026-08-08 ultracode)**
>
> **3건 머지 완료**: #416 `a10d63281` → #415 `a956142f1` → #414 `a1cd5f4cc` (하나씩, 순서대로).
> #414 는 setup-cli 메이저 2단계라 08-04 base 의 통과를 그대로 신뢰하지 않고 `gh pr update-branch` 로
> **현재 master 기준 CI 를 재실행한 뒤** 머지했다 — DB Tests(pg_prove) 2m17s pass · E2E 9m20s pass.
> 우려하던 setup-cli grant 드리프트는 재현되지 않았다.
>
> ### 🔴 #380 은 "규칙 판단" 문제가 아니었다 — **버전 천장**이다 (재조사 금지)
>
> Quality-lint 실패의 실체는 lint 룰 위반이 아니라 **설정 로딩 에러**다:
> `ConfigError: Config (unnamed): Key "plugins": Cannot redefine plugin "react-hooks".`
>
> 원인은 **플러그인 이중 등록**이다. `uniqn-mobile/eslint.config.js:18` 이 `...expoConfig`
> (`eslint-config-expo/flat` — 주석 스스로 "React Hooks 포함"이라 적고 있다)를 펼치고,
> **:50 이 `'react-hooks': reactHooksPlugin` 으로 같은 이름을 또 등록**한다.
>
> | 축 | 값 |
> |---|---|
> | 우리 직접 의존 | `eslint-plugin-react-hooks: ^5.2.0` (`package.json:128`) |
> | `eslint-config-expo@55.0.1` 요구 | `^5.1.0` |
> | 실제 설치 | 루트에 **5.2.0 하나** · `eslint-config-expo/node_modules/` 에 중첩 사본 **없음** |
>
> 두 범위가 하나로 dedupe 되어 **같은 객체**이기 때문에 ESLint 가 이중 등록을 눈감아 준다.
> 우리 쪽만 7.1.1 로 올리면 expo 용 **5.x 중첩 사본이 생겨 서로 다른 객체 2개**가 되고, 그 순간 하드 에러다.
>
> 🔑 **해소 조건은 우리 코드가 아니라 expo 쪽 천장이다** — `eslint-config-expo@57.0.1` 은
> `eslint-plugin-react-hooks: ^7.0.0` 을 요구한다(`npm view` 실측). 우리는 `@55.0.1`(Expo SDK 55)이다.
> → **Expo SDK 57 업그레이드 때 같이 풀린다.** 그때까지 #380 은 머지 불가다.
>
> 🚨 **하지 말아야 할 두 가지**
> 1. 규칙을 `off` 로 덮어 뚫기 — 실패는 룰이 아니라 설정 로딩이라 애초에 안 통한다.
> 2. `eslint.config.js:50` 의 중복 등록만 지워 "통과시키기" — 그러면 룰이 **expo 의 5.x** 에 바인딩되고
>    루트의 7.x 는 설치만 된 채 **아무 효과가 없다.** 업그레이드했다는 착각만 남는다.

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

## T8. ✅ **머지됨** (#444 `0c580cf05`) — 단 **후속 결정이 열려 있다**

> ⚠️ 이 절의 앞 판은 "⏸ 대기 — 스토어 빌드 시점에만"이었다. **그 상태는 지났다.**
> ultracode 세션 착수 시 `git fetch` 로 발견: 브랜치는 이미 머지됐고 origin 에서 삭제됐다.

- 내용: Android App Links 축소(uniqn.app 전 경로를 삼키던 것을 iOS 와 같은 목록 7종으로) + **version 1.0.5 → 1.0.6**
- 안전판 `origin/archive/ops-original-20260807` (`2c686291e`)는 **여전히 origin 에 있다.**
- 짝인 AASA `/jobs` 는 웹 배포물이라 #435 로 이미 나갔다.

🚨 **머지되면서 앞 판이 경고한 그 일이 실제로 일어났다** — OTA 채널이 runtime 1.0.6 으로 옮겨갔고
설치된 1.0.5 기기는 이제 어떤 OTA 도 받지 못한다. **§0 의 "🚨 최우선 신규 사실" 절이 이 항목의 현재 상태다.**
남은 것은 브랜치 관리가 아니라 **전달 경로 결정(새 빌드 / 버전 원복 / 감수)** 이고, 그건 사용자 게이트다.

- 정리 대상: 워크트리 `T-HOLDEM-opsurl`(브랜치가 사라져 `master` 로 남아 있다).

---

## T9. 소소한 잔여 묶음 — **6항목 전량 재실측 완료 (2026-08-08 ultracode)**

> ⚠️ 앞 판의 "6항목 묶음" 표현은 **틀렸다.** 실측 결과 **코드 작업이 남은 항목은 0개**다 —
> 2건은 이미 닫혔고, 1건은 전제가 사라졌고, 1건은 열린 채가 옳고, 1건은 사람이 콘솔에서 볼 일이고,
> 1건만 진짜 잔여인데 그건 "소소"하지 않다(4~5주). **재조사 금지 — 아래가 실측 결과다.**

| 항목 | 판정 | 남은 일 |
|---|---|---|
| iOS 스킴(#411) | ✅ **닫힘** | 없음 (문서 정리만) |
| P0-3 / P0-4 | ✅ **닫힘** | 없음 (문서 정리만) |
| 구 빌드 QR 고지 | 🗑️ **전제 소멸** | 없음 — 단 **대체 잔여가 나왔다**(아래) |
| 정원 0 원인 B | ⏸ **열린 채가 옳다** | 착수 게이트 교체 |
| Rate Limits(#408) | 🔴 **사람 게이트** | 콘솔 확인 1건 (코드 0) |
| W2 10항목 | 🔴 **유효하나 XL** | 별도 세션 (4~5주) |

### ✅ iOS 스킴(#411) — 닫힘

잔여의 실체는 "iOS `Info.plist` 에 `LSApplicationQueriesSchemes` 를 선언해 `nmap://` 후보를 살릴 것인가"였는데,
**PR#422**(2026-08-06 머지)가 그 전제를 통째로 없앴다. 지도 열기를 '경로안내 후보 + `canOpenURL` 게이트'에서
'사용자가 지도앱을 직접 고르는 경로 + 위치표시'로 재설계했고, 그 결과 `mapLink.ts:386-391` 에서
커스텀 스킴이 나오는 경로는 `probe: false`(canOpenURL 미경유), `probe: true` 인 기본 경로는 후보가 전부 https 로 갈렸다.
→ **iOS 에서 `canOpenURL` 이 커스텀 스킴에 호출되는 코드 경로가 존재하지 않으므로 선언이 필요 없다.**

🚨 **거꾸로 가지 마라** — `LSApplicationQueriesSchemes` 를 *추가*하면 네이티브 구성 변경이라 version bump 를
유발하고, 그 순간 §0 의 OTA 채널 잠김이 한 번 더 일어난다. **이득 0, 비용 큼.**

### ✅ P0-3 / P0-4 — 닫힘

08-02~08-08 웨이브가 흡수했다. **P0-4** = `get_my_venue_contexts` SECDEF RPC(prod `20260730185559`) +
`scheduleService.resolveContainerContexts` 배선. **P0-3** = `update_venue_slot` 대신 **`update_work_log_slot`**
SECDEF RPC(prod `20260802114709`, 이후 확장)로 승격 — `edited_by=auth.uid()` 서버 스탬프 + 이력 append.

📝 로드맵이 처방한 "`get_my_venue_role_salaries` 컬럼 확장"은 **반증되고 별도 RPC 로 대체**됐다
(그 함수의 CROSS JOIN LATERAL 때문에 단가 미설정 지점이 0행이 된다 — 사유는 마이그 주석 :14-18).
남은 REVOKE 는 P0-3 이 아니라 **#407**(T5)이고 계기판 부재라는 별도 차단 요인 위에 있다.

### 🗑️ 구 빌드 QR 거부 고지 — 전제 소멸, 단 **대체 잔여가 나왔다**

"구 빌드 QR 거부"의 실제 원인은 토큰 포맷·서명 변경이 아니라 `process_qr_checkin_atomically` 의 checkIn 가드를
**블랙리스트 → 화이트리스트로 뒤집은 것**이다(`20260727160000`, W1-8/#360). 새 거부코드 3종의 한글 매핑은
같은 PR 로 클라(`WorkLogRepositoryTransactions.ts:86-99`)에 들어갔고, 매핑 없는 번들은 영문 raw 코드를 노출한다.

**그런데 prod 실측이 전제를 무너뜨린다**: `work_logs` 총 6행(scheduled 5·checked_out 1), `cancelled`/`completed`/`no_show`
**0건** → 신규 거부코드 3종은 **발화 자체가 불가능**하다. 유일하게 발화 가능한 `already_checked_in` 은 전환 이전부터
있던 코드라 모든 구 빌드가 이미 한글로 매핑한다. QR 포맷도 안 깨진다. → **고지할 사건이 없다.**

🔴 **대신 훨씬 큰 것이 드러났다 — 인앱 "업데이트 안내" 경로가 0개다.**
§0 에서 OTA 가 잠긴 지금 사용자에게 도달하는 유일한 길이 **스토어 업데이트**인데, 그걸 **알릴 인앱 수단이 없다.**
그리고 이건 OTA 로 못 고친다(고치는 코드 자체가 새 빌드에만 실린다) → **새 스토어 빌드 결정과 한 묶음이다.**

📝 `docs/qa/2026-08-07-device-qa-checklist.md:151-157` 의 9번("업데이트 안내 문구가 보인다")은 **현재 코드로 달성
불가능**하다. "해당없음 — 트리거 데이터 0건, 안내 UI 미구현"으로 정정해야 한다. 추정 통과로 남기면 QA 가 거짓 보고를 만든다.

### ⏸ 정원 0 원인 B(축 미매칭) — 열린 채가 옳다. 단 **착수 게이트를 교체하라**

B 는 지금도 살아 있다(레포·prod 양쪽 확인). `confirm_application` 은 정원 조회가 0행이면 `v_capacity` 가 NULL 이 되고
`IF v_capacity IS NOT NULL AND ...`(`20260804140000:168`) 때문에 가드를 통째로 건너뛴다. prod 활성 `work_logs` 6건 중
**축 미매칭 3건**이 실재한다(전부 `application_id` 없음 = 직접 배치 경로).

**닫지 말아야 할 이유는 PR#417 이 적은 것이 아니라 새로 확인한 두 가지다:**
1. 🔑 **컨테이너 자유슬롯 설계가 이 fail-open 에 의존한다.** `softTargets.ts:4-6` 이
   *"requirements 에 넣으면 `add_direct_staff` 의 MAX_CAPACITY 하드가드가 발동해 자유 슬롯이 막힌다"* 고 명시했고,
   prod 컨테이너 공고(`status='container'`, requirements 0개)에 실제로 2건이 그 상태로 살아 있다.
2. 🔑 **형제 함수 `add_direct_staff` 가 아직 #417 의 NULL 규약을 안 따른다**(`20260803120000:336-356` 의
   `COALESCE(MAX(count),0)` + `v_capacity > 0` 레거시 그대로). 여기서 `confirm_application` 만 더 조이면
   **두 함수가 또 다른 말을 하게 되고, 그게 바로 #417 이 없앤 분열(A 버그)의 재발 형태**다.

반대로 PR#417 이 든 이유("공고 수정으로 슬롯이 사라진 뒤 남은 지원자를 확정하는 정상 경로가 막힌다")는
**클라이언트가 이미 같은 조건에서 막고 있어**(`ApplicationRepositoryTransactions.ts:82` → `slotCapacity.ts:124-139`
→ `MaxCapacityReachedError`) 실질적으로 무효다. 즉 지금 닫는 것은 **UX 변화 없는 심층방어 1겹**이다.

🚨 **착수 게이트를 바꿔라.** 기존 게이트인 "`capacity unknown (guard skipped)` 로그 관측"은 **원리적으로 충족 불가**다
(prod 트래픽이 없어 로그가 안 쌓인다 — #407 과 같은 구조적 제약). 새 게이트 = **① `add_direct_staff` 를 같은 NULL 규약으로
올리고 ② 컨테이너/자유슬롯을 명시 예외로 파고 ③ pgTAP `capacity_zero_fail_closed.test.sql:173-191` 의 4번 계약을 뒤집는다.**
이건 "소소한 잔여" 한 줄이 아니라 **별도 설계 슬라이스**다.

### 🔴 Rate Limits(#408) — 코드 잔여 0, **사람이 콘솔에서 볼 일 1건**

트리아지의 rate limit 항목은 `E4` 하나뿐인데 그 판정은 이미 뒤집혀 종결됐다 — **#406(`143003eb8`)이 클라이언트
로그인 잠금을 통째로 삭제했고**(잠금 상태가 공격자 기기에 저장돼 원격 브루트포스에 무력), #408 이 남은 상수까지 걷어냈다.
살아 있는 rate limit 회로는 전부 **실배선 상태**다(`emailCheckLimiter` · DB `check_user_rate_limit` · Edge Function 2종).

🚨 **그래서 미루면 위험하다**: 클라 잠금을 지운 뒤 prod 가 이미 운영 중인데, **서버 rate limit 이 기본값이거나 꺼져 있다면
로그인 브루트포스 방어선이 지금 이 순간 0**일 수 있고 **그 사실조차 아무도 모른다.** 레포 안에서는 원리적으로 증명 불가하다
(`config.toml` 에 rate limit 키 0건 + `site_url` 이 로컬용).

```
[사람 액션 · 5분] Supabase 대시보드 → Authentication → Rate Limits 에서 확인:
  sign in / sign up · token refresh · email send 한도
결과를 wiki(`sources/dead-circuit-cleanup-2026-08` 의 '잔여' 줄)에 **수치까지** 적어 닫아라 —
레포로 증명 불가한 값이라 기록이 유일한 증거가 된다.
```

### 🔴 W2 10항목 — 유효하나 **XL (이 묶음에서 빼라)**

정의 = `docs/analysis/2026-07-27-posting-domain-audit.md:194-287`, 요약표 = `docs/planning/2026-07-28-posting-w1-ship-w3-1-handoff.md:147-156`.
감사 추정 **4~5주(1인)** · L 등급 9개 + M 1개. **ultracode 한 세션의 단위가 아니다.**

실측: **10항목 중 통째로 닫힌 것은 0개.** W2-1·2·3·4·7 은 감사가 지목한 신설 심볼이 코드에 한 건도 없다.
다만 다른 웨이브가 **하위 결함 일부를 개별적으로 봉합**했다 — W2-8①(마이그 `20260727120000`/#357) ·
W2-9②(`scheduleDeepLink.ts` 신설) · W2-10⑤(`venue-settlements.tsx:318-325`). 반대로 같은 항목의 형제 결함은 그대로다.

착수한다면 **W2-2(유일한 M, W1 자산 그대로 확장)를 단독 세션으로** 먼저 떼라. 그 전에 각 항목의 하위 결함을
코드로 재확인하라 — **감사 처방이 틀렸던 전례가 4건 있다**(handoff:169-176).
`W2-4` 의 '공고 내용과 상태를 수정' 거짓 카피 2곳(`index.tsx:565·623`)만은 XS 라 다른 작업에 얹어도 된다.

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
