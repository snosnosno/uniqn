/**
 * UNIQN Mobile - 로깅 유틸리티
 *
 * @description 구조화된 로깅 시스템
 * @version 1.0.0
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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
 * 프로덕션 환경 여부
 */
const isProduction = process.env.NODE_ENV === 'production';

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
 */
const output = (level: LogLevel, entry: LogEntry): void => {
  if (!shouldLog(level)) return;

  const formatted = formatLog(entry);

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
      if (entry.error) {
        console.error(entry.error);
      }
      break;
  }

  // TODO: 프로덕션에서는 Crashlytics 등으로 전송
  // if (isProduction && level === 'error') {
  //   crashlytics().recordError(entry.error || new Error(entry.message));
  // }
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
      console.group(label);
    }
  },

  /**
   * 그룹 로그 종료
   */
  groupEnd: (): void => {
    if (!isProduction) {
      console.groupEnd();
    }
  },

  /**
   * 테이블 로그 (개발용)
   */
  table: (data: Record<string, unknown>[] | object): void => {
    if (!isProduction) {
      console.table(data);
    }
  },
};

export default logger;
