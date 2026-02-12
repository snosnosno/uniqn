/**
 * QR 출퇴근 확인 알림 Firebase Functions
 *
 * @description
 * WorkLog에 checkInTime/checkOutTime이 설정되면 근무자+구인자에게 FCM 푸시 알림 전송
 * - checkInTime 설정: 출근 확인 알림
 * - checkOutTime 설정: 퇴근 확인 알림
 *
 * @trigger Firestore onUpdate
 * @collection workLogs/{workLogId}
 * @version 3.0.0
 * @since 2025-01-18
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createAndSendNotification } from '../utils/notificationUtils';
import { formatTime, extractUserId } from '../utils/helpers';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface JobPostingData {
  title?: string;
  location?: string;
  ownerId?: string;
  createdBy?: string;
}

interface WorkLogData {
  staffId: string;
  jobPostingId: string;
  date?: string;
  checkInTime?: admin.firestore.Timestamp | null;
  checkOutTime?: admin.firestore.Timestamp | null;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * QR 출퇴근 확인 알림 트리거
 *
 * @description
 * - WorkLog checkInTime/checkOutTime 변경 감지
 * - 근무자에게 check_in_confirmed/check_out_confirmed 알림 전송
 * - 구인자에게 staff_checked_in/staff_checked_out 알림 전송
 */
export const onCheckInOut = onDocumentUpdated(
  { document: 'workLogs/{workLogId}', region: 'asia-northeast3' },
  async (event) => {
    const workLogId = event.params.workLogId;
    const before = event.data?.before.data() as WorkLogData | undefined;
    const after = event.data?.after.data() as WorkLogData | undefined;
    if (!before || !after) return;

    // 출근/퇴근 시간 변경 확인
    const isCheckIn = !before.checkInTime && after.checkInTime;
    const isCheckOut = !before.checkOutTime && after.checkOutTime;

    if (!isCheckIn && !isCheckOut) {
      return; // 출퇴근 시간 변경 없음
    }

    // 출근+퇴근 동시 설정 시 (데이터 복구 등) 각각 처리
    const checkTypes: Array<'check_in' | 'check_out'> = [];
    if (isCheckIn) checkTypes.push('check_in');
    if (isCheckOut) checkTypes.push('check_out');

    logger.info('QR 출퇴근 감지', {
      workLogId,
      staffId: after.staffId,
      jobPostingId: after.jobPostingId,
      checkTypes,
    });

    try {
      // 1. 공고 정보 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(after.jobPostingId)
        .get();

      if (!jobPostingDoc.exists) {
        logger.warn('공고를 찾을 수 없습니다', {
          workLogId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;

      // 2. 근무자 정보 조회 (스태프 이름 - 구인자 알림용)
      const actualUserId = extractUserId(after.staffId);
      const staffDoc = await db.collection('users').doc(actualUserId).get();

      if (!staffDoc.exists) {
        logger.warn('근무자를 찾을 수 없습니다', {
          workLogId,
          staffId: after.staffId,
          actualUserId,
        });
        return;
      }

      const staffName = staffDoc.data()?.name || '스태프';
      const employerId = jobPosting?.ownerId ?? jobPosting?.createdBy;

      // 3. 각 체크 타입별 알림 전송 (동시 출퇴근 시 양쪽 모두 처리)
      for (const checkType of checkTypes) {
        const isIn = checkType === 'check_in';
        const checkTime = isIn ? after.checkInTime : after.checkOutTime;
        const formattedTime = formatTime(checkTime);

        // 근무자 알림
        const staffResult = await createAndSendNotification(
          actualUserId,
          isIn ? 'check_in_confirmed' : 'check_out_confirmed',
          isIn ? '✅ 출근 확인' : '✅ 퇴근 확인',
          `'${jobPosting?.title || '이벤트'}' ${isIn ? '출근' : '퇴근'}이 확인되었습니다. (${formattedTime})`,
          {
            link: '/schedule',
            data: {
              workLogId,
              jobPostingId: after.jobPostingId,
              jobPostingTitle: jobPosting?.title || '',
              date: after.date || '',
              checkTime: formattedTime,
            },
          }
        );

        logger.info(`${checkType} 알림 전송 완료 (근무자)`, {
          notificationId: staffResult.notificationId,
          staffId: after.staffId,
          fcmSent: staffResult.fcmSent,
        });

        // 구인자 알림
        if (employerId) {
          const employerResult = await createAndSendNotification(
            employerId,
            isIn ? 'staff_checked_in' : 'staff_checked_out',
            isIn ? '🟢 출근 알림' : '🔴 퇴근 알림',
            `${staffName}님이 ${formattedTime}에 ${isIn ? '출근' : '퇴근'}했습니다.`,
            {
              link: `/employer/applicants/${after.jobPostingId}`,
              data: {
                workLogId,
                jobPostingId: after.jobPostingId,
                jobPostingTitle: jobPosting?.title || '',
                staffId: after.staffId,
                staffName,
                date: after.date || '',
                checkTime: formattedTime,
              },
            }
          );

          logger.info(`${checkType} 알림 전송 완료 (구인자)`, {
            notificationId: employerResult.notificationId,
            employerId,
            fcmSent: employerResult.fcmSent,
          });
        }
      }
    } catch (error: unknown) {
      logger.error('출퇴근 알림 처리 중 오류 발생', {
        workLogId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });
