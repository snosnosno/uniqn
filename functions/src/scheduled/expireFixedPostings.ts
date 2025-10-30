/**
 * @file expireFixedPostings.ts
 * @description 고정 공고 만료 처리 Scheduled Function
 *
 * 실행 주기: 매 1시간마다
 * 처리 내용:
 * 1. expiresAt이 현재 시각보다 이전인 고정 공고 조회
 * 2. status를 'closed'로 업데이트
 * 3. 배치 처리 (100개 제한)
 * 4. 만료 처리 로그 기록
 */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * 고정 공고 만료 처리 Scheduled Function
 *
 * 스케줄: 매 1시간마다 실행 (0 * * * *)
 * 타임존: Asia/Seoul
 */
export const expireFixedPostings = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Asia/Seoul',
    memory: '256MiB',
    maxInstances: 1
  },
  async (event) => {
    logger.info('=== 고정 공고 만료 처리 시작 ===', {
      timestamp: new Date().toISOString(),
      triggeredAt: event.scheduleTime
    });

    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    try {
      // 만료된 고정 공고 조회
      // 조건: postingType='fixed' AND status='open' AND expiresAt <= now
      const expiredQuery = db
        .collection('jobPostings')
        .where('postingType', '==', 'fixed')
        .where('status', '==', 'open')
        .where('fixedConfig.expiresAt', '<=', now)
        .limit(100); // 배치 크기 제한

      const snapshot = await expiredQuery.get();

      if (snapshot.empty) {
        logger.info('만료된 고정 공고가 없습니다');
        return;
      }

      logger.info(`${snapshot.size}개 만료된 공고 발견`);

      // 배치 업데이트
      const batch = db.batch();
      let processedCount = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        logger.info(`공고 ${doc.id} 만료 처리`, {
          id: doc.id,
          title: data.title,
          expiresAt: data.fixedConfig?.expiresAt?.toDate(),
          durationDays: data.fixedConfig?.durationDays
        });

        // status를 'closed'로 업데이트
        batch.update(doc.ref, {
          status: 'closed',
          closedAt: now,
          closedReason: 'expired', // 만료 사유 추가
          updatedAt: now
        });

        processedCount++;
      });

      // 배치 커밋
      await batch.commit();

      logger.info('=== 고정 공고 만료 처리 완료 ===', {
        expiredCount: processedCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('고정 공고 만료 처리 실패', error, {
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      throw error; // Functions에서 재시도하도록 에러 던지기
    }
  }
);

/**
 * 수동 만료 처리 Callable Function (admin 전용)
 *
 * 사용 예시:
 * ```typescript
 * const result = await httpsCallable(functions, 'manualExpireFixedPostings')({
 *   dryRun: true
 * });
 * ```
 */
export const manualExpireFixedPostings = async (
  data: {
    dryRun?: boolean;
    limit?: number;
  },
  context: admin.auth.DecodedIdToken
): Promise<{
  success: boolean;
  expiredCount: number;
  expiredPostings: Array<{ id: string; title: string; expiresAt: string }>;
  message: string;
}> => {
  // Admin 권한 체크
  if (!context.uid) {
    throw new Error('인증되지 않은 요청입니다');
  }

  const userDoc = await admin.firestore()
    .collection('users')
    .doc(context.uid)
    .get();

  const userData = userDoc.data();
  if (!userData || userData.role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다');
  }

  logger.info('수동 만료 처리 요청', {
    userId: context.uid,
    dryRun: data.dryRun ?? true,
    limit: data.limit ?? 100
  });

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const limit = data.limit ?? 100;

  try {
    // 만료된 고정 공고 조회
    const expiredQuery = db
      .collection('jobPostings')
      .where('postingType', '==', 'fixed')
      .where('status', '==', 'open')
      .where('fixedConfig.expiresAt', '<=', now)
      .limit(limit);

    const snapshot = await expiredQuery.get();

    if (snapshot.empty) {
      return {
        success: true,
        expiredCount: 0,
        expiredPostings: [],
        message: '만료된 공고가 없습니다'
      };
    }

    const expiredPostings = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Untitled',
        expiresAt: data.fixedConfig?.expiresAt?.toDate()?.toISOString() || 'Unknown'
      };
    });

    // Dry-run 모드
    if (data.dryRun) {
      logger.info('[DRY RUN] 만료 처리 예정 공고', {
        count: expiredPostings.length,
        postings: expiredPostings
      });

      return {
        success: true,
        expiredCount: expiredPostings.length,
        expiredPostings,
        message: `[DRY RUN] ${expiredPostings.length}개 공고 만료 처리 예정`
      };
    }

    // 실제 만료 처리
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'closed',
        closedAt: now,
        closedReason: 'expired',
        updatedAt: now
      });
    });

    await batch.commit();

    logger.info('수동 만료 처리 완료', {
      expiredCount: expiredPostings.length,
      userId: context.uid
    });

    return {
      success: true,
      expiredCount: expiredPostings.length,
      expiredPostings,
      message: `${expiredPostings.length}개 공고 만료 처리 완료`
    };
  } catch (error) {
    logger.error('수동 만료 처리 실패', error);
    throw error;
  }
};
