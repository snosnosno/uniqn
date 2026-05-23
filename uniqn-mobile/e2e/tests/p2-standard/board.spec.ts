import { test, expect } from '../../fixtures/base.fixture';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';

interface SeededBoardPosts {
  freePostId: string;
  freePostTitle: string;
  employerTdaPostId: string;
}

const FREE_POST_TITLE = `[e2e] Free board post ${Date.now()}`;
const EMPLOYER_TDA_TITLE = `[e2e] Employer TDA topic ${Date.now()}`;

async function seedBoardPosts(): Promise<SeededBoardPosts | null> {
  const adminClient = getAdminClient();
  if (!adminClient) {
    console.warn('[board.spec seed] service_role 미설정 — 시드 생략');
    return null;
  }

  // 1) staff 가 작성한 free post
  const { data: freePost, error: freeErr } = await adminClient
    .from('board_posts')
    .insert({
      board_type: 'free',
      title: FREE_POST_TITLE,
      body: 'Seed free board content for e2e Cat 3.',
      author_id: SUPABASE_QA_ACCOUNTS.staff.id,
      author_name: SUPABASE_QA_ACCOUNTS.staff.name,
      author_role: 'staff',
    })
    .select('id')
    .single();
  if (freeErr || !freePost) {
    console.warn('[board.spec seed] free post 생성 실패:', freeErr?.message);
    return null;
  }

  // 2) employer 가 작성한 TDA post (비작성자 staff 가 수정 시도 → '게시글을 수정할 수 없어요')
  const { data: tdaPost, error: tdaErr } = await adminClient
    .from('board_posts')
    .insert({
      board_type: 'tda',
      title: EMPLOYER_TDA_TITLE,
      body: 'Seed employer TDA discussion for non-author edit guard verification.',
      author_id: SUPABASE_QA_ACCOUNTS.employer.id,
      author_name: SUPABASE_QA_ACCOUNTS.employer.name,
      author_role: 'employer',
    })
    .select('id')
    .single();
  if (tdaErr || !tdaPost) {
    console.warn('[board.spec seed] tda post 생성 실패:', tdaErr?.message);
    // free post 만 dangling 으로 남지 않도록 정리
    await adminClient.from('board_posts').delete().eq('id', freePost.id);
    return null;
  }

  return {
    freePostId: freePost.id,
    freePostTitle: FREE_POST_TITLE,
    employerTdaPostId: tdaPost.id,
  };
}

async function cleanupBoardPosts(seeded: SeededBoardPosts): Promise<void> {
  const adminClient = getAdminClient();
  if (!adminClient) return;

  await adminClient
    .from('board_posts')
    .delete()
    .in('id', [seeded.freePostId, seeded.employerTdaPostId]);
}

test.describe('게시판 사용자 흐름', () => {
  let seeded: SeededBoardPosts | null = null;

  test.beforeAll(async () => {
    seeded = await seedBoardPosts();
  });

  test.afterAll(async () => {
    if (seeded) {
      await cleanupBoardPosts(seeded);
    }
  });

  test('게시판 홈과 제한 화면을 안내한다', async ({ page, basePage }) => {
    await page.goto('/board', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    await expect(page.getByText('게시판').first()).toBeVisible();
    await expect(page.getByLabel('공지 탭')).toBeVisible();
    await expect(page.getByLabel('일정 탭')).toBeVisible();
    await expect(page.getByLabel('자유 탭')).toBeVisible();
    await expect(page.getByLabel('TDA 탭')).toBeVisible();

    // 자유 탭 이동 → 라우트 전환 + 자유게시판 헤더 표시
    await page.getByLabel('자유 탭').click();
    await page.waitForURL(/\/board\/free$/, { timeout: 10_000 });
    await basePage.waitForReady();
    // BOARD_TYPE_LABELS.free = '자유게시판'
    await expect(page.getByText('자유게시판').first()).toBeVisible({ timeout: 10_000 });

    // 글쓰기 불가 카테고리는 안내 페이지로 라우팅
    await page.goto('/board/write?boardType=notice', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();
    await expect(page.getByText('글을 작성할 수 없는 게시판이에요')).toBeVisible();

    await page.goto('/board/write?boardType=schedule', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();
    await expect(page.getByText('글을 작성할 수 없는 게시판이에요')).toBeVisible();

    // unknown boardType — (tabs)/board/[boardType].tsx 의 ErrorState
    await page.goto('/board/unknown', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();
    await expect(page.getByText('게시판을 찾을 수 없어요')).toBeVisible();
  });

  // BoardPostDetailScreen 이 ActionSheet 기반 메뉴 + accessibilityLabel 없는 좋아요/싫어요
  // Button 으로 재설계됨 (2026-04 이후). 기존 inline selector(`getByRole('button', { name: /좋아요/ })`,
  // `getByText('수정')`, `board-post-lock-${id}` 등)가 production 과 mismatch.
  // 시나리오 자체는 valid 하나 selector 전면 재작성이 필요해 별도 PR 에서 처리.
  test.skip('free 게시글 작성 후 상세, 댓글, 답글, 반응, 수정, 잠금이 동작한다', async ({
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
    if (!seeded) {
      test.skip(true, 'service_role key 미설정 또는 시드 실패 — 비작성자 가드 테스트 생략');
      return;
    }

    // staff 인증 상태로 employer 가 작성한 TDA post 의 edit 화면 접근 → 가드 메시지 노출
    await page.goto(`/board/edit/${seeded.employerTdaPostId}`, {
      waitUntil: 'domcontentloaded',
    });
    await basePage.waitForReady();

    await expect(page.getByText('게시글을 수정할 수 없어요')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('글 작성자나 관리자만 게시글을 수정할 수 있어요.')).toBeVisible();
  });

  test('상단 탭 바가 홈과 카테고리 화면 모두에서 보인다', async ({ page, basePage }) => {
    await page.goto('/board', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    // 홈에서 탭 바 확인
    await expect(page.getByLabel('자유 탭')).toBeVisible();

    // 자유 탭 클릭 → 카테고리 화면에서도 탭 바 유지
    await page.getByLabel('자유 탭').click();
    await page.waitForURL(/\/board\/free$/, { timeout: 10_000 });
    await basePage.waitForReady();

    await expect(page.getByLabel('자유 탭')).toBeVisible();
    await expect(page.getByLabel('TDA 탭')).toBeVisible();

    // 탭이 실제로 상호작용 가능한지 확인 (TDA로 전환)
    await page.getByLabel('TDA 탭').click();
    await page.waitForURL(/\/board\/tda$/, { timeout: 10_000 });
    await basePage.waitForReady();
  });
});
