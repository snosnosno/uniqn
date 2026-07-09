# 핸드오프 프롬프트 — 미사용 export triage 실행 (다음 세션 메인 프롬프트)

> 갱신: 2026-07-06 · Phase 0 완료 + `/plan-eng-review` 반영 후 **실행 단계** 핸드오프
> 로드맵(플랜 본문, **개정 2가 정본**): [`2026-07-05-unused-exports-triage-roadmap.md`](./2026-07-05-unused-exports-triage-roadmap.md)
> 이전 상태(Phase 0부터 실행) 핸드오프는 이 파일이 대체함.

---

## 실행 세션 1 완료 로그 (2026-07-08, Opus 4.8)

> 워크트리 `T-HOLDEM-knip-triage` · 브랜치 `chore/knip-triage-exec`(Phase 0 커밋 위에 rebase 없이 이어짐) · **미push**. 이후 세션은 이 브랜치를 이어가거나 push/PR.

**완료(A·B·D·E + Phase 3 batch 1):** 총 이슈 **2951 → 2393 (−558)** · 래칫 N=**2393**.

| STEP         | 결과                                                                                      | 커밋                                |
| ------------ | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| A knip 핀    | devDeps `knip@6.25.0` exact, 핀 전후 카운트 동일                                          | `9c41831c5`                         |
| B 래칫       | `knip:gate = knip --max-issues=<N>`; N은 knip 총계 경험 확정(2951 exit0/2950 exit1)       | `705cd988f`                         |
| D Phase 1    | 중복 `Component\|default` **277개 제거**(3배치, grep 게이트+tsc 오라클). Duplicate 313→36 | `2b1f2b144`·`c62909c95`·`69b6f3009` |
| E Phase 2    | 죽은 dep `@cloudflare/workers-types` uninstall+unseal(lock diff 분리)                     | `1505440d3`                         |
| F Phase 3 b1 | colors.ts 자기완결 죽은 export 5개(BORDER_COLORS·CHART_COLORS쌍·PLACEHOLDER_COLORS쌍)     | `af37f2060`                         |

전 배치 게이트 그린: type-check EXIT0 · jest 4748/4748 · (D 배치3·웹변형) build:web EXIT0(T1) · knip 새 미사용 0.

**+ 후속(`00b46bfba`)**: code-review(독립 검증)가 batch1~2에서 놓친 **웹 변형 잔존 default 4개**(SheetProvider/PortOneIdentityVerification/QRCodeScanner/BottomSheet `.web.tsx`, 소비자 0)를 적발 → 대칭 제거(knip 미집계라 N 불변). **code-review 최종 = APPROVE, 코드-깨짐 0**(excluded 경로·동적 소비·플랫폼 변형·배럴 전수 점검). 함정 노트 `.claude/agent-memory/code-reviewer/pitfall_knip_platform_variant_default_drift.md`(Phase 4 컴포넌트 구간 재현 주의). → **Phase 4/이후 배치는 base 삭제 시 `.web/.native` 형제 default도 함께 처리**.

**남은 duplicate 36 = 13 needs-review**(테스트 default-import·dynamic import·barrel default 재수출: useAppInitialize/useApplicantManagement/analyticsService/deepLinkService/secureStorage/CalendarView/AssignmentSelector/ApplicantCard/SettlementDetailModal/SalarySection/useNotificationStore/notificationService/sentryService) **+ 23 의도적 별칭**(icons/index.tsx 아이콘 별칭·colors PRIMARY\|ACCENT·statusConfig ATTENDANCE\|attendanceConfig). 버킷 데이터: 세션 스크래치패드 `dup-buckets.json`(재생성: knip --reporter json → `dup-analyze.mjs`).

**결정(STEP G 부분 회부, 2026-07-08):** 사용자 = "Phase 3 리프 이어서". @public(STEP C)·Phase 4/5는 **P4/P5 재결정까지 보류**(@public 가치가 삭제 캠페인 지속에 종속되므로 그 전 투자 = 낭비 위험).

**Phase 3 남은 작업의 실측 난점(다음 세션 필독):** 리프 구역이 "기계적"이 아니라 **심볼별 판단**임이 실측 확인됨 —

- **(d) 배럴 얽힘**: `constants/index.ts`가 50 exports+18 types 재수출(배럴은 131회 소비되나 특정 심볼만). 죽은 재수출 라인 제거는 **라인별로 `from '@/constants'` 배럴 소비 0 확인** 필요. 소스 삭제 시 배럴 재수출이 참조→tsc red.
- **(f)/(b) SSOT**: `statusValues.ts`의 13 `*_VALUES`는 knip "unused export"지만 **로컬에서 STATUS 구성에 사용**(외부 미import일 뿐)·DB enum 정합 SSOT → (b) 의도적 공개, **보존**. "unused export ≠ 죽음"의 대표 반례.
- **로컬 사용**: getOpsWebOrigin·CHART_COLORS·parseVersion 등은 정의 파일 내부에서 사용 → 삭제 불가(demote만 가능하나 (b) 판단 선행).
- **동명 오탐**: PLACEHOLDER_COLORS는 SearchBar/Input의 **동명 로컬 const**가 grep 오탐 유발 → 심볼 grep은 import 경로/스코프까지 확인.
- **안전 오라클(검증됨)**: 선언 전체 삭제 → tsc red = 실사용(타입포지션 포함) → 즉시 리버트. `--fix`(export 키워드만 제거)는 noUnusedLocals와 충돌하니 리프에선 **수동 전체 삭제** 권장.
- 남은 리프 물량(현재 실측): constants(exports 80/types 24 — colors 5 제외)·utils(124/12)·stores(46/13)·lib(42/6)·shared(44/25)·types구역(67/177). 다음 배치 후보: 배럴 미얽힌 자기완결 (a)부터, 배럴 라인은 별도 배치.

---

## 실행 세션 2 완료 로그 (2026-07-08, Opus 4.8)

> 워크트리 `T-HOLDEM-knip-triage` · 브랜치 `chore/knip-triage-exec` · 세션 1 위에 4커밋 추가 · **미push**.

**총 이슈 2393 → 2313 (−80)** · 래칫 N=**2313**. 세션 1(2951→2393) 이어서 진행.

| 커밋        | 배치                                                                                          | 삭제   | 래칫      |
| ----------- | --------------------------------------------------------------------------------------------- | ------ | --------- |
| `d24024d3d` | utils 리프 SELF (platform 반응형 서브셋·상태카운트라벨·시간포맷)                              | 12 net | 2393→2381 |
| `05be2d002` | platform 죽은 프리미티브 (isIOS·isAndroid·isMobile, code-reviewer 후속)                       | 3      | 2381→2378 |
| `2e047b080` | types 구역 리프 24종 (5 클러스터)                                                             | 24     | 2378→2354 |
| `071fe16f6` | constants·lib·shared 배럴 재수출 리프 21종 협응삭제 (+ location.ts·database.ts 죽은파일 삭제) | 41 net | 2354→2313 |

전 배치 게이트 그린: type-check EXIT0 · jest 4748/4748 · knip 재측정(캐스케이드 실측) · 배럴 배치는 미사용파일 0. code-reviewer: batch1 APPROVE(LOW 1=isMobile 트리오 후속지목→05be2d002로 해소), batch2+3 **APPROVE 0 issues**(grep 결정적 + 독립 tsc EXIT0 이중확인, 실수삭제 0·고아참조 0).

**이 세션의 핵심 실측 발견 (P4/P5 판단 근거로 중요):**

- knip "미사용 export"의 **대다수는 삭제 대상이 아니다.** 리프 SELF 후보 109개 중 실제 (a)삭제가능은 ~39개(약 35%). 나머지는 ▲살아있는 형제가 로컬 소비(tsc red로 차단) ▲의도적 공개/미구현 계약 표면 ▲SSOT(statusValues)·보안상수(SQL_INJECTION_PATTERNS).
- stores/lib/shared/constants/security 구역 SELF는 **삭제가능 0건**이었다(전부 로컬사용/계약).
- BARREL 버킷도 51개 평가 중 (a)죽음은 21개뿐, 나머지는 계약타입/패밀리훅/local-use-live.

**남은 Phase 3 리프 작업 (다음 세션 착수점, 현 스냅샷 2313 = exports 1320 / types 957 / dup 36):**

- **OTHER 버킷 (69)** — 단순 죽음 아니라 **중복/잉여 재수출 disambiguation**. `utils/job-posting/dateUtils.ts`↔`utils/date/*`, `utils/formatters/phone.ts`↔`utils/phone.ts`, `settlementGrouping`/`settlement/formatters` 중복파일 통합 + `types/supabase.ts` Json/Tables/Enums=**생성타입(불가촉)** + SalaryType/AttendanceStatus/User/Staff=정본 재수출. 이중파일 분석 필요·위험 높음 → 전용 세션 권장.
- **BARREL 잔여 디퍼(borderline-b)** — `types/index.ts` 47 계약타입(auth DTO·board·jobPosting 엔티티·common: Phase5-adjacent)·domains/application 9·unified 8·version.ts(빌드메타)·authStore 셀렉터/훅(b)·status/deeplink 계약맵(b)·`useRealtimeSubscription` **훅 추상화 전체(100% 死지만 문서화 공개모듈, 사용자 사인오프 권장)**.
- **LOCAL-USE de-export 후보(다수)** — 과다 export지만 로컬사용. 삭제 불가·데모트만 가능(이 세션은 데모트 미실행 — 규칙 준수).

**STEP G 부분 회부(2026-07-08):** 사용자 = "Phase 3 리프 잔여 완주" 선택 → 배럴 리프유틸(batch 071fe16f6) 완료. OTHER 버킷·barrel 계약타입·P4/P5는 다음 결정.

---

## 0. 결론 먼저 (현재 상태)

- **Phase 0 완료·커밋됨** — 브랜치 `chore/knip-config-harden`, 로컬 커밋 2개(미push):
  - `3998a055a chore(knip): 테스트 인프라 오탐 봉인 + Phase 0 baseline 재측정`
  - `2ba9c914b docs(knip): triage 로드맵 엔지니어링 리뷰 반영(개정 2)`
- **Phase 0 후 실측 baseline** (전부 `src/**`, 게이트 그린): Unused exports **1,670** · exported types **968** · duplicate **313** · files 0 · deps 0 · binaries 0 · hints 3.
- **확정 종착점(리뷰 CM1=C)**: 원안 "0→5 전 Phase 완주(21~29세션)"는 **폐기**. §1 목표(knip을 CI 게이트로 신뢰)는 래칫 도입 즉시 달성되므로 — **knip핀 → 래칫 → @public 봉인 → Phase 1~3까지 확정 실행**, 그다음 **Phase 4/5(대량 삭제)는 잔여 리포트를 보고 재결정**(런타임 이득 0 + Phase 5 prod 회귀 위험 때문). 지금 P4/P5를 자동 진행하지 않는다.

**이 세션이 할 일 = 아래 §1 프롬프트를 실행해 knip핀·래칫·@public 봉인·Phase 1~3을 끝내고, P4/P5 재결정 게이트에서 멈춰 사용자에게 데이터로 재판단을 요청.**

---

## 1. 붙여넣기용 프롬프트 (다음 세션 첫 메시지)

```
미사용 export triage 실행을 이어간다. 정본은 uniqn-mobile/docs/planning/2026-07-05-unused-exports-triage-roadmap.md 이며, 그 문서 상단 "개정 2 (2026-07-06)" 블록이 §4·§5·§6·§7의 상충 부분보다 우선한다. 먼저 로드맵 전체 + 개정 2 + §8 GSTACK REVIEW REPORT를 정독하라.

착수 전 필수:
- `git status`로 상태 확인. 작업은 기존 브랜치 chore/knip-config-harden 에서 이어간다(Phase 0 커밋 2개가 이미 있음, 미push). 내가 만들지 않은 미커밋 변경이 섞여 있으면 새 워크트리로 격리.
- `npx knip` 현재 스냅샷을 찍어 baseline(exports 1,670 / types 968 / duplicate 313)과 대조.

실행 순서(엄수 — 각 단계는 개정 2가 정의한 게이트를 이 세션 안에서 직접 실행한 증거로만 완료 처리):

STEP A — knip 핀 (래칫 선행 필수)
- `knip`을 devDependencies에 핀 버전으로 추가(`npm i -D knip@<현재버전>` → package-lock 동기화). 지금은 floating(npx가 매번 최신 다운로드)이라 래칫 baseline이 불안정.
- 게이트: `npx knip` 카운트가 핀 전후 동일한지 확인. 커밋 `chore(knip): knip devDependencies 핀 고정`.

STEP B — 래칫 게이트 배선
- package.json scripts에 "knip:gate": "knip --max-issues=<N>" 추가. N은 손계산(2,951) 금지 — `npx knip`의 자체 출력 총계에서 취한다(hints·member 등이 합계에 섞일 수 있음).
- `npm run knip:gate`가 현재 상태에서 exit 0인지 확인(N=현재총계면 통과). 커밋 `chore(knip): 미사용 export 래칫 게이트 배선`.
- 이후 모든 삭제 배치 커밋에서 N을 그 배치 후 실측 총계로 하향. Phase 경계(특히 @public 봉인)에서 카운트 급락 시 재baseline. 캐스케이드 삭제(배럴 제거→원본 고아화)로 총계가 비단조로 움직이면 게이트 red를 "새 미사용" vs "캐스케이드"로 구분 판독.

STEP C — @public 봉인 (의도적 공개 API)
- (b)유형 심볼(도메인 배럴 재수출 + 계약 표면)에 JSDoc `@public` 태그를 달고 knip config에 `"tags": ["-public"]`(또는 `--tags=-public`) 배선해 리포트에서 영구 제외. 현 레포 @public 컨벤션 0건이라 신규 도입.
- 주의: @public 태깅은 삭제/보존 심볼별 판단을 없애지 못한다(같은 판단을 태그로 옮기는 것). 가치는 자기문서화+영구제외. "배럴 재수출=일괄 @public" 휴리스틱 금지(거의 다 봉인+거의 못 지움 됨).
- 게이트: type-check EXIT0 + 전체 jest + knip 재측정(태그분만큼 리포트 감소). 래칫 N 재baseline. 커밋 `refactor(knip): 의도적 공개 API @public 봉인`.

STEP D — Phase 1 (duplicate 313, Component|default dedup)
- 읽기전용 스크립트로 각 파일을 safe/needs-review 버킷팅(§4.1 grep 게이트: default-import 소비자 0 + React.lazy 동적 default 0 + 배럴 default 재수출 0). app/** 라우트 파일 무조건 제외.
- duplicate는 knip --fix 대상 타입이 아니다 → Phase 1에서 --fix 쓰지 말 것(no-op). named import 확정 패턴이므로 grep 게이트된 codemod 1패스 또는 배치 수동으로 `export default` 라인만 제거(named 유지).
- 배치마다 게이트: type-check EXIT0 + 전체 `npm test`(실측 ~53s) + knip 재측정(duplicate 감소·새 미사용 0) + git diff + 래칫 N 하향. 커밋 예 `refactor(components): 중복 default export 제거 batch N`.

STEP E — Phase 2 (죽은 deps/파일)
- `@cloudflare/workers-types` unseal(ignoreDependencies에서 제거)+`npm uninstall @cloudflare/workers-types`(lock 동기화). 이 커밋만 lock diff 포함, 다른 관심사와 분리.
- ts-node 부재 확인됨. lint-staged는 config 블록이 package.json에 잔존(패키지만 devDeps에 없음, 현재 knip 미flag) → 건드리지 말 것.
- Phase 0가 파일 오탐을 이미 봉인했으므로 남는 "죽은 파일"만 import 참조 0 + git log 확인 후 삭제.

STEP F — Phase 3 (리프 구역: constants·utils·stores·lib·shared·types)
- (a)진짜죽음만 삭제. (d)배럴 재수출·(f)타입-포지션을 grep으로 걸러낸 뒤.
- **--fix 파일럿은 여기서**(exports/types는 fixable). 단 knip --fix는 export 키워드만 떼고 선언은 남겨 noUnusedLocals가 무조건 tsc red를 만든다 → "삭제→tsc red=실사용" 안전 오라클은 --fix와 양립 불가. --fix 쓰면 그 오라클 대신 knip 재측정+전체 jest에 의존. 오라클을 쓰려면 선언 전체 수동 삭제.
- 배치 게이트 동일(type-check + 전체 jest + knip + diff + 래칫 하향).

STEP G — P4/P5 재결정 게이트 (여기서 멈춰 사용자에게 보고)
- Phase 1~3 완료 후 `npx knip` 최종 스냅샷을 찍어 남은 components / services / repositories / hooks / schemas / domains / errors 물량을 제시.
- "대량 삭제(원안 Phase 4/5) vs 기회주의적 삭제(파일 만질 때만) vs 여기서 종료"를 데이터로 재판단하도록 사용자에게 질문. 자동으로 Phase 4/5 삭제에 들어가지 말 것.

공통 규칙(반드시 준수):
- 로컬 커밋은 사전 승인(매번 묻지 말 것). push/PR은 사용자 명시 지시 전까지 금지. 커밋 메시지 한글 `<type>(<scope>): <설명>`.
- 게이트 보강(개정 2 T1): .web.*/.native. 변형 파일 삭제 가드 — 삭제 후보가 base 형제와 export 모양이 갈리면 tsc가 못 잡으니, web 변형/observability(.web.ts) 건드리는 배치마다 `npm run build:web` 1회. Phase 5류 스키마 삭제 시 해당 입력경로 jest 통합 + `xssValidation` 참조 grep 0건 확인.
- 삭제 배치 직후 code-reviewer, RLS·인증·스키마 등 보안 경계 건드리면 /guard·security-reviewer.
- 완료 주장 전 이 세션 안에서 실행한 증거(테스트/빌드 출력) 필수. "될 것"·"통과할 듯" 금지.
```

---

## 2. 개정 2 핵심 정정 (원안과 다른 점 — 반드시 인지)

| 항목         | 원안                          | 개정 2 (정본)                                                                      |
| ------------ | ----------------------------- | ---------------------------------------------------------------------------------- |
| 종착점       | 0→5 전부(21~29세션)           | knip핀+래칫+@public봉인+P1~3만 확정, **P4/P5는 봉인 후 재결정**                    |
| knip         | `npx knip`(floating)          | **래칫 전 devDeps 핀 필수**                                                        |
| 래칫 N       | —                             | knip **자체 출력 총계**에서, phase 경계마다 재baseline                             |
| Red-Green    | "삭제→tsc red=실사용" 항상    | **--fix와 양립 불가**(noUnusedLocals). 오라클은 수동 삭제에만                      |
| --fix 파일럿 | Phase 1                       | **Phase 3/4로 이동**(duplicate는 fixable 아님)                                     |
| (b) 판정     | 배럴+deprecated 주석이면 보존 | 주석 말고 **본문 동작까지 확인**(getCurrentUser는 return null 죽은 stub)           |
| 플랫폼 가드  | ".web.tsx 7"                  | 실측 .web.tsx 4 + .web.ts 2, `.web.*/.native.*` 전부 커버 + web 배치마다 build:web |
| 배치 테스트  | 관련 스위트                   | **배치마다 전체 jest**(53s)                                                        |

---

## 3. 완료 정의 (이 실행 세션)

- [ ] STEP A: knip devDeps 핀 + lock 동기화, 핀 전후 knip 카운트 동일 확인, 커밋
- [ ] STEP B: `knip:gate` 배선(N=knip 총계), `npm run knip:gate` exit 0, 커밋
- [ ] STEP C: @public 봉인 + tags 배선, 게이트 그린, 래칫 재baseline, 커밋
- [ ] STEP D~F: Phase 1~3 배치별 삭제 — 각 배치 type-check EXIT0 + 전체 jest 0 failures + knip 감소(새 미사용 0) + git diff + 래칫 N 하향, 배치=1커밋
- [ ] STEP G: 최종 knip 스냅샷으로 P4/P5 재결정을 사용자에게 데이터로 질의(자동 진행 금지)
- [ ] push/PR은 사용자 지시 시에만
