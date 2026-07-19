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
  // /employer 리스트에 노출된다. 별도 'E2E 테스트 팀' 에 넣으면 0건으로 보임.
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

/**
 * fixed(고정) 공고 시드 — 주문서로 표현 불가한 공고. create.tsx 의 프리셋 캐러셀은
 * 이런 공고를 `draftToValues` throw → try/catch 로 조용히 제외해야 하며, 이때 create
 * 화면이 크래시하면 안 된다(Task 9 리뷰 Minor 회귀 방어).
 *
 * ⚠️ created_at 을 미래로 밀어 이 공고가 useMyJobPostings 의 "가장 최신(lastPosting)"이
 *    되도록 강제한다 — 그래야 프리셋 조립이 이 fixed 공고를 매핑하려다 catch 로 빠지는
 *    스킵 경로가 실제로 실행된다(병렬 시드 레이스와 무관하게 결정적).
 * schema: work_date='' (fixed 파생값), work_dates 미설정, fixed_config 필수(durationDays=7),
 *         schedule.kind='fixed' + requirements 1건(date:null, timeSlot 1개).
 */
async function seedFixedJobPosting(title: string): Promise<string> {
  const admin = getAdminClient();
  if (!admin) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY 필요 — fixed job_postings 시드 불가');

  const workspaceId = await getDefaultWorkspaceId(admin, TEST_ACCOUNTS.employer.uid);
  const now = new Date();
  const futureCreatedAt = new Date(now.getTime() + 3_600_000).toISOString();
  const expiresAt = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const { data, error } = await admin
    .from('job_postings')
    .insert({
      title,
      status: 'active',
      workspace_id: workspaceId,
      owner_id: TEST_ACCOUNTS.employer.uid,
      owner_name: TEST_ACCOUNTS.employer.displayName,
      created_at: futureCreatedAt,
      work_date: '', // fixed 파생 workDate (deriveWorkDateFieldsFromSchedule)
      posting_type: 'fixed',
      total_positions: 2,
      filled_positions: 0,
      view_count: 0,
      schema_version: 3,
      description: `E2E 고정 공고 — ${title}`,
      contact_phone: '+82101234567',
      location: {
        name: '테스트홀덤펍',
        district: '강남구',
        detailedAddress: '테스트로 123',
      },
      schedule: {
        kind: 'fixed',
        daysPerWeek: 5,
        startTime: '18:00',
        requirements: [
          {
            date: null,
            timeSlots: [
              {
                startTime: '18:00',
                roles: [{ role: 'dealer', count: 2 }],
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
      fixed_config: {
        durationDays: 7,
        expiresAt,
        createdAt: now.toISOString(),
      },
    })
    .select('id')
    .single();

  if (error) throw new Error(`fixed job_postings INSERT 실패: ${error.message}`);
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

    // 주문서(order-sheet) 개편: 기본 정보는 화면 내 인라인 입력이 아니라 "주문서 행"으로 노출되고,
    // 세부 입력은 각 행을 탭해 여는 시트에서 이뤄진다. 필수 컨트롤 = 핵심 행 + 등록 버튼.
    await expect(visibleByTestId(page, 'order-sheet-row-title')).toBeVisible({ timeout: 15_000 });
    await expect(visibleByTestId(page, 'order-sheet-row-place')).toBeVisible();
    await expect(visibleByTestId(page, 'order-sheet-row-contact')).toBeVisible();
    await expect(visibleByTestId(page, 'order-sheet-row-dates')).toBeVisible();
    await expect(visibleByTestId(page, 'job-posting-create-submit')).toBeVisible();
  });

  test('opens the first unset row sheet when submitting empty', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    // 주문서는 빈 제출을 "차단 텍스트"로 막지 않고, 첫 미설정 행(제목) 시트를 열어 순차 입력을
    // 유도한다(죽은 버튼 금지 — OrderSheetScreen onInvalid → firstUnsetRow → handleRowPress).
    await visibleByTestId(page, 'job-posting-create-submit').click();
    await expect(visibleByTestId(page, 'order-sheet-title-input')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/my-postings\/create/);
  });

  test('caps title length at the input limit', async ({ page }) => {
    await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
    await waitForReady(page);

    // 제목 행 탭 → TitleSheet 오픈 → 입력. TextInput maxLength=25 로 타이핑 즉시 25자 캡.
    await visibleByTestId(page, 'order-sheet-row-title').click();
    const titleInput = visibleByTestId(page, 'order-sheet-title-input');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill('a'.repeat(40));

    await expect(titleInput).toHaveValue(/^[\s\S]{0,25}$/);
  });

  test('renders the create page without crashing when the latest posting is fixed', async ({
    page,
  }) => {
    // Task 9 리뷰 Minor 회귀: 마지막 공고가 fixed(주문서 밖)면 프리셋 캐러셀이 이를
    // draftToValues throw → try/catch 로 제외한다. 이 스킵 경로에서 create 화면이
    // 크래시(백지)하지 않고 주문서가 정상 렌더돼야 한다.
    const fixedId = await seedFixedJobPosting('crud-fixed-preset-skip');

    try {
      await page.goto('/my-postings/create', { waitUntil: 'domcontentloaded' });
      await waitForReady(page);

      // 주문서 골격(첫 행 + 등록 버튼)이 보이면 프리셋 조립이 throw 를 삼키고 화면이 살아남은 것.
      await expect(visibleByTestId(page, 'order-sheet-row-title')).toBeVisible({ timeout: 15_000 });
      await expect(visibleByTestId(page, 'job-posting-create-submit')).toBeVisible();
    } finally {
      await cleanupJobPosting(fixedId);
    }
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
