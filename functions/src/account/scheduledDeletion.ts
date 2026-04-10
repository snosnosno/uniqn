/**
 * 예약/강제 계정 삭제 처리
 *
 * 현재 source of truth는 users/{uid}.deletionRequest 이지만,
 * 과거 deletionRequests 서브컬렉션도 읽어 호환 처리한다.
 */

import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import {
  NotFoundError,
  handleFunctionError,
  handleTriggerError,
  requireAuth,
  requireRole,
  requireString,
} from "../errors";

const FIRESTORE_BATCH_LIMIT = 500;
const USER_COLLECTION = "users";
const APPLICATIONS_COLLECTION = "applications";
const WORK_LOGS_COLLECTION = "workLogs";
const NOTIFICATIONS_COLLECTION = "notifications";
const LEGACY_DELETION_REQUESTS_SUBCOLLECTION = "deletionRequests";
const PENDING_DELETION_STATUS = "pending";
const DEACTIVATED_USER_STATUS = "deactivated";
const DELETED_USER_ID = "[deleted]";
const DELETED_USER_NAME = "[탈퇴한 사용자]";
const USER_SUBCOLLECTIONS = [
  "consents",
  "consentHistory",
  LEGACY_DELETION_REQUESTS_SUBCOLLECTION,
  "loginNotifications",
  "securitySettings",
  "notificationSettings",
  "counters",
  "tournaments",
] as const;
const TOURNAMENT_SUBCOLLECTIONS = [
  "participants",
  "settings",
  "tables",
  "prizes",
  "shifts",
] as const;

type BatchOperation = (batch: admin.firestore.WriteBatch) => void;

interface DeletionTarget {
  userId: string;
  source: "embedded" | "legacy" | "manual";
  requestRef?: admin.firestore.DocumentReference;
}

function getEmbeddedDeletionRequest(
  userData: admin.firestore.DocumentData | undefined,
): admin.firestore.DocumentData | null {
  const deletionRequest = userData?.deletionRequest;
  return deletionRequest && typeof deletionRequest === "object"
    ? deletionRequest
    : null;
}

function isDuePendingDeletionRequest(
  requestData: admin.firestore.DocumentData | null | undefined,
  now: admin.firestore.Timestamp,
): boolean {
  if (!requestData || requestData.status !== PENDING_DELETION_STATUS) {
    return false;
  }

  const scheduledDeletionAt = requestData.scheduledDeletionAt;
  if (!(scheduledDeletionAt instanceof admin.firestore.Timestamp)) {
    return false;
  }

  return scheduledDeletionAt.toMillis() <= now.toMillis();
}

function resolveLegacyDeletionUserId(
  requestDoc: admin.firestore.QueryDocumentSnapshot,
): string | null {
  const rawUserId = requestDoc.get("userId");
  if (typeof rawUserId === "string" && rawUserId.trim().length > 0) {
    return rawUserId;
  }

  return requestDoc.ref.parent.parent?.id ?? null;
}

async function commitBatchOperations(
  operations: BatchOperation[],
): Promise<number> {
  if (operations.length === 0) {
    return 0;
  }

  const db = admin.firestore();
  let committedBatchCount = 0;

  for (let i = 0; i < operations.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = operations.slice(i, i + FIRESTORE_BATCH_LIMIT);

    chunk.forEach((operation) => operation(batch));
    await batch.commit();
    committedBatchCount++;
  }

  return committedBatchCount;
}

async function markNotificationsAsClientHandled(
  notificationDocs: readonly admin.firestore.QueryDocumentSnapshot[],
): Promise<number> {
  const operations = notificationDocs.map<BatchOperation>((notificationDoc) => {
    return (batch) => {
      batch.update(notificationDoc.ref, { _clientHandled: true });
    };
  });

  return commitBatchOperations(operations);
}

function queueDeleteOperations(
  docs: readonly admin.firestore.QueryDocumentSnapshot[],
  operations: BatchOperation[],
): void {
  docs.forEach((docSnapshot) => {
    operations.push((batch) => {
      batch.delete(docSnapshot.ref);
    });
  });
}

async function queueTournamentDeletionOperations(
  tournamentDocs: readonly admin.firestore.QueryDocumentSnapshot[],
  operations: BatchOperation[],
): Promise<void> {
  for (const tournamentDoc of tournamentDocs) {
    for (const subcollectionName of TOURNAMENT_SUBCOLLECTIONS) {
      const subcollectionSnapshot = await tournamentDoc.ref
        .collection(subcollectionName)
        .get();
      queueDeleteOperations(subcollectionSnapshot.docs, operations);
    }
  }
}

async function cleanupUserDataScopes(
  userId: string,
  options?: { preserveRequestRef?: admin.firestore.DocumentReference },
): Promise<{ operations: number; committedBatchCount: number }> {
  const db = admin.firestore();
  const operations: BatchOperation[] = [];
  const preserveRequestPath = options?.preserveRequestRef?.path ?? null;

  const applicationsSnapshot = await db
    .collection(APPLICATIONS_COLLECTION)
    .where("applicantId", "==", userId)
    .get();
  applicationsSnapshot.docs.forEach((docSnapshot) => {
    operations.push((batch) => {
      batch.update(docSnapshot.ref, {
        applicantId: DELETED_USER_ID,
        applicantName: DELETED_USER_NAME,
        applicantPhone: null,
      });
    });
  });

  const workLogsSnapshot = await db
    .collection(WORK_LOGS_COLLECTION)
    .where("staffId", "==", userId)
    .get();
  workLogsSnapshot.docs.forEach((docSnapshot) => {
    operations.push((batch) => {
      batch.update(docSnapshot.ref, {
        staffId: DELETED_USER_ID,
        staffName: DELETED_USER_NAME,
      });
    });
  });

  const notificationsSnapshot = await db
    .collection(NOTIFICATIONS_COLLECTION)
    .where("recipientId", "==", userId)
    .get();
  const notificationPreparationBatchCount =
    await markNotificationsAsClientHandled(notificationsSnapshot.docs);
  queueDeleteOperations(notificationsSnapshot.docs, operations);

  const userRef = db.collection(USER_COLLECTION).doc(userId);
  for (const subcollectionName of USER_SUBCOLLECTIONS) {
    const subcollectionSnapshot = await userRef
      .collection(subcollectionName)
      .get();
    if (subcollectionName === "tournaments") {
      await queueTournamentDeletionOperations(
        subcollectionSnapshot.docs,
        operations,
      );
    }

    subcollectionSnapshot.docs.forEach((docSnapshot) => {
      if (preserveRequestPath && docSnapshot.ref.path === preserveRequestPath) {
        return;
      }

      operations.push((batch) => {
        batch.delete(docSnapshot.ref);
      });
    });
  }

  const committedBatchCount =
    notificationPreparationBatchCount +
    (await commitBatchOperations(operations));

  logger.info("계정 연관 데이터 정리 완료", {
    userId,
    operations: operations.length,
    committedBatchCount,
    preservedRequestPath: preserveRequestPath,
  });

  return {
    operations: operations.length,
    committedBatchCount,
  };
}

async function deleteFirebaseAuthUser(userId: string): Promise<void> {
  try {
    await admin.auth().deleteUser(userId);
    logger.info(`Firebase Auth 계정 삭제 완료: ${userId}`);
  } catch (authError: unknown) {
    const authErrorCode =
      authError != null && typeof authError === "object" && "code" in authError
        ? (authError as { code: string }).code
        : undefined;

    if (authErrorCode !== "auth/user-not-found") {
      throw authError;
    }

    logger.warn(`Firebase Auth 계정이 이미 삭제됨: ${userId}`);
  }
}

async function permanentlyDeleteUserData(
  target: DeletionTarget,
): Promise<{ operations: number; committedBatchCount: number }> {
  const db = admin.firestore();

  // Keep the Firestore deletion source until every downstream cleanup succeeds.
  await deleteFirebaseAuthUser(target.userId);

  const cleanupResult = await cleanupUserDataScopes(target.userId, {
    preserveRequestRef: target.requestRef,
  });

  const finalizeBatch = db.batch();
  if (target.requestRef) {
    finalizeBatch.delete(target.requestRef);
  }
  finalizeBatch.delete(db.collection(USER_COLLECTION).doc(target.userId));
  await finalizeBatch.commit();

  return {
    operations: cleanupResult.operations + (target.requestRef ? 2 : 1),
    committedBatchCount: cleanupResult.committedBatchCount + 1,
  };
}

async function getDueDeletionTargets(
  now: admin.firestore.Timestamp,
): Promise<DeletionTarget[]> {
  const db = admin.firestore();
  const targetsByUserId = new Map<string, DeletionTarget>();
  const cachedUserDocs = new Map<string, admin.firestore.DocumentSnapshot>();

  const deactivatedUsersSnapshot = await db
    .collection(USER_COLLECTION)
    .where("status", "==", DEACTIVATED_USER_STATUS)
    .where("deletionRequest.status", "==", PENDING_DELETION_STATUS)
    .where("deletionRequest.scheduledDeletionAt", "<=", now)
    .get();

  deactivatedUsersSnapshot.docs.forEach((userDoc) => {
    targetsByUserId.set(userDoc.id, {
      userId: userDoc.id,
      source: "embedded",
    });
  });

  const legacyDeletionRequestsSnapshot = await db
    .collectionGroup(LEGACY_DELETION_REQUESTS_SUBCOLLECTION)
    .where("status", "==", PENDING_DELETION_STATUS)
    .where("scheduledDeletionAt", "<=", now)
    .get();

  for (const requestDoc of legacyDeletionRequestsSnapshot.docs) {
    const userId = resolveLegacyDeletionUserId(requestDoc);
    if (!userId || targetsByUserId.has(userId)) {
      continue;
    }

    let userDoc = cachedUserDocs.get(userId);
    if (!userDoc) {
      userDoc = await db.collection(USER_COLLECTION).doc(userId).get();
      cachedUserDocs.set(userId, userDoc);
    }

    if (userDoc.exists) {
      if (userDoc.get("status") !== DEACTIVATED_USER_STATUS) {
        continue;
      }

      const embeddedDeletionRequest = getEmbeddedDeletionRequest(
        userDoc.data(),
      );
      if (embeddedDeletionRequest) {
        if (isDuePendingDeletionRequest(embeddedDeletionRequest, now)) {
          targetsByUserId.set(userId, {
            userId,
            source: "embedded",
          });
        }
        continue;
      }
    }

    targetsByUserId.set(userId, {
      userId,
      source: "legacy",
      requestRef: requestDoc.ref,
    });
  }

  return [...targetsByUserId.values()];
}

async function recordDeletionFailure(
  target: DeletionTarget,
  error: unknown,
): Promise<void> {
  if (!target.requestRef) {
    return;
  }

  try {
    await target.requestRef.update({
      lastError: {
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
  } catch (updateError) {
    logger.warn("삭제 실패 상태 기록도 실패했습니다", {
      userId: target.userId,
      source: target.source,
      error:
        updateError instanceof Error
          ? updateError.message
          : String(updateError),
    });
  }
}

export const processScheduledDeletions = onSchedule(
  { schedule: "0 18 * * *", timeZone: "UTC", region: "asia-northeast3" },
  async () => {
    logger.info("예약 계정 삭제 작업 시작");

    try {
      const now = admin.firestore.Timestamp.now();
      const deletionTargets = await getDueDeletionTargets(now);

      if (deletionTargets.length === 0) {
        logger.info("처리할 계정 삭제 요청이 없습니다");
        return;
      }

      logger.info(`${deletionTargets.length}개의 계정 삭제 요청 발견`);

      const results = {
        processed: deletionTargets.length,
        succeeded: 0,
        failed: 0,
      };

      for (const target of deletionTargets) {
        try {
          logger.info(`계정 삭제 시작: ${target.userId}`, {
            source: target.source,
          });

          const cleanupResult = await permanentlyDeleteUserData(target);

          logger.info(`계정 삭제 완료: ${target.userId}`, {
            source: target.source,
            operations: cleanupResult.operations,
            committedBatchCount: cleanupResult.committedBatchCount,
          });
          results.succeeded++;
        } catch (error) {
          logger.error(`계정 삭제 실패: ${target.userId}`, error);
          results.failed++;
          await recordDeletionFailure(target, error);
        }
      }

      logger.info("예약 계정 삭제 작업 완료", results);
    } catch (error) {
      logger.error("예약 계정 삭제 작업 중 오류 발생", error);
      throw handleTriggerError(error, {
        operation: "processScheduledDeletions",
        context: { source: "scheduled-task" },
      });
    }
  },
);

export const forceDeleteAccount = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const db = admin.firestore();

      const adminUid = requireAuth(request);
      requireRole(request, "admin");

      const { userId, reason } = request.data;
      requireString(userId, "userId");

      logger.info(`관리자 강제 삭제 시작: ${userId}`, {
        adminUid,
        reason,
      });

      const userDoc = await db.collection(USER_COLLECTION).doc(userId).get();
      if (!userDoc.exists) {
        throw new NotFoundError({
          message: "User not found",
          metadata: { resource: "User", resourceId: userId },
        });
      }

      const cleanupResult = await permanentlyDeleteUserData({
        userId,
        source: "manual",
      });

      await db.collection("adminLogs").add({
        action: "force_delete_account",
        targetUserId: userId,
        adminUid,
        reason: reason || "No reason provided",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        cleanupOperations: cleanupResult.operations,
        cleanupBatches: cleanupResult.committedBatchCount,
      });

      logger.info(`관리자 강제 삭제 완료: ${userId}`);

      return {
        success: true,
        message: `Account ${userId} has been permanently deleted`,
      };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: "forceDeleteAccount",
        context: { userId: request.data?.userId },
      });
    }
  },
);
