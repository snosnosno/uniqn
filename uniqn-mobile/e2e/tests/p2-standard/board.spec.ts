import { test, expect } from '../../fixtures/base.fixture';
import { BOARD_FIXTURE_IDS } from '../../fixtures/board-fixtures';

test.describe('게시판 사용자 흐름', () => {
  test('게시판 홈과 제한 화면을 안내한다', async ({ page, basePage }) => {
    await page.goto('/board', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    await expect(page.getByText('게시판').first()).toBeVisible();
    await expect(page.getByLabel('공지 탭')).toBeVisible();
    await expect(page.getByLabel('일정 탭')).toBeVisible();
    await expect(page.getByLabel('자유 탭')).toBeVisible();
    await expect(page.getByLabel('TDA 탭')).toBeVisible();

    await page.getByLabel('자유 탭').click();
    await page.waitForURL(/\/board\/free$/, { timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /\[seed\] Free board post/ }).first()
    ).toBeVisible();

    await page.goto('/board/write?boardType=notice', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();
    await expect(page.getByText('글을 작성할 수 없는 게시판이에요')).toBeVisible();

    await page.goto('/board/write?boardType=schedule', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();
    await expect(page.getByText('글을 작성할 수 없는 게시판이에요')).toBeVisible();

    await page.goto('/board/unknown', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();
    await expect(page.getByText('게시판을 찾을 수 없어요')).toBeVisible();
  });

  test('free 게시글 작성 후 상세, 댓글, 답글, 반응, 수정, 잠금이 동작한다', async ({
    page,
    basePage,
    toast,
  }) => {
    const uniqueSuffix = Date.now();
    const title = `PW Board Title ${uniqueSuffix}`;
    const body = `PW board body ${uniqueSuffix}`;
    const updatedTitle = `${title} Updated`;
    const updatedBody = `${body} Updated`;
    const commentBody = `PW comment ${uniqueSuffix}`;
    const replyBody = `PW reply ${uniqueSuffix}`;

    await page.goto('/board/free', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    await page.getByLabel('글쓰기').click();
    await page.waitForURL(/\/board\/write/, { timeout: 10_000 });

    await page.getByRole('textbox', { name: '제목', exact: true }).fill(title);
    await page.getByRole('textbox', { name: '내용', exact: true }).fill(body);
    await page.getByRole('button', { name: '등록하기' }).click();

    await page.waitForURL(/\/board\/free$/, { timeout: 10_000 });
    expect(await toast.hasMessage('게시글을 등록했습니다.')).toBe(true);
    await toast.dismiss();
    const createdPostCard = page.getByRole('button', { name: new RegExp(title) }).first();
    await expect(createdPostCard).toBeVisible();

    await createdPostCard.click();
    await page.waitForURL(/\/board\/post\//, { timeout: 10_000 });
    await basePage.waitForReady();
    await expect(page.getByText(body, { exact: true }).last()).toBeVisible();

    const postId = page.url().split('/').pop();
    expect(postId).toBeTruthy();

    await page.getByRole('button', { name: /좋아요/ }).click();
    await expect(page.getByRole('button', { name: /좋아요 1/ })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: /싫어요/ }).click();
    await expect(page.getByRole('button', { name: /싫어요 1/ })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByLabel('댓글 내용').fill(commentBody);
    await page.getByRole('button', { name: '등록' }).click();
    expect(await toast.hasMessage('댓글을 등록했습니다.')).toBe(true);
    await toast.dismiss();
    await expect(page.getByText(commentBody, { exact: true })).toBeVisible();

    await page.getByText('답글', { exact: true }).first().click();
    await page.getByLabel('댓글 내용').last().fill(replyBody);
    await page.getByRole('button', { name: '등록' }).last().click();
    expect(await toast.hasMessage('댓글을 등록했습니다.')).toBe(true);
    await toast.dismiss();
    await expect(page.getByText(replyBody, { exact: true })).toBeVisible();

    await page.getByText('수정', { exact: true }).first().click();
    await page.waitForURL(/\/board\/edit\//, { timeout: 10_000 });

    await page.getByRole('textbox', { name: '제목', exact: true }).fill(updatedTitle);
    await page.getByRole('textbox', { name: '내용', exact: true }).fill(updatedBody);
    await page.getByRole('button', { name: '수정하기' }).click();

    await page.waitForURL(/\/board\/post\//, { timeout: 10_000 });
    await basePage.waitForReady();
    await expect(page.getByText(updatedTitle, { exact: true }).last()).toBeVisible();
    await expect(page.getByText(updatedBody, { exact: true }).last()).toBeVisible();

    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.getByTestId(`board-post-lock-${postId}`).last().click();
    await expect(page.getByRole('button', { name: '게시글 잠금 해제' }).last()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId(`board-post-edit-${postId}`)).toHaveCount(0);
    await page.waitForTimeout(1_000);

    await page.goto(`/board/edit/${postId}`, { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();
    await expect(page.getByText('잠긴 게시글이에요')).toBeVisible();
  });

  test('비작성자 게시글 수정 제한을 안내한다', async ({ page, basePage }) => {
    await page.goto(`/board/edit/${BOARD_FIXTURE_IDS.employerTdaPost}`, {
      waitUntil: 'domcontentloaded',
    });
    await basePage.waitForReady();

    await expect(page.getByText('게시글을 수정할 수 없어요')).toBeVisible();
    await expect(page.getByText('글 작성자나 관리자만 게시글을 수정할 수 있어요.')).toBeVisible();
  });

  test('상단 탭 바가 홈과 카테고리 화면 모두에서 보인다', async ({ page, basePage }) => {
    await page.goto('/board', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    await expect(page.getByLabel('자유 탭')).toBeVisible();

    await page.getByLabel('자유 탭').click();
    await page.waitForURL(/\/board\/free$/, { timeout: 10_000 });

    await expect(page.getByLabel('자유 탭')).toBeVisible();
    await expect(page.getByLabel('TDA 탭')).toBeVisible();
  });
});
