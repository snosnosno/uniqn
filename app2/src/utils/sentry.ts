import * as Sentry from '@sentry/react';
import { logger } from './logger';

// Sentry 초기화 함수
export const initSentry = () => {
  // Sentry DSN이 설정되어 있는지 확인
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) {
    logger.warn('Sentry DSN is not configured', { component: 'Sentry' });
    return;
  }

  // 개발 환경에서는 콘솔에만 로깅
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Sentry is in development mode (console logging only)', { component: 'Sentry' });
  }

  try {
    Sentry.init({
      dsn,

      // 성능 모니터링
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // 환경 설정
      environment: process.env.REACT_APP_ENV || process.env.NODE_ENV || 'production',

      // 에러 필터링
      beforeSend(event) {
        // 개발자 확장 프로그램 에러 무시
        if (event.exception?.values?.[0]?.value?.includes('extension://')) {
          return null;
        }

        // 네트워크 에러 중 일부 무시
        if (event.exception?.values?.[0]?.type === 'NetworkError') {
          const message = event.exception.values[0].value || '';
          if (message.includes('Load failed') || message.includes('Failed to fetch')) {
            // 일시적인 네트워크 에러는 로그만 남기고 Sentry에 보내지 않음
            logger.warn('Network error ignored by Sentry', {
              component: 'Sentry',
              data: { message },
            });
            return null;
          }
        }

        return event;
      },

      // 무시할 에러 패턴
      ignoreErrors: [
        // 브라우저 확장 프로그램 관련
        'extension://',
        'chrome-extension://',
        'moz-extension://',
        // 일반적인 네트워크 에러
        'Network request failed',
        'NetworkError',
        'Failed to fetch',
        // 사용자 취소
        'AbortError',
        'Cancelled',
        // 알려진 써드파티 에러
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Firebase 관련 (이미 logger로 처리)
        'INTERNAL ASSERTION FAILED',
        'Firebase: Error',
      ],

      // 추가 컨텍스트 설정
      initialScope: {
        tags: {
          component: 'react',
        },
      },
    });

    logger.info('Sentry initialized successfully', { component: 'Sentry' });
  } catch (error) {
    logger.error(
      'Failed to initialize Sentry',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'Sentry' }
    );
  }
};

// 사용자 정보 설정
export const setSentryUser = (user: { id: string; email?: string; username?: string } | null) => {
  if (process.env.NODE_ENV !== 'production') return;

  if (user) {
    const sentryUser: { id: string; email?: string; username?: string } = {
      id: user.id,
    };
    if (user.email) sentryUser.email = user.email;
    if (user.username) sentryUser.username = user.username;
    Sentry.setUser(sentryUser);
  } else {
    Sentry.setUser(null);
  }
};

// 추가 컨텍스트 설정
export const setSentryContext = (key: string, context: Record<string, any>) => {
  if (process.env.NODE_ENV !== 'production') return;

  Sentry.setContext(key, context);
};

// 커스텀 에러 캡처
export const captureError = (error: Error, context?: Record<string, any>) => {
  if (process.env.NODE_ENV === 'production') {
    if (context) {
      Sentry.captureException(error, {
        contexts: { custom: context },
      });
    } else {
      Sentry.captureException(error);
    }
  }

  // 로컬에서도 로깅
  logger.error('Error captured', error, {
    component: 'Sentry',
    data: context,
  });
};

// 메시지 캡처 (에러가 아닌 중요한 이벤트)
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureMessage(message, level);
  }

  // 로컬에서도 로깅
  logger.info('Message captured', {
    component: 'Sentry',
    data: { message, level },
  });
};

// 브레드크럼 추가 (사용자 행동 추적)
export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, unknown>
) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
};

// 성능 측정 헬퍼 (단순 에러 캡처)
export const measurePerformance = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  try {
    const result = await fn();
    return result;
  } catch (error) {
    captureError(error as Error, { function: name });
    throw error;
  }
};
