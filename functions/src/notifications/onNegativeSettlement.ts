/**
 * 음수 정산 관리자 알림 Firebase Functions
 *
 * @description
 * 정산 금액이 음수(공제 > 세후급여)인 경우 관리자에게 알림 전송
 *
 * @trigger Firestore onDocumentUpdated
 * @collection workLogs/{workLogId}
 * @version 1.0.0
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { handleTriggerError } from "../errors/errorHandler";
import {
  broadcastNotification,
  getAdminUserIds,
} from "../utils/notificationUtils";

// ============================================================================
// Types
// ============================================================================

interface WorkLogData {
  staffId?: string;
  staffName?: string;
  jobPostingId?: string;
  jobPostingTitle?: string;
  date?: string;
  _negativeSettlementDetected?: boolean;
  _negativeSettlementAmount?: number;
}

// ============================================================================
// Trigger
// ============================================================================

/**
 * 음수 정산 감지 알림 트리거
 *
 * @description
 * - workLogs 문서의 _negativeSettlementDetected가 true로 변경되면 실행
 * - 모든 관리자에게 알림 전송
 */
export const onNegativeSettlement = onDocumentUpdated(
  { document: "workLogs/{workLogId}", region: "asia-northeast3" },
  async (event) => {
    const workLogId = event.params.workLogId;
    const before = event.data?.before.data() as WorkLogData | undefined;
    const after = event.data?.after.data() as WorkLogData | undefined;

    if (!after) return;

    // _negativeSettlementDetected가 false→true로 전환된 경우만 처리
    if (!after._negativeSettlementDetected || before?._negativeSettlementDetected) {
      return;
    }

    logger.info("음수 정산 감지", {
      workLogId,
      amount: after._negativeSettlementAmount,
      staffName: after.staffName,
      jobPostingTitle: after.jobPostingTitle,
    });

    try {
      // 1. 모든 관리자 조회 (캐시 사용)
      const adminIds = await getAdminUserIds();

      if (adminIds.length === 0) {
        logger.warn("관리자가 없습니다");
        return;
      }

      // 2. 금액 포맷팅
      const amount = after._negativeSettlementAmount ?? 0;
      const formattedAmount = Math.abs(amount).toLocaleString("ko-KR");

      // 3. 알림 전송
      const staffName = after.staffName || "알 수 없음";
      const jobTitle = after.jobPostingTitle || "알 수 없음";

      const results = await broadcastNotification(
        adminIds,
        "negative_settlement_alert",
        "⚠️ 음수 정산 경고",
        `${staffName}님의 정산 금액이 -${formattedAmount}원입니다. (${jobTitle})`,
        {
          priority: "urgent",
          data: {
            workLogId,
            staffId: after.staffId || "",
            jobPostingId: after.jobPostingId || "",
            amount: String(amount),
          },
        },
      );

      // 4. 결과 로깅
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result) => {
        if (result.fcmSent) {
          successCount++;
        } else {
          failureCount++;
        }
      });

      logger.info("음수 정산 알림 전송 완료", {
        workLogId,
        totalAdmins: adminIds.length,
        successCount,
        failureCount,
      });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: "음수 정산 알림 처리",
        context: { workLogId },
      });
    }
  },
);
