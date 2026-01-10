/**
 * 구인공고 관련 상수 정의
 *
 * @version 2.0.0
 * @description 날짜별 요구사항 섹션 구현을 위한 상수
 */

import { PostingType } from '@/types/postingConfig';
import { DateConstraint } from '@/types/jobPosting/dateRequirement';

/**
 * 타입별 날짜 제약사항
 *
 * @description
 * - regular/urgent: 최대 7개 날짜
 * - tournament: 복수 날짜 (최대 30개)
 * - fixed: DateRequirementsSection 사용 안 함
 */
export const DATE_CONSTRAINTS: Record<PostingType, DateConstraint> = {
  regular: {
    maxDates: 7,
    label: '최대 7개',
  },
  urgent: {
    maxDates: 7,
    label: '최대 7개',
  },
  tournament: {
    maxDates: 30,
    label: '최대 30개',
  },
  fixed: {
    maxDates: 0,
    label: '해당 없음',
  },
};

/**
 * 날짜당 최대 시간대 개수
 */
export const MAX_TIME_SLOTS_PER_DATE = 10;

/**
 * 시간대당 최대 역할 개수
 */
export const MAX_ROLES_PER_SLOT = 10;

/**
 * 역할당 최대 인원
 */
export const MAX_HEADCOUNT = 200;

/**
 * 역할당 최소 인원
 */
export const MIN_HEADCOUNT = 1;

/**
 * 스태프 역할 옵션 (한글 라벨)
 *
 * @description DateRequirementsSection에서 사용하는 역할 옵션
 */
export const STAFF_ROLE_OPTIONS = [
  { value: 'dealer', label: '딜러' },
  { value: 'floorman', label: '플로어맨' },
  { value: 'supervisor', label: '슈퍼바이저' },
  { value: 'chip_runner', label: '칩러너' },
  { value: 'other', label: '기타' },
] as const;

/**
 * 기본 시작 시간
 */
export const DEFAULT_START_TIME = '09:00';

/**
 * 에러 메시지 (날짜별 요구사항 관련)
 */
export const DATE_REQUIREMENT_ERRORS = {
  MAX_DATES_EXCEEDED: (maxDates: number) =>
    maxDates === 1
      ? '이미 1개 날짜가 추가되어 있습니다'
      : `최대 ${maxDates}개까지 추가할 수 있습니다`,
  DUPLICATE_DATE: '이미 추가된 날짜입니다',
  MIN_ONE_DATE: '최소 1개 날짜를 추가해주세요',
  MIN_ONE_TIME_SLOT: '최소 1개 시간대를 추가해주세요',
  MIN_ONE_ROLE: '최소 1개 역할을 추가해주세요',
  MAX_TIME_SLOTS_EXCEEDED: `최대 ${MAX_TIME_SLOTS_PER_DATE}개 시간대까지 추가할 수 있습니다`,
  MAX_ROLES_EXCEEDED: `최대 ${MAX_ROLES_PER_SLOT}개 역할까지 추가할 수 있습니다`,
  DUPLICATE_ROLE: '이미 추가된 역할입니다',
  INVALID_TIME_FORMAT: '시간은 HH:mm 형식이어야 합니다 (예: 09:00)',
  INVALID_HEADCOUNT_RANGE: `인원은 ${MIN_HEADCOUNT}명 이상 ${MAX_HEADCOUNT}명 이하여야 합니다`,
  CUSTOM_ROLE_REQUIRED: '기타 역할명을 입력해주세요',
} as const;
