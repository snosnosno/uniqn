/**
 * Rate Limit 정리 Scheduled Function
 *
 * 매일 자정에 실행되어 만료된 Rate Limit 문서를 삭제합니다.
 * Firestore 비용 절감 및 성능 최적화
 */

import * as functions from 'firebase-functions/v1';
import { cleanupExpiredRateLimits } from '../middleware/rateLimiter';

/**
 * Cloud Scheduler: 매일 00:00 (Asia/Seoul) 실행
 * pubsub.schedule() 사용 → firebase deploy 시 Cloud Scheduler 자동 생성
 */
export const cleanupRateLimitsScheduled = functions
  .region('asia-northeast3')
  .pubsub.schedule('0 0 * * *')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    functions.logger.info('Rate Limit 정리 시작');

    await cleanupExpiredRateLimits();

    functions.logger.info('Rate Limit 정리 완료');
  });
