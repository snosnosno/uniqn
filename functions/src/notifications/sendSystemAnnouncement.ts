/**
 * 시스템 공지사항 전송 Firebase Functions
 *
 * @description
 * 전체 사용자 대상 시스템 공지사항을 FCM 푸시 알림으로 일괄 전송하는 Functions
 *
 * @version 2.0.0
 * @since 2025-10-25
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음 (fcmTokens: string[] 배열만 사용)
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { extractAllFcmTokens, flattenTokens } from "../utils/fcmTokenUtils";
import { sendMulticast, updateUnreadCounter } from "../utils/notificationUtils";
import {
  requireAuth,
  requireRole,
  requireString,
  requireMaxLength,
  requireEnum,
} from "../errors/validators";
import { NotFoundError, handleFunctionError } from "../errors";

const db = admin.firestore();

/**
 * 시스템 공지사항 전송 요청 데이터
 */
interface SendSystemAnnouncementRequest {
  announcementId: string;
  title: string;
  content: string;
  priority: "normal" | "important" | "urgent";
}

/**
 * 시스템 공지사항 전송 응답 데이터
 */
interface SendSystemAnnouncementResponse {
  success: boolean;
  announcementId?: string;
  result?: {
    successCount: number;
    failedCount: number;
    totalUsers: number;
  };
  error?: string;
}

/**
 * 시스템 공지사항 전송 Cloud Function
 *
 * @description
 * - 권한 검증 (admin만 가능)
 * - 모든 활성 사용자 조회
 * - FCM 멀티캐스트 전송 (500명씩 배치 처리)
 * - Firestore 알림 문서 생성 (각 사용자별)
 * - 전송 결과 기록 및 반환
 */
export const sendSystemAnnouncement = onCall<SendSystemAnnouncementRequest>(
  { region: "asia-northeast3" },
  async (request): Promise<SendSystemAnnouncementResponse> => {
    logger.info("시스템 공지사항 전송 요청 수신", {
      data: request.data,
      userId: request.auth?.uid,
    });

    try {
      // 1. 인증 및 권한 검증
      requireAuth(request);
      requireRole(request, "admin");

      // 2. 입력 데이터 검증
      const announcementId = requireString(
        request.data.announcementId,
        "공지사항 ID",
      );
      const title = requireString(request.data.title, "공지 제목");
      requireMaxLength(title, 100, "공지 제목");

      const content = requireString(request.data.content, "공지 내용");
      requireMaxLength(content, 2000, "공지 내용");

      const priority = requireEnum(
        request.data.priority,
        ["normal", "important", "urgent"] as const,
        "우선순위",
      );

      const userId = request.auth!.uid;

      // 3. 공지사항 문서 확인
      const announcementDoc = await db
        .collection("systemAnnouncements")
        .doc(announcementId)
        .get();

      if (!announcementDoc.exists) {
        throw new NotFoundError({
          userMessage: "공지사항을 찾을 수 없습니다.",
          metadata: { announcementId },
        });
      }

      // 4. 모든 사용자 조회 (isActive 필드 없이 전체 조회)
      const usersSnapshot = await db.collection("users").get();

      const totalUsers = usersSnapshot.size;
      logger.info("전체 활성 사용자 조회 완료", { totalUsers });

      if (totalUsers === 0) {
        logger.warn("활성 사용자가 없습니다.");

        await db
          .collection("systemAnnouncements")
          .doc(announcementId)
          .update({
            sendResult: {
              successCount: 0,
              failedCount: 0,
              totalUsers: 0,
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          });

        return {
          success: false,
          announcementId,
          error: "활성 사용자가 없습니다.",
        };
      }

      // 5. FCM 토큰 수집 (fcmTokens: string[] 배열만 사용)
      const usersData = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data(),
      }));

      const userTokensMap = extractAllFcmTokens(usersData);
      const allTokens = flattenTokens(userTokensMap);

      logger.info("FCM 토큰 조회 완료", {
        totalUsers,
        usersWithTokens: userTokensMap.size,
        totalTokens: allTokens.length,
      });

      // 6. FCM 멀티캐스트 전송 (최대 500개씩 배치)
      // 토큰 → 사용자 ID 역매핑 (한 사용자가 여러 토큰 가질 수 있음)
      const tokenToUserMap = new Map<string, string>();
      for (const [userId, tokens] of userTokensMap.entries()) {
        for (const token of tokens) {
          tokenToUserMap.set(token, userId);
        }
      }

      const allUserIds = Array.from(userTokensMap.keys());
      const successUserIds = new Set<string>();
      const failedUserIds = new Set<string>();
      const errors: Array<{ userId: string; error: string }> = [];

      if (allTokens.length === 0) {
        logger.warn("FCM 토큰이 있는 사용자가 없습니다.");

        // 토큰이 없는 사용자에게도 알림 문서는 생성 (앱 내 확인 가능)
        const FIRESTORE_BATCH_LIMIT = 500;
        const allDocs = usersSnapshot.docs;

        for (let i = 0; i < allDocs.length; i += FIRESTORE_BATCH_LIMIT) {
          const batchDocs = allDocs.slice(i, i + FIRESTORE_BATCH_LIMIT);
          const notificationBatch = db.batch();

          batchDocs.forEach((doc) => {
            const notificationRef = db.collection("notifications").doc();
            notificationBatch.set(notificationRef, {
              id: notificationRef.id,
              recipientId: doc.id,
              type: "announcement",
              category: "system",
              priority:
                priority === "urgent"
                  ? "urgent"
                  : priority === "important"
                    ? "high"
                    : "normal",
              title: `📢 ${title}`,
              body:
                content.length > 200
                  ? content.substring(0, 200) + "..."
                  : content,
              link: "/announcements",
              data: {
                type: "announcement",
                announcementId,
              },
              relatedId: announcementId,
              senderId: userId,
              isRead: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          await notificationBatch.commit();

          // 카운터 증가 (배치 후)
          await Promise.all(
            batchDocs.map((doc) =>
              updateUnreadCounter(doc.id, 1).catch(() => {
                // 에러는 updateUnreadCounter 내부에서 로깅 및 기록됨
              }),
            ),
          );
        }

        await db
          .collection("systemAnnouncements")
          .doc(announcementId)
          .update({
            sendResult: {
              successCount: 0,
              failedCount: 0,
              totalUsers: totalUsers,
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          });

        return {
          success: true,
          announcementId,
          result: {
            successCount: 0,
            failedCount: 0,
            totalUsers: totalUsers,
          },
        };
      }

      // sendMulticast()로 일괄 전송 (Expo/FCM 하이브리드)
      // @note 의도적 설계: 시스템 공지는 사용자별 알림설정(카테고리 비활성화) 무시하여 전원 수신
      // @note 만료 토큰 정리는 cleanupExpiredTokensScheduled (스케줄 함수)에서 일괄 처리
      const multicastResult = await sendMulticast(allTokens, {
        title: `📢 ${title}`,
        body:
          content.length > 200 ? content.substring(0, 200) + "..." : content,
        data: {
          type: "announcement",
          announcementId,
          priority,
          target: "/notices",
        },
        channelId: "announcements",
        priority:
          priority === "urgent"
            ? "urgent"
            : priority === "important"
              ? "high"
              : "normal",
      });

      // 전송 결과 처리 (토큰 → 사용자 역매핑)
      multicastResult.responses.forEach((resp, idx) => {
        const token = allTokens[idx];
        const userIdForToken = tokenToUserMap.get(token);

        if (!userIdForToken) return;

        if (resp.success) {
          successUserIds.add(userIdForToken);
        } else {
          failedUserIds.add(userIdForToken);
          errors.push({
            userId: userIdForToken,
            error: resp.error || "알 수 없는 오류",
          });
        }
      });

      // 7. 각 사용자에게 알림 문서 생성 (배치 500개 제한 고려)
      const FIRESTORE_BATCH_LIMIT = 500;

      for (let i = 0; i < allUserIds.length; i += FIRESTORE_BATCH_LIMIT) {
        const batchUserIds = allUserIds.slice(i, i + FIRESTORE_BATCH_LIMIT);
        const notificationBatch = db.batch();

        batchUserIds.forEach((uid) => {
          const notificationRef = db.collection("notifications").doc();
          const isSent = successUserIds.has(uid);

          notificationBatch.set(notificationRef, {
            id: notificationRef.id,
            recipientId: uid,
            type: "announcement",
            category: "system",
            priority:
              priority === "urgent"
                ? "urgent"
                : priority === "important"
                  ? "high"
                  : "normal",
            title: `📢 ${title}`,
            body:
              content.length > 200
                ? content.substring(0, 200) + "..."
                : content,
            link: "/announcements",
            data: {
              type: "announcement",
              announcementId,
            },
            relatedId: announcementId,
            senderId: userId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(isSent && {
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
            }),
          });
        });

        await notificationBatch.commit();

        // 카운터 증가 (배치 후)
        await Promise.all(
          batchUserIds.map((uid) =>
            updateUnreadCounter(uid, 1).catch(() => {
              // 에러는 updateUnreadCounter 내부에서 로깅 및 기록됨
            }),
          ),
        );
      }

      // 8. 공지사항 문서 업데이트
      const sendResult = {
        successCount: successUserIds.size,
        failedCount: failedUserIds.size,
        totalUsers: totalUsers,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("systemAnnouncements").doc(announcementId).update({
        sendResult,
      });

      logger.info("시스템 공지사항 전송 완료", {
        announcementId,
        successCount: successUserIds.size,
        failedCount: failedUserIds.size,
        totalUsers,
      });

      return {
        success: true,
        announcementId,
        result: {
          successCount: successUserIds.size,
          failedCount: failedUserIds.size,
          totalUsers,
        },
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: "sendSystemAnnouncement",
        context: { announcementId: request.data?.announcementId },
      });
    }
  },
);
