/**
 * 실패한 카운터 연산 재처리 스케줄러
 *
 * @description 1시간마다 _failedCounterOps 컬렉션의 실패 기록을 재처리
 * @version 1.0.0
 *
 * @note 알림 카운터 증가/감소 실패 시 복구용
 */

import * as functions from 'firebase-functions/v1';
import { retryFailedCounterOps } from '../utils/notificationUtils';

/**
 * 실패한 카운터 연산 재처리 스케줄러
 *
 * @schedule 매 1시간마다 실행
 * @region asia-northeast3
 *
 * @description
 * - _failedCounterOps 컬렉션에서 pending 상태의 실패 기록 조회
 * - 최대 100개씩 배치 재처리
 * - 3회 재시도 후 failed로 표시
 *
 * @example
 * // Firebase Console에서 수동 실행 가능
 * // 또는 Cloud Scheduler에서 트리거
 */
export const retryFailedCounterOpsScheduled = functions
  .region('asia-northeast3')
  .pubsub.schedule('every 1 hours')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    functions.logger.info('실패 카운터 연산 재처리 시작', {
      eventId: context.eventId,
      timestamp: context.timestamp,
    });

    try {
      const result = await retryFailedCounterOps(100);

      functions.logger.info('스케줄된 카운터 복구 완료', {
        ...result,
        eventId: context.eventId,
      });

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('스케줄된 카운터 복구 실패', {
        error: errorMessage,
        eventId: context.eventId,
      });

      // 스케줄러 실패는 다음 실행에서 재시도되므로 throw하지 않음
      return { success: 0, failed: 0, skipped: 0, error: errorMessage };
    }
  });
