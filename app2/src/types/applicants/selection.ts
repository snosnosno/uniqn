/**
 * selection.ts - 지원자 선택 항목 타입 정의
 *
 * @module types/applicants/selection
 * @description
 * 지원자의 선택 항목과 관련된 모든 타입을 정의합니다.
 * - Selection: 기본 선택 항목 (단일 또는 그룹)
 * - DateGroupedSelections: 날짜별 그룹화된 선택 항목
 * - DateValue: Firebase Timestamp를 포함한 날짜 타입
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 날짜 타입 유니온 (Firebase Timestamp 지원)
 *
 * @description
 * Firebase Firestore에서 날짜는 Timestamp 객체로 저장되지만,
 * 프론트엔드에서는 string 또는 Date 객체로도 사용됩니다.
 * undefined도 허용하여 exactOptionalPropertyTypes와 호환됩니다.
 */
export type DateValue = string | Date | Timestamp | null | undefined;

/**
 * 선택 기간 정보
 *
 * @property type - 기간 타입 (단일/연속/다중)
 * @property startDate - 시작 날짜 (YYYY-MM-DD 형식)
 * @property endDate - 종료 날짜 (다양한 형식 지원)
 */
export interface SelectionDuration {
  type?: 'single' | 'consecutive' | 'multi';
  startDate?: string;
  endDate?: DateValue;
}

/**
 * 지원자 선택 항목 (개별 또는 그룹)
 *
 * @description
 * 지원자가 구인공고에 지원할 때 선택한 역할, 시간, 날짜 정보를 담습니다.
 *
 * **선택 방식**:
 * - **단일 선택**: date + role + time
 * - **그룹 선택**: dates[] + role + time + checkMethod='group'
 * - **연속 날짜**: isGrouped=true + dates[]
 *
 * @property role - 역할 (dealer, floor, manager 등)
 * @property time - 시간대 (예: "09:00-18:00")
 * @property date - 단일 날짜 (하위 호환성 유지)
 * @property dates - 다중 날짜 배열 (신규 필드)
 * @property checkMethod - 체크 방식 (그룹 vs 개별)
 * @property groupId - 그룹 식별자
 * @property isGrouped - 그룹 여부
 * @property duration - 기간 정보
 */
export interface Selection {
  role: string;
  time: string;

  // 날짜 (단일 vs 다중)
  date?: string;         // 단일 날짜 (YYYY-MM-DD 형식, 하위 호환)
  dates?: string[];      // 다중 날짜 배열 (신규)

  // 그룹화 메타데이터
  checkMethod?: 'group' | 'individual';
  groupId?: string;
  isGrouped?: boolean;

  // 기간 정보
  duration?: SelectionDuration;
}

/**
 * 날짜별 그룹화된 선택 사항
 *
 * @description
 * 특정 날짜에 대한 모든 선택 항목을 그룹화한 결과입니다.
 * 날짜별 UI 렌더링 및 통계 계산에 사용됩니다.
 *
 * @property date - 날짜 (YYYY-MM-DD 형식)
 * @property displayDate - 표시용 날짜 (예: "2025년 1월 15일")
 * @property selections - 해당 날짜의 모든 선택 항목
 * @property selectedCount - 선택된 항목 수
 * @property totalCount - 전체 항목 수
 */
export interface DateGroupedSelections {
  date: string;
  displayDate: string;
  selections: Selection[];
  selectedCount: number;
  totalCount: number;
}

/**
 * Selection 타입 가드
 *
 * @param obj - 검증할 객체
 * @returns Selection 타입 여부
 *
 * @example
 * ```typescript
 * const data = getDataFromAPI();
 * if (isSelection(data)) {
 *   // data는 Selection 타입으로 안전하게 사용 가능
 *   console.log(data.role, data.time);
 * }
 * ```
 */
export function isSelection(obj: unknown): obj is Selection {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.role === 'string' &&
    typeof s.time === 'string'
  );
}

/**
 * DateValue를 문자열로 안전하게 변환
 *
 * @param value - 변환할 날짜 값 (string | Date | Timestamp | null)
 * @returns YYYY-MM-DD 형식의 문자열 (실패 시 빈 문자열)
 *
 * @description
 * Firebase Timestamp, JavaScript Date, 문자열을 모두 처리할 수 있습니다.
 *
 * @example
 * ```typescript
 * // Timestamp 객체
 * const timestamp = Timestamp.fromDate(new Date('2025-01-15'));
 * convertDateValueToString(timestamp); // "2025-01-15"
 *
 * // Date 객체
 * convertDateValueToString(new Date('2025-01-15')); // "2025-01-15"
 *
 * // 문자열
 * convertDateValueToString("2025-01-15"); // "2025-01-15"
 *
 * // null 또는 undefined
 * convertDateValueToString(null); // ""
 * ```
 */
export function convertDateValueToString(value: DateValue): string {
  if (!value) return '';
  if (typeof value === 'string') return value;

  // Timestamp 객체 (Firebase)
  if ('toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return formatDateToString(date);
  }

  // Date 객체
  if (value instanceof Date) {
    return formatDateToString(value);
  }

  return '';
}

/**
 * Date 객체를 YYYY-MM-DD 형식 문자열로 변환
 *
 * @param date - 변환할 Date 객체
 * @returns YYYY-MM-DD 형식의 문자열
 * @private
 */
function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * SelectionDuration에 Timestamp가 포함되어 있는지 확인
 *
 * @param duration - 검증할 duration 객체
 * @returns Timestamp 포함 여부
 *
 * @example
 * ```typescript
 * if (hasTimestampEndDate(selection.duration)) {
 *   // endDate를 문자열로 변환
 *   const endDateStr = convertDateValueToString(selection.duration.endDate);
 * }
 * ```
 */
export function hasTimestampEndDate(duration: SelectionDuration | undefined): boolean {
  if (!duration?.endDate) return false;
  return typeof duration.endDate === 'object' && 'toDate' in duration.endDate;
}
