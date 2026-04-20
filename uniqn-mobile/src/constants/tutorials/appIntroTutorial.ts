/**
 * UNIQN Mobile - 앱 기능 소개 튜토리얼 콘텐츠
 *
 * @description 첫 메인 탭 진입 시 표시. 역할별 다른 콘텐츠.
 * @version 1.0.0
 */

import {
  SearchIcon,
  BriefcaseIcon,
  ScanIcon,
  BanknotesIcon,
  EditIcon,
  UsersIcon,
  QrCodeIcon,
  CreditCardIcon,
} from '@/components/icons';
import { PRIMARY_COLORS } from '@/constants/colors';
import type { TutorialConfig, TutorialPage } from '@/types/tutorial';

// ============================================================================
// 스태프 페이지
// ============================================================================

const STAFF_PAGES: readonly TutorialPage[] = [
  {
    id: 'staff-explore',
    icon: SearchIcon,
    iconColor: PRIMARY_COLORS[500],
    title: '원하는 공고를 찾아보세요',
    subtitle: '날짜, 지역, 타입별로 필터링하세요',
    description:
      '긴급, 대회, 일반, 고정 4가지 타입의 공고를 탐색하고\n달력에서 원하는 날짜의 공고만 볼 수 있어요.',
  },
  {
    id: 'staff-apply',
    icon: BriefcaseIcon,
    iconColor: PRIMARY_COLORS[500],
    title: '터치 한 번으로 지원하세요',
    subtitle: '원하는 날짜와 역할을 선택하면 끝',
    description:
      '공고를 확인하고 근무 가능한 날짜를 선택한 뒤,\n사전질문에 답변하면 지원이 완료됩니다.\n확정되면 알림으로 알려드려요.',
  },
  {
    id: 'staff-qr',
    icon: ScanIcon,
    iconColor: PRIMARY_COLORS[500],
    title: 'QR로 출퇴근하세요',
    subtitle: '현장에서 QR 코드를 스캔하면 자동 처리',
    description:
      '구인자가 생성한 QR 코드를 카메라로 스캔하세요.\n근무 상태에 따라 출근 또는 퇴근이\n자동으로 기록됩니다.',
  },
  {
    id: 'staff-settlement',
    icon: BanknotesIcon,
    iconColor: PRIMARY_COLORS[500],
    title: '정산 내역을 확인하세요',
    subtitle: '급여와 정산 상태를 한눈에',
    description:
      '근무가 완료되면 구인자가 정산을 진행합니다.\n정산이 완료되면 알림을 받을 수 있고,\n내 스케줄에서 전체 내역을 확인할 수 있어요.',
  },
] as const;

// ============================================================================
// 구인자 페이지
// ============================================================================

const EMPLOYER_PAGES: readonly TutorialPage[] = [
  {
    id: 'employer-posting',
    icon: EditIcon,
    iconColor: PRIMARY_COLORS[500],
    title: '공고를 작성해 보세요',
    subtitle: '4가지 타입 중 상황에 맞는 공고를 선택',
    description:
      '일반, 긴급, 대회, 고정 타입 중 선택하고\n날짜, 역할, 급여를 설정하세요.\n템플릿으로 반복 작성도 간편해요.',
  },
  {
    id: 'employer-applicants',
    icon: UsersIcon,
    iconColor: PRIMARY_COLORS[500],
    title: '지원자를 관리하세요',
    subtitle: '확정, 거절, 비고 입력까지 한 화면에서',
    description:
      '지원자 목록을 확인하고 확정 또는 거절하세요.\n비고를 남겨두면 다음에 같은 스태프가\n지원할 때 참고할 수 있어요.',
  },
  {
    id: 'employer-qr',
    icon: QrCodeIcon,
    iconColor: PRIMARY_COLORS[500],
    title: 'QR 코드로 출퇴근을 관리하세요',
    subtitle: '현장에서 QR을 생성하면 스태프가 스캔해요',
    description:
      '내 공고 탭에서 QR 코드를 생성하세요.\n스태프가 이 코드를 스캔하면\n출퇴근이 자동으로 기록됩니다.',
  },
  {
    id: 'employer-settlement',
    icon: CreditCardIcon,
    iconColor: PRIMARY_COLORS[500],
    title: '간편하게 정산하세요',
    subtitle: '개별 또는 일괄로 급여를 정산',
    description:
      '출퇴근 기록을 확인하고 급여를 설정한 뒤,\n개별 또는 일괄 정산을 진행하세요.\n세금 계산도 자동으로 처리됩니다.',
  },
] as const;

// ============================================================================
// Config
// ============================================================================

export const APP_INTRO_STAFF: TutorialConfig = {
  type: 'appIntro',
  accentColor: PRIMARY_COLORS[500],
  ctaText: '공고 둘러보기',
  pages: STAFF_PAGES,
};

export const APP_INTRO_EMPLOYER: TutorialConfig = {
  type: 'appIntro',
  accentColor: PRIMARY_COLORS[500],
  ctaText: '공고 작성하기',
  pages: EMPLOYER_PAGES,
};
