/**
 * UNIQN Functions - 근무 기록 관련 트리거
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendNotification } from '../utils/notifications';
import { WorkLogDoc, JobPostingDoc, UserDoc } from '../types';

const db = admin.firestore();

/**
 * 출근 체크 시 → 구인자에게 알림
 */
export const onCheckIn = functions
  .region('asia-northeast3')
  .firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as WorkLogDoc;
    const after = change.after.data() as WorkLogDoc;

    // 출근 체크가 아닌 경우 무시
    if (before.checkInTime || !after.checkInTime) {
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

      // 구인자에게 알림 전송
      await sendNotification(job.employerId, 'staff_checked_in', {
        workLogId: context.params.workLogId,
        jobPostingId: after.jobPostingId,
        jobTitle: job.title,
        staffId: after.staffId,
        staffName: after.staffName,
        checkInTime: after.checkInTime.toDate().toLocaleTimeString('ko-KR'),
      });

      console.log(`Check-in notification sent for: ${after.staffName}`);
    } catch (error) {
      console.error('Error in onCheckIn:', error);
    }
  });

/**
 * 퇴근 체크 시 → 구인자에게 알림
 */
export const onCheckOut = functions
  .region('asia-northeast3')
  .firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as WorkLogDoc;
    const after = change.after.data() as WorkLogDoc;

    // 퇴근 체크가 아닌 경우 무시
    if (before.checkOutTime || !after.checkOutTime) {
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

      // 근무 시간 계산
      const checkIn = after.checkInTime?.toDate();
      const checkOut = after.checkOutTime.toDate();
      const workMinutes = checkIn
        ? Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000)
        : 0;
      const workHours = `${Math.floor(workMinutes / 60)}시간 ${workMinutes % 60}분`;

      // 구인자에게 알림 전송
      await sendNotification(job.employerId, 'staff_checked_out', {
        workLogId: context.params.workLogId,
        jobPostingId: after.jobPostingId,
        jobTitle: job.title,
        staffId: after.staffId,
        staffName: after.staffName,
        workHours,
        checkOutTime: checkOut.toLocaleTimeString('ko-KR'),
      });

      console.log(`Check-out notification sent for: ${after.staffName}`);
    } catch (error) {
      console.error('Error in onCheckOut:', error);
    }
  });

/**
 * 근무 시간 수정 시 → 스태프에게 알림
 */
export const onWorkTimeChanged = functions
  .region('asia-northeast3')
  .firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as WorkLogDoc;
    const after = change.after.data() as WorkLogDoc;

    // 수정 이력이 추가되지 않았으면 무시
    const beforeHistory = before.modificationHistory || [];
    const afterHistory = after.modificationHistory || [];

    if (afterHistory.length <= beforeHistory.length) {
      return;
    }

    // 관리자가 수정한 경우만 알림 (스태프 본인 수정은 알림 없음)
    const latestModification = afterHistory[afterHistory.length - 1];
    if (latestModification.modifiedBy === after.staffId) {
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
      const scheduleDate = job.eventDate.toDate().toISOString().split('T')[0];

      // 스태프에게 알림 전송
      await sendNotification(after.staffId, 'work_time_changed', {
        workLogId: context.params.workLogId,
        jobPostingId: after.jobPostingId,
        jobTitle: job.title,
        scheduleDate,
        reason: latestModification.reason || '관리자 수정',
      });

      console.log(`Work time changed notification sent to: ${after.staffId}`);
    } catch (error) {
      console.error('Error in onWorkTimeChanged:', error);
    }
  });
