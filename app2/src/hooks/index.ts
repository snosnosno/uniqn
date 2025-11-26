/**
 * Hooks Barrel Export
 *
 * @description
 * 모든 커스텀 훅을 통합 export합니다.
 * 이 파일을 통해 깔끔한 import 경로를 제공합니다.
 *
 * @version 2.0.0
 * @since 2025-11-25
 * @author T-HOLDEM Development Team
 *
 * @example
 * ```typescript
 * // 개별 import
 * import { useAuth } from '@/hooks';
 *
 * // 여러 Hook import
 * import {
 *   useNotifications,
 *   useJobPostings,
 *   useScheduleData
 * } from '@/hooks';
 * ```
 */

// =============================================================================
// Firestore Hooks (하위 모듈 re-export)
// =============================================================================

export {
  useFirestoreCollection,
  useFirestoreDocument,
  useFirestoreQuery,
  useFirestoreMutation,
  convertDocument,
} from './firestore';

export type {
  FirestoreHookState,
  FirestoreCollectionResult,
  FirestoreDocumentResult,
  FirestoreQueryResult,
  FirestoreMutationResult,
  FirestoreDocument,
  CollectionHookOptions,
  DocumentHookOptions,
  QueryHookOptions,
  MutationHookOptions,
} from './firestore';

// =============================================================================
// Job Posting Hooks
// =============================================================================

/** 고정공고 관리 Hook */
export { useFixedJobPostings } from './useFixedJobPostings';
export type { UseFixedJobPostingsReturn } from './useFixedJobPostings';

/** 구인공고 목록 Hook */
export { useJobPostings, useInfiniteJobPostings, JobPostingUtils } from './useJobPostings';
export type {
  JobPostingFilters,
  JobPosting,
  ConfirmedStaff,
} from './useJobPostings';

/** 구인공고 폼 Hook */
export { useJobPostingForm } from './useJobPostingForm';

/** 구인공고 작업 Hook */
export { useJobPostingOperations } from './useJobPostingOperations';

/** 구인공고 승인 Hook */
export { useJobPostingApproval } from './useJobPostingApproval';

/** 구인공고 공지 Hook */
export { useJobPostingAnnouncement } from './useJobPostingAnnouncement';
export type { UseJobPostingAnnouncementReturn } from './useJobPostingAnnouncement';

// =============================================================================
// Schedule & WorkLog Hooks
// =============================================================================

/** 스케줄 데이터 Hook (메인) */
export { default as useScheduleData } from './useScheduleData';

/** 통합 WorkLog Hook */
export {
  useUnifiedWorkLogs,
  useJobPostingWorkLogs,
  useStaffWorkLogs,
  useDateRangeWorkLogs,
} from './useUnifiedWorkLogs';

/** 교대 스케줄 Hook */
export {
  useShiftSchedule,
  generateTimeSlots,
} from './useShiftSchedule';
export type { ShiftSchedule, ShiftDealer, WorkLog } from './useShiftSchedule';
export { default as useShiftScheduleDefault } from './useShiftSchedule';

// =============================================================================
// Staff Hooks
// =============================================================================

/** 스태프 관리 Hook */
export { useStaffManagement } from './useStaffManagement';

/** 스태프 QR Hook */
export { useStaffQR } from './useStaffQR';

/** 스태프 선택 Hook (루트 레벨) */
export { useStaffSelection } from './useStaffSelection';

/** 스태프 근무 데이터 Hook */
export { useStaffWorkData } from './useStaffWorkData';

// Staff 하위 모듈 Hooks
export { useStaffSelection as useStaffSelectionV2 } from './staff/useStaffSelection';
export type { UseStaffSelectionReturn } from './staff/useStaffSelection';

export { useStaffActions } from './staff/useStaffActions';
export type { UseStaffActionsParams, UseStaffActionsReturn } from './staff/useStaffActions';

export { useStaffData } from './staff/useStaffData';
export type { UseStaffDataParams, UseStaffDataReturn } from './staff/useStaffData';

export { useStaffModals } from './staff/useStaffModals';

// =============================================================================
// Table Hooks
// =============================================================================

/** 테이블 관리 Hook (메인) */
export { useTables } from './useTables';
export type { Table, BalancingResult, UseTablesReturn } from './useTables';
export { default as useTablesDefault } from './useTables';

/** 테이블 구독 Hook */
export { useTableSubscription } from './tables/useTableSubscription';

/** 테이블 배정 Hook */
export { useTableAssignment } from './tables/useTableAssignment';

/** 테이블 작업 Hook */
export { useTableOperations } from './tables/useTableOperations';

// =============================================================================
// Notification Hooks
// =============================================================================

/** 알림 Hook */
export { useNotifications } from './useNotifications';
export type { UseNotificationsReturn } from './useNotifications';

/** 알림 설정 Hook */
export { useNotificationSettings } from './useNotificationSettings';

// =============================================================================
// Tournament Hooks
// =============================================================================

/** 토너먼트 목록 Hook */
export { useTournamentList } from './useTournamentList';

/** 토너먼트 Hook */
export { useTournaments } from './useTournaments';

/** 참가자 Hook */
export { useParticipants } from './useParticipants';

/** 설정 Hook */
export { useSettings } from './useSettings';
export type { TournamentSettings } from './useSettings';
export { default as useSettingsDefault } from './useSettings';

// =============================================================================
// Data & State Hooks
// =============================================================================

/** 통합 데이터 Hook */
export {
  useUnifiedData,
  useScheduleData as useScheduleDataV2,
  useStaffData as useStaffDataV2,
  useJobPostingData,
  useApplicationData,
  useAttendanceData,
  useUnifiedDataPerformance,
  useSmartUnifiedData,
  usePageOptimizedData,
} from './useUnifiedData';

/** 데이터 집계 Hook */
export { useDataAggregator } from './useDataAggregator';

/** 날짜 필터 Hook */
export { useDateFilter } from './useDateFilter';
export type { DateFilterContextType } from './useDateFilter';

/** 날짜별 그룹화 Hook */
export { useGroupByDate } from './useGroupByDate';
export type { GroupByDateOptions, GroupedData, UseGroupByDateReturn } from './useGroupByDate';

/** 출석 맵 Hook */
export { useAttendanceMap } from './useAttendanceMap';

/** 출석 상태 Hook */
export { useAttendanceStatus } from './useAttendanceStatus';

// =============================================================================
// Payment & Subscription Hooks
// =============================================================================

/** 활성 구독 Hook */
export { useActiveSubscription } from './useActiveSubscription';

/** 칩 잔액 Hook */
export { useChipBalance } from './useChipBalance';

/** 결제 내역 Hook */
export { usePaymentHistory } from './usePaymentHistory';

/** 환불 요청 Hook */
export { useRefundRequest } from './useRefundRequest';

/** 구독 플랜 Hook */
export { useSubscriptionPlans } from './useSubscriptionPlans';

/** 토스 결제 Hook */
export { useTossPayment } from './useTossPayment';

/** 급여 계산 Worker Hook */
export { usePayrollWorker } from './usePayrollWorker';

// =============================================================================
// User & Account Hooks
// =============================================================================

/** 동의 Hook */
export { useConsent } from './useConsent';
export type { UseConsentReturn } from './useConsent';

/** 계정 삭제 Hook */
export { useAccountDeletion } from './useAccountDeletion';

/** 권한 Hook */
export {
  usePermissions,
  useResourcePermission,
  useJobPostingPermissions,
  useSchedulePermissions,
  useStaffPermissions,
} from './usePermissions';

// =============================================================================
// Security Hooks
// =============================================================================

/** 보안 Hook */
export {
  useSecurity,
  useFrameBuster,
  useSecureStorage,
} from './useSecurity';
export { default as useSecurityDefault } from './useSecurity';

/** 보안 설정 Hook */
export { useSecuritySettings } from './useSecuritySettings';
export type { UseSecuritySettingsReturn } from './useSecuritySettings';

// =============================================================================
// Utility & UI Hooks
// =============================================================================

/** 날짜 유틸 Hook */
export { useDateUtils } from './useDateUtils';

/** 캐시된 날짜 포맷 Hook */
export { useCachedFormatDate } from './useCachedFormatDate';

/** 디바운스 검색 Hook */
export { useDebounceSearch } from './useDebounceSearch';

/** 이벤트 서비스 Hook */
export { useEventService } from './useEventService';

/** 햅틱 피드백 Hook */
export { useHapticFeedback } from './useHapticFeedback';

/** 무한 스크롤 Hook */
export { useInfiniteScroll } from './useInfiniteScroll';

/** 미디어 쿼리 Hook */
export { useMediaQuery, useBreakpoint } from './useMediaQuery';
export { default as useMediaQueryDefault } from './useMediaQuery';

/** 반응형 Hook */
export {
  useResponsive,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsTouch,
  useBreakpoint as useBreakpointV2,
} from './useResponsive';
export type { ResponsiveState, ResponsiveBreakpoints } from './useResponsive';

/** 스와이프 제스처 Hook */
export { useSwipeGesture } from './useSwipeGesture';

/** 토스트 Hook */
export { useToast } from './useToast';

/** 가상화 Hook */
export { useVirtualization, getVirtualizationStats } from './useVirtualization';
export { default as useVirtualizationDefault } from './useVirtualization';

// =============================================================================
// System & Performance Hooks
// =============================================================================

/** 로거 Hook */
export { logAction, useStructuredLogger, useLogger } from './useLogger';

/** 시스템 공지 Hook */
export { useSystemAnnouncements } from './useSystemAnnouncements';
export type { UseSystemAnnouncementsReturn } from './useSystemAnnouncements';

/** 시스템 성능 Hook */
export { useSystemPerformance } from './useSystemPerformance';

/** 스마트 캐시 Hook */
export { useSmartCache } from './useSmartCache';

/** 개발 도구 Hook */
export { useDevTools } from './useDevTools';
export { default as useDevToolsDefault } from './useDevTools';

/** 템플릿 관리자 Hook */
export { useTemplateManager } from './useTemplateManager';
