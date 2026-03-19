import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  broadcastNotification,
  type CreateNotificationOptions,
  type NotificationResult,
  type NotificationType,
} from "../utils/notificationUtils";

const NOTIFIABLE_APPLICATION_STATUSES = [
  "confirmed",
  "pending",
  "applied",
] as const;

interface ApplicationData {
  applicantId?: string;
}

export interface JobPostingNotificationSpec {
  type: NotificationType;
  title: string;
  body: string;
  options?: CreateNotificationOptions;
}

interface JobPostingNotificationDependencies {
  fetchApplications: (jobPostingId: string) => Promise<ApplicationData[]>;
  broadcast: (
    recipientIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    options?: CreateNotificationOptions,
  ) => Promise<Map<string, NotificationResult>>;
}

export interface JobPostingNotificationDispatchResult {
  applicantIds: string[];
  totalApplicants: number;
  totalSuccess: number;
  totalFailure: number;
  skipped: boolean;
}

async function fetchApplicationsForJobPosting(
  jobPostingId: string,
): Promise<ApplicationData[]> {
  const snapshot = await admin
    .firestore()
    .collection("applications")
    .where("jobPostingId", "==", jobPostingId)
    .where("status", "in", [...NOTIFIABLE_APPLICATION_STATUSES])
    .get();

  return snapshot.docs.map((doc) => doc.data() as ApplicationData);
}

const defaultDependencies: JobPostingNotificationDependencies = {
  fetchApplications: fetchApplicationsForJobPosting,
  broadcast: broadcastNotification,
};

export function collectApplicantIds(applications: ApplicationData[]): string[] {
  return [
    ...new Set(
      applications
        .map((application) => application.applicantId)
        .filter((applicantId): applicantId is string => Boolean(applicantId)),
    ),
  ];
}

export function summarizeNotificationResults(
  results: Map<string, NotificationResult>,
): Pick<JobPostingNotificationDispatchResult, "totalSuccess" | "totalFailure"> {
  let totalSuccess = 0;
  let totalFailure = 0;

  results.forEach((result) => {
    totalSuccess += result.successCount;
    totalFailure += result.failureCount;
  });

  return { totalSuccess, totalFailure };
}

export async function notifyApplicantsForJobPostingChange(
  jobPostingId: string,
  spec: JobPostingNotificationSpec,
  logLabel: string,
  dependencies: JobPostingNotificationDependencies = defaultDependencies,
): Promise<JobPostingNotificationDispatchResult> {
  const applications = await dependencies.fetchApplications(jobPostingId);
  const applicantIds = collectApplicantIds(applications);

  if (applicantIds.length === 0) {
    logger.info("알림 대상 지원자가 없습니다", { jobPostingId });
    return {
      applicantIds: [],
      totalApplicants: 0,
      totalSuccess: 0,
      totalFailure: 0,
      skipped: true,
    };
  }

  logger.info("알림 대상 지원자 수", {
    jobPostingId,
    count: applicantIds.length,
  });

  const results = await dependencies.broadcast(
    applicantIds,
    spec.type,
    spec.title,
    spec.body,
    spec.options,
  );
  const { totalSuccess, totalFailure } = summarizeNotificationResults(results);

  logger.info(`${logLabel} 알림 전체 처리 완료`, {
    jobPostingId,
    totalApplicants: applicantIds.length,
    totalSuccess,
    totalFailure,
  });

  return {
    applicantIds,
    totalApplicants: applicantIds.length,
    totalSuccess,
    totalFailure,
    skipped: false,
  };
}
