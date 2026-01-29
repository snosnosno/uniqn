/**
 * UNIQN Mobile - AssignmentSelector 타입 정의
 *
 * @description AssignmentSelector 컴포넌트에서 사용하는 타입
 */

import type { Assignment, JobPosting } from '@/types';
import type { TimeSlotInfo, RoleInfo } from '@/types/unified';
import type { SelectionKey, ScheduleGroup } from '@/utils/assignment';

/**
 * AssignmentSelector Props
 */
export interface AssignmentSelectorProps {
  /** 공고 정보 */
  jobPosting: JobPosting;
  /** 선택된 Assignments */
  selectedAssignments: Assignment[];
  /** 선택 변경 콜백 */
  onSelectionChange: (assignments: Assignment[]) => void;
  /** 최대 선택 가능 수 (기본: 제한 없음) */
  maxSelections?: number;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 역할 체크박스 Props
 */
export interface RoleCheckboxProps {
  /** 역할 정보 (v3.0: RoleInfo) */
  role: RoleInfo;
  /** 선택 여부 */
  isSelected: boolean;
  /** 토글 콜백 */
  onToggle: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * 시간 옵션 (미정 시간 정보)
 */
export interface TimeOptions {
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
}

/**
 * 날짜 선택 Props
 */
export interface DateSelectionProps {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 시간대 정보 배열 (v3.0: TimeSlotInfo[]) */
  timeSlots: TimeSlotInfo[];
  /** 메인 날짜 여부 */
  isMainDate?: boolean;
  /** 설명 */
  description?: string;
  /** 선택된 키 Set */
  selectedKeys: Set<SelectionKey>;
  /** 역할 토글 콜백 */
  onRoleToggle: (
    date: string,
    slotTime: string,
    role: string,
    timeOptions?: TimeOptions
  ) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * 그룹 선택 Props (대회 공고용)
 */
export interface DateGroupSelectionProps {
  /** 스케줄 그룹 */
  group: ScheduleGroup;
  /** 선택된 키 Set */
  selectedKeys: Set<SelectionKey>;
  /** 그룹 역할 토글 콜백 (그룹 내 모든 날짜 동시 선택/해제) */
  onGroupRoleToggle: (
    group: ScheduleGroup,
    slotTime: string,
    role: string,
    timeOptions?: TimeOptions
  ) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}
