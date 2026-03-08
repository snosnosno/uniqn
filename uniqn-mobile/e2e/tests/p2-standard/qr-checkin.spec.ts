/**
 * P2 QR 체크인 테스트 (4 tests)
 * 인증된 staff 상태에서 실행
 *
 * 웹 환경에서는 카메라 접근이 불가하므로 QR 표시 컴포넌트만 테스트
 */
import { test, expect } from '@playwright/test';
import { QRPage } from '../../pages/app/tabs/qr.page';

// storageState는 chromium 프로젝트에서 staff.json으로 자동 설정됨

test.describe('QR 체크인', () => {
  let qrPage: QRPage;

  test.beforeEach(async ({ page }) => {
    qrPage = new QRPage(page);
    await qrPage.goto();
  });

  // =====================================================
  // UI 렌더링 (2 tests)
  // =====================================================

  test('QR 스캔 화면이 정상 표시된다', async () => {
    // 헤더
    await expect(qrPage.header).toBeVisible();
    // 서브타이틀
    await expect(qrPage.subtitle).toBeVisible();
    // 스캔 타이틀
    await expect(qrPage.scanTitle).toBeVisible();
    // 스캔 버튼
    await expect(qrPage.scanButton).toBeVisible();
  });

  test('현재 상태 카드에 근무 상태가 표시된다', async () => {
    // '현재 상태' 라벨
    await expect(qrPage.statusLabel).toBeVisible();

    // '근무 중' 또는 '출근 전' 중 하나가 표시
    const statusText = qrPage.getWorkStatus();
    await expect(statusText).toBeVisible({ timeout: 5_000 });
  });

  // =====================================================
  // 상태별 동작 (1 test)
  // =====================================================

  test('근무 상태에 따라 액션 배지가 다르게 표시된다', async () => {
    // 액션 배지: '출근 필요' 또는 '퇴근 필요'
    const badge = qrPage.getActionBadge();
    await expect(badge).toBeVisible({ timeout: 5_000 });

    const badgeText = await badge.textContent();
    expect(badgeText).toMatch(/출근 필요|퇴근 필요/);

    // 스캔 설명도 일치해야 함
    const isCheckIn = badgeText?.includes('출근');
    if (isCheckIn) {
      await expect(qrPage.getScanDescription('출근')).toBeVisible();
    } else {
      await expect(qrPage.getScanDescription('퇴근')).toBeVisible();
    }
  });

  // =====================================================
  // 안내 문구 (1 test)
  // =====================================================

  test('QR 코드 안내 문구가 표시된다', async () => {
    // 하단 안내 문구 확인
    await expect(qrPage.getGuideText()).toBeVisible();
  });
});
