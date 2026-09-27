/**
 * 웹 로거 — 모바일 `@/utils/logger` 와 같은 모양(동기화 사본 Repository·Service 가 이것을 쓴다).
 *
 * - 개발(`import.meta.env.DEV`): debug 이상 전부 콘솔(console.debug/info/warn/error — console.log 금지).
 * - 운영: warn·error 만 콘솔. 외부 수집(Sentry 등)은 설계 §8 결정 전이라 두지 않는다.
 * - 컨텍스트에 비밀번호·토큰이 섞여 나가지 않게 알려진 키는 가린다.
 */
import { isAppError, isRecoverableBusinessAppError } from '@/core/errors/AppError';

export type LogContext = Record<string, unknown>;
type Level = 'debug' | 'info' | 'warn' | 'error';

const SECRET_KEY_RE = /(password|token|secret|pin|authorization|access_token|refresh_token)/i;

export function redact(context: LogContext | undefined): LogContext | undefined {
  if (!context) return undefined;
  return Object.fromEntries(
    Object.entries(context).map(([k, v]) => [k, SECRET_KEY_RE.test(k) ? '[가림]' : v])
  );
}

const enabled = (level: Level): boolean =>
  import.meta.env.DEV || level === 'warn' || level === 'error';

function output(level: Level, message: string, context?: LogContext, error?: Error): void {
  if (!enabled(level)) return;
  const args: unknown[] = [`[ops] ${message}`];
  const safe = redact(context);
  if (safe) args.push(safe);
  if (error) args.push(error);
  console[level](...args);
}

export const logger = {
  debug: (message: string, context?: LogContext): void => output('debug', message, context),
  info: (message: string, context?: LogContext): void => output('info', message, context),
  warn: (message: string, context?: LogContext): void => output('warn', message, context),
  error: (message: string, error?: Error | LogContext, context?: LogContext): void => {
    if (error instanceof Error) output('error', message, context, error);
    else output('error', message, error);
  },
  /**
   * AppError 로깅(모바일 serviceErrorHandler 사본이 호출). 사용자 복구 가능한 업무 에러
   * (등록 마감·좌석 충돌 등)는 warn 으로 낮춰 콘솔을 붉게 물들이지 않는다.
   */
  appError: (error: unknown, context?: LogContext): void => {
    if (isAppError(error)) {
      const level: Level = isRecoverableBusinessAppError(error) ? 'warn' : 'error';
      output(
        level,
        error.message,
        { ...context, code: error.code, category: error.category },
        error
      );
      return;
    }
    output('error', '알 수 없는 에러', context, error instanceof Error ? error : undefined);
  },
};
