/**
 * 문의 접수 알림 Firebase Functions
 *
 * @description
 * 새로운 문의가 접수되면 모든 관리자에게 FCM 푸시 알림 전송
 *
 * @trigger Firestore onCreate
 * @collection inquiries/{inquiryId}
 * @version 1.0.0
 * @since 2025-02-01
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { broadcastNotification } from '../utils/notificationUtils';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface InquiryData {
  userId: string;
  userName: string;
  userEmail?: string;
  category: string;
  subject: string;
  message: string;
  status: string;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 문의 접수 알림 트리거
 *
 * @description
 * - 새로운 문의가 생성되면 실행
 * - 모든 관리자에게 알림 전송
 */
export const onInquiryCreated = functions.region('asia-northeast3').firestore
  .document('inquiries/{inquiryId}')
  .onCreate(async (snap, context) => {
    const inquiryId = context.params.inquiryId;
    const inquiry = snap.data() as InquiryData;

    functions.logger.info('새로운 문의 접수', {
      inquiryId,
      userName: inquiry.userName,
      category: inquiry.category,
      subject: inquiry.subject,
    });

    try {
      // 1. 모든 관리자 조회
      const adminUsersSnap = await db
        .collection('users')
        .where('role', '==', 'admin')
        .get();

      if (adminUsersSnap.empty) {
        functions.logger.warn('관리자가 없습니다');
        return;
      }

      const adminIds = adminUsersSnap.docs.map((doc) => doc.id);

      functions.logger.info('알림 대상 관리자 수', {
        count: adminIds.length,
      });

      // 2. 알림 전송 (broadcastNotification 사용)
      const results = await broadcastNotification(
        adminIds,
        'new_inquiry',
        '💬 새로운 문의 접수',
        `${inquiry.userName}님의 문의: ${inquiry.subject}`,
        {
          link: `/admin/inquiries/${inquiryId}`,
          priority: 'normal',
          data: {
            inquiryId,
            category: inquiry.category,
            subject: inquiry.subject,
            userName: inquiry.userName,
          },
        }
      );

      // 3. 결과 로깅
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result) => {
        if (result.fcmSent) {
          successCount++;
        } else {
          failureCount++;
        }
      });

      functions.logger.info('문의 접수 알림 전송 완료', {
        inquiryId,
        totalAdmins: adminIds.length,
        successCount,
        failureCount,
      });
    } catch (error: unknown) {
      functions.logger.error('문의 접수 알림 처리 중 오류 발생', {
        inquiryId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });
