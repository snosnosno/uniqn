/**
 * UNIQN Mobile - QR 출퇴근 사용법 튜토리얼 콘텐츠
 *
 * @description 스태프가 QR 스캔 화면(/scan) 첫 진입 시 표시
 * @version 2.0.0 - 공고당 고정 QR 기준으로 문구 갱신 (회전 QR 전제 제거)
 */

import { ScanIcon, CheckCircleIcon, AlertCircleIcon } from '@/components/icons';
import { PRIMARY_COLORS } from '@/constants/colors';
import type { TutorialConfig, TutorialPage } from '@/types/tutorial';

// ============================================================================
// 페이지
// ============================================================================

const PAGES: readonly TutorialPage[] = [
  {
    id: 'qr-scan',
    icon: ScanIcon,
    iconColor: PRIMARY_COLORS[700],
    title: '현장에 비치된 QR을 스캔하세요',
    subtitle: '근무지에 붙어 있는 코드를 비추면 돼요',
    description:
      'QR 스캔 화면에 들어가면 카메라가 바로 열립니다.\n근무지에 비치된 출퇴근 QR 코드를\n카메라 프레임 안에 비추세요.',
  },
  {
    id: 'qr-auto',
    icon: CheckCircleIcon,
    iconColor: PRIMARY_COLORS[700],
    title: '출근/퇴근이 자동으로 감지돼요',
    subtitle: '현재 근무 상태에 따라 자동 판별',
    description:
      '출근 전이면 "출근"으로,\n근무 중이면 "퇴근"으로 자동 처리됩니다.\n같은 QR 하나로 출근과 퇴근을 모두 합니다.',
  },
  {
    id: 'qr-tips',
    icon: AlertCircleIcon,
    iconColor: PRIMARY_COLORS[700],
    title: '이것만 기억하세요',
    subtitle: '원활한 출퇴근을 위한 안내',
    description:
      '• QR 코드는 공고마다 1장이며 바뀌지 않아요\n• 카메라 권한 허용이 필요합니다\n• 배정된 근무가 있어야 스캔이 처리됩니다\n• 스캔이 안 되면 구인자에게 문의하세요',
  },
] as const;

// ============================================================================
// Config
// ============================================================================

export const QR_CHECKIN_TUTORIAL: TutorialConfig = {
  type: 'qrCheckIn',
  accentColor: PRIMARY_COLORS[700],
  ctaText: 'QR 스캔 시작',
  pages: PAGES,
};
