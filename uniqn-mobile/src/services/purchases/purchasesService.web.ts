/**
 * UNIQN Mobile - 구매 서비스 웹 스텁
 * @description react-native-purchases는 네이티브 전용. 웹은 모든 메서드 no-op + isAvailable=false.
 */
import { logger } from '@/utils/logger';

export interface PurchaseResult {
  cancelled: boolean;
  productId?: string;
}

export const purchasesService = {
  isAvailable(): boolean {
    return false;
  },
  async configure(_appUserID: string): Promise<void> {
    /* 웹 미지원 */
  },
  async logOut(): Promise<void> {
    /* 웹 미지원 */
  },
  async getDiamondPackages(): Promise<never[]> {
    return [];
  },
  async purchasePackage(): Promise<PurchaseResult> {
    logger.warn('purchases.web.unsupported');
    throw new Error('PURCHASES_UNAVAILABLE');
  },
  async restorePurchases(): Promise<void> {
    logger.warn('purchases.web.unsupported');
    throw new Error('PURCHASES_UNAVAILABLE');
  },
  __resetForTest(): void {
    /* no-op */
  },
};
