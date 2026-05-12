/**
 * UNIQN Mobile - 스케줄 컴포넌트 모듈
 *
 * @description 스케줄 관련 컴포넌트 내보내기
 * @version 1.1.0
 */

// CalendarView 는 barrel re-export 제외 — schedule.tsx 에서 lazy import 로만 사용.
// barrel 에 두면 metro 가 react-native-calendars(112KB) + moment(60KB) + lodash(73KB) 를
// main bundle 에 끌어옴(transitive chain 추적). lazy chunk 효과 무효화 방지.
export { ScheduleDetailSheet } from './ScheduleDetailSheet';
export { ScheduleDetailModal } from './ScheduleDetailModal';
export type { ScheduleDetailModalProps } from './ScheduleDetailModal';
export { ScheduleCard } from './ScheduleCard';
export type { ScheduleCardProps } from './ScheduleCard';
export { GroupedScheduleCard } from './GroupedScheduleCard';
export type { GroupedScheduleCardProps } from './GroupedScheduleCard';
export { WorkLogList } from './WorkLogList';
export type { WorkLogListProps } from './WorkLogList';

// Tab components
export * from './tabs';
