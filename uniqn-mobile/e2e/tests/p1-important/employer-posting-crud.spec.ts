import { expect, test, type Locator, type Page } from '@playwright/test';
import { getAdminClient } from '../../helpers/supabase-admin';
import { getDefaultWorkspaceId } from '../../helpers/workspace-seed';
import { TEST_ACCOUNTS } from '../../fixtures/test-accounts';

async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(1_000);
}

function visibleByTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`).first();
}

async function seedJobPosting(
  title: string,
  status: 'active' | 'closed' | 'cancelled' = 'active'
): Promise<string> {
  const admin = getAdminClient();
  if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요 — job_postings 시드 불가');

  const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  // 앱이 현재 워크스페이스로 보여주는 기본(가장 오래된 owned) 워크스페이스에 시드해야
  // /employer 리스트에 노출된다. 별도 'E2E 테스트 워크스페이스' 에 넣으면 0건으로 보임.
  const workspaceId = await getDefaultWorkspaceId(admin, TEST_ACCOUNTS.employer.uid);

  const { data, error } = await admin
    .from('job_postings')
    .insert({
      title,
      status,
      workspace_id: workspaceId,
      owner_id: TEST_ACCOUNTS.employer.uid,
      owner_name: TEST_ACCOUNTS.employer.displayName,
      work_date: workDate,
      work_dates: [workDate],
      posting_type: 'regular',
      total_positions: 2,
      filled_positions: 0,
      view_count: 0,
      schema_version: 3,
      description: `E2E 테스트 공고 — ${title}`,
      contact_phone: '+82101234567',
      location: {
        name: '테스트홀덤펍',
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
                roles: [{ role: 'dealer', count: 2, filled: 0 }],
              },
            ],
          },
        ],
      },
      role_catalog: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
      compensation: { mode: 'shared', defaultSalary: { type: 'daily', amount: 150000 } },
      questions: { items: [] },
      stats: {
        totalApplicants: 0,
        activeApplicants: 0,
        confirmedApplicants: 0,
        cancellationPendingApplicants: 0,
        filledPositions: 0,
      },
      ...(status === 'closed'
        ? {
            closed_at: new Date().toISOString(),
            closed_reason: 'manual',
          }
        : {}),
    })
    .select('id')
    .single();

  if (error) throw new Error(`job_postings INSERT 실패: ${error.message}`);
  return data.id as string;
}

async function cleanupJobPosting(id: string): Promise<void> {
  const admin = getAdminClient();
  await admin?.from('job_postings').delete().eq('id', id);
}

test.describe('Employer posting CRUD', () => {
  test.setTimeout(60_000);

  test('shows seeded postings and filter tabs on the list page', async ({ page }) => {
    const activeId = await seedJobPosting('crud-list-active', 'active');
    const closedId = await seedJobPosting('crud-list-closed', 'closed');

    try {
      await page.goto('/employer', { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(page.locator('button:has-text("crud-list-active"):visible').first()).toBeVisible(
        {
          timeout: 15_000,
        }
      );
      await expect(
        page.locator('button:has-text("crud-list-closed"):visible').first()
      ).toBeVisible();
      const tabCount = await page.getByRole('tab').count();
      expect(tabCount).toBeGreaterThanOrEqual(3);
    } finally {
      await cleanupJobPosting(activeId);
      await cleanupJobPosting(closedId);
    }
  });

  test('renders required controls on the create page', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    await expect(visibleByTestId(page, 'job-posting-title-input')).toBeVisible({ timeout: 15_000 });
    await expect(visibleByTestId(page, 'job-posting-location-name-input')).toBeVisible();
    await expect(visibleByTestId(page, 'job-posting-location-address-input')).toBeVisible();
    await expect(visibleByTestId(page, 'job-posting-add-date-button')).toBeVisible();
    await expect(visibleByTestId(page, 'job-posting-create-submit')).toBeVisible();
  });

  test('stays on the create page when submitting empty', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    await visibleByTestId(page, 'job-posting-create-submit').click();
    await expect(page).toHaveURL(/\/my-postings\/create/);
    await expect(visibleByTestId(page, 'job-posting-title-input')).toBeVisible();
  });

  test('caps title length at the input limit', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    const titleInput = visibleByTestId(page, 'job-posting-title-input');
    await titleInput.fill('a'.repeat(40));
    await visibleByTestId(page, 'job-posting-description-input').click();

    await expect(titleInput).toHaveValue(/^[\s\S]{0,25}$/);
  });

  test('shows management actions on the detail page', async ({ page }) => {
    const jobId = await seedJobPosting('crud-detail-actions', 'active');

    try {
      await page.goto(`/my-postings/${jobId}`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(visibleByTestId(page, 'job-posting-manage-applicants')).toBeVisible({
        timeout: 15_000,
      });
      await expect(visibleByTestId(page, 'job-posting-manage-settlements')).toBeVisible();
      await expect(visibleByTestId(page, 'job-posting-edit-button')).toBeVisible();
    } finally {
      await cleanupJobPosting(jobId);
    }
  });

  test('shows the delete action on the detail page', async ({ page }) => {
    const jobId = await seedJobPosting('crud-delete-modal', 'active');

    try {
      await page.goto(`/my-postings/${jobId}`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(visibleByTestId(page, 'job-posting-delete-button')).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await cleanupJobPosting(jobId);
    }
  });
});
