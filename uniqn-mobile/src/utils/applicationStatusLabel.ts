import type { ApplicationStatus } from '@/shared/status';

/**
 * 지원 카운트 셀(홈 위젯, 스케줄 통계)용 축약 라벨.
 * APPLICATION_STATUS_LABELS("지원 완료" 등 상세 메시지)는 레이아웃 공간을 넘겨
 * 카드/스트립 셀에서 파손되므로 전용 매핑을 제공한다.
 */
export const APPLICATION_COUNT_LABELS: Record<ApplicationStatus, string> = {
  applied: '대기중',
  confirmed: '확정',
  rejected: '거절',
  cancelled: '취소',
  completed: '완료',
  cancellation_pending: '취소 요청',
};

export function getApplicationCountLabel(status: ApplicationStatus): string {
  return APPLICATION_COUNT_LABELS[status];
}

/**
 * 스케줄 통계(앞으로의 일정 기준, forward-looking)용 라벨.
 * 홈의 ApplicationStatusWidget과 동일 어휘를 사용해 역할 간 인지 혼선을 줄인다.
 * - upcoming = 미래 applied = 확정 대기
 * - confirmed = 미래 confirmed = 확정 완료
 * - completed = 과거 completed = 근무 종료
 */
export const SCHEDULE_STATS_LABELS = {
  upcoming: '대기중',
  confirmed: '확정',
  completed: '완료',
} as const;
