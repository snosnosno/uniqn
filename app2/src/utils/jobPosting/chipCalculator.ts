import { PostingType } from '../../types/jobPosting/jobPosting';
import { CHIP_PRICING } from '../../config/chipPricing';
import { logError } from '../logger';

/**
 * 칩 비용 계산 함수
 *
 * @param postingType - 공고 타입 ('regular' | 'fixed' | 'tournament' | 'urgent')
 * @param durationDays - 고정 공고 노출 기간 (7 | 30 | 90) - fixed 타입일 때만 필수
 * @returns 칩 비용
 * @throws Error - 잘못된 타입 또는 기간
 */
export const calculateChipCost = (
  postingType: PostingType,
  durationDays?: 7 | 30 | 90
): number => {
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
      const error = new Error('고정 공고는 노출 기간(durationDays)이 필요합니다');
      logError('고정 공고는 노출 기간(durationDays)이 필요합니다', error, {
        component: 'chipCalculator',
        operation: 'calculateChipCost'
      });
      throw error;
    }

    // 유효한 기간인지 확인
    if (![7, 30, 90].includes(durationDays)) {
      const error = new Error(`지원하지 않는 노출 기간입니다: ${durationDays}일`);
      logError('지원하지 않는 노출 기간입니다', error, {
        component: 'chipCalculator',
        operation: 'calculateChipCost'
      });
      throw error;
    }

    const pricing = CHIP_PRICING.find(
      p => p.postingType === 'fixed' && p.durationDays === durationDays
    );

    if (!pricing) {
      const error = new Error(`지원하지 않는 노출 기간입니다: ${durationDays}일`);
      logError('칩 가격 설정을 찾을 수 없습니다', error, {
        component: 'chipCalculator',
        operation: 'calculateChipCost'
      });
      throw error;
    }

    return pricing.chipCost;
  }

  // 지원하지 않는 타입
  const error = new Error(`지원하지 않는 공고 타입입니다: ${postingType}`);
  logError('지원하지 않는 공고 타입입니다', error, {
    component: 'chipCalculator',
    operation: 'calculateChipCost'
  });
  throw error;
};

/**
 * 칩 비용을 포맷팅하여 표시
 *
 * @param chipCost - 칩 비용
 * @returns 포맷팅된 문자열 (예: "3칩", "무료")
 */
export const formatChipCost = (chipCost: number): string => {
  if (chipCost === 0) {
    return '무료';
  }
  return `${chipCost}칩`;
};
