import { getFunctions, httpsCallable } from 'firebase/functions';
// 로그 레벨 정의
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 로그 컨텍스트 인터페이스
export interface LogContext {
  userId?: string;
  operation?: string;
  component?: string;
  fieldName?: string;
  duration?: number;
  value?: unknown;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  minDate?: Date;
  maxDate?: Date;
  pattern?: string;
  missingFields?: string[];
  requiredFields?: string[];
  index?: number;
  item?: unknown;
  validLength?: number;
  errors?: string[];
  warnings?: string[];
  data?: unknown;
  step?: string;
  eventId?: string;
  tokenGenerated?: boolean;
  errorCode?: string | number;
  errorMessage?: string;
  errorInfo?: string;
  error?: string;
  attempt?: number;
  maxRetries?: number;
  strategy?: string;
  additionalData?: Record<string, unknown>;
  timestamp?: string;
  
  // 새로 추가된 속성들
  selectionsCount?: number;
  firstSelection?: unknown;
  hasDatesArray?: boolean | unknown[] | unknown;
  hasCheckMethod?: boolean | string | unknown;
  jobPosting?: unknown;
  staffDataLength?: number;
  workLogsDataLength?: number;
  attendanceDataLength?: number;
  staffId?: string;
  date?: unknown;
  name?: unknown;
  keys?: string[];
  groups?: Record<string, unknown[]>;
  processedStaffPerDate?: Record<string, string[]>;
  groupedData?: Record<string, unknown[]>;
  entries?: [string, unknown[]][];
  dateA?: string;
  dateB?: string;
  groupedDataKeys?: string[];
  dates?: string[];
  totalItems?: number;
  dateHeaders?: (string | undefined)[];
  memoryUsageMB?: number;
  newLevel?: string;
}

// 로그 엔트리 인터페이스
export interface LogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: Error | undefined;
  stack?: string | undefined;
}

// 구조화된 로거 클래스
class StructuredLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';
  
  // 로그 레벨 제어를 위한 환경변수
  private minLogLevel: LogLevel;
  
  constructor() {
    // 환경변수로 로그 레벨 설정 (기본값: 개발환경은 debug, 프로덕션은 warn)
    const envLogLevel = process.env.REACT_APP_LOG_LEVEL?.toLowerCase();
    
    if (envLogLevel && Object.values(LogLevel).includes(envLogLevel as LogLevel)) {
      this.minLogLevel = envLogLevel as LogLevel;
    } else {
      this.minLogLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
    }
  }
  
  // 로그 레벨 우선순위
  private getLogLevelPriority(level: LogLevel): number {
    const priorities = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.CRITICAL]: 4
    };
    return priorities[level];
  }
  
  // 로그 레벨 체크
  private shouldLog(level: LogLevel): boolean {
    return this.getLogLevelPriority(level) >= this.getLogLevelPriority(this.minLogLevel);
  }

  // 로그 레벨별 색상 정의
  private colors = {
    [LogLevel.DEBUG]: '#6c757d',
    [LogLevel.INFO]: '#17a2b8',
    [LogLevel.WARN]: '#ffc107',
    [LogLevel.ERROR]: '#dc3545',
    [LogLevel.CRITICAL]: '#721c24'
  };

  // 로그 레벨별 이모지
  private emojis = {
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.CRITICAL]: '🚨'
  };

  // 기본 컨텍스트 생성
  private createBaseContext(additionalContext?: Partial<LogContext>): LogContext {
    return {
      timestamp: new Date().toISOString(),
      ...additionalContext
    };
  }

  // 콘솔에 로그 출력
  private logToConsole(entry: LogEntry): void {
    if (!this.isDevelopment || !this.shouldLog(entry.level)) return;

    const { level, message, context, error } = entry;
    const emoji = this.emojis[level];
    const color = this.colors[level];

    const logMessage = `${emoji} [${level.toUpperCase()}] ${message}`;
    const contextStr = JSON.stringify(context, null, 2);

    console.group(`%c${logMessage}`, `color: ${color}; font-weight: bold;`);
    console.log('Context:', contextStr);
    
    if (error) {
      console.error('Error:', error);
      if (error instanceof Error && error.stack) {
        console.log('Stack:', error.stack);
      }
    }
    
    console.groupEnd();
  }

  // Firebase Functions를 통한 서버 로깅
  private async logToServer(entry: LogEntry): Promise<void> {
    if (!this.isProduction || !this.shouldLog(entry.level)) return;

    try {
      const functions = getFunctions();
      const logActionCallable = httpsCallable(functions, 'logAction');
      
      await logActionCallable({
        action: `log_${entry.level}`,
        details: {
          message: entry.message,
          context: entry.context,
          error: entry.error ? {
            message: entry.error.message,
            stack: entry.error.stack,
            name: entry.error.name
          } : undefined
        }
      });
    } catch (error) {
      // 서버 로깅 실패 시 콘솔에 기록
      console.error('Failed to log to server:', error);
    }
  }

  // 로그 엔트리 생성 및 처리
  private async log(level: LogLevel, message: string, context?: Partial<LogContext>, error?: Error): Promise<void> {
    const logEntry: LogEntry = {
      level,
      message,
      context: this.createBaseContext(context),
      error,
      stack: error?.stack
    };

    // 콘솔 로깅 (개발 환경)
    this.logToConsole(logEntry);

    // 서버 로깅 (프로덕션 환경)
    await this.logToServer(logEntry);
  }

  // 공개 메서드들
  public debug(message: string, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, error?: Error, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    this.log(LogLevel.ERROR, message, context, error);
  }

  public critical(message: string, error?: Error, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.CRITICAL)) return;
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  // 현재 로그 레벨 확인 (개발/디버깅용)
  public getCurrentLogLevel(): LogLevel {
    return this.minLogLevel;
  }

  // 로그 레벨 동적 변경 (개발 환경에서만)
  public setLogLevel(level: LogLevel): void {
    if (!this.isDevelopment) return;
    this.minLogLevel = level;
    this.info('로그 레벨 변경됨', { newLevel: level });
  }

  // Firebase 작업 래퍼 (기존 withFirebaseErrorHandling 패턴 통합)
  public async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Partial<LogContext>
  ): Promise<T> {
    try {
      this.info(`Starting operation: ${operationName}`, { ...context, operation: operationName });
      const result = await operation();
      this.info(`Operation completed successfully: ${operationName}`, { ...context, operation: operationName });
      return result;
    } catch (error) {
      this.error(`Operation failed: ${operationName}`, error instanceof Error ? error : new Error(String(error)), { ...context, operation: operationName });
      
      // Firebase 내부 에러 처리
      if (error instanceof Error && error.message && error.message.includes('INTERNAL ASSERTION FAILED')) {
        this.warn(`Detected Firebase internal error, attempting recovery for: ${operationName}`, {
          ...context,
          operation: operationName
        });
        
        // 재시도 로직
        try {
          const retryResult = await operation();
          this.info(`Operation recovered successfully: ${operationName}`, { ...context, operation: operationName });
          return retryResult;
        } catch (retryError: any) {
          this.critical(`Operation recovery failed: ${operationName}`, retryError, { ...context, operation: operationName });
          throw retryError;
        }
      }
      
      throw error;
    }
  }

  // 성능 측정 래퍼
  public async withPerformanceTracking<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Partial<LogContext>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.info(`Performance: ${operationName} completed in ${duration.toFixed(2)}ms`, {
        ...context,
        operation: operationName,
        duration
      });
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.error(`Performance: ${operationName} failed after ${duration.toFixed(2)}ms`, error instanceof Error ? error : new Error(String(error)), {
        ...context,
        operation: operationName,
        duration
      });
      
      throw error;
    }
  }
}

// 싱글톤 인스턴스 생성
export const logger = new StructuredLogger();

// 편의 함수들
export const logDebug = (message: string, context?: Partial<LogContext>) => {
  logger.debug(message, context);
};
export const logInfo = (message: string, context?: Partial<LogContext>) => logger.info(message, context);
export const logWarn = (message: string, context?: Partial<LogContext>) => logger.warn(message, context);
export const logError = (message: string, error?: Error, context?: Partial<LogContext>) => logger.error(message, error, context);
export const logCritical = (message: string, error?: Error, context?: Partial<LogContext>) => logger.critical(message, error, context);

// Firebase 작업 래퍼 함수들
export const withErrorHandling = <T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Partial<LogContext>
) => logger.withErrorHandling(operation, operationName, context);

export const withPerformanceTracking = <T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Partial<LogContext>
) => logger.withPerformanceTracking(operation, operationName, context);