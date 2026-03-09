/**
 * UNIQN Mobile - QR 출퇴근 사용법 튜토리얼 콘텐츠
 *
 * @description 스태프가 QR 탭 첫 진입 시 표시
 * @version 1.0.0
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
    title: '카메라로 QR 코드를 스캔하세요',
    subtitle: '구인자가 보여주는 코드를 비추면 돼요',
    description:
      '"카메라로 스캔하기" 버튼을 누르면 카메라가 열립니다.\n구인자의 화면에 표시된 QR 코드를\n카메라 프레임 안에 비추세요.',
  },
  {
    id: 'qr-auto',
    icon: CheckCircleIcon,
    iconColor: PRIMARY_COLORS[700],
    title: '출근/퇴근이 자동으로 감지돼요',
    subtitle: '현재 근무 상태에 따라 자동 판별',
    description:
      '출근 전이면 "출근"으로,\n근무 중이면 "퇴근"으로 자동 처리됩니다.\n화면 상단의 상태 표시를 확인하세요.',
  },
  {
    id: 'qr-tips',
    icon: AlertCircleIcon,
    iconColor: PRIMARY_COLORS[700],
    title: '이것만 기억하세요',
    subtitle: '원활한 출퇴근을 위한 안내',
    description:
      '• QR 코드는 구인자가 현장에서 생성합니다\n• 카메라 권한 허용이 필요합니다\n• QR 코드는 일정 시간 후 만료될 수 있어요\n• 스캔이 안 되면 구인자에게 새 코드를 요청하세요',
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
