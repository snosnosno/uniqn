/**
 * 만료된 pendingVerifications 문서 정리 Scheduled Function
 *
 * 매시간 실행되어 expiresAt이 지난 문서를 삭제합니다.
 * TTL: 30분 (verifyIdentity에서 설정)
 *
 * pubsub.schedule() 사용 → firebase deploy 시 Cloud Scheduler 자동 생성
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

const BATCH_SIZE = 400; // Firestore 500 limit에 여유분

/**
 * 매시간 정각 실행 (Asia/Seoul)
 * Cloud Scheduler + Pub/Sub 토픽이 배포 시 자동 생성됨
 */
export const cleanupPendingVerificationsScheduled = onSchedule(
  { schedule: "0 * * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    logger.info("만료 pendingVerifications 정리 시작");

    const now = new Date();
    let totalDeleted = 0;

    const expiredDocs = await db
      .collection("pendingVerifications")
      .where("expiresAt", "<", now)
      .limit(BATCH_SIZE)
      .get();

    if (expiredDocs.empty) {
      logger.info("만료된 pendingVerifications 없음");
      return;
    }

    const batch = db.batch();

    for (const doc of expiredDocs.docs) {
      batch.delete(doc.ref);
      totalDeleted++;
    }

    await batch.commit();

    logger.info("만료 pendingVerifications 정리 완료", {
      totalDeleted,
    });
  }
);
