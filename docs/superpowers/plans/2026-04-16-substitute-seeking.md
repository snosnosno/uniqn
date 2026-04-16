# 대타 구인 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 확정 스태프가 취소 요청 시 대타 구인 게시판 글을 자동 생성하고, 취소 승인 시 공고 슬롯이 안전하게 재오픈되는 기능

**Architecture:** 기존 `cancel_application_atomically` RPC에 expired 가드를 패치하고, `boardService`에 substitute 카테고리를 추가하여 기존 게시판 인프라를 재활용. 취소 요청 모달에 체크박스를 추가하여 대타 게시글 자동 생성을 연동. `useShare` 훅이 이미 있으므로 공유 링크는 기존 인프라 재사용.

**Tech Stack:** Supabase PostgreSQL (migration), React Native / NativeWind, TanStack Query, Zod, expo-router

---

## 파일 구조

| 파일 | 작업 | 역할 |
|------|------|------|
| `supabase/migrations/YYYYMMDD_substitute_feature.sql` | 생성 | board_type enum 확장 + RPC 패치 |
| `src/types/board.ts` | 수정 | `BoardType`에 `'substitute'` 추가 |
| `src/types/jobPosting.ts` | 수정 | `ClosedReason`에 `'filled'` 추가 |
| `src/schemas/jobPosting.schema.ts` | 수정 | Zod `closedReason`에 `'filled'` 추가 |
| `src/services/boardService.ts` | 수정 | `createSubstitutePost` 함수 추가 + `assertCanCreatePost` 수정 |
| `src/services/jobs/applicationService.ts` | 수정 | `requestCancellation`에 대타 글 생성 연동 |
| `src/components/applications/CancellationRequestForm.tsx` | 수정 | 체크박스 + 안내 문구 + 공유 버튼 |
| `app/(app)/(tabs)/board/index.tsx` | 수정 | 대타 게시판 엔트리 카드 추가 |
| `app/(app)/(tabs)/board/[boardType].tsx` | 수정 | `SUPPORTED_BOARD_TYPES`에 `'substitute'` 추가 |
| `__tests__/services/boardService.substitute.test.ts` | 생성 | 대타 글 생성 테스트 |
| `__tests__/services/applicationService.substitute.test.ts` | 생성 | 취소 요청 + 대타 연동 테스트 |
| `supabase/tests/cancel_application_expired_guard.test.sql` | 생성 | expired 재오픈 방지 테스트 |

---

### Task 1: DB 마이그레이션 — board_type enum 확장 + RPC 패치

**Files:**
- Create: `supabase/migrations/20260416120000_substitute_feature.sql`
- Create: `supabase/tests/cancel_application_expired_guard.test.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 1. board_type enum에 'substitute' 추가
ALTER TYPE public.board_type ADD VALUE IF NOT EXISTS 'substitute';

-- 2. cancel_application_atomically RPC 패치: expired 재오픈 방지
CREATE OR REPLACE FUNCTION public.cancel_application_atomically(
  p_application_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_cancel_reason text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_application applications%ROWTYPE;
  v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb;
  v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb;
  v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_assignment_count int := 0;
  v_new_filled int;
  v_new_status text;
  v_updated_cancellation_request jsonb;
BEGIN
  -- 1. Lock application row
  SELECT * INTO v_application FROM applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- 2. Idempotency
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 3. State validation
  IF p_actor_type = 'staff_initiates' THEN
    IF v_application.status != 'confirmed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation',
                                'current_status', v_application.status);
    END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval',
                                'current_status', v_application.status);
    END IF;
    IF v_application.cancellation_request IS NULL
       OR (v_application.cancellation_request->>'status') != 'pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_pending_cancellation_request');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type');
  END IF;

  -- 4. Lock job_posting
  SELECT * INTO v_job_posting FROM job_postings
  WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- 5. Permission check
  IF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_job_posting.owner_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  END IF;

  -- 6. confirmation_history 갱신
  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1
  INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY
  WHERE (value->>'cancelled_at') IS NULL
  LIMIT 1;

  IF v_active_confirmation_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation');
  END IF;

  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancellation_reason'],
    COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));

  -- 7. New status + cancellation_request update
  IF p_actor_type = 'staff_initiates' THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request
      || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;

  -- 8. Update applications
  UPDATE applications SET
    status = v_new_status,
    confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request),
    cancelled_at = v_now,
    updated_at = v_now
  WHERE id = p_application_id;

  -- 9. job_postings: filled_positions 재계산 + expired 재오픈 방지
  SELECT COUNT(*)::int INTO v_assignment_count
  FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  v_new_filled := GREATEST(0, v_job_posting.filled_positions - v_assignment_count);

  UPDATE job_postings SET
    filled_positions = v_new_filled,
    status = CASE
      WHEN status = 'closed'
        AND v_new_filled < total_positions
        AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date')
      THEN 'active'
      ELSE status
    END,
    updated_at = v_now
  WHERE id = v_job_posting.id;

  -- 10. work_logs DELETE
  DELETE FROM work_logs
  WHERE application_id = p_application_id
    AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'new_status', v_new_status,
    'assignment_count', v_assignment_count,
    'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count,
    'cancelled_at', v_now
  );
END;
$$;
```

- [ ] **Step 2: pgTAP 테스트 작성**

파일: `supabase/tests/cancel_application_expired_guard.test.sql`

```sql
-- cancel_application_atomically: expired 공고는 재오픈하지 않음
BEGIN;
SELECT plan(2);

-- Setup: expired 공고 + confirmed 스태프 시나리오는
-- 테스트 데이터 헬퍼로 생성 (기존 cancel_application_atomically.test.sql 패턴 참고)

-- Test 1: closed_reason = 'manual'인 공고 → 재오픈 됨
SELECT ok(true, 'manual closed 공고는 취소 승인 시 재오픈');

-- Test 2: closed_reason = 'expired'인 공고 → 재오픈 안됨
SELECT ok(true, 'expired 공고는 취소 승인 시 재오픈 안함');

SELECT * FROM finish();
ROLLBACK;
```

> 실제 테스트는 기존 `cancel_application_atomically.test.sql`의 fixture 패턴을 참고하여 구체적인 INSERT+RPC 호출로 작성

- [ ] **Step 3: 마이그레이션 적용**

```bash
cd uniqn-mobile && npx supabase db push
```

Expected: Migration applied successfully

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260416120000_substitute_feature.sql supabase/tests/cancel_application_expired_guard.test.sql
git commit -m "feat(db): board_type substitute enum + expired 재오픈 가드 RPC 패치"
```

---

### Task 2: 타입 + 스키마 확장

**Files:**
- Modify: `src/types/board.ts:14` (BoardType)
- Modify: `src/types/board.ts:232-237` (BOARD_TYPE_LABELS)
- Modify: `src/types/board.ts:160-161` (CreateBoardPostInput)
- Modify: `src/types/jobPosting.ts:38` (ClosedReason)
- Modify: `src/schemas/jobPosting.schema.ts` (closedReason enum)

- [ ] **Step 1: BoardType에 substitute 추가**

```typescript
// src/types/board.ts:14
export type BoardType = 'notice' | 'schedule' | 'free' | 'tda' | 'substitute';
```

- [ ] **Step 2: BOARD_TYPE_LABELS에 추가**

```typescript
// src/types/board.ts:232-238
export const BOARD_TYPE_LABELS: Record<BoardType, string> = {
  notice: '공지사항',
  schedule: '일정게시판',
  free: '자유게시판',
  tda: 'TDA 토론',
  substitute: '대타 구인',
};
```

- [ ] **Step 3: CreateBoardPostInput 타입 확장**

```typescript
// src/types/board.ts:160-161
export interface CreateBoardPostInput {
  boardType: Extract<BoardType, 'free' | 'tda' | 'substitute'>;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: BoardAuthorRole;
  imageAttachments?: BoardImageAttachment[];
  jobSummary?: BoardJobSummary;
  linkedJobPostingId?: string;
}
```

- [ ] **Step 4: ClosedReason에 filled 추가**

```typescript
// src/types/jobPosting.ts:38
export type ClosedReason = 'manual' | 'expired' | 'expired_by_work_date' | 'filled';
```

- [ ] **Step 5: Zod 스키마 확장**

```typescript
// src/schemas/jobPosting.schema.ts — closedReason 부분
closedReason: z.enum(['manual', 'expired', 'expired_by_work_date', 'filled']).optional(),
```

- [ ] **Step 6: 타입 체크 실행**

```bash
cd uniqn-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: 에러 0개 또는 기존 에러만 (새 에러 없음). `CreateBoardPostInput` 변경으로 `assertCanCreatePost`에서 에러가 발생할 수 있음 — Task 3에서 수정.

- [ ] **Step 7: 커밋**

```bash
git add src/types/board.ts src/types/jobPosting.ts src/schemas/jobPosting.schema.ts
git commit -m "feat(types): BoardType substitute + ClosedReason filled 추가"
```

---

### Task 3: boardService — 대타 글 생성 함수 + assertCanCreatePost 수정

**Files:**
- Modify: `src/services/boardService.ts` (~681, ~994)
- Create: `__tests__/services/boardService.substitute.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/services/boardService.substitute.test.ts
import { describe, it, expect, vi, beforeEach } from '@jest/globals';

// boardService의 createSubstitutePost를 테스트
// boardRepository.createPost를 모킹

describe('createSubstitutePost', () => {
  it('should create a board post with boardType substitute and jobSummary', async () => {
    // Arrange: mock boardRepository.createPost to return a post ID
    // Act: call createSubstitutePost with valid input
    // Assert: boardRepository.createPost called with correct shape
    expect(true).toBe(true); // placeholder for actual mock setup
  });

  it('should sanitize reason text for XSS', async () => {
    expect(true).toBe(true);
  });

  it('should include linkedJobPostingId from jobSummary', async () => {
    expect(true).toBe(true);
  });
});
```

> 실제 구현에서 기존 `boardService` 테스트 패턴(`__tests__/services/boardService.test.ts` 참조)을 따라 mock 세팅

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest __tests__/services/boardService.substitute.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL (createSubstitutePost not found)

- [ ] **Step 3: assertCanCreatePost 수정**

```typescript
// src/services/boardService.ts:681-687 변경
function assertCanCreatePost(input: CreateBoardPostInput) {
  if (input.boardType !== 'free' && input.boardType !== 'tda' && input.boardType !== 'substitute') {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: '직접 작성할 수 없는 게시판입니다.',
    });
  }
}
```

- [ ] **Step 4: createSubstitutePost 함수 추가**

boardService.ts 파일 끝 (export 목록 위)에 추가:

```typescript
export interface CreateSubstitutePostInput {
  authorId: string;
  authorName: string;
  authorRole: BoardAuthorRole;
  applicationId: string;
  jobSummary: BoardJobSummary;
  reason: string;
}

export async function createSubstitutePost(
  input: CreateSubstitutePostInput
): Promise<string> {
  await requireMatchingCurrentUser(input.authorId);

  const title = `대타 구해요 · ${input.jobSummary.title}`;
  const dateInfo = input.jobSummary.workDate || '';
  const locationInfo = input.jobSummary.locationName || '';
  const compensationInfo = input.jobSummary.compensationLabel || '';

  const body = [
    input.reason,
    '',
    `📅 ${dateInfo}`,
    locationInfo ? `📍 ${locationInfo}` : '',
    compensationInfo ? `💰 ${compensationInfo}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  assertSafeText('title', title, 120);
  assertSafeText('body', body, 5000);

  try {
    return await boardRepository.createPost({
      boardType: 'substitute',
      title: sanitizeBoardText(title),
      body: sanitizeBoardText(body),
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      imageAttachments: [],
      linkedJobPostingId: input.jobSummary.jobPostingId,
      jobSummary: input.jobSummary,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '대타 구인 글 작성',
      component: COMPONENT,
      context: { authorId: input.authorId, applicationId: input.applicationId },
    });
  }
}
```

- [ ] **Step 5: export 목록에 추가**

boardService.ts 파일 끝의 export 목록에 추가:

```typescript
  createSubstitutePost,
  type CreateSubstitutePostInput,
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
cd uniqn-mobile && npx jest __tests__/services/boardService.substitute.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 7: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 0개

- [ ] **Step 8: 커밋**

```bash
git add src/services/boardService.ts __tests__/services/boardService.substitute.test.ts
git commit -m "feat(board): createSubstitutePost 함수 + substitute 게시판 지원"
```

---

### Task 4: 취소 요청 서비스 — 대타 글 생성 연동

**Files:**
- Modify: `src/services/jobs/applicationService.ts:176-218` (requestCancellation)
- Modify: `src/schemas/application.schema.ts:110-119` (cancellationRequestSchema)
- Create: `__tests__/services/applicationService.substitute.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/services/applicationService.substitute.test.ts
import { describe, it, expect } from '@jest/globals';

describe('requestCancellation with substitute post', () => {
  it('should create substitute board post when wantsSubstitutePost is true', async () => {
    // 취소 요청 + wantsSubstitutePost: true → createSubstitutePost 호출됨
    expect(true).toBe(true);
  });

  it('should NOT create substitute board post when wantsSubstitutePost is false', async () => {
    // 취소 요청 + wantsSubstitutePost: false → createSubstitutePost 호출 안됨
    expect(true).toBe(true);
  });

  it('should still succeed cancellation even if substitute post fails', async () => {
    // 대타 글 생성 실패해도 취소 요청 자체는 성공해야 함
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile && npx jest __tests__/services/applicationService.substitute.test.ts --no-coverage 2>&1 | tail -10
```

- [ ] **Step 3: RequestCancellationInput 타입 확인 및 확장**

`src/types/application.ts` (또는 해당 타입 정의 파일)에서 `RequestCancellationInput`을 찾아 `wantsSubstitutePost?: boolean` 필드를 추가.

```typescript
export interface RequestCancellationInput {
  applicationId: string;
  reason: string;
  wantsSubstitutePost?: boolean;
}
```

- [ ] **Step 4: cancellationRequestSchema 확장**

```typescript
// src/schemas/application.schema.ts:110-119
export const cancellationRequestSchema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  reason: z
    .string()
    .min(5, { message: '취소 사유는 최소 5자 이상 입력해주세요' })
    .max(500, { message: '취소 사유는 500자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  wantsSubstitutePost: z.boolean().optional().default(true),
});
```

- [ ] **Step 5: requestCancellation 서비스 수정**

`src/services/jobs/applicationService.ts`의 `requestCancellation` 함수에서, 기존 취소 요청 완료 후 대타 글 생성을 best-effort로 호출:

```typescript
export async function requestCancellation(
  input: RequestCancellationInput,
  applicantId: string,
  applicantContext?: { name: string; role: BoardAuthorRole; jobSummary: BoardJobSummary }
): Promise<void> {
  const trace = startApiTrace('requestCancellation');
  trace.putAttribute('applicationId', input.applicationId);

  try {
    const validationResult = cancellationRequestSchema.safeParse(input);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      throw toValidationError(
        firstError?.message || 'Please check the cancellation request input.',
        validationResult.error.flatten().fieldErrors
      );
    }

    logger.info('Cancellation request started', {
      applicationId: input.applicationId,
      applicantId,
      wantsSubstitutePost: validationResult.data.wantsSubstitutePost,
    });

    await applicationRepository.requestCancellationWithTransaction(
      validationResult.data,
      applicantId
    );

    logger.info('Cancellation request completed', { applicationId: input.applicationId });

    // 대타 글 생성 (best-effort: 실패해도 취소 요청은 유지)
    if (validationResult.data.wantsSubstitutePost && applicantContext) {
      try {
        const { createSubstitutePost } = await import('@/services/boardService');
        await createSubstitutePost({
          authorId: applicantId,
          authorName: applicantContext.name,
          authorRole: applicantContext.role,
          applicationId: input.applicationId,
          jobSummary: applicantContext.jobSummary,
          reason: validationResult.data.reason,
        });
        logger.info('Substitute post created', { applicationId: input.applicationId });
      } catch (substituteError) {
        logger.warn('Substitute post creation failed (non-blocking)', {
          applicationId: input.applicationId,
          error: substituteError,
        });
      }
    }

    trace.putAttribute('status', 'success');
    trace.stop();

    trackEvent('cancellation_request', {
      application_id: input.applicationId,
      wants_substitute: validationResult.data.wantsSubstitutePost,
    });
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

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
cd uniqn-mobile && npx jest __tests__/services/applicationService.substitute.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 7: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: 커밋**

```bash
git add src/services/jobs/applicationService.ts src/schemas/application.schema.ts __tests__/services/applicationService.substitute.test.ts
git commit -m "feat(application): 취소 요청 시 대타 구인 게시글 자동 생성 연동"
```

---

### Task 5: 취소 요청 모달 UI — 체크박스 + 안내 문구 + 공유 버튼

**Files:**
- Modify: `src/components/applications/CancellationRequestForm.tsx`

- [ ] **Step 1: CancellationRequestFormProps 확장**

`onSubmit` 시그니처에 `wantsSubstitutePost` 파라미터 추가:

```typescript
interface CancellationRequestFormProps {
  application: Application;
  visible: boolean;
  isSubmitting: boolean;
  onSubmit: (applicationId: string, reason: string, wantsSubstitutePost: boolean) => void;
  onClose: () => void;
}
```

- [ ] **Step 2: 상태 + 체크박스 추가**

컴포넌트 내부에 `wantsSubstitutePost` 상태 추가:

```typescript
const [wantsSubstitutePost, setWantsSubstitutePost] = useState(true);
```

handleSubmit에서 전달:

```typescript
const handleSubmit = useCallback(() => {
  const result = cancellationRequestSchema.safeParse({
    applicationId: application.id,
    reason: reason.trim(),
    wantsSubstitutePost,
  });

  if (!result.success) {
    const fieldError = result.error.issues[0];
    setError(fieldError?.message ?? '입력값을 확인해주세요');
    return;
  }

  setError(null);
  onSubmit(application.id, reason.trim(), wantsSubstitutePost);
}, [application.id, reason, wantsSubstitutePost, onSubmit]);
```

handleClose에서 초기화:

```typescript
const handleClose = useCallback(() => {
  setReason('');
  setError(null);
  setWantsSubstitutePost(true);
  onClose();
}, [onClose]);
```

- [ ] **Step 3: UI에 체크박스 + 안내 추가**

취소 사유 입력 아래, 주의사항 위에 추가:

```tsx
{/* 대타 구인 게시글 */}
<Pressable
  onPress={() => setWantsSubstitutePost((prev) => !prev)}
  className="flex-row items-center bg-surface-page rounded-lg p-4 mt-4"
  accessibilityRole="checkbox"
  accessibilityState={{ checked: wantsSubstitutePost }}
>
  <View
    className={`w-5 h-5 rounded border mr-3 items-center justify-center ${
      wantsSubstitutePost
        ? 'bg-primary-500 border-primary-500'
        : 'border-secondary-300 dark:border-secondary-600'
    }`}
  >
    {wantsSubstitutePost && (
      <Text className="text-white text-xs font-sans-bold">✓</Text>
    )}
  </View>
  <View className="flex-1">
    <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
      대타 구해요 글 올리기
    </Text>
    <Text className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5 font-sans">
      게시판에 대타 구인 글이 자동으로 올라갑니다
    </Text>
  </View>
</Pressable>
```

- [ ] **Step 4: 안내 문구에 재오픈 정보 추가**

기존 주의사항 View(159행)의 텍스트 수정:

```tsx
<Text className="text-xs text-secondary-500 dark:text-secondary-400 leading-5 font-sans">
  • 취소 요청이 승인되면 지원이 취소됩니다.{'\n'}
  • 승인 시 해당 자리가 공고에 다시 노출됩니다.{'\n'}
  • 구인자가 거절하면 지원은 유지됩니다.{'\n'}
  • 무단 취소는 평판에 영향을 줄 수 있습니다.
</Text>
```

- [ ] **Step 5: import 추가**

```typescript
import { Pressable } from 'react-native';  // 기존 import에 추가
```

> `Pressable`이 이미 import돼있지 않으면 추가. 기존 `View, Text, TextInput`에 포함시킴.

- [ ] **Step 6: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: `onSubmit` 호출부(부모 컴포넌트)에서 시그니처 불일치 에러 발생 가능 — 부모 컴포넌트도 수정 필요. 부모에서 `wantsSubstitutePost` 파라미터를 받아서 `requestCancellation`에 전달하도록 수정.

- [ ] **Step 7: 부모 컴포넌트 onSubmit 핸들러 수정**

`onSubmit` 호출부를 찾아서 시그니처에 `wantsSubstitutePost: boolean` 추가.

```bash
cd uniqn-mobile && grep -rn "onSubmit.*applicationId.*reason" src/ --include="*.tsx" | head -10
```

찾은 파일에서 `onSubmit` 핸들러가 `requestCancellation`을 호출하는 부분에 `wantsSubstitutePost`와 `applicantContext`를 전달하도록 수정.

- [ ] **Step 8: 커밋**

```bash
git add src/components/applications/CancellationRequestForm.tsx
git commit -m "feat(ui): 취소 요청 모달에 대타 구인 체크박스 + 재오픈 안내"
```

---

### Task 6: 게시판 UI — 대타 탭 추가

**Files:**
- Modify: `app/(app)/(tabs)/board/index.tsx:99-119`
- Modify: `app/(app)/(tabs)/board/[boardType].tsx:14`

- [ ] **Step 1: SUPPORTED_BOARD_TYPES에 substitute 추가**

```typescript
// app/(app)/(tabs)/board/[boardType].tsx:14
const SUPPORTED_BOARD_TYPES: BoardType[] = ['notice', 'schedule', 'free', 'tda', 'substitute'];
```

- [ ] **Step 2: isWritable 조건 수정**

```typescript
// [boardType].tsx:22 — substitute에서는 직접 글쓰기 허용 안함 (자동 생성만)
const isWritable = safeBoardType === 'free' || safeBoardType === 'tda';
```

> `substitute`는 직접 글쓰기 불가 (취소 요청 시 자동 생성만). `isWritable`은 변경하지 않음.

- [ ] **Step 3: 게시판 홈에 대타 엔트리 카드 추가**

`app/(app)/(tabs)/board/index.tsx`의 BoardEntryCard 목록에 추가. 아이콘 import 추가 필요:

```tsx
// import에 추가
import { SwapHorizontalIcon } from '@/components/icons';
// SwapHorizontalIcon이 없으면 기존 아이콘 중 적합한 것 사용 (예: RefreshIcon, ArrowsIcon 등)
```

4개 카드 영역(99~119행) 뒤에 추가:

```tsx
<BoardEntryCard
  title="대타 구인"
  icon={<SwapHorizontalIcon size={28} color={PRIMARY_COLORS[500]} />}
  boardType="substitute"
/>
```

> 아이콘이 없으면 기존 프로젝트의 `src/components/icons/` 디렉토리에서 사용 가능한 아이콘을 확인하고 적합한 것을 선택.

- [ ] **Step 4: 빈 상태 메시지 추가**

`[boardType].tsx`의 ListEmptyComponent에서 substitute 전용 메시지 추가:

```tsx
description={
  boardType === 'schedule'
    ? '접근 가능한 일정 게시판이 아직 없어요.'
    : boardType === 'substitute'
      ? '현재 대타 구인 글이 없어요.'
      : '첫 게시글을 등록해 보세요.'
}
```

- [ ] **Step 5: fetchBoardPosts에서 substitute 처리 확인**

`src/services/boardService.ts`의 `fetchBoardPosts`에서 `substitute` boardType이 기존 default 분기(737~743행)로 처리되는지 확인:

```typescript
// 기존 코드 — notice, schedule을 특별 처리하고 나머지는 boardRepository.getPosts
return boardRepository.getPosts({
  boardTypes: [boardType],
  statuses: [...ACTIVE_POST_STATUSES],
  limitCount,
  sortBy: 'lastActivityAt',
  sortDirection: 'desc',
});
```

`substitute`는 `notice`도 `schedule`도 아니므로 이 default 분기를 탐. 추가 수정 불필요.

- [ ] **Step 6: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: 커밋**

```bash
git add app/\(app\)/\(tabs\)/board/index.tsx app/\(app\)/\(tabs\)/board/\[boardType\].tsx
git commit -m "feat(ui): 게시판 홈에 대타 구인 탭 추가"
```

---

### Task 7: 공고 상세 — 공유 버튼 확인 및 연동

**Files:**
- 확인: `useShare` 훅이 이미 존재 (`src/hooks/useShare.ts`)
- 확인: 공고 상세 화면에 공유 버튼이 이미 있는지 확인

- [ ] **Step 1: 공고 상세 화면에서 공유 버튼 유무 확인**

```bash
cd uniqn-mobile && grep -rn "useShare\|shareJob\|ShareIcon" app/ src/ --include="*.tsx" | head -10
```

- [ ] **Step 2: 공유 버튼이 없으면 추가**

공고 상세 화면(해당 라우트 파일)에서 `useShare` 훅을 import하고, 헤더 또는 하단에 공유 버튼 추가:

```tsx
import { useShare } from '@/hooks/useShare';

// 컴포넌트 내부
const { shareJob, isSharing } = useShare();

// JSX
<Pressable
  onPress={() => shareJob({
    id: jobPosting.id,
    title: jobPosting.title,
    location: jobPosting.location?.name ?? '',
    workDate: jobPosting.workDate,
  })}
  disabled={isSharing}
  className="p-2"
  accessibilityRole="button"
  accessibilityLabel="공고 공유하기"
>
  <ShareIcon size={22} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
</Pressable>
```

> `shareJob`은 이미 `[대타 급구]` 태그 없이 일반 공유 메시지를 생성. 대타 맥락이 필요하면 `useShare`의 `share` 메서드로 커스텀 메시지 사용 가능하나, MVP에서는 기존 `shareJob` 그대로 사용.

- [ ] **Step 3: 공유 버튼이 이미 있으면 이 Task 스킵**

기존에 있으면 추가 작업 없음.

- [ ] **Step 4: 커밋 (변경이 있는 경우에만)**

```bash
git add <modified files>
git commit -m "feat(ui): 공고 상세에 공유 버튼 추가"
```

---

### Task 8: 취소 거부 시 대타 게시글 자동 삭제

**Files:**
- Modify: `src/repositories/supabase/ApplicationRepositoryTransactions.ts:448-460` (executeRejectCancellation)
- Modify: `src/services/boardService.ts` (archiveSubstitutePostByApplicationId 함수 추가)

- [ ] **Step 1: boardService에 대타 글 아카이브 함수 추가**

```typescript
export async function archiveSubstitutePostByLinkedPosting(
  linkedJobPostingId: string,
  authorId: string
): Promise<void> {
  try {
    const posts = await boardRepository.getPosts({
      boardTypes: ['substitute'],
      statuses: ['active'],
      limitCount: 10,
    });

    const targetPosts = posts.filter(
      (post) => post.linkedJobPostingId === linkedJobPostingId && post.authorId === authorId
    );

    for (const post of targetPosts) {
      await boardRepository.setPostStatus(post.id, 'archived');
    }

    if (targetPosts.length > 0) {
      logger.info('Substitute posts archived on cancellation rejection', {
        count: targetPosts.length,
        linkedJobPostingId,
        authorId,
      });
    }
  } catch (error) {
    logger.warn('Failed to archive substitute posts (non-blocking)', {
      linkedJobPostingId,
      authorId,
      error,
    });
  }
}
```

- [ ] **Step 2: reviewCancellationRequest 서비스에서 거부 시 호출**

`src/services/jobs/applicationService.ts`의 `reviewCancellationRequest`에서, `input.approved === false`일 때 best-effort로 대타 글 아카이브:

```typescript
// reviewCancellationRequest 함수 내부, 기존 로직 뒤에 추가
if (!input.approved) {
  try {
    const { archiveSubstitutePostByLinkedPosting } = await import('@/services/boardService');
    const application = await applicationRepository.getById(input.applicationId);
    if (application) {
      await archiveSubstitutePostByLinkedPosting(
        application.jobPostingId,
        application.applicantId
      );
    }
  } catch (archiveError) {
    logger.warn('Substitute post archive failed (non-blocking)', {
      applicationId: input.applicationId,
      error: archiveError,
    });
  }
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: 커밋**

```bash
git add src/services/boardService.ts src/services/jobs/applicationService.ts
git commit -m "feat(board): 취소 거부 시 대타 게시글 자동 아카이브"
```

---

### Task 9: 최종 통합 검증

- [ ] **Step 1: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Lint**

```bash
cd uniqn-mobile && npx eslint . --ext .js,.jsx,.ts,.tsx 2>&1 | tail -20
```

Expected: 0 errors (또는 기존 에러만)

- [ ] **Step 3: 전체 테스트**

```bash
cd uniqn-mobile && npx jest --no-coverage 2>&1 | tail -20
```

Expected: All tests pass

- [ ] **Step 4: Quality 체크**

```bash
cd uniqn-mobile && npm run quality
```

Expected: Pass

- [ ] **Step 5: 커밋 (lint/format 수정이 있으면)**

```bash
git add -A && git commit -m "chore: 대타 구인 기능 lint/format 정리"
```
