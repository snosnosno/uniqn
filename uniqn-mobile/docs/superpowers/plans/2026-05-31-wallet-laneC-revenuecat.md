# Wallet Lane C — RevenueCat 다이아 충전 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 다이아 충전 풀사이클(IAP → RevenueCat → 웹훅 → Edge Function → wallet_ledger → 클라 폴링)의 **클라이언트 절반**을 배선한다: SDK 설치·세션·PurchaseSheet·폴링.

**Architecture:** RevenueCat SDK는 네이티브 전용 → `purchasesService.ts`(네이티브) + `purchasesService.web.ts`(웹 스텁) 플랫폼 분리. 세션은 `useRevenueCatSession()`이 인증 시 `configure(appUserID=Supabase UUID)`, 로그아웃 시 `logOut`. 충전은 RC가 **즉시 적립하지 않음**(웹훅 비동기) → 구매 성공 후 `get_wallet_summary`를 1초×10회 폴링해 잔액 증가를 감지(timeout-after "처리 중" UX로 이중결제 차단). PaywallModal `onCharge` + 지갑 카드가 전역 `purchaseSheetStore`로 PurchaseSheet를 연다.

**Tech Stack:** react-native-purchases (Expo 55 autolink, native) / TanStack Query / zustand / Jest. **DB·Edge Function 변경 없음** — 웹훅(223줄)·`credit_diamonds_atomically`·`diamond_products`(6 SKU)는 이미 prod. C는 클라 코드 + jest/tsc만 검증.

**검증 한계 (명시):** 실제 구매 플로우는 **외부 RC 설정**(계정·IAP 6종·webhook secret·SDK 키) + **EAS dev build + sandbox**가 필요 — 별도 세션. 본 plan은 코드를 작성하고 jest(SDK mock)·tsc·web 스텁으로만 검증한다. SDK 키 미설정 시 `isAvailable()=false`로 graceful no-op.

---

## 사전 확인된 백엔드 계약 (prod, 불변)

```
diamond_products SKU (6): uniqn_diamonds_1000(3💎) / _3000(10) / _10000(33+2) / _30000(100+10) / _50000(167+23) / _100000(333+67)
webhook: POST /functions/v1/revenuecat-webhook  (RC Bearer 인증)
  event.app_user_id = Supabase user UUID (UUID_REGEX 검증) → credit_diamonds_atomically(p_user_id=app_user_id)
  멱등키 = event.id → wallet_ledger.revenuecat_transaction_id (UNIQUE)
충전 적립은 웹훅 경유 비동기 → 클라는 get_wallet_summary 폴링으로 잔액 증가 감지
```

`WalletRepository.getSummary()` / `listProducts()` 이미 존재. `useWalletBalance()` 단일 queryKey `queryKeys.wallet.summary(uid)`. `PaywallModal`(B2)에 `onCharge` prop 존재(現 placeholder toast).

---

## File Structure

| 파일                                             | 책임                       | 변경                                        |
| ------------------------------------------------ | -------------------------- | ------------------------------------------- |
| `package.json`                                   | RC 네이티브 의존성         | `react-native-purchases` 추가(expo install) |
| `src/services/purchases/purchasesService.ts`     | RC SDK 래퍼(네이티브)      | 신규                                        |
| `src/services/purchases/purchasesService.web.ts` | 웹 스텁(isAvailable=false) | 신규                                        |
| `src/services/purchases/index.ts`                | 배럴                       | 신규                                        |
| `src/hooks/useRevenueCatSession.ts`              | 인증 연동 configure/logOut | 신규                                        |
| `src/components/app/AuthenticatedRuntime.tsx`    | 세션 훅 마운트             | `useRevenueCatSession()` 1줄 추가           |
| `src/utils/wallet/pollWalletCredit.ts`           | 폴링 helper(순수)          | 신규                                        |
| `src/hooks/usePurchaseDiamonds.ts`               | 구매+폴링 훅               | 신규                                        |
| `src/stores/purchaseSheetStore.ts`               | 전역 open/close(zustand)   | 신규                                        |
| `src/components/wallet/PurchaseSheet.tsx`        | 충전 시트 UI               | 신규                                        |
| `src/components/wallet/index.ts`                 | 배럴                       | PurchaseSheet export                        |
| `app/_layout.tsx` (MainNavigator)                | PurchaseSheet 렌더         | 1줄                                         |
| `app/(employer)/my-postings/create.tsx`          | PaywallModal onCharge      | placeholder→`open()`                        |

> **레이어:** SDK 호출은 `purchasesService`만. 훅/컴포넌트는 service·Repository 경유. 결제 적립은 서버(웹훅) 권위 — 클라는 폴링 표시만.

---

### Task 1: react-native-purchases 설치 + 게이트 확인

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Expo 호환 버전 설치**

Run (from `uniqn-mobile/`): `npx expo install react-native-purchases`
Expected: `react-native-purchases`가 dependencies에 추가됨. (node_modules는 메인 junction 공유 — 메인 repo에도 설치됨, 정상.)

> react-native-purchases는 Expo CNG에서 autolink — **별도 config plugin 불필요**(app.plugin.js 미제공). app.config.ts plugins 변경 없음. 단, 실제 동작은 네이티브 rebuild(EAS dev build) 필요 — 본 세션 범위 밖.

- [ ] **Step 2: 설치가 기존 게이트를 깨지 않는지 확인**

```
npx tsc --noEmit
npx jest src/components/wallet src/services/wallet
```

Expected: tsc exit 0, 기존 wallet 테스트 GREEN. (아직 import 안 했으니 영향 없어야 함.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(wallet): react-native-purchases 설치 (Lane C T10)"
```

> 만약 `npx expo install`이 네트워크/레지스트리 문제로 실패하면 STOP하고 BLOCKED 보고(수동 설치 필요).

---

### Task 2: purchasesService (네이티브 + 웹 스텁)

**Files:**

- Create: `src/services/purchases/purchasesService.ts`, `purchasesService.web.ts`, `index.ts`
- Test: `src/services/purchases/__tests__/purchasesService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/purchases/__tests__/purchasesService.test.ts
const mockConfigure = jest.fn();
const mockLogIn = jest.fn(() => Promise.resolve({ customerInfo: {} }));
const mockLogOut = jest.fn(() => Promise.resolve({}));
const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: (...a: unknown[]) => mockConfigure(...a),
    logIn: (...a: unknown[]) => mockLogIn(...a),
    logOut: (...a: unknown[]) => mockLogOut(...a),
    getOfferings: (...a: unknown[]) => mockGetOfferings(...a),
    purchasePackage: (...a: unknown[]) => mockPurchasePackage(...a),
  },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED' },
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// 키가 있어야 isAvailable=true
process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_testkey';

import { purchasesService } from '../purchasesService';

const UID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  mockConfigure.mockClear();
  mockLogIn.mockClear();
  mockLogOut.mockClear();
  purchasesService.__resetForTest?.();
});

describe('purchasesService (native)', () => {
  it('키가 있으면 isAvailable=true', () => {
    expect(purchasesService.isAvailable()).toBe(true);
  });

  it('최초 configure는 Purchases.configure(appUserID) 호출', async () => {
    await purchasesService.configure(UID);
    expect(mockConfigure).toHaveBeenCalledWith(expect.objectContaining({ appUserID: UID }));
  });

  it('이미 configure된 상태에서 다른 uid면 logIn 호출(중복 configure 금지)', async () => {
    await purchasesService.configure(UID);
    mockConfigure.mockClear();
    await purchasesService.configure('22222222-2222-4222-8222-222222222222');
    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockLogIn).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222');
  });

  it('logOut은 configure된 경우에만 Purchases.logOut 호출', async () => {
    await purchasesService.logOut();
    expect(mockLogOut).not.toHaveBeenCalled();
    await purchasesService.configure(UID);
    await purchasesService.logOut();
    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });

  it('purchase 사용자 취소는 { cancelled:true } 반환(throw 아님)', async () => {
    await purchasesService.configure(UID);
    mockPurchasePackage.mockRejectedValue({ code: 'PURCHASE_CANCELLED' });
    const result = await purchasesService.purchasePackage({ identifier: 'p1' } as never);
    expect(result).toEqual({ cancelled: true });
  });

  it('purchase 성공은 { cancelled:false, productId } 반환', async () => {
    await purchasesService.configure(UID);
    mockPurchasePackage.mockResolvedValue({
      productIdentifier: 'uniqn_diamonds_3000',
      customerInfo: {},
    });
    const result = await purchasesService.purchasePackage({ identifier: 'p1' } as never);
    expect(result).toEqual({ cancelled: false, productId: 'uniqn_diamonds_3000' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/purchases/__tests__/purchasesService.test.ts`
Expected: FAIL — `Cannot find module '../purchasesService'`

- [ ] **Step 3: Implement service**

```typescript
// src/services/purchases/purchasesService.ts
/**
 * UNIQN Mobile - RevenueCat 구매 서비스 (네이티브)
 * @description RC SDK 래퍼. configure 1회 + uid 변경 시 logIn. 키 미설정 시 isAvailable=false.
 *   웹은 purchasesService.web.ts 스텁이 대체(Metro 플랫폼 해상도).
 */
import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { logger } from '@/utils/logger';

export interface PurchaseResult {
  cancelled: boolean;
  productId?: string;
}

function getApiKey(): string {
  return (
    Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      default: undefined,
    }) ?? ''
  );
}

let configured = false;
let currentUid: string | null = null;

export const purchasesService = {
  /** SDK 사용 가능 여부 — 네이티브 + 키 존재. */
  isAvailable(): boolean {
    return getApiKey().length > 0;
  },

  /** 인증 사용자로 SDK 초기화. 최초 1회 configure, 이후 uid 변경은 logIn. 멱등. */
  async configure(appUserID: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      if (!configured) {
        Purchases.configure({ apiKey: getApiKey(), appUserID });
        configured = true;
        currentUid = appUserID;
        logger.info('purchases.configured', { appUserID });
        return;
      }
      if (currentUid !== appUserID) {
        await Purchases.logIn(appUserID);
        currentUid = appUserID;
        logger.info('purchases.loggedIn', { appUserID });
      }
    } catch (error) {
      logger.warn('purchases.configure.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /** 로그아웃 — configure된 경우에만. */
  async logOut(): Promise<void> {
    if (!this.isAvailable() || !configured) return;
    try {
      await Purchases.logOut();
      currentUid = null;
    } catch (error) {
      logger.warn('purchases.logOut.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /** 현재 offering의 다이아 패키지 목록. */
  async getDiamondPackages(): Promise<PurchasesPackage[]> {
    if (!this.isAvailable()) return [];
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  },

  /** 패키지 구매. 사용자 취소는 throw 대신 { cancelled:true }. 그 외 에러는 throw. */
  async purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
    if (!this.isAvailable()) {
      throw new Error('PURCHASES_UNAVAILABLE');
    }
    try {
      const result = await Purchases.purchasePackage(pkg);
      return { cancelled: false, productId: result.productIdentifier };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { cancelled: true };
      }
      throw error;
    }
  },

  /** 테스트 전용 상태 리셋. */
  __resetForTest(): void {
    configured = false;
    currentUid = null;
  },
};
```

```typescript
// src/services/purchases/purchasesService.web.ts
/**
 * UNIQN Mobile - 구매 서비스 웹 스텁
 * @description react-native-purchases는 네이티브 전용. 웹은 모든 메서드 no-op + isAvailable=false.
 */
import { logger } from '@/utils/logger';

export interface PurchaseResult {
  cancelled: boolean;
  productId?: string;
}

export const purchasesService = {
  isAvailable(): boolean {
    return false;
  },
  async configure(_appUserID: string): Promise<void> {
    /* 웹 미지원 */
  },
  async logOut(): Promise<void> {
    /* 웹 미지원 */
  },
  async getDiamondPackages(): Promise<never[]> {
    return [];
  },
  async purchasePackage(): Promise<PurchaseResult> {
    logger.warn('purchases.web.unsupported');
    throw new Error('PURCHASES_UNAVAILABLE');
  },
  __resetForTest(): void {
    /* no-op */
  },
};
```

```typescript
// src/services/purchases/index.ts
export { purchasesService } from './purchasesService';
export type { PurchaseResult } from './purchasesService';
```

> **사전 확인:** `react-native-purchases`의 타입 export 이름이 `PurchasesPackage`인지 확인(`node_modules/react-native-purchases/dist/index.d.ts` 또는 `import type`). 다르면 실제 이름으로 맞춤. `PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR` enum 경로도 확인.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/purchases/__tests__/purchasesService.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: tsc + commit**

```
npx tsc --noEmit   # exit 0
git add src/services/purchases/
git commit -m "feat(wallet): RevenueCat purchasesService + 웹 스텁 (Lane C T10)"
```

---

### Task 3: useRevenueCatSession + AuthenticatedRuntime 연동

**Files:**

- Create: `src/hooks/useRevenueCatSession.ts`
- Modify: `src/components/app/AuthenticatedRuntime.tsx`
- Test: `src/hooks/__tests__/useRevenueCatSession.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/useRevenueCatSession.test.tsx
import { renderHook } from '@testing-library/react-native';

const mockConfigure = jest.fn(() => Promise.resolve());
const mockLogOut = jest.fn(() => Promise.resolve());
jest.mock('@/services/purchases', () => ({
  purchasesService: {
    configure: (...a: unknown[]) => mockConfigure(...a),
    logOut: (...a: unknown[]) => mockLogOut(...a),
  },
}));

let mockUser: { uid: string } | null = { uid: '11111111-1111-4111-8111-111111111111' };
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));

import { useRevenueCatSession } from '../useRevenueCatSession';

beforeEach(() => {
  mockConfigure.mockClear();
  mockLogOut.mockClear();
});

it('인증 사용자가 있으면 configure(uid) 호출', () => {
  mockUser = { uid: '11111111-1111-4111-8111-111111111111' };
  renderHook(() => useRevenueCatSession());
  expect(mockConfigure).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
});

it('언마운트 시 logOut 호출', () => {
  mockUser = { uid: '11111111-1111-4111-8111-111111111111' };
  const { unmount } = renderHook(() => useRevenueCatSession());
  unmount();
  expect(mockLogOut).toHaveBeenCalledTimes(1);
});
```

> **사전 확인:** `useAuthStore`의 셀렉터 시그니처가 `useAuthStore((s) => s.user)`인지 확인(다른 hook들 참고). 위 mock을 실제 사용 형태에 맞춤.

- [ ] **Step 2: Run → FAIL** (`Cannot find module '../useRevenueCatSession'`)

- [ ] **Step 3: Implement**

```typescript
// src/hooks/useRevenueCatSession.ts
/**
 * UNIQN Mobile - useRevenueCatSession
 * @description 인증 사용자 변경에 맞춰 RevenueCat SDK를 configure/logIn하고, 언마운트(로그아웃) 시 logOut.
 *   appUserID = Supabase user UUID(웹훅 app_user_id와 일치해야 함).
 *   웹/키 미설정 환경은 purchasesService가 no-op.
 */
import { useEffect } from 'react';
import { purchasesService } from '@/services/purchases';
import { useAuthStore } from '@/stores/authStore';

export function useRevenueCatSession(): void {
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid;

  useEffect(() => {
    if (uid) {
      void purchasesService.configure(uid);
    }
    return () => {
      void purchasesService.logOut();
    };
  }, [uid]);
}
```

`AuthenticatedRuntime.tsx`에 추가 (import + 호출):

```typescript
import { useRevenueCatSession } from '@/hooks/useRevenueCatSession';
// ...컴포넌트 본문 상단, useNavigationTracking() 근처:
useRevenueCatSession();
```

- [ ] **Step 4: Run → PASS (2 tests)** + `npx tsc --noEmit` exit 0

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRevenueCatSession.ts src/hooks/__tests__/useRevenueCatSession.test.tsx src/components/app/AuthenticatedRuntime.tsx
git commit -m "feat(wallet): RevenueCat 세션 훅 + AuthenticatedRuntime 연동 (Lane C T10)"
```

---

### Task 4: 폴링 helper + usePurchaseDiamonds

**Files:**

- Create: `src/utils/wallet/pollWalletCredit.ts`
- Create: `src/hooks/usePurchaseDiamonds.ts`
- Test: `src/utils/wallet/__tests__/pollWalletCredit.test.ts`

- [ ] **Step 1: Write the failing test (폴링 helper — 순수 로직)**

```typescript
// src/utils/wallet/__tests__/pollWalletCredit.test.ts
import { pollWalletCredit } from '../pollWalletCredit';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('잔액이 baseline 초과로 증가하면 credited:true로 조기 종료', async () => {
  const fetchBalance = jest
    .fn()
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(15);
  const p = pollWalletCredit({ baseline: 5, fetchBalance, intervalMs: 1000, maxAttempts: 10 });
  await jest.advanceTimersByTimeAsync(3000);
  await expect(p).resolves.toEqual({ credited: true, balance: 15 });
  expect(fetchBalance).toHaveBeenCalledTimes(3);
});

it('maxAttempts 내 증가 없으면 credited:false (timeout)', async () => {
  const fetchBalance = jest.fn().mockResolvedValue(5);
  const p = pollWalletCredit({ baseline: 5, fetchBalance, intervalMs: 1000, maxAttempts: 3 });
  await jest.advanceTimersByTimeAsync(3000);
  await expect(p).resolves.toEqual({ credited: false, balance: 5 });
  expect(fetchBalance).toHaveBeenCalledTimes(3);
});

it('연속 2회 fetch 실패 시 조기 종료(credited:false)', async () => {
  const fetchBalance = jest.fn().mockRejectedValue(new Error('net'));
  const p = pollWalletCredit({ baseline: 5, fetchBalance, intervalMs: 1000, maxAttempts: 10 });
  await jest.advanceTimersByTimeAsync(2000);
  await expect(p).resolves.toEqual({ credited: false, balance: 5 });
  expect(fetchBalance).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement helper**

```typescript
// src/utils/wallet/pollWalletCredit.ts
/**
 * UNIQN Mobile - pollWalletCredit
 * @description 충전 적립은 웹훅 비동기 → 잔액이 baseline 초과로 증가할 때까지 폴링.
 *   interval×maxAttempts 내 미증가면 timeout(credited:false). 연속 2회 fetch 실패 시 조기 종료.
 */
export interface PollWalletCreditParams {
  baseline: number;
  fetchBalance: () => Promise<number>;
  intervalMs?: number;
  maxAttempts?: number;
}

export interface PollWalletCreditResult {
  credited: boolean;
  balance: number;
}

export async function pollWalletCredit({
  baseline,
  fetchBalance,
  intervalMs = 1000,
  maxAttempts = 10,
}: PollWalletCreditParams): Promise<PollWalletCreditResult> {
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  let consecutiveFailures = 0;
  let lastBalance = baseline;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(intervalMs);
    try {
      const balance = await fetchBalance();
      consecutiveFailures = 0;
      lastBalance = balance;
      if (balance > baseline) {
        return { credited: true, balance };
      }
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= 2) {
        return { credited: false, balance: lastBalance };
      }
    }
  }
  return { credited: false, balance: lastBalance };
}
```

```typescript
// src/hooks/usePurchaseDiamonds.ts
/**
 * UNIQN Mobile - usePurchaseDiamonds
 * @description 패키지 구매 → 성공 시 wallet 잔액 폴링으로 적립 감지 → 캐시 무효화.
 *   상태: idle | purchasing | processing(폴링) | done | timeout | cancelled | error.
 */
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PurchasesPackage } from 'react-native-purchases';
import { purchasesService } from '@/services/purchases';
import { getWalletSummary } from '@/services/wallet';
import { pollWalletCredit } from '@/utils/wallet/pollWalletCredit';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/utils/logger';

export type PurchaseStatus =
  | 'idle'
  | 'purchasing'
  | 'processing'
  | 'done'
  | 'timeout'
  | 'cancelled'
  | 'error';

export function usePurchaseDiamonds() {
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid);
  const [status, setStatus] = useState<PurchaseStatus>('idle');

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      setStatus('purchasing');
      try {
        const before = await getWalletSummary();
        const baseline = before.diamond_balance;

        const result = await purchasesService.purchasePackage(pkg);
        if (result.cancelled) {
          setStatus('cancelled');
          return;
        }

        // 적립은 웹훅 비동기 → 폴링
        setStatus('processing');
        const poll = await pollWalletCredit({
          baseline,
          fetchBalance: async () => (await getWalletSummary()).diamond_balance,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary(uid) });
        setStatus(poll.credited ? 'done' : 'timeout');
      } catch (error) {
        logger.error('purchaseDiamonds.failed', error as Error);
        setStatus('error');
      }
    },
    [queryClient, uid]
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, purchase, reset };
}
```

- [ ] **Step 4: Run → PASS (3 tests)** + `npx tsc --noEmit` exit 0

- [ ] **Step 5: Commit**

```bash
git add src/utils/wallet/pollWalletCredit.ts "src/utils/wallet/__tests__/pollWalletCredit.test.ts" src/hooks/usePurchaseDiamonds.ts
git commit -m "feat(wallet): 충전 적립 폴링 helper + usePurchaseDiamonds (Lane C T10/D7)"
```

---

### Task 5: purchaseSheetStore + PurchaseSheet

**Files:**

- Create: `src/stores/purchaseSheetStore.ts`
- Create: `src/components/wallet/PurchaseSheet.tsx`
- Modify: `src/components/wallet/index.ts`
- Modify: `app/_layout.tsx` (MainNavigator에 렌더)
- Test: `src/stores/__tests__/purchaseSheetStore.test.ts`, `src/components/wallet/__tests__/PurchaseSheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/stores/__tests__/purchaseSheetStore.test.ts
import { usePurchaseSheetStore } from '../purchaseSheetStore';

it('open/close가 isOpen을 토글한다', () => {
  usePurchaseSheetStore.getState().open();
  expect(usePurchaseSheetStore.getState().isOpen).toBe(true);
  usePurchaseSheetStore.getState().close();
  expect(usePurchaseSheetStore.getState().isOpen).toBe(false);
});
```

```tsx
// src/components/wallet/__tests__/PurchaseSheet.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/hooks/usePurchaseDiamonds', () => ({
  usePurchaseDiamonds: () => ({ status: 'idle', purchase: jest.fn(), reset: jest.fn() }),
}));
jest.mock('@/services/purchases', () => ({
  purchasesService: {
    isAvailable: () => true,
    getDiamondPackages: jest.fn(() => Promise.resolve([])),
  },
}));
jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: {
    listProducts: jest.fn(() =>
      Promise.resolve([
        {
          product_id: 'uniqn_diamonds_3000',
          diamonds: 10,
          bonus_diamonds: 0,
          price_krw: 3000,
          display_order: 2,
          active: true,
        },
      ])
    ),
  },
}));

import { PurchaseSheet } from '../PurchaseSheet';
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';

it('닫힌 상태면 시트 내용 미렌더', () => {
  usePurchaseSheetStore.setState({ isOpen: false });
  const { queryByText } = render(<PurchaseSheet />);
  expect(queryByText(/다이아 충전/)).toBeNull();
});

it('열린 상태면 제목 렌더', () => {
  usePurchaseSheetStore.setState({ isOpen: true });
  const { getByText } = render(<PurchaseSheet />);
  expect(getByText(/다이아 충전/)).toBeTruthy();
});
```

> **사전 확인:** zustand store 패턴은 `src/stores/toastStore.ts` 참고(`create((set) => ...)`). 테스트 wrapper(QueryClientProvider) 필요 시 다른 wallet 컴포넌트 테스트 패턴 따름. `@tanstack/react-query`가 jest.setup에서 전역 mock되면 PurchaseSheet의 useQuery가 stub일 수 있음 — 필요 시 `jest.requireActual` 처리.

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement store + sheet**

```typescript
// src/stores/purchaseSheetStore.ts
/**
 * UNIQN Mobile - purchaseSheetStore
 * @description 전역 다이아 충전 시트 open/close. PaywallModal·지갑 카드 등 어디서든 open() 호출.
 */
import { create } from 'zustand';

interface PurchaseSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const usePurchaseSheetStore = create<PurchaseSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

```tsx
// src/components/wallet/PurchaseSheet.tsx
/**
 * UNIQN Mobile - PurchaseSheet
 * @description 다이아 충전 시트. RC 패키지(가격)+DB 제품(다이아량) 병합 표시 → 구매 → 폴링.
 *   웹/키 미설정 시 "모바일 앱에서 충전 가능" 안내. 폴링 중 "처리 중"으로 이중탭 차단.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { PurchasesPackage } from 'react-native-purchases';
import { Modal } from '@/components/ui';
import { purchasesService } from '@/services/purchases';
import { WalletRepository } from '@/repositories/supabase/WalletRepository';
import { usePurchaseDiamonds } from '@/hooks/usePurchaseDiamonds';
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';
import { queryKeys } from '@/lib/queryClient';

export function PurchaseSheet() {
  const isOpen = usePurchaseSheetStore((s) => s.isOpen);
  const close = usePurchaseSheetStore((s) => s.close);
  const available = purchasesService.isAvailable();
  const { status, purchase, reset } = usePurchaseDiamonds();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  const productsQuery = useQuery({
    queryKey: queryKeys.wallet.all.concat('products'),
    queryFn: () => WalletRepository.listProducts(),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen || !available) return;
    let active = true;
    purchasesService.getDiamondPackages().then((p) => {
      if (active) setPackages(p);
    });
    return () => {
      active = false;
    };
  }, [isOpen, available]);

  const busy = status === 'purchasing' || status === 'processing';

  const handleClose = () => {
    if (busy) return; // 폴링 중 닫기 차단(이중결제 방지)
    reset();
    close();
  };

  // product_id → 다이아량 매핑(표시는 DB 신뢰, 가격은 RC priceString)
  const productMap = useMemo(() => {
    const map = new Map<string, { diamonds: number; bonus: number; priceKrw: number }>();
    for (const p of productsQuery.data ?? []) {
      map.set(p.product_id, {
        diamonds: p.diamonds,
        bonus: p.bonus_diamonds,
        priceKrw: p.price_krw,
      });
    }
    return map;
  }, [productsQuery.data]);

  return (
    <Modal visible={isOpen} onClose={handleClose} title="다이아 충전" position="bottom">
      {!available ? (
        <View className="py-6">
          <Text className="text-center font-sans text-content-primary dark:text-secondary-100">
            다이아 충전은 모바일 앱에서 가능해요.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {(productsQuery.data ?? []).map((product) => {
            const meta = productMap.get(product.product_id);
            const pkg = packages.find((p) => p.product?.identifier === product.product_id);
            const total = (meta?.diamonds ?? 0) + (meta?.bonus ?? 0);
            return (
              <Pressable
                key={product.product_id}
                testID={`purchase-${product.product_id}`}
                disabled={busy || !pkg}
                onPress={() => pkg && purchase(pkg)}
                className="flex-row items-center justify-between rounded-md bg-surface-card px-4 py-3 dark:bg-secondary-800"
              >
                <Text className="font-sans-semibold text-content-primary dark:text-secondary-100">
                  💎 {total}
                </Text>
                <Text className="font-sans text-secondary-500 dark:text-secondary-400">
                  {pkg?.product?.priceString ?? `${meta?.priceKrw ?? 0}원`}
                </Text>
              </Pressable>
            );
          })}

          {busy ? (
            <View className="mt-2 flex-row items-center justify-center gap-2 py-2">
              <ActivityIndicator />
              <Text className="font-sans text-secondary-500 dark:text-secondary-400">
                {status === 'processing' ? '충전 처리 중이에요…' : '결제 진행 중…'}
              </Text>
            </View>
          ) : null}
          {status === 'done' ? (
            <Text className="mt-2 text-center font-sans-semibold text-success-600">
              충전이 완료됐어요!
            </Text>
          ) : null}
          {status === 'timeout' ? (
            <Text className="mt-2 text-center font-sans text-secondary-500 dark:text-secondary-400">
              충전 반영이 지연되고 있어요. 잠시 후 잔액을 확인해주세요.
            </Text>
          ) : null}
          {status === 'error' ? (
            <Text className="mt-2 text-center font-sans text-error-600">
              결제 중 문제가 발생했어요.
            </Text>
          ) : null}
        </View>
      )}
    </Modal>
  );
}
```

`src/components/wallet/index.ts`에 추가:

```typescript
export { PurchaseSheet } from './PurchaseSheet';
```

`app/_layout.tsx` MainNavigator의 `<ModalManager />` 아래에 추가 (import 포함):

```tsx
import { PurchaseSheet } from '@/components/wallet';
// ...JSX, <ModalManager /> 다음 줄:
<PurchaseSheet />;
```

> **사전 확인:** `success-600` 토큰 존재 여부 grep(없으면 인접 success 토큰). `PurchasesPackage`의 `product.identifier`/`product.priceString` 필드명 확인(RC 타입). `queryKeys.wallet.all.concat('products')`가 타입상 허용되는지 — 안되면 `[...queryKeys.wallet.all, 'products']`.

- [ ] **Step 4: Run → PASS** + `npx tsc --noEmit` exit 0

- [ ] **Step 5: Commit**

```bash
git add src/stores/purchaseSheetStore.ts "src/stores/__tests__/purchaseSheetStore.test.ts" src/components/wallet/PurchaseSheet.tsx "src/components/wallet/__tests__/PurchaseSheet.test.tsx" src/components/wallet/index.ts app/_layout.tsx
git commit -m "feat(wallet): PurchaseSheet 충전 시트 + 전역 store + 루트 렌더 (Lane C T10)"
```

---

### Task 6: PaywallModal onCharge → PurchaseSheet 연결

**Files:** `app/(employer)/my-postings/create.tsx`

- [ ] **Step 1: placeholder toast를 store.open()으로 교체**

import 추가:

```typescript
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';
```

컴포넌트 본문:

```typescript
const openPurchaseSheet = usePurchaseSheetStore((s) => s.open);
```

PaywallModal의 `onCharge` 교체:

```tsx
        onCharge={() => {
          setShowPaywall(false);
          openPurchaseSheet();
        }}
```

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add "app/(employer)/my-postings/create.tsx"
git commit -m "feat(wallet): PaywallModal 충전 CTA → PurchaseSheet 연결 (Lane C T10)"
```

---

### Task 7: 전체 게이트

- [ ] **Step 1:** `npx jest purchases PurchaseSheet pollWalletCredit useRevenueCatSession purchaseSheetStore` → 전체 PASS
- [ ] **Step 2:** `npx jest 2>&1 | tail -10` (전체 스위트), `npx tsc --noEmit` (exit 0), `npm run quality` (exit 0)
- [ ] **Step 3:** web 번들 무결성 — `purchasesService.web.ts`가 react-native-purchases를 import하지 않음을 확인(grep). 웹에서 네이티브 모듈 import 0건이어야 함.

---

## Self-Review

**Spec coverage:** SDK 설치(T1) / service+웹스텁(T2) / 세션(T3) / 폴링+구매훅(T4, D7) / PurchaseSheet+store+루트(T5) / paywall 연결(T6) / 게이트(T7). 모두 매핑.

**검증 한계 명시:** 실제 IAP/sandbox는 외부 RC 설정 + EAS dev build 후 별도 세션. 본 plan은 SDK mock jest + tsc + web 스텁만.

**알려진 확인 의존(실행 시 grep):** react-native-purchases 타입 export(`PurchasesPackage`, `PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR`, `product.identifier/priceString`) / `useAuthStore` 셀렉터 형태 / zustand `create` import / `success-600` 토큰 / jest.setup의 react-query 전역 mock 여부.

**스코프 밖:** Lane D(featured/extend). 외부 RC 설정(사용자). sandbox 검증(별도 세션).
