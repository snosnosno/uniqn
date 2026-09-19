# 평점/리뷰 기능 복구 + 통합 허브 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** prod에서 전체 작동 불가(읽기 22P02/E4002·쓰기 RPC 부재·reviews 0건)인 평점 기능을 복구하고, 흩어진 화면을 단일 평점관리 허브로 통합해 발견→작성→공개 흐름을 매끄럽게 만든다.

**Architecture:** Firebase 잔재인 합성 텍스트키(`{workLogId}_{reviewerType}`) 조회를 제거하고 `(work_log_id, reviewer_type)` 컬럼 조회로 전환한다. 누락된 `create_review` RPC를 SECURITY DEFINER 트랜잭션으로 신설(INSERT + 피평가자 `bubble_score` 원자 갱신, 멱등). 허브는 기존 `history.tsx`(점수헤더+탭 보유)에 "미작성" 탭을 추가해 확장한다.

**Tech Stack:** Expo Router, React Native, NativeWind, Supabase(PostgREST + plpgsql RPC), TanStack Query, Jest + @testing-library/react-native, pgTAP(로컬 db-tests).

## Global Constraints

- 작업 위치: 격리 워크트리 `C:/Users/user/Desktop/T-HOLDEM-review`, 브랜치 `feat/review-recovery-hub`. uniqn-mobile/ 가 작업 디렉토리.
- DB 마이그레이션: `mcp__supabase__apply_migration` 전용(prod). 로컬 검증은 `npm run db:reset` + pgTAP. `supabase db push` 금지.
- 새 RPC는 `SECURITY DEFINER`, `SET search_path = 'public'`, 생성 직후 `REVOKE EXECUTE ... FROM anon, public` + `GRANT ... TO authenticated`. 호출자 바인딩 `auth.uid() = p_reviewer_id`.
- pgTAP에서 caller-binding RPC 테스트 시 `set_config('request.jwt.claims', ...)`로 `auth.uid()` 주입 필수(미설정 시 거부 — #195/#198 회귀).
- 버블점수 상수 SSOT = `src/types/review.ts` `BUBBLE_SCORE`: INITIAL 50.0, MIN 0, MAX 100, POSITIVE_CHANGE +1.0, NEUTRAL_CHANGE 0, NEGATIVE_CHANGE -1.0, DECIMAL_PLACES 1. `bubble_score` jsonb 키는 **camelCase**: `{score, totalReviewCount, positiveCount, neutralCount, negativeCount, lastUpdatedAt}`.
- 필드명 camelCase, 로깅 `logger`, 다크모드 `dark:`, 경로 `@/`. 커밋 `<type>(review): <한글>`.
- 각 Task 종료 시 `/review` 또는 `/simplify` 체크포인트(최소 diff·기존 자산 재사용 확인).

---

## File Structure

| 파일 | 역할 | 변경 |
|------|------|------|
| `supabase/migrations/20260624120000_recover_reviews_create_rpc_and_unique.sql` | create_review RPC + UNIQUE 제약 + grant | Create |
| `supabase/tests/create_review.test.sql` | pgTAP: RPC 동작·멱등·anon revoke | Create |
| `src/repositories/supabase/ReviewRepository.ts` | 읽기 2곳 + 쓰기 1곳 쿼리 수정 | Modify |
| `src/repositories/supabase/__tests__/ReviewRepository.read.test.ts` | 읽기 쿼리 컬럼 회귀 가드 | Create |
| `src/repositories/supabase/__tests__/ReviewRepository.write.test.ts` | 쓰기 RPC 호출 계약 | Create |
| `src/components/review/PendingReviewCard.tsx` | pending 카드(허브·재사용) | Create(추출) |
| `app/(app)/reviews/history.tsx` | 평점관리 허브(미작성 탭 추가) | Modify |
| `app/(app)/reviews/pending.tsx` | 허브로 Redirect | Modify |
| `app/(app)/reviews/__tests__/ReviewHubScreen.test.tsx` | 허브 3탭·배지 | Create |
| `src/shared/deeplink/NotificationRouteMap.ts` | REVIEW_* → 허브 | Modify |
| `src/shared/deeplink/__tests__/NotificationRouteMap.review.test.ts` | 라우팅 회귀 | Create |
| `app/(app)/reviews/write.tsx` | 제출 후 허브 복귀 | Modify |

---

## Task 1: create_review RPC + UNIQUE 제약 (DB 토대)

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260624120000_recover_reviews_create_rpc_and_unique.sql`
- Test: `uniqn-mobile/supabase/tests/create_review.test.sql`

**Interfaces:**
- Produces: `public.create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment public.review_sentiment, p_tags text[], p_comment text) RETURNS uuid` — 생성/기존 review id 반환. 제약: `reviews_work_log_reviewer_type_key UNIQUE (work_log_id, reviewer_type)`.

- [ ] **Step 1: pgTAP 실패 테스트 작성**

`uniqn-mobile/supabase/tests/create_review.test.sql`:
```sql
BEGIN;
SELECT plan(5);

-- fixtures: reviewer/reviewee/worklog/posting 는 seed 헬퍼 가정(test:db:helpers 선행)
-- 호출자 바인딩 주입: reviewer 로 행세
SELECT set_config('request.jwt.claims', json_build_object('sub', 'a1111111-1111-4111-a111-111111111111')::text, true);

-- (1) 함수 존재
SELECT has_function('public', 'create_review', 'create_review RPC 존재');

-- (2) anon 실행 불가
SELECT ok(
  NOT has_function_privilege('anon', 'public.create_review(uuid,uuid,text,text,uuid,text,text,uuid,text,public.review_sentiment,text[],text)', 'EXECUTE'),
  'anon 은 create_review 실행 불가');

-- (3) 신규 작성 → review 1행 생성
SELECT lives_ok($$
  SELECT public.create_review(
    '00000000-0000-4000-8000-000000000001'::uuid, -- work_log_id (fixture)
    '00000000-0000-4000-8000-000000000010'::uuid, -- job_posting_id (fixture)
    '테스트 공고', '2026-06-20',
    'a1111111-1111-4111-a111-111111111111'::uuid, '리뷰어',
    'staff',
    'b2222222-2222-4222-b222-222222222222'::uuid, '대상자',
    'positive'::public.review_sentiment, ARRAY['punctual'], NULL)
$$, '신규 리뷰 작성 성공');

SELECT is(
  (SELECT count(*)::int FROM public.reviews WHERE work_log_id='00000000-0000-4000-8000-000000000001'),
  1, 'reviews 1행 생성');

-- (4) 피평가자 bubble_score score 51, positiveCount 1
SELECT is(
  (SELECT (bubble_score->>'score')::numeric FROM public.users WHERE id='b2222222-2222-4222-b222-222222222222'),
  51.0, '버블점수 50→51(positive +1)');

-- (5) 동일 (work_log, type) 재호출 멱등 — 2행 안 됨
SELECT public.create_review(
  '00000000-0000-4000-8000-000000000001'::uuid,'00000000-0000-4000-8000-000000000010'::uuid,
  '테스트 공고','2026-06-20','a1111111-1111-4111-a111-111111111111'::uuid,'리뷰어','staff',
  'b2222222-2222-4222-b222-222222222222'::uuid,'대상자','positive'::public.review_sentiment,ARRAY['punctual'],NULL);
SELECT is(
  (SELECT count(*)::int FROM public.reviews WHERE work_log_id='00000000-0000-4000-8000-000000000001'),
  1, '재호출 멱등(중복 미생성)');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npm run db:reset && npm run test:db -- supabase/tests/create_review.test.sql`
Expected: FAIL — `function create_review does not exist` (has_function false).

- [ ] **Step 3: 마이그레이션 작성**

`uniqn-mobile/supabase/migrations/20260624120000_recover_reviews_create_rpc_and_unique.sql`:
```sql
-- 평점 복구: create_review RPC + (work_log_id, reviewer_type) UNIQUE
-- 배경: Firebase 잔재인 합성 PK({workLogId}_{reviewerType}) 설계가 uuid 스키마로
--       번역되지 않아 쓰기 경로(create_review RPC)가 부재 → reviews 0행.
-- SSOT 주의: 점수식은 src/types/review.ts BUBBLE_SCORE 와 일치해야 함.
--   INITIAL 50.0 / MIN 0 / MAX 100 / POSITIVE +1.0 / NEUTRAL 0 / NEGATIVE -1.0 / DECIMAL 1
-- ============================================================

-- 1) 멱등 제약: 한 근무·한 방향 1리뷰
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_work_log_reviewer_type_key UNIQUE (work_log_id, reviewer_type);

-- 2) create_review RPC
CREATE OR REPLACE FUNCTION public.create_review(
  p_work_log_id uuid,
  p_job_posting_id uuid,
  p_job_posting_title text,
  p_work_date text,
  p_reviewer_id uuid,
  p_reviewer_name text,
  p_reviewer_type text,
  p_reviewee_id uuid,
  p_reviewee_name text,
  p_sentiment public.review_sentiment,
  p_tags text[],
  p_comment text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_review_id uuid;
  v_change numeric;
  v_current jsonb;
  v_new_score numeric;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  -- 호출자 바인딩: 작성자는 본인만 (SECURITY DEFINER 가 RLS 우회하므로 수동 검사)
  IF auth.uid() IS DISTINCT FROM p_reviewer_id THEN
    RAISE EXCEPTION 'unauthorized_reviewer';
  END IF;

  IF p_reviewer_type NOT IN ('employer', 'staff') THEN
    RAISE EXCEPTION 'invalid_reviewer_type';
  END IF;

  -- 서버 권위: sentiment → 점수 변화량 (클라 delta 불신)
  v_change := CASE p_sentiment
    WHEN 'positive' THEN 1.0
    WHEN 'neutral'  THEN 0
    WHEN 'negative' THEN -1.0
  END;

  -- 멱등 INSERT (id 는 gen_random_uuid 기본값)
  INSERT INTO public.reviews (
    work_log_id, job_posting_id, job_posting_title, work_date,
    reviewer_id, reviewer_name, reviewer_type,
    reviewee_id, reviewee_name, sentiment, tags, comment, bubble_score_change
  ) VALUES (
    p_work_log_id, p_job_posting_id, p_job_posting_title, p_work_date,
    p_reviewer_id, p_reviewer_name, p_reviewer_type,
    p_reviewee_id, p_reviewee_name, p_sentiment, COALESCE(p_tags, '{}'), p_comment, v_change::int
  )
  ON CONFLICT (work_log_id, reviewer_type) DO NOTHING
  RETURNING id INTO v_review_id;

  -- 이미 존재 → 점수 미반영, 기존 id 반환(멱등)
  IF v_review_id IS NULL THEN
    SELECT id INTO v_review_id FROM public.reviews
    WHERE work_log_id = p_work_log_id AND reviewer_type = p_reviewer_type;
    RETURN v_review_id;
  END IF;

  -- 피평가자 bubble_score 원자 갱신 (camelCase jsonb, clamp 0..100)
  SELECT bubble_score INTO v_current FROM public.users WHERE id = p_reviewee_id FOR UPDATE;
  v_new_score := round(
    GREATEST(0, LEAST(100, COALESCE((v_current->>'score')::numeric, 50.0) + v_change)), 1);

  UPDATE public.users SET bubble_score = jsonb_build_object(
    'score', v_new_score,
    'totalReviewCount', COALESCE((v_current->>'totalReviewCount')::int, 0) + 1,
    'positiveCount', COALESCE((v_current->>'positiveCount')::int, 0) + (CASE WHEN p_sentiment = 'positive' THEN 1 ELSE 0 END),
    'neutralCount',  COALESCE((v_current->>'neutralCount')::int, 0)  + (CASE WHEN p_sentiment = 'neutral'  THEN 1 ELSE 0 END),
    'negativeCount', COALESCE((v_current->>'negativeCount')::int, 0) + (CASE WHEN p_sentiment = 'negative' THEN 1 ELSE 0 END),
    'lastUpdatedAt', v_now
  ) WHERE id = p_reviewee_id;

  RETURN v_review_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_review(uuid,uuid,text,text,uuid,text,text,uuid,text,public.review_sentiment,text[],text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_review(uuid,uuid,text,text,uuid,text,text,uuid,text,public.review_sentiment,text[],text) TO authenticated;

COMMENT ON FUNCTION public.create_review(uuid,uuid,text,text,uuid,text,text,uuid,text,public.review_sentiment,text[],text) IS
  '리뷰 작성 원자 RPC. auth.uid()=reviewer 검사 → reviews INSERT(ON CONFLICT (work_log_id,reviewer_type) DO NOTHING) → 피평가자 users.bubble_score 갱신. 멱등(재호출 시 기존 id 반환·점수 미반영). 점수식 SSOT=src/types/review.ts BUBBLE_SCORE.';
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npm run db:reset && npm run test:db -- supabase/tests/create_review.test.sql`
Expected: PASS — 5/5. (fixture id 가 헬퍼와 다르면 Step 1 의 fixture uuid 를 `test:db:helpers` seed 값으로 맞춤.)

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/supabase/migrations/20260624120000_recover_reviews_create_rpc_and_unique.sql uniqn-mobile/supabase/tests/create_review.test.sql
git commit -m "feat(review): create_review RPC + (work_log_id,reviewer_type) UNIQUE 복구"
```

> **prod 적용**: 로컬 GREEN 후 `mcp__supabase__apply_migration` 로 prod 반영. `get_advisors` 로 security 경고 확인.

---

## Task 2: Repository 읽기 경로 수정 (E4002 제거)

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/ReviewRepository.ts` (`getReviewsWithBlindCheck` :81-130, `getByWorkLogAndType` :57-79)
- Test: `uniqn-mobile/src/repositories/supabase/__tests__/ReviewRepository.read.test.ts`

**Interfaces:**
- Consumes: `supabase.from('reviews').select(...).eq('work_log_id', id).eq('reviewer_type', type).maybeSingle()`.
- Produces: `getReviewsWithBlindCheck`/`getByWorkLogAndType` 시그니처 불변. 내부 쿼리만 `(work_log_id, reviewer_type)` 사용.

- [ ] **Step 1: 실패 테스트 작성 (컬럼 회귀 가드)**

`uniqn-mobile/src/repositories/supabase/__tests__/ReviewRepository.read.test.ts`:
```ts
const eqCalls: Array<[string, unknown]> = [];

function makeChain() {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(() => chain),
    eq: jest.fn((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return chain;
    }),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return chain;
}

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => makeChain()) },
}));

import { SupabaseReviewRepository } from '../ReviewRepository';

describe('SupabaseReviewRepository 읽기 — work_log_id+reviewer_type 조회', () => {
  beforeEach(() => {
    eqCalls.length = 0;
  });

  it('getReviewsWithBlindCheck 는 합성 id 가 아닌 work_log_id/reviewer_type 으로 조회한다', async () => {
    const repo = new SupabaseReviewRepository();
    await repo.getReviewsWithBlindCheck('wl-1', 'staff', 'me-1');

    // 합성키('wl-1_staff')로 id 조회하면 uuid 컬럼에서 22P02 → 절대 금지
    expect(eqCalls).toContainEqual(['work_log_id', 'wl-1']);
    expect(eqCalls).toContainEqual(['reviewer_type', 'staff']);
    expect(eqCalls).toContainEqual(['reviewer_type', 'employer']); // 상대 리뷰
    expect(eqCalls.some(([col]) => col === 'id')).toBe(false);
  });

  it('getByWorkLogAndType 도 id 합성키를 쓰지 않는다', async () => {
    const repo = new SupabaseReviewRepository();
    await repo.getByWorkLogAndType('wl-9', 'employer');

    expect(eqCalls).toContainEqual(['work_log_id', 'wl-9']);
    expect(eqCalls).toContainEqual(['reviewer_type', 'employer']);
    expect(eqCalls.some(([col]) => col === 'id')).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ReviewRepository.read.test.ts`
Expected: FAIL — 현재 코드는 `.eq('id', 'wl-1_staff')` 호출 → `eqCalls` 에 `['id', ...]` 존재.

- [ ] **Step 3: getReviewsWithBlindCheck 수정**

`ReviewRepository.ts` 의 `getReviewsWithBlindCheck` 내부 쿼리 부분(:90-101)을 교체:
```ts
      const opponentType: ReviewerType = myReviewerType === 'employer' ? 'staff' : 'employer';

      // 내 리뷰 + 상대 리뷰 병렬 조회 (uuid 컬럼 직접 조회 — 합성 id 금지)
      const [myResult, opponentResult] = await Promise.all([
        supabase
          .from(TABLES.REVIEWS)
          .select(TABLE_COLUMNS)
          .eq('work_log_id', workLogId)
          .eq('reviewer_type', myReviewerType)
          .maybeSingle(),
        supabase
          .from(TABLES.REVIEWS)
          .select(TABLE_COLUMNS)
          .eq('work_log_id', workLogId)
          .eq('reviewer_type', opponentType)
          .maybeSingle(),
      ]);
```
(`myReviewId`/`opponentReviewId` 선언 삭제. 이후 블라인드 로직은 그대로.)

- [ ] **Step 4: getByWorkLogAndType 수정**

`getByWorkLogAndType` 내부(:61-66) 교체:
```ts
      const { data, error } = await supabase
        .from(TABLES.REVIEWS)
        .select(TABLE_COLUMNS)
        .eq('work_log_id', workLogId)
        .eq('reviewer_type', reviewerType)
        .maybeSingle();
```
(`const reviewId = ${workLogId}_${reviewerType}` 삭제.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ReviewRepository.read.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/ReviewRepository.ts uniqn-mobile/src/repositories/supabase/__tests__/ReviewRepository.read.test.ts
git commit -m "fix(review): 블라인드/단건 조회를 work_log_id+reviewer_type 으로 — E4002(22P02) 제거"
```

---

## Task 3: Repository 쓰기 경로 수정 (RPC 계약 정합)

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/ReviewRepository.ts` (`createWithTransaction` :190-230)
- Test: `uniqn-mobile/src/repositories/supabase/__tests__/ReviewRepository.write.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `create_review` RPC (RETURNS uuid 스칼라).
- Produces: `createWithTransaction(input, context)` 시그니처 불변, 반환 `Promise<string>`.

- [ ] **Step 1: 실패 테스트 작성**

`uniqn-mobile/src/repositories/supabase/__tests__/ReviewRepository.write.test.ts`:
```ts
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { SupabaseReviewRepository } from '../ReviewRepository';
import type { CreateReviewInput } from '@/types/review';

const input: CreateReviewInput = {
  workLogId: 'wl-1',
  jobPostingId: 'jp-1',
  jobPostingTitle: '공고',
  workDate: '2026-06-20',
  revieweeId: 'rv-1',
  revieweeName: '대상',
  reviewerType: 'staff',
  sentiment: 'positive',
  tags: ['punctual'],
  comment: undefined,
};

describe('SupabaseReviewRepository.createWithTransaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('create_review 를 합성 p_review_id 없이 호출하고 반환 id 를 돌려준다', async () => {
    mockRpc.mockResolvedValue({ data: 'new-review-uuid', error: null });
    const repo = new SupabaseReviewRepository();

    const id = await repo.createWithTransaction(input, { reviewerId: 'me-1', reviewerName: '나' });

    expect(id).toBe('new-review-uuid');
    expect(mockRpc).toHaveBeenCalledWith('create_review', expect.objectContaining({
      p_work_log_id: 'wl-1',
      p_reviewer_id: 'me-1',
      p_reviewer_type: 'staff',
      p_reviewee_id: 'rv-1',
      p_sentiment: 'positive',
    }));
    const params = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(params).not.toHaveProperty('p_review_id');
    expect(params).not.toHaveProperty('p_bubble_score_change');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ReviewRepository.write.test.ts`
Expected: FAIL — 현재 코드는 `p_review_id`, `p_bubble_score_change` 전달 + `result.review_id` 사용.

- [ ] **Step 3: createWithTransaction 수정**

`createWithTransaction` 본문(:201-222)을 교체:
```ts
      const result = await runRpc<string>('create_review', {
        p_work_log_id: input.workLogId,
        p_job_posting_id: input.jobPostingId,
        p_job_posting_title: input.jobPostingTitle,
        p_work_date: input.workDate,
        p_reviewer_id: context.reviewerId,
        p_reviewer_name: context.reviewerName,
        p_reviewer_type: input.reviewerType,
        p_reviewee_id: input.revieweeId,
        p_reviewee_name: input.revieweeName,
        p_sentiment: input.sentiment,
        p_tags: input.tags,
        p_comment: input.comment ?? null,
      });

      logger.info('리뷰 생성 트랜잭션 완료', { reviewId: result });
      return result;
```
파일 상단 import 에서 사용처가 사라진 `getSentimentScoreChange` 제거(`@/types/review` import 정리). `const reviewId`/`bubbleScoreChange` 선언 삭제.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ReviewRepository.write.test.ts && npx tsc --noEmit -p uniqn-mobile`
Expected: PASS — 1/1, tsc 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/ReviewRepository.ts uniqn-mobile/src/repositories/supabase/__tests__/ReviewRepository.write.test.ts
git commit -m "fix(review): createWithTransaction 을 create_review RPC(uuid 반환)에 정합 — p_review_id 제거"
```

---

## Task 4: 평점관리 통합 허브 (미작성 탭 추가)

**Files:**
- Create: `uniqn-mobile/src/components/review/PendingReviewCard.tsx` (pending.tsx :28-90 의 카드 추출)
- Modify: `uniqn-mobile/app/(app)/reviews/history.tsx` (3탭 + 제목 "평점관리")
- Test: `uniqn-mobile/app/(app)/reviews/__tests__/ReviewHubScreen.test.tsx`

**Interfaces:**
- Consumes: `usePendingReviews()` → `{ pendingReviews, pendingCount, isLoading }`; `useReceivedReviews`/`useGivenReviews`/`useBubbleScore`.
- Produces: 허브 화면(route `/(app)/reviews/history`), 탭 `'pending' | 'received' | 'given'`, 미작성 카드 → `/(app)/reviews/write`.

- [ ] **Step 1: PendingReviewCard 추출**

`uniqn-mobile/src/components/review/PendingReviewCard.tsx` 생성 — `app/(app)/reviews/pending.tsx` 의 `getDaysRemaining`/`PendingReviewCard`(:24-90)를 그대로 옮기고 export. import 경로는 `@/` 절대경로 사용:
```tsx
import { View, Text, Pressable } from 'react-native';
import { CardStripe, NumericText } from '@/components/ui';
import type { PendingReviewItem } from '@/hooks/useReviews';
import { getReviewDaysRemaining } from '@/domains/review/reviewDeadline';
import { REVIEW_DEADLINE_DAYS } from '@/types/review';
import { REVIEW_CONTEXT_STRIPE_TONE } from '@/components/review/helpers/reviewConfig';

function getDaysRemaining(item: PendingReviewItem): number {
  return getReviewDaysRemaining(item.checkOutTime, item.workDate);
}

export interface PendingReviewCardProps {
  item: PendingReviewItem;
  onPress: () => void;
}

export default function PendingReviewCard({ item, onPress }: PendingReviewCardProps) {
  // ... pending.tsx :34-89 본문 그대로 ...
}
```
(본문은 기존 pending.tsx 카드와 동일 — DRY 위해 추출만.)

- [ ] **Step 2: 허브 실패 테스트 작성**

`uniqn-mobile/app/(app)/reviews/__tests__/ReviewHubScreen.test.tsx`:
```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ReviewHistoryScreen from '../history';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ profile: { uid: 'me-1' } }) }));
jest.mock('@/hooks/useReviews', () => ({
  useReceivedReviews: () => ({ data: { pages: [{ items: [] }] }, isLoading: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }),
  useGivenReviews: () => ({ data: { pages: [{ items: [] }] }, isLoading: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }),
  useBubbleScore: () => ({ score: 50, totalReviewCount: 0, positiveCount: 0, neutralCount: 0, negativeCount: 0 }),
  usePendingReviews: () => ({ pendingReviews: [], pendingCount: 2, isLoading: false }),
}));
jest.mock('@/components/review/ReviewCard', () => 'ReviewCard');
jest.mock('@/components/review/BubbleScoreBadge', () => 'BubbleScoreBadge');
jest.mock('@/components/review/PendingReviewCard', () => 'PendingReviewCard');

describe('평점관리 허브', () => {
  it('미작성/받은/작성한 3개 탭과 제목 "평점관리"를 렌더한다', () => {
    const { getByText } = render(<ReviewHistoryScreen />);
    expect(getByText('평점관리')).toBeTruthy();
    expect(getByText(/미작성/)).toBeTruthy();
    expect(getByText('받은 평가')).toBeTruthy();
    expect(getByText('작성한 평가')).toBeTruthy();
  });

  it('미작성 탭 라벨에 건수 배지(2)를 표시한다', () => {
    const { getByText } = render(<ReviewHistoryScreen />);
    expect(getByText(/미작성 2/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest app/\(app\)/reviews/__tests__/ReviewHubScreen.test.tsx`
Expected: FAIL — 제목 "평가 히스토리", 미작성 탭 없음.

- [ ] **Step 4: history.tsx 를 허브로 확장**

`app/(app)/reviews/history.tsx` 수정:
1. `type TabType = 'pending' | 'received' | 'given';`
2. import 추가: `import { usePendingReviews } from '@/hooks/useReviews';` `import PendingReviewCard from '@/components/review/PendingReviewCard';`
3. 컴포넌트 내부:
```tsx
  const { pendingReviews, pendingCount, isLoading: pendingLoading } = usePendingReviews();
  const [activeTab, setActiveTab] = useState<TabType>(pendingCount > 0 ? 'pending' : 'received');

  const goToWrite = useCallback((item: PendingReviewItem) => {
    router.push({
      pathname: '/(app)/reviews/write',
      params: {
        workLogId: item.workLogId, revieweeId: item.revieweeId, revieweeName: item.revieweeName,
        reviewerType: item.reviewerType, jobPostingId: item.jobPostingId,
        jobPostingTitle: item.jobPostingTitle, workDate: item.workDate,
      },
    });
  }, []);
```
4. 제목 `title="평점관리"`.
5. 탭바에 첫 번째 탭 추가(배지 포함):
```tsx
        <TabButton
          label={pendingCount > 0 ? `미작성 ${pendingCount}` : '미작성'}
          isActive={activeTab === 'pending'}
          onPress={() => setActiveTab('pending')}
        />
```
6. 리스트 영역: `activeTab === 'pending'` 이면 pending 리스트 렌더(미작성 0건 시 EmptyState "미작성 평가 없음"), 아니면 기존 received/given FlashList. pending 항목은 `<PendingReviewCard item={item} onPress={() => goToWrite(item)} />`.
7. `import { router } from 'expo-router'` 와 `import type { PendingReviewItem } from '@/hooks/useReviews'` 추가.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest app/\(app\)/reviews/__tests__/ReviewHubScreen.test.tsx`
Expected: PASS — 2/2.

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/components/review/PendingReviewCard.tsx uniqn-mobile/app/\(app\)/reviews/history.tsx uniqn-mobile/app/\(app\)/reviews/__tests__/ReviewHubScreen.test.tsx
git commit -m "feat(review): 평점관리 통합 허브 — 미작성 탭 추가(건수 배지) + 제목 변경"
```

---

## Task 5: 알림/진입 라우팅 허브 통일

**Files:**
- Modify: `uniqn-mobile/src/shared/deeplink/NotificationRouteMap.ts` (:107-118)
- Modify: `uniqn-mobile/app/(app)/reviews/pending.tsx` (→ Redirect)
- Test: `uniqn-mobile/src/shared/deeplink/__tests__/NotificationRouteMap.review.test.ts`

**Interfaces:**
- Consumes: 기존 deeplink route name `reviews/pending`(허브로 도달), `reviews/detail`(드릴다운 유지).
- Produces: REVIEW_* 알림 → `{ name: 'reviews/pending' }` (workLogId 유무 무관).

- [ ] **Step 1: 실패 테스트 작성**

`uniqn-mobile/src/shared/deeplink/__tests__/NotificationRouteMap.review.test.ts`:
```ts
import { getRouteForNotificationType } from '../NotificationRouteMap';
import { NotificationType } from '@/types/notification';

describe('리뷰 알림 라우팅 — 항상 허브', () => {
  it.each([
    NotificationType.REVIEW_REQUEST,
    NotificationType.REVIEW_RECEIVED,
    NotificationType.REVIEW_REMINDER,
  ])('%s 는 workLogId 가 있어도 허브(reviews/pending)로 보낸다', (type) => {
    expect(getRouteForNotificationType(type, { workLogId: 'wl-1' })).toEqual({ name: 'reviews/pending' });
    expect(getRouteForNotificationType(type, {})).toEqual({ name: 'reviews/pending' });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/shared/deeplink/__tests__/NotificationRouteMap.review.test.ts`
Expected: FAIL — workLogId 있으면 현재 `{ name: 'reviews/detail', params: { workLogId } }` 반환.

- [ ] **Step 3: NotificationRouteMap 수정**

`NotificationRouteMap.ts` :107-118 의 세 항목을 교체(깨지기 쉬운 detail 딥링크 제거):
```ts
  [NotificationType.REVIEW_REQUEST]: () => ({ name: 'reviews/pending' }),
  [NotificationType.REVIEW_RECEIVED]: () => ({ name: 'reviews/pending' }),
  [NotificationType.REVIEW_REMINDER]: () => ({ name: 'reviews/pending' }),
```

- [ ] **Step 4: pending.tsx 를 허브 Redirect 로 축소**

`app/(app)/reviews/pending.tsx` 전체를 교체(미작성 화면은 허브 탭으로 흡수됨):
```tsx
/**
 * 미작성 평가 화면은 평점관리 허브(history)의 '미작성' 탭으로 통합됨.
 * 기존 reviews/pending 딥링크 호환을 위해 허브로 redirect.
 */
import { Redirect } from 'expo-router';

export default function PendingReviewsRedirect() {
  return <Redirect href="/(app)/reviews/history" />;
}
```

- [ ] **Step 5: 테스트 통과 확인 + 회귀**

Run: `cd uniqn-mobile && npx jest src/shared/deeplink/__tests__/NotificationRouteMap.review.test.ts && npx tsc --noEmit -p uniqn-mobile`
Expected: PASS, tsc 0 errors. (schedule.tsx:614 → reviews/pending → 허브 redirect 도달. profile.tsx:192 → 이미 reviews/history.)

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/shared/deeplink/NotificationRouteMap.ts uniqn-mobile/app/\(app\)/reviews/pending.tsx uniqn-mobile/src/shared/deeplink/__tests__/NotificationRouteMap.review.test.ts
git commit -m "feat(review): 리뷰 알림을 항상 평점관리 허브로 — detail 딥링크 제거 + pending redirect"
```

---

## Task 6: 흐름 폴리시 (제출 후 허브 복귀)

**Files:**
- Modify: `uniqn-mobile/app/(app)/reviews/write.tsx` (제출 성공 후 허브 복귀)
- Test: `uniqn-mobile/app/(app)/reviews/__tests__/ReviewWriteScreen.test.tsx` (기존 테스트에 케이스 추가)

**Interfaces:**
- Consumes: `useCreateReview()` mutation 의 onSuccess.
- Produces: 제출 성공 → `router.replace('/(app)/reviews/history')`.

- [ ] **Step 1: 실패 테스트 추가**

`ReviewWriteScreen.test.tsx` 에 케이스 추가:
```tsx
it('제출 성공 시 평점관리 허브로 replace 한다', async () => {
  // useCreateReview mock 의 mutate 가 onSuccess 를 호출하도록 구성 후
  // 제출 버튼 fireEvent → mockReplace 가 '/(app)/reviews/history' 로 호출됐는지 검증
  expect(mockReplace).toHaveBeenCalledWith('/(app)/reviews/history');
});
```
(기존 파일의 expo-router mock(`mockReplace`)과 useCreateReview mock 패턴 재사용.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest app/\(app\)/reviews/__tests__/ReviewWriteScreen.test.tsx`
Expected: FAIL — 제출 후 허브로 이동하지 않음.

- [ ] **Step 3: write.tsx 제출 성공 핸들러 수정**

제출 성공 콜백에서 허브로 복귀:
```tsx
  const handleSuccess = useCallback(() => {
    router.replace('/(app)/reviews/history');
  }, []);
  // useCreateReview().mutate(input, { onSuccess: handleSuccess }) 형태로 연결
```
(기존 submit 흐름에 onSuccess 콜백만 추가. 토스트는 useCreateReview 가 이미 처리.)

- [ ] **Step 4: 테스트 통과 + 전체 품질**

Run: `cd uniqn-mobile && npx jest app/\(app\)/reviews && npm run quality`
Expected: PASS, type-check + lint + format 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/reviews/write.tsx uniqn-mobile/app/\(app\)/reviews/__tests__/ReviewWriteScreen.test.tsx
git commit -m "feat(review): 평가 제출 후 평점관리 허브로 복귀 — 매끄러운 흐름"
```

---

## 최종 검증 (전 Task 완료 후)

- [ ] `cd uniqn-mobile && npm run quality` (type-check + lint + format) 0 errors.
- [ ] `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ReviewRepository* src/shared/deeplink/__tests__/NotificationRouteMap.review.test.ts app/\(app\)/reviews` 전부 PASS.
- [ ] 로컬 `npm run db:reset && npm run test:db -- supabase/tests/create_review.test.sql` PASS.
- [ ] prod 마이그레이션 `mcp__supabase__apply_migration` 적용 → `execute_sql` 로 `create_review` 존재 + `reviews_work_log_reviewer_type_key` 확인 + anon `has_function_privilege` false.
- [ ] 수동 흐름: 평가 알림 탭 → 허브(미작성) → 작성 → 제출 → reviews 1행 + 피평가자 bubble_score 51 + 허브 복귀 + 블라인드 공개.
- [ ] OTA 배포(JS 변경, 네이티브 무변경) — 마이그레이션 prod 적용 후.

## Self-Review 결과 (작성자 점검)
- **Spec 커버리지**: A1→T2, A2→T3, A3/RPC→T1, A4(잔재 정리)→T3 import 정리, B→T4, C→T5, D(저비용)→T6/T4. ✅
- **버블점수 SSOT**: T1 RPC 식이 BUBBLE_SCORE(±1.0, INITIAL 50, round 1) 일치 + pgTAP가 51.0 검증. ✅
- **Placeholder**: 없음(모든 코드 실본문/실명령). ⚠️ T1 fixture uuid 는 `test:db:helpers` seed 값에 맞춰야 함(Step 4 주석).
- **타입 정합**: `createWithTransaction` 반환 `string`, RPC `RETURNS uuid` 스칼라 → `runRpc<string>`. `TabType` 3값 일관. ✅
- **YAGNI 확인**: workLogId 하이라이트 미포함, 허브 신규 화면 대신 history 확장, pending 1줄 redirect, profile 무변경. ✅
