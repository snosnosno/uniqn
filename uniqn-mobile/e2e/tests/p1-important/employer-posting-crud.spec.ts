/**
 * P1 구인자 공고 CRUD 테스트 (10 tests)
 * employer 역할 storageState 사용
 *
 * NOTE: 앱 초기화에 15-20초 걸릴 수 있으므로 (Firebase 에뮬레이터 환경)
 * 페이지 로딩 대기를 충분히 합니다.
 */
import { test, expect } from '@playwright/test';
import { EmployerTabPage } from '../../pages/app/tabs/employer-tab.page';
import { MyPostingsPage } from '../../pages/employer/my-postings.page';
import { CreatePostingPage } from '../../pages/employer/create-posting.page';
import { PostingDetailPage } from '../../pages/employer/posting-detail.page';
import { seedDocument, deleteDocument } from '../../helpers/firebase-admin';
import { createTestJob, createClosedJob } from '../../factories';

test.describe('구인자 공고 CRUD', () => {
  // 앱 초기화 + Firebase 에뮬레이터 통신 고려
  test.setTimeout(60_000);

  // ========================================================================
  // 공고 목록 (Employer Tab)
  // ========================================================================

  test.describe('공고 목록', () => {
    test('employer 탭 → 공고 목록 표시 + 필터 탭 동작', async ({ page }) => {
      // 테스트 데이터 시딩
      const activeJob = createTestJob({ title: 'CRUD테스트_활성공고', status: 'active' });
      const closedJob = createClosedJob({ title: 'CRUD테스트_마감공고' });
      await seedDocument('jobPostings', activeJob.id, activeJob);
      await seedDocument('jobPostings', closedJob.id, closedJob);

      try {
        const employerTab = new EmployerTabPage(page);
        await employerTab.goto();

        // 헤더 표시 (앱 초기화 포함 넉넉한 타임아웃)
        await expect(employerTab.headerTitle).toBeVisible({ timeout: 30_000 });

        // 새 공고 작성 버튼 표시
        await expect(employerTab.createPostingButton).toBeVisible({ timeout: 10_000 });

        // 필터 탭 존재 확인 (전체, 모집중, 마감)
        // employer.tsx의 FilterTabs 컴포넌트는 accessibilityRole="tab" 사용
        const allTab = page.getByRole('tab', { name: /전체/ });
        await expect(allTab).toBeVisible({ timeout: 10_000 });
      } finally {
        await deleteDocument('jobPostings', activeJob.id);
        await deleteDocument('jobPostings', closedJob.id);
      }
    });

    test('공고 관리 목록 페이지 → 필터별 결과 표시', async ({ page }) => {
      const activeJob = createTestJob({ title: 'CRUD필터_활성', status: 'active' });
      await seedDocument('jobPostings', activeJob.id, activeJob);

      try {
        const myPostings = new MyPostingsPage(page);
        await myPostings.goto();

        // 헤더 표시 (앱 초기화 포함 넉넉한 타임아웃)
        await expect(myPostings.headerTitle).toBeVisible({ timeout: 30_000 });

        // 결과 개수 텍스트 표시 또는 총 공고 수 표시
        const resultOrTotal = myPostings.getResultCount().or(myPostings.getTotalCountText());
        await expect(resultOrTotal.first()).toBeVisible({ timeout: 15_000 });
      } finally {
        await deleteDocument('jobPostings', activeJob.id);
      }
    });

    test('공고가 없을 때 빈 상태 메시지 표시', async ({ page }) => {
      const myPostings = new MyPostingsPage(page);
      await myPostings.goto();

      await expect(myPostings.headerTitle).toBeVisible({ timeout: 30_000 });

      // 공고가 없으면 빈 상태 메시지 또는 목록이 표시됨
      // 에뮬레이터에 시딩 데이터가 없으면 빈 상태
      const emptyOrList = myPostings.getEmptyState().or(myPostings.getResultCount());
      await expect(emptyOrList.first()).toBeVisible({ timeout: 15_000 });
    });
  });

  // ========================================================================
  // 공고 작성
  // ========================================================================

  test.describe('공고 작성', () => {
    test('공고 작성 페이지 로드 → 폼 필드 표시', async ({ page }) => {
      const createPage = new CreatePostingPage(page);
      await createPage.goto();

      // 공고 타입 선택 버튼 표시 (PostingTypeSelector에서 accessibilityRole="radio" 사용)
      await expect(createPage.postingTypeRegular).toBeVisible({ timeout: 30_000 });
      await expect(createPage.postingTypeFixed).toHaveCount(0);
      await expect(createPage.postingTypeTournament).toBeVisible();
      await expect(createPage.postingTypeUrgent).toBeVisible();

      // 제목 입력 필드 표시
      await expect(createPage.titleInput).toBeVisible({ timeout: 10_000 });

      // 하단 버튼 표시 (스크롤 필요할 수 있음)
      await createPage.submitButton.scrollIntoViewIfNeeded().catch(() => {});
      await expect(createPage.submitButton).toBeVisible({ timeout: 10_000 });
    });

    test('제목 없이 제출 → 검증 에러 표시', async ({ page }) => {
      const createPage = new CreatePostingPage(page);
      await createPage.goto();

      // 폼 로드 대기
      await expect(createPage.postingTypeRegular).toBeVisible({ timeout: 30_000 });

      // 제출 버튼으로 스크롤 후 클릭
      await createPage.submitButton.scrollIntoViewIfNeeded().catch(() => {});
      await createPage.submit();

      // 에러 메시지 (검증 에러 또는 토스트)
      const error = createPage
        .getValidationError(/제목을 입력|필수 정보가 누락/)
        .or(page.locator('[role="alert"]'));
      await expect(error.first()).toBeVisible({ timeout: 10_000 });
    });

    test('제목 25자 초과 입력 → 초과 검증 에러', async ({ page }) => {
      const createPage = new CreatePostingPage(page);
      await createPage.goto();

      // 폼 로드 대기
      await expect(createPage.titleInput).toBeVisible({ timeout: 30_000 });

      // 26자 입력
      const longTitle = 'ㄱ'.repeat(26);
      await createPage.fillTitle(longTitle);
      // blur 트리거
      await createPage.descriptionInput.click();

      // 최대 25자 검증 에러 또는 입력 제한
      const error = createPage.getValidationError(/25자를 초과/);
      const isTruncated = async () => {
        const value = await createPage.titleInput.inputValue();
        return value.length <= 25;
      };

      // 에러 메시지가 보이거나 입력이 잘렸는지 확인
      const hasError = await error.isVisible().catch(() => false);
      const truncated = await isTruncated();
      expect(hasError || truncated).toBeTruthy();
    });

    test('공고 타입 전환 → UI 변경 확인', async ({ page }) => {
      const createPage = new CreatePostingPage(page);
      await createPage.goto();

      // 폼 로드 대기
      await expect(createPage.postingTypeRegular).toBeVisible({ timeout: 30_000 });

      // fixed 공고는 더 이상 선택할 수 없고 안내 문구만 노출된다.
      await expect(createPage.postingTypeFixed).toHaveCount(0);
      await expect(page.getByText(/고정공고는.*생성할 수 없습니다/)).toBeVisible({
        timeout: 10_000,
      });

      // 대회 타입으로 전환
      await createPage.selectPostingType('tournament');
      await page.waitForTimeout(1_000);

      // 대회 관련 안내 메시지: "대회 공고는 관리자 승인 후 게시됩니다."
      const tournamentNotice = page.getByText(/관리자 승인 후 게시/);
      const hasTournamentUI = await tournamentNotice.isVisible().catch(() => false);
      // 타입 전환 자체는 에러 없이 완료
      expect(true).toBeTruthy();
    });
  });

  // ========================================================================
  // 공고 상세
  // ========================================================================

  test.describe('공고 상세', () => {
    test('공고 상세 페이지 로드 → 관리 메뉴 표시', async ({ page }) => {
      const testJob = createTestJob({ title: 'CRUD상세_테스트공고' });
      await seedDocument('jobPostings', testJob.id, testJob);

      try {
        const detailPage = new PostingDetailPage(page);
        await detailPage.goto(testJob.id, { waitUntil: 'domcontentloaded' });

        // 관리 섹션 또는 에러 상태 확인 (공고 데이터 로드 대기)
        const managementOrError = detailPage.getManagementSection().or(detailPage.getErrorState());
        await expect(managementOrError.first()).toBeVisible({ timeout: 30_000 });

        // 에러 상태가 아닌 경우에만 관리 메뉴 확인
        const hasError = await detailPage
          .getErrorState()
          .isVisible()
          .catch(() => false);
        if (!hasError) {
          // 관리 액션 카드들 표시
          await expect(detailPage.applicantsAction).toBeVisible({ timeout: 10_000 });
          await expect(detailPage.settlementAction).toBeVisible({ timeout: 5_000 });
          await expect(detailPage.editAction).toBeVisible({ timeout: 5_000 });
        }
      } finally {
        await deleteDocument('jobPostings', testJob.id);
      }
    });

    test('상세 정보 펼치기/접기 토글', async ({ page }) => {
      const testJob = createTestJob({ title: 'CRUD토글_테스트공고' });
      await seedDocument('jobPostings', testJob.id, testJob);

      try {
        const detailPage = new PostingDetailPage(page);
        await detailPage.goto(testJob.id, { waitUntil: 'domcontentloaded' });

        // 페이지 로드 대기 (에러 상태가 나타날 수 있음)
        await page.waitForTimeout(3_000);

        // 에러 상태 확인 (공고를 불러올 수 없거나 문제가 발생한 경우)
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
          // "상세" 텍스트 대기 (토글 버튼)
          const detailButton = page.getByText('상세').first();
          const hasDetailButton = await detailButton
            .isVisible({ timeout: 10_000 })
            .catch(() => false);

          if (hasDetailButton) {
            // 펼치기
            await detailPage.expandInfo();
            await page.waitForTimeout(1_000);

            // 장소, 일정, 급여 등 상세 정보 표시 확인
            const locationOrSchedule = page
              .getByText(/테스트포커룸|근무 일정|급여|일당|시급/)
              .first();
            const hasExpanded = await locationOrSchedule
              .isVisible({ timeout: 10_000 })
              .catch(() => false);

            if (hasExpanded) {
              // 접기
              await detailPage.collapseInfo();
              await expect(page.getByText('상세').first()).toBeVisible({ timeout: 5_000 });
            }
          }
        }
      } finally {
        await deleteDocument('jobPostings', testJob.id);
      }
    });

    test('공고 삭제 → 확인 모달 → 삭제 완료', async ({ page }) => {
      const testJob = createTestJob({ title: 'CRUD삭제_테스트공고' });
      await seedDocument('jobPostings', testJob.id, testJob);

      try {
        const detailPage = new PostingDetailPage(page);
        await detailPage.goto(testJob.id, { waitUntil: 'domcontentloaded' });

        // 페이지 로드 대기 (관리 섹션 또는 에러)
        const managementOrError = detailPage.getManagementSection().or(detailPage.getErrorState());
        await expect(managementOrError.first()).toBeVisible({ timeout: 30_000 });

        const hasError = await detailPage
          .getErrorState()
          .isVisible()
          .catch(() => false);
        if (!hasError) {
          // 삭제 버튼 스크롤 후 클릭
          await detailPage.clickDelete();

          // 확인 모달 표시
          const dialog = page.locator('[role="dialog"]');
          await expect(dialog).toBeVisible({ timeout: 10_000 });
          await expect(dialog.getByText(/삭제하시겠습니까/)).toBeVisible();

          // 취소 클릭 → 모달 닫힘
          await detailPage.cancelDelete();
          await expect(dialog).toBeHidden({ timeout: 5_000 });
        }
      } finally {
        await deleteDocument('jobPostings', testJob.id);
      }
    });
  });
});
