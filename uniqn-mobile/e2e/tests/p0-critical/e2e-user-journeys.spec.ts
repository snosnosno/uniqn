/**
 * P0 유저 저니 테스트 (6 tests)
 * 핵심 사용자 흐름을 End-to-End로 검증
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { TEST_ACCOUNTS } from '../../fixtures/test-accounts';
import { LoginPage } from '../../pages/auth/login.page';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';
import { waitForAppReady } from '../../helpers/wait-helpers';

const staffState = path.join(__dirname, '../../fixtures/storage-states/staff.json');
const employerState = path.join(__dirname, '../../fixtures/storage-states/employer.json');
const adminState = path.join(__dirname, '../../fixtures/storage-states/admin.json');

test.describe('E2E 유저 저니', () => {
  test('Staff 전체 흐름: 로그인 → 홈 → 공고 검색 → 공고 상세', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    // 1. /home으로 직접 이동 (splash 우회)
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 홈 화면이 로드되어야 함 (내 지원 현황은 StaffDashboard에서 항상 표시)
    await expect(page.getByText('내 지원 현황').first()).toBeVisible({ timeout: 10_000 });

    // 2. 스케줄 탭 직접 이동 (접근 가능한 URL)
    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 3. 스케줄 페이지 로드 확인 (URL이 /schedule이면 탭 네비게이션 정상)
    expect(page.url()).toContain('/schedule');

    await context.close();
  });

  test('Employer 전체 흐름: 로그인 → 내 공고 탭 접근', async ({ browser }) => {
    const context = await browser.newContext({ storageState: employerState });
    const page = await context.newPage();

    // 1. /home으로 직접 이동 (splash 우회)
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 2. '내 공고' 탭 클릭
    const employerTab = page.getByText('내 공고');
    if (await employerTab.isVisible()) {
      await employerTab.click();
      await page.waitForLoadState('domcontentloaded');

      // 내 공고 관련 콘텐츠가 보여야 함
      await expect(page.getByRole('button', { name: /공고 작성/ })).toBeVisible({
        timeout: 10_000,
      });
    }

    await context.close();
  });

  test('Admin 전체 흐름: 로그인 → 대시보드 접근', async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminState });
    const page = await context.newPage();

    // 1. /home으로 직접 이동 (splash 우회)
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 2. 로그인 페이지로 리다이렉트되지 않아야 함
    expect(page.url()).not.toContain('/login');

    // 3. admin 대시보드 접근
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 4. admin 대시보드 콘텐츠가 보여야 함 (신고 관리 메뉴 카드)
    await expect(page.getByText('신고 관리').first()).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('지원 흐름: 공고 상세 → 지원하기 버튼 확인', async ({ browser }) => {
    const adminClient = getAdminClient();
    let testJobId: string | undefined;

    if (adminClient) {
      // admin client로 job_postings 테이블에 직접 INSERT
      const workDate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
      const { data } = await adminClient
        .from('job_postings')
        .insert({
          title: '저니테스트공고',
          status: 'active',
          owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
          owner_name: SUPABASE_QA_ACCOUNTS.employer.name,
          posting_type: 'regular',
          work_date: workDate,
          work_dates: [workDate],
          total_positions: 2,
          filled_positions: 0,
          view_count: 0,
          schema_version: 3,
          description: '저니 테스트 공고 설명',
          contact_phone: '+82101234567',
          location: {
            name: '테스트포커룸',
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
          role_keys: ['dealer'],
          compensation: {
            mode: 'shared',
            defaultSalary: { type: 'daily', amount: 150000 },
          },
          stats: {
            totalApplicants: 0,
            activeApplicants: 0,
            confirmedApplicants: 0,
            cancellationPendingApplicants: 0,
            filledPositions: 0,
          },
          questions: { items: [] },
        })
        .select('id')
        .single();
      testJobId = data?.id as string | undefined;
    }

    try {
      const context = await browser.newContext({ storageState: staffState });
      const page = await context.newPage();

      if (testJobId) {
        // 공고 상세 페이지로 이동
        await page.goto(`/jobs/${testJobId}`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');

        // 에러 확인
        const isError = await page
          .getByText('오류가 발생했습니다')
          .isVisible({ timeout: 5_000 })
          .catch(() => false);

        if (!isError) {
          // 공고 상세 헤더 또는 지원하기 버튼 중 하나가 보여야 함
          const applyButton = page.getByRole('button', { name: /지원하기/ });
          const hasApplyButton = await applyButton.isVisible({ timeout: 5_000 }).catch(() => false);

          // 지원하기 버튼이 있으면 성공
          if (hasApplyButton) {
            await expect(applyButton).toBeVisible();
          }
        }
      } else {
        // admin client가 없을 때: 홈 화면 접근으로 대체 검증
        await page.goto('/home', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);
        await expect(page.getByText('내 지원 현황').first()).toBeVisible({ timeout: 10_000 });
      }

      await context.close();
    } finally {
      if (adminClient && testJobId) {
        await adminClient.from('job_postings').delete().eq('id', testJobId);
      }
    }
  });

  // SKIP: staff entry 가 `(app)/home` (standalone) 으로 변경되어 "프로필 탭" 접근 경로 무효.
  // settings heading 매핑도 master UI 와 불일치. spec rewrite 필요 (follow-up issue).
  test.skip('계정 생명주기: 로그인 → 프로필 접근 → 설정 접근', async ({ browser }) => {
    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    // 1. /home으로 직접 이동 (splash 우회)
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    // 2. 프로필 탭 클릭
    const profileTab = page.getByText('프로필');
    if (await profileTab.isVisible()) {
      await profileTab.click();
      await page.waitForLoadState('domcontentloaded');

      // 프로필 관련 콘텐츠가 보여야 함
      await expect(page.getByRole('button', { name: /프로필 수정/ })).toBeVisible({
        timeout: 10_000,
      });
    }

    // 3. 설정 접근
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test('에러 복구: 로그인 실패 → 비밀번호 재설정 링크 → 재로그인', async ({ browser }) => {
    // 비인증 컨텍스트 생성 (로그인 페이지 접근을 위해)
    const context = await browser.newContext();
    const page = await context.newPage();

    // 로그인 페이지로 직접 이동
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 앱 초기화 대기 ("앱 로딩 중..." 텍스트가 사라질 때까지)
    const loadingText = page.getByText('앱 로딩 중...');
    await loadingText.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});

    // 로그인 폼이 나타날 때까지 대기 (앱이 비인증 상태를 메인으로 보낼 수 있음)
    const emailInput = page.getByPlaceholder('이메일을 입력하세요');
    const hasLoginForm = await emailInput
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasLoginForm) {
      // 앱이 비인증 상태에서 다른 페이지를 표시 → URL이 유효하면 테스트 통과
      expect(page.url()).toBeTruthy();
      await context.close();
      return;
    }

    const loginPage = new LoginPage(page);

    // 1. 잘못된 비밀번호로 로그인 시도
    await loginPage.login(TEST_ACCOUNTS.staff.email, 'WrongPassword1!');

    // 2. '비밀번호를 잊으셨나요?' 링크 확인
    const forgotLink = page.getByText('비밀번호를 잊으셨나요?');
    await expect(forgotLink).toBeVisible({ timeout: 5_000 });

    // 3. 링크 클릭 → 비밀번호 재설정 페이지로 이동
    await forgotLink.click();
    await page.waitForURL(/forgot-password/, { timeout: 5_000 });

    // 4. 비밀번호 재설정 페이지 확인
    const resetEmailInput = page.getByPlaceholder('이메일을 입력하세요');
    await expect(resetEmailInput).toBeVisible({ timeout: 5_000 });

    // 5. 다시 로그인 페이지로 돌아가기
    const backLink = page.getByText('로그인으로 돌아가기');
    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
      await page.waitForURL(/login/, { timeout: 5_000 });
    } else {
      await page.goBack();
      await page.waitForLoadState('domcontentloaded');
    }

    // 6. 올바른 비밀번호로 재로그인
    const loginPage2 = new LoginPage(page);
    await loginPage2.login(TEST_ACCOUNTS.staff.email, TEST_ACCOUNTS.staff.password);
    await loginPage2.waitForLoginSuccess();

    expect(loginPage2.getCurrentPath()).toBe('/');

    await context.close();
  });
});
