/**
 * Settlement Service - 배럴 Export
 *
 * @description 정산 서비스 진입점
 * 기존 settlementService.ts를 re-export하여 호환성 유지
 *
 * 향후 분리 계획:
 * - settlementQuery.ts: 조회 (getWorkLogsByJobPosting, getJobPostingSettlementSummary)
 * - settlementCalculation.ts: 계산 (calculateSettlement)
 * - settlementMutation.ts: 변경 (updateWorkTime, settleWorkLog, bulkSettlement)
 */

// 기존 settlementService에서 모든 export 가져오기
export * from '../settlementService';
