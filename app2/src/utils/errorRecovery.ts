import { logger } from './logger';

// 에러 복구 전략 타입 정의
export type RecoveryStrategy = 'retry' | 'fallback' | 'reset' | 'ignore';

// 에러 복구 옵션 인터페이스
export interface RecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  fallbackValue?: any;
  strategy?: RecoveryStrategy;
  context?: string;
}

// 에러 복구 결과 인터페이스
export interface RecoveryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  strategy: RecoveryStrategy;
}

// 기본 복구 옵션
const DEFAULT_OPTIONS: Required<RecoveryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  fallbackValue: null,
  strategy: 'retry',
  context: 'unknown'
};

// 지연 함수
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// 재시도 전략
async function retryStrategy<T>(
  operation: () => Promise<T>,
  options: Required<RecoveryOptions>
): Promise<RecoveryResult<T>> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      const result = await operation();
      return {
        success: true,
        data: result,
        attempts: attempt,
        strategy: 'retry'
      };
    } catch (error) {
      lastError = error as Error;
      
      logger.warn(`Retry attempt ${attempt} failed`, {
        component: 'errorRecovery',
        operation: options.context,
        attempt,
        maxRetries: options.maxRetries,
        error: lastError.message
      });
      
      if (attempt < options.maxRetries) {
        await delay(options.retryDelay * attempt); // 지수 백오프
      }
    }
  }
  
  return {
    success: false,
    error: lastError!,
    attempts: options.maxRetries,
    strategy: 'retry'
  };
}

// 폴백 전략
async function fallbackStrategy<T>(
  operation: () => Promise<T>,
  options: Required<RecoveryOptions>
): Promise<RecoveryResult<T>> {
  try {
    const result = await operation();
    return {
      success: true,
      data: result,
      attempts: 1,
      strategy: 'fallback'
    };
  } catch (error) {
    logger.warn(`Operation failed, using fallback value`, {
      component: 'errorRecovery',
      operation: options.context,
      error: (error as Error).message
    });
    
    return {
      success: true,
      data: options.fallbackValue,
      attempts: 1,
      strategy: 'fallback'
    };
  }
}

// 무시 전략
async function ignoreStrategy<T>(
  operation: () => Promise<T>,
  options: Required<RecoveryOptions>
): Promise<RecoveryResult<T>> {
  try {
    const result = await operation();
    return {
      success: true,
      data: result,
      attempts: 1,
      strategy: 'ignore'
    };
  } catch (error) {
    logger.warn(`Operation failed, ignoring error`, {
      component: 'errorRecovery',
      operation: options.context,
      error: (error as Error).message
    });
    
    return {
      success: false,
      error: error as Error,
      attempts: 1,
      strategy: 'ignore'
    };
  }
}

// 메인 에러 복구 함수
export async function withErrorRecovery<T>(
  operation: () => Promise<T>,
  options: RecoveryOptions = {}
): Promise<RecoveryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  logger.info(`Starting operation with error recovery`, {
    component: 'errorRecovery',
    operation: opts.context,
    strategy: opts.strategy,
    maxRetries: opts.maxRetries
  });
  
  switch (opts.strategy) {
    case 'retry':
      return retryStrategy(operation, opts);
    case 'fallback':
      return fallbackStrategy(operation, opts);
    case 'ignore':
      return ignoreStrategy(operation, opts);
    default:
      return retryStrategy(operation, opts);
  }
}

// Firebase 특화 에러 복구
export async function withFirebaseRecovery<T>(
  operation: () => Promise<T>,
  options: RecoveryOptions = {}
): Promise<RecoveryResult<T>> {
  const firebaseOptions: RecoveryOptions = {
    ...options,
    strategy: 'retry',
    maxRetries: options.maxRetries || 2,
    retryDelay: options.retryDelay || 2000,
    context: options.context || 'firebase_operation'
  };
  
  return withErrorRecovery(operation, firebaseOptions);
}

// 네트워크 에러 복구
export async function withNetworkRecovery<T>(
  operation: () => Promise<T>,
  options: RecoveryOptions = {}
): Promise<RecoveryResult<T>> {
  const networkOptions: RecoveryOptions = {
    ...options,
    strategy: 'retry',
    maxRetries: options.maxRetries || 3,
    retryDelay: options.retryDelay || 1000,
    context: options.context || 'network_operation'
  };
  
  return withErrorRecovery(operation, networkOptions);
}

// 사용자 친화적인 에러 메시지 생성
export function getUserFriendlyErrorMessage(error: Error, context?: string): string {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch')) {
    return '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
  }
  
  if (message.includes('permission') || message.includes('auth')) {
    return '권한이 없습니다. 로그인 상태를 확인해주세요.';
  }
  
  if (message.includes('quota') || message.includes('limit')) {
    return '서비스 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
  }
  
  if (message.includes('firebase') || message.includes('fir store')) {
    return '데이터베이스 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
  }
  
  return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

// 에러 심각도 평가
export function evaluateErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('timeout')) {
    return 'medium';
  }
  
  if (message.includes('permission') || message.includes('auth')) {
    return 'high';
  }
  
  if (message.includes('quota') || message.includes('limit')) {
    return 'high';
  }
  
  if (message.includes('firebase') && message.includes('internal assertion failed')) {
    return 'critical';
  }
  
  return 'low';
}

// 에러 복구 가능성 평가
export function canRecoverFromError(error: Error): boolean {
  const severity = evaluateErrorSeverity(error);
  return severity !== 'critical';
} 