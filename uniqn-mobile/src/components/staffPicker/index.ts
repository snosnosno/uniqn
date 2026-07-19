/**
 * staffPicker — 스태프 후보 선택 공유 프리미티브 배럴
 *
 * 그리드 인원 추가 시트(AddSlotSheet)와 스태프 직접추가 모달(AddStaffModal)이 공유하는
 * 순수 표현(presentational) 컴포넌트 모음. 검색·변이 로직은 각 호출부에 남긴다.
 */
export { CandidateRow } from './CandidateRow';
export type { CandidateRowProps } from './CandidateRow';
export { RoleChips } from './RoleChips';
export type { RoleChipsProps } from './RoleChips';
export { NicknameSearchField } from './NicknameSearchField';
export type { NicknameSearchFieldProps } from './NicknameSearchField';
export { SearchErrorNotice, resolveSearchErrorMessage } from './SearchErrorNotice';
export type { SearchErrorNoticeProps } from './SearchErrorNotice';
