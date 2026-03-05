/**
 * UNIQN Mobile - 서비스 레이어 배럴 Export
 *
 * @version 1.0.0
 */

// Auth Domain (auth, storage, accountDeletion, biometric)
export * from './auth';

// Jobs Domain (job, application, applicantManagement, applicantConversion, jobManagement, template, search)
export * from './jobs';

// Work Domain (schedule, workLog, confirmedStaff, eventQR, settlement)
export * from './work';

// Notifications Domain (notification, push, sync, inApp)
export * from './notifications';

// ============================================================================
// Observability (분석/모니터링/세션)
// ============================================================================
export * from './observability';

// Deep Link Shared Module (v2.0)
export {
  RouteMapper,
  EXPO_ROUTES,
  NOTIFICATION_ROUTE_MAP,
  getRouteForNotificationType,
  isAdminOnlyNotification,
  isEmployerOnlyNotification,
  type NavigationContext,
} from '@/shared/deeplink';

// ============================================================================
// 관리자 서비스 (Admin Services)
// ============================================================================

// Admin Service (관리자 대시보드 및 사용자 관리)
export {
  adminService,
  getDashboardStats,
  getUsers,
  getUserById,
  updateUserRole,
  setUserActive,
  getSystemMetrics,
} from './adminService';

// Report Service (스태프 신고 관리)
export {
  reportService,
  createReport,
  getReportsByJobPosting,
  getReportsByStaff,
  getMyReports,
  getReportById,
  reviewReport,
  getReportCountByStaff,
} from './reportService';

// ============================================================================
// 도메인 레이어 Re-export (Phase 7)
// ============================================================================

/**
 * @description 도메인 레이어의 주요 클래스 및 유틸리티를 services에서도 사용 가능하게 re-export
 * 하위 호환성 유지를 위해 제공
 */

// Schedule Domain (Phase 5)
export { ScheduleMerger } from '../domains/schedule';
export type {
  MergeOptions,
  DateGroup,
  ApplicationGroup,
  GroupByApplicationResult,
  GroupByApplicationOptions,
  MergerScheduleStats,
} from '../domains/schedule';

// Settlement Domain (Phase 6)
export { SettlementCalculator, TaxCalculator, SettlementCache } from '../domains/settlement';
export type {
  CalculationInput,
  SettlementResult as CalculatorSettlementResult,
  SettlementBreakdown,
  TaxBreakdown,
  TaxableAmounts,
  CachedSettlement,
} from '../domains/settlement';
