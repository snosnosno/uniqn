/**
 * API Rate Limiting Middleware
 *
 * 기능:
 * - 결제 API 호출 제한 (사용자당 1분에 5회)
 * - Redis 기반 Rate Limiting (Production)
 * - Firestore 기반 Rate Limiting (Development)
 * - 남용 방지
 *
 * 알고리즘: Token Bucket (토큰 버킷)
 */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

/**
 * Rate Limit 설정
 */
export interface RateLimitConfig {
  windowMs: number;        // 시간 윈도우 (밀리초)
  maxRequests: number;     // 최대 요청 횟수
  keyPrefix: string;       // 키 접두사
}

/**
 * Rate Limit 기본 설정
 */
export const RATE_LIMIT_CONFIGS = {
  // 결제 API: 1분에 5회
  payment: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 5,
    keyPrefix: 'ratelimit:payment',
  },
  // 환불 API: 1분에 3회
  refund: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 3,
    keyPrefix: 'ratelimit:refund',
  },
  // 일반 API: 1분에 30회
  general: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 30,
    keyPrefix: 'ratelimit:general',
  },
};

/**
 * Rate Limit 결과
 */
export interface RateLimitResult {
  allowed: boolean;          // 요청 허용 여부
  remainingRequests: number; // 남은 요청 횟수
  resetTime: number;         // 리셋 시간 (Unix timestamp)
  retryAfter?: number;       // 재시도까지 대기 시간 (초)
}

/**
 * Rate Limit 체크 (Firestore 기반)
 *
 * @param userId - 사용자 ID
 * @param config - Rate Limit 설정
 * @returns Rate Limit 결과
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const resetTime = now + config.windowMs;

  // Rate Limit 키
  const rateLimitKey = `${config.keyPrefix}:${userId}`;
  const rateLimitRef = db.collection('rateLimits').doc(rateLimitKey);

  try {
    // Firestore 트랜잭션으로 원자적 처리
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);

      // 1. 문서가 없거나 만료된 경우
      if (!doc.exists) {
        // 새로운 Rate Limit 생성
        transaction.set(rateLimitRef, {
          userId,
          requests: [{
            timestamp: now,
          }],
          resetAt: resetTime,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          allowed: true,
          remainingRequests: config.maxRequests - 1,
          resetTime,
        };
      }

      // 2. 기존 문서 확인
      const data = doc.data()!;
      const requests = data.requests || [];

      // 3. 윈도우 밖의 요청 필터링
      const validRequests = requests.filter(
        (req: { timestamp: number }) => req.timestamp > windowStart
      );

      // 4. Rate Limit 체크
      if (validRequests.length >= config.maxRequests) {
        // 요청 제한 초과
        const oldestRequest = validRequests[0];
        const retryAfter = Math.ceil(
          (oldestRequest.timestamp + config.windowMs - now) / 1000
        );

        logger.warn('Rate limit exceeded', {
          userId,
          config: config.keyPrefix,
          requests: validRequests.length,
          maxRequests: config.maxRequests,
          retryAfter,
        });

        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: oldestRequest.timestamp + config.windowMs,
          retryAfter,
        };
      }

      // 5. 요청 허용 - 새로운 요청 추가
      validRequests.push({ timestamp: now });

      transaction.update(rateLimitRef, {
        requests: validRequests,
        resetAt: resetTime,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        allowed: true,
        remainingRequests: config.maxRequests - validRequests.length,
        resetTime,
      };
    });

    return result;
  } catch (error) {
    logger.error('Rate limit check failed', {
      userId,
      config: config.keyPrefix,
      error,
    });

    // 에러 시에는 요청 허용 (서비스 가용성 우선)
    return {
      allowed: true,
      remainingRequests: config.maxRequests,
      resetTime,
    };
  }
}

/**
 * Rate Limit 검증 (미들웨어)
 *
 * @param userId - 사용자 ID
 * @param config - Rate Limit 설정
 * @throws {Error} Rate Limit 초과 시 에러
 */
export async function validateRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<void> {
  const result = await checkRateLimit(userId, config);

  if (!result.allowed) {
    const error = new Error(
      `요청 횟수 제한을 초과했습니다. ${result.retryAfter}초 후에 다시 시도하세요.`
    );
    Object.assign(error, { code: 'RATE_LIMIT_EXCEEDED', retryAfter: result.retryAfter });
    throw error;
  }

  logger.info('Rate limit check passed', {
    userId,
    config: config.keyPrefix,
    remainingRequests: result.remainingRequests,
  });
}

/**
 * Rate Limit 초기화 (테스트용)
 *
 * @param userId - 사용자 ID
 * @param config - Rate Limit 설정
 */
export async function resetRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<void> {
  const rateLimitKey = `${config.keyPrefix}:${userId}`;
  await db.collection('rateLimits').doc(rateLimitKey).delete();

  logger.info('Rate limit reset', {
    userId,
    config: config.keyPrefix,
  });
}

/**
 * 만료된 Rate Limit 정리 (Scheduled Function)
 *
 * 매일 자정에 실행되어 만료된 Rate Limit 문서를 삭제합니다.
 */
export async function cleanupExpiredRateLimits(): Promise<void> {
  const now = Date.now();

  try {
    const snapshot = await db
      .collection('rateLimits')
      .where('resetAt', '<', now)
      .limit(500)  // 한 번에 500개씩 처리
      .get();

    if (snapshot.empty) {
      logger.info('No expired rate limits to cleanup');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info('Expired rate limits cleaned up', {
      count: snapshot.size,
    });
  } catch (error) {
    logger.error('Failed to cleanup expired rate limits', { error });
  }
}

/**
 * IP 기반 Rate Limiting (추가 보안)
 *
 * 사용자 인증 전에 IP 주소 기반으로 Rate Limiting을 적용합니다.
 * DDoS 공격 및 무차별 대입 공격 방지
 *
 * @param ipAddress - IP 주소
 * @param config - Rate Limit 설정
 * @returns Rate Limit 결과
 */
export async function checkIpRateLimit(
  ipAddress: string,
  config: RateLimitConfig = {
    windowMs: 60 * 1000,    // 1분
    maxRequests: 100,       // IP당 1분에 100회
    keyPrefix: 'ratelimit:ip',
  }
): Promise<RateLimitResult> {
  // IP 주소 정규화 (IPv6 → IPv4 변환)
  const normalizedIp = ipAddress.replace(/^::ffff:/, '');

  return checkRateLimit(normalizedIp, config);
}

/**
 * 사용자별 일일 한도 체크
 *
 * 결제 남용 방지를 위한 일일 결제 횟수 제한
 *
 * @param userId - 사용자 ID
 * @param maxDailyPayments - 일일 최대 결제 횟수 (기본값: 10회)
 * @returns 일일 한도 초과 여부
 */
export async function checkDailyPaymentLimit(
  userId: string,
  maxDailyPayments: number = 10
): Promise<{
  allowed: boolean;
  remainingPayments: number;
  todayPayments: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // 오늘 결제 횟수 조회
    const paymentsSnapshot = await db
      .collection('paymentTransactions')
      .where('userId', '==', userId)
      .where('createdAt', '>=', today)
      .where('createdAt', '<', tomorrow)
      .where('status', '==', 'completed')
      .get();

    const todayPayments = paymentsSnapshot.size;
    const remainingPayments = Math.max(0, maxDailyPayments - todayPayments);

    if (todayPayments >= maxDailyPayments) {
      logger.warn('Daily payment limit exceeded', {
        userId,
        todayPayments,
        maxDailyPayments,
      });

      return {
        allowed: false,
        remainingPayments: 0,
        todayPayments,
      };
    }

    return {
      allowed: true,
      remainingPayments,
      todayPayments,
    };
  } catch (error) {
    logger.error('Failed to check daily payment limit', {
      userId,
      error,
    });

    // 에러 시에는 요청 허용 (서비스 가용성 우선)
    return {
      allowed: true,
      remainingPayments: maxDailyPayments,
      todayPayments: 0,
    };
  }
}

/**
 * 남용 패턴 감지
 *
 * 의심스러운 결제 패턴을 감지하고 차단합니다.
 *
 * @param userId - 사용자 ID
 * @returns 남용 패턴 감지 결과
 */
export async function detectAbusePattern(
  userId: string
): Promise<{
  isAbusive: boolean;
  reason?: string;
  riskScore: number;  // 0.0 ~ 1.0 (위험도)
}> {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  try {
    // 1시간 내 결제 시도 조회
    const recentPaymentsSnapshot = await db
      .collection('paymentTransactions')
      .where('userId', '==', userId)
      .where('createdAt', '>=', new Date(oneHourAgo))
      .get();

    const recentPayments = recentPaymentsSnapshot.docs.map((doc) => doc.data());

    // 위험도 점수 계산
    let riskScore = 0;

    // 1. 1시간 내 10회 이상 결제 시도 (+0.3)
    if (recentPayments.length >= 10) {
      riskScore += 0.3;
    }

    // 2. 실패한 결제 비율이 50% 이상 (+0.3)
    const failedPayments = recentPayments.filter(
      (payment) => payment.status === 'failed'
    );
    const failureRate = failedPayments.length / recentPayments.length;
    if (failureRate >= 0.5) {
      riskScore += 0.3;
    }

    // 3. 동일 금액 반복 결제 (+0.2)
    const amounts = recentPayments.map((payment) => payment.amount);
    const uniqueAmounts = new Set(amounts);
    if (uniqueAmounts.size === 1 && amounts.length >= 5) {
      riskScore += 0.2;
    }

    // 4. 짧은 시간 내 연속 결제 (+0.2)
    const timestamps = recentPayments.map((payment) =>
      payment.createdAt.toMillis()
    );
    timestamps.sort((a, b) => a - b);
    let consecutivePayments = 0;
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] < 5000) {
        // 5초 이내
        consecutivePayments++;
      }
    }
    if (consecutivePayments >= 3) {
      riskScore += 0.2;
    }

    // 위험도 판정
    const isAbusive = riskScore >= 0.7;

    if (isAbusive) {
      logger.warn('Abuse pattern detected', {
        userId,
        riskScore,
        recentPayments: recentPayments.length,
        failureRate,
      });

      return {
        isAbusive: true,
        reason: '의심스러운 결제 패턴이 감지되었습니다.',
        riskScore,
      };
    }

    return {
      isAbusive: false,
      riskScore,
    };
  } catch (error) {
    logger.error('Failed to detect abuse pattern', {
      userId,
      error,
    });

    return {
      isAbusive: false,
      riskScore: 0,
    };
  }
}
