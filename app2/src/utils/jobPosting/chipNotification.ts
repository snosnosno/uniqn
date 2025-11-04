import { PostingType } from '../../types/jobPosting/jobPosting';
import { toast } from '../toast';
import { formatChipCost } from './chipCalculator';

/**
 * 칩 차감 예정 알림 표시
 *
 * @param postingType - 공고 타입
 * @param chipCost - 차감될 칩 비용
 */
export const notifyChipDeduction = (
  postingType: PostingType,
  chipCost: number
): void => {
  // 무료 공고는 알림 표시하지 않음
  if (chipCost === 0) {
    return;
  }

  const typeNames: Record<PostingType, string> = {
    regular: '지원 공고',
    fixed: '고정 공고',
    tournament: '대회 공고',
    urgent: '긴급 공고'
  };

  const typeName = typeNames[postingType] || '공고';
  const costText = formatChipCost(chipCost);

  toast.info(`${typeName} 생성 시 ${costText}이 차감될 예정입니다.`);
};

/**
 * 칩 부족 알림 표시
 *
 * @param requiredChips - 필요한 칩 수
 * @param currentChips - 현재 보유 칩 수
 */
export const notifyInsufficientChips = (
  requiredChips: number,
  currentChips: number
): void => {
  const shortage = requiredChips - currentChips;

  toast.error(
    `칩이 부족합니다. ${shortage}칩이 더 필요합니다. (보유: ${currentChips}칩, 필요: ${requiredChips}칩)`
  );
};
