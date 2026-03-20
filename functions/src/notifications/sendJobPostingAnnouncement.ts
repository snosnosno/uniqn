/**
 * 구인공고 공지 전송 Firebase Functions
 *
 * @description
 * 각 공고마다 확정된 스태프들에게 FCM 푸시 알림을 일괄 전송하는 Functions
 *
 * @version 2.0.0
 * @since 2025-09-30
 *
 * @note 개발 단계이므로 레거시 호환 코드 없음 (fcmTokens: string[] 배열만 사용)
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { extractAllFcmTokens, flattenTokens } from "../utils/fcmTokenUtils";
import { sendMulticast, updateUnreadCounter } from "../utils/notificationUtils";
import { formatJobPostingLocation } from "../utils/jobPosting";
import {
  requireAuth,
  requireRole,
  requireString,
  requireMaxLength,
} from "../errors/validators";
import {
  NotFoundError,
  ValidationError,
  handleFunctionError,
  ERROR_CODES,
} from "../errors";

const db = admin.firestore();

/**
 * 공지 전송 요청 데이터
 */
interface SendAnnouncementRequest {
  eventId: string; // 이벤트 ID (공고 ID)
  title: string;
  message: string; // 클라이언트에서 전달되는 필드명
  targetStaffIds: string[];
  jobPostingTitle?: string; // 공고 제목 (알림 제목 prefix용)
}

/**
 * 공지 전송 응답 데이터
 */
interface SendAnnouncementResponse {
  success: boolean;
  announcementId?: string;
  result?: {
    successIds: string[];
    failedIds: string[];
    successCount: number;
    failedCount: number;
    errors?: Array<{ userId: string; error: string }>;
  };
  error?: string;
}

/**
 * 공지 전송 Cloud Function
 *
 * @description
 * - 권한 검증 (admin, employer만 가능)
 * - 스태프 FCM 토큰 조회
 * - FCM 멀티캐스트 전송
 * - Firestore 알림 문서 생성
 * - 전송 결과 반환
 */
export const sendJobPostingAnnouncement = onCall<SendAnnouncementRequest>(
  { region: "asia-northeast3" },
  async (request): Promise<SendAnnouncementResponse> => {
    logger.info("공지 전송 요청 수신", {
      data: request.data,
      userId: request.auth?.uid,
    });

    try {
      // 1. 인증 및 권한 검증
      const userId = requireAuth(request);
      requireRole(request, "admin", "employer");

      // 2. 입력 데이터 검증
      const eventId = requireString(request.data.eventId, "이벤트 ID");
      const title = requireString(request.data.title, "공지 제목");
      requireMaxLength(title, 50, "공지 제목");

      const announcementMessage = requireString(
        request.data.message,
        "공지 내용",
      );
      requireMaxLength(announcementMessage, 500, "공지 내용");

      const targetStaffIds = request.data.targetStaffIds;
      if (!Array.isArray(targetStaffIds) || targetStaffIds.length === 0) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: "대상 스태프가 필요합니다.",
          field: "targetStaffIds",
        });
      }

      const jobPostingTitle = request.data.jobPostingTitle;

      // 3. 공고 정보 조회
      const jobPostingDoc = await db
        .collection("jobPostings")
        .doc(eventId)
        .get();

      if (!jobPostingDoc.exists) {
        throw new NotFoundError({
          userMessage: "공고를 찾을 수 없습니다.",
          metadata: { eventId },
        });
      }

      const jobPosting = jobPostingDoc.data();

      // 공고 제목으로 알림 제목 prefix 생성
      const actualJobPostingTitle =
        jobPostingTitle || jobPosting?.title || "공고";
      const notificationTitle = `[${actualJobPostingTitle}] ${title}`;

      // 4. 발신자 정보 조회
      const senderDoc = await db.collection("users").doc(userId).get();
      const senderName = senderDoc.data()?.name || "관리자";

      // 5. 공지 문서 생성
      const announcementRef = db.collection("jobPostingAnnouncements").doc();
      const announcementId = announcementRef.id;

      const announcementData = {
        id: announcementId,
        eventId,
        title,
        message: announcementMessage,
        createdBy: userId,
        createdByName: senderName,
        targetStaffIds,
        sentCount: 0,
        failedCount: 0,
        status: "sending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          jobPostingTitle: jobPosting?.title || "공고",
          location: formatJobPostingLocation(jobPosting?.location),
        },
      };

      await announcementRef.set(announcementData);

      // 6. 스태프 FCM 토큰 조회 (배치 처리, fcmTokens: string[] 배열만 사용)
      const allUsersData: Array<{
        id: string;
        data: FirebaseFirestore.DocumentData | undefined;
      }> = [];
      const chunkSize = 10; // Firestore in 쿼리 제한

      for (let i = 0; i < targetStaffIds.length; i += chunkSize) {
        const chunk = targetStaffIds.slice(i, i + chunkSize);
        const usersSnapshot = await db
          .collection("users")
          .where("__name__", "in", chunk)
          .get();

        usersSnapshot.docs.forEach((doc) => {
          allUsersData.push({ id: doc.id, data: doc.data() });
        });
      }

      const staffTokensMap = extractAllFcmTokens(allUsersData);
      const allTokens = flattenTokens(staffTokensMap);

      // 토큰 → 사용자 ID 역매핑
      const tokenToUserMap = new Map<string, string>();
      for (const [userId, tokens] of staffTokensMap.entries()) {
        for (const token of tokens) {
          tokenToUserMap.set(token, userId);
        }
      }

      logger.info("FCM 토큰 조회 완료", {
        totalStaff: targetStaffIds.length,
        usersWithTokens: staffTokensMap.size,
        totalTokens: allTokens.length,
      });

      // 7. FCM 멀티캐스트 전송 (최대 500개씩 배치)
      const successUserIds = new Set<string>();
      const failedUserIds = new Set<string>();
      const errors: Array<{ userId: string; error: string }> = [];

      if (allTokens.length === 0) {
        logger.warn("FCM 토큰이 없는 스태프만 있습니다.");

        await announcementRef.update({
          status: "failed",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          failedCount: targetStaffIds.length,
        });

        return {
          success: false,
          announcementId,
          error: "FCM 토큰이 있는 스태프가 없습니다.",
        };
      }

      // sendMulticast()로 일괄 전송 (Expo/FCM 하이브리드)
      // @note 의도적 설계: 공지사항은 사용자별 알림설정(카테고리 비활성화) 무시하여 전원 수신
      // @note 만료 토큰 정리는 cleanupExpiredTokensScheduled (스케줄 함수)에서 일괄 처리
      const multicastResult = await sendMulticast(allTokens, {
        title: `📢 ${notificationTitle}`,
        body: announcementMessage,
        data: {
          type: "announcement",
          announcementId,
          eventId,
          link: `/jobs/${eventId}`,
        },
        channelId: "announcements",
        priority: "high",
      });

      // 전송 결과 처리 (토큰 → 사용자 역매핑)
      multicastResult.responses.forEach((resp, idx) => {
        const token = allTokens[idx];
        const staffId = tokenToUserMap.get(token);

        if (!staffId) return;

        if (resp.success) {
          successUserIds.add(staffId);
        } else {
          failedUserIds.add(staffId);
          errors.push({
            userId: staffId,
            error: resp.error || "알 수 없는 오류",
          });
        }
      });

      // Set을 Array로 변환
      const successIds = Array.from(successUserIds);
      const failedIds = Array.from(failedUserIds);

      // 8. 각 스태프에게 알림 문서 생성 (배치 500개 제한 고려)
      const FIRESTORE_BATCH_LIMIT = 500;

      for (let i = 0; i < successIds.length; i += FIRESTORE_BATCH_LIMIT) {
        const batchIds = successIds.slice(i, i + FIRESTORE_BATCH_LIMIT);
        const notificationBatch = db.batch();

        batchIds.forEach((staffId) => {
          const notificationRef = db.collection("notifications").doc();
          notificationBatch.set(notificationRef, {
            id: notificationRef.id,
            recipientId: staffId,
            type: "announcement",
            category: "system",
            priority: "high",
            title: `📢 ${notificationTitle}`,
            body: announcementMessage,
            link: `/jobs/${eventId}`,
            data: {
              type: "announcement",
              announcementId,
              eventId,
            },
            relatedId: announcementId,
            senderId: userId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await notificationBatch.commit();

        // 카운터 증가 (배치 후)
        await Promise.all(
          batchIds.map((staffId) =>
            updateUnreadCounter(staffId, 1).catch(() => {
              // 에러는 updateUnreadCounter 내부에서 로깅 및 기록됨
            }),
          ),
        );
      }

      // 9. 공지 문서 업데이트
      const sendResult: {
        successIds: string[];
        failedIds: string[];
        successCount: number;
        failedCount: number;
        errors?: Array<{ userId: string; error: string }>;
      } = {
        successIds,
        failedIds,
        successCount: successIds.length,
        failedCount: failedIds.length,
      };

      // errors가 있을 때만 필드 추가
      if (errors.length > 0) {
        sendResult.errors = errors;
      }

      await announcementRef.update({
        status: successIds.length > 0 ? "sent" : "failed",
        sentCount: successIds.length,
        failedCount: failedIds.length,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sendResult,
      });

      logger.info("공지 전송 완료", {
        announcementId,
        successCount: successIds.length,
        failedCount: failedIds.length,
      });

      return {
        success: true,
        announcementId,
        result: sendResult,
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: "sendJobPostingAnnouncement",
        context: { eventId: request.data?.eventId },
      });
    }
  },
);
