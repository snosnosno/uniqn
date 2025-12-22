/**
 * UNIQN Functions - 스케줄 작업
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendNotification, sendNotificationToMany } from '../utils/notifications';
import { ScheduleDoc, JobPostingDoc } from '../types';

const db = admin.firestore();

/**
 * 출근 30분 전 리마인더
 * 매 5분마다 실행 (00:00, 00:05, 00:10, ...)
 */
export const sendCheckinReminders = functions
  .region('asia-northeast3')
  .pubsub
  .schedule('every 5 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
    const thirtyFiveMinutesLater = new Date(now.getTime() + 35 * 60 * 1000);

    // 30분 후가 출근 시간인 스케줄 조회
    const targetDate = now.toISOString().split('T')[0];

    try {
      const schedulesSnapshot = await db.collection('schedules')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(new Date(targetDate)))
        .where('date', '<', admin.firestore.Timestamp.fromDate(new Date(targetDate + 'T23:59:59')))
        .where('status', '==', 'scheduled')
        .where('reminderSent', '==', false)
        .get();

      const batch = db.batch();
      const notifications: Promise<void>[] = [];

      for (const doc of schedulesSnapshot.docs) {
        const schedule = doc.data() as ScheduleDoc;

        // 시작 시간 파싱 (HH:MM 형식)
        const [hours, minutes] = schedule.startTime.split(':').map(Number);
        const startDateTime = new Date(schedule.date.toDate());
        startDateTime.setHours(hours, minutes, 0, 0);

        // 30분 전 ~ 35분 전 사이인지 확인
        if (startDateTime >= thirtyMinutesLater && startDateTime < thirtyFiveMinutesLater) {
          // 공고 정보 조회
          const jobDoc = await db.collection('jobPostings').doc(schedule.jobPostingId).get();
          if (jobDoc.exists) {
            const job = jobDoc.data() as JobPostingDoc;

            notifications.push(
              sendNotification(schedule.staffId, 'checkin_reminder', {
                scheduleId: doc.id,
                jobPostingId: schedule.jobPostingId,
                jobTitle: job.title,
                startTime: schedule.startTime,
              })
            );

            // 리마인더 전송 표시
            batch.update(doc.ref, { reminderSent: true });
          }
        }
      }

      await Promise.all(notifications);
      await batch.commit();

      console.log(`Sent ${notifications.length} checkin reminders`);
    } catch (error) {
      console.error('Error in sendCheckinReminders:', error);
    }
  });

/**
 * No-show 체크
 * 매 5분마다 실행
 * 출근 시간 30분 경과 후 미출근자 알림
 */
export const checkNoShow = functions
  .region('asia-northeast3')
  .pubsub
  .schedule('every 5 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const thirtyFiveMinutesAgo = new Date(now.getTime() - 35 * 60 * 1000);
    const targetDate = now.toISOString().split('T')[0];

    try {
      const schedulesSnapshot = await db.collection('schedules')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(new Date(targetDate)))
        .where('date', '<', admin.firestore.Timestamp.fromDate(new Date(targetDate + 'T23:59:59')))
        .where('status', '==', 'scheduled')
        .where('noShowAlertSent', '==', false)
        .get();

      const batch = db.batch();
      const notifications: Promise<void>[] = [];

      for (const doc of schedulesSnapshot.docs) {
        const schedule = doc.data() as ScheduleDoc;

        // 시작 시간 파싱
        const [hours, minutes] = schedule.startTime.split(':').map(Number);
        const startDateTime = new Date(schedule.date.toDate());
        startDateTime.setHours(hours, minutes, 0, 0);

        // 시작 시간이 30분 ~ 35분 전인지 확인
        if (startDateTime <= thirtyMinutesAgo && startDateTime > thirtyFiveMinutesAgo) {
          // 공고 정보 조회
          const jobDoc = await db.collection('jobPostings').doc(schedule.jobPostingId).get();
          if (jobDoc.exists) {
            const job = jobDoc.data() as JobPostingDoc;

            // 스태프 정보 조회
            const staffDoc = await db.collection('users').doc(schedule.staffId).get();
            const staffName = staffDoc.exists ? staffDoc.data()?.name || '미확인' : '미확인';

            // 구인자에게 알림
            notifications.push(
              sendNotification(job.employerId, 'no_show_alert', {
                scheduleId: doc.id,
                jobPostingId: schedule.jobPostingId,
                jobTitle: job.title,
                staffId: schedule.staffId,
                staffName,
              })
            );

            // 스케줄 상태 업데이트
            batch.update(doc.ref, {
              status: 'no_show',
              noShowAlertSent: true,
            });
          }
        }
      }

      await Promise.all(notifications);
      await batch.commit();

      console.log(`Sent ${notifications.length} no-show alerts`);
    } catch (error) {
      console.error('Error in checkNoShow:', error);
    }
  });

/**
 * 오래된 알림 정리
 * 매일 새벽 3시 실행
 * 30일 이상 된 읽은 알림 삭제
 */
export const cleanupOldNotifications = functions
  .region('asia-northeast3')
  .pubsub
  .schedule('0 3 * * *') // 매일 03:00
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const oldNotificationsSnapshot = await db.collection('notifications')
        .where('isRead', '==', true)
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .limit(500) // 한 번에 최대 500개
        .get();

      if (oldNotificationsSnapshot.empty) {
        console.log('No old notifications to cleanup');
        return;
      }

      const batch = db.batch();
      oldNotificationsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Cleaned up ${oldNotificationsSnapshot.size} old notifications`);
    } catch (error) {
      console.error('Error in cleanupOldNotifications:', error);
    }
  });
