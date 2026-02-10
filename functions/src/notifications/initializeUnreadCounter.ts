/**
 * 미읽음 카운터 초기화 Callable Function
 *
 * @description 기존 사용자의 카운터 문서가 없을 때 실제 미읽음 수를 계산하여 초기화
 * @version 1.1.0
 *
 * @changelog
 * - 1.1.0: 트랜잭션으로 경쟁 조건 방지 (동시 요청 시 중복 초기화 방지)
 *
 * @note 앱 초기화 시 카운터 문서가 없으면 호출됨
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface InitializeUnreadCounterResult {
  unreadCount: number;
}

/** 중복 초기화 방지를 위한 최소 간격 (밀리초) */
const MIN_INIT_INTERVAL_MS = 10000; // 10초

/**
 * 미읽음 카운터 초기화
 *
 * @description 인증된 사용자의 실제 미읽음 알림 수를 계산하고 카운터 문서 생성
 *
 * @note 트랜잭션으로 동시 요청 시에도 중복 초기화 방지
 * @note 10초 내 중복 요청 무시 (debounce)
 *
 * @example
 * // 클라이언트에서:
 * const initCounter = httpsCallable(functions, 'initializeUnreadCounter');
 * const result = await initCounter();
 * console.log(result.data.unreadCount);
 */
export const initializeUnreadCounter = functions
  .region('asia-northeast3')
  .https.onCall(async (data, context): Promise<InitializeUnreadCounterResult> => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '로그인이 필요합니다.'
      );
    }

    const userId = context.auth.uid;

    try {
      const counterRef = db
        .collection('users')
        .doc(userId)
        .collection('counters')
        .doc('notifications');

      // 🆕 0. 먼저 기존 카운터 문서 확인 (중복 호출 방지)
      const existingCounter = await counterRef.get();
      if (existingCounter.exists) {
        const data = existingCounter.data();
        const existingCount = data?.unreadCount ?? 0;
        const initializedAt = data?.initializedAt?.toMillis?.() ?? 0;
        const now = Date.now();

        // 최근 초기화된 경우 기존 값 반환 (debounce)
        if (now - initializedAt < MIN_INIT_INTERVAL_MS) {
          functions.logger.info('카운터 초기화 debounce - 최근 초기화됨', {
            userId,
            existingCount,
            initializedAgo: now - initializedAt,
          });
          return { unreadCount: existingCount };
        }

        // 이미 존재하면 기존 값 반환
        functions.logger.info('카운터 문서 이미 존재', {
          userId,
          existingCount,
        });
        return { unreadCount: existingCount };
      }

      // 1. 먼저 미읽음 알림 수 계산 (트랜잭션 외부 - 집계 쿼리는 트랜잭션 불가)
      const notificationsRef = db.collection('notifications');
      const unreadQuery = notificationsRef
        .where('recipientId', '==', userId)
        .where('isRead', '==', false);

      const unreadSnapshot = await unreadQuery.count().get();
      const calculatedCount = unreadSnapshot.data().count;

      // 2. 트랜잭션으로 원자적 생성 (경쟁 조건 방지)
      const result = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        // 이미 존재하면 기존 값 반환 (다른 요청이 먼저 생성한 경우)
        if (counterDoc.exists) {
          const existingCount = counterDoc.data()?.unreadCount ?? 0;
          functions.logger.info('카운터 문서 이미 존재 (동시 요청)', {
            userId,
            existingCount,
            calculatedCount,
          });
          return { unreadCount: existingCount, created: false };
        }

        // 카운터 문서 생성
        transaction.set(counterRef, {
          unreadCount: calculatedCount,
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          initializedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { unreadCount: calculatedCount, created: true };
      });

      if (result.created) {
        functions.logger.info('미읽음 카운터 초기화 완료', {
          userId,
          unreadCount: result.unreadCount,
        });
      }

      return { unreadCount: result.unreadCount };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('미읽음 카운터 초기화 실패', {
        userId,
        error: errorMessage,
      });

      throw new functions.https.HttpsError(
        'internal',
        '카운터 초기화에 실패했습니다.'
      );
    }
  });
