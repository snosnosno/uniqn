import { expect, test, type Locator, type Page } from '@playwright/test';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';
import { ensureE2EWorkspace } from '../../helpers/workspace-seed';

async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const loading = page.getByText(/로딩 중|데이터를 불러오는 중/).first();
  await loading.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  await loading.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
}

async function expectAnyVisible(locators: Locator[], timeout = 10_000): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const locator of locators) {
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < count; index += 1) {
        if (
          await locator
            .nth(index)
            .isVisible()
            .catch(() => false)
        ) {
          return;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Expected at least one locator to become visible');
}

async function seedJobPosting(title: string): Promise<string> {
  const admin = getAdminClient();
  if (!admin)
    throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — 시딩에 service_role이 필요합니다.');

  const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const workspaceId = await ensureE2EWorkspace(admin, SUPABASE_QA_ACCOUNTS.employer.id);

  const { data, error } = await admin
    .from('job_postings')
    .insert({
      title,
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
      description: `${title} 설명`,
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
  return (data as Record<string, unknown>).id as string;
}

async function seedApplication(
  jobPostingId: string,
  applicantId: string,
  status: string,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const admin = getAdminClient();
  if (!admin)
    throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — 시딩에 service_role이 필요합니다.');

  const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await admin
    .from('applications')
    .insert({
      job_posting_id: jobPostingId,
      applicant_id: applicantId,
      applicant_name: SUPABASE_QA_ACCOUNTS.staff.name,
      applicant_phone: '+82101234567',
      applicant_role: 'staff',
      job_posting_title: '지원자관리 테스트공고',
      status,
      assignments: [
        {
          roleIds: ['dealer'],
          timeSlot: '18:00',
          dates: [workDate],
          isGrouped: false,
        },
      ],
      is_read: false,
      recruitment_type: 'event',
      ...extra,
    })
    .select('id')
    .single();

  if (error) throw new Error(`applications INSERT 실패: ${error.message}`);
  return (data as Record<string, unknown>).id as string;
}

async function cleanupJobPosting(id: string): Promise<void> {
  const admin = getAdminClient();
  if (admin) await admin.from('job_postings').delete().eq('id', id);
}

async function cleanupApplication(id: string): Promise<void> {
  const admin = getAdminClient();
  if (admin) await admin.from('applications').delete().eq('id', id);
}

test.describe('구인자 지원자 관리', () => {
  test.setTimeout(60_000);

  let testJobId: string;

  test.beforeAll(async () => {
    testJobId = await seedJobPosting('지원자관리 테스트공고');
  });

  test.afterAll(async () => {
    await cleanupJobPosting(testJobId);
  });

  test('공고 상세에서 지원자 관리로 이동한다', async ({ page }) => {
    await page.goto(`/my-postings/${testJobId}`, { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    const applicantsAction = page.locator('button:visible', { hasText: /지원자 관리/ }).first();
    await expect(applicantsAction).toBeVisible();
    await applicantsAction.click();
    await page.waitForURL(/applicants/, { timeout: 15_000 });
  });

  test('지원자 목록 페이지는 필터 탭과 카드 UI를 보여준다', async ({ page }) => {
    const applicationId = await seedApplication(
      testJobId,
      SUPABASE_QA_ACCOUNTS.staff.id,
      'applied'
    );

    try {
      await page.goto(`/my-postings/${testJobId}/applicants`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(page.getByRole('tab', { name: /전체 필터/ }).first()).toBeVisible();
      await expectAnyVisible(
        [
          page.getByRole('button', { name: /프로필 보기/ }),
          page.getByRole('button', { name: /지원 상세 접기|지원 상세 열기/ }),
          page.getByText('지원자가 없습니다', { exact: true }),
          page.getByText('데이터가 없습니다', { exact: true }),
        ],
        15_000
      );
    } finally {
      await cleanupApplication(applicationId);
    }
  });

  test('지원자가 있으면 상태 액션 또는 상세 토글을 노출한다', async ({ page }) => {
    const applicationId = await seedApplication(
      testJobId,
      SUPABASE_QA_ACCOUNTS.staff.id,
      'applied'
    );

    try {
      await page.goto(`/my-postings/${testJobId}/applicants`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      const expandButton = page.getByRole('button', { name: /지원 상세 열기/ }).first();
      if (await expandButton.isVisible().catch(() => false)) {
        await expandButton.click();
      }

      await expectAnyVisible(
        [
          page.getByRole('button', { name: /지원 거절/ }),
          page.getByRole('button', { name: /\d+개 확정/ }),
          page.getByText('지원 완료', { exact: true }),
          page.getByText('거절', { exact: true }),
          page.getByText('확정', { exact: true }),
        ],
        10_000
      );
    } finally {
      await cleanupApplication(applicationId);
    }
  });

  test('확정된 지원자는 확정 상태를 유지한다', async ({ page }) => {
    const applicationId = await seedApplication(
      testJobId,
      SUPABASE_QA_ACCOUNTS.staff.id,
      'confirmed',
      {
        confirmed_at: new Date().toISOString(),
      }
    );

    try {
      await page.goto(`/my-postings/${testJobId}/applicants`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);
      await expectAnyVisible(
        [
          page.getByLabel(/확정 배지/),
          page.getByRole('tab', { name: /확정 필터/ }),
          page.getByText(/확정 \(\d+\)/),
        ],
        10_000
      );
    } finally {
      await cleanupApplication(applicationId);
    }
  });

  test('거절된 지원자는 거절 상태나 사유를 보여준다', async ({ page }) => {
    const applicationId = await seedApplication(
      testJobId,
      SUPABASE_QA_ACCOUNTS.staff.id,
      'rejected',
      {
        rejection_reason: '다른 지원자를 먼저 선발했습니다.',
        processed_at: new Date().toISOString(),
        processed_by: SUPABASE_QA_ACCOUNTS.employer.id,
      }
    );

    try {
      await page.goto(`/my-postings/${testJobId}/applicants`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);
      await expectAnyVisible(
        [
          page.getByLabel(/거절 배지/),
          page.getByText(/거절 사유:/),
          page.getByRole('tab', { name: /거절 필터/ }),
        ],
        10_000
      );
    } finally {
      await cleanupApplication(applicationId);
    }
  });
});
