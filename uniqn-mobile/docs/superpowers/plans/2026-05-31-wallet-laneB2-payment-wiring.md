# Wallet Lane B2 — 차감/환불 배선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고 생성/취소 경로를 이미 prod에 적용된 결제 RPC(`create_job_posting_with_payment_atomically` / `refund_job_cancellation_atomically`)에 연결하고, 잔액 부족 시 PaywallModal을 노출한다.

**Architecture:** 결제·환불 RPC 호출은 wallet 도메인 SSOT인 `WalletRepository`가 소유한다. `JobPostingRepository`의 create/delete 트랜잭션이 이를 orchestrate한다(클라 생성 UUID를 멱등키로 payload에 유지). 잔액 부족(`INSUFFICIENT_BALANCE`)은 boundary에서 `BusinessError(BUSINESS_INSUFFICIENT_BALANCE)`로 매핑되어 create 화면이 PaywallModal을 띄운다. 환불은 취소 트랜잭션 직후 best-effort로 호출(실패는 로깅, 취소는 항상 성립). **flag off → 서버 cost=0 → 차감 0 → 무료 게시 동등(R1)**.

**Tech Stack:** React Native 0.83 / Expo 55 / TanStack Query / Supabase RPC(plpgsql) / Zod / Jest. **DB 변경 없음** — RPC는 Lane A에서 이미 prod 적용·pgTAP 139 통과. B2는 순수 클라이언트 TDD.

**Gate (CRITICAL):** R1 회귀 — flag off일 때 create 경로가 결제 RPC에 넘기는 payload가 legacy 직접 INSERT가 넘기던 snake_case 필드와 동등(+ 멱등 id)함을 jest로 실측 증명. 이 가드 GREEN 전 master 머지/배포 금지.

---

## File Structure

| 파일                                                | 책임                            | 변경                                             |
| --------------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| `src/types/wallet.ts`                               | 결제/환불 RPC 응답 Zod 스키마   | CreatePostingPayment/Refund 스키마 추가          |
| `src/errors/AppError.ts`                            | 에러 코드 + 메시지              | `BUSINESS_INSUFFICIENT_BALANCE` 코드/메시지 추가 |
| `src/repositories/supabase/WalletRepository.ts`     | 결제/환불 RPC 호출(wallet SSOT) | write 메서드 2종 추가                            |
| `src/repositories/supabase/JobPostingRepository.ts` | 공고 create/delete 트랜잭션     | create→결제RPC, delete→환불 연결                 |
| `src/components/wallet/PaywallModal.tsx`            | 잔액 부족 안내 모달             | 신규                                             |
| `src/hooks/useJobManagement.ts`                     | create mutation                 | 잔액부족 토스트 억제 + wallet 캐시 무효화(6A)    |
| `app/(employer)/my-postings/create.tsx`             | 공고 작성 화면                  | 잔액부족→PaywallModal                            |
| `app/(employer)/my-postings/[id]/index.tsx`         | 공고 상세/삭제                  | 취소 다이얼로그 환불 사전고지(4A)                |

> **레이어 주의(CLAUDE.md):** RPC 호출은 Repository만. `JobPostingRepository`가 `WalletRepository`(peer data-layer)를 호출하는 것은 허용 — 결제/환불 RPC가 wallet 도메인 SSOT이고 create는 그 payload만 제공한다. Presentation/Hooks는 절대 supabase 직접 호출 금지.

---

## 사전 확인된 RPC 계약 (Lane A, prod 적용·types 재생성됨)

```
create_job_posting_with_payment_atomically(
  p_owner_id UUID, p_posting_payload JSONB, p_reason wallet_reason DEFAULT 'consume_job_posting'
) RETURNS JSONB
  -- 신규 삽입: { success:true, posting_id, diamonds_consumed, hearts_consumed, total_consumed }
  -- 재시도(멱등): { success:true, posting_id, idempotent:true, diamonds_consumed:0, hearts_consumed:0, total_consumed:0 }
  -- 잔액부족: RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %h+%d, need %' → supabase error.message에 포함
  -- payload.id가 있으면 멱등키로 사용(ON CONFLICT (id) DO NOTHING)

refund_job_cancellation_atomically(p_posting_id UUID, p_owner_id UUID) RETURNS JSONB
  -- 성공: { success:true, refunded_diamonds, refund_rate, hours_elapsed, original_diamond, original_heart }
  -- 멱등: { success:true, idempotent:true }
  -- 무차감/권한밖/인자오류: { success:false, error:'no_consumption_found'|'unauthorized'|'invalid_args' }  (RAISE 아님 — RETURN)
  -- caller(auth.uid())가 owner 또는 JPC 협업자일 때 통과, 환불은 항상 owner 지갑에 적립
```

`src/types/supabase.ts`는 이미 3-arg create / 2-arg get_posting_cost / refund 반영됨(재생성 불필요).

---

### Task 1: 결제/환불 RPC 응답 Zod 스키마

**Files:**

- Modify: `src/types/wallet.ts` (파일 끝에 append)
- Test: `src/types/__tests__/walletPaymentSchemas.test.ts` (신규)

- [ ] **Step 1: Write the failing test**

```typescript
// src/types/__tests__/walletPaymentSchemas.test.ts
import { CreatePostingPaymentResultSchema, RefundResultSchema } from '@/types/wallet';

describe('CreatePostingPaymentResultSchema', () => {
  it('신규 삽입 응답을 파싱한다', () => {
    const parsed = CreatePostingPaymentResultSchema.parse({
      success: true,
      posting_id: '11111111-1111-4111-8111-111111111111',
      diamonds_consumed: 10,
      hearts_consumed: 0,
      total_consumed: 10,
    });
    expect(parsed.posting_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(parsed.total_consumed).toBe(10);
  });

  it('멱등 재시도 응답(idempotent:true)을 파싱한다', () => {
    const parsed = CreatePostingPaymentResultSchema.parse({
      success: true,
      posting_id: '22222222-2222-4222-8222-222222222222',
      idempotent: true,
      diamonds_consumed: 0,
      hearts_consumed: 0,
      total_consumed: 0,
    });
    expect(parsed.idempotent).toBe(true);
  });

  it('consumed 카운트 누락 시 0으로 기본값', () => {
    const parsed = CreatePostingPaymentResultSchema.parse({
      success: true,
      posting_id: '33333333-3333-4333-8333-333333333333',
    });
    expect(parsed.total_consumed).toBe(0);
  });
});

describe('RefundResultSchema', () => {
  it('환불 성공 응답을 파싱한다', () => {
    const parsed = RefundResultSchema.parse({
      success: true,
      refunded_diamonds: 5,
      refund_rate: 1.0,
      hours_elapsed: 3.2,
      original_diamond: 5,
      original_heart: 0,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.refunded_diamonds).toBe(5);
  });

  it('무차감 응답(success:false)을 파싱한다', () => {
    const parsed = RefundResultSchema.parse({ success: false, error: 'no_consumption_found' });
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('no_consumption_found');
  });

  it('멱등 응답(idempotent)을 파싱한다', () => {
    const parsed = RefundResultSchema.parse({ success: true, idempotent: true });
    expect(parsed.idempotent).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/types/__tests__/walletPaymentSchemas.test.ts`
Expected: FAIL — `CreatePostingPaymentResultSchema is not exported`

- [ ] **Step 3: Append schemas to `src/types/wallet.ts`**

```typescript
// ============================================================================
// create_job_posting_with_payment_atomically RPC 응답 (Lane B2)
// ============================================================================

export const CreatePostingPaymentResultSchema = z.object({
  success: z.literal(true),
  posting_id: z.string().uuid(),
  idempotent: z.boolean().optional(),
  diamonds_consumed: z.number().int().nonnegative().default(0),
  hearts_consumed: z.number().int().nonnegative().default(0),
  total_consumed: z.number().int().nonnegative().default(0),
});
export type CreatePostingPaymentResult = z.infer<typeof CreatePostingPaymentResultSchema>;

// ============================================================================
// refund_job_cancellation_atomically RPC 응답 (Lane B2)
// ============================================================================

const RefundSuccessSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean().optional(),
  refunded_diamonds: z.number().int().nonnegative().optional(),
  refund_rate: z.number().optional(),
  hours_elapsed: z.number().optional(),
  original_diamond: z.number().int().optional(),
  original_heart: z.number().int().optional(),
});

const RefundFailureSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export const RefundResultSchema = z.union([RefundSuccessSchema, RefundFailureSchema]);
export type RefundResult = z.infer<typeof RefundResultSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/types/__tests__/walletPaymentSchemas.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/types/wallet.ts src/types/__tests__/walletPaymentSchemas.test.ts
git commit -m "feat(wallet): 결제/환불 RPC 응답 Zod 스키마 (B2 T6)"
```

---

### Task 2: WalletRepository 결제/환불 write 메서드

**Files:**

- Modify: `src/repositories/supabase/WalletRepository.ts`
- Test: `src/repositories/supabase/__tests__/WalletRepository.write.test.ts` (신규)

- [ ] **Step 1: Write the failing test**

```typescript
// src/repositories/supabase/__tests__/WalletRepository.write.test.ts
import { WalletRepository } from '../WalletRepository';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const POSTING = '22222222-2222-4222-8222-222222222222';

beforeEach(() => mockRpc.mockReset());

describe('WalletRepository.createJobPostingWithPayment', () => {
  it('결제 RPC를 (p_owner_id, p_posting_payload, p_reason)로 호출하고 결과를 파싱한다', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        posting_id: POSTING,
        diamonds_consumed: 0,
        hearts_consumed: 0,
        total_consumed: 0,
      },
      error: null,
    });
    const payload = { id: POSTING, title: 't', posting_type: 'regular' };

    const result = await WalletRepository.createJobPostingWithPayment(
      OWNER,
      payload,
      'consume_job_posting'
    );

    expect(mockRpc).toHaveBeenCalledWith('create_job_posting_with_payment_atomically', {
      p_owner_id: OWNER,
      p_posting_payload: payload,
      p_reason: 'consume_job_posting',
    });
    expect(result.posting_id).toBe(POSTING);
  });

  it('reason 미지정 시 consume_job_posting 기본값', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, posting_id: POSTING }, error: null });
    await WalletRepository.createJobPostingWithPayment(OWNER, { id: POSTING });
    expect(mockRpc).toHaveBeenCalledWith(
      'create_job_posting_with_payment_atomically',
      expect.objectContaining({ p_reason: 'consume_job_posting' })
    );
  });

  it('RPC 에러를 그대로 throw한다 (호출자가 INSUFFICIENT_BALANCE 매핑)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'INSUFFICIENT_BALANCE: have 0h+0d, need 10' },
    });
    await expect(
      WalletRepository.createJobPostingWithPayment(OWNER, { id: POSTING })
    ).rejects.toMatchObject({
      message: expect.stringContaining('INSUFFICIENT_BALANCE'),
    });
  });
});

describe('WalletRepository.refundJobCancellation', () => {
  it('환불 RPC를 (p_posting_id, p_owner_id)로 호출하고 결과를 파싱한다', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        refunded_diamonds: 5,
        refund_rate: 1,
        hours_elapsed: 2,
        original_diamond: 5,
        original_heart: 0,
      },
      error: null,
    });

    const result = await WalletRepository.refundJobCancellation(POSTING, OWNER);

    expect(mockRpc).toHaveBeenCalledWith('refund_job_cancellation_atomically', {
      p_posting_id: POSTING,
      p_owner_id: OWNER,
    });
    expect(result.success).toBe(true);
  });

  it('success:false 응답(무차감)도 throw 없이 파싱해 반환', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'no_consumption_found' },
      error: null,
    });
    const result = await WalletRepository.refundJobCancellation(POSTING, OWNER);
    expect(result).toEqual({ success: false, error: 'no_consumption_found' });
  });

  it('RPC transport 에러는 throw', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await expect(WalletRepository.refundJobCancellation(POSTING, OWNER)).rejects.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/repositories/supabase/__tests__/WalletRepository.write.test.ts`
Expected: FAIL — `createJobPostingWithPayment is not a function`

- [ ] **Step 3: Add write methods to WalletRepository**

`src/repositories/supabase/WalletRepository.ts` 상단 import에 추가:

```typescript
import {
  DiamondProductSchema,
  WalletSummarySchema,
  ClaimAttendanceResponseSchema,
  PostingCostSchema,
  CreatePostingPaymentResultSchema,
  RefundResultSchema,
  type DiamondProduct,
  type WalletSummary,
  type ClaimAttendanceResponse,
  type PostingCost,
  type CreatePostingPaymentResult,
  type RefundResult,
  type WalletReason,
} from '@/types/wallet';
```

`export const WalletRepository = {` 객체에 `getPostingCost` 뒤에 추가(마지막 콤마 유지):

```typescript
  /**
   * 공고 생성 + 서버 권위 비용 차감을 단일 트랜잭션으로 (결제 RPC).
   *
   * @param ownerId 비용 주체(워크스페이스 owner) user_id
   * @param payload snake_case job_postings payload. **payload.id를 멱등키로 유지할 것.**
   * @param reason 차감 사유 (기본 consume_job_posting)
   * @returns posting_id + 차감량. flag off면 cost=0 → 차감 0.
   * @throws Supabase RPC 에러 그대로 throw — 호출자가 INSUFFICIENT_BALANCE를 매핑.
   */
  async createJobPostingWithPayment(
    ownerId: string,
    payload: Record<string, unknown>,
    reason: WalletReason = 'consume_job_posting'
  ): Promise<CreatePostingPaymentResult> {
    const { data, error } = await supabase.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: ownerId,
      p_posting_payload: payload,
      p_reason: reason,
    });
    if (error) {
      logger.error('wallet.createJobPostingWithPayment.failed', error, { ownerId });
      throw error;
    }
    return CreatePostingPaymentResultSchema.parse(data);
  },

  /**
   * 공고 취소 환불 (24h 100% / 이후 50%). 환불은 항상 owner 지갑에 적립.
   *
   * @param postingId 취소된 공고 id
   * @param ownerId 비용 주체(owner) user_id — caller가 owner 또는 협업자여야 통과.
   * @returns success + 환불량. 무차감/권한밖이면 success:false (throw 아님).
   * @throws Supabase transport 에러만 throw.
   */
  async refundJobCancellation(postingId: string, ownerId: string): Promise<RefundResult> {
    const { data, error } = await supabase.rpc('refund_job_cancellation_atomically', {
      p_posting_id: postingId,
      p_owner_id: ownerId,
    });
    if (error) {
      logger.error('wallet.refundJobCancellation.failed', error, { postingId });
      throw error;
    }
    return RefundResultSchema.parse(data);
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/repositories/supabase/__tests__/WalletRepository.write.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/repositories/supabase/WalletRepository.ts src/repositories/supabase/__tests__/WalletRepository.write.test.ts
git commit -m "feat(wallet): WalletRepository 결제/환불 RPC write 메서드 (B2 T6)"
```

---

### Task 3: BUSINESS_INSUFFICIENT_BALANCE 에러 코드

**Files:**

- Modify: `src/errors/AppError.ts` (ERROR_CODES enum + USER_MESSAGES 맵)
- Test: `src/errors/__tests__/insufficientBalance.test.ts` (신규)

- [ ] **Step 1: Write the failing test**

```typescript
// src/errors/__tests__/insufficientBalance.test.ts
import { ERROR_CODES, ERROR_MESSAGES, BusinessError } from '@/errors/AppError';

describe('BUSINESS_INSUFFICIENT_BALANCE', () => {
  it('코드가 정의되어 있다', () => {
    expect(ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE).toBe('E6080');
  });

  it('ERROR_MESSAGES 맵에 메시지가 등록돼 있다', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE]).toContain('잔액');
  });

  it('userMessage 없이 BusinessError 생성 시 맵 메시지로 채워진다', () => {
    const err = new BusinessError(ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE);
    expect(err.userMessage).toContain('잔액');
  });
});
```

> **확인됨:** 사용자 메시지 맵은 `ERROR_MESSAGES`(`AppError.ts:183`). `getUserMessage` 함수는 없음 — `BusinessError(code)`가 `ERROR_MESSAGES[code]`로 `userMessage`를 채운다(`:309-310`). `BusinessError`/`ERROR_MESSAGES`가 `@/errors/AppError`에서 export되는지 확인(되어 있음).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/errors/__tests__/insufficientBalance.test.ts`
Expected: FAIL — `BUSINESS_INSUFFICIENT_BALANCE` undefined

- [ ] **Step 3: Add code + message**

`src/errors/AppError.ts` ERROR_CODES에서 `BUSINESS_EMPLOYER_APP_NOT_FOUND: 'E6073',` 다음 줄에 추가:

```typescript
  // 결제/지갑 (E608x)
  BUSINESS_INSUFFICIENT_BALANCE: 'E6080',
```

`ERROR_MESSAGES` 맵(`AppError.ts:183`, business 섹션 끝)에 추가:

```typescript
  [ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE]: '하트/다이아 잔액이 부족해요. 충전 후 다시 시도해주세요',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/errors/__tests__/insufficientBalance.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/errors/AppError.ts src/errors/__tests__/insufficientBalance.test.ts
git commit -m "feat(wallet): BUSINESS_INSUFFICIENT_BALANCE 에러 코드 (B2 T8)"
```

---

### Task 4: createWithTransaction → 결제 RPC 전환 (T8 핵심 + R1 게이트)

**Files:**

- Modify: `src/repositories/supabase/JobPostingRepository.ts:330-374`
- Test: `src/repositories/supabase/__tests__/JobPostingRepository.create.payment.test.ts` (신규)

- [ ] **Step 1: Write the failing test (R1 회귀 가드 + INSUFFICIENT_BALANCE)**

```typescript
// src/repositories/supabase/__tests__/JobPostingRepository.create.payment.test.ts
import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import { isAppError } from '@/errors';
import { ERROR_CODES } from '@/errors/AppError';

const mockCreatePayment = jest.fn();
jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: {
    createJobPostingWithPayment: (...args: unknown[]) => mockCreatePayment(...args),
  },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn() },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

const OWNER = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '66666666-6666-4666-8666-666666666666';
const NEW_ID = '99999999-9999-4999-8999-999999999999';

const input = {
  title: '강남 홀덤펍 딜러 모집',
  postingType: 'regular' as const,
  location: { name: '강남' },
  schedule: {
    kind: 'dated' as const,
    primaryDate: '2026-06-10',
    allDates: ['2026-06-10'],
    requirements: [
      {
        date: '2026-06-10',
        timeSlots: [{ start: '18:00', end: '23:00', roles: [{ role: 'dealer', count: 2 }] }],
      },
    ],
  },
  roleCatalog: [{ role: 'dealer' }],
  compensation: { mode: 'shared' as const },
  questions: { items: [] },
} as never;

const context = { ownerId: OWNER, ownerName: 'Owner', workspaceId: WORKSPACE };

beforeEach(() => mockCreatePayment.mockReset());

describe('createWithTransaction → 결제 RPC (R1: flag off 무료게시 동등)', () => {
  const repo = new SupabaseJobPostingRepository();

  it('legacy INSERT가 넘기던 snake_case 필드 + 멱등 id를 payload로 결제 RPC 호출', async () => {
    mockCreatePayment.mockResolvedValue({
      success: true,
      posting_id: NEW_ID,
      diamonds_consumed: 0,
      hearts_consumed: 0,
      total_consumed: 0,
    });

    const result = await repo.createWithTransaction(input, context);

    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
    const [ownerArg, payload, reason] = mockCreatePayment.mock.calls[0];
    expect(ownerArg).toBe(OWNER);
    expect(reason).toBe('consume_job_posting');

    // R1: legacy 직접 INSERT가 넘기던 핵심 snake_case 필드가 모두 보존돼야 함
    expect(payload.title).toBe('강남 홀덤펍 딜러 모집');
    expect(payload.owner_id).toBe(OWNER);
    expect(payload.workspace_id).toBe(WORKSPACE);
    expect(payload.posting_type).toBe('regular');
    expect(payload.schema_version).toBe(3);
    expect(payload.status).toBe('active');
    expect(payload.schedule).toBeDefined();
    expect(payload.role_catalog).toBeDefined();
    expect(payload.stats).toBeDefined();
    expect(payload.total_positions).toBeDefined();

    // 멱등키: 클라 생성 UUID가 payload.id로 유지 (legacy는 id를 제거했음 — 회귀 차단)
    expect(payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    // payload에 undefined 값이 없어야 함 (removeUndefined 적용)
    expect(Object.values(payload).some((v) => v === undefined)).toBe(false);

    // 반환 id는 RPC의 posting_id를 사용
    expect(result.id).toBe(NEW_ID);
    expect(result.jobPosting.id).toBe(NEW_ID);
  });

  it('payload.id와 결제 RPC posting_id가 동일 (멱등키 round-trip)', async () => {
    mockCreatePayment.mockImplementation((_o: string, payload: { id: string }) =>
      Promise.resolve({
        success: true,
        posting_id: payload.id,
        diamonds_consumed: 0,
        hearts_consumed: 0,
        total_consumed: 0,
      })
    );
    const result = await repo.createWithTransaction(input, context);
    const payload = mockCreatePayment.mock.calls[0][1];
    expect(result.id).toBe(payload.id);
  });

  it('INSUFFICIENT_BALANCE 에러를 BusinessError(BUSINESS_INSUFFICIENT_BALANCE)로 매핑', async () => {
    mockCreatePayment.mockRejectedValue(new Error('INSUFFICIENT_BALANCE: have 0h+0d, need 10'));

    await expect(repo.createWithTransaction(input, context)).rejects.toSatisfy((e: unknown) => {
      return (
        isAppError(e) && (e as { code: string }).code === ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE
      );
    });
  });
});
```

> `toSatisfy`가 없으면(jest matcher 미설치) 아래로 대체:
>
> ```typescript
> await expect(repo.createWithTransaction(input, context)).rejects.toMatchObject({
>   code: ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE,
> });
> ```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/repositories/supabase/__tests__/JobPostingRepository.create.payment.test.ts`
Expected: FAIL — createWithTransaction still calls `supabase.from().insert()` (mockCreatePayment 0 calls)

- [ ] **Step 3: Rewrite createWithTransaction (`:330-374`)**

상단 import에 `generateUUID`와 `WalletRepository`, `isInsufficientBalanceError` 추가:

```typescript
import { generateUUID } from '@/utils/generateId';
import { WalletRepository } from '@/repositories/supabase/WalletRepository';
```

(`BusinessError`, `ERROR_CODES`는 이미 import됨 — 확인. 없으면 `import { BusinessError, ERROR_CODES } from '@/errors';` 추가.)

메서드 본문 교체:

```typescript
  async createWithTransaction(
    input: CreateJobPostingInput,
    context: CreateJobPostingContext
  ): Promise<CreateJobPostingResult> {
    try {
      logger.info('공고 생성', { ownerId: context.ownerId, title: input.title });
      const now = new Date();
      // 클라 생성 UUID — 결제 RPC의 멱등키(ON CONFLICT id)로 사용해 재시도 이중과금 방지
      const postingId = generateUUID();
      const current: Partial<JobPosting> = {
        id: postingId,
        viewCount: 0,
        filledPositions: 0,
        stats: createInitialPostingStats(input.schedule),
        ...(input.postingType === 'tournament'
          ? { tournamentConfig: { approvalStatus: STATUS.TOURNAMENT.PENDING, submittedAt: now } }
          : {}),
      };

      const serialized = serializeJobPostingV3(input, {
        ownerId: context.ownerId,
        ownerName: context.ownerName,
        workspaceId: context.workspaceId,
        status: STATUS.JOB_POSTING.ACTIVE,
        current,
        createdAt: now,
        updatedAt: now,
      });
      const jobPosting = assertCanonical(
        serialized,
        'Created job posting does not satisfy the canonical contract.',
        { ownerId: context.ownerId, title: input.title }
      );

      // 멱등 id를 payload에 유지(legacy는 제거했음) → 결제 RPC가 ON CONFLICT (id)로 멱등
      const snakeData = toSnakeCase(
        removeUndefined(serialized as unknown as Record<string, unknown>)
      );

      let result;
      try {
        result = await WalletRepository.createJobPostingWithPayment(
          context.ownerId,
          snakeData,
          'consume_job_posting'
        );
      } catch (rpcError) {
        if (rpcError instanceof Error && rpcError.message.includes('INSUFFICIENT_BALANCE')) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE, {
            userMessage: '하트/다이아 잔액이 부족해요. 충전 후 다시 시도해주세요.',
            metadata: { ownerId: context.ownerId },
          });
        }
        throw rpcError;
      }

      const newId = result.posting_id;
      logger.info('공고 생성 완료', { id: newId, consumed: result.total_consumed });
      return { id: newId, jobPosting: { ...jobPosting, id: newId } };
    } catch (error) {
      rethrowOrHandle(error, '공고 생성', { ownerId: context.ownerId });
    }
  }
```

> `createInitialPostingStats`, `STATUS`, `assertCanonical`, `serializeJobPostingV3`, `toSnakeCase`, `removeUndefined`, `rethrowOrHandle`은 기존 import 유지. **`from(TABLE).insert` 호출은 완전 제거** — `supabase` import가 더 이상 create에서 쓰이지 않아도 다른 메서드(update/close 등)가 쓰므로 import는 유지.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/repositories/supabase/__tests__/JobPostingRepository.create.payment.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Red-Green R1 회귀 검증 (증거 기록)**

기존 create 관련 회귀 스위트도 함께 GREEN인지 확인:
Run: `npx jest src/repositories/supabase/__tests__/JobPostingRepository`
Expected: 전체 PASS. R1 가드(payload 동등 + 멱등 id) 캡처 출력을 PR 증거로 사용.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/supabase/JobPostingRepository.ts src/repositories/supabase/__tests__/JobPostingRepository.create.payment.test.ts
git commit -m "feat(wallet): 공고 생성 결제 RPC 전환 + 잔액부족 매핑 (B2 T8, R1 가드)"
```

---

### Task 5: deleteWithTransaction → 환불 연결 (T9)

**Files:**

- Modify: `src/repositories/supabase/JobPostingRepository.ts:423-441`
- Test: `src/repositories/supabase/__tests__/JobPostingRepository.delete.refund.test.ts` (신규)

- [ ] **Step 1: Write the failing test**

```typescript
// src/repositories/supabase/__tests__/JobPostingRepository.delete.refund.test.ts
import { SupabaseJobPostingRepository } from '../JobPostingRepository';

const mockRefund = jest.fn();
jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: { refundJobCancellation: (...a: unknown[]) => mockRefund(...a) },
}));

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
    channel: jest.fn(),
  },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      if (error) throw new Error(`supabase: ${error.message ?? 'unknown'}`);
    },
  };
});
jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

const mockParseJobPosting = jest.fn();
jest.mock('@/schemas', () => {
  const actual = jest.requireActual('@/schemas');
  return { ...actual, parseJobPostingDocument: (...a: unknown[]) => mockParseJobPosting(...a) };
});

const OWNER = '11111111-1111-4111-8111-111111111111';
const POSTING = '55555555-5555-4555-8555-555555555555';
const WORKSPACE = '66666666-6666-4666-8666-666666666666';

function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'update', 'insert', 'delete']) {
    chain[m] = jest.fn(() => chain);
  }
  for (const m of ['single', 'maybeSingle']) chain[m] = jest.fn(() => Promise.resolve(returnValue));
  (chain as { then?: unknown }).then = (onf: (v: unknown) => unknown) =>
    Promise.resolve(returnValue).then(onf);
  return chain as Record<string, jest.Mock> & PromiseLike<unknown>;
}

const fakePosting = {
  id: POSTING,
  ownerId: OWNER,
  workspaceId: WORKSPACE,
  title: 't',
  status: 'active',
  filledPositions: 0,
  schemaVersion: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
  postingType: 'regular',
  location: { name: 'x' },
  schedule: {
    kind: 'dated',
    primaryDate: '2026-06-10',
    allDates: ['2026-06-10'],
    requirements: [],
  },
  roleCatalog: [],
  compensation: { mode: 'shared' },
  questions: { items: [] },
};

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRefund.mockReset();
  mockParseJobPosting.mockReset();
});

function setupOwnerDelete() {
  const loadChain = makeChain({
    data: { id: POSTING, owner_id: OWNER, workspace_id: WORKSPACE },
    error: null,
  });
  const updateChain = makeChain({ data: null, error: null });
  mockFrom.mockReturnValueOnce(loadChain).mockReturnValue(updateChain);
  mockParseJobPosting.mockReturnValue(fakePosting);
}

describe('deleteWithTransaction → 환불 연결', () => {
  const repo = new SupabaseJobPostingRepository();

  it('취소(CANCELLED) UPDATE 성공 후 refundJobCancellation(postingId, ownerId) 호출', async () => {
    setupOwnerDelete();
    mockRefund.mockResolvedValue({ success: false, error: 'no_consumption_found' });

    await repo.deleteWithTransaction(POSTING, OWNER);

    expect(mockRefund).toHaveBeenCalledWith(POSTING, OWNER);
  });

  it('환불 RPC 실패는 swallow — 취소는 성립(throw 없음)', async () => {
    setupOwnerDelete();
    mockRefund.mockRejectedValue(new Error('refund down'));

    await expect(repo.deleteWithTransaction(POSTING, OWNER)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/repositories/supabase/__tests__/JobPostingRepository.delete.refund.test.ts`
Expected: FAIL — mockRefund 0 calls

- [ ] **Step 3: Wire refund into deleteWithTransaction (`:423-441`)**

`WalletRepository` import는 Task 4에서 추가됨. 메서드 교체:

```typescript
  async deleteWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
    try {
      logger.info('공고 삭제', { jobPostingId, ownerId });
      const cur = await loadAndVerifyDeleteAccess(jobPostingId, ownerId, '공고 삭제');
      if ((cur.filledPositions ?? 0) > 0) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Cannot delete a posting with confirmed applicants. Close it instead.',
        });
      }
      const { error } = await supabase
        .from(TABLE)
        .update({ status: STATUS.JOB_POSTING.CANCELLED, updated_at: new Date().toISOString() })
        .eq('id', jobPostingId);
      if (error) handleSupabaseError(error, { operation: '공고 삭제', table: TABLE });

      // 취소 성립 후 환불(best-effort) — 비용 주체=posting owner(cur.ownerId).
      // RPC가 caller(owner|협업자) 권한 검증 + owner 지갑 적립. 멱등.
      // 무차감(no_consumption_found, flag off 등)은 success:false로 정상 no-op.
      // RPC 실패가 취소를 되돌리지 않도록 swallow + 경고 로깅(멱등이라 후속 재시도 가능).
      try {
        const refund = await WalletRepository.refundJobCancellation(jobPostingId, cur.ownerId);
        if (refund.success && !('idempotent' in refund && refund.idempotent)) {
          logger.info('공고 취소 환불 완료', { jobPostingId, refunded: refund.refunded_diamonds });
        }
      } catch (refundError) {
        logger.warn('공고 취소 환불 실패 — 취소는 성립, 환불 후속 필요', {
          jobPostingId,
          error: refundError instanceof Error ? refundError.message : String(refundError),
        });
      }

      logger.info('공고 삭제 완료', { jobPostingId });
    } catch (error) {
      rethrowOrHandle(error, '공고 삭제', { jobPostingId });
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/repositories/supabase/__tests__/JobPostingRepository.delete.refund.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/repositories/supabase/JobPostingRepository.ts src/repositories/supabase/__tests__/JobPostingRepository.delete.refund.test.ts
git commit -m "feat(wallet): 공고 취소 환불 RPC 연결 (B2 T9, best-effort)"
```

---

### Task 6: PaywallModal 컴포넌트

**Files:**

- Create: `src/components/wallet/PaywallModal.tsx`
- Modify: `src/components/wallet/index.ts`
- Test: `src/components/wallet/__tests__/PaywallModal.test.tsx` (신규)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/wallet/__tests__/PaywallModal.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaywallModal } from '../PaywallModal';

describe('PaywallModal', () => {
  it('비용/잔액/부족분을 표시한다', () => {
    const { getByText } = render(
      <PaywallModal
        visible
        cost={10}
        currencyHint="diamond"
        heartBalance={3}
        diamondBalance={2}
        onClose={jest.fn()}
        onCharge={jest.fn()}
      />
    );
    expect(getByText(/잔액이 부족/)).toBeTruthy();
  });

  it('충전하기 버튼이 onCharge를 호출한다', () => {
    const onCharge = jest.fn();
    const { getByTestId } = render(
      <PaywallModal
        visible
        cost={10}
        currencyHint="diamond"
        heartBalance={0}
        diamondBalance={0}
        onClose={jest.fn()}
        onCharge={onCharge}
      />
    );
    fireEvent.press(getByTestId('paywall-charge'));
    expect(onCharge).toHaveBeenCalledTimes(1);
  });

  it('닫기 버튼이 onClose를 호출한다', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <PaywallModal
        visible
        cost={10}
        currencyHint="diamond"
        heartBalance={0}
        diamondBalance={0}
        onClose={onClose}
        onCharge={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('paywall-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('visible=false면 내용 미렌더', () => {
    const { queryByText } = render(
      <PaywallModal
        visible={false}
        cost={10}
        currencyHint="diamond"
        heartBalance={0}
        diamondBalance={0}
        onClose={jest.fn()}
        onCharge={jest.fn()}
      />
    );
    expect(queryByText(/잔액이 부족/)).toBeNull();
  });
});
```

> **사전 확인:** 다른 wallet 컴포넌트 테스트(`BalanceBadge.test.tsx`)의 render util import 경로를 그대로 따를 것(`@testing-library/react-native` 직접 import인지 프로젝트 wrapper인지). 불일치 시 그 컨벤션에 맞춤.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/wallet/__tests__/PaywallModal.test.tsx`
Expected: FAIL — `Cannot find module '../PaywallModal'`

- [ ] **Step 3: Create PaywallModal**

```tsx
// src/components/wallet/PaywallModal.tsx
/**
 * UNIQN Mobile - PaywallModal
 * @description 공고 게시 잔액 부족 시 노출. 비용/보유잔액/부족분 + 충전 CTA.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Modal } from '@/components/ui';

export interface PaywallModalProps {
  visible: boolean;
  cost: number;
  currencyHint: string;
  heartBalance: number;
  diamondBalance: number;
  onClose: () => void;
  onCharge: () => void;
}

export function PaywallModal({
  visible,
  cost,
  currencyHint,
  heartBalance,
  diamondBalance,
  onClose,
  onCharge,
}: PaywallModalProps) {
  const symbol = currencyHint === 'heart_first' ? '💖' : '💎';
  const owned = currencyHint === 'heart_first' ? heartBalance + diamondBalance : diamondBalance;
  const short = Math.max(0, cost - owned);

  return (
    <Modal visible={visible} onClose={onClose} title="잔액이 부족해요" position="center">
      <View className="gap-3">
        <Text className="text-sm font-sans text-content-primary dark:text-secondary-100">
          이 공고를 게시하려면 {cost}
          {symbol} 가 필요해요.
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
            보유 잔액
          </Text>
          <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
            💖 {heartBalance} 💎 {diamondBalance}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
            부족분
          </Text>
          <Text className="text-sm font-sans-semibold text-error-600">
            {short}
            {symbol}
          </Text>
        </View>
        <View className="mt-2 flex-row gap-2">
          <Pressable
            testID="paywall-close"
            onPress={onClose}
            className="flex-1 items-center rounded-md bg-secondary-100 py-3 dark:bg-secondary-800"
          >
            <Text className="font-sans-semibold text-content-primary dark:text-secondary-100">
              닫기
            </Text>
          </Pressable>
          <Pressable
            testID="paywall-charge"
            onPress={onCharge}
            className="flex-1 items-center rounded-md bg-primary-600 py-3"
          >
            <Text className="font-sans-semibold text-white">충전하기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

`src/components/wallet/index.ts`에 추가:

```typescript
export { PaywallModal, type PaywallModalProps } from './PaywallModal';
```

> **사전 확인:** `Modal`이 `@/components/ui`에서 export되며 `position="center"` prop을 받는지 확인(ModalProps). 색 토큰(`bg-secondary-100`, `text-content-primary`, `bg-primary-600`, `text-error-600`)이 NativeWind 설정에 존재하는지 기존 컴포넌트에서 grep 확인. 없으면 인접 컴포넌트가 쓰는 토큰으로 교체.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/wallet/__tests__/PaywallModal.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/wallet/PaywallModal.tsx src/components/wallet/index.ts src/components/wallet/__tests__/PaywallModal.test.tsx
git commit -m "feat(wallet): PaywallModal 잔액부족 안내 컴포넌트 (B2 T8)"
```

---

### Task 7: useCreateJobPosting 잔액부족 토스트 억제 + wallet 캐시 무효화(6A)

**Files:**

- Modify: `src/hooks/useJobManagement.ts` (useCreateJobPosting onSuccess/onError)
- Test: `src/hooks/__tests__/useCreateJobPosting.paywall.test.tsx` (신규)

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/__tests__/useCreateJobPosting.paywall.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCreateJobPosting } from '@/hooks/useJobManagement';
import { BusinessError, ERROR_CODES } from '@/errors';

const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({ useToastStore: () => ({ addToast: mockAddToast }) }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { uid: 'u1', displayName: 'U' }, profile: { name: 'U' } }),
}));
jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: jest.fn(),
  shouldApplyOptimisticUpdate: () => false,
}));
const mockCreate = jest.fn();
jest.mock('@/services', () => ({ createJobPosting: (...a: unknown[]) => mockCreate(...a) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockAddToast.mockReset();
  mockCreate.mockReset();
});

it('잔액부족(BUSINESS_INSUFFICIENT_BALANCE) 에러는 토스트를 띄우지 않는다 (PaywallModal이 화면에서 처리)', async () => {
  mockCreate.mockRejectedValue(
    new BusinessError(ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE, { userMessage: '부족' })
  );
  const { result } = renderHook(() => useCreateJobPosting(), { wrapper });

  await act(async () => {
    result.current.mutate({ input: {} as never });
  });
  await waitFor(() => expect(mockCreate).toHaveBeenCalled());

  const errorToasts = mockAddToast.mock.calls.filter((c) => c[0]?.type === 'error');
  expect(errorToasts).toHaveLength(0);
});

it('그 외 에러는 기존대로 토스트를 띄운다', async () => {
  mockCreate.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useCreateJobPosting(), { wrapper });
  await act(async () => {
    result.current.mutate({ input: {} as never });
  });
  await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
});
```

> **사전 확인:** 다른 hook 테스트가 `renderHook`을 `@testing-library/react-native`에서 쓰는지 `@testing-library/react`에서 쓰는지 확인하고 맞출 것. `buildCurrentUserIdentitySnapshot` import가 mock 없이 동작하지 않으면 해당 모듈도 가벼운 mock 추가.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/__tests__/useCreateJobPosting.paywall.test.tsx`
Expected: FAIL — 잔액부족인데도 error 토스트가 1건 발생

- [ ] **Step 3: Modify useCreateJobPosting**

`src/hooks/useJobManagement.ts` 상단 import에 추가:

```typescript
import { isAppError, ERROR_CODES } from '@/errors';
```

`useCreateJobPosting`의 onSuccess/onError 교체:

```typescript
return useMutation({
  mutationFn: (params: CreateJobParams) => {
    requireAuth(user?.uid, 'useJobManagement');
    const identity = buildCurrentUserIdentitySnapshot({
      profile,
      authUser: user,
      fallbackName: '익명',
    });
    const ownerName = profile?.name || profile?.nickname || user.displayName || '익명';
    requireOnlineForMutation('useJobManagement.createJobPosting');
    return createJobPosting(params.input, user.uid, identity.preferredName || ownerName);
  },
  onSuccess: () => {
    addToast({ type: 'success', message: '공고가 등록되었습니다.' });
    queryClient.invalidateQueries({ queryKey: queryKeys.jobManagement.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.all });
    // 6A: 차감 반영 — 지갑 요약 동기 갱신(단일 queryKey)
    queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary(user?.uid) });
  },
  onError: (error, variables, ctx) => {
    // 잔액부족은 화면(create.tsx)의 PaywallModal이 처리 → 토스트 억제
    if (isAppError(error) && error.code === ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE) {
      return;
    }
    createMutationErrorHandler('공고 생성', addToast)(error, variables, ctx);
  },
});
```

> `queryKeys.wallet.summary`는 `src/lib/queryClient.ts`에 존재(확인됨). `ERROR_CODES`가 `@/errors`에서 re-export되는지 확인(없으면 `@/errors/AppError`에서 import).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/hooks/__tests__/useCreateJobPosting.paywall.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useJobManagement.ts src/hooks/__tests__/useCreateJobPosting.paywall.test.tsx
git commit -m "feat(wallet): 공고생성 잔액부족 토스트 억제 + 지갑캐시 무효화 (B2 T8/6A)"
```

---

### Task 8: create.tsx PaywallModal 연동

**Files:**

- Modify: `app/(employer)/my-postings/create.tsx`
- Test: (화면 통합 — 수동 QA. 단위는 Task 6/7이 커버.)

- [ ] **Step 1: Modify create.tsx handleSubmit + render**

import 추가:

```typescript
import { useState, useCallback, useMemo } from 'react'; // useState 이미 있음
import { PaywallModal, WalletBalanceBadge } from '@/components/wallet';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { isAppError, ERROR_CODES } from '@/errors';
```

상태 추가(컴포넌트 본문 상단, 기존 useState들 근처):

```typescript
const [showPaywall, setShowPaywall] = useState(false);
const wallet = useWalletBalance();
```

handleSubmit catch 블록 교체:

```typescript
    } catch (error) {
      if (isAppError(error) && error.code === ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE) {
        setShowPaywall(true);
        return;
      }
      logger.error('공고 등록 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 등록에 실패했습니다.',
      });
    }
```

SafeAreaView 닫기 직전(`</SafeAreaView>` 위, LoadTemplateModal 블록 다음)에 PaywallModal 추가:

```tsx
<PaywallModal
  visible={showPaywall}
  cost={postingCost.data?.cost ?? 0}
  currencyHint={postingCost.data?.currency_hint ?? 'diamond'}
  heartBalance={wallet.data?.heart_balance ?? 0}
  diamondBalance={wallet.data?.diamond_balance ?? 0}
  onClose={() => setShowPaywall(false)}
  onCharge={() => {
    setShowPaywall(false);
    // 충전(PurchaseSheet)은 Lane C(T10)에서 연결. 그 전까지 안내 토스트.
    addToast({ type: 'info', message: '충전 기능은 곧 제공될 예정이에요.' });
  }}
/>
```

> **Lane C 연결 지점:** C 완료 후 `onCharge`를 PurchaseSheet 오픈으로 교체.
> **사전 확인:** toast `type: 'info'`가 toastStore에서 지원되는지 확인. 미지원이면 `'success'` 또는 가용 타입으로.

- [ ] **Step 2: tsc + lint 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add "app/(employer)/my-postings/create.tsx"
git commit -m "feat(wallet): 공고작성 잔액부족 PaywallModal 연동 (B2 T8)"
```

---

### Task 9: 취소 다이얼로그 환불 사전고지 (4A)

**Files:**

- Modify: `app/(employer)/my-postings/[id]/index.tsx`
- Test: (화면 — 수동 QA)

- [ ] **Step 1: Modify cancel ConfirmModal message**

`my-postings/[id]/index.tsx`에 import 추가:

```typescript
import { usePostingCost } from '@/hooks/usePostingCost';
```

posting 로드 이후(`postingFacts` 근처)에 비용 조회 + 메시지 계산:

```typescript
const deletePostingCost = usePostingCost(posting?.postingType ?? 'regular', posting?.ownerId);
const isPaidPosting = (deletePostingCost.data?.cost ?? 0) > 0;
const deleteMessage = isPaidPosting
  ? '이 공고는 유료로 등록되었습니다. 취소 시 등록 시점 기준 24시간 이내는 100%, 이후는 50%가 환불됩니다. 정말 취소하시겠습니까?'
  : '정말 이 공고를 삭제하시겠습니까? 삭제된 공고는 복구할 수 없습니다.';
```

ConfirmModal의 `message` prop을 동적 값으로 교체:

```tsx
<ConfirmModal
  visible={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  onConfirm={handleDeleteConfirm}
  title="공고 삭제"
  message={deleteMessage}
  confirmText="삭제"
  cancelText="취소"
  isDestructive
/>
```

> 기존 ConfirmModal에 `message="정말 이 공고를..."` 하드코딩이 있던 자리를 `message={deleteMessage}`로 교체. `isDestructive` prop이 이미 있었는지 확인하고 누락 시 추가(기존 prop 세트 유지).

- [ ] **Step 2: tsc 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add "app/(employer)/my-postings/[id]/index.tsx"
git commit -m "feat(wallet): 공고 취소 다이얼로그 환불 사전고지 (B2 T9/4A)"
```

---

### Task 10: 전체 게이트 검증

- [ ] **Step 1: 전체 wallet/job-posting 테스트**

Run: `npx jest wallet JobPostingRepository useCreateJobPosting Paywall insufficientBalance`
Expected: 전체 PASS

- [ ] **Step 2: 전체 스위트 + 품질 게이트**

```bash
npx jest 2>&1 | tail -20
npx tsc --noEmit
npm run quality
```

Expected: jest 전체 PASS(이전 4333+ 신규), tsc 0 errors, quality exit 0

- [ ] **Step 3: R1 증거 캡처**

R1 가드 테스트만 verbose 재실행해 payload 동등 + 멱등 id 단언 통과를 PR 본문 증거로 캡처:
Run: `npx jest JobPostingRepository.create.payment -t "R1" --verbose` (또는 describe 명으로)

---

## Self-Review

**Spec coverage:**

- T6(WalletRepository write + 스키마) → Task 1, 2 ✅
- T8(create→결제RPC, 멱등 id, INSUFFICIENT→Paywall, 6A 캐시) → Task 3, 4, 6, 7, 8 ✅
- T9(delete→환불, 4A 사전고지) → Task 5, 9 ✅
- R1 회귀 게이트(flag off 동등) → Task 4 Step 1/5, Task 10 Step 3 ✅

**Type consistency:** `CreatePostingPaymentResult.posting_id`, `RefundResult.success`, `BUSINESS_INSUFFICIENT_BALANCE='E6080'`, `WalletRepository.createJobPostingWithPayment(ownerId,payload,reason)` / `.refundJobCancellation(postingId,ownerId)` — Task 1~9 전반 일관.

**알려진 검증 의존(실행 시 grep 확인 필수):** `getUserMessage` export 이름(Task 3) / `ERROR_CODES` re-export 위치(`@/errors` vs `@/errors/AppError`) / `renderHook`·`render` import 출처 / NativeWind 색 토큰 존재 / toast `'info'` 타입 지원 / `Modal` `position` prop. 각 Task의 "사전 확인" 메모대로 보정.

**스코프 밖(후속 Lane):** C(RevenueCat 충전, T10) — PaywallModal `onCharge` 연결 지점만 표시. D(featured/extend, T12) — 별도 plan.
