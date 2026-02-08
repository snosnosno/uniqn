/**
 * 공유 에러 처리 모듈
 *
 * @description Phase 11 - 훅 레이어 에러 처리 표준화
 * @version 1.1.0 - errorHandlerPresets, loadingState 추가
 *
 * @example
 * import { createMutationErrorHandler, requireAuth } from '@/shared/errors';
 *
 * @example
 * // 사전 정의된 에러 핸들러 사용
 * import { errorHandlerPresets } from '@/shared/errors';
 * useMutation({ onError: errorHandlerPresets.confirm(addToast) });
 *
 * @example
 * // 로딩 상태 정규화
 * import { normalizeLoadingState } from '@/shared/errors';
 * const state = normalizeLoadingState(queryResult);
 * if (state.showSkeleton) return <Skeleton />;
 */

export {
  // Core handlers
  createMutationErrorHandler,
  createQueryErrorHandler,
  handleHookSilentError,
  // Auth helpers
  requireAuth,
  getAuthUserId,
  // Error utilities
  extractErrorMessage,
  canRetry,
  needsReauth,
  // Presets (v1.1.0)
  errorHandlerPresets,
  // Loading state (v1.1.0)
  normalizeLoadingState,
  combineLoadingStates,
  // Types
  type NormalizedLoadingState,
} from './hookErrorHandler';
