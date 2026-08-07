# 남은 작업 전량 착수 원장 — 2026-08-08

> **새 세션은 이 파일부터 읽는다.** 트랙 하나 = 세션 하나. 각 트랙은 **자립적**이라 골라 착수해도 된다.
>
> 기준: `origin/master` = **`e53722b5c`** (#439 머지) · 2026-08-08 실측
>
> 🚨 **이 레포는 병렬 세션이 상시 활성이다.** 이 문서를 쓰는 동안에도 워크트리 3개가 돌고 있었고,
> 세션 하나 안에서 사실이 **두 번 뒤집혔다**(마이그 충돌이 이미 닫혀 있었고, prod 미적용 1건이 0건이 됐다).
> **§1 중복 착수 금지 표를 먼저 확인하고, 착수 직전에 `git fetch` + `git worktree list` 로 재실측하라.**

---

## §0. 현황 스냅샷 (2026-08-08 실측)

| 축 | 값 |
|---|---|
| `origin/master` | **`e53722b5c`** (#439) |
| **prod 미적용 마이그** | ✅ **0건** — #433·#436·#439 모두 `prod-migrate` 워크플로우로 적용 완료 |
| **DB 파리티** | ✅ **일치** — prod `funcs 202 / policies 111` = 레포 기대값 202/111 (`parity_baseline_guard.test.sql:142-143`) |
| **branch protection** | ✅ 활성 — required = `Quality Gate` · `E2E Gate` |
| 마지막 OTA | ⚠️ `078e857d-49ca-4002-abae-849783163cf0` (runtime **1.0.5**, commit `fefe6b609`=#429) |
| 마지막 웹배포 | ⚠️ CF Production `92416de0` (source `fefe6b6`) |
| 열린 PR | **#440**(이 원장 계열, CI 12/12 pass·MERGEABLE) · Dependabot 4건(#380·#414·#415·#416) |

> 🔴 **가장 큰 잔여는 코드가 아니다.** #432~#439 **8건이 웹·OTA 어디에도 안 나갔다.**
> 정산 Lost Update(#436)·퇴근≥출근 검증(#433)·조회 실패 위장(#434)·ops 링크 복구(#435)가
> 전부 **사용자에게 도달하지 않은 상태**다. 서버(마이그·EF)만 앞서 있어 롤아웃 비대칭이 커져 있다.

---

## §1. 중복 착수 금지 — 다른 세션이 이미 하고 있는 것

착수 전 `git worktree list` 로 **살아 있는지 재확인**하라. 아래는 2026-08-08 시점 실측이다.

| 워크트리 | 브랜치 | 하고 있는 일 | 상태 |
|---|---|---|---|
| `T-HOLDEM-ops4` | `fix/ops-event-date-20260808` | **ops 결함 ④ 대회 날짜 · ② 노쇼** | 커밋 2건 완료(`690a20f0e`·`37b3bcb2b`) |
| `T-HOLDEM-medium4` | `fix/merge-review-medium-rest-20260808` | **머지 리뷰 MEDIUM 나머지 4건** | 작업 중(미커밋) |
| `T-HOLDEM-sf` | `docs/next-session-prompts-20260808` | 잔여 2건(딥링크·MEDIUM) 프롬프트 | 커밋 완료·미푸시 |
| `T-HOLDEM-opsurl` | `fix/ops-native-deeplink-20260807` | Android App Links 축소 + 1.0.6 bump | **대기**(§T8 참조) |

→ **ops 결함 ②·④ 와 MEDIUM 4건은 착수하지 말 것.** ops 는 ③⑤⑥⑦ 만 남는다.

---

## T1. 🔴 최우선 — PR#440 머지 → 웹배포 → OTA

가장 급하다. 8건의 수정이 사용자에게 안 갔다.

```
#432~#439 를 웹과 OTA 로 내보낸다. 그 전에 PR#440 을 머지한다.

순서를 지켜라 — 웹 먼저, OTA 나중이다. 웹에는 AASA 가 실려 있고(#435 의 /jobs 패턴),
그건 네이티브 빌드가 아니라 public/ 의 배포물이라 웹으로만 전달된다.

1. PR#440 머지 (CI 는 이미 12/12 green 이었으나 base 가 움직였을 수 있으니 재확인)
   gh pr checks 440 → 전부 pass 확인 후 gh pr merge 440 --squash
2. 로컬을 origin/master 로 맞춘다 (git fetch origin master:master)
3. 웹 배포: node scripts/deploy-cloudflare.js --force
4. OTA: eas update --branch master (커밋 필드가 origin/master HEAD 인지 확인)
5. 배포 후 번들 마커 검증

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

**T1 이 끝난 뒤에** 한다. 지금 체크리스트는 이전 롤아웃(#420~#429) 기준이다.

- 체크리스트: `docs/qa/2026-08-07-device-qa-checklist.md` (61항목)
- 🚨 앱을 **완전 종료 후 재실행**해야 OTA 가 적용된다. 체크리스트 **0번을 먼저** 하고, 실패하면 나머지는 무의미.
- T1 이후라면 **#432~#439 범위 항목을 체크리스트에 추가**해야 한다 — 특히 실패/빈 상태 분리(#434)와
  정산 수정 이력(#436)은 기존 체크리스트에 없다.

누적 미검증 QA: Android 키보드 17화면 · 1.0.5 웨이브 전량 · 지도 앱 선택(#422) 등.

---

## T3. 🔴 ops 결함 ③⑤⑥⑦ (②④ 제외 — 진행 중)

정본 문서: **`docs/planning/2026-08-08-ops-defects-2-7-handoff.md`** (§2 트랙 A)

```
ops 완성도 결함 중 ③⑤⑥⑦ 을 닫는다. ②(노쇼)와 ④(대회 날짜)는 다른 세션이
fix/ops-event-date-20260808 에서 이미 커밋했으므로 건드리지 마라 — 착수 전 그 브랜치를
git fetch 해서 실제로 살아있는지 먼저 확인하고, 머지됐으면 그 위에서 시작한다.

정본: docs/planning/2026-08-08-ops-defects-2-7-handoff.md §2
③ 참가자 정정·삭제, 대회 삭제 불가 — HIGH
⑤ ops_unclaim_participant 죽은 회로 — LOW (제거인지 완성인지 판정부터)
⑥ (ops) 라우트가 플래그를 안 본다 — 판단 필요
⑦ 통합 공백 — 범위 결정 (②~④ 착지 후에만 착수)
```

⚠️ **`app_config.ops_hub_enabled` 가 OFF 라 ops 실사용이 사실상 0이다.**
결함을 닫아도 플래그를 켜지 않으면 사용자에게 보이지 않는다 — 플래그 ON 여부는 **사용자 결정**이다.
⑤ 를 "죽은 회로"로 판정할 때 [[dead-circuit-cleanup-2026-08]] 의 교훈을 적용하라:
안 쓰인다에는 *필요 없었다*와 *배선이 덜 끝났다*가 섞여 있고, 전자로 단정하면 미완성 기능을 영구 삭제한다.

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

## T6. 🔴 감사 M11 — 정산 축 통일

⚠️ **이 항목은 기록이 희소하다.** M11 의 정의가 어디에도 온전히 없다 —
`memory/project_settlement_selection_axis_20260802.md:44` 에 *"부모가 축을 내려주므로 실경로는 하나.
감사 M11 과 함께 처리할 것"* 이라는 **한 줄 참조**가 있을 뿐이고, 그 줄은 M11 이 무엇인지 말하지 않는다.

```
감사 M11(정산 선택·집계 축 통일)을 닫는다.

🚨 착수 전에 "M11 이 무엇인가"부터 확정해야 한다. 이 항목은 정의가 남아 있지 않다 —
memory/project_settlement_selection_axis_20260802.md:44 의 한 줄 참조가 전부다.

1. 원 감사 문서에서 M11 정의를 찾는다:
   grep -rn "M11" docs/analysis/ docs/planning/
2. 못 찾으면 P1(PR#393 `bc295df49`)의 diff 와 그 PR 이 남긴 TODO 에서 역추적한다.
3. 정의를 확정한 뒤에야 코드를 고친다. 정의 없이 "축을 통일했다"고 하면 무엇을 했는지 검증할 수 없다.

배경: PR#393 이 판정 복제 2건 제거 + 렌더 가드 신설까지 했고 "축 통일" 자체가 미완으로 남았다.
관련 wiki: sources/settlement-rpc-wave-2026-08
```

---

## T7. ⏸ Dependabot 4건

```
열린 Dependabot PR 4건을 처리한다: #380(eslint-plugin-react-hooks 5→7)
#414(supabase/setup-cli 1.7.1→3.0.0) #415(actions/github-script 7→9) #416(postcss 8.5.22→8.5.25)

🚨 #414 는 주의해서 봐라 — setup-cli 버전 드리프트가 과거 db-tests/e2e 를 광범위하게
red 로 만든 이력이 있다(wiki sources/db-tests-cli-grant-drift · e2e-cli-grant-drift).
메이저 2단계 점프이므로 CI 를 끝까지 지켜본 뒤 머지한다.
🚨 #380 도 메이저 2단계라 lint 규칙이 대거 바뀔 수 있다.
```

---

## T8. ⏸ 대기 — 스토어 빌드 시점에만

**`fix/ops-native-deeplink-20260807`** (워크트리 `T-HOLDEM-opsurl`, **로컬 전용·미푸시**)

- 내용: Android App Links 축소(uniqn.app 전 경로를 삼키던 것을 iOS 와 같은 목록으로) + **version 1.0.6 bump**
- 🚨 **머지 즉시 이후 모든 OTA 가 runtime 1.0.6 으로 가서, 설치된 1.0.5 기기가 전부 끊긴다.**
  새 스토어 빌드를 낼 때 함께 처리해야 한다.
- 🚨 **로컬에만 있다** — 워크트리를 지우면 소실된다. 안전판은 **로컬 브랜치** `archive/ops-original-20260807`
  (태그가 아니라 브랜치이고, 이것 역시 origin 에 없다 — 이 머신을 잃으면 둘 다 사라진다)
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
- ops 정본: `2026-08-08-ops-defects-2-7-handoff.md` · 선행 `2026-08-07-ops-completeness-defects-handoff.md`
- 병렬 세션 산출(미푸시): `T-HOLDEM-sf` 의 `2026-08-08-next-session-prompts.md` — 딥링크·MEDIUM 2건 상세
- 지식: `wiki/index.md` → `/query` 로 인용 답변. 08월 웨이브 교훈 16편이 wiki 에 있다.
- 세션 메모리: `MEMORY.md`(잔여·prod기록명·라이브함정만. 교훈 본문은 wiki)
