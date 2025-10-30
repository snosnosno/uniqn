import { BoardTab } from '../types/jobPosting/boardTab';

/**
 * 게시판 탭 동적 설정
 *
 * 새로운 공고 타입 추가 시:
 * 1. 이 파일에 탭 설정 추가
 * 2. i18n 번역 키 추가 (locales 디렉토리의 translation.json)
 * 3. Feature Flag 추가 (선택)
 * 4. 타입별 스타일 추가 (JobPostingCard)
 */
export const BOARD_TABS: BoardTab[] = [
  {
    id: 'regular',
    labelKey: 'jobBoard.tabs.regular',
    icon: '📋',
    postingType: 'regular',
    order: 1,
    enabled: true  // 지원 공고 (항상 활성화)
  },
  {
    id: 'fixed',
    labelKey: 'jobBoard.tabs.fixed',
    icon: '📌',
    postingType: 'fixed',
    order: 2,
    enabled: true  // 고정 공고 (항상 활성화)
  },
  {
    id: 'tournament',
    labelKey: 'jobBoard.tabs.tournament',
    icon: '🏆',
    postingType: 'tournament',
    order: 3,
    enabled: true  // 대회 공고 (Feature Flag로 제어 가능)
  },
  {
    id: 'urgent',
    labelKey: 'jobBoard.tabs.urgent',
    icon: '🚨',
    postingType: 'urgent',
    order: 4,
    enabled: true  // 긴급 공고 (Feature Flag로 제어 가능)
  },
  {
    id: 'myApplications',
    labelKey: 'jobBoard.tabs.myApplications',
    icon: '📝',
    // postingType 생략 - 타입 필터링 없음 (내가 지원한 공고 전체)
    order: 5,
    enabled: true  // 내지원 탭 (항상 활성화)
  }
];

/**
 * 활성화된 탭만 반환
 * Feature Flag나 enabled 설정에 따라 필터링
 */
export const getEnabledTabs = (): BoardTab[] => {
  return BOARD_TABS.filter(tab => tab.enabled).sort((a, b) => a.order - b.order);
};
