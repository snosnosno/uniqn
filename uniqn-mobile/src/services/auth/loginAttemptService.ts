/**
 * UNIQN Mobile - Login Attempt Rate Limiting Service
 *
 * @description 로그인 시도 횟수 추적 및 계정 잠금. 브루트포스 공격 완화.
 *
 * 정책:
 *  - 5회 연속 실패 시 15분 잠금
 *  - 잠금 시간 경과 시 자동 해제
 *  - 성공 시 카운트 리셋
 *
 * @note 이전에 sessionService에 있던 로직. 단일 책임 원칙으로 분리됨.
 */

import { getItem, setItem, deleteItem } from '@/lib/secureStorage';
import { logger } from '@/utils/logger';
import { AuthError, ERROR_CODES, isAppError, toError } from '@/errors';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

export interface LoginAttempts {
  count: number;
  lockUntil: number | null;
  lastAttempt: number;
}

export async function checkLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const attempts = await getItem<LoginAttempts>(key);
    if (!attempts) {
      return;
    }

    if (attempts.lockUntil && Date.now() < attempts.lockUntil) {
      const remainingTime = Math.ceil((attempts.lockUntil - Date.now()) / 60000);
      throw new AuthError(ERROR_CODES.AUTH_RATE_LIMITED, {
        userMessage: `로그인 시도 횟수를 초과했습니다. ${remainingTime}분 후에 다시 시도해 주세요.`,
        metadata: { remainingMinutes: remainingTime },
      });
    }

    if (attempts.lockUntil && Date.now() >= attempts.lockUntil) {
      await deleteItem(key);
    }
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    logger.error('로그인 시도 횟수 확인 실패', toError(error));
  }
}

export async function incrementLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const current = (await getItem<LoginAttempts>(key)) ?? {
      count: 0,
      lockUntil: null,
      lastAttempt: 0,
    };

    const newCount = current.count + 1;
    const shouldLock = newCount >= MAX_LOGIN_ATTEMPTS;

    const nextAttempts: LoginAttempts = {
      count: newCount,
      lockUntil: shouldLock ? Date.now() + LOCKOUT_DURATION : null,
      lastAttempt: Date.now(),
    };

    await setItem(key, nextAttempts);

    if (shouldLock) {
      logger.warn('로그인 시도 횟수 초과 - 계정 잠금', {
        email: email.substring(0, 3) + '***',
      });
    }
  } catch (error) {
    logger.error('로그인 시도 횟수 증가 실패', toError(error));
  }
}

export async function resetLoginAttempts(email: string): Promise<void> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    await deleteItem(key);
    logger.debug('로그인 시도 횟수 초기화', { email: email.substring(0, 3) + '***' });
  } catch (error) {
    logger.error('로그인 시도 횟수 초기화 실패', toError(error));
  }
}

export async function getRemainingLoginAttempts(email: string): Promise<number> {
  const key = `login_attempts_${email.toLowerCase()}`;

  try {
    const attempts = await getItem<LoginAttempts>(key);
    if (!attempts) {
      return MAX_LOGIN_ATTEMPTS;
    }

    return Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.count);
  } catch {
    return MAX_LOGIN_ATTEMPTS;
  }
}
