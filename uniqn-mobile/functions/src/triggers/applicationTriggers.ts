/**
 * UNIQN Functions - 지원 관련 트리거
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendNotification } from '../utils/notifications';
import { ApplicationDoc, JobPostingDoc, ScheduleDoc } from '../types';

const db = admin.firestore();

/**
 * 새 지원 생성 시 → 구인자에게 알림
 */
export const onApplicationCreated = functions
  .region('asia-northeast3') // 서울 리전
  .firestore
  .document('applications/{applicationId}')
  .onCreate(async (snapshot, context) => {
    const application = snapshot.data() as ApplicationDoc;
    const applicationId = context.params.applicationId;

    try {
      // 공고 정보 조회
      const jobDoc = await db.collection('jobPostings').doc(application.jobPostingId).get();
      if (!jobDoc.exists) {
        console.error(`Job posting not found: ${application.jobPostingId}`);
        return;
      }

      const job = jobDoc.data() as JobPostingDoc;

      // 구인자에게 알림 전송
      await sendNotification(job.employerId, 'new_application', {
        applicationId,
        jobPostingId: application.jobPostingId,
        jobTitle: job.title,
        applicantId: application.applicantId,
        applicantName: application.applicantName,
      });

      console.log(`New application notification sent to employer: ${job.employerId}`);
    } catch (error) {
      console.error('Error in onApplicationCreated:', error);
    }
  });

/**
 * 지원 상태 변경 시 → 지원자에게 알림
 */
export const onApplicationStatusChanged = functions
  .region('asia-northeast3')
  .firestore
  .document('applications/{applicationId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as ApplicationDoc;
    const after = change.after.data() as ApplicationDoc;
    const applicationId = context.params.applicationId;

    // 상태가 변경되지 않았으면 무시
    if (before.status === after.status) {
      return;
    }

    try {
      // 공고 정보 조회
      const jobDoc = await db.collection('jobPostings').doc(after.jobPostingId).get();
      if (!jobDoc.exists) {
        console.error(`Job posting not found: ${after.jobPostingId}`);
        return;
      }

      const job = jobDoc.data() as JobPostingDoc;
      const notificationData = {
        applicationId,
        jobPostingId: after.jobPostingId,
        jobTitle: job.title,
        location: job.location,
      };

      // 상태별 알림 전송
      switch (after.status) {
        case 'confirmed': {
          // 스케줄 정보 조회 (확정 시 스케줄이 생성됨)
          const scheduleSnapshot = await db.collection('schedules')
            .where('applicationId', '==', applicationId)
            .limit(1)
            .get();

          let scheduleDate = '';
          if (!scheduleSnapshot.empty) {
            const schedule = scheduleSnapshot.docs[0].data() as ScheduleDoc;
            scheduleDate = schedule.date.toDate().toISOString().split('T')[0];
          }

          await sendNotification(after.applicantId, 'application_confirmed', {
            ...notificationData,
            scheduleDate,
          });

          // 30분 전 리마인더 예약 (스케줄된 함수가 처리)
          if (!scheduleSnapshot.empty) {
            const schedule = scheduleSnapshot.docs[0];
            await schedule.ref.update({
              reminderScheduled: true,
            });
          }
          break;
        }

        case 'rejected':
          await sendNotification(after.applicantId, 'application_rejected', notificationData);
          break;

        case 'cancelled':
          // 확정 취소 (구인자가 취소한 경우)
          if (before.status === 'confirmed') {
            await sendNotification(after.applicantId, 'confirmation_cancelled', notificationData);
          }
          break;
      }

      console.log(`Application status changed: ${before.status} -> ${after.status}`);
    } catch (error) {
      console.error('Error in onApplicationStatusChanged:', error);
    }
  });
