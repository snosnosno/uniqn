/**
 * 정산 완료 알림 Firebase Functions
 *
 * @description
 * WorkLog의 settlementStatus가 'completed'로 변경되면 스태프에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onUpdate
 * @collection workLogs/{workLogId}
 * @version 2.0.0
 * @since 2025-02-01
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createAndSendNotification } from '../utils/notificationUtils';
import { extractUserId } from '../utils/helpers';
import { STATUS } from '../constants/status';
import { handleTriggerError } from '../errors';

const db = admin.firestore();

/**
 * 정산 완료 알림 트리거
 *
 * @description
 * - WorkLog settlementStatus가 'completed'로 변경되면 실행
 * - 스태프(workLog.staffId에서 userId 추출)에게 알림 전송
 */
export const onSettlementCompleted = onDocumentUpdated(
  { document: 'workLogs/{workLogId}', region: 'asia-northeast3' },
  async (event) => {
    const workLogId = event.params.workLogId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // settlementStatus가 completed로 변경된 경우만 처리
    if (
      before.settlementStatus === after.settlementStatus ||
      after.settlementStatus !== STATUS.PAYROLL.COMPLETED
    ) {
      return;
    }

    logger.info('정산 완료 감지', {
      workLogId,
      staffId: after.staffId,
      jobPostingId: after.jobPostingId,
      beforeStatus: before.settlementStatus,
      afterStatus: after.settlementStatus,
    });

    try {
      // 1. 스태프 userId 추출
      const actualUserId = extractUserId(after.staffId);

      // 2. 공고 제목 조회
      const jobPostingDoc = await db
        .collection('jobPostings')
        .doc(after.jobPostingId)
        .get();

      const jobPostingTitle = jobPostingDoc.exists
        ? jobPostingDoc.data()?.title || ''
        : '';

      // 3. 정산 금액 포맷
      const totalPay = after.totalPay || 0;
      const formattedPay = totalPay.toLocaleString('ko-KR');

      // 4. 알림 내용 생성
      const notificationBody = jobPostingTitle
        ? `'${jobPostingTitle}' 정산이 완료되었습니다. (${formattedPay}원)`
        : `정산이 완료되었습니다. (${formattedPay}원)`;

      // 5. 알림 전송 (data 값은 모두 String 변환 필요)
      const result = await createAndSendNotification(
        actualUserId,
        'settlement_completed',
        '💰 정산 완료',
        notificationBody,
        {
          link: '/schedule',
          priority: 'high',
          relatedId: workLogId,
          data: {
            workLogId,
            jobPostingId: after.jobPostingId,
            jobPostingTitle,
            date: after.date || '',
            totalPay: String(totalPay),
            hourlyRate: String(after.hourlyRate || 0),
            totalHours: String(after.totalHours || 0),
          },
        }
      );

      logger.info('정산 완료 알림 전송 완료', {
        notificationId: result.notificationId,
        staffId: after.staffId,
        totalPay,
        fcmSent: result.fcmSent,
      });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: 'onSettlementCompleted',
        context: { workLogId, staffId: after.staffId },
      });
    }
  });
