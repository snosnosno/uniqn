/**
 * QR Scan Page Object
 * 참조: app/(app)/(tabs)/qr.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

export class QRPage extends BasePage {
  readonly header: Locator;
  readonly subtitle: Locator;
  readonly scanButton: Locator;
  readonly statusLabel: Locator;
  readonly scanTitle: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.getByText('QR 스캔', { exact: true }).first();
    this.subtitle = page.getByText('구인자의 QR 코드를 스캔하여 출퇴근하세요');
    this.scanButton = page.getByText('카메라로 스캔하기');
    this.statusLabel = page.getByText('현재 상태');
    this.scanTitle = page.getByText('QR 코드 스캔');
  }

  async goto(): Promise<void> {
    await this.page.goto('/qr', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 현재 근무 상태 텍스트 가져오기 */
  getWorkStatus(): Locator {
    // '근무 중' 또는 '출근 전'
    return this.page.locator('text=/근무 중|출근 전/');
  }

  /** 액션 배지 텍스트 가져오기 */
  getActionBadge(): Locator {
    // '출근 필요' 또는 '퇴근 필요'
    return this.page.locator('text=/출근 필요|퇴근 필요/');
  }

  /** 안내 문구 확인 */
  getGuideText(): Locator {
    return this.page.getByText('QR 코드는 구인자가 현장에서 생성합니다.');
  }

  /** 스캔 설명 텍스트 (출근/퇴근에 따라 다름) */
  getScanDescription(action: '출근' | '퇴근'): Locator {
    return this.page.getByText(new RegExp(`${action}을 완료하세요`));
  }

  /** 카메라 스캔 버튼 클릭 */
  async clickScanButton(): Promise<void> {
    await this.scanButton.click();
  }
}
