import { expect, test, type Locator, type Page } from '@playwright/test';
import { createClosedJob, createTestJob } from '../../factories';
import { deleteDocument, seedDocument } from '../../helpers/firebase-admin';

async function waitForReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(1_000);
}

function visibleByTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`).first();
}

test.describe('Employer posting CRUD', () => {
  test.setTimeout(60_000);

  test('shows seeded postings and filter tabs on the list page', async ({ page }) => {
    const activeJob = createTestJob({ title: 'crud-list-active', status: 'active' });
    const closedJob = createClosedJob({ title: 'crud-list-closed' });
    await seedDocument('jobPostings', activeJob.id, activeJob);
    await seedDocument('jobPostings', closedJob.id, closedJob);

    try {
      await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
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
      await deleteDocument('jobPostings', activeJob.id);
      await deleteDocument('jobPostings', closedJob.id);
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
    const job = createTestJob({ title: 'crud-detail-actions' });
    await seedDocument('jobPostings', job.id, job);

    try {
      await page.goto(`/my-postings/${job.id}`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(visibleByTestId(page, 'job-posting-manage-applicants')).toBeVisible({
        timeout: 15_000,
      });
      await expect(visibleByTestId(page, 'job-posting-manage-settlements')).toBeVisible();
      await expect(visibleByTestId(page, 'job-posting-edit-button')).toBeVisible();
    } finally {
      await deleteDocument('jobPostings', job.id);
    }
  });

  test('shows the delete action on the detail page', async ({ page }) => {
    const job = createTestJob({ title: 'crud-delete-modal' });
    await seedDocument('jobPostings', job.id, job);

    try {
      await page.goto(`/my-postings/${job.id}`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(visibleByTestId(page, 'job-posting-delete-button')).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteDocument('jobPostings', job.id);
    }
  });
});
