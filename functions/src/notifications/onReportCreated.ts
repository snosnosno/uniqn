/**
 * 신고 접수 알림 Firebase Functions
 *
 * @description
 * 새로운 신고가 접수되면 모든 관리자에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onCreate
 * @collection reports/{reportId}
 * @version 1.0.0
 * @since 2025-02-01
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { handleTriggerError } from "../errors/errorHandler";
import {
  broadcastNotification,
  getAdminUserIds,
} from "../utils/notificationUtils";

// ============================================================================
// Types
// ============================================================================

interface ReportData {
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  type: string;
  description?: string;
  severity?: string;
  jobPostingId?: string;
  status: string;
}

// 신고 유형 라벨 매핑
const REPORT_TYPE_LABELS: Record<string, string> = {
  // 스태프 신고 (구인자 → 스태프)
  tardiness: "지각",
  negligence: "근무태만",
  no_show: "노쇼",
  early_leave: "무단 조퇴",
  inappropriate: "부적절한 행동",
  dress_code: "복장 불량",
  communication: "소통 문제",
  // 구인자 신고 (구직자 → 구인자)
  false_posting: "허위 공고",
  employer_negligence: "근무 관리 태만",
  unfair_treatment: "부당한 대우",
  inappropriate_behavior: "부적절한 행동",
  // 공통
  other: "기타",
};

// ============================================================================
// Helpers
// ============================================================================

function getReportTypeLabel(type: string): string {
  return REPORT_TYPE_LABELS[type] || type;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 신고 접수 알림 트리거
 *
 * @description
 * - 새로운 신고가 생성되면 실행
 * - 모든 관리자에게 알림 전송
 */
export const onReportCreated = onDocumentCreated(
  { document: "reports/{reportId}", region: "asia-northeast3" },
  async (event) => {
    const reportId = event.params.reportId;
    const report = event.data?.data() as ReportData | undefined;
    if (!report) return;

    logger.info("새로운 신고 접수", {
      reportId,
      reporterName: report.reporterName,
      targetName: report.targetName,
      type: report.type,
    });

    try {
      // 1. 모든 관리자 조회 (캐시 사용)
      const adminIds = await getAdminUserIds();

      if (adminIds.length === 0) {
        logger.warn("관리자가 없습니다");
        return;
      }

      logger.info("알림 대상 관리자 수", {
        count: adminIds.length,
      });

      // 2. 신고 유형 라벨 가져오기
      const reportTypeLabel = getReportTypeLabel(report.type);

      // 3. 알림 전송 (broadcastNotification 사용)
      const results = await broadcastNotification(
        adminIds,
        "new_report",
        "🚨 새로운 신고 접수",
        `${report.reporterName}님이 ${report.targetName}님을 신고했습니다. (${reportTypeLabel})`,
        {
          link: `/admin/reports/${reportId}`,
          priority: "high",
          data: {
            reportId,
            reportType: report.type,
            reporterName: report.reporterName,
            targetName: report.targetName,
            severity: report.severity || "medium",
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

      logger.info("신고 접수 알림 전송 완료", {
        reportId,
        totalAdmins: adminIds.length,
        successCount,
        failureCount,
      });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: "신고 접수 알림 처리",
        context: { reportId },
      });
    }
  },
);
