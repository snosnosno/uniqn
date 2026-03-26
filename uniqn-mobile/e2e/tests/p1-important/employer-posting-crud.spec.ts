import { expect, test, type Locator, type Page } from '@playwright/test';
import { createClosedJob, createTestJob } from '../../factories';
import { deleteDocument, seedDocument } from '../../helpers/firebase-admin';

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

test.describe('구인자 공고 CRUD', () => {
  test.setTimeout(60_000);

  test('내 공고 목록은 작성 버튼과 상태 탭을 보여준다', async ({ page }) => {
    const activeJob = createTestJob({ title: 'CRUD 목록 테스트 공고', status: 'active' });
    const closedJob = createClosedJob({ title: 'CRUD 마감 테스트 공고' });
    await seedDocument('jobPostings', activeJob.id, activeJob);
    await seedDocument('jobPostings', closedJob.id, closedJob);

    try {
      await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(page.getByRole('button', { name: /공고 작성/ }).first()).toBeVisible();
      await expect(page.getByRole('tab', { name: /전체/ }).first()).toBeVisible();
      await expect(page.getByRole('tab', { name: /마감/ }).first()).toBeVisible();
    } finally {
      await deleteDocument('jobPostings', activeJob.id);
      await deleteDocument('jobPostings', closedJob.id);
    }
  });

  test('내 공고 목록은 결과 수나 빈 상태를 보여준다', async ({ page }) => {
    await page.goto('/my-postings', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    const summary = page
      .getByRole('tab', { name: /전체.*\d/ })
      .or(page.getByText(/등록된 공고가 없습니다|공고가 없습니다/))
      .first();
    await expect(summary).toBeVisible({ timeout: 15_000 });
  });

  test('공고 생성 페이지는 핵심 필드를 렌더링한다', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    await expect(page.getByRole('heading', { name: /공고 작성/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /지원 공고 타입/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /대회 공고 타입/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /긴급 공고 타입/ })).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: /예: 강남 홀덤펍 딜러 구합니다/ })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /날짜 추가/ }).first()).toBeVisible();
    await expect(
      page.locator('button:visible', { hasText: /공고 등록|확인 요청/ }).first()
    ).toBeVisible();
  });

  test('제목 없이 제출하면 검증 오류가 보인다', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    await page
      .locator('button:visible', { hasText: /공고 등록|확인 요청/ })
      .first()
      .click();
    await expectAnyVisible(
      [
        page.getByText('제목을 입력해 주세요', { exact: true }),
        page.getByText('근무지를 선택해 주세요', { exact: true }),
        page.getByText('날짜별 모집 요구사항을 추가해 주세요', { exact: true }),
        page.locator('[role="alert"]'),
      ],
      10_000
    );
  });

  test('제목 길이 제한이 동작한다', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    const titleInput = page.locator('input[placeholder*="딜러 구합니다"]').last();
    await titleInput.fill('가'.repeat(26));
    await page.locator('textarea, input[placeholder*="근무 환경"]').last().click();

    const value = await titleInput.inputValue();
    const hasValidation = await page
      .getByText(/25자|최대/)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasValidation || value.length <= 25).toBeTruthy();
  });

  test('고정 공고 옵션은 노출되지 않는다', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    await expect(page.getByRole('radio', { name: /고정 공고 타입/ })).toHaveCount(0);
    await expectAnyVisible(
      [
        page.getByText('고정공고는 이번 V3 통합 범위에서 제외되어 생성할 수 없습니다.', {
          exact: true,
        }),
        page.getByText(
          '고정공고는 이번 V3 정비 범위에서 제외되었습니다. 날짜/시간/역할을 가진 행사형 공고만 생성할 수 있습니다.',
          {
            exact: true,
          }
        ),
      ],
      10_000
    );
  });

  test('공고 상세는 관리 액션을 보여준다', async ({ page }) => {
    const job = createTestJob({ title: 'CRUD 상세 테스트 공고' });
    await seedDocument('jobPostings', job.id, job);

    try {
      await page.goto(`/my-postings/${job.id}`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      await expect(
        page.locator('button:visible', { hasText: /지원자 관리/ }).first()
      ).toBeVisible();
      await expect(page.locator('button:visible', { hasText: /정산 관리/ }).first()).toBeVisible();
      await expect(page.locator('button:visible', { hasText: /공고 수정/ }).first()).toBeVisible();
    } finally {
      await deleteDocument('jobPostings', job.id);
    }
  });

  test('공고 삭제 확인 모달이 열리고 닫힌다', async ({ page }) => {
    const job = createTestJob({ title: 'CRUD 삭제 테스트 공고' });
    await seedDocument('jobPostings', job.id, job);

    try {
      await page.goto(`/my-postings/${job.id}`, { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      const deleteButton = page.locator('button:visible', { hasText: /^공고 삭제$/ }).first();
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      const modal = page.getByText(/정말 이 공고를 삭제하시겠습니까/).first();
      await expect(modal).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: '취소', exact: true }).click();
      await expect(modal).toBeHidden({ timeout: 5_000 });
    } finally {
      await deleteDocument('jobPostings', job.id);
    }
  });
});
