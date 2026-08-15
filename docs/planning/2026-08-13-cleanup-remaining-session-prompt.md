# 정리 잔여 작업 — 다음 세션 착수 프롬프트 (2026-08-13)

> # ✅ 전량 완료 — 재실행하지 말 것 (2026-08-14)
>
> A(죽은 배럴) · B(아이콘 별칭) · C(문서 아카이브) · D(착지) **전부 종료**.
> **PR #474 머지**(squash `978354feb`) · 아카이브 태그 `archive/cleanup-batch1-20260813`
> · 워크트리 `.claude/worktrees/cleanup-batch1` 제거됨.
>
> 최종 수치: knip 2,189 → **1,450** · Duplicate exports **21 → 1** · 문서 **47편** 아카이브
> · 배럴 7종 삭제 + 3종 축소 · 아이콘 별칭 24종 제거.
> 이 문서의 §2 표에 적힌 "소비처 0" 판정은 **직접 import 만 센 값이라 실제와 달랐다** —
> `@/services` 가 `export *` 로 도메인 배럴을 재수출해 간접 소비 중이었다(집행 시 정정).
>
> 🔴 **넘어간 것 2건**(감사 문서 §집행 현황에 상세):
> ① `calculatePayByType` 0시간 동작 변경 — 호출부가 0시간을 미리 걸러 도달 경로 없음
> ② `src/hooks/useVersionCheck.ts` 미사용 파일 — **남기기로 결정**(버전 게이트 기능 자체는
>    `useAppInitialize → versionService → app/_layout.tsx` 로 생존, 이 훅은 병렬 사문 구현)
>
> 🔎 **후속 후보**(PR #474 코멘트에 표로 정리): `MegaphoneOutlineIcon`(사용 0) ·
> `XIcon`(11) · `CloseCircleOutlineIcon`(7) — 별칭이 아니라 **별도 `createIcon()` 재선언**이라
> knip Duplicate 가 원리적으로 못 잡는 잔여. ⚠️`AddCircleOutlineIcon` 은 별개 글리프라 **통합 금지**.
>
> 아래 원문은 이력으로 보존한다.

---

> **이 파일 하나만 읽고 시작할 수 있게 썼다.** 감사 원본은 `docs/analysis/2026-08-12-cleanup-audit.md`
> (§집행 현황 표에 완료/미착수가 정리돼 있다). 그쪽은 배경이 필요할 때만 열면 된다.

---

## 0. 상황 — 무엇이 이미 끝났나

`chore/cleanup-batch1-20260813` 브랜치에 **커밋 8개**가 로컬에만 있다(push·PR 안 함).
워크트리: `.claude/worktrees/cleanup-batch1`. 분기점 = `master` `8b08010aa`.

```
32a6b899f refactor(settlement): 중복 구현 4쌍 통합 — 산식 단일 소유 + 발산 축 1건 수렴
ddfa316e9 chore(cleanup): knip 래칫을 실측치로 조이고 감사 문서에 집행 현황 기록
fd183e360 docs(cleanup): 아카이브를 막던 gitignore 함정 제거 + 고아 문서 22편 아카이브
75f055f46 fix(cleanup): 환경 판정 축 일원화 — OTA 에서 항상 development 이던 소스 제거
60b05a51d chore(cleanup): 폐기된 app2/ 를 가리키던 gitignore·스킬 사문 정리
4e8cc6dab refactor(cleanup): 소비처 없는 잉여 export default 38건 제거
008e99375 fix(cleanup): 실제 절차와 어긋난 릴리스 스크립트·stale 주석·테스트 배치 정정
de000ffbd refactor(cleanup): 소비처 0인 사문 컴포넌트 6종 제거 — 1,043줄
```

누적 101 파일 / -914줄 순감. **브랜치 tip 기준 마지막 실측**(2026-08-13):

| 게이트 | 결과 |
|---|---|
| `npx tsc --noEmit` | EXIT 0 |
| `npm run quality` | EXIT 0 (에러 0 · 경고 123) |
| `npx jest` | 663 suites / **7,548 tests** 전량 통과 |
| `npm run knip:gate` | EXIT 0 (래칫 2,079) |
| knip 내역 | 미사용 export 1,158 · 미사용 타입 895 · Duplicate 21 · Config hint 4 |

### 🚨 병렬 세션이 **3개** 돌고 있다 — 착수 전 반드시 재실측

작성 시점 워크트리:

```
C:/Users/user/Desktop/T-HOLDEM                                   [master]
C:/Users/user/Desktop/T-HOLDEM/.claude/worktrees/cleanup-batch1  [chore/cleanup-batch1-20260813]  ← 이 작업
C:/Users/user/Desktop/T-HOLDEM-wt-honesty                        [fix/posting-detail-honesty-20260813]
C:/Users/user/Desktop/T-HOLDEM-wt-schedule                       [fix/schedule-posting-top3-20260813]
```

메인 체크아웃에 남의 미커밋 문서 2건(`2026-08-12-employer-posting-detail-ux-audit.md`,
`2026-08-12-work-schedule-posting-audit.md`)이 있다. **메인에서 작업하지 말 것.**
아래 §2 의 배럴 정리는 `src/components/jobs`·`src/hooks` 등 저 두 브랜치가 건드릴 가능성이
높은 자리라 **충돌이 예상된다.** 머지 순서는 실행 직전에 `git worktree list` +
`gh pr list` 로 다시 판단하라 — 이 문서의 목록은 작성 시점 스냅샷이다.

---

## 1. 시작 절차 (그대로 따라할 것)

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git worktree list                     # 워크트리 3개가 그대로인지, 새로 생겼는지
git fetch origin master
git -C .claude/worktrees/cleanup-batch1 log --oneline -1   # 32a6b899f 인지
git rev-list --count chore/cleanup-batch1-20260813..origin/master   # 0 이 아니면 먼저 재통합
```

`master` 가 앞서 있으면 **작업 전에** 최신 master 를 브랜치에 통합하고 게이트를 다시 돌린다
(squash 저장소라 rebase 말고 merge).

작업 디렉토리는 항상 `.claude/worktrees/cleanup-batch1/uniqn-mobile`.
`node_modules` 는 메인 정션이므로 **워크트리에서 `npm install` 금지**.

---

## 2. 남은 작업 — 4건

권장 순서는 **A → B → C → D**. A·B 는 위험이 낮고 즉시 값이 나온다.
C 는 codemod 라 한 커밋에 몰아야 하고, D 는 링크 그래프 정리라 별개 성격이다.

---

### A. 죽은 배럴 정리 (가장 값싼 승리)

`@/services/jobs` 배럴은 **소비처가 0**이다. 파일 자체가 죽었다.

실측(2026-08-13, `[미사용 export] / [배럴을 import 하는 파일 수]`):

| 배럴 | 미사용 export | 소비 파일 | 판정 |
|---|---|---|---|
| `@/services/jobs` | 35 | **0** | 🔴 배럴 삭제 |
| `@/services/work` | 24 | 0 (1건은 JSDoc 문구뿐) | 🔴 배럴 삭제 |
| `@/services/notifications` | 51 | 1 (`authCoreService.ts:36`) | 소비처를 직접 경로로 바꾸고 삭제 |
| `@/components/ops` | 22 | 2 (`app/(ops)/tournaments/{new,[id]}.tsx`) | 좁히거나 직접 경로화 |
| `@/lib` | 29 | 6 (전부 `queryKeys`/`invalidateRelated`/`cachingPolicies`) | 좁히기 |
| `@/stores` | 34 | 9 | 좁히기 |
| `@/hooks` | 120 | 11 | 좁히기 (아래 🚨 참조) |
| `@/schemas` | 199 | 28 | 좁히기 — **단일 최대 건** |
| `@/domains/application` | 42 | 10 | 좁히기 |
| `@/services/auth` | 50 | 20 | 좁히기 |

> 🚨 **`@/hooks` 배럴은 그냥 편의 문제가 아니라 알려진 사고 원인이다.** 리프 UI 에서 배럴을
> import 하면 상수 순환 참조로 모듈스코프 값이 `undefined` 가 되는 함정이 **3회 재발**했다
> (`.claude/rules/impeccable-design.md` §8 주석). 소비처를 직접 경로로 바꾸는 방향이
> 옳고, 배럴을 남기더라도 재수출 범위를 실제 소비 심볼로 좁혀라.

**하는 법(배럴 1개 = 커밋 1개)**

1. `grep -rn "from '@/<배럴>'" src app e2e --include=*.ts --include=*.tsx` 로 실제 소비 심볼 수집
2. 소비처 0 → 파일 삭제 / 소비처 소수 → 그 소비처를 직접 경로 import 로 바꾸고 파일 삭제
3. 소비처 다수 → 배럴의 `export` 를 실제 소비 심볼만 남기게 좁힘
4. `npx tsc --noEmit` → `npx jest` → `npm run quality`
5. `npm run knip:gate` 통과 확인 후, `package.json` 의 `knip:gate --max-issues` 를
   **새 실측치로 조인다**(래칫은 내려가기만 해야 한다)

**완료 조건**: 소비처 0인 배럴 잔존 0 · knip 미사용 export가 시작값 1,158 대비 유의미하게 감소
· 래칫이 실측치와 일치 · 게이트 4종 전부 통과.

---

### B. 아이콘 별칭 — 먼저 **죽은 별칭 5개**부터

`src/components/icons/index.tsx` 에 같은 아이콘이 2~3개 이름으로 산다(20쌍).
**전부 codemod 대상은 아니다.** 실측하니 5개는 아예 안 쓰인다:

| 죽은 별칭 (사용 0회) | 정본 (사용 횟수) |
|---|---|
| `HeartOutlineIcon` | `HeartIcon` (5) |
| `CloseIcon` | `XMarkIcon` (67) |
| `CheckmarkCircleIcon` | `CheckCircleIcon` (46) |
| `CloseCircleIcon` | `XCircleIcon` (26) |
| `NotificationsIcon` | `BellIcon` (19) |

→ **이 5개는 codemod 없이 그냥 지운다.** 커밋 1개, 위험 0.

나머지 15쌍은 양쪽 다 실사용이라 codemod 가 필요하다. 실측 사용 횟수:

```
MapPinIcon=18 | MapIcon=10 | LocationOutlineIcon=2
AlertCircleIcon=20 | ExclamationCircleIcon=11 | AlertCircleOutlineIcon=4
CalendarIcon=53 | CalendarDaysIcon=7 | CalendarOutlineIcon=2
RefreshIcon=17 | ArrowPathIcon=2
SearchIcon=19 | MagnifyingGlassIcon=5
MailIcon=4 | EnvelopeIcon=2
QrCodeIcon=12 | QRCodeIcon=2
ExclamationTriangleIcon=8 | AlertTriangleIcon=26      ← ⚠️ 별칭이 정본보다 많이 쓰인다
PlusIcon=24 | AddIcon=5
CheckIcon=56 | CheckmarkIcon=6
UserIcon=24 | PersonOutlineIcon=6
UsersIcon=28 | PeopleOutlineIcon=9
EyeIcon=12 | EyeOutlineIcon=4
EditIcon=13 | CreateOutlineIcon=3
TrashIcon=22 | TrashOutlineIcon=2
```

> ⚠️ **`ExclamationTriangleIcon`(8) vs `AlertTriangleIcon`(26)** — 소수파가 "정본" 이름을
> 달고 있다. 이름이 예뻐서 정본을 고르지 말고 **사용 횟수가 많은 쪽으로 수렴**시켜라
> (diff 가 작고 리뷰가 쉽다). 07-16 감사에서 `JobPostingCard` 를 "Legacy alias" 주석만
> 보고 지울 뻔한 선례가 있다 — **주석이 아니라 실사용이 정본을 정한다.**

> ⚠️ `Outline` 접미 별칭(`*OutlineIcon`)이 **정말 같은 글리프인지** 먼저 확인하라.
> `icons/index.tsx` 에서 두 이름이 같은 lucide 컴포넌트를 가리키면 별칭이 맞지만,
> 다른 것을 가리키면 별칭이 아니라 **다른 아이콘**이다. 지우면 UI 가 바뀐다.

**하는 법**: 정본을 정하고 `sed`/`perl` 로 전량 치환 → `icons/index.tsx` 에서 별칭 export 제거
→ `npm run quality` → `npx jest`. **`e2e/` 도 별도 Grep 필수**(eslint ignores 라
`npm run quality` 범위 밖 — PR#353 실사고).

**완료 조건**: knip `Duplicate exports` 21 → **1**(남는 건 `sentryService|crashlyticsService`
별칭 하나. 이건 의도적 alias 라 유지) · 게이트 4종 통과.

---

### C. 문서 아카이브 잔여 24편

이번 배치에서 **인바운드 링크가 0인 22편만** 옮겼다. 같은 시기(2026-04~06) 문서 24편은
다른 문서가 링크하고 있어 남겼다.

**하는 법**
1. 후보 열거 + 인바운드 링크 재측정:
   ```bash
   cd C:/Users/user/Desktop/T-HOLDEM/.claude/worktrees/cleanup-batch1
   for f in $(ls docs/planning/*.md docs/superpowers/plans/*.md docs/superpowers/specs/*.md | grep -E "2026-0[456]"); do
     b=$(basename $f)
     n=$(grep -rl "$b" docs wiki CLAUDE.md AGENTS.md README.md .claude 2>/dev/null | grep -v "^$f$" | wc -l)
     echo "$n $f"
   done | sort -rn
   ```
2. `git mv` 로 `docs/archive/<카테고리>/<YYYY-MM>/` 이동 (규약은 `docs/README.md` §아카이브 문서)
3. **참조하는 쪽을 같은 커밋에서 고친다** — 이게 이번에 미룬 이유다
4. **옮긴 문서 내부의 상대 경로도 깊이가 바뀐다** — `docs/planning/` → `docs/archive/planning/YYYY-MM/`
   은 `../` 가 `../../../` 이 된다. 이번에 `2026-05-28-blockers-launch.md` 에서 실제로 1건 깨졌다
5. 검증: `node scripts/check-docs.js` 로 **이동 파일발 깨진 링크 0** 확인

> ✅ `docs/archive/*` gitignore 함정은 이번 배치에서 이미 제거했다. 예전엔 `plans/`·`specs/`·
> `qa/`·`operations/` 로 아카이브하면 `git add` 가 조용히 거부됐다. 지금은 정상 동작한다.

**완료 조건**: 2026-06 이전 planning/plans/specs 잔존 0 · `check-docs.js` 상 이동 파일발
깨진 링크 0 · `docs/README.md` 목록이 실제 구조와 일치.

---

### D. 착지 (마지막)

1. 최신 `origin/master` 재통합 + 게이트 4종 재실행
2. **push + PR** — 사용자에게 확인받고 진행 (표준 승인은 로컬 커밋까지만이다)
3. PR 본문에 아래 **리뷰 주목 지점**을 반드시 싣는다:

   > 🔴 **동작 변경 1건** — `calculatePayByType` 이 `hoursWorked === 0` 에서
   > 일급·월급 **전액 → 0원** 으로 바뀌었다(`SettlementCalculator.calculateBasePay` 로 수렴).
   > 현재 호출부 2곳은 모두 0시간을 미리 걸러내므로 **도달 경로가 없다**. 다만 정산 금액
   > 축이라 리뷰가 필요하다. 근거·RED 확인은 커밋 `32a6b899f` 메시지와
   > `src/domains/settlement/__tests__/helpers.test.ts` 참조.

4. 머지 후: `docs/analysis/2026-08-12-cleanup-audit.md` §집행 현황 표를 최종 상태로 갱신
5. 워크트리 정리 — `git worktree remove .claude/worktrees/cleanup-batch1`
   🚨 정션 삭제는 `rm <path>`(재귀 없이). 재귀로 지우면 **메인 `node_modules` 원본이 날아간다**
6. 브랜치 삭제 전 아카이브 태그

---

## 3. 게이트 (매 커밋마다)

```bash
cd C:/Users/user/Desktop/T-HOLDEM/.claude/worktrees/cleanup-batch1/uniqn-mobile
npx tsc --noEmit          # EXIT 0
npx jest --silent         # 663 suites / 7,548+ tests, 실패 0
npm run quality           # EXIT 0 (경고 123은 기존 수준 — 에러만 0이면 됨)
npm run knip:gate         # EXIT 0
```

- `sed`/`perl` 로 대량 치환한 뒤엔 **`npx prettier --write "src/**/*.{ts,tsx}"`** 를 먼저 돌려라.
  안 하면 `format:check` 에서 `quality` 가 깨진다(이번 배치에서 2번 겪었다).
- pre-commit 훅이 ESLint --fix + Prettier 를 다시 돌리므로 커밋 후 diff 가 바뀔 수 있다.
- **완료를 주장하기 전에 이 세션에서 실제로 돌린 출력이 있어야 한다.** 이전 실행은 근거가 아니다.

---

## 4. 하지 말 것 (오삭제 방지 — 전부 실측으로 확인된 것)

| 대상 | 이유 |
|---|---|
| `src/components/app/SheetProvider.web.tsx` | 플랫폼 확장자 — metro 가 해석. 정적 참조 0은 정상 |
| `rootSentry.ts` / `rootSentry.web.ts` | **진짜** 플랫폼 분기. `sentryService` 쌍과 다르다 |
| `sentryService|crashlyticsService` 별칭 | 의도적 alias — knip Duplicate 1건은 남는 게 정상 |
| `weekly_grid_enabled` · `ops_hub_enabled` snake_case | 원격 `app_config` 행 키와 1:1 **DB 계약** — 리네임 금지 |
| `supervisor` / 한글 역호환 키 | 기존 DB 데이터 대응. 백필 없이 지우면 라벨 증발 |
| `constants/index.ts` ↔ `types/unified/role.ts` 라벨 맵 2벌 | **의도적 분기**(UserRole '스태프' vs StaffRole '직원'). 통합 시도 금지 — 제3값으로 회피했다 화면이 갈라진 이력 |
| `supabase/migrations/archive/` 248편 | 이력 보존 의도 |
| `.claude/wf-screen-audit*.js`, `.claude/pr-body.md` | 미추적 로컬 파일. 지워도 이득 없고 복구 불가 |
| 마이그레이션 파일 수정 | 기존 마이그는 절대 수정 금지 (새 파일로만) |

---

## 5. 참고 — 이번 배치에서 배운 것

- **knip 의 "미사용"은 배럴 재수출을 포함한다.** 구현부 선언인지 배럴인지 구분해야 진짜
  죽은 코드가 보인다. 구현부 미사용만 세면 훨씬 작다.
- **`app/` 트리는 bash `grep` 이 조용히 0건을 낸다.** 삭제 판정은 반드시 **Grep 도구**로,
  가능하면 `tsc` 교차검증까지.
- **한 줄 정규식은 여러 줄 혼합 import 를 놓친다.** `import X, {\n ... } from` 형태를
  `export default` 제거 때 놓쳤고 `tsc` 가 잡았다. 대량 치환 뒤 tsc 는 선택이 아니다.
- **주석은 정본을 정하지 못한다.** "Legacy alias" 라고 적힌 쪽이 주력인 선례가 있다.
  실사용 횟수로 판단하라.
- **같은 산식이 두 곳에 있으면 언젠가 갈린다.** 이번에 `calculatePayByType` 이 실제로
  갈려 있었다(0시간 축). 증상이 없었던 건 호출부가 우연히 그 입력을 걸러냈기 때문이다.
