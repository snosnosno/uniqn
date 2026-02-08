/**
 * UNIQN Mobile - 로깅 유틸리티
 *
 * @description 구조화된 로깅 시스템 (AppError 통합 + Crashlytics 연동)
 * @version 1.2.0
 */

import { isAppError, type AppError } from '@/errors/AppError';
import { env } from '@/config/env';

// Note: crashlyticsService는 동적 import로 순환 의존성 방지

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ============================================================================
// Sensitive Data Masking (프로덕션 로그 보호)
// ============================================================================

/** 민감 정보 필드 목록 (대소문자 무시) */
const SENSITIVE_FIELDS = [
  'userid',
  'staffid',
  'uid',
  'email',
  'phone',
  'password',
  'token',
  'apikey',
  'secret',
  'credential',
  'applicantid',
  'ownerid',
];

/**
 * 민감 정보 마스킹 (로깅용)
 *
 * @description 프로덕션 환경에서 민감 데이터가 로그에 노출되지 않도록 보호
 */
function maskSensitiveContext(data: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field));

    if (isSensitive) {
      if (typeof value === 'string' && value.length > 6) {
        masked[key] = `${value.slice(0, 3)}***${value.slice(-3)}`;
      } else if (typeof value === 'string' && value.length > 0) {
        masked[key] = '***';
      } else {
        masked[key] = '[MASKED]';
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      masked[key] = maskSensitiveContext(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

/**
 * 프로덕션 환경 여부 (env 모듈 사용)
 */
const isProduction = env.isProduction;

/**
 * 로그 레벨 우선순위
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 현재 최소 로그 레벨 (프로덕션에서는 info 이상만)
 */
const MIN_LOG_LEVEL: LogLevel = isProduction ? 'info' : 'debug';

/**
 * 로그 레벨 체크
 */
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
};

/**
 * 로그 포맷팅
 */
const formatLog = (entry: LogEntry): string => {
  const { timestamp, level, message, context } = entry;
  const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
};

/**
 * 로그 출력
 *
 * @description 프로덕션 환경에서는 context 내 민감 데이터를 자동 마스킹
 */
const output = (level: LogLevel, entry: LogEntry, skipCrashlytics = false): void => {
  if (!shouldLog(level)) return;

  // 프로덕션 환경에서 context 마스킹 (민감 데이터 보호)
  const safeEntry: LogEntry =
    isProduction && entry.context
      ? { ...entry, context: maskSensitiveContext(entry.context) }
      : entry;

  const formatted = formatLog(safeEntry);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      if (safeEntry.error) {
        console.error(safeEntry.error);
      }
      break;
  }

  // 프로덕션에서 error 레벨은 Crashlytics로 전송 (동적 import로 순환 의존성 방지)
  // skipCrashlytics: appError()처럼 severity 기반으로 직접 전송을 제어하는 경우 true
  if (!skipCrashlytics && isProduction && level === 'error' && entry.error) {
    import('@/services/crashlyticsService')
      .then(({ crashlyticsService }) => {
        crashlyticsService
          .recordError(entry.error!, {
            logMessage: entry.message,
            ...entry.context,
          })
          .catch(() => {
            // Crashlytics 전송 실패 시 무시 (무한 루프 방지)
          });
      })
      .catch(() => {
        // 동적 import 실패 시 무시
      });
  }
};

/**
 * LogContext를 CrashContext-호환 형식으로 변환
 * unknown 타입을 string | number | boolean | undefined로 필터링
 */
const toCrashContext = (
  context: LogContext
): Record<string, string | number | boolean | undefined> => {
  const result: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) {
      result[key] = undefined;
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
    } else {
      // 복잡한 타입은 JSON 문자열로 변환
      try {
        result[key] = JSON.stringify(value);
      } catch {
        result[key] = String(value);
      }
    }
  }
  return result;
};

/**
 * 로그 엔트리 생성
 */
const createEntry = (
  level: LogLevel,
  message: string,
  contextOrError?: LogContext | Error,
  error?: Error
): LogEntry => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (contextOrError instanceof Error) {
    entry.error = contextOrError;
  } else if (contextOrError) {
    entry.context = contextOrError;
    if (error) {
      entry.error = error;
    }
  }

  return entry;
};

/**
 * Logger 인스턴스
 */
export const logger = {
  /**
   * 디버그 로그 (개발 환경에서만)
   */
  debug: (message: string, context?: LogContext): void => {
    output('debug', createEntry('debug', message, context));
  },

  /**
   * 정보 로그
   */
  info: (message: string, context?: LogContext): void => {
    output('info', createEntry('info', message, context));
  },

  /**
   * 경고 로그
   */
  warn: (message: string, context?: LogContext): void => {
    output('warn', createEntry('warn', message, context));
  },

  /**
   * 에러 로그
   */
  error: (message: string, error?: Error | LogContext, context?: LogContext): void => {
    if (error instanceof Error) {
      output('error', createEntry('error', message, context, error));
    } else {
      output('error', createEntry('error', message, error));
    }
  },

  /**
   * 성능 추적 래퍼
   */
  withPerformanceTracking: async <T>(
    fn: () => Promise<T>,
    operationName: string,
    context?: LogContext
  ): Promise<T> => {
    const startTime = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - startTime;

      logger.info(`${operationName} completed`, {
        ...context,
        duration: `${duration.toFixed(2)}ms`,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      logger.error(`${operationName} failed`, error instanceof Error ? error : undefined, {
        ...context,
        duration: `${duration.toFixed(2)}ms`,
      });

      throw error;
    }
  },

  /**
   * 그룹 로그 시작 (개발용)
   */
  group: (label: string): void => {
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.group(label);
    }
  },

  /**
   * 그룹 로그 종료
   */
  groupEnd: (): void => {
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
  },

  /**
   * 테이블 로그 (개발용)
   */
  table: (data: Record<string, unknown>[] | object): void => {
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.table(data);
    }
  },

  /**
   * AppError 전용 로깅
   * 에러의 모든 메타데이터를 포함하여 로깅
   */
  appError: (error: AppError | Error | unknown, context?: LogContext): void => {
    if (isAppError(error)) {
      const entry = createEntry(
        'error',
        error.message,
        {
          ...context,
          code: error.code,
          category: error.category,
          severity: error.severity,
          isRetryable: error.isRetryable,
          ...error.metadata,
        },
        error.originalError
      );

      // skipCrashlytics=true: output()의 자동 Sentry 전송을 방지하고,
      // 아래에서 severity 기반으로 직접 전송을 제어
      output('error', entry, true);

      // 프로덕션에서는 심각도에 따라 Crashlytics로 전송 (동적 import로 순환 의존성 방지)
      // low/medium (비밀번호 불일치, 이미 지원함 등) → Sentry 전송 안 함
      // high/critical (서버 장애, 알 수 없는 에러 등) → Sentry 전송
      if (isProduction && (error.severity === 'high' || error.severity === 'critical')) {
        // LogContext를 CrashContext-호환 형식으로 변환
        const crashContext = context ? toCrashContext(context) : undefined;
        import('@/services/crashlyticsService')
          .then(({ crashlyticsService }) => {
            crashlyticsService.recordAppError(error, crashContext).catch(() => {
              // Crashlytics 전송 실패 시 무시 (무한 루프 방지)
            });
          })
          .catch(() => {
            // 동적 import 실패 시 무시
          });
      }
    } else if (error instanceof Error) {
      logger.error(error.message, error, context);
    } else {
      logger.error(String(error), context);
    }
  },

  /**
   * 네트워크 요청 로깅
   */
  network: (
    method: string,
    url: string,
    status?: number,
    duration?: number,
    context?: LogContext
  ): void => {
    const level: LogLevel = status && status >= 400 ? 'error' : 'info';
    const message = `[Network] ${method} ${url}${status ? ` - ${status}` : ''}`;

    output(
      level,
      createEntry(level, message, {
        ...context,
        method,
        url,
        status,
        duration: duration ? `${duration.toFixed(2)}ms` : undefined,
      })
    );
  },

  /**
   * Firebase 작업 로깅
   */
  firebase: (
    operation: 'read' | 'write' | 'delete' | 'query' | 'auth' | 'storage',
    collection: string,
    docId?: string,
    context?: LogContext
  ): void => {
    const message = `[Firebase] ${operation.toUpperCase()} ${collection}${docId ? `/${docId}` : ''}`;

    output(
      'debug',
      createEntry('debug', message, {
        ...context,
        operation,
        collection,
        docId,
      })
    );
  },
};

export default logger;
