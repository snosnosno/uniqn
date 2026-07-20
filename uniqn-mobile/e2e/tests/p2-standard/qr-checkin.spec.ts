/**
 * P2 QR 출퇴근 스캔 진입 동선 — 실사용 경로 검증 (2 tests)
 * 인증된 staff 상태에서 실행
 *
 * 이 스펙은 스태프의 **실사용 동선**을 그대로 탄다: 홈에서 헤더 QR 버튼을 탭해
 * 스캔 화면으로 이동한다. 고정 QR 전환의 핵심 목표가 "헤더 1탭이면 카메라"이므로
 * 그 동선 자체가 검증 대상이다.
 *
 * ⚠️ `page.goto('/scan')` 하드 로드는 쓰지 않는다. 2026-07-20 CI 에서 하드 로드 시
 * URL 은 /scan 인데 DOM 은 홈(구인구직)이 렌더되는 현상이 관측됐다(run 29710416562).
 * expo-router 웹의 초기 라우트 하이드레이션 문제로 보이나 원인 미규명 상태이며,
 * 딥링크·새로고침 경로의 갭으로 남아 있다 → 후속 조사 항목.
 *
 * ⚠️ 이 스펙이 검증하지 **못하는** 것 (웹 카메라 제약 — 실기기 QA 항목):
 * - 실제 QR 스캔 → 출근/퇴근 반영 (getUserMedia 를 헤드리스 브라우저에서 쓸 수 없음)
 * - 하루 2슬롯 배정 시 처리 대상 자동 선택 (단위 테스트 selectWorkLogForQR 로만 커버)
 * - 최초 1회 튜토리얼 오버레이 (global-setup 이 완료 플래그를 미리 심어 항상 스킵됨)
 *
 * 억지로 통과시키려 카메라 상태를 흉내내지 않는다 — 통과해도 의미 없는 테스트가 되기 때문.
 */
import { test, expect } from '@playwright/test';
import { waitForAppReady } from '../../helpers/wait-helpers';

// storageState는 chromium 프로젝트에서 staff.json으로 자동 설정됨

/** TabHeader.tsx 의 QR 버튼 accessibilityLabel — 웹에서 aria-label 로 노출된다 */
const QR_BUTTON_LABEL = '출퇴근 QR 스캔';

/** app/(app)/scan.tsx 가 QRCodeScanner 에 넘기는 title — 권한 허용/거부 양쪽에서 렌더된다 */
const SCANNER_TITLE = '출퇴근 QR 스캔';

test.describe('QR 출퇴근 스캔 진입 동선', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
  });

  test('홈 헤더에 QR 스캔 버튼이 있다', async ({ page }) => {
    await expect(page.getByRole('button', { name: QR_BUTTON_LABEL }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('헤더 QR 버튼 1탭이면 스캔 화면이 열린다', async ({ page }) => {
    await page.getByRole('button', { name: QR_BUTTON_LABEL }).first().click();

    // 카메라 권한이 거부돼도 헤더 타이틀은 렌더된다 (QRCodeScanner.web.tsx 권한 안내 분기).
    await expect(page.getByText(SCANNER_TITLE).first()).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toContain('scan');
  });
});
