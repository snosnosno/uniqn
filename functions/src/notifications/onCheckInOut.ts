import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { handleTriggerError } from '../errors';
import { createAndSendNotification } from '../utils/notificationUtils';
import { extractUserId, formatTime } from '../utils/helpers';

const db = admin.firestore();

interface JobPostingData {
  title?: string;
  ownerId?: string;
  createdBy?: string;
}

interface UserData {
  name?: string;
  nickname?: string;
}

interface WorkLogData {
  staffId: string;
  jobPostingId: string;
  date?: string;
  checkInTime?: admin.firestore.Timestamp | null;
  checkOutTime?: admin.firestore.Timestamp | null;
}

export const onCheckInOut = onDocumentUpdated(
  { document: 'workLogs/{workLogId}', region: 'asia-northeast3' },
  async (event) => {
    const workLogId = event.params.workLogId;
    const before = event.data?.before.data() as WorkLogData | undefined;
    const after = event.data?.after.data() as WorkLogData | undefined;

    if (!before || !after) {
      return;
    }

    const didCheckIn = !before.checkInTime && !!after.checkInTime;
    const didCheckOut = !before.checkOutTime && !!after.checkOutTime;

    if (!didCheckIn && !didCheckOut) {
      return;
    }

    try {
      const jobPostingDoc = await db.collection('jobPostings').doc(after.jobPostingId).get();
      if (!jobPostingDoc.exists) {
        logger.warn('Job posting not found for check-in/out notification', {
          workLogId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;
      const staffUserId = extractUserId(after.staffId);
      const staffDoc = await db.collection('users').doc(staffUserId).get();
      const staffData = (staffDoc.data() as UserData | undefined) ?? {};
      const staffName = staffData.nickname ?? staffData.name ?? '스태프';
      const jobLabel = jobPosting.title ? `'${jobPosting.title}'` : '해당 근무';
      const employerId = jobPosting.ownerId ?? jobPosting.createdBy;

      if (didCheckIn) {
        const checkInTime = formatTime(after.checkInTime);

        await createAndSendNotification(
          staffUserId,
          'check_in_confirmed',
          '출근 확인',
          `${jobLabel} 출근이 ${checkInTime}에 기록되었습니다.`,
          {
            link: '/schedule',
            relatedId: workLogId,
            data: {
              workLogId,
              jobPostingId: after.jobPostingId,
              jobPostingTitle: jobPosting.title ?? '',
              date: after.date ?? '',
              checkTime: checkInTime,
            },
          }
        );

        if (employerId) {
          await createAndSendNotification(
            employerId,
            'staff_checked_in',
            '출근 알림',
            `${staffName}님이 ${checkInTime}에 출근했습니다.`,
            {
              link: `/employer/applicants/${after.jobPostingId}`,
              relatedId: workLogId,
              senderId: staffUserId,
              data: {
                workLogId,
                jobPostingId: after.jobPostingId,
                jobPostingTitle: jobPosting.title ?? '',
                staffId: after.staffId,
                staffName,
                date: after.date ?? '',
                checkTime: checkInTime,
              },
            }
          );
        }
      }

      if (didCheckOut) {
        const checkOutTime = formatTime(after.checkOutTime);

        await createAndSendNotification(
          staffUserId,
          'check_out_confirmed',
          '퇴근 확인',
          `${jobLabel} 퇴근이 ${checkOutTime}에 기록되었습니다.`,
          {
            link: '/schedule',
            relatedId: workLogId,
            data: {
              workLogId,
              jobPostingId: after.jobPostingId,
              jobPostingTitle: jobPosting.title ?? '',
              date: after.date ?? '',
              checkTime: checkOutTime,
            },
          }
        );

        if (employerId) {
          await createAndSendNotification(
            employerId,
            'staff_checked_out',
            '퇴근 알림',
            `${staffName}님이 ${checkOutTime}에 퇴근했습니다.`,
            {
              link: `/employer/applicants/${after.jobPostingId}`,
              relatedId: workLogId,
              senderId: staffUserId,
              data: {
                workLogId,
                jobPostingId: after.jobPostingId,
                jobPostingTitle: jobPosting.title ?? '',
                staffId: after.staffId,
                staffName,
                date: after.date ?? '',
                checkTime: checkOutTime,
              },
            }
          );
        }

        await createAndSendNotification(
          staffUserId,
          'review_request',
          '평가 요청',
          `${jobLabel} 근무가 완료되었습니다. 평가를 남겨주세요.`,
          {
            link: `/reviews/${workLogId}`,
            relatedId: workLogId,
            data: {
              workLogId,
              jobPostingId: after.jobPostingId,
              jobPostingTitle: jobPosting.title ?? '',
            },
          }
        );

        if (employerId) {
          await createAndSendNotification(
            employerId,
            'review_request',
            '평가 요청',
            `${jobLabel} 근무가 완료되었습니다. ${staffName}님에 대한 평가를 남겨주세요.`,
            {
              link: `/reviews/${workLogId}`,
              relatedId: workLogId,
              senderId: staffUserId,
              data: {
                workLogId,
                jobPostingId: after.jobPostingId,
                jobPostingTitle: jobPosting.title ?? '',
                staffName,
              },
            }
          );
        }
      }
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: 'onCheckInOut',
        context: { workLogId, staffId: after.staffId },
      });
    }
  }
);
