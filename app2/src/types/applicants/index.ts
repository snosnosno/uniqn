/**
 * applicants/index.ts - 지원자 관련 타입 중앙 Export
 *
 * @module types/applicants
 */

// Selection 관련 타입
export type { DateValue, SelectionDuration, Selection, DateGroupedSelections } from './selection';
export { isSelection, convertDateValueToString, hasTimestampEndDate } from './selection';
