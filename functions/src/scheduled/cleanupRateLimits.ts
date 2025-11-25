/**
 * Rate Limit 정리 Scheduled Function
 *
 * 매일 자정에 실행되어 만료된 Rate Limit 문서를 삭제합니다.
 * Firestore 비용 절감 및 성능 최적화
 */

import * as functions from 'firebase-functions';
import { cleanupExpiredRateLimits } from '../middleware/rateLimiter';

/**
 * Cloud Scheduler: 매일 00:00 (Asia/Seoul) 실행
 *
 * 배포 명령:
 * ```bash
 * gcloud scheduler jobs create pubsub cleanupRateLimits \
 *   --schedule="0 0 * * *" \
 *   --time-zone="Asia/Seoul" \
 *   --topic="cleanup-rate-limits" \
 *   --message-body="{}"
 * ```
 */
export const cleanupRateLimitsScheduled = functions
  .region('asia-northeast3')
  .pubsub.topic('cleanup-rate-limits')
  .onPublish(async () => {
    functions.logger.info('Rate Limit 정리 시작');

    await cleanupExpiredRateLimits();

    functions.logger.info('Rate Limit 정리 완료');
  });
