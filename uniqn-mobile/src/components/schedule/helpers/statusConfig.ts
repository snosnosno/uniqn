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
 * - no_show: 노쇼 → 에러 (평판·정산에 불리한 기록. 취소와 반드시 구분돼야 한다)
 */
export const SCHEDULE_STATUS_STRIPE_TONE: Record<ScheduleType, CardStripeTone> = {
  applied: 'gold',
  confirmed: 'info',
  completed: 'muted',
  cancelled: 'warning',
  no_show: 'error',
};

/**
 * 노쇼 고지 문구 — 카드·그룹 카드·상세 3탭이 같은 문장을 쓴다.
 *
 * 문구를 각자 쓰면 같은 사건이 화면마다 다른 무게로 읽힌다. 이 기록은 스태프에게
 * 불리하므로 ①무슨 기록인지 ②무엇에 영향을 주는지 ③이의 제기 경로 세 가지를 반드시 함께 말한다.
 */
export const NO_SHOW_NOTICE_TITLE = '무단결근(노쇼)으로 기록되었습니다';
export const NO_SHOW_NOTICE_DESCRIPTION =
  '이 기록은 평판과 정산에 영향을 줄 수 있어요. 사실과 다르면 구인자에게 문의해 주세요.';
