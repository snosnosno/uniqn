/**
 * 만료 FCM 토큰 정리 Scheduled Function
 *
 * 매일 실행되어 30일 이상 갱신되지 않은 FCM 토큰을 삭제합니다.
 * fcmTokens Map 구조에서 lastRefreshedAt 기준으로 판단
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { FcmTokenRecord } from '../utils/fcmTokenUtils';

const db = admin.firestore();

const TOKEN_EXPIRY_DAYS = 30;
const BATCH_SIZE = 100;
const MAX_BATCH_OPS = 450; // Firestore 500 limit에 여유분

/**
 * Cloud Scheduler: 매일 03:00 (Asia/Seoul) 실행
 * onSchedule() 사용 → firebase deploy 시 Cloud Scheduler 자동 생성
 */
export const cleanupExpiredTokensScheduled = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  async () => {
    logger.info('만료 FCM 토큰 정리 시작');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TOKEN_EXPIRY_DAYS);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    let totalRemoved = 0;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

    // 배치 처리 (BATCH_SIZE명씩)
    while (true) {
      let queryRef: admin.firestore.Query = db.collection('users')
        .limit(BATCH_SIZE);

      if (lastDoc) {
        queryRef = queryRef.startAfter(lastDoc);
      }

      const snapshot = await queryRef.get();

      if (snapshot.empty) {
        break;
      }

      let batch = db.batch();
      let batchOps = 0;

      for (const userDoc of snapshot.docs) {
        try {
          const fcmTokens = (userDoc.data().fcmTokens ?? {}) as Record<string, FcmTokenRecord>;

          if (typeof fcmTokens !== 'object' || Object.keys(fcmTokens).length === 0) {
            continue;
          }

          const expiredKeys: string[] = [];
          for (const [key, record] of Object.entries(fcmTokens)) {
            if (!record?.lastRefreshedAt) {
              expiredKeys.push(key);
              continue;
            }

            try {
              let refreshedAt: admin.firestore.Timestamp;
              if (record.lastRefreshedAt instanceof admin.firestore.Timestamp) {
                refreshedAt = record.lastRefreshedAt;
              } else if (typeof record.lastRefreshedAt === 'string' || typeof record.lastRefreshedAt === 'number') {
                refreshedAt = admin.firestore.Timestamp.fromDate(new Date(record.lastRefreshedAt));
              } else {
                // 알 수 없는 타입 → 만료 처리
                expiredKeys.push(key);
                continue;
              }

              if (refreshedAt.toMillis() < cutoffTimestamp.toMillis()) {
                expiredKeys.push(key);
              }
            } catch {
              // 유효하지 않은 timestamp → 만료 처리
              expiredKeys.push(key);
            }
          }

          if (expiredKeys.length > 0) {
            const updateData: Record<string, admin.firestore.FieldValue> = {};
            for (const key of expiredKeys) {
              updateData[`fcmTokens.${key}`] = admin.firestore.FieldValue.delete();
            }
            batch.update(userDoc.ref, updateData);
            batchOps++;
            totalRemoved += expiredKeys.length;

            // Firestore batch 500 제한 준수
            if (batchOps >= MAX_BATCH_OPS) {
              await batch.commit();
              batch = db.batch();
              batchOps = 0;
            }
          }
        } catch (userError) {
          logger.error('사용자 토큰 정리 실패 - 스킵', {
            userId: userDoc.id,
            error: (userError as Error).message,
          });
          continue;
        }
      }

      if (batchOps > 0) {
        await batch.commit();
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.size < BATCH_SIZE) {
        break;
      }
    }

    logger.info('만료 FCM 토큰 정리 완료', { totalRemoved });
  });
