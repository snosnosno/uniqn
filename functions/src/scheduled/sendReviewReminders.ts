/**
 * 평가 리마인더 Scheduled Function
 *
 * @description 매일 10:00 KST에 실행. 5일 전(D-2) 완료된 workLog 중
 * 미작성 평가가 있는 사용자에게 리마인더 알림 전송
 * @version 1.0.0
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { createAndSendNotification } from "../utils/notificationUtils";
import { handleTriggerError } from "../errors/errorHandler";

const db = admin.firestore();

/** 리마인더 대상: 완료 후 5일 경과 (D-2) */
const REMINDER_DAYS_AFTER = 5;

/**
 * Cloud Scheduler: 매일 10:00 (Asia/Seoul) 실행
 *
 * 1. 5일 전 checkOutTime이 설정된 workLog 조회
 * 2. 결정적 ID로 reviews/{workLogId}_staff, reviews/{workLogId}_employer 존재 확인
 * 3. 미작성 측에게 review_reminder 알림 전송
 */
export const sendReviewRemindersScheduled = onSchedule(
  { schedule: "0 1 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    logger.info("평가 리마인더 스케줄 시작");

    try {
      // D-2 기준 날짜 범위 (5일 전 00:00 ~ 23:59)
      const now = new Date();
      const targetStart = new Date(now);
      targetStart.setDate(now.getDate() - REMINDER_DAYS_AFTER);
      targetStart.setHours(0, 0, 0, 0);

      const targetEnd = new Date(targetStart);
      targetEnd.setHours(23, 59, 59, 999);

      const startTimestamp = admin.firestore.Timestamp.fromDate(targetStart);
      const endTimestamp = admin.firestore.Timestamp.fromDate(targetEnd);

      // 5일 전 퇴근한 workLog 조회
      const workLogsSnap = await db
        .collection("workLogs")
        .where("checkOutTime", ">=", startTimestamp)
        .where("checkOutTime", "<=", endTimestamp)
        .get();

      if (workLogsSnap.empty) {
        logger.info("리마인더 대상 workLog 없음");
        return;
      }

      logger.info(`리마인더 대상 workLog ${workLogsSnap.size}건`);

      // 1. 배치로 jobPosting 조회 (N+1 방지)
      const uniqueJobPostingIds = [...new Set(
        workLogsSnap.docs.map((d) => d.data().jobPostingId as string),
      )];
      const jobPostingRefs = uniqueJobPostingIds.map((id) =>
        db.collection("jobPostings").doc(id),
      );
      const jobPostingSnaps = await db.getAll(...jobPostingRefs);
      const jobPostingMap = new Map(
        jobPostingSnaps
          .filter((s) => s.exists)
          .map((s) => [s.id, s.data() as { title?: string; ownerId?: string; createdBy?: string }]),
      );

      // 2. 배치로 리뷰 존재 확인 (workLog당 2건 → 전체 한 번에)
      const reviewRefs = workLogsSnap.docs.flatMap((d) => [
        db.collection("reviews").doc(`${d.id}_staff`),
        db.collection("reviews").doc(`${d.id}_employer`),
      ]);
      const reviewSnaps = await db.getAll(...reviewRefs);
      const reviewExistsSet = new Set(
        reviewSnaps.filter((s) => s.exists).map((s) => s.id),
      );

      // 3. 알림 전송
      let sentCount = 0;

      for (const workLogDoc of workLogsSnap.docs) {
        const workLogId = workLogDoc.id;
        const wl = workLogDoc.data();
        const staffId = wl.staffId as string;
        const jobPostingId = wl.jobPostingId as string;

        const jobData = jobPostingMap.get(jobPostingId);
        const jobTitle = jobData?.title || "근무";
        const employerId = (jobData?.ownerId ?? jobData?.createdBy) as string | undefined;

        // 스태프 리뷰 미작성 → 스태프에게 리마인더
        if (!reviewExistsSet.has(`${workLogId}_staff`) && staffId) {
          await createAndSendNotification(
            staffId,
            "review_reminder",
            "⏰ 평가 마감이 다가옵니다",
            `"${jobTitle}" 근무 평가 마감이 2일 남았습니다. 지금 평가를 작성해주세요.`,
            {
              link: `/reviews/${workLogId}`,
              data: { workLogId, jobPostingTitle: jobTitle },
            },
          );
          sentCount++;
        }

        // 구인자 리뷰 미작성 → 구인자에게 리마인더
        if (!reviewExistsSet.has(`${workLogId}_employer`) && employerId) {
          await createAndSendNotification(
            employerId,
            "review_reminder",
            "⏰ 평가 마감이 다가옵니다",
            `"${jobTitle}" 근무 평가 마감이 2일 남았습니다. 지금 평가를 작성해주세요.`,
            {
              link: `/reviews/${workLogId}`,
              data: { workLogId, jobPostingTitle: jobTitle },
            },
          );
          sentCount++;
        }
      }

      logger.info(`평가 리마인더 전송 완료: ${sentCount}건`);
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: "평가 리마인더 처리",
      });
    }
  },
);
