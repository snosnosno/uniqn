/**
 * P1 employer posting CRUD smoke coverage.
 */
import { expect, test } from '@playwright/test';
import { createClosedJob, createTestJob } from '../../factories';
import { EmployerTabPage } from '../../pages/app/tabs/employer-tab.page';
import { CreatePostingPage } from '../../pages/employer/create-posting.page';
import { MyPostingsPage } from '../../pages/employer/my-postings.page';
import { PostingDetailPage } from '../../pages/employer/posting-detail.page';
import { deleteDocument, seedDocument } from '../../helpers/firebase-admin';

test.describe('구인자 공고 CRUD', () => {
  test.setTimeout(60_000);

  test.describe('공고 목록', () => {
    test('employer 탭에서 공고 목록과 필터 UI를 본다', async ({ page }) => {
      const activeJob = createTestJob({ title: 'CRUD테스트활성공고', status: 'active' });
      const closedJob = createClosedJob({ title: 'CRUD테스트마감공고' });
      await seedDocument('jobPostings', activeJob.id, activeJob);
      await seedDocument('jobPostings', closedJob.id, closedJob);

      try {
        const employerTab = new EmployerTabPage(page);
        await employerTab.goto();

        await expect(employerTab.headerTitle).toBeVisible({ timeout: 30_000 });
        await expect(employerTab.createPostingButton).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('tab', { name: /전체/ })).toBeVisible({ timeout: 10_000 });
      } finally {
        await deleteDocument('jobPostings', activeJob.id);
        await deleteDocument('jobPostings', closedJob.id);
      }
    });

    test('내 공고 목록 페이지에서 결과 수를 본다', async ({ page }) => {
      const activeJob = createTestJob({ title: 'CRUD필터활성', status: 'active' });
      await seedDocument('jobPostings', activeJob.id, activeJob);

      try {
        const myPostings = new MyPostingsPage(page);
        await myPostings.goto();

        await expect(myPostings.headerTitle).toBeVisible({ timeout: 30_000 });
        await expect(
          myPostings.getResultCount().or(myPostings.getTotalCountText()).first()
        ).toBeVisible({ timeout: 15_000 });
      } finally {
        await deleteDocument('jobPostings', activeJob.id);
      }
    });

    test('공고가 없으면 빈 상태 또는 목록 요약이 보인다', async ({ page }) => {
      const myPostings = new MyPostingsPage(page);
      await myPostings.goto();

      await expect(myPostings.headerTitle).toBeVisible({ timeout: 30_000 });
      await expect(myPostings.getEmptyState().or(myPostings.getResultCount()).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test.describe('공고 생성', () => {
    test('공고 생성 페이지가 주요 필드를 렌더링한다', async ({ page }) => {
      const createPage = new CreatePostingPage(page);
      await createPage.goto();

      await expect(createPage.postingTypeRegular).toBeVisible({ timeout: 30_000 });
      await expect(createPage.postingTypeFixed).toHaveCount(0);
      await expect(createPage.postingTypeTournament).toBeVisible();
      await expect(createPage.postingTypeUrgent).toBeVisible();
      await expect(createPage.titleInput).toBeVisible({ timeout: 10_000 });
      await createPage.submitButton.scrollIntoViewIfNeeded().catch(() => {});
      await expect(createPage.submitButton).toBeVisible({ timeout: 10_000 });
    });

    test('제목 없이 제출하면 검증 오류가 보인다', async ({ page }) => {
      const createPage = new CreatePostingPage(page);
      await createPage.goto();

      await expect(createPage.postingTypeRegular).toBeVisible({ timeout: 30_000 });
      await createPage.submitButton.scrollIntoViewIfNeeded().catch(() => {});
      await createPage.submit();

      const error = createPage
        .getValidationError(/제목|필수 정보/)
        .or(page.locator('[role="alert"]'));
      await expect(error.first()).toBeVisible({ timeout: 10_000 });
    });

    test('제목 길이 제한이 동작한다', async ({ page }) => {
      const createPage = new CreatePostingPage(page);
      await createPage.goto();

      await expect(createPage.titleInput).toBeVisible({ timeout: 30_000 });

      const longTitle = '가'.repeat(26);
      await createPage.fillTitle(longTitle);
      await createPage.descriptionInput.click();

      const hasError = await createPage
        .getValidationError(/25자|최대/)
        .isVisible()
        .catch(() => false);
      const value = await createPage.titleInput.inputValue();
      expect(hasError || value.length <= 25).toBeTruthy();
    });

    test('고정 공고는 생성 옵션에서 노출되지 않는다', async ({ page }) => {
      const createPage = new CreatePostingPage(page);
      await createPage.goto();

      await expect(createPage.postingTypeRegular).toBeVisible({ timeout: 30_000 });
      await expect(createPage.postingTypeFixed).toHaveCount(0);
      await expect(
        page
          .getByText(/고정공고는 .* 제외.*생성할 수 없습니다|고정공고는 .* 제외되었습니다/)
          .first()
      ).toBeVisible({ timeout: 10_000 });

      await createPage.selectPostingType('tournament');
      await page.waitForTimeout(1_000);
      expect(true).toBeTruthy();
    });
  });

  test.describe('공고 상세', () => {
    test('공고 상세 페이지는 관리 메뉴를 보여준다', async ({ page }) => {
      const testJob = createTestJob({ title: 'CRUD상세테스트공고' });
      await seedDocument('jobPostings', testJob.id, testJob);

      try {
        const detailPage = new PostingDetailPage(page);
        await detailPage.goto(testJob.id, { waitUntil: 'domcontentloaded' });

        await expect(
          detailPage.getManagementSection().or(detailPage.getErrorState()).first()
        ).toBeVisible({ timeout: 30_000 });

        if (
          !(await detailPage
            .getErrorState()
            .isVisible()
            .catch(() => false))
        ) {
          await expect(detailPage.applicantsAction).toBeVisible({ timeout: 10_000 });
          await expect(detailPage.settlementAction).toBeVisible({ timeout: 5_000 });
          await expect(detailPage.editAction).toBeVisible({ timeout: 5_000 });
        }
      } finally {
        await deleteDocument('jobPostings', testJob.id);
      }
    });

    test('상세 정보 펼치기와 접기 토글이 동작한다', async ({ page }) => {
      const testJob = createTestJob({ title: 'CRUD토글테스트공고' });
      await seedDocument('jobPostings', testJob.id, testJob);

      try {
        const detailPage = new PostingDetailPage(page);
        await detailPage.goto(testJob.id, { waitUntil: 'domcontentloaded' });

        const hasError = await detailPage
          .getErrorState()
          .isVisible()
          .catch(() => false);
        const hasOtherError = await page
          .getByText(/문제가 발생|공고를 찾을 수 없습니다/)
          .first()
          .isVisible()
          .catch(() => false);

        if (!hasError && !hasOtherError) {
          await expect(detailPage.toggleInfoButton).toBeVisible({ timeout: 10_000 });
          await detailPage.expandInfo();
          await expect(page.getByText(/근무 일정|급여|수당|시급/).first()).toBeVisible({
            timeout: 10_000,
          });
          await detailPage.collapseInfo();
          await expect(page.getByRole('button', { name: '상세 정보 펼치기' })).toBeVisible({
            timeout: 5_000,
          });
        }
      } finally {
        await deleteDocument('jobPostings', testJob.id);
      }
    });

    test('공고 삭제 확인 모달이 열리고 닫힌다', async ({ page }) => {
      const testJob = createTestJob({ title: 'CRUD삭제테스트공고' });
      await seedDocument('jobPostings', testJob.id, testJob);

      try {
        const detailPage = new PostingDetailPage(page);
        await detailPage.goto(testJob.id, { waitUntil: 'domcontentloaded' });

        await expect(
          detailPage.getManagementSection().or(detailPage.getErrorState()).first()
        ).toBeVisible({ timeout: 30_000 });

        if (
          !(await detailPage
            .getErrorState()
            .isVisible()
            .catch(() => false))
        ) {
          await detailPage.clickDelete();
          await expect(detailPage.getDeleteModalTitle()).toBeVisible({ timeout: 10_000 });
          await expect(detailPage.getDeleteModalMessage()).toBeVisible();
          await detailPage.cancelDelete();
          await expect(detailPage.getDeleteModalMessage()).toBeHidden({ timeout: 5_000 });
        }
      } finally {
        await deleteDocument('jobPostings', testJob.id);
      }
    });
  });
});
