# UI/UX 최적화 세션 인계 — 2026-09-11

> 다음 세션은 이 파일부터 읽는다. 아래 "복붙 프롬프트"를 그대로 새 세션에 넣어도 된다.

---

## 복붙 프롬프트

```
UI/UX 최적화 작업을 이어서 한다.

브랜치 docs/rn-list-performance-rules (master 대비 11커밋, HEAD 8dded0bec).
docs/planning/2026-09-11-ui-ux-handoff.md 를 먼저 읽어라.

지금 상태: 밀도 축도 radius 규칙도 소진됐다. 화면을 못 본 채 넣은 **시각 변경 3건**
(카드 elevation · 협업자 아바타 · 배지 11곳)이 쌓여 있고, 실기기 확인이 다음 게이트다.

먼저 git status 로 다른 세션 작업이 있는지 확인하고, 사용자에게 이번 회차 목표를 물어라.
```

---

## 무엇을 했나 — 커밋 11개 (1회차 7 + 2회차 3, 문서 인계 커밋 1)

| 커밋 | 내용 | 검증 |
|---|---|---|
| `027e56a5e` | 규칙: 혼합 타입 리스트 `getItemType` 필수 + Vercel RN 스킬 oss-vet 판정 기록 | 문서 |
| `dad8521b0` | `NotificationList` 에 `getItemType` 적용 | tsc 0 / jest 1 |
| `e6fe0da7e` | `ActionTileGrid` 프리미티브 승격 (`ui/`) | tsc 0 / eslint 0 / jest 6 suites 38 |
| `ec0bf6f81` | 밀도 룰 v4 등재 — `impeccable-design.md` §34-1~34-5 | 문서 |
| `d195ef405` | `내 공고` 고정 영역 416 → 308px | tsc 0 / eslint 0 / jest 5 suites 23 |
| `1768847ae` | **카드 elevation 재정의 — 67곳 영향** | tsc 0 / eslint 0 / jest 11 suites 106 |
| `8cc0a2e83` | 협업자 아바타를 공용 `Avatar` 로 통일 (원형 2곳 제거) | tsc 0 / eslint 0 / jest 2 suites 13 |
| `5b3134e78` | 미사용 `MobileHeader` 제거 (파일+배럴, 360줄) | tsc 0 / eslint 0 / jest 674 suites 7633 |
| `cab04f381` | **카운트·상태 배지 11곳 `rounded-sm` 통일** | tsc 0 / eslint 0 / jest 674 suites 7633, 스냅샷 98 |
| `8dded0bec` | `rounded-full` 규칙 재정의 + radius 표기 정정 (DESIGN.md·impeccable-design.md) | 문서 |

미커밋: `communication-notice-schedule.patch` (untracked, **내가 만든 것 아님** — 손대지 말 것)

---

## 🔴 다음 게이트 — 실기기 시각 확인

**시각 변경 **세 건**을 화면을 못 본 채로 넣었다.** 이 환경에 RN 시뮬레이터가 없다.

1. **`1768847ae` 카드 elevation** — 앱 전체 67곳
   - `elevated` 가 `bg-white dark:bg-surface-elevated shadow-md` → `bg-surface-card border border-divider`
   - **라이트는 배경색 무변** (`surface-card` 라이트 = `#FFFFFF`). 그림자가 빠지고 헤어라인이 생길 뿐
   - **다크는 카드가 한 단계 어두워진다** (`#1C1C22` → `#141418`). ← **이게 확인 1순위**
2. **`8cc0a2e83` 협업자 아바타** — 원형 → `rounded-sm`, 사진 없을 때 회색 아이콘 → 이름 이니셜
   - 화면: `(employer)/my-postings/[id]/collaborators`
3. **`cab04f381` 카운트·상태 배지 11곳** — 원형 → `rounded-sm`(4px)
   - `NotificationBadge`(탭바 알림 카운트, **상시 노출**) · `PostingTypeChips` 칩 내부 카운트 ·
     `RegionTaxonomyBrowser` 카운트 2 · `OrderRow` 2 · `PlayersTab` KO · `WorkTimeFields` 상태 ·
     `(ops)/tournaments` StatusBadge · `VenueDayPanel` 톤 박스
   - 공용 `Badge.tsx` 가 이미 `rounded-sm` 이라 **같은 화면 안의 배지 모양 불일치를 없앤 것**이다.
     다만 작은 카운트 배지가 원형 → 사각이 되면 인상이 바뀐다

되돌리기는 각각 커밋 하나 revert 로 끝난다.

---

## 판단 근거 아티팩트 2개

- **뷰포트 회수** (밀도) — https://claude.ai/code/artifact/9178d162-27cd-44d4-95df-2190dad689a3
- **그림자 없는 깊이** (카드 elevation) — https://claude.ai/code/artifact/c9cd20da-b73b-4ad0-86c7-96de37267363

둘 다 **실제 적용 결과로 갱신 완료**. 첫 판의 틀린 수치는 정정 표시를 달아 두었다.

---

## 실측으로 확정된 것 — 재조사 금지

### 밀도 축은 소진됐다

| 화면 | 고정 스택 | 판정 |
|---|---|---|
| `내 공고` | 416 → **308px** | 고쳤다 |
| `home-jobs` | **224px** | 양호 (룰 상한 210 에 근접) |
| `venue-settlements` | **148px** | 여유 |

`내 공고` 만 유독 심했던 이유: `ba3d08a77` 이 압축한 세 화면(공고 상세·프로필 수정·내 스케줄)
목록에서 빠져 있었다. 디자인 루프 A~Z 가 이미 전 화면을 훑었으므로 나머지는 수확 체감.

### 실현 불가로 판명된 것

- **카드 푸터 압축(-27px/장)** — 푸터에 공유·QR·마감·재오픈 **액션 버튼**이 들어 있다.
  지원자 수를 위로 올려도 줄이 남아 회수 0. 룰 §34-4 기준 "자기 줄을 가질 자격이 있는" 푸터다.

### 보류 (정보구조 변경이라 사람 판단 필요)

- **`내 공고` 의 '공유받은 공고' 섹션(-100px)** — 필터 탭에 `공유(n)` 로 흡수하면 회수되지만,
  사장이 늘 보던 자리가 사라진다. 이 앱에서 같은 유형 사고 전례 있음
  (`my-postings/[id]/index.tsx` 승격 카드 주석).

### radius — 앞선 진단 "51곳 위반은 오해였다"가 **틀렸다** (2026-09-11 2회차 정정)

`rounded-full` 을 다시 전수 분류한 결과, "아바타 2곳 빼고 전부 원형이 자연스러운 자리"는
사실이 아니었다. `src`+`app` 50건(주석 2건 제외 **48건**) + className grep 에 안 잡히는
인라인 `borderRadius: 999` 1건:

| 분류 | 곳 | 판정 |
|---|---|---|
| 필터 칩/필 — 예외에 명시돼 있던 범위 | 6 | ✅ 합치 |
| 그 외 선택 칩/필 (order-sheet 시트·`VenueSelector`·`RoleChips` 등) | 14 | 예외 문구가 좁았음 → 확대 |
| 라디오·체크 원 / dot / 스와치 / 오버레이 아이콘 버튼 | 11 | 원형이 곧 기능 → 예외 2 신설 |
| 카운트·상태 배지 | 11 | ❌ 규칙 정면 위반 → **`rounded-sm` 으로 수정 완료** (`cab04f381`) |
| 대형 아이콘 컨테이너 원 (`h-16`~`h-24`, 빈 상태·성공 화면) | 7 | ❌ 위반이나 **미결** — 아래 참조 |

- ✅ `DESIGN.md` 개정 완료 (`8dded0bec`): 예외 1(선택 칩/필 일반)·예외 2(원형이 기능인 요소)
  명문화, 카드·컨테이너·배지·아바타 금지는 유지, Decision log 3행 추가
- ✅ **radius 표기 자체가 틀려 있었다** — 문서가 "xs(4) sm(6)"이라 적었으나
  `tailwind.config.js:188` 은 `sm: 4px` 이고 **`rounded-xs` 클래스는 존재하지 않는다**.
  `DESIGN.md`·`.claude/rules/impeccable-design.md` 양쪽 정정. 없는 이름을 가리키는 규칙은
  지킬 수가 없다
- 🔴 **미결 부채 7곳** — 빈 상태·성공 화면의 대형 아이콘 원
  (`jobs/[id]/apply.tsx` 4 · `scan.tsx` 2 · `my-postings/create-success.tsx` 1).
  "컨테이너 금지"에 어긋나지만 체감이 큰 시각 변경이라 실기기 확인 뒤 판단. DESIGN.md 에도 명기됨
- 🔑 **교훈**: className grep 만으로 스타일 규칙 준수를 판정하면 인라인 스타일을 놓친다.
  `borderRadius: 999` 는 `rounded-full` 과 같은 뜻인데 grep 에 안 걸렸다
- `rounded-xl` 58곳은 `order-sheet/sheets/*` 에 집중 — 그 영역을 손볼 때 함께 정한다

---

## 🚨 이번 세션에서 물린 함정

### 1. `node_modules` 가 비어 있었다 (복구 완료)

세션 도중 `uniqn-mobile/node_modules` 가 **항목 0개**였다. `npm ci` 로 복구(818 항목).

**위험했던 이유는 검증이 조용히 무력화된 것이다.** `tsconfig.json` 의
`extends: "expo/tsconfig.base"` 가 해소되지 않으면 `strict`·`lib`·`paths` 가 전부 무효가 되고,
`type-check` 는 `supabase/functions/` 를 ES5 로 검사하며 **무관한 에러로 exit 2** 를 낸다.
통과도 실패도 아닌 무의미한 실행이라 "원래 저런 에러가 있나 보다" 하고 지나치기 쉽다.

👉 **`type-check` 가 `supabase/functions` 에러를 뱉으면 먼저 `node_modules/expo/tsconfig.base.json`
존재를 확인하라.**

### 2. 배럴 import 가 `jest.mock` 에 먹혔다 (해결 완료)

`ActionTileGrid` 를 `@/components/ui` 배럴로 붙였더니 **type-check exit 0 인데 jest 35건이
`TypeError: Cannot read properties of undefined` 로 죽었다.** 이 화면 테스트 6종이
`jest.mock('@/components/ui', () => ({ ActionSheet: () => null }))` 로 배럴을 통째로
갈아끼우는데, 그 목에 없는 export 는 조용히 `undefined` 가 된다. **tsc 는 목 문자열을 안 본다.**

👉 새 프리미티브를 화면에 붙일 때는 **직접 경로**를 쓰거나, 그 화면 테스트의 `jest.mock` 을 먼저 확인하라.

### 3. 규칙 문서 grep 으로 "갭"을 판정하면 틀린다

`useCallback` 이 `.claude/rules/`·CLAUDE.md 에 0건이라 "콜백 안정화 규칙이 없다"고 판단했으나,
**코드는 이미 전 리스트가 지키고 있었다**(관행 정착, 명문화만 누락). Vercel 룰 13종을 흡수하려던
계획이 코드 실측 후 **2종**으로 줄었다. 👉 **문서가 아니라 코드를 재라.**

---

## 다음에 할 수 있는 것

우선순위 순.

1. **실기기 확인 후 판단** ← 권장. 위 두 시각 변경을 보고 유지/되돌리기 결정
2. **PR 생성** — 11커밋을 묶어 올린다 (아직 push 안 함)
3. **역할 혼재 풀기** — 하단 탭바에 `내 스케줄`(스태프용)과 `내 공고`(사장용)가 섞여 있다.
   사장은 5개 탭 중 2개를 안 쓰고 스태프도 마찬가지. **밀도보다 체감 변화가 클 수 있으나
   네비게이션 구조 변경이라 범위가 크다.** 세션 초반 방향 선택지 중 하나였다
4. ✅ **`DESIGN.md` rounded-full 규칙 정정 완료** (`8dded0bec`) — 아래 radius 절 참조
5. **`InfoRow` 중복 통합** — `ui/InfoRow`(접근성·hint·children·dense) vs
   `employer/settlement/SettlementDetailModal/InfoRow`(highlight·valueColor). 겹치는 게 라벨-값
   뿐이라 **정산 화면을 손볼 때 함께** 하는 게 맞다고 판단해 미뤘다

### 부수 발견 (미처리)

- ✅ **`MobileHeader.tsx` 죽은 코드 제거 완료** (`5b3134e78`) — `MobileHeader`/`HeaderAction`/
  `LargeHeader` 셋 다 사용처 0 확인 후 파일과 배럴 export 를 삭제했다. knip 이 파일을
  "Unused files" 로 안 잡았던 이유는 배럴이 붙잡고 있었기 때문. `employer.tsx` 의
  `WorkspaceHeaderAction` 은 이름만 비슷한 별개 컴포넌트다. `useAnimatedStyle` 로 height 를
  애니메이트하던 룰 위반 2건도 함께 사라졌다(실행되지 않던 코드라 동작 변화 없음)
- **React Compiler 미사용** — React 19.2 인데 `app.json`·`babel.config.js` 에 설정 0.
  켜면 Reanimated `.value` 54곳이 `.get()`/`.set()` 전환 대상이 된다 (별도 판단 사안)
- **`ApplicantList.tsx` 도 `getItemType` 후보** — `selectionMode && isApplied` 분기라 선택 모드에서
  두 레이아웃이 실제로 섞인다. 다만 둘 다 `ApplicantCard` 를 써서 `NotificationList` 보다 이득이 작다

---

## 신설된 규칙 (이번 세션)

- `.claude/rules/nativewind-patterns.md` **§6** 혼합 타입 리스트 `getItemType` 필수 /
  **§7** `renderItem` 은 `useCallback` + deps
- `.claude/rules/impeccable-design.md` **§34 (v4 밀도)** — 세로 픽셀을 예산으로 다룬다.
  체크리스트 마지막 항목이 **"실제로 쟀는가"** 인데, 이번 회차는 **클래스 산술 추정**이라
  그 항목을 아직 못 채웠다
- `.claude/rules/skills-guide.md` — Vercel `react-native-skills` 조건부 채택 근거 + 탈락 기록
  (`ui-ux-pro-max` 126k stars 지만 우리 `impeccable-design` 과 중복 + 디자인 시스템 생성기가
  Black&Gold 확정인 우리에겐 무용)
