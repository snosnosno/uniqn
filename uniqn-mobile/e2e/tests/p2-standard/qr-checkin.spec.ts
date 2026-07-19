/**
 * P2 QR 출퇴근 스캔 화면 — 라우팅·표시 검증 (2 tests)
 * 인증된 staff 상태에서 실행
 *
 * ⚠️ 이 스펙이 검증하지 **못하는** 것 (웹 카메라 제약 — 실기기 QA 항목):
 * - 실제 QR 스캔 → 출근/퇴근 반영 (getUserMedia 를 헤드리스 브라우저에서 쓸 수 없음)
 * - 하루 2슬롯 배정 시 처리 대상 자동 선택 (단위 테스트 selectWorkLogForQR 로만 커버)
 * - 최초 1회 튜토리얼 오버레이 (global-setup 이 완료 플래그를 미리 심어 항상 스킵됨)
 *
 * 따라서 여기서는 "/scan 라우트가 살아 있고 스캐너 화면이 렌더된다"만 확인한다.
 * 억지로 통과시키려 카메라 상태를 흉내내지 않는다 — 통과해도 의미 없는 테스트가 되기 때문.
 *
 * 페이지 오브젝트를 두지 않는 이유: /scan 은 전체화면 스캐너 하나뿐이라
 * 캡슐화할 상호작용이 없다 (구 qr.page.ts 는 /qr 라우트와 함께 삭제됨).
 */
import { test, expect } from '@playwright/test';
import { waitForAppReady } from '../../helpers/wait-helpers';

// storageState는 chromium 프로젝트에서 staff.json으로 자동 설정됨

/** app/(app)/scan.tsx 가 QRCodeScanner 에 넘기는 title — 권한 허용/거부 양쪽에서 렌더된다 */
const SCANNER_TITLE = '출퇴근 QR 스캔';

test.describe('QR 출퇴근 스캔 화면', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scan', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
  });

  test('/scan 진입 시 인증 화면으로 튕기지 않고 스캔 라우트에 머문다', async ({ page }) => {
    const pathname = new URL(page.url()).pathname;
    expect(pathname).toContain('scan');
  });

  test('스캐너 화면 타이틀이 표시된다', async ({ page }) => {
    // 카메라 권한이 거부돼도 헤더 타이틀은 렌더된다 (QRCodeScanner.web.tsx 권한 안내 분기).
    await expect(page.getByText(SCANNER_TITLE).first()).toBeVisible({ timeout: 15_000 });
  });
});
