/**
 * 공유 에러 처리 모듈
 *
 * @description Phase 11 - 훅 레이어 에러 처리 표준화
 *
 * @example
 * import { createMutationErrorHandler, requireAuth } from '@/shared/errors';
 */

export {
  createMutationErrorHandler,
  handleSilentError,
  requireAuth,
  getAuthUserId,
  extractErrorMessage,
  canRetry,
  needsReauth,
} from './hookErrorHandler';
