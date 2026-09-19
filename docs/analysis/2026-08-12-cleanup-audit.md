# 정리 대상 전수 감사 — 레거시·중복·모순·불필요 (2026-08-12)

> 범위: 레포 전체(`uniqn-mobile/` 코드 + 루트 문서·설정). 분석 전용 — **코드 변경 없음**.
> 기준 커밋: `8b08010aa` (master, clean tree).
> 기계 증거: `npx tsc --noEmit` **EXIT 0**(정리 착수 기준선 green) · `npx knip` 실행(이슈 2,183) · `Grep` 도구 교차검증(`app/` 트리 bash grep 0건 함정 회피) · `find`/`wc` 실측.
> 선행 감사 대조: `docs/analysis/2026-07-16-full-codebase-cleanup-analysis.md` 항목 중 **A2·A3·A4·A6·A8, formatters 그림자, TABLE_COLUMNS 3벌, phoneSchema 중복, allowanceUtils, queryClient invalidationGraph = 전부 해소 확인**. 아래는 **그 이후 남은 것 + 새로 발견한 것**이다.

---

---

## 🟢 집행 현황 (2026-08-13, `chore/cleanup-batch1-20260813` 커밋 12개 — **감사 항목 전량 종료**)

| 항목 | 상태 | 결과 |
|---|---|---|
| §A 사문 컴포넌트 6종 | ✅ 완료 | 1,043줄 삭제 |
| §B2 release 스크립트 | ✅ 완료 | 복합 스크립트 제거 → `release:bump` + deploy 스킬에 단계별 순서 명문화 |
| §B3 parity stale 주석 | ✅ 완료 | `list_migrations` 실측으로 2곳 정정 |
| §B1 OptimizedImage | ✅ 완료 | 삭제 결정 — `DEFAULT_BLURHASH` 만 `utils/blurhash.ts` 로 이관 |
| §B4 ENVIRONMENT | ✅ 완료 | `@/config/env` 로 일원화 + `lib/env` 의 죽은 판정 함수 제거(07-16 감사 잔여) |
| §B6 테스트 배치 | ✅ 완료 | 코로케이트 5건 → `__tests__/` |
| §C1 `export default` | ✅ 완료 | 38건 제거 · Duplicate exports 57 → 21 |
| §E1 gitignore 사문 | ✅ 완료 | app2 22줄 + 3경로 제거 · **스킬 3종의 `cd app2` 죽은 지시문도 함께 정정** |
| §E2 고아 워크트리 | ✅ 완료 | 빈 디렉토리 2개 삭제 |
| §E5 문서 아카이브 | ✅ 완료 | 링크 0인 22편 + 참조 있는 24편(+동반 `.sh` 1) = **47건** 이동 완료 · **`docs/archive/*` gitignore 함정 발견·제거**(아카이브가 조용히 실패하던 원인) |
| §E6 브랜치 정리 | ✅ 완료 | 6 → 2 (머지 확인 후 5건 삭제, PR 없던 2건은 아카이브 태그) |
| §C4 중복 통합 4쌍 | ✅ 완료 | 정산 산식 단일 소유화 · **동작 변경 1건**(아래 🔴) |
| §C2 배럴 축소 | ✅ 완료 | 배럴 **7종 삭제 + 3종 축소** · knip 2,074 → **1,447**(래칫 2,079 → 1,447) |
| §C3 아이콘 별칭 20쌍 | ✅ 완료 | 별칭 24종 제거 · **Duplicate exports 21 → 1**(남은 1건은 의도적 alias) |

기계 증거(브랜치 tip `f65d70f0b` 이후, 2026-08-13 실측): `tsc --noEmit` EXIT 0 ·
`npm run quality` EXIT 0(에러 0) · `jest` 663 suites / **7,524 tests** 전량 통과 ·
`npm run knip:gate` EXIT 0 · `check-docs.js` 깨진 링크 165 → 165(**신규 0**).

> 테스트 수가 7,546 → 7,524 로 준 것은 **회귀가 아니다.** 아이콘 테스트가 전량 export 를
> 순회하는 구조라 별칭 24종을 지우면 테스트 케이스도 24개 사라진다(obsolete 스냅샷 24개
> 동반 제거). 스위트 수·실패 수는 그대로다.

### 🔴 리뷰가 필요한 잔여 2건

1. **동작 변경 — `calculatePayByType`**: `hoursWorked === 0` 에서 일급·월급이
   **전액 → 0원** 으로 바뀌었다(`SettlementCalculator.calculateBasePay` 로 수렴).
   현재 호출부 2곳은 모두 0시간을 미리 걸러내므로 **도달 경로가 없다**. 근거·RED 확인은
   커밋 `32a6b899f` 와 `src/domains/settlement/__tests__/helpers.test.ts`.
2. **파생 발견 — `src/hooks/useVersionCheck.ts` 가 미사용 파일**: `@/hooks` 배럴이
   참조를 유지해 가려져 있었다. 버전 게이트 **기능 자체는 살아 있다**
   (`useAppInitialize → versionService → app/_layout.tsx`). 이 훅은 MMKV 억제 로직을
   따로 가진 **병렬 사문 구현**이라, 기능 파일이므로 이번 배치에서 삭제하지 않고 남겼다.
   삭제 여부는 별도 판단이 필요하다.

---

## 요약 — 실행 우선순위

| 순위 | 항목 | 규모 | 위험 | 근거 |
|---|---|---|---|---|
| 1 | 완전 사문(死文) 컴포넌트 5종 삭제 | **1,043줄** | LOW | Grep 전수 — 자기 파일·배럴·주석 외 참조 0 |
| 2 | `.gitignore` 사문 규칙 정리 | 24줄 | LOW | `app2/`·`SHRIMP/`·`claude-forge/`·`qa-screenshots/` 전부 부재 |
| 3 | `export default` 중복 42+건 제거 | 57건 중 15건만 사용 | LOW | knip Duplicate exports + import 실측 |
| 4 | 배럴 과다 재수출 축소 | 미사용 export **2,118건** | LOW | knip (1,214 값 + 904 타입) |
| 5 | `package.json` `release` 스크립트 모순 | 1줄 | **MED** | squash 저장소 태그 고아화 — 메모리 규칙과 정면 충돌 |
| 6 | `parity_baseline_guard.test.sql` stale 주석 | 1줄 | **MED** | 반대 사실 기재 — 다음 배포 판단을 오도 |
| 7 | 중복 구현 4쌍 통합 | ~800줄 | MED | 07-16 감사 잔여 |
| 8 | 문서 158편 아카이브 | docs 311편 중 | LOW | 완료·폐기 플랜 |
| 9 | 고아 워크트리·브랜치 정리 | 2 디렉토리 + 6 브랜치 | LOW | `git worktree list` 대조 |

---

## A. 완전한 죽은 코드 — 삭제 가능 (1,043줄)

`Grep` 도구로 레포 전체를 훑어 **자기 자신·배럴 재수출·JSDoc 주석 외의 참조가 0인 것**만 남겼다.

| 대상 | 줄수 | 유일 참조 | 비고 |
|---|---|---|---|
| `src/components/applicant/StaffApplicantCard.tsx` | 512 | 자기 배럴 + 타 모듈 JSDoc 2줄 | "구직자 지원내역 카드" — 화면에서 완전히 대체됨 |
| `src/components/applicant/index.ts` | 34 | — | 위 배럴. `ConfirmationHistoryTimeline` 은 **직접 경로**로 살아있으니 파일은 남길 것 |
| `src/components/ui/OptimizedImage.tsx` | 241 | `Avatar.tsx` 가 `DEFAULT_BLURHASH` 상수 1개만 import | 🔴 아래 §B1 참조 |
| `src/components/navigation/PublicBottomTabBar.tsx` (+ 배럴 7줄, 테스트 41줄) | 129 | 자기 테스트 + 배럴만 | **테스트만 있는 죽은 컴포넌트** — 화면 사용처 0 |
| `src/components/employer/applicants/ApplicantCard/components/SimpleAssignmentSelector.tsx` | 127 | 배럴 + JSDoc | |
| `FixedBadge` (`src/components/jobs/PostingTypeBadge.tsx:118`) | ~10 | 선언부뿐 | 같은 파일 `UrgentBadge`·`TournamentBadge` 는 사용 중 |

> ⚠️ `StaffApplicantCard` 를 지우면 `src/components/employer/applicants/ApplicantCard/index.ts:14-15` 의 "스태프 뷰는 저기 쓰세요" 안내 주석도 함께 정정해야 한다(그 주석이 남으면 다음 사람이 없는 모듈을 찾는다).

## B. 모순 — 규칙·주석과 실제가 어긋난 것

### B1. `OptimizedImage` 는 만들어놓고 우회됐다 🔴
`src/components/ui/OptimizedImage.tsx` 는 `OptimizedImage`/`AvatarImage`/`BannerImage`/`ProductImage` 4종을 배럴로 내보내지만 **소비처가 0**이다. 대신 **14개 파일이 `expo-image` 를 직접 import** 한다.
→ 래퍼가 존재한다는 사실이 "이미지 최적화가 배선돼 있다"는 착각을 만든다. **삭제하고 `DEFAULT_BLURHASH` 만 `Avatar.tsx` 나 상수 파일로 옮기거나**, 반대로 14곳을 래퍼로 통일하거나 — 둘 중 하나. 지금 상태가 최악이다.

### B2. `package.json` `release` 스크립트가 squash 규칙과 충돌 🔴
```json
"release": "npm version patch -m \"chore(release): v%s\" && npm run release:build && npm run release:sync"
```
`npm version patch` 는 기본으로 **git 태그를 만든다**. 이 저장소는 squash 머지라 그 태그는 머지 후 고아 커밋을 가리킨다(메모리 확립 규칙: `npm version patch --no-git-tag-version` 을 쓸 것).
→ 실제 1.0.7 릴리스는 이 스크립트를 **안 쓰고** 수동 범프로 진행됐다. 스크립트가 문서와 반대를 가르치고 있다. `--no-git-tag-version` 추가 또는 스크립트 삭제.

### B3. `parity_baseline_guard.test.sql` stale 주석 🔴
```
supabase/tests/parity_baseline_guard.test.sql:172
--     🔴 prod 미적용 — 머지·prod 적용 전까지 주간 parity-smoke 가 111 vs 110 불일치를 보고한다.
```
해당 마이그레이션은 이미 prod 적용됐고, 같은 파일 `:176-177` 의 기계 마커(`PARITY_EXPECT_FUNCS=208` / `PARITY_EXPECT_POLICIES=110`)가 prod 실측과 일치한다. **주석만 반대 사실을 말한다** — 다음 배포에서 "불일치는 알려진 것"으로 오독될 위험.

### B4. `ENVIRONMENT` 는 프로덕션에서도 항상 `development`
`src/constants/version.ts:46` 이 `Constants.expoConfig?.extra?.environment` 를 읽는데, OTA 매니페스트의 이 값은 **항상 `development`** 다(확립된 함정). 이 값이 `versionInfo`(`:247`)를 거쳐 **설정 화면 버전 표시**(`app/(app)/settings/index.tsx:244`)까지 간다.
→ 환경 판정 단일 소스는 `@/config/env` 의 `env.*` 다. `ENVIRONMENT`·`versionInfo.environment` 를 그쪽으로 갈아끼우거나, 표시에서 환경 문자열을 빼라.

### B5. `requireAuth` 동명 이시그니처 (07-16 감사 잔여)
- `src/errors/guardErrors.ts:36` — 문자열 인자
- `src/shared/errors/hookErrorHandler.ts:141` — `asserts` 타입가드
같은 이름, 다른 계약. 07-16 감사에서 지적됐고 아직 그대로다.

### B6. 테스트 배치 관례 이탈 5건
`__tests__/` 하위 **642건** vs 코로케이트 **5건**:
`src/components/board/{BoardTabBar,BoardTypeBadge,BoardWriteFab,PinnedNoticeBanner}.test.tsx` · `src/utils/formatCompactCount.test.ts`
→ jest `testMatch` 가 둘 다 잡으므로 **실행은 된다**(죽은 테스트 아님). 관례만 어긋난 것 — 이동하면 끝.

### B7. `@deprecated` 인데 계약만 남은 prop 2개
`src/components/employer/settlement/TaxSettingsEditor.tsx:32,41` — `totalAmount`·`showPreview`. 세후 미리보기 블록이 제거돼 **무효**인데 "사용처 계약 유지"로 prop 만 남겼다. 실제 전달처를 확인해 0이면 제거.

## C. 중복

### C1. `export default` + named 이중 수출 — 57건 중 15건만 사용
knip Duplicate exports **57건**(대부분 `Component|default`). 실제 default import 는 레포 전체 **15건**(전부 `components/review/*` 계열 + `CalendarViewLazyEntry`).
→ 나머지 **42건 이상의 `export default` 는 순수 잉여**. 삭제해도 소비처 무변경.

### C2. 배럴 과다 재수출 — 미사용 export 2,118건
knip: 미사용 값 export **1,214** + 미사용 타입 export **904** = 2,118 (`knip:gate` 래칫 2,189 대비 여유 6).

배럴에서 발생한 것이 대부분:

| 배럴 | 미사용 값 | 미사용 타입 |
|---|---|---|
| `src/schemas/index.ts` | 117 | 82 |
| `src/hooks/index.ts` | 101 | 19 |
| `src/types/index.ts` | — | 89 |
| `src/repositories/index.ts` | 19 | 49 |
| `src/errors/index.ts` | 42 | 9 |
| `src/constants/index.ts` | 42 | 15 |
| `src/components/ui/index.ts` | 41 | 36 |

→ **구현부(비-배럴)에서 선언된 미사용 export 는 416건**. 이쪽이 진짜 정리 대상이고, 배럴 쪽은 "재수출을 실제 소비처만 남기게 좁히기" 작업이다. 래칫을 2,189 → 실측치로 조이는 것부터.

### C3. 아이콘 별칭 이중 명명 20쌍
`src/components/icons/index.tsx` 에 같은 아이콘이 두 이름으로 산다(`XMarkIcon|CloseIcon`, `CheckCircleIcon|CheckmarkCircleIcon|CheckmarkCircleOutlineIcon`, `MapPinIcon|MapIcon|LocationOutlineIcon` …).
→ **별칭 쪽도 109회 실사용 중**이라 죽은 코드는 아니다. 하지만 리뷰 때마다 "어느 쪽이 정본인가"를 다시 묻게 만든다. 한 이름으로 통일 + codemod 치환이면 20쌍이 사라진다.

### C4. 07-16 감사에서 남은 중복 쌍 4개
| 쌍 | 상태 |
|---|---|
| `domains/settlement/SettlementCalculator.ts` ↔ `domains/settlement/helpers.ts` | 공존 — 서비스/레포는 Calculator, 프레젠테이션은 helpers |
| `domains/settlement/TaxCalculator.ts` ↔ `utils/settlement/tax.ts` | 동일 `taxCore` 이중 파사드 |
| `SALARY_TYPE_LABELS` | `constants/index.ts:195` ↔ `utils/settlement/constants.ts:14` (3벌 → 2벌로 줄었으나 잔존) |
| `sentryService.ts`(467줄) ↔ `sentryService.web.ts`(291줄) | 플랫폼 분기 불필요한 로직 복붙. `rootSentry` 쌍은 **진짜 분기라 정상** |

### C5. 역할 라벨 맵 이중 (의도적 — 삭제 금지, 기록만)
`src/constants/index.ts:170` 과 `src/types/unified/role.ts:11` 이 둘 다 `USER_ROLE_LABELS + STAFF_ROLE_LABELS` 를 스프레드하고 **`staff` 키만 다르게 덮는다**(`'스태프'` vs `'직원'`).
→ UserRole 문맥 / StaffRole 문맥 구분을 위한 **의도적 분기**이고 양쪽에 2026-07-19 정리 주석이 붙어 있다. 통합 시도 금지 — 과거에 '일반'이라는 제3값으로 회피했다가 화면이 갈라진 이력이 있다.

## D. 레거시 잔재

- **`supervisor` / 한글 키 역호환**: `constants/index.ts:178,185`, `types/unified/role.ts:20`. StaffRole 6종에서 제거됐지만 기존 DB 데이터 대응으로 남김 — **백필 없이 지우면 라벨 증발**. 지우려면 마이그레이션 선행.
- **`@/components/employer/applicants/ApplicantCard/utils.ts:21`** 등 "Re-export for backward compatibility" 5곳(`SettlementCard`·`SettlementDetailModal`·`SettlementList`·`TaxSettingsEditor`). 전환기가 끝났는지 확인 후 소비처 직접 import 로.
- **`src/config/env.ts:135-136`** — `lib/env.ts` 의 `isDevelopment`/`isProduction` 을 `isDevelopmentEnv`/`isProductionEnv` 로 재수출("하위 호환성"). 두 모듈이 **서로 다른 방식으로 환경을 판정**한다(`config/env.ts:47` 은 `NODE_ENV` 도 봄, `lib/env.ts:101` 은 안 봄) — B4 와 같은 뿌리.
- **`marketing/`, `specs/`** — `specs/LEGACY_NOTICE.md` + `specs/react-native-app/README.md` 2파일뿐. 실질 사문.
- **`TODOS.md` (158줄)** — `## 전체 QA 발견 (2026-04-20)` 하위 **FIX WINDOW 2A~2E 5개 섹션 전부 ✅ 완료** 표기. `## 홈 대시보드 관련` 섹션은 **⛔ 폐기**(PR #276 으로 홈 화면 자체가 삭제됨). 살아있는 건 하위 4개 섹션뿐.

## E. 불필요한 파일·설정

### E1. `.gitignore` 사문 규칙 24줄 🔴
216줄 중, **존재하지 않는 경로**를 가리키는 규칙:

| 규칙 | 줄 | 실태 |
|---|---|---|
| `app2/…` 20건 + `!app2/src/**` | 160-180, 191 | `app2/` 디렉토리 **부재** (폐기된 Capacitor 웹앱) |
| `SHRIMP/` | 214 | 부재 |
| `claude-forge/` | 215 | 부재 |
| `qa-screenshots/` | 193 | 부재 |

> 🚨 `app2/` 는 메모리의 **유출 Google API 키 #1~4** 출처다. 디렉토리는 사라졌지만 gitignore 규칙이 남아 "아직 있는 프로젝트"처럼 보인다 — 정리하면서 GCP 키 폐기 잔여도 같이 닫는 게 자연스럽다.

### E2. 고아 워크트리 디렉토리 2개
`git worktree list` 는 **메인 하나만** 보고하는데 디스크에는 남아 있다:
- `.claude/worktrees/region-filter-p1/uniqn-mobile/supabase/` (0바이트, 08-04)
- `.claude/worktrees/ui-overflow-polish/uniqn-mobile/` (16K, 07-26)

`git worktree prune` 은 이미 깨끗하다(git 은 모른다) → **수동 삭제**. ⚠️ 정션이 남아 있을 수 있으니 재귀 삭제 전에 `node_modules` 유무 확인(재귀 삭제로 원본이 날아간 이력 있음).

### E3. 미추적 루트 잡파일
`.claude/wf-screen-audit.js`(320줄) + `wf-screen-audit-v2.js`(181줄) — **v1/v2 동시 존치**, 둘 다 미추적. `.claude/pr-body.md`, `.claude/scheduled_tasks.lock` 도 미추적 잔여.
`.claude/agents/` 는 **빈 디렉토리**(커스텀 에이전트는 전역 `~/.claude/agents/` 에 있음) — 삭제해도 무해.

### E4. `knip` 설정 힌트 4건
knip 이 직접 보고: `react-native-mmkv`·`react-native-nitro-modules`·`expo-intent-launcher` → `ignoreDependencies` 에서 제거 가능, `supabase` → `ignoreBinaries` 에서 제거 가능(이제 감지됨).
→ ⚠️ mmkv/nitro 는 **정확 핀 어긋나면 Android Kotlin 빌드가 깨지는** 조합이다. ignore 해제는 무해하지만 버전 핀은 절대 건드리지 말 것.

### E5. 문서 311편 — 아카이브 후보 158편
| 위치 | 편수 | 판정 |
|---|---|---|
| `docs/planning/` | 108 | 2026-07 이전 **18편**은 종료된 웨이브 |
| `docs/superpowers/plans` + `specs` | 66 | 2026-06 이전 **22편** 종료 |
| `docs/archive/**` | 이미 분리됨 | 유지 |
| `docs/README.md` | 1 | **최종 업데이트 2026-07-28** — 그 뒤 추가된 문서 미반영 |
| `CHANGELOG.md` | 106KB 단일 파일 | 연도/분기 분할 검토 |

> `wiki/` 는 08-10 lint 기준 stale 37 · 고아 25/70 · 미흡수 docs 154 로 진단돼 있다. **stale 판정은 오탐 다수**(`check-staleness.sh` 가 mtime 기반이라 `package.json`·`CLAUDE.md` 터치가 무관한 페이지를 깨움) — 목록을 그대로 믿고 손대지 말 것.

### E6. 브랜치 6개 잔존
`archive/ops-original-20260807` · `chore/prod-migrate-workflow-20260807` · `docs/3c-time-change-design` · `docs/work-time-editing-unification-design` · `fix/merge-review-medium-20260807` · `fix/notification-contract-alignment`

squash 저장소라 `--merged` 판정이 전부 0으로 나온다(머지 여부의 증거가 아님). PR 상태를 개별 확인 후, **삭제 전 아카이브 태그**를 남기고 정리.

---

## 하지 말아야 할 것 (오삭제 방지)

| 대상 | 이유 |
|---|---|
| `src/components/app/SheetProvider.web.tsx` | 플랫폼 확장자 — metro 가 해석. 정적 참조 0은 정상 |
| 아이콘 별칭 20쌍 | 109회 **실사용** — 통일은 codemod 동반 필요, 단순 삭제 금지 |
| `weekly_grid_enabled` · `ops_hub_enabled` snake_case 키 | 원격 `app_config` 행 키와 1:1 **DB 계약** — 리네임 금지 |
| `supabase/migrations/archive/` 248편(1.8MB) | 이력 보존 의도. `.graphifyignore` 로도 이미 색인 제외 |
| `rootSentry.ts` / `rootSentry.web.ts` | 진짜 플랫폼 분기 (C4 의 `sentryService` 쌍과 다름) |
| `src/constants/statusValues.ts` | `StatusMapper`·`eventQRService` 등에서 사용 중 — knip 은 배럴 재수출만 미사용으로 본 것 |
| `src/services/auth/portOneIdentityService.ts` | 일부 함수만 미사용, 모듈은 회원가입 본인인증 경로에서 살아있음 |

---

## 권장 실행 순서

1. **무위험 삭제 배치** — §A(1,043줄) + §C1(`export default` 42건) + §E1~E3(gitignore·워크트리·잡파일). 한 커밋씩 분리, 각 단계 `npm run quality`.
2. **모순 교정** — §B2(release 스크립트) · §B3(parity 주석) · §B6(테스트 이동). 전부 1~5줄.
3. **B1 결정** — `OptimizedImage` 를 죽이든 살리든 **한쪽으로**. 결정 전엔 §A 에서 이 파일만 빼둘 것.
4. **B4 환경 판정 일원화** — `ENVIRONMENT` → `@/config/env`. 배포 진단 신뢰도 문제라 §7보다 먼저.
5. **배럴 축소(§C2)** — 배럴 하나씩, 소비처 실측 후 좁히기. 끝날 때마다 `knip:gate` 래칫 조이기.
6. **중복 통합(§C4)** — 정산 계산 계열이 우선(과거 발산 이력). 등가성 테스트 선행 필수.
7. **문서 아카이브(§E5)** + 브랜치 정리(§E6).

> 각 단계 완료 조건은 `npm run quality` EXIT 0 + `npm test` 실패 0. 이 문서는 **실행 증거를 담고 있지 않다** — 삭제를 실제로 수행할 때 그 세션에서 다시 측정할 것.
