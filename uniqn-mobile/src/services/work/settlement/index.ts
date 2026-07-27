/**
 * UNIQN Mobile - 정산 서비스 배럴
 *
 * @description 정산 관련 서비스 통합 export
 * @version 1.0.0
 *
 * 기존 import 경로 호환성 유지:
 * - import { getWorkLogsByJobPosting } from '@/services/work/settlement'
 * - import { getWorkLogsByJobPosting } from '@/services/work'
 * - import { getWorkLogsByJobPosting } from '@/services'
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Internal types
  WorkLogWithOverrides,
  // Query types
  SettlementWorkLog,
  SettlementFilters,
  JobPostingSettlementSummary,
  // Calculation types
  CalculateSettlementInput,
  SettlementCalculation,
  // Mutation types
  UpdateWorkTimeInput,
  SettleWorkLogInput,
  BulkSettlementInput,
  SettlementResult,
  BulkSettlementResult,
} from './types';

// ============================================================================
// Query Functions
// ============================================================================

export { getWorkLogsByJobPosting, getJobPostingSettlementSummary } from './settlementQuery';

// 운영처(venue) 정산 — 근무표 Phase 4 (venue 스팬 + 날짜범위 SQL 집계)
export { getVenueSettlementWorkLogs } from './settlementVenueQuery';

// ============================================================================
// Calculation Functions
// ============================================================================

export { calculateSettlement } from './settlementCalculation';

// ============================================================================
// Mutation Functions
// ============================================================================

export {
  updateWorkTimeForSettlement,
  settleWorkLog,
  bulkSettlement,
  updateSettlementStatus,
  updateWorkLogCustomSettlement,
} from './settlementMutation';

// ============================================================================
// Legacy Alias (하위 호환성)
// ============================================================================

// updateWorkTime은 updateWorkTimeForSettlement로 rename됨
// 기존 코드 호환을 위해 alias 제공
export { updateWorkTimeForSettlement as updateWorkTime } from './settlementMutation';
