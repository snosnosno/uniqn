import { test, expect } from '../../fixtures/base.fixture';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';

interface SeededReports {
  pendingCommentReportId: string;
  resolvedPostReportId: string;
  freePostId: string;
  tdaPostId: string;
  commentId: string;
}

// PR #118: BOARD_FIXTURE_IDS 의 비-UUID seed ID 가 board_reports.id (uuid 타입) 에서
// invalid_text_representation 으로 hang 했던 문제 해결. 동적 seed + DB-generated UUID 로 전환.
const SUFFIX = Date.now();
const FREE_TITLE = `[e2e-abr] Free board post ${SUFFIX}`;
const TDA_TITLE = `[e2e-abr] Employer TDA topic ${SUFFIX}`;
const TDA_BODY = `[e2e-abr] Employer-authored TDA discussion seed ${SUFFIX}.`;
const COMMENT_BODY = `[e2e-abr] Seeded employer comment for report detail verification ${SUFFIX}.`;
const PENDING_REASON = `[e2e-abr] Pending board report reason ${SUFFIX}`;
const RESOLVED_REASON = `[e2e-abr] Resolved board report reason ${SUFFIX}`;

async function seedReports(): Promise<SeededReports | null> {
  const admin = getAdminClient();
  if (!admin) {
    console.warn('[admin-board-reports seed] service_role 미설정 — 시드 생략');
    return null;
  }

  // 1. Free post (staff authored)
  const { data: freePost, error: freeErr } = await admin
    .from('board_posts')
    .insert({
      board_type: 'free',
      title: FREE_TITLE,
      body: 'Seeded free board content for report verification.',
      author_id: SUPABASE_QA_ACCOUNTS.staff.id,
      author_name: SUPABASE_QA_ACCOUNTS.staff.name,
      author_role: 'staff',
    })
    .select('id')
    .single();
  if (freeErr || !freePost) {
    console.warn('[admin-board-reports seed] free post 생성 실패:', freeErr?.message);
    return null;
  }

  // 2. TDA post (employer authored)
  const { data: tdaPost, error: tdaErr } = await admin
    .from('board_posts')
    .insert({
      board_type: 'tda',
      title: TDA_TITLE,
      body: TDA_BODY,
      author_id: SUPABASE_QA_ACCOUNTS.employer.id,
      author_name: SUPABASE_QA_ACCOUNTS.employer.name,
      author_role: 'employer',
    })
    .select('id')
    .single();
  if (tdaErr || !tdaPost) {
    console.warn('[admin-board-reports seed] tda post 생성 실패:', tdaErr?.message);
    await admin.from('board_posts').delete().eq('id', freePost.id);
    return null;
  }

  // 3. Comment on free post (employer authored)
  const { data: comment, error: commentErr } = await admin
    .from('board_comments')
    .insert({
      post_id: freePost.id,
      body: COMMENT_BODY,
      author_id: SUPABASE_QA_ACCOUNTS.employer.id,
      author_name: SUPABASE_QA_ACCOUNTS.employer.name,
      author_role: 'employer',
    })
    .select('id')
    .single();
  if (commentErr || !comment) {
    console.warn('[admin-board-reports seed] comment 생성 실패:', commentErr?.message);
    await admin.from('board_posts').delete().in('id', [freePost.id, tdaPost.id]);
    return null;
  }

  // 4. Pending comment report
  const { data: pending, error: pendingErr } = await admin
    .from('board_reports')
    .insert({
      target_type: 'comment',
      target_id: comment.id,
      post_id: freePost.id,
      reporter_id: SUPABASE_QA_ACCOUNTS.staff.id,
      reason: PENDING_REASON,
      details: 'Pending board report details for the seeded employer comment.',
      status: 'pending',
    })
    .select('id')
    .single();
  if (pendingErr || !pending) {
    console.warn('[admin-board-reports seed] pending report 생성 실패:', pendingErr?.message);
    await admin.from('board_posts').delete().in('id', [freePost.id, tdaPost.id]);
    return null;
  }

  // 5. Resolved post report
  const { data: resolved, error: resolvedErr } = await admin
    .from('board_reports')
    .insert({
      target_type: 'post',
      target_id: tdaPost.id,
      post_id: tdaPost.id,
      reporter_id: SUPABASE_QA_ACCOUNTS.staff.id,
      reason: RESOLVED_REASON,
      details: 'Resolved board report details for the seeded employer post.',
      status: 'resolved',
      resolved_by: SUPABASE_QA_ACCOUNTS.admin.id,
      resolved_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (resolvedErr || !resolved) {
    console.warn('[admin-board-reports seed] resolved report 생성 실패:', resolvedErr?.message);
    await admin.from('board_posts').delete().in('id', [freePost.id, tdaPost.id]);
    return null;
  }

  return {
    pendingCommentReportId: pending.id,
    resolvedPostReportId: resolved.id,
    freePostId: freePost.id,
    tdaPostId: tdaPost.id,
    commentId: comment.id,
  };
}

async function cleanupReports(seeded: SeededReports): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  // board_posts CASCADE → board_comments, board_reports 동반 삭제
  await admin.from('board_posts').delete().in('id', [seeded.freePostId, seeded.tdaPostId]);
}

test.describe('Admin 게시판 신고', () => {
  let seeded: SeededReports | null = null;

  test.beforeAll(async () => {
    seeded = await seedReports();
  });

  test.afterAll(async () => {
    if (seeded) {
      await cleanupReports(seeded);
    }
  });

  test('목록 필터와 검색이 동작하고 pending 신고를 해결 처리할 수 있다', async ({
    page,
    basePage,
    toast,
  }) => {
    if (!seeded) {
      test.skip(true, 'service_role key 미설정 또는 시드 실패 — pending 시드 의존 테스트 생략');
      return;
    }

    await page.goto('/admin/board-reports', { waitUntil: 'domcontentloaded' });
    await basePage.waitForReady();

    await expect(page.getByText('게시판 신고').first()).toBeVisible();
    await expect(page.getByText(PENDING_REASON)).toBeVisible();

    await page.getByText('전체', { exact: true }).first().click();
    await expect(page.getByText(RESOLVED_REASON)).toBeVisible();

    await page.getByPlaceholder('사유, 신고자, 게시글 검색').fill(RESOLVED_REASON);
    await page.waitForTimeout(500);

    await expect(page.getByText(RESOLVED_REASON)).toBeVisible();
    await expect(page.getByText(PENDING_REASON)).toHaveCount(0);

    await page.goto(`/admin/board-reports/${seeded.pendingCommentReportId}`, {
      waitUntil: 'domcontentloaded',
    });
    await basePage.waitForReady();

    await expect(page.getByText('게시판 신고 상세').first()).toBeVisible();
    await expect(page.getByText('댓글 신고', { exact: true })).toBeVisible();
    await expect(page.getByText(PENDING_REASON, { exact: true })).toBeVisible();
    await expect(page.getByText(COMMENT_BODY, { exact: true })).toBeVisible();
    await expect(page.getByText(FREE_TITLE, { exact: true })).toBeVisible();

    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.getByRole('button', { name: '해결 처리' }).click();

    expect(await toast.hasMessage('게시판 신고를 처리했습니다.')).toBe(true);
    await expect(page.getByText(/처리 상태: 해결/)).toBeVisible({ timeout: 10_000 });
  });

  test('resolved 게시판 신고 상세를 직접 열 수 있다', async ({ page, basePage }) => {
    if (!seeded) {
      test.skip(true, 'service_role key 미설정 또는 시드 실패 — resolved 시드 의존 테스트 생략');
      return;
    }

    await page.goto(`/admin/board-reports/${seeded.resolvedPostReportId}`, {
      waitUntil: 'domcontentloaded',
    });
    await basePage.waitForReady();

    await expect(page.getByText('게시판 신고 상세').first()).toBeVisible();
    await expect(page.getByText('게시글 신고', { exact: true })).toBeVisible();
    await expect(page.getByText(RESOLVED_REASON, { exact: true })).toBeVisible();
    await expect(page.getByText(TDA_BODY, { exact: true })).toBeVisible();
    await expect(page.getByText(/처리 상태: 해결/)).toBeVisible();
  });
});
