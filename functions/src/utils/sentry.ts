/**
 * Sentry 에러 트래킹 (Firebase Functions)
 *
 * 기능:
 * - Cloud Functions 에러 자동 캡처
 * - 성능 모니터링
 * - 사용자 컨텍스트 추적
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import * as functions from 'firebase-functions';

/**
 * Sentry 초기화
 */
export const initSentry = (): void => {
  const dsn = functions.config().sentry?.dsn;

  if (!dsn) {
    console.warn('⚠️  Sentry DSN이 설정되지 않아 에러 트래킹이 비활성화되었습니다.');
    console.warn('설정 방법: firebase functions:config:set sentry.dsn="YOUR_DSN"');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.GCLOUD_PROJECT || 'development',

    // 통합 기능
    integrations: [
      new ProfilingIntegration(),
    ],

    // 성능 모니터링 샘플링 비율
    tracesSampleRate: 0.1, // 10%

    // 프로파일링 샘플링 비율
    profilesSampleRate: 0.1, // 10%

    // 민감 정보 필터링
    beforeSend(event) {
      // 환경변수에서 민감 정보 제거
      if (event.contexts?.runtime?.env) {
        const filteredEnv = {} as Record<string, string>;
        Object.keys(event.contexts.runtime.env).forEach((key) => {
          if (
            !key.toLowerCase().includes('secret') &&
            !key.toLowerCase().includes('key') &&
            !key.toLowerCase().includes('password') &&
            !key.toLowerCase().includes('token')
          ) {
            filteredEnv[key] = event.contexts.runtime.env[key];
          } else {
            filteredEnv[key] = '[FILTERED]';
          }
        });
        event.contexts.runtime.env = filteredEnv;
      }

      // 요청 데이터에서 민감 정보 제거
      if (event.request?.data) {
        const sensitiveFields = [
          'password',
          'token',
          'secret',
          'apiKey',
          'creditCard',
          'ssn',
        ];

        const filteredData = { ...event.request.data };
        sensitiveFields.forEach((field) => {
          if (filteredData[field]) {
            filteredData[field] = '[FILTERED]';
          }
        });
        event.request.data = filteredData;
      }

      return event;
    },

    // 무시할 에러
    ignoreErrors: [
      'PERMISSION_DENIED',
      'UNAUTHENTICATED',
      'NOT_FOUND',
    ],
  });

  console.info('✅ Sentry (Functions) 초기화 완료');
};

/**
 * Cloud Function 래퍼 (자동 에러 캡처)
 *
 * @param fn Cloud Function
 * @returns 래핑된 Function
 */
export const wrapFunction = <T extends (...args: any[]) => any>(fn: T): T => {
  return ((...args: Parameters<T>) => {
    return Sentry.startTransaction(
      {
        name: fn.name || 'anonymous',
        op: 'function.cloud',
      },
      () => {
        try {
          const result = fn(...args);

          // Promise를 반환하는 경우
          if (result && typeof result.then === 'function') {
            return result.catch((error: Error) => {
              Sentry.captureException(error);
              throw error;
            });
          }

          return result;
        } catch (error) {
          Sentry.captureException(error);
          throw error;
        }
      }
    );
  }) as T;
};

/**
 * 에러 캡처
 *
 * @param error 에러 객체
 * @param context 추가 컨텍스트
 */
export const captureError = (
  error: Error | unknown,
  context?: Record<string, unknown>
): void => {
  if (context) {
    Sentry.setContext('additional', context);
  }

  if (error instanceof Error) {
    Sentry.captureException(error);
  } else {
    Sentry.captureException(new Error(String(error)));
  }
};

/**
 * 메시지 캡처
 *
 * @param message 메시지
 * @param level 심각도
 * @param context 추가 컨텍스트
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): void => {
  if (context) {
    Sentry.setContext('additional', context);
  }

  Sentry.captureMessage(message, level);
};

/**
 * 사용자 정보 설정
 *
 * @param userId 사용자 ID
 * @param email 사용자 이메일
 */
export const setSentryUser = (userId: string, email?: string): void => {
  Sentry.setUser({
    id: userId,
    email,
  });
};

export default Sentry;
