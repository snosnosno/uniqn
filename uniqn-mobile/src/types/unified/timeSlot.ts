/**
 * UNIQN Mobile - 통합 시간대 타입
 *
 * @description 모든 공고 타입에서 사용하는 단일 시간대 표현
 * @version 1.0.0
 */

import type { RoleInfo } from './role';

// ============================================================================
// Types
// ============================================================================

/**
 * 통합 시간대 정보 타입
 *
 * @description 날짜별 요구사항(DateSpecificRequirement)의 시간대를
 * 정규화된 형태로 표현
 */
export interface TimeSlotInfo {
  /** 고유 ID (React key용) */
  id: string;

  /** 시작 시간 (HH:mm 형식), 미정인 경우 null */
  startTime: string | null;

  /** 종료 시간 (HH:mm 형식), 선택 */
  endTime?: string | null;

  /** 시간 미정 여부 */
  isTimeToBeAnnounced: boolean;

  /** 미정 사유 */
  tentativeDescription?: string;

  /** 종일 근무 여부 */
  isFullDay?: boolean;

  /** 역할별 모집 정보 */
  roles: RoleInfo[];
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * TimeSlotInfo 생성 헬퍼
 *
 * @param id - 고유 ID
 * @param startTime - 시작 시간 (HH:mm)
 * @param roles - 역할 배열
 * @param options - 추가 옵션 (시간 미정, 종일 등)
 * @returns TimeSlotInfo 객체
 *
 * @example
 * const slot = createTimeSlotInfo('slot-1', '19:00', roles);
 * const tbaSlot = createTimeSlotInfo('slot-2', null, roles, {
 *   isTimeToBeAnnounced: true,
 *   tentativeDescription: '추후 공지'
 * });
 */
export function createTimeSlotInfo(
  id: string,
  startTime: string | null,
  roles: RoleInfo[],
  options?: {
    endTime?: string | null;
    isTimeToBeAnnounced?: boolean;
    tentativeDescription?: string;
    isFullDay?: boolean;
  }
): TimeSlotInfo {
  const isTimeToBeAnnounced = options?.isTimeToBeAnnounced ?? false;

  return {
    id,
    startTime: isTimeToBeAnnounced ? null : startTime,
    endTime: options?.endTime,
    isTimeToBeAnnounced,
    tentativeDescription: isTimeToBeAnnounced
      ? options?.tentativeDescription
      : undefined,
    isFullDay: options?.isFullDay,
    roles,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 시간 표시 문자열 생성
 *
 * @param slot - TimeSlotInfo 객체
 * @returns 표시용 시간 문자열
 *
 * @example
 * formatTimeSlotDisplay(slot) // "19:00" 또는 "미정 (추후 공지)" 또는 "종일"
 */
export function formatTimeSlotDisplay(slot: TimeSlotInfo): string {
  if (slot.isFullDay) {
    return '종일';
  }

  if (slot.isTimeToBeAnnounced) {
    return slot.tentativeDescription
      ? `미정 (${slot.tentativeDescription})`
      : '미정';
  }

  if (slot.startTime && slot.endTime) {
    return `${slot.startTime} ~ ${slot.endTime}`;
  }

  return slot.startTime ?? '-';
}

/**
 * 시간대의 전체 필요 인원 합계
 *
 * @param slot - TimeSlotInfo 객체
 * @returns 필요 인원 합계
 */
export function getSlotTotalRequired(slot: TimeSlotInfo): number {
  return slot.roles.reduce((sum, r) => sum + r.requiredCount, 0);
}

/**
 * 시간대의 전체 충원 인원 합계
 *
 * @param slot - TimeSlotInfo 객체
 * @returns 충원 인원 합계
 */
export function getSlotTotalFilled(slot: TimeSlotInfo): number {
  return slot.roles.reduce((sum, r) => sum + r.filledCount, 0);
}

/**
 * 시간대의 마감 여부 확인
 *
 * @param slot - TimeSlotInfo 객체
 * @returns 마감 여부
 */
export function isSlotFilled(slot: TimeSlotInfo): boolean {
  const total = getSlotTotalRequired(slot);
  const filled = getSlotTotalFilled(slot);
  return total > 0 && filled >= total;
}
