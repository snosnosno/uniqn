/**
 * 공고 수정 알림 Firebase Functions
 *
 * @description
 * 공고 주요 필드가 수정되면 해당 공고에 지원한 지원자들에게 FCM 푸시 알림 전송
 * - 알림 대상 필드: title, location, workDate, startTime, endTime, hourlyRate
 * - 알림 대상: confirmed, pending 상태의 지원자
 *
 * @trigger Firestore onUpdate
 * @collection jobPostings/{jobPostingId}
 * @version 3.0.0
 * @since 2025-01-18
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { notifyApplicantsForJobPostingChange } from "./jobPostingNotificationHelper";
import { getChangedJobPostingNotificationFields } from "../utils/jobPosting";

/**
 * 공고 수정 알림 트리거
 *
 * @description
 * - 공고 주요 필드 변경 감지
 * - 해당 공고에 지원한 지원자들에게 broadcastNotification으로 일괄 알림
 */
export const onJobPostingUpdated = onDocumentUpdated(
  { document: "jobPostings/{jobPostingId}", region: "asia-northeast3" },
  async (event) => {
    const jobPostingId = event.params.jobPostingId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const changedFields = getChangedJobPostingNotificationFields(before, after);

    if (changedFields.length === 0) {
      return;
    }

    logger.info("공고 수정 감지", {
      jobPostingId,
      changedFields,
    });

    try {
      await notifyApplicantsForJobPostingChange(
        jobPostingId,
        {
          type: "job_updated",
          title: "📝 공고 수정 안내",
          body: `'${after.title || "공고"}' 공고가 수정되었습니다. 변경 내용을 확인하세요.`,
          options: {
            link: `/jobs/${jobPostingId}`,
            data: {
              jobPostingId,
              jobPostingTitle: after.title || "",
              changedFields: changedFields.join(", "),
            },
          },
        },
        "공고 수정",
      );
    } catch (error) {
      logger.error("공고 수정 알림 처리 중 오류 발생", {
        jobPostingId,
        error: error instanceof Error ? error.stack : String(error),
      });
    }
  },
);
