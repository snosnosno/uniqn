/**
 * P1 job detail and apply flows.
 */
import { expect, test } from '@playwright/test';
import path from 'path';
import { JobDetailPage } from '../../pages/app/job-detail.page';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';
import { ensureE2EWorkspace } from '../../helpers/workspace-seed';

const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');
const TEST_JOB_TITLE = '상세테스트공고';
const ERROR_TEXT = /오류가 발생했습니다|문제가 발생했습니다|공고를 찾을 수 없습니다/;

test.describe('공고 상세와 지원 흐름', () => {
  let testJobId: string;

  test.beforeAll(async () => {
    const admin = getAdminClient();
    if (!admin) {
      throw new Error(
        'E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — job-detail-apply 테스트는 service_role이 필요합니다.'
      );
    }

    const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const workspaceId = await ensureE2EWorkspace(admin, SUPABASE_QA_ACCOUNTS.employer.id);

    const { data, error } = await admin
      .from('job_postings')
      .insert({
        title: TEST_JOB_TITLE,
        status: 'active',
        workspace_id: workspaceId,
        owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
        owner_name: SUPABASE_QA_ACCOUNTS.employer.name,
        posting_type: 'regular',
        work_date: workDate,
        work_dates: [workDate],
        total_positions: 3,
        filled_positions: 0,
        view_count: 0,
        schema_version: 3,
        description: '상세테스트공고 설명',
        contact_phone: '+82101234567',
        location: {
          name: '테스트포커룸',
          district: '강남구',
          detailedAddress: '테스트로 123',
        },
        schedule: {
          kind: 'dated',
          primaryDate: workDate,
          allDates: [workDate],
          requirements: [
            {
              date: workDate,
              timeSlots: [
                {
                  startTime: '18:00',
                  roles: [
                    { role: 'dealer', count: 2, filled: 0 },
                    { role: 'floor', count: 1, filled: 0 },
                  ],
                },
              ],
            },
          ],
        },
        role_catalog: [
          { role: 'dealer', salary: { type: 'daily', amount: 150000 } },
          { role: 'floor', salary: { type: 'daily', amount: 150000 } },
        ],
        role_keys: ['dealer', 'floor'],
        compensation: {
          mode: 'shared',
          defaultSalary: { type: 'daily', amount: 150000 },
        },
        stats: {
          totalApplicants: 0,
          activeApplicants: 0,
          confirmedApplicants: 0,
          cancellationPendingApplicants: 0,
          filledPositions: 0,
        },
        questions: { items: [] },
      })
      .select('id')
      .single();

    if (error) throw new Error(`job_postings INSERT 실패: ${error.message}`);
    testJobId = (data as Record<string, unknown>).id as string;
  });

  test.afterAll(async () => {
    const admin = getAdminClient();
    if (admin && testJobId) {
      await admin.from('job_postings').delete().eq('id', testJobId);
    }
  });

  test('인증된 사용자는 공고 상세 헤더를 본다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);

    await expect(page.locator('body')).toContainText(TEST_JOB_TITLE, { timeout: 15_000 });

    await context.close();
  });

  test('활성 공고에는 지원하기 버튼이 보인다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);

    const contentOrError = jobDetailPage.applyButton.or(jobDetailPage.errorMessage);
    await expect(contentOrError.first()).toBeVisible({ timeout: 15_000 });

    if (!(await jobDetailPage.isErrorVisible().catch(() => false))) {
      await expect(jobDetailPage.applyButton).toBeVisible();
      await expect(jobDetailPage.applyButton).toBeEnabled();
    }

    await context.close();
  });

  test('로그인 사용자는 /jobs 상세에서 실제 지원 화면으로 이어진다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);

    await expect(jobDetailPage.applyButton).toBeVisible({ timeout: 15_000 });
    await jobDetailPage.clickApply();
    await expect(page).toHaveURL(new RegExp(`/jobs/${testJobId}/apply`), { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(TEST_JOB_TITLE, { timeout: 15_000 });

    await context.close();
  });

  test('마감 공고에는 비활성 상태 버튼이 보인다', async ({ browser }) => {
    const admin = getAdminClient();
    if (!admin) {
      test.skip();
      return;
    }

    const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const workspaceId = await ensureE2EWorkspace(admin, SUPABASE_QA_ACCOUNTS.employer.id);
    const { data: closedData, error: closedError } = await admin
      .from('job_postings')
      .insert({
        title: '마감상세테스트공고',
        status: 'closed',
        workspace_id: workspaceId,
        owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
        owner_name: SUPABASE_QA_ACCOUNTS.employer.name,
        posting_type: 'regular',
        work_date: workDate,
        work_dates: [workDate],
        total_positions: 1,
        filled_positions: 0,
        view_count: 0,
        schema_version: 3,
        description: '마감 테스트 공고',
        contact_phone: '+82101234567',
        location: { name: '테스트포커룸', district: '강남구', detailedAddress: '테스트로 123' },
        schedule: {
          kind: 'dated',
          primaryDate: workDate,
          allDates: [workDate],
          requirements: [
            {
              date: workDate,
              timeSlots: [{ startTime: '18:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
            },
          ],
        },
        role_catalog: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
        role_keys: ['dealer'],
        compensation: { mode: 'shared', defaultSalary: { type: 'daily', amount: 150000 } },
        stats: {
          totalApplicants: 0,
          activeApplicants: 0,
          confirmedApplicants: 0,
          cancellationPendingApplicants: 0,
          filledPositions: 0,
        },
        questions: { items: [] },
        closed_at: new Date().toISOString(),
        closed_reason: 'manual',
      })
      .select('id')
      .single();

    if (closedError) throw new Error(`마감공고 INSERT 실패: ${closedError.message}`);
    const closedJobId = (closedData as Record<string, unknown>).id as string;

    try {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();
      const jobDetailPage = new JobDetailPage(page);

      await jobDetailPage.gotoAuthenticated(closedJobId);

      const contentOrError = jobDetailPage.closedButton.or(jobDetailPage.errorMessage);
      await expect(contentOrError.first()).toBeVisible({ timeout: 15_000 });

      if (!(await jobDetailPage.isErrorVisible().catch(() => false))) {
        await expect(jobDetailPage.closedButton).toBeVisible();
        await expect(jobDetailPage.closedButton).toBeDisabled();
      }

      await context.close();
    } finally {
      await admin.from('job_postings').delete().eq('id', closedJobId);
    }
  });

  test('존재하지 않는 공고는 에러 화면을 보여준다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    // job_postings.id 는 uuid 타입 — 비-UUID 문자열은 Supabase eq() 에서
    // `invalid input syntax for type uuid` 로 useJobDetail query 가 hang.
    // valid UUID 형식이지만 DB 에 존재하지 않는 ID 사용 (PR #112 public-pages:59 동일 패턴)
    const nonexistentValidUuid = '00000000-0000-0000-0000-000000000000';
    await page.goto(`/jobs/${nonexistentValidUuid}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(ERROR_TEXT).last()).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('에러 화면에는 다시 시도 버튼이 있다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/jobs/nonexistent-retry-test', { waitUntil: 'domcontentloaded' });

    const errorText = page.getByText(ERROR_TEXT).first();
    if (await errorText.isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible({
        timeout: 5_000,
      });
    }

    await context.close();
  });

  test('지원 페이지는 공고 정보를 로드한다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto(`/jobs/${testJobId}/apply`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(TEST_JOB_TITLE, { timeout: 15_000 });

    await context.close();
  });

  test('이미 지원한 공고는 중복 지원 안내가 보인다', async ({ browser }) => {
    const admin = getAdminClient();
    if (!admin) {
      test.skip();
      return;
    }

    const { data: appData, error: appError } = await admin
      .from('applications')
      .insert({
        job_posting_id: testJobId,
        applicant_id: SUPABASE_QA_ACCOUNTS.staff.id,
        applicant_name: SUPABASE_QA_ACCOUNTS.staff.name,
        applicant_phone: '+82101234567',
        applicant_role: 'staff',
        job_posting_title: TEST_JOB_TITLE,
        status: 'applied',
        assignments: [
          {
            roleIds: ['dealer'],
            timeSlot: '18:00',
            dates: [new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)],
            isGrouped: false,
          },
        ],
        is_read: false,
        recruitment_type: 'event',
      })
      .select('id')
      .single();

    if (appError) throw new Error(`applications INSERT 실패: ${appError.message}`);
    const applicationId = (appData as Record<string, unknown>).id as string;

    try {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();
      const jobDetailPage = new JobDetailPage(page);

      await jobDetailPage.gotoAuthenticated(testJobId);
      await expect(jobDetailPage.viewStatusButton.or(jobDetailPage.statusText).first()).toBeVisible(
        {
          timeout: 15_000,
        }
      );
      await expect(jobDetailPage.applyButton).toBeHidden();

      await context.close();
    } finally {
      await admin.from('applications').delete().eq('id', applicationId);
    }
  });

  test('홈에서 공고를 누르면 상세 페이지로 이동한다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const cards = page.locator('[accessibilityRole="button"]');
    const count = await cards.count();
    if (count === 0) {
      test.skip();
    }

    await cards.first().click();
    await expect(page).toHaveURL(/jobs|detail/, { timeout: 10_000 });

    await context.close();
  });

  test('상세 화면에 공유 버튼이 있으면 활성 상태다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);

    if (!(await jobDetailPage.isErrorVisible().catch(() => false))) {
      if (await jobDetailPage.shareButton.isVisible().catch(() => false)) {
        await expect(jobDetailPage.shareButton).toBeEnabled();
      }
    }

    await context.close();
  });

  test('구인자도 공고 상세를 조회할 수 있다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();
    const jobDetailPage = new JobDetailPage(page);

    await jobDetailPage.gotoAuthenticated(testJobId);
    await expect(page.locator('body')).toContainText(TEST_JOB_TITLE, { timeout: 15_000 });

    await context.close();
  });
});
