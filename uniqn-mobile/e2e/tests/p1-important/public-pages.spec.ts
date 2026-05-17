/**
 * P1 public pages tests
 * Unauthenticated users can browse the public jobs surface and protected actions stay on the web install flow.
 */
import path from 'path';
import { test, expect } from '@playwright/test';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';

const PUBLIC_SEED_JOB_TITLE = `[e2e] 긴급 딜러 모집 ${Date.now()}`;
const E2E_TEST_WORKSPACE_NAME = 'E2E 테스트 워크스페이스';
const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');

interface SeededPublicJob {
  jobPostingId: string;
  workspaceId: string;
}

async function seedPublicJob(): Promise<SeededPublicJob | null> {
  const adminClient = getAdminClient();
  if (!adminClient) {
    console.warn('[public-pages seed] service_role 미설정 — 시드 생략');
    return null;
  }

  // workspace 보장 (멱등 — 이름 + owner 매칭 시 재사용; 2026-05-17 PR #111 race-safe 패턴 적용)
  // 동시 INSERT race 가능성 대응: created_at order + limit 으로 첫 번째 row 사용
  let workspaceId: string | undefined;
  const { data: existingWs } = await adminClient
    .from('workspaces')
    .select('id')
    .eq('owner_id', SUPABASE_QA_ACCOUNTS.employer.id)
    .eq('name', E2E_TEST_WORKSPACE_NAME)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (existingWs) {
    workspaceId = existingWs.id;
  } else {
    const { data: newWs, error: wsErr } = await adminClient
      .from('workspaces')
      .insert({
        name: E2E_TEST_WORKSPACE_NAME,
        owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
      })
      .select('id')
      .single();
    if (wsErr || !newWs) {
      // 동시성 race — 다른 worker 가 같은 시점에 INSERT 했을 수 있어 재조회
      const { data: retry } = await adminClient
        .from('workspaces')
        .select('id')
        .eq('owner_id', SUPABASE_QA_ACCOUNTS.employer.id)
        .eq('name', E2E_TEST_WORKSPACE_NAME)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (!retry) {
        console.warn('[public-pages seed] workspace 생성 실패:', wsErr?.message);
        return null;
      }
      workspaceId = retry.id;
    } else {
      workspaceId = newWs.id;
    }
  }

  // 활성 공고 생성 (status=active 여야 '지원하기' 버튼 노출)
  const { data: jp, error: jpErr } = await adminClient
    .from('job_postings')
    .insert({
      title: PUBLIC_SEED_JOB_TITLE,
      owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
      workspace_id: workspaceId,
      status: 'active',
    })
    .select('id')
    .single();
  if (jpErr || !jp) {
    console.warn('[public-pages seed] job_posting 생성 실패:', jpErr?.message);
    return null;
  }

  return { jobPostingId: jp.id, workspaceId: workspaceId! };
}

async function cleanupPublicJob(seeded: SeededPublicJob): Promise<void> {
  const adminClient = getAdminClient();
  if (!adminClient) return;

  await adminClient.from('job_postings').delete().eq('id', seeded.jobPostingId);
  // workspace 는 재사용 위해 유지
}

test.describe('퍼블릭 페이지', () => {
  let seeded: SeededPublicJob | null = null;

  test.beforeAll(async () => {
    seeded = await seedPublicJob();
  });

  test.afterAll(async () => {
    if (seeded) {
      await cleanupPublicJob(seeded);
    }
  });

  test('비로그인 /jobs 진입 → 로그인 페이지로 리다이렉트', async ({ page }) => {
    // a465d82c7 (2026-03-29) 이후 (public)/jobs 는 LegacyPublicJobsEntryRoute 로
    // 비로그인 사용자를 무조건 /(auth)/login 으로 redirect 한다.
    // 공개 목록은 더 이상 제공하지 않으며, 공개 상세(/jobs/:id) 만 비로그인 접근 가능.
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 10_000 });
  });

  test('공개 공고 상세 페이지에서 비로그인 사용자도 공고를 볼 수 있다', async ({ page }) => {
    if (!seeded) {
      test.skip(true, 'service_role key 미설정 또는 시드 실패 — 공개 공고 상세 테스트 생략');
      return;
    }

    await page.goto(`/jobs/${seeded.jobPostingId}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(PUBLIC_SEED_JOB_TITLE).last()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '지원하기' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('공개 공고 상세에서 지원하기 클릭 시 설치 유도 모달이 열린다', async ({ page }) => {
    if (!seeded) {
      test.skip(true, 'service_role key 미설정 또는 시드 실패 — 설치 유도 테스트 생략');
      return;
    }

    await page.goto(`/jobs/${seeded.jobPostingId}`, { waitUntil: 'domcontentloaded' });

    const applyButton = page.getByRole('button', { name: '지원하기' });
    await expect(applyButton).toBeVisible({ timeout: 15_000 });
    await applyButton.click();

    // InstallPromptContent — `UNIQN 앱에서 계속 이용할 수 있어요`
    await expect(page.getByText('UNIQN 앱에서 계속 이용할 수 있어요')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '앱 설치' })).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain(`/jobs/${seeded.jobPostingId}`);
  });

  test('로그인한 사용자는 /jobs 진입 시 실제 구인 페이지를 본다', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/jobs(?:\/)?$/);
    await expect(page).toHaveURL(/\/(?:[?#].*)?$/);
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('존재하지 않는 공고 경로도 앱이 깨지지 않고 렌더된다', async ({ page }) => {
    await page.goto('/jobs/nonexistent-job-id-12345', { waitUntil: 'domcontentloaded' });

    // app/jobs/[id].tsx (PublicJobDetailAliasRoute) 는 비로그인 사용자도 접근 허용.
    // job 미존재 시 redirect 가 아닌 ErrorState 노출.
    await expect(page.locator('#root')).toBeAttached({ timeout: 10_000 });
    await expect(page.locator('body')).not.toBeEmpty();
    // 비로그인 redirect 가 없으므로 URL 보존
    expect(page.url()).toContain('/jobs/nonexistent-job-id-12345');
  });
});
