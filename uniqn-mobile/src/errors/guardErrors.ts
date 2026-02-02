/**
 * UNIQN Mobile - Guard Error Helpers
 *
 * @description 인증 및 검증 가드 함수
 * @version 1.0.0
 *
 * @example
 * // 뮤테이션에서 사용
 * import { requireAuth } from '@/errors/guardErrors';
 *
 * const { mutateAsync } = useMutation({
 *   mutationFn: async (data) => {
 *     requireAuth(user?.uid, 'useSettlement.calculate');
 *     return await settlementService.calculate(user.uid, data);
 *   },
 * });
 */

import { AuthError, ERROR_CODES } from './AppError';

/**
 * 인증 필수 가드 - userId가 없으면 AuthError throw
 *
 * TypeScript의 asserts 키워드를 사용하여 이 함수 호출 후
 * userId가 string 타입임을 보장합니다.
 *
 * @param userId - 검증할 사용자 ID
 * @param context - 에러 발생 위치 (디버깅용)
 * @throws {AuthError} userId가 없으면 AUTH_REQUIRED 에러
 *
 * @example
 * const { user } = useAuthStore();
 * requireAuth(user?.uid, 'useJobManagement.createJob');
 * // 이 라인 이후 user.uid는 string 타입으로 추론됨
 */
export function requireAuth(
  userId: string | undefined | null,
  context?: string
): asserts userId is string {
  if (!userId) {
    throw new AuthError(ERROR_CODES.AUTH_REQUIRED, {
      userMessage: '로그인이 필요합니다',
      metadata: context ? { location: context } : undefined,
    });
  }
}

/**
 * null/undefined 검증 가드
 *
 * @param value - 검증할 값
 * @param errorMessage - 에러 메시지
 * @param context - 에러 발생 위치 (디버깅용)
 * @throws {Error} value가 null/undefined이면 에러
 */
export function requireValue<T>(
  value: T | null | undefined,
  errorMessage: string,
  context?: string
): asserts value is T {
  if (value === null || value === undefined) {
    const error = new Error(errorMessage);
    if (context) {
      (error as Error & { context?: string }).context = context;
    }
    throw error;
  }
}
