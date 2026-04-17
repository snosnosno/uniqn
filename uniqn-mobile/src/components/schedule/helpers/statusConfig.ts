/**
 * UNIQN Mobile - ScheduleCard 상태 설정
 *
 * @description 중앙 상수에서 re-export + 상태별 stripe tone 매핑 (Phase 3 Tier A §B 카드 언어)
 * @version 1.2.0 - SCHEDULE_STATUS_STRIPE_TONE 추가
 */

import type { CardStripeTone } from '@/components/ui';
import type { ScheduleType } from '@/shared/status';

export {
  SCHEDULE_STATUS as statusConfig,
  ATTENDANCE_STATUS as attendanceConfig,
} from '@/constants/statusConfig';

/**
 * 일정 상태 → CardStripe tone 매핑.
 *
 * - applied: 대기/검토 중 → 골드 (기본/지원 완료 어필)
 * - confirmed: 확정 → 블루 (정보/확정 톤)
 * - completed: 완료 → 뮤트 (지나간 작업)
 * - cancelled: 취소 → 워닝 (주의 유발, 옵셔널로 사용)
 */
export const SCHEDULE_STATUS_STRIPE_TONE: Record<ScheduleType, CardStripeTone> = {
  applied: 'gold',
  confirmed: 'info',
  completed: 'muted',
  cancelled: 'warning',
};
