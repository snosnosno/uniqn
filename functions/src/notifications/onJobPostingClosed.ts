/**
 * 공고 마감 알림 Firebase Functions
 *
 * @description
 * 공고 상태가 closed로 변경되면 해당 공고에 지원한 지원자들에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onUpdate
 * @collection jobPostings/{jobPostingId}
 * @version 2.0.0
 * @since 2025-02-01
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { STATUS } from "../constants/status";
import { handleTriggerError } from "../errors";
import { notifyApplicantsForJobPostingChange } from "./jobPostingNotificationHelper";
import { type JobPostingLocationInput } from "../utils/jobPosting";

interface JobPostingData {
  title?: string;
  location?: JobPostingLocationInput;
  status?: string;
  createdBy?: string;
}

/**
 * 공고 마감 알림 트리거
 *
 * @description
 * - 공고 status가 'closed'로 변경되면 실행
 * - confirmed, pending, applied 상태의 지원자들에게 broadcastNotification으로 일괄 알림
 */
export const onJobPostingClosed = onDocumentUpdated(
  { document: "jobPostings/{jobPostingId}", region: "asia-northeast3" },
  async (event) => {
    const jobPostingId = event.params.jobPostingId;
    const before = event.data?.before.data() as JobPostingData | undefined;
    const after = event.data?.after.data() as JobPostingData | undefined;
    if (!before || !after) return;

    if (
      before.status === after.status ||
      after.status !== STATUS.JOB_POSTING.CLOSED
    ) {
      return;
    }

    logger.info("공고 마감 감지", {
      jobPostingId,
      beforeStatus: before.status,
      afterStatus: after.status,
    });

    try {
      await notifyApplicantsForJobPostingChange(
        jobPostingId,
        {
          type: "job_closed",
          title: "📋 공고 마감 안내",
          body: `'${after.title || "공고"}'가 마감되었습니다.`,
          options: {
            link: `/jobs/${jobPostingId}`,
            data: {
              jobPostingId,
              jobPostingTitle: after.title || "",
            },
          },
        },
        "공고 마감",
      );
    } catch (error) {
      handleTriggerError(error, {
        operation: "onJobPostingClosed",
        context: { jobPostingId },
      });
    }
  },
);
