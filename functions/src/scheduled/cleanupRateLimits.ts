/**
 * Rate Limit 정리 Scheduled Function
 *
 * 매일 자정에 실행되어 만료된 Rate Limit 문서를 삭제합니다.
 * Firestore 비용 절감 및 성능 최적화
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { cleanupExpiredRateLimits } from '../middleware/rateLimiter';

/**
 * Cloud Scheduler: 매일 00:00 (Asia/Seoul) 실행
 * onSchedule() 사용 → firebase deploy 시 Cloud Scheduler 자동 생성
 */
export const cleanupRateLimitsScheduled = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  async () => {
    logger.info('Rate Limit 정리 시작');

    await cleanupExpiredRateLimits();

    logger.info('Rate Limit 정리 완료');
  }
);
