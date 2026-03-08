/**
 * UNIQN Mobile - 정산 절차 안내 튜토리얼 콘텐츠
 *
 * @description 정산 화면 첫 진입 시 표시. 역할별 다른 콘텐츠.
 * @version 1.0.0
 */

import {
  ClockIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  BanknotesIcon,
  CurrencyYenIcon,
  BellIcon,
} from '@/components/icons';
import { STATUS_COLORS } from '@/constants/colors';
import type { TutorialConfig, TutorialPage } from '@/types/tutorial';

// ============================================================================
// 구인자 페이지
// ============================================================================

const EMPLOYER_PAGES: readonly TutorialPage[] = [
  {
    id: 'se-hours',
    icon: ClockIcon,
    iconColor: STATUS_COLORS.success,
    title: '근무 시간을 확인하세요',
    subtitle: 'QR 출퇴근 기록을 기반으로 자동 계산',
    description:
      '스태프의 QR 출퇴근 기록이 자동으로 표시됩니다.\n출퇴근 시간이 정확한지 확인하고,\n필요하면 수동으로 수정할 수 있어요.',
  },
  {
    id: 'se-salary',
    icon: CurrencyDollarIcon,
    iconColor: STATUS_COLORS.success,
    title: '급여를 설정하세요',
    subtitle: '시급, 일급, 월급 + 수당까지',
    description:
      '급여 유형(시급/일급/월급)을 선택하고 금액을 입력하세요.\n교통비, 식비 등 추가 수당도 설정할 수 있습니다.\n세금은 자동 계산됩니다.',
  },
  {
    id: 'se-process',
    icon: CheckCircleIcon,
    iconColor: STATUS_COLORS.success,
    title: '정산을 진행하세요',
    subtitle: '개별 정산 또는 일괄 정산 모두 가능',
    description:
      '스태프별 카드에서 개별 정산하거나,\n상단의 일괄 정산 버튼으로 한 번에 처리하세요.\n정산 완료 시 스태프에게 알림이 전송됩니다.',
  },
  {
    id: 'se-overview',
    icon: BanknotesIcon,
    iconColor: STATUS_COLORS.success,
    title: '정산 현황을 한눈에',
    subtitle: '미정산, 완료, 총액을 요약 카드로 확인',
    description:
      '상단 요약 카드에서 미정산 건수와 금액,\n완료된 금액을 바로 확인할 수 있어요.\n정산 설정에서 기본 급여와 세금 옵션도 변경 가능합니다.',
  },
] as const;

// ============================================================================
// 스태프 페이지
// ============================================================================

const STAFF_PAGES: readonly TutorialPage[] = [
  {
    id: 'ss-attendance',
    icon: ClockIcon,
    iconColor: STATUS_COLORS.success,
    title: '출퇴근 기록을 확인하세요',
    subtitle: 'QR 스캔으로 기록된 시간이 표시돼요',
    description:
      '현장에서 QR 코드를 스캔하면\n출퇴근 시간이 자동으로 기록됩니다.\n내 스케줄에서 기록을 확인할 수 있어요.',
  },
  {
    id: 'ss-pay',
    icon: CurrencyYenIcon,
    iconColor: STATUS_COLORS.success,
    title: '급여 금액을 확인하세요',
    subtitle: '근무 시간 기반으로 자동 계산된 금액',
    description:
      '출퇴근 기록을 기반으로 계산된 급여가 표시됩니다.\n시급, 수당, 세금 공제 내역을\n상세히 확인할 수 있어요.',
  },
  {
    id: 'ss-notification',
    icon: BellIcon,
    iconColor: STATUS_COLORS.success,
    title: '정산 완료 알림을 받으세요',
    subtitle: '구인자가 정산하면 알림이 와요',
    description:
      '구인자가 정산을 완료하면\n푸시 알림으로 알려드립니다.\n정산 상태는 내 스케줄에서 "정산 완료"로 표시됩니다.',
  },
] as const;

// ============================================================================
// Config
// ============================================================================

export const SETTLEMENT_EMPLOYER_TUTORIAL: TutorialConfig = {
  type: 'settlement',
  version: 1,
  accentColor: STATUS_COLORS.success,
  ctaText: '정산 시작하기',
  pages: EMPLOYER_PAGES,
};

export const SETTLEMENT_STAFF_TUTORIAL: TutorialConfig = {
  type: 'settlement',
  version: 1,
  accentColor: STATUS_COLORS.success,
  ctaText: '확인했어요',
  pages: STAFF_PAGES,
};
