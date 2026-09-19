import { TBA_TIME_MARKER } from '@/domains/application';
import type { RoleInfo, TimeSlotInfo } from '@/types/unified';

/**
 * 슬롯에서 지원 배정(`Assignment.timeSlot`)에 실을 값을 고른다.
 *
 * 🔴 예전엔 이 한 줄이 **세 곳에 그대로 복제**돼 있었다(AssignmentSelector·DateSelection·
 *    DateGroupSelection). 셋 중 하나만 고치면 "선택은 됐는데 정원 키가 안 맞아 항상 마감"이
 *    조용히 생긴다 — 복제를 지우는 것이 이 헬퍼의 존재 이유다.
 *
 * ⚠️ 시각이 없을 때의 폴백은 `''` 이 아니라 `'미정'` 이다. 서버는 둘을 같은 키로 접지만
 *    (`_posting_slot_key`), `''` 를 그대로 보내면 **미정을 표현하는 값이 또 하나 늘어난다** —
 *    이 재설계가 없애려는 바로 그 분열이다. 쓰기는 `'미정'` 하나로 통일한다.
 *    (null 을 보내지 않는 이유: 구버전 사장 앱의 엄격한 zod 가 지원서 레코드를 통째로 증발시킨다.)
 */
export function getSlotSelectionTime(
  slot: Pick<TimeSlotInfo, 'isTimeToBeAnnounced' | 'startTime'>
) {
  return slot.isTimeToBeAnnounced ? TBA_TIME_MARKER : slot.startTime || TBA_TIME_MARKER;
}

export function getEffectiveRoleId(role: Pick<RoleInfo, 'roleId' | 'customName'>): string {
  return role.roleId === 'other' && role.customName ? role.customName : role.roleId;
}

export function getRoleCheckboxKey(
  role: Pick<RoleInfo, 'roleId' | 'customName'>,
  fallbackIndex: number
): string {
  const effectiveRoleId = getEffectiveRoleId(role);
  return `${effectiveRoleId || role.roleId || 'role'}-${fallbackIndex}`;
}
