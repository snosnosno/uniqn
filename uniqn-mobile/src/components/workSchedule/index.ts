/**
 * workSchedule 컴포넌트 배럴 — 근무표(운영처) 화면 구성 요소.
 *
 * **화면 컴포넌트**는 전부 weekly_grid_enabled 플래그 뒤에서만 사용된다(OFF면 화면 미노출).
 * 예외: 순수 빌더(addSlotPayload)와 시간 입력 프리미티브(StartTimeField/SlotTimeField)는
 * 시간 저장 규약(§K)의 SSOT 라서 플래그 밖 공고 경로(AddStaffModal)도 직접 경로로 공유한다.
 */
export { VenueSelector, type VenueSelectorProps } from './VenueSelector';
export { VenueDayDetail, type VenueDayDetailProps } from './VenueDayDetail';
export { VenueDayPanel, type VenueDayPanelProps } from './VenueDayPanel';
export { buildVenueDayGroup, mapVenueDaySlotToConfirmedStaff } from './venueDayDetailMapping';
export { AddSlotSheet, type AddSlotSheetProps } from './AddSlotSheet';
export { buildAddSlotPayload, type BuildAddSlotPayloadParams } from './addSlotPayload';
export { EditSlotSheet, type EditSlotSheetProps } from './EditSlotSheet';
export { VenueCreateSheet, type VenueCreateSheetProps } from './VenueCreateSheet';
export { VenueSettingsSheet, type VenueSettingsSheetProps } from './VenueSettingsSheet';
export { GridBadgeLegend } from './GridBadgeLegend';
