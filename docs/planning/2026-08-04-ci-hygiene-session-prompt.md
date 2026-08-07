# CI 위생 세션 프롬프트 — E2E flake + GitHub Actions 범프 (2026-08-04 작성)

> 범위: `board.spec:88` flake 근본 수선 + Dependabot **actions 3건만** 착지
> 원장 밖 트랙 — 실행 원장(`2026-07-31-execution-session-prompts.md`)의 S7과 **독립**이고 충돌 0건이다.

---

## 착수 시점 상태 (2026-08-04 실측)

- master = `55260f2c2` (B2 #411)
- **시간모델 R2 웹 배포 완료** — CF `70ce3d05`, 번들 md5 라이브=로컬 일치. 🔴 **OTA 는 미발행**(사용자 보류)
- prod 파리티 **193 / 111** — 레포 기대값과 일치, 미적용 마이그 0건
- 병렬 세션: **S7(3-C 공고 시간 변경)이 `T-HOLDEM-timechange` 워크트리에서 진행 중** — 근무표·공고 시간 경로를 건드리므로 그쪽 파일은 손대지 말 것
- 이 세션의 예상 마이그레이션 = **0건** (DB 무관)

## 🔴 착수 전 필수

1. **전용 워크트리**(상시 규칙 — clean 이어도 예외 없음)
   ```
   git worktree add ../T-HOLDEM-cihygiene -b chore/ci-hygiene origin/master
   ```
   `node_modules` 는 PowerShell `New-Item -ItemType Junction` 으로 메인에서 연결(약 818개 확인).
   ⚠️ 정리할 때는 **정션 해제 선행** → `worktree remove` → 브랜치 삭제. 순서를 어기면 원본 `node_modules` 가 지워진다.
2. `.env.local` / `.env.development.local` 은 gitignore 라 메인 체크아웃에서 복사해야 앱이 뜬다.

---

## 과제 1 — E2E `board.spec:88` flake (주 과제)

### 대상
`uniqn-mobile/e2e/tests/p2-standard/board.spec.ts:88`
테스트명: **`게시판 홈과 제한 화면을 안내한다`**

### 알려진 증상
CI 에서 **간헐 실패 → 실패 잡만 재실행하면 통과**. PR #393(P1) 에서 실제로 이 패턴이 관측돼 "알려진 flake" 로 기록됐고, 그 뒤로도 재실행을 유발해 왔다. 원장 §"E2E 게이트 부재" 항목의 잔여 2건 중 하나다.

### 코드 구조 (읽고 시작할 것)
- `test.beforeAll` → `seedBoardPosts()` 가 `board_posts` 에 자유글 + employer TDA 글을 **DB 에 직접 시드**
- `test.afterAll` → `cleanupBoardPosts()` 가 시드한 2건을 id 로 삭제
- 88번 테스트 본문: `/board` 이동(`domcontentloaded`) → `basePage.waitForReady()` → 탭 4개(`공지/일정/자유/TDA`) 가시성 → `자유 탭` 클릭 → `waitForURL(/\/board\/free$/, 10s)` → `자유게시판` 텍스트 가시성(10s)

### 조사 규율 (fablize investigation-protocol 준수)
**증상 제거 ≠ 결함 제거.** `timeout` 을 늘리는 것은 수선이 아니다.

1. **재현 먼저** — flake 는 1회 실행으로 재현되지 않는다. 실패율을 **수치로** 잡아라:
   ```
   npx playwright test e2e/tests/p2-standard/board.spec.ts --repeat-each=20
   npx playwright test e2e/tests/p2-standard/board.spec.ts --repeat-each=20 --workers=4   # 병렬 경합 노출
   ```
   실패 시 trace/video 를 반드시 남겨 실제 화면을 관찰할 것(정적 코드 읽기는 관찰이 아니다).
2. **경쟁 가설 3개 이상**을 세우고 각각 증거를 모아라. 최소한 아래는 다뤄라:
   - H1: `beforeAll` 시드와 다른 spec 의 시드/정리가 **공유 DB 에서 경합**(병렬 워커·앞선 세션 잔여 행)
   - H2: `waitForReady()` 가 라우트 하이드레이션 완료를 실제로 보장하지 못해 탭 렌더 전에 단언이 들어감
   - H3: `getByText('자유게시판').first()` 가 **탭 라벨과 헤더 양쪽에 매칭**되어 전환 도중 옛 노드를 잡음
   - H4: `/board` → `/board/free` 라우트 전환 중 리스트 재조회로 인한 레이아웃 교체
3. **인과사슬을 끝까지** 추적한 뒤 수정하고, 수정 전/후를 같은 `--repeat-each` 로 재측정해 실패율 변화를 증거로 제시하라.
4. **기각한 가설과 근거**를 보고에 남겨라.

### ⚠️ 함정
- **`e2e/` 는 `npm run quality` 사각지대다** (eslint ignores). 상수·문구를 건드리면 `e2e/` 를 **별도 Grep** 해야 한다. PR#353 에서 제목 상한 25→40 상향 때 E2E 단언만 25 로 남아 CI red 가 난 실사고가 있다.
- 공유 Docker 스택은 병렬 세션이 함께 쓴다 — 로컬 DB 로 돌린다면 착수 전 상태를 재확인할 것.

---

## 과제 2 — Dependabot GitHub Actions 3건 (부수 과제)

### 대상 (이 3건만)
| PR | 내용 |
|---|---|
| **#376** | `actions/checkout` 4 → 7 |
| **#377** | `actions/upload-artifact` 4 → 7 |
| **#378** | `actions/setup-node` 4 → 7 |

### 🔴 이번 범위가 **아닌** 것 (건드리지 말 것)
| PR | 이유 |
|---|---|
| #379 `react-native-webview` 13.16.0 → 14.0.1 | **네이티브 메이저** — `version` bump + 새 EAS 빌드 필요. OTA 로 못 넘긴다 |
| #381 `expo-camera` 55.0.21 → 57.0.3 | 동일. SDK 기대값과의 정합 확인도 필요 |
| #380 `eslint-plugin-react-hooks` 5.2.0 → 7.1.1 | 메이저 — 신규 룰이 대량 에러를 낼 수 있어 별도 세션 |

### 확인할 것
- 메이저 범프이므로 각 액션의 **breaking change** 를 확인하라(특히 `upload-artifact` v4 이후 아티팩트 병합 동작 변경). 워크플로에서 실제로 쓰는 옵션만 대조하면 된다.
- **`.github/workflows/` 전체를 훑어** 같은 액션의 다른 버전 참조가 남지 않게 하라(Dependabot 은 자기 PR 범위만 고친다).
- ⚠️ **paths 필터 + required check = 영구 pending 데드락** 전례가 있다(#375). 액션을 올린 뒤 CI 가 실제로 완료 상태에 도달하는지 확인할 것.
- ⚠️ **master 에는 branch protection 이 아예 없다** — 머지 전 CI green 을 사람이 눈으로 확인해야 한다.

### 선택 — 같이 해도 되는 것
GitHub 하드닝 잔여의 **액션 SHA 핀**(태그 대신 커밋 SHA 고정)은 같은 파일을 건드리므로 이번에 묶는 게 효율적이다. 범위를 넓힐지는 착수 시 사용자에게 확인.

---

## 완료 기준 (이것 없이 완료 주장 금지)

- [ ] flake: 수정 **전** 실패율과 **후** 실패율을 같은 반복 실행 조건으로 측정한 수치 제시
- [ ] flake: 기각한 경쟁 가설과 근거 보고
- [ ] `npm run quality` exit 0 (경고 수는 선재 기준선과 대조)
- [ ] `npm test` 전량 통과 — 스위트/테스트 수를 기준선과 대조
- [ ] actions 3건: 워크플로 파일에 잔여 구버전 참조 0건(Grep 실측)
- [ ] PR CI 전 잡 green 확인 (재실행 횟수도 함께 보고 — 재실행으로 넘긴 것은 flake 미해결이다)
- [ ] 코드 직후 `code-reviewer`(fable) 리뷰

## 커밋·PR
- 커밋: `<type>(<scope>): <한글>` — 이 세션은 `fix(e2e):` / `ci(deps):`
- 로컬 커밋은 사전 승인됨. **push·PR 은 명시 요청 시에만.**
- master 직접 push 금지 — hotfix 도 PR 경유(E2E 게이트 우회 방지).
