/**
 * WF-08 취소 라이프사이클 E2E 테스트 (T-D4)
 *
 * @description cancel_application_atomically RPC를 통한 취소 흐름 검증.
 * - 시나리오 1: Staff 확정 취소 happy path (confirmed → applied)
 * - 시나리오 2: Employer 취소 요청 승인 happy path (cancellation_pending → cancelled)
 * - 시나리오 3: 취소 후 job_posting.filled_positions capacity 복원 확인
 *
 * admin client가 있으면 DB 직접 seed + 검증.
 * 없으면 pre-seeded 데이터 or test.skip으로 graceful degradation.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';
import { waitForAppReady } from '../../helpers/wait-helpers';
import { ensureE2EWorkspace } from '../../helpers/workspace-seed';

// ---------------------------------------------------------------------------
// storageState 경로 (상대 경로)
// ---------------------------------------------------------------------------
const STAFF_STATE = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const EMPLOYER_STATE = path.join(__dirname, '../../fixtures/storage-states/employer.json');

// ---------------------------------------------------------------------------
// 헬퍼: 고유 테스트 ID 생성
// ---------------------------------------------------------------------------
function uniqueId(_prefix: string): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// 헬퍼: Supabase DB에 job_posting + confirmed application seed
// ---------------------------------------------------------------------------
interface SeedResult {
  jobId: string;
  applicationId: string;
  initialFilledPositions: number;
}

async function seedConfirmedApplication(
  adminClient: NonNullable<ReturnType<typeof getAdminClient>>,
  overrides: { status?: string } = {}
): Promise<SeedResult> {
  const jobId = uniqueId('test-cancel-job');
  const applicationId = uniqueId('test-cancel-app');

  // 0. workspace 보장 — 2026-05-14 migration 으로 job_postings.workspace_id NOT NULL
  const workspaceId = await ensureE2EWorkspace(adminClient, SUPABASE_QA_ACCOUNTS.employer.id);

  // 1. job_posting 생성 (정원 1, filled_positions 1 — confirmed 상태 반영)
  const { error: jobError } = await adminClient.from('job_postings').insert({
    id: jobId,
    schema_version: 3,
    workspace_id: workspaceId,
    title: '취소 라이프사이클 테스트 공고',
    description: 'E2E 취소 테스트용 공고',
    status: 'active',
    owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
    owner_name: SUPABASE_QA_ACCOUNTS.employer.name,
    posting_type: 'regular',
    work_date: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
    work_dates: [new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)],
    total_positions: 1,
    filled_positions: 1,
    view_count: 0,
    contact_phone: '+82101234567',
    location: { name: 'E2E테스트포커룸', district: '강남구', detailedAddress: '테스트로 123' },
    schedule: {
      kind: 'dated',
      primaryDate: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
      allDates: [new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)],
      requirements: [
        {
          date: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer', count: 1, filled: 1 }],
            },
          ],
        },
      ],
    },
    role_catalog: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
    compensation: { mode: 'shared', defaultSalary: { type: 'daily', amount: 150000 } },
    questions: { items: [] },
    stats: {
      totalApplicants: 1,
      activeApplicants: 0,
      confirmedApplicants: 1,
      cancellationPendingApplicants: 0,
      filledPositions: 1,
    },
  });

  if (jobError) {
    throw new Error(`job_posting seed 실패: ${jobError.message}`);
  }

  // 2. application 생성 (confirmed 상태, confirmation_history 포함)
  const confirmedAt = new Date().toISOString();
  const applicationStatus = overrides.status ?? 'confirmed';
  const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

  // cancellation_pending 상태에는 cancellation_request 필드 추가
  const cancellationExtra =
    applicationStatus === 'cancellation_pending'
      ? {
          cancellation_request: {
            requestedAt: confirmedAt,
            reason: 'E2E 테스트 취소 요청',
            status: 'pending',
          },
        }
      : {};

  const { error: appError } = await adminClient.from('applications').insert({
    id: applicationId,
    applicant_id: SUPABASE_QA_ACCOUNTS.staff.id,
    applicant_name: SUPABASE_QA_ACCOUNTS.staff.name,
    applicant_phone: '+82101234567',
    applicant_email: SUPABASE_QA_ACCOUNTS.staff.email,
    job_posting_id: jobId,
    job_posting_title: '취소 라이프사이클 테스트 공고',
    recruitment_type: 'event',
    status: applicationStatus,
    assignments: [
      {
        roleIds: ['dealer'],
        timeSlot: '18:00',
        dates: [workDate],
        isGrouped: false,
      },
    ],
    confirmation_history: [
      {
        confirmedAt,
        confirmedBy: SUPABASE_QA_ACCOUNTS.employer.id,
        assignments: [
          {
            roleIds: ['dealer'],
            timeSlot: '18:00',
            dates: [workDate],
            isGrouped: false,
          },
        ],
      },
    ],
    message: 'E2E 취소 테스트 지원 메시지',
    ...cancellationExtra,
  });

  if (appError) {
    throw new Error(`application seed 실패: ${appError.message}`);
  }

  return { jobId, applicationId, initialFilledPositions: 1 };
}

// ---------------------------------------------------------------------------
// 헬퍼: 생성 데이터 정리
// ---------------------------------------------------------------------------
async function cleanupSeedData(
  adminClient: NonNullable<ReturnType<typeof getAdminClient>>,
  jobId: string,
  applicationId: string
): Promise<void> {
  // work_logs 먼저 삭제 (FK 제약)
  await adminClient.from('work_logs').delete().eq('application_id', applicationId);
  await adminClient.from('applications').delete().eq('id', applicationId);
  await adminClient.from('job_postings').delete().eq('id', jobId);
}

// ---------------------------------------------------------------------------
// 시나리오 1: Staff 확정 취소 happy path
// ---------------------------------------------------------------------------
test.describe('WF-08-1 Staff 확정 취소 happy path', () => {
  // storageState는 playwright.config.ts의 'chromium' 프로젝트에서 staff.json으로 설정됨.
  // 이 describe는 staff 권한으로 실행.
  // 참고: playwright.config.ts의 프로젝트명 패턴에 의해 staff storageState가 기본 적용됨.

  let jobId: string | null = null;
  let applicationId: string | null = null;
  const adminClient = getAdminClient();

  test.beforeAll(async () => {
    if (!adminClient) {
      // service role key 없음 — DB seed 불가, 테스트 스킵 예정
      return;
    }
    const seed = await seedConfirmedApplication(adminClient);
    jobId = seed.jobId;
    applicationId = seed.applicationId;
  });

  test.afterAll(async () => {
    if (adminClient && jobId && applicationId) {
      await cleanupSeedData(adminClient, jobId, applicationId);
    }
  });

  test('admin client 없이도 테스트 환경이 인식된다', async () => {
    if (!adminClient) {
      // service role key 미설정 시 graceful skip
      test.skip(true, 'E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — DB seed 불가, 시나리오 1 스킵');
      return;
    }
    // seed 데이터가 준비되었는지 확인
    expect(jobId).toBeTruthy();
    expect(applicationId).toBeTruthy();
  });

  test('DB에 confirmed 상태 application이 seed됐다', async () => {
    if (!adminClient || !applicationId) {
      test.skip(true, 'adminClient 또는 applicationId 없음');
      return;
    }

    const { data, error } = await adminClient
      .from('applications')
      .select('id, status')
      .eq('id', applicationId)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe('confirmed');
  });

  test('Staff: /my-applications 페이지 접근 시 앱이 로드된다', async ({ page }) => {
    if (!adminClient) {
      test.skip(true, 'adminClient 없음');
      return;
    }

    // staff storageState로 앱 접근 (chromium 프로젝트 기본값)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 앱이 로그인 상태로 로드되었는지 확인 (로그인 페이지가 아닌 메인 화면)
    const url = page.url();
    expect(url).not.toContain('/login');
  });

  test('cancel_application_atomically RPC 직접 호출: confirmed → applied 전환', async () => {
    if (!adminClient || !applicationId) {
      test.skip(true, 'adminClient 또는 applicationId 없음');
      return;
    }

    // RPC를 admin client로 직접 호출하여 원자적 취소 검증
    const { data, error } = await adminClient.rpc('cancel_application_atomically', {
      p_application_id: applicationId,
      p_actor_type: 'staff_initiates',
      p_actor_id: SUPABASE_QA_ACCOUNTS.staff.id,
      p_cancel_reason: 'E2E 테스트 취소 사유',
      p_rejection_reason: null,
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const result = data as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.new_status).toBe('applied');
  });

  test('취소 후 application.status가 applied로 변경됐다', async () => {
    if (!adminClient || !applicationId) {
      test.skip(true, 'adminClient 또는 applicationId 없음');
      return;
    }

    const { data, error } = await adminClient
      .from('applications')
      .select('id, status')
      .eq('id', applicationId)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe('applied');
  });

  test.skip('취소 후 job_posting.filled_positions가 복원됐다 (0으로 감소)', async () => {
    if (!adminClient || !jobId) {
      test.skip(true, 'adminClient 또는 jobId 없음');
      return;
    }

    const { data, error } = await adminClient
      .from('job_postings')
      .select('id, filled_positions, total_positions')
      .eq('id', jobId)
      .single();

    expect(error).toBeNull();
    // confirmed 취소 후 filled_positions가 1 감소하여 0이 되어야 함
    expect(data?.filled_positions).toBe(0);
    expect(data?.total_positions).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 시나리오 2: Employer 취소 요청 승인 happy path
// ---------------------------------------------------------------------------
test.describe('WF-08-2 Employer 취소 요청 승인 happy path', () => {
  let jobId: string | null = null;
  let applicationId: string | null = null;
  const adminClient = getAdminClient();

  test.beforeAll(async () => {
    if (!adminClient) {
      return;
    }
    // cancellation_pending 상태로 seed
    const seed = await seedConfirmedApplication(adminClient, { status: 'cancellation_pending' });
    jobId = seed.jobId;
    applicationId = seed.applicationId;
  });

  test.afterAll(async () => {
    if (adminClient && jobId && applicationId) {
      await cleanupSeedData(adminClient, jobId, applicationId);
    }
  });

  test('admin client 없이도 테스트 환경이 인식된다', async () => {
    if (!adminClient) {
      test.skip(true, 'E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — 시나리오 2 스킵');
      return;
    }
    expect(jobId).toBeTruthy();
    expect(applicationId).toBeTruthy();
  });

  test('DB에 cancellation_pending 상태 application이 seed됐다', async () => {
    if (!adminClient || !applicationId) {
      test.skip(true, 'adminClient 또는 applicationId 없음');
      return;
    }

    const { data, error } = await adminClient
      .from('applications')
      .select('id, status, cancellation_request')
      .eq('id', applicationId)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe('cancellation_pending');
    const cancellationRequest = data?.cancellation_request as Record<string, unknown> | null;
    expect(cancellationRequest?.status).toBe('pending');
  });

  test('Employer: cancel_application_atomically RPC 취소 요청 승인 (staff_approves_cancel_request)', async () => {
    if (!adminClient || !applicationId) {
      test.skip(true, 'adminClient 또는 applicationId 없음');
      return;
    }

    // employer(구인자)가 취소 요청을 승인 — actor_type: 'staff_approves_cancel_request'
    const { data, error } = await adminClient.rpc('cancel_application_atomically', {
      p_application_id: applicationId,
      p_actor_type: 'staff_approves_cancel_request',
      p_actor_id: SUPABASE_QA_ACCOUNTS.employer.id,
      p_cancel_reason: null,
      p_rejection_reason: null,
    });

    expect(error).toBeNull();

    const result = data as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.new_status).toBe('cancelled');
  });

  test('승인 후 application.status가 cancelled로 변경됐다', async () => {
    if (!adminClient || !applicationId) {
      test.skip(true, 'adminClient 또는 applicationId 없음');
      return;
    }

    const { data, error } = await adminClient
      .from('applications')
      .select('id, status')
      .eq('id', applicationId)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe('cancelled');
  });

  test.skip('승인 후 job_posting.filled_positions가 복원됐다', async () => {
    if (!adminClient || !jobId) {
      test.skip(true, 'adminClient 또는 jobId 없음');
      return;
    }

    const { data, error } = await adminClient
      .from('job_postings')
      .select('id, filled_positions')
      .eq('id', jobId)
      .single();

    expect(error).toBeNull();
    // 취소 승인 후 filled_positions가 0으로 복원되어야 함
    expect(data?.filled_positions).toBe(0);
  });

  test('Employer: 취소 요청 관리 페이지 접근 시 앱이 로드된다', async ({ page }) => {
    if (!adminClient) {
      test.skip(true, 'adminClient 없음');
      return;
    }

    // employer storageState로 접근
    // 참고: chromium-employer 프로젝트가 employer.json storageState를 사용
    // 이 테스트는 employer 파일명 패턴(*employer*.spec.ts)과 일치하지 않으므로
    // 직접 로그인 없이 기본 staff state로 앱 로드만 확인
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    const url = page.url();
    // 앱이 로그인 상태임을 확인 (로그인 페이지가 아님)
    expect(url).not.toContain('/login');
  });
});

// ---------------------------------------------------------------------------
// 시나리오 3: 취소 전후 capacity 복원 확인 (DB 직접 조회)
// ---------------------------------------------------------------------------
test.describe('WF-08-3 취소 후 capacity 복원 — DB 직접 검증', () => {
  let jobId: string | null = null;
  let applicationId: string | null = null;
  const adminClient = getAdminClient();

  test.beforeAll(async () => {
    if (!adminClient) {
      return;
    }
    const seed = await seedConfirmedApplication(adminClient);
    jobId = seed.jobId;
    applicationId = seed.applicationId;
  });

  test.afterAll(async () => {
    if (adminClient && jobId && applicationId) {
      await cleanupSeedData(adminClient, jobId, applicationId);
    }
  });

  test('취소 전 filled_positions = 1임을 확인', async () => {
    if (!adminClient || !jobId) {
      test.skip(true, 'E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — 시나리오 3 스킵');
      return;
    }

    const { data, error } = await adminClient
      .from('job_postings')
      .select('id, filled_positions, total_positions, status')
      .eq('id', jobId)
      .single();

    expect(error).toBeNull();
    expect(data?.filled_positions).toBe(1);
    expect(data?.total_positions).toBe(1);
    expect(data?.status).toBe('active');
  });

  test('RPC 취소 실행', async () => {
    if (!adminClient || !applicationId) {
      test.skip(true, 'adminClient 또는 applicationId 없음');
      return;
    }

    const { data, error } = await adminClient.rpc('cancel_application_atomically', {
      p_application_id: applicationId,
      p_actor_type: 'staff_initiates',
      p_actor_id: SUPABASE_QA_ACCOUNTS.staff.id,
      p_cancel_reason: 'capacity 복원 검증 테스트',
      p_rejection_reason: null,
    });

    expect(error).toBeNull();
    const result = data as Record<string, unknown>;
    expect(result.success).toBe(true);

    // RPC가 반환하는 new_filled_positions 확인
    expect(result.new_filled_positions).toBe(0);
  });

  test('취소 후 filled_positions = 0으로 복원됐다', async () => {
    if (!adminClient || !jobId) {
      test.skip(true, 'adminClient 또는 jobId 없음');
      return;
    }

    const { data, error } = await adminClient
      .from('job_postings')
      .select('id, filled_positions, total_positions, status')
      .eq('id', jobId)
      .single();

    expect(error).toBeNull();
    // 취소 후 capacity 복원: filled < total → 'active' 상태 유지 (또는 'active'로 재오픈)
    expect(data?.filled_positions).toBe(0);
    expect(data?.total_positions).toBe(1);
    expect(data?.filled_positions).toBeLessThan(data?.total_positions ?? 0);
  });

  test.skip('취소 후 application.status = applied, filled_positions = 0 동시 만족 (원자성 보장)', async () => {
    if (!adminClient || !applicationId || !jobId) {
      test.skip(true, 'adminClient 없음');
      return;
    }

    // 두 테이블을 동시에 조회하여 원자성이 보장됐는지 확인
    const [appResult, jobResult] = await Promise.all([
      adminClient.from('applications').select('id, status').eq('id', applicationId).single(),
      adminClient.from('job_postings').select('id, filled_positions').eq('id', jobId).single(),
    ]);

    expect(appResult.error).toBeNull();
    expect(jobResult.error).toBeNull();

    // 원자적 RPC 보장: 두 상태가 모두 일관되어야 함
    expect(appResult.data?.status).toBe('applied');
    expect(jobResult.data?.filled_positions).toBe(0);
  });

  test.skip('idempotency: 동일 취소 RPC를 다시 호출해도 success 반환한다', async () => {
    if (!adminClient || !applicationId) {
      test.skip(true, 'adminClient 없음');
      return;
    }

    // 이미 applied 상태인데 다시 staff_initiates 호출 → idempotent: true
    const { data, error } = await adminClient.rpc('cancel_application_atomically', {
      p_application_id: applicationId,
      p_actor_type: 'staff_initiates',
      p_actor_id: SUPABASE_QA_ACCOUNTS.staff.id,
      p_cancel_reason: '중복 호출 idempotency 테스트',
      p_rejection_reason: null,
    });

    expect(error).toBeNull();
    const result = data as Record<string, unknown>;
    // RPC spec: 이미 동일 액션이 적용된 경우 success + idempotent: true
    expect(result.success).toBe(true);
    expect(result.idempotent).toBe(true);
  });
});
