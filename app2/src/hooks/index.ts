/**
 * Hooks Barrel Export
 *
 * @description
 * 모든 커스텀 훅을 통합 export합니다.
 * 이 파일을 통해 깔끔한 import 경로를 제공합니다.
 *
 * @version 3.0.0 - 토너먼트 전용 리팩토링
 * @since 2025-01-19
 * @author T-HOLDEM Development Team
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
// Table Hooks
// =============================================================================

/** 테이블 관리 Hook (메인) */
export { useTables } from './useTables';
export type { Table, BalancingResult, UseTablesReturn } from './useTables';

/** 테이블 구독 Hook */
export { useTableSubscription } from './tables/useTableSubscription';

/** 테이블 배정 Hook */
export { useTableAssignment } from './tables/useTableAssignment';

/** 테이블 작업 Hook */
export { useTableOperations } from './tables/useTableOperations';

// =============================================================================
// Tournament Hooks
// =============================================================================

/** 토너먼트 Hook */
export { useTournaments } from './useTournaments';

/** 참가자 Hook */
export { useParticipants } from './useParticipants';

/** 설정 Hook */
export { useSettings } from './useSettings';
export type { TournamentSettings } from './useSettings';

// =============================================================================
// Notification Hooks
// =============================================================================

/** 알림 Hook */
export { useNotifications } from './useNotifications';
export type { UseNotificationsReturn } from './useNotifications';

/** 알림 설정 Hook */
export { useNotificationSettings } from './useNotificationSettings';

// =============================================================================
// Data & State Hooks
// =============================================================================

/** 통합 데이터 Hook */
export {
  useUnifiedData,
  useJobPostingData,
  useApplicationData,
  useAttendanceData,
  useUnifiedDataPerformance,
  useSmartUnifiedData,
  usePageOptimizedData,
} from './useUnifiedData';

/** 날짜 필터 Hook */
export { useDateFilter } from './useDateFilter';
export type { DateFilterContextType } from './useDateFilter';

/** 날짜별 그룹화 Hook */
export { useGroupByDate } from './useGroupByDate';
export type { GroupByDateOptions, GroupedData, UseGroupByDateReturn } from './useGroupByDate';

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
export { useSecurity, useFrameBuster, useSecureStorage } from './useSecurity';

/** 보안 설정 Hook */
export { useSecuritySettings } from './useSecuritySettings';
export type { UseSecuritySettingsReturn } from './useSecuritySettings';

// =============================================================================
// Utility & UI Hooks
// =============================================================================

/** 캐시된 날짜 포맷 Hook */
export { useCachedFormatDate } from './useCachedFormatDate';

/** 햅틱 피드백 Hook */
export { useHapticFeedback } from './useHapticFeedback';

/** 무한 스크롤 Hook */
export { useInfiniteScroll } from './useInfiniteScroll';

/** 미디어 쿼리 Hook */
export { useMediaQuery, useBreakpoint } from './useMediaQuery';

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

// =============================================================================
// System & Performance Hooks
// =============================================================================

/** 로거 Hook */
export { logAction, useStructuredLogger, useLogger } from './useLogger';

/** 시스템 공지 Hook */
export { useSystemAnnouncements } from './useSystemAnnouncements';
export type { UseSystemAnnouncementsReturn } from './useSystemAnnouncements';
