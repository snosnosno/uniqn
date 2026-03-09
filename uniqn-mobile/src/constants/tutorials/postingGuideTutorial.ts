/**
 * UNIQN Mobile - 공고 작성 가이드 튜토리얼 콘텐츠
 *
 * @description 구인자가 공고 작성 화면 첫 진입 시 표시
 * @version 1.0.0
 */

import {
  Squares2X2Icon,
  DocumentIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  CopyIcon,
} from '@/components/icons';
import { ACCENT_COLORS } from '@/constants/colors';
import type { TutorialConfig, TutorialPage } from '@/types/tutorial';

// ============================================================================
// 페이지
// ============================================================================

const PAGES: readonly TutorialPage[] = [
  {
    id: 'pg-type',
    icon: Squares2X2Icon,
    iconColor: ACCENT_COLORS[500],
    title: '공고 타입을 선택하세요',
    subtitle: '상황에 따라 4가지 타입이 준비되어 있어요',
    description:
      '일반 — 일반적인 구인 공고\n긴급 — 7일 이내 급히 필요한 인원 (우선 노출)\n대회 — 토너먼트/대회 공고 (다중 날짜)\n고정 — 상시 채용 공고 (기간제)',
  },
  {
    id: 'pg-basic',
    icon: DocumentIcon,
    iconColor: ACCENT_COLORS[500],
    title: '기본 정보를 입력하세요',
    subtitle: '제목, 장소, 상세 설명을 작성해요',
    description:
      '공고 제목(최대 25자), 근무 장소, 상세 설명을 입력하세요.\n스태프가 한눈에 파악할 수 있도록\n명확하게 작성해 주세요.',
  },
  {
    id: 'pg-schedule',
    icon: CalendarIcon,
    iconColor: ACCENT_COLORS[500],
    title: '근무 일정을 설정하세요',
    subtitle: '타입에 따라 날짜 설정 방식이 달라요',
    description:
      '일반/긴급 — 캘린더에서 날짜 선택 후 시간대 추가\n대회 — 여러 날짜를 그룹으로 묶어 역할 배정\n고정 — 주 출근일수와 근무 요일 설정',
  },
  {
    id: 'pg-salary',
    icon: CurrencyDollarIcon,
    iconColor: ACCENT_COLORS[500],
    title: '역할과 급여를 설정하세요',
    subtitle: '역할별 인원과 급여를 개별 지정 가능',
    description:
      '딜러, 플로어, 서빙 등 역할을 추가하고\n각 역할별 필요 인원과 시급/일급/월급을\n설정하세요. 역할별로 다른 급여를 지정할 수 있어요.',
  },
  {
    id: 'pg-template',
    icon: CopyIcon,
    iconColor: ACCENT_COLORS[500],
    title: '템플릿으로 빠르게 작성하세요',
    subtitle: '자주 쓰는 설정을 저장하고 불러오기',
    description:
      '작성한 공고를 템플릿으로 저장하면\n다음에 같은 설정으로 빠르게 공고를 작성할 수 있어요.\n날짜만 바꾸면 됩니다.',
  },
] as const;

// ============================================================================
// Config
// ============================================================================

export const POSTING_GUIDE_TUTORIAL: TutorialConfig = {
  type: 'postingGuide',
  accentColor: ACCENT_COLORS[500],
  ctaText: '공고 작성 시작',
  pages: PAGES,
};
