/**
 * UNIQN Mobile - Assignment 선택 코어 유틸리티
 *
 * @description 선택 키 생성/파싱/토글 로직 통합
 * @version 1.0.0
 *
 * 통합 대상:
 * - src/utils/assignment/selectionUtils.ts (makeSelectionKey - '|' 구분자)
 * - src/components/employer/ApplicantCard/utils.ts (createAssignmentKey - '_' 구분자)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 선택 키 구분자 옵션
 */
export type SelectionKeySeparator = '|' | '_';

/**
 * 선택 키 옵션
 */
export interface SelectionKeyOptions {
  /** 구분자 (기본값: '|') */
  separator?: SelectionKeySeparator;
}

/**
 * 파싱된 선택 키 정보
 */
export interface ParsedSelectionKey {
  date: string;
  timeSlot: string;
  role: string;
}

/**
 * 토글 결과
 */
export interface ToggleResult<T> {
  /** 새 키 Set */
  keys: Set<T>;
  /** 추가되었는지 여부 */
  added: boolean;
  /** 제거되었는지 여부 */
  removed: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** 기본 구분자 (AssignmentSelector용) */
export const DEFAULT_SEPARATOR: SelectionKeySeparator = '|';

/** ApplicantCard용 구분자 */
export const APPLICANT_SEPARATOR: SelectionKeySeparator = '_';

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 선택 키 생성
 *
 * @param date - 날짜 (YYYY-MM-DD 또는 FIXED_DATE_MARKER)
 * @param timeSlot - 시간대 (HH:MM 또는 TBA_TIME_MARKER)
 * @param role - 역할 ID
 * @param options - 구분자 옵션
 * @returns 선택 키 문자열
 *
 * @example
 * // AssignmentSelector용 (기본)
 * makeSelectionKey('2024-01-17', '09:00', 'dealer')
 * // => '2024-01-17|09:00|dealer'
 *
 * // ApplicantCard용
 * makeSelectionKey('2024-01-17', '09:00', 'dealer', { separator: '_' })
 * // => '2024-01-17_09:00_dealer'
 */
export function makeSelectionKey(
  date: string,
  timeSlot: string,
  role: string,
  options: SelectionKeyOptions = {}
): string {
  const sep = options.separator ?? DEFAULT_SEPARATOR;
  return `${date}${sep}${timeSlot}${sep}${role}`;
}

/**
 * 선택 키 파싱
 *
 * @param key - 선택 키 문자열
 * @param options - 구분자 옵션
 * @returns 파싱된 정보
 *
 * @example
 * parseSelectionKey('2024-01-17|09:00|dealer')
 * // => { date: '2024-01-17', timeSlot: '09:00', role: 'dealer' }
 */
export function parseSelectionKey(
  key: string,
  options: SelectionKeyOptions = {}
): ParsedSelectionKey {
  const sep = options.separator ?? DEFAULT_SEPARATOR;
  const parts = key.split(sep);
  return {
    date: parts[0] ?? '',
    timeSlot: parts[1] ?? '',
    role: parts[2] ?? '',
  };
}

/**
 * 선택 키에서 날짜 추출
 *
 * @param key - 선택 키 문자열
 * @param options - 구분자 옵션
 * @returns 날짜 문자열
 */
export function getDateFromKey(key: string, options: SelectionKeyOptions = {}): string {
  return parseSelectionKey(key, options).date;
}

/**
 * 선택 키에서 시간대 추출
 *
 * @param key - 선택 키 문자열
 * @param options - 구분자 옵션
 * @returns 시간대 문자열
 */
export function getTimeSlotFromKey(key: string, options: SelectionKeyOptions = {}): string {
  return parseSelectionKey(key, options).timeSlot;
}

/**
 * 선택 키에서 역할 추출
 *
 * @param key - 선택 키 문자열
 * @param options - 구분자 옵션
 * @returns 역할 문자열
 */
export function getRoleFromKey(key: string, options: SelectionKeyOptions = {}): string {
  return parseSelectionKey(key, options).role;
}

// ============================================================================
// Toggle Functions
// ============================================================================

/**
 * 선택 토글 (단순 추가/제거)
 *
 * @param selectedKeys - 현재 선택된 키 Set
 * @param key - 토글할 키
 * @returns 새 키 Set과 결과 정보
 *
 * @example
 * const result = toggleSelection(selectedKeys, 'key1');
 * // result.keys: 새 Set
 * // result.added: true/false
 * // result.removed: true/false
 */
export function toggleSelection<T extends string>(selectedKeys: Set<T>, key: T): ToggleResult<T> {
  const newKeys = new Set(selectedKeys);
  const wasSelected = newKeys.has(key);

  if (wasSelected) {
    newKeys.delete(key);
    return { keys: newKeys, added: false, removed: true };
  } else {
    newKeys.add(key);
    return { keys: newKeys, added: true, removed: false };
  }
}

/**
 * 선택 토글 (같은 날짜 배타적 선택)
 *
 * @description 같은 날짜에는 하나의 항목만 선택 가능
 * @param selectedKeys - 현재 선택된 키 Set
 * @param key - 토글할 키
 * @param options - 구분자 옵션
 * @returns 새 키 Set
 *
 * @example
 * // 같은 날짜의 다른 항목이 선택되어 있으면 자동 제거
 * const newKeys = toggleExclusiveByDate(selectedKeys, '2024-01-17_09:00_dealer', { separator: '_' });
 */
export function toggleExclusiveByDate(
  selectedKeys: Set<string>,
  key: string,
  options: SelectionKeyOptions = {}
): Set<string> {
  const newKeys = new Set(selectedKeys);
  const wasSelected = newKeys.has(key);

  if (wasSelected) {
    // 이미 선택된 항목 클릭 시 해제
    newKeys.delete(key);
  } else {
    // 새로 선택 시, 같은 날짜의 다른 항목 제거
    const targetDate = getDateFromKey(key, options);

    for (const existingKey of selectedKeys) {
      const existingDate = getDateFromKey(existingKey, options);
      if (existingDate === targetDate) {
        newKeys.delete(existingKey);
      }
    }

    newKeys.add(key);
  }

  return newKeys;
}

/**
 * 그룹 토글 (같은 날짜 배타적 선택 적용)
 *
 * @description 그룹 내 모든 항목 선택/해제
 * @param selectedKeys - 현재 선택된 키 Set
 * @param groupKeys - 그룹에 속한 키 배열
 * @param options - 구분자 옵션
 * @returns 새 키 Set
 */
export function toggleGroup(
  selectedKeys: Set<string>,
  groupKeys: string[],
  options: SelectionKeyOptions = {}
): Set<string> {
  const newKeys = new Set(selectedKeys);

  // 그룹 내 모든 항목이 선택되어 있는지 확인
  const allSelected = groupKeys.every((key) => selectedKeys.has(key));

  if (allSelected) {
    // 전체 해제
    for (const key of groupKeys) {
      newKeys.delete(key);
    }
  } else {
    // 전체 선택 (같은 날짜의 다른 항목 제거)
    for (const key of groupKeys) {
      const targetDate = getDateFromKey(key, options);

      // 같은 날짜의 기존 선택 항목 제거
      for (const existingKey of selectedKeys) {
        const existingDate = getDateFromKey(existingKey, options);
        if (existingDate === targetDate && !groupKeys.includes(existingKey)) {
          newKeys.delete(existingKey);
        }
      }

      newKeys.add(key);
    }
  }

  return newKeys;
}

/**
 * 그룹 선택 상태 확인
 *
 * @param selectedKeys - 현재 선택된 키 Set
 * @param groupKeys - 그룹에 속한 키 배열
 * @returns 'all' | 'some' | 'none'
 */
export function getGroupSelectionState(
  selectedKeys: Set<string>,
  groupKeys: string[]
): 'all' | 'some' | 'none' {
  const selectedCount = groupKeys.filter((key) => selectedKeys.has(key)).length;

  if (selectedCount === 0) return 'none';
  if (selectedCount === groupKeys.length) return 'all';
  return 'some';
}

// ============================================================================
// Backward Compatibility Aliases
// ============================================================================

/**
 * @deprecated createAssignmentKey 대신 makeSelectionKey 사용
 * ApplicantCard utils.ts 호환용
 */
export function createAssignmentKey(date: string, timeSlot: string, role: string): string {
  return makeSelectionKey(date, timeSlot, role, { separator: '_' });
}

/**
 * @deprecated getDateFromKey (options 없는 버전) 호환용
 * ApplicantCard utils.ts 호환용
 */
export function getDateFromKeyLegacy(key: string): string {
  return key.split('_')[0] ?? '';
}
