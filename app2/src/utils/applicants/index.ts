/**
 * utils/applicants/index.ts - 지원자 유틸리티 통합 Export
 *
 * 기존 applicantHelpers.ts를 4개 모듈로 분리:
 * - applicantTransform: 데이터 변환 로직
 * - applicantValidation: 검증 로직
 * - applicantFormat: 포맷팅 로직
 * - applicantGrouping: 그룹화 로직
 *
 * 100% 하위 호환성 보장
 */

// Transform 모듈
export {
  convertDateToString,
  formatDateDisplay,
  getApplicantSelections,
  getApplicantSelectionsByDate,
  type Selection,
  type DateGroupedSelections,
} from './applicantTransform';

// Validation 모듈
export {
  hasMultipleSelections,
  isDuplicateInSameDate,
  getDateSelectionStats,
  getStaffCounts,
} from './applicantValidation';

// Format 모듈
export {
  jobRoleMap,
  generateDateRange,
  formatDateRange,
  isConsecutiveDates,
  findConsecutiveDateGroups,
} from './applicantFormat';

// Grouping 모듈
export {
  groupApplicationsByConsecutiveDates,
  groupApplicationsByTimeAndRole,
  groupMultiDaySelections,
  groupSingleDaySelections,
  groupConsecutiveDatesForUnconfirmed,
  type ConsecutiveDateGroup,
  type LegacyApplicationGroup,
  type ConsecutiveDateGroupForUnconfirmed,
} from './applicantGrouping';

/**
 * 통계 정보가 포함된 선택 항목 인터페이스
 * (기존 코드 호환성을 위해 re-export)
 */
export interface SelectionWithStats {
  role: string;
  time: string;
  date?: string;
  dates?: string[];
  checkMethod?: 'group' | 'individual';
  groupId?: string;
  isGrouped?: boolean;
  confirmedCount: number;
  requiredCount: number;
  isFull: boolean;
  isSelected: boolean;
}
