import { PostingType } from './jobPosting';

/**
 * 게시판 탭 설정 인터페이스
 * 동적 탭 생성을 위한 설정
 */
export interface BoardTab {
  id: string; // 고유 ID (regular, fixed, tournament, urgent, myApplications)
  labelKey: string; // i18n 키 (jobBoard.tabs.regular)
  icon: string; // 이모지 아이콘
  postingType?: PostingType; // 필터링할 공고 타입 (내지원 탭은 null)
  order: number; // 표시 순서 (1부터 시작)
  enabled: boolean; // Feature Flag로 제어 (false일 때 UI에 표시 안 됨)
}
