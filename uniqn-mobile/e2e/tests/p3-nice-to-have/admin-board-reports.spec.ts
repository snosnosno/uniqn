import { test, expect } from '../../fixtures/base.fixture';
import { BOARD_FIXTURE_CONTENT, BOARD_FIXTURE_IDS } from '../../fixtures/board-fixtures';

test.describe('Admin 게시판 신고', () => {
  test.skip('목록 필터와 검색이 동작하고 pending 신고를 해결 처리할 수 있다', async ({
    page,
    basePage,
    toast,
  }) => {
    await page.goto('/admin/board-reports', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    await expect(page.getByText('게시판 신고').first()).toBeVisible();
    await expect(page.getByText(BOARD_FIXTURE_CONTENT.pendingReportReason)).toBeVisible();

    await page.getByText('전체', { exact: true }).first().click();
    await expect(page.getByText(BOARD_FIXTURE_CONTENT.resolvedReportReason)).toBeVisible();

    await page
      .getByPlaceholder('사유, 신고자, 게시글 검색')
      .fill(BOARD_FIXTURE_CONTENT.resolvedReportReason);
    await page.waitForTimeout(500);

    await expect(page.getByText(BOARD_FIXTURE_CONTENT.resolvedReportReason)).toBeVisible();
    await expect(page.getByText(BOARD_FIXTURE_CONTENT.pendingReportReason)).toHaveCount(0);

    await page.goto(`/admin/board-reports/${BOARD_FIXTURE_IDS.pendingCommentReport}`, {
      waitUntil: 'domcontentloaded',
    });
    await basePage.waitForReady();

    await expect(page.getByText('게시판 신고 상세').first()).toBeVisible();
    await expect(page.getByText('댓글 신고', { exact: true })).toBeVisible();
    await expect(
      page.getByText(BOARD_FIXTURE_CONTENT.pendingReportReason, { exact: true })
    ).toBeVisible();
    await expect(page.getByText(BOARD_FIXTURE_CONTENT.commentBody, { exact: true })).toBeVisible();
    await expect(page.getByText(BOARD_FIXTURE_CONTENT.freeTitle, { exact: true })).toBeVisible();

    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.getByRole('button', { name: '해결 처리' }).click();

    expect(await toast.hasMessage('게시판 신고를 처리했습니다.')).toBe(true);
    await expect(page.getByText(/처리 상태: 해결/)).toBeVisible({ timeout: 10_000 });
  });

  test.skip('resolved 게시판 신고 상세를 직접 열 수 있다', async ({ page, basePage }) => {
    await page.goto(`/admin/board-reports/${BOARD_FIXTURE_IDS.resolvedPostReport}`, {
      waitUntil: 'domcontentloaded',
    });
    await basePage.waitForReady();

    await expect(page.getByText('게시판 신고 상세').first()).toBeVisible();
    await expect(page.getByText('게시글 신고', { exact: true })).toBeVisible();
    await expect(
      page.getByText(BOARD_FIXTURE_CONTENT.resolvedReportReason, { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(BOARD_FIXTURE_CONTENT.employerTdaBody, { exact: true })
    ).toBeVisible();
    await expect(page.getByText(/처리 상태: 해결/)).toBeVisible();
  });
});
