/**
 * 주문서 테스트 헬퍼 — scheduleGroups 폼 계약(S1) 픽스처 유틸
 *
 * singleGroup: 구(dates+timeSlots 평탄) 픽스처를 단일 그룹 형태로 기계 포팅(설계 Eng-L2 —
 * 신구 등가성 회귀의 기준). jest testMatch(*.test.*)에 안 걸리는 순수 헬퍼 모듈.
 */
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type ScheduleGroups = OrderSheetValues['scheduleGroups'];
type GroupTimeSlots = ScheduleGroups[number]['timeSlots'];

export const singleGroup = (
  dates: string[],
  timeSlots: GroupTimeSlots,
  grouped = false
): ScheduleGroups => [{ dates, timeSlots, grouped }];
