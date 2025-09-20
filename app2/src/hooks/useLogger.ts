import { getFunctions, httpsCallable } from 'firebase/functions';

import { logger, type LogContext } from '../utils/logger';

type ActionType =
  | 'login'
  | 'logout'
  | 'staff_added'
  | 'staff_added_with_id'
  | 'staff_updated'
  | 'staff_deleted'
  | 'event_added'
  | 'event_updated'
  | 'event_deleted'
  | 'participant_added'
  | 'participant_updated'
  | 'participant_deleted'
  | 'participant_busted'
  | 'participant_added_and_seated'
  | 'assignment_added'
  | 'assignment_updated'
  | 'assignment_deleted'
  | 'worklog_added'
  | 'worklog_updated'
  | 'worklog_deleted'
  | 'clock_in'
  | 'clock_out'
  | 'application_added'
  | 'application_status_updated'
  | 'table_created_standby'
  | 'table_activated'
  | 'table_closed'
  | 'table_details_updated'
  | 'table_order_updated'
  | 'seats_reassigned_with_balancing'
  | 'participants_moved'
  | 'seat_moved'
  | 'max_seats_updated'
  | 'settings_updated'
  | 'action_failed';


export const logAction = async (action: ActionType, details: Record<string, any> = {}) => {
  const context: LogContext = {
    operation: 'logAction',
    additionalData: { action, details }
  };

  try {
    const functions = getFunctions();
    const logActionCallable = httpsCallable(functions, 'logAction');
    await logActionCallable({ action, details });
    
    logger.info(`Action logged successfully: ${action}`, context);
  } catch (error) {
    logger.error(`Failed to log action: ${action}`, error instanceof Error ? error : new Error(String(error)), context);
  }
};

// 새로운 구조화된 로깅 훅
export const useStructuredLogger = () => {
  return {
    debug: (_message: string, _context?: Partial<LogContext>) => {
      // Debug 로그는 프로덕션에서 제거됨
    },
    info: (message: string, context?: Partial<LogContext>) => {
      logger.info(message, context);
    },
    warn: (message: string, context?: Partial<LogContext>) => {
      logger.warn(message, context);
    },
    error: (message: string, error?: Error, context?: Partial<LogContext>) => {
      logger.error(message, error, context);
    },
    critical: (message: string, error?: Error, context?: Partial<LogContext>) => {
      logger.critical(message, error, context);
    },
    withErrorHandling: <T>(
      operation: () => Promise<T>,
      operationName: string,
      context?: Partial<LogContext>
    ) => {
      return logger.withErrorHandling(operation, operationName, context);
    },
    withPerformanceTracking: <T>(
      operation: () => Promise<T>,
      operationName: string,
      context?: Partial<LogContext>
    ) => {
      return logger.withPerformanceTracking(operation, operationName, context);
    }
  };
};

// 기존 호환성을 위한 별칭
export const useLogger = useStructuredLogger;
