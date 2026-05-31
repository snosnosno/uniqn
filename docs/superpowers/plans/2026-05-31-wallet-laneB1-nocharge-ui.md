# Wallet Lane B1 — 무과금 클라 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Lane A에서 prod 적용된 RPC를 무과금(리스크 0) 클라 경로에 연결 — ① stale types 재생성 ② 출석 적립 UI(`claim_daily_attendance` write는 이미 service까지 완성, 훅+버튼만) ③ 공고 비용 표시(`get_posting_cost` read 훅, flag off면 "무료").

**Architecture:** CLAUDE.md 레이어(Presentation→Hooks→Service→Repository→Supabase) 유지. 출석은 `useClaimDailyAttendance`(뮤테이션, 성공 시 `queryKeys.wallet.summary(uid)` invalidate) + profile 지갑 카드 버튼. 비용은 `WalletRepository.getPostingCost`→`walletService.getPostingCost`→`usePostingCost`(읽기 쿼리)→create.tsx 표시. 차감(consume)/환불(refund) write·PaywallModal은 계획 B2(차감 게이트).

**Tech Stack:** Expo 55 / RN 0.83 / React 19 / TS strict / NativeWind 4.2 / TanStack Query v5 / Zod / Supabase RPC / Jest + @testing-library/react-native

**작업 디렉토리:** `uniqn-mobile/`. 테스트: `npx jest <path>`. 게이트: `npx tsc --noEmit` 0, `npm run quality` exit 0.

---

## File Structure

| 파일 | 책임 | 생성/수정 |
|------|------|-----------|
| `src/types/supabase.ts` | prod 스키마 기반 재생성 (get_posting_cost·create_payment 3-arg 반영) | 재생성 |
| `src/hooks/useClaimDailyAttendance.ts` | 출석 뮤테이션 (성공 시 wallet 키 invalidate) | 생성 |
| `app/(app)/(tabs)/profile.tsx` | 지갑 카드에 "출석 체크" 버튼 | 수정 |
| `src/types/wallet.ts` | `PostingCostSchema` 추가 | 수정 |
| `src/repositories/supabase/WalletRepository.ts` | `getPostingCost(type, ownerId)` read 메서드 | 수정 |
| `src/services/wallet/walletService.ts` | `getPostingCost` 래퍼 | 수정 |
| `src/services/wallet/index.ts` | export 추가 | 수정 |
| `src/lib/queryClient.ts` | `queryKeys.wallet.postingCost(type, ownerId)` | 수정 |
| `src/hooks/usePostingCost.ts` | 비용 조회 훅 | 생성 |
| `app/(employer)/my-postings/create.tsx` | postingType 비용 표시 | 수정 |

테스트: `src/hooks/__tests__/useClaimDailyAttendance.test.ts`, `src/types/__tests__/wallet.test.ts`(PostingCost 추가), `src/repositories/supabase/__tests__/WalletRepository.read.test.ts`(getPostingCost), `src/services/wallet/__tests__/walletService.test.ts`(getPostingCost 추가), `src/hooks/__tests__/usePostingCost.test.ts`.

---

## Task 1: types 재생성 (stale 4-arg create RPC 제거)

**Files:** Modify: `src/types/supabase.ts`

> Lane A에서 `create_job_posting_with_payment_atomically`가 3-arg로 바뀌고 `get_posting_cost`가 신규 추가됐으나 `src/types/supabase.ts`는 구 4-arg(`p_cost_diamonds`)를 유지(stale). prod 스키마 기반으로 재생성.

- [ ] **Step 1: prod 스키마에서 타입 재생성**

Supabase MCP `mcp__supabase__generate_typescript_types`를 호출해 전체 타입을 받아 `src/types/supabase.ts`를 **완전히 덮어쓴다**. (db:types npm 스크립트는 없음.) 파일 헤더 주석(기존 파일 상단의 라이선스/자동생성 안내)이 있으면 보존 형식 유지.

- [ ] **Step 2: 재생성 검증**

Run:
```bash
grep -n "create_job_posting_with_payment_atomically" src/types/supabase.ts
grep -n "get_posting_cost" src/types/supabase.ts
```
Expected: `create_job_posting_with_payment_atomically`의 Args에 `p_cost_diamonds`가 **없고** `p_owner_id, p_posting_payload, p_reason` 3개만. `get_posting_cost` Args `p_type, p_owner_id` 존재.

- [ ] **Step 3: tsc + 전체 jest 회귀**

Run:
```bash
npx tsc --noEmit
npx jest
```
Expected: tsc 0 errors. jest 전체 PASS (types 변경이 기존 RPC 호출 타입을 깨지 않는지 — 깨지면 그 호출부를 보고하고 STOP, 임의 수정 금지).

- [ ] **Step 4: Commit**

```bash
git add src/types/supabase.ts
git commit -m "chore(wallet): Supabase 타입 재생성 (Lane A RPC 시그니처 반영)"
```

---

## Task 2: useClaimDailyAttendance 훅

**Files:** Create: `src/hooks/useClaimDailyAttendance.ts`, Test: `src/hooks/__tests__/useClaimDailyAttendance.test.ts`

> `walletService.claimDailyAttendance()`(이미 존재) → `{status:'claimed',amount,expiresAt}` | `{status:'already_claimed'}`. 성공 시 `queryKeys.wallet.summary(uid)` invalidate(6A). claimed/already_claimed 구분 토스트.

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/useClaimDailyAttendance.test.ts
const mockUseMutation = jest.fn();
const mockInvalidate = jest.fn();
const mockClaim = jest.fn();
const mockAddToast = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: (opts: unknown) => mockUseMutation(opts),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/services/wallet', () => ({
  claimDailyAttendance: (...a: unknown[]) => mockClaim(...a),
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'user-1' } }) }));
jest.mock('@/stores/useToastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

import { useClaimDailyAttendance } from '../useClaimDailyAttendance';
import { queryKeys } from '@/lib/queryClient';

describe('useClaimDailyAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  it('mutationFn은 walletService.claimDailyAttendance를 호출한다', async () => {
    useClaimDailyAttendance();
    const opts = mockUseMutation.mock.calls[0][0];
    await opts.mutationFn();
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  it('claimed 성공 시 wallet.summary 키를 invalidate하고 성공 토스트', () => {
    useClaimDailyAttendance();
    const opts = mockUseMutation.mock.calls[0][0];
    opts.onSuccess({ status: 'claimed', amount: 1, expiresAt: '2026-08-29T00:00:00Z' });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: queryKeys.wallet.summary('user-1') });
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
  });

  it('already_claimed 시 info 토스트, invalidate 안 함', () => {
    useClaimDailyAttendance();
    const opts = mockUseMutation.mock.calls[0][0];
    opts.onSuccess({ status: 'already_claimed' });
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info' })
    );
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
```

> 실행 전 확인(STEP 0): `useToastStore`의 실제 경로/형태를 `grep -rn "useToastStore" src/stores src/hooks | head` 및 `addToast` 시그니처를 확인. 기존 `useJobManagement.ts`가 `const { addToast } = useToastStore()` + `addToast({ type, message })` 패턴을 쓰므로 그에 맞춤. 다르면 mock과 구현을 실제 패턴에 맞게 조정.

- [ ] **Step 2: Run test to verify it fails** — `npx jest src/hooks/__tests__/useClaimDailyAttendance.test.ts` → FAIL (모듈 없음).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/hooks/useClaimDailyAttendance.ts
/**
 * UNIQN Mobile - useClaimDailyAttendance
 * @description 일일 출석 적립 뮤테이션. 성공(claimed) 시 지갑 잔액 키 invalidate(6A).
 *   이미 출석(already_claimed)이면 info 토스트만.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { claimDailyAttendance } from '@/services/wallet';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/stores/useToastStore';
import { queryKeys } from '@/lib/queryClient';

export function useClaimDailyAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const uid = user?.uid;

  return useMutation({
    mutationFn: () => claimDailyAttendance(),
    onSuccess: (result) => {
      if (result.status === 'claimed') {
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary(uid) });
        addToast({ type: 'success', message: `출석 완료! 하트 ${result.amount}개를 받았어요.` });
      } else {
        addToast({ type: 'info', message: '오늘은 이미 출석했어요.' });
      }
    },
    onError: () => {
      addToast({ type: 'error', message: '출석 적립에 실패했어요. 다시 시도해 주세요.' });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx jest src/hooks/__tests__/useClaimDailyAttendance.test.ts` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useClaimDailyAttendance.ts src/hooks/__tests__/useClaimDailyAttendance.test.ts
git commit -m "feat(wallet): useClaimDailyAttendance 출석 적립 훅"
```

---

## Task 3: 출석 체크 버튼 (profile 지갑 카드)

**Files:** Modify: `app/(app)/(tabs)/profile.tsx`

> profile.tsx의 "내 지갑" 카드(L184 텍스트 / L186 `WalletBalanceBadge`)에 "출석 체크" 버튼을 추가. 통합이라 단위 TDD 대신 타입/품질 게이트 + 훅 자체 테스트로 보장.

- [ ] **Step 1: import 추가**

`import { WalletBalanceBadge } from '@/components/wallet';`(L40 부근) 아래에:
```tsx
import { useClaimDailyAttendance } from '@/hooks/useClaimDailyAttendance';
```
`Pressable`이 `react-native` import에 없으면 추가.

- [ ] **Step 2: 컴포넌트 본문에 훅 호출**

profile 컴포넌트 함수 상단(다른 훅들 옆)에:
```tsx
const claimAttendance = useClaimDailyAttendance();
```

- [ ] **Step 3: 지갑 카드에 버튼 배치**

"내 지갑" 카드 내부, `WalletBalanceBadge` 행 아래(같은 `Card` 안)에 출석 버튼 행을 추가. 정확한 JSX는 `grep -n "내 지갑\|WalletBalanceBadge\|</Card>" "app/(app)/(tabs)/profile.tsx"`로 카드 경계를 확인한 뒤, 배지 행 다음에 삽입:

```tsx
          <Pressable
            testID="profile-attendance-button"
            onPress={() => claimAttendance.mutate()}
            disabled={claimAttendance.isPending}
            className="mt-3 flex-row items-center justify-center rounded-xl bg-primary-500 py-2.5 active:opacity-80 disabled:opacity-50 dark:bg-primary-600"
          >
            <Text className="text-sm font-sans-semibold text-white">
              {claimAttendance.isPending ? '처리 중…' : '출석 체크 (하트 +1)'}
            </Text>
          </Pressable>
```

> 색 토큰은 실제 사용 가능한 primary 계열로(`grep -n "bg-primary-500\|bg-primary-600" src app | head`로 확인). 없으면 프로젝트의 강조색 토큰(예: gold 계열)으로 교체. `Text`/`Pressable`는 react-native import 확인.

- [ ] **Step 4: 게이트**

Run:
```bash
npx tsc --noEmit
npm run quality
```
Expected: tsc 0, quality exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/(tabs)/profile.tsx"
git commit -m "feat(wallet): 프로필 지갑 카드 출석 체크 버튼"
```

---

## Task 4: PostingCost 조회 (Repository→service→queryKey→hook)

**Files:** Modify `src/types/wallet.ts`, `WalletRepository.ts`, `walletService.ts`, `src/services/wallet/index.ts`, `src/lib/queryClient.ts`; Create `src/hooks/usePostingCost.ts`; Tests.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/types/__tests__/wallet.test.ts 에 추가
import { PostingCostSchema } from '@/types/wallet';
describe('PostingCostSchema', () => {
  it('get_posting_cost 응답을 파싱한다', () => {
    const parsed = PostingCostSchema.parse({
      type: 'urgent', cost: 0, is_paid: false, currency_hint: 'diamond',
    });
    expect(parsed.cost).toBe(0);
    expect(parsed.is_paid).toBe(false);
  });
});
```

```typescript
// src/repositories/supabase/__tests__/WalletRepository.read.test.ts
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
import { WalletRepository } from '../WalletRepository';

describe('WalletRepository.getPostingCost', () => {
  beforeEach(() => jest.clearAllMocks());
  it('get_posting_cost RPC를 type/owner로 호출하고 파싱한다', async () => {
    mockRpc.mockResolvedValue({
      data: { type: 'urgent', cost: 0, is_paid: false, currency_hint: 'diamond' },
      error: null,
    });
    const r = await WalletRepository.getPostingCost('urgent', 'owner-1');
    expect(mockRpc).toHaveBeenCalledWith('get_posting_cost', { p_type: 'urgent', p_owner_id: 'owner-1' });
    expect(r.cost).toBe(0);
  });
  it('RPC 에러를 throw한다', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(WalletRepository.getPostingCost('urgent', 'owner-1')).rejects.toMatchObject({ message: 'boom' });
  });
});
```

```typescript
// src/services/wallet/__tests__/walletService.test.ts 에 추가 (기존 mock에 getPostingCost 추가)
// jest.mock('@/repositories/supabase/WalletRepository', ...) 의 WalletRepository에
//   getPostingCost: (...a) => mockGetPostingCost(...a) 추가하고:
import { getPostingCost } from '../walletService';
describe('walletService.getPostingCost', () => {
  it('Repository 결과를 그대로 반환', async () => {
    mockGetPostingCost.mockResolvedValue({ type: 'urgent', cost: 0, is_paid: false, currency_hint: 'diamond' });
    await expect(getPostingCost('urgent', 'owner-1')).resolves.toMatchObject({ cost: 0 });
  });
  it('에러를 AppError로 변환', async () => {
    mockGetPostingCost.mockRejectedValue(new Error('boom'));
    await expect(getPostingCost('urgent', 'owner-1')).rejects.toMatchObject({ userMessage: expect.any(String) });
  });
});
```

```typescript
// src/hooks/__tests__/usePostingCost.test.ts
const mockUseQuery = jest.fn();
const mockGet = jest.fn();
jest.mock('@tanstack/react-query', () => ({ useQuery: (o: unknown) => mockUseQuery(o) }));
jest.mock('@/services/wallet', () => ({ getPostingCost: (...a: unknown[]) => mockGet(...a) }));
import { usePostingCost } from '../usePostingCost';
import { queryKeys } from '@/lib/queryClient';

describe('usePostingCost', () => {
  beforeEach(() => { jest.clearAllMocks(); mockUseQuery.mockReturnValue({ data: undefined }); });
  it('type+ownerId 기반 queryKey, enabled', () => {
    usePostingCost('urgent', 'owner-1');
    const o = mockUseQuery.mock.calls[0][0];
    expect(o.queryKey).toEqual(queryKeys.wallet.postingCost('urgent', 'owner-1'));
    expect(o.enabled).toBe(true);
  });
  it('ownerId 없으면 enabled=false', () => {
    usePostingCost('urgent', undefined);
    expect(mockUseQuery.mock.calls[0][0].enabled).toBe(false);
  });
  it('queryFn은 getPostingCost 호출', () => {
    usePostingCost('urgent', 'owner-1');
    mockUseQuery.mock.calls[0][0].queryFn();
    expect(mockGet).toHaveBeenCalledWith('urgent', 'owner-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — 각 `npx jest <path>` → FAIL.

- [ ] **Step 3: Write minimal implementations**

3a. `src/types/wallet.ts` 끝에:
```typescript
// ============================================================
// get_posting_cost RPC 응답
// ============================================================
export const PostingCostSchema = z.object({
  type: z.string(),
  cost: z.number().int().nonnegative(),
  is_paid: z.boolean(),
  currency_hint: z.string(),
});
export type PostingCost = z.infer<typeof PostingCostSchema>;
```

3b. `WalletRepository.ts` — import에 `PostingCostSchema, type PostingCost` 추가, `claimDailyAttendance` 뒤에:
```typescript
  /**
   * 공고 비용 조회 (표시·과금 단일소스 get_posting_cost). flag off면 cost=0.
   */
  async getPostingCost(postingType: string, ownerId: string): Promise<PostingCost> {
    const { data, error } = await supabase.rpc('get_posting_cost', {
      p_type: postingType,
      p_owner_id: ownerId,
    });
    if (error) {
      logger.error('wallet.getPostingCost.failed', error, { postingType });
      throw error;
    }
    return PostingCostSchema.parse(data);
  },
```

3c. `walletService.ts` — import에 `PostingCost` 추가, 끝에:
```typescript
/**
 * 공고 비용 조회 (표시용 단일소스).
 */
export async function getPostingCost(postingType: string, ownerId: string): Promise<PostingCost> {
  try {
    return await WalletRepository.getPostingCost(postingType, ownerId);
  } catch (error) {
    throw handleServiceError(error, { operation: '공고 비용 조회', component: 'walletService' });
  }
}
```
import 줄: `import type { WalletSummary, PostingCost } from '@/types/wallet';`

3d. `src/services/wallet/index.ts`:
```typescript
export { getWalletSummary, claimDailyAttendance, getPostingCost } from './walletService';
```

3e. `src/lib/queryClient.ts` — `queryKeys.wallet` 객체에:
```typescript
    postingCost: (type: string, ownerId?: string) =>
      [...queryKeys.wallet.all, 'posting-cost', type, ownerId ?? 'me'] as const,
```

3f. `src/hooks/usePostingCost.ts`:
```typescript
/**
 * UNIQN Mobile - usePostingCost
 * @description 공고 비용(get_posting_cost) 조회 훅. 표시용 단일소스. flag off면 cost=0.
 */
import { useQuery } from '@tanstack/react-query';
import { getPostingCost } from '@/services/wallet';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';

export function usePostingCost(postingType: string, ownerId?: string) {
  return useQuery({
    queryKey: queryKeys.wallet.postingCost(postingType, ownerId),
    queryFn: () => getPostingCost(postingType, ownerId as string),
    enabled: !!ownerId,
    staleTime: queryCachingOptions.wallet.staleTime,
    gcTime: queryCachingOptions.wallet.gcTime,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass** — 각 스위트 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/wallet.ts src/types/__tests__/wallet.test.ts src/repositories/supabase/WalletRepository.ts src/repositories/supabase/__tests__/WalletRepository.read.test.ts src/services/wallet/ src/lib/queryClient.ts src/hooks/usePostingCost.ts src/hooks/__tests__/usePostingCost.test.ts
git commit -m "feat(wallet): get_posting_cost 조회 경로 (Repository→service→usePostingCost)"
```

---

## Task 5: create.tsx 비용 표시

**Files:** Modify: `app/(employer)/my-postings/create.tsx`

> 폼 상단 "보유 잔액" 행(이전 세션 배치) 옆/아래에 선택된 `postingType`의 비용을 표시. flag off면 cost=0 → "무료" 라벨. 통합이라 타입/품질 게이트로 검증.

- [ ] **Step 1: import + 훅 호출**

`import { usePostingCost } from '@/hooks/usePostingCost';` 추가. 컴포넌트 본문에서 현재 선택된 타입(`formData.postingType`)과 `user?.uid`로:
```tsx
const postingCost = usePostingCost(formData.postingType ?? 'regular', user?.uid);
```
> `formData.postingType` 접근 경로는 실제 폼 상태에 맞춤(`grep -n "postingType" "app/(employer)/my-postings/create.tsx"`로 확인).

- [ ] **Step 2: 비용 표시 행**

"보유 잔액" 배지 행 아래(또는 옆)에:
```tsx
        <View className="flex-row items-center justify-between px-4 pb-2">
          <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
            게시 비용
          </Text>
          <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
            {postingCost.data == null
              ? '—'
              : postingCost.data.cost === 0
                ? '무료'
                : `${postingCost.data.cost}${postingCost.data.currency_hint === 'heart_first' ? '💖' : '💎'}`}
          </Text>
        </View>
```
> `View`/`Text`는 이미 import됨(이전 세션 create.tsx 배치). 색 토큰은 기존 파일 사용 토큰과 일치시킴.

- [ ] **Step 3: 게이트**

```bash
npx tsc --noEmit
npx jest
npm run quality
```
Expected: tsc 0, jest 전체 PASS(신규 B1 스위트 포함), quality exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/(employer)/my-postings/create.tsx"
git commit -m "feat(wallet): 공고 생성 화면 게시 비용 표시 (flag off=무료)"
```

---

## Self-Review

**스펙 커버리지:** 출석 적립 UI(후속 ⓪) = Task 2 훅 + Task 3 버튼 ✅. 비용 표시(T11/3A 표시분) = Task 4 조회 경로 + Task 5 표시 ✅. types stale 제거 = Task 1 ✅.
**제외(계획 B2 차감 게이트):** WalletRepository createJobPostingWithPayment/refund write, T8 createWithTransaction RPC 전환, INSUFFICIENT_BALANCE→PaywallModal, T9 취소 환불 연결, 6A 차감 동기 캐시. **B1은 전부 무과금·읽기/적립이라 R1 게이트와 무관.**
**타입 일관성:** `PostingCost`(Task4) ← Repository·service·hook 동일. `queryKeys.wallet.postingCost(type,ownerId)`(Task4 3e) ← hook·test 일치. `ClaimAttendanceResult`(기존) ← Task2 onSuccess 분기 `claimed`/`already_claimed` 일치.
**플레이스홀더:** 없음. 단 실행 시 확인 3건(검증 명령 포함): useToastStore 경로/시그니처(Task2 STEP0), profile 카드 경계·primary 토큰(Task3), formData.postingType 접근·create.tsx 색토큰(Task5).
