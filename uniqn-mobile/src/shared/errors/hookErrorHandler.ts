/**
 * UNIQN Mobile - 훅용 에러 핸들러
 *
 * @description React Query 뮤테이션 등 훅에서 사용하는 표준 에러 처리 유틸리티
 * @version 1.0.0 - Phase 11
 *
 * @example
 * // 기본 사용
 * const handleError = createMutationErrorHandler('지원 처리', addToast);
 * useMutation({ onError: handleError });
 *
 * @example
 * // 인증 체크
 * requireAuth(user);
 */

import { normalizeError, AppError, AuthError, ERROR_CODES } from '@/errors';
import { logger } from '@/utils/logger';
import type { User } from 'firebase/auth';

// ============================================================================
// Types
// ============================================================================

interface ToastInput {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

type AddToastFn = (toast: ToastInput) => void;

interface ErrorHandlerOptions {
  /** 에러 발생 시 토스트 표시 여부 (기본: true) */
  showToast?: boolean;
  /** 추가 컨텍스트 데이터 */
  context?: Record<string, unknown>;
  /** 특정 에러 코드에 대한 커스텀 메시지 */
  customMessages?: Record<string, string>;
}

// ============================================================================
// Main Handlers
// ============================================================================

/**
 * 뮤테이션용 표준 에러 핸들러 생성
 *
 * @description normalizeError로 에러를 AppError로 변환 후 로깅 및 토스트 표시
 *
 * @param context - 에러 발생 위치/작업 설명 (예: '지원 처리', '확정 처리')
 * @param addToast - 토스트 추가 함수
 * @param options - 추가 옵션
 * @returns 에러 핸들러 함수
 *
 * @example
 * const handleError = createMutationErrorHandler('지원 확정', addToast);
 *
 * useMutation({
 *   mutationFn: confirmApplication,
 *   onError: handleError,
 * });
 */
export function createMutationErrorHandler(
  context: string,
  addToast: AddToastFn,
  options: ErrorHandlerOptions = {}
): (error: unknown) => void {
  const { showToast = true, context: extraContext, customMessages } = options;

  return (error: unknown) => {
    const appError = normalizeError(error);

    // 로깅
    logger.error(`${context} 실패`, appError, {
      code: appError.code,
      category: appError.category,
      ...extraContext,
    });

    // 토스트 표시
    if (showToast) {
      // 커스텀 메시지 확인
      const customMessage = customMessages?.[appError.code];
      const message = customMessage ?? appError.userMessage;

      addToast({
        type: 'error',
        message,
      });
    }
  };
}

/**
 * 사일런트 에러 핸들러 (토스트 없이 로깅만)
 *
 * @param context - 에러 발생 위치
 * @param extraContext - 추가 컨텍스트
 * @returns AppError
 */
export function handleHookSilentError(
  error: unknown,
  context: string,
  extraContext?: Record<string, unknown>
): AppError {
  const appError = normalizeError(error);

  logger.error(`${context} 실패 (silent)`, appError, {
    code: appError.code,
    category: appError.category,
    ...extraContext,
  });

  return appError;
}

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * 인증 상태 필수 체크 (Type Guard)
 *
 * @description 인증되지 않은 경우 AuthError 발생
 *
 * @param user - Firebase User 또는 null
 * @throws AuthError - 인증되지 않은 경우
 *
 * @example
 * function useMyMutation() {
 *   const { user } = useAuthStore();
 *
 *   return useMutation({
 *     mutationFn: async (input) => {
 *       requireAuth(user);
 *       return await myService.doSomething(input, user.uid);
 *     },
 *   });
 * }
 */
export function requireAuth(user: User | null | undefined): asserts user is User {
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '로그인이 필요합니다.',
    });
  }
}

/**
 * 인증 상태 체크 (옵셔널)
 *
 * @param user - Firebase User 또는 null
 * @returns User ID 또는 null
 */
export function getAuthUserId(user: User | null | undefined): string | null {
  return user?.uid ?? null;
}

// ============================================================================
// Error Utilities for Hooks
// ============================================================================

/**
 * 에러에서 사용자 친화적 메시지 추출
 *
 * @param error - 에러 객체
 * @param fallbackMessage - 폴백 메시지
 * @returns 사용자 친화적 메시지
 */
export function extractErrorMessage(
  error: unknown,
  fallbackMessage: string = '처리 중 오류가 발생했습니다.'
): string {
  const appError = normalizeError(error);
  return appError.userMessage || fallbackMessage;
}

/**
 * 에러가 재시도 가능한지 확인
 *
 * @param error - 에러 객체
 * @returns 재시도 가능 여부
 */
export function canRetry(error: unknown): boolean {
  const appError = normalizeError(error);
  return appError.isRetryable && appError.category !== 'business';
}

/**
 * 에러가 재인증을 필요로 하는지 확인
 *
 * @param error - 에러 객체
 * @returns 재인증 필요 여부
 */
export function needsReauth(error: unknown): boolean {
  const appError = normalizeError(error);
  return (
    appError.code === ERROR_CODES.AUTH_TOKEN_EXPIRED ||
    appError.code === ERROR_CODES.AUTH_SESSION_EXPIRED
  );
}

// ============================================================================
// Query Error Handler (v1.1.0)
// ============================================================================

interface QueryErrorHandlerOptions extends ErrorHandlerOptions {
  /** 백그라운드 에러 무시 여부 (기본: false) */
  ignoreBackground?: boolean;
  /** 재시도 가능 시 토스트 억제 (기본: false) */
  suppressRetryableToast?: boolean;
}

/**
 * 쿼리용 표준 에러 핸들러 생성
 *
 * @description useQuery의 onError 또는 전역 에러 처리에 사용
 *
 * @param context - 에러 발생 위치/작업 설명
 * @param addToast - 토스트 추가 함수
 * @param options - 추가 옵션
 * @returns 에러 핸들러 함수
 *
 * @example
 * const handleError = createQueryErrorHandler('공고 목록 조회', addToast, {
 *   suppressRetryableToast: true,
 * });
 *
 * useQuery({
 *   queryKey: ['jobPostings'],
 *   queryFn: fetchJobPostings,
 *   onError: handleError,
 * });
 */
export function createQueryErrorHandler(
  context: string,
  addToast: AddToastFn,
  options: QueryErrorHandlerOptions = {}
): (error: unknown) => void {
  const {
    showToast = true,
    context: extraContext,
    customMessages,
    suppressRetryableToast = false,
  } = options;

  return (error: unknown) => {
    const appError = normalizeError(error);

    // 로깅
    logger.warn(`${context} 쿼리 실패`, {
      code: appError.code,
      category: appError.category,
      isRetryable: appError.isRetryable,
      ...extraContext,
    });

    // 재시도 가능한 에러인 경우 토스트 억제 옵션
    if (suppressRetryableToast && appError.isRetryable) {
      return;
    }

    // 토스트 표시
    if (showToast) {
      const customMessage = customMessages?.[appError.code];
      const message = customMessage ?? appError.userMessage;

      addToast({
        type: 'error',
        message,
      });
    }
  };
}

// ============================================================================
// Error Handler Presets (v1.1.0)
// ============================================================================

/**
 * 사전 정의된 에러 핸들러 팩토리
 *
 * @description 자주 사용되는 작업에 대한 표준 에러 핸들러 제공
 *
 * @example
 * const { addToast } = useToastStore();
 *
 * // 확정 처리용 에러 핸들러
 * useMutation({
 *   mutationFn: confirmApplication,
 *   onError: errorHandlerPresets.confirm(addToast),
 * });
 *
 * // 거절 처리용 에러 핸들러
 * useMutation({
 *   mutationFn: rejectApplication,
 *   onError: errorHandlerPresets.reject(addToast),
 * });
 */
export const errorHandlerPresets = {
  /** 확정 처리 에러 핸들러 */
  confirm: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('확정 처리', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '이미 확정된 지원입니다.',
        [ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED]: '모집 인원이 마감되었습니다.',
      },
    }),

  /** 거절 처리 에러 핸들러 */
  reject: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('거절 처리', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.BUSINESS_INVALID_STATE]: '이미 처리된 지원입니다.',
      },
    }),

  /** 지원 처리 에러 핸들러 */
  apply: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('지원', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '이미 지원한 공고입니다.',
        [ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED]: '모집이 마감되었습니다.',
        [ERROR_CODES.BUSINESS_APPLICATION_CLOSED]: '마감된 공고입니다.',
      },
    }),

  /** 지원 취소 에러 핸들러 */
  cancel: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('지원 취소', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.BUSINESS_INVALID_STATE]: '취소할 수 없는 상태입니다.',
      },
    }),

  /** 정산 처리 에러 핸들러 */
  settlement: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('정산 처리', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.BUSINESS_ALREADY_SETTLED]: '이미 정산이 완료되었습니다.',
        [ERROR_CODES.BUSINESS_INVALID_WORKLOG]: '유효하지 않은 근무 기록입니다.',
      },
    }),

  /** 출퇴근 처리 에러 핸들러 */
  attendance: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('출퇴근 처리', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.BUSINESS_ALREADY_CHECKED_IN]: '이미 출근 처리되었습니다.',
        [ERROR_CODES.BUSINESS_NOT_CHECKED_IN]: '출근 기록이 없습니다.',
        [ERROR_CODES.BUSINESS_INVALID_QR]: '유효하지 않은 QR 코드입니다.',
        [ERROR_CODES.BUSINESS_EXPIRED_QR]: 'QR 코드가 만료되었습니다.',
      },
    }),

  /** 프로필 업데이트 에러 핸들러 */
  profile: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('프로필 저장', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.VALIDATION_FORMAT]: '입력 형식이 올바르지 않습니다.',
      },
    }),

  /** 공고 CRUD 에러 핸들러 */
  jobPosting: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('공고 처리', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.FIREBASE_PERMISSION_DENIED]: '공고 수정 권한이 없습니다.',
        [ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND]: '공고를 찾을 수 없습니다.',
      },
    }),

  /** 신고 처리 에러 핸들러 */
  report: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('신고 처리', addToast, {
      context: extraContext,
      customMessages: {
        [ERROR_CODES.BUSINESS_DUPLICATE_REPORT]: '이미 신고한 항목입니다.',
        [ERROR_CODES.BUSINESS_CANNOT_REPORT_SELF]: '자신을 신고할 수 없습니다.',
      },
    }),

  /** 알림 처리 에러 핸들러 */
  notification: (addToast: AddToastFn, extraContext?: Record<string, unknown>) =>
    createMutationErrorHandler('알림 처리', addToast, {
      context: extraContext,
      showToast: false, // 알림 처리 실패는 조용히 로깅만
    }),
} as const;

// ============================================================================
// Loading State Normalizer (v1.1.0)
// ============================================================================

/**
 * React Query 결과의 로딩 상태 타입
 */
export interface NormalizedLoadingState {
  /** 초기 로딩 중 (데이터 없음) */
  isInitialLoading: boolean;
  /** 백그라운드 리프레시 중 (데이터 있음) */
  isRefetching: boolean;
  /** 에러 발생 (데이터 없을 수 있음) */
  isError: boolean;
  /** 데이터 존재 여부 */
  hasData: boolean;
  /** 빈 데이터 (배열/객체가 비어있음) */
  isEmpty: boolean;
  /** UI에서 로딩 표시해야 하는지 */
  showLoading: boolean;
  /** UI에서 스켈레톤 표시해야 하는지 */
  showSkeleton: boolean;
  /** UI에서 빈 상태 표시해야 하는지 */
  showEmpty: boolean;
  /** UI에서 에러 표시해야 하는지 */
  showError: boolean;
  /** UI에서 데이터 표시해야 하는지 */
  showData: boolean;
}

interface QueryResultLike<T = unknown> {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isPending?: boolean;
  isRefetching?: boolean;
  status?: 'pending' | 'loading' | 'error' | 'success';
}

/**
 * React Query 결과에서 정규화된 로딩 상태 추출
 *
 * @description 다양한 로딩 상태를 일관된 형식으로 정규화
 *
 * @param queryResult - useQuery 결과 객체
 * @param options - 옵션
 * @returns 정규화된 로딩 상태
 *
 * @example
 * const { data, isLoading, isFetching, isError } = useQuery({...});
 * const loadingState = normalizeLoadingState({ data, isLoading, isFetching, isError });
 *
 * if (loadingState.showSkeleton) return <Skeleton />;
 * if (loadingState.showError) return <ErrorState />;
 * if (loadingState.showEmpty) return <EmptyState />;
 * return <DataView data={data} />;
 */
export function normalizeLoadingState<T>(
  queryResult: QueryResultLike<T>,
  options: {
    /** 빈 데이터 판별 함수 (기본: 배열이면 length === 0) */
    isEmptyFn?: (data: T) => boolean;
    /** 백그라운드 리프레시 중에도 스켈레톤 표시 */
    showSkeletonOnRefetch?: boolean;
  } = {}
): NormalizedLoadingState {
  const { isEmptyFn, showSkeletonOnRefetch = false } = options;

  const { data, isLoading, isFetching, isError } = queryResult;
  const isRefetching = queryResult.isRefetching ?? (isFetching && !isLoading);

  // 데이터 존재 여부
  const hasData = data !== undefined && data !== null;

  // 빈 데이터 판별
  const isEmpty = hasData
    ? isEmptyFn
      ? isEmptyFn(data)
      : Array.isArray(data)
        ? data.length === 0
        : typeof data === 'object'
          ? Object.keys(data as object).length === 0
          : false
    : true;

  // 초기 로딩 (데이터 없이 로딩 중)
  const isInitialLoading = isLoading && !hasData;

  // UI 표시 결정
  const showSkeleton = isInitialLoading || (showSkeletonOnRefetch && isRefetching);
  const showLoading = isFetching;
  const showError = isError && !hasData;
  const showEmpty = !isError && hasData && isEmpty;
  const showData = hasData && !isEmpty;

  return {
    isInitialLoading,
    isRefetching,
    isError,
    hasData,
    isEmpty,
    showLoading,
    showSkeleton,
    showEmpty,
    showError,
    showData,
  };
}

/**
 * 여러 쿼리의 로딩 상태 병합
 *
 * @description 여러 쿼리를 동시에 사용할 때 통합된 로딩 상태 제공
 *
 * @param queries - 쿼리 결과 배열
 * @returns 병합된 로딩 상태
 *
 * @example
 * const jobQuery = useQuery({...});
 * const applicantsQuery = useQuery({...});
 *
 * const combinedState = combineLoadingStates([
 *   { data: jobQuery.data, isLoading: jobQuery.isLoading, ... },
 *   { data: applicantsQuery.data, isLoading: applicantsQuery.isLoading, ... },
 * ]);
 *
 * if (combinedState.showSkeleton) return <CombinedSkeleton />;
 */
export function combineLoadingStates(
  queries: QueryResultLike[]
): Omit<NormalizedLoadingState, 'isEmpty' | 'hasData'> {
  const anyLoading = queries.some((q) => q.isLoading);
  const anyFetching = queries.some((q) => q.isFetching);
  const anyError = queries.some((q) => q.isError);
  const allHaveData = queries.every((q) => q.data !== undefined && q.data !== null);
  const anyRefetching = queries.some((q) => q.isRefetching ?? (q.isFetching && !q.isLoading));

  const isInitialLoading = anyLoading && !allHaveData;
  const showSkeleton = isInitialLoading;
  const showError = anyError && !allHaveData;
  const showData = allHaveData && !anyError;

  return {
    isInitialLoading,
    isRefetching: anyRefetching,
    isError: anyError,
    showLoading: anyFetching,
    showSkeleton,
    showEmpty: false, // 개별 판단 필요
    showError,
    showData,
  };
}
