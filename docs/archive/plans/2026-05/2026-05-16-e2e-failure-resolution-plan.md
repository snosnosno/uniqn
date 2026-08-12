# E2E Test Failure Resolution Plan (2026-05-16)

## 0. 컨텍스트 — 5 PR 머지 후 baseline 확보

### Master Run 검증
- **run id**: 25951946403 (`workflow_dispatch`, 2026-05-16 03:45 → 04:10 UTC, 24m9s)
- **결과**: workflow `conclusion=success` (continue-on-error 마스킹) / job `conclusion=failure`
- **카운트**: 234 tests / **147 passed** / **59 failed** / 8 skipped / **20 did not run** (19.5m)

### 이전 → 현재 비교
| 항목 | 이전 (마지막 통과 후) | 현재 (5 PR 머지 후) | 변화 |
|------|----------|------|------|
| Pass | 70 | 147 | +77 |
| Fail | 119 | 59 | **-60** |
| Skip | 71 | 28 (skip+did_not_run) | -43 |

### 5 PR 효과 검증 ✅
| PR | 영역 | 효과 |
|----|------|------|
| #99 | artifact 회수 (list reporter + path + if:always) | report.zip + trace.zip 다운 가능 |
| #100 | identity_verified=true 시드 | 본인인증 게이트 103건 차단 해소 |
| #101 | 제3자 동의 체크박스 + Legacy public-pages | 동기화 완료 |
| #102 | dotenv quiet + BasePage 텍스트 동기화 | 노이즈 제거 |
| #103 | admin-report 동적 시드 (workspace+job_posting) | admin-report skip → run+pass |

### `continue-on-error: true` 현황 (e2e.yml:27)
- 워크플로우 게이트 무력화 상태 — fail 이 PR 머지 차단 안 함
- 59 fail 잔존이므로 즉시 제거 불가 (모든 master PR 차단됨)
- **제거 조건**: 잔존 fail 0건 도달 후

---

## 1. 잔존 59 Fail 분류

### Group A: `workspace_id NOT NULL` seed 실패 — **23건 (39%)**

**Root cause**: 2026-05-14 migration 으로 `job_postings.workspace_id NOT NULL` 전환됐으나, e2e seed 헬퍼들이 workspace_id 없이 INSERT 함. PR #103 가 admin-report 만 fix.

**영향 spec 8개**:
| spec | 라인 | 건수 |
|------|------|------|
| p0-critical/cancellation-lifecycle | 197, 278, 321, 386, 445, 504 | 6 |
| p1-important/employer-applicants | 172, 208, 265 | 3 |
| p1-important/employer-posting-crud | 93, 149, 166 | 3 |
| p1-important/employer-settlement | 166, 177, 210, 235 | 4 |
| p1-important/employer-collaborator-add | 86 | 1 |
| p1-important/collaborator-self-leave | 92 | 1 |
| p1-important/collaborator-shared-postings | 91 | 1 |
| p1-important/job-detail-apply | 99, 144, 247, 328 | 4 |

**에러 메시지**:
```
job_postings INSERT 실패: null value in column "workspace_id" of relation "job_postings" violates not-null constraint
```
또는 `job_posting seed 실패: ...` (helper 명칭에 따라)

### Group B: `expect(locator).toBeVisible() failed` — **22건**

UI 렌더링 / 데이터 부재 / 셀렉터 mismatch.

| spec | 라인 | 건수 |
|------|------|------|
| admin-report-resolution | 160, 222 | 2 |
| admin-board-reports | 5, 49 | 2 |
| admin-dashboard | 23 | 1 |
| admin-reports-announcements | 73, 95 | 2 |
| home-employer-toggle | 35, 68, 84 | 3 |
| public-pages | 22, 31 | 2 |
| board | 5, 121 | 2 |
| jobs-home | 22, 27 | 2 |
| review-system | 36, 58 | 2 |
| support-faq | 56, 62 | 2 |
| e2e-user-journeys | 186 | 1 |
| rbac-access | 132 | 1 |

⚠️ **Group A 의 downstream 가능성**: employer-* 테스트 (10건) 는 seed 가 fail 한 후 assertion 단계에서 toBeVisible 으로 잡히는 게 아니라 seed 단계에서 throw 됐을 가능성 — Phase 1 후 재실행으로 검증 필요.

### Group C: `locator.click/fill: Test timeout of 60000ms exceeded` — **12건**

UI 셀렉터 변경 또는 페이지 미로드.

| spec | 라인 | 건수 |
|------|------|------|
| jobs-home | 49, 61, 71, 86, 96, 107, 118, 179 | 8 |
| home-logo-no-stack-accumulation | 37, 77 | 2 |
| home-navigation-staff | 45 | 1 |
| board | 34 | 1 |

### Group D: `expect(received).toBeTruthy()` — **1건**

- jobs-home.spec.ts:35 ("초기 로드 시 공고가 있는 탭으로 자동 선택된다")

### Group E: `strict mode violation` — **1건**

- admin-reports-announcements.spec.ts:85 — `getByText('공지사항이 없습니다', { exact: true })` 가 2 elements resolve

---

## 2. 검증 결과 — Production 정상 / 100% 테스트 코드 문제

Page snapshot + master 코드 grep 으로 모든 의심 케이스 검증:

| 검증 케이스 | 테스트 expectation | 실제 master 상태 | 결론 |
|------|--------|--------|------|
| home-employer-toggle:45 | `getByText('이번 주 스태프 현황')` | widget title 은 `이번 주 스태프` (현황 없음). button aria-label 만 "이번 주 스태프 현황 전체 보기" | 테스트 셀렉터 stale |
| admin-dashboard:25 | `getByText('관리자 대시보드')` | 페이지 title 은 `관리자` 로 단축 | 테스트 셀렉터 stale |
| home-logo:46 | `getByRole('button', { name: 'UNIQN 홈으로 이동' })` | `TabHeader.tsx` 에 정확히 존재 ✅ | timeout 원인은 다른 곳 (page load 또는 dismiss onboarding) |
| jobs-home:22 | `homePage.header` (구인구직 헤더) | snapshot 은 staff 홈 ("다음 근무" widget) | page object 가 잘못된 라우트로 navigate |
| rbac-access:132 | `toBeVisible` | log: `workspace_id NOT NULL seed 실패` (Group A downstream) | Group A 해소 시 자동 fix |

**모든 fix 는 `e2e/**` 만 수정**. production code 변경 0건.

---

## 3. PR Phase 공통 제약

1. **production 코드 (`src/**`, `app/**`, `supabase/migrations/**`) 변경 금지** — 만약 검증 중 실제 production 버그 발견되면 **별도 PR 로 분리**.
2. **e2e/** 파일만 수정** — 시드 헬퍼, page object, spec selector.
3. 각 Phase 진입 전 page snapshot (`error-context.md`) 으로 production UI 정상 동작 확인 → selector/seed/page-object fix.
4. Phase 머지 후 master e2e run 트리거 → fail 카운트 감소 확인 → 다음 Phase.

---

## 4. PR Phase 계획

### Phase 1 — Group A workspace_id seed fix (23건)

**목표**: 59 → 36 (Group A 23 + Group B downstream 일부 추가 감소 가능)

**구현**:
1. **공통 헬퍼 신규** — `e2e/helpers/seedJobPosting.ts`
   - `ensureE2EWorkspace(adminClient, ownerId)` → `{ id: workspaceId }` (이름+owner 매칭 멱등)
   - `seedJobPosting(adminClient, { ownerId, ...overrides })` → `{ id: jobPostingId, workspaceId }`
   - PR #103 의 admin-report-resolution.spec.ts:71~ 로직 재사용
2. **8 spec 수정** — `from('job_postings').insert(...)` 호출부를 헬퍼로 치환
3. **로컬 검증** — `cd uniqn-mobile && npm run e2e` 또는 `npx playwright test e2e/tests/p0-critical/cancellation-lifecycle.spec.ts` 로 Group A 대상 spec 만 우선 통과 확인
4. **PR 생성** — 단일 PR (8 spec + 1 helper)

**검증 기준** (Red-Green):
- 헬퍼 작성 후 spec 수정 전: cancellation-lifecycle 6개 fail 재현
- 헬퍼 적용 후: 6개 pass
- Phase 1 머지 후 master e2e run: 36 이하 fail 도달

**예상 diff 크기**: ~200 LOC (헬퍼 ~80, 8 spec edit ~120)

### Phase 2 — Group C locator timeout (12건)

**전제**: production UI 가 정상 동작함을 page snapshot 으로 확인 후 selector/page-object fix.

**목표**: 36 → 24 (Group A fix 후 36 이라고 가정)

**조사 우선순위**:
- jobs-home.spec.ts (8건) — 가장 큰 비중. trace.zip 분석으로 어느 셀렉터가 60s 동안 미감지인지 확인.
- home-logo / home-navigation (3건) — UNIQN 로고 탭 동작이 master 에서 깨졌을 가능성 (최근 commits 확인)
- board:34 (1건) — 게시글 작성 흐름

**구현 방식**: per-spec 디버깅. trace 확인 → 코드/셀렉터 fix → spec 별로 push.

### Phase 3 — Group B 잔존 toBeVisible

**목표**: Phase 1, 2 후 잔존하는 Group B 만 대상.

**예상**: employer-* downstream 10개가 Phase 1 후 해소되면 12 남음 (admin-*, public-pages, review/faq).

### Phase 4 — Group D + E misc

**목표**: jobs-home:35 (toBeTruthy) + admin-reports-announcements:85 (strict mode).

**구현**: spec 별 1-line fix (toBeTruthy → 명시적 assertion, strict mode → `.first()` 또는 더 좁은 셀렉터).

### Phase 5 — `continue-on-error: true` 제거 PR

**조건**: 모든 master e2e run 이 0 fail 통과 확인

**구현**:
- `.github/workflows/e2e.yml:27` 라인 + 코멘트 제거
- 자체 PR 의 e2e 가 게이트로 작동하는지 self-test
- 머지 시 향후 e2e 실패가 PR 머지 차단

### Phase 6 — (선택) timeout / sharding 조정

- 현재 runtime 24m9s, timeout 45m — 마진 충분
- sharding 불필요 추정. 필요 시 `strategy.matrix.shard` 추가.

---

## 3. 다음 세션 첫 액션

1. **현재 working tree 확인** — PortOne/Modal in-progress 변경 (`SignupStepTerms.tsx`, `2026-05-13-third-party-consent-p0-p1-p3.md`) 보존
2. **본 plan 의 Phase 1 승인 재확인** — 헬퍼 추출 vs inline 옵션
3. **Phase 1 PR 워크트리 생성** — `git worktree add ../uniqn-e2e-workspace-id-seed-fix master`
4. **헬퍼 작성 → 8 spec 수정 → 로컬 검증 → PR 생성**

---

## 4. 참고 자료

### Run / Artifact
- **run 25951946403**: https://github.com/snosnosno/uniqn/actions/runs/25951946403
- **playwright-report**: artifact id 7030340576 (79MB)
- **e2e-test-results**: artifact id 7030341018 (85MB)
- **로컬 분석 위치**: `/tmp/e2e_arts/` (full_log.txt, all_failed_spec_lines.txt, error_map_final.txt, failed_only.txt)

### 5 PR 머지 커밋
- #99 4bbff9dc8 — artifact path
- #100 a7dba5be2 — identity_verified seed
- #101 cc4b42203 — 제3자 동의 + public-pages
- #102 d24d1eef4 — dotenv + BasePage
- #103 31bbd0f3b — admin-report 동적 시드

### 관련 마이그레이션
- 2026-05-14: `job_postings.workspace_id NOT NULL` 전환 (Phase 1 의 root cause)
- 2026-05-12 PR #88: 공고별 협업자 공유 (workspace 의존성 도입)

### 관련 문서
- `docs/superpowers/plans/2026-05-11-job-posting-collaborators.md`
- `docs/superpowers/plans/2026-05-12-jpc-tests-followup.md`
