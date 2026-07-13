import type { ApplicationStatus } from '@/shared/status';

/**
 * 지원 카운트 셀(홈 위젯)용 축약 라벨.
 * APPLICATION_STATUS_LABELS("지원 완료" 등 상세 메시지)는 레이아웃 공간을 넘겨
 * 카드/스트립 셀에서 파손되므로 전용 매핑을 제공한다.
 *
 * 의미: 시점 필터 없이 status 매칭만 — 지난 공고에 대한 applied 도 포함("전체 대기중").
 * 스케줄 통계는 forward-looking 계산이므로 SCHEDULE_STATS_LABELS 로 분리.
 */
export const APPLICATION_COUNT_LABELS: Record<ApplicationStatus, string> = {
  applied: '전체 대기중',
  confirmed: '확정',
  rejected: '거절',
  cancelled: '취소',
  completed: '완료',
  cancellation_pending: '취소 요청',
};

/**
 * 스케줄 통계(스케줄 탭, 월 스코프)용 라벨.
 * 조회된 월의 type 기준 집계 — 날짜 필터 없이 리스트/캘린더 표시기준과 통일(2026-07 #2 수정).
 * 홈 위젯(APPLICATION_COUNT_LABELS)은 집계 시점이 달라 cross-screen 숫자가 다를 수 있음.
 * 의미 차이를 라벨로 명시해 인지 혼선 차단.
 * - upcoming = 월 스코프 applied = 지원
 * - confirmed = 월 스코프 confirmed = 확정
 * - completed = completed = 근무 종료
 */
export const SCHEDULE_STATS_LABELS = {
  upcoming: '지원',
  confirmed: '확정',
  completed: '완료',
} as const;
