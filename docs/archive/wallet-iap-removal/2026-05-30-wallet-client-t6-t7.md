# Wallet Client Integration (T6·T7, 무과금) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** wallet 백엔드(이미 100% 완성된 RPC)를 클라이언트에 무과금(리스크 0) 경로만 연결한다 — 출석 적립(`claim_daily_attendance`) write 경로 + 잔액 조회 훅 + `BalanceBadge`(만료 임박 하트 inline 포함)를 2개 화면에 배치.

**Architecture:** CLAUDE.md 레이어(Presentation → Hooks → Service → Repository → Supabase)를 그대로 따른다. `WalletRepository`(쓰기 메서드 1개 추가) → `walletService`(에러 변환·도메인 정규화) → `useWalletBalance`(단일 queryKey, 5화면 dedup) → `BalanceBadge`(순수 표시) + `WalletBalanceBadge`(connected). 차감(consume)/환불(refund) write 경로는 T3(멱등성 key)·T5(협업자 분기)에서 RPC 시그니처가 바뀌므로 **이 계획에서 제외**(만들면 재작업).

**Tech Stack:** Expo 55 / RN 0.83 / React 19 / TS strict / NativeWind 4.2 / TanStack Query v5 / Zod / Supabase RPC / lucide-react-native / @testing-library/react-native / Jest

**Scope (이 계획):** T6(무과금 부분) + T7. **제외:** consume/refund Repository 메서드(T3/T5 후), 출석 버튼 UI 배치(후속 ⓪), 공고 생성 차감 배선(T8), RevenueCat 충전(T10).

**검증된 RPC 계약 (변경 금지):**
- `get_wallet_summary(p_user_id UUID DEFAULT NULL) RETURNS JSONB` → `{ heart_balance, diamond_balance, lifetime_purchased_diamonds, expiring_lots[] }`. `expiring_lots`는 7일 이내 만료 lot만, `expires_at ASC` 정렬. (마이그 `20260427000500` L113-176). 이미 `WalletSummarySchema`와 매핑됨.
- `claim_daily_attendance() RETURNS JSONB` — 인자 없음, `authenticated` 권한. 성공 `{ success: true, lot_id, expires_at, amount }` / 중복 `{ success: false, error: 'already_attended_today' }` / 미인증 `RAISE EXCEPTION 'NOT_AUTHENTICATED'`. (마이그 `20260427000500` L86-106)

---

## File Structure

| 파일 | 책임 | 생성/수정 |
|------|------|-----------|
| `src/types/wallet.ts` | `ClaimAttendanceResponseSchema` 추가 (discriminated union) | 수정 |
| `src/repositories/supabase/WalletRepository.ts` | `claimDailyAttendance()` write 메서드 추가 | 수정 |
| `src/services/wallet/walletService.ts` | `getWalletSummary`·`claimDailyAttendance` (에러 변환 + 도메인 정규화) | 생성 |
| `src/services/wallet/index.ts` | 배럴 export | 생성 |
| `src/lib/queryClient.ts` | `queryKeys.wallet` + `queryCachingOptions.wallet` 추가 | 수정 |
| `src/hooks/useWalletBalance.ts` | 단일 queryKey 잔액 조회 훅 | 생성 |
| `src/utils/wallet/expiringHearts.ts` | `summarizeExpiringHearts` 순수 함수 (D-day 계산) | 생성 |
| `src/components/wallet/BalanceBadge.tsx` | 순수 표시 컴포넌트 (props 기반) | 생성 |
| `src/components/wallet/WalletBalanceBadge.tsx` | connected (훅 호출 → BalanceBadge) | 생성 |
| `src/components/wallet/index.ts` | 배럴 export | 생성 |
| `src/components/icons/index.tsx` | `GemIcon`(다이아) export 추가 | 수정 |
| `app/(app)/(tabs)/profile.tsx` | 프로필 카드 뒤 지갑 카드 배치 | 수정 |
| `app/(employer)/my-postings/create.tsx` | 폼 상단 잔액 배지 배치 | 수정 |

**테스트 파일:**
- `src/types/__tests__/wallet.test.ts`
- `src/repositories/supabase/__tests__/WalletRepository.write.test.ts`
- `src/services/wallet/__tests__/walletService.test.ts`
- `src/hooks/__tests__/useWalletBalance.test.ts`
- `src/utils/wallet/__tests__/expiringHearts.test.ts`
- `src/components/wallet/__tests__/BalanceBadge.test.tsx`
- `src/components/wallet/__tests__/WalletBalanceBadge.test.tsx`

**작업 디렉토리:** 모든 명령은 `uniqn-mobile/`에서 실행. 테스트: `npx jest <path>`.

---

## Task 1: 출석 응답 Zod 스키마

**Files:**
- Modify: `src/types/wallet.ts` (파일 끝에 추가)
- Test: `src/types/__tests__/wallet.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/types/__tests__/wallet.test.ts
import {
  ClaimAttendanceResponseSchema,
  type ClaimAttendanceResponse,
} from '@/types/wallet';

describe('ClaimAttendanceResponseSchema', () => {
  it('성공 응답을 파싱한다', () => {
    const raw = {
      success: true,
      lot_id: '11111111-1111-1111-1111-111111111111',
      expires_at: '2026-08-28T00:00:00Z',
      amount: 1,
    };
    const parsed = ClaimAttendanceResponseSchema.parse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.amount).toBe(1);
      expect(parsed.lot_id).toBe('11111111-1111-1111-1111-111111111111');
    }
  });

  it('이미 출석 응답을 파싱한다', () => {
    const raw = { success: false, error: 'already_attended_today' };
    const parsed = ClaimAttendanceResponseSchema.parse(raw);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error).toBe('already_attended_today');
    }
  });

  it('알 수 없는 error 문자열은 거부한다', () => {
    const raw = { success: false, error: 'something_else' };
    expect(() => ClaimAttendanceResponseSchema.parse(raw)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/types/__tests__/wallet.test.ts`
Expected: FAIL — `ClaimAttendanceResponseSchema` is not exported / undefined.

- [ ] **Step 3: Write minimal implementation**

`src/types/wallet.ts` 파일 끝(`DiamondProductSchema` 블록 뒤)에 추가:

```typescript
// ============================================================================
// claim_daily_attendance RPC 응답
// ============================================================================

export const ClaimAttendanceSuccessSchema = z.object({
  success: z.literal(true),
  lot_id: z.string().uuid(),
  expires_at: z.string(),
  amount: z.number().int().positive(),
});

export const ClaimAttendanceAlreadySchema = z.object({
  success: z.literal(false),
  error: z.literal('already_attended_today'),
});

export const ClaimAttendanceResponseSchema = z.discriminatedUnion('success', [
  ClaimAttendanceSuccessSchema,
  ClaimAttendanceAlreadySchema,
]);
export type ClaimAttendanceResponse = z.infer<typeof ClaimAttendanceResponseSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/types/__tests__/wallet.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/types/wallet.ts src/types/__tests__/wallet.test.ts
git commit -m "feat(wallet): claim_daily_attendance 응답 Zod 스키마 추가"
```

---

## Task 2: WalletRepository 출석 write 메서드

**Files:**
- Modify: `src/repositories/supabase/WalletRepository.ts`
- Test: `src/repositories/supabase/__tests__/WalletRepository.write.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/repositories/supabase/__tests__/WalletRepository.write.test.ts
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { WalletRepository } from '../WalletRepository';

describe('WalletRepository.claimDailyAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claim_daily_attendance RPC를 인자 없이 호출하고 성공 응답을 파싱한다', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        lot_id: '11111111-1111-1111-1111-111111111111',
        expires_at: '2026-08-28T00:00:00Z',
        amount: 1,
      },
      error: null,
    });

    const result = await WalletRepository.claimDailyAttendance();

    expect(mockRpc).toHaveBeenCalledWith('claim_daily_attendance', {});
    expect(result.success).toBe(true);
  });

  it('이미 출석 응답을 그대로 파싱해 반환한다', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'already_attended_today' },
      error: null,
    });

    const result = await WalletRepository.claimDailyAttendance();

    expect(result.success).toBe(false);
  });

  it('RPC 에러를 그대로 throw한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'NOT_AUTHENTICATED' },
    });

    await expect(WalletRepository.claimDailyAttendance()).rejects.toMatchObject({
      message: 'NOT_AUTHENTICATED',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/repositories/supabase/__tests__/WalletRepository.write.test.ts`
Expected: FAIL — `WalletRepository.claimDailyAttendance is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/repositories/supabase/WalletRepository.ts` 상단 import에 `ClaimAttendanceResponseSchema`·`ClaimAttendanceResponse` 추가:

```typescript
import {
  DiamondProductSchema,
  WalletSummarySchema,
  ClaimAttendanceResponseSchema,
  type DiamondProduct,
  type WalletSummary,
  type ClaimAttendanceResponse,
} from '@/types/wallet';
```

`listProducts` 메서드 뒤(객체 닫기 `};` 직전)에 추가:

```typescript
  /**
   * 본인 일일 출석 체크 — 하트 1개 적립(90일 만료). KST 기준 일일 1회.
   *
   * @returns 성공 시 lot 정보, 이미 출석 시 success:false. 미인증 등은 throw.
   * @throws Supabase RPC 에러 그대로 throw — Service 계층이 변환.
   */
  async claimDailyAttendance(): Promise<ClaimAttendanceResponse> {
    const { data, error } = await supabase.rpc('claim_daily_attendance', {});
    if (error) {
      logger.error('wallet.claimDailyAttendance.failed', error);
      throw error;
    }
    return ClaimAttendanceResponseSchema.parse(data);
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/repositories/supabase/__tests__/WalletRepository.write.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/repositories/supabase/WalletRepository.ts src/repositories/supabase/__tests__/WalletRepository.write.test.ts
git commit -m "feat(wallet): WalletRepository.claimDailyAttendance write 경로 추가"
```

---

## Task 3: walletService (도메인 정규화 + 에러 변환)

**Files:**
- Create: `src/services/wallet/walletService.ts`
- Create: `src/services/wallet/index.ts`
- Test: `src/services/wallet/__tests__/walletService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/wallet/__tests__/walletService.test.ts
const mockGetSummary = jest.fn();
const mockClaimDailyAttendance = jest.fn();

jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: {
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
    claimDailyAttendance: (...args: unknown[]) => mockClaimDailyAttendance(...args),
  },
}));

import { getWalletSummary, claimDailyAttendance } from '../walletService';

describe('walletService.claimDailyAttendance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('성공 응답을 claimed 결과로 정규화한다', async () => {
    mockClaimDailyAttendance.mockResolvedValue({
      success: true,
      lot_id: '11111111-1111-1111-1111-111111111111',
      expires_at: '2026-08-28T00:00:00Z',
      amount: 1,
    });

    const result = await claimDailyAttendance();

    expect(result).toEqual({
      status: 'claimed',
      amount: 1,
      expiresAt: '2026-08-28T00:00:00Z',
    });
  });

  it('이미 출석 응답을 already_claimed 결과로 정규화한다', async () => {
    mockClaimDailyAttendance.mockResolvedValue({
      success: false,
      error: 'already_attended_today',
    });

    const result = await claimDailyAttendance();

    expect(result).toEqual({ status: 'already_claimed' });
  });

  it('Repository 에러를 AppError로 변환해 throw한다', async () => {
    mockClaimDailyAttendance.mockRejectedValue(new Error('NOT_AUTHENTICATED'));

    await expect(claimDailyAttendance()).rejects.toMatchObject({
      code: expect.any(String),
      userMessage: expect.any(String),
    });
  });
});

describe('walletService.getWalletSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Repository 요약을 그대로 반환한다', async () => {
    const summary = {
      heart_balance: 10,
      diamond_balance: 0,
      lifetime_purchased_diamonds: 0,
      expiring_lots: [],
    };
    mockGetSummary.mockResolvedValue(summary);

    await expect(getWalletSummary()).resolves.toEqual(summary);
    expect(mockGetSummary).toHaveBeenCalledWith(undefined);
  });

  it('Repository 에러를 AppError로 변환해 throw한다', async () => {
    mockGetSummary.mockRejectedValue(new Error('boom'));

    await expect(getWalletSummary()).rejects.toMatchObject({
      userMessage: expect.any(String),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/wallet/__tests__/walletService.test.ts`
Expected: FAIL — cannot find module `../walletService`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/wallet/walletService.ts
/**
 * UNIQN Mobile - Wallet Service
 *
 * @description 지갑 도메인 비즈니스 로직 — Repository 호출 + 에러 변환 + 도메인 정규화.
 *   - 차감(consume)/환불(refund)은 RPC 시그니처 확정(T3/T5) 후 별도 추가.
 * @see docs/superpowers/plans/2026-05-30-wallet-client-t6-t7.md
 */

import { WalletRepository } from '@/repositories/supabase/WalletRepository';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import type { WalletSummary } from '@/types/wallet';

export type ClaimAttendanceResult =
  | { status: 'claimed'; amount: number; expiresAt: string }
  | { status: 'already_claimed' };

/**
 * 본인(또는 지정 사용자) 지갑 요약 조회.
 */
export async function getWalletSummary(userId?: string): Promise<WalletSummary> {
  try {
    return await WalletRepository.getSummary(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '지갑 요약 조회',
      component: 'walletService',
    });
  }
}

/**
 * 일일 출석 체크 — 하트 1개 적립. 이미 출석했으면 already_claimed.
 */
export async function claimDailyAttendance(): Promise<ClaimAttendanceResult> {
  try {
    const res = await WalletRepository.claimDailyAttendance();
    if (res.success) {
      return { status: 'claimed', amount: res.amount, expiresAt: res.expires_at };
    }
    return { status: 'already_claimed' };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '출석 적립',
      component: 'walletService',
    });
  }
}
```

```typescript
// src/services/wallet/index.ts
export { getWalletSummary, claimDailyAttendance } from './walletService';
export type { ClaimAttendanceResult } from './walletService';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/wallet/__tests__/walletService.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/wallet/
git commit -m "feat(wallet): walletService 출석 적립 + 요약 조회 (에러 변환·정규화)"
```

---

## Task 4: queryKeys.wallet + useWalletBalance 훅 (단일 queryKey)

**Files:**
- Modify: `src/lib/queryClient.ts` (`queryKeys` 객체 + `queryCachingOptions` 객체)
- Create: `src/hooks/useWalletBalance.ts`
- Test: `src/hooks/__tests__/useWalletBalance.test.ts`

> queryKeys/캐싱 설정은 config라 자체 테스트 없이 훅 테스트가 키 형태·enabled·queryFn을 검증한다.

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/useWalletBalance.test.ts
const mockUseQuery = jest.fn();
const mockGetWalletSummary = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: unknown) => mockUseQuery(opts),
}));

jest.mock('@/services/wallet', () => ({
  getWalletSummary: (...args: unknown[]) => mockGetWalletSummary(...args),
}));

const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

import { useWalletBalance } from '../useWalletBalance';

describe('useWalletBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
  });

  it('uid 기반 단일 queryKey로 useQuery를 구성한다', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });

    useWalletBalance();

    const opts = mockUseQuery.mock.calls[0][0];
    expect(opts.queryKey).toEqual(['wallet', 'summary', 'user-1']);
    expect(opts.enabled).toBe(true);
  });

  it('queryFn은 walletService.getWalletSummary를 호출한다', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });

    useWalletBalance();

    const opts = mockUseQuery.mock.calls[0][0];
    opts.queryFn();
    expect(mockGetWalletSummary).toHaveBeenCalledTimes(1);
  });

  it('로그인 전(uid 없음)에는 enabled=false', () => {
    mockUseAuth.mockReturnValue({ user: null });

    useWalletBalance();

    const opts = mockUseQuery.mock.calls[0][0];
    expect(opts.enabled).toBe(false);
    expect(opts.queryKey).toEqual(['wallet', 'summary', 'me']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/__tests__/useWalletBalance.test.ts`
Expected: FAIL — cannot find module `../useWalletBalance`.

- [ ] **Step 3: Write minimal implementation**

3a. `src/lib/queryClient.ts`의 `queryKeys` 객체 안, `employerApplications` 블록 뒤(닫는 `} as const;` 직전)에 추가:

```typescript
  // 지갑 (wallet — 결제/적립)
  wallet: {
    all: ['wallet'] as const,
    summary: (uid?: string) => [...queryKeys.wallet.all, 'summary', uid ?? 'me'] as const,
  },
```

3b. 같은 파일 `queryCachingOptions` 객체 안, `reviews` 블록 뒤(닫는 `} as const;` 직전)에 추가:

```typescript
  /** 지갑 잔액 - 5분 (차감/충전 시 동기 invalidate로 즉시 갱신) */
  wallet: {
    staleTime: cachingPolicies.frequent,
    gcTime: 10 * 60 * 1000, // 10분
  },
```

3c. 훅 생성:

```typescript
// src/hooks/useWalletBalance.ts
/**
 * UNIQN Mobile - useWalletBalance
 *
 * @description 본인 지갑 요약(하트/다이아 잔액 + 만료 임박 lot) 조회 훅.
 *   - 단일 queryKey(uid 기준)라 여러 화면에서 동시 사용해도 네트워크 1회로 dedup된다.
 *   - 차감/충전 시 같은 키를 invalidate해 동기 갱신(6A).
 */

import { useQuery } from '@tanstack/react-query';
import { getWalletSummary } from '@/services/wallet';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';

export function useWalletBalance() {
  const { user } = useAuth();
  const uid = user?.uid;

  return useQuery({
    queryKey: queryKeys.wallet.summary(uid),
    queryFn: () => getWalletSummary(),
    enabled: !!uid,
    staleTime: queryCachingOptions.wallet.staleTime,
    gcTime: queryCachingOptions.wallet.gcTime,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/hooks/__tests__/useWalletBalance.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/queryClient.ts src/hooks/useWalletBalance.ts src/hooks/__tests__/useWalletBalance.test.ts
git commit -m "feat(wallet): useWalletBalance 훅 + wallet queryKey 단일 소스"
```

---

## Task 5: 만료 임박 하트 요약 유틸 (순수 함수, D-day)

**Files:**
- Create: `src/utils/wallet/expiringHearts.ts`
- Test: `src/utils/wallet/__tests__/expiringHearts.test.ts`

> `now`를 인자로 주입해 결정적 테스트. `expiring_lots`는 RPC가 이미 7일 이내·ASC 정렬로 보장하지만, 유틸은 방어적으로 합산·최소 expiry 재계산한다.

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/wallet/__tests__/expiringHearts.test.ts
import { summarizeExpiringHearts } from '../expiringHearts';
import type { ExpiringLot } from '@/types/wallet';

const NOW = new Date('2026-05-30T00:00:00Z');

function lot(over: Partial<ExpiringLot>): ExpiringLot {
  return {
    lot_id: '11111111-1111-1111-1111-111111111111',
    amount_remaining: 1,
    expires_at: '2026-06-02T00:00:00Z',
    source: 'grant_signup',
    ...over,
  };
}

describe('summarizeExpiringHearts', () => {
  it('lot이 없으면 null', () => {
    expect(summarizeExpiringHearts([], NOW)).toBeNull();
  });

  it('남은 수량을 합산한다', () => {
    const result = summarizeExpiringHearts(
      [lot({ amount_remaining: 3 }), lot({ amount_remaining: 2 })],
      NOW
    );
    expect(result?.totalAmount).toBe(5);
  });

  it('가장 임박한 lot 기준 D-day를 올림 계산한다', () => {
    // 2026-06-02 - 2026-05-30 = 3일
    const result = summarizeExpiringHearts(
      [lot({ expires_at: '2026-06-05T00:00:00Z' }), lot({ expires_at: '2026-06-02T00:00:00Z' })],
      NOW
    );
    expect(result?.daysUntilExpiry).toBe(3);
  });

  it('하루 미만 남은 lot은 D-day 1로 올림(0 방지)', () => {
    const result = summarizeExpiringHearts(
      [lot({ expires_at: '2026-05-30T10:00:00Z' })],
      NOW
    );
    expect(result?.daysUntilExpiry).toBe(1);
  });

  it('amount_remaining이 0인 lot은 무시한다', () => {
    const result = summarizeExpiringHearts(
      [lot({ amount_remaining: 0 }), lot({ amount_remaining: 4 })],
      NOW
    );
    expect(result?.totalAmount).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/wallet/__tests__/expiringHearts.test.ts`
Expected: FAIL — cannot find module `../expiringHearts`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/wallet/expiringHearts.ts
/**
 * UNIQN Mobile - 만료 임박 하트 요약
 *
 * @description get_wallet_summary의 expiring_lots(7일 이내 만료 하트 lot)를
 *   inline 표시용 요약(총 수량 + 가장 임박한 D-day)으로 변환하는 순수 함수.
 */

import type { ExpiringLot } from '@/types/wallet';

export interface ExpiringHeartSummary {
  /** 만료 임박 lot들의 남은 하트 총합 */
  totalAmount: number;
  /** 가장 임박한 lot까지 남은 일수 (최소 1로 올림) */
  daysUntilExpiry: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function summarizeExpiringHearts(
  lots: ExpiringLot[],
  now: Date
): ExpiringHeartSummary | null {
  const active = lots.filter((l) => l.amount_remaining > 0);
  if (active.length === 0) {
    return null;
  }

  const totalAmount = active.reduce((sum, l) => sum + l.amount_remaining, 0);

  const earliest = active.reduce((min, l) =>
    new Date(l.expires_at).getTime() < new Date(min.expires_at).getTime() ? l : min
  );

  const diffMs = new Date(earliest.expires_at).getTime() - now.getTime();
  const daysUntilExpiry = Math.max(1, Math.ceil(diffMs / MS_PER_DAY));

  return { totalAmount, daysUntilExpiry };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/wallet/__tests__/expiringHearts.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/wallet/expiringHearts.ts src/utils/wallet/__tests__/expiringHearts.test.ts
git commit -m "feat(wallet): 만료 임박 하트 요약 유틸 (D-day 올림)"
```

---

## Task 6: BalanceBadge (순수 표시 컴포넌트) + GemIcon

**Files:**
- Modify: `src/components/icons/index.tsx` (`GemIcon` export 추가)
- Create: `src/components/wallet/BalanceBadge.tsx`
- Create: `src/components/wallet/index.ts`
- Test: `src/components/wallet/__tests__/BalanceBadge.test.tsx`

> `Gem`은 lucide-react-native에 존재(확인됨). 기존 `createIcon` 패턴 사용. 다크모드 `dark:` variant 필수.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/wallet/__tests__/BalanceBadge.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { BalanceBadge } from '@/components/wallet/BalanceBadge';

describe('BalanceBadge', () => {
  it('하트·다이아 잔액을 표시한다', () => {
    const { getByText } = render(
      <BalanceBadge heartBalance={12} diamondBalance={5} />
    );
    expect(getByText('12')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('만료 임박 요약이 있으면 inline 표시한다', () => {
    const { getByText } = render(
      <BalanceBadge
        heartBalance={12}
        diamondBalance={0}
        expiring={{ totalAmount: 3, daysUntilExpiry: 2 }}
      />
    );
    // "3💖 D-2 만료" 류 텍스트 — 수량/일수 둘 다 노출
    expect(getByText(/3/)).toBeTruthy();
    expect(getByText(/D-2/)).toBeTruthy();
  });

  it('만료 요약이 없으면 만료 텍스트를 렌더하지 않는다', () => {
    const { queryByText } = render(
      <BalanceBadge heartBalance={12} diamondBalance={0} expiring={null} />
    );
    expect(queryByText(/만료/)).toBeNull();
  });

  it('isLoading이면 잔액 대신 플레이스홀더(—)를 표시한다', () => {
    const { getAllByText } = render(
      <BalanceBadge heartBalance={0} diamondBalance={0} isLoading />
    );
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/wallet/__tests__/BalanceBadge.test.tsx`
Expected: FAIL — cannot find module `@/components/wallet/BalanceBadge`.

- [ ] **Step 3: Write minimal implementation**

3a. `src/components/icons/index.tsx`:
- 상단 lucide import 블록(`import { ... } from 'lucide-react-native'`)에 `Gem,` 추가 (알파벳 순 위치 무관, 블록 내 아무 곳).
- `HeartIcon` export 부근(L265)에 추가:

```tsx
export const GemIcon = createIcon(Gem);
```

3b. BalanceBadge 컴포넌트:

```tsx
// src/components/wallet/BalanceBadge.tsx
/**
 * UNIQN Mobile - BalanceBadge (순수 표시)
 *
 * @description 하트/다이아 잔액 + 만료 임박 하트 inline 표시. 데이터는 props로만 받는다.
 *   연결(훅 호출)은 WalletBalanceBadge가 담당.
 */

import { View, Text } from 'react-native';
import { HeartFilledIcon, GemIcon } from '@/components/icons';
import { PRIMARY_PALETTE } from '@/constants/colors';
import type { ExpiringHeartSummary } from '@/utils/wallet/expiringHearts';

export interface BalanceBadgeProps {
  heartBalance: number;
  diamondBalance: number;
  expiring?: ExpiringHeartSummary | null;
  isLoading?: boolean;
  testID?: string;
}

export function BalanceBadge({
  heartBalance,
  diamondBalance,
  expiring,
  isLoading,
  testID,
}: BalanceBadgeProps) {
  const heartLabel = isLoading ? '—' : String(heartBalance);
  const diamondLabel = isLoading ? '—' : String(diamondBalance);

  return (
    <View testID={testID} className="flex-row items-center gap-3">
      <View className="flex-row items-center gap-1">
        <HeartFilledIcon size={16} />
        <Text className="text-sm font-sans-medium text-content-primary dark:text-secondary-100">
          {heartLabel}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        <GemIcon size={16} color={PRIMARY_PALETTE[500]} />
        <Text className="text-sm font-sans-medium text-content-primary dark:text-secondary-100">
          {diamondLabel}
        </Text>
      </View>
      {expiring && (
        <Text className="text-xs font-sans text-warning-600 dark:text-warning-400">
          {expiring.totalAmount}💖 D-{expiring.daysUntilExpiry} 만료
        </Text>
      )}
    </View>
  );
}
```

3c. 배럴:

```typescript
// src/components/wallet/index.ts
export { BalanceBadge } from './BalanceBadge';
export type { BalanceBadgeProps } from './BalanceBadge';
export { WalletBalanceBadge } from './WalletBalanceBadge';
```

> Task 6 시점에는 `WalletBalanceBadge`가 아직 없으므로, **Step 3c의 마지막 줄(`WalletBalanceBadge` export)은 Task 7에서 추가**한다. Task 6에서는 `BalanceBadge` 두 줄만 작성.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/wallet/__tests__/BalanceBadge.test.tsx`
Expected: PASS (4 tests)

> `PRIMARY_PALETTE`가 `@/constants/colors`에 없으면 `SECONDARY_PALETTE` 대신 임포트 가능한 팔레트로 교체하고 골드 톤(`#D4AF37`)에 가까운 키를 사용. 실행 전 `grep "export const PRIMARY_PALETTE\|export const SECONDARY_PALETTE" src/constants/colors.ts`로 확인.

- [ ] **Step 5: Commit**

```bash
git add src/components/icons/index.tsx src/components/wallet/BalanceBadge.tsx src/components/wallet/index.ts src/components/wallet/__tests__/BalanceBadge.test.tsx
git commit -m "feat(wallet): BalanceBadge 표시 컴포넌트 + GemIcon"
```

---

## Task 7: WalletBalanceBadge (connected)

**Files:**
- Create: `src/components/wallet/WalletBalanceBadge.tsx`
- Modify: `src/components/wallet/index.ts` (export 추가)
- Test: `src/components/wallet/__tests__/WalletBalanceBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/wallet/__tests__/WalletBalanceBadge.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';

const mockUseWalletBalance = jest.fn();
jest.mock('@/hooks/useWalletBalance', () => ({
  useWalletBalance: () => mockUseWalletBalance(),
}));

import { WalletBalanceBadge } from '@/components/wallet/WalletBalanceBadge';

describe('WalletBalanceBadge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('훅 데이터를 BalanceBadge에 전달해 잔액을 표시한다', () => {
    mockUseWalletBalance.mockReturnValue({
      data: {
        heart_balance: 7,
        diamond_balance: 2,
        lifetime_purchased_diamonds: 0,
        expiring_lots: [],
      },
      isLoading: false,
    });

    const { getByText } = render(<WalletBalanceBadge />);
    expect(getByText('7')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('데이터가 없으면 0으로 폴백한다', () => {
    mockUseWalletBalance.mockReturnValue({ data: undefined, isLoading: true });

    const { getAllByText } = render(<WalletBalanceBadge />);
    // isLoading 플레이스홀더 — '—' 2개
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/wallet/__tests__/WalletBalanceBadge.test.tsx`
Expected: FAIL — cannot find module `@/components/wallet/WalletBalanceBadge`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/wallet/WalletBalanceBadge.tsx
/**
 * UNIQN Mobile - WalletBalanceBadge (connected)
 *
 * @description useWalletBalance를 호출해 BalanceBadge에 전달하는 컨테이너.
 *   여러 화면에 배치해도 단일 queryKey라 네트워크 1회로 dedup된다.
 */

import { BalanceBadge, type BalanceBadgeProps } from './BalanceBadge';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { summarizeExpiringHearts } from '@/utils/wallet/expiringHearts';

type WalletBalanceBadgeProps = Pick<BalanceBadgeProps, 'testID'>;

export function WalletBalanceBadge({ testID }: WalletBalanceBadgeProps) {
  const { data, isLoading } = useWalletBalance();
  const expiring = data ? summarizeExpiringHearts(data.expiring_lots, new Date()) : null;

  return (
    <BalanceBadge
      testID={testID}
      heartBalance={data?.heart_balance ?? 0}
      diamondBalance={data?.diamond_balance ?? 0}
      expiring={expiring}
      isLoading={isLoading}
    />
  );
}
```

`src/components/wallet/index.ts`에 export 추가(Task 6에서 보류했던 줄):

```typescript
export { WalletBalanceBadge } from './WalletBalanceBadge';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/wallet/__tests__/WalletBalanceBadge.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/wallet/WalletBalanceBadge.tsx src/components/wallet/index.ts src/components/wallet/__tests__/WalletBalanceBadge.test.tsx
git commit -m "feat(wallet): WalletBalanceBadge connected 컨테이너"
```

---

## Task 8: 화면 배치 (profile + create) + 전체 게이트

**Files:**
- Modify: `app/(app)/(tabs)/profile.tsx`
- Modify: `app/(employer)/my-postings/create.tsx`

> 화면 배치는 통합이라 단위 TDD 대신 import·렌더 스모크 + 타입/품질 게이트로 검증. `WalletBalanceBadge`는 자체 테스트로 동작 보장됨.

- [ ] **Step 1: profile.tsx 배치**

`import { EmployerApplicationStatusBanner } ...` 아래에 추가:

```tsx
import { WalletBalanceBadge } from '@/components/wallet';
```

프로필 정보 `Card`(L143~178, `</Card>` 닫는 지점) 바로 뒤, 메뉴 `Card`(L180) 앞에 지갑 카드 삽입:

```tsx
        <Card className="mb-4">
          <View className="flex-row items-center justify-between py-1">
            <Text className="text-sm font-sans-medium text-secondary-700 dark:text-secondary-300">
              내 지갑
            </Text>
            <WalletBalanceBadge testID="profile-wallet-badge" />
          </View>
        </Card>
```

> `Text`·`View`는 이미 `react-native`에서 import됨(L8-9). `Card`도 import됨(L19).

- [ ] **Step 2: create.tsx 배치**

`import { StackHeader } from '@/components/headers';` 아래에 추가:

```tsx
import { View, Text } from 'react-native';
import { WalletBalanceBadge } from '@/components/wallet';
```

> create.tsx는 현재 `View`/`Text`를 import하지 않으므로 추가. 이미 import 중이면 중복 줄만 제거.

`return (` 내부에서 `StackHeader` 바로 뒤, 폼(`JobPostingScrollForm`) 앞에 잔액 줄 삽입(공고 생성 시 보유 잔액 확인 맥락 — T8에서 여기에 비용 표시가 더해짐):

```tsx
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
            보유 잔액
          </Text>
          <WalletBalanceBadge testID="create-wallet-badge" />
        </View>
```

> 정확한 JSX 삽입 위치는 `StackHeader` 컴포넌트 직후. `grep -n "StackHeader\|JobPostingScrollForm" app/(employer)/my-postings/create.tsx`로 라인 확인 후 그 사이에 삽입.

- [ ] **Step 3: 타입·품질·전체 테스트 게이트**

Run:
```bash
npx tsc --noEmit
npx jest src/types/__tests__/wallet.test.ts src/repositories/supabase/__tests__/WalletRepository.write.test.ts src/services/wallet src/hooks/__tests__/useWalletBalance.test.ts src/utils/wallet src/components/wallet
npm run quality
```
Expected:
- `tsc --noEmit`: 0 errors
- jest: 신규 wallet 스위트 전부 PASS (types 3 + repo 3 + service 5 + hook 3 + util 5 + BalanceBadge 4 + WalletBalanceBadge 2 = 25 tests)
- `npm run quality`: exit 0 (type-check + lint + format:check)

- [ ] **Step 4: 전체 회귀 가드**

Run: `npx jest`
Expected: 기존 스위트 전부 PASS + 신규 25 tests PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/(tabs)/profile.tsx" "app/(employer)/my-postings/create.tsx"
git commit -m "feat(wallet): BalanceBadge 프로필·공고생성 화면 배치"
```

---

## 수동 검증 (배포 전, 선택)

> 무과금이라 prod 영향 없음. 단위/타입 게이트로 충분하나, UI 확인이 필요하면:

- `npm start` → 웹 또는 시뮬레이터에서 로그인 후 **프로필** 화면 → "내 지갑" 카드에 하트/다이아 잔액 노출 확인.
- employer 계정으로 **공고 생성** 진입 → 상단 "보유 잔액" 배지 노출 확인.
- 만료 임박 하트가 있는 계정(또는 `grant_signup` 직후 90일 lot)에서 "N💖 D-X 만료" inline 노출 확인.

---

## Self-Review 결과

**1. 스코프 커버리지:**
- T6(무과금): `claim_daily_attendance` Repository write(Task 2) + walletService(Task 3) ✅. consume/refund는 의도적 제외(T3/T5 후) — 본문 명시 ✅.
- T7: `useWalletBalance` 단일 queryKey(Task 4) ✅ / `BalanceBadge`(Task 6) ✅ / 만료 lot inline(Task 5 유틸 + Task 6 표시) ✅ / 화면 배치(Task 8, 사용자 선택 profile+employer 2곳) ✅.
- 6A 잔액 갱신 단일 queryKey dedup: Task 4 훅 + Task 7 connected로 충족(차감 동기 invalidate 배선은 T8 소관, 키는 준비됨) ✅.

**2. 플레이스홀더 스캔:** TBD/TODO 없음. 모든 코드 블록 완전. 단, Task 6의 `PRIMARY_PALETTE`·Task 8의 정확한 삽입 라인은 실행 시 grep 확인 지시(검증 명령 포함)로 안전장치 처리.

**3. 타입 일관성:**
- `ClaimAttendanceResponse`(Task1) → Repository 반환(Task2) → service가 `ClaimAttendanceResult`로 정규화(Task3) ✅.
- `summarizeExpiringHearts`→`ExpiringHeartSummary`(Task5) → `BalanceBadge.expiring` prop(Task6) → `WalletBalanceBadge`가 생성(Task7) ✅.
- `queryKeys.wallet.summary(uid)`(Task4) 형태 `['wallet','summary',uid|'me']` — 훅 테스트 기대값과 일치 ✅.
- `getWalletSummary`/`claimDailyAttendance` 이름 service(Task3)·배럴(Task3)·훅(Task4) 전부 동일 ✅.

**제외 항목(범위 외, 후속):** consume/refund write(T3/T5 후), 출석 버튼 UI(후속 ⓪), 공고 차감 배선·INSUFFICIENT_BALANCE Paywall(T8), 취소 환불 연결(T9), RevenueCat 충전(T10).
