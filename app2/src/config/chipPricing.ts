import { ChipPricing } from '../types/jobPosting/chipPricing';
import { PostingType } from '../types/jobPosting/jobPosting';
import i18n from '../i18n';

/**
 * 칩 가격 중앙 설정
 *
 * 고정 공고: 기간별 차등 가격
 * - 7일: 3칩
 * - 30일: 5칩
 * - 90일: 10칩
 *
 * 긴급 공고: 고정 5칩
 */
export const CHIP_PRICING: ChipPricing[] = [
  { postingType: 'fixed', durationDays: 7, chipCost: 3 },
  { postingType: 'fixed', durationDays: 30, chipCost: 5 },
  { postingType: 'fixed', durationDays: 90, chipCost: 10 },
  { postingType: 'urgent', chipCost: 5 },
];

/**
 * 칩 비용 계산 함수
 *
 * @param postingType - 공고 타입 ('fixed' | 'urgent')
 * @param durationDays - 고정 공고 노출 기간 (7 | 30 | 90) - fixed 타입일 때만 필수
 * @returns 칩 비용
 * @throws Error - 잘못된 타입 또는 기간
 */
export const getChipCost = (postingType: PostingType, durationDays?: 7 | 30 | 90): number => {
  // regular, tournament는 무료
  if (postingType === 'regular' || postingType === 'tournament') {
    return 0;
  }

  // urgent는 고정 5칩
  if (postingType === 'urgent') {
    return 5;
  }

  // fixed는 기간에 따라 가격 변동
  if (postingType === 'fixed') {
    if (!durationDays) {
      throw new Error(i18n.t('errors.fixedPostingDurationRequired'));
    }

    const pricing = CHIP_PRICING.find(
      (p) => p.postingType === 'fixed' && p.durationDays === durationDays
    );

    if (!pricing) {
      throw new Error(i18n.t('errors.unsupportedDuration', { days: durationDays }));
    }

    return pricing.chipCost;
  }

  throw new Error(i18n.t('errors.unsupportedPostingType', { type: postingType }));
};

// ================= 충전 패키지 & 구독 플랜 =================
// 문서 출처: MODEL_B_CHIP_SYSTEM_FINAL.md

/**
 * 충전 패키지 정보 (재export)
 * src/types/payment/package.ts에서 관리
 */
export {
  CHIP_PACKAGES,
  CHIP_PACKAGE_IDS,
  getAllChipPackages,
  getChipPackage,
} from '../types/payment/package';

/**
 * 구독 플랜 정보 (재export)
 * src/types/payment/subscription.ts에서 관리
 */
export { SUBSCRIPTION_PLANS } from '../types/payment/subscription';
