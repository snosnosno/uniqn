/**
 * 리뷰 생성 알림 Firebase Functions
 *
 * @description 리뷰가 생성되면 피평가자에게 FCM 푸시 알림 전송
 * @trigger Firestore onCreate
 * @collection reviews/{reviewId}
 * @version 1.0.0
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { createAndSendNotification } from "../utils/notificationUtils";
import { handleTriggerError } from "../errors/errorHandler";

/**
 * 리뷰 생성 알림 트리거
 *
 * @description
 * - 리뷰가 생성되면 피평가자에게 review_received 알림 전송
 * - 블라인드 정책: 알림에 리뷰 내용(sentiment, tags)을 포함하지 않음
 */
export const onReviewCreated = onDocumentCreated(
  { document: "reviews/{reviewId}", region: "asia-northeast3" },
  async (event) => {
    const reviewId = event.params.reviewId;
    const review = event.data?.data();
    if (!review) return;

    const revieweeId = review.revieweeId as string;
    const jobPostingTitle = (review.jobPostingTitle as string) || "근무";
    const reviewerType = review.reviewerType as string;

    logger.info("리뷰 생성 알림 시작", {
      reviewId,
      revieweeId,
      reviewerType,
    });

    try {
      const reviewerLabel = reviewerType === "employer" ? "구인자" : "스태프";

      await createAndSendNotification(
        revieweeId,
        "review_received",
        "📋 새로운 평가가 도착했습니다",
        `"${jobPostingTitle}" 근무에 대한 ${reviewerLabel} 평가가 등록되었습니다. 내 평가를 작성하면 확인할 수 있습니다.`,
        {
          link: `/reviews/${review.workLogId}`,
          data: {
            workLogId: review.workLogId as string,
            jobPostingId: review.jobPostingId as string,
            jobPostingTitle,
          },
        },
      );

      logger.info("리뷰 생성 알림 전송 완료", { reviewId, revieweeId });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: "리뷰 생성 알림 처리",
        context: { reviewId, revieweeId },
      });
    }
  },
);
