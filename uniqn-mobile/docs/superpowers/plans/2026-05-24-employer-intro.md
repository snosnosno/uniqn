# 구인자 등록 신청 소개글 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구인자 등록 신청 시 "주로 구인하는 지역/매장/대회" 소개글(필수, 10~300자)을 입력받아 `employer_applications.intro` 전용 컬럼에 저장하고, 관리자 신청 상세 화면에서 노출한다.

**Architecture:** Presentation(`employer-register.tsx`) → Service(`profileService.registerAsEmployer`) → Repository(`employerApplicationRepository.register`) → RPC(`register_as_employer`). 관리자 노출은 기존 `getById` → `.select(ADMIN_SELECT)` 경로로 컬럼만 추가. 입력은 zod + xssValidation 으로 검증.

**Tech Stack:** Expo 55 / RN 0.83 / TS strict / Supabase(PostgreSQL RPC) / Zod 4.x / Jest / NativeWind

**스펙:** `docs/superpowers/specs/2026-05-24-employer-intro-design.md`

**작업 브랜치:** `feat/employer-intro` (이미 생성됨, 스펙 커밋 완료)

---

## 파일 구조

| 파일                                                                        | 역할                         | 작업   |
| --------------------------------------------------------------------------- | ---------------------------- | ------ |
| `supabase/migrations/20260524120000_add_employer_application_intro.sql`     | intro 컬럼 + RPC p_intro     | 생성   |
| `src/types/supabase.ts`                                                     | DB 타입 (자동 생성)          | 재생성 |
| `src/schemas/user.schema.ts`                                                | employerIntroSchema          | 수정   |
| `src/schemas/__tests__/user.schema.test.ts`                                 | intro 스키마 테스트          | 생성   |
| `src/repositories/supabase/EmployerApplicationRepository.ts`                | TABLE_COLUMNS·타입·register  | 수정   |
| `src/repositories/supabase/__tests__/EmployerApplicationRepository.test.ts` | register p_intro 전달 테스트 | 생성   |
| `src/services/auth/profileService.ts`                                       | registerAsEmployer 시그니처  | 수정   |
| `app/(app)/employer-register.tsx`                                           | 소개글 입력 Card             | 수정   |
| `app/(admin)/employer-applications/[id].tsx`                                | 구인 소개 Card               | 수정   |

---

## Task 1: zod 소개글 스키마 (TDD)

**Files:**

- Modify: `src/schemas/user.schema.ts` (employerRegisterSchema 근처, line 137~150)
- Test: `src/schemas/__tests__/user.schema.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

Create `src/schemas/__tests__/user.schema.test.ts`:

```typescript
import { employerIntroSchema } from '../user.schema';

describe('employerIntroSchema', () => {
  const valid = '강남 일대 홀덤펍과 OO포커 대회 딜러를 주로 모집합니다';

  it('accepts a valid 10~300 char intro', () => {
    expect(employerIntroSchema.parse(valid)).toBe(valid);
  });

  it('trims surrounding whitespace', () => {
    expect(employerIntroSchema.parse(`  ${valid}  `)).toBe(valid);
  });

  it('rejects intro shorter than 10 chars (after trim)', () => {
    expect(() => employerIntroSchema.parse('짧은글')).toThrow();
  });

  it('rejects whitespace-only intro', () => {
    expect(() => employerIntroSchema.parse('          ')).toThrow();
  });

  it('rejects intro longer than 300 chars', () => {
    expect(() => employerIntroSchema.parse('가'.repeat(301))).toThrow();
  });

  it('rejects intro containing XSS payload', () => {
    expect(() =>
      employerIntroSchema.parse('주로 모집합니다 <script>alert(1)</script> 지역')
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/schemas/__tests__/user.schema.test.ts`
Expected: FAIL — `employerIntroSchema` is not exported / undefined.

- [ ] **Step 3: Add the schema**

In `src/schemas/user.schema.ts`, insert BEFORE `employerRegisterSchema` (currently line 137):

```typescript
/**
 * 구인자 소개글 스키마 (주로 구인하는 지역/매장/대회)
 * @description 등록 신청 시 필수 입력. trim 후 10~300자, XSS 검증.
 */
export const employerIntroSchema = z
  .string()
  .trim()
  .min(10, { message: '소개글은 최소 10자 이상 입력해주세요' })
  .max(300, { message: '소개글은 300자를 초과할 수 없습니다' })
  .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

export type EmployerIntroData = z.infer<typeof employerIntroSchema>;
```

Then extend `employerRegisterSchema` (currently line 141) to include intro:

```typescript
export const employerRegisterSchema = z.object({
  intro: employerIntroSchema,
  agreeToEmployerTerms: z.literal(true, {
    message: '구인자 이용약관에 동의해주세요',
  }),
  agreeToLiabilityWaiver: z.literal(true, {
    message: '서약서에 동의해주세요',
  }),
});
```

- [ ] **Step 4: Export from index**

In `src/schemas/index.ts`, add `employerIntroSchema` next to the existing `employerRegisterSchema` export (around line 211):

```typescript
  employerIntroSchema,
  employerRegisterSchema,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/schemas/__tests__/user.schema.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/user.schema.ts src/schemas/index.ts src/schemas/__tests__/user.schema.test.ts
git commit -m "feat(employer): 구인자 소개글 zod 스키마 추가 (10~300자 + XSS)"
```

---

## Task 2: DB 마이그레이션 — intro 컬럼 + RPC p_intro

> ⚠️ 마이그레이션 적용은 MCP `apply_migration` 전용. `supabase db push` 금지.
> 이 Task의 SQL은 파일로 먼저 작성(레지스트리 보존)하고, 적용은 실행 단계에서 MCP로 수행한다.
> RPC 인자 개수가 바뀌므로 구 1인자 함수를 반드시 DROP (CREATE OR REPLACE 는 오버로드만 생성).

**Files:**

- Create: `supabase/migrations/20260524120000_add_employer_application_intro.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260524120000_add_employer_application_intro.sql`:

```sql
-- =============================================================================
-- Migration: employer_applications.intro 컬럼 + register_as_employer p_intro
--
-- 구인자 등록 신청 시 "주로 구인하는 지역/매장/대회" 소개글 저장.
-- - intro 컬럼은 nullable (기존 신청 레코드 호환). 필수 여부는 앱 레이어 강제.
-- - 경계 방어용 CHECK: char_length(intro) <= 300
-- - RPC register_as_employer 에 p_intro 파라미터 추가 (인자 개수 변경 → DROP 후 CREATE)
--   기존 supersedes_id 재신청 체인 로직(20260416200000) 보존.
-- =============================================================================

-- 1. intro 컬럼 추가
ALTER TABLE public.employer_applications
  ADD COLUMN IF NOT EXISTS intro text;

ALTER TABLE public.employer_applications
  DROP CONSTRAINT IF EXISTS employer_applications_intro_len_chk;

ALTER TABLE public.employer_applications
  ADD CONSTRAINT employer_applications_intro_len_chk
  CHECK (intro IS NULL OR char_length(intro) <= 300);

-- 2. register_as_employer 재정의 (구 1인자 시그니처 DROP 후 2인자 CREATE)
DROP FUNCTION IF EXISTS public.register_as_employer(JSONB);

CREATE OR REPLACE FUNCTION public.register_as_employer(
  p_employer_agreements JSONB DEFAULT NULL::JSONB,
  p_intro               TEXT  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user         RECORD;
  v_app_id       UUID;
  v_supersedes   UUID;
  v_now          TIMESTAMPTZ := now();
BEGIN
  -- 현재 사용자 조회
  SELECT * INTO v_user FROM users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: 사용자를 찾을 수 없습니다';
  END IF;

  -- staff → employer 신청만 허용 (admin 상승 차단)
  IF v_user.role != 'staff' THEN
    RAISE EXCEPTION 'INVALID_ROLE_TRANSITION: 현재 역할 %, staff만 구인자 신청 가능', v_user.role;
  END IF;

  -- 동일 유저 pending 중복 신청 차단
  IF EXISTS (
    SELECT 1 FROM employer_applications
    WHERE user_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'EMPLOYER_APP_PENDING_EXISTS: 이미 심사 중인 신청이 있습니다';
  END IF;

  -- 재신청 체인: 직전 거부된 신청 ID 조회
  SELECT id INTO v_supersedes
  FROM employer_applications
  WHERE user_id = auth.uid()
    AND status = 'rejected'
  ORDER BY created_at DESC
  LIMIT 1;

  -- 신청 INSERT (intro + supersedes_id 포함)
  INSERT INTO employer_applications (
    user_id,
    status,
    submitted_at,
    agreements_snapshot,
    intro,
    supersedes_id,
    created_at
  ) VALUES (
    auth.uid(),
    'pending',
    v_now,
    COALESCE(p_employer_agreements, '{}'::JSONB),
    p_intro,
    v_supersedes,
    v_now
  )
  RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success',       true,
    'applicationId', v_app_id,
    'status',        'pending',
    'submittedAt',   v_now,
    'supersedesId',  v_supersedes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_as_employer(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_as_employer(JSONB, TEXT) TO authenticated;
```

- [ ] **Step 2: Apply the migration via MCP**

Use the `mcp__supabase__apply_migration` tool with:

- name: `add_employer_application_intro`
- query: (the full SQL body above)

Do NOT run `supabase db push`.

- [ ] **Step 3: Verify the column and function exist**

Use `mcp__supabase__execute_sql` with:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employer_applications'
  AND column_name = 'intro';

SELECT pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'register_as_employer'
  AND pronamespace = 'public'::regnamespace;
```

Expected: 1 row `intro | text`; exactly ONE function row with args `p_employer_agreements jsonb, p_intro text` (no leftover 1-arg overload).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260524120000_add_employer_application_intro.sql
git commit -m "feat(db): employer_applications.intro 컬럼 + register_as_employer p_intro 추가"
```

---

## Task 3: DB 타입 재생성

**Files:**

- Modify: `src/types/supabase.ts` (자동 생성)

- [ ] **Step 1: Regenerate types via MCP**

Use `mcp__supabase__generate_typescript_types`. Write the output to `src/types/supabase.ts` (overwrite).

- [ ] **Step 2: Verify intro is present**

Run: `npx grep -n "intro" src/types/supabase.ts` (or Grep tool for `intro` within the `employer_applications` Row type).
Expected: `intro: string | null` appears in the `employer_applications` `Row` definition.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (no new type errors introduced by the regenerated file).

- [ ] **Step 4: Commit**

```bash
git add src/types/supabase.ts
git commit -m "chore(types): employer_applications.intro 반영 DB 타입 재생성"
```

---

## Task 4: Repository — intro 조회 + register 전달 (TDD)

**Files:**

- Modify: `src/repositories/supabase/EmployerApplicationRepository.ts`
  - `TABLE_COLUMNS` (line 102-103)
  - `EmployerApplication` interface (line 53-67)
  - `register()` (line 201-221)
- Test: `src/repositories/supabase/__tests__/EmployerApplicationRepository.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

Create `src/repositories/supabase/__tests__/EmployerApplicationRepository.test.ts`:

```typescript
import { SupabaseEmployerApplicationRepository } from '../EmployerApplicationRepository';

const rpcMock = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('SupabaseEmployerApplicationRepository.register', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        applicationId: 'app-1',
        status: 'pending',
        submittedAt: '2026-05-24T00:00:00Z',
      },
      error: null,
    });
  });

  it('passes p_employer_agreements and p_intro to the RPC', async () => {
    const repo = new SupabaseEmployerApplicationRepository();
    const snapshot = { termsVersion: 'v1' };

    await repo.register(snapshot, '강남 일대 홀덤펍 딜러를 주로 모집합니다');

    expect(rpcMock).toHaveBeenCalledWith('register_as_employer', {
      p_employer_agreements: snapshot,
      p_intro: '강남 일대 홀덤펍 딜러를 주로 모집합니다',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/repositories/supabase/__tests__/EmployerApplicationRepository.test.ts`
Expected: FAIL — `register` takes 1 arg / RPC called without `p_intro`.

- [ ] **Step 3: Add `intro` to TABLE_COLUMNS**

In `EmployerApplicationRepository.ts`, change `TABLE_COLUMNS` (line 102-103):

```typescript
const TABLE_COLUMNS =
  'id,user_id,status,submitted_at,reviewed_at,reviewed_by,rejection_reason,rejection_category,agreements_snapshot,intro,supersedes_id,created_at' as const;
```

- [ ] **Step 4: Add `intro` to the EmployerApplication interface**

In the `EmployerApplication` interface (line 53-67), add after `agreementsSnapshot`:

```typescript
agreementsSnapshot: Record<string, unknown>;
intro: string | null;
supersedesId: string | null;
```

(`toCamelCase` in `rowToApplication` maps the `intro` column automatically — no extra mapping code needed.)

- [ ] **Step 5: Extend `register()` signature**

Replace the `register` method body's RPC call (line 201-221). New signature + RPC params:

```typescript
  async register(
    agreementsSnapshot: Record<string, unknown>,
    intro: string
  ): Promise<RegisterAsEmployerResult> {
    try {
      logger.info('구인자 신청 제출', { component: COMPONENT });

      const { data, error } = await supabase.rpc('register_as_employer', {
        p_employer_agreements: agreementsSnapshot,
        p_intro: intro,
      });

      if (error) mapRpcError(error);

      const result = data as RegisterAsEmployerResult;
      logger.info('구인자 신청 제출 완료', {
        component: COMPONENT,
        applicationId: result.applicationId,
      });
      return result;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapRpcError(error);
    }
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/repositories/supabase/__tests__/EmployerApplicationRepository.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/supabase/EmployerApplicationRepository.ts src/repositories/supabase/__tests__/EmployerApplicationRepository.test.ts
git commit -m "feat(employer): repository register intro 전달 + intro 컬럼 조회"
```

---

## Task 5: Service — registerAsEmployer 시그니처 확장

**Files:**

- Modify: `src/services/auth/profileService.ts` (line 189-220)

- [ ] **Step 1: Extend the service signature and JSDoc**

In `profileService.ts`, update `registerAsEmployer` (line 189-191) and the JSDoc `@param`:

```typescript
/**
 * @param agreementsSnapshot 약관/서약 동의 스냅샷 (신청 당시 버전 고정)
 * @param intro 구인자 소개글 (주로 구인하는 지역/매장/대회, 10~300자)
 * @returns 신청 결과 (applicationId, status='pending', submittedAt)
 */
export async function registerAsEmployer(
  agreementsSnapshot: Record<string, unknown>,
  intro: string
): Promise<RegisterAsEmployerResult> {
```

- [ ] **Step 2: Pass intro to the repository call**

In the same function (line 205), change:

```typescript
const result = await employerApplicationRepository.register(agreementsSnapshot, intro);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: FAIL pointing only at `app/(app)/employer-register.tsx` (caller not yet updated). This is expected — the next task fixes the caller. If any OTHER file errors, fix it here.

- [ ] **Step 4: Commit**

```bash
git add src/services/auth/profileService.ts
git commit -m "feat(employer): registerAsEmployer 서비스에 intro 파라미터 추가"
```

---

## Task 6: 등록 화면 — 소개글 입력 Card

**Files:**

- Modify: `app/(app)/employer-register.tsx`
  - imports (line 10-27)
  - state (line 116-126)
  - JSX: 프로필 정보 Card 다음 (line 247) 에 소개글 Card 삽입
  - handleSubmit (line 165)

- [ ] **Step 1: Add imports**

In `employer-register.tsx`, update the RN import (line 11) and add the schema import:

```typescript
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
```

Add after the existing `@/constants/legal` import block (after line 27):

```typescript
import { employerIntroSchema } from '@/schemas';
```

- [ ] **Step 2: Add intro state + validation**

Inside the component, after the agreement state (after line 117):

```typescript
// 구인 소개글 (주로 구인하는 지역/매장/대회)
const [intro, setIntro] = useState('');

const introResult = employerIntroSchema.safeParse(intro);
const introValid = introResult.success;
// 입력을 시작한 뒤에만 에러를 보여준다 (빈 상태에서 빨간 메시지 방지)
const introError = intro.length > 0 && !introValid ? introResult.error.issues[0]?.message : null;
```

- [ ] **Step 3: Extend canSubmit**

Change `canSubmit` (line 126):

```typescript
const canSubmit = isVerified && agreeToTerms && agreeToLiability && introValid;
```

- [ ] **Step 4: Pass intro to registerAsEmployer**

In `handleSubmit`, change the call (line 165):

```typescript
await registerAsEmployer(agreementsSnapshot, intro.trim());
```

- [ ] **Step 5: Insert the intro Card in JSX**

In `employer-register.tsx`, insert this block immediately AFTER the "프로필 정보" Card closing tag (after line 247, before the "동의 항목" `<View className="mb-6">`):

```tsx
{
  /* 구인 소개 */
}
<Card variant="outlined" padding="md" className="mb-6">
  <Text className="mb-1 text-base font-sans-semibold text-content-primary dark:text-off-white">
    구인 소개
  </Text>
  <Text className="mb-3 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
    주로 구인하는 지역/매장/대회를 알려주세요. 관리자 심사에 참고됩니다.
  </Text>

  <TextInput
    value={intro}
    onChangeText={setIntro}
    placeholder={'예) 강남 일대 홀덤펍, OO포커 대회 딜러를 주로 모집합니다'}
    placeholderTextColor="#9CA3AF"
    multiline
    numberOfLines={5}
    textAlignVertical="top"
    maxLength={300}
    className="min-h-[120px] rounded-md border border-secondary-300 bg-white px-3 py-2 text-base text-content-primary dark:border-surface-overlay dark:bg-surface dark:text-off-white font-sans"
  />

  <View className="mt-1 flex-row items-center justify-between">
    <Text className="flex-1 text-xs text-error-500 dark:text-error-400 font-sans">
      {introError ?? ''}
    </Text>
    <Text className="text-xs text-content-placeholder font-sans">{intro.length}/300</Text>
  </View>
</Card>;
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: exit 0 (the Task 5 caller error is now resolved).

Run: `npx eslint "app/(app)/employer-register.tsx"`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/employer-register.tsx"
git commit -m "feat(employer): 등록 신청 화면에 구인 소개글 입력 추가 (필수)"
```

---

## Task 7: 관리자 상세 — 구인 소개 Card

**Files:**

- Modify: `app/(admin)/employer-applications/[id].tsx`
  - JSX: "프로필 정보" Card (line 310-351) 다음에 "구인 소개" Card 삽입

- [ ] **Step 1: Insert the intro Card**

In `[id].tsx`, insert this block immediately AFTER the "프로필 정보" Card closing `) : null}` (after line 351), BEFORE the "약관 동의 스냅샷" Card (line 353):

```tsx
{
  /* Card — 구인 소개 */
}
<Card className="mb-4">
  <Text className="mb-3 text-base font-sans-semibold text-content-primary dark:text-off-white">
    구인 소개
  </Text>
  <Text className="text-sm leading-5 text-content-primary dark:text-off-white font-sans">
    {app.intro && app.intro.trim().length > 0 ? app.intro : '-'}
  </Text>
</Card>;
```

(`app.intro` is now typed `string | null` from Task 4. No truncation — full text shown per design Rule 26.)

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint "app/(admin)/employer-applications/[id].tsx"`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/employer-applications/[id].tsx"
git commit -m "feat(employer): 관리자 신청 상세에 구인 소개 카드 노출"
```

---

## Task 8: 전체 검증 + 수동 확인

- [ ] **Step 1: Full quality gate**

Run: `npm run quality`
Expected: type-check + lint + format:check 모두 통과 (exit 0).

- [ ] **Step 2: Full test suite (touched areas)**

Run: `npx jest src/schemas/__tests__/user.schema.test.ts src/repositories/supabase/__tests__/EmployerApplicationRepository.test.ts`
Expected: all PASS.

- [ ] **Step 3: 수동 검증 (localhost dev = prod DB)**

Run: `npm start` (or web)

1. staff 계정으로 로그인 → `/(app)/employer-register` 진입
2. 소개글 비움 → "구인자로 등록하기" 버튼 비활성 확인
3. 9자 입력 → 에러 메시지 "최소 10자" + 버튼 비활성 확인
4. 유효한 소개글 입력 → 카운터 갱신, 버튼 활성화 확인
5. 본인인증 + 약관 2개 동의 후 제출 → 신청 접수
6. admin 계정으로 `/(admin)/employer-applications/[id]` 진입 → "구인 소개" 카드에 입력값 노출 확인

- [ ] **Step 4: Red-Green for the migration (선택, pgTAP 미사용 시 수동)**

`mcp__supabase__execute_sql` 로 직전 신청 레코드의 intro 가 저장됐는지 확인:

```sql
SELECT id, intro, created_at
FROM public.employer_applications
ORDER BY created_at DESC
LIMIT 1;
```

Expected: 방금 제출한 소개글이 `intro` 에 저장됨.

- [ ] **Step 5: 최종 상태 보고**

`git log --oneline feat/employer-intro` 로 커밋 목록 확인 후, 검증 증거(테스트 통과 수, quality exit code, 수동 확인 결과)와 함께 완료 보고. PR 생성은 사용자 승인 후.

---

## 배포 주의 (구현과 별개, 머지 후)

- RPC 시그니처 변경 → 클라이언트 코드와 **동시 배포** 필요. master 머지 = 코드 반영, 마이그레이션은 이미 prod 적용됨(Task 2).
- 모바일 앱 반영은 EAS OTA(`eas update`) 또는 새 빌드 필요 — 머지만으론 기존 앱 사용자에게 미반영.
- 웹은 Cloudflare 재배포로 반영.
