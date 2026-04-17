# 게시판 대타 구인 버그 4건 + Json Zod 검증 Implementation Plan (PR A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시판 대타 구인 기능의 4개 버그(아카이브 분기 모호성, toast 미노출, jobPostingId 검증 부재, 테스트 부재) 수정 + JSONB 필드 2곳(`board_posts.metadata`, `applications.cancellation_request`) Zod 검증 추가.

**Architecture:** Service 레이어 변경 중심. 아키텍처 제약(Service → UI store 직접 호출 금지) 준수 — `requestCancellation`이 result 객체 반환 → Hook/Component에서 toast 표시.

**Tech Stack:** TypeScript, Zod, Jest, React Native, Zustand(toastStore), Supabase.

**Spec:** `docs/superpowers/specs/2026-04-17-tech-debt-cleanup-design.md` §PR A

**Branch:** `fix/board-bugs-json-zod-2026-04-17`
**Worktree:** `.claude/worktrees/fix-board-bugs-json-zod/`

---

## File Structure

### Create
- `uniqn-mobile/src/schemas/boardMetadata.schema.ts` — `board_posts.metadata` JSONB Zod 스키마
- (선택) `uniqn-mobile/src/repositories/supabase/__tests__/BoardRepository.zod.test.ts` — Json Zod 전용 테스트 (통합 시 확장 가능)

### Modify
- `uniqn-mobile/src/services/jobs/applicationService.ts`
  - `requestCancellation` return type → `Promise<CancellationResult>`
  - `reviewCancellationRequest` JSDoc + 인라인 주석 확장
- `uniqn-mobile/src/services/boardService.ts:1729`
  - `createSubstitutePost`: `jobPostingId` 런타임 검증
- `uniqn-mobile/src/repositories/supabase/BoardRepositoryHelpers.ts` (또는 `BoardRepository.ts`)
  - `metadata` 필드 파싱을 `BoardPostMetadataSchema.safeParse()`로 감쌈
- `uniqn-mobile/src/repositories/supabase/ApplicationRepository.ts`
  - `cancellation_request` 필드 파싱을 `cancellationRequestSchema.safeParse()`로 감쌈
- `uniqn-mobile/src/services/jobs/__tests__/applicationService.substitute.test.ts`
  - +5 테스트 케이스 (bug #1 × 2, bug #2 × 3)
- `uniqn-mobile/src/services/__tests__/boardService.substitute.test.ts`
  - +7 테스트 케이스 (bug #3 × 1, bug #4 × 6)
- `uniqn-mobile/app/(app)/(tabs)/schedule.tsx:259,385`
  - `requestCancellation` result 사용 + toast
- `uniqn-mobile/src/components/home/widgets/CancellationWidget.tsx`
  - `requestCancellation` result 사용 + toast
- `uniqn-mobile/src/hooks/applicant/useCancellationManagement.ts` (존재 시)
  - mutation onSuccess에서 result 전파 확인

### Tests
- Existing tests to extend + new Json Zod tests

---

## Task 1: Worktree 생성 + baseline 확인

**Files:** 없음 (환경 세팅)

- [ ] **Step 1: 메인 세션에서 worktree 생성**

Run (in main session, not worktree):
```
EnterWorktree({ name: "fix-board-bugs-json-zod" })
```

이후 모든 step은 이 worktree 내부에서 실행.

- [ ] **Step 2: 현재 test baseline 기록**

```bash
cd uniqn-mobile && npx jest src/services/__tests__/boardService.substitute.test.ts src/services/jobs/__tests__/applicationService.substitute.test.ts --no-coverage 2>&1 | tail -15
# 출력: 현재 통과 테스트 수 기록 (예: "Tests: 8 passed")
# 이 숫자를 메모: BASELINE_TESTS=8 (이후 증가 확인용)
```

- [ ] **Step 3: requestCancellation 호출처 전수 조사**

```bash
cd uniqn-mobile && grep -rn "requestCancellation" --include="*.ts" --include="*.tsx" src/ app/ 2>/dev/null | grep -v "__tests__" | grep -v ".d.ts"
# 출력 예:
#   src/services/jobs/applicationService.ts:181: export async function requestCancellation(
#   src/services/jobs/index.ts:X: export { requestCancellation } ...
#   src/hooks/applicant/useCancellationManagement.ts:X: requestCancellation(...)
#   app/(app)/(tabs)/schedule.tsx:259: const { cancelApplication, requestCancellation, ... } = useApplications();
#   app/(app)/(tabs)/schedule.tsx:385: requestCancellation({...})
#   src/components/home/widgets/CancellationWidget.tsx:X: (호출 발견)
# 이 목록을 Task 7에서 참조
```

---

## Task 2: Bug #1 — 아카이브 분기 Regression lock-in 테스트

**Files:**
- Modify: `uniqn-mobile/src/services/jobs/__tests__/applicationService.substitute.test.ts`

- [ ] **Step 1: 현재 테스트 파일 구조 확인**

```bash
cd uniqn-mobile && head -30 src/services/jobs/__tests__/applicationService.substitute.test.ts
# 출력: import/describe 구조 파악
```

- [ ] **Step 2: 두 개의 regression lock-in 테스트 추가**

Edit `uniqn-mobile/src/services/jobs/__tests__/applicationService.substitute.test.ts`. `describe('reviewCancellationRequest ...')` 블록 내부에 추가 (없으면 새 describe 블록 생성):

```typescript
describe('reviewCancellationRequest - substitute post archive behavior (regression lock-in)', () => {
  it('archives substitute post when cancellation is approved', async () => {
    // Arrange
    const mockReviewTx = jest.spyOn(applicationRepository, 'reviewCancellationWithTransaction').mockResolvedValue(undefined);
    const mockGetById = jest.spyOn(applicationRepository, 'getById').mockResolvedValue({
      id: 'app-1',
      jobPostingId: 'job-1',
      applicantId: 'user-1',
    } as any);
    const archiveSpy = jest.spyOn(boardService, 'archiveSubstitutePostByLinkedPosting').mockResolvedValue(undefined);

    // Act
    await applicationService.reviewCancellationRequest(
      { applicationId: 'app-1', approved: true, reviewNote: 'OK' },
      'reviewer-1'
    );

    // Assert
    expect(archiveSpy).toHaveBeenCalledWith('job-1', 'user-1');
    expect(archiveSpy).toHaveBeenCalledTimes(1);
  });

  it('archives substitute post when cancellation is rejected', async () => {
    // Arrange
    jest.spyOn(applicationRepository, 'reviewCancellationWithTransaction').mockResolvedValue(undefined);
    jest.spyOn(applicationRepository, 'getById').mockResolvedValue({
      id: 'app-2',
      jobPostingId: 'job-2',
      applicantId: 'user-2',
    } as any);
    const archiveSpy = jest.spyOn(boardService, 'archiveSubstitutePostByLinkedPosting').mockResolvedValue(undefined);

    // Act
    await applicationService.reviewCancellationRequest(
      { applicationId: 'app-2', approved: false, reviewNote: 'denied' },
      'reviewer-2'
    );

    // Assert: 거절도 동일하게 archive (spec 결정)
    expect(archiveSpy).toHaveBeenCalledWith('job-2', 'user-2');
    expect(archiveSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: 테스트 실행 — 이미 PASS해야 함 (regression lock-in 이므로)**

```bash
npx jest src/services/jobs/__tests__/applicationService.substitute.test.ts -t "substitute post archive behavior" --no-coverage
# 출력: Tests: 2 passed
# (FAIL 나면 mock 설정 또는 파일 위치 문제. import 경로 확인)
```

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/src/services/jobs/__tests__/applicationService.substitute.test.ts
git commit -m "$(cat <<'EOF'
test(application): 취소 심사 후 대타글 아카이브 동작 regression lock-in

승인/거절 모두에서 대타글이 아카이브되는 현 동작을 테스트로 고정.
향후 "거절 시만 아카이브"로 축소 시 이 테스트가 실패하여 의도 변경을
명시적으로 강제함.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Bug #1 — JSDoc + 인라인 주석 확장

**Files:**
- Modify: `uniqn-mobile/src/services/jobs/applicationService.ts:250-300`

- [ ] **Step 1: `reviewCancellationRequest` 함수 JSDoc 추가**

Edit `uniqn-mobile/src/services/jobs/applicationService.ts`. 라인 250 근처 `export async function reviewCancellationRequest` 위에 JSDoc 추가:

```typescript
/**
 * 취소 요청 심사 (승인 또는 거절).
 *
 * 부수효과:
 *   - 승인/거절 모두 성공 시 관련 대타 구인 게시글을 archived 상태로 전환
 *     (동일 jobPostingId + 동일 applicantId의 active 대타글)
 *
 * 아카이브 조건 설계 근거:
 *   - 거절 시: 원 지원자가 계속 참석 → 대타 불필요
 *   - 승인 시: 슬롯 재오픈 + 정식 지원 루트로 전환 → 대타 임무 완료
 *   - 양쪽 모두: 취소 요청 라이프사이클 종료 = 대타글 종료
 *
 * 동작 변경 시 주의:
 *   - applicationService.substitute.test.ts의 regression lock-in 테스트가
 *     의도 변경을 명시적으로 강제함. 분기 로직 추가 시 해당 테스트 업데이트 필요.
 *
 * 아카이브는 non-blocking: 실패 시 logger.warn, 심사 자체는 성공 처리.
 */
export async function reviewCancellationRequest(
```

- [ ] **Step 2: 인라인 주석 강화 (라인 284 근처)**

Edit 같은 파일. 현재 라인 284의 주석을 교체:

```typescript
// BEFORE:
// 대타 글 아카이브: 취소 거절 시(대타 불필요) AND 취소 승인 시(슬롯 재오픈, 대타 임무 완료)
```

```typescript
// AFTER:
// 대타글 아카이브 (승인/거절 공통):
//   · 거절 → 원 지원자 계속 참석 → 대타 불필요
//   · 승인 → 슬롯 재오픈, 정식 지원 루트 전환 → 대타 임무 완료
//   · 분기 추가 시 applicationService.substitute.test.ts 의 regression
//     lock-in 테스트 업데이트 필수 (현재 양쪽 동일 동작 고정)
```

- [ ] **Step 3: 타입 체크 + 테스트 재실행**

```bash
cd uniqn-mobile && npm run type-check 2>&1 | tail -5
# 출력: 에러 없음
npx jest src/services/jobs/__tests__/applicationService.substitute.test.ts --no-coverage 2>&1 | tail -5
# 출력: Tests: N passed (Task 2에서 추가한 2 테스트 여전히 통과)
```

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/src/services/jobs/applicationService.ts
git commit -m "$(cat <<'EOF'
docs(application): reviewCancellationRequest 아카이브 분기 의도 명시

JSDoc에 승인/거절 공통 아카이브 설계 근거 명시. 인라인 주석 확장.
코드 변경 없음 — regression lock-in 테스트가 동작 보호.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Bug #3 — linkedJobPostingId 런타임 검증 (RED → GREEN)

**Files:**
- Modify: `uniqn-mobile/src/services/__tests__/boardService.substitute.test.ts`
- Modify: `uniqn-mobile/src/services/boardService.ts:1729`

- [ ] **Step 1: 실패 테스트 작성 (RED)**

Edit `uniqn-mobile/src/services/__tests__/boardService.substitute.test.ts`. `describe('createSubstitutePost', ...)` 블록 내부에 추가:

```typescript
it('rejects creation when jobSummary.jobPostingId is missing', async () => {
  // Arrange
  const input = {
    authorId: 'user-1',
    authorName: 'Alice',
    authorRole: 'staff' as const,
    applicationId: 'app-1',
    reason: 'Schedule conflict',
    jobSummary: {
      // jobPostingId 의도적 누락
      title: 'Bar Shift',
      workDate: '2026-04-20',
      locationName: 'Pub',
      compensationLabel: '80000원',
    } as any,
  };

  // Act + Assert
  await expect(boardService.createSubstitutePost(input)).rejects.toMatchObject({
    name: 'AppError',
    code: expect.stringMatching(/VALIDATION/i),
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패해야 함 (RED)**

```bash
cd uniqn-mobile && npx jest src/services/__tests__/boardService.substitute.test.ts -t "rejects creation when jobSummary.jobPostingId is missing" --no-coverage
# 출력: FAIL — 현재 구현은 jobPostingId 누락을 허용 (undefined로 Repository 호출)
# expected rejection but got fulfillment
```

- [ ] **Step 3: 최소 구현 (GREEN)**

Edit `uniqn-mobile/src/services/boardService.ts`. `createSubstitutePost` 함수(라인 1729) 본문 시작 부분에 추가:

```typescript
export async function createSubstitutePost(input: CreateSubstitutePostInput): Promise<string> {
  await requireMatchingCurrentUser(input.authorId);

  // 대타 글은 원 공고 연결이 필수 (아카이브 필터링 + 지원자 네비게이션에 사용).
  // 타입 상 BoardJobSummary.jobPostingId는 string이지만 런타임에 undefined/empty
  // 유입 방지를 위한 이중 가드.
  if (!input.jobSummary?.jobPostingId) {
    throw toValidationError(
      'jobSummary.jobPostingId은 대타 구인 글 작성 시 필수입니다.'
    );
  }

  const title = `대타 구해요 · ${input.jobSummary.title}`;
  // ... (기존 로직 유지)
```

`toValidationError` import 확인:
```bash
grep -n "toValidationError" uniqn-mobile/src/services/boardService.ts | head -3
# 출력: import 이미 존재하면 OK. 없으면 파일 상단에 추가:
#   import { toValidationError } from '@/errors';
```

- [ ] **Step 4: 테스트 재실행 — 통과해야 함 (GREEN)**

```bash
npx jest src/services/__tests__/boardService.substitute.test.ts -t "rejects creation when jobSummary.jobPostingId is missing" --no-coverage
# 출력: Tests: 1 passed
```

- [ ] **Step 5: 기존 테스트 regression 확인**

```bash
npx jest src/services/__tests__/boardService.substitute.test.ts --no-coverage 2>&1 | tail -10
# 출력: 기존 5 + 신규 1 = 6 passed (또는 baseline + 1)
```

- [ ] **Step 6: Commit**

```bash
git add uniqn-mobile/src/services/boardService.ts uniqn-mobile/src/services/__tests__/boardService.substitute.test.ts
git commit -m "$(cat <<'EOF'
fix(board): 대타 구인 글 생성 시 jobPostingId 필수 검증

타입 상 non-optional이지만 런타임 undefined/empty 유입 방지를 위한
이중 가드. toValidationError로 AppError 변환. 테스트로 고정.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Bug #4 — archiveSubstitutePostByLinkedPosting 6 테스트 케이스

**Files:**
- Modify: `uniqn-mobile/src/services/__tests__/boardService.substitute.test.ts`

- [ ] **Step 1: 6개 테스트 케이스 추가 (RED는 없음 — 기존 동작 검증)**

Edit 같은 파일. 새 describe 블록:

```typescript
describe('archiveSubstitutePostByLinkedPosting', () => {
  const mockGetPosts = () => jest.spyOn(boardRepository, 'getPosts');
  const mockSetStatus = () => jest.spyOn(boardRepository, 'setPostStatus');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('archives single active substitute post', async () => {
    mockGetPosts().mockResolvedValue([
      { id: 'post-1', boardType: 'substitute', status: 'active' } as any,
    ]);
    const setStatusSpy = mockSetStatus().mockResolvedValue(undefined);

    await boardService.archiveSubstitutePostByLinkedPosting('job-1', 'user-1');

    expect(setStatusSpy).toHaveBeenCalledWith('post-1', 'archived');
    expect(setStatusSpy).toHaveBeenCalledTimes(1);
  });

  it('archives multiple active substitute posts', async () => {
    mockGetPosts().mockResolvedValue([
      { id: 'p1' } as any,
      { id: 'p2' } as any,
      { id: 'p3' } as any,
    ]);
    const setStatusSpy = mockSetStatus().mockResolvedValue(undefined);

    await boardService.archiveSubstitutePostByLinkedPosting('job-1', 'user-1');

    expect(setStatusSpy).toHaveBeenCalledTimes(3);
    expect(setStatusSpy).toHaveBeenNthCalledWith(1, 'p1', 'archived');
    expect(setStatusSpy).toHaveBeenNthCalledWith(2, 'p2', 'archived');
    expect(setStatusSpy).toHaveBeenNthCalledWith(3, 'p3', 'archived');
  });

  it('no-op when no active substitute posts exist', async () => {
    mockGetPosts().mockResolvedValue([]);
    const setStatusSpy = mockSetStatus().mockResolvedValue(undefined);

    await expect(
      boardService.archiveSubstitutePostByLinkedPosting('job-1', 'user-1')
    ).resolves.toBeUndefined();

    expect(setStatusSpy).not.toHaveBeenCalled();
  });

  it('filters by authorId (권한 격리)', async () => {
    const getPostsSpy = mockGetPosts().mockResolvedValue([]);
    mockSetStatus().mockResolvedValue(undefined);

    await boardService.archiveSubstitutePostByLinkedPosting('job-X', 'user-X');

    expect(getPostsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedJobPostingId: 'job-X',
        authorId: 'user-X',
      })
    );
  });

  it('filters by boardTypes: substitute only', async () => {
    const getPostsSpy = mockGetPosts().mockResolvedValue([]);
    mockSetStatus().mockResolvedValue(undefined);

    await boardService.archiveSubstitutePostByLinkedPosting('job-Y', 'user-Y');

    expect(getPostsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        boardTypes: ['substitute'],
        statuses: ['active'],
      })
    );
  });

  it('non-blocking: swallows repository error with logger.warn', async () => {
    const { logger } = require('@/utils/logger');
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    mockGetPosts().mockRejectedValue(new Error('DB unreachable'));

    await expect(
      boardService.archiveSubstitutePostByLinkedPosting('job-Z', 'user-Z')
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to archive substitute posts (non-blocking)',
      expect.objectContaining({ linkedJobPostingId: 'job-Z', authorId: 'user-Z' })
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 — 6개 모두 통과해야 함**

```bash
cd uniqn-mobile && npx jest src/services/__tests__/boardService.substitute.test.ts -t "archiveSubstitutePostByLinkedPosting" --no-coverage
# 출력: Tests: 6 passed
# 하나라도 FAIL 시: mock 설정 / import 경로 / 실제 구현 로직 불일치 중 하나. 코드 확인.
```

- [ ] **Step 3: 전체 테스트 regression 확인**

```bash
npx jest src/services/__tests__/boardService.substitute.test.ts --no-coverage 2>&1 | tail -10
# 출력: 기존 + 1(task 4) + 6(task 5) = baseline + 7 passed
```

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/src/services/__tests__/boardService.substitute.test.ts
git commit -m "$(cat <<'EOF'
test(board): archiveSubstitutePostByLinkedPosting 단위 테스트 6건 추가

케이스: 단수 아카이브 / 복수 아카이브 / 빈 결과 no-op /
authorId 권한 격리 / boardType substitute 필터 / non-blocking 에러.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Bug #2 — Service 시그니처 변경 (result object) RED → GREEN

**Files:**
- Modify: `uniqn-mobile/src/services/jobs/applicationService.ts`
- Modify: `uniqn-mobile/src/services/jobs/__tests__/applicationService.substitute.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (RED) — Service 레벨**

Edit `uniqn-mobile/src/services/jobs/__tests__/applicationService.substitute.test.ts`. 새 describe 블록 추가:

```typescript
describe('requestCancellation - substitute post result reporting', () => {
  const baseInput = {
    applicationId: 'app-1',
    reason: 'Schedule conflict',
    wantsSubstitutePost: true,
  };
  const applicantContext = {
    name: 'Alice',
    role: 'staff' as const,
    jobSummary: {
      jobPostingId: 'job-1',
      title: 'Bar',
      workDate: '2026-04-20',
      locationName: 'Pub',
      compensationLabel: '80000',
    },
  };

  beforeEach(() => {
    jest.spyOn(applicationRepository, 'requestCancellationWithTransaction').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns substitutePost: "created" on success', async () => {
    jest.spyOn(boardService, 'createSubstitutePost').mockResolvedValue('post-1');

    const result = await applicationService.requestCancellation(baseInput, 'user-1', applicantContext);

    expect(result).toEqual({ substitutePost: 'created' });
  });

  it('returns substitutePost: "failed" when createSubstitutePost throws', async () => {
    jest.spyOn(boardService, 'createSubstitutePost').mockRejectedValue(new Error('Board DB error'));

    const result = await applicationService.requestCancellation(baseInput, 'user-1', applicantContext);

    expect(result).toEqual({ substitutePost: 'failed' });
  });

  it('returns substitutePost: "skipped" when wantsSubstitutePost=false', async () => {
    const createSpy = jest.spyOn(boardService, 'createSubstitutePost');

    const result = await applicationService.requestCancellation(
      { ...baseInput, wantsSubstitutePost: false },
      'user-1',
      applicantContext
    );

    expect(result).toEqual({ substitutePost: 'skipped' });
    expect(createSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
cd uniqn-mobile && npx jest src/services/jobs/__tests__/applicationService.substitute.test.ts -t "substitute post result reporting" --no-coverage
# 출력: FAIL — requestCancellation은 현재 void 반환, result 객체 미존재
```

- [ ] **Step 3: 구현 (GREEN)**

Edit `uniqn-mobile/src/services/jobs/applicationService.ts` 파일 상단(RequestCancellationInput 근처)에 타입 추가:

```typescript
/**
 * requestCancellation 결과 — 대타 구인 글 생성 부수효과 상태 보고.
 * Service는 UI 의존성 금지 규칙 준수. UI 레이어에서 이 값을 보고 toast 표시.
 */
export type CancellationResult = {
  substitutePost: 'created' | 'skipped' | 'failed';
};
```

이어서 함수 시그니처 변경 (라인 181 근처):

```typescript
// BEFORE:
export async function requestCancellation(
  input: RequestCancellationInput,
  applicantId: string,
  applicantContext?: { name: string; role: BoardAuthorRole; jobSummary: BoardJobSummary }
): Promise<void> {

// AFTER:
export async function requestCancellation(
  input: RequestCancellationInput,
  applicantId: string,
  applicantContext?: { name: string; role: BoardAuthorRole; jobSummary: BoardJobSummary }
): Promise<CancellationResult> {
```

함수 본문 변경 (라인 211-229 영역):

```typescript
// BEFORE:
    // 대타 글 생성 (best-effort: 실패해도 취소 요청은 유지)
    if (validationResult.data.wantsSubstitutePost && applicantContext) {
      try {
        await createSubstitutePost({...});
        logger.info('Substitute post created', { applicationId: input.applicationId });
      } catch (substituteError) {
        logger.warn('Substitute post creation failed (non-blocking)', {...});
      }
    }

    trace.putAttribute('status', 'success');
    trace.stop();
    trackEvent('cancellation_request', {...});
  } catch (error) {
    ...
  }
}

// AFTER:
    // 대타 글 생성 (best-effort: 실패해도 취소 요청은 유지).
    // UI 레이어는 이 결과를 보고 적절한 toast 표시.
    let substitutePost: CancellationResult['substitutePost'] = 'skipped';
    if (validationResult.data.wantsSubstitutePost && applicantContext) {
      try {
        await createSubstitutePost({
          authorId: applicantId,
          authorName: applicantContext.name,
          authorRole: applicantContext.role,
          applicationId: input.applicationId,
          jobSummary: applicantContext.jobSummary,
          reason: validationResult.data.reason,
        });
        substitutePost = 'created';
        logger.info('Substitute post created', { applicationId: input.applicationId });
      } catch (substituteError) {
        substitutePost = 'failed';
        logger.warn('Substitute post creation failed (non-blocking)', {
          applicationId: input.applicationId,
          error: substituteError,
        });
      }
    }

    trace.putAttribute('status', 'success');
    trace.putAttribute('substitute_post', substitutePost);
    trace.stop();

    trackEvent('cancellation_request', {
      application_id: input.applicationId,
      wants_substitute: validationResult.data.wantsSubstitutePost,
      substitute_post: substitutePost,
    });

    return { substitutePost };
  } catch (error) {
    trace.putAttribute('status', 'error');
    trace.stop();
    throw handleServiceError(error, {
      operation: 'Request cancellation',
      component: 'applicationService',
      context: { applicationId: input.applicationId, applicantId },
    });
  }
}
```

- [ ] **Step 4: 테스트 재실행 — 3개 모두 통과**

```bash
npx jest src/services/jobs/__tests__/applicationService.substitute.test.ts -t "substitute post result reporting" --no-coverage
# 출력: Tests: 3 passed
```

- [ ] **Step 5: 타입 체크 (호출처에서 타입 에러 발생 예상 — 다음 task에서 수정)**

```bash
cd uniqn-mobile && npm run type-check 2>&1 | grep -E "error|requestCancellation" | head -10
# 출력 예: TS2322 등 — schedule.tsx, CancellationWidget 등 호출처가 void 기대하는 곳.
# 이 에러들이 Task 7에서 수정될 call site 목록 제공.
```

- [ ] **Step 6: Commit (call site 수정 전이지만 Service 단계 완료)**

```bash
git add uniqn-mobile/src/services/jobs/applicationService.ts uniqn-mobile/src/services/jobs/__tests__/applicationService.substitute.test.ts
git commit -m "$(cat <<'EOF'
feat(application): requestCancellation return CancellationResult

대타 구인 글 생성 상태를 UI 레이어로 전달 (created/skipped/failed).
Service → UI store 직접 호출 금지 규칙 준수 — 결과 객체 반환 방식.
호출처 수정은 후속 커밋에서.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Bug #2 — UI 콜사이트 업데이트 + toast 연결

**Files:**
- Modify: `uniqn-mobile/app/(app)/(tabs)/schedule.tsx` (라인 385 근처)
- Modify: `uniqn-mobile/src/components/home/widgets/CancellationWidget.tsx`
- Modify: `uniqn-mobile/src/hooks/applicant/useCancellationManagement.ts` (필요 시)
- Modify: `uniqn-mobile/src/hooks/*` — `useApplications` 훅 (mutation 정의처)

- [ ] **Step 1: useApplications 훅에서 requestCancellation mutation 정의 찾기**

```bash
cd uniqn-mobile && grep -rn "useApplications\|cancelApplication\|requestCancellation" src/hooks/ --include="*.ts" --include="*.tsx" | grep -E "mutationFn|useMutation|function useApplications"
# 출력: 훅 정의 위치 확인
```

- [ ] **Step 2: mutation onSuccess 계약 확인**

해당 훅 파일 열어서 `requestCancellation` mutation 정의 확인:

```typescript
// 예상 현재 코드:
const requestCancellationMutation = useMutation({
  mutationFn: (args: { applicationId: string; reason: string; ...}) =>
    applicationService.requestCancellation(input, applicantId, applicantContext),
  onSuccess: () => { ... },
  ...
});
```

mutation의 `data` 타입이 `CancellationResult`로 자동 추론되는지 확인. 명시적 타입이 있으면 `CancellationResult`로 수정.

- [ ] **Step 3: schedule.tsx 콜사이트 수정 (라인 385 근처)**

Edit `uniqn-mobile/app/(app)/(tabs)/schedule.tsx`:

```typescript
// BEFORE (라인 385 근처):
      requestCancellation(
        { applicationId, reason, wantsSubstitutePost, applicantContext },
        {
          onSuccess: () => {
            toast.success('취소 요청이 전송되었습니다.');
            ...
          },
          ...
        }
      );

// AFTER:
      requestCancellation(
        { applicationId, reason, wantsSubstitutePost, applicantContext },
        {
          onSuccess: (result) => {
            toast.success('취소 요청이 전송되었습니다.');
            // 대타 구인 글 생성 결과에 따른 보조 toast
            if (result?.substitutePost === 'failed') {
              toast.warning(
                '대타 구인 글 생성에 실패했습니다. 게시판에서 수동으로 작성해 주세요.'
              );
            }
            ...
          },
          ...
        }
      );
```

`toast` import 확인:
```bash
grep -n "useToastStore\|toast\." "uniqn-mobile/app/(app)/(tabs)/schedule.tsx" | head -5
# 출력: 이미 toast 사용처 있으면 그 패턴 따라감
```

- [ ] **Step 4: CancellationWidget.tsx 콜사이트 수정**

```bash
cd uniqn-mobile && grep -n "requestCancellation" src/components/home/widgets/CancellationWidget.tsx
# 출력: 수정할 라인 식별
```

schedule.tsx와 동일한 패턴으로 수정:
- `onSuccess: (result) => { ... if (result?.substitutePost === 'failed') { toast.warning(...) } }`

- [ ] **Step 5: 타입 체크**

```bash
cd uniqn-mobile && npm run type-check 2>&1 | grep -E "error TS|requestCancellation|CancellationResult" | head -10
# 출력: 에러 없음 (모든 call site 업데이트됨)
```

에러가 더 있으면 해당 파일도 같은 패턴으로 수정.

- [ ] **Step 6: 전체 테스트 실행 — regression 없음 확인**

```bash
cd uniqn-mobile && npx jest src/services/jobs/__tests__/applicationService.substitute.test.ts src/services/__tests__/boardService.substitute.test.ts --no-coverage 2>&1 | tail -5
# 출력: 모두 통과
```

- [ ] **Step 7: Commit**

```bash
git add uniqn-mobile/app uniqn-mobile/src/components uniqn-mobile/src/hooks
git commit -m "$(cat <<'EOF'
fix(application): 대타 구인 글 생성 실패 시 toast 경고 표시

requestCancellation result.substitutePost === 'failed' 일 때
게시판에서 수동 작성 안내 toast. schedule.tsx + CancellationWidget
모든 호출처 업데이트.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Json Zod #1 — board_posts.metadata 스키마 + Repository 통합

**Files:**
- Create: `uniqn-mobile/src/schemas/boardMetadata.schema.ts`
- Modify: `uniqn-mobile/src/repositories/supabase/BoardRepositoryHelpers.ts` (또는 `BoardRepository.ts`)
- Modify: `uniqn-mobile/src/repositories/supabase/__tests__/BoardRepository.zod.test.ts` (신규)

- [ ] **Step 1: board_posts.metadata 사용처 확인**

```bash
cd uniqn-mobile && grep -rn "metadata" src/repositories/supabase/BoardRepository*.ts | grep -v "comment_" | head -20
# 출력: metadata 필드 매핑 위치 파악 (toDomain 또는 mapRow 함수)
```

```bash
grep -rn "BoardJobSummary\|jobSummary" src/types/board.ts src/services/boardService.ts 2>/dev/null | head -10
# 출력: BoardJobSummary 타입 정의 확인 (스키마 작성에 필요)
```

- [ ] **Step 2: 스키마 작성**

Write `uniqn-mobile/src/schemas/boardMetadata.schema.ts`:

```typescript
/**
 * board_posts.metadata JSONB 필드 Zod 스키마.
 *
 * @description
 *   - `jobSummary`: 대타 구인 글이 연결된 원 공고 정보 (BoardJobSummary 참조)
 *   - `applicationId`: 대타 글 생성 트리거가 된 지원 ID
 *   - 기타 키: `passthrough`로 미래 확장 허용
 *
 * 파싱 실패 시: Repository에서 safeParse → logger.error + 빈 객체 fallback
 */

import { z } from 'zod';

export const BoardJobSummarySchema = z.object({
  jobPostingId: z.string(),
  title: z.string(),
  workDate: z.string().optional(),
  locationName: z.string().optional(),
  compensationLabel: z.string().optional(),
});

export const BoardPostMetadataSchema = z
  .object({
    jobSummary: BoardJobSummarySchema.optional(),
    applicationId: z.string().optional(),
  })
  .passthrough();

export type BoardPostMetadata = z.infer<typeof BoardPostMetadataSchema>;
```

- [ ] **Step 3: Zod 테스트 작성 (RED→GREEN 불필요, 스키마 자체 검증)**

Write `uniqn-mobile/src/repositories/supabase/__tests__/BoardRepository.zod.test.ts`:

```typescript
import { BoardPostMetadataSchema } from '@/schemas/boardMetadata.schema';

describe('BoardPostMetadataSchema', () => {
  it('parses valid substitute post metadata', () => {
    const input = {
      jobSummary: {
        jobPostingId: 'job-1',
        title: 'Bar Shift',
        workDate: '2026-04-20',
        locationName: 'Pub',
        compensationLabel: '80000',
      },
      applicationId: 'app-1',
    };
    const result = BoardPostMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobSummary?.jobPostingId).toBe('job-1');
    }
  });

  it('passes through unknown keys (forward compat)', () => {
    const input = {
      jobSummary: { jobPostingId: 'j', title: 't' },
      customField: 'future-value',
    };
    const result = BoardPostMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).customField).toBe('future-value');
    }
  });

  it('fails on jobSummary with missing required jobPostingId', () => {
    const input = { jobSummary: { title: 'x' } };
    const result = BoardPostMetadataSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts null/missing jobSummary (optional)', () => {
    const result = BoardPostMetadataSchema.safeParse({ applicationId: 'a' });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 4: Zod 테스트 실행 — 모두 통과**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/BoardRepository.zod.test.ts --no-coverage
# 출력: Tests: 4 passed
```

- [ ] **Step 5: Repository에 safeParse 통합**

Edit `uniqn-mobile/src/repositories/supabase/BoardRepositoryHelpers.ts` (metadata 매핑 함수 위치). 현재 매핑 코드를 찾아서 safeParse로 감싸기:

```typescript
// BEFORE (예상):
metadata: row.metadata as BoardPostMetadata,

// AFTER:
metadata: (() => {
  if (row.metadata === null || row.metadata === undefined) {
    return {};
  }
  const parsed = BoardPostMetadataSchema.safeParse(row.metadata);
  if (!parsed.success) {
    logger.error('Invalid board_posts.metadata JSON', {
      postId: row.id,
      zodErrors: parsed.error.issues,
    });
    return {}; // fallback — UI는 빈 메타데이터로 렌더 (대타 정보 미표시)
  }
  return parsed.data;
})(),
```

import 추가 (파일 상단):
```typescript
import { BoardPostMetadataSchema } from '@/schemas/boardMetadata.schema';
import { logger } from '@/utils/logger';
```

`BoardPostMetadata` 타입을 `@/types/board`에서 쓰고 있다면 그 export도 스키마와 일관 유지:
```bash
grep -n "BoardPostMetadata" uniqn-mobile/src/types/board.ts
# 출력 확인. 필요시 type alias 재수출:
# export type { BoardPostMetadata } from '@/schemas/boardMetadata.schema';
```

- [ ] **Step 6: 전체 Board 관련 테스트 실행**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/BoardRepository.zod.test.ts src/services/__tests__/boardService.substitute.test.ts src/services/__tests__/boardService.test.ts --no-coverage 2>&1 | tail -10
# 출력: 모두 통과 (regression 없음)
```

- [ ] **Step 7: Commit**

```bash
git add uniqn-mobile/src/schemas/boardMetadata.schema.ts uniqn-mobile/src/repositories/supabase/BoardRepositoryHelpers.ts uniqn-mobile/src/repositories/supabase/__tests__/BoardRepository.zod.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): board_posts.metadata Zod 검증 추가

JSONB 필드 런타임 파싱 안전성. 파싱 실패 시 logger.error +
빈 객체 fallback (UI는 대타 정보 없이 렌더). passthrough로
미래 스키마 확장 허용.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Json Zod #2 — applications.cancellation_request Repository 통합

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/ApplicationRepository.ts`
- Modify: `uniqn-mobile/src/repositories/supabase/__tests__/ApplicationRepository.zod.test.ts` (신규)

기존 `cancellationRequestSchema` (`src/schemas/application.schema.ts:110`)를 재사용.

- [ ] **Step 1: ApplicationRepository에서 cancellation_request 매핑 위치 찾기**

```bash
cd uniqn-mobile && grep -n "cancellation_request\|cancellationRequest" src/repositories/supabase/ApplicationRepository.ts src/repositories/supabase/ApplicationRepositoryHelpers.ts 2>/dev/null | head -10
# 출력: 매핑 함수 위치 파악
```

- [ ] **Step 2: DB 저장 구조 스키마 작성 (입력 스키마와 별도)**

기존 `cancellationRequestSchema`(라인 110)는 "입력 검증" 용도. DB 저장 JSON은 추가 필드(requestedAt, status, reviewedAt 등)를 포함하므로 **별도 스키마** 작성이 명확함.

먼저 DB 실 저장 구조 확인 (실제 샘플 row 참조):
```bash
# 테스트 DB에 샘플 있으면 확인 또는 repository mapping 코드 참조
grep -n "cancellation_request" uniqn-mobile/src/repositories/supabase/ApplicationRepository*.ts | head -5
# 출력: 매핑 함수에서 사용하는 필드 목록 파악
```

Edit `uniqn-mobile/src/schemas/application.schema.ts` 하단에 추가:

```typescript
/**
 * applications.cancellation_request JSONB 필드 Zod 스키마.
 * 입력 스키마(cancellationRequestSchema)와 달리 DB 저장 시점의
 * 메타데이터(requestedAt, status 등)를 포함.
 */
export const cancellationRequestStoredSchema = z.object({
  reason: z.string(),
  requestedAt: z.string(), // ISO datetime
  requestedBy: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewNote: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),
  wantsSubstitutePost: z.boolean().optional(),
}).passthrough();

export type CancellationRequestStored = z.infer<typeof cancellationRequestStoredSchema>;
```

실제 DB 필드가 위와 다르면 (예: `cancellation_requested_at` snake_case 그대로 저장) 확인 후 스키마 조정. **핵심 원칙**: Repository의 현 mapping 코드가 읽는 키와 스키마의 키가 일치해야 함.

- [ ] **Step 3: Repository Zod 테스트 작성**

Write `uniqn-mobile/src/repositories/supabase/__tests__/ApplicationRepository.zod.test.ts`:

```typescript
import { cancellationRequestStoredSchema } from '@/schemas/application.schema';
// 재사용하면: import { cancellationRequestSchema } from '@/schemas/application.schema';

describe('cancellationRequestStoredSchema', () => {
  it('parses valid cancellation request JSON', () => {
    const input = {
      reason: 'Schedule conflict',
      requestedAt: '2026-04-17T09:00:00Z',
      requestedBy: 'user-1',
      status: 'pending',
      wantsSubstitutePost: true,
    };
    const result = cancellationRequestStoredSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('returns failure on invalid status enum', () => {
    const input = {
      reason: 'x',
      requestedAt: '2026-04-17T09:00:00Z',
      requestedBy: 'u',
      status: 'unknown-status',
    };
    const result = cancellationRequestStoredSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Zod 테스트 실행**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ApplicationRepository.zod.test.ts --no-coverage
# 출력: Tests: 2 passed
```

- [ ] **Step 5: Repository에 safeParse 통합**

Edit `uniqn-mobile/src/repositories/supabase/ApplicationRepository*.ts`. cancellation_request 매핑 위치에:

```typescript
// BEFORE (예상):
cancellationRequest: row.cancellation_request ?? null,

// AFTER:
cancellationRequest: (() => {
  if (row.cancellation_request === null || row.cancellation_request === undefined) {
    return null;
  }
  const parsed = cancellationRequestStoredSchema.safeParse(row.cancellation_request);
  if (!parsed.success) {
    logger.error('Invalid applications.cancellation_request JSON', {
      applicationId: row.id,
      zodErrors: parsed.error.issues,
    });
    return null; // fallback — UI는 취소 요청 없음으로 렌더
  }
  return parsed.data;
})(),
```

import 추가:
```typescript
import { cancellationRequestStoredSchema } from '@/schemas/application.schema';
import { logger } from '@/utils/logger';
```

- [ ] **Step 6: 전체 application 테스트 실행**

```bash
cd uniqn-mobile && npx jest src/services/jobs/__tests__/ src/repositories/supabase/__tests__/ApplicationRepository.zod.test.ts --no-coverage 2>&1 | tail -10
# 출력: 모두 통과
```

- [ ] **Step 7: Commit**

```bash
git add uniqn-mobile/src/schemas/application.schema.ts uniqn-mobile/src/repositories/supabase/ApplicationRepository.ts uniqn-mobile/src/repositories/supabase/__tests__/ApplicationRepository.zod.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): applications.cancellation_request Zod 검증 추가

과거 timestamp 스키마 순서 버그(6e24a4868) 예방. 파싱 실패 시
logger.error + null fallback. UI는 취소 요청 없음으로 degrade.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 최종 quality gate + push + PR

**No Files Modified**

- [ ] **Step 1: 전체 quality gate 통과 확인**

```bash
cd uniqn-mobile && npm run quality 2>&1 | tail -15
# 출력: type-check, lint, format:check 모두 통과
```

- [ ] **Step 2: 영향 테스트 전체 실행**

```bash
npx jest src/services/jobs/__tests__/ src/services/__tests__/boardService src/repositories/supabase/__tests__/ --no-coverage 2>&1 | tail -10
# 출력: 모두 통과. 카운트는 baseline + 17 예상.
```

- [ ] **Step 3: 커버리지 확인 (선택)**

```bash
npx jest src/services/jobs/applicationService.ts src/services/boardService.ts --coverage --collectCoverageFrom='src/services/jobs/applicationService.ts' --collectCoverageFrom='src/services/boardService.ts' 2>&1 | grep -A 10 "File"
# 출력: 영향 파일 커버리지. 80% 이상 목표.
```

- [ ] **Step 4: git log 확인**

```bash
git log --oneline master..HEAD
# 출력 예 (8 commits):
#   <sha>  feat(schema): applications.cancellation_request Zod 검증 추가
#   <sha>  feat(schema): board_posts.metadata Zod 검증 추가
#   <sha>  fix(application): 대타 구인 글 생성 실패 시 toast 경고 표시
#   <sha>  feat(application): requestCancellation return CancellationResult
#   <sha>  test(board): archiveSubstitutePostByLinkedPosting 단위 테스트 6건 추가
#   <sha>  fix(board): 대타 구인 글 생성 시 jobPostingId 필수 검증
#   <sha>  docs(application): reviewCancellationRequest 아카이브 분기 의도 명시
#   <sha>  test(application): 취소 심사 후 대타글 아카이브 동작 regression lock-in
```

- [ ] **Step 5: 브랜치 push**

```bash
git push -u origin fix/board-bugs-json-zod-2026-04-17
```

- [ ] **Step 6: PR 생성**

```bash
gh pr create --title "fix(board): 대타 구인 버그 4건 + Json Zod 검증 추가" --body "$(cat <<'EOF'
## Summary
- **Bug #1** 아카이브 분기 문서화: JSDoc + 인라인 주석 + regression lock-in 테스트 2건
- **Bug #2** createSubstitutePost 실패 시 사용자 알림: Service return type → `CancellationResult`, UI에서 toast 표시
- **Bug #3** linkedJobPostingId 런타임 검증: `createSubstitutePost` 진입 가드
- **Bug #4** `archiveSubstitutePostByLinkedPosting` 단위 테스트 6건
- **Json Zod #1** `board_posts.metadata` 파싱 safeParse + fallback
- **Json Zod #2** `applications.cancellation_request` 파싱 safeParse + fallback

## 아키텍처 준수
- Service 레이어에서 UI store 직접 호출 금지 → result 객체 반환 방식 채택
- Repository 레이어에서 JSONB 파싱 실패 시 logger.error + fallback (앱 crash 방지)

## Test plan
- [x] `applicationService.substitute.test.ts` +5 케이스 통과
- [x] `boardService.substitute.test.ts` +7 케이스 통과
- [x] `BoardRepository.zod.test.ts` 신규, 4 케이스 통과
- [x] `ApplicationRepository.zod.test.ts` 신규, 2 케이스 통과
- [x] `npm run quality` 통과
- [ ] Reviewer: schedule.tsx / CancellationWidget에서 toast 메시지 문구 UX 확인
- [ ] Reviewer: BoardPostMetadataSchema의 `passthrough` 정책 (미래 확장 허용) 동의 확인

## Spec
`docs/superpowers/specs/2026-04-17-tech-debt-cleanup-design.md` §PR A

## Rollback
`git revert <sha>` 각 커밋별 독립 revert 가능. 의존 순서: Task 7은 Task 6 revert 시 함께 revert 필요.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: PR URL 보고**

```bash
gh pr view --web
# 브라우저 URL을 사용자에게 전달
```

- [ ] **Step 8: 메인 세션으로 복귀 (서브에이전트 아닌 메인에서)**

```
ExitWorktree({ action: "keep" })
# 사용자 merge 후 remove로 최종 정리
```

---

## 완료 기준

- [ ] +17 테스트 추가, 모두 GREEN (bug #1 × 2 + bug #2 × 3 + bug #3 × 1 + bug #4 × 6 + zod × 6)
- [ ] `npm run quality` 통과
- [ ] `requestCancellation` 호출처 전부 result 확인 + toast 연결
- [ ] `createSubstitutePost` jobPostingId 가드 작동 (테스트 PASS)
- [ ] `archiveSubstitutePostByLinkedPosting` 6개 케이스 커버
- [ ] `board_posts.metadata`, `applications.cancellation_request` 파싱 safeParse
- [ ] PR 생성됨 (사용자 merge 대기)

---

## 미리 확인 사항 (구현 중 발견 시 조정)

1. **useApplications 훅 구조**: mutation의 onSuccess data 타입이 명시적이면 `CancellationResult`로 변경 필요
2. **BoardJobSummary 타입**: `src/types/board.ts`의 기존 정의와 스키마 일치 확인. 불일치 시 스키마를 타입 기준으로 정렬
3. **ApplicationRepositoryHelpers의 cancellation_request 매핑**: 기존 매핑 함수 위치 확인 후 수정
4. **`cancellationRequestSchema` 재사용 vs 신규**: 입력 스키마와 DB 저장 구조가 같으면 재사용, 다르면 신규 `cancellationRequestStoredSchema` 작성
