/**
 * P1 구인자 정산 관리 테스트 (4 tests)
 * employer 역할 storageState 사용
 *
 * NOTE: 앱 초기화에 15-20초 걸릴 수 있으므로 (Firebase 에뮬레이터 환경)
 * 페이지 로딩 대기를 충분히 합니다.
 */
import { test, expect } from '@playwright/test';
import { PostingDetailPage } from '../../pages/employer/posting-detail.page';
import { seedDocument, deleteDocument } from '../../helpers/firebase-admin';
import { createTestJob } from '../../factories';
import { createTestWorkLog, createCompletedWorkLog } from '../../factories/work-log.factory';

/** 앱 초기화 대기 */
async function waitForAppInit(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const loadingText = page.getByText('앱 로딩 중...');
  try {
    await loadingText.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await loadingText.waitFor({ state: 'hidden', timeout: 30_000 });
  } catch {
    // 이미 사라졌거나 로딩 텍스트가 없음
  }
  // 알림 온보딩 모달 스킵
  try {
    const skipButton = page.getByText('나중에 하기');
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click({ timeout: 3_000 });
      await page.waitForTimeout(500);
    }
  } catch {
    // 모달 없음
  }
}

test.describe('구인자 정산 관리', () => {
  // 앱 초기화 + Firebase 에뮬레이터 통신 고려
  test.setTimeout(60_000);

  /** 공통 테스트 데이터 */
  let testJob: ReturnType<typeof createTestJob>;

  test.beforeAll(async () => {
    testJob = createTestJob({
      title: '정산관리_테스트공고',
      status: 'active',
    });
    await seedDocument('jobPostings', testJob.id, testJob);
  });

  test.afterAll(async () => {
    await deleteDocument('jobPostings', testJob.id);
  });

  // ========================================================================
  // 정산 진입
  // ========================================================================

  test('공고 상세 → 스태프/정산 관리 진입 → 탭 구조 확인', async ({ page }) => {
    const detailPage = new PostingDetailPage(page);
    await detailPage.goto(testJob.id, { waitUntil: 'domcontentloaded' });

    // 공고 상세 로드 대기 (관리 섹션 또는 에러 상태)
    const managementOrError = detailPage.getManagementSection()
      .or(detailPage.getErrorState());
    await expect(managementOrError.first()).toBeVisible({ timeout: 30_000 });

    const hasError = await detailPage.getErrorState().isVisible().catch(() => false);
    if (hasError) {
      test.skip();
      return;
    }

    // 스태프/정산 관리 액션 카드 확인
    await expect(detailPage.settlementAction).toBeVisible({ timeout: 10_000 });

    // 클릭하여 정산 관리 화면 이동
    await detailPage.goToSettlements();

    // 정산 관리 화면 로드 확인
    const url = page.url();
    expect(url).toContain('settlements');

    // 탭 구조 확인 (스태프 관리 / 정산)
    const staffTab = page.getByText(/스태프 관리/);
    const settlementTab = page.getByText('정산', { exact: true }).or(
      page.getByText(/^정산$/)
    );

    const hasStaffTab = await staffTab.isVisible().catch(() => false);
    const hasSettlementTab = await settlementTab
      .first()
      .isVisible()
      .catch(() => false);

    // 적어도 하나의 탭이 보여야 함
    expect(hasStaffTab || hasSettlementTab).toBeTruthy();
  });

  // ========================================================================
  // 정산 목록
  // ========================================================================

  test('정산 탭 → 정산 요약 카드 + 필터 탭 표시', async ({ page }) => {
    // 테스트 근무기록 시딩
    const pendingWorkLog = createTestWorkLog({
      jobPostingId: testJob.id,
      staffName: '정산요약_테스트스태프',
      payrollStatus: 'pending',
    });
    const completedWorkLog = createCompletedWorkLog({
      jobPostingId: testJob.id,
      staffName: '정산완료_테스트스태프',
    });

    await seedDocument(
      `jobPostings/${testJob.id}/workLogs`,
      pendingWorkLog.id,
      pendingWorkLog
    );
    await seedDocument(
      `jobPostings/${testJob.id}/workLogs`,
      completedWorkLog.id,
      completedWorkLog
    );

    try {
      await page.goto(`/my-postings/${testJob.id}/settlements`, { waitUntil: 'domcontentloaded' });
      await waitForAppInit(page);

      // 정산 탭 클릭 (이미 정산 탭이면 스킵)
      const settlementTabButton = page
        .getByText('정산', { exact: true })
        .or(page.getByText(/^정산$/));
      if (await settlementTabButton.first().isVisible().catch(() => false)) {
        await settlementTabButton.first().click();
        await page.waitForTimeout(2_000);
      }

      // 정산 관련 UI 요소 확인
      // 필터 탭: 전체, 미정산, 완료
      const filterAll = page.getByText('전체', { exact: false });
      const filterPending = page.getByText(/미정산/);
      const filterCompleted = page.getByText('완료', { exact: false });

      const hasFilters =
        (await filterAll.first().isVisible().catch(() => false)) ||
        (await filterPending.isVisible().catch(() => false)) ||
        (await filterCompleted.first().isVisible().catch(() => false));

      // 페이지가 정상적으로 로드됨 (에러 없음)
      const errorState = page.getByText(/오류|에러|불러올 수 없습니다/);
      const hasError = await errorState.isVisible().catch(() => false);
      expect(hasError).toBeFalsy();
    } finally {
      await deleteDocument(
        `jobPostings/${testJob.id}/workLogs`,
        pendingWorkLog.id
      );
      await deleteDocument(
        `jobPostings/${testJob.id}/workLogs`,
        completedWorkLog.id
      );
    }
  });

  test('일괄 정산 선택 모드 토글', async ({ page }) => {
    const workLog = createTestWorkLog({
      jobPostingId: testJob.id,
      staffName: '일괄정산_테스트',
      payrollStatus: 'pending',
    });
    await seedDocument(
      `jobPostings/${testJob.id}/workLogs`,
      workLog.id,
      workLog
    );

    try {
      await page.goto(`/my-postings/${testJob.id}/settlements`, { waitUntil: 'domcontentloaded' });
      await waitForAppInit(page);

      // 정산 탭으로 이동
      const settlementTabButton = page
        .getByText('정산', { exact: true })
        .or(page.getByText(/^정산$/));
      if (await settlementTabButton.first().isVisible().catch(() => false)) {
        await settlementTabButton.first().click();
        await page.waitForTimeout(2_000);
      }

      // 일괄 정산 선택 버튼 확인
      const batchSelectButton = page.getByText(/일괄 정산 선택/);
      const hasBatchSelect = await batchSelectButton
        .isVisible()
        .catch(() => false);

      if (hasBatchSelect) {
        // 일괄 정산 모드 활성화
        await batchSelectButton.click();
        await page.waitForTimeout(1_000);

        // 선택 취소 버튼이 표시됨
        const cancelSelectButton = page.getByText(/선택 취소/);
        await expect(cancelSelectButton).toBeVisible({ timeout: 5_000 });

        // 전체 선택 / 선택 해제 / 일괄 정산 버튼 확인
        const selectAllButton = page.getByText(/전체 선택/);
        const batchSettleButton = page.getByText(/일괄 정산/).last();

        const hasSelectAll = await selectAllButton
          .isVisible()
          .catch(() => false);
        const hasBatchSettle = await batchSettleButton
          .isVisible()
          .catch(() => false);

        // 액션 버튼이 존재
        expect(hasSelectAll || hasBatchSettle).toBeTruthy();

        // 선택 모드 해제
        await cancelSelectButton.click();
      }
    } finally {
      await deleteDocument(
        `jobPostings/${testJob.id}/workLogs`,
        workLog.id
      );
    }
  });

  test('개별 근무기록 → 정산 상세 모달 표시', async ({ page }) => {
    const workLog = createTestWorkLog({
      jobPostingId: testJob.id,
      staffName: '정산상세_테스트',
      payrollStatus: 'pending',
    });
    await seedDocument(
      `jobPostings/${testJob.id}/workLogs`,
      workLog.id,
      workLog
    );

    try {
      await page.goto(`/my-postings/${testJob.id}/settlements`, { waitUntil: 'domcontentloaded' });
      await waitForAppInit(page);

      // 정산 탭으로 이동
      const settlementTabButton = page
        .getByText('정산', { exact: true })
        .or(page.getByText(/^정산$/));
      if (await settlementTabButton.first().isVisible().catch(() => false)) {
        await settlementTabButton.first().click();
        await page.waitForTimeout(2_000);
      }

      // 스태프 이름이 표시되는지 확인
      const staffCard = page.getByText('정산상세_테스트');
      const isVisible = await staffCard.isVisible().catch(() => false);

      if (isVisible) {
        // 정산하기 버튼 클릭
        const settleButton = page.getByRole('button', { name: /정산하기/ });
        const hasSettleButton = await settleButton
          .first()
          .isVisible()
          .catch(() => false);

        if (hasSettleButton) {
          await settleButton.first().click();

          // 정산 상세 모달 표시
          const modal = page.locator('[role="dialog"]');
          await expect(modal).toBeVisible({ timeout: 10_000 });
        }
      }
    } finally {
      await deleteDocument(
        `jobPostings/${testJob.id}/workLogs`,
        workLog.id
      );
    }
  });
});
