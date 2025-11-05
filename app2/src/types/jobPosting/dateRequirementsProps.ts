/**
 * DateRequirementsSection Props 타입
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections/DateRequirementsSection.tsx
 */

import { SectionProps, ValidationState } from './sectionProps';
import { DateSpecificRequirement } from './base';

/**
 * DateRequirements 섹션 데이터
 */
export interface DateRequirementsData {
  /** 날짜별 요구사항 배열 */
  dateSpecificRequirements: DateSpecificRequirement[];
}

/**
 * DateRequirements 섹션 이벤트 핸들러
 */
export interface DateRequirementsHandlers {
  /**
   * 시간대 변경 핸들러
   * @param dateIndex - 날짜 인덱스
   * @param timeSlotIndex - 시간대 인덱스
   * @param value - 새로운 시간 값
   */
  onTimeSlotChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;

  /**
   * 시간 미정 토글 핸들러
   * @param dateIndex - 날짜 인덱스
   * @param timeSlotIndex - 시간대 인덱스
   * @param isAnnounced - 미정 여부
   */
  onTimeToBeAnnouncedToggle: (dateIndex: number, timeSlotIndex: number, isAnnounced: boolean) => void;

  /**
   * 미정 설명 변경 핸들러
   * @param dateIndex - 날짜 인덱스
   * @param timeSlotIndex - 시간대 인덱스
   * @param value - 미정 설명
   */
  onTentativeDescriptionChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;

  /**
   * 역할 변경 핸들러
   * @param dateIndex - 날짜 인덱스
   * @param timeSlotIndex - 시간대 인덱스
   * @param roleIndex - 역할 인덱스
   * @param field - 변경할 필드명 ('name' | 'count')
   * @param value - 새로운 값 (string | number)
   */
  onRoleChange: (
    dateIndex: number,
    timeSlotIndex: number,
    roleIndex: number,
    field: 'name' | 'count',
    value: string | number
  ) => void;
}

/**
 * DateRequirements 섹션 검증 에러
 *
 * 날짜 인덱스별 에러 메시지
 */
export interface DateRequirementErrors {
  date?: string;
  timeSlots?: string;
  [key: string]: string | undefined;
}

/**
 * DateRequirements 섹션 검증 상태
 */
export interface DateRequirementsValidation {
  /** 에러 메시지 */
  errors: {
    dateSpecificRequirements?: string;
    [key: string]: string | undefined;
  };

  /** touched 상태 */
  touched: {
    dateSpecificRequirements?: boolean;
    [key: string]: boolean | undefined;
  };
}

/**
 * DateRequirementsSection Props
 */
export interface DateRequirementsSectionProps extends SectionProps<
  DateRequirementsData,
  DateRequirementsHandlers,
  DateRequirementsValidation
> {}
