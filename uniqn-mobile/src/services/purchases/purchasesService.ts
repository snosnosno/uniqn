/**
 * UNIQN Mobile - RevenueCat 구매 서비스 (네이티브)
 * @description RC SDK 래퍼. configure 1회 + uid 변경 시 logIn. 키 미설정 시 isAvailable=false.
 *   웹은 purchasesService.web.ts 스텁이 대체(Metro 플랫폼 해상도).
 */
import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { logger } from '@/utils/logger';

export interface PurchaseResult {
  cancelled: boolean;
  productId?: string;
}

function getApiKey(): string {
  return (
    Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      default: undefined,
    }) ?? ''
  );
}

let configured = false;
let currentUid: string | null = null;

export const purchasesService = {
  /** SDK 사용 가능 여부 — 네이티브 + 키 존재. */
  isAvailable(): boolean {
    return getApiKey().length > 0;
  },

  /** 인증 사용자로 SDK 초기화. 최초 1회 configure, 이후 uid 변경은 logIn. 멱등. */
  async configure(appUserID: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      if (!configured) {
        Purchases.configure({ apiKey: getApiKey(), appUserID });
        configured = true;
        currentUid = appUserID;
        logger.info('purchases.configured', { appUserID });
        return;
      }
      if (currentUid !== appUserID) {
        await Purchases.logIn(appUserID);
        currentUid = appUserID;
        logger.info('purchases.loggedIn', { appUserID });
      }
    } catch (error) {
      logger.warn('purchases.configure.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /** 로그아웃 — configure된 경우에만. */
  async logOut(): Promise<void> {
    if (!this.isAvailable() || !configured) return;
    try {
      await Purchases.logOut();
      currentUid = null;
    } catch (error) {
      logger.warn('purchases.logOut.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /** 현재 offering의 다이아 패키지 목록. */
  async getDiamondPackages(): Promise<PurchasesPackage[]> {
    if (!this.isAvailable()) return [];
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  },

  /** 패키지 구매. 사용자 취소는 throw 대신 { cancelled:true }. 그 외 에러는 throw. */
  async purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
    if (!this.isAvailable()) {
      throw new Error('PURCHASES_UNAVAILABLE');
    }
    try {
      const result = await Purchases.purchasePackage(pkg);
      return { cancelled: false, productId: result.productIdentifier };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { cancelled: true };
      }
      throw error;
    }
  },

  /** 테스트 전용 상태 리셋. */
  __resetForTest(): void {
    configured = false;
    currentUid = null;
  },
};
