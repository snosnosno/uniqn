/**
 * Application Service - 배럴 Export
 *
 * @description 지원서 서비스 진입점
 * 기존 applicationService.ts를 re-export하여 호환성 유지
 *
 * 향후 분리 계획:
 * - applicationQuery.ts: 조회 (getMyApplications, getApplicationById, hasAppliedToJob)
 * - applicationApply.ts: 지원 (applyToJobV2)
 * - applicationCancellation.ts: 취소 (cancelApplication, requestCancellation, reviewCancellationRequest)
 */

// 기존 applicationService에서 모든 export 가져오기
export * from '../applicationService';
