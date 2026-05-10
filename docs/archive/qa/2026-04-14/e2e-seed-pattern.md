# E2E Seed Pattern — Wave 5 Track B 가이드

> 작성일: 2026-04-15
> 대상: Wave 5 트랙 B (Playwright e2e) Phase 2 agents
> 기준 브랜치: test/wave5-track-b

---

## 1. 환경 구성

### 필수 환경변수 (`uniqn-mobile/e2e/.env.test`)

```dotenv
# Supabase 접속 정보 (필수)
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Service Role Key (선택 — DB 직접 INSERT 시 필요)
E2E_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# 앱 서버 (기본값: http://localhost:4101)
E2E_BASE_URL=http://localhost:4101
E2E_WEB_PORT=4101
```

`EXPO_PUBLIC_SUPABASE_URL`과 `EXPO_PUBLIC_SUPABASE_ANON_KEY`는 `config.ts`의 `requireEnv()`로 읽으므로
미설정 시 global-setup 단계에서 즉시 오류가 발생한다.

### Supabase admin client 초기화

```typescript
import { getAdminClient } from '@/e2e/helpers/supabase-admin';

// E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 시 null 반환
const adminClient = getAdminClient();
if (!adminClient) {
  // pre-seeded 데이터만으로 진행 (대부분의 읽기 전용 테스트는 OK)
}
```

`getAdminClient()`는 `createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })`로
생성되므로 RLS 정책을 우회하여 모든 테이블에 접근할 수 있다.

---

## 2. 헬퍼 함수 카탈로그

### `uniqn-mobile/e2e/helpers/supabase-admin.ts` 제공 함수

| 함수 | 시그니처 | 용도 |
|------|----------|------|
| `signInWithSupabase` | `(email: string, password: string) => Promise<SupabaseAuthToken>` | Supabase Auth REST API로 직접 로그인. storageState 생성용. |
| `getAdminClient` | `() => SupabaseClient \| null` | service_role 클라이언트 반환. 미설정 시 null. |
| `buildStorageStateEntry` | `(token, accountRole, baseUrl) => { name, value }[]` | Playwright storageState용 localStorage 엔트리 2개 생성 (Supabase auth-token + Zustand auth-storage). |
| `SUPABASE_QA_ACCOUNTS` | const 객체 | staff/employer/admin 3개 QA 계정 상수 (id, email, password, role, name). |

### `uniqn-mobile/e2e/fixtures/test-accounts.ts` 제공 상수

```typescript
import { TEST_ACCOUNTS } from '@/e2e/fixtures/test-accounts';

// TEST_ACCOUNTS.staff.uid  → '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8'
// TEST_ACCOUNTS.employer.uid → '9cf771e9-0e67-413d-8395-5b1d573ae64d'
// TEST_ACCOUNTS.admin.uid   → '95337a77-9700-427e-8ff3-bc7a14abb90e'
// 공통 비밀번호: 'TestPass1!'
```

### `uniqn-mobile/e2e/scripts/seedSupabase.ts` 역할

이 스크립트는 **데이터 삽입이 아닌 현황 검증용**이다. 다음 3가지를 확인한다:

1. 3개 QA 계정 로그인 가능 여부
2. `users` 테이블 프로필 존재 여부
3. `job_postings` 레코드 개수

사용 방법:
```bash
cd uniqn-mobile
npx ts-node e2e/scripts/seedSupabase.ts
```

---

## 3. 데이터 시드 패턴

### 3.1 User/Auth 시드

QA 계정 3개(staff/employer/admin)는 **Supabase migration으로 pre-seeded**되어 있다.
직접 생성할 필요 없고 `TEST_ACCOUNTS` 상수를 그대로 사용한다.

새 테스트 유저를 동적으로 생성해야 할 경우 service role 클라이언트를 사용한다:

```typescript
import { getAdminClient } from '@/e2e/helpers/supabase-admin';

async function createTestUserWithAuth(email: string, password: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error('service_role key required');

  // auth.users 생성
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // 이메일 인증 건너뜀
    app_metadata: { role: 'staff' },
  });
  if (error) throw error;

  // users 테이블 프로필도 함께 생성 (auth trigger가 없으면 수동으로)
  await admin.from('users').insert({
    id: data.user.id,
    email,
    name: 'E2E테스트',
    role: 'staff',
    status: 'active',
  });

  return data.user;
}
```

**주의**: `auth.users`에 직접 INSERT할 때는 반드시 `auth.identities`에도 email provider 레코드를
함께 생성해야 로그인이 가능하다. `admin.auth.admin.createUser()`를 사용하면 자동 처리된다.

### 3.2 Job Posting 시드

Supabase 기반 spec에서는 `job_postings` 테이블에 직접 INSERT한다.
`createTestJob()` factory는 Firestore 문서 형태의 데이터를 반환하므로,
Supabase 컬럼 스키마(snake_case)에 맞게 매핑이 필요하다.

```typescript
import { getAdminClient } from '@/e2e/helpers/supabase-admin';
import { TEST_ACCOUNTS } from '@/e2e/fixtures/test-accounts';

async function seedJobPosting(title: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error('service_role key required for seeding');

  const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await admin
    .from('job_postings')
    .insert({
      title,
      status: 'active',
      owner_id: TEST_ACCOUNTS.employer.uid,
      work_date: workDate,
      // 기타 필수 컬럼들...
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

async function cleanupJobPosting(id: string) {
  const admin = getAdminClient();
  await admin?.from('job_postings').delete().eq('id', id);
}
```

### 3.3 Application 시드

지원(application) 생성 시 복합 ID(`{jobPostingId}_{applicantId}`) 패턴에 주의한다.
Supabase에서는 별도 UUID primary key를 사용할 수 있으나, 기존 코드베이스의 composite ID 패턴을 확인해야 한다.

```typescript
async function seedApplication(jobId: string, applicantId: string, status = 'applied') {
  const admin = getAdminClient();
  if (!admin) throw new Error('service_role key required');

  const { data, error } = await admin
    .from('applications')
    .insert({
      job_posting_id: jobId,
      applicant_id: applicantId,
      status,
      // confirmed 상태인 경우
      ...(status === 'confirmed' ? {
        confirmed_at: new Date().toISOString(),
        confirmed_by: TEST_ACCOUNTS.employer.uid,
      } : {}),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

async function cleanupApplication(id: string) {
  const admin = getAdminClient();
  await admin?.from('applications').delete().eq('id', id);
}
```

### 3.4 Work Log 시드

`work_logs` 테이블 INSERT 시 `payroll_status`(pending/completed) 상태 전환이 핵심이다.

```typescript
async function seedWorkLog(jobId: string, staffId: string, payrollStatus = 'pending') {
  const admin = getAdminClient();
  if (!admin) throw new Error('service_role key required');

  const workDate = '2026-04-01';

  const { data, error } = await admin
    .from('work_logs')
    .insert({
      job_posting_id: jobId,
      staff_id: staffId,
      work_date: workDate,
      check_in_time: `${workDate}T18:00:00+09:00`,
      check_out_time: `${workDate}T23:00:00+09:00`,
      status: payrollStatus === 'completed' ? 'completed' : 'checked_out',
      payroll_status: payrollStatus,
      ...(payrollStatus === 'completed' ? {
        payroll_amount: 150000,
        payroll_date: new Date().toISOString(),
      } : {}),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

async function cleanupWorkLog(id: string) {
  const admin = getAdminClient();
  await admin?.from('work_logs').delete().eq('id', id);
}
```

### 3.5 Report 시드 (있으면)

`reports` 테이블이 존재하는 경우 동일한 패턴으로 INSERT:

```typescript
async function seedReport(targetId: string, authorId: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error('service_role key required');

  const { data, error } = await admin
    .from('reports')
    .insert({
      target_id: targetId,
      author_id: authorId,
      reason: 'E2E 테스트용 리포트',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}
```

---

## 4. Playwright 테스트 구조 패턴

### beforeAll / afterAll 패턴

Firebase stub(`seedDocument`/`deleteDocument`) 대신 Supabase 함수로 교체하는 핵심 패턴:

```typescript
import { test } from '@playwright/test';
import path from 'path';
import { getAdminClient } from '@/e2e/helpers/supabase-admin';

// storageState 경로 — path.join으로 절대 경로 구성 (@ alias 불가)
const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');

test.describe('공고 상세와 지원 흐름', () => {
  let testJobId: string;

  test.beforeAll(async () => {
    // Firebase: await seedDocument('jobPostings', job.id, job)
    // Supabase:
    const admin = getAdminClient();
    if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요');

    const { data, error } = await admin
      .from('job_postings')
      .insert({ title: '상세테스트공고', status: 'active', /* ... */ })
      .select('id')
      .single();

    if (error) throw error;
    testJobId = data.id;
  });

  test.afterAll(async () => {
    // Firebase: await deleteDocument('jobPostings', testJobId)
    // Supabase:
    const admin = getAdminClient();
    await admin?.from('job_postings').delete().eq('id', testJobId);
  });

  test('인증된 사용자는 공고 상세 헤더를 본다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    // ... 테스트 로직
    await context.close();
  });
});
```

### Role별 로그인 방법

**방법 1 (권장): storageState 파일 사용**

global-setup이 미리 생성한 JSON 파일을 `browser.newContext()`에 전달한다.
UI 로그인 없이 Supabase auth 토큰 + Zustand auth-storage가 localStorage에 주입된다.

```typescript
const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');
const adminState = path.join(__dirname, '../../fixtures/storage-states/admin.json');

const context = await browser.newContext({ storageState: staffState });
```

**방법 2: 런타임 로그인**

```typescript
import { TEST_ACCOUNTS } from '@/e2e/fixtures/test-accounts';
import { LoginPage } from '@/e2e/pages/auth/login.page';

const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login(TEST_ACCOUNTS.staff.email, TEST_ACCOUNTS.staff.password);
await loginPage.waitForLoginSuccess();
```

**방법 3: auth-helpers.ts의 injectAuthState (보조적 사용)**

```typescript
import { injectAuthState } from '@/e2e/helpers/auth-helpers';
// Zustand auth-storage만 주입 (Supabase JWT 없음 → 일부 API 호출 실패 가능)
await injectAuthState(page, 'employer');
```

방법 3은 Supabase JWT가 없어 인증이 필요한 API 요청이 실패할 수 있다.
storageState 방법(방법 1)을 최우선으로 사용할 것.

---

## 5. RLS 주의사항

### service role vs anon key 사용 시점

| 작업 | 사용 키 | 이유 |
|------|---------|------|
| 테스트 데이터 INSERT (beforeAll) | service role | RLS 우회 필요 |
| 테스트 데이터 DELETE (afterAll) | service role | RLS 우회 필요 |
| 로그인 (signInWithSupabase) | anon key | 일반 사용자 인증 |
| 로그인 여부 확인 | anon key | 앱 동작 시뮬레이션 |

### RLS 정책 핵심 규칙

Supabase RLS에서 app role 체크는 다음 경로를 사용한다:

```sql
-- 잘못된 경로 (auth.jwt() ->> 'role' 는 DB role이지 앱 권한이 아님)
auth.jwt() ->> 'role'

-- 올바른 경로 (app_metadata에 저장된 앱 권한)
auth.jwt() -> 'app_metadata' ->> 'role'
```

### 어떤 작업에 service role이 필요한가

- `auth.users` 테이블 직접 조회/수정
- 다른 사용자 소유 데이터 INSERT/DELETE
- RLS 정책이 적용된 테이블의 테스트 데이터 관리
- `beforeAll`/`afterAll`의 모든 시딩/정리 작업

---

## 6. 절대 경로 금지 규칙 (★ CRITICAL)

### @/ alias 사용 규칙

spec 파일 내 모든 import는 반드시 `@/` alias를 사용한다.
단, `path.join(__dirname, ...)` 패턴은 파일 시스템 경로이므로 예외.

```typescript
// 금지 — 로컬 절대 경로 하드코딩
import { getAdminClient } from '/c/Users/user/Desktop/T-HOLDEM/uniqn-mobile/e2e/helpers/supabase-admin';
import { getAdminClient } from 'C:\\Users\\user\\Desktop\\T-HOLDEM\\...';

// 허용 — @/ alias 사용
import { getAdminClient } from '@/e2e/helpers/supabase-admin';
import { TEST_ACCOUNTS } from '@/e2e/fixtures/test-accounts';

// 허용 — storageState 경로는 path.join + __dirname
const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
```

### 금지 패턴 예시

```typescript
// 금지 1: Windows 절대 경로
'C:\\Users\\user\\Desktop\\T-HOLDEM\\uniqn-mobile\\e2e\\helpers\\supabase-admin'

// 금지 2: Unix 스타일 절대 경로
'/c/Users/user/Desktop/T-HOLDEM/uniqn-mobile/e2e/helpers/supabase-admin'

// 금지 3: ../.. 과도한 상대 경로 (import에서)
'../../../../helpers/supabase-admin'
```

### 검증 명령어

```bash
cd uniqn-mobile
# spec 파일에 절대 경로 하드코딩 여부 확인
grep -rn "C:\\\\Users\|/c/Users\|/Users/user" e2e/tests/ --include="*.ts"

# @/ alias 미사용 import 확인 (path.join 제외)
grep -rn "from '\.\./\.\./\.\." e2e/tests/ --include="*.ts"
```

---

## 7. 현재 passing spec에서 발견한 패턴

### auth-login.spec.ts 패턴

**파일 경로**: `uniqn-mobile/e2e/tests/p0-critical/auth-login.spec.ts`

- storageState 없이 비인증 상태에서 실행 (playwright.config의 기본 설정 사용)
- `LoginPage` page object를 `beforeEach`에서 초기화
- `TEST_ACCOUNTS.staff`의 실제 계정 정보로 로그인 테스트
- `createInvalidLoginData()` factory로 실패 케이스 생성
- `waitForAppReady()` 헬퍼로 앱 초기화 완료 대기

```typescript
// 핵심 패턴: Page Object + test.beforeEach
test.beforeEach(async ({ page }) => {
  loginPage = new LoginPage(page);
  await loginPage.goto();
});

// 핵심 패턴: 실제 QA 계정 사용
const { email, password } = TEST_ACCOUNTS.staff;
await loginPage.login(email, password);
await loginPage.waitForLoginSuccess();
```

### smoke.spec.ts 패턴

**파일 경로**: `uniqn-mobile/e2e/tests/p0-critical/smoke.spec.ts`

- storageState 없이 실행 (공개 페이지 검사)
- `waitForAppReady()` 헬퍼로 Expo Web 앱 초기화 대기
- `#root` locator로 Expo Web 렌더링 확인
- URL pathname으로 라우팅 상태 검증 (login/auth/schedule/qr)

```typescript
// 핵심 패턴: 앱 로드 확인
await page.goto('/', { waitUntil: 'domcontentloaded' });
await expect(page.locator('#root')).toBeAttached({ timeout: 15_000 });
await waitForAppReady(page);
```

### skipped spec(p1-important)에서 발견한 공통 패턴

3개 skipped spec(job-detail-apply, employer-applicants, employer-settlement)은 모두 동일한 구조:

```typescript
// 현재 패턴 (Firebase stub — no-op)
test.beforeAll(async () => {
  await seedDocument('jobPostings', job.id, job);  // stub: 아무것도 안 함
});
test.afterAll(async () => {
  await deleteDocument('jobPostings', job.id);     // stub: 아무것도 안 함
});
```

Wave 5 Phase 2에서 교체할 패턴:

```typescript
// 목표 패턴 (Supabase admin client)
test.beforeAll(async () => {
  const admin = getAdminClient();
  const { data } = await admin.from('job_postings').insert({ ... }).select('id').single();
  testJobId = data.id;
});
test.afterAll(async () => {
  const admin = getAdminClient();
  await admin?.from('job_postings').delete().eq('id', testJobId);
});
```

---

## 8. Phase 2 agents를 위한 체크리스트

spec 파일 재작성 전 반드시 확인:

- [ ] `import { seedDocument, deleteDocument } from '../../helpers/firebase-admin'` 제거
- [ ] `import { getAdminClient } from '@/e2e/helpers/supabase-admin'` 추가
- [ ] factory 함수(`createTestJob` 등)의 반환값과 Supabase 컬럼명(snake_case) 매핑 확인
- [ ] `test.describe.skip` → `test.describe`로 변경
- [ ] import 경로에 절대 경로 하드코딩 없는지 검증
- [ ] `E2E_SUPABASE_SERVICE_ROLE_KEY` 설정 여부 확인 후 실행

### 컬럼명 매핑 주의사항

factory 함수는 camelCase를 반환하지만 Supabase 테이블은 snake_case를 사용한다:

| factory 반환값 | Supabase 컬럼 |
|----------------|--------------|
| `jobPostingId` | `job_posting_id` |
| `applicantId` | `applicant_id` |
| `ownerId` | `owner_id` |
| `workDate` | `work_date` |
| `payrollStatus` | `payroll_status` |
| `checkInTime` | `check_in_time` |
| `checkOutTime` | `check_out_time` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
